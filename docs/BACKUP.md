# Respaldos

Qué respaldar en cada instalación, cada cuánto, y cómo restaurar.

## Qué respaldar

1. **Base de datos** — lo más importante. Contiene notas, asistencia, observaciones, todo.
2. **`backend/uploads/`** — logos institucionales y cualquier archivo subido por usuarios.
3. **`backend/.env`** — configuración de esta instalación (nunca se puede regenerar automáticamente:
   contiene claves de API, credenciales SMTP, `JWT_SECRET`).

No hace falta respaldar `node_modules/`, `frontend/build/` ni ningún archivo de código — esos se
regeneran desde el propio repositorio de desarrollo y `npm install`/`npm run build`.

## Backup de base de datos

Vía phpMyAdmin: seleccionar la base de datos → pestaña "Exportar" → método rápido → formato SQL →
Ejecutar. Guarda el archivo con fecha en el nombre, ej. `backup_2026-07-14.sql`.

Vía terminal (si hay acceso SSH):
```
mysqldump -u USUARIO -p NOMBRE_BD > backup_$(date +%Y-%m-%d).sql
```

## Backup de archivos subidos

Comprime `backend/uploads/` (FTP/SFTP, o desde el administrador de archivos de cPanel):
```
tar -czf uploads_$(date +%Y-%m-%d).tar.gz backend/uploads/
```

## Dónde guardar los respaldos

En `deployment/CLIENTES/<Nombre_Colegio>/backups/`, con fecha en el nombre de cada archivo. No
subir respaldos con datos reales de estudiantes a ningún lugar público o compartido entre colegios.

## Frecuencia recomendada

- **Antes de cualquier actualización** (ver `checklists/CHECKLIST_ACTUALIZACION.md`) — siempre,
  sin excepción.
- **Backup periódico** — semanal como mínimo para un colegio en producción activa. Si el hosting
  ofrece backups automáticos (muchos cPanel los incluyen), verificar que estén activados y que
  incluyan la base de datos, no solo archivos.

## Restaurar un backup

1. Base de datos: en phpMyAdmin, pestaña "Importar" sobre la base de datos (¡cuidado! esto puede
   sobrescribir datos más recientes que el backup — solo hacerlo si es intencional, por ejemplo tras
   un incidente).
2. Archivos: descomprimir y subir de vuelta a `backend/uploads/`.
3. Reiniciar la aplicación Node desde cPanel.
4. Probar login y un par de módulos antes de dar la restauración por completa.
