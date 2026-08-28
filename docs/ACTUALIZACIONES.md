# Actualizaciones

Cómo se distribuyen mejoras del core a colegios que ya están instalados, sin sobrescribir su
identidad ni su configuración.

## Qué es "core" y qué es "de la institución"

| Core (se actualiza) | De la institución (nunca se sobrescribe) |
|---|---|
| `backend/src/` (controllers, routes, services, middlewares) | `backend/.env` |
| `backend/index.js` | `backend/uploads/` (logos y archivos subidos) |
| `frontend/src/` | `frontend/.env.production` |
| `database/schema.sql` (para instalaciones nuevas) | `frontend/public/logo-icon.png` y demás archivos de marca ya personalizados |
| `database/migrations/*.sql` (para instalaciones existentes) | Los datos en la base de datos (estudiantes, notas, asistencia, etc.) |

`frontend/public/index.html` y `manifest.json` son un caso intermedio: la estructura es del core
(usa tokens), pero los valores ya inyectados (nombre, colores) son de la institución — al
actualizar, se reemplaza el archivo pero se vuelve a correr `aplicar-marca.js` inmediatamente
después para reinyectar los valores de esa institución.

## Cómo se propaga una mejora nueva

1. La funcionalidad se desarrolla y se prueba en el core (`backend/`, `frontend/`, `database/` de la
   raíz del proyecto) — nunca directamente en `deployment/PLAYFESOR_TEMPLATE/` ni en la carpeta de
   un colegio.
2. Se documenta como una versión nueva en `releases/` (ver `docs/VERSIONES.md`).
3. Se actualiza `deployment/PLAYFESOR_TEMPLATE/` con los mismos cambios, para que cualquier colegio
   *nuevo* ya nazca con la mejora incluida.
4. Para colegios *existentes*, se sigue `checklists/CHECKLIST_ACTUALIZACION.md` — se copian
   selectivamente los archivos que cambiaron (listados en el CHANGELOG de esa versión), nunca la
   carpeta completa.

## Por qué no hay actualización automática

El flujo de trabajo de este proyecto es manual (PC de desarrollo → pruebas locales → subir
archivos a mano), sin CI/CD ni Docker. Cada colegio se actualiza de forma independiente y en el
momento que se decida — no hay un mecanismo de "push" a todas las instalaciones a la vez. Esto es
intencional: da control total sobre cuándo se actualiza cada colegio, a costa de que cada
actualización requiera trabajo manual por instalación.
