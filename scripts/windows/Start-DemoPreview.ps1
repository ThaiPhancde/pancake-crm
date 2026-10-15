$ErrorActionPreference='Stop'
$crmRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (Get-NetTCPConnection -LocalPort 3120 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 3120 is occupied.' }
$nodeBinary=if ($env:NVM_HOME) { Join-Path $env:NVM_HOME 'v22.14.0\node.exe' } else { '' }
if (-not (Test-Path -LiteralPath $nodeBinary)) { $nodeBinary=(Get-Command node -ErrorAction Stop).Source }
$env:NODE_ENV='development'
$env:DATABASE_URL='postgresql://crm_fixture@127.0.0.1:55432/comp_ai_crm_demo?schema=public'
$env:PANCAKE_DEMO_MODE='1'
$env:PANCAKE_LIVE_SYNC_ENABLED='0'
$env:CRM_TELEMETRY_DISABLED='1'
$env:DO_NOT_TRACK='1'
$env:APP_URL='http://localhost:3120'
$logFolder=Join-Path $crmRoot '.logs'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
$nextBinary=Join-Path $crmRoot 'apps\app\node_modules\next\dist\bin\next'
$previewProcess=Start-Process -FilePath $nodeBinary -ArgumentList @($nextBinary,'dev','--hostname','127.0.0.1','--port','3120') -WorkingDirectory (Join-Path $crmRoot 'apps\app') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logFolder 'demo-preview.log') -RedirectStandardError (Join-Path $logFolder 'demo-preview-error.log')
@{name='demo-preview';id=$previewProcess.Id;startedAt=$previewProcess.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $logFolder 'demo-preview.json')
Write-Output 'Safe sample preview: http://localhost:3120/pancake-demo'
