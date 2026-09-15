const db = require('../database');
const { registrarAuditoria } = require('../utils/auditoria');

// POST /api/calificaciones-historicas/importar
// body: { filas: [{ numero_documento, materia_nombre, ano_lectivo, periodo, nota }] }
async function importar(req, res) {
  const { filas } = req.body;
  const colegioId = req.usuario.colegio_id;

  if (!Array.isArray(filas) || filas.length === 0) {
    return res.status(400).json({ error: 'No se recibieron filas para importar' });
  }

  const conn = await db.getConnection();
  const creados = [];
  const errores = [];

  try {
    await conn.beginTransaction();

    for (const [i, fila] of filas.entries()) {
      const numFila = i + 2; // fila 1 es el encabezado del Excel
      try {
        const numeroDocumento = String(fila.numero_documento || '').trim();
        const materiaNombre = String(fila.materia_nombre || '').trim();
        const anoLectivo = parseInt(fila.ano_lectivo);
        const periodo = parseInt(fila.periodo);
        const nota = parseFloat(fila.nota);

        if (!numeroDocumento) { errores.push({ fila: numFila, error: 'Falta el número de documento' }); continue; }
        if (!materiaNombre)   { errores.push({ fila: numFila, error: 'Falta el nombre de la materia' }); continue; }
        if (!anoLectivo || anoLectivo < 2000 || anoLectivo > 2100) {
          errores.push({ fila: numFila, error: 'Año lectivo inválido' }); continue;
        }
        if (![1, 2, 3].includes(periodo)) {
          errores.push({ fila: numFila, error: 'El período debe ser 1, 2 o 3' }); continue;
        }
        if (isNaN(nota) || nota < 1.0 || nota > 5.0) {
          errores.push({ fila: numFila, error: 'La nota debe estar entre 1.0 y 5.0' }); continue;
        }

        const [[estudiante]] = await conn.query(
          `SELECT id, nombre FROM usuarios
           WHERE numero_documento = ? AND colegio_id = ? AND rol = 'estudiante'`,
          [numeroDocumento, colegioId]
        );
        if (!estudiante) {
          errores.push({ fila: numFila, error: `No existe un estudiante con documento ${numeroDocumento} en este colegio` });
          continue;
        }

        await conn.query(
          `INSERT INTO calificaciones_historicas
             (colegio_id, estudiante_id, ano_lectivo, periodo, materia_nombre, nota, importado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [colegioId, estudiante.id, anoLectivo, periodo, materiaNombre, parseFloat(nota.toFixed(1)), req.usuario.id]
        );
        creados.push({ fila: numFila, estudiante: estudiante.nombre, materia: materiaNombre });
      } catch (e) {
        errores.push({ fila: numFila, error: e.message });
      }
    }

    await conn.commit();

    registrarAuditoria({
      colegio_id: colegioId, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'historico_importado', entidad: 'calificacion_historica',
      detalle: { filas_recibidas: filas.length, importadas: creados.length, con_error: errores.length },
    });

    res.json({ mensaje: `${creados.length} notas históricas importadas`, creados, errores });
  } catch (err) {
    await conn.rollback();
    console.error('Error al importar histórico:', err);
    res.status(500).json({ error: 'Error en la importación del histórico' });
  } finally {
    conn.release();
  }
}

// GET /api/calificaciones-historicas/estudiante/:id
async function listarPorEstudiante(req, res) {
  const { id } = req.params;
  try {
    const [[estudiante]] = await db.query(
      'SELECT colegio_id FROM usuarios WHERE id = ? AND rol = "estudiante"',
      [id]
    );
    if (!estudiante || estudiante.colegio_id !== req.usuario.colegio_id) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const [filas] = await db.query(
      `SELECT ano_lectivo, periodo, materia_nombre, nota
       FROM calificaciones_historicas
       WHERE estudiante_id = ?
       ORDER BY ano_lectivo DESC, periodo ASC, materia_nombre ASC`,
      [id]
    );
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar histórico:', err);
    res.status(500).json({ error: 'Error al obtener el histórico' });
  }
}

module.exports = { importar, listarPorEstudiante };
