'use strict';
const PDFDocument = require('pdfkit');

const NIVEL = {
  'Superior':      { bg: '#E3F2FD', text: '#1565C0' },
  'Alto':          { bg: '#E8F5E9', text: '#2E7D32' },
  'Básico':        { bg: '#FFFDE7', text: '#F57F17' },
  'Bajo':          { bg: '#FFEBEE', text: '#C62828' },
  'Sin calificar': { bg: '#F5F5F5', text: '#9E9E9E' },
};

function notaColor(nota) {
  if (nota == null) return '#AAAAAA';
  if (nota >= 4.0) return '#2E7D32';
  if (nota >= 3.5) return '#F57F17';
  return '#C62828';
}

function fechaHoy() {
  return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function dibujarBoletin(doc, b) {
  const M = 50;
  const W = doc.page.width - M * 2; // 495 pts en A4
  let y = 50;

  // ── ENCABEZADO ───────────────────────────────────────────────────────────────
  doc.fillColor('#667EEA').rect(M, y, W, 64).fill();

  doc.fillColor('#FFFFFF').fontSize(15).font('Helvetica-Bold')
     .text(b.colegio.nombre, M + 12, y + 10, { width: W - 110, lineBreak: false });
  doc.fillColor('#D4CAFF').fontSize(9).font('Helvetica')
     .text('Boletín de Desempeño Académico · Año 2026', M + 12, y + 32, { lineBreak: false });

  // Chip período (derecha)
  doc.fillColor('#4A3AC0').rect(M + W - 90, y + 16, 80, 26).fill();
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
     .text(`Período ${b.periodo}`, M + W - 90, y + 22, { width: 80, align: 'center' });

  y += 72;

  // ── DATOS DEL ESTUDIANTE ─────────────────────────────────────────────────────
  doc.fillColor('#F8F9FF').rect(M, y, W, 50).fill();
  doc.strokeColor('#E8EAF6').lineWidth(1).rect(M, y, W, 50).stroke();

  const cols = W / 4;
  const labels = ['ESTUDIANTE', 'GRADO', 'GRUPO', 'FECHA'];
  const values = [b.estudiante.nombre, `${b.grupo.grado}°`, b.grupo.nombre, fechaHoy()];
  for (let i = 0; i < 4; i++) {
    const cx = M + i * cols + 10;
    doc.fillColor('#9E9E9E').fontSize(7.5).font('Helvetica-Bold')
       .text(labels[i], cx, y + 8, { width: cols - 20, lineBreak: false });
    doc.fillColor('#1A1A2E').fontSize(11).font('Helvetica-Bold')
       .text(values[i], cx, y + 22, { width: cols - 20, lineBreak: false });
  }

  y += 60;

  // ── SECCIÓN: DESEMPEÑO POR ÁREA ──────────────────────────────────────────────
  doc.fillColor('#667EEA').fontSize(7.5).font('Helvetica-Bold')
     .text('DESEMPEÑO POR ÁREA', M, y, { lineBreak: false });
  y += 13;

  // Columnas de la tabla
  const cMat  = 185;
  const cNota =  52;
  const cNivel =  88;
  const cDoc  = 120;
  const cAct  = W - cMat - cNota - cNivel - cDoc;

  // Header de tabla
  doc.fillColor('#F8F9FF').rect(M, y, W, 20).fill();
  doc.strokeColor('#EEEFF3').lineWidth(0.5).rect(M, y, W, 20).stroke();

  doc.fillColor('#666666').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Área / Asignatura',
    M + 6, y + 6, { width: cMat - 12, lineBreak: false });
  doc.text('Nota',
    M + cMat + 6, y + 6, { width: cNota - 12, align: 'center', lineBreak: false });
  doc.text('Desempeño',
    M + cMat + cNota + 6, y + 6, { width: cNivel, align: 'center', lineBreak: false });
  doc.text('Docente',
    M + cMat + cNota + cNivel + 6, y + 6, { width: cDoc - 12, lineBreak: false });
  doc.text('Act.',
    M + cMat + cNota + cNivel + cDoc + 6, y + 6, { width: cAct - 12, align: 'center', lineBreak: false });
  y += 20;

  // Filas de materias
  for (const m of b.materias) {
    doc.strokeColor('#F0F0F0').lineWidth(0.3).rect(M, y, W, 20).stroke();

    doc.fillColor('#333333').fontSize(10).font('Helvetica')
       .text(m.materia_nombre, M + 6, y + 5, { width: cMat - 12, lineBreak: false });

    doc.fillColor(notaColor(m.nota_promedio)).fontSize(11).font('Helvetica-Bold')
       .text(m.nota_promedio != null ? String(m.nota_promedio) : '—',
             M + cMat + 6, y + 4, { width: cNota - 12, align: 'center', lineBreak: false });

    // Badge de nivel
    const nv = NIVEL[m.nivel] || NIVEL['Sin calificar'];
    doc.fillColor(nv.bg).rect(M + cMat + cNota + 10, y + 4, cNivel - 20, 12).fill();
    doc.fillColor(nv.text).fontSize(7.5).font('Helvetica-Bold')
       .text(m.nivel, M + cMat + cNota + 10, y + 6, { width: cNivel - 20, align: 'center', lineBreak: false });

    doc.fillColor('#666666').fontSize(8.5).font('Helvetica')
       .text(m.docente_nombre || '—',
             M + cMat + cNota + cNivel + 6, y + 5, { width: cDoc - 12, lineBreak: false });
    doc.fillColor('#888888').fontSize(9).font('Helvetica')
       .text(`${m.actividades_calificadas}/${m.total_actividades}`,
             M + cMat + cNota + cNivel + cDoc + 6, y + 5, { width: cAct - 12, align: 'center', lineBreak: false });

    y += 20;
  }

  // Fila promedio general
  doc.fillColor('#F8F9FF').rect(M, y, W, 26).fill();
  doc.strokeColor('#667EEA').lineWidth(1.5).rect(M, y, W, 26).stroke();

  doc.fillColor('#1A1A2E').fontSize(10).font('Helvetica-Bold')
     .text('PROMEDIO GENERAL', M + 6, y + 8, { lineBreak: false });

  doc.fillColor(notaColor(b.promedio_general)).fontSize(13).font('Helvetica-Bold')
     .text(b.promedio_general != null ? String(b.promedio_general) : '—',
           M + cMat + 6, y + 6, { width: cNota - 12, align: 'center', lineBreak: false });

  if (b.nivel_general) {
    const ngv = NIVEL[b.nivel_general] || NIVEL['Sin calificar'];
    doc.fillColor(ngv.bg).rect(M + cMat + cNota + 10, y + 6, cNivel - 20, 14).fill();
    doc.fillColor(ngv.text).fontSize(8).font('Helvetica-Bold')
       .text(b.nivel_general, M + cMat + cNota + 10, y + 9, { width: cNivel - 20, align: 'center', lineBreak: false });
  }

  y += 34;

  // ── ASISTENCIA ───────────────────────────────────────────────────────────────
  doc.fillColor('#667EEA').fontSize(7.5).font('Helvetica-Bold')
     .text('ASISTENCIA', M, y, { lineBreak: false });
  y += 13;

  const asItems = [
    { label: 'Presentes',    valor: b.asistencia.presentes,    color: '#2E7D32' },
    { label: 'Ausencias',    valor: b.asistencia.ausentes,     color: '#C62828' },
    { label: 'Tardanzas',    valor: b.asistencia.tardanzas,    color: '#F57F17' },
    { label: 'Justificados', valor: b.asistencia.justificados, color: '#1565C0' },
    {
      label: 'Tasa',
      valor: b.asistencia.tasa_asistencia != null ? `${b.asistencia.tasa_asistencia}%` : '—',
      color: '#667EEA',
      isTasa: true,
    },
  ];
  const aW = (W - 16) / 5;
  for (let i = 0; i < 5; i++) {
    const ax = M + i * (aW + 4);
    const { isTasa } = asItems[i];
    doc.fillColor(isTasa ? '#F3F4FF' : '#FAFAFA').rect(ax, y, aW, 44).fill();
    doc.strokeColor(isTasa ? '#667EEA' : '#F0F0F0').lineWidth(isTasa ? 1.5 : 0.5).rect(ax, y, aW, 44).stroke();
    doc.fillColor(asItems[i].color).fontSize(16).font('Helvetica-Bold')
       .text(String(asItems[i].valor), ax + 2, y + 6, { width: aW - 4, align: 'center', lineBreak: false });
    doc.fillColor('#999999').fontSize(7).font('Helvetica')
       .text(asItems[i].label.toUpperCase(), ax + 2, y + 30, { width: aW - 4, align: 'center', lineBreak: false });
  }

  y += 54;

  // ── ESCALA MEN ───────────────────────────────────────────────────────────────
  doc.fillColor('#FAFAFA').rect(M, y, W, 20).fill();
  doc.strokeColor('#F0F0F0').lineWidth(0.5).rect(M, y, W, 20).stroke();

  doc.fillColor('#666666').fontSize(8).font('Helvetica-Bold')
     .text('Escala MEN:', M + 8, y + 6, { lineBreak: false });

  const escala = [
    { n: 'Superior', r: '≥ 4.6', ...NIVEL['Superior'] },
    { n: 'Alto',     r: '≥ 4.0', ...NIVEL['Alto'] },
    { n: 'Básico',   r: '≥ 3.5', ...NIVEL['Básico'] },
    { n: 'Bajo',     r: '< 3.5', ...NIVEL['Bajo'] },
  ];
  let ex = M + 78;
  for (const e of escala) {
    doc.fillColor(e.bg).rect(ex, y + 3, 76, 14).fill();
    doc.fillColor(e.text).fontSize(7.5).font('Helvetica-Bold')
       .text(`${e.n} ${e.r}`, ex + 2, y + 6, { width: 72, align: 'center', lineBreak: false });
    ex += 80;
  }

  y += 28;

  // ── OBSERVACIONES ────────────────────────────────────────────────────────────
  doc.fillColor('#555555').fontSize(8.5).font('Helvetica-Bold')
     .text('Observaciones del período:', M, y, { lineBreak: false });
  y += 14;
  for (let i = 0; i < 3; i++) {
    doc.strokeColor('#E0E0E0').lineWidth(0.8).moveTo(M, y).lineTo(M + W, y).stroke();
    y += 20;
  }
  y += 8;

  // ── FIRMAS ───────────────────────────────────────────────────────────────────
  const sigW = (W - 40) / 3;
  const sigLabels = ['Director(a) de Grupo', 'Rector(a)', 'Firma del Acudiente'];
  for (let i = 0; i < 3; i++) {
    const sx = M + i * (sigW + 20);
    doc.strokeColor('#444444').lineWidth(1).moveTo(sx, y + 32).lineTo(sx + sigW, y + 32).stroke();
    doc.fillColor('#666666').fontSize(8.5).font('Helvetica')
       .text(sigLabels[i], sx, y + 36, { width: sigW, align: 'center', lineBreak: false });
  }
  y += 52;

  // ── PIE ──────────────────────────────────────────────────────────────────────
  doc.strokeColor('#F0F0F0').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
  doc.fillColor('#BBBBBB').fontSize(7.5).font('Helvetica')
     .text(
       `Documento generado por Playfesor · ${b.colegio.nombre} · ${fechaHoy()}`,
       M, y + 6, { width: W, align: 'center', lineBreak: false }
     );
}

function generarPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: { Title: 'Boletín Playfesor', Author: 'Playfesor' },
      autoFirstPage: true,
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const boletines = Array.isArray(data) ? data : [data];
    boletines.forEach((b, i) => {
      if (i > 0) doc.addPage();
      dibujarBoletin(doc, b);
    });

    doc.end();
  });
}

module.exports = { generarPDF };
