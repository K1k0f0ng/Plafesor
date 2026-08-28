const db = require('../database');
const { generarBriefingColegio } = require('../services/briefingService');

// GET /api/briefing/colegio/:colegio_id?forzar=1
async function obtener(req, res) {
  const { colegio_id } = req.params;
  const forzar = req.query.forzar === '1' || req.query.forzar === 'true';

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  try {
    if (!forzar) {
      const [[existente]] = await db.query(
        'SELECT * FROM briefing_diario WHERE colegio_id = ? AND fecha = CURDATE()',
        [colegio_id]
      );
      if (existente) return res.json({ data: existente });
    }

    const fila = await generarBriefingColegio(colegio_id);
    if (!fila) return res.status(404).json({ error: 'Colegio no encontrado' });

    res.json({ data: fila });
  } catch (err) {
    console.error('Error obtener (briefing):', err);
    res.status(500).json({ error: 'Error al obtener el resumen diario' });
  }
}

module.exports = { obtener };
