import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconInbox } from '../components/Icons';

function filaExcelANota(fila) {
  return {
    numero_documento: String(fila['Número de documento *'] ?? '').trim(),
    materia_nombre:   String(fila['Materia *'] ?? '').trim(),
    ano_lectivo:      fila['Año lectivo *'],
    periodo:          fila['Período (1, 2 o 3) *'],
    nota:             fila['Nota (1.0 a 5.0) *'],
  };
}

export default function CargueHistorico() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  function descargarPlantilla() {
    const ejemplo1 = {
      'Número de documento *': '1002345678', 'Nombre del estudiante (referencia)': 'Juan Pérez Gómez',
      'Materia *': 'Matemáticas', 'Año lectivo *': 2024, 'Período (1, 2 o 3) *': 1, 'Nota (1.0 a 5.0) *': 4.2,
    };
    const ejemplo2 = {
      'Número de documento *': '1002345678', 'Nombre del estudiante (referencia)': 'Juan Pérez Gómez',
      'Materia *': 'Español', 'Año lectivo *': 2024, 'Período (1, 2 o 3) *': 1, 'Nota (1.0 a 5.0) *': 3.8,
    };
    const headers = Object.keys(ejemplo1);
    const ws = XLSX.utils.json_to_sheet([ejemplo1, ejemplo2], { header: headers });
    ws['!cols'] = headers.map(h => ({ wch: Math.max(18, Math.min(38, h.length)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    XLSX.writeFile(wb, 'plantilla_historico_calificaciones.xlsx');
  }

  function handleArchivo(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setNombreArchivo(archivo.name);
    setResultado(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });
        const notas = filas.map(filaExcelANota).filter(f => f.numero_documento && f.materia_nombre);
        setPreview(notas);
        if (notas.length === 0) {
          setError('No se encontraron filas válidas. Verifica que uses la plantilla y que Número de documento y Materia estén diligenciados.');
        }
      } catch {
        setError('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.');
      }
    };
    reader.readAsArrayBuffer(archivo);
  }

  async function handleImportar() {
    if (preview.length === 0) return;
    setGuardando(true); setError('');
    try {
      const resp = await axiosAuth.post('/api/calificaciones-historicas/importar', { filas: preview });
      setResultado(resp.data);
      setPreview([]);
      setNombreArchivo('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error en la importación');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Cargue de histórico de calificaciones" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Cargue de histórico de calificaciones</h2>
          <p style={es.subtitulo}>
            Importa notas de años anteriores (de antes de usar Playfesor) para que queden en el registro del estudiante.
            Solo aplica a estudiantes que ya existan en Playfesor — se buscan por número de documento.
          </p>
        </div>

        <div style={es.card}>
          <button type="button" onClick={descargarPlantilla} style={es.btnPlantilla}>
            ⬇ Descargar plantilla de ejemplo (.xlsx)
          </button>

          <div style={es.inputArchivoZona}>
            <input
              type="file"
              accept=".xlsx,.xls"
              id="inputHistorico"
              style={{ display: 'none' }}
              onChange={handleArchivo}
            />
            <label htmlFor="inputHistorico" style={es.btnArchivo}>
              {nombreArchivo || 'Seleccionar archivo Excel...'}
            </label>
          </div>

          {error && <div style={es.errorBox}>{error}</div>}

          {preview.length > 0 && (
            <>
              <p style={es.previewTexto}>{preview.length} fila{preview.length !== 1 ? 's' : ''} lista{preview.length !== 1 ? 's' : ''} para importar.</p>
              <div style={es.tablaScroll}>
                <table style={es.tabla}>
                  <thead>
                    <tr>
                      <th style={es.th}>Documento</th>
                      <th style={es.th}>Materia</th>
                      <th style={es.th}>Año</th>
                      <th style={es.th}>Período</th>
                      <th style={es.th}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 12).map((f, i) => (
                      <tr key={i}>
                        <td style={es.td}>{f.numero_documento}</td>
                        <td style={es.td}>{f.materia_nombre}</td>
                        <td style={es.td}>{f.ano_lectivo}</td>
                        <td style={es.td}>{f.periodo}</td>
                        <td style={es.td}>{f.nota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 12 && <p style={es.masFilas}>… y {preview.length - 12} filas más.</p>}
              </div>

              <button onClick={handleImportar} disabled={guardando} style={es.btnPrimario}>
                {guardando ? 'Importando...' : `Importar ${preview.length} fila${preview.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}

          {resultado && (
            <div style={(resultado.errores?.length ?? 0) === 0 ? es.exito : es.resultadoMixto}>
              <strong>{resultado.creados.length} nota{resultado.creados.length !== 1 ? 's' : ''} importada{resultado.creados.length !== 1 ? 's' : ''} correctamente.</strong>
              {resultado.errores?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>{resultado.errores.length} error{resultado.errores.length !== 1 ? 'es' : ''}:</strong>
                  <ul style={es.errorList}>
                    {resultado.errores.map((e, i) => (
                      <li key={i}>Fila {e.fila}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {preview.length === 0 && !resultado && (
            <div style={es.sinDatos}>
              <IconInbox size={40} style={{ color: '#ccc' }} />
              <p>Descarga la plantilla, complétala con las notas históricas y súbela aquí.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  encabezado: { marginBottom: '18px' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '8px 0 4px' },
  subtitulo: { fontSize: '13px', color: '#888', margin: 0, lineHeight: 1.5 },

  card: { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  btnPlantilla: { background: '#f0f0ff', border: '1px solid #c5b8f7', color: '#5c35c2', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 16px', borderRadius: '8px' },
  inputArchivoZona: { marginTop: '16px' },
  btnArchivo: { display: 'inline-block', padding: '10px 16px', borderRadius: '8px', border: '1.5px dashed #c0c0d0', color: '#555', fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit' },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginTop: '16px', fontSize: '13.5px' },
  previewTexto: { marginTop: '18px', fontSize: '13px', color: '#555', fontWeight: '600' },
  tablaScroll: { overflowX: 'auto', marginTop: '8px' },
  tabla: { width: '100%', borderCollapse: 'collapse', minWidth: '480px' },
  th: { padding: '9px 12px', fontSize: '11.5px', fontWeight: '700', color: '#6b7280', borderBottom: '1px solid #eef1f7', textAlign: 'left', background: '#fafbfe' },
  td: { padding: '9px 12px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #f5f7fb' },
  masFilas: { fontSize: '12px', color: '#999', marginTop: '6px' },

  btnPrimario: { marginTop: '16px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 22px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  exito: { marginTop: '16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '12px 16px', fontSize: '14px' },
  resultadoMixto: { marginTop: '16px', background: '#fff8e1', color: '#e65100', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', border: '1px solid #ffe082' },
  errorList: { margin: '6px 0 0', paddingLeft: '18px' },

  sinDatos: { marginTop: '20px', textAlign: 'center', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '30px 0' },
};
