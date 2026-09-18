const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../database');
const { generarBorradorPiar, CAMPOS_PIAR } = require('../services/piarService');
const { ordenApellido } = require('../utils/ordenNombre');
const { registrarAuditoria } = require('../utils/auditoria');

const CAMPOS_CLAVES = CAMPOS_PIAR.map(c => c.clave);

// Carpeta PRIVADA (fuera de /uploads) — los documentos de soporte del PIAR
// son datos sensibles de salud, solo se sirven por el endpoint protegido
// de descarga más abajo.
const uploadsDirPiar = path.join(__dirname, '../../uploads_privados/piar');
if (!fs.existsSync(uploadsDirPiar)) fs.mkdirSync(uploadsDirPiar, { recursive: true });

const MAX_DOCUMENTOS_PARA_IA = 5;
const EXTENSION_A_MIME = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const uploadDocumentos = multer({
  storage: multer.diskStorage({
    destination: uploadsDirPiar,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const azar = crypto.randomBytes(6).toString('hex');
      cb(null, `piar_${req.params.estudiante_id}_${Date.now()}_${azar}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (/\.(pdf|jpe?g|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato no permitido. Usa PDF o imágenes (jpg, png, webp)'));
  },
}).array('documentos', 5);

// GET /api/piar/colegio/:colegio_id — estudiantes marcados con requiere_piar + estado de su PIAR
async function listarPorColegio(req, res) {
  const { colegio_id } = req.params;

  if (req.usuario.colegio_id !== parseInt(colegio_id)) {
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
      LEFT JOIN grados_academicos ga ON ga.codigo = g.grado AND ga.colegio_id = g.colegio_id
      LEFT JOIN piar pi ON pi.estudiante_id = u.id AND pi.anio_escolar = ?
      WHERE u.rol = 'estudiante' AND u.requiere_piar = TRUE
        AND (u.colegio_id = ? OR g.colegio_id = ?)
      ORDER BY ga.orden ASC, ${ordenApellido('u.nombre')} ASC
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
    const [[estudiante]] = await db.query(
      "SELECT colegio_id FROM usuarios WHERE id = ? AND rol = 'estudiante'",
      [estudiante_id]
    );
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (estudiante.colegio_id !== req.usuario.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este estudiante' });
    }

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

    if (req.usuario.colegio_id !== grupo.colegio_id) {
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

    // Documentos de soporte ya subidos para este estudiante — se leen del
    // disco y se pasan a la IA como evidencia real (ver piarService).
    // Se limita la cantidad para no disparar el tamaño/costo de la petición.
    const [documentosFilas] = await db.query(
      'SELECT archivo_url, nombre_original FROM piar_documentos WHERE estudiante_id = ? ORDER BY creado_en DESC LIMIT ?',
      [estudiante_id, MAX_DOCUMENTOS_PARA_IA]
    );
    const documentosAdjuntos = documentosFilas
      .map(d => {
        const ruta = path.join(uploadsDirPiar, d.archivo_url);
        const mimeType = EXTENSION_A_MIME[path.extname(d.archivo_url).toLowerCase()];
        if (!mimeType || !fs.existsSync(ruta)) return null;
        return { buffer: fs.readFileSync(ruta), mimeType, nombreOriginal: d.nombre_original };
      })
      .filter(Boolean);

    const documentoGenerado = await generarBorradorPiar({
      ...datosFormulario,
      docente_apoyo_nombre,
      docente_apoyo_observaciones,
      estudianteNombre: estudiante.nombre,
      grado: grupo.grado,
      grupoNombre: grupo.nombre,
      colegioNombre: colegio?.nombre || '',
      anioEscolar,
    }, documentosAdjuntos);

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

    if (req.usuario.colegio_id !== piar.colegio_id) {
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

    if (req.usuario.colegio_id !== piar.colegio_id) {
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

    if (req.usuario.colegio_id !== piar.colegio_id) {
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

// GET /api/piar/estudiante/:estudiante_id/documentos
async function listarDocumentos(req, res) {
  const { estudiante_id } = req.params;
  try {
    const [[estudiante]] = await db.query(
      "SELECT colegio_id FROM usuarios WHERE id = ? AND rol = 'estudiante'",
      [estudiante_id]
    );
    if (!estudiante || estudiante.colegio_id !== req.usuario.colegio_id) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const [filas] = await db.query(
      'SELECT id, nombre_original, descripcion, subido_por_nombre, creado_en FROM piar_documentos WHERE estudiante_id = ? ORDER BY creado_en DESC',
      [estudiante_id]
    );
    res.json({ data: filas });
  } catch (err) {
    console.error('Error listarDocumentos (PIAR):', err);
    res.status(500).json({ error: 'Error al obtener los documentos' });
  }
}

// POST /api/piar/estudiante/:estudiante_id/documentos
async function subirDocumentos(req, res) {
  uploadDocumentos(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const { estudiante_id } = req.params;
    const descripcion = (req.body.descripcion || '').trim().slice(0, 255) || null;

    try {
      const [[estudiante]] = await db.query(
        "SELECT colegio_id, requiere_piar FROM usuarios WHERE id = ? AND rol = 'estudiante'",
        [estudiante_id]
      );
      if (!estudiante || estudiante.colegio_id !== req.usuario.colegio_id) {
        return res.status(404).json({ error: 'Estudiante no encontrado' });
      }
      if (!estudiante.requiere_piar) {
        return res.status(400).json({ error: 'Este estudiante no está marcado como que requiere PIAR' });
      }

      for (const file of req.files) {
        await db.query(
          `INSERT INTO piar_documentos (estudiante_id, colegio_id, archivo_url, nombre_original, descripcion, subido_por, subido_por_nombre)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [estudiante_id, estudiante.colegio_id, file.filename, file.originalname, descripcion, req.usuario.id, req.usuario.nombre]
        );
      }

      registrarAuditoria({
        colegio_id: estudiante.colegio_id, usuario_id: req.usuario.id,
        usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
        accion: 'piar_documento_subido', entidad: 'estudiante', entidad_id: parseInt(estudiante_id),
        detalle: { cantidad: req.files.length },
      });

      res.status(201).json({ mensaje: `${req.files.length} documento(s) subido(s) correctamente` });
    } catch (dbErr) {
      console.error('Error subirDocumentos (PIAR):', dbErr);
      res.status(500).json({ error: 'Error al guardar los documentos' });
    }
  });
}

// DELETE /api/piar/documentos/:id
async function eliminarDocumento(req, res) {
  const { id } = req.params;
  try {
    const [[doc]] = await db.query('SELECT * FROM piar_documentos WHERE id = ?', [id]);
    if (!doc || doc.colegio_id !== req.usuario.colegio_id) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const ruta = path.join(uploadsDirPiar, doc.archivo_url);
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
    await db.query('DELETE FROM piar_documentos WHERE id = ?', [id]);

    registrarAuditoria({
      colegio_id: doc.colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'piar_documento_eliminado', entidad: 'estudiante', entidad_id: doc.estudiante_id,
      detalle: { nombre_original: doc.nombre_original },
    });

    res.json({ mensaje: 'Documento eliminado' });
  } catch (err) {
    console.error('Error eliminarDocumento (PIAR):', err);
    res.status(500).json({ error: 'Error al eliminar el documento' });
  }
}

// GET /api/piar/documentos/:id/descargar
async function descargarDocumento(req, res) {
  const { id } = req.params;
  try {
    const [[doc]] = await db.query('SELECT * FROM piar_documentos WHERE id = ?', [id]);
    if (!doc || doc.colegio_id !== req.usuario.colegio_id) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const ruta = path.join(uploadsDirPiar, doc.archivo_url);
    if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.download(ruta, doc.nombre_original);
  } catch (err) {
    console.error('Error descargarDocumento (PIAR):', err);
    res.status(500).json({ error: 'Error al descargar el documento' });
  }
}

module.exports = {
  listarPorColegio, obtenerPorEstudiante, generarBorrador,
  guardarEdicion, actualizarEstado, descargarPDF,
  listarDocumentos, subirDocumentos, eliminarDocumento, descargarDocumento,
};
