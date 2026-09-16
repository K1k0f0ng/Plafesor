-- ============================================================
-- Migración: preferencias de notificación por usuario — sin fila = todo
-- activado (comportamiento anterior sin cambios); cada quien decide qué
-- categorías le llegan a la campanita, y los acudientes si quieren o no
-- WhatsApp.
-- Ver database/schema.sql y backend/src/utils/preferenciasNotificacion.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS preferencias_notificacion (
  usuario_id INT PRIMARY KEY,
  notif_mensajes BOOLEAN NOT NULL DEFAULT TRUE,
  notif_citaciones BOOLEAN NOT NULL DEFAULT TRUE,
  notif_riesgo_academico BOOLEAN NOT NULL DEFAULT TRUE,
  notif_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
