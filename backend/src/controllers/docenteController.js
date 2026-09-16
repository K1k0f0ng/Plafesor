const bcrypt = require('bcryptjs');
const db = require('../database');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/docentes — solo los del colegio del admin
async function listar(req, res) {
  try {
    const [filas] = await db.query(`
      SELECT u.id, u.nombre, u.email, u.activo, u.creado_en,
             c.nombre AS nombre_colegio,
             u.grupo_dirigido_id,
             g.nombre AS nombre_grupo_dirigido,
             g.grado  AS grado_grupo_dirigido
      FROM usuarios u
      LEFT JOIN colegios c ON c.id = u.colegio_id
      LEFT JOIN grupos g ON g.id = u.grupo_dirigido_id
      WHERE u.rol = 'docente' AND u.colegio_id = ?
      ORDER BY u.nombre ASC
    `, [req.usuario.colegio_id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar docentes:', err);
    res.status(500).json({ error: 'Error al obtener los docentes' });
  }
}

// POST /api/docentes — colegio_id viene del JWT
async function crear(req, res) {
  const { nombre, email, password, grupo_dirigido_id } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }
  if (!colegio_id) {
    return res.status(400).json({ error: 'Tu usuario no tiene un colegio asignado' });
  }

  let grupoDirigido = null;
  if (grupo_dirigido_id) {
    const [[grupo]] = await db.query('SELECT id FROM grupos WHERE id = ? AND colegio_id = ?', [grupo_dirigido_id, colegio_id]);
    if (!grupo) return res.status(400).json({ error: 'El grupo seleccionado no existe en tu colegio' });
    grupoDirigido = grupo.id;
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO usuarios (nombre, email, password, rol, colegio_id, grupo_dirigido_id) VALUES (?, ?, ?, "docente", ?, ?)',
      [nombre, email, hash, colegio_id, grupoDirigido]
    );
    res.status(201).json({ mensaje: 'Docente creado', data: { id: result.insertId, nombre, email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('unique_director_grupo')) {
        return res.status(409).json({ error: 'Ese grupo ya tiene un director de grupo asignado' });
      }
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error al crear docente:', err);
    res.status(500).json({ error: 'Error al crear el docente' });
  }
}

// POST /api/docentes/asignar — define una clase: docente + grupo + materia (+ horas semanales)
async function asignar(req, res) {
  const { docente_id, grupo_id, materia_id, intensidad_horaria_semanal } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!docente_id || !grupo_id || !materia_id) {
    return res.status(400).json({ error: 'docente_id, grupo_id y materia_id son obligatorios' });
  }

  try {
    const [[docente]] = await db.query(
      'SELECT id FROM usuarios WHERE id = ? AND rol = "docente" AND colegio_id = ?',
      [docente_id, colegio_id]
    );
    if (!docente) return res.status(400).json({ error: 'El docente seleccionado no existe en tu colegio' });

    const [[grupo]] = await db.query(
      'SELECT id, grado FROM grupos WHERE id = ? AND colegio_id = ?',
      [grupo_id, colegio_id]
    );
    if (!grupo) return res.status(400).json({ error: 'El grupo seleccionado no existe en tu colegio' });

    const [[materia]] = await db.query(
      'SELECT id, nombre FROM materias WHERE id = ? AND activa = TRUE AND (colegio_id = ? OR colegio_id IS NULL)',
      [materia_id, colegio_id]
    );
    if (!materia) return res.status(400).json({ error: 'La asignatura seleccionada no es válida' });

    // Si el colegio ya definió el pénsum de este grado, la asignatura debe pertenecer a él
    const [pensum] = await db.query(
      'SELECT materia_id FROM grado_materias WHERE colegio_id = ? AND grado_codigo = ?',
      [colegio_id, grupo.grado]
    );
    if (pensum.length > 0 && !pensum.some(p => p.materia_id === materia_id)) {
      return res.status(400).json({ error: 'Esta asignatura no está definida en el pénsum de este grado' });
    }

    const [result] = await db.query(
      'INSERT INTO docente_grupos_materias (docente_id, grupo_id, materia_id, intensidad_horaria_semanal) VALUES (?, ?, ?, ?)',
      [docente_id, grupo_id, materia_id, intensidad_horaria_semanal || null]
    );

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'clase_definida', entidad: 'docente_grupos_materias', entidad_id: result.insertId,
      detalle: { materia: materia.nombre, tipo: 'creada' },
    });

    res.status(201).json({ mensaje: 'Clase definida', data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esta asignación ya existe' });
    }
    console.error('Error al asignar docente:', err);
    res.status(500).json({ error: 'Error al crear la asignación' });
  }
}

// PUT /api/docentes/:id/grupo-dirigido — asigna, cambia o quita el grupo que dirige
async function actualizarGrupoDirigido(req, res) {
  const { id } = req.params;
  const { grupo_id } = req.body;
  const colegio_id = req.usuario.colegio_id;

  try {
    const [[docente]] = await db.query(
      'SELECT id FROM usuarios WHERE id = ? AND rol = "docente" AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!docente) return res.status(404).json({ error: 'Docente no encontrado' });

    let grupoDirigido = null;
    if (grupo_id) {
      const [[grupo]] = await db.query('SELECT id FROM grupos WHERE id = ? AND colegio_id = ?', [grupo_id, colegio_id]);
      if (!grupo) return res.status(400).json({ error: 'El grupo seleccionado no existe en tu colegio' });
      grupoDirigido = grupo.id;
    }

    await db.query('UPDATE usuarios SET grupo_dirigido_id = ? WHERE id = ?', [grupoDirigido, id]);
    res.json({ mensaje: grupoDirigido ? 'Director de grupo asignado' : 'Director de grupo removido' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese grupo ya tiene un director de grupo asignado' });
    }
    console.error('Error al actualizar director de grupo:', err);
    res.status(500).json({ error: 'Error al actualizar el director de grupo' });
  }
}

// GET /api/docentes/:id/asignaciones
async function obtenerAsignaciones(req, res) {
  const { id } = req.params;
  const colegio_id = req.usuario.colegio_id;

  if (req.usuario.rol === 'docente' && parseInt(id) !== req.usuario.id) {
    return res.status(403).json({ error: 'No puedes ver las asignaciones de otro docente' });
  }

  try {
    const [filas] = await db.query(`
      SELECT dgm.id, dgm.docente_id, dgm.intensidad_horaria_semanal,
             g.id AS grupo_id, g.nombre AS nombre_grupo, g.grado,
             m.id AS materia_id, m.nombre AS nombre_materia, m.codigo
      FROM docente_grupos_materias dgm
      JOIN grupos g ON g.id = dgm.grupo_id
      JOIN materias m ON m.id = dgm.materia_id
      LEFT JOIN grados_academicos ga ON ga.codigo = g.grado AND ga.colegio_id = g.colegio_id
      WHERE dgm.docente_id = ? AND g.colegio_id = ?
      ORDER BY ga.orden ASC, g.nombre ASC, m.nombre ASC
    `, [id, colegio_id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al obtener asignaciones:', err);
    res.status(500).json({ error: 'Error al obtener las asignaciones' });
  }
}

// DELETE /api/docentes/asignacion/:id
async function eliminarAsignacion(req, res) {
  const { id } = req.params;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [result] = await db.query(
      `DELETE dgm FROM docente_grupos_materias dgm
       JOIN grupos g ON g.id = dgm.grupo_id
       WHERE dgm.id = ? AND g.colegio_id = ?`,
      [id, colegio_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'clase_definida', entidad: 'docente_grupos_materias', entidad_id: parseInt(id),
      detalle: { tipo: 'eliminada' },
    });

    res.json({ mensaje: 'Asignación eliminada' });
  } catch (err) {
    console.error('Error al eliminar asignación:', err);
    res.status(500).json({ error: 'Error al eliminar la asignación' });
  }
}

// PUT /api/docentes/carga-academica/reasignar — mueve clases de un docente a otro
// body: { docente_origen_id, docente_destino_id, asignacion_ids: number[] }
async function reasignarCarga(req, res) {
  const { docente_origen_id, docente_destino_id, asignacion_ids } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!docente_origen_id || !docente_destino_id || !Array.isArray(asignacion_ids) || asignacion_ids.length === 0) {
    return res.status(400).json({ error: 'Selecciona el docente de origen, el de destino y al menos una clase' });
  }
  if (String(docente_origen_id) === String(docente_destino_id)) {
    return res.status(400).json({ error: 'El docente de destino debe ser distinto al de origen' });
  }

  try {
    const [[origen]] = await db.query(
      'SELECT id, nombre FROM usuarios WHERE id = ? AND rol = "docente" AND colegio_id = ?',
      [docente_origen_id, colegio_id]
    );
    if (!origen) return res.status(400).json({ error: 'El docente de origen no existe en tu colegio' });

    const [[destino]] = await db.query(
      'SELECT id, nombre FROM usuarios WHERE id = ? AND rol = "docente" AND colegio_id = ?',
      [docente_destino_id, colegio_id]
    );
    if (!destino) return res.status(400).json({ error: 'El docente de destino no existe en tu colegio' });

    let reasignadas = 0;
    let omitidas = 0;
    for (const asignacionId of asignacion_ids) {
      try {
        const [result] = await db.query(
          `UPDATE docente_grupos_materias dgm
           JOIN grupos g ON g.id = dgm.grupo_id
           SET dgm.docente_id = ?
           WHERE dgm.id = ? AND dgm.docente_id = ? AND g.colegio_id = ?`,
          [docente_destino_id, asignacionId, docente_origen_id, colegio_id]
        );
        if (result.affectedRows > 0) reasignadas++;
        else omitidas++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') omitidas++;
        else throw err;
      }
    }

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'carga_academica_reasignada', entidad: 'docente_grupos_materias', entidad_id: null,
      detalle: { docente_origen: origen.nombre, docente_destino: destino.nombre, reasignadas, omitidas },
    });

    res.json({
      mensaje: omitidas > 0
        ? `${reasignadas} clase(s) reasignada(s), ${omitidas} omitida(s) (ya existían para el docente destino)`
        : `${reasignadas} clase(s) reasignada(s) correctamente`,
      data: { reasignadas, omitidas },
    });
  } catch (err) {
    console.error('Error al reasignar carga académica:', err);
    res.status(500).json({ error: 'Error al reasignar la carga académica' });
  }
}

// PUT /api/docentes/clases/trasladar-masivo — copia las clases abiertas de un grupo a otro(s) grupo(s)
// body: { grupo_origen_id, grupo_destino_ids: number[] }
async function trasladarClases(req, res) {
  const { grupo_origen_id, grupo_destino_ids } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!grupo_origen_id || !Array.isArray(grupo_destino_ids) || grupo_destino_ids.length === 0) {
    return res.status(400).json({ error: 'Selecciona el grupo de origen y al menos un grupo de destino' });
  }
  if (grupo_destino_ids.map(String).includes(String(grupo_origen_id))) {
    return res.status(400).json({ error: 'El grupo de destino debe ser distinto al de origen' });
  }

  try {
    const [[origen]] = await db.query(
      'SELECT id, nombre FROM grupos WHERE id = ? AND colegio_id = ?',
      [grupo_origen_id, colegio_id]
    );
    if (!origen) return res.status(400).json({ error: 'El grupo de origen no existe en tu colegio' });

    const [clasesOrigen] = await db.query(
      'SELECT docente_id, materia_id, intensidad_horaria_semanal FROM docente_grupos_materias WHERE grupo_id = ?',
      [grupo_origen_id]
    );
    if (clasesOrigen.length === 0) {
      return res.status(400).json({ error: 'El grupo de origen no tiene clases abiertas para trasladar' });
    }

    const resultados = [];
    for (const grupo_destino_id of grupo_destino_ids) {
      const [[destino]] = await db.query(
        'SELECT id, nombre, grado FROM grupos WHERE id = ? AND colegio_id = ?',
        [grupo_destino_id, colegio_id]
      );
      if (!destino) {
        resultados.push({ grupo_destino_id, nombre: null, insertadas: 0, omitidas: clasesOrigen.length, error: 'Grupo no encontrado' });
        continue;
      }

      const [pensum] = await db.query(
        'SELECT materia_id FROM grado_materias WHERE colegio_id = ? AND grado_codigo = ?',
        [colegio_id, destino.grado]
      );
      const pensumIds = pensum.length > 0 ? new Set(pensum.map(p => p.materia_id)) : null;

      let insertadas = 0;
      let omitidas = 0;
      for (const clase of clasesOrigen) {
        if (pensumIds && !pensumIds.has(clase.materia_id)) { omitidas++; continue; }
        try {
          await db.query(
            'INSERT INTO docente_grupos_materias (docente_id, grupo_id, materia_id, intensidad_horaria_semanal) VALUES (?, ?, ?, ?)',
            [clase.docente_id, grupo_destino_id, clase.materia_id, clase.intensidad_horaria_semanal]
          );
          insertadas++;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') omitidas++;
          else throw err;
        }
      }
      resultados.push({ grupo_destino_id, nombre: destino.nombre, insertadas, omitidas });
    }

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'clases_trasladadas', entidad: 'docente_grupos_materias', entidad_id: null,
      detalle: { grupo_origen: origen.nombre, grupos_destino: resultados.map(r => r.nombre).filter(Boolean), resultados },
    });

    res.json({ mensaje: 'Traslado masivo completado', data: resultados });
  } catch (err) {
    console.error('Error al trasladar clases:', err);
    res.status(500).json({ error: 'Error al trasladar las clases' });
  }
}

// DELETE /api/docentes/:id (desactiva)
async function eliminar(req, res) {
  const { id } = req.params;
  try {
    await db.query(
      'UPDATE usuarios SET activo = FALSE WHERE id = ? AND rol = "docente" AND colegio_id = ?',
      [id, req.usuario.colegio_id]
    );
    res.json({ mensaje: 'Docente desactivado' });
  } catch (err) {
    console.error('Error al desactivar docente:', err);
    res.status(500).json({ error: 'Error al desactivar el docente' });
  }
}

module.exports = { listar, crear, asignar, obtenerAsignaciones, eliminarAsignacion, reasignarCarga, trasladarClases, eliminar, actualizarGrupoDirigido };
