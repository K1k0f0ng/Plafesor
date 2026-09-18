const db = require('../../database');
const { cifrar, descifrar } = require('../../utils/cifrado');
const { registrarBienestar } = require('../../utils/bienestarAuditoria');
const { notificar } = require('../../utils/bienestarNotificaciones');
const { casoAccesible } = require('../../middlewares/bienestarAcceso');

// Casos de orientación (Fase 4). Ver docs/BIENESTAR_MAPA_FUNCIONAL.md §4.3.
// Regla: un estudiante tiene como máximo UN caso abierto (abierto o en_seguimiento).
// Acceso: líder → todos los del colegio; profesional → responsable o asignado.
// Admin, director y docente nunca entran aquí (solo director ve el estado, ver estadoParaDirector).

const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];
const ABIERTOS = ['abierto', 'en_seguimiento'];
const LIMITE_TEXTO = 4000;

// Grado y grupo actuales del estudiante (alias e = usuarios del estudiante, c = caso)
const SUBCONSULTA_GRUPO = `
  (SELECT g.grado FROM estudiante_grupos eg JOIN grupos g ON g.id = eg.grupo_id
    WHERE eg.estudiante_id = e.id AND g.colegio_id = c.colegio_id ORDER BY g.ano_lectivo DESC LIMIT 1) AS grado,
  (SELECT g.nombre FROM estudiante_grupos eg JOIN grupos g ON g.id = eg.grupo_id
    WHERE eg.estudiante_id = e.id AND g.colegio_id = c.colegio_id ORDER BY g.ano_lectivo DESC LIMIT 1) AS grupo`;

function texto(v, max = LIMITE_TEXTO) {
  if (v === undefined) return undefined;              // no enviado → no se cambia
  const t = typeof v === 'string' ? v.trim() : '';
  if (t.length > max) return null;                    // inválido
  return t;
}

function manejarError(res, err, mensaje) {
  if (err.code === 'SIN_CLAVE_CIFRADO') {
    return res.status(503).json({ error: 'El módulo no está listo para guardar información. Contacta al administrador.' });
  }
  console.error(`Bienestar: ${mensaje}:`, err.message);
  return res.status(500).json({ error: mensaje });
}

async function catalogoValido(colegio_id, id, tipo) {
  if (!id) return false;
  const [[fila]] = await db.query(
    'SELECT id FROM bienestar_catalogos WHERE id = ? AND colegio_id = ? AND tipo = ? AND activo = TRUE',
    [id, colegio_id, tipo]
  );
  return !!fila;
}

async function esMiembroEquipo(colegio_id, usuario_id) {
  const [[fila]] = await db.query(
    `SELECT be.usuario_id FROM bienestar_equipo be JOIN usuarios u ON u.id = be.usuario_id AND u.activo = TRUE
     WHERE be.colegio_id = ? AND be.usuario_id = ? AND be.activo = TRUE`,
    [colegio_id, usuario_id]
  );
  return !!fila;
}

// Filtro SQL de casos visibles para el orientador actual
function filtroCasos(req, alias = 'c') {
  if (req.bienestar.nivel === 'lider') return { sql: '', params: [] };
  const id = req.usuario.id;
  return {
    sql: `AND (${alias}.responsable_id = ? OR ${alias}.id IN (
            SELECT caso_id FROM bienestar_caso_asignaciones WHERE usuario_id = ? AND hasta IS NULL))`,
    params: [id, id],
  };
}

// GET /api/bienestar/casos?estado=abiertos|cerrado|todos
async function listar(req, res) {
  const u = req.usuario;
  const filtro = req.query.estado || 'abiertos';
  let condEstado = '';
  if (filtro === 'abiertos') condEstado = "AND c.estado IN ('abierto','en_seguimiento')";
  else if (['cerrado', 'archivado'].includes(filtro)) condEstado = 'AND c.estado = ?';
  else if (filtro !== 'todos') return res.status(400).json({ error: 'Filtro inválido' });
  const vis = filtroCasos(req);
  try {
    const [filas] = await db.query(
      `SELECT c.id, c.estado, c.prioridad, c.abierto_en, c.cerrado_en, c.estudiante_id,
              e.nombre AS estudiante, ${SUBCONSULTA_GRUPO},
              cat.nombre AS motivo, r.nombre AS responsable, c.responsable_id,
              (SELECT MAX(s.fecha) FROM bienestar_seguimientos s WHERE s.caso_id = c.id) AS ultimo_seguimiento,
              (SELECT COUNT(*) FROM bienestar_compromisos k WHERE k.caso_id = c.id AND k.estado = 'pendiente'
                 AND k.fecha_limite < CURDATE()) AS compromisos_vencidos
       FROM bienestar_casos c
       JOIN usuarios e ON e.id = c.estudiante_id
       LEFT JOIN usuarios r ON r.id = c.responsable_id
       LEFT JOIN bienestar_catalogos cat ON cat.id = c.motivo_id
       WHERE c.colegio_id = ? ${condEstado} ${vis.sql}
       ORDER BY FIELD(c.prioridad, 'urgente', 'alta', 'media', 'baja'), c.abierto_en DESC
       LIMIT 500`,
      [u.colegio_id, ...(condEstado.includes('?') ? [filtro] : []), ...vis.params]
    );
    registrarBienestar(req, 'casos_listar', 'caso');
    res.json({ data: filas });
  } catch (err) {
    manejarError(res, err, 'Error al obtener los casos');
  }
}

// POST /api/bienestar/casos
// body: { estudiante_id, remision_id?, motivo_id, prioridad, motivo_detalle?, antecedentes?, responsable_id? }
async function abrir(req, res) {
  const u = req.usuario;
  const b = req.body || {};
  const estudianteId = parseInt(b.estudiante_id);
  const remisionId = b.remision_id ? parseInt(b.remision_id) : null;
  const motivoId = parseInt(b.motivo_id);
  const prioridad = PRIORIDADES.includes(b.prioridad) ? b.prioridad : null;
  const motivoDetalle = texto(b.motivo_detalle);
  const antecedentes = texto(b.antecedentes);
  let responsableId = b.responsable_id ? parseInt(b.responsable_id) : u.id;

  if (!estudianteId) return res.status(400).json({ error: 'Selecciona el estudiante' });
  if (!prioridad) return res.status(400).json({ error: 'Selecciona la prioridad' });
  if (motivoDetalle === null || antecedentes === null) return res.status(400).json({ error: 'Texto demasiado largo' });
  // Un profesional solo puede abrir casos a su nombre; el líder puede asignar
  if (req.bienestar.nivel !== 'lider') responsableId = u.id;

  try {
    const [[est]] = await db.query(
      `SELECT id FROM usuarios WHERE id = ? AND colegio_id = ? AND rol = 'estudiante'`,
      [estudianteId, u.colegio_id]
    );
    if (!est) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (!(await catalogoValido(u.colegio_id, motivoId, 'motivo_remision'))) {
      return res.status(400).json({ error: 'Motivo inválido' });
    }
    if (responsableId !== u.id && !(await esMiembroEquipo(u.colegio_id, responsableId))) {
      return res.status(400).json({ error: 'El responsable debe ser parte del equipo de orientación' });
    }
    const [[abierto]] = await db.query(
      `SELECT id FROM bienestar_casos WHERE estudiante_id = ? AND colegio_id = ? AND estado IN ('abierto','en_seguimiento') LIMIT 1`,
      [estudianteId, u.colegio_id]
    );
    if (abierto) {
      return res.status(409).json({ error: 'Este estudiante ya tiene un caso abierto. Vincula la remisión a ese caso.', caso_id: abierto.id });
    }

    let remision = null;
    if (remisionId) {
      const [[r]] = await db.query(
        'SELECT id, estudiante_id, estado FROM bienestar_remisiones WHERE id = ? AND colegio_id = ?',
        [remisionId, u.colegio_id]
      );
      if (!r || r.estudiante_id !== estudianteId) return res.status(400).json({ error: 'La remisión no corresponde a este estudiante' });
      if (['archivada', 'cerrada', 'en_seguimiento'].includes(r.estado)) {
        return res.status(409).json({ error: 'Esa remisión ya fue atendida o archivada' });
      }
      remision = r;
    }

    const conn = await db.getConnection();
    let casoId;
    try {
      await conn.beginTransaction();
      const [ins] = await conn.query(
        `INSERT INTO bienestar_casos (colegio_id, estudiante_id, responsable_id, prioridad, estado, motivo_id, motivo_detalle, antecedentes)
         VALUES (?, ?, ?, ?, 'abierto', ?, ?, ?)`,
        [u.colegio_id, estudianteId, responsableId, prioridad, motivoId, cifrar(motivoDetalle), cifrar(antecedentes)]
      );
      casoId = ins.insertId;
      await conn.query(
        'INSERT INTO bienestar_caso_asignaciones (caso_id, usuario_id, asignado_por) VALUES (?, ?, ?)',
        [casoId, responsableId, u.id]
      );
      if (remision) {
        await conn.query(
          `UPDATE bienestar_remisiones SET caso_id = ?, estado = 'en_seguimiento',
             recibida_por = COALESCE(recibida_por, ?), recibida_en = COALESCE(recibida_en, NOW())
           WHERE id = ?`,
          [casoId, u.id, remision.id]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    registrarBienestar(req, 'caso_abierto', 'caso', casoId, casoId);
    if (responsableId !== u.id) {
      notificar([responsableId], { tipo: 'bienestar_remision', ref_key: `caso_asignado_${casoId}_${responsableId}`, titulo: 'Se te asignó un caso' });
    }
    res.status(201).json({ mensaje: 'Caso abierto', data: { id: casoId } });
  } catch (err) {
    manejarError(res, err, 'Error al abrir el caso');
  }
}

// POST /api/bienestar/remisiones/:id/vincular  body: { caso_id }
async function vincularRemision(req, res) {
  const remisionId = parseInt(req.params.id);
  const casoId = parseInt(req.body?.caso_id);
  try {
    const caso = await casoAccesible(req, casoId);
    if (!caso || !ABIERTOS.includes(caso.estado)) return res.status(404).json({ error: 'Caso abierto no encontrado' });
    const [[r]] = await db.query(
      'SELECT id, estudiante_id, estado FROM bienestar_remisiones WHERE id = ? AND colegio_id = ?',
      [remisionId, req.usuario.colegio_id]
    );
    if (!r || r.estudiante_id !== caso.estudiante_id) return res.status(400).json({ error: 'La remisión no corresponde al estudiante del caso' });
    if (['archivada', 'cerrada'].includes(r.estado)) return res.status(409).json({ error: 'Esa remisión ya fue archivada' });
    await db.query(
      `UPDATE bienestar_remisiones SET caso_id = ?, estado = 'en_seguimiento',
         recibida_por = COALESCE(recibida_por, ?), recibida_en = COALESCE(recibida_en, NOW())
       WHERE id = ?`,
      [casoId, req.usuario.id, remisionId]
    );
    registrarBienestar(req, 'remision_vinculada', 'remision', remisionId, casoId);
    res.json({ mensaje: 'Remisión vinculada al caso' });
  } catch (err) {
    manejarError(res, err, 'Error al vincular la remisión');
  }
}

// Contexto académico de solo lectura, tomado de Playfesor sin copiarlo
async function contextoEstudiante(estudianteId, colegioId) {
  const [[grupo]] = await db.query(
    `SELECT g.nombre AS grupo, g.grado FROM estudiante_grupos eg JOIN grupos g ON g.id = eg.grupo_id
     WHERE eg.estudiante_id = ? AND g.colegio_id = ? ORDER BY g.ano_lectivo DESC LIMIT 1`,
    [estudianteId, colegioId]
  );
  const [[notas]] = await db.query(
    `SELECT ROUND(AVG(CASE WHEN ra.completada_en >= DATE_SUB(NOW(), INTERVAL 60 DAY) THEN ra.nota END), 1) AS promedio_60,
            ROUND(AVG(CASE WHEN ra.completada_en <  DATE_SUB(NOW(), INTERVAL 60 DAY)
                            AND ra.completada_en >= DATE_SUB(NOW(), INTERVAL 120 DAY) THEN ra.nota END), 1) AS promedio_previo
     FROM resultados_actividades ra WHERE ra.estudiante_id = ? AND ra.nota IS NOT NULL`,
    [estudianteId]
  );
  const [[asis]] = await db.query(
    `SELECT SUM(estado = 'ausente') AS ausencias, SUM(estado = 'tardanza') AS tardanzas, COUNT(*) AS registros
     FROM asistencias WHERE estudiante_id = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    [estudianteId]
  );
  const [[riesgo]] = await db.query(
    `SELECT MAX(FIELD(nivel, 'bajo', 'medio', 'alto', 'critico')) AS nivel_num,
            SUM(nivel IN ('alto','critico')) AS materias_riesgo
     FROM predicciones_riesgo WHERE estudiante_id = ? AND colegio_id = ?`,
    [estudianteId, colegioId]
  );
  const [[piar]] = await db.query(
    `SELECT (u.requiere_piar = TRUE OR EXISTS (SELECT 1 FROM piar p WHERE p.estudiante_id = u.id)) AS tiene
     FROM usuarios u WHERE u.id = ?`,
    [estudianteId]
  );
  const [[anot]] = await db.query(
    `SELECT COUNT(*) AS n FROM anotaciones WHERE estudiante_id = ? AND tipo = 'mejora'
     AND creado_en >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [estudianteId]
  );
  const niveles = [null, 'bajo', 'medio', 'alto', 'critico'];
  return {
    grupo: grupo?.grupo || null,
    grado: grupo?.grado || null,
    promedio_60_dias: notas?.promedio_60 !== null && notas?.promedio_60 !== undefined ? parseFloat(notas.promedio_60) : null,
    promedio_periodo_anterior: notas?.promedio_previo !== null && notas?.promedio_previo !== undefined ? parseFloat(notas.promedio_previo) : null,
    ausencias_30_dias: Number(asis?.ausencias || 0),
    tardanzas_30_dias: Number(asis?.tardanzas || 0),
    riesgo_academico: niveles[Number(riesgo?.nivel_num || 0)] || null,
    materias_en_riesgo: Number(riesgo?.materias_riesgo || 0),
    tiene_piar: !!piar?.tiene,
    anotaciones_mejora_30_dias: Number(anot?.n || 0),
  };
}

// ¿Puede este usuario leer la nota privada de un seguimiento del caso?
// Autor siempre; responsable o asignado vigente del caso; líder solo si el colegio lo habilitó.
async function puedeVerNotaPrivada(req, caso, seguimiento) {
  const u = req.usuario;
  if (seguimiento.autor_id === u.id) return true;
  if (caso.responsable_id === u.id) return true;
  const [[asig]] = await db.query(
    'SELECT 1 FROM bienestar_caso_asignaciones WHERE caso_id = ? AND usuario_id = ? AND hasta IS NULL LIMIT 1',
    [caso.id, u.id]
  );
  if (asig) return true;
  return req.bienestar.nivel === 'lider' && !!req.bienestar.config?.lider_lee_privadas;
}

// GET /api/bienestar/casos/:id — todo el caso para armar la línea de tiempo.
// Nunca incluye el texto de las notas privadas (van por su propio endpoint).
async function detalle(req, res) {
  const id = parseInt(req.params.id);
  try {
    const caso = await casoAccesible(req, id);
    if (!caso) {
      registrarBienestar(req, 'acceso_denegado', 'caso', id);
      return res.status(404).json({ error: 'Caso no encontrado' });
    }
    const [[nombres]] = await db.query(
      `SELECT e.nombre AS estudiante, r.nombre AS responsable, m.nombre AS motivo, mc.nombre AS motivo_cierre
       FROM bienestar_casos c JOIN usuarios e ON e.id = c.estudiante_id
       LEFT JOIN usuarios r ON r.id = c.responsable_id
       LEFT JOIN bienestar_catalogos m ON m.id = c.motivo_id
       LEFT JOIN bienestar_catalogos mc ON mc.id = c.motivo_cierre_id
       WHERE c.id = ?`,
      [id]
    );
    const [seguimientos] = await db.query(
      `SELECT s.*, t.nombre AS tipo, a.nombre AS autor
       FROM bienestar_seguimientos s
       LEFT JOIN bienestar_catalogos t ON t.id = s.tipo_id
       LEFT JOIN usuarios a ON a.id = s.autor_id
       WHERE s.caso_id = ? ORDER BY s.fecha DESC, s.id DESC`,
      [id]
    );
    const [compromisos] = await db.query(
      'SELECT * FROM bienestar_compromisos WHERE caso_id = ? ORDER BY (estado = "pendiente") DESC, fecha_limite IS NULL, fecha_limite ASC',
      [id]
    );
    const [remisiones] = await db.query(
      `SELECT r.id, r.creado_en, r.prioridad, r.estado, cat.nombre AS motivo, u.nombre AS remitente, u.rol AS remitente_rol
       FROM bienestar_remisiones r LEFT JOIN bienestar_catalogos cat ON cat.id = r.motivo_id
       LEFT JOIN usuarios u ON u.id = r.remitente_id
       WHERE r.caso_id = ? ORDER BY r.creado_en ASC`,
      [id]
    );
    const [asignaciones] = await db.query(
      `SELECT a.desde, a.hasta, u.nombre AS orientador, p.nombre AS asignado_por
       FROM bienestar_caso_asignaciones a JOIN usuarios u ON u.id = a.usuario_id
       LEFT JOIN usuarios p ON p.id = a.asignado_por
       WHERE a.caso_id = ? ORDER BY a.desde ASC`,
      [id]
    );
    const [adjuntos] = await db.query(
      `SELECT a.id, a.nombre_original, a.tipo_mime, a.tamano, a.creado_en, a.remision_id, u.nombre AS subido_por
       FROM bienestar_adjuntos a LEFT JOIN usuarios u ON u.id = a.subido_por
       WHERE a.colegio_id = ? AND (a.caso_id = ? OR a.remision_id IN (SELECT id FROM bienestar_remisiones WHERE caso_id = ?))
       ORDER BY a.creado_en DESC`,
      [caso.colegio_id, id, id]
    );

    const segs = [];
    for (const s of seguimientos) {
      segs.push({
        id: s.id, fecha: s.fecha, tipo: s.tipo, tipo_id: s.tipo_id, autor: s.autor, autor_id: s.autor_id,
        participantes: typeof s.participantes === 'string' ? JSON.parse(s.participantes || '[]') : (s.participantes || []),
        motivo: descifrar(s.motivo), resumen: descifrar(s.resumen), acuerdos: descifrar(s.acuerdos),
        proxima_accion: descifrar(s.proxima_accion), proxima_fecha: s.proxima_fecha,
        tiene_nota_privada: !!s.nota_privada,
        puede_ver_nota: s.nota_privada ? await puedeVerNotaPrivada(req, caso, s) : false,
        puede_editar: s.autor_id === req.usuario.id && ABIERTOS.includes(caso.estado),
      });
    }

    registrarBienestar(req, 'caso_ver', 'caso', id, id);
    res.json({
      data: {
        id: caso.id, estado: caso.estado, prioridad: caso.prioridad, estudiante_id: caso.estudiante_id,
        abierto_en: caso.abierto_en, cerrado_en: caso.cerrado_en,
        responsable_id: caso.responsable_id, motivo_id: caso.motivo_id,
        ...nombres,
        motivo_detalle: descifrar(caso.motivo_detalle),
        antecedentes: descifrar(caso.antecedentes),
        cierre_detalle: descifrar(caso.cierre_detalle),
        contexto: await contextoEstudiante(caso.estudiante_id, caso.colegio_id),
        seguimientos: segs,
        compromisos: compromisos.map(k => ({
          id: k.id, seguimiento_id: k.seguimiento_id, descripcion: descifrar(k.descripcion),
          responsable_tipo: k.responsable_tipo, fecha_limite: k.fecha_limite, estado: k.estado,
          visible_familia: !!k.visible_familia, creado_en: k.creado_en,
        })),
        remisiones,
        asignaciones,
        adjuntos: adjuntos.map(a => ({ ...a, nombre_original: descifrar(a.nombre_original) || 'archivo' })),
        permisos: {
          es_lider: req.bienestar.nivel === 'lider',
          editable: ABIERTOS.includes(caso.estado),
        },
      },
    });
  } catch (err) {
    manejarError(res, err, 'Error al obtener el caso');
  }
}

// PATCH /api/bienestar/casos/:id — prioridad, estado (abierto/en_seguimiento), motivo, textos
async function editar(req, res) {
  const id = parseInt(req.params.id);
  const b = req.body || {};
  try {
    const caso = await casoAccesible(req, id);
    if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });
    if (!ABIERTOS.includes(caso.estado)) return res.status(409).json({ error: 'El caso está cerrado. Reábrelo para editarlo.' });

    const cambios = []; const valores = [];
    if (b.prioridad !== undefined) {
      if (!PRIORIDADES.includes(b.prioridad)) return res.status(400).json({ error: 'Prioridad inválida' });
      cambios.push('prioridad = ?'); valores.push(b.prioridad);
    }
    if (b.estado !== undefined) {
      if (!ABIERTOS.includes(b.estado)) return res.status(400).json({ error: 'Para cerrar el caso usa "Cerrar caso"' });
      cambios.push('estado = ?'); valores.push(b.estado);
    }
    if (b.motivo_id !== undefined) {
      if (!(await catalogoValido(req.usuario.colegio_id, parseInt(b.motivo_id), 'motivo_remision'))) return res.status(400).json({ error: 'Motivo inválido' });
      cambios.push('motivo_id = ?'); valores.push(parseInt(b.motivo_id));
    }
    for (const campo of ['motivo_detalle', 'antecedentes']) {
      const t = texto(b[campo]);
      if (t === null) return res.status(400).json({ error: 'Texto demasiado largo' });
      if (t !== undefined) { cambios.push(`${campo} = ?`); valores.push(cifrar(t)); }
    }
    if (!cambios.length) return res.status(400).json({ error: 'No hay cambios' });

    await db.query(`UPDATE bienestar_casos SET ${cambios.join(', ')} WHERE id = ? AND colegio_id = ?`, [...valores, id, req.usuario.colegio_id]);
    registrarBienestar(req, 'caso_editado', 'caso', id, id);
    res.json({ mensaje: 'Caso actualizado' });
  } catch (err) {
    manejarError(res, err, 'Error al actualizar el caso');
  }
}

// POST /api/bienestar/casos/:id/asignar — solo líder. body: { usuario_id }
async function reasignar(req, res) {
  const id = parseInt(req.params.id);
  const nuevo = parseInt(req.body?.usuario_id);
  try {
    const caso = await casoAccesible(req, id);
    if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });
    if (!ABIERTOS.includes(caso.estado)) return res.status(409).json({ error: 'El caso está cerrado' });
    if (!nuevo || !(await esMiembroEquipo(req.usuario.colegio_id, nuevo))) {
      return res.status(400).json({ error: 'El nuevo responsable debe ser parte del equipo de orientación' });
    }
    if (nuevo === caso.responsable_id) return res.status(400).json({ error: 'Esa persona ya es la responsable' });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE bienestar_caso_asignaciones SET hasta = NOW() WHERE caso_id = ? AND hasta IS NULL', [id]);
      await conn.query('INSERT INTO bienestar_caso_asignaciones (caso_id, usuario_id, asignado_por) VALUES (?, ?, ?)', [id, nuevo, req.usuario.id]);
      await conn.query('UPDATE bienestar_casos SET responsable_id = ? WHERE id = ?', [nuevo, id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    registrarBienestar(req, 'caso_reasignado', 'caso', id, id);
    notificar([nuevo], { tipo: 'bienestar_remision', ref_key: `caso_asignado_${id}_${nuevo}`, titulo: 'Se te asignó un caso' });
    res.json({ mensaje: 'Caso reasignado' });
  } catch (err) {
    manejarError(res, err, 'Error al reasignar el caso');
  }
}

// POST /api/bienestar/casos/:id/cerrar  body: { motivo_cierre_id, cierre_detalle? }
async function cerrar(req, res) {
  const id = parseInt(req.params.id);
  const motivoCierre = parseInt(req.body?.motivo_cierre_id);
  const detalleCierre = texto(req.body?.cierre_detalle);
  if (detalleCierre === null) return res.status(400).json({ error: 'Texto demasiado largo' });
  try {
    const caso = await casoAccesible(req, id);
    if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });
    if (!ABIERTOS.includes(caso.estado)) return res.status(409).json({ error: 'El caso ya está cerrado' });
    if (!(await catalogoValido(req.usuario.colegio_id, motivoCierre, 'motivo_cierre'))) {
      return res.status(400).json({ error: 'Selecciona el motivo de cierre' });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE bienestar_casos SET estado = 'cerrado', cerrado_en = NOW(), motivo_cierre_id = ?, cierre_detalle = ? WHERE id = ?`,
        [motivoCierre, cifrar(detalleCierre), id]
      );
      await conn.query(`UPDATE bienestar_remisiones SET estado = 'cerrada' WHERE caso_id = ? AND estado NOT IN ('archivada')`, [id]);
      await conn.query('UPDATE bienestar_caso_asignaciones SET hasta = NOW() WHERE caso_id = ? AND hasta IS NULL', [id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    registrarBienestar(req, 'caso_cerrado', 'caso', id, id);
    res.json({ mensaje: 'Caso cerrado' });
  } catch (err) {
    manejarError(res, err, 'Error al cerrar el caso');
  }
}

// POST /api/bienestar/casos/:id/reabrir — solo líder
async function reabrir(req, res) {
  const id = parseInt(req.params.id);
  try {
    const caso = await casoAccesible(req, id);
    if (!caso) return res.status(404).json({ error: 'Caso no encontrado' });
    if (caso.estado !== 'cerrado') return res.status(409).json({ error: 'Solo se puede reabrir un caso cerrado' });
    const [[otro]] = await db.query(
      `SELECT id FROM bienestar_casos WHERE estudiante_id = ? AND colegio_id = ? AND estado IN ('abierto','en_seguimiento') AND id <> ? LIMIT 1`,
      [caso.estudiante_id, caso.colegio_id, id]
    );
    if (otro) return res.status(409).json({ error: 'El estudiante ya tiene otro caso abierto', caso_id: otro.id });
    const responsable = caso.responsable_id && (await esMiembroEquipo(caso.colegio_id, caso.responsable_id)) ? caso.responsable_id : req.usuario.id;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`UPDATE bienestar_casos SET estado = 'en_seguimiento', cerrado_en = NULL, responsable_id = ? WHERE id = ?`, [responsable, id]);
      await conn.query('INSERT INTO bienestar_caso_asignaciones (caso_id, usuario_id, asignado_por) VALUES (?, ?, ?)', [id, responsable, req.usuario.id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    registrarBienestar(req, 'caso_reabierto', 'caso', id, id);
    res.json({ mensaje: 'Caso reabierto' });
  } catch (err) {
    manejarError(res, err, 'Error al reabrir el caso');
  }
}

// GET /api/bienestar/acompanamientos — director: SOLO estado, sin motivo ni contenido
async function estadoParaDirector(req, res) {
  try {
    const [filas] = await db.query(
      `SELECT c.id, c.estado, c.abierto_en, e.nombre AS estudiante, r.nombre AS responsable, ${SUBCONSULTA_GRUPO}
       FROM bienestar_casos c
       JOIN usuarios e ON e.id = c.estudiante_id
       LEFT JOIN usuarios r ON r.id = c.responsable_id
       WHERE c.colegio_id = ? AND c.estado IN ('abierto','en_seguimiento')
       ORDER BY c.abierto_en DESC`,
      [req.usuario.colegio_id]
    );
    registrarBienestar(req, 'acompanamientos_ver', 'caso');
    res.json({ data: filas.map(f => ({ ...f, estado: 'en_acompanamiento' })) });
  } catch (err) {
    manejarError(res, err, 'Error al obtener los acompañamientos');
  }
}

module.exports = {
  listar, abrir, vincularRemision, detalle, editar, reasignar, cerrar, reabrir, estadoParaDirector,
  puedeVerNotaPrivada, contextoEstudiante, ABIERTOS, manejarError, catalogoValido,
};
