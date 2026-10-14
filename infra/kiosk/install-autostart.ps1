<#
  Registra BioMap para que arranque solo al iniciar sesión en el kiosco
  (tarea programada de Windows). Ejecutar una vez, como el usuario del kiosco.

  Uso:     powershell -ExecutionPolicy Bypass -File infra\kiosk\install-autostart.ps1
  Quitar:  Unregister-ScheduledTask -TaskName BioMapKiosk -Confirm:$false
#>
$script = Join-Path $PSScriptRoot 'start-kiosk.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'BioMapKiosk' -Action $action -Trigger $trigger -Settings $settings `
  -Description 'BioMap: API y visor a pantalla completa' -Force | Out-Null
Write-Host 'Listo: BioMap arrancará al iniciar sesión. Para probar ahora: Start-ScheduledTask BioMapKiosk'
