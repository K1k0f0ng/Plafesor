# /database/migrations

A partir de ahora, todo cambio al esquema de base de datos que se aplique a una instalación ya
existente debe quedar registrado aquí como un archivo `.sql` numerado y versionado, por ejemplo:

```
001_agregar_telefono_padres_usuarios.sql
002_agregar_indice_asistencias.sql
```

Motivo: la auditoría técnica (`AUDITORIA_TECNICA_2026-07-14.md`, sección 4.2) encontró que
`database/schema.sql` estaba desincronizado de producción porque cambios como la columna
`usuarios.telefono_padres` se aplicaron manualmente en su momento (vía phpMyAdmin) sin quedar
registrados en ningún archivo. Esta carpeta existe para que eso no vuelva a pasar: cada `ALTER TABLE`
que se aplique a una instalación en producción debe tener aquí su script correspondiente, ya
probado en local antes de aplicarse.

`database/schema.sql` sigue siendo el script de instalación limpia para un colegio nuevo (incluye
ya todas las migraciones aplicadas hasta la fecha). Las migraciones de esta carpeta son para
actualizar instalaciones que ya existen.
