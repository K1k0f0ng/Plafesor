# Colegio_Prueba

**Esta NO es una instalación de un cliente real.** Es una copia de prueba de
`deployment/PLAYFESOR_TEMPLATE/`, creada el 12 de agosto de 2026 (el mismo día de
`AUDITORIA_TECNICA_2026-08-12.md`) para validar que el mecanismo de instalación funciona antes de
prometerle una instalación a un colegio real — el hallazgo #1 de esa auditoría.

## Estado

- Tiene su propio `backend/.env` local (no versionado en git, sin datos reales) y `node_modules`
  instalados — se puede levantar el backend/frontend de prueba desde aquí.
- No se registró en `/versiones/registro_clientes.md` porque no es un cliente — ese registro es
  solo para instalaciones reales entregadas.
- Este README antes era una copia literal de `deployment/PLAYFESOR_TEMPLATE/README.md` (documentaba
  la plantilla, no esta carpeta) — se corrigió el 11 de septiembre de 2026 durante una auditoría de
  documentación.
- **Es un snapshot del 12 de agosto**, anterior a la resincronización del 28 de agosto documentada en
  `deployment/PLAYFESOR_TEMPLATE/README.md` ("Resincronización 2026-08-28"). No refleja el estado
  actual de la plantilla ni de las 6 funcionalidades agregadas después de esa fecha.
- No hay evidencia en el repositorio de si `crear-admin.js` llegó a ejecutarse aquí contra una base
  de datos real, ni de si se completó un login end-to-end — eso seguía pendiente según la propia
  auditoría de agosto. Confirmar antes de asumir que la instalación fue probada de punta a punta.

## Qué hacer con esta carpeta

Si la prueba de instalación ya se completó con esta carpeta (con evidencia real: admin creado, login
funcionando), vale la pena anotar aquí el resultado y la fecha. Si no, lo más simple es volver a
copiar `deployment/PLAYFESOR_TEMPLATE/` actual (ya resincronizada) y repetir la prueba desde cero,
en vez de seguir con esta copia desactualizada.
