const db = require('../database');

const CAMPOS = [
  'peso_kg', 'estatura_cm', 'tipo_sangre',
  'nombre_padre', 'telefono_padre', 'nombre_madre', 'telefono_madre',
  'pediatra', 'telefono_pediatra', 'clinica_preferencia', 'eps', 'numero_afiliacion', 'seguro_accidentes',
  'esquema_completo', 'refuerzo_5_anios', 'fiebre_amarilla', 'fecha_vacunacion',
  'enfermedad_ojos', 'detalles_ojos', 'usa_lentes', 'usa_protesis',
  'alergias', 'tratamiento_alergias', 'cirugias', 'convulsiones_perdida_conocimiento',
  'enfermedad_actual', 'medicamentos_prohibidos', 'puede_recibir_acetaminofen', 'condiciones_especiales',
  'antecedente_diabetes', 'antecedente_cancer', 'antecedente_hipertension', 'antecedente_cardiovascular', 'antecedente_otro',
];

const CAMPOS_BOOLEANOS = new Set([
  'seguro_accidentes', 'esquema_completo', 'refuerzo_5_anios', 'fiebre_amarilla',
  'enfermedad_ojos', 'usa_lentes', 'usa_protesis', 'convulsiones_perdida_conocimiento', 'puede_recibir_acetaminofen',
  'antecedente_diabetes', 'antecedente_cancer', 'antecedente_hipertension', 'antecedente_cardiovascular',
]);

// Los booleanos son tri-estado (Sí / No / No especificado) — "no especificado"
// se guarda como NULL, no como false, porque son datos que pueden no
// conocerse todavía en el momento de la matrícula.
function normalizarBooleano(v) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return null;
}
function normalizarFecha(v) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? v : null;
}

async function tieneAccesoLectura(usuario, estudianteId) {
  if (usuario.rol === 'padre') {
    const [[vinculo]] = await db.query(
      'SELECT 1 FROM padre_estudiante WHERE padre_id = ? AND estudiante_id = ? LIMIT 1',
      [usuario.id, estudianteId]
    );
    return !!vinculo;
  }
  // admin, director, docente — mismo colegio del estudiante (por matrícula
  // directa o por el grupo al que pertenece)
  const [[mismoColegio]] = await db.query(`
    SELECT 1 FROM usuarios u
    LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
    LEFT JOIN grupos g ON g.id = eg.grupo_id
    WHERE u.id = ? AND (u.colegio_id = ? OR g.colegio_id = ?)
    LIMIT 1
  `, [estudianteId, usuario.colegio_id, usuario.colegio_id]);
  return !!mismoColegio;
}

// GET /api/estudiantes/:id/ficha-medica
async function obtener(req, res) {
  const estudianteId = parseInt(req.params.id);
  try {
    const acceso = await tieneAccesoLectura(req.usuario, estudianteId);
    if (!acceso) return res.status(403).json({ error: 'No tienes acceso a este estudiante' });

    const [[fila]] = await db.query('SELECT * FROM fichas_medicas WHERE estudiante_id = ?', [estudianteId]);
    res.json({ data: fila || {} });
  } catch (err) {
    console.error('Error al obtener la ficha médica:', err);
    res.status(500).json({ error: 'Error al obtener la ficha médica' });
  }
}

// PUT /api/estudiantes/:id/ficha-medica — solo admin/director (secretaría académica)
async function guardar(req, res) {
  const estudianteId = parseInt(req.params.id);
  try {
    const [[mismoColegio]] = await db.query(
      'SELECT 1 FROM usuarios WHERE id = ? AND colegio_id = ? AND rol = "estudiante" LIMIT 1',
      [estudianteId, req.usuario.colegio_id]
    );
    if (!mismoColegio) return res.status(404).json({ error: 'Estudiante no encontrado' });

    const valores = CAMPOS.map(campo => {
      const v = req.body[campo];
      if (CAMPOS_BOOLEANOS.has(campo)) return normalizarBooleano(v);
      if (campo === 'fecha_vacunacion') return normalizarFecha(v);
      return v === undefined || v === '' ? null : v;
    });

    await db.query(
      `INSERT INTO fichas_medicas (estudiante_id, ${CAMPOS.join(', ')})
       VALUES (?, ${CAMPOS.map(() => '?').join(', ')})
       ON DUPLICATE KEY UPDATE ${CAMPOS.map(c => `${c} = VALUES(${c})`).join(', ')}`,
      [estudianteId, ...valores]
    );

    res.json({ mensaje: 'Ficha médica guardada' });
  } catch (err) {
    console.error('Error al guardar la ficha médica:', err);
    res.status(500).json({ error: 'Error al guardar la ficha médica' });
  }
}

module.exports = { obtener, guardar };
