import { all, put, remove, get } from './store.js';
import { inspectKioskQr } from './qr/contract.js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Geolocation } from '@capacitor/geolocation';
import { adjustOfflineMapZoom, bindOfflineMap, loadOfflineMap, placePoint, resetOfflineMapView, routeBetween, routeInstructions } from './offline-map.js';

const apiBaseUrl = (import.meta.env?.VITE_API_BASE_URL || window.GUIDE_VOYAGER_API_URL || '').replace(/\/+$/, '');
const apiUrl = path => `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
const copy = {
  en: {your_journey:'YOUR JOURNEY',home:'Home',explore:'Explore',maps:'Maps',saved:'Saved places',my_plan:'My plan',near_me:'Near me',transport:'Transport',ready_offline:'Ready offline',essentials_on_device:'Essentials on this device',settings:'Settings',offline_ready:'Offline ready',more:'More',discover:'DISCOVER AT YOUR OWN PACE',hero_title:'The Krishna, <em>in your own time.</em>',hero_copy:'A little local knowledge makes a journey feel like your own. Start with the stories, save a few places, and take Vijayawada at your pace.',explore_places:'Explore places',plan_day:'Plan my day',for_you:'A GOOD PLACE TO BEGIN',featured:'A few local favourites',see_all:'See all places',make_it_yours:'Make the day your own',make_it_yours_copy:'Save places for later or start a simple itinerary. Your choices stay on this device.',find_nearby:'Find nearby',build_plan:'Build an itinerary',govt_transport:'Government transport',scan_qr:'Kiosk QR',explore_title:'Find your kind of place',explore_sub:'A locally stored guide to Vijayawada and nearby landmarks.',search_placeholder:'Search places, themes or stories',all_places:'All places',empty_saved:'Nothing saved yet',empty_saved_copy:'Tap the heart on a place you want to come back to.',browse_places:'Browse places',empty_plan:'Your plan is waiting',empty_plan_copy:'Add a place to make a simple list for your day. It stays on this device.',add_first_place:'Add a place',nearby_title:'Explore on a map',nearby_sub:'Use your location or kiosk point to calculate directions over the offline Vijayawada map.',enable_location:'Use my location',location_pending:'Tap to share your current location with this device. We do not upload it.',transport_title:'Getting around',transport_sub:'Official transport hubs. Live schedules need an internet connection.',transport_note:'This guide does not show live arrivals or timetables. Check the official operator for current service information.',settings_title:'Make it yours',settings_sub:'Language, text size and what is stored on this device.',language:'App language',text_size:'Text size',small:'Small',standard:'Standard',large:'Large',local_data:'Your on-device data',favorites_label:'Saved places',itineraries_label:'Itineraries',feedback_label:'Feedback waiting to send',clear_data:'Clear guest data',content_update:'Tourism content',check_content:'Check for content updates',app_update:'App version',check_app:'Check for app updates',qr_title:'A kiosk code, when ready',qr_sub:'Scan a Guide Voyager kiosk code to open a place or a saved selection.',qr_pending:'The kiosk team has not supplied the QR format yet. This scanner will stay adaptable until their sample codes and specification are available.',qr_code_entry:'Paste a QR value',qr_placeholder:'Scanned value or test input',check_qr:'Check code',qr_scan:'Scan with camera',qr_result:'QR contents are not interpreted yet. The hardware team’s format is still pending.',back:'Back',add_to_plan:'Add to my plan',rate_place:'Rate this place',your_voice:'YOUR VOICE',optional_note:'A note, if you’d like',save_feedback:'Save feedback',feedback_offline_note:'Saved on this device and sent when you’re online.',feedback_saved:'Feedback saved on this device.',added_plan:'Added to your plan.',saved_place:'Saved for later.',removed_saved:'Removed from saved places.',plan_saved:'Your plan is saved on this device.',clear_confirm:'Clear saved places, itineraries, and unsent feedback on this device?',cleared:'Guest data cleared.',location_denied:'Location access was not available. You can still open place maps manually.',content_current:'Your offline guide is up to date.',content_failed:'Could not check for updates. Your current guide is unchanged.',app_current:'You have the latest app version available to this guide.',app_failed:'App version information is unavailable offline.',source:'Official source',unavailable:'Not verified for this guide',included:'Included in this guide',unknown_duration:'Times and access can change',plan_title:'A day, your way',plan_sub:'A saved list of places with local walking steps from the device or kiosk start point.',plan_name:'Plan name',plan_name_hint:'e.g. A slow morning by the river',choose_place:'Choose a place',add_place:'Add place',remove:'Remove',map_title:'Maps',map_copy:'The bundled Vijayawada street map and walking directions work offline. Confirm route access and local conditions before travelling.',no_route:'Walking directions are calculated on this device from the bundled road graph.',version:'Version',content_language:'Place content is shown in English; localized place names are available.',draft_login:'Admin tools are in the separate dashboard.'},
  te: {your_journey:'మీ ప్రయాణం',home:'హోమ్',explore:'అన్వేషించండి',maps:'మ్యాప్‌లు',saved:'దాచిన ప్రదేశాలు',my_plan:'నా ప్రణాళిక',near_me:'నా దగ్గర',transport:'రవాణా',ready_offline:'ఆఫ్‌లైన్‌కు సిద్ధం',essentials_on_device:'ముఖ్యమైన సమాచారం ఈ పరికరంలో ఉంది',settings:'సెట్టింగ్‌లు',offline_ready:'ఆఫ్‌లైన్‌కు సిద్ధం',more:'మరిన్ని',discover:'మీ వేగంతో అన్వేషించండి',hero_title:'కృష్ణా తీరం, <em>మీ సమయంతో.</em>',hero_copy:'కొద్దిగా స్థానిక సమాచారం ప్రయాణాన్ని మీ సొంతంగా మార్చుతుంది. ప్రదేశాలను దాచుకొని విజయవాడను మీ వేగంతో చూడండి.',explore_places:'ప్రదేశాలు చూడండి',plan_day:'నా రోజును ప్లాన్ చేయండి',featured:'ప్రారంభించడానికి కొన్ని ప్రదేశాలు',see_all:'అన్ని ప్రదేశాలు',search_placeholder:'ప్రదేశాలు, అంశాలు లేదా కథలు వెతకండి',all_places:'అన్ని ప్రదేశాలు',back:'వెనుకకు',add_to_plan:'నా ప్రణాళికలో చేర్చండి',rate_place:'ఈ ప్రదేశానికి రేటింగ్ ఇవ్వండి',optional_note:'మీకు ఇష్టమైతే ఒక గమనిక',save_feedback:'అభిప్రాయాన్ని భద్రపరచండి',feedback_offline_note:'ఈ పరికరంలో భద్రపరచి, ఆన్‌లైన్‌లో పంపిస్తాము.',content_language:'ప్రదేశాల వివరణలు ఇంగ్లీష్‌లో ఉన్నాయి; పేర్లు స్థానిక భాషల్లో అందుబాటులో ఉన్నాయి.'},
  hi: {your_journey:'आपकी यात्रा',home:'होम',explore:'खोजें',maps:'मानचित्र',saved:'सहेजे स्थान',my_plan:'मेरी योजना',near_me:'मेरे पास',transport:'यातायात',ready_offline:'ऑफ़लाइन तैयार',essentials_on_device:'ज़रूरी जानकारी इस डिवाइस पर है',settings:'सेटिंग्स',offline_ready:'ऑफ़लाइन तैयार',more:'और',discover:'अपनी गति से खोजें',hero_title:'कृष्णा का किनारा, <em>अपने समय पर।</em>',hero_copy:'थोड़ी स्थानीय जानकारी यात्रा को अपना बना देती है। कहानियों से शुरुआत करें, कुछ जगहें सहेजें और विजयवाड़ा को अपनी गति से देखें।',explore_places:'जगहें देखें',plan_day:'अपना दिन बनाएँ',featured:'शुरुआत के लिए कुछ जगहें',see_all:'सभी जगहें',search_placeholder:'जगहें, विषय या कहानियाँ खोजें',all_places:'सभी जगहें',back:'वापस',add_to_plan:'मेरी योजना में जोड़ें',rate_place:'इस जगह को रेट करें',optional_note:'आप चाहें तो एक नोट',save_feedback:'प्रतिक्रिया सहेजें',feedback_offline_note:'इस डिवाइस पर सहेजकर ऑनलाइन होने पर भेजा जाएगा।',content_language:'जगहों का विवरण अंग्रेज़ी में है; स्थानीय नाम उपलब्ध हैं।'}
};
const categories = ['All places','Sacred places','River & city','Culture & views','Nature & outdoors','Heritage','Transport hubs','Malls & shopping','Health & emergency','Police & safety'];
const icons = {temple:'🛕',water:'🌉',hill:'☀️',island:'🌴',caves:'🪨',rail:'🚆',bus:'🚌',mall:'🛍️',hospital:'✚',police:'🚓',statue:'🗿'};
const bundledContentVersion='2026.10.19-offline-ambedkar-gandhi-update';
const state = { view:'welcome', destination:null, filter:'All places', query:'', rating:0, feedbackTarget:null, language:'en', destinations:[], bundledDestinations:[], favorites:new Set(), plans:[], events:[], location:null, kioskLocation:null, selectingKiosk:false, offlineMap:null, activeRoute:null, focusMapId:null, user:null, analyticsConsent:null, guestId:null, contentVersion:bundledContentVersion };
const isLegacyBundledContent=version=>['2026.10.19-offline-map','2026.10.19-offline-photos'].includes(version);
const $ = (s, root=document) => root.querySelector(s);
const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr = key => copy[state.language]?.[key] || copy.en[key] || key;
function currentScreen(){return state.destination?'detail':state.view;}
function recordSearchActivity(){const query=state.query.trim();const matches=sortedPlaces().filter(p=>(state.filter==='All places'||p.category===state.filter)&&(!query||`${p.name} ${p.summary} ${p.category}`.toLowerCase().includes(query.toLowerCase())));recordActivity('search',{screen:'explore',queryLength:query.length,resultCount:matches.length});}
function trackUiAction(action,id=''){
  const trackedAction=action==='favorite'?(state.favorites.has(id)?'favorite-remove':'favorite-add'):action;
  const payload={screen:currentScreen(),action:trackedAction};
  const destinationId=action==='plan-add-selected'?$('#plan-place')?.value:id;
  if(destinationId&&state.destinations.some(place=>place.id===destinationId))payload.destinationId=destinationId;
  if(action==='filter'&&categories.includes(id))payload.category=id;
  if(action==='language'&&['en','te','hi'].includes(id))payload.settingValue=id;
  recordActivity('ui_action',payload);
}
async function ensureGuestId(){
  if(!state.guestId){const saved=await get('settings','analyticsGuestId');state.guestId=saved?.value||uid();if(!saved)await put('settings',{id:'analyticsGuestId',value:state.guestId});}
  return state.guestId;
}
async function activityActor(){
  const accountId=state.user?.id||sessionStorage.getItem('gv-account-id');
  if(accountId)return {accountId};
  return {guestId:await ensureGuestId()};
}
async function recordActivity(type,payload={}){
  if(type!=='feedback'&&state.analyticsConsent!=='enabled')return;
  try{
    const isFeedback=type==='feedback';
    const safePayload=isFeedback?{screen:payload.screen,destinationId:payload.destinationId,rating:payload.rating}:payload;
    const event={id:uid(),type,payload:safePayload,createdAt:new Date().toISOString(),sessionId:activitySessionId,...await activityActor()};
    if(isFeedback){event.destinationId=payload.destinationId;event.rating=payload.rating;event.comment=payload.comment||'';}
    await put('events',event);state.events.push(event);scheduleActivitySync();
  }catch(error){console.warn('Could not queue usage activity:',error);}
}
async function setAnalyticsConsent(value){
  state.analyticsConsent=value;await put('settings',{id:'analyticsConsent',value});
  const dialog=$('#analytics-consent');if(dialog.open)dialog.close();
  if(value==='enabled'){
    await recordActivity('ui_action',{screen:currentScreen(),action:'analytics-enable'});
    await recordActivity('session_start',{screen:currentScreen()});
    await recordActivity('screen_view',{screen:currentScreen()});
    scheduleActivitySync();
  }else{
    for(const event of await all('events'))if(event.type!=='feedback')await remove('events',event.id);
    state.events=state.events.filter(event=>event.type==='feedback');
  }
  render();
}
const uid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
const activitySessionId = uid();
let activitySyncPromise;
let activitySyncRequested=false;
let activitySyncTimer;
let searchActivityTimer;
const name = place => state.language === 'te' ? place.name_te : state.language === 'hi' ? place.name_hi : place.name;
const sortedPlaces = () => [...state.destinations].sort((a,b) => a.name.localeCompare(b.name));
function mergeDestinations(bundled,remote){const remoteById=new Map(remote.map(place=>[place.id,place]));const detailFields=['history','timings','entry_fee','facilities','details_source','details_source_label'];const merged=bundled.map(place=>{const remotePlace=remoteById.get(place.id);if(!remotePlace)return place;const combined={...place,...remotePlace};for(const field of detailFields)if(remotePlace[field]==null||remotePlace[field]==='')combined[field]=place[field];return combined;});const ids=new Set(merged.map(place=>place.id));for(const place of remote)if(!ids.has(place.id)){merged.push(place);ids.add(place.id);}return merged;}
const photoFiles = {'kanaka-durga-temple':'./images/kanaka-durga-temple.png','prakasam-barrage':'./images/prakasam-barrage.jpg','gandhi-hill':'./images/gandhi-hill.jpg','bhavani-island':'./images/bhavani-island.jpg','undavalli-caves':'./images/undavalli-caves.jpg','mangalagiri-temple':'./images/mangalagiri-temple.jpg','vijayawada-railway-station':'./images/vijayawada-railway-station.jpg','pandit-nehru-bus-station':'./images/pandit-nehru-bus-station.jpg','pvp-square':'./images/pvp-square.webp','lepl-centro':'./images/lepl-centro.jpg','trendset-mall':'./images/trendset-mall.jpg','laila-mall':'./images/laila-mall-inox-lobby.webp','government-general-hospital-vijayawada':'./images/government-general-hospital-vijayawada.jpg','andhra-hospitals-vijayawada':'./images/andhra-hospitals-vijayawada.jpg','vijayawada-city-police-commissionerate':'./images/vijayawada-city-police-commissionerate.jpg','aayush-hospitals-vijayawada':'./images/aayush-hospitals-vijayawada.jpg','hcg-cancer-hospital-vijayawada':'./images/hcg-cancer-hospital.webp','rainbow-childrens-hospital-vijayawada':'./images/rainbow-childrens-hospital.jpg','manipal-hospitals-vijayawada':'./images/manipal-hospitals-vijayawada.webp','ambedkar-statue-vijayawada':'./images/ambedkar-statue-vijayawada.jpg'};
const photoCredits = {
  'kanaka-durga-temple':{author:'Naga venkata janeeth',source:'https://commons.wikimedia.org/wiki/File:Temple_in_vijayawada.png',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/'},
  'prakasam-barrage':{author:'Hari K Patibanda',source:'https://commons.wikimedia.org/wiki/File:Prakasam_Barrage,_Vijayawada_(32994379992).jpg',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/',modified:'resized and cropped for app display'},
  'gandhi-hill':{author:'Deensonu',source:'https://commons.wikimedia.org/wiki/File:Gandhi_hill_vijayawada.jpg',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',modified:'resized and cropped for app display'},
  'bhavani-island':{author:'Saisumanth532',source:'https://commons.wikimedia.org/wiki/File:Bhavani_island_sunset.jpg',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',modified:'resized and cropped for app display'},
  'undavalli-caves':{author:'Ascswarup',source:'https://commons.wikimedia.org/wiki/File:Undavalli_caves.jpg',license:'Public domain',licenseUrl:'https://commons.wikimedia.org/wiki/Commons:Copyright_tags',modified:'cropped for app display'},
  'mangalagiri-temple':{author:'Durgarao Vuddanti',source:'https://commons.wikimedia.org/wiki/File:Mangalagiri_Temple.jpg',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/',modified:'cropped for app display'},
  'vijayawada-railway-station':{author:'Devi yasasree',source:'https://commons.wikimedia.org/wiki/File:Vijayawada_Railway_station.jpg',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',modified:'resized and cropped for app display'},
  'pandit-nehru-bus-station':{author:'Adbh266',source:'https://commons.wikimedia.org/wiki/File:Pandit_Nehru_bus_station.jpg',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',modified:'resized and cropped for app display'},
  'pvp-square':{author:'PVP Square',source:'https://pvpsquare.com/',modified:'official mall exterior photo'},
  'lepl-centro':{author:'LEPL',source:'https://www.lepl.in/commercial-lepl-centro/',modified:'official mall exterior photo'},
  'trendset-mall':{author:'Trendset Builders',source:'https://www.trendsetbuilders.com/trendset-mall.html',modified:'from the official developer site'},
  'laila-mall':{author:'AndhraBoxOffice.com on X',source:'https://x.com/AndhraBoxOffice/status/1607621056663269382',modified:'photographed INOX lobby inside Laila Mall'},
  'government-general-hospital-vijayawada':{author:'Kl2300031442',source:'https://commons.wikimedia.org/wiki/File:Gunadhala_Government_Hospital.jpg',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',modified:'resized by Wikimedia Commons'},
  'andhra-hospitals-vijayawada':{author:'Justmanju23',source:'https://commons.wikimedia.org/wiki/File:Andhra_Hospitals.jpg',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',modified:'resized for app display'},
  'vijayawada-city-police-commissionerate':{author:'Akshitha Yara',source:'https://commons.wikimedia.org/wiki/File:Vijayawada_City_Police,MG_Road,Vijayawada.jpg',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/'},
  'aayush-hospitals-vijayawada':{author:'Aayush Hospitals',source:'https://www.aayushhospitals.com/gallery',modified:'official Vijayawada hospital exterior photo'},
  'hcg-cancer-hospital-vijayawada':{author:'HCG Hospitals',source:'https://www.hcghospitals.com/vijayawada',modified:'from the official hospital site'},
  'manipal-hospitals-vijayawada':{author:'Manipal Hospitals',source:'https://www.manipalhospitals.com/vijayawada/gallery/',modified:'official Vijayawada facility photo'},
  'rainbow-childrens-hospital-vijayawada':{author:'Rainbow Children’s Hospital',source:'https://www.rainbowhospitals.in/our-centre-detail/vijayawada',modified:'from the official hospital site'},
  'ambedkar-statue-vijayawada':{author:'Sindhu Haridas',source:'https://commons.wikimedia.org/wiki/File:Statue_of_Social_Justice_%40_Vijayawada_01.jpg',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',modified:'resized for app display'}
};
function placeImage(place){const safeId=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(place.id||'')?place.id:'';const bundledPhoto=photoFiles[safeId];return bundledPhoto||(typeof place.image==='string'&&/^\.\/images\/[a-z0-9-]+\.(?:jpg|png|webp)$/i.test(place.image)?place.image:'');}
function photoCreditMarkup(place,extraClass=''){const credit=photoCredits[place.id];if(!credit)return '';const license=credit.license&&credit.licenseUrl?`<span>·</span><a href="${esc(credit.licenseUrl)}" target="_blank" rel="noopener">${esc(credit.license)}</a>`:'';const modified=credit.modified?`<span>· ${esc(credit.modified)}</span>`:'';return `<div class="photo-credit ${esc(extraClass)}"><a href="${esc(credit.source)}" target="_blank" rel="noopener">Photo: ${esc(credit.author)}</a>${license}${modified}</div>`;}
function artMarkup(place){const image=placeImage(place);return image?`<div class="place-art has-image ${esc(place.accent)}"><img src="${esc(image)}" alt="Photograph of ${esc(name(place))}" loading="lazy" decoding="async"><span class="place-art-label">Photo</span></div>`:`<div class="place-art photo-unavailable ${esc(place.accent)}" role="img" aria-label="No photo bundled for ${esc(name(place))}"><span class="photo-unavailable-mark" aria-hidden="true">⌖</span><span class="photo-unavailable-label">No photo in offline guide</span></div>`;}
function bindArtFallback(){document.querySelectorAll('.place-art img').forEach(img=>img.addEventListener('error',()=>{const art=img.closest('.place-art');if(!art)return;art.classList.remove('has-image');art.classList.add('photo-unavailable');art.setAttribute('role','img');art.setAttribute('aria-label',`Photo unavailable for ${img.alt.replace(/^Photograph of /,'')}`);const mark=document.createElement('span');mark.className='photo-unavailable-mark';mark.setAttribute('aria-hidden','true');mark.textContent='⌖';const label=document.createElement('span');label.className='photo-unavailable-label';label.textContent='Photo unavailable offline';art.replaceChildren(mark,label);},{once:true}));}
function callLink(number,label,primary=false){const safeNumber=String(number||'').replace(/[^+\d]/g,'');if(!safeNumber)return '';return `<a class="button ${primary?'button-dark':'button-outline'} small" href="tel:${encodeURIComponent(safeNumber)}">${esc(label||'Call')} ${esc(number)}</a>`;}
function placeContactMarkup(place){const calls=[place.emergency_phone?callLink(place.emergency_phone,place.emergency_phone_label||'Emergency call',true):'',place.phone?callLink(place.phone,place.phone_label||'Call',false):''].filter(Boolean).join('');return `${place.address?`<p class="place-address"><strong>Address</strong>${esc(place.address)}</p>`:''}${calls?`<div class="place-contact-links">${calls}</div>`:''}`;}
function mapActions(place){const point=state.offlineMap?.places?.[place.id];return `<div class="map-links"><button class="button button-outline small" data-action="map-show" data-id="${esc(place.id)}">Show on offline map</button>${point?`<button class="button button-dark small" data-action="route" data-id="${esc(place.id)}">Start shortest route</button>`:`<span class="unverified">No mapped pin in this offline area</span>`}</div>${point?.accessNote?`<p class="map-access-note">${esc(point.accessNote)}</p>`:''}`;}
function emergencyBanner(){return `<div class="inline-banner emergency-banner"><div><strong>Emergency in India? Dial 112</strong><p>India’s official emergency response number for police, fire and medical help. A phone signal is required; internet is not.</p></div><a class="button button-dark small" href="tel:112">Call 112</a><a class="source-link" data-external-map href="https://112.gov.in/about" target="_blank" rel="noopener">Official 112 information ↗</a></div>`;}
function mapFrame(){return `<div class="map-frame"><canvas id="offline-map-canvas" aria-label="Bundled OpenStreetMap street map of Vijayawada. Drag to pan, scroll to zoom." role="img"></canvas><div class="map-status" id="map-status">Loading the bundled Vijayawada map…</div><div class="map-zoom-controls"><button class="button button-light small" data-action="map-zoom-in" aria-label="Zoom in">+</button><button class="button button-light small" data-action="map-zoom-out" aria-label="Zoom out">−</button><button class="button button-light small" data-action="map-reset">City</button></div></div><div class="map-attribution">Offline street data · © OpenStreetMap contributors · <a data-external-map href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">ODbL 1.0</a> · snapshot 19 Oct 2026</div>`;}
function mapPlaceCard(place){return `<article class="map-place-card"><div class="map-place-art">${artMarkup(place)}</div><div class="map-place-copy"><span class="card-tag">${esc(place.category)}</span><h3>${esc(name(place))}</h3><p>${esc(place.summary)}</p>${placeContactMarkup(place)}${photoCreditMarkup(place)}${mapActions(place)}</div></article>`;}

function bindCurrentOfflineMap(){
  const canvas=$('#offline-map-canvas');if(!canvas)return;
  if(!state.offlineMap){
    if(state.offlineMapLoading)return;
    state.offlineMapLoading=true;
    loadOfflineMap().then(map=>{state.offlineMap=map;state.offlineMapLoading=false;if($('#offline-map-canvas'))render();}).catch(()=>{state.offlineMapLoading=false;const status=$('#map-status');if(status)status.textContent='The bundled map could not be opened. Reinstall or refresh the offline guide.';});
    return;
  }
  const destinationId=state.activeRoute?.destinationId||state.focusMapId;
  const origin=state.activeRoute?.origin||state.location||state.kioskLocation;
  bindOfflineMap(canvas,state.offlineMap,{destinations:state.destinations,route:state.activeRoute?.route,origin,originLabel:state.activeRoute?'START':state.location?'YOUR LOCATION':state.kioskLocation?'KIOSK START':'',destinationId,selectingKiosk:state.selectingKiosk,onInteraction:action=>recordActivity('ui_action',{screen:'map',action}),onPickKiosk:saveKioskPoint});
  const status=$('#map-status');if(status)status.remove();
}
async function saveKioskPoint(point){state.kioskLocation=point;state.selectingKiosk=false;await put('settings',{id:'offlineMapStart',value:point});recordActivity('ui_action',{screen:'map',action:'kiosk-point-set'});state.activeRoute=null;toast('Kiosk start point saved on this device.');render();}
function routeMarkup(){
  const active=state.activeRoute;if(!active||!state.offlineMap)return '';
  const steps=routeInstructions(state.offlineMap,active.route);
  const total=active.route.meters>=1000?`${(active.route.meters/1000).toFixed(1)} km`:`${Math.round(active.route.meters/10)*10} m`;
  const point=state.offlineMap.places[active.destinationId];
  const destination=state.destinations.find(place=>place.id===active.destinationId)||{name:active.destinationId};
  return `<section class="offline-route-result"><div class="offline-route-title"><div><span class="eyebrow">SHORTEST OFFLINE WALKING ROUTE</span><h3>Route started</h3></div><strong>${esc(total)}</strong></div><div class="route-endpoints"><div><span>START</span><b>${esc(active.originLabel)}</b></div><div><span>DESTINATION</span><b>${esc(name(destination))}</b></div></div><p>This is the shortest distance path found on the bundled walking network. Check local access before setting out.</p>${point?.accessNote?`<div class="map-access-note">${esc(point.accessNote)}</div>`:''}${steps.length?`<ol class="offline-route-steps">${steps.map(step=>`<li><span>${esc(step.action)}</span> on <b>${esc(step.road)}</b><small>${Math.round(step.meters/10)*10} m</small></li>`).join('')}</ol>`:`<p>The start and destination are on the same mapped road point.</p>`}</section>`;
}
function mapControlPanel(){
  const start=state.location?'Device location (this session)':state.kioskLocation?'Saved kiosk start point':'No route start set';
  const destination=state.destinations.find(place=>place.id===state.focusMapId);
  const hasStart=Boolean(state.location||state.kioskLocation);
  const routePreview=destination?`<section class="route-preview"><h4>Route endpoints</h4><div class="route-endpoints"><div><span>START</span><b>${esc(state.location?'Your device location':state.kioskLocation?'Saved kiosk point':'Set a start point')}</b></div><div><span>DESTINATION</span><b>${esc(name(destination))}</b></div></div>${hasStart?state.activeRoute?`<p class="route-ready-note">Shortest route is shown below.</p>`:`<button class="button button-dark full" data-action="route-start" data-id="${esc(destination.id)}">Start shortest route</button>`:`<p class="route-ready-note">Use device location or set the kiosk point to choose a start.</p>`}</section>`:'';
  return `<aside class="map-side"><h3>Offline directions</h3><p>Use the device’s current location, or save this kiosk’s fixed location once. Location data stays on this device.</p><div class="map-origin-status"><b>Route starts from</b><span>${esc(start)}</span></div><button class="button button-dark full" data-action="geolocate">Use device location</button><button class="button button-outline full" data-action="kiosk-select">${state.selectingKiosk?'Cancel map selection':'Set kiosk start point'}</button>${state.kioskLocation?`<button class="text-button" data-action="kiosk-clear">Clear saved kiosk point</button>`:''}<p class="map-gesture-help">Drag to pan · scroll or use + / − to zoom. When kiosk selection is on, tap its map location.</p>${routePreview}${routeMarkup()}</aside>`;
}

async function boot(){
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  try {
    const response = await fetch('./data/destinations.json');
    state.bundledDestinations = await response.json();
    state.destinations = state.bundledDestinations;
    const activeContent = await get('content','active');
    if (activeContent?.destinations?.length && !isLegacyBundledContent(activeContent.version)) { state.destinations = mergeDestinations(state.bundledDestinations,activeContent.destinations); state.contentVersion = activeContent.version || state.contentVersion; }
    const [favorites, plans, events, settings, feedback] = await Promise.all([all('favorites'),all('itineraries'),all('events'),all('settings'),all('feedback')]);
    for(const event of events)if(event.type!=='feedback'&&(!event.sessionId||(!event.accountId&&!event.guestId)))await remove('events',event.id);
    state.favorites = new Set(favorites.map(item => item.id)); state.plans = plans; state.events = events.filter(event=>event.type==='feedback'||(event.sessionId&&(event.accountId||event.guestId)));
    state.language = settings.find(item => item.id === 'language')?.value || 'en';
    state.analyticsConsent = settings.find(item => item.id === 'analyticsConsent')?.value || null;
    state.guestId = settings.find(item => item.id === 'analyticsGuestId')?.value || null;
    state.kioskLocation = settings.find(item => item.id === 'offlineMapStart')?.value || null;
    state.view = settings.find(item => item.id === 'welcomed')?.value ? 'home' : 'welcome';
    const cachedUser = settings.find(item => item.id === 'cachedUser')?.value || null;
    if (cachedUser) state.user = cachedUser;
    const token = sessionStorage.getItem('gv-session');
    if (token) { try { const response = await fetch(apiUrl('/api/auth/me'),{headers:{Authorization:`Bearer ${token}`}}); if(response.ok) { state.user=(await response.json()).user; await put('settings',{id:'cachedUser',value:state.user}); sessionStorage.setItem('gv-account-id',state.user.id); } else { sessionStorage.removeItem('gv-session'); sessionStorage.removeItem('gv-account-id'); state.user=null; await remove('settings','cachedUser'); } } catch {} }
    const queuedFeedback = new Set(events.filter(item=>item.type==='feedback').map(item=>item.id));
    for (const item of feedback) {
      if (queuedFeedback.has(item.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.destinationId||'') || !Number.isInteger(Number(item.rating)) || Number(item.rating)<1 || Number(item.rating)>5) continue;
      const createdAt = Number.isFinite(Date.parse(item.createdAt||'')) ? new Date(item.createdAt).toISOString() : new Date().toISOString();
      const migrated = {id:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id||'')?item.id:uid(),type:'feedback',destinationId:item.destinationId,rating:Number(item.rating),comment:String(item.comment||'').slice(0,500),createdAt,sessionId:activitySessionId,...await activityActor()};
      if (migrated.id!==item.id) { await remove('feedback',item.id); await put('feedback',{...item,id:migrated.id}); }
      await put('events',migrated); queuedFeedback.add(migrated.id);
    }
    state.events = await all('events');
    document.documentElement.lang = state.language;
    applyTextScale(settings.find(item => item.id === 'fontScale')?.value || '1');
  } catch (error) { console.error('Could not initialize local guide:', error); }
  bindShell(); updateStaticText(); render();
  if (state.analyticsConsent === 'enabled') { recordActivity('session_start',{screen:currentScreen()}); recordActivity('screen_view',{screen:currentScreen()}); }
  else if (!state.analyticsConsent) $('#analytics-consent').showModal();
  trySync();
}
function bindShell(){
  document.addEventListener('click', event => {
    const externalLink=event.target.closest('a[href^="https://"]');if(externalLink)recordActivity('ui_action',{screen:currentScreen(),action:'external-link'});
    const legalLink=event.target.closest('a[href$="/privacy-policy.html"],a[href$="/delete-account.html"]');if(legalLink&&Capacitor.isNativePlatform()){event.preventDefault();Browser.open({url:legalLink.href,toolbarColor:'#f5f3ed'}).catch(()=>window.location.assign(legalLink.href));return;}
    const externalMap=event.target.closest('a[data-external-map]');if(externalMap&&Capacitor.isNativePlatform()){event.preventDefault();Browser.open({url:externalMap.href,toolbarColor:'#f5f3ed'}).catch(()=>window.location.assign(externalMap.href));return;}
    const nav = event.target.closest('[data-view]'); if(nav){navigate(nav.dataset.view);return;}
    const action = event.target.closest('[data-action]'); if(action){trackUiAction(action.dataset.action,action.dataset.id);handleAction(action.dataset.action, action.dataset.id, action.dataset.originId);return;}
    if(event.target.closest('[data-rating]'))recordActivity('ui_action',{screen:'detail',action:'feedback-rating-select'});
    if(event.target.closest('#account-switch'))recordActivity('ui_action',{screen:currentScreen(),action:'account-mode-toggle'});
  });
  $('#open-settings').addEventListener('click',()=>navigate('settings'));
  $('#feedback-form').addEventListener('submit', onFeedbackSubmit);
  $('#account-form').addEventListener('submit', onAccountSubmit);
  $('#delete-account-form').addEventListener('submit', onDeleteAccountSubmit);
  $('#account-switch').addEventListener('click',()=>{const register=$('#account-title').dataset.mode!=='register';$('#account-title').dataset.mode=register?'register':'login';$('#account-title').textContent=register?'Create an account':'Sign in';$('#account-submit').textContent=register?'Create account':'Sign in';$('#account-switch').textContent=register?'I already have an account':'Create an account';$('#account-password').autocomplete=register?'new-password':'current-password';$('#account-message').textContent='';});
  document.addEventListener('change',event=>{if(event.target?.id==='qr-file'){recordActivity('ui_action',{screen:'qr',action:'qr-image-selected'});decodeQrImage(event);}});
  $('#feedback-form').addEventListener('click',event=>{const star=event.target.closest('[data-rating]');if(star){state.rating=Number(star.dataset.rating);paintStars();}});
  $('#analytics-consent').addEventListener('cancel',event=>event.preventDefault());
  window.addEventListener('online',trySync); window.addEventListener('hashchange',()=>{const hash=location.hash.slice(1);if(hash && hash!=='home')navigate(hash,false);});
}
function updateStaticText(){document.querySelectorAll('[data-i18n]').forEach(node=>{node.textContent=tr(node.dataset.i18n)});}
function applyTextScale(value=document.documentElement.style.getPropertyValue('--font-scale')||'1'){
  const scale=Math.min(1.2,Math.max(.9,Number(value)||1));
  document.documentElement.style.fontSize='16px';
  document.documentElement.style.setProperty('--font-scale',String(scale));
  const body=document.body;
  if(!body.dataset.gvFontBaseSize)body.dataset.gvFontBaseSize=getComputedStyle(body).fontSize;
  body.style.fontSize=`${parseFloat(body.dataset.gvFontBaseSize)*scale}px`;
  for(const element of body.querySelectorAll('*')){
    const base=element.dataset.gvFontBaseSize;
    if(base){element.style.fontSize=`${parseFloat(base)*scale}px`;continue;}
    const size=parseFloat(getComputedStyle(element).fontSize);
    const parentSize=parseFloat(getComputedStyle(element.parentElement).fontSize);
    if(!Number.isFinite(size)||Math.abs(size-parentSize)<.01)continue;
    element.dataset.gvFontBaseSize=String(size);
    element.style.fontSize=`${size*scale}px`;
  }
  return scale;
}
function navigate(view,push=true){if(searchActivityTimer){clearTimeout(searchActivityTimer);searchActivityTimer=null;if(state.view==='explore'&&state.query.trim())recordSearchActivity();}const changed=currentScreen()!==view;state.view=view;state.destination=null;state.query='';if(push) location.hash=view==='home'?'home':view;if(changed)recordActivity('screen_view',{screen:view});render();window.scrollTo({top:0,behavior:'smooth'});}
function countWords(){return `${state.destinations.length} places`}
function heading(kicker,title,sub,action=''){return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${sub}</p></div>${action}</div>`}
function placeCard(place){const saved=state.favorites.has(place.id);return `<article class="place-card"><div class="place-art-wrap">${artMarkup(place)}<button class="save-button ${saved?'saved':''}" data-action="favorite" data-id="${esc(place.id)}" aria-label="${saved?'Remove saved place':'Save place'}">${saved?'♥':'♡'}</button></div>${photoCreditMarkup(place,'card-photo-credit')}<div class="card-body"><div class="card-tag">${esc(place.category)}</div><div class="card-title-row"><h3>${esc(name(place))}</h3><button class="text-button card-arrow" data-action="detail" data-id="${esc(place.id)}" aria-label="Open ${esc(name(place))}">↗</button></div><p>${esc(place.summary)}</p><div class="card-meta"><span>${tr('included')}</span><span>${tr('unknown_duration')}</span></div></div></article>`}
function render(){
  document.body.classList.toggle('welcome-mode',state.view==='welcome');
  document.querySelectorAll('.nav-item[data-view],.bottom-nav button[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===state.view));
  $('#saved-count').textContent=state.favorites.size;
  const view=$('#view');
  if(state.destination){view.innerHTML=renderDetail(state.destination);applyTextScale();bindArtFallback();return;}
  const renderers={welcome:renderWelcome,home:renderHome,explore:renderExplore,saved:renderSaved,itinerary:renderOfflineItinerary,nearby:renderOfflineNearby,transport:renderTransport,settings:renderSettings,qr:renderQr,map:renderOfflineMap};
  view.innerHTML=(renderers[state.view]||renderHome)();
  applyTextScale();
  bindArtFallback();
  bindCurrentOfflineMap();
  bindView();
}
function renderWelcome(){return `<section class="welcome-screen"><div class="welcome-copy"><a class="brand" href="#"><img src="/assets/mark.svg" alt=""><span>guide<span class="brand-light">voyager</span></span></a><span class="eyebrow">A LOCAL GUIDE TO VIJAYAWADA</span><h1>Meet the city<br>at <em>your pace.</em></h1><p>Discover riverside landmarks, save places for later and make a simple plan. Your essential guide works offline, from your very first visit.</p><div class="welcome-actions"><button class="button button-dark" data-action="continue-guest">Continue as guest <span>↗</span></button><button class="button button-outline" data-action="account-info">Sign in / Create account</button></div><p class="muted" style="font-size:10px">No account needed to explore. Sign-in needs an internet connection.</p></div><div class="welcome-art"><span class="welcome-spark"></span><div class="welcome-caption"><b>Vijayawada, in your own time.</b><span>Krishna River · Andhra Pradesh</span></div></div></section>`}
function renderHome(){const featured=['kanaka-durga-temple','prakasam-barrage','bhavani-island'].map(id=>state.destinations.find(p=>p.id===id)).filter(Boolean);
 return `<section class="hero"><div class="hero-content"><span class="eyebrow">${tr('discover')}</span><h1>${tr('hero_title')}</h1><p class="hero-copy">${tr('hero_copy')}</p><div class="hero-actions"><button class="button button-primary" data-action="navigate" data-id="explore">${tr('explore_places')} <span>↗</span></button><button class="button button-glass" data-action="navigate" data-id="itinerary">${tr('plan_day')}</button></div></div></section>
 <div class="section-head"><h2>${tr('featured')}</h2><button class="text-button" data-action="navigate" data-id="explore">${tr('see_all')} ↗</button></div><div class="feature-grid">${featured.map(placeCard).join('')}</div>
 <div class="section-head"><h2>${tr('make_it_yours')}</h2></div><div class="quick-grid"><button class="quick-card" data-action="navigate" data-id="nearby"><span>◎</span><strong>${tr('find_nearby')}</strong><small>Location permission stays on-device</small></button><button class="quick-card" data-action="navigate" data-id="itinerary"><span>▤</span><strong>${tr('build_plan')}</strong><small>Save your own list</small></button><button class="quick-card" data-action="navigate" data-id="transport"><span>↗</span><strong>${tr('govt_transport')}</strong><small>Official hubs and links</small></button><button class="quick-card" data-action="navigate" data-id="qr"><span>▦</span><strong>${tr('scan_qr')}</strong><small>QR format pending</small></button></div>
 <div class="inline-banner"><div><strong>${tr('ready_offline')}</strong><p>Destination guide, saved places and your plan remain available on this device.</p></div><button class="button button-outline small" data-action="navigate" data-id="settings">${tr('settings')} ↗</button></div>`;
}
function renderExplore(){const filters=categories.map(category=>`<button class="filter-chip ${state.filter===category?'active':''}" data-action="filter" data-id="${esc(category)}">${category=== 'All places'?tr('all_places'):esc(category)}</button>`).join('');
 const matches=sortedPlaces().filter(p=>(state.filter==='All places'||p.category===state.filter)&&(!state.query||`${p.name} ${p.summary} ${p.category}`.toLowerCase().includes(state.query.toLowerCase())));
 return `${heading('VIJAYAWADA · OFFLINE GUIDE',tr('explore_title'),tr('explore_sub'))}<label class="search-row"><span class="searchbox"><span>⌕</span><input id="place-search" type="search" placeholder="${tr('search_placeholder')}" value="${esc(state.query)}"></span></label><div class="filter-row">${filters}</div><p class="results-count">${matches.length} places in this guide</p>${matches.length?`<div class="card-grid">${matches.map(placeCard).join('')}</div>`:emptyBox('⌕','No matching places','Try a shorter search or choose a different category.')}`;
}
function emptyBox(icon,title,copyText,button=''){return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${copyText}</p>${button}</div>`}
function renderSaved(){const places=state.destinations.filter(p=>state.favorites.has(p.id));return `${heading('YOUR JOURNEY',tr('saved'),`Places you chose to keep close. ${places.length} saved.`)}${places.length?`<div class="card-grid">${places.map(placeCard).join('')}</div>`:emptyBox('♡',tr('empty_saved'),tr('empty_saved_copy'),`<button class="button button-dark" data-action="navigate" data-id="explore">${tr('browse_places')}</button>`)}`}
function renderDetail(place){const facilities=Array.isArray(place.facilities)?place.facilities:[];return `<button class="text-button" data-action="back">← ${tr('back')}</button><section class="detail-top"><div class="detail-copy"><span class="eyebrow">${esc(place.category)} · VIJAYAWADA</span><h1>${esc(name(place))}</h1><p>${esc(place.summary)}</p><div class="detail-actions"><button class="button button-dark" data-action="plan-add" data-id="${esc(place.id)}">+ ${tr('add_to_plan')}</button><button class="button button-outline" data-action="feedback" data-id="${esc(place.id)}">☆ ${tr('rate_place')}</button><button class="button button-light" data-action="favorite" data-id="${esc(place.id)}">${state.favorites.has(place.id)?'♥ Saved':'♡ Save'}</button></div><div class="detail-facts"><span><b>${tr('included')}</b>Offline guide</span><span><b>${tr('unknown_duration')}</b>Confirm locally</span></div></div><div class="detail-art">${artMarkup(place)}${photoCreditMarkup(place,'detail-photo-credit')}</div></section><section class="detail-sections"><div class="detail-main-column"><article class="info-panel"><h3>About this place</h3><p>${esc(place.description)}</p><p class="about-visiting">${esc(place.visiting)}</p><a class="source-link" href="${esc(place.source)}" target="_blank" rel="noopener">${tr('source')}: ${esc(place.source_label)} ↗</a></article><article class="info-panel"><h3>History</h3><p>${esc(place.history||'A short history is not available in this offline guide.')}</p></article><article class="info-panel visitor-information"><h3>Visitor information</h3><div class="visitor-facts"><section><h4>Timings</h4><p>${esc(place.timings||'Check current timings with the venue.')}</p></section><section><h4>Entry fee</h4><p>${esc(place.entry_fee||'₹0')}</p></section></div><div class="facilities-block"><h4>Facilities</h4>${facilities.length?`<ul>${facilities.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:'<p>Facility details are not listed in this offline guide.</p>'}</div><a class="source-link" href="${esc(place.details_source||place.source)}" target="_blank" rel="noopener">${tr('source')}: ${esc(place.details_source_label||place.source_label)} ↗</a></article></div><div><div class="note-panel"><strong>${tr('content_language')}</strong></div><div class="map-side detail-map-panel"><h3>Map &amp; directions</h3>${placeContactMarkup(place)}<p>${tr('map_copy')}</p>${mapActions(place)}</div></div></section>`}
function renderTransport(){const stations=state.destinations.filter(p=>p.category==='Transport hubs');return `${heading('GOVERNMENT OPERATORS',tr('transport_title'),tr('transport_sub'))}<div class="transport-list">${stations.map(p=>`<article class="transport-card"><div class="transport-icon">${icons[p.kind]}</div><h3>${esc(name(p))}</h3><p>${esc(p.description)}</p><a href="${esc(p.source)}" target="_blank" rel="noopener">${tr('source')}: ${esc(p.source_label)} ↗</a>${mapActions(p)}</article>`).join('')}</div><div class="inline-banner"><div><strong>Schedules need a live source</strong><p>${tr('transport_note')}</p></div><button class="button button-outline small" data-action="transport-source">Official operator ↗</button></div>`}
 function renderSettings(){const analyticsOn=state.analyticsConsent==='enabled';const legalBase=(apiBaseUrl||window.location.origin).replace(/\/$/,'');return `${heading('YOUR PREFERENCES',tr('settings_title'),tr('settings_sub'))}<div class="settings-grid"><section class="setting-card"><h3>${tr('language')}</h3><p>Navigation labels and place names.</p><div class="segmented">${[['en','English'],['te','తెలుగు'],['hi','हिन्दी']].map(([code,label])=>`<button data-action="language" data-id="${code}" class="${state.language===code?'active':''}">${label}</button>`).join('')}</div><p style="margin-top:12px">${tr('content_language')}</p></section><section class="setting-card"><h3>${tr('text_size')}</h3><p>Adjust the interface text for easier reading.</p><div class="range-row"><span>A</span><input type="range" min="0.9" max="1.2" step="0.1" value="${document.documentElement.style.getPropertyValue('--font-scale')||1}" id="font-range"><span style="font-size:18px">A</span></div></section><section class="setting-card"><h3>${tr('local_data')}</h3><p>Saved places, plans and preferences stay on this device. Usage analytics sync only when enabled.</p><div class="storage-row"><span>${tr('favorites_label')}</span><strong>${state.favorites.size}</strong></div><div class="storage-row"><span>${tr('itineraries_label')}</span><strong>${state.plans.length}</strong></div><div class="storage-row"><span>${tr('feedback_label')}</span><strong>${state.events.filter(e=>e.type==='feedback').length}</strong></div><button class="button button-outline small" data-action="clear-data">${tr('clear_data')}</button></section><section class="setting-card"><h3>Usage analytics</h3><p>When enabled, Guide Voyager syncs pages opened and app actions, including searches (length and result count only), saved places, plans and route requests. Account activity is linked to your account; guest activity uses a random ID on this device. Passwords, typed search terms, QR contents and location coordinates are not recorded.</p><div class="storage-row"><span>Tracking status</span><strong>${analyticsOn?'On':'Off'}</strong></div><p>Activity waits on this device while offline. Turning tracking off clears unsent analytics; feedback you chose to submit still syncs. Previously synced activity remains in administrator reports for up to 24 months.</p><button class="button button-outline small" data-action="${analyticsOn?'analytics-disable':'analytics-enable'}">${analyticsOn?'Turn off usage analytics':'Turn on usage analytics'}</button></section><section class="setting-card"><h3>${tr('content_update')}</h3><p>Current guide: ${esc(state.contentVersion)}. The previous guide remains if an update cannot be validated.</p><button class="button button-light small" data-action="content-update">${tr('check_content')}</button><h3 style="margin-top:22px">${tr('app_update')}</h3><p>App builds and tourism content are updated separately.</p><button class="button button-light small" data-action="app-update">${tr('check_app')}</button></section><section class="setting-card"><h3>Privacy &amp; account deletion</h3><p>Read what information Guide Voyager stores and how to request deletion.</p><p><a href="${legalBase}/privacy-policy.html" target="_blank" rel="noopener">Privacy policy</a></p><p><a href="${legalBase}/delete-account.html" target="_blank" rel="noopener">Request account deletion on the web</a></p>${state.user?'<button class="button button-outline small" data-action="delete-account">Delete this account</button>':''}</section></div><div class="inline-banner"><div><strong>${state.user?'Signed in as '+esc(state.user.email):'Accounts & sync'}</strong><p>${state.user?(analyticsOn?'Usage activity sync is enabled and uploads when online. Saved places and itineraries remain on this device.':'Usage activity sync is off. Turn it on above to share activity with the administrator. Saved places and itineraries remain on this device.'):'Guest mode works without an account. Sign-in and registration need an online backend.'}</p></div>${state.user?`<button class="button button-outline small" data-action="signout">Sign out</button>`:`<button class="button button-outline small" data-action="account-info">Sign in / Register</button>`}</div>`}
function renderQr(){return `${heading('KIOSK INTEGRATION',tr('qr_title'),tr('qr_sub'))}<section class="qr-box"><span class="eyebrow">MODULAR QR ADAPTER</span><h2>Ready to connect to the kiosk format</h2><p>${tr('qr_pending')}</p><label class="field-label" for="qr-input">${tr('qr_code_entry')}</label><textarea id="qr-input" rows="3" placeholder="${tr('qr_placeholder')}"></textarea><div class="qr-actions"><button class="button button-dark" data-action="qr-check">${tr('check_qr')}</button><button class="button button-outline" data-action="qr-camera">${tr('qr_scan')}</button></div><div class="note-panel" id="qr-output">${tr('qr_result')}</div><input id="qr-file" type="file" accept="image/*" hidden></section><div class="inline-banner"><div><strong>What we need from the hardware team</strong><p>One specification and a few real sample codes. The app deliberately does not assume a payload structure or destination field.</p></div></div>`}
function renderOfflineItinerary(){
  const plan=state.plans[0]||{id:'main',name:'My Vijayawada day',placeIds:[]};
  const places=(plan.placeIds||[]).map(id=>state.destinations.find(p=>p.id===id)).filter(Boolean);
  const legs=places.map((place,i)=>`<div class="map-route-row"><span class="plan-index">${String(i+1).padStart(2,'0')}</span><div><strong>${i?`${esc(name(places[i-1]))} → ${esc(name(place))}`:`Start → ${esc(name(place))}`}</strong><small>${i?'From the previous stop':'From your device or saved kiosk point'}</small></div><button class="text-button" data-action="route" data-id="${esc(place.id)}" data-origin-id="${i?esc(places[i-1].id):''}">Get steps</button></div>`).join('');
  return `${heading('YOUR JOURNEY',tr('plan_title'),'Save places and calculate walking directions from your location or kiosk start point.')}<div class="plan-layout"><section class="plan-panel"><h2>${tr('build_plan')}</h2><p>Add destinations in the order you want to visit them. The offline map can calculate walking steps without a network connection.</p><label class="field-label" for="plan-name">${tr('plan_name')}</label><input class="text-field" id="plan-name" value="${esc(plan.name||'My Vijayawada day')}" maxlength="80"><label class="field-label" for="plan-place">${tr('choose_place')}</label><select id="plan-place">${state.destinations.map(p=>`<option value="${esc(p.id)}">${esc(name(p))}</option>`).join('')}</select><button class="button button-dark full" data-action="plan-add-selected">+ ${tr('add_place')}</button><div class="plan-footer">Saved automatically on this device · ${places.length} places</div></section><section class="plan-panel"><h2>${esc(plan.name||'My Vijayawada day')}</h2><p>${places.length?`${places.length} places, in your chosen order.`:tr('empty_plan_copy')}</p>${places.length?`<div class="plan-list">${places.map((place,i)=>`<div class="plan-item"><div class="plan-index">${String(i+1).padStart(2,'0')}</div><div><strong>${esc(name(place))}</strong><small>${esc(place.category)}</small></div><button class="plan-remove" data-action="plan-remove" data-id="${esc(place.id)}" aria-label="Remove ${esc(name(place))}">×</button></div>`).join('')}</div><div class="itinerary-directions"><h3>Directions between stops</h3><p>Walking steps are calculated on this device from the bundled road map.</p>${legs}</div>${routeMarkup()}`:emptyBox('▤',tr('empty_plan'),tr('empty_plan_copy'))}<div class="plan-footer">Your list stays on this device. Verify local access and conditions before travelling.</div></section></div>`;
}
function renderOfflineNearby(){
  const places=sortedPlaces();
  return `${heading('DISCOVER AROUND YOU',tr('nearby_title'),'Use the bundled Vijayawada map with a device location or a saved kiosk start point.')}${emergencyBanner()}<div class="map-layout"><section class="map-preview-panel"><div class="map-preview-heading"><span class="eyebrow">BUNDLED OFFLINE MAP</span><h2>Vijayawada and nearby places</h2><p>Map roads and saved destinations remain available without mobile data.</p></div>${mapFrame()}</section>${mapControlPanel()}</div><div class="section-head"><h2>Places, hospitals and city services</h2></div><div class="map-place-grid">${places.map(mapPlaceCard).join('')}</div>`;
}
function renderOfflineMap(){
  const places=sortedPlaces();
  return `${heading('MAPS & ROUTES',tr('maps'),'Vijayawada streets, destination pins and walking steps are bundled for offline use.')}${emergencyBanner()}<div class="map-layout"><section class="map-preview-panel"><div class="map-preview-heading"><span class="eyebrow">OFFLINE STREET MAP</span><h2>Vijayawada</h2><p>Drag to pan, zoom, choose a destination, and calculate local walking directions.</p></div>${mapFrame()}</section>${mapControlPanel()}</div><div class="section-head"><h2>Destinations and city essentials</h2></div><div class="map-place-grid">${places.map(mapPlaceCard).join('')}</div>`;
}
function bindView(){
 const search=$('#place-search');
 if(search)search.addEventListener('input',e=>{
  state.query=e.target.value;const cursor=e.target.selectionStart;const scroll=window.scrollY;
  clearTimeout(searchActivityTimer);searchActivityTimer=setTimeout(()=>{searchActivityTimer=null;recordSearchActivity();},700);
  render();const next=$('#place-search');next.focus();next.setSelectionRange(cursor,cursor);window.scrollTo(0,scroll);
 });
 const nameInput=$('#plan-name');if(nameInput)nameInput.addEventListener('change',savePlanName);
 const placeSelect=$('#plan-place');if(placeSelect)placeSelect.addEventListener('change',()=>{const destinationId=placeSelect.value;if(state.destinations.some(place=>place.id===destinationId))recordActivity('ui_action',{screen:'itinerary',action:'plan-destination-select',destinationId});});
 const range=$('#font-range');if(range){range.addEventListener('input',async e=>{applyTextScale(e.target.value);await put('settings',{id:'fontScale',value:e.target.value});});range.addEventListener('change',()=>recordActivity('ui_action',{screen:'settings',action:'text-size-change',settingValue:range.value}));}
}
async function handleAction(action,id,originId=''){
 if(action==='analytics-enable'){await setAnalyticsConsent('enabled');return;} if(action==='analytics-disable'){if($('#analytics-consent').open||confirm('Turn off future usage tracking and clear unsent analytics from this device? Previously synced events remain in administrator reports.'))await setAnalyticsConsent('disabled');return;}
 if(action==='navigate'){navigate(id);return;} if(action==='continue-guest'){await put('settings',{id:'welcomed',value:true});navigate('home');return;} if(action==='account-info'){openAccountDialog();return;} if(action==='delete-account'){if(!state.user){toast('Sign in first to delete your account.');return;}$('#delete-account-password').value='';$('#delete-account-message').textContent='';$('#delete-account-dialog').showModal();return;}if(action==='close-delete-account'){$('#delete-account-dialog').close();return;} if(action==='signout'){await trySync();sessionStorage.removeItem('gv-session');sessionStorage.removeItem('gv-account-id');state.user=null;await remove('settings','cachedUser');render();toast('Signed out. Guest data remains on this device.');trySync();return;} if(action==='close-account'){$('#account-dialog').close();return;} if(action==='detail'){state.destination=state.destinations.find(p=>p.id===id);if(state.destination){state.view='detail';recordActivity('screen_view',{screen:'detail',destinationId:id});render();window.scrollTo(0,0);}return;} if(action==='back'){navigate('explore');return;}
 if(action==='map-show'){state.destination=null;state.view='map';state.focusMapId=id;state.activeRoute=null;location.hash='map';recordActivity('screen_view',{screen:'map',destinationId:id});render();window.scrollTo({top:0,behavior:'smooth'});return;}
 if(action==='route'){await calculateOfflineRoute(id,originId);return;}
 if(action==='geolocate'){state.activeRoute=null;requestLocation();return;}
 if(action==='route-start'){await calculateOfflineRoute(id);return;}
 if(action==='kiosk-select'){state.selectingKiosk=!state.selectingKiosk;state.activeRoute=null;if(state.selectingKiosk)resetOfflineMapView();render();if(state.selectingKiosk)toast('Tap the map where this kiosk is located.');return;}
 if(action==='kiosk-clear'){state.kioskLocation=null;state.selectingKiosk=false;await remove('settings','offlineMapStart');render();return;}
 if(action==='map-zoom-in'){adjustOfflineMapZoom(1.25);return;}if(action==='map-zoom-out'){adjustOfflineMapZoom(0.8);return;}if(action==='map-reset'){state.focusMapId=null;state.activeRoute=null;state.selectingKiosk=false;resetOfflineMapView();render();return;}
  if(action==='favorite'){if(state.favorites.has(id)){state.favorites.delete(id);await remove('favorites',id);toast(tr('removed_saved'));}else{state.favorites.add(id);await put('favorites',{id});toast(tr('saved_place'));}render();return;}
 if(action==='filter'){state.filter=id;render();return;}
 if(action==='plan-add'){await addToPlan(id);return;} if(action==='plan-add-selected'){await addToPlan($('#plan-place')?.value);return;}
 if(action==='plan-remove'){const p=state.plans[0];if(p){p.placeIds=p.placeIds.filter(placeId=>placeId!==id);await put('itineraries',p);}render();return;}
 if(action==='feedback'){openFeedback(id);return;}
 if(action==='language'){state.language=id;document.documentElement.lang=id;await put('settings',{id:'language',value:id});updateStaticText();render();return;}
  if(action==='clear-data'){if(confirm(tr('clear_confirm'))){for(const item of await all('favorites'))await remove('favorites',item.id);for(const item of await all('itineraries'))await remove('itineraries',item.id);for(const item of await all('feedback'))await remove('feedback',item.id);for(const item of await all('events'))if(item.type==='feedback')await remove('events',item.id);state.favorites.clear();state.plans=[];state.events=await all('events');render();toast(tr('cleared'));}return;}
 if(action==='content-update'){await checkContentUpdate();return;}if(action==='app-update'){await checkAppVersion();return;}
 if(action==='transport-source'){window.open('https://www.apsrtconline.in/','_blank','noopener');return;}
  if(action==='qr-check'){const raw=$('#qr-input')?.value||'';const result=inspectKioskQr(raw);$('#qr-output').textContent=result.status==='contract-pending'?`${result.message} ${result.raw.length} characters received.`:result.message;if(raw.trim())recordActivity('qr_check',{screen:'qr',action:'qr-check',inputLength:raw.trim().length,outcome:result.status==='contract-pending'?'unavailable':'invalid'});return;}
 if(action==='qr-camera'){$('#qr-file')?.click();return;}
}
function openAccountDialog(){
  $('#account-message').textContent='';$('#account-title').dataset.mode='login';$('#account-title').textContent='Sign in';$('#account-submit').textContent='Sign in';$('#account-switch').textContent='Create an account';$('#account-password').autocomplete='current-password';$('#account-dialog').showModal();
}
async function onAccountSubmit(event){
  event.preventDefault();const register=$('#account-title').dataset.mode==='register';const endpoint=register?'/api/auth/register':'/api/auth/login';$('#account-message').textContent='Connecting…';
  try{const response=await fetch(apiUrl(endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#account-email').value.trim(),password:$('#account-password').value})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not sign in.');sessionStorage.setItem('gv-session',data.token);sessionStorage.setItem('gv-account-id',data.user.id);state.user=data.user;await put('settings',{id:'cachedUser',value:state.user});$('#account-dialog').close();recordActivity(register?'auth_register':'auth_login',{screen:currentScreen(),outcome:'success'});if(state.view==='welcome'){await put('settings',{id:'welcomed',value:true});navigate('home');}else render();toast(register?'Account created.':'Signed in.');trySync();}catch(error){$('#account-message').textContent=error.message;recordActivity(register?'auth_register':'auth_login',{screen:currentScreen(),outcome:'failure'});}
}
async function onDeleteAccountSubmit(event){
 event.preventDefault();const token=sessionStorage.getItem('gv-session'),accountId=state.user?.id;
 if(!token||!accountId){$('#delete-account-message').textContent='Your session expired. Sign in again, then retry.';return;}
 if(!confirm('Permanently delete your Guide Voyager account and account-linked server data? This cannot be undone.'))return;
 const message=$('#delete-account-message');message.textContent='Deleting account…';
 try{
  const response=await fetch(apiUrl('/api/auth/account'),{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({password:$('#delete-account-password').value})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not delete the account.');
  const accountEvents=(await all('events')).filter(event=>event.accountId===accountId);
  for(const event of accountEvents)await remove('events',event.id);
  for(const event of accountEvents)if(event.type==='feedback')await remove('feedback',event.id);
  for(const item of await all('favorites'))await remove('favorites',item.id);
  for(const item of await all('itineraries'))await remove('itineraries',item.id);
  state.events=await all('events');state.favorites.clear();state.plans=[];state.user=null;
  sessionStorage.removeItem('gv-session');sessionStorage.removeItem('gv-account-id');await remove('settings','cachedUser');
  $('#delete-account-dialog').close();render();toast('Account and account-linked server data deleted.');
 }catch(error){message.textContent=error.message;}
}
async function decodeQrImage(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;if(!('BarcodeDetector' in window)){toast('QR image decoding is not available on this device. You can paste the decoded value.');return;}
  try{const bitmap=await createImageBitmap(file);const detector=new BarcodeDetector({formats:['qr_code']});const codes=await detector.detect(bitmap);bitmap.close?.();if(!codes.length){toast('No QR code was found in that image.');return;}$('#qr-input').value=codes[0].rawValue;await handleAction('qr-check');}catch{toast('Could not read this QR image.');}
}
async function addToPlan(id){if(!id)return;const place=state.destinations.find(p=>p.id===id);if(!place)return;let plan=state.plans[0]||{id:'main',name:'My Vijayawada day',placeIds:[]};if(!plan.placeIds.includes(id))plan.placeIds.push(id);await put('itineraries',plan);state.plans=[plan];if(state.destination){toast(tr('added_plan'));}else{toast(tr('plan_saved'));}render();}
async function savePlanName(){let plan=state.plans[0]||{id:'main',name:'My Vijayawada day',placeIds:[]};plan.name=$('#plan-name').value.trim()||'My Vijayawada day';await put('itineraries',plan);state.plans=[plan];recordActivity('ui_action',{screen:'itinerary',action:'plan-name-change'});}
async function requestLocation(){
 recordActivity('location_request',{screen:currentScreen(),outcome:'requested'});
 const denied=()=>{recordActivity('location_request',{screen:currentScreen(),outcome:'denied'});toast(tr('location_denied'));};
 const granted=position=>{state.location={latitude:position.coords.latitude,longitude:position.coords.longitude};recordActivity('location_request',{screen:currentScreen(),outcome:'granted'});render();};
 if(Capacitor.isNativePlatform()){
  try{let permission=await Geolocation.checkPermissions();if(permission.coarseLocation!=='granted')permission=await Geolocation.requestPermissions({permissions:['coarseLocation']});if(permission.coarseLocation!=='granted'&&permission.location!=='granted'){denied();return;}granted(await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:8000,maximumAge:60000}));}catch{denied();}return;
 }
 if(!navigator.geolocation){denied();return;}
 navigator.geolocation.getCurrentPosition(granted,denied,{enableHighAccuracy:false,timeout:8000,maximumAge:60000});
}
async function calculateOfflineRoute(destinationId,originId=''){
  if(!state.offlineMap){try{state.offlineMap=await loadOfflineMap();}catch{toast('The bundled offline map is unavailable on this device.');return;}}
  const destination=placePoint(state.offlineMap,destinationId);
  if(!destination){toast('This place does not have a confirmed pin in the bundled map yet.');return;}
  const origin=originId?placePoint(state.offlineMap,originId):state.location||state.kioskLocation;
  if(!origin){toast('Use your device location or save this kiosk’s start point on the Maps page first.');return;}
  const result=routeBetween(state.offlineMap,origin,destination);
  if(result.error){toast(result.error);return;}
  const originPlace=originId?state.destinations.find(place=>place.id===originId):null;
  state.activeRoute={destinationId,origin,route:result,originLabel:originPlace?name(originPlace):state.location?'Device location':'Kiosk start point'};
  recordActivity('route_calculated',{screen:'map',destinationId,routeSource:originId?'place':state.location?'device':'kiosk',routeMeters:Math.round(result.meters),outcome:'success'});
  state.destination=null;state.view='map';state.focusMapId=destinationId;location.hash='map';recordActivity('screen_view',{screen:'map',destinationId});render();window.scrollTo({top:0,behavior:'smooth'});
}
function openFeedback(id){state.feedbackTarget=state.destinations.find(p=>p.id===id);state.rating=0;$('#feedback-place').textContent=state.feedbackTarget?name(state.feedbackTarget):'';$('#feedback-comment').value='';paintStars();$('#feedback-dialog').showModal();}
function paintStars(){const group=$('.star-picker');group.innerHTML=[1,2,3,4,5].map(i=>`<button type="button" class="${i<=state.rating?'selected':''}" data-rating="${i}" aria-label="${i} stars">★</button>`).join('');}
async function onFeedbackSubmit(event){event.preventDefault();if(!state.feedbackTarget||!state.rating){toast('Choose a star rating first.');return;}const row={id:uid(),type:'feedback',destinationId:state.feedbackTarget.id,rating:state.rating,comment:$('#feedback-comment').value.trim(),createdAt:new Date().toISOString(),status:'pending'};await put('feedback',row);await recordActivity('feedback',{screen:'detail',destinationId:row.destinationId,rating:row.rating,comment:row.comment});$('#feedback-dialog').close();toast(tr('feedback_saved'));render();trySync();}
function safeActivityPayload(event,type){
 const input=event.payload||{},payload={};
 let screen=input.screen;
 if(type==='destination_view')screen='detail';else if(type==='itinerary_place_added')screen='itinerary';else if(type==='qr_scan')screen='qr';else if(type==='kiosk_open')screen='home';
 if(['welcome','home','explore','saved','itinerary','nearby','transport','settings','qr','map','detail'].includes(screen))payload.screen=screen;
 let action=input.action;
 if(type==='itinerary_place_added')action='plan-add';else if(type==='qr_scan')action='qr-check';else if(type==='kiosk_open')action='kiosk-open';
 if(typeof action==='string'&&/^[a-z][a-z0-9-]{0,49}$/.test(action))payload.action=action;
 const destinationId=event.destinationId||input.destinationId;
 if(typeof destinationId==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(destinationId))payload.destinationId=destinationId;
 if(categories.includes(input.category))payload.category=input.category;
 if(Number.isInteger(input.queryLength)&&input.queryLength>=0&&input.queryLength<=300)payload.queryLength=input.queryLength;
 if(Number.isInteger(input.resultCount)&&input.resultCount>=0&&input.resultCount<=10000)payload.resultCount=input.resultCount;
 if(['device','kiosk','place'].includes(input.routeSource))payload.routeSource=input.routeSource;
 if(Number.isFinite(input.routeMeters)&&input.routeMeters>=0&&input.routeMeters<=500000)payload.routeMeters=input.routeMeters;
 if(['success','failure','granted','denied','current','updated','unavailable','invalid','requested'].includes(input.outcome))payload.outcome=input.outcome;
 if(['en','te','hi','0.9','1','1.1','1.2'].includes(String(input.settingValue)))payload.settingValue=String(input.settingValue);
 const inputLength=type==='qr_scan'?input.length:input.inputLength;
 if(Number.isInteger(inputLength)&&inputLength>=0&&inputLength<=10000)payload.inputLength=inputLength;
 if(Number.isInteger(input.rating)&&input.rating>=1&&input.rating<=5)payload.rating=input.rating;
 return payload;
}
function eventForSync(event,guestId){
 let type=event.type;
 if(type==='destination_view')type='screen_view';else if(type==='itinerary_place_added'||type==='kiosk_open')type='ui_action';else if(type==='qr_scan')type='qr_check';
 const wire={id:event.id,type,sessionId:event.sessionId||activitySessionId,createdAt:event.createdAt,payload:safeActivityPayload(event,event.type)};
 if(event.accountId)wire.accountId=event.accountId;else wire.guestId=event.guestId||guestId;
 if(type==='feedback'){
  wire.destinationId=event.destinationId||event.payload?.destinationId;
  wire.rating=event.rating||event.payload?.rating;
  wire.comment=event.comment||'';
  wire.payload=safeActivityPayload(event,'feedback');
 }
 return wire;
}
async function sendActivityBatch(events,token=''){
 for(let start=0;start<events.length;start+=100){
  const batch=events.slice(start,start+100);
  try{
   const headers={'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})};
   const response=await fetch(apiUrl('/api/sync/events'),{method:'POST',headers,body:JSON.stringify({events:batch})});
   if(!response.ok)break;
   const result=await response.json(),accepted=new Set(result.acceptedIds||[]);
   for(const event of batch)if(accepted.has(event.id)){await remove('events',event.id);if(event.type==='feedback')await remove('feedback',event.id);}
  }catch{break;}
 }
}
function scheduleActivitySync(){clearTimeout(activitySyncTimer);activitySyncTimer=setTimeout(()=>{activitySyncTimer=null;trySync();},1200);}
async function trySync(){
 if(!navigator.onLine)return;
 if(activitySyncPromise){activitySyncRequested=true;return activitySyncPromise;}
 activitySyncPromise=(async()=>{
  const queued=await all('events');
  const pending=queued.filter(event=>event.type==='feedback'||state.analyticsConsent==='enabled');
  if(!pending.length)return;
  const guestId=await ensureGuestId();
  for(const event of pending)if(!event.accountId&&!event.guestId){event.guestId=guestId;event.sessionId=event.sessionId||activitySessionId;await put('events',event);}
  const guestEvents=pending.filter(event=>!event.accountId).map(event=>eventForSync(event,guestId));
  if(guestEvents.length)await sendActivityBatch(guestEvents);
  const accountId=state.user?.id||sessionStorage.getItem('gv-account-id'),token=sessionStorage.getItem('gv-session');
  const accountEvents=accountId&&token?pending.filter(event=>event.accountId===accountId).map(event=>eventForSync(event,guestId)):[];
  if(accountEvents.length)await sendActivityBatch(accountEvents,token);
  state.events=await all('events');if(state.view==='settings')render();
 })().catch(error=>console.warn('Usage activity sync is waiting for a connection:',error)).finally(()=>{const retry=activitySyncRequested;activitySyncRequested=false;activitySyncPromise=null;if(retry)trySync();});
 return activitySyncPromise;
}
function validContent(payload){if(!payload||typeof payload.version!=='string'||!payload.version||!Array.isArray(payload.destinations)||!payload.destinations.length)return false;const ids=new Set();return payload.destinations.every(p=>{if(!p||typeof p.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||typeof p.category!=='string'||typeof p.summary!=='string'||typeof p.description!=='string'||typeof p.source!=='string')return false;try{if(new URL(p.source).protocol!=='https:')return false;}catch{return false;}ids.add(p.id);return true;});}
async function checkContentUpdate(){try{const response=await fetch(apiUrl('/api/content/current'));if(!response.ok)throw new Error('unavailable');const payload=await response.json();if(!validContent(payload))throw new Error('invalid');if(payload.version===state.contentVersion){recordActivity('content_update',{screen:currentScreen(),outcome:'current'});toast(tr('content_current'));return;}if(isLegacyBundledContent(payload.version)){recordActivity('content_update',{screen:currentScreen(),outcome:'current'});toast('Your bundled guide is newer than the server copy.');return;}await put('content',{id:'active',version:payload.version,destinations:payload.destinations});state.destinations=mergeDestinations(state.bundledDestinations,payload.destinations);state.contentVersion=payload.version;recordActivity('content_update',{screen:currentScreen(),outcome:'updated'});render();toast('Tourism content updated safely.');}catch{recordActivity('content_update',{screen:currentScreen(),outcome:'unavailable'});toast(tr('content_failed'));}}
function compareVersions(left,right){const a=String(left).split('.').map(Number),b=String(right).split('.').map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){const diff=(a[i]||0)-(b[i]||0);if(diff)return Math.sign(diff);}return 0;}
async function checkAppVersion(){try{const response=await fetch(apiUrl('/api/app-version'));if(!response.ok)throw new Error('offline');const update=await response.json();const current=document.querySelector('meta[name="app-version"]')?.content||'0.1.0';if(update.version&&compareVersions(update.version,current)>0){recordActivity('app_update',{screen:currentScreen(),outcome:'updated'});if(!update.storeUrl){toast('An update is available, but the official Play Store listing is not configured yet.');return;}if(confirm(`Guide Voyager ${update.version} is available. Open the Play Store?`))window.open(update.storeUrl,'_blank','noopener');else toast('Update later. You can keep using this version.');return;}recordActivity('app_update',{screen:currentScreen(),outcome:'current'});toast(tr('app_current'));}catch{recordActivity('app_update',{screen:currentScreen(),outcome:'unavailable'});toast(tr('app_failed'));}}
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),2600);}

boot();









