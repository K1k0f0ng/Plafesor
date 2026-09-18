const db = require('../../database');
const { cifrar, descifrar } = require('../../utils/cifrado');
const { registrarBienestar } = require('../../utils/bienestarAuditoria');
const { notificar, notificarEquipo } = require('../../utils/bienestarNotificaciones');

// Remisiones a orientación (Fase 3). Ver docs/BIENESTAR_MAPA_FUNCIONAL.md §4.2.
// - Remiten: docente (según configuración), director y orientadores del equipo.
// - La bandeja la ve solo el equipo de orientación.
// - El remitente solo ve un estado simplificado de SUS remisiones.

const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];

// Lo que ve el remitente: nunca el estado interno ni quién la atiende
const ESTADO_REMITENTE = {
  pendiente: 'enviada',
  recibida: 'recibida',
  en_revision: 'en_atencion',
  en_seguimiento: 'en_atencion',
  cerrada: 'atendida',
  archivada: 'atendida',
};

const LIMITES = { descripcion: 4000, observaciones: 2000, devolucion: 1000, motivo_archivo: 1000 };

function textoValido(v, max, { obligatorio = false, minimo = 0 } = {}) {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return obligatorio ? null : '';
  if (t.length < minimo || t.length > max) return null;
  return t;
}

// Grupo "actual" del estudiante: el de año lectivo más reciente en su colegio.
const FILTRO_GRUPO_ACTUAL = `
  g.ano_lectivo = (
    SELECT MAX(g2.ano_lectivo) FROM estudiante_grupos eg2
    JOIN grupos g2 ON g2.id = eg2.grupo_id
    WHERE eg2.estudiante_id = u.id AND g2.colegio_id = g.colegio_id
  )`;

// Estudiantes a los que este usuario puede remitir (con su grupo actual).
// Docente: los de los grupos donde dicta o que dirige (o solo el que dirige,
// si el colegio restringió la remisión a directores de grupo).
// Director y orientador: todos los estudiantes activos del colegio.
async function consultarEstudiantesPermitidos(req, estudianteId = null) {
  const u = req.usuario;
  const params = [u.colegio_id, u.colegio_id];
  let filtroRol = '';

  if (u.rol === 'docente') {
    const [[doc]] = await db.query('SELECT grupo_dirigido_id FROM usuarios WHERE id = ?', [u.id]);
    const dirigido = doc?.grupo_dirigido_id || 0;
    if (req.bienestar.config?.remiten === 'directores_grupo') {
      filtroRol = 'AND g.id = ?';
      params.push(dirigido);
    } else {
      filtroRol = 'AND (g.id IN (SELECT grupo_id FROM docente_grupos_materias WHERE docente_id = ?) OR g.id = ?)';
      params.push(u.id, dirigido);
    }
  }
  let filtroEst = '';
  if (estudianteId) { filtroEst = 'AND u.id = ?'; params.push(estudianteId); }

  const [filas] = await db.query(
    `SELECT DISTINCT u.id, u.nombre, g.id AS grupo_id, g.nombre AS grupo, g.grado
     FROM usuarios u
     JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
     JOIN grupos g ON g.id = eg.grupo_id
     WHERE u.rol = 'estudiante' AND u.activo = TRUE AND u.colegio_id = ? AND g.colegio_id = ?
       AND ${FILTRO_GRUPO_ACTUAL}
       ${filtroRol} ${filtroEst}
     ORDER BY g.grado, g.nombre, u.nombre`,
    params
  );
  return filas;
}

// GET /api/bienestar/remisiones/estudiantes
async function estudiantesDisponibles(req, res) {
  try {
    res.json({ data: await consultarEstudiantesPermitidos(req) });
  } catch (err) {
    console.error('Bienestar: error al listar estudiantes para remitir:', err.message);
    res.status(500).json({ error: 'Error al obtener los estudiantes' });
  }
}

// POST /api/bienestar/remisiones
async function crear(req, res) {
  const u = req.usuario;
  const b = req.body || {};
  const estudianteId = parseInt(b.estudiante_id);
  const motivoId = parseInt(b.motivo_id);
  const prioridad = PRIORIDADES.includes(b.prioridad) ? b.prioridad : null;
  const descripcion = textoValido(b.descripcion, LIMITES.descripcion, { obligatorio: true, minimo: 10 });
  const observaciones = textoValido(b.observaciones, LIMITES.observaciones);
  const familiaInformada = b.familia_informada === true ? true : b.familia_informada === false ? false : null;

  if (!estudianteId) return res.status(400).json({ error: 'Selecciona el estudiante' });
  if (!motivoId) return res.status(400).json({ error: 'Selecciona el motivo de la remisión' });
  if (!prioridad) return res.status(400).json({ error: 'Selecciona la prioridad' });
  if (descripcion === null) return res.status(400).json({ error: `Describe lo observado (entre 10 y ${LIMITES.descripcion} caracteres)` });
  if (observaciones === null) return res.status(400).json({ error: `Las observaciones no pueden superar ${LIMITES.observaciones} caracteres` });

  try {
    const [estudiante] = await consultarEstudiantesPermitidos(req, estudianteId);
    if (!estudiante) {
      registrarBienestar(req, 'acceso_denegado', 'remision');
      return res.status(403).json({ error: 'No puedes remitir a ese estudiante' });
    }
    const [[motivo]] = await db.query(
      `SELECT id FROM bienestar_catalogos WHERE id = ? AND colegio_id = ? AND tipo = 'motivo_remision' AND activo = TRUE`,
      [motivoId, u.colegio_id]
    );
    if (!motivo) return res.status(400).json({ error: 'Motivo de remisión inválido' });

    const [r] = await db.query(
      `INSERT INTO bienestar_remisiones
         (colegio_id, estudiante_id, grupo_id, remitente_id, motivo_id, descripcion, observaciones, prioridad, familia_informada, origen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'docente')`,
      [u.colegio_id, estudianteId, estudiante.grupo_id, u.id, motivoId,
        cifrar(descripcion), cifrar(observaciones), prioridad, familiaInformada]
    );

    registrarBienestar(req, 'remision_creada', 'remision', r.insertId);
    notificarEquipo(u.colegio_id, {
      tipo: prioridad === 'urgente' ? 'bienestar_urgente' : 'bienestar_remision',
      ref_key: `remision_${r.insertId}`,
      titulo: prioridad === 'urgente' ? 'Remisión URGENTE pendiente de revisión' : 'Hay una nueva remisión pendiente de revisión',
      mensaje: 'Revísala en Bienestar y Orientación → Remisiones.',
    });

    res.status(201).json({ mensaje: 'Remisión enviada a orientación', data: { id: r.insertId, estado: 'enviada' } });
  } catch (err) {
    if (err.code === 'SIN_CLAVE_CIFRADO') {
      return res.status(503).json({ error: 'El módulo no está listo para guardar información. Contacta al administrador.' });
    }
    console.error('Bienestar: error al crear remisión:', err.message);
    res.status(500).json({ error: 'Error al enviar la remisión' });
  }
}

// GET /api/bienestar/remisiones/mias — el remitente ve sus remisiones con estado simplificado
async function mias(req, res) {
  const u = req.usuario;
  const verDevolucion = !!req.bienestar.config?.devolucion_docente;
  try {
    const [filas] = await db.query(
      `SELECT r.id, r.creado_en, r.estado, r.prioridad, r.descripcion, r.devolucion,
              e.nombre AS estudiante, g.nombre AS grupo, g.grado, c.nombre AS motivo
       FROM bienestar_remisiones r
       JOIN usuarios e ON e.id = r.estudiante_id
       LEFT JOIN grupos g ON g.id = r.grupo_id
       LEFT JOIN bienestar_catalogos c ON c.id = r.motivo_id
       WHERE r.colegio_id = ? AND r.remitente_id = ?
       ORDER BY r.creado_en DESC
       LIMIT 200`,
      [u.colegio_id, u.id]
    );
    res.json({
      data: filas.map(f => ({
        id: f.id, creado_en: f.creado_en, prioridad: f.prioridad,
        estado: ESTADO_REMITENTE[f.estado] || 'enviada',
        estudiante: f.estudiante, grupo: f.grupo, grado: f.grado, motivo: f.motivo,
        descripcion: descifrar(f.descripcion),               // su propio texto
        devolucion: verDevolucion ? descifrar(f.devolucion) : null,
      })),
    });
  } catch (err) {
    console.error('Bienestar: error al listar mis remisiones:', err.message);
    res.status(500).json({ error: 'Error al obtener tus remisiones' });
  }
}

// Condición SQL de qué remisiones ve un orientador: el líder todas; el
// profesional las pendientes (alguien debe recibirlas), las que recibió él y
// las vinculadas a casos a los que tiene acceso.
function filtroVisibilidad(req) {
  if (req.bienestar.nivel === 'lider') return { sql: '', params: [] };
  const id = req.usuario.id;
  return {
    sql: `AND (r.estado = 'pendiente' OR r.recibida_por = ? OR r.caso_id IN (
            SELECT bc.id FROM bienestar_casos bc
            WHERE bc.responsable_id = ?
               OR bc.id IN (SELECT caso_id FROM bienestar_caso_asignaciones WHERE usuario_id = ? AND hasta IS NULL)))`,
    params: [id, id, id],
  };
}

// GET /api/bienestar/remisiones?estado=pendiente — bandeja del equipo
async function bandeja(req, res) {
  const u = req.usuario;
  const estado = req.query.estado;
  const estadosValidos = Object.keys(ESTADO_REMITENTE);
  if (estado && !estadosValidos.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  const vis = filtroVisibilidad(req);
  try {
    const [filas] = await db.query(
      `SELECT r.id, r.creado_en, r.estado, r.prioridad, r.origen, r.caso_id, r.recibida_en,
              r.estudiante_id, e.nombre AS estudiante, g.nombre AS grupo, g.grado,
              c.nombre AS motivo, rem.nombre AS remitente, rem.rol AS remitente_rol,
              rec.nombre AS recibida_por_nombre,
              EXISTS (SELECT 1 FROM bienestar_casos bc WHERE bc.estudiante_id = r.estudiante_id
                        AND bc.colegio_id = r.colegio_id AND bc.estado IN ('abierto','en_seguimiento')) AS tiene_caso_abierto
       FROM bienestar_remisiones r
       JOIN usuarios e ON e.id = r.estudiante_id
       LEFT JOIN grupos g ON g.id = r.grupo_id
       LEFT JOIN bienestar_catalogos c ON c.id = r.motivo_id
       LEFT JOIN usuarios rem ON rem.id = r.remitente_id
       LEFT JOIN usuarios rec ON rec.id = r.recibida_por
       WHERE r.colegio_id = ? ${estado ? 'AND r.estado = ?' : ''} ${vis.sql}
       ORDER BY FIELD(r.estado, 'pendiente') DESC,
                FIELD(r.prioridad, 'urgente', 'alta', 'media', 'baja'),
                r.creado_en DESC
       LIMIT 300`,
      [u.colegio_id, ...(estado ? [estado] : []), ...vis.params]
    );
    registrarBienestar(req, 'remisiones_listar', 'remision');
    res.json({ data: filas.map(f => ({ ...f, tiene_caso_abierto: !!f.tiene_caso_abierto })) });
  } catch (err) {
    console.error('Bienestar: error al listar bandeja:', err.message);
    res.status(500).json({ error: 'Error al obtener las remisiones' });
  }
}

// Carga una remisión si el orientador puede verla (misma regla que la bandeja)
async function remisionVisible(req, id) {
  const vis = filtroVisibilidad(req);
  const [[fila]] = await db.query(
    `SELECT r.* FROM bienestar_remisiones r WHERE r.id = ? AND r.colegio_id = ? ${vis.sql}`,
    [id, req.usuario.colegio_id, ...vis.params]
  );
  return fila || null;
}

// GET /api/bienestar/remisiones/:id — detalle para el equipo (descifrado)
async function detalle(req, res) {
  const id = parseInt(req.params.id);
  try {
    const r = await remisionVisible(req, id);
    if (!r) {
      registrarBienestar(req, 'acceso_denegado', 'remision', id);
      return res.status(404).json({ error: 'Remisión no encontrada' });
    }
    const [[extra]] = await db.query(
      `SELECT e.nombre AS estudiante, g.nombre AS grupo, g.grado, c.nombre AS motivo,
              rem.nombre AS remitente, rem.rol AS remitente_rol, rec.nombre AS recibida_por_nombre
       FROM bienestar_remisiones r
       JOIN usuarios e ON e.id = r.estudiante_id
       LEFT JOIN grupos g ON g.id = r.grupo_id
       LEFT JOIN bienestar_catalogos c ON c.id = r.motivo_id
       LEFT JOIN usuarios rem ON rem.id = r.remitente_id
       LEFT JOIN usuarios rec ON rec.id = r.recibida_por
       WHERE r.id = ?`,
      [id]
    );
    const [[casoAbierto]] = await db.query(
      `SELECT id FROM bienestar_casos WHERE estudiante_id = ? AND colegio_id = ? AND estado IN ('abierto','en_seguimiento') LIMIT 1`,
      [r.estudiante_id, req.usuario.colegio_id]
    );
    registrarBienestar(req, 'remision_ver', 'remision', id, r.caso_id);
    res.json({
      data: {
        id: r.id, creado_en: r.creado_en, estado: r.estado, prioridad: r.prioridad, origen: r.origen,
        estudiante_id: r.estudiante_id, caso_id: r.caso_id, recibida_en: r.recibida_en,
        motivo_id: r.motivo_id, caso_abierto_id: casoAbierto?.id || null,
        familia_informada: r.familia_informada === null ? null : !!r.familia_informada,
        ...extra,
        descripcion: descifrar(r.descripcion),
        observaciones: descifrar(r.observaciones),
        devolucion: descifrar(r.devolucion),
        motivo_archivo: descifrar(r.motivo_archivo),
      },
    });
  } catch (err) {
    console.error('Bienestar: error al ver remisión:', err.message);
    res.status(500).json({ error: 'Error al obtener la remisión' });
  }
}

// PATCH /api/bienestar/remisiones/:id/recibir
async function recibir(req, res) {
  const id = parseInt(req.params.id);
  try {
    const r = await remisionVisible(req, id);
    if (!r) return res.status(404).json({ error: 'Remisión no encontrada' });
    if (r.estado !== 'pendiente') return res.status(409).json({ error: 'Esta remisión ya fue recibida' });

    // El WHERE estado='pendiente' evita que dos orientadores la reciban a la vez
    const [upd] = await db.query(
      `UPDATE bienestar_remisiones SET estado = 'recibida', recibida_por = ?, recibida_en = NOW()
       WHERE id = ? AND colegio_id = ? AND estado = 'pendiente'`,
      [req.usuario.id, id, req.usuario.colegio_id]
    );
    if (!upd.affectedRows) return res.status(409).json({ error: 'Otro orientador acaba de recibir esta remisión' });

    registrarBienestar(req, 'remision_recibida', 'remision', id);
    if (r.remitente_id && r.remitente_id !== req.usuario.id) {
      notificar([r.remitente_id], {
        tipo: 'bienestar_remision', ref_key: `remision_recibida_${id}`,
        titulo: 'Tu remisión fue recibida por orientación',
      });
    }
    res.json({ mensaje: 'Remisión recibida' });
  } catch (err) {
    console.error('Bienestar: error al recibir remisión:', err.message);
    res.status(500).json({ error: 'Error al recibir la remisión' });
  }
}

// PATCH /api/bienestar/remisiones/:id/revision — marcar "en revisión"
async function enRevision(req, res) {
  const id = parseInt(req.params.id);
  try {
    const r = await remisionVisible(req, id);
    if (!r) return res.status(404).json({ error: 'Remisión no encontrada' });
    if (r.estado !== 'recibida') return res.status(409).json({ error: 'Solo una remisión recibida puede pasar a revisión' });
    await db.query(`UPDATE bienestar_remisiones SET estado = 'en_revision' WHERE id = ? AND colegio_id = ?`, [id, req.usuario.colegio_id]);
    registrarBienestar(req, 'remision_en_revision', 'remision', id);
    res.json({ mensaje: 'Remisión en revisión' });
  } catch (err) {
    console.error('Bienestar: error al pasar a revisión:', err.message);
    res.status(500).json({ error: 'Error al actualizar la remisión' });
  }
}

// PATCH /api/bienestar/remisiones/:id/archivar — cerrar sin abrir caso, con motivo
async function archivar(req, res) {
  const id = parseInt(req.params.id);
  const motivo = textoValido(req.body?.motivo, LIMITES.motivo_archivo, { obligatorio: true, minimo: 5 });
  if (motivo === null) return res.status(400).json({ error: 'Indica por qué se archiva (mínimo 5 caracteres)' });
  try {
    const r = await remisionVisible(req, id);
    if (!r) return res.status(404).json({ error: 'Remisión no encontrada' });
    if (['cerrada', 'archivada', 'en_seguimiento'].includes(r.estado)) {
      return res.status(409).json({ error: 'Esta remisión no se puede archivar en su estado actual' });
    }
    await db.query(
      `UPDATE bienestar_remisiones SET estado = 'archivada', motivo_archivo = ?,
         recibida_por = COALESCE(recibida_por, ?), recibida_en = COALESCE(recibida_en, NOW())
       WHERE id = ? AND colegio_id = ?`,
      [cifrar(motivo), req.usuario.id, id, req.usuario.colegio_id]
    );
    registrarBienestar(req, 'remision_archivada', 'remision', id);
    res.json({ mensaje: 'Remisión archivada' });
  } catch (err) {
    if (err.code === 'SIN_CLAVE_CIFRADO') return res.status(503).json({ error: 'El módulo no está listo para guardar información.' });
    console.error('Bienestar: error al archivar remisión:', err.message);
    res.status(500).json({ error: 'Error al archivar la remisión' });
  }
}

// PATCH /api/bienestar/remisiones/:id/devolucion — nota breve y NO confidencial al remitente
async function devolucion(req, res) {
  if (!req.bienestar.config?.devolucion_docente) {
    return res.status(403).json({ error: 'El colegio no tiene activada la devolución al docente' });
  }
  const id = parseInt(req.params.id);
  const texto = textoValido(req.body?.texto, LIMITES.devolucion, { obligatorio: true, minimo: 5 });
  if (texto === null) return res.status(400).json({ error: `La devolución debe tener entre 5 y ${LIMITES.devolucion} caracteres` });
  try {
    const r = await remisionVisible(req, id);
    if (!r) return res.status(404).json({ error: 'Remisión no encontrada' });
    if (r.estado === 'pendiente') return res.status(409).json({ error: 'Primero recibe la remisión' });
    await db.query('UPDATE bienestar_remisiones SET devolucion = ? WHERE id = ? AND colegio_id = ?', [cifrar(texto), id, req.usuario.colegio_id]);
    registrarBienestar(req, 'remision_devolucion', 'remision', id);
    if (r.remitente_id) {
      notificar([r.remitente_id], {
        tipo: 'bienestar_remision', ref_key: `remision_devolucion_${id}`,
        titulo: 'Orientación dejó una devolución sobre tu remisión',
        mensaje: 'Consúltala en Bienestar y Orientación → Mis remisiones.',
      });
    }
    res.json({ mensaje: 'Devolución enviada' });
  } catch (err) {
    if (err.code === 'SIN_CLAVE_CIFRADO') return res.status(503).json({ error: 'El módulo no está listo para guardar información.' });
    console.error('Bienestar: error al guardar devolución:', err.message);
    res.status(500).json({ error: 'Error al enviar la devolución' });
  }
}

module.exports = {
  estudiantesDisponibles, crear, mias, bandeja, detalle, recibir, enRevision, archivar, devolucion,
  ESTADO_REMITENTE, consultarEstudiantesPermitidos, remisionVisible,
};
