'use strict';
const PDFDocument = require('pdfkit');

function fechaHoy() {
  return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function esTituloSeccion(linea) {
  const t = linea.trim();
  return t.length > 0 && t.length < 90 && /^[A-ZÁÉÍÓÚÑ0-9°\s.,()/-]+:?$/.test(t) && /[A-ZÁÉÍÓÚÑ]/.test(t);
}

function dibujarPiar(doc, p) {
  const M = 50;
  const W = doc.page.width - M * 2;

  // Encabezado
  doc.fillColor('#667EEA').rect(M, 50, W, 60).fill();
  doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
     .text(p.colegio, M + 14, 60, { width: W - 100 });
  doc.fillColor('#D4CAFF').fontSize(9).font('Helvetica')
     .text('PIAR — Plan Individual de Ajustes Razonables (Decreto 1421 de 2017)', M + 14, 80, { width: W - 100 });
  doc.fillColor('#4A3AC0').rect(M + W - 80, 62, 66, 24).fill();
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
     .text(String(p.anio_escolar), M + W - 80, 69, { width: 66, align: 'center' });

  doc.y = 122;

  // Datos del estudiante
  doc.fillColor('#F8F9FF').rect(M, doc.y, W, 46).fill();
  doc.strokeColor('#E8EAF6').lineWidth(1).rect(M, doc.y, W, 46).stroke();
  const yInfo = doc.y;
  const cols = W / 3;
  const labels = ['ESTUDIANTE', 'GRADO Y GRUPO', 'FECHA DE GENERACIÓN'];
  const values = [p.estudiante, `${p.grado}° ${p.grupo}`, fechaHoy()];
  for (let i = 0; i < 3; i++) {
    const cx = M + i * cols + 10;
    doc.fillColor('#9E9E9E').fontSize(7.5).font('Helvetica-Bold').text(labels[i], cx, yInfo + 7, { width: cols - 20 });
    doc.fillColor('#1A1A2E').fontSize(11).font('Helvetica-Bold').text(values[i], cx, yInfo + 20, { width: cols - 20 });
  }
  doc.y = yInfo + 58;

  if (p.docente_apoyo_nombre) {
    doc.fillColor('#666666').fontSize(9).font('Helvetica-Bold')
       .text(`Docente de apoyo pedagógico: ${p.docente_apoyo_nombre}`, M, doc.y, { width: W });
    doc.moveDown(0.6);
  }

  // Cuerpo del documento
  const lineas = (p.documento_generado || '').split('\n');
  for (const linea of lineas) {
    if (doc.y > doc.page.height - 140) doc.addPage();
    const t = linea.trim();
    if (!t) { doc.moveDown(0.4); continue; }
    if (esTituloSeccion(t)) {
      doc.moveDown(0.5);
      doc.fillColor('#667EEA').fontSize(10.5).font('Helvetica-Bold').text(t, M, doc.y, { width: W });
      doc.moveDown(0.2);
    } else {
      doc.fillColor('#333333').fontSize(10).font('Helvetica').text(t, M, doc.y, { width: W, align: 'justify' });
    }
  }

  // Acta de firmas
  if (doc.y > doc.page.height - 170) doc.addPage();
  doc.moveDown(1.5);
  doc.strokeColor('#E0E0E0').lineWidth(0.8).moveTo(M, doc.y).lineTo(M + W, doc.y).stroke();
  doc.moveDown(0.8);
  doc.fillColor('#555555').fontSize(9.5).font('Helvetica-Bold').text('ACTA DE ACUERDO Y FIRMAS', M, doc.y, { width: W });
  doc.moveDown(2.2);

  const firmaY = doc.y;
  const sigW = (W - 30) / 2;
  const firmas = ['Docente de aula', 'Docente de apoyo pedagógico', 'Familia / Acudiente', 'Estudiante'];
  for (let i = 0; i < firmas.length; i++) {
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const sx = M + col * (sigW + 30);
    const sy = firmaY + fila * 46;
    doc.strokeColor('#444444').lineWidth(1).moveTo(sx, sy + 28).lineTo(sx + sigW, sy + 28).stroke();
    doc.fillColor('#666666').fontSize(8.5).font('Helvetica').text(firmas[i], sx, sy + 32, { width: sigW, align: 'center' });
  }
  doc.y = firmaY + 46 * 2 + 10;

  doc.moveDown(1);
  doc.strokeColor('#F0F0F0').lineWidth(0.5).moveTo(M, doc.y).lineTo(M + W, doc.y).stroke();
  doc.moveDown(0.4);
  doc.fillColor('#BBBBBB').fontSize(7.5).font('Helvetica')
     .text(`Documento generado por Playfesor · ${p.colegio} · ${fechaHoy()} — Borrador sujeto a validación conforme al Decreto 1421 de 2017`,
       M, doc.y, { width: W, align: 'center' });
}

function generarPiarPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: { Title: `PIAR - ${data.estudiante}`, Author: 'Playfesor' },
      autoFirstPage: true,
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    dibujarPiar(doc, data);

    doc.end();
  });
}

module.exports = { generarPiarPDF };
