-- ============================================================
-- Migración: ficha médica del estudiante (peso/estatura/tipo de sangre,
-- contactos de emergencia, esquema de vacunación, antecedentes personales
-- y familiares). La diligencia admin/director en matrícula; docentes y
-- padres/acudientes solo la consultan.
-- Ver database/schema.sql para el detalle completo — este archivo
-- solo aplica el cambio a una base de datos que ya existe en producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS fichas_medicas (
  estudiante_id INT PRIMARY KEY,
  peso_kg DECIMAL(5,2) NULL,
  estatura_cm DECIMAL(5,1) NULL,
  tipo_sangre VARCHAR(5) NULL,
  -- Contactos e información para emergencias
  nombre_padre VARCHAR(150) NULL,
  telefono_padre VARCHAR(20) NULL,
  nombre_madre VARCHAR(150) NULL,
  telefono_madre VARCHAR(20) NULL,
  pediatra VARCHAR(150) NULL,
  telefono_pediatra VARCHAR(20) NULL,
  clinica_preferencia VARCHAR(200) NULL,
  eps VARCHAR(150) NULL,
  numero_afiliacion VARCHAR(50) NULL,
  seguro_accidentes BOOLEAN NULL,
  -- Esquema de vacunación
  esquema_completo BOOLEAN NULL,
  refuerzo_5_anios BOOLEAN NULL,
  fiebre_amarilla BOOLEAN NULL,
  fecha_vacunacion DATE NULL,
  -- Antecedentes personales
  enfermedad_ojos BOOLEAN NULL,
  detalles_ojos VARCHAR(255) NULL,
  usa_lentes BOOLEAN NULL,
  usa_protesis BOOLEAN NULL,
  alergias TEXT NULL,
  tratamiento_alergias TEXT NULL,
  cirugias TEXT NULL,
  convulsiones_perdida_conocimiento BOOLEAN NULL,
  enfermedad_actual TEXT NULL,
  medicamentos_prohibidos TEXT NULL,
  puede_recibir_acetaminofen BOOLEAN NULL,
  condiciones_especiales TEXT NULL,
  -- Antecedentes familiares
  antecedente_diabetes BOOLEAN NULL,
  antecedente_cancer BOOLEAN NULL,
  antecedente_hipertension BOOLEAN NULL,
  antecedente_cardiovascular BOOLEAN NULL,
  antecedente_otro VARCHAR(255) NULL,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
