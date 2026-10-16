param([switch]$Demo, [switch]$Production, [switch]$EnsureRunning)
$ErrorActionPreference = 'Stop'
$crmRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'Runtime-Config.psd1')
$logFolder = Join-Path $crmRoot '.logs'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
$pauseFile = Join-Path $logFolder 'runtime-paused'
if ($EnsureRunning -and (Test-Path -LiteralPath $pauseFile)) { Write-Output 'CRM monitoring is paused.'; exit 0 }
if ($Demo -and ($Production -or $EnsureRunning)) { throw 'Demo mode cannot use production monitoring.' }
$rootHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($crmRoot.ToLowerInvariant()))).Replace('-', '')
$runtimeLock = New-Object Threading.Mutex($false, "Local\PancakeCRM-$rootHash")
$lockHeld = $false
try {
  try { $lockHeld = $runtimeLock.WaitOne([TimeSpan]::FromSeconds($config.LockTimeoutSeconds)) } catch [Threading.AbandonedMutexException] { $lockHeld = $true }
  if (-not $lockHeld) { throw 'Another CRM startup is still running.' }
  if ($EnsureRunning -and (Test-Path -LiteralPath $pauseFile)) { Write-Output 'CRM monitoring is paused.'; exit 0 }
  if (-not $EnsureRunning -and (Test-Path -LiteralPath $pauseFile)) { Remove-Item -LiteralPath $pauseFile }
  $bunBinary = Join-Path (Split-Path $crmRoot -Parent) '.tools\bun-windows-x64\bun.exe'
  if (-not (Test-Path -LiteralPath $bunBinary)) { $bunBinary = (Get-Command bun -ErrorAction Stop).Source }
  $nodeBinary = if ($env:NVM_HOME) { Join-Path $env:NVM_HOME 'v22.14.0\node.exe' } else { '' }
  if (-not (Test-Path -LiteralPath $nodeBinary)) { $nodeBinary = (Get-Command node -ErrorAction Stop).Source }
  $nodeVersion = & $nodeBinary --version
  if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) { throw 'CRM requires Node.js 22 or newer.' }
  $env:CRM_TELEMETRY_DISABLED = '1'
  $env:DO_NOT_TRACK = '1'
  $env:APP_URL = "http://localhost:$($config.AppPort)"
  $env:API_URL = "http://localhost:$($config.ApiPort)"
  $env:NEXT_PUBLIC_API_URL = $env:API_URL
  $env:PORT = [string]$config.ApiPort
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
  Push-Location $crmRoot
  try {
    $runtimeStateJson = & $bunBinary (Join-Path $PSScriptRoot 'runtime-state.ts')
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read CRM runtime configuration.' }
    $runtimeState = $runtimeStateJson | ConvertFrom-Json
  } finally { Pop-Location }
  $nextBinary = Join-Path $crmRoot 'apps\app\node_modules\next\dist\bin\next'
  $nextMode = if ($Production) { 'start' } else { 'dev' }
  $apiEntry = if ($Production) { Join-Path $crmRoot 'apps\api\dist\main.js' } else { Join-Path $crmRoot 'apps\api\src\main.ts' }
  $processFile = Join-Path $logFolder 'processes.json'
  $recorded = @()
  if (Test-Path -LiteralPath $processFile) { $recorded = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json }
  $definitions = @(
    @{Name='api';Port=$config.ApiPort;Binary=$bunBinary;Arguments=@(('"{0}"' -f $apiEntry));Directory=(Join-Path $crmRoot 'apps\api');Expected=$apiEntry},
    @{Name='app';Port=$config.AppPort;Binary=$nodeBinary;Arguments=@(('"{0}"' -f $nextBinary),$nextMode,'--hostname','127.0.0.1','--port',[string]$config.AppPort);Directory=(Join-Path $crmRoot 'apps\app');Expected=$nextBinary}
  )
  if (-not $Demo -and $runtimeState.liveSyncEnabled) {
    $workerEntry = Join-Path $crmRoot 'apps\pancake-sync\src\main.ts'
    $definitions += @{Name='pancake-worker';Port=0;Binary=$bunBinary;Arguments=@(('"{0}"' -f $workerEntry));Directory=$crmRoot;Expected=$workerEntry}
  }
  $resolved = @()
  foreach ($definition in $definitions) {
    $candidate = $null
    if ($definition.Port) {
      $listener = @(Get-NetTCPConnection -LocalPort $definition.Port -State Listen -ErrorAction SilentlyContinue)
      if ($listener.Count) {
        $ownerIds = @($listener.OwningProcess | Select-Object -Unique)
        if ($ownerIds.Count -ne 1) { throw "Port $($definition.Port) has multiple owners. No process is stopped." }
        $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $($ownerIds[0])"
        if ($candidate -and ($candidate.CommandLine.IndexOf($definition.Expected, [StringComparison]::OrdinalIgnoreCase) -lt 0)) {
          $parentProc = Get-CimInstance Win32_Process -Filter "ProcessId = $($candidate.ParentProcessId)"
          if ($parentProc -and $parentProc.CommandLine -and ($parentProc.CommandLine.IndexOf($definition.Expected, [StringComparison]::OrdinalIgnoreCase) -ge 0)) {
            $candidate = $parentProc
          }
        }
        if (-not $candidate -or [string]::IsNullOrWhiteSpace($candidate.CommandLine) -or $candidate.CommandLine.IndexOf($definition.Expected, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
          throw "Port $($definition.Port) belongs to another process. No process is stopped."
        }
        if ($definition.Name -eq 'app' -and $candidate.CommandLine -notmatch ("\s" + $nextMode + "\s")) { throw 'The running CRM app uses a different mode. Stop it before changing modes.' }
      }
    } else {
      $candidates = @(Get-CimInstance Win32_Process -Filter "Name = 'bun.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($definition.Expected, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
      if ($candidates.Count -gt 1) { throw 'Multiple Pancake workers exist. Resolve duplicate workers before monitoring.' }
      if ($candidates.Count) { $candidate = $candidates[0] }
    }
    if (-not $candidate) {
      $entry = @($recorded | Where-Object { $_.name -eq $definition.Name } | Select-Object -First 1)
      if ($entry.Count) {
        $pending = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry[0].id)"
        if ($pending -and $pending.CommandLine -and $pending.CommandLine.IndexOf($definition.Expected, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
          $live = Get-Process -Id $pending.ProcessId -ErrorAction SilentlyContinue
          if ($live -and $entry[0].startedAt -and $live.StartTime.ToUniversalTime() -eq [DateTime]::Parse([string]$entry[0].startedAt).ToUniversalTime()) { $candidate = $pending }
        }
      }
    }
    $resolved += @{Definition=$definition;Process=$candidate}
  }
  $processList = @()
  foreach ($item in $resolved) {
    $definition = $item.Definition
    if ($item.Process) {
      $current = Get-Process -Id $item.Process.ProcessId -ErrorAction Stop
      Write-Output "CRM $($definition.Name) is already running (PID $($current.Id))."
    } else {
      if (Test-Path -LiteralPath $pauseFile) { throw 'CRM startup is cancelled by Stop-Crm.' }
      $current = Start-Process -FilePath $definition.Binary -ArgumentList $definition.Arguments -WorkingDirectory $definition.Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logFolder "$($definition.Name).log") -RedirectStandardError (Join-Path $logFolder "$($definition.Name)-error.log")
      Write-Output "Started CRM $($definition.Name) (PID $($current.Id))."
    }
    $processList += @{name=$definition.Name;id=$current.Id;startedAt=$current.StartTime.ToUniversalTime().ToString('o')}
    ConvertTo-Json -InputObject @($processList) | Set-Content -Encoding utf8 -LiteralPath $processFile
  }
  $startupDeadline = [DateTime]::UtcNow.AddSeconds($config.StartupTimeoutSeconds)
  do {
    $ready = $true
    foreach ($entry in $processList) {
      $live = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
      if (-not $live) { throw "CRM $($entry.name) exits during startup. Inspect .logs/$($entry.name)-error.log." }
      $definition = $definitions | Where-Object { $_.Name -eq $entry.name }
      if ($definition.Port) {
        $listeners = @(Get-NetTCPConnection -LocalPort $definition.Port -State Listen -ErrorAction SilentlyContinue)
        $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($entry.id)" -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.ProcessId })
        $pids = @($entry.id) + $children
        if (-not ($listeners | Where-Object { $pids -contains $_.OwningProcess })) { $ready = $false }
      }
    }
    if ($ready) { break }
    Start-Sleep -Milliseconds $config.StartupPollMilliseconds
  } while ([DateTime]::UtcNow -lt $startupDeadline)
  if (-not $ready) { throw 'CRM startup times out. Inspect .logs.' }
  if (-not $Demo -and -not $runtimeState.liveSyncEnabled) { Write-Output 'Pancake live sync is disabled by configuration. No worker is started.' }
  Write-Output "CRM is ready on http://localhost:$($config.AppPort). API uses port $($config.ApiPort)."
} catch {
  Add-Content -LiteralPath (Join-Path $logFolder 'startup-error.log') -Value ("{0} {1}" -f [DateTime]::UtcNow.ToString('o'), ($_.Exception.Message + " " + $_.ScriptStackTrace))
  Write-Output $_.Exception.Message
  Write-Output $_.InvocationInfo.PositionMessage
  exit 1
} finally {
  if ($lockHeld) { $runtimeLock.ReleaseMutex() }
  $runtimeLock.Dispose()
}
