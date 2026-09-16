-- ============================================================
-- Migración: módulos desactivados por usuario individual, además de los
-- que ya se podían desactivar para todo el colegio. Permite diferenciar el
-- acceso real de cada "cargo" (Coordinador Académico, Administrador de
-- Pagos y Cartera, etc.) sin crear un rol de permisos nuevo.
-- Ver backend/src/utils/modulos.js para el catálogo completo de claves.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción — en el servidor real esto ya se aplica solo al reiniciar el
-- backend (ver agregarColumnaSiFalta en backend/src/database.js), este
-- script queda aquí únicamente para que schema.sql y el historial de
-- cambios no queden desincronizados de lo que hay en producción.
-- ============================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos_desactivados JSON NULL;
