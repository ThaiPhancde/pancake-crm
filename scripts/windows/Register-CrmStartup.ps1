$ErrorActionPreference = 'Stop'
$crmRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'Runtime-Config.psd1')
$taskName = 'CompAI-CRM-Pancake'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not ($existing.Actions.Arguments -like "*$crmRoot*")) { throw 'Task name belongs to another application. Registration is refused.' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$wscriptBinary = (Get-Command wscript.exe -ErrorAction Stop).Source
$vbsRunner = Join-Path $PSScriptRoot 'Run-SilentCrmMonitor.vbs'
$action = New-ScheduledTaskAction -Execute $wscriptBinary -Argument ('"{0}"' -f $vbsRunner) -WorkingDirectory $crmRoot
$logon = New-ScheduledTaskTrigger -AtLogOn -User $identity
$periodic = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes($config.MonitorIntervalMinutes) -RepetitionInterval (New-TimeSpan -Minutes $config.MonitorIntervalMinutes)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount $config.TaskRetryCount -RestartInterval (New-TimeSpan -Minutes $config.TaskRetryMinutes) -ExecutionTimeLimit (New-TimeSpan -Minutes $config.TaskTimeoutMinutes)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($logon, $periodic) -Principal $principal -Settings $settings -Description 'Pancake CRM production on 3100/3101. Checks every minute and recovers missing processes. Stop-Crm pauses recovery.' -Force | Out-Null
Write-Output 'Registered CRM startup and process recovery for the current user. Existing processes remain running.'
