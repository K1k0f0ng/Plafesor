# Base de datos

Playfesor usa MySQL 8 (o MariaDB 10+) con InnoDB y `utf8mb4`. El script de instalación limpia para
un colegio nuevo es `deployment/PLAYFESOR_TEMPLATE/database/schema.sql`.

## Tablas

| Tabla | Para qué sirve | Depende de |
|---|---|---|
| `colegios` | La institución. En esta plantilla siempre hay un único registro, `id = 1`. | — |
| `usuarios` | Admin, docentes, estudiantes, directores y padres. Incluye `telefono_padres` (WhatsApp), `reset_token`/`reset_expiry` (recuperación de contraseña). | `colegios` |
| `materias` | Catálogo de asignaturas del MEN colombiano. Igual en todos los colegios — se precarga siempre, no es un dato de prueba. | — |
| `grupos` | Grados/cursos del colegio, por año lectivo. | `colegios` |
| `docente_grupos_materias` | Qué docente dicta qué materia en qué grupo. | `usuarios`, `grupos`, `materias` |
| `estudiante_grupos` | A qué grupo pertenece cada estudiante. | `usuarios`, `grupos` |
| `actividades` | Actividades creadas por un docente (9 tipos: opción múltiple, verdadero/falso, ordenar, etc.). | `usuarios`, `materias`, `grupos` |
| `resultados_actividades` | Cada intento de un estudiante en una actividad, con su nota. | `usuarios`, `actividades` |
| `periodos_academicos` | Períodos del año lectivo con fechas reales. | `colegios` |
| `asistencias` | Registro diario de asistencia. | `usuarios`, `grupos` |
| `predicciones_riesgo` | Score de riesgo académico (recalculado cada noche a las 2 a.m.). | `usuarios`, `materias`, `grupos`, `colegios` |
| `padre_estudiante` | Relación entre cuentas de padres y sus hijos. | `usuarios` |
| `estudiante_logros` | Gamificación (logros/rachas). | `usuarios` |
| `planes_mejoramiento` | PMI generados por IA para estudiantes en riesgo alto/crítico. | `usuarios`, `materias`, `grupos`, `colegios` |
| `horarios` | Franjas horarias de clase. | `usuarios`, `grupos`, `materias` |
| `notificaciones` | Alertas in-app. | `usuarios` |

Todas las relaciones usan **FOREIGN KEY reales** (no solo columnas `*_id` por convención), en su
mayoría con `ON DELETE CASCADE`. Esto es una fortaleza del diseño: la base de datos garantiza la
integridad relacional a nivel de motor.

## Por qué `colegio_id` sigue existiendo

El esquema conserva la columna `colegio_id` (en `usuarios`, `grupos`, `periodos_academicos`,
`predicciones_riesgo`, `planes_mejoramiento`, y heredada por JOIN en el resto) aunque cada
instalación sirva a un solo colegio. Es un remanente del diseño multi-tenant original. En esta
plantilla siempre vale `1`. No se removió porque hacerlo exigiría tocar 18 controllers del backend
para un valor que nunca cambia — ver `AUDITORIA_TECNICA_2026-07-14.md` y el README de
`deployment/PLAYFESOR_TEMPLATE/` para el detalle de esta decisión.

## Escala de calificación (MEN Colombia)

Las notas (`resultados_actividades.nota`, `DECIMAL(3,1)`) usan la escala oficial:

| Rango | Nivel |
|---|---|
| 1.0 – 2.9 | Desempeño Bajo |
| 3.0 – 3.9 | Desempeño Básico |
| 4.0 – 4.5 | Desempeño Alto |
| 4.6 – 5.0 | Desempeño Superior |

## Cambios de esquema futuros: usar migraciones, no ALTER manuales

Antes de julio de 2026, los cambios de esquema en producción se aplicaban manualmente vía
phpMyAdmin y no quedaban registrados en ningún archivo — así fue como `usuarios.telefono_padres`
llegó a faltar en `schema.sql` durante meses (ver auditoría técnica, sección 4.2). A partir de
ahora:

1. Todo cambio de esquema se escribe primero como un archivo numerado en `database/migrations/`
   (ej. `003_agregar_columna_x.sql`).
2. Se prueba en una base de datos local antes de aplicarse a cualquier instalación real.
3. Se aplica a cada colegio afectado siguiendo `checklists/CHECKLIST_ACTUALIZACION.md`.
4. Se actualiza también `database/schema.sql` (y el de la plantilla) para que una instalación nueva
   ya nazca con el cambio incluido.

## Verificar el esquema real de una instalación

Si en algún momento hay duda de si `schema.sql` refleja lo que realmente existe en un servidor,
la fuente de verdad es siempre la base de datos real, nunca este archivo. Para compararlos, en
phpMyAdmin: Base de datos → Exportar → formato SQL → solo estructura, y diff contra `schema.sql`.
