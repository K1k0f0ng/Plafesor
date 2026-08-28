-- ============================================================
-- Migración: actividades de tipo "entrega_archivo" — el estudiante
-- sube un archivo (PDF, Word, PowerPoint, Excel o imagen) como evidencia
-- de un trabajo (proyecto, laboratorio, exposición, taller, etc.) y el
-- docente lo revisa y califica manualmente.
-- Ver database/schema.sql para el detalle completo — este archivo
-- solo aplica el cambio a una base de datos que ya existe en producción.
-- ============================================================

ALTER TABLE actividades
  MODIFY COLUMN tipo ENUM(
    'opcion_multiple',
    'verdadero_falso',
    'ordenar_pasos',
    'completar_espacios',
    'relacionar_columnas',
    'ordenar_letras',
    'ordenar_palabras',
    'sopa_letras',
    'entrega_archivo',
    'manual'
  ) NOT NULL;

-- nota pasa a ser NULL mientras la entrega está pendiente de revisión
-- (antes siempre se calculaba automáticamente al momento de responder)
ALTER TABLE resultados_actividades
  MODIFY COLUMN nota DECIMAL(3,1) NULL;

ALTER TABLE resultados_actividades
  ADD COLUMN IF NOT EXISTS archivo_url VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS archivo_nombre_original VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS comentario_docente TEXT NULL;
