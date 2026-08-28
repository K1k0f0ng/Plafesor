# Changelog

Registro cronológico de cambios al core del producto. Ver `docs/VERSIONES.md` para la explicación
del esquema de versionado y `releases/` para el detalle completo de cada versión.

## [2.0.0] — 2026-07-14

### Agregado
- `deployment/PLAYFESOR_TEMPLATE/`: plantilla completa single-tenant lista para instalar un colegio
  nuevo — backend, frontend, `schema.sql`, scripts de instalación (`crear-admin.js`,
  `aplicar-marca.js`) y assets gráficos genéricos.
- Nueva estructura de carpetas en la raíz del proyecto: `docs/`, `config/`, `database/migrations/`,
  `storage/`, `uploads/`, `backups/`, `install/`, `deployment/`, `templates/`, `checklists/`,
  `scripts/`, `assets/`, `releases/`, `logs/`, `versiones/`.
- Documentación completa: requerimientos, instalación, configuración, hosting, personalización,
  SMTP, seguridad, backup, actualizaciones, manuales de admin y técnico.
- Checklists de datos institucionales, implementación y actualización.
- `frontend/src/config/tema.js` en la plantilla: nombre y colores institucionales configurables por
  variable de entorno, en vez de hardcodeados.

### Cambiado
- La plantilla ya no tiene ninguna referencia hardcodeada a la marca "Playfesor" en el código de
  `frontend/src/` ni en `public/index.html`/`manifest.json`.
- La ruta raíz (`/`) de la plantilla va directo a `/login` — se removió la página de marketing
  multi-colegio (`LandingPage.js`), que no aplica a una instalación de un solo colegio.
- `robots.txt` de la plantilla bloquea indexación; se eliminó `sitemap.xml` (app interna, no un
  sitio público).

### Corregido
- `Login.js` de la plantilla: el mapa de rutas por rol ahora incluye `director` y `padre` (antes
  solo funcionaba por una redirección accidental de la página de marketing que ya no existe en la
  plantilla).

## [1.1.0] — 2026-07-14

### Cambiado
- `backend/index.js`: `CORS_ORIGINS` ahora se lee de variable de entorno en vez de estar
  hardcodeado (con el valor anterior como respaldo).
- Modelo de Claude centralizado en `backend/src/config/ia.js` — antes repetido literalmente en 8
  archivos distintos.
- Email de reset de contraseña migrado de Resend (cuenta compartida) a SMTP genérico configurable
  por instalación (`backend/src/services/emailService.js`, usa `nodemailer`).

### Corregido
- `database/schema.sql`: se agregó `usuarios.telefono_padres` (usada en producción desde el módulo
  de WhatsApp, pero nunca documentada en el schema — se había aplicado como ALTER TABLE manual).
- `database/schema.sql`: se agregaron `usuarios.reset_token`/`reset_expiry` (mismo problema).
- `database/schema.sql`: se corrigió el default de `ano_lectivo` en `grupos` para que coincida con
  `periodos_academicos` (antes 2025 vs 2026).
- `database/schema.sql`: se removió el `INSERT` del usuario administrador con contraseña en texto
  plano dentro de un comentario.

## [1.0.0] — 2026-07-14

Snapshot documentado del estado real en producción, antes de iniciar la rearquitectura a
single-tenant. Ver `AUDITORIA_TECNICA_2026-07-14.md` para el detalle completo. Deuda técnica
conocida en este punto (no corregida todavía): patrón IDOR en varios controllers, `JWT_SECRET` de
baja entropía, `schema.sql` desincronizado de producción, sin suite de tests.
