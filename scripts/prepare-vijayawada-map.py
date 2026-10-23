#!/usr/bin/env python3
"""Turn a BBBike OSM XML extract into compact, offline Guide Voyager map data."""
from __future__ import annotations

import argparse
import gzip
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROAD_CLASSES = {
    "motorway": 0, "motorway_link": 0, "trunk": 1, "trunk_link": 1,
    "primary": 2, "primary_link": 2, "secondary": 3, "secondary_link": 3,
    "tertiary": 4, "tertiary_link": 4, "residential": 5, "unclassified": 5,
    "living_street": 5, "service": 6, "pedestrian": 7, "footway": 7,
    "path": 7, "track": 7, "steps": 7, "cycleway": 7, "bridleway": 7,
}
CLASS_NAMES = ["motorway", "trunk", "primary", "secondary", "tertiary", "local", "service", "path"]
BOUNDS = [80.43, 16.38, 80.82, 16.65]

ALIASES = {
    "kanaka-durga-temple": ["Sri Durga Malleswara Swamy Varla Devasthanam", "Kanaka Durga Temple"],
    "prakasam-barrage": ["Prakasam Barrage"],
    "gandhi-hill": ["Gandhi Hill", "Gandhi Hill Rock Memorial", "Mahatma Gandhi Stupa"],
    "bhavani-island": ["Bhavani Island"],
    "undavalli-caves": ["Undavalli Caves", "Undavalli Cave"],
    "mangalagiri-temple": ["Panakala Lakshmi Narasimha Swamy Temple", "Mangalagiri Temple"],
    "vijayawada-railway-station": ["Vijayawada Junction Railway Station", "Vijayawada Junction"],
    "pandit-nehru-bus-station": ["Pandit Nehru Bus Station", "Pandit Nehru Bus Station , Vijayawada", "PNBS", "Vijayawada Bus Station"],
    "pvp-square": ["PVP Square", "PVP Square Mall"],
    "lepl-centro": ["LEPL Centro", "Centro Mall", "Centro"],
    "trendset-mall": ["Trendset Mall"],
    "laila-mall": ["Laila Mall"],
    "government-general-hospital-vijayawada": ["Government General Hospital Vijayawada", "Government General Hospital", "New Government Hospital"],
    "aayush-hospitals-vijayawada": ["Aayush Hospitals", "Aayush Hospital", "Aayush Hospitals Vijayawada"],
    "manipal-hospitals-vijayawada": ["Manipal Hospitals Vijayawada", "Manipal Super Specialty Hospital", "Manipal multi speciality Hospital"],
    "andhra-hospitals-vijayawada": ["Andhra Hospitals", "Andhra Hospital Vijayawada"],
    "rainbow-childrens-hospital-vijayawada": ["Rainbow Children's Hospital", "Rainbow Children's Hospital Vijayawada"],
    "hcg-cancer-hospital-vijayawada": ["HCG Cancer Hospital", "HCG Cancer Centre Vijayawada", "Health Care Global Curie City Cancer Centre - Vijayawada"],
    "vijayawada-city-police-commissionerate": ["Vijayawada City Police Commissionerate", "Commissioner of Police Vijayawada", "Vijayawada city Police"],
}

# Manual points are used only where the extract omits a named facility. Each point
# has a traceable coordinate source; nearby roads remain from the bundled OSM file.
MANUAL_POINTS = {
    "prakasam-barrage": {"x": 80.6325, "y": 16.509444, "name": "Prakasam Barrage", "source": "Krishna River Management Board", "url": "https://www.krmb.gov.in/html/project37.html"},
    "pvp-square": {"x": 80.642867, "y": 16.502358, "name": "PVP Square", "source": "Wikimedia Commons photo coordinates", "url": "https://commons.wikimedia.org/wiki/File:PVP_square_Vijayawada.jpg"},
    "laila-mall": {"x": 80.6284847, "y": 16.5065614, "name": "Laila Mall", "source": "Business listing coordinates", "url": "https://rentechdigital.com/smartscraper/business-report-details/india/andhra-pradesh/list-of-movie-theaters-in-vijayawada"},
    # Public passenger-terminal approach road, rather than the airport/runway centre.
    "vijayawada-international-airport": {"x": 80.7904709, "y": 16.522581, "name": "Vijayawada Airport new Terminal Road", "source": "OpenStreetMap mapped terminal access road", "url": "https://www.openstreetmap.org/?mlat=16.522581&mlon=80.7904709#map=18/16.522581/80.7904709", "accessNote": "Offline directions end at the mapped passenger-terminal approach road. Check airport notices and current road access before travelling."},
    "kondapalli-fort": {"x": 80.5293247, "y": 16.6247467, "name": "Kondapalli Fort Road entrance", "source": "OpenStreetMap mapped fort access road", "url": "https://www.openstreetmap.org/?mlat=16.6247467&mlon=80.5293247#map=17/16.6247467/80.5293247", "accessNote": "Offline directions end at the mapped Kondapalli Fort Road entrance. Confirm current fort opening and access locally."},
}

def norm(value: str) -> str:
    value = value.casefold().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()

def tags_of(element) -> dict[str, str]:
    return {tag.get("k", ""): tag.get("v", "") for tag in element.findall("tag")}

def is_named_feature(tags: dict[str, str]) -> bool:
    return bool(tags.get("name") and any(k in tags for k in (
        "amenity", "shop", "tourism", "historic", "railway", "public_transport",
        "leisure", "place", "healthcare", "office", "building", "man_made", "natural", "waterway",
    )))

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="BBBike .osm.gz file")
    parser.add_argument("destinations", type=Path, help="destinations.json")
    parser.add_argument("output", type=Path, help="output compact map JSON")
    parser.add_argument("--base-map", type=Path, help="existing bundled map; preserve its verified place pins and labels")
    args = parser.parse_args()

    node_coords: dict[str, tuple[int, int]] = {}
    features: list[dict] = []
    raw_roads: list[tuple[str, int, list[str], int, float | None]] = []
    raw_waterways: list[tuple[str, list[str]]] = []
    with gzip.open(args.source, "rb") as source:
        for _, element in ET.iterparse(source, events=("end",)):
            if element.tag not in ("node", "way"):
                if element.tag == "relation":
                    element.clear()
                continue
            if element.tag == "node":
                lat = float(element.get("lat", "0")); lon = float(element.get("lon", "0"))
                if BOUNDS[0] <= lon <= BOUNDS[2] and BOUNDS[1] <= lat <= BOUNDS[3]:
                    node_id = element.get("id", "")
                    node_coords[node_id] = (round(lon * 1e5), round(lat * 1e5))
                    tags = tags_of(element)
                    if is_named_feature(tags):
                        features.append({"n": tags["name"], "x": round(lon * 1e5), "y": round(lat * 1e5),
                                         "t": tags.get("amenity") or tags.get("shop") or tags.get("tourism") or tags.get("healthcare") or tags.get("railway") or tags.get("office") or "place"})
            elif element.tag == "way":
                tags = tags_of(element)
                refs = [node.get("ref", "") for node in element.findall("nd")]
                if tags.get("highway") in ROAD_CLASSES:
                    # Apply the most specific vehicle access tag available.
                    vehicle_access = (tags.get("motorcar") or tags.get("motor_vehicle") or
                                      tags.get("vehicle") or tags.get("access") or "").casefold()
                    if vehicle_access not in ("no", "private", "delivery", "customers", "agricultural", "forestry"):
                        highway = tags["highway"]
                        oneway = tags.get("oneway", "").casefold()
                        direction = -1 if oneway == "-1" else 1 if oneway in ("yes", "true", "1") or (oneway != "no" and (highway in ("motorway", "motorway_link") or tags.get("junction") == "roundabout")) else 0
                        speed_text = tags.get("maxspeed", "")
                        speed_match = re.search(r"\d+(?:\.\d+)?", speed_text)
                        speed_kmh = float(speed_match.group()) if speed_match else None
                        if speed_kmh and "mph" in speed_text.casefold():
                            speed_kmh *= 1.60934
                        raw_roads.append((tags.get("name") or tags.get("ref") or "", ROAD_CLASSES[highway], refs, direction, speed_kmh))
                if tags.get("waterway") in ("river", "canal", "stream", "riverbank"):
                    raw_waterways.append((tags.get("name") or "", refs))
                if is_named_feature(tags) and refs:
                    coords = [node_coords[ref] for ref in refs if ref in node_coords]
                    if coords:
                        features.append({"n": tags["name"], "x": round(sum(p[0] for p in coords) / len(coords)),
                                         "y": round(sum(p[1] for p in coords) / len(coords)),
                                         "t": tags.get("amenity") or tags.get("shop") or tags.get("tourism") or tags.get("healthcare") or tags.get("railway") or tags.get("office") or "place"})
            element.clear()

    node_ids: dict[str, int] = {}
    coords: list[list[int]] = []
    names: list[str] = []
    name_ids: dict[str, int] = {}
    roads: list[list] = []
    def coord_index(osm_id: str) -> int | None:
        coordinate = node_coords.get(osm_id)
        if not coordinate:
            return None
        if osm_id not in node_ids:
            node_ids[osm_id] = len(coords)
            coords.append([coordinate[0], coordinate[1]])
        return node_ids[osm_id]
    for name, road_class, refs, direction, speed_kmh in raw_roads:
        segments: list[int] = []
        for ref in refs:
            index = coord_index(ref)
            if index is None:
                if len(segments) > 1:
                    if name not in name_ids:
                        name_ids[name] = len(names); names.append(name)
                    roads.append([name_ids[name], road_class, segments, direction, speed_kmh])
                segments = []
                continue
            if not segments or segments[-1] != index:
                segments.append(index)
        if len(segments) > 1:
            if name not in name_ids:
                name_ids[name] = len(names); names.append(name)
            roads.append([name_ids[name], road_class, segments, direction, speed_kmh])

    waterways = []
    for water_name, refs in raw_waterways:
        segment = []
        for ref in refs:
            coordinate = node_coords.get(ref)
            if coordinate is None:
                if len(segment) > 1:
                    waterways.append([water_name, segment])
                segment = []
                continue
            segment.append([coordinate[0], coordinate[1]])
        if len(segment) > 1:
            waterways.append([water_name, segment])

    destinations = json.loads(args.destinations.read_text(encoding="utf-8"))
    normalized_features = [(norm(f["n"]), f) for f in features]
    matched: dict[str, dict] = {}
    unmatched: list[str] = []
    for destination in destinations:
        place_id = destination["id"]
        aliases = [norm(a) for a in ALIASES.get(place_id, [destination["name"]])]
        best = None; best_score = -1
        for normalized, feature in normalized_features:
            if not normalized:
                continue
            # Coordinates are only attached when the actual mapped feature name
            # matches an explicitly reviewed alias. Broad substring matching can
            # silently place hospitals at the city centre or on unrelated places.
            score = 100 if normalized in aliases else -1
            if score > best_score:
                best = feature; best_score = score
        if place_id in MANUAL_POINTS:
            point = MANUAL_POINTS[place_id]
            matched[place_id] = {"x": round(point["x"] * 1e5), "y": round(point["y"] * 1e5),
                                 "name": point["name"], "source": point["source"], "sourceUrl": point["url"]}
        elif best and best_score == 100:
            matched[place_id] = {"x": best["x"], "y": best["y"], "name": best["n"], "source": "OpenStreetMap extract"}
            if place_id == "government-general-hospital-vijayawada":
                # This record describes the Gunadala hospital, not the older city-centre facility.
                preferred = next((f for f in features if norm(f["n"]) == norm("Government General Hospital") and f["x"] == 8066963), None)
                if preferred:
                    matched[place_id] = {"x": preferred["x"], "y": preferred["y"], "name": preferred["n"], "source": "OpenStreetMap extract; Gunadala facility"}
            if place_id == "bhavani-island":
                terminal = next((f for f in features if norm(f["n"]) == norm("APSTDC BHAVANI ILAND SERVICE")), None)
                if terminal:
                    matched[place_id] = {"x": terminal["x"], "y": terminal["y"], "name": "APSTDC Bhavani Island boat service", "source": "OpenStreetMap extract", "accessNote": "This route ends at the mapped APSTDC boat service point. A boat crossing is required to reach Bhavani Island."}
            if place_id == "mangalagiri-temple":
                parking = next((f for f in features if norm(f["n"]) == norm("Panakala Swami Temple Parking")), None)
                if parking:
                    matched[place_id] = {"x": parking["x"], "y": parking["y"], "name": "Panakala Swami Temple parking", "source": "OpenStreetMap extract", "accessNote": "The mapped point is the temple parking/access area. Confirm onward hill access locally."}
        elif place_id == "bhavani-island":
            terminal = next((f for f in features if norm(f["n"]) == norm("APSTDC BHAVANI ILAND SERVICE")), None)
            if terminal:
                matched[place_id] = {"x": terminal["x"], "y": terminal["y"], "name": "APSTDC Bhavani Island boat service", "source": "OpenStreetMap extract", "accessNote": "This route ends at the mapped APSTDC boat service point. A boat crossing is required to reach Bhavani Island."}
            else:
                unmatched.append(place_id)
        elif place_id == "mangalagiri-temple":
            parking = next((f for f in features if norm(f["n"]) == norm("Panakala Swami Temple Parking")), None)
            if parking:
                matched[place_id] = {"x": parking["x"], "y": parking["y"], "name": "Panakala Swami Temple parking", "source": "OpenStreetMap extract", "accessNote": "The mapped point is the temple parking/access area. Confirm onward hill access locally."}
            else:
                unmatched.append(place_id)
        else:
            unmatched.append(place_id)

    # Keep named features useful for map labels and the destination coordinate check.
    previous_map = json.loads(args.base_map.read_text(encoding="utf-8")) if args.base_map and args.base_map.exists() else {}
    # Keep reviewed POIs already bundled in the app. The expanded extract is
    # road-only; it supplies new roads while previous verified points/labels stay.
    previous_places = previous_map.get("places", {})
    previous_places.update(matched)
    merged_features = {(f.get("n"), f.get("x"), f.get("y"), f.get("t")): f
                       for f in previous_map.get("features", [])}
    for feature in features:
        merged_features[(feature.get("n"), feature.get("x"), feature.get("y"), feature.get("t"))] = feature
    map_data = {
        "version": "2026-10-23-airport-kondapalli",
        "bounds": BOUNDS,
        "attribution": "© OpenStreetMap contributors; ODbL 1.0",
        "snapshot": "2026-10-19",
        "coordinateScale": 100000,
        "roadClasses": CLASS_NAMES,
        "names": names,
        "coordinates": coords,
        "roads": roads,
        "waterways": waterways or previous_map.get("waterways", []),
        "features": list(merged_features.values()),
        "places": previous_places,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(map_data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"nodes": len(coords), "roads": len(roads), "waterways": len(waterways), "features": len(features),
                      "matched": matched, "unmatched": unmatched, "outputBytes": args.output.stat().st_size}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
