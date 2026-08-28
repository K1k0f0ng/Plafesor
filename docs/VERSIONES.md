# Versionado

Playfesor usa versionado semántico (`MAYOR.MENOR.PARCHE`) a partir de julio de 2026.

- **MAYOR** (`X.0.0`): cambios de modelo de despliegue o de configuración incompatibles con
  versiones anteriores (ej. pasar de multi-tenant a single-tenant, cambiar el formato de una
  variable de entorno existente).
- **MENOR** (`1.X.0`): funcionalidades o tablas nuevas, compatibles hacia atrás (ej. un módulo
  nuevo, una columna nueva que no rompe nada existente).
- **PARCHE** (`1.0.X`): corrección de errores, sin cambios de comportamiento nuevos.

## Dónde vive cada versión

`releases/vX.X.X/` contiene, por versión:
- `CHANGELOG.md` — qué cambió y por qué.
- Lista de archivos modificados.
- Scripts SQL de migración correspondientes (o referencia a `database/migrations/`).
- Instrucciones de aplicación.
- Notas de compatibilidad y riesgos conocidos.

## Qué versión tiene cada colegio

`versiones/registro_clientes.md` — una fila por colegio, con la versión instalada y la fecha de la
última actualización. Se actualiza cada vez que se instala un colegio nuevo o se aplica una
actualización a uno existente (paso final de `checklists/CHECKLIST_ACTUALIZACION.md`).

## Historial de versiones

| Versión | Fecha | Resumen |
|---|---|---|
| v1.0.0 | 2026-07-14 | Snapshot documentado del estado real en producción antes de la rearquitectura. Deuda técnica conocida (CORS hardcodeado, JWT_SECRET débil, patrón IDOR, schema.sql desincronizado) marcada explícitamente como no corregida en esta versión. |
| v1.1.0 | 2026-07-14 | Externalización de configuración: CORS por variable de entorno, modelo de IA centralizado (`config/ia.js`), email migrado de Resend a SMTP genérico configurable, `schema.sql` corregido (`telefono_padres`, `reset_token`/`reset_expiry`, default de `ano_lectivo` unificado), contraseña de admin removida del schema. |
| v2.0.0 | 2026-07-14 | Primera versión de `deployment/PLAYFESOR_TEMPLATE/`: plantilla single-tenant completa, sin marca "Playfesor" hardcodeada, con scripts de instalación (`crear-admin.js`, `aplicar-marca.js`) y assets genéricos. Cambia el modelo de despliegue de forma conceptual (de SaaS multi-tenant compartido a instalación independiente por colegio), aunque no se tocó ningún colegio ya activo. |

Ver `releases/v1.0.0/`, `releases/v1.1.0/` y `releases/v2.0.0/` para el detalle completo de cada una.
