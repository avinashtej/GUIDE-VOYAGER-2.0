# Deploy Guide Voyager on Render

This repository uses one Node web service for the tourist app, API, and admin dashboard. The service connects to a Render PostgreSQL database using its private/internal connection URL.

## Deploy the service

1. Push the project, including `render.yaml`, to the GitHub branch connected to Render.
2. In Render, choose **New + → Blueprint** and select the `GUIDE-VOYAGER-2.0` repository and `main` branch.
3. Render reads `render.yaml`. Keep the web service name `guide-voyager` and select the Free plan for an initial trial. The build command must be `npm ci --include=dev && npm run build:mobile` so Vite is installed during the build even when `NODE_ENV=production`.
4. When Render asks for `DATABASE_URL`, open the existing `guide-voyager` PostgreSQL service in another tab, open **Connect**, and copy its **Internal Database URL**. Paste it into Render's secret/environment variable prompt. Do not put this URL in GitHub, chat, or a source file.
5. Render generates `JWT_SECRET`. Leave that generated value unchanged and private.
6. Review and create the Blueprint. Wait for the service deploy to finish successfully.

The health check is `/api/health`. It returns success only after it can connect to PostgreSQL. On first startup, the API applies the SQL migrations and seeds the initial published destinations.

## Verify the deployment

Open these URLs using the service's `onrender.com` hostname:

- `/api/health` — should return JSON with `"status":"ok"` and `"database":"connected"`.
- `/` — tourist app.
- `/admin/` — admin dashboard.

Create a user account in the app, then promote the administrator account once through the database's SQL console:

```sql
UPDATE users SET role = 'admin' WHERE email = lower('your-admin-email@example.com');
```

Sign in at `/admin/` with that account. Keep database and JWT credentials private.

## Connect the Android build

The Android package needs the deployed API origin embedded when it is built. In PowerShell, from the project folder, set the base URL to the service origin (no trailing slash), then run the existing Capacitor build/sync command:

```powershell
$env:VITE_API_BASE_URL = 'https://YOUR-SERVICE.onrender.com'
npm run cap:sync
```

Replace `YOUR-SERVICE` with the actual Render service hostname. Keep that environment variable set for each Android release build. The API already permits requests from Capacitor's `capacitor://localhost` origin.

## Free-plan limits

Render's Free web service can spin down when idle, so the first request after inactivity may take longer. Free Render PostgreSQL expires 30 days after creation; it is suitable for deployment testing, not long-term records. Upgrade the database before treating real user accounts, activity, and feedback as retained production data. Export or back up any trial data before the database expires.
