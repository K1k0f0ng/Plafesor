# v1.1.0 — 2026-07-14

Externalización de configuración del core (backend). No toca la marca ni el modelo multi-tenant
todavía — eso es v2.0.0.

## Cambiado

- **CORS**: `backend/index.js` — `origenesPermitidos` ahora se lee de `process.env.CORS_ORIGINS`
  (separado por comas), con el array hardcodeado anterior como respaldo si la variable no está
  definida.
- **Modelo de IA centralizado**: nuevo `backend/src/config/ia.js`, exporta `CLAUDE_MODEL` desde
  `process.env.CLAUDE_MODEL`. Reemplaza el valor hardcodeado `'claude-haiku-4-5-20251001'` que
  aparecía en 8 archivos.
- **Email**: nuevo `backend/src/services/emailService.js` (usa `nodemailer` contra
  `SMTP_HOST/PORT/USER/PASSWORD/FROM`), reemplaza la llamada directa a la API de Resend en
  `authController.js`. Se agregó `nodemailer` a `package.json`.

## Corregido

- `database/schema.sql`: se agregó la columna `usuarios.telefono_padres` (usada en producción por
  el módulo de WhatsApp desde antes, pero nunca documentada aquí).
- `database/schema.sql`: se agregaron `usuarios.reset_token` y `usuarios.reset_expiry` (mismo
  problema — usadas por `authController.js`, ausentes del schema).
- `database/schema.sql`: default de `ano_lectivo` en `grupos` corregido de `2025` a `2026`, para
  coincidir con `periodos_academicos`.
- `database/schema.sql`: se removió el `INSERT` del usuario administrador inicial con la contraseña
  en texto plano dentro de un comentario. La creación de administradores ahora se hace con
  `crear-admin.js` (introducido en v2.0.0, dentro de la plantilla).

## Archivos modificados

```
backend/index.js
backend/src/config/ia.js                          (nuevo)
backend/src/services/emailService.js               (nuevo)
backend/src/controllers/authController.js
backend/src/controllers/actividadController.js
backend/src/controllers/coPilotoController.js
backend/src/controllers/observadorController.js
backend/src/controllers/riesgoController.js
backend/src/controllers/tutorController.js
backend/src/controllers/whatsappController.js
backend/src/services/planMejoramientoService.js
backend/src/services/informesSemanalService.js
backend/package.json
backend/.env.example
database/schema.sql
```

## Scripts SQL

Ninguna migración nueva sobre una BD existente: para colegios que ya tienen datos, agregar
manualmente las columnas que faltan (ver `database/migrations/` para el patrón a seguir en
adelante):

```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono_padres VARCHAR(20);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_expiry DATETIME;
```
(La instalación de producción ya tenía `telefono_padres`/`reset_token`/`reset_expiry` aplicadas
manualmente con anterioridad — este script es solo para instalaciones que partieran del
`schema.sql` desactualizado.)

## Compatibilidad y riesgos

- **CORS**: si `CORS_ORIGINS` no está definida en el `.env` de una instalación, el comportamiento es
  idéntico al anterior (usa el respaldo hardcodeado) — cambio no disruptivo por defecto.
- **Email**: requiere configurar `SMTP_HOST/PORT/USER/PASSWORD` antes de desplegar, o el envío de
  correo de reset de contraseña fallará. Antes de subir esta versión a un servidor real, confirmar
  que las variables SMTP están completas (ver `docs/SMTP.md`).
- **JWT_SECRET**: no se tocó en esta versión — la rotación queda como acción manual, documentada en
  `docs/SEGURIDAD.md`, a ejecutar en el momento que decida el operador (invalida sesiones activas).
