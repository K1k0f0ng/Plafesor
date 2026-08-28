# Seguridad

Prácticas de seguridad de Playfesor y qué debe revisarse en cada instalación. Basado en la
auditoría técnica del 14 de julio de 2026 (`AUDITORIA_TECNICA_2026-07-14.md`).

## Autenticación

- Contraseñas hasheadas con `bcryptjs` (costo 10–12), nunca en texto plano.
- Sesión vía JWT firmado con `JWT_SECRET`, expira según `JWT_EXPIRES_IN` (por defecto 8h).
- **`JWT_SECRET` debe ser único por instalación y de alta entropía.** Genéralo con:
  ```
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
  Nunca reutilices el `JWT_SECRET` de otro colegio, ni un valor corto/predecible.
- El middleware `verificarToken` + `permitirRoles` protege todas las rutas salvo el webhook público
  de WhatsApp (que valida su propio token dentro del controller).

## Aislamiento entre colegios (relevante solo si el hosting llegara a compartirse)

Cada instalación single-tenant sirve a un único colegio, así que el riesgo de que un colegio vea
datos de otro **desaparece por diseño** (no hay "otro colegio" en ese servidor). Aun así, la
disciplina de siempre resolver la pertenencia de un recurso antes de devolverlo es una buena
práctica general de la aplicación, independiente del modelo de despliegue.

## Rate limiting

El login (`/api/auth/login`) y los endpoints que consumen IA (Copiloto, Observador, Tutor,
generación de actividades) tienen límite de intentos en memoria (`backend/index.js`). Al vivir en
memoria del proceso, se reinicia con cada `restart` del servidor — aceptable para el volumen de una
instalación de un solo colegio.

## Manejo de errores

El servidor nunca expone stack traces al cliente — los errores se registran en los logs del
servidor y se responde un mensaje genérico. Revisa los logs de la aplicación Node en cPanel si algo
falla silenciosamente.

## Secretos

- Ningún secreto (contraseña de BD, `JWT_SECRET`, claves de API) debe estar hardcodeado en código
  fuente `.js` — todos se leen de `.env`, que nunca se sube a ningún repositorio compartido entre
  colegios.
- El `schema.sql` de la plantilla **no** incluye ningún usuario ni contraseña embebida — el
  administrador se crea con `scripts/crear-admin.js`, que pide la contraseña por terminal.

## SQL injection

Todas las consultas usan parámetros preparados (`?` de `mysql2`) — no se concatena input del
usuario directamente en SQL en ningún controller. Mantener esta práctica en cualquier código nuevo.

## Checklist rápido de seguridad para una instalación nueva

- [ ] `JWT_SECRET` generado específicamente para este colegio, no copiado de otra instalación.
- [ ] `DB_PASSWORD` fuerte, generado por el hosting o un gestor de contraseñas.
- [ ] `.env` nunca compartido por correo/chat sin cifrar — usar un gestor de contraseñas o el mismo
      panel de cPanel para transferirlo.
- [ ] SSL activo en frontend y backend antes de la entrega.
- [ ] Contraseña del usuario administrador cambiada del valor inicial si se compartió por un canal
      no seguro durante la instalación.
