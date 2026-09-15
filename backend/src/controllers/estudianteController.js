const bcrypt = require('bcryptjs');
const db = require('../database');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { ordenApellido } = require('../utils/ordenNombre');
const { registrarAuditoria } = require('../utils/auditoria');
const { obtenerAnioActivo } = require('../utils/anioLectivo');
const { obtenerMotivos } = require('../utils/motivoRetiro');

const uploadsDirEstudiantes = path.join(__dirname, '../../uploads/estudiantes');
if (!fs.existsSync(uploadsDirEstudiantes)) fs.mkdirSync(uploadsDirEstudiantes, { recursive: true });

const uploadFoto = multer({
  storage: multer.diskStorage({
    destination: uploadsDirEstudiantes,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `estudiante_${req.params.id}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  },
}).single('foto');

// Cargue masivo de fotos: cada archivo se relaciona con un estudiante por su
// número de documento en el nombre (ej. "1098765432.jpg") — se guarda en
// memoria primero porque el nombre final del archivo en disco depende del
// id del estudiante que se resuelva después de emparejar.
const uploadFotosMasivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 200 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  },
}).array('fotos', 200);

// Estos endpoints reciben JSON directamente (no solo desde el formulario ni
// desde la plantilla Excel, que ya normalizan), así que se valida de nuevo
// aquí: un valor fuera del ENUM no debe tumbar la fila entera con un error
// críptico de MySQL — simplemente se guarda como vacío.
const TIPOS_DOC_VALIDOS = ['RC', 'TI', 'CC', 'CE'];
const GENEROS_VALIDOS = ['M', 'F', 'Otro'];

function normalizarTipoDocumento(v) {
  if (!v) return null;
  const up = String(v).trim().toUpperCase();
  return TIPOS_DOC_VALIDOS.includes(up) ? up : null;
}
function normalizarGenero(v) {
  return GENEROS_VALIDOS.includes(v) ? v : null;
}
function normalizarFecha(v) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? v : null;
}

// Inserta o actualiza los datos de matrícula (identificación, demográficos,
// poblacionales) de un estudiante. Todos los campos son opcionales.
async function guardarDatosEstudiante(conn, estudianteId, datos) {
  const {
    fecha_nacimiento, lugar_nacimiento, genero, grupo_sanguineo, direccion, eps_sisben,
    discapacidad, grupo_etnico, victima_conflicto,
    codigo_matricula, lugar_expedicion_documento, barrio, ciudad, comuna, telefono, celular,
    estudiante_nuevo, colegio_procedencia, anio_procedencia,
  } = datos;

  await conn.query(
    `INSERT INTO estudiantes_datos
       (estudiante_id, fecha_nacimiento, lugar_nacimiento, genero, grupo_sanguineo, direccion, eps_sisben, discapacidad, grupo_etnico, victima_conflicto,
        codigo_matricula, lugar_expedicion_documento, barrio, ciudad, comuna, telefono, celular, estudiante_nuevo, colegio_procedencia, anio_procedencia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       fecha_nacimiento = VALUES(fecha_nacimiento), lugar_nacimiento = VALUES(lugar_nacimiento),
       genero = VALUES(genero), grupo_sanguineo = VALUES(grupo_sanguineo),
       direccion = VALUES(direccion), eps_sisben = VALUES(eps_sisben),
       discapacidad = VALUES(discapacidad), grupo_etnico = VALUES(grupo_etnico),
       victima_conflicto = VALUES(victima_conflicto),
       codigo_matricula = VALUES(codigo_matricula), lugar_expedicion_documento = VALUES(lugar_expedicion_documento),
       barrio = VALUES(barrio), ciudad = VALUES(ciudad), comuna = VALUES(comuna),
       telefono = VALUES(telefono), celular = VALUES(celular), estudiante_nuevo = VALUES(estudiante_nuevo),
       colegio_procedencia = VALUES(colegio_procedencia), anio_procedencia = VALUES(anio_procedencia)`,
    [
      estudianteId, normalizarFecha(fecha_nacimiento), lugar_nacimiento || null, normalizarGenero(genero), grupo_sanguineo || null,
      direccion || null, eps_sisben || null, discapacidad || null, grupo_etnico || null, !!victima_conflicto,
      codigo_matricula || null, lugar_expedicion_documento || null, barrio || null, ciudad || null, comuna || null,
      telefono || null, celular || null, estudiante_nuevo !== false, colegio_procedencia || null, anio_procedencia || null,
    ]
  );
}

// Crea (o reutiliza, si el correo ya pertenece a un padre existente) la
// cuenta del acudiente y la vincula al estudiante. Lanza un error con
// `codigoPersonalizado` para que el llamador lo distinga de un fallo genérico.
async function vincularAcudiente(conn, acudiente, estudianteId, colegioId) {
  const { nombre, email, password, parentesco, tipo_documento, numero_documento } = acudiente;
  if (!email) return null;

  const [[existente]] = await conn.query('SELECT id, rol FROM usuarios WHERE email = ?', [email]);
  let padreId;

  if (existente) {
    if (existente.rol !== 'padre') {
      const err = new Error(`El correo del acudiente (${email}) ya está en uso por otro usuario`);
      err.codigoPersonalizado = 'ACUDIENTE_EMAIL_EN_USO';
      throw err;
    }
    padreId = existente.id;
  } else {
    if (!nombre || !password) {
      const err = new Error('Nombre y contraseña del acudiente son obligatorios para crear su cuenta');
      err.codigoPersonalizado = 'ACUDIENTE_DATOS_INCOMPLETOS';
      throw err;
    }
    const hash = await bcrypt.hash(String(password), 10);
    const [result] = await conn.query(
      'INSERT INTO usuarios (nombre, email, password, rol, colegio_id, tipo_documento, numero_documento) VALUES (?, ?, ?, "padre", ?, ?, ?)',
      [nombre, email, hash, colegioId || null, normalizarTipoDocumento(tipo_documento), numero_documento || null]
    );
    padreId = result.insertId;
  }

  await conn.query(
    'INSERT IGNORE INTO padre_estudiante (padre_id, estudiante_id, parentesco) VALUES (?, ?, ?)',
    [padreId, estudianteId, parentesco || null]
  );
  return padreId;
}

// GET /api/estudiantes?grupo_id=X — solo los del colegio del admin
async function listar(req, res) {
  const { grupo_id } = req.query;
  try {
    let sql = `
      SELECT u.id, u.nombre, u.email, u.activo, u.colegio_id, u.foto_url,
             u.telefono_padres, u.requiere_piar, u.tipo_documento, u.numero_documento,
             eg.grupo_id,
             g.nombre AS nombre_grupo, g.grado,
             ed.fecha_nacimiento, ed.lugar_nacimiento, ed.genero, ed.grupo_sanguineo,
             ed.direccion, ed.eps_sisben, ed.discapacidad, ed.grupo_etnico, ed.victima_conflicto,
             ed.codigo_matricula, ed.lugar_expedicion_documento, ed.barrio, ed.ciudad, ed.comuna,
             ed.telefono, ed.celular, ed.estudiante_nuevo, ed.colegio_procedencia, ed.anio_procedencia,
             (
               SELECT GROUP_CONCAT(p.nombre SEPARATOR ', ')
               FROM padre_estudiante pe JOIN usuarios p ON p.id = pe.padre_id
               WHERE pe.estudiante_id = u.id
             ) AS acudientes
      FROM usuarios u
      LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
      LEFT JOIN grupos g ON g.id = eg.grupo_id
      LEFT JOIN estudiantes_datos ed ON ed.estudiante_id = u.id
      WHERE u.rol = 'estudiante'
        AND (u.colegio_id = ? OR g.colegio_id = ?)
    `;
    const params = [req.usuario.colegio_id, req.usuario.colegio_id];
    if (grupo_id) {
      sql += ' AND eg.grupo_id = ?';
      params.push(grupo_id);
    }
    sql += ` ORDER BY ${ordenApellido('u.nombre')} ASC`;

    const [filas] = await db.query(sql, params);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar estudiantes:', err);
    res.status(500).json({ error: 'Error al obtener los estudiantes' });
  }
}

// POST /api/estudiantes — colegio_id viene del JWT
async function crear(req, res) {
  const {
    nombre, email, password, grupo_id, telefono_padres, requiere_piar,
    tipo_documento, numero_documento,
    fecha_nacimiento, lugar_nacimiento, genero, grupo_sanguineo, direccion, eps_sisben,
    discapacidad, grupo_etnico, victima_conflicto,
    codigo_matricula, lugar_expedicion_documento, barrio, ciudad, comuna, telefono, celular,
    estudiante_nuevo, colegio_procedencia, anio_procedencia,
    acudiente_nombre, acudiente_email, acudiente_password, acudiente_parentesco,
    acudiente_tipo_documento, acudiente_numero_documento,
  } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      `INSERT INTO usuarios (nombre, email, password, rol, colegio_id, telefono_padres, requiere_piar, tipo_documento, numero_documento)
       VALUES (?, ?, ?, "estudiante", ?, ?, ?, ?, ?)`,
      [nombre, email, hash, colegio_id || null, telefono_padres || null, !!requiere_piar, normalizarTipoDocumento(tipo_documento), numero_documento || null]
    );

    const estudianteId = result.insertId;

    if (grupo_id) {
      await conn.query(
        'INSERT INTO estudiante_grupos (estudiante_id, grupo_id) VALUES (?, ?)',
        [estudianteId, grupo_id]
      );
    }

    await guardarDatosEstudiante(conn, estudianteId, {
      fecha_nacimiento, lugar_nacimiento, genero, grupo_sanguineo, direccion, eps_sisben,
      discapacidad, grupo_etnico, victima_conflicto,
      codigo_matricula, lugar_expedicion_documento, barrio, ciudad, comuna, telefono, celular,
      estudiante_nuevo, colegio_procedencia, anio_procedencia,
    });

    if (acudiente_email) {
      await vincularAcudiente(conn, {
        nombre: acudiente_nombre, email: acudiente_email, password: acudiente_password,
        parentesco: acudiente_parentesco, tipo_documento: acudiente_tipo_documento, numero_documento: acudiente_numero_documento,
      }, estudianteId, colegio_id);
    }

    await conn.commit();

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'estudiante_creado', entidad: 'estudiante', entidad_id: estudianteId,
      detalle: { nombre, email },
    });

    res.status(201).json({ mensaje: 'Estudiante creado', data: { id: estudianteId, nombre, email } });
  } catch (err) {
    await conn.rollback();
    if (err.codigoPersonalizado) {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error al crear estudiante:', err);
    res.status(500).json({ error: 'Error al crear el estudiante' });
  } finally {
    conn.release();
  }
}

// POST /api/estudiantes/importar — importación masiva (plantilla Excel)
async function importar(req, res) {
  const { estudiantes } = req.body; // array de objetos

  if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de estudiantes' });
  }

  const conn = await db.getConnection();
  const creados = [];
  const errores = [];
  const avisos = [];

  try {
    await conn.beginTransaction();

    for (const est of estudiantes) {
      try {
        if (!est.password || String(est.password).trim().length < 6) {
          errores.push({ email: est.email, error: 'Contraseña requerida (mínimo 6 caracteres)' });
          continue;
        }
        const hash = await bcrypt.hash(String(est.password), 10);
        const [result] = await conn.query(
          `INSERT INTO usuarios (nombre, email, password, rol, colegio_id, telefono_padres, requiere_piar, tipo_documento, numero_documento)
           VALUES (?, ?, ?, "estudiante", ?, ?, ?, ?, ?)`,
          [
            est.nombre, est.email, hash, req.usuario.colegio_id || null,
            est.telefono_padres || null, !!est.requiere_piar,
            normalizarTipoDocumento(est.tipo_documento), est.numero_documento || null,
          ]
        );
        const estudianteId = result.insertId;

        if (est.grupo_id) {
          await conn.query(
            'INSERT INTO estudiante_grupos (estudiante_id, grupo_id) VALUES (?, ?)',
            [estudianteId, est.grupo_id]
          );
        }

        await guardarDatosEstudiante(conn, estudianteId, {
          fecha_nacimiento: est.fecha_nacimiento, lugar_nacimiento: est.lugar_nacimiento,
          genero: est.genero, grupo_sanguineo: est.grupo_sanguineo,
          direccion: est.direccion, eps_sisben: est.eps_sisben,
          discapacidad: est.discapacidad, grupo_etnico: est.grupo_etnico,
          victima_conflicto: est.victima_conflicto,
          codigo_matricula: est.codigo_matricula, lugar_expedicion_documento: est.lugar_expedicion_documento,
          barrio: est.barrio, ciudad: est.ciudad, comuna: est.comuna,
          telefono: est.telefono, celular: est.celular, estudiante_nuevo: est.estudiante_nuevo,
          colegio_procedencia: est.colegio_procedencia, anio_procedencia: est.anio_procedencia,
        });

        if (est.acudiente_email) {
          try {
            await vincularAcudiente(conn, {
              nombre: est.acudiente_nombre, email: est.acudiente_email, password: est.acudiente_password,
              parentesco: est.acudiente_parentesco, tipo_documento: est.acudiente_tipo_documento,
              numero_documento: est.acudiente_numero_documento,
            }, estudianteId, req.usuario.colegio_id);
          } catch (eAcudiente) {
            avisos.push({ email: est.email, aviso: `Estudiante creado, pero no se pudo vincular al acudiente: ${eAcudiente.message}` });
          }
        }

        creados.push(est.email);
      } catch (e) {
        errores.push({ email: est.email, error: e.code === 'ER_DUP_ENTRY' ? 'Email duplicado' : e.message });
      }
    }

    await conn.commit();
    res.json({ mensaje: `${creados.length} estudiantes importados`, creados, errores, avisos });
  } catch (err) {
    await conn.rollback();
    console.error('Error en importación:', err);
    res.status(500).json({ error: 'Error en la importación masiva' });
  } finally {
    conn.release();
  }
}

// PUT /api/estudiantes/:id — colegio_id viene del JWT
async function actualizar(req, res) {
  const { id } = req.params;
  const {
    nombre, email, grupo_id, telefono_padres, requiere_piar,
    tipo_documento, numero_documento,
    fecha_nacimiento, lugar_nacimiento, genero, grupo_sanguineo, direccion, eps_sisben,
    discapacidad, grupo_etnico, victima_conflicto,
    codigo_matricula, lugar_expedicion_documento, barrio, ciudad, comuna, telefono, celular,
    estudiante_nuevo, colegio_procedencia, anio_procedencia,
    acudiente_nombre, acudiente_email, acudiente_password, acudiente_parentesco,
    acudiente_tipo_documento, acudiente_numero_documento,
  } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombre || !email) {
    return res.status(400).json({ error: 'Nombre y email son obligatorios' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE usuarios SET nombre = ?, email = ?, colegio_id = ?, telefono_padres = ?, requiere_piar = ?, tipo_documento = ?, numero_documento = ?
       WHERE id = ? AND rol = 'estudiante'`,
      [nombre, email, colegio_id || null, telefono_padres || null, !!requiere_piar, normalizarTipoDocumento(tipo_documento), numero_documento || null, id]
    );

    // Reasignar grupo — solo se quita la membresía del año lectivo activo,
    // nunca la de años anteriores (eso destruiría el historial académico
    // que necesitan los boletines y el cierre de año lectivo).
    const anioActivo = await obtenerAnioActivo(colegio_id);
    await conn.query(
      `DELETE eg FROM estudiante_grupos eg
       JOIN grupos g ON g.id = eg.grupo_id
       WHERE eg.estudiante_id = ? AND g.ano_lectivo = ?`,
      [id, anioActivo.anio]
    );
    if (grupo_id) {
      await conn.query(
        'INSERT INTO estudiante_grupos (estudiante_id, grupo_id) VALUES (?, ?)',
        [id, grupo_id]
      );
    }

    await guardarDatosEstudiante(conn, id, {
      fecha_nacimiento, lugar_nacimiento, genero, grupo_sanguineo, direccion, eps_sisben,
      discapacidad, grupo_etnico, victima_conflicto,
      codigo_matricula, lugar_expedicion_documento, barrio, ciudad, comuna, telefono, celular,
      estudiante_nuevo, colegio_procedencia, anio_procedencia,
    });

    if (acudiente_email) {
      await vincularAcudiente(conn, {
        nombre: acudiente_nombre, email: acudiente_email, password: acudiente_password,
        parentesco: acudiente_parentesco, tipo_documento: acudiente_tipo_documento, numero_documento: acudiente_numero_documento,
      }, id, colegio_id);
    }

    await conn.commit();

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'estudiante_editado', entidad: 'estudiante', entidad_id: parseInt(id),
      detalle: { nombre, email },
    });

    res.json({ mensaje: 'Estudiante actualizado' });
  } catch (err) {
    await conn.rollback();
    if (err.codigoPersonalizado) {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error al actualizar estudiante:', err);
    res.status(500).json({ error: 'Error al actualizar el estudiante' });
  } finally {
    conn.release();
  }
}

// DELETE /api/estudiantes/:id (desactiva) — body opcional: { motivo_id, detalle }
async function eliminar(req, res) {
  const { id } = req.params;
  const { motivo_id, detalle } = req.body || {};
  const colegio_id = req.usuario.colegio_id;
  try {
    const [[est]] = await db.query('SELECT nombre, colegio_id FROM usuarios WHERE id = ? AND rol = "estudiante"', [id]);

    let motivoValido = null;
    if (motivo_id) {
      const catalogo = await obtenerMotivos(colegio_id);
      motivoValido = catalogo.find(m => m.id === parseInt(motivo_id)) || null;
      if (!motivoValido) {
        return res.status(400).json({ error: 'El motivo de retiro seleccionado no existe en el catálogo del colegio' });
      }
    }

    await db.query(
      `UPDATE usuarios SET activo = FALSE, motivo_retiro_id = ?, motivo_retiro_detalle = ?, retirado_en = NOW()
       WHERE id = ? AND rol = "estudiante"`,
      [motivoValido ? motivoValido.id : null, (detalle || '').trim() || null, id]
    );

    if (est) {
      registrarAuditoria({
        colegio_id: est.colegio_id || colegio_id, usuario_id: req.usuario.id,
        usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
        accion: 'estudiante_retirado', entidad: 'estudiante', entidad_id: parseInt(id),
        detalle: { nombre: est.nombre, motivo: motivoValido ? motivoValido.nombre : null, detalle: (detalle || '').trim() || null },
      });
    }

    res.json({ mensaje: 'Estudiante desactivado' });
  } catch (err) {
    console.error('Error al desactivar estudiante:', err);
    res.status(500).json({ error: 'Error al desactivar el estudiante' });
  }
}

// GET /api/estudiantes/:id/ficha
// Ficha básica para que docentes y directivos identifiquen rápido a un
// estudiante (foto, grado/curso, acudiente y director de grupo) — no incluye
// notas ni datos sensibles, es solo una tarjeta de referencia visual.
async function ficha(req, res) {
  const { id } = req.params;
  try {
    const [[fila]] = await db.query(`
      SELECT
        u.id, u.nombre, u.foto_url, u.telefono_padres,
        g.grado, g.nombre AS nombre_grupo,
        dir.nombre AS director_grupo,
        (
          SELECT GROUP_CONCAT(p.nombre SEPARATOR ', ')
          FROM padre_estudiante pe JOIN usuarios p ON p.id = pe.padre_id
          WHERE pe.estudiante_id = u.id
        ) AS acudientes
      FROM usuarios u
      LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
      LEFT JOIN grupos g ON g.id = eg.grupo_id
      LEFT JOIN usuarios dir ON dir.grupo_dirigido_id = g.id
      WHERE u.id = ? AND u.rol = 'estudiante' AND (u.colegio_id = ? OR g.colegio_id = ?)
    `, [id, req.usuario.colegio_id, req.usuario.colegio_id]);

    if (!fila) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json({ data: fila });
  } catch (err) {
    console.error('Error al obtener la ficha del estudiante:', err);
    res.status(500).json({ error: 'Error al obtener la ficha del estudiante' });
  }
}

// POST /api/estudiantes/:id/foto
async function subirFoto(req, res) {
  uploadFoto(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const { id } = req.params;
    try {
      const [[est]] = await db.query(
        'SELECT id, foto_url FROM usuarios WHERE id = ? AND rol = "estudiante" AND colegio_id = ?',
        [id, req.usuario.colegio_id]
      );
      if (!est) return res.status(404).json({ error: 'Estudiante no encontrado' });

      if (est.foto_url) {
        const anterior = path.join(__dirname, '../..', est.foto_url);
        if (fs.existsSync(anterior)) fs.unlinkSync(anterior);
      }

      const foto_url = `/uploads/estudiantes/${req.file.filename}`;
      await db.query('UPDATE usuarios SET foto_url = ? WHERE id = ?', [foto_url, id]);
      res.json({ data: { foto_url } });
    } catch (dbErr) {
      console.error('Error al guardar la foto:', dbErr);
      res.status(500).json({ error: 'Error al guardar la foto' });
    }
  });
}

// POST /api/estudiantes/fotos-masivo — cada archivo se llama como el número
// de documento del alumno (ej. "1098765432.jpg"); los que no encuentran
// coincidencia se reportan para que el colegio los revise, no se descartan
// en silencio.
async function subirFotosMasivo(req, res) {
  uploadFotosMasivo(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const colegio_id = req.usuario.colegio_id;
    const asignadas = [];
    const sinCoincidencia = [];

    for (const file of req.files) {
      const numeroDocumento = path.basename(file.originalname, path.extname(file.originalname)).trim();
      try {
        const [estudiantes] = await db.query(
          `SELECT id, foto_url FROM usuarios
           WHERE rol = 'estudiante' AND colegio_id = ? AND numero_documento = ?`,
          [colegio_id, numeroDocumento]
        );

        if (estudiantes.length !== 1) {
          sinCoincidencia.push({
            archivo: file.originalname,
            motivo: estudiantes.length === 0 ? 'Ningún estudiante con ese número de documento' : 'Varios estudiantes con ese número de documento',
          });
          continue;
        }

        const est = estudiantes[0];
        if (est.foto_url) {
          const anterior = path.join(__dirname, '../..', est.foto_url);
          if (fs.existsSync(anterior)) fs.unlinkSync(anterior);
        }

        const ext = path.extname(file.originalname).toLowerCase();
        const nombreArchivo = `estudiante_${est.id}_${Date.now()}${ext}`;
        fs.writeFileSync(path.join(uploadsDirEstudiantes, nombreArchivo), file.buffer);

        const foto_url = `/uploads/estudiantes/${nombreArchivo}`;
        await db.query('UPDATE usuarios SET foto_url = ? WHERE id = ?', [foto_url, est.id]);
        asignadas.push({ archivo: file.originalname, estudiante_id: est.id });
      } catch (fileErr) {
        console.error(`Error al procesar la foto ${file.originalname}:`, fileErr);
        sinCoincidencia.push({ archivo: file.originalname, motivo: 'Error al guardar el archivo' });
      }
    }

    res.json({
      mensaje: `${asignadas.length} de ${req.files.length} fotos asignadas`,
      data: { asignadas: asignadas.length, sin_coincidencia: sinCoincidencia, total: req.files.length },
    });
  });
}

// GET /api/estudiantes/:id/historial
async function historial(req, res) {
  const eid = parseInt(req.params.id);
  const u = req.usuario;

  // Estudiante solo puede ver su propio historial
  if (u.rol === 'estudiante' && u.id !== eid) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio historial' });
  }

  // Padre solo puede ver el historial de un hijo vinculado a su cuenta
  if (u.rol === 'padre') {
    const [[vinculo]] = await db.query(
      'SELECT 1 FROM padre_estudiante WHERE padre_id = ? AND estudiante_id = ? LIMIT 1',
      [u.id, eid]
    );
    if (!vinculo) return res.status(403).json({ error: 'No tienes acceso a este estudiante' });
  }

  // Admin/director solo pueden ver estudiantes de su propio colegio
  if (u.rol === 'admin' || u.rol === 'director') {
    const [[mismoColegio]] = await db.query(
      'SELECT 1 FROM usuarios WHERE id = ? AND colegio_id = ? LIMIT 1',
      [eid, u.colegio_id]
    );
    if (!mismoColegio) return res.status(403).json({ error: 'Ese estudiante no pertenece a tu colegio' });
  }

  try {
    const [
      [infoRows],
      [porMateriaRows],
      [porPeriodoRows],
      [recientesRows],
      [tendenciaRows],
    ] = await Promise.all([

      // 1. Datos del estudiante
      db.query(`
        SELECT u.nombre, u.email,
          g.nombre AS grupo, g.grado, c.nombre AS colegio
        FROM usuarios u
        LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
        LEFT JOIN grupos g ON g.id = eg.grupo_id
        LEFT JOIN colegios c ON c.id = u.colegio_id
        WHERE u.id = ?
        LIMIT 1
      `, [eid]),

      // 2. Promedio y distribución MEN por materia — "regla de tres": suma de
      // notas obtenidas ÷ actividades asignadas en cada grupo del estudiante
      // (no ÷ solo las que entregó), igual que el boletín oficial.
      db.query(`
        SELECT
          m.id AS materia_id, m.nombre AS materia, m.codigo,
          COUNT(DISTINCT mejor.actividad_id)                                            AS total,
          ROUND(SUM(mejor.nota) / NULLIF(COUNT(DISTINCT a.id), 0), 1)                    AS promedio,
          SUM(CASE WHEN mejor.nota < 3.5              THEN 1 ELSE 0 END)               AS bajo,
          SUM(CASE WHEN mejor.nota >= 3.5 AND mejor.nota < 4.0  THEN 1 ELSE 0 END)      AS basico,
          SUM(CASE WHEN mejor.nota >= 4.0 AND mejor.nota <= 4.5 THEN 1 ELSE 0 END)      AS alto,
          SUM(CASE WHEN mejor.nota > 4.5              THEN 1 ELSE 0 END)               AS superior
        FROM estudiante_grupos eg
        JOIN actividades a ON a.grupo_id = eg.grupo_id AND a.activa = TRUE
        JOIN materias m ON m.id = a.materia_id
        LEFT JOIN (
          SELECT actividad_id, estudiante_id, MAX(nota) AS nota
          FROM resultados_actividades
          GROUP BY actividad_id, estudiante_id
        ) mejor ON mejor.actividad_id = a.id AND mejor.estudiante_id = eg.estudiante_id
        WHERE eg.estudiante_id = ?
        GROUP BY m.id, m.nombre, m.codigo
        ORDER BY promedio DESC
      `, [eid]),

      // 3. Promedio por período — mismo criterio de regla de tres
      db.query(`
        SELECT
          a.periodo,
          COUNT(DISTINCT mejor.actividad_id)                          AS total,
          ROUND(SUM(mejor.nota) / NULLIF(COUNT(DISTINCT a.id), 0), 2) AS promedio
        FROM estudiante_grupos eg
        JOIN actividades a ON a.grupo_id = eg.grupo_id AND a.activa = TRUE
        LEFT JOIN (
          SELECT actividad_id, estudiante_id, MAX(nota) AS nota
          FROM resultados_actividades
          GROUP BY actividad_id, estudiante_id
        ) mejor ON mejor.actividad_id = a.id AND mejor.estudiante_id = eg.estudiante_id
        WHERE eg.estudiante_id = ?
        GROUP BY a.periodo
        ORDER BY a.periodo ASC
      `, [eid]),

      // 4. Actividades recientes (últimas 15)
      db.query(`
        SELECT
          a.titulo, a.periodo, a.tipo,
          m.nombre AS materia,
          ra.nota, ra.completada_en,
          CASE
            WHEN ra.nota < 3.5 THEN 'Bajo'
            WHEN ra.nota < 4.0 THEN 'Básico'
            WHEN ra.nota <= 4.5 THEN 'Alto'
            ELSE 'Superior'
          END AS nivel
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id
        JOIN materias m ON m.id = a.materia_id
        WHERE ra.estudiante_id = ?
        ORDER BY ra.completada_en DESC
        LIMIT 15
      `, [eid]),

      // 5. Tendencia semanal últimas 8 semanas
      db.query(`
        SELECT
          YEARWEEK(ra.completada_en, 1) AS semana_num,
          DATE(MIN(ra.completada_en))   AS fecha_inicio,
          ROUND(AVG(ra.nota), 2)        AS promedio,
          COUNT(ra.id)                  AS total
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        WHERE ra.estudiante_id = ?
          AND ra.completada_en >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY YEARWEEK(ra.completada_en, 1)
        ORDER BY semana_num ASC
      `, [eid]),
    ]);

    const info = infoRows[0] || {};
    const totalNotas = porMateriaRows.reduce((s, m) => s + (parseInt(m.total) || 0), 0);
    const promedioGlobal = porMateriaRows.length > 0
      ? parseFloat((porMateriaRows.reduce((s, m) => s + (parseFloat(m.promedio) || 0), 0) / porMateriaRows.length).toFixed(1))
      : null;

    res.json({
      data: {
        estudiante:      info.nombre || '',
        grupo:           info.grupo  || '',
        grado:           info.grado  || '',
        colegio:         info.colegio || '',
        promedioGlobal,
        totalActividades: totalNotas,
        porMateria:      porMateriaRows,
        porPeriodo:      porPeriodoRows,
        recientes:       recientesRows,
        tendencia:       tendenciaRows,
      },
    });
  } catch (err) {
    console.error('Error en historial estudiante:', err);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
}

module.exports = { listar, crear, importar, actualizar, eliminar, historial, ficha, subirFoto, subirFotosMasivo };
