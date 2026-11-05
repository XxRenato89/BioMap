# Kiosco (Windows)

Puesta en marcha del mini PC del Centro de Visitantes.

1. Instalar Node.js 24 y PostgreSQL con PostGIS (o Docker Desktop con `docker compose up db`).
2. Copiar el proyecto, crear `.env` desde `.env.example` con `NODE_ENV=production` y la
   `DATABASE_URL` real, y ejecutar:

   ```powershell
   npm ci
   npm run db:migrate
   npm run build -w apps/web
   npm run admin:password     # crea el administrador con una contraseña temporal
   ```

   En `.env` va también `SESSION_SECRET` (32+ caracteres al azar; ver `.env.example`).

3. Probar: `powershell -ExecutionPolicy Bypass -File infra\kiosk\start-kiosk.ps1`
4. Arranque automático: `powershell -ExecutionPolicy Bypass -File infra\kiosk\install-autostart.ps1`

`start-kiosk.ps1` levanta la API, que también sirve el visor compilado
(`WEB_DIR=apps/web/dist`), y abre Chrome (o Edge) en modo kiosco: pantalla completa,
sin zoom con gestos ni navegación por historial. Si el navegador o la API se cierran,
los vuelve a abrir. Deja un registro en `kiosk.log`.

Para salir del modo kiosco: `Alt+F4` (el script lo vuelve a abrir en 3 s; detener
antes la tarea con `Stop-ScheduledTask BioMapKiosk`).

Recomendado en Windows:

- Usuario dedicado con inicio de sesión automático.
- Desactivar suspensión de pantalla y equipo (Configuración → Sistema → Energía).
- Desactivar notificaciones y actualizaciones automáticas en horario de atención.
- Gestos de borde de la pantalla táctil desactivados (directiva de grupo
  "Allow edge swipe" = deshabilitado).

## Panel de administración

En el navegador: `http://<kiosco>:3000/admin`. Hay un solo administrador.

- La primera vez, y cada `PASSWORD_MAX_AGE_DAYS` días (90 por defecto), el panel
  obliga a cambiar la contraseña: al menos 12 caracteres, con letras y números.
- Tras 5 intentos fallidos el ingreso se bloquea 15 minutos.
- Si se olvida la contraseña o queda bloqueado: `npm run admin:password` en el
  mini PC pone una temporal y desbloquea.
- Desde el panel se editan los lugares (texto, capa, ubicación con un clic en el
  mapa, parada del recorrido, secreto), sus fotos y las capas; se descargan las
  estadísticas de visitas en CSV y se ve el historial de cambios. El kiosco toma
  los cambios en menos de un minuto.
