<#
  Respaldo diario de BioMap (base de datos PostgreSQL + imágenes /media) hacia
  una carpeta o disco externo USB, con rotación automática de 14 días.

  Requisitos: PostgreSQL (pg_dump en PATH o contenedor Docker biomap-db) y .env
  en la raíz del proyecto.

  Uso:  powershell -ExecutionPolicy Bypass -File infra\kiosk\backup.ps1 [-BackupRoot "D:\BioMapBackups"]
#>
param(
  [string]$BackupRoot = $(if ($env:BIOMAP_BACKUP_DIR) { $env:BIOMAP_BACKUP_DIR } else { 'D:\BioMapBackups' }),
  [int]$RetentionDays = 14
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envFile = Join-Path $root '.env'
$log = Join-Path $root 'backup.log'

function Write-Log($message) {
  "$(Get-Date -Format s)  $message" | Tee-Object -FilePath $log -Append
}

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $name = $matches[1]
      $val = $matches[2].Trim('"').Trim("'")
      if (-not (Get-Item "Env:$name" -ErrorAction SilentlyContinue)) {
        Set-Item "Env:$name" $val
      }
    }
  }
}

if (-not (Test-Path (Split-Path $BackupRoot -Qualifier))) {
  $BackupRoot = Join-Path $root 'backups'
  Write-Log "Unidad externa no detectada; respaldando localmente en $BackupRoot"
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$targetDir = Join-Path $BackupRoot $stamp
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$dbDump = Join-Path $targetDir 'biomap_db.sql'
$mediaDir = if ($env:MEDIA_DIR) { $env:MEDIA_DIR } else { Join-Path $root 'apps\api\media' }
$mediaZip = Join-Path $targetDir 'media.zip'

try {
  Write-Log "Iniciando respaldo en $targetDir"

  if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    if (-not $env:DATABASE_URL) { throw 'Falta DATABASE_URL en .env' }
    & pg_dump --dbname="$env:DATABASE_URL" --no-owner --no-privileges --file="$dbDump"
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falló con código $LASTEXITCODE" }
  } else {
    docker compose -f (Join-Path $root 'docker-compose.yml') exec -T db `
      pg_dump -U biomap -d biomap --no-owner --no-privileges > $dbDump
    if ($LASTEXITCODE -ne 0) { throw "pg_dump (Docker) falló con código $LASTEXITCODE" }
  }

  if ((Get-Item $dbDump).Length -eq 0) {
    throw 'El volcado SQL resultó vacío'
  }

  if (Test-Path $mediaDir) {
    Compress-Archive -Path (Join-Path $mediaDir '*') -DestinationPath $mediaZip -Force
  }

  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -Path $BackupRoot -Directory |
    Where-Object { $_.CreationTime -lt $cutoff } |
    ForEach-Object {
      Write-Log "Rotación ($RetentionDays d): eliminando $($_.FullName)"
      Remove-Item $_.FullName -Recurse -Force
    }

  Write-Log "Respaldo completado OK ($((Get-Item $dbDump).Length) bytes SQL)"
} catch {
  Write-Log "ERROR en respaldo: $($_.Exception.Message)"
  exit 1
}

