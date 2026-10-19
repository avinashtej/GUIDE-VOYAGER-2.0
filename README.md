# Guide Voyager 2.0

An offline-first Vijayawada tourism guide with a plain HTML/CSS/JavaScript mobile experience, Capacitor Android packaging, a Node/Express API, PostgreSQL content and feedback storage, and a separate administrator content studio.

## Current implementation

- Welcome and guest entry, responsive destination discovery, search and categories.
- Nineteen bundled destinations: attractions, transport hubs, malls, major hospitals and the Vijayawada City Police Commissionerate. Each entry links to a district, tourism, health-provider or venue source. Volatile details such as current hours and schedules are called out for confirmation.
- English, Telugu and Hindi interface labels and localized place names. Descriptions are currently in English.
- Offline saved places, a one-list itinerary, font-size preference and a feedback queue. Browser builds use IndexedDB; native builds use the Capacitor SQLite plugin.
- A modular QR entry/decoder that does not interpret the payload until the hardware team supplies the format and sample codes.
- Backend authentication, idempotent event/feedback ingestion, published content snapshots, draft validation and explicit publish steps, administrator feedback views, and 24-month analytics cleanup.
- Progressive Web App shell caching for a browser install. The Android build packages its local web assets.

## Run locally

Requires Node.js 20.19 or newer. PostgreSQL 13 or newer is needed for accounts, online synchronization and the admin studio; the tourist guide itself can run without it. Create the database named in `DATABASE_URL` before starting the API.

1. Install dependencies: `npm install`
2. For a local Windows database, run `npm run db:setup` once. It initializes PostgreSQL 17 on `127.0.0.1:55432` and stores database files and secrets in `%LOCALAPPDATA%\GuideVoyager`, outside the project folder. After a Windows restart, run `npm run db:start`.
3. Start the API and app: `npm start`
4. Open the tourist app at `http://localhost:3000` and the admin studio at `http://localhost:3000/admin/`.

For another PostgreSQL instance, copy `.env.example` to `.env` and set `DATABASE_URL` plus a random `JWT_SECRET` of at least 32 characters. The local database created by `db:setup` is available only on this PC; use a hosted PostgreSQL database and set the API URL for cross-device accounts or production use.

On startup the API applies the numbered, idempotent SQL files in `backend/migrations/` and seeds the first published content snapshot from `mobile-app/public/data/destinations.json`. It removes analytics events older than 24 months at startup and once per day while the API is running.

Create an account in the app, then promote the account using a database administrator connection:

```sql
UPDATE users SET role = 'admin' WHERE email = lower('your-admin-email@example.com');
```

The admin studio requires the `admin` role. Do not expose database credentials or `JWT_SECRET` in source control.

## Android packaging

The `android/` Capacitor platform is scaffolded in this workspace. The web UI remains plain JavaScript; Vite bundles it so Capacitor can include the SQLite plugin and native Android platform code.

```sh
npm run cap:sync
npm run cap:open:android
```

Build the APK from Android Studio or Gradle after the Android SDK/JDK are configured. The app identifier is `in.guidevoyager.app`. App distribution and the official Play Store listing are not configured yet. If you recreate the platform folder later, run `npm run cap:add:android` once before syncing.

## API outline

- `GET /api/health`
- `GET /api/destinations`, `GET /api/content/current`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `POST /api/sync/events` (retry-safe event IDs; feedback is attached to a destination)
- Admin: `GET /api/admin/drafts`, `GET /api/admin/destinations`, `POST /api/admin/drafts`, `PUT /api/admin/drafts/:id`, `POST /api/admin/drafts/:id/preview`, `POST /api/admin/drafts/:id/publish`, `GET /api/admin/feedback`, `PATCH /api/admin/feedback/:eventId/review`
- `GET /api/app-version`

## Data and known dependencies

- Place summaries are linked to official NTR/Guntur district pages, Incredible India and official operator material in the content JSON. Check the source links before publishing any time-sensitive details.
- Real destination photographs are bundled locally and cached for offline viewing. Commons images show photographer and license links. Newly added Commons photos cover Government General Hospital, Andhra Hospitals (CC BY-SA 4.0) and the City Police building (CC0). Laila Mall shows a real INOX lobby photo from [AndhraBoxOffice.com on X](https://x.com/AndhraBoxOffice/status/1607621056663269382); that post does not state a reuse license, and the photo is of the lobby rather than the mall exterior. PVP Square uses an exterior photo; LEPL Centro, Aayush Hospitals, and Manipal Hospitals have official facility photos bundled.
- The guide bundles 19 destinations, including Vijayawada malls, major hospitals and the city police commissionerate. The new essentials include addresses and published call numbers where available; urgent help is linked to India’s 112 service.
- Maps and Nearby draw the bundled Vijayawada OSM road extract locally; they do not load live map tiles. The 4.5 MB map file includes about 142,000 road nodes, 28,000 road segments, and map points for the 19 guide destinations. It is cached for offline viewing. After selecting a destination and setting device or kiosk location, choose Start shortest route to show the shortest path in the bundled walking network.
- Walking routes are calculated on-device from the bundled road graph, starting from device location or a kiosk point saved on the device. The numbered left/right steps are derived from OSM street geometry, not a surveyed route or live navigation service; check local access and crossings before travelling. Bhavani Island routes stop at its mapped APSTDC boat service point.
- The map extract is © OpenStreetMap contributors, ODbL 1.0, snapshot 2026-10-19. Destination pins are matched to named OSM features or come from the coordinate source recorded in the map data; some facilities may have approximate access points.
- The hardware QR contract and samples are outstanding; the app currently displays raw decoded text without interpreting it.
- Account registration/login is implemented. Cross-device favorites/itinerary sync, guest-data migration and protected account-specific offline data are not active. The local encryption/key-management decision remains open in the blueprint.
- Admin drafts currently manage destination text and source links. Translation review, image management, route/transport editing, analytics dashboards and inactive-content controls remain to be implemented.
- No live railway/bus timetables, fares, travel durations, app-store URL or hosting configuration are bundled.
- Detailed analytics events are deleted after 24 months by the running API process. Production operations still need a backup/export retention policy and monitoring for cleanup failures.

See [docs/architecture.md](docs/architecture.md) for the initial contracts and implementation boundaries.
