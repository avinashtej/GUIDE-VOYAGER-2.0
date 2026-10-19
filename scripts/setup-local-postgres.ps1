$ErrorActionPreference = 'Stop'

$dataRoot = Join-Path $env:LOCALAPPDATA 'GuideVoyager\postgres'
$dataDir = Join-Path $dataRoot 'data'
$localConfigDir = Join-Path $env:LOCALAPPDATA 'GuideVoyager'
$configPath = Join-Path $localConfigDir 'app.env'
$adminSecretPath = Join-Path $dataRoot 'admin.secret'
$passwordFile = Join-Path $dataRoot 'init-password.tmp'
$logPath = Join-Path $dataRoot 'server.log'
$pgBin = Join-Path $env:ProgramFiles 'PostgreSQL\17\bin'
$initdb = Join-Path $pgBin 'initdb.exe'
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'
$psql = Join-Path $pgBin 'psql.exe'
$createdb = Join-Path $pgBin 'createdb.exe'

function New-RandomHex([int]$length) {
  $bytes = New-Object 'System.Byte[]' $length
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
    return [System.BitConverter]::ToString($bytes).Replace('-', '')
  } finally {
    $rng.Dispose()
  }
}

function New-RandomBase64([int]$length) {
  $bytes = New-Object 'System.Byte[]' $length
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
  } finally {
    $rng.Dispose()
  }
}

if (Test-Path -LiteralPath $configPath) {
  throw 'A local Guide Voyager database configuration already exists. Use npm run db:start instead.'
}
if (-not (Test-Path -LiteralPath $initdb) -or -not (Test-Path -LiteralPath $pgCtl) -or -not (Test-Path -LiteralPath $psql) -or -not (Test-Path -LiteralPath $createdb)) {
  throw "PostgreSQL 17 was not found under $env:ProgramFiles\PostgreSQL\17. Install PostgreSQL 17, then run this command again."
}

New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $dataDir)) {
  $adminPassword = New-RandomHex 32
  [System.IO.File]::WriteAllText($adminSecretPath, $adminPassword, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($passwordFile, "$adminPassword`n", [System.Text.UTF8Encoding]::new($false))
  $initArgs = @('-D', $dataDir, '-U', 'postgres', "--pwfile=$passwordFile", '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--locale=C', '--encoding=UTF8')
  & $initdb @initArgs
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not initialize its local data directory.' }
  Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
} elseif (-not (Test-Path -LiteralPath $adminSecretPath)) {
  throw 'An incomplete local database directory exists without its setup key. Preserve it and inspect the PostgreSQL log before retrying.'
} else {
  $adminPassword = [System.IO.File]::ReadAllText($adminSecretPath).Trim()
}

& $pgCtl '-D' $dataDir 'status' *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl '-D' $dataDir '-l' $logPath '-o' '-h 127.0.0.1 -p 55432' '-w' 'start'
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not start. See the local server log in AppData\Local\GuideVoyager\postgres.' }
}

$appPassword = New-RandomHex 32
$jwtSecret = New-RandomBase64 48
$env:PGPASSWORD = $adminPassword
$roleSql = "DO `$setup`$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guide_voyager') THEN ALTER ROLE guide_voyager WITH LOGIN PASSWORD '$appPassword'; ELSE CREATE ROLE guide_voyager WITH LOGIN PASSWORD '$appPassword'; END IF; END `$setup`$;"
& $psql '-h' '127.0.0.1' '-p' '55432' '-U' 'postgres' '-d' 'postgres' '-v' 'ON_ERROR_STOP=1' '-c' $roleSql
if ($LASTEXITCODE -ne 0) { throw 'Could not create the Guide Voyager database login.' }
$dbExists = & $psql '-h' '127.0.0.1' '-p' '55432' '-U' 'postgres' '-d' 'postgres' '-tAc' "SELECT 1 FROM pg_database WHERE datname = 'guide_voyager';"
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect PostgreSQL databases.' }
if (($dbExists | Out-String).Trim() -ne '1') {
  & $createdb '-h' '127.0.0.1' '-p' '55432' '-U' 'postgres' '-O' 'guide_voyager' 'guide_voyager'
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the Guide Voyager database.' }
} else {
  & $psql '-h' '127.0.0.1' '-p' '55432' '-U' 'postgres' '-d' 'postgres' '-v' 'ON_ERROR_STOP=1' '-c' 'ALTER DATABASE guide_voyager OWNER TO guide_voyager;'
  if ($LASTEXITCODE -ne 0) { throw 'Could not assign the Guide Voyager database owner.' }
}

New-Item -ItemType Directory -Path $localConfigDir -Force | Out-Null
$config = @"
PORT=3000
DATABASE_URL=postgresql://guide_voyager:$appPassword@127.0.0.1:55432/guide_voyager
PGSSLMODE=
JWT_SECRET=$jwtSecret
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,capacitor://localhost,https://localhost
APP_VERSION=0.1.0
PLAY_STORE_URL=
"@
[System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))
Remove-Item -LiteralPath $adminSecretPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
$env:PGPASSWORD = $null
$adminPassword = $null
$appPassword = $null
$jwtSecret = $null
$roleSql = $null
$config = $null

Write-Output 'Local PostgreSQL is configured with a dedicated Guide Voyager database and login.'
Write-Output 'Database files and secrets are stored under your Windows Local AppData folder, outside OneDrive.'
Write-Output 'Next, start the API with: npm start'
