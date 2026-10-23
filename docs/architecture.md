# Architecture notes

## Runtime boundaries

```text
mobile-app (HTML/CSS/JS, Capacitor)
  ├─ local guide + saved guest state (SQLite on Android, IndexedDB in browser)
  ├─ optional online auth and retry-safe event upload
  └─ published tourism-content snapshots

admin-dashboard (separate HTML/CSS/JS app)
  └─ authenticated REST API
        ├─ Express API and validation
        └─ PostgreSQL (users, destinations, drafts, versions, feedback, events)

ESP32 kiosk remains a separate system. QR payload parsing is intentionally an adapter boundary.
```

## Local data contract

The mobile store exposes `all`, `get`, `put`, and `remove`. Guest favorites, itineraries, preferences, pending feedback/events, and the active content snapshot are separate stores. An update is activated only after checking a version, non-empty destination list, unique IDs, required text and HTTPS source URLs. User-edited lists stay in their own stores when content is replaced.

Android uses the Capacitor SQLite plugin. This initial build sets the database to unencrypted because the account-data encryption/key lifecycle is still unresolved. The app currently does not synchronize account favorites or itineraries and does not persist account-specific data locally. Resolve encryption and logout isolation before enabling those features.

## Content publishing

An administrator saves a draft, runs the validation/preview step, then explicitly publishes it. Only the publish endpoint updates the public destination table and writes a new immutable snapshot into `content_versions`. Mobile clients download the latest published snapshot; drafts never appear in tourist responses.

## Event processing

Usage activity sharing is on by default for each app installation. A user can turn it off in Settings. While sharing is on, screen views and app actions are recorded for signed-in accounts or under a persistent random guest ID; events include a per-launch session ID and sync in batches when the API is reachable. Offline events remain queued and are removed only after the server acknowledges their IDs, so retries are safe. The admin dashboard shows the account email or pseudonymous guest ID, session and event details. Turning sharing off clears queued activity on that device; previously received records remain available to administrators for up to 24 months.

Search text, passwords, QR contents and precise location coordinates are never included in analytics. Search length and result count, destination IDs, action names, route source and route distance may be stored. Location permission results are recorded without location coordinates. User-submitted feedback is a separate feature: its rating and optional comment are sent for administrator review even when analytics is off, because the user explicitly submits that feedback.

Each event has a UUID and event timestamp. Uploads accept batches of at most 100, store the event ID as a primary key, and safely ignore duplicate IDs on retry. Events are linked to an account only when the API validates a token for that account; guest events use the installation's random guest ID. Feedback entries start pending administrator review; only approved ratings contribute to the dashboard rating summary. The sync endpoint is rate-limited. Scans and opens are events only; they are not treated as proof of a visit.

A daily API cleanup deletes detailed analytics older than 24 months. Feedback is stored separately and is not deleted by this policy. Production backup and export retention need a matching operational policy.

## Maps and destination artwork

Real destination photographs are stored in the app bundle and cached for offline viewing. Commons photographs show their photographer and reuse license; official venue and hospital photographs link to their source page, whose reuse terms are not stated. The Government General Hospital and City Police photos are CC0; the Andhra Hospitals photo is CC BY-SA 4.0. Laila Mall uses a photographed INOX lobby image from [AndhraBoxOffice.com on X](https://x.com/AndhraBoxOffice/status/1607621056663269382); its post does not state a reuse license, and the picture is of the lobby rather than the mall exterior. PVP Square uses an exterior photo; LEPL Centro, Aayush Hospitals and Manipal Hospitals use official facility photos. A place without a usable, verifiable photo keeps an offline fallback rather than a remote or fabricated image. The local destination directory includes Vijayawada malls, major hospitals and the city police commissionerate, with official addresses and published contact numbers where available. India’s 112 emergency number is shown on map screens.

Maps and Nearby render a bundled OpenStreetMap extract locally on a canvas. `mobile-app/public/data/vijayawada-map.json` covers 80.43–80.75° E and 16.38–16.62° N, with 142,122 road nodes, 28,063 road segments, named map features and a coordinate record for each guide destination. It is cached by the service worker and works without requesting live map tiles. The OSM snapshot is dated 2026-10-19 and the map UI links to the ODbL attribution.

`mobile-app/src/offline-map.js` builds an on-device walking graph and calculates the shortest distance route between the nearest mapped road nodes. After a destination and device or kiosk start are selected, the map labels START and DESTINATION; the user taps Start shortest route before the path and written steps appear. It turns road geometry into compass and left/right steps. The route origin can be device location, requested only after a tap and held in memory for that session, or a map point saved as the kiosk start in local settings. The app excludes roads marked private or foot-prohibited and motorways. Routes are computed from OSM data; they are not surveyed or live-validated navigation. The map has no traffic, transit, live closures, voice guidance or car-mode routing. Bhavani Island directs visitors to the mapped APSTDC boat service point and notes that a boat crossing is required; the Mangalagiri route pin is the mapped temple parking/access point. Other facility points are matched to OSM names or carry their coordinate source in the bundled file. Check local entry, crossing and route conditions before travel.

## Not yet selected

- Periodic OSM extract refresh and review of destination access points and walking routes.
- Hardware QR schema and real sample images.
- Encryption secret management, Android recovery, and account-data isolation after logout.
- Play Store URL and production backup/recovery operations.

For Android builds that use a separately hosted API, set `VITE_API_BASE_URL` to the deployed API origin during the Vite build. Same-origin browser deployments can leave it blank. The backend migration runner applies the activity attribution migration at startup.
