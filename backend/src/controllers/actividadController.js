const db = require('../database');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { ordenApellido, ordenarPorApellido } = require('../utils/ordenNombre');

// Carpeta PRIVADA (fuera de /uploads, que se sirve público vía express.static)
// — los archivos de entregas solo se descargan mediante endpoints con token.
const uploadsDirEntregas = path.join(__dirname, '../../uploads_privados/entregas');
if (!fs.existsSync(uploadsDirEntregas)) fs.mkdirSync(uploadsDirEntregas, { recursive: true });

const EXTENSIONES_ENTREGA = /\.(pdf|docx?|pptx?|xlsx?|jpe?g|png|webp)$/i;

const uploadEntrega = multer({
  storage: multer.diskStorage({
    destination: uploadsDirEntregas,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const azar = crypto.randomBytes(6).toString('hex');
      cb(null, `entrega_${req.params.id}_${req.usuario.id}_${Date.now()}_${azar}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONES_ENTREGA.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato no permitido. Usa PDF, Word, PowerPoint, Excel o imágenes (jpg, png, webp)'));
  },
}).single('archivo');

// GET /api/actividades/docente — actividades creadas por el docente autenticado
async function listarParaDocente(req, res) {
  try {
    const [filas] = await db.query(`
      SELECT a.*,
             m.nombre AS nombre_materia,
             g.nombre AS nombre_grupo, g.grado,
             COUNT(ra.id) AS total_completadas,
             AVG(ra.nota) AS nota_promedio,
             (
               SELECT COUNT(DISTINCT eg.estudiante_id)
               FROM estudiante_grupos eg
               WHERE eg.grupo_id = a.grupo_id
                 AND eg.estudiante_id NOT IN (
                   SELECT ra2.estudiante_id
                   FROM resultados_actividades ra2
                   WHERE ra2.actividad_id = a.id
                 )
             ) AS total_pendientes
      FROM actividades a
      JOIN materias m ON m.id = a.materia_id
      JOIN grupos g ON g.id = a.grupo_id
      LEFT JOIN resultados_actividades ra ON ra.actividad_id = a.id
        AND ra.id = (
          SELECT rb.id FROM resultados_actividades rb
          WHERE rb.estudiante_id = ra.estudiante_id AND rb.actividad_id = ra.actividad_id
          ORDER BY rb.nota DESC, rb.completada_en DESC LIMIT 1
        )
      WHERE a.docente_id = ?
      GROUP BY a.id
      ORDER BY a.creado_en DESC
    `, [req.usuario.id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar actividades docente:', err);
    res.status(500).json({ error: 'Error al obtener las actividades' });
  }
}

// GET /api/actividades/estudiante — actividades disponibles para el estudiante autenticado
async function listarParaEstudiante(req, res) {
  try {
    // Obtener el grupo del estudiante
    const [grupos] = await db.query(
      'SELECT grupo_id FROM estudiante_grupos WHERE estudiante_id = ?',
      [req.usuario.id]
    );

    if (grupos.length === 0) {
      return res.json({ data: [] });
    }

    const grupoIds = grupos.map(g => g.grupo_id);
    const placeholders = grupoIds.map(() => '?').join(',');

    const [filas] = await db.query(`
      SELECT a.id, a.titulo, a.descripcion, a.tipo, a.periodo,
             a.materia_id, a.grupo_id,
             a.grado_minimo, a.grado_maximo, a.tiempo_limite_minutos,
             a.intentos_permitidos, a.activa, a.creado_en,
             m.nombre AS nombre_materia, m.codigo AS codigo_materia,
             g.nombre AS nombre_grupo, g.grado,
             ra.nota, ra.intento_numero, ra.completada_en
      FROM actividades a
      JOIN materias m ON m.id = a.materia_id
      JOIN grupos g ON g.id = a.grupo_id
      LEFT JOIN resultados_actividades ra
        ON ra.actividad_id = a.id AND ra.estudiante_id = ?
      WHERE a.grupo_id IN (${placeholders})
        AND a.activa = TRUE
      ORDER BY a.periodo ASC, m.nombre ASC, a.creado_en ASC
    `, [req.usuario.id, ...grupoIds]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar actividades estudiante:', err);
    res.status(500).json({ error: 'Error al obtener las actividades' });
  }
}

// GET /api/actividades/:id
async function obtener(req, res) {
  const { id } = req.params;
  try {
    const [filas] = await db.query(`
      SELECT a.*, m.nombre AS nombre_materia, g.nombre AS nombre_grupo, g.grado
      FROM actividades a
      JOIN materias m ON m.id = a.materia_id
      JOIN grupos g ON g.id = a.grupo_id
      WHERE a.id = ?
    `, [id]);

    if (filas.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }

    res.json({ data: filas[0] });
  } catch (err) {
    console.error('Error al obtener actividad:', err);
    res.status(500).json({ error: 'Error al obtener la actividad' });
  }
}

// Valida el porcentaje de una actividad y que, sumado a las demás actividades
// activas del mismo grupo+materia+período, no supere el 100%. `excluirId` se
// usa al editar, para no contar la propia actividad dos veces.
async function validarPorcentaje(porcentaje, grupo_id, materia_id, periodo, excluirId) {
  const num = parseFloat(porcentaje);
  if (porcentaje === undefined || porcentaje === null || porcentaje === '' || isNaN(num)) {
    return 'El porcentaje de la actividad es obligatorio';
  }
  if (num <= 0 || num > 100) {
    return 'El porcentaje debe ser mayor a 0 y no puede superar 100';
  }
  let condicionExcluir = '';
  const params = [grupo_id, materia_id, periodo];
  if (excluirId) { condicionExcluir = ' AND id != ?'; params.push(excluirId); }
  const [[fila]] = await db.query(
    `SELECT COALESCE(SUM(porcentaje), 0) AS suma FROM actividades
     WHERE grupo_id = ? AND materia_id = ? AND periodo = ? AND activa = TRUE${condicionExcluir}`,
    params
  );
  const sumaTotal = parseFloat(fila.suma) + num;
  if (sumaTotal > 100.001) {
    return `La suma de porcentajes de las actividades de este período sería ${Math.round(sumaTotal * 100) / 100}% — no puede superar 100%`;
  }
  return null;
}

// GET /api/actividades/porcentaje-disponible?grupo_id=&materia_id=&periodo=&excluir_id=
async function porcentajeDisponible(req, res) {
  const { grupo_id, materia_id, periodo, excluir_id } = req.query;
  if (!grupo_id || !materia_id || !periodo) {
    return res.status(400).json({ error: 'Faltan parámetros: grupo_id, materia_id, periodo' });
  }
  try {
    let condicionExcluir = '';
    const params = [grupo_id, materia_id, periodo];
    if (excluir_id) { condicionExcluir = ' AND id != ?'; params.push(excluir_id); }
    const [[fila]] = await db.query(
      `SELECT COALESCE(SUM(porcentaje), 0) AS suma FROM actividades
       WHERE grupo_id = ? AND materia_id = ? AND periodo = ? AND activa = TRUE${condicionExcluir}`,
      params
    );
    const usado = Math.round(parseFloat(fila.suma) * 100) / 100;
    res.json({ data: { usado, disponible: Math.round((100 - usado) * 100) / 100 } });
  } catch (err) {
    console.error('Error en porcentajeDisponible:', err);
    res.status(500).json({ error: 'Error al calcular el porcentaje disponible' });
  }
}

// POST /api/actividades
async function crear(req, res) {
  const {
    titulo, descripcion, tipo, contenido,
    materia_id, grupo_id, periodo, porcentaje,
    fecha_inicio, fecha_cierre,
    tiempo_limite_minutos, intentos_permitidos
  } = req.body;

  if (!titulo || !tipo || !contenido || !materia_id || !grupo_id || !periodo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const errorPorcentaje = await validarPorcentaje(porcentaje, grupo_id, materia_id, periodo);
  if (errorPorcentaje) return res.status(400).json({ error: errorPorcentaje });

  try {
    const [grupos] = await db.query('SELECT grado FROM grupos WHERE id = ?', [grupo_id]);
    const grado = grupos[0]?.grado || '5';
    const contenidoJson = typeof contenido === 'string' ? contenido : JSON.stringify(contenido);

    const [result] = await db.query(
      `INSERT INTO actividades
        (titulo, descripcion, tipo, contenido, docente_id, materia_id, grupo_id,
         periodo, porcentaje, fecha_inicio, fecha_cierre,
         grado_minimo, grado_maximo, tiempo_limite_minutos, intentos_permitidos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        titulo, descripcion || null, tipo, contenidoJson,
        req.usuario.id, materia_id, grupo_id,
        periodo, parseFloat(porcentaje), fecha_inicio || null, fecha_cierre || null,
        grado, grado,
        tiempo_limite_minutos || 30, intentos_permitidos || 3
      ]
    );
    res.status(201).json({ mensaje: 'Actividad creada', data: { id: result.insertId } });
  } catch (err) {
    console.error('Error al crear actividad:', err);
    res.status(500).json({ error: 'Error al crear la actividad' });
  }
}

// PUT /api/actividades/:id
async function actualizar(req, res) {
  const { id } = req.params;
  const {
    titulo, descripcion, activa, tiempo_limite_minutos,
    materia_id, grupo_id, periodo, porcentaje, fecha_inicio, fecha_cierre,
    intentos_permitidos, contenido,
  } = req.body;

  // El porcentaje afecta la validación de suma 100% del grupo+materia+período
  // — si cambia cualquiera de esos 4 valores, hay que revalidar contra el
  // estado real de la actividad (los que no cambian se toman de la BD).
  if (porcentaje !== undefined || materia_id !== undefined || grupo_id !== undefined || periodo !== undefined) {
    const [[actual]] = await db.query(
      'SELECT materia_id, grupo_id, periodo, porcentaje FROM actividades WHERE id = ? AND docente_id = ?',
      [id, req.usuario.id]
    );
    if (!actual) return res.status(404).json({ error: 'Actividad no encontrada' });
    const errorPorcentaje = await validarPorcentaje(
      porcentaje !== undefined ? porcentaje : actual.porcentaje,
      grupo_id !== undefined ? grupo_id : actual.grupo_id,
      materia_id !== undefined ? materia_id : actual.materia_id,
      periodo !== undefined ? periodo : actual.periodo,
      id
    );
    if (errorPorcentaje) return res.status(400).json({ error: errorPorcentaje });
  }

  const campos = [];
  const params = [];

  if (titulo              !== undefined) { campos.push('titulo = ?');                params.push(titulo); }
  if (descripcion         !== undefined) { campos.push('descripcion = ?');           params.push(descripcion || null); }
  if (activa              !== undefined) { campos.push('activa = ?');                params.push(activa); }
  if (tiempo_limite_minutos !== undefined) { campos.push('tiempo_limite_minutos = ?'); params.push(tiempo_limite_minutos); }
  if (materia_id          !== undefined) { campos.push('materia_id = ?');            params.push(materia_id); }
  if (periodo             !== undefined) { campos.push('periodo = ?');               params.push(periodo); }
  if (porcentaje          !== undefined) { campos.push('porcentaje = ?');            params.push(parseFloat(porcentaje)); }
  if (fecha_inicio        !== undefined) { campos.push('fecha_inicio = ?');          params.push(fecha_inicio || null); }
  if (fecha_cierre        !== undefined) { campos.push('fecha_cierre = ?');          params.push(fecha_cierre || null); }
  if (intentos_permitidos !== undefined) { campos.push('intentos_permitidos = ?');   params.push(intentos_permitidos); }
  if (contenido           !== undefined) {
    campos.push('contenido = ?');
    params.push(typeof contenido === 'string' ? contenido : JSON.stringify(contenido));
  }

  if (campos.length === 0) return res.json({ mensaje: 'Sin cambios' });

  // Si cambió el grupo, actualizar grado_minimo, grado_maximo y grupo_id
  if (grupo_id !== undefined) {
    campos.push('grupo_id = ?');
    params.push(grupo_id);
    try {
      const [[g]] = await db.query('SELECT grado FROM grupos WHERE id = ?', [grupo_id]);
      if (g) {
        campos.push('grado_minimo = ?', 'grado_maximo = ?');
        params.push(g.grado, g.grado);
      }
    } catch { /* ignorar */ }
  }

  params.push(id, req.usuario.id);

  try {
    await db.query(
      `UPDATE actividades SET ${campos.join(', ')} WHERE id = ? AND docente_id = ?`,
      params
    );
    res.json({ mensaje: 'Actividad actualizada' });
  } catch (err) {
    console.error('Error al actualizar actividad:', err);
    res.status(500).json({ error: 'Error al actualizar la actividad' });
  }
}

// DELETE /api/actividades/:id (desactiva)
async function eliminar(req, res) {
  const { id } = req.params;
  try {
    await db.query(
      'UPDATE actividades SET activa = FALSE WHERE id = ? AND docente_id = ?',
      [id, req.usuario.id]
    );
    res.json({ mensaje: 'Actividad desactivada' });
  } catch (err) {
    console.error('Error al desactivar actividad:', err);
    res.status(500).json({ error: 'Error al desactivar la actividad' });
  }
}

// POST /api/actividades/:id/responder — estudiante entrega sus respuestas
async function responder(req, res) {
  const { id } = req.params;
  const { respuestas, tiempo_empleado_segundos } = req.body;

  if (!respuestas) {
    return res.status(400).json({ error: 'Las respuestas son obligatorias' });
  }

  try {
    const [acts] = await db.query('SELECT * FROM actividades WHERE id = ? AND activa = TRUE', [id]);
    if (acts.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada o inactiva' });
    }

    const actividad = acts[0];
    const contenido = typeof actividad.contenido === 'string'
      ? JSON.parse(actividad.contenido)
      : actividad.contenido;

    // Contar intentos anteriores
    const [intentosAnteriores] = await db.query(
      'SELECT COUNT(*) AS total FROM resultados_actividades WHERE estudiante_id = ? AND actividad_id = ?',
      [req.usuario.id, id]
    );
    const numeroIntento = intentosAnteriores[0].total + 1;

    if (numeroIntento > actividad.intentos_permitidos) {
      return res.status(403).json({ error: `Ya agotaste los ${actividad.intentos_permitidos} intentos permitidos` });
    }

    // Calcular nota según tipo
    const nota = calcularNota(actividad.tipo, contenido, respuestas, numeroIntento);

    const [result] = await db.query(
      `INSERT INTO resultados_actividades
        (estudiante_id, actividad_id, respuestas, nota, tiempo_empleado_segundos, intento_numero)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.usuario.id, id,
        JSON.stringify(respuestas),
        nota,
        tiempo_empleado_segundos || null,
        numeroIntento
      ]
    );

    res.json({ mensaje: 'Actividad completada', data: { nota, intento_numero: numeroIntento, id: result.insertId } });

    // Verificar y otorgar logros (fire-and-forget)
    setImmediate(() => require('../controllers/logroController').verificarYOtorgar(req.usuario.id));

    // Notificación WhatsApp al padre si nota < 3.5 (fire-and-forget)
    if (nota < 3.5) {
      setImmediate(async () => {
        try {
          const { enviarMensaje } = require('../services/whatsappService');
          const [[info]] = await db.query(`
            SELECT u.nombre    AS estudiante,
                   u.telefono_padres,
                   act.titulo  AS actividad,
                   m.nombre    AS materia,
                   g.nombre    AS grupo,
                   g.grado,
                   c.nombre    AS colegio
            FROM usuarios u
            JOIN actividades act ON act.id = ?
            JOIN materias    m   ON m.id   = act.materia_id
            JOIN grupos      g   ON g.id   = act.grupo_id
            JOIN colegios    c   ON c.id   = g.colegio_id
            WHERE u.id = ?
          `, [id, req.usuario.id]);

          if (!info?.telefono_padres) return;

          const mensaje = [
            `📚 *Playfesor*`,
            ``,
            `Estimado padre/madre de *${info.estudiante}*,`,
            ``,
            `Le informamos que su hijo/a obtuvo una nota de *${nota}* en la actividad *"${info.actividad}"* de ${info.materia} (Grado ${info.grado}° ${info.grupo}).`,
            ``,
            `⚠️ Esta nota está por debajo del nivel básico (3.5). Le recomendamos acompañar a su hijo/a con refuerzo en esta área.`,
            ``,
            `_${info.colegio}_`,
          ].join('\n');

          await enviarMensaje(info.telefono_padres, mensaje);
        } catch (e) {
          console.error('Error notificando nota baja por WhatsApp:', e.message);
        }
      });
    }

  } catch (err) {
    console.error('Error al responder actividad:', err);
    res.status(500).json({ error: 'Error al guardar las respuestas' });
  }
}

// GET /api/actividades/:id/pendientes — estudiantes del grupo que no han completado la actividad
async function obtenerPendientes(req, res) {
  const { id } = req.params;
  try {
    const [acts] = await db.query(
      'SELECT grupo_id FROM actividades WHERE id = ? AND docente_id = ?',
      [id, req.usuario.id]
    );
    if (acts.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }
    const [filas] = await db.query(`
      SELECT u.id, u.nombre
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id
      WHERE eg.grupo_id = ?
        AND u.id NOT IN (
          SELECT ra.estudiante_id FROM resultados_actividades ra WHERE ra.actividad_id = ?
        )
      ORDER BY ${ordenApellido('u.nombre')} ASC
    `, [acts[0].grupo_id, id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al obtener pendientes:', err);
    res.status(500).json({ error: 'Error al obtener pendientes' });
  }
}

// GET /api/actividades/:id/resultado
async function obtenerResultado(req, res) {
  const { id } = req.params;
  try {
    const [filas] = await db.query(
      `SELECT * FROM resultados_actividades
       WHERE estudiante_id = ? AND actividad_id = ?
       ORDER BY completada_en DESC`,
      [req.usuario.id, id]
    );
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al obtener resultado:', err);
    res.status(500).json({ error: 'Error al obtener el resultado' });
  }
}

// Convierte proporción (0–1) a escala MEN (1.0–5.0)
function toNota(proporcion) {
  return parseFloat(Math.max(1.0, proporcion * 5.0).toFixed(1));
}

// Lógica de calificación — soporta formato multi-pregunta y tipos nuevos
function calcularNota(tipo, contenido, respuestas, intento) {
  // Formato multi-pregunta (opcion_multiple, completar_espacios)
  if (contenido.preguntas) {
    return calcularNotaMulti(tipo, contenido.preguntas, respuestas);
  }
  // Tipos nuevos
  if (tipo === 'ordenar_letras') {
    const total = contenido.palabras.length;
    if (!total) return 1.0;
    const correctas = contenido.palabras.filter(p => {
      const resp = (respuestas[p.id] || '').toLowerCase().replace(/\s/g, '');
      return resp === p.palabra.toLowerCase().replace(/\s/g, '');
    }).length;
    return toNota(correctas / total);
  }
  if (tipo === 'ordenar_palabras') {
    const total = contenido.oraciones.length;
    if (!total) return 1.0;
    const correctas = contenido.oraciones.filter(o => {
      const resp = (respuestas[o.id] || '').trim().toLowerCase();
      return resp === o.oracion.trim().toLowerCase();
    }).length;
    return toNota(correctas / total);
  }
  if (tipo === 'sopa_letras') {
    const total = contenido.palabras.length;
    if (!total) return 1.0;
    const encontradas = contenido.palabras.filter(p => respuestas[p.id] === true).length;
    return toNota(encontradas / total);
  }

  // Formato legacy (una sola pregunta por actividad)
  let correctas = 0;
  let total = 0;
  switch (tipo) {
    case 'opcion_multiple': {
      const opcionCorrecta = contenido.opciones.find(o => o.correcto);
      if (opcionCorrecta && respuestas.opcion_id === opcionCorrecta.id) {
        return parseFloat(Math.max(1.0, 5.0 - (intento - 1) * 0.5).toFixed(1));
      }
      return 1.0;
    }
    case 'verdadero_falso': {
      total = contenido.afirmaciones.length;
      contenido.afirmaciones.forEach(af => {
        if (respuestas[af.id] === af.correcto) correctas++;
      });
      break;
    }
    case 'ordenar_pasos': {
      total = contenido.pasos.length;
      contenido.pasos.forEach((_, i) => {
        const esperado = contenido.pasos.find(p => p.orden === i + 1);
        if (esperado && respuestas[i] === esperado.id) correctas++;
      });
      break;
    }
    case 'completar_espacios': {
      total = contenido.respuestas.length;
      contenido.respuestas.forEach(esp => {
        const resp = (respuestas[esp.id] || '').trim().toLowerCase();
        if (resp === esp.respuesta.trim().toLowerCase()) correctas++;
      });
      break;
    }
    case 'relacionar_columnas': {
      total = contenido.columna_b.length;
      contenido.columna_b.forEach(b => {
        if (respuestas[b.id] === b.par_id) correctas++;
      });
      break;
    }
    default: return 1.0;
  }
  return toNota(total > 0 ? correctas / total : 0);
}

function calcularNotaMulti(tipo, preguntas, respuestas) {
  let correctas = 0;
  let total = 0;
  if (tipo === 'opcion_multiple') {
    total = preguntas.length;
    preguntas.forEach(p => {
      const correcta = p.opciones.find(o => o.correcto);
      if (correcta && respuestas[p.id] === correcta.id) correctas++;
    });
  } else if (tipo === 'completar_espacios') {
    preguntas.forEach(p => {
      p.respuestas.forEach(r => {
        total++;
        const resp = (respuestas[`${p.id}_${r.id}`] || '').trim().toLowerCase();
        if (resp === r.respuesta.trim().toLowerCase()) correctas++;
      });
    });
  }
  return total > 0 ? toNota(correctas / total) : 1.0;
}

// POST /api/actividades/generar-ia — genera contenido de actividad con Claude
async function generarConIA(req, res) {
  const { tema, tipo, grado, n_preguntas } = req.body;
  if (!tema || !tipo || !grado) {
    return res.status(400).json({ error: 'tema, tipo y grado son obligatorios' });
  }
  const tiposPermitidos = ['opcion_multiple', 'verdadero_falso', 'ordenar_pasos', 'completar_espacios', 'relacionar_columnas'];
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({ error: 'El generador IA soporta: opcion_multiple, verdadero_falso, ordenar_pasos, completar_espacios, relacionar_columnas' });
  }
  const n = Math.min(10, Math.max(3, parseInt(n_preguntas) || 5));

  const schemas = {
    opcion_multiple: {
      ejemplo: JSON.stringify({
        preguntas: [{
          id: 'p1', pregunta: '¿Pregunta de ejemplo?', imagen: null,
          opciones: [
            { id: 'a', texto: 'Opción A', correcto: false },
            { id: 'b', texto: 'Opción B correcta', correcto: true },
            { id: 'c', texto: 'Opción C', correcto: false },
            { id: 'd', texto: 'Opción D', correcto: false },
          ],
        }],
      }, null, 2),
      extra: `Genera exactamente ${n} preguntas. IDs de preguntas: "p1","p2",... IDs de opciones: "a","b","c","d". Exactamente UNA opción con correcto:true por pregunta. imagen: null siempre.`,
    },
    verdadero_falso: {
      ejemplo: JSON.stringify({
        afirmaciones: [
          { id: 1, texto: 'Afirmación de ejemplo', correcto: true, imagen: null },
        ],
      }, null, 2),
      extra: `Genera exactamente ${n} afirmaciones. IDs: números enteros 1,2,3... imagen: null siempre. Mezcla verdaderas y falsas.`,
    },
    ordenar_pasos: {
      ejemplo: JSON.stringify({
        instruccion: 'Ordena los pasos en el orden correcto',
        pasos: [
          { id: 1, texto: 'Primer paso', orden: 1 },
          { id: 2, texto: 'Segundo paso', orden: 2 },
        ],
      }, null, 2),
      extra: `Genera exactamente ${n} pasos en su orden correcto. Los IDs deben ser enteros únicos 1,2,...${n} y el campo "orden" debe coincidir con el número de paso.`,
    },
    completar_espacios: {
      ejemplo: JSON.stringify({
        preguntas: [{
          id: 'p1',
          texto_con_blancos: 'La fotosíntesis ocurre en el [BLANK] de la célula',
          imagen: null,
          respuestas: [{ id: 1, respuesta: 'cloroplasto' }],
        }],
      }, null, 2),
      extra: `Genera exactamente ${n} frases. IDs de preguntas: "p1","p2",... Usa [BLANK] en el texto donde va la respuesta. Cada respuesta tiene id numérico empezando en 1. imagen: null siempre. Entre 1 y 2 blancos por frase.`,
    },
    relacionar_columnas: {
      ejemplo: JSON.stringify({
        columna_a: [{ id: 1, texto: 'Concepto' }],
        columna_b: [{ id: 101, texto: 'Definición', par_id: 1 }],
      }, null, 2),
      extra: `Genera exactamente ${n} pares. columna_a usa IDs 1,2,...${n}. columna_b usa IDs 101,102,...${100 + n} y par_id apunta al ID correspondiente en columna_a.`,
    },
  };

  const tipoLabel = {
    opcion_multiple:    'Opción múltiple',
    verdadero_falso:    'Verdadero / Falso',
    ordenar_pasos:      'Ordenar pasos',
    completar_espacios: 'Completar espacios',
    relacionar_columnas:'Relacionar columnas',
  }[tipo];

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const { CLAUDE_MODEL } = require('../config/ia');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { ejemplo, extra } = schemas[tipo];
    const prompt = `Eres un experto en educación colombiana. Genera actividad académica para grado ${grado}° sobre: "${tema}".

Tipo: ${tipoLabel}

RESPONDE SOLO CON JSON VÁLIDO, sin texto adicional ni markdown. Esquema exacto:
${ejemplo}

Reglas:
- ${extra}
- Español, apropiado para grado ${grado}° colombiano
- Preguntas claras, educativas y bien redactadas`;

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    });

    let texto = message.content[0].text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let contenido;
    try {
      contenido = JSON.parse(texto);
    } catch {
      return res.status(500).json({ error: 'La IA generó un formato inválido. Intenta de nuevo con un tema más específico.' });
    }

    const titulo = `${tema.charAt(0).toUpperCase() + tema.slice(1)} — Grado ${grado}°`;
    res.json({ data: { contenido, titulo } });
  } catch (err) {
    console.error('Error generando actividad con IA:', err);
    res.status(500).json({ error: 'Error al generar la actividad' });
  }
}

// POST /api/actividades/calificar-manual
// Docente crea una evaluación presencial y registra las notas directamente
async function calificarManual(req, res) {
  const { titulo, grupo_id, materia_id, periodo, porcentaje, calificaciones } = req.body;

  if (!titulo || !grupo_id || !materia_id || !periodo || !Array.isArray(calificaciones) || calificaciones.length === 0) {
    return res.status(400).json({ error: 'Faltan campos: titulo, grupo_id, materia_id, periodo, calificaciones' });
  }

  const errorPorcentaje = await validarPorcentaje(porcentaje, grupo_id, materia_id, periodo);
  if (errorPorcentaje) return res.status(400).json({ error: errorPorcentaje });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Crear la actividad de tipo 'manual'
    const [result] = await conn.query(
      `INSERT INTO actividades
        (titulo, tipo, contenido, docente_id, materia_id, grupo_id, periodo, porcentaje, grado_minimo, grado_maximo, activa)
       SELECT ?, 'manual', '{}', ?, ?, ?, ?, ?, grado, grado, TRUE
       FROM grupos WHERE id = ?`,
      [titulo, req.usuario.id, materia_id, grupo_id, periodo, parseFloat(porcentaje), grupo_id]
    );
    const actividadId = result.insertId;

    // 2. Insertar notas directamente en resultados_actividades
    for (const c of calificaciones) {
      if (c.nota === null || c.nota === undefined || c.nota === '') continue;
      const nota = Math.min(5.0, Math.max(1.0, parseFloat(c.nota)));
      if (isNaN(nota)) continue;
      await conn.query(
        `INSERT INTO resultados_actividades (estudiante_id, actividad_id, respuestas, nota, intento_numero)
         VALUES (?, ?, '{}', ?, 1)
         ON DUPLICATE KEY UPDATE nota = VALUES(nota)`,
        [c.estudiante_id, actividadId, parseFloat(nota.toFixed(1))]
      );
    }

    await conn.commit();
    res.status(201).json({ mensaje: 'Calificaciones registradas', data: { actividad_id: actividadId } });
  } catch (err) {
    await conn.rollback();
    console.error('Error en calificarManual:', err);
    res.status(500).json({ error: 'Error al registrar las calificaciones' });
  } finally {
    conn.release();
  }
}

// GET /api/actividades/mis-materias?grupo_id=X
// Materias que el usuario enseña en ese grupo (docente) o todas las materias del grupo (director/admin)
async function misMaterias(req, res) {
  const { grupo_id } = req.query;
  if (!grupo_id) return res.status(400).json({ error: 'grupo_id requerido' });
  try {
    let filas;
    if (req.usuario.rol === 'docente') {
      [filas] = await db.query(`
        SELECT DISTINCT m.id, m.nombre
        FROM docente_grupos_materias dgm
        JOIN materias m ON m.id = dgm.materia_id
        WHERE dgm.docente_id = ? AND dgm.grupo_id = ?
        ORDER BY m.nombre ASC
      `, [req.usuario.id, grupo_id]);
    } else {
      [filas] = await db.query(`
        SELECT DISTINCT m.id, m.nombre
        FROM docente_grupos_materias dgm
        JOIN materias m ON m.id = dgm.materia_id
        WHERE dgm.grupo_id = ?
        ORDER BY m.nombre ASC
      `, [grupo_id]);
    }
    res.json({ data: filas });
  } catch (err) {
    console.error('Error en misMaterias:', err);
    res.status(500).json({ error: 'Error al obtener materias' });
  }
}

const TIPOS_COMPONENTE = ['autoevaluacion', 'coevaluacion', 'heteroevaluacion'];
// Peso de cada bloque en la nota final: actividades 80%, autoeval 5%,
// coeval 5%, heteroeval 10%.
const PESO_ACTIVIDADES = 0.80;
const PESOS_COMPONENTE = { autoevaluacion: 0.05, coevaluacion: 0.05, heteroevaluacion: 0.10 };

// GET /api/actividades/libro?grupo_id=X&materia_id=Y&periodo=Z
// Matriz completa: actividades × estudiantes con sus notas, más los
// componentes de autoevaluación/coevaluación/heteroevaluación y la nota
// final ponderada de cada estudiante.
async function libroCalificaciones(req, res) {
  const { grupo_id, materia_id, periodo } = req.query;
  if (!grupo_id || !materia_id || !periodo) {
    return res.status(400).json({ error: 'Faltan parámetros: grupo_id, materia_id, periodo' });
  }
  try {
    // 1. Actividades del grupo+materia+periodo, con su porcentaje y cuántos
    // estudiantes ya entregaron. El promedio por actividad se calcula más
    // abajo, en JS, sobre el total de estudiantes del grupo — no solo sobre
    // los que entregaron.
    // Toma el mejor intento de cada estudiante por actividad — si no, los intentos
    // múltiples (intentos_permitidos) se promedian entre sí y distorsionan la nota real
    const [actividades] = await db.query(`
      SELECT a.id, a.titulo, a.creado_en, a.porcentaje, a.fecha_inicio, a.fecha_cierre,
        COUNT(mejores.estudiante_id) AS total_completadas
      FROM actividades a
      LEFT JOIN (
        SELECT actividad_id, estudiante_id, MAX(nota) AS mejor_nota
        FROM resultados_actividades
        GROUP BY actividad_id, estudiante_id
      ) mejores ON mejores.actividad_id = a.id
      WHERE a.grupo_id = ? AND a.materia_id = ? AND a.periodo = ? AND a.activa = TRUE
      GROUP BY a.id, a.titulo, a.creado_en, a.porcentaje, a.fecha_inicio, a.fecha_cierre
      ORDER BY a.creado_en ASC
    `, [grupo_id, materia_id, periodo]);

    // 2. Todas las notas de todos los estudiantes para esas actividades (mejor intento)
    const [filas] = await db.query(`
      SELECT u.id AS estudiante_id, u.nombre,
             a.id AS actividad_id, mejores.mejor_nota AS nota
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      LEFT JOIN actividades a
        ON a.grupo_id = eg.grupo_id AND a.materia_id = ? AND a.periodo = ? AND a.activa = TRUE
      LEFT JOIN (
        SELECT actividad_id, estudiante_id, MAX(nota) AS mejor_nota
        FROM resultados_actividades
        GROUP BY actividad_id, estudiante_id
      ) mejores ON mejores.actividad_id = a.id AND mejores.estudiante_id = u.id
      WHERE eg.grupo_id = ?
      ORDER BY ${ordenApellido('u.nombre')} ASC
    `, [materia_id, periodo, grupo_id]);

    // 3. Componentes manuales (autoeval/coeval/heteroeval) ya guardados
    const [componentesFilas] = await db.query(`
      SELECT estudiante_id, tipo, nota FROM componentes_evaluacion
      WHERE grupo_id = ? AND materia_id = ? AND periodo = ?
    `, [grupo_id, materia_id, periodo]);
    const componentesMap = {};
    componentesFilas.forEach(c => {
      if (!componentesMap[c.estudiante_id]) componentesMap[c.estudiante_id] = {};
      componentesMap[c.estudiante_id][c.tipo] = parseFloat(c.nota);
    });

    // 4. Construir mapa de estudiantes
    // mysql2 devuelve las columnas DECIMAL (la nota) como string — convertir a
    // número real aquí evita que las sumas de más abajo concatenen texto.
    const estudiantesMap = {};
    filas.forEach(f => {
      if (!estudiantesMap[f.estudiante_id]) {
        estudiantesMap[f.estudiante_id] = { id: f.estudiante_id, nombre: f.nombre, notas: {} };
      }
      if (f.actividad_id !== null && f.nota !== null) {
        estudiantesMap[f.estudiante_id].notas[f.actividad_id] = parseFloat(f.nota);
      }
    });

    // Object.values() reordena las claves numéricas (estudiante_id) de forma
    // ascendente sin importar el ORDER BY de la consulta — hay que reordenar
    // explícitamente por apellido.
    const listaEstudiantes = ordenarPorApellido(Object.values(estudiantesMap));
    const totalEstudiantesGrupo = listaEstudiantes.length;
    const actIds = actividades.map(a => a.id);
    const sumaPorcentaje = Math.round(actividades.reduce((s, a) => s + parseFloat(a.porcentaje || 0), 0) * 100) / 100;
    const porcentajeCompleto = actIds.length > 0 && Math.abs(sumaPorcentaje - 100) < 0.01;

    // Promedio ponderado de actividades por estudiante: Σ(nota_i × %_i) / 100.
    // Lo no entregado cuenta como 0 (misma regla de tres del boletín, aplicada
    // ahora por porcentaje en vez de partes iguales). Solo es la nota válida
    // del bloque de actividades (80%) cuando los porcentajes suman 100%.
    const estudiantes = listaEstudiantes.map(est => {
      const sumaPonderada = actividades.reduce((s, a) => {
        const nota = est.notas[a.id];
        return s + (nota !== undefined ? nota : 0) * parseFloat(a.porcentaje || 0);
      }, 0);
      const promedio_actividades = actIds.length ? Math.round((sumaPonderada / 100) * 10) / 10 : null;

      const comp = componentesMap[est.id] || {};
      let nota_final = null;
      if (porcentajeCompleto) {
        nota_final = Math.round((
          promedio_actividades * PESO_ACTIVIDADES +
          (comp.autoevaluacion || 0) * PESOS_COMPONENTE.autoevaluacion +
          (comp.coevaluacion || 0) * PESOS_COMPONENTE.coevaluacion +
          (comp.heteroevaluacion || 0) * PESOS_COMPONENTE.heteroevaluacion
        ) * 10) / 10;
      }

      return {
        ...est,
        promedio_actividades,
        componentes: {
          autoevaluacion: comp.autoevaluacion ?? null,
          coevaluacion: comp.coevaluacion ?? null,
          heteroevaluacion: comp.heteroevaluacion ?? null,
        },
        nota_final,
      };
    });

    // Promedio por actividad — mismo criterio, pero dividido entre el total de
    // estudiantes del grupo (no solo los que la entregaron). Es solo un dato
    // descriptivo por columna, no interviene en la nota final.
    const actividadesConPromedio = actividades.map(act => {
      const notasAct = listaEstudiantes
        .map(est => est.notas[act.id])
        .filter(n => n !== undefined && n !== null);
      const suma = notasAct.reduce((s, n) => s + n, 0);
      const promedio_actividad = totalEstudiantesGrupo
        ? Math.round((suma / totalEstudiantesGrupo) * 10) / 10
        : null;
      return { ...act, porcentaje: parseFloat(act.porcentaje), promedio_actividad };
    });

    res.json({ data: { actividades: actividadesConPromedio, estudiantes, sumaPorcentaje, porcentajeCompleto } });
  } catch (err) {
    console.error('Error en libroCalificaciones:', err);
    res.status(500).json({ error: 'Error al obtener el libro de calificaciones' });
  }
}

// GET /api/actividades/componentes?grupo_id=X&materia_id=Y&periodo=Z&tipo=autoevaluacion
// Notas ya guardadas de un componente específico, por estudiante.
async function getComponentes(req, res) {
  const { grupo_id, materia_id, periodo, tipo } = req.query;
  if (!grupo_id || !materia_id || !periodo || !TIPOS_COMPONENTE.includes(tipo)) {
    return res.status(400).json({ error: 'Faltan parámetros: grupo_id, materia_id, periodo, tipo válido' });
  }
  try {
    const [filas] = await db.query(`
      SELECT estudiante_id, nota FROM componentes_evaluacion
      WHERE grupo_id = ? AND materia_id = ? AND periodo = ? AND tipo = ?
    `, [grupo_id, materia_id, periodo, tipo]);
    res.json({ data: filas.map(f => ({ estudiante_id: f.estudiante_id, nota: parseFloat(f.nota) })) });
  } catch (err) {
    console.error('Error en getComponentes:', err);
    res.status(500).json({ error: 'Error al obtener el componente' });
  }
}

// POST /api/actividades/componentes
// body: { grupo_id, materia_id, periodo, tipo, calificaciones: [{estudiante_id, nota}] }
async function guardarComponentes(req, res) {
  const { grupo_id, materia_id, periodo, tipo, calificaciones } = req.body;
  if (!grupo_id || !materia_id || !periodo || !TIPOS_COMPONENTE.includes(tipo) || !Array.isArray(calificaciones)) {
    return res.status(400).json({ error: 'Faltan campos: grupo_id, materia_id, periodo, tipo válido, calificaciones' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const c of calificaciones) {
      if (c.nota === null || c.nota === undefined || c.nota === '') continue;
      const nota = parseFloat(c.nota);
      if (isNaN(nota) || nota < 1.0 || nota > 5.0) continue;
      await conn.query(
        `INSERT INTO componentes_evaluacion (estudiante_id, materia_id, grupo_id, periodo, tipo, nota)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nota = VALUES(nota)`,
        [c.estudiante_id, materia_id, grupo_id, periodo, tipo, parseFloat(nota.toFixed(1))]
      );
    }
    await conn.commit();
    res.json({ mensaje: 'Calificaciones guardadas' });
  } catch (err) {
    await conn.rollback();
    console.error('Error en guardarComponentes:', err);
    res.status(500).json({ error: 'Error al guardar las calificaciones' });
  } finally {
    conn.release();
  }
}

// POST /api/actividades/:id/generar-recuperacion — genera actividad de recuperación para el estudiante que falló
async function generarRecuperacion(req, res) {
  const { id } = req.params;
  const estudianteId = req.usuario.id;

  try {
    // Verificar que el estudiante falló esta actividad
    const [[resultado]] = await db.query(
      'SELECT nota FROM resultados_actividades WHERE actividad_id = ? AND estudiante_id = ? ORDER BY completada_en DESC LIMIT 1',
      [id, estudianteId]
    );
    if (!resultado || parseFloat(resultado.nota) >= 3.5) {
      return res.status(400).json({ error: 'Solo puedes generar recuperación si obtuviste una nota inferior a 3.5' });
    }

    // Verificar que no existe ya una recuperación reciente (últimas 24h)
    const [[yaExiste]] = await db.query(`
      SELECT a.id FROM actividades a
      WHERE a.titulo LIKE CONCAT('Recuperación: ', (SELECT titulo FROM actividades WHERE id = ?), '%')
        AND a.grupo_id = (SELECT grupo_id FROM actividades WHERE id = ?)
        AND a.materia_id = (SELECT materia_id FROM actividades WHERE id = ?)
        AND a.creado_en >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      LIMIT 1
    `, [id, id, id]);
    if (yaExiste) {
      return res.json({ data: { id: yaExiste.id, yaExistia: true } });
    }

    // Obtener datos de la actividad original
    const [[original]] = await db.query(`
      SELECT a.titulo, a.tipo, a.periodo, a.grupo_id, a.materia_id, a.docente_id,
        m.nombre AS materia, g.grado
      FROM actividades a
      JOIN materias m ON m.id = a.materia_id
      JOIN grupos g ON g.id = a.grupo_id
      WHERE a.id = ?
    `, [id]);
    if (!original) return res.status(404).json({ error: 'Actividad no encontrada' });

    // Tipos que soporta la IA (los otros tipos caen a opcion_multiple)
    const tiposIA = ['opcion_multiple', 'verdadero_falso', 'ordenar_pasos', 'completar_espacios', 'relacionar_columnas'];
    const tipoRecup = tiposIA.includes(original.tipo) ? original.tipo : 'opcion_multiple';
    const n = 5;

    const schemas = {
      opcion_multiple: {
        ejemplo: JSON.stringify({ preguntas: [{ id: 'p1', pregunta: '¿Pregunta?', imagen: null, opciones: [{ id: 'a', texto: 'Op A', correcto: false },{ id: 'b', texto: 'Op B correcta', correcto: true },{ id: 'c', texto: 'Op C', correcto: false },{ id: 'd', texto: 'Op D', correcto: false }] }] }),
        extra: `Genera exactamente ${n} preguntas. IDs: "p1"..."p${n}". Opciones: "a","b","c","d". Solo una correcto:true por pregunta. imagen: null.`,
      },
      verdadero_falso: {
        ejemplo: JSON.stringify({ afirmaciones: [{ id: 1, texto: 'Afirmación', correcto: true, imagen: null }] }),
        extra: `Genera exactamente ${n} afirmaciones. IDs: 1..${n}. imagen: null. Mezcla verdaderas y falsas.`,
      },
      ordenar_pasos: {
        ejemplo: JSON.stringify({ instruccion: 'Ordena los pasos', pasos: [{ id: 1, texto: 'Paso 1', orden: 1 },{ id: 2, texto: 'Paso 2', orden: 2 }] }),
        extra: `Genera exactamente ${n} pasos. IDs y orden: 1..${n}.`,
      },
      completar_espacios: {
        ejemplo: JSON.stringify({ preguntas: [{ id: 'p1', texto_con_blancos: 'La [BLANK] ocurre en...', imagen: null, respuestas: [{ id: 1, respuesta: 'fotosíntesis' }] }] }),
        extra: `Genera exactamente ${n} frases con [BLANK]. IDs: "p1"..."p${n}". imagen: null.`,
      },
      relacionar_columnas: {
        ejemplo: JSON.stringify({ columna_a: [{ id: 1, texto: 'Concepto' }], columna_b: [{ id: 101, texto: 'Definición', par_id: 1 }] }),
        extra: `Genera exactamente ${n} pares. columna_a IDs: 1..${n}. columna_b IDs: 101..${100+n}.`,
      },
    };

    const tipoLabel = { opcion_multiple: 'Opción múltiple', verdadero_falso: 'Verdadero/Falso', ordenar_pasos: 'Ordenar pasos', completar_espacios: 'Completar espacios', relacionar_columnas: 'Relacionar columnas' }[tipoRecup];

    const Anthropic = require('@anthropic-ai/sdk');
    const { CLAUDE_MODEL } = require('../config/ia');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { ejemplo, extra } = schemas[tipoRecup];

    const prompt = `Eres un experto en educación colombiana. El estudiante falló una actividad sobre "${original.titulo}" (${original.materia}, grado ${original.grado}°). Genera una actividad de RECUPERACIÓN con preguntas diferentes pero sobre el mismo tema, para reforzar los conceptos que no dominó.

Tipo: ${tipoLabel}

RESPONDE SOLO CON JSON VÁLIDO, sin texto adicional ni markdown. Esquema exacto:
${ejemplo}

Reglas:
- ${extra}
- Español, apropiado para grado ${original.grado}° colombiano
- Preguntas claras, enfocadas en conceptos básicos del tema para afianzar comprensión`;

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1600,
      messages: [{ role: 'user', content: prompt }],
    });

    let texto = message.content[0].text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let contenido;
    try {
      contenido = JSON.parse(texto);
    } catch {
      return res.status(500).json({ error: 'La IA generó un formato inválido. Intenta de nuevo.' });
    }

    const [result] = await db.query(`
      INSERT INTO actividades (titulo, tipo, descripcion, contenido, docente_id, materia_id, grupo_id, periodo, intentos_permitidos, activa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2, TRUE)
    `, [
      `Recuperación: ${original.titulo}`,
      tipoRecup,
      'Actividad de recuperación generada automáticamente',
      JSON.stringify(contenido),
      original.docente_id,
      original.materia_id,
      original.grupo_id,
      original.periodo,
    ]);

    res.json({ data: { id: result.insertId, yaExistia: false } });
  } catch (err) {
    console.error('Error en generarRecuperacion:', err);
    res.status(500).json({ error: 'Error al generar la recuperación. Intenta de nuevo.' });
  }
}

// GET /api/actividades/banco — actividades del colegio de otros docentes
async function listarBanco(req, res) {
  const { materia_id, tipo } = req.query;
  const docenteId = req.usuario.id;
  const colegioId = req.usuario.colegio_id;

  let condiciones = 'g.colegio_id = ? AND a.activa = TRUE AND a.docente_id != ?';
  const params = [colegioId, docenteId];

  if (materia_id) { condiciones += ' AND a.materia_id = ?'; params.push(materia_id); }
  if (tipo)       { condiciones += ' AND a.tipo = ?';       params.push(tipo); }

  try {
    const [filas] = await db.query(`
      SELECT
        a.id, a.titulo, a.tipo, a.periodo, a.descripcion,
        m.nombre AS materia, m.codigo AS materia_codigo,
        g.nombre AS grupo, g.grado,
        u.nombre AS docente,
        COUNT(ra.id) AS veces_completada,
        ROUND(AVG(ra.nota), 1) AS nota_promedio
      FROM actividades a
      JOIN grupos   g ON g.id = a.grupo_id
      JOIN materias m ON m.id = a.materia_id
      JOIN usuarios u ON u.id = a.docente_id
      LEFT JOIN resultados_actividades ra ON ra.actividad_id = a.id
        AND ra.id = (
          SELECT rb.id FROM resultados_actividades rb
          WHERE rb.estudiante_id = ra.estudiante_id AND rb.actividad_id = ra.actividad_id
          ORDER BY rb.nota DESC, rb.completada_en DESC LIMIT 1
        )
      WHERE ${condiciones}
      GROUP BY a.id
      ORDER BY veces_completada DESC, a.creado_en DESC
      LIMIT 60
    `, params);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error en banco de actividades:', err);
    res.status(500).json({ error: 'Error al obtener el banco' });
  }
}

// POST /api/actividades/:id/copiar — copia una actividad al docente autenticado
async function copiarDelBanco(req, res) {
  const { id } = req.params;
  const { grupo_id, periodo, porcentaje } = req.body;
  const docenteId = req.usuario.id;
  const colegioId = req.usuario.colegio_id;

  if (!grupo_id || !periodo) {
    return res.status(400).json({ error: 'grupo_id y periodo son requeridos' });
  }

  try {
    // Verificar que el grupo pertenece al colegio del docente
    const [[grupo]] = await db.query(
      'SELECT id FROM grupos WHERE id = ? AND colegio_id = ?',
      [grupo_id, colegioId]
    );
    if (!grupo) return res.status(403).json({ error: 'Grupo no válido' });

    // Obtener la actividad original
    const [[original]] = await db.query(
      'SELECT titulo, tipo, descripcion, contenido, materia_id, intentos_permitidos, tiempo_limite_minutos FROM actividades WHERE id = ? AND activa = TRUE',
      [id]
    );
    if (!original) return res.status(404).json({ error: 'Actividad no encontrada' });

    const errorPorcentaje = await validarPorcentaje(porcentaje, grupo_id, original.materia_id, periodo);
    if (errorPorcentaje) return res.status(400).json({ error: errorPorcentaje });

    const [result] = await db.query(`
      INSERT INTO actividades
        (titulo, tipo, descripcion, contenido, docente_id, materia_id, grupo_id, periodo, porcentaje, intentos_permitidos, tiempo_limite_minutos, activa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `, [
      `${original.titulo} (copia)`,
      original.tipo,
      original.descripcion,
      original.contenido,
      docenteId,
      original.materia_id,
      grupo_id,
      periodo,
      parseFloat(porcentaje),
      original.intentos_permitidos || 1,
      original.tiempo_limite_minutos,
    ]);

    res.json({ data: { id: result.insertId, mensaje: 'Actividad copiada exitosamente' } });
  } catch (err) {
    console.error('Error al copiar actividad:', err);
    res.status(500).json({ error: 'Error al copiar la actividad' });
  }
}

// POST /api/actividades/:id/entregar — estudiante sube el archivo de su trabajo
// (actividades de tipo 'entrega_archivo'). Permite reemplazar el archivo mientras
// no haya sido calificado; una vez calificada, la entrega queda fija.
async function entregarArchivo(req, res) {
  const { id } = req.params;
  uploadEntrega(req, res, async (errMulter) => {
    if (errMulter) return res.status(400).json({ error: errMulter.message });
    if (!req.file) return res.status(400).json({ error: 'Debes adjuntar un archivo' });

    const borrarArchivoSubido = () => fs.unlink(req.file.path, () => {});

    try {
      const [acts] = await db.query('SELECT tipo FROM actividades WHERE id = ? AND activa = TRUE', [id]);
      if (acts.length === 0) {
        borrarArchivoSubido();
        return res.status(404).json({ error: 'Actividad no encontrada o inactiva' });
      }
      if (acts[0].tipo !== 'entrega_archivo') {
        borrarArchivoSubido();
        return res.status(400).json({ error: 'Esta actividad no acepta entrega de archivos' });
      }

      const [[existente]] = await db.query(
        `SELECT id, archivo_url, nota FROM resultados_actividades
         WHERE actividad_id = ? AND estudiante_id = ? ORDER BY completada_en DESC LIMIT 1`,
        [id, req.usuario.id]
      );
      if (existente && existente.nota !== null) {
        borrarArchivoSubido();
        return res.status(403).json({ error: 'Esta entrega ya fue calificada y no se puede reemplazar' });
      }

      if (existente) {
        if (existente.archivo_url) {
          fs.unlink(path.join(uploadsDirEntregas, existente.archivo_url), () => {});
        }
        await db.query(
          `UPDATE resultados_actividades
           SET archivo_url = ?, archivo_nombre_original = ?, completada_en = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [req.file.filename, req.file.originalname, existente.id]
        );
        return res.json({ mensaje: 'Entrega actualizada. Queda pendiente de revisión.', data: { id: existente.id } });
      }

      const [result] = await db.query(
        `INSERT INTO resultados_actividades
          (estudiante_id, actividad_id, respuestas, nota, archivo_url, archivo_nombre_original, intento_numero)
         VALUES (?, ?, '{}', NULL, ?, ?, 1)`,
        [req.usuario.id, id, req.file.filename, req.file.originalname]
      );
      res.status(201).json({ mensaje: 'Entrega registrada. Queda pendiente de revisión.', data: { id: result.insertId } });
    } catch (err) {
      borrarArchivoSubido();
      console.error('Error al registrar entrega:', err);
      res.status(500).json({ error: 'Error al registrar la entrega' });
    }
  });
}

// GET /api/actividades/:id/entregas — docente ve el estado de entrega de cada estudiante del grupo
async function listarEntregas(req, res) {
  const { id } = req.params;
  try {
    const [[act]] = await db.query('SELECT grupo_id, tipo FROM actividades WHERE id = ? AND docente_id = ?', [id, req.usuario.id]);
    if (!act) return res.status(404).json({ error: 'Actividad no encontrada' });
    if (act.tipo !== 'entrega_archivo') return res.status(400).json({ error: 'Esta actividad no es de tipo entrega de archivo' });

    const [filas] = await db.query(`
      SELECT u.id AS estudiante_id, u.nombre,
             ra.id AS resultado_id, ra.archivo_nombre_original, ra.nota, ra.comentario_docente, ra.completada_en
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      LEFT JOIN resultados_actividades ra ON ra.actividad_id = ? AND ra.estudiante_id = u.id
      WHERE eg.grupo_id = ?
      ORDER BY ${ordenApellido('u.nombre')} ASC
    `, [id, act.grupo_id]);

    res.json({ data: filas.map(f => ({ ...f, nota: f.nota !== null ? parseFloat(f.nota) : null })) });
  } catch (err) {
    console.error('Error al listar entregas:', err);
    res.status(500).json({ error: 'Error al obtener las entregas' });
  }
}

// POST /api/actividades/entregas/:resultadoId/calificar — docente califica una entrega puntual
async function calificarEntrega(req, res) {
  const { resultadoId } = req.params;
  const notaNum = parseFloat(req.body.nota);
  if (isNaN(notaNum) || notaNum < 1.0 || notaNum > 5.0) {
    return res.status(400).json({ error: 'La nota debe estar entre 1.0 y 5.0' });
  }
  try {
    const [[fila]] = await db.query(`
      SELECT ra.id, a.docente_id
      FROM resultados_actividades ra
      JOIN actividades a ON a.id = ra.actividad_id
      WHERE ra.id = ?
    `, [resultadoId]);
    if (!fila || fila.docente_id !== req.usuario.id) {
      return res.status(404).json({ error: 'Entrega no encontrada' });
    }
    await db.query(
      'UPDATE resultados_actividades SET nota = ?, comentario_docente = ? WHERE id = ?',
      [parseFloat(notaNum.toFixed(1)), req.body.comentario || null, resultadoId]
    );
    res.json({ mensaje: 'Entrega calificada' });
  } catch (err) {
    console.error('Error al calificar entrega:', err);
    res.status(500).json({ error: 'Error al calificar la entrega' });
  }
}

// GET /api/actividades/entregas/:resultadoId/archivo — descarga protegida:
// solo el docente dueño de la actividad o el estudiante dueño de la entrega
async function descargarEntrega(req, res) {
  const { resultadoId } = req.params;
  try {
    const [[fila]] = await db.query(`
      SELECT ra.archivo_url, ra.archivo_nombre_original, ra.estudiante_id, a.docente_id
      FROM resultados_actividades ra
      JOIN actividades a ON a.id = ra.actividad_id
      WHERE ra.id = ?
    `, [resultadoId]);
    if (!fila || !fila.archivo_url) return res.status(404).json({ error: 'Archivo no encontrado' });

    const autorizado = req.usuario.id === fila.estudiante_id || req.usuario.id === fila.docente_id;
    if (!autorizado) return res.status(403).json({ error: 'No autorizado' });

    const rutaArchivo = path.join(uploadsDirEntregas, fila.archivo_url);
    if (!fs.existsSync(rutaArchivo)) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.download(rutaArchivo, fila.archivo_nombre_original || fila.archivo_url);
  } catch (err) {
    console.error('Error al descargar entrega:', err);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
}

module.exports = {
  listarParaDocente,
  listarParaEstudiante,
  obtener,
  crear,
  actualizar,
  eliminar,
  responder,
  obtenerResultado,
  obtenerPendientes,
  generarConIA,
  misMaterias,
  libroCalificaciones,
  calificarManual,
  listarBanco,
  copiarDelBanco,
  generarRecuperacion,
  porcentajeDisponible,
  getComponentes,
  guardarComponentes,
  entregarArchivo,
  listarEntregas,
  calificarEntrega,
  descargarEntrega,
};
