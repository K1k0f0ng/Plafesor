const db = require('../database');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

// Carpeta PRIVADA (fuera de /uploads, que se sirve público) — los adjuntos de
// mensajería solo se descargan mediante el endpoint protegido de abajo.
const uploadsDirMensajes = path.join(__dirname, '../../uploads_privados/mensajes');
if (!fs.existsSync(uploadsDirMensajes)) fs.mkdirSync(uploadsDirMensajes, { recursive: true });

const EXTENSIONES_ADJUNTO = /\.(pdf|docx?|pptx?|xlsx?|jpe?g|png|webp)$/i;

const uploadAdjuntos = multer({
  storage: multer.diskStorage({
    destination: uploadsDirMensajes,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const azar = crypto.randomBytes(6).toString('hex');
      cb(null, `msj_${req.usuario.id}_${Date.now()}_${azar}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONES_ADJUNTO.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato no permitido. Usa PDF, Word, PowerPoint, Excel o imágenes (jpg, png, webp)'));
  },
}).array('adjuntos', 3);

// Contactos válidos según el rol de quien va a escribir un mensaje NUEVO
// (una respuesta dentro de un hilo ya existente no pasa por aquí).
//
// Caso "hermanos": un docente puede dictarle a varios hijos del mismo
// acudiente (mismo curso o cursos distintos si dicta en más de uno). Antes
// esto devolvía una fila por cada hijo con el mismo id de acudiente
// repetido — confuso en la lista y, peor, "Seleccionar todos" armaba un
// arreglo de destinatarios con ese id duplicado, lo que rompía el envío
// (mensajes_destinatarios tiene UNIQUE KEY mensaje_id+destinatario_id).
// Por eso se agrupa aquí: un acudiente = una sola fila, con `hijos` adentro.
async function obtenerContactos(usuario) {
  if (usuario.rol === 'docente') {
    const [filas] = await db.query(`
      SELECT DISTINCT u.id AS padre_id, u.nombre AS padre_nombre,
             est.id AS estudiante_id, est.nombre AS estudiante_nombre,
             g.id AS grupo_id, g.nombre AS grupo_nombre, g.grado AS grado
      FROM docente_grupos_materias dgm
      JOIN estudiante_grupos eg ON eg.grupo_id = dgm.grupo_id
      JOIN grupos g              ON g.id = eg.grupo_id
      JOIN padre_estudiante pe   ON pe.estudiante_id = eg.estudiante_id
      JOIN usuarios u   ON u.id = pe.padre_id AND u.activo = TRUE
      JOIN usuarios est ON est.id = eg.estudiante_id AND est.activo = TRUE
      WHERE dgm.docente_id = ?
      ORDER BY est.nombre ASC
    `, [usuario.id]);

    const porPadre = new Map();
    filas.forEach(f => {
      if (!porPadre.has(f.padre_id)) {
        porPadre.set(f.padre_id, { id: f.padre_id, nombre: f.padre_nombre, rol: 'padre', hijos: [] });
      }
      porPadre.get(f.padre_id).hijos.push({
        id: f.estudiante_id, nombre: f.estudiante_nombre,
        grupo_id: f.grupo_id, grupo_nombre: f.grupo_nombre, grado: f.grado,
      });
    });
    return [...porPadre.values()];
  }
  if (usuario.rol === 'padre') {
    const [filas] = await db.query(`
      SELECT DISTINCT u.id, u.nombre, 'docente' AS rol, m.nombre AS detalle
      FROM padre_estudiante pe
      JOIN estudiante_grupos eg ON eg.estudiante_id = pe.estudiante_id
      JOIN docente_grupos_materias dgm ON dgm.grupo_id = eg.grupo_id
      JOIN usuarios u  ON u.id = dgm.docente_id AND u.activo = TRUE
      JOIN materias m  ON m.id = dgm.materia_id
      WHERE pe.padre_id = ?
      UNION
      SELECT u.id, u.nombre, u.rol, NULL AS detalle
      FROM usuarios u
      WHERE u.colegio_id = ? AND u.rol IN ('admin','director') AND u.activo = TRUE
      ORDER BY nombre ASC
    `, [usuario.id, usuario.colegio_id]);
    return filas;
  }
  if (usuario.rol === 'admin' || usuario.rol === 'director') {
    const [filas] = await db.query(`
      SELECT id, nombre, rol, NULL AS detalle
      FROM usuarios
      WHERE colegio_id = ? AND rol IN ('padre','docente') AND activo = TRUE
      ORDER BY rol ASC, nombre ASC
    `, [usuario.colegio_id]);
    return filas;
  }
  return [];
}

// Todos los usuarios que participan de un hilo (remitente + destinatarios de
// cada mensaje del hilo) — se usa para validar a quién se le puede responder.
async function participantesDelHilo(raizId) {
  const [filas] = await db.query(`
    SELECT DISTINCT p FROM (
      SELECT remitente_id AS p FROM mensajes_internos WHERE id = ? OR hilo_id = ?
      UNION
      SELECT d.destinatario_id AS p
      FROM mensajes_destinatarios d
      JOIN mensajes_internos m ON m.id = d.mensaje_id
      WHERE m.id = ? OR m.hilo_id = ?
    ) t
  `, [raizId, raizId, raizId, raizId]);
  return new Set(filas.map(f => f.p));
}

// GET /api/mensajes/contactos
async function listarContactos(req, res) {
  try {
    const contactos = await obtenerContactos(req.usuario);
    res.json({ data: contactos });
  } catch (err) {
    console.error('Error al listar contactos de mensajería:', err);
    res.status(500).json({ error: 'Error al obtener los contactos' });
  }
}

// GET /api/mensajes?carpeta=bandeja_entrada|enviados|archivados|eliminados|borradores&buscar=&pagina=
async function listar(req, res) {
  const usuarioId = req.usuario.id;
  const carpeta = req.query.carpeta || 'bandeja_entrada';
  const buscar = (req.query.buscar || '').trim();
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = 20;
  const offset = (pagina - 1) * limite;

  try {
    let filas;
    if (carpeta === 'enviados') {
      const condBuscar = buscar ? 'AND (m.asunto LIKE ? OR m.cuerpo LIKE ?)' : '';
      const params = [usuarioId];
      if (buscar) params.push(`%${buscar}%`, `%${buscar}%`);
      [filas] = await db.query(`
        SELECT m.id, m.asunto, m.cuerpo, m.creado_en, m.hilo_id, m.responde_a_id,
               u.nombre AS remitente_nombre, u.rol AS remitente_rol,
               TRUE AS leido,
               (SELECT COUNT(*) FROM mensajes_adjuntos WHERE mensaje_id = m.id) AS total_adjuntos,
               (SELECT COUNT(*) FROM mensajes_destinatarios WHERE mensaje_id = m.id) AS total_destinatarios
        FROM mensajes_internos m
        JOIN usuarios u ON u.id = m.remitente_id
        WHERE m.remitente_id = ? AND m.estado = 'enviado' AND m.remitente_eliminado = FALSE
        ${condBuscar}
        ORDER BY m.creado_en DESC
        LIMIT ${limite} OFFSET ${offset}
      `, params);
    } else if (carpeta === 'borradores') {
      [filas] = await db.query(`
        SELECT m.id, m.asunto, m.cuerpo, m.creado_en, m.destinatarios_borrador,
               TRUE AS leido, 0 AS total_adjuntos
        FROM mensajes_internos m
        WHERE m.remitente_id = ? AND m.estado = 'borrador'
        ORDER BY m.creado_en DESC
        LIMIT ${limite} OFFSET ${offset}
      `, [usuarioId]);
    } else if (carpeta === 'eliminados') {
      [filas] = await db.query(`
        (SELECT m.id, m.asunto, m.cuerpo, m.creado_en, u.nombre AS remitente_nombre, u.rol AS remitente_rol,
                d.leido, 'recibido' AS origen,
                (SELECT COUNT(*) FROM mensajes_adjuntos WHERE mensaje_id = m.id) AS total_adjuntos
         FROM mensajes_destinatarios d
         JOIN mensajes_internos m ON m.id = d.mensaje_id
         JOIN usuarios u ON u.id = m.remitente_id
         WHERE d.destinatario_id = ? AND d.carpeta = 'eliminado')
        UNION ALL
        (SELECT m.id, m.asunto, m.cuerpo, m.creado_en, u.nombre AS remitente_nombre, u.rol AS remitente_rol,
                TRUE AS leido, 'enviado' AS origen,
                (SELECT COUNT(*) FROM mensajes_adjuntos WHERE mensaje_id = m.id) AS total_adjuntos
         FROM mensajes_internos m
         JOIN usuarios u ON u.id = m.remitente_id
         WHERE m.remitente_id = ? AND m.remitente_eliminado = TRUE AND m.estado = 'enviado')
        ORDER BY creado_en DESC
        LIMIT ${limite} OFFSET ${offset}
      `, [usuarioId, usuarioId]);
    } else {
      const carpetaDb = carpeta === 'archivados' ? 'archivado' : 'bandeja_entrada';
      const condBuscar = buscar ? 'AND (m.asunto LIKE ? OR m.cuerpo LIKE ?)' : '';
      const params = [usuarioId, carpetaDb];
      if (buscar) params.push(`%${buscar}%`, `%${buscar}%`);
      [filas] = await db.query(`
        SELECT m.id, m.asunto, m.cuerpo, m.creado_en, m.hilo_id, m.responde_a_id,
               u.nombre AS remitente_nombre, u.rol AS remitente_rol,
               d.leido, d.leido_en,
               (SELECT COUNT(*) FROM mensajes_adjuntos WHERE mensaje_id = m.id) AS total_adjuntos
        FROM mensajes_destinatarios d
        JOIN mensajes_internos m ON m.id = d.mensaje_id
        JOIN usuarios u ON u.id = m.remitente_id
        WHERE d.destinatario_id = ? AND d.carpeta = ?
        ${condBuscar}
        ORDER BY m.creado_en DESC
        LIMIT ${limite} OFFSET ${offset}
      `, params);
    }
    res.json({ data: filas, pagina });
  } catch (err) {
    console.error('Error al listar mensajes:', err);
    res.status(500).json({ error: 'Error al obtener los mensajes' });
  }
}

// GET /api/mensajes/no-leidos
async function contarNoLeidos(req, res) {
  try {
    const [[fila]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM mensajes_destinatarios
      WHERE destinatario_id = ? AND carpeta = 'bandeja_entrada' AND leido = FALSE
    `, [req.usuario.id]);
    res.json({ data: { total: fila.total } });
  } catch (err) {
    console.error('Error al contar mensajes no leídos:', err);
    res.status(500).json({ error: 'Error al contar mensajes no leídos' });
  }
}

// GET /api/mensajes/:id — detalle + hilo completo (marca como leído si aplica)
async function obtener(req, res) {
  const { id } = req.params;
  const usuarioId = req.usuario.id;
  try {
    const [[mensaje]] = await db.query('SELECT * FROM mensajes_internos WHERE id = ?', [id]);
    if (!mensaje) return res.status(404).json({ error: 'Mensaje no encontrado' });

    const [[destRow]] = await db.query(
      'SELECT id, leido FROM mensajes_destinatarios WHERE mensaje_id = ? AND destinatario_id = ?',
      [id, usuarioId]
    );
    const esRemitente = mensaje.remitente_id === usuarioId;
    if (!esRemitente && !destRow) {
      return res.status(403).json({ error: 'No tienes acceso a este mensaje' });
    }

    if (destRow && !destRow.leido) {
      await db.query('UPDATE mensajes_destinatarios SET leido = TRUE, leido_en = NOW() WHERE id = ?', [destRow.id]);
    }

    const raizId = mensaje.hilo_id || mensaje.id;
    const [hilo] = await db.query(`
      SELECT m.id, m.asunto, m.cuerpo, m.creado_en, m.remitente_id,
             u.nombre AS remitente_nombre, u.rol AS remitente_rol
      FROM mensajes_internos m
      JOIN usuarios u ON u.id = m.remitente_id
      WHERE (m.id = ? OR m.hilo_id = ?) AND m.estado = 'enviado'
      ORDER BY m.creado_en ASC
    `, [raizId, raizId]);

    const idsHilo = hilo.map(h => h.id);
    let adjuntosPorMensaje = {};
    let destinatariosPorMensaje = {};
    if (idsHilo.length) {
      const [adjuntos] = await db.query(
        `SELECT id, mensaje_id, archivo_nombre_original FROM mensajes_adjuntos WHERE mensaje_id IN (?)`,
        [idsHilo]
      );
      adjuntos.forEach(a => {
        (adjuntosPorMensaje[a.mensaje_id] = adjuntosPorMensaje[a.mensaje_id] || []).push(a);
      });
      const [destinatarios] = await db.query(
        `SELECT d.mensaje_id, u.id, u.nombre, d.leido, d.leido_en
         FROM mensajes_destinatarios d JOIN usuarios u ON u.id = d.destinatario_id WHERE d.mensaje_id IN (?)`,
        [idsHilo]
      );
      destinatarios.forEach(d => {
        (destinatariosPorMensaje[d.mensaje_id] = destinatariosPorMensaje[d.mensaje_id] || [])
          .push({ id: d.id, nombre: d.nombre, leido: !!d.leido, leido_en: d.leido_en });
      });
    }

    const hiloConDetalle = hilo.map(h => ({
      ...h,
      adjuntos: adjuntosPorMensaje[h.id] || [],
      destinatarios: destinatariosPorMensaje[h.id] || [],
    }));

    res.json({ data: hiloConDetalle });
  } catch (err) {
    console.error('Error al obtener mensaje:', err);
    res.status(500).json({ error: 'Error al obtener el mensaje' });
  }
}

// POST /api/mensajes — crea un mensaje nuevo, una respuesta, o guarda un borrador
async function crear(req, res) {
  uploadAdjuntos(req, res, async (errMulter) => {
    if (errMulter) return res.status(400).json({ error: errMulter.message });
    const archivos = req.files || [];
    const borrarArchivos = () => archivos.forEach(f => fs.unlink(f.path, () => {}));

    try {
      const { asunto, cuerpo } = req.body;
      const esBorrador = req.body.borrador === 'true' || req.body.borrador === true;
      const respondeAId = req.body.responde_a_id ? parseInt(req.body.responde_a_id) : null;
      let destinatarios = [];
      try { destinatarios = [...new Set(JSON.parse(req.body.destinatarios || '[]').map(Number).filter(Boolean))]; } catch { destinatarios = []; }

      if (!asunto?.trim() || !cuerpo?.trim()) {
        borrarArchivos();
        return res.status(400).json({ error: 'El asunto y el mensaje son obligatorios' });
      }
      if (!esBorrador && destinatarios.length === 0) {
        borrarArchivos();
        return res.status(400).json({ error: 'Selecciona al menos un destinatario' });
      }

      let hiloId = null;

      if (respondeAId) {
        const [[original]] = await db.query('SELECT id, hilo_id FROM mensajes_internos WHERE id = ?', [respondeAId]);
        if (!original) { borrarArchivos(); return res.status(404).json({ error: 'El mensaje al que respondes no existe' }); }
        const raizId = original.hilo_id || original.id;
        const participantes = await participantesDelHilo(raizId);
        if (!participantes.has(req.usuario.id)) {
          borrarArchivos();
          return res.status(403).json({ error: 'No participas de esta conversación' });
        }
        if (!esBorrador && !destinatarios.every(d => participantes.has(d))) {
          borrarArchivos();
          return res.status(403).json({ error: 'Solo puedes responder a quienes ya participan de esta conversación' });
        }
        hiloId = raizId;
      } else if (!esBorrador) {
        const permitidos = new Set((await obtenerContactos(req.usuario)).map(c => c.id));
        if (!destinatarios.every(d => permitidos.has(d))) {
          borrarArchivos();
          return res.status(403).json({ error: 'Uno o más destinatarios no están permitidos para tu rol' });
        }
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [result] = await conn.query(
          `INSERT INTO mensajes_internos
            (colegio_id, remitente_id, hilo_id, responde_a_id, asunto, cuerpo, estado, destinatarios_borrador)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.usuario.colegio_id, req.usuario.id, hiloId, respondeAId,
            asunto.trim(), cuerpo.trim(),
            esBorrador ? 'borrador' : 'enviado',
            esBorrador ? JSON.stringify(destinatarios) : null,
          ]
        );
        const mensajeId = result.insertId;

        if (!esBorrador) {
          for (const destId of destinatarios) {
            await conn.query(
              'INSERT INTO mensajes_destinatarios (mensaje_id, destinatario_id) VALUES (?, ?)',
              [mensajeId, destId]
            );
          }
        }

        for (const archivo of archivos) {
          await conn.query(
            'INSERT INTO mensajes_adjuntos (mensaje_id, archivo_url, archivo_nombre_original) VALUES (?, ?, ?)',
            [mensajeId, archivo.filename, archivo.originalname]
          );
        }

        await conn.commit();

        if (!esBorrador && destinatarios.length) {
          const valores = destinatarios.map(destId => [
            destId, 'mensaje_interno', `mensaje_${mensajeId}`,
            `Nuevo mensaje: ${asunto.trim()}`,
            cuerpo.trim().slice(0, 140),
            JSON.stringify({ mensaje_id: mensajeId }),
          ]);
          await db.query(
            'INSERT IGNORE INTO notificaciones (usuario_id, tipo, ref_key, titulo, mensaje, datos_extra) VALUES ?',
            [valores]
          );
        }

        res.status(201).json({ mensaje: esBorrador ? 'Borrador guardado' : 'Mensaje enviado', data: { id: mensajeId } });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err) {
      borrarArchivos();
      console.error('Error al crear mensaje:', err);
      res.status(500).json({ error: 'Error al enviar el mensaje' });
    }
  });
}

// POST /api/mensajes/:id/enviar — envía un borrador ya guardado
async function enviarBorrador(req, res) {
  const { id } = req.params;
  try {
    const [[borrador]] = await db.query(
      'SELECT * FROM mensajes_internos WHERE id = ? AND remitente_id = ? AND estado = "borrador"',
      [id, req.usuario.id]
    );
    if (!borrador) return res.status(404).json({ error: 'Borrador no encontrado' });

    let destinatarios = [];
    try {
      destinatarios = typeof borrador.destinatarios_borrador === 'string'
        ? JSON.parse(borrador.destinatarios_borrador)
        : (borrador.destinatarios_borrador || []);
    } catch { destinatarios = []; }
    if (destinatarios.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un destinatario antes de enviar' });
    }

    if (borrador.responde_a_id) {
      const raizId = borrador.hilo_id || borrador.responde_a_id;
      const participantes = await participantesDelHilo(raizId);
      if (!destinatarios.every(d => participantes.has(d))) {
        return res.status(403).json({ error: 'Solo puedes responder a quienes ya participan de esta conversación' });
      }
    } else {
      const permitidos = new Set((await obtenerContactos(req.usuario)).map(c => c.id));
      if (!destinatarios.every(d => permitidos.has(d))) {
        return res.status(403).json({ error: 'Uno o más destinatarios no están permitidos para tu rol' });
      }
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE mensajes_internos SET estado = "enviado", destinatarios_borrador = NULL, creado_en = NOW() WHERE id = ?',
        [id]
      );
      for (const destId of destinatarios) {
        await conn.query(
          'INSERT IGNORE INTO mensajes_destinatarios (mensaje_id, destinatario_id) VALUES (?, ?)',
          [id, destId]
        );
      }
      await conn.commit();

      const valores = destinatarios.map(destId => [
        destId, 'mensaje_interno', `mensaje_${id}`,
        `Nuevo mensaje: ${borrador.asunto}`,
        borrador.cuerpo.slice(0, 140),
        JSON.stringify({ mensaje_id: parseInt(id) }),
      ]);
      await db.query(
        'INSERT IGNORE INTO notificaciones (usuario_id, tipo, ref_key, titulo, mensaje, datos_extra) VALUES ?',
        [valores]
      );

      res.json({ mensaje: 'Mensaje enviado', data: { id: parseInt(id) } });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error al enviar borrador:', err);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
}

// PUT /api/mensajes/:id — edita un borrador (asunto, cuerpo, destinatarios)
async function actualizarBorrador(req, res) {
  const { id } = req.params;
  const { asunto, cuerpo, destinatarios } = req.body;
  try {
    const [[borrador]] = await db.query(
      'SELECT id FROM mensajes_internos WHERE id = ? AND remitente_id = ? AND estado = "borrador"',
      [id, req.usuario.id]
    );
    if (!borrador) return res.status(404).json({ error: 'Borrador no encontrado' });

    const campos = [];
    const params = [];
    if (asunto !== undefined) { campos.push('asunto = ?'); params.push(asunto.trim()); }
    if (cuerpo !== undefined) { campos.push('cuerpo = ?'); params.push(cuerpo.trim()); }
    if (destinatarios !== undefined) { campos.push('destinatarios_borrador = ?'); params.push(JSON.stringify(destinatarios)); }
    if (campos.length === 0) return res.json({ mensaje: 'Sin cambios' });

    params.push(id);
    await db.query(`UPDATE mensajes_internos SET ${campos.join(', ')} WHERE id = ?`, params);
    res.json({ mensaje: 'Borrador actualizado' });
  } catch (err) {
    console.error('Error al actualizar borrador:', err);
    res.status(500).json({ error: 'Error al actualizar el borrador' });
  }
}

// PUT /api/mensajes/:id/carpeta — archivar / eliminar / restaurar (por destinatario o por remitente)
async function moverCarpeta(req, res) {
  const { id } = req.params;
  const { carpeta } = req.body;
  const usuarioId = req.usuario.id;
  if (!['bandeja_entrada', 'archivado', 'eliminado'].includes(carpeta)) {
    return res.status(400).json({ error: 'Carpeta inválida' });
  }
  try {
    const [[destRow]] = await db.query(
      'SELECT id FROM mensajes_destinatarios WHERE mensaje_id = ? AND destinatario_id = ?',
      [id, usuarioId]
    );
    if (destRow) {
      await db.query('UPDATE mensajes_destinatarios SET carpeta = ? WHERE id = ?', [carpeta, destRow.id]);
      return res.json({ mensaje: 'Actualizado' });
    }
    const [[propio]] = await db.query(
      'SELECT id FROM mensajes_internos WHERE id = ? AND remitente_id = ?',
      [id, usuarioId]
    );
    if (!propio) return res.status(404).json({ error: 'Mensaje no encontrado' });
    await db.query('UPDATE mensajes_internos SET remitente_eliminado = ? WHERE id = ?', [carpeta === 'eliminado', id]);
    res.json({ mensaje: 'Actualizado' });
  } catch (err) {
    console.error('Error al mover mensaje de carpeta:', err);
    res.status(500).json({ error: 'Error al actualizar el mensaje' });
  }
}

// DELETE /api/mensajes/:id — borra definitivamente un borrador
async function eliminarBorrador(req, res) {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      'DELETE FROM mensajes_internos WHERE id = ? AND remitente_id = ? AND estado = "borrador"',
      [id, req.usuario.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Borrador no encontrado' });
    res.json({ mensaje: 'Borrador eliminado' });
  } catch (err) {
    console.error('Error al eliminar borrador:', err);
    res.status(500).json({ error: 'Error al eliminar el borrador' });
  }
}

// GET /api/mensajes/adjuntos/:adjuntoId/archivo — descarga protegida
async function descargarAdjunto(req, res) {
  const { adjuntoId } = req.params;
  try {
    const [[fila]] = await db.query(`
      SELECT a.archivo_url, a.archivo_nombre_original, m.remitente_id, m.id AS mensaje_id
      FROM mensajes_adjuntos a
      JOIN mensajes_internos m ON m.id = a.mensaje_id
      WHERE a.id = ?
    `, [adjuntoId]);
    if (!fila) return res.status(404).json({ error: 'Archivo no encontrado' });

    const esRemitente = req.usuario.id === fila.remitente_id;
    let autorizado = esRemitente;
    if (!autorizado) {
      const [[destRow]] = await db.query(
        'SELECT id FROM mensajes_destinatarios WHERE mensaje_id = ? AND destinatario_id = ?',
        [fila.mensaje_id, req.usuario.id]
      );
      autorizado = !!destRow;
    }
    if (!autorizado) return res.status(403).json({ error: 'No autorizado' });

    const rutaArchivo = path.join(uploadsDirMensajes, fila.archivo_url);
    if (!fs.existsSync(rutaArchivo)) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.download(rutaArchivo, fila.archivo_nombre_original || fila.archivo_url);
  } catch (err) {
    console.error('Error al descargar adjunto:', err);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
}

module.exports = {
  listarContactos,
  listar,
  contarNoLeidos,
  obtener,
  crear,
  enviarBorrador,
  actualizarBorrador,
  moverCarpeta,
  eliminarBorrador,
  descargarAdjunto,
};
