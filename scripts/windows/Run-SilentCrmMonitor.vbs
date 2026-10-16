Set objShell = CreateObject("WScript.Shell")
strScriptPath = Replace(WScript.ScriptFullName, WScript.ScriptName, "") & "Start-Crm.ps1"
strCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strScriptPath & """ -Production -EnsureRunning"
objShell.Run strCommand, 0, False
