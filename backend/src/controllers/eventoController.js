const db = require('../database');
const { obtenerAnioActivo } = require('../utils/anioLectivo');
const { obtenerGrados } = require('../utils/gradoAcademico');
const { registrarAuditoria } = require('../utils/auditoria');
const { CATEGORIAS_EVENTO, CATEGORIAS_VALIDAS, ROLES_EVENTO, ROLES_VALIDOS } = require('../utils/eventos');

// GET /api/eventos/opciones — catálogo de categorías y roles para el formulario
async function opciones(req, res) {
  try {
    const grados = await obtenerGrados(req.usuario.colegio_id);
    res.json({ data: { categorias: CATEGORIAS_EVENTO, roles: ROLES_EVENTO, grados } });
  } catch (err) {
    console.error('Error al obtener opciones de eventos:', err);
    res.status(500).json({ error: 'Error al obtener las opciones de la agenda' });
  }
}

// Grados del propio estudiante, o de todos los hijos vinculados si es padre.
// null = el filtro por grado no aplica a este rol (docente, director, admin).
async function obtenerGradosDelUsuario(usuario) {
  if (!['estudiante', 'padre'].includes(usuario.rol)) return null;
  const anioActivo = await obtenerAnioActivo(usuario.colegio_id);

  if (usuario.rol === 'estudiante') {
    const [filas] = await db.query(
      `SELECT DISTINCT g.grado FROM estudiante_grupos eg
       JOIN grupos g ON g.id = eg.grupo_id
       WHERE eg.estudiante_id = ? AND g.ano_lectivo = ? AND g.activo = TRUE`,
      [usuario.id, anioActivo.anio]
    );
    return filas.map(f => f.grado);
  }

  if (usuario.rol === 'padre') {
    const [filas] = await db.query(
      `SELECT DISTINCT g.grado
       FROM padre_estudiante pe
       JOIN estudiante_grupos eg ON eg.estudiante_id = pe.estudiante_id
       JOIN grupos g ON g.id = eg.grupo_id
       WHERE pe.padre_id = ? AND g.ano_lectivo = ? AND g.activo = TRUE`,
      [usuario.id, anioActivo.anio]
    );
    return filas.map(f => f.grado);
  }

  return null;
}

// Las columnas JSON pueden llegar ya parseadas (objeto/array) o como texto,
// según la versión de mysql2/MySQL — nunca asumir una sola forma.
function parsearJSON(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  try {
    const parsed = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function adjuntarFechas(eventos) {
  if (eventos.length === 0) return eventos;
  const ids = eventos.map(e => e.id);
  const [fechas] = await db.query(
    `SELECT evento_id, fecha, hora_inicio, hora_fin, lugar
     FROM eventos_institucionales_fechas
     WHERE evento_id IN (${ids.map(() => '?').join(',')})
     ORDER BY fecha ASC`,
    ids
  );
  const porEvento = {};
  for (const f of fechas) {
    (porEvento[f.evento_id] = porEvento[f.evento_id] || []).push(f);
  }
  return eventos.map(e => ({ ...e, fechas: porEvento[e.id] || [] }));
}

// GET /api/eventos?gestion=1 — gestion=1 (solo admin/director) trae todos los
// eventos del colegio sin filtrar por audiencia, para la pantalla de edición.
// Sin ese parámetro, cada quien ve solo lo que le corresponde.
async function listar(req, res) {
  const usuario = req.usuario;
  const gestion = req.query.gestion === '1' && ['admin', 'director'].includes(usuario.rol);

  try {
    const [filas] = await db.query(
      `SELECT * FROM eventos_institucionales WHERE colegio_id = ? AND activo = TRUE ORDER BY creado_en DESC`,
      [usuario.colegio_id]
    );

    // dirigido_roles/dirigido_grados son columnas JSON, pero mysql2 no
    // siempre las entrega ya convertidas a arreglo — se normalizan aquí
    // antes de filtrar o de mandarlas al frontend (que sí espera arreglos).
    const eventos = filas.map(e => ({
      ...e,
      dirigido_roles: parsearJSON(e.dirigido_roles),
      dirigido_grados: parsearJSON(e.dirigido_grados),
    }));

    let visibles = eventos;
    if (!gestion) {
      const gradosUsuario = await obtenerGradosDelUsuario(usuario);
      visibles = eventos.filter(e => {
        const roles = e.dirigido_roles;
        if (roles.length > 0 && !roles.includes(usuario.rol) && !(usuario.cargo && roles.includes(usuario.cargo))) return false;

        const grados = e.dirigido_grados;
        if (grados.length > 0 && gradosUsuario !== null) {
          return gradosUsuario.some(g => grados.includes(g));
        }
        return true;
      });
    }

    const conFechas = await adjuntarFechas(visibles);
    res.json({ data: conFechas });
  } catch (err) {
    console.error('Error al listar eventos institucionales:', err);
    res.status(500).json({ error: 'Error al obtener la agenda institucional' });
  }
}

function validarFechas(fechas) {
  if (!Array.isArray(fechas) || fechas.length === 0) return 'El evento necesita al menos una fecha';
  for (const f of fechas) {
    if (!f.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) return 'Una de las fechas no es válida';
  }
  return null;
}

// POST /api/eventos — admin/director
async function crear(req, res) {
  const { titulo, categoria, detalle, dirigido_roles, dirigido_grados, fechas } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
  if (!CATEGORIAS_VALIDAS.includes(categoria)) return res.status(400).json({ error: 'Categoría inválida' });
  const roles = Array.isArray(dirigido_roles) ? dirigido_roles.filter(r => ROLES_VALIDOS.includes(r)) : [];
  const grados = Array.isArray(dirigido_grados) ? dirigido_grados : [];
  const errorFechas = validarFechas(fechas);
  if (errorFechas) return res.status(400).json({ error: errorFechas });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO eventos_institucionales
         (colegio_id, titulo, categoria, detalle, dirigido_roles, dirigido_grados, creado_por, creado_por_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [colegio_id, titulo.trim(), categoria, detalle || null, JSON.stringify(roles), JSON.stringify(grados), req.usuario.id, req.usuario.nombre]
    );
    const eventoId = result.insertId;

    for (const f of fechas) {
      await conn.query(
        `INSERT INTO eventos_institucionales_fechas (evento_id, fecha, hora_inicio, hora_fin, lugar) VALUES (?, ?, ?, ?, ?)`,
        [eventoId, f.fecha, f.hora_inicio || null, f.hora_fin || null, f.lugar || null]
      );
    }

    await conn.commit();

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'evento_institucional_creado', entidad: 'evento_institucional', entidad_id: eventoId,
      detalle: { titulo: titulo.trim(), categoria },
    });

    res.status(201).json({ mensaje: 'Evento creado', data: { id: eventoId } });
  } catch (err) {
    await conn.rollback();
    console.error('Error al crear evento institucional:', err);
    res.status(500).json({ error: 'Error al crear el evento' });
  } finally {
    conn.release();
  }
}

// PUT /api/eventos/:id — admin/director, solo del propio colegio
async function actualizar(req, res) {
  const { id } = req.params;
  const { titulo, categoria, detalle, dirigido_roles, dirigido_grados, fechas } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
  if (!CATEGORIAS_VALIDAS.includes(categoria)) return res.status(400).json({ error: 'Categoría inválida' });
  const roles = Array.isArray(dirigido_roles) ? dirigido_roles.filter(r => ROLES_VALIDOS.includes(r)) : [];
  const grados = Array.isArray(dirigido_grados) ? dirigido_grados : [];
  const errorFechas = validarFechas(fechas);
  if (errorFechas) return res.status(400).json({ error: errorFechas });

  const conn = await db.getConnection();
  try {
    const [[evento]] = await conn.query(
      'SELECT id FROM eventos_institucionales WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

    await conn.beginTransaction();

    await conn.query(
      `UPDATE eventos_institucionales
       SET titulo = ?, categoria = ?, detalle = ?, dirigido_roles = ?, dirigido_grados = ?
       WHERE id = ?`,
      [titulo.trim(), categoria, detalle || null, JSON.stringify(roles), JSON.stringify(grados), id]
    );

    await conn.query('DELETE FROM eventos_institucionales_fechas WHERE evento_id = ?', [id]);
    for (const f of fechas) {
      await conn.query(
        `INSERT INTO eventos_institucionales_fechas (evento_id, fecha, hora_inicio, hora_fin, lugar) VALUES (?, ?, ?, ?, ?)`,
        [id, f.fecha, f.hora_inicio || null, f.hora_fin || null, f.lugar || null]
      );
    }

    await conn.commit();

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'evento_institucional_editado', entidad: 'evento_institucional', entidad_id: parseInt(id),
      detalle: { titulo: titulo.trim(), categoria },
    });

    res.json({ mensaje: 'Evento actualizado' });
  } catch (err) {
    await conn.rollback();
    console.error('Error al actualizar evento institucional:', err);
    res.status(500).json({ error: 'Error al actualizar el evento' });
  } finally {
    conn.release();
  }
}

// DELETE /api/eventos/:id — admin/director, solo del propio colegio (borrado suave)
async function eliminar(req, res) {
  const { id } = req.params;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [[evento]] = await db.query(
      'SELECT id, titulo FROM eventos_institucionales WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

    await db.query('UPDATE eventos_institucionales SET activo = FALSE WHERE id = ?', [id]);

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'evento_institucional_eliminado', entidad: 'evento_institucional', entidad_id: parseInt(id),
      detalle: { titulo: evento.titulo },
    });

    res.json({ mensaje: 'Evento eliminado' });
  } catch (err) {
    console.error('Error al eliminar evento institucional:', err);
    res.status(500).json({ error: 'Error al eliminar el evento' });
  }
}

module.exports = { opciones, listar, crear, actualizar, eliminar };
