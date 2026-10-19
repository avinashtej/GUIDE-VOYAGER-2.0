param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('Start', 'Stop', 'Status')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$dataRoot = Join-Path $env:LOCALAPPDATA 'GuideVoyager\postgres'
$dataDir = Join-Path $dataRoot 'data'
$logPath = Join-Path $dataRoot 'server.log'
$pgCtl = Join-Path $env:ProgramFiles 'PostgreSQL\17\bin\pg_ctl.exe'

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw 'PostgreSQL 17 binaries are missing. Install PostgreSQL 17, then run npm run db:setup.'
}
if (-not (Test-Path -LiteralPath $dataDir)) {
  throw 'The local database has not been initialized. Run npm run db:setup first.'
}

if ($Action -eq 'Status') {
  & $pgCtl '-D' $dataDir 'status'
  exit $LASTEXITCODE
}

if ($Action -eq 'Start') {
  & $pgCtl '-D' $dataDir 'status' *> $null
  if ($LASTEXITCODE -eq 0) {
    'Local PostgreSQL is already running.'
    exit 0
  }

  & $pgCtl '-D' $dataDir '-l' $logPath '-o' '-h 127.0.0.1 -p 55432' '-w' 'start'
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not start. See the local server log in AppData\Local\GuideVoyager\postgres.' }
  'Local PostgreSQL is running on 127.0.0.1:55432.'
  exit 0
}

& $pgCtl '-D' $dataDir '-m' 'fast' '-w' 'stop'
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not be stopped cleanly.' }
'Local PostgreSQL stopped.'
