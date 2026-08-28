# PLAYFESOR_TEMPLATE

**Esta carpeta representa una instalación completamente limpia de Playfesor, lista para un colegio nuevo.**

## Reglas de uso

1. **Nunca se trabaja directamente aquí.** Esta carpeta es la base inmutable para crear cualquier
   colegio nuevo. Si necesitas desarrollar una funcionalidad nueva, hazlo en `backend/`/`frontend/`
   de la raíz del proyecto (el core) y luego trae esos cambios aquí como parte de una nueva versión
   en `releases/`.
2. **Para crear un colegio nuevo:** copia esta carpeta completa a `deployment/CLIENTES/<Nombre_Colegio>/`
   y sigue `docs/INSTALACION.md`.
3. Esta plantilla **no contiene**: usuarios, estudiantes, docentes, matrículas, notas, observaciones,
   archivos subidos, logos institucionales de ningún colegio real, ni datos de prueba. Sí contiene
   (porque no son datos de prueba, son catálogos de referencia nacional): las materias estándar del
   MEN colombiano.

## Contenido

- **`backend/`** — copia del backend con la configuración ya externalizada: modelo de IA
  centralizado (`src/config/ia.js`), CORS leído de `CORS_ORIGINS`, email por SMTP genérico
  (`src/services/emailService.js`, ya no depende de Resend), correo de reset de contraseña
  personalizado con `INSTITUCION_NOMBRE`/`EMAIL_COLOR_*` en vez de "Playfesor" hardcodeado.
  Sin `.env`/`.env.production` reales — solo `.env.example` documentado.
- **`backend/scripts/crear-admin.js`** — CLI que pide nombre/email/contraseña por terminal y crea
  el usuario administrador (rol `admin`, `colegio_id=1`) con hash bcrypt real. Ejecutar desde
  `backend/`: `node scripts/crear-admin.js`. Vive dentro de `backend/` (no en `/scripts` de la raíz
  de la plantilla) porque reutiliza la conexión a BD y las dependencias ya instaladas ahí.
- **`frontend/`** — copia del frontend sin la marca "Playfesor":
  - `src/config/tema.js` expone `NOMBRE_INSTITUCION`/`COLOR_PRIMARIO`/`COLOR_SECUNDARIO` desde
    variables `REACT_APP_*`, e inyecta los colores como variables CSS (`--color-primario`,
    `--color-secundario`) al arrancar (`src/index.js`).
  - Los ~40 archivos que tenían los colores de marca hardcodeados (`#667eea`/`#764ba2`) ahora usan
    `var(--color-primario)`/`var(--color-secundario)`.
  - Sidebar, Login, ResetPassword, OlvidePassword y Boletin usan `NOMBRE_INSTITUCION` en vez del
    texto fijo "Playfesor".
  - **`pages/LandingPage.js` se eliminó de la plantilla** (no de la producción actual): era la
    página de marketing multi-colegio del producto Playfesor, no tiene sentido en la instalación de
    un solo colegio. La ruta `/` ahora redirige directo a `/login`.
  - `public/index.html` usa tokens `%REACT_APP_NOMBRE_INSTITUCION%`/`%REACT_APP_COLOR_PRIMARIO%`,
    que **Create React App sustituye automáticamente** al compilar (`npm run build`), leyendo el
    `.env.production` de cada instalación.
  - `public/manifest.json` usa tokens `__NOMBRE_INSTITUCION__`/`__COLOR_PRIMARIO__` (CRA no los
    sustituye solo — los reemplaza `scripts/aplicar-marca.js`, ver abajo).
  - `public/robots.txt` bloquea la indexación (`Disallow: /`) y se eliminó `sitemap.xml`: esto es
    una app interna con login, no un sitio público que deba aparecer en buscadores.
  - `public/logo-icon.png`, `favicon*.png`, `favicon.ico`, `logo192.png`, `logo512.png`,
    `apple-touch-icon.png` son **placeholders genéricos neutros** (cuadrados de color sólido, sin
    texto ni símbolo) — se reemplazan por el logo/favicon real del colegio con
    `scripts/aplicar-marca.js` o copiándolos a mano antes de compilar.
- **`database/schema.sql`** — script de instalación limpia: 23 tablas, catálogo de materias del MEN
  precargado, un único registro en `colegios` (id=1, placeholders), sin usuario admin embebido.
- **`scripts/aplicar-marca.js`** — antes de compilar el frontend: reemplaza los tokens de
  `manifest.json` con los valores de `frontend/.env.production`, y si se le pasa una carpeta de
  logos, copia esos archivos sobre los placeholders genéricos de `frontend/public/`. Uso:
  `node scripts/aplicar-marca.js [carpeta-con-logos]` desde la raíz de esta plantilla.
- **`assets/plantilla-generica/`** (en la raíz del proyecto, no dentro de esta carpeta) — copia de
  respaldo de los mismos placeholders neutros, por si `frontend/public/` se sobrescribe por error.

## Decisión de diseño: `colegio_id` no se removió del backend/BD

La plantilla mantiene la columna `colegio_id` y el patrón multi-tenant en backend y base de datos,
con un único valor fijo (`colegios.id = 1`). **No se tocaron los 26 controllers ni las rutas** para
eliminarlo, porque en una instalación single-tenant esa columna nunca tendrá un segundo valor —
quitarla sería un refactor grande y riesgoso sin beneficio funcional real. El frontend también sigue
enviando `colegio_id` en las URLs de API (`/colegio/${colegio_id}/...`) exactamente igual que hoy:
intentar quitarlo solo del lado del frontend sin tocar las rutas del backend rompería la aplicación
(404 en cada llamada), así que se dejó como una limpieza cosmética diferida, no como parte de esta
plantilla. Ver `AUDITORIA_TECNICA_2026-07-14.md` para más contexto sobre este patrón.

## Verificación realizada

- `node --check` sobre todos los archivos `.js` del backend de la plantilla: sin errores.
- `npm run build` del frontend de la plantilla: compila correctamente (solo quedan warnings de lint
  preexistentes del código original, no relacionados con estos cambios).
- Se confirmó que `%REACT_APP_NOMBRE_INSTITUCION%` y `%REACT_APP_COLOR_PRIMARIO%` se sustituyen
  correctamente en el `index.html` compilado, usando el valor de `frontend/.env.production`.
- **Pendiente** (no se pudo hacer en esta sesión, requiere una base de datos real): probar
  `crear-admin.js` contra una BD ya provisionada con este `schema.sql`, y hacer login end-to-end
  contra el backend real. Hacer esto la primera vez que se instale un colegio de verdad con esta
  plantilla, siguiendo `docs/INSTALACION.md`.

## Resincronización 2026-08-28 — la plantilla estaba muy desactualizada

Una auditoría del 12 de agosto de 2026 solo había detectado 2 tablas desincronizadas. Al revisar
a fondo el 28 de agosto se encontró que el desfase real era mucho mayor: la plantilla llevaba desde
su creación (12 de agosto) sin recibir casi ninguno de los cambios hechos al core desde entonces —
prácticamente cada controller, página y servicio tenía diferencias, algunas de cientos de líneas
(`boletinController.js` estaba casi completamente desactualizado: sin la fórmula de notas vigente,
sin período "Final" ponderado, y sin una corrección de seguridad — un IDOR que permitía ver boletines
de estudiantes de otro colegio — que se acababa de corregir en el core ese mismo día).

Se hizo una resincronización completa: se copió el core actual sobre la plantilla (backend y
frontend) y se reaplicaron todas las modificaciones propias de la plantilla (nombre/colores por
variable de entorno, sin `LandingPage`, etc.) archivo por archivo. Además de las 2 tablas, la
plantilla no tenía 6 funcionalidades completas construidas después del 12 de agosto — controller,
rutas y página de frontend de cada una: anotaciones del observador del estudiante, observaciones de
período con IA, citaciones a reunión por WhatsApp, mensajes masivos por WhatsApp, briefing diario
para el rector y PIAR (Plan Individual de Ajustes Razonables) — todas ya integradas y probadas.

**Para que este desfase no vuelva a acumularse:** cada vez que se termine una funcionalidad nueva en
el core, traerla a la plantilla en la misma sesión (o como tarea explícita inmediatamente después),
no dejarlo para "cuando haya tiempo" — así fue exactamente como se acumularon ~10 días de trabajo sin
sincronizar.
