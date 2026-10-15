$ErrorActionPreference='Stop'
$crmRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskName='CompAI-CRM-Pancake'
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not ($existing.Actions.Arguments -like "*$crmRoot*")) { throw 'Task name belongs to another application. Registration is refused.' }
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$shellBinary=(Get-Command powershell.exe -ErrorAction Stop).Source
$startScript=Join-Path $PSScriptRoot 'Start-Crm.ps1'
$action=New-ScheduledTaskAction -Execute $shellBinary -Argument ('-NoProfile -WindowStyle Hidden -File "{0}" -Production' -f $startScript) -WorkingDirectory $crmRoot
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Comp AI CRM production on 3100/3101. Pancake live sync follows explicit shop gates.' -Force | Out-Null
Write-Output 'Registered CompAI-CRM-Pancake for the current user logon. Existing CRM processes remain running.'
