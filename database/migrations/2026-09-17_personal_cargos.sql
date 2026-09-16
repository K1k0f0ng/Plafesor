-- ============================================================
-- Migración: Usuarios del Sistema (personal administrativo/directivo).
-- Usan el permiso real de 'admin' o 'director'; 'cargo' guarda el título
-- del puesto (Rector, Coordinador Académico, etc.) solo para mostrarlo y
-- para la Agenda ("dirigido a" ese cargo) — no cambia lo que puede hacer.
-- Ver database/schema.sql, backend/src/utils/cargos.js y
-- backend/src/controllers/personalController.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cargo VARCHAR(60) NULL;

CREATE TABLE IF NOT EXISTS personal_datos (
  usuario_id INT PRIMARY KEY,
  fecha_nacimiento DATE NULL,
  telefono_residencial VARCHAR(30) NULL,
  direccion_residencial VARCHAR(150) NULL,
  telefono_oficina VARCHAR(30) NULL,
  direccion_oficina VARCHAR(150) NULL,
  telefono_celular VARCHAR(30) NULL,
  telefono_otro VARCHAR(30) NULL,
  fecha_ingreso_caja_compensacion DATE NULL,
  fecha_ingreso_institucion DATE NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
