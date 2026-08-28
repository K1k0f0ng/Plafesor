# /scripts

Utilidades de línea de comandos para desarrollo (nada de automatización de despliegue tipo CI/CD —
el flujo de trabajo del proyecto es manual: se ejecutan a mano desde la PC de desarrollo).

Los scripts que operan sobre una instalación de un colegio viven dentro de
`deployment/PLAYFESOR_TEMPLATE/`, no aquí, porque viajan con cada instalación:
- `deployment/PLAYFESOR_TEMPLATE/backend/scripts/crear-admin.js` — genera el usuario administrador
  inicial (reutiliza la conexión a BD y dependencias del backend de esa instalación).
- `deployment/PLAYFESOR_TEMPLATE/scripts/aplicar-marca.js` — inyecta identidad institucional
  (nombre, colores, logo, favicon) en la plantilla antes de compilar el frontend.

Pendiente para esta carpeta (herramientas de desarrollo del core, no de una instalación puntual):
- `verificar-env.js` — valida que un `.env` tenga todas las variables requeridas antes de arrancar
  el backend, evitando fallas silenciosas como la detectada en la auditoría (`ANTHROPIC_API_KEY`/
  variables `SMTP_*` ausentes de los archivos `.env`).
