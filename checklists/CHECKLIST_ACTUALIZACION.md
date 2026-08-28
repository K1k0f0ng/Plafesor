# Checklist de actualización — colegio ya instalado

Procedimiento estándar para llevar un colegio existente de una versión del core a otra más nueva,
sin perder su configuración ni sus datos.

1. **Respaldar archivos** — copia `backend/` y `frontend/` actuales del servidor del colegio
   (ver `docs/BACKUP.md`).
2. **Respaldar base de datos** — `mysqldump` o exportación completa vía phpMyAdmin.
3. **Comparar versión actual** — revisa `versiones/registro_clientes.md` para saber qué versión
   tiene este colegio hoy.
4. **Revisar CHANGELOG** — lee `releases/vX.X.X/CHANGELOG.md` de cada versión entre la actual y la
   nueva (si se salta más de una versión, revisar todas las intermedias, no solo la última).
5. **Identificar qué es core y qué es de la institución** — nunca sobrescribir: `.env`,
   `frontend/public/logo-icon.png` y demás archivos de marca ya personalizados, `backend/uploads/`.
   Sí se reemplazan: el código en `backend/src/`, `frontend/src/`, `backend/index.js`,
   `frontend/public/index.html` y `manifest.json` (estos últimos dos solo si cambiaron en el core —
   revisar el CHANGELOG).
6. **Copiar archivos modificados** — según la lista de "archivos modificados" de cada
   `releases/vX.X.X/`, sube solo esos archivos al servidor del colegio (no la carpeta completa, para
   no arriesgar sobrescribir su configuración).
7. **Ejecutar scripts SQL** — aplica en orden los archivos de `database/migrations/` que correspondan
   a las versiones nuevas, contra la base de datos real de este colegio (nunca contra `schema.sql`
   directamente en una BD que ya tiene datos).
8. **Actualizar configuración** — si la nueva versión agrega variables de entorno nuevas
   (revisar `docs/CONFIGURACION.md` y el `.env.example` actualizado), añádelas al `.env` del colegio
   sin tocar las que ya tenía.
9. **Limpiar caché** — si el hosting o el navegador cachean el frontend, fuerza una recarga completa
   después de subir el nuevo `build/`.
10. **Verificar permisos** — confirma que los archivos subidos tienen los permisos correctos para
    que Apache/Passenger los sirva (relevante si se subió por FTP con permisos distintos).
11. **Probar login** — con una cuenta real del colegio, no solo con el admin.
12. **Probar módulos afectados** — específicamente los que cambiaron según el CHANGELOG; no hace
    falta reprobar todo el sistema en cada actualización menor.
13. **Verificar reportes** — boletines, métricas, exportes a Excel, si la actualización tocó algo
    relacionado.
14. **Verificar correo** — que el reset de contraseña siga funcionando (a veces se pierde si se
    sobrescribió el `.env` por error).
15. **Confirmar funcionamiento** y **documentar la actualización** en
    `versiones/registro_clientes.md` (nueva versión + fecha) y en las notas de
    `deployment/CLIENTES/<Nombre_Colegio>/`.

## Si algo sale mal

Restaura el backup de archivos y base de datos del paso 1 y 2, reinicia la aplicación Node, y
confirma que el colegio vuelve a funcionar en la versión anterior antes de investigar la causa del
problema con más calma.
