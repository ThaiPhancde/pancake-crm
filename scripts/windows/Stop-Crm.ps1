$ErrorActionPreference = 'Stop'
$crmRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$processFile = Join-Path $crmRoot '.logs\processes.json'
if (-not (Test-Path -LiteralPath $processFile)) { Write-Output 'No recorded CRM processes.'; exit 0 }
$recorded = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
$previewFile = Join-Path $crmRoot '.logs\demo-preview.json'
if (Test-Path -LiteralPath $previewFile) { $recorded = @($recorded) + @((Get-Content -LiteralPath $previewFile -Raw | ConvertFrom-Json)) }
foreach ($entry in $recorded) {
  $parentProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.id)"
  if (-not $parentProcess) { continue }
  if (-not $parentProcess.CommandLine.Contains($crmRoot)) { throw 'Recorded process does not belong to this CRM. Stop is refused.' }
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($entry.id)"
  foreach ($child in $children) {
    Stop-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
  }
  Stop-Process -Id $entry.id -ErrorAction SilentlyContinue
  Write-Output "Stopped CRM $($entry.name)."
}
