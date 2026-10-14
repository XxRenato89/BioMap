<#
  Arranca BioMap en el kiosco: la API (que también sirve el visor compilado)
  y el navegador a pantalla completa, sin barras ni menús. Vigila ambos: si la
  API o el navegador se cierran, los vuelve a abrir.

  Requisitos: Node.js 24, `npm ci` y `npm run build -w apps/web` ya hechos, y
  un .env en la raíz del proyecto (ver .env.example).

  Uso:  powershell -ExecutionPolicy Bypass -File infra\kiosk\start-kiosk.ps1
#>
param(
  [int]$Port = 3000,
  [string]$Browser = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$api = Join-Path $root 'apps\api'
$web = Join-Path $root 'apps\web\dist'
$url = "http://localhost:$Port/"
$log = Join-Path $root 'kiosk.log'

function Write-Log($message) {
  "$(Get-Date -Format s)  $message" | Tee-Object -FilePath $log -Append
}

if (-not (Test-Path (Join-Path $web 'index.html'))) {
  throw "Falta el visor compilado en $web. Ejecuta: npm run build -w apps/web"
}

<# Chrome o, si no está, Edge (viene con Windows). #>
if (-not $Browser) {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
  )
  $Browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $Browser) { throw 'No se encontró Chrome ni Edge.' }

<#
  Modo kiosco: pantalla completa sin salida, sin gestos de zoom ni de
  historial, sin traducción ni avisos, con WebGL por hardware.
#>
$profileDir = Join-Path $env:LOCALAPPDATA 'BioMapKiosk'
$browserArgs = @(
  '--kiosk', $url,
  "--user-data-dir=$profileDir",
  '--no-first-run', '--no-default-browser-check', '--noerrdialogs',
  '--disable-session-crashed-bubble', '--disable-infobars',
  '--disable-pinch', '--overscroll-history-navigation=0',
  '--disable-features=TranslateUI,Translate',
  '--autoplay-policy=no-user-gesture-required',
  '--ignore-gpu-blocklist', '--enable-gpu-rasterization'
)

function Start-Api {
  Write-Log 'Iniciando la API'
  $env:WEB_DIR = $web
  $env:PORT = "$Port"
  Start-Process -FilePath 'node' -WorkingDirectory $api -WindowStyle Hidden -PassThru `
    -ArgumentList '--env-file-if-exists=../../.env', 'src/server.js'
}

function Wait-Api {
  for ($i = 0; $i -lt 60; $i++) {
    try {
      Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$($url)api/health" | Out-Null
      return $true
    } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

$apiProcess = Start-Api
if (-not (Wait-Api)) { Write-Log 'La API no respondió en 60 s; se abre el visor igual' }

while ($true) {
  if ($apiProcess.HasExited) {
    Write-Log "La API se cerró (código $($apiProcess.ExitCode)); reiniciando"
    $apiProcess = Start-Api
    Wait-Api | Out-Null
  }
  Write-Log "Abriendo el visor en $Browser"
  $browserProcess = Start-Process -FilePath $Browser -ArgumentList $browserArgs -PassThru
  while (-not $browserProcess.HasExited) {
    Start-Sleep -Seconds 5
    if ($apiProcess.HasExited) { break }
  }
  Write-Log 'El navegador se cerró; se vuelve a abrir en 3 s'
  Start-Sleep -Seconds 3
}
