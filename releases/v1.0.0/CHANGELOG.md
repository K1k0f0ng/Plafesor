# v1.0.0 — 2026-07-14

Snapshot documentado del estado real en producción, tomado como línea base antes de iniciar la
rearquitectura a single-tenant. No incluye cambios de código — es un punto de referencia.

## Contexto

Ver `AUDITORIA_TECNICA_2026-07-14.md` (raíz del proyecto) para el informe técnico completo que
sustenta esta versión.

## Estado funcional

Módulos en producción a esta fecha: gestión académica completa (colegios, grupos, docentes,
estudiantes, materias, actividades, calificación automática), asistencia, boletines en PDF, períodos
académicos, Centro de Métricas Institucional, Motor de Riesgo Académico, Copiloto de Rectoría,
Observador Académico automático, Tutor IA para estudiantes, Portal para Padres, notificaciones por
WhatsApp (UltraMsg), informes semanales automáticos.

## Deuda técnica conocida (no corregida en esta versión)

- CORS hardcodeado en `backend/index.js` (ignora la variable `CORS_ORIGINS` ya presente en `.env`).
- Modelo de Claude repetido literalmente en 8 archivos distintos.
- Email transaccional dependiente de una única cuenta compartida de Resend.
- `JWT_SECRET` de baja entropía y predecible.
- `database/schema.sql` desincronizado de producción — falta `usuarios.telefono_padres` (aplicada
  manualmente en su momento) y `reset_token`/`reset_expiry`.
- Contraseña del usuario administrador embebida (hash + comentario en texto plano) en
  `database/schema.sql`.
- Patrón IDOR en varios controllers: endpoints que reciben un ID de recurso por parámetro no
  siempre verifican que ese recurso pertenezca al colegio del usuario autenticado.
- Sin suite de tests automatizados, sin ambiente de staging.

## Archivos de referencia

Ninguno modificado — esta versión documenta el estado tal como estaba, sin tocar nada.

## Compatibilidad y riesgos

No aplica (versión de referencia, no de cambio).
