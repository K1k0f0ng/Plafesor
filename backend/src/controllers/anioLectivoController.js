const db = require('../database');
const { obtenerAnioActivo } = require('../utils/anioLectivo');
const { obtenerGrados } = require('../utils/gradoAcademico');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/anios-lectivos/activo
async function activo(req, res) {
  try {
    const anio = await obtenerAnioActivo(req.usuario.colegio_id);
    res.json({ data: anio });
  } catch (err) {
    console.error('Error al obtener el año lectivo activo:', err);
    res.status(500).json({ error: 'Error al obtener el año lectivo activo' });
  }
}

// GET /api/anios-lectivos/cierre/resumen
// Trae, para el año activo, cada grupo con su lista de estudiantes y el
// grado al que les tocaría pasar (o null si ya no hay un grado siguiente).
async function resumenCierre(req, res) {
  const colegio_id = req.usuario.colegio_id;
  try {
    const anioActivo = await obtenerAnioActivo(colegio_id);
    const catalogo = await obtenerGrados(colegio_id);
    const ordenPorCodigo = Object.fromEntries(catalogo.map(g => [g.codigo, g.orden]));
    const catalogoOrdenado = [...catalogo].sort((a, b) => a.orden - b.orden);

    const [grupos] = await db.query(
      `SELECT id, nombre, grado FROM grupos
       WHERE colegio_id = ? AND ano_lectivo = ? AND activo = TRUE
       ORDER BY nombre ASC`,
      [colegio_id, anioActivo.anio]
    );
    grupos.sort((a, b) => (ordenPorCodigo[a.grado] ?? 999) - (ordenPorCodigo[b.grado] ?? 999));

    for (const g of grupos) {
      const [estudiantes] = await db.query(
        `SELECT u.id, u.nombre
         FROM estudiante_grupos eg
         JOIN usuarios u ON u.id = eg.estudiante_id
         WHERE eg.grupo_id = ? AND u.activo = TRUE
         ORDER BY u.nombre ASC`,
        [g.id]
      );
      g.estudiantes = estudiantes;
      const idx = catalogoOrdenado.findIndex(c => c.codigo === g.grado);
      g.grado_siguiente = (idx === -1 || idx === catalogoOrdenado.length - 1) ? null : catalogoOrdenado[idx + 1].codigo;
    }

    res.json({ data: { anio: anioActivo, grupos } });
  } catch (err) {
    console.error('Error al preparar el cierre de año lectivo:', err);
    res.status(500).json({ error: 'Error al preparar el cierre de año lectivo' });
  }
}

// Crea o reutiliza el grupo destino según lo que decidió el director
async function resolverGrupoDestino(conn, colegio_id, anioSiguiente, destino) {
  if (!destino) return null;
  if (destino.modo === 'existente') {
    const [[g]] = await conn.query(
      'SELECT id FROM grupos WHERE id = ? AND colegio_id = ? AND ano_lectivo = ?',
      [destino.id, colegio_id, anioSiguiente]
    );
    if (!g) throw new Error(`El grupo destino seleccionado no existe en ${anioSiguiente}`);
    return g.id;
  }
  const gradosColegio = await obtenerGrados(colegio_id);
  if (!gradosColegio.some(g => g.codigo === String(destino.grado))) {
    throw new Error(`Grado inválido: ${destino.grado}`);
  }
  const [result] = await conn.query(
    'INSERT INTO grupos (nombre, grado, colegio_id, ano_lectivo) VALUES (?, ?, ?, ?)',
    [destino.nombre, destino.grado, colegio_id, anioSiguiente]
  );
  return result.insertId;
}

// POST /api/anios-lectivos/cierre
// body: { decisiones: [{ grupo_origen_id, destino_promovidos, destino_repitentes,
//                         estudiantes: [{ estudiante_id, accion }] }] }
// accion: 'promovido' | 'repite' | 'egresa'
async function ejecutarCierre(req, res) {
  const colegio_id = req.usuario.colegio_id;
  const { decisiones } = req.body;

  if (!Array.isArray(decisiones) || decisiones.length === 0) {
    return res.status(400).json({ error: 'No se recibieron decisiones de promoción' });
  }

  const conn = await db.getConnection();
  try {
    const anioActivo = await obtenerAnioActivo(colegio_id);
    const anioSiguiente = anioActivo.anio + 1;

    const [[yaExiste]] = await db.query(
      'SELECT id FROM anios_lectivos WHERE colegio_id = ? AND anio = ?',
      [colegio_id, anioSiguiente]
    );
    if (yaExiste) {
      return res.status(409).json({ error: `El año lectivo ${anioSiguiente} ya existe. El cierre ya se hizo antes.` });
    }

    await conn.beginTransaction();

    let totalPromovidos = 0, totalRepiten = 0, totalEgresan = 0;
    const gruposDestinoCache = {};
    const gruposOrigenCerrados = [];

    for (const decision of decisiones) {
      const { grupo_origen_id, destino_promovidos, destino_repitentes, estudiantes } = decision;
      if (!Array.isArray(estudiantes)) continue;

      const [[grupoOrigen]] = await conn.query(
        'SELECT id FROM grupos WHERE id = ? AND colegio_id = ? AND ano_lectivo = ?',
        [grupo_origen_id, colegio_id, anioActivo.anio]
      );
      if (!grupoOrigen) throw new Error(`El grupo de origen ${grupo_origen_id} no pertenece al año lectivo activo`);
      gruposOrigenCerrados.push(grupoOrigen.id);

      const cacheKeyProm = JSON.stringify(destino_promovidos);
      const cacheKeyRep = JSON.stringify(destino_repitentes);

      for (const est of estudiantes) {
        if (est.accion === 'egresa') {
          await conn.query('UPDATE usuarios SET activo = FALSE WHERE id = ? AND rol = "estudiante"', [est.estudiante_id]);
          totalEgresan++;
          continue;
        }

        let destino, cacheKey;
        if (est.accion === 'promovido') { destino = destino_promovidos; cacheKey = cacheKeyProm; }
        else if (est.accion === 'repite') { destino = destino_repitentes; cacheKey = cacheKeyRep; }
        else continue;

        if (!destino) throw new Error(`Falta el grupo destino para el estudiante ${est.estudiante_id} (${est.accion})`);

        if (!gruposDestinoCache[cacheKey]) {
          gruposDestinoCache[cacheKey] = await resolverGrupoDestino(conn, colegio_id, anioSiguiente, destino);
        }
        const grupoDestinoId = gruposDestinoCache[cacheKey];

        await conn.query(
          'INSERT IGNORE INTO estudiante_grupos (estudiante_id, grupo_id) VALUES (?, ?)',
          [est.estudiante_id, grupoDestinoId]
        );
        if (est.accion === 'promovido') totalPromovidos++; else totalRepiten++;
      }
    }

    // Los grupos del año que se cierra dejan de estar "activos" para que no
    // se sigan mostrando junto con los del año nuevo en paneles y reportes
    // (su historial de actividades y notas queda intacto, solo se ocultan
    // de las vistas del año en curso).
    if (gruposOrigenCerrados.length > 0) {
      await conn.query(
        `UPDATE grupos SET activo = FALSE WHERE id IN (${gruposOrigenCerrados.map(() => '?').join(',')})`,
        gruposOrigenCerrados
      );
    }

    await conn.query(
      "INSERT INTO anios_lectivos (colegio_id, anio, estado) VALUES (?, ?, 'activo')",
      [colegio_id, anioSiguiente]
    );
    await conn.query(
      "UPDATE anios_lectivos SET estado = 'cerrado', cerrado_en = NOW(), cerrado_por = ? WHERE id = ?",
      [req.usuario.id, anioActivo.id]
    );

    await conn.commit();

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'anio_lectivo_cerrado', entidad: 'anio_lectivo', entidad_id: anioActivo.id,
      detalle: {
        anio_cerrado: anioActivo.anio, anio_nuevo: anioSiguiente,
        promovidos: totalPromovidos, repiten: totalRepiten, egresan: totalEgresan,
      },
    });

    res.json({
      mensaje: `Año lectivo ${anioActivo.anio} cerrado. Año ${anioSiguiente} creado.`,
      data: { anio_cerrado: anioActivo.anio, anio_nuevo: anioSiguiente, promovidos: totalPromovidos, repiten: totalRepiten, egresan: totalEgresan },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Error al cerrar el año lectivo:', err);
    res.status(500).json({ error: err.message || 'Error al cerrar el año lectivo' });
  } finally {
    conn.release();
  }
}

module.exports = { activo, resumenCierre, ejecutarCierre };
