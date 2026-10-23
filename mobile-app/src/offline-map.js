const EARTH = 6371008.8;
let cachedMap;
let graph;
let viewport = { zoom: 1, x: 0, y: 0, centerLongitude: null, centerLatitude: null, focusId: null };
let currentCanvas;

export async function loadOfflineMap() {
  if (!cachedMap) cachedMap = fetch('./data/vijayawada-map.json').then(async response => {
    if (!response.ok) throw new Error('The offline road map could not be loaded.');
    const data = await response.json();
    if (!Array.isArray(data.coordinates) || !Array.isArray(data.roads) || !Array.isArray(data.bounds)) throw new Error('The offline map file is incomplete.');
    graph = buildGraph(data);
    return data;
  }).catch(error => { cachedMap = undefined; throw error; });
  return cachedMap;
}

export function placePoint(map, placeId) {
  const point = map?.places?.[placeId];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { longitude: point.x / map.coordinateScale, latitude: point.y / map.coordinateScale };
}

export function resetOfflineMapView() {
  viewport = { zoom: 1, x: 0, y: 0, centerLongitude: null, centerLatitude: null, focusId: null };
  if (currentCanvas) drawOfflineMap(currentCanvas, currentCanvas.__mapData, currentCanvas.__mapOptions);
}

function metersBetween(a, b) {
  const lat1 = a[1] / 1e5 * Math.PI / 180, lat2 = b[1] / 1e5 * Math.PI / 180;
  const dLat = lat2 - lat1, dLon = (b[0] - a[0]) / 1e5 * Math.PI / 180;
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
  return 2 * EARTH * Math.asin(Math.sqrt(s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2));
}

function buildGraph(map) {
  // Fastest-route estimates vary by road class. Explicit OSM maxspeed values
  // win when present; legacy extracts use conservative city-road estimates.
  const fallbackSpeeds = [80, 65, 50, 40, 30, 22, 12, 0];
  const pathClass = map.roadClasses.indexOf('path');
  const count = map.coordinates.length;
  const degree = new Uint32Array(count);
  const active = new Uint8Array(count);
  let edgeCount = 0;
  const parent = new Int32Array(count); for (let i = 0; i < count; i++) parent[i] = i;
  const rootOf = node => { while (parent[node] !== node) { parent[node] = parent[parent[node]]; node = parent[node]; } return node; };
  for (const road of map.roads) {
    const [, roadClass, path] = road, direction = road[3] || 0;
    if (roadClass === pathClass) continue;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      active[a] = 1; active[b] = 1;
      if (direction >= 0) degree[a]++;
      if (direction <= 0) degree[b]++;
      edgeCount += direction === 0 ? 2 : 1;
      const rootA = rootOf(a), rootB = rootOf(b); if (rootA !== rootB) parent[rootA] = rootB;
    }
  }
  const offsets = new Uint32Array(count + 1);
  for (let i = 0; i < count; i++) offsets[i + 1] = offsets[i] + degree[i];
  const cursor = offsets.slice(0, count);
  const neighbors = new Uint32Array(edgeCount), lengths = new Float32Array(edgeCount), costs = new Float32Array(edgeCount), roadIds = new Int32Array(edgeCount);
  for (let roadId = 0; roadId < map.roads.length; roadId++) {
    const road = map.roads[roadId], [, roadClass, path] = road, direction = road[3] || 0;
    if (roadClass === pathClass) continue;
    const speed = Number(road[4]) > 0 ? Number(road[4]) : fallbackSpeeds[roadClass] || 18;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], length = metersBetween(map.coordinates[a], map.coordinates[b]);
      if (direction >= 0) { const index = cursor[a]++; neighbors[index] = b; lengths[index] = length; costs[index] = length * 3.6 / speed; roadIds[index] = roadId; }
      if (direction <= 0) { const index = cursor[b]++; neighbors[index] = a; lengths[index] = length; costs[index] = length * 3.6 / speed; roadIds[index] = roadId; }
    }
  }
  const component = new Int32Array(count); component.fill(-1); const ids = new Map(); let nextId = 0;
  for (let node = 0; node < count; node++) if (active[node]) { const root = rootOf(node); if (!ids.has(root)) ids.set(root, nextId++); component[node] = ids.get(root); }
  return { offsets, neighbors, lengths, costs, roadIds, count, component };
}

function nearestNode(map, point) {
  const target = [point.longitude * map.coordinateScale, point.latitude * map.coordinateScale];
  const nearestByComponent = new Map();
  for (let i = 0; i < graph.count; i++) {
    const component = graph.component[i];
    if (component < 0) continue;
    const d = metersBetween(target, map.coordinates[i]);
    const current = nearestByComponent.get(component) || [];
    current.push({ node: i, distance: d, component }); current.sort((a,b)=>a.distance-b.distance);
    if (current.length > 4) current.pop(); nearestByComponent.set(component, current);
  }
  return [...nearestByComponent.values()].flat();
}

class MinHeap {
  constructor() { this.items = []; }
  push(item) {
    let i = this.items.length; this.items.push(item);
    while (i) { const p = (i - 1) >> 1; if (this.items[p][0] <= item[0]) break; this.items[i] = this.items[p]; i = p; }
    this.items[i] = item;
  }
  pop() {
    if (!this.items.length) return null;
    const root = this.items[0], last = this.items.pop();
    if (this.items.length) {
      let i = 0;
      while (true) { let c = i * 2 + 1; if (c >= this.items.length) break; if (c + 1 < this.items.length && this.items[c + 1][0] < this.items[c][0]) c++;
        if (this.items[c][0] >= last[0]) break; this.items[i] = this.items[c]; i = c; }
      this.items[i] = last;
    }
    return root;
  }
  get length() { return this.items.length; }
}

export function routeBetween(map, start, end) {
  if (!graph || !start || !end) return { error: 'Choose a mapped start point and destination first.' };
  const fromCandidates = nearestNode(map, start), toCandidates = nearestNode(map, end);
  const snapPairs = [];
  for (const from of fromCandidates) for (const to of toCandidates) {
    if (from.component !== to.component || from.distance > 1800 || to.distance > 1800) continue;
    snapPairs.push({ from, to, snapCost: from.distance + to.distance });
  }
  if (!snapPairs.length) return { error: 'A connected car road could not be found near both points in the saved map.' };
  snapPairs.sort((a,b)=>a.snapCost-b.snapCost);
  let result = null;
  for (const { from, to } of snapPairs.slice(0, 24)) {
    const distance = new Float64Array(graph.count); distance.fill(Infinity); distance[from.node] = 0;
    const previous = new Int32Array(graph.count); previous.fill(-1);
    const previousRoad = new Int32Array(graph.count); previousRoad.fill(-1);
    const open = new MinHeap(); open.push([metersBetween(map.coordinates[from.node], map.coordinates[to.node]) * 3.6 / 160, 0, from.node]);
    while (open.length) {
      const [, cost, node] = open.pop();
      if (cost !== distance[node]) continue;
      if (node === to.node) break;
      for (let edge = graph.offsets[node]; edge < graph.offsets[node + 1]; edge++) {
        const next = graph.neighbors[edge], candidate = cost + graph.costs[edge];
        if (candidate >= distance[next]) continue;
        distance[next] = candidate; previous[next] = node; previousRoad[next] = graph.roadIds[edge];
        const heuristic = metersBetween(map.coordinates[next], map.coordinates[to.node]) * 3.6 / 160;
        open.push([candidate + heuristic, candidate, next]);
      }
    }
    if (!Number.isFinite(distance[to.node])) continue;
    const nodes = [], edgeRoads = [];
    for (let node = to.node; node !== -1; node = previous[node]) {
      nodes.push(node);
      if (node !== from.node) edgeRoads.push(previousRoad[node]);
      if (node === from.node) break;
    }
    nodes.reverse(); edgeRoads.reverse();
    const meters = edgeRoads.reduce((sum, roadId, i) => sum + metersBetween(map.coordinates[nodes[i]], map.coordinates[nodes[i+1]]), 0);
    result = { nodes, edgeRoads, meters, durationSeconds: distance[to.node], fromSnap: from.distance, toSnap: to.distance }; break;
  }
  if (!result) return { error: 'A connected car route could not be found on the saved road map. Try another starting point or check the place map pin.' };
  return result;
}

function bearing(a, b, scale) {
  const lat1 = a[1] / scale * Math.PI / 180, lat2 = b[1] / scale * Math.PI / 180;
  const dLon = (b[0] - a[0]) / scale * Math.PI / 180;
  return (Math.atan2(Math.sin(dLon) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)) * 180 / Math.PI + 360) % 360;
}

function turnName(angle) {
  const absolute = Math.abs(angle);
  if (absolute < 35) return '';
  if (absolute > 145) return angle < 0 ? 'Make a U-turn' : 'Make a U-turn';
  if (absolute > 110) return angle < 0 ? 'Turn sharp left' : 'Turn sharp right';
  if (absolute > 60) return angle < 0 ? 'Turn left' : 'Turn right';
  return angle < 0 ? 'Bear left' : 'Bear right';
}

function compass(degrees) {
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(degrees / 45) % 8];
}

function formatDistance(meters) { return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(meters / 10) * 10)} m`; }

export function routeInstructions(map, route) {
  if (!route?.nodes || route.nodes.length < 2 || !route.edgeRoads?.length) return [];
  const chunks = [];
  let length = 0, startBearing = bearing(map.coordinates[route.nodes[0]], map.coordinates[route.nodes[1]], map.coordinateScale);
  let priorBearing = startBearing, roadId = route.edgeRoads[0];
  for (let i = 0; i < route.edgeRoads.length; i++) {
    const currentRoad = route.edgeRoads[i], currentBearing = bearing(map.coordinates[route.nodes[i]], map.coordinates[route.nodes[i + 1]], map.coordinateScale);
    if (i) {
      let angle = currentBearing - priorBearing;
      while (angle > 180) angle -= 360; while (angle < -180) angle += 360;
      const nameChange = map.roads[currentRoad][0] !== map.roads[roadId][0];
      const turn = turnName(angle);
      if ((turn || nameChange) && length >= 24) {
        chunks.push({ action: chunks.length ? turn || 'Continue' : `Head ${compass(startBearing)}`, road: map.names[roadId] || 'the road', meters: length });
        length = 0; roadId = currentRoad; startBearing = currentBearing;
      }
    }
    length += metersBetween(map.coordinates[route.nodes[i]], map.coordinates[route.nodes[i + 1]]);
    priorBearing = currentBearing;
    if (i === route.edgeRoads.length - 1) chunks.push({ action: chunks.length ? 'Continue' : `Head ${compass(startBearing)}`, road: map.names[roadId] || 'the road', meters: length });
  }
  return chunks;
}

function projection(canvas, map) {
  const rect = canvas.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
  const [west, south, east, north] = map.bounds, centerLat = (south + north) / 2;
  const cosine = Math.cos(centerLat * Math.PI / 180), factor = 111320;
  const worldWidth = (east - west) * cosine * factor, worldHeight = (north - south) * factor;
  const base = Math.min((width - 44) / worldWidth, (height - 44) / worldHeight);
  const scale = base * viewport.zoom;
  const cx = width / 2 + viewport.x, cy = height / 2 + viewport.y;
  const centerX = ((viewport.centerLongitude ?? (west + east) / 2) - west) * cosine * factor;
  const centerY = (north - (viewport.centerLatitude ?? centerLat)) * factor;
  const toXY = point => [cx + ((point[0] / map.coordinateScale - west) * cosine * factor - centerX) * scale,
    cy + ((north - point[1] / map.coordinateScale) * factor - centerY) * scale];
  const fromXY = (x, y) => ({ longitude: west + (((x - cx) / scale + centerX) / (cosine * factor)), latitude: north - (((y - cy) / scale + centerY) / factor) });
  return { width, height, scale, toXY, fromXY };
}

function focusDestination(canvas, map, destinationId, route, origin) {
  if (!destinationId) return;
  const originKey = origin ? `${origin.latitude.toFixed(4)}-${origin.longitude.toFixed(4)}` : '';
  const routeKey = route?.nodes?.length ? `route-${route.nodes[0]}-${route.nodes[route.nodes.length - 1]}-${destinationId}` : `${destinationId}-${originKey}`;
  if (viewport.focusId === routeKey) return;
  let centerLongitude, centerLatitude, zoom = 4.2;
  let focusPoints = route?.nodes?.length ? route.nodes.map(node => [map.coordinates[node][0] / map.coordinateScale, map.coordinates[node][1] / map.coordinateScale]) : [];
  if (!focusPoints.length && origin) {
    const destination = placePoint(map, destinationId);
    if (destination) focusPoints = [[destination.longitude, destination.latitude], [origin.longitude, origin.latitude]];
  }
  if (focusPoints.length) {
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (const [longitude, latitude] of focusPoints) {
      west = Math.min(west, longitude); east = Math.max(east, longitude); south = Math.min(south, latitude); north = Math.max(north, latitude);
    }
    centerLongitude = (west + east) / 2; centerLatitude = (south + north) / 2;
    const [mapWest, mapSouth, mapEast, mapNorth] = map.bounds, cosine = Math.cos(centerLatitude * Math.PI / 180), metersPerDegree = 111320;
    const fullWidth = (mapEast - mapWest) * Math.cos(((mapSouth + mapNorth) / 2) * Math.PI / 180) * metersPerDegree;
    const fullHeight = (mapNorth - mapSouth) * metersPerDegree;
    const base = Math.min((canvas.clientWidth - 44) / fullWidth, (canvas.clientHeight - 44) / fullHeight);
    const routeWidth = Math.max(80, (east - west) * cosine * metersPerDegree), routeHeight = Math.max(80, (north - south) * metersPerDegree);
    zoom = Math.min(8, Math.max(0.8, Math.min((canvas.clientWidth - 100) / (routeWidth * base), (canvas.clientHeight - 100) / (routeHeight * base))));
  } else {
    const point = placePoint(map, destinationId);
    if (!point) return;
    centerLongitude = point.longitude; centerLatitude = point.latitude;
  }
  viewport = { zoom, x: 0, y: 0, centerLongitude, centerLatitude, focusId: routeKey };
}

const colors = ['#d6aa88', '#cf9a70', '#bf8262', '#d7b47f', '#899d81', '#c3c9b7', '#dbd8ca', '#b7ccc4'];

function drawMapTag(context, label, x, y, color) {
  context.save();
  context.font = '700 9px Manrope, sans-serif';
  const width = Math.ceil(context.measureText(label).width + 12);
  context.fillStyle = color; context.fillRect(x, y - 9, width, 18);
  context.fillStyle = '#fff'; context.textAlign = 'left'; context.textBaseline = 'middle'; context.fillText(label, x + 6, y);
  context.restore();
}

export function drawOfflineMap(canvas, map, options = {}) {
  if (!canvas || !map) return;
  currentCanvas = canvas; canvas.__mapData = map; canvas.__mapOptions = options;
  const ratio = window.devicePixelRatio || 1, width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d'); context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const p = projection(canvas, map);
  context.fillStyle = '#f1f1e9'; context.fillRect(0, 0, p.width, p.height);
  context.beginPath();
  for (const [, path] of map.waterways || []) {
    if (path.length < 2) continue;
    path.forEach((point, i) => { const [x, y] = p.toXY(point); i ? context.lineTo(x, y) : context.moveTo(x, y); });
  }
  context.strokeStyle = '#9dbfc1'; context.lineWidth = 3.4; context.lineCap = 'round'; context.stroke();
  // Draw each road category in a single canvas path to keep large city extracts responsive.
  for (let roadClass = 0; roadClass < map.roadClasses.length; roadClass++) {
    context.beginPath();
    for (const [, type, path] of map.roads) {
      if (type !== roadClass || path.length < 2) continue;
      let started = false;
      for (const index of path) {
        const [x, y] = p.toXY(map.coordinates[index]);
        if (!started) { context.moveTo(x, y); started = true; } else context.lineTo(x, y);
      }
    }
    context.strokeStyle = colors[roadClass] || '#c7cbbc';
    context.lineWidth = roadClass <= 2 ? 2.4 : roadClass <= 4 ? 1.45 : roadClass === 7 ? 1.1 : 0.75;
    context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke();
  }
  if (options.route?.nodes?.length) {
    context.beginPath(); options.route.nodes.forEach((node, i) => { const [x, y] = p.toXY(map.coordinates[node]); i ? context.lineTo(x, y) : context.moveTo(x, y); });
    context.strokeStyle = '#245b49'; context.lineWidth = 4; context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke();
  }
  for (const place of options.destinations || []) {
    const point = placePoint(map, place.id); if (!point) continue;
    const [x, y] = p.toXY([point.longitude * map.coordinateScale, point.latitude * map.coordinateScale]);
    context.beginPath(); context.arc(x, y, place.id === options.destinationId ? 7 : 4.5, 0, Math.PI * 2);
    context.fillStyle = place.id === options.destinationId ? '#b75f43' : '#fdfcf8'; context.fill();
    context.lineWidth = 2; context.strokeStyle = '#355744'; context.stroke();
    if (place.id === options.destinationId && options.route) {
      drawMapTag(context, 'DESTINATION', x + 10, y - 8, '#a9543d');
    } else if (place.id === options.destinationId || viewport.zoom > 1.8) {
      context.font = '600 11px Manrope, sans-serif'; context.textAlign = 'left'; context.textBaseline = 'middle';
      context.fillStyle = '#203c31'; context.fillText(place.name, x + 9, y - 1, 150);
    }
  }
  const origin = options.origin;
  if (origin) {
    const [x, y] = p.toXY([origin.longitude * map.coordinateScale, origin.latitude * map.coordinateScale]);
    context.beginPath(); context.arc(x, y, 6.5, 0, Math.PI * 2); context.fillStyle = '#315e95'; context.fill();
    context.lineWidth = 2; context.strokeStyle = '#fff'; context.stroke();
    if (options.originLabel) drawMapTag(context, options.originLabel, x + 10, y + 10, '#315e95');
  }
  if (options.selectingKiosk) {
    context.fillStyle = '#315e95'; context.font = '600 11px Manrope, sans-serif'; context.textAlign = 'left'; context.fillText('Tap the map to place this kiosk', 12, 20);
  }
  return p;
}

export function bindOfflineMap(canvas, map, options = {}) {
  if (!canvas || !map) return;
  if (!options.selectingKiosk) focusDestination(canvas, map, options.destinationId, options.route, options.origin);
  canvas.__mapOptions = options;
  let pointerStart = null;
  let dragTracked = false;
  const redraw = () => drawOfflineMap(canvas, map, canvas.__mapOptions);
  if (!canvas.__offlineMapBound) {
    canvas.__offlineMapBound = true;
    canvas.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY, px: viewport.x, py: viewport.y }; dragTracked = false; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => { if (!pointerStart) return; const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y; if (Math.abs(dx) + Math.abs(dy) > 3) { if(!dragTracked){canvas.__mapOptions.onInteraction?.('map-pan');dragTracked=true;}viewport.x = pointerStart.px + dx; viewport.y = pointerStart.py + dy; redraw(); } });
    canvas.addEventListener('pointerup', event => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y; pointerStart = null;
      if (Math.abs(dx) + Math.abs(dy) > 6) return;
      const rect = canvas.getBoundingClientRect(), p = projection(canvas, map), point = p.fromXY(event.clientX - rect.left, event.clientY - rect.top);
      if (canvas.__mapOptions.selectingKiosk) canvas.__mapOptions.onPickKiosk?.(point);
    });
    canvas.addEventListener('wheel', event => { event.preventDefault();canvas.__mapOptions.onInteraction?.('map-gesture-zoom');viewport.zoom = Math.min(8, Math.max(0.8, viewport.zoom * (event.deltaY < 0 ? 1.12 : 0.89))); redraw(); }, { passive: false });
    new ResizeObserver(redraw).observe(canvas);
  }
  redraw();
}

export function adjustOfflineMapZoom(amount) {
  viewport.zoom = Math.min(8, Math.max(0.8, viewport.zoom * amount));
  if (currentCanvas) drawOfflineMap(currentCanvas, currentCanvas.__mapData, currentCanvas.__mapOptions);
}
