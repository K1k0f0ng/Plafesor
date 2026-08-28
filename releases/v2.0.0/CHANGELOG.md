# v2.0.0 — 2026-07-14

Primera versión de `deployment/PLAYFESOR_TEMPLATE/` — cambia el modelo de despliegue de forma
conceptual (de SaaS multi-tenant compartido a instalación independiente por colegio). Versión
mayor porque introduce una forma nueva de distribuir el producto, aunque **no se tocó ningún
colegio ya activo en producción** como parte de este cambio.

## Agregado

- `deployment/PLAYFESOR_TEMPLATE/` completa: copia de `backend/`+`frontend/` (post v1.1.0), sin
  `node_modules/`, sin `build/`, sin secretos reales.
- `deployment/PLAYFESOR_TEMPLATE/database/schema.sql`: script de instalación limpia — catálogo de
  materias del MEN precargado, un único registro en `colegios` (id=1) con placeholders, sin usuario
  administrador embebido.
- `deployment/PLAYFESOR_TEMPLATE/backend/scripts/crear-admin.js`: CLI para crear el usuario
  administrador inicial (nombre/email/contraseña por terminal, hash bcrypt real).
- `deployment/PLAYFESOR_TEMPLATE/scripts/aplicar-marca.js`: inyecta nombre/colores en
  `manifest.json` y copia logo/favicon/escudo del colegio sobre los genéricos.
- `frontend/src/config/tema.js` (dentro de la plantilla): `NOMBRE_INSTITUCION`, `COLOR_PRIMARIO`,
  `COLOR_SECUNDARIO` desde variables `REACT_APP_*`, con inyección de variables CSS en runtime.
- Assets gráficos genéricos neutros (`assets/plantilla-generica/`), usados como placeholder en
  `frontend/public/` de la plantilla.
- Nueva estructura de carpetas en la raíz: `docs/`, `config/`, `database/migrations/`, `storage/`,
  `uploads/`, `backups/`, `install/`, `deployment/`, `templates/`, `checklists/`, `scripts/`,
  `assets/`, `releases/`, `logs/`, `versiones/`.
- Documentación completa (17 documentos en `docs/`, 3 checklists, README raíz).

## Cambiado (solo dentro de la plantilla, no en el core ni en producción)

- Los ~37 archivos de `frontend/src` que tenían los colores de marca hardcodeados
  (`#667eea`/`#764ba2`) ahora usan `var(--color-primario)`/`var(--color-secundario)`.
- 5 archivos (`Sidebar.js`, `Boletin.js`, `Login.js`, `ResetPassword.js`, `OlvidePassword.js`) usan
  `NOMBRE_INSTITUCION` en vez del texto fijo "Playfesor".
- `backend/src/controllers/authController.js` (en la plantilla): el correo de reset de contraseña
  usa `INSTITUCION_NOMBRE`/`EMAIL_COLOR_*` en vez de "Playfesor" y los colores hardcodeados.
- `public/index.html` (plantilla): usa tokens `%REACT_APP_NOMBRE_INSTITUCION%`/
  `%REACT_APP_COLOR_PRIMARIO%`, sustituidos automáticamente por Create React App al compilar. Se
  removieron las meta tags de SEO/marketing orientadas al producto Playfesor (Open Graph, JSON-LD,
  keywords).
- `public/manifest.json` (plantilla): usa tokens `__NOMBRE_INSTITUCION__`/`__COLOR_PRIMARIO__`,
  reemplazados por `aplicar-marca.js`.
- `public/robots.txt` (plantilla): bloquea indexación (`Disallow: /`) — es una app interna con
  login, no un sitio público.
- `App.js` (plantilla): la ruta `/` redirige directo a `/login`.
- `Login.js` (plantilla): el mapa `RUTA_POR_ROL` ahora incluye `director` y `padre` (corrección de
  un bug latente que solo no se manifestaba porque la página de marketing eliminada absorbía la
  redirección con el mapa completo).
- `backend/.htaccess` (plantilla): el dominio en `Access-Control-Allow-Origin` es un placeholder a
  reemplazar por instalación, no `playfesor.co` fijo.

## Eliminado (solo de la plantilla)

- `frontend/src/pages/LandingPage.js`: era la página de marketing multi-colegio del producto
  Playfesor — no aplica a una instalación de un solo colegio con su propio dominio.
- `frontend/public/sitemap.xml` y `og-image.png`: sin uso tras remover la landing page y el SEO de
  marketing.

## Archivos de referencia (dentro de `deployment/PLAYFESOR_TEMPLATE/`)

Ver el README de esa carpeta para el detalle completo, no se repite aquí la lista completa por ser
prácticamente todo el árbol de `backend/` y `frontend/`.

## Scripts SQL

Ninguno adicional a los de v1.1.0 — el `schema.sql` de la plantilla ya nace con esas correcciones
incluidas.

## Compatibilidad y riesgos

- **Cero riesgo para instalaciones ya activas**: esta versión no modifica ningún archivo fuera de
  `deployment/PLAYFESOR_TEMPLATE/`.
- **`colegio_id` no se removió** de backend ni base de datos (decisión documentada en el README de
  la plantilla) — queda fijo en `1`. Si en el futuro se decide removerlo por completo, es un
  refactor aparte que toca 18 controllers, y debe planearse y aprobarse como tal.
- **Verificado**: `node --check` sobre todo el backend de la plantilla sin errores; `npm run build`
  del frontend de la plantilla compila correctamente (solo warnings de lint preexistentes, no
  relacionados con estos cambios); los tokens de `index.html` y `manifest.json` se sustituyen
  correctamente con los valores de `.env.production`.
- **Pendiente de verificar** (requiere una base de datos real, no se pudo hacer en esta sesión):
  `crear-admin.js` contra una BD recién provisionada, y un login end-to-end completo. Validar en la
  primera instalación real que use esta plantilla.
