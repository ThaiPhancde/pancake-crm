$ErrorActionPreference = 'Stop'
$crmRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'Runtime-Config.psd1')
$logFolder = Join-Path $crmRoot '.logs'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
Set-Content -LiteralPath (Join-Path $logFolder 'runtime-paused') -Value ([DateTime]::UtcNow.ToString('o'))
$rootHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($crmRoot.ToLowerInvariant()))).Replace('-', '')
$runtimeLock = New-Object Threading.Mutex($false, "Local\PancakeCRM-$rootHash")
$lockHeld = $false
try {
  try { $lockHeld = $runtimeLock.WaitOne([TimeSpan]::FromSeconds($config.LockTimeoutSeconds)) } catch [Threading.AbandonedMutexException] { $lockHeld = $true }
  if (-not $lockHeld) { throw 'CRM startup is still running. Recovery is paused; retry Stop-Crm.' }
  $processFile = Join-Path $crmRoot '.logs\processes.json'
  if (-not (Test-Path -LiteralPath $processFile)) { Write-Output 'No recorded CRM processes.'; exit 0 }
  $recorded = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
  $previewFile = Join-Path $crmRoot '.logs\demo-preview.json'
  if (Test-Path -LiteralPath $previewFile) { $recorded = @($recorded) + @((Get-Content -LiteralPath $previewFile -Raw | ConvertFrom-Json)) }
  foreach ($entry in $recorded) {
    $parentProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.id)"
    if (-not $parentProcess) { continue }
    if ([string]::IsNullOrWhiteSpace($parentProcess.CommandLine) -or $parentProcess.CommandLine.IndexOf($crmRoot, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
      Write-Output "Skipped stale CRM process record for $($entry.name)."
      continue
    }
    if ($entry.startedAt) {
      $liveProcess = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
      if (-not $liveProcess) { continue }
      try { $actualStart = $liveProcess.StartTime.ToUniversalTime() } catch { continue }
      $recordedStart = if ($entry.startedAt -is [DateTime]) { $entry.startedAt.ToUniversalTime() } else { [DateTime]::Parse([string]$entry.startedAt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime() }
      if ($actualStart -ne $recordedStart) {
        Write-Output "Skipped reused CRM process ID for $($entry.name)."
        continue
      }
    }
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($entry.id)"
    foreach ($child in $children) {
      Stop-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
    }
    Stop-Process -Id $entry.id -ErrorAction SilentlyContinue
    Write-Output "Stopped CRM $($entry.name)."
  }

} finally {
  if ($lockHeld) { $runtimeLock.ReleaseMutex() }
  $runtimeLock.Dispose()
}
