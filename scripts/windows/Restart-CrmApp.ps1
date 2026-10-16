$ErrorActionPreference = 'Stop'
$crmRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$recordPath = Join-Path $crmRoot '.logs\processes.json'
$records = @(Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json)
$appRecord = $records | Where-Object name -eq 'app'
if (-not $appRecord) { throw 'No recorded CRM app process.' }
$appOwner = Get-CimInstance Win32_Process -Filter "ProcessId = $($appRecord.id)"
if (-not $appOwner) { throw 'The recorded CRM app process is absent.' }
$nextBinary = Join-Path $crmRoot 'apps\app\node_modules\next\dist\bin\next'
if ($appOwner.CommandLine.IndexOf($nextBinary, [StringComparison]::OrdinalIgnoreCase) -lt 0 -or $appOwner.CommandLine -notlike '*start*--port 3100*') {
  throw 'The recorded process is not the CRM production app on port 3100.'
}
$liveProcess = Get-Process -Id $appRecord.id
$recordedStart = if ($appRecord.startedAt -is [DateTime]) { $appRecord.startedAt.ToUniversalTime() } else { [DateTime]::Parse([string]$appRecord.startedAt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime() }
if ($liveProcess.StartTime.ToUniversalTime() -ne $recordedStart) { throw 'The app process ID is reused.' }
$nodeBinary = $appOwner.ExecutablePath
if (-not (Test-Path -LiteralPath (Join-Path $crmRoot 'apps\app\.next\BUILD_ID'))) { throw 'Build the app before restarting.' }
Stop-Process -Id $appRecord.id
Wait-Process -Id $appRecord.id -Timeout 15 -ErrorAction SilentlyContinue
$env:NODE_ENV = 'production'
$env:APP_URL = 'http://localhost:3100'
$env:API_URL = 'http://localhost:3101'
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3101'
$env:PANCAKE_DEMO_MODE = '0'
$env:CRM_TELEMETRY_DISABLED = '1'
$appProcess = Start-Process -FilePath $nodeBinary -ArgumentList @($nextBinary,'start','--hostname','127.0.0.1','--port','3100') -WorkingDirectory (Join-Path $crmRoot 'apps\app') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $crmRoot '.logs\app.log') -RedirectStandardError (Join-Path $crmRoot '.logs\app-error.log')
$appRecord.id = $appProcess.Id
$appRecord.startedAt = $appProcess.StartTime.ToUniversalTime().ToString('o')
$records | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8
Write-Output 'CRM app restarts on http://localhost:3100.'
