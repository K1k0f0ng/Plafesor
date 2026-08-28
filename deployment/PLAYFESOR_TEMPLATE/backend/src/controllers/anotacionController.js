const db = require('../database');
const { ordenApellido } = require('../utils/ordenNombre');

const TIPOS_VALIDOS = ['positiva', 'mejora', 'neutral'];

// GET /api/anotaciones/grupo/:grupo_id/estudiantes — roster para elegir a quién anotar
async function estudiantesDelGrupo(req, res) {
  const { grupo_id } = req.params;
  const docenteId = req.usuario.id;

  try {
    const [[asignado]] = await db.query(
      'SELECT 1 FROM docente_grupos_materias WHERE docente_id = ? AND grupo_id = ? LIMIT 1',
      [docenteId, grupo_id]
    );
    if (!asignado) return res.status(403).json({ error: 'No tienes ese grupo asignado' });

    const [estudiantes] = await db.query(
      `SELECT u.id, u.nombre,
              (SELECT COUNT(*) FROM anotaciones an WHERE an.estudiante_id = u.id) AS total_anotaciones
       FROM estudiante_grupos eg
       JOIN usuarios u ON u.id = eg.estudiante_id
       WHERE eg.grupo_id = ? AND u.activo = TRUE
       ORDER BY ${ordenApellido('u.nombre')} ASC`,
      [grupo_id]
    );
    res.json({ data: estudiantes });
  } catch (err) {
    console.error('Error al listar estudiantes del grupo:', err);
    res.status(500).json({ error: 'Error al obtener los estudiantes' });
  }
}

// POST /api/anotaciones — crea una anotación (solo el docente del grupo)
async function crear(req, res) {
  const { estudiante_id, grupo_id, tipo, texto } = req.body;
  const docenteId = req.usuario.id;

  if (!estudiante_id || !grupo_id || !texto || !texto.trim()) {
    return res.status(400).json({ error: 'Estudiante, grupo y texto son obligatorios' });
  }
  const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'neutral';

  try {
    const [[asignado]] = await db.query(
      'SELECT 1 FROM docente_grupos_materias WHERE docente_id = ? AND grupo_id = ? LIMIT 1',
      [docenteId, grupo_id]
    );
    if (!asignado) return res.status(403).json({ error: 'No tienes ese grupo asignado' });

    const [[pertenece]] = await db.query(
      'SELECT 1 FROM estudiante_grupos WHERE estudiante_id = ? AND grupo_id = ? LIMIT 1',
      [estudiante_id, grupo_id]
    );
    if (!pertenece) return res.status(400).json({ error: 'Ese estudiante no pertenece a ese grupo' });

    const [result] = await db.query(
      'INSERT INTO anotaciones (estudiante_id, docente_id, grupo_id, tipo, texto) VALUES (?, ?, ?, ?, ?)',
      [estudiante_id, docenteId, grupo_id, tipoFinal, texto.trim()]
    );
    res.status(201).json({ mensaje: 'Anotación creada', data: { id: result.insertId } });
  } catch (err) {
    console.error('Error al crear anotación:', err);
    res.status(500).json({ error: 'Error al crear la anotación' });
  }
}

// GET /api/anotaciones/estudiante/:id — historial de anotaciones de un estudiante
async function listarPorEstudiante(req, res) {
  const estudianteId = parseInt(req.params.id);
  const u = req.usuario;

  try {
    if (u.rol === 'estudiante' && u.id !== estudianteId) {
      return res.status(403).json({ error: 'Solo puedes ver tus propias anotaciones' });
    }
    if (u.rol === 'padre') {
      const [[vinculo]] = await db.query(
        'SELECT 1 FROM padre_estudiante WHERE padre_id = ? AND estudiante_id = ? LIMIT 1',
        [u.id, estudianteId]
      );
      if (!vinculo) return res.status(403).json({ error: 'No tienes acceso a este estudiante' });
    }
    if (u.rol === 'admin' || u.rol === 'director') {
      const [[mismoColegio]] = await db.query(
        'SELECT 1 FROM usuarios WHERE id = ? AND colegio_id = ? LIMIT 1',
        [estudianteId, u.colegio_id]
      );
      if (!mismoColegio) return res.status(403).json({ error: 'Ese estudiante no pertenece a tu colegio' });
    }
    // docente: se deja el mismo criterio que ya usa /estudiantes/:id/historial
    // (cualquier docente autenticado puede consultar) — no se restringe más aquí.

    const [anotaciones] = await db.query(
      `SELECT a.id, a.tipo, a.texto, a.creado_en, a.docente_id,
              du.nombre AS nombre_docente,
              g.nombre AS nombre_grupo, g.grado
       FROM anotaciones a
       JOIN usuarios du ON du.id = a.docente_id
       JOIN grupos   g  ON g.id = a.grupo_id
       WHERE a.estudiante_id = ?
       ORDER BY a.creado_en DESC`,
      [estudianteId]
    );

    res.json({ data: anotaciones });
  } catch (err) {
    console.error('Error al listar anotaciones:', err);
    res.status(500).json({ error: 'Error al obtener las anotaciones' });
  }
}

// DELETE /api/anotaciones/:id — el docente autor, o admin/director del mismo colegio
async function eliminar(req, res) {
  const { id } = req.params;
  const u = req.usuario;

  try {
    const [[anotacion]] = await db.query(
      `SELECT a.docente_id, g.colegio_id
       FROM anotaciones a JOIN grupos g ON g.id = a.grupo_id
       WHERE a.id = ?`,
      [id]
    );
    if (!anotacion) return res.status(404).json({ error: 'Anotación no encontrada' });

    const esAutor = u.rol === 'docente' && u.id === anotacion.docente_id;
    const esDireccion = (u.rol === 'admin' || u.rol === 'director') && u.colegio_id === anotacion.colegio_id;
    if (!esAutor && !esDireccion) {
      return res.status(403).json({ error: 'No puedes eliminar esta anotación' });
    }

    await db.query('DELETE FROM anotaciones WHERE id = ?', [id]);
    res.json({ mensaje: 'Anotación eliminada' });
  } catch (err) {
    console.error('Error al eliminar anotación:', err);
    res.status(500).json({ error: 'Error al eliminar la anotación' });
  }
}

module.exports = { estudiantesDelGrupo, crear, listarPorEstudiante, eliminar };
