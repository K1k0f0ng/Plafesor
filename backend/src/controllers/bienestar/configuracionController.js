const db = require('../../database');
const { claveConfigurada } = require('../../utils/cifrado');
const { registrarBienestar } = require('../../utils/bienestarAuditoria');
const { sembrarCatalogos, TIPOS_CATALOGO } = require('../../utils/bienestarCatalogos');
const { puedeRemitir } = require('../../middlewares/bienestarAcceso');

// Valores por defecto cuando el colegio todavía no tiene fila de configuración.
// Todo apagado: privacidad por defecto.
const CONFIG_POR_DEFECTO = {
  activo: false, remiten: 'todos', devolucion_docente: false, lider_lee_privadas: false,
  portal_familia: false, adjuntos_remision: false, ia_activa: false,
};
const OPCIONES_BOOLEANAS = ['activo', 'devolucion_docente', 'lider_lee_privadas', 'portal_familia', 'adjuntos_remision', 'ia_activa'];

function aBool(v) { return v === true || v === 1 || v === '1'; }

function normalizarConfig(fila) {
  const base = { ...CONFIG_POR_DEFECTO, ...(fila || {}) };
  const salida = { remiten: base.remiten };
  OPCIONES_BOOLEANAS.forEach(k => { salida[k] = aBool(base[k]); });
  return salida;
}

// GET /api/bienestar/estado — lo consulta el menú de cualquier rol para saber
// qué mostrar. No expone nada sensible.
async function estado(req, res) {
  const { activo, nivel, config } = req.bienestar;
  const u = req.usuario;
  const cfg = normalizarConfig(config);
  let remite = false;
  try {
    remite = await puedeRemitir(req);
  } catch (err) {
    console.error('Bienestar: error al calcular estado:', err.message);
    return res.status(503).json({ error: 'No fue posible consultar el módulo' });
  }
  res.json({
    data: {
      activo,
      nivel,                       // null | 'lider' | 'profesional'
      es_equipo: u.rol === 'orientador' && !!nivel,
      puede_remitir: remite,
      adjuntos_remision: remite && cfg.adjuntos_remision,
      ia_activa: activo && cfg.ia_activa,
      // Opciones que cambian lo que ve el equipo de orientación
      ...(u.rol === 'orientador' && nivel ? { devolucion_docente: cfg.devolucion_docente } : {}),
      // Solo el admin necesita saber si falta la clave (para no poder activar)
      ...(u.rol === 'admin' ? { clave_configurada: claveConfigurada() } : {}),
    },
  });
}

// GET /api/bienestar/configuracion — admin
async function obtener(req, res) {
  const colegio_id = req.usuario.colegio_id;
  try {
    const [orientadores] = await db.query(
      `SELECT u.id, u.nombre, u.email, u.activo AS cuenta_activa,
              be.nivel, COALESCE(be.activo, FALSE) AS en_equipo
       FROM usuarios u
       LEFT JOIN bienestar_equipo be ON be.usuario_id = u.id AND be.colegio_id = u.colegio_id
       WHERE u.colegio_id = ? AND u.rol = 'orientador'
       ORDER BY u.nombre ASC`,
      [colegio_id]
    );
    res.json({
      data: {
        configuracion: normalizarConfig(req.bienestar.config),
        clave_configurada: claveConfigurada(),
        orientadores: orientadores.map(o => ({ ...o, en_equipo: aBool(o.en_equipo), cuenta_activa: aBool(o.cuenta_activa) })),
      },
    });
  } catch (err) {
    console.error('Bienestar: error al obtener configuración:', err.message);
    res.status(500).json({ error: 'Error al obtener la configuración' });
  }
}

// PUT /api/bienestar/configuracion — admin
async function guardar(req, res) {
  const colegio_id = req.usuario.colegio_id;
  const cuerpo = req.body || {};
  const nueva = normalizarConfig(req.bienestar.config);

  OPCIONES_BOOLEANAS.forEach(k => { if (k in cuerpo) nueva[k] = aBool(cuerpo[k]); });
  if ('remiten' in cuerpo) {
    if (!['todos', 'directores_grupo'].includes(cuerpo.remiten)) {
      return res.status(400).json({ error: 'Opción de remisión inválida' });
    }
    nueva.remiten = cuerpo.remiten;
  }

  // Sin clave de cifrado no se puede activar: no habría cómo guardar el texto sensible
  if (nueva.activo && !claveConfigurada()) {
    return res.status(409).json({ error: 'No se puede activar el módulo: falta configurar la clave de cifrado en el servidor.' });
  }
  if (nueva.activo) {
    try {
      const [[equipo]] = await db.query(
        'SELECT COUNT(*) AS n FROM bienestar_equipo WHERE colegio_id = ? AND activo = TRUE AND nivel = "lider"',
        [colegio_id]
      );
      if (!equipo.n) {
        return res.status(409).json({ error: 'Para activar el módulo agrega primero al menos un orientador líder al equipo.' });
      }
    } catch (err) {
      console.error('Bienestar: error al verificar equipo:', err.message);
      return res.status(500).json({ error: 'Error al guardar la configuración' });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO bienestar_configuracion
         (colegio_id, activo, remiten, devolucion_docente, lider_lee_privadas, portal_familia, adjuntos_remision, ia_activa, actualizado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE activo = VALUES(activo), remiten = VALUES(remiten),
         devolucion_docente = VALUES(devolucion_docente), lider_lee_privadas = VALUES(lider_lee_privadas),
         portal_familia = VALUES(portal_familia), adjuntos_remision = VALUES(adjuntos_remision),
         ia_activa = VALUES(ia_activa), actualizado_por = VALUES(actualizado_por)`,
      [colegio_id, nueva.activo, nueva.remiten, nueva.devolucion_docente, nueva.lider_lee_privadas,
        nueva.portal_familia, nueva.adjuntos_remision, nueva.ia_activa, req.usuario.id]
    );
    await sembrarCatalogos(colegio_id, conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('Bienestar: error al guardar configuración:', err.message);
    return res.status(500).json({ error: 'Error al guardar la configuración' });
  } finally {
    conn.release();
  }

  const antes = normalizarConfig(req.bienestar.config);
  const accion = antes.activo !== nueva.activo ? (nueva.activo ? 'modulo_activado' : 'modulo_desactivado') : 'configuracion_editada';
  registrarBienestar(req, accion, 'configuracion');
  res.json({ mensaje: 'Configuración guardada', data: nueva });
}

// PUT /api/bienestar/equipo — admin. body: { miembros: [{ usuario_id, en_equipo, nivel }] }
async function guardarEquipo(req, res) {
  const colegio_id = req.usuario.colegio_id;
  const miembros = req.body?.miembros;
  if (!Array.isArray(miembros)) return res.status(400).json({ error: 'Lista de miembros inválida' });
  if (miembros.some(m => !Number.isInteger(m.usuario_id) || !['lider', 'profesional'].includes(m.nivel))) {
    return res.status(400).json({ error: 'Cada miembro necesita usuario y nivel (líder o profesional)' });
  }

  try {
    // Solo cuentas con rol orientador de ESTE colegio
    const ids = miembros.map(m => m.usuario_id);
    if (ids.length) {
      const [validos] = await db.query(
        `SELECT id FROM usuarios WHERE colegio_id = ? AND rol = 'orientador' AND id IN (${ids.map(() => '?').join(',')})`,
        [colegio_id, ...ids]
      );
      if (validos.length !== new Set(ids).size) {
        return res.status(400).json({ error: 'Solo se pueden agregar cuentas con rol Orientador de tu colegio' });
      }
    }

    const activos = miembros.filter(m => aBool(m.en_equipo));
    // Con un solo orientador activo, ese es líder automáticamente
    if (activos.length === 1) activos[0].nivel = 'lider';
    // Si el módulo está activo, siempre debe quedar al menos un líder
    if (normalizarConfig(req.bienestar.config).activo && !activos.some(m => m.nivel === 'lider')) {
      return res.status(409).json({ error: 'El módulo está activo: debe quedar al menos un orientador líder.' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const m of miembros) {
        await conn.query(
          `INSERT INTO bienestar_equipo (usuario_id, colegio_id, nivel, activo) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE nivel = VALUES(nivel), activo = VALUES(activo)`,
          [m.usuario_id, colegio_id, m.nivel, aBool(m.en_equipo)]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    registrarBienestar(req, 'equipo_editado', 'equipo');
    res.json({ mensaje: 'Equipo de orientación actualizado' });
  } catch (err) {
    console.error('Bienestar: error al guardar equipo:', err.message);
    res.status(500).json({ error: 'Error al guardar el equipo' });
  }
}

// GET /api/bienestar/equipo/miembros — equipo: a quién se le puede asignar un caso
async function miembrosEquipo(req, res) {
  try {
    const [filas] = await db.query(
      `SELECT u.id, u.nombre, be.nivel FROM bienestar_equipo be
       JOIN usuarios u ON u.id = be.usuario_id AND u.activo = TRUE
       WHERE be.colegio_id = ? AND be.activo = TRUE ORDER BY u.nombre`,
      [req.usuario.colegio_id]
    );
    res.json({ data: filas });
  } catch (err) {
    console.error('Bienestar: error al listar el equipo:', err.message);
    res.status(500).json({ error: 'Error al obtener el equipo' });
  }
}

// GET /api/bienestar/catalogos?tipo=motivo_remision — admin o equipo.
// Los docentes también la necesitan para el formulario de remisión (solo activos).
async function listarCatalogos(req, res) {
  const { tipo } = req.query;
  if (tipo && !TIPOS_CATALOGO.includes(tipo)) return res.status(400).json({ error: 'Tipo de catálogo inválido' });
  const soloActivos = !(req.usuario.rol === 'admin' || req.bienestar.nivel);
  try {
    const [filas] = await db.query(
      `SELECT id, tipo, nombre, activo, orden FROM bienestar_catalogos
       WHERE colegio_id = ? ${tipo ? 'AND tipo = ?' : ''} ${soloActivos ? 'AND activo = TRUE' : ''}
       ORDER BY tipo, orden, nombre`,
      tipo ? [req.usuario.colegio_id, tipo] : [req.usuario.colegio_id]
    );
    res.json({ data: filas.map(f => ({ ...f, activo: aBool(f.activo) })) });
  } catch (err) {
    console.error('Bienestar: error al listar catálogos:', err.message);
    res.status(500).json({ error: 'Error al obtener los catálogos' });
  }
}

// POST /api/bienestar/catalogos — admin o líder. body: { tipo, nombre }
async function crearCatalogo(req, res) {
  const tipo = req.body?.tipo;
  const nombre = String(req.body?.nombre || '').trim();
  if (!TIPOS_CATALOGO.includes(tipo)) return res.status(400).json({ error: 'Tipo de catálogo inválido' });
  if (!nombre || nombre.length > 120) return res.status(400).json({ error: 'El nombre es obligatorio (máximo 120 caracteres)' });
  try {
    const [[{ maximo }]] = await db.query(
      'SELECT COALESCE(MAX(orden), 0) AS maximo FROM bienestar_catalogos WHERE colegio_id = ? AND tipo = ?',
      [req.usuario.colegio_id, tipo]
    );
    const [r] = await db.query(
      'INSERT INTO bienestar_catalogos (colegio_id, tipo, nombre, orden) VALUES (?, ?, ?, ?)',
      [req.usuario.colegio_id, tipo, nombre, maximo + 1]
    );
    registrarBienestar(req, 'catalogo_creado', 'catalogo', r.insertId);
    res.status(201).json({ data: { id: r.insertId, tipo, nombre, activo: true, orden: maximo + 1 } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe una opción con ese nombre' });
    console.error('Bienestar: error al crear catálogo:', err.message);
    res.status(500).json({ error: 'Error al crear la opción' });
  }
}

// PATCH /api/bienestar/catalogos/:id — admin o líder. body: { nombre?, activo? }
// No se borran: una opción ya usada en casos solo se desactiva.
async function editarCatalogo(req, res) {
  const id = parseInt(req.params.id);
  const cambios = [];
  const valores = [];
  if ('nombre' in (req.body || {})) {
    const nombre = String(req.body.nombre || '').trim();
    if (!nombre || nombre.length > 120) return res.status(400).json({ error: 'El nombre es obligatorio (máximo 120 caracteres)' });
    cambios.push('nombre = ?'); valores.push(nombre);
  }
  if ('activo' in (req.body || {})) { cambios.push('activo = ?'); valores.push(aBool(req.body.activo)); }
  if (!cambios.length) return res.status(400).json({ error: 'No hay cambios' });
  try {
    const [r] = await db.query(
      `UPDATE bienestar_catalogos SET ${cambios.join(', ')} WHERE id = ? AND colegio_id = ?`,
      [...valores, id, req.usuario.colegio_id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Opción no encontrada' });
    registrarBienestar(req, 'catalogo_editado', 'catalogo', id);
    res.json({ mensaje: 'Opción actualizada' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe una opción con ese nombre' });
    console.error('Bienestar: error al editar catálogo:', err.message);
    res.status(500).json({ error: 'Error al editar la opción' });
  }
}

// GET /api/bienestar/auditoria?pagina=1 — admin o líder. Nunca incluye contenido.
async function listarAuditoria(req, res) {
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const porPagina = 50;
  try {
    const [filas] = await db.query(
      `SELECT ba.id, ba.creado_en, ba.accion, ba.recurso, ba.recurso_id, ba.caso_id, ba.ip,
              ba.usuario_rol, u.nombre AS usuario_nombre
       FROM bienestar_auditoria ba
       LEFT JOIN usuarios u ON u.id = ba.usuario_id
       WHERE ba.colegio_id = ?
       ORDER BY ba.creado_en DESC, ba.id DESC
       LIMIT ? OFFSET ?`,
      [req.usuario.colegio_id, porPagina, (pagina - 1) * porPagina]
    );
    registrarBienestar(req, 'bitacora_ver', 'auditoria');
    res.json({ data: filas, pagina, por_pagina: porPagina });
  } catch (err) {
    console.error('Bienestar: error al listar bitácora:', err.message);
    res.status(500).json({ error: 'Error al obtener la bitácora' });
  }
}

module.exports = {
  estado, obtener, guardar, guardarEquipo, miembrosEquipo,
  listarCatalogos, crearCatalogo, editarCatalogo, listarAuditoria,
  normalizarConfig,
};
