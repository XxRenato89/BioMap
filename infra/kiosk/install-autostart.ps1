<#
  Registra BioMap para que arranque solo al iniciar sesión en el kiosco
  (tarea programada BioMapKiosk) y respalde la base de datos y fotos a diario
  a las 19:00 (tarea programada BioMapBackup).
  Ejecutar una vez, como el usuario del kiosco.

  Uso:     powershell -ExecutionPolicy Bypass -File infra\kiosk\install-autostart.ps1
  Quitar:  Unregister-ScheduledTask -TaskName BioMapKiosk,BioMapBackup -Confirm:$false
#>
$kioskScript = Join-Path $PSScriptRoot 'start-kiosk.ps1'
$kioskAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$kioskScript`""
$kioskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$kioskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'BioMapKiosk' -Action $kioskAction -Trigger $kioskTrigger -Settings $kioskSettings `
  -Description 'BioMap: API y visor a pantalla completa' -Force | Out-Null

$backupScript = Join-Path $PSScriptRoot 'backup.ps1'
$backupAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$backupScript`""
$backupTrigger = New-ScheduledTaskTrigger -Daily -At '19:00'
$backupSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'BioMapBackup' -Action $backupAction -Trigger $backupTrigger -Settings $backupSettings `
  -Description 'BioMap: respaldo diario de PostgreSQL y carpeta /media con rotación de 14 días' -Force | Out-Null

Write-Host 'Listo: BioMapKiosk (al iniciar sesión) y BioMapBackup (diario 19:00) registrados.'
