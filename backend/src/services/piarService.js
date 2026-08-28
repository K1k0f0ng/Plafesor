'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const { CLAUDE_MODEL } = require('../config/ia');

const anthropic = new Anthropic();

const CAMPOS_PIAR = [
  { clave: 'contexto_estudiante',   titulo: 'CONTEXTO DEL ESTUDIANTE (hogar, aula, espacios, capacidades, gustos, intereses, apoyo familiar)' },
  { clave: 'valoracion_pedagogica', titulo: 'VALORACIÓN PEDAGÓGICA (barreras para el aprendizaje y la participación identificadas)' },
  { clave: 'informes_salud',        titulo: 'INFORMES DE PROFESIONALES DE LA SALUD (resumen de diagnósticos, si existen)' },
  { clave: 'objetivos_metas',       titulo: 'OBJETIVOS Y METAS DE APRENDIZAJE' },
  { clave: 'ajustes_curriculares',  titulo: 'AJUSTES CURRICULARES' },
  { clave: 'ajustes_didacticos',    titulo: 'AJUSTES DIDÁCTICOS' },
  { clave: 'ajustes_evaluativos',   titulo: 'AJUSTES EVALUATIVOS' },
  { clave: 'recursos_apoyos',       titulo: 'RECURSOS FÍSICOS, TECNOLÓGICOS Y DIDÁCTICOS' },
  { clave: 'proyectos_especificos', titulo: 'PROYECTOS ESPECÍFICOS NECESARIOS' },
  { clave: 'actividades_casa',      titulo: 'ACTIVIDADES EN CASA DURANTE RECESOS ESCOLARES' },
  { clave: 'seguimiento',           titulo: 'SEGUIMIENTO (temporalidad, responsables, medios)' },
];

const SYSTEM_PROMPT = `Eres un redactor pedagógico experto en educación inclusiva colombiana. Tu única función es dar formato profesional al Plan Individual de Ajustes Razonables (PIAR) de un estudiante, según el Decreto 1421 de 2017.

Fuente normativa exacta que debes respetar:
- Art. 2.3.3.5.1.4 núm. 11: el PIAR es la "herramienta utilizada para garantizar los procesos de enseñanza y aprendizaje de los estudiantes, basados en la valoración pedagógica y social".
- Art. 2.3.3.5.1.4 núm. 4: los ajustes razonables son las "acciones, adaptaciones, estrategias, apoyos, recursos o modificaciones necesarias y adecuadas del sistema educativo" para eliminar barreras.
- Art. 2.3.3.5.2.3.5: el PIAR debe contener como mínimo el contexto del estudiante, la valoración pedagógica, informes de profesionales de salud, objetivos y metas de aprendizaje, ajustes curriculares/didácticos/evaluativos, recursos, proyectos específicos, información relevante del proceso y actividades para la casa; lo elaboran los docentes de aula junto con el docente de apoyo, la familia y el estudiante; se elabora en el primer trimestre y se actualiza anualmente.

Reglas estrictas:
1. NO inventes ni supongas ningún diagnóstico, necesidad, barrera o dato que no esté explícitamente en la información entregada.
2. Usa exclusivamente la información real que te da el docente. Si una sección viene vacía, escribe literalmente "Pendiente de completar por el equipo de apoyo" en esa sección — no la redactes ni la completes con supuestos.
3. Organiza el documento en las mismas 11 secciones que recibes, con esos títulos exactos, en el mismo orden.
4. Tono formal, institucional, en español colombiano, orientado a garantizar el aprendizaje, la participación y la permanencia del estudiante.
5. Al final agrega una nota que diga: "Este documento es un borrador que debe ser revisado, ajustado y firmado por el docente de aula, el docente de apoyo pedagógico, la familia y el estudiante, conforme al Decreto 1421 de 2017."`;

function construirContexto(datos, campos) {
  return campos.map(c => {
    const valor = (datos[c.clave] || '').trim();
    return `${c.titulo}:\n${valor || '(sin información — el docente no diligenció este campo)'}`;
  }).join('\n\n');
}

async function generarBorradorPiar(datos) {
  const {
    estudianteNombre, grado, grupoNombre, colegioNombre, anioEscolar,
    docente_apoyo_nombre, docente_apoyo_observaciones,
  } = datos;

  const contexto = [
    `ESTUDIANTE: ${estudianteNombre}`,
    `GRADO: ${grado}° | GRUPO: ${grupoNombre} | COLEGIO: ${colegioNombre}`,
    `AÑO ESCOLAR: ${anioEscolar}`,
    docente_apoyo_nombre ? `DOCENTE DE APOYO PEDAGÓGICO: ${docente_apoyo_nombre}${docente_apoyo_observaciones ? ' — ' + docente_apoyo_observaciones : ''}` : null,
    '',
    construirContexto(datos, CAMPOS_PIAR),
  ].filter(Boolean).join('\n');

  const resp = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1400,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Redacta el Plan Individual de Ajustes Razonables (PIAR) con la información real a continuación:\n\n${contexto}`,
    }],
  });

  return resp.content[0]?.text?.trim() || '';
}

module.exports = { generarBorradorPiar, CAMPOS_PIAR };
