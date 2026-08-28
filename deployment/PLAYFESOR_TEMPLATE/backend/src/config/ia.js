// Modelo de Claude usado por Copiloto, Observador, Tutor IA, generación de actividades,
// planes de mejoramiento e informes semanales. Antes estaba hardcodeado en 8 archivos distintos —
// cambiar de modelo ahora solo requiere tocar CLAUDE_MODEL en el .env de cada instalación.
module.exports = {
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
};
