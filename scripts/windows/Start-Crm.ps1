param([switch]$Demo, [switch]$Production)
$ErrorActionPreference = 'Stop'
$crmRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$bunBinary = Join-Path (Split-Path $crmRoot -Parent) '.tools\bun-windows-x64\bun.exe'
if (-not (Test-Path -LiteralPath $bunBinary)) { $bunBinary = (Get-Command bun -ErrorAction Stop).Source }
$nodeBinary = if ($env:NVM_HOME) { Join-Path $env:NVM_HOME 'v22.14.0\node.exe' } else { '' }
if (-not (Test-Path -LiteralPath $nodeBinary)) { $nodeBinary = (Get-Command node -ErrorAction Stop).Source }
$nodeVersion = & $nodeBinary --version
if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) { throw 'CRM requires a dedicated Node.js 22 or newer executable.' }
foreach ($portNumber in @(3100,3101)) {
  if (Get-NetTCPConnection -LocalPort $portNumber -State Listen -ErrorAction SilentlyContinue) { throw "Port $portNumber is occupied. No process is stopped." }
}
if ($Demo -and $Production) { throw 'Demo mode cannot use production mode.' }
$logFolder = Join-Path $crmRoot '.logs'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
$env:CRM_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'
$env:APP_URL = 'http://localhost:3100'
$env:API_URL = 'http://localhost:3101'
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3101'
$env:PORT = '3101'
$env:API_HOST = '127.0.0.1'
if ($Demo) {
  $env:NODE_ENV = 'development'
  $env:DATABASE_URL = 'postgresql://crm_fixture@127.0.0.1:55432/comp_ai_crm_demo?schema=public'
  $env:ALLOWED_SIGN_IN = 'admin@example.invalid'
  $env:PANCAKE_DEMO_MODE = '1'
  $env:PANCAKE_LIVE_SYNC_ENABLED = '0'
} else {
  $env:PANCAKE_DEMO_MODE = '0'
  & $bunBinary (Join-Path $crmRoot 'scripts\validate-windows.ts')
  if ($LASTEXITCODE -ne 0) { throw 'CRM configuration validation fails.' }
  $env:NODE_ENV = if ($Production) { 'production' } else { 'development' }
}
$nextBinary = Join-Path $crmRoot 'apps\app\node_modules\next\dist\bin\next'
$nextMode = if ($Production) { 'start' } else { 'dev' }
$apiEntry = if ($Production) { Join-Path $crmRoot 'apps\api\dist\main.js' } else { Join-Path $crmRoot 'apps\api\src\main.ts' }
$apiProcess = Start-Process -FilePath $bunBinary -ArgumentList @($apiEntry) -WorkingDirectory (Join-Path $crmRoot 'apps\api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logFolder 'api.log') -RedirectStandardError (Join-Path $logFolder 'api-error.log')
$appProcess = Start-Process -FilePath $nodeBinary -ArgumentList @($nextBinary,$nextMode,'--hostname','127.0.0.1','--port','3100') -WorkingDirectory (Join-Path $crmRoot 'apps\app') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logFolder 'app.log') -RedirectStandardError (Join-Path $logFolder 'app-error.log')
$processList = @(@{name='api';id=$apiProcess.Id;startedAt=$apiProcess.StartTime.ToUniversalTime().ToString('o')},@{name='app';id=$appProcess.Id;startedAt=$appProcess.StartTime.ToUniversalTime().ToString('o')})
if (-not $Demo) {
  $workerProcess = Start-Process -FilePath $bunBinary -ArgumentList @((Join-Path $crmRoot 'apps\pancake-sync\src\main.ts')) -WorkingDirectory $crmRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logFolder 'pancake-worker.log') -RedirectStandardError (Join-Path $logFolder 'pancake-worker-error.log')
  try {
    $workerStartedAt = $workerProcess.StartTime.ToUniversalTime().ToString('o')
    $processList += @{name='pancake-worker';id=$workerProcess.Id;startedAt=$workerStartedAt}
  } catch {
    if (-not $workerProcess.HasExited) { throw }
  }
}
$processList | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $logFolder 'processes.json')
$startupDeadline = [DateTime]::UtcNow.AddSeconds(60)
do {
  $apiReady = Get-NetTCPConnection -LocalPort 3101 -State Listen -ErrorAction SilentlyContinue
  $appReady = Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue
  if ($apiReady -and $appReady) { break }
  Start-Sleep -Milliseconds 500
} while ([DateTime]::UtcNow -lt $startupDeadline)
if (-not $apiReady -or -not $appReady) { throw 'CRM startup fails. Inspect .logs/api-error.log and .logs/app-error.log.' }
Write-Output 'CRM starts on http://localhost:3100. API starts on http://localhost:3101.'
if ($Demo) { Write-Output 'Safe sample preview: http://localhost:3100/pancake-demo' }
