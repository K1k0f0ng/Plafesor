const db = require('../database');
const { generarBorradorPiar, CAMPOS_PIAR } = require('../services/piarService');

const CAMPOS_CLAVES = CAMPOS_PIAR.map(c => c.clave);

// GET /api/piar/colegio/:colegio_id — estudiantes marcados con requiere_piar + estado de su PIAR
async function listarPorColegio(req, res) {
  const { colegio_id } = req.params;

  if (req.usuario.rol !== 'admin' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  try {
    const anioEscolar = new Date().getFullYear();
    const [filas] = await db.query(`
      SELECT
        u.id AS estudiante_id, u.nombre AS estudiante,
        eg.grupo_id, g.nombre AS grupo, g.grado,
        pi.id AS piar_id, pi.estado, pi.acta_firmada, pi.actualizado_en
      FROM usuarios u
      LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
      LEFT JOIN grupos g ON g.id = eg.grupo_id
      LEFT JOIN piar pi ON pi.estudiante_id = u.id AND pi.anio_escolar = ?
      WHERE u.rol = 'estudiante' AND u.requiere_piar = TRUE
        AND (u.colegio_id = ? OR g.colegio_id = ?)
      ORDER BY g.grado ASC, u.nombre ASC
    `, [anioEscolar, colegio_id, colegio_id]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error listarPorColegio (PIAR):', err);
    res.status(500).json({ error: 'Error al obtener los estudiantes con PIAR' });
  }
}

// GET /api/piar/estudiante/:estudiante_id — PIAR del año escolar actual, si existe
async function obtenerPorEstudiante(req, res) {
  const { estudiante_id } = req.params;
  try {
    const anioEscolar = new Date().getFullYear();
    const [[piar]] = await db.query(
      'SELECT * FROM piar WHERE estudiante_id = ? AND anio_escolar = ?',
      [estudiante_id, anioEscolar]
    );
    res.json({ data: piar || null });
  } catch (err) {
    console.error('Error obtenerPorEstudiante (PIAR):', err);
    res.status(500).json({ error: 'Error al obtener el PIAR' });
  }
}

// POST /api/piar/generar — genera (o regenera) el borrador con IA y lo guarda
async function generarBorrador(req, res) {
  const { estudiante_id, grupo_id } = req.body;

  if (!estudiante_id || !grupo_id) {
    return res.status(400).json({ error: 'estudiante_id y grupo_id son obligatorios' });
  }

  try {
    const [[grupo]] = await db.query('SELECT colegio_id, nombre, grado FROM grupos WHERE id = ?', [grupo_id]);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    if (req.usuario.rol === 'director' && req.usuario.colegio_id !== grupo.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este colegio' });
    }

    const [[estudiante]] = await db.query(
      "SELECT nombre, requiere_piar FROM usuarios WHERE id = ? AND rol = 'estudiante'",
      [estudiante_id]
    );
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (!estudiante.requiere_piar) {
      return res.status(400).json({ error: 'Este estudiante no está marcado como que requiere PIAR' });
    }

    const [[colegio]] = await db.query('SELECT nombre FROM colegios WHERE id = ?', [grupo.colegio_id]);

    const datosFormulario = {};
    for (const clave of CAMPOS_CLAVES) datosFormulario[clave] = (req.body[clave] || '').trim();
    const docente_apoyo_nombre = (req.body.docente_apoyo_nombre || '').trim();
    const docente_apoyo_observaciones = (req.body.docente_apoyo_observaciones || '').trim();

    const anioEscolar = new Date().getFullYear();

    const documentoGenerado = await generarBorradorPiar({
      ...datosFormulario,
      docente_apoyo_nombre,
      docente_apoyo_observaciones,
      estudianteNombre: estudiante.nombre,
      grado: grupo.grado,
      grupoNombre: grupo.nombre,
      colegioNombre: colegio?.nombre || '',
      anioEscolar,
    });

    await db.query(`
      INSERT INTO piar
        (estudiante_id, grupo_id, colegio_id, anio_escolar,
         contexto_estudiante, valoracion_pedagogica, informes_salud, objetivos_metas,
         ajustes_curriculares, ajustes_didacticos, ajustes_evaluativos,
         recursos_apoyos, proyectos_especificos, actividades_casa, seguimiento,
         docente_apoyo_nombre, docente_apoyo_observaciones,
         documento_generado, estado, elaborado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)
      ON DUPLICATE KEY UPDATE
        grupo_id = VALUES(grupo_id),
        contexto_estudiante = VALUES(contexto_estudiante),
        valoracion_pedagogica = VALUES(valoracion_pedagogica),
        informes_salud = VALUES(informes_salud),
        objetivos_metas = VALUES(objetivos_metas),
        ajustes_curriculares = VALUES(ajustes_curriculares),
        ajustes_didacticos = VALUES(ajustes_didacticos),
        ajustes_evaluativos = VALUES(ajustes_evaluativos),
        recursos_apoyos = VALUES(recursos_apoyos),
        proyectos_especificos = VALUES(proyectos_especificos),
        actividades_casa = VALUES(actividades_casa),
        seguimiento = VALUES(seguimiento),
        docente_apoyo_nombre = VALUES(docente_apoyo_nombre),
        docente_apoyo_observaciones = VALUES(docente_apoyo_observaciones),
        documento_generado = VALUES(documento_generado),
        estado = 'borrador',
        acta_firmada = FALSE,
        fecha_acta = NULL,
        elaborado_por = VALUES(elaborado_por)
    `, [
      estudiante_id, grupo_id, grupo.colegio_id, anioEscolar,
      datosFormulario.contexto_estudiante, datosFormulario.valoracion_pedagogica,
      datosFormulario.informes_salud, datosFormulario.objetivos_metas,
      datosFormulario.ajustes_curriculares, datosFormulario.ajustes_didacticos,
      datosFormulario.ajustes_evaluativos, datosFormulario.recursos_apoyos,
      datosFormulario.proyectos_especificos, datosFormulario.actividades_casa,
      datosFormulario.seguimiento, docente_apoyo_nombre, docente_apoyo_observaciones,
      documentoGenerado, req.usuario.id,
    ]);

    const [[piar]] = await db.query(
      'SELECT * FROM piar WHERE estudiante_id = ? AND anio_escolar = ?',
      [estudiante_id, anioEscolar]
    );

    res.json({ mensaje: 'Borrador de PIAR generado correctamente', data: piar });
  } catch (err) {
    console.error('Error generarBorrador (PIAR):', err);
    res.status(500).json({ error: 'Error al generar el borrador del PIAR' });
  }
}

// PUT /api/piar/:id — el docente edita el borrador antes de activarlo
async function guardarEdicion(req, res) {
  const { id } = req.params;
  const { documento_generado } = req.body;

  if (documento_generado === undefined) {
    return res.status(400).json({ error: 'documento_generado es obligatorio' });
  }

  try {
    const [[piar]] = await db.query('SELECT colegio_id FROM piar WHERE id = ?', [id]);
    if (!piar) return res.status(404).json({ error: 'PIAR no encontrado' });

    if (req.usuario.rol === 'director' && req.usuario.colegio_id !== piar.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este PIAR' });
    }

    await db.query('UPDATE piar SET documento_generado = ? WHERE id = ?', [documento_generado, id]);
    res.json({ mensaje: 'PIAR actualizado' });
  } catch (err) {
    console.error('Error guardarEdicion (PIAR):', err);
    res.status(500).json({ error: 'Error al guardar los cambios' });
  }
}

// PUT /api/piar/:id/estado
async function actualizarEstado(req, res) {
  const { id } = req.params;
  const { estado, fecha_acta } = req.body;

  if (!['borrador', 'activo', 'en_revision', 'archivado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const [[piar]] = await db.query('SELECT colegio_id FROM piar WHERE id = ?', [id]);
    if (!piar) return res.status(404).json({ error: 'PIAR no encontrado' });

    if (req.usuario.rol === 'director' && req.usuario.colegio_id !== piar.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este PIAR' });
    }

    const acta_firmada = estado === 'activo';
    await db.query(
      'UPDATE piar SET estado = ?, acta_firmada = ?, fecha_acta = ? WHERE id = ?',
      [estado, acta_firmada, acta_firmada ? (fecha_acta || new Date()) : null, id]
    );
    res.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    console.error('Error actualizarEstado (PIAR):', err);
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
}

// GET /api/piar/:id/pdf
async function descargarPDF(req, res) {
  const { id } = req.params;
  try {
    const [[piar]] = await db.query(`
      SELECT pi.*, u.nombre AS estudiante, g.nombre AS grupo, g.grado, c.nombre AS colegio
      FROM piar pi
      JOIN usuarios u ON u.id = pi.estudiante_id
      JOIN grupos g   ON g.id = pi.grupo_id
      JOIN colegios c ON c.id = pi.colegio_id
      WHERE pi.id = ?
    `, [id]);

    if (!piar) return res.status(404).json({ error: 'PIAR no encontrado' });

    if (req.usuario.rol === 'director' && req.usuario.colegio_id !== piar.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este PIAR' });
    }

    const { generarPiarPDF } = require('../services/piarPdfService');
    const buf = await generarPiarPDF(piar);
    const nombre = piar.estudiante.replace(/\s+/g, '_');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="PIAR_${nombre}_${piar.anio_escolar}.pdf"`,
    });
    res.send(buf);
  } catch (err) {
    console.error('Error descargarPDF (PIAR):', err);
    res.status(500).json({ error: 'Error al generar el PDF del PIAR' });
  }
}

module.exports = {
  listarPorColegio, obtenerPorEstudiante, generarBorrador,
  guardarEdicion, actualizarEstado, descargarPDF,
};
