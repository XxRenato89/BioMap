# Kiosco (Windows)

Puesta en marcha del mini PC del Centro de Visitantes.

1. Instalar Node.js 24 y PostgreSQL con PostGIS (o Docker Desktop con `docker compose up db`).
2. Copiar el proyecto, crear `.env` desde `.env.example` con `NODE_ENV=production` y la
   `DATABASE_URL` real, y ejecutar:

   ```powershell
   npm ci
   npm run db:migrate
   npm run build -w apps/web
   ```

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
