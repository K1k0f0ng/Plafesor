import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { Avatar, FichaBasicaContenido } from '../components/FichaEstudiante';
import { FichaMedicaEditor } from '../components/FichaMedica';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

const TIPOS_DOC_ESTUDIANTE = [
  { value: 'RC', label: 'Registro Civil de Nacimiento' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
];
const TIPOS_DOC_ACUDIENTE = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
];
const GENEROS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'Otro', label: 'Otro' },
];

const FORM_VACIO = {
  // Datos del alumno
  nombre: '', email: '', password: '',
  tipo_documento: '', numero_documento: '', lugar_expedicion_documento: '',
  fecha_nacimiento: '', lugar_nacimiento: '', genero: '', grupo_sanguineo: '',
  direccion: '', barrio: '', ciudad: '', comuna: '', eps_sisben: '',
  grupo_id: '', telefono_padres: '', telefono: '', celular: '', requiere_piar: false,
  // Datos poblacionales especiales (si aplica)
  discapacidad: '', grupo_etnico: '', victima_conflicto: false,
  // Datos de matrícula / procedencia (SIMAT)
  codigo_matricula: '', estudiante_nuevo: true, colegio_procedencia: '', anio_procedencia: '',
  // Datos del acudiente (opcional)
  acudiente_nombre: '', acudiente_parentesco: '',
  acudiente_tipo_documento: '', acudiente_numero_documento: '',
  acudiente_email: '', acudiente_password: '',
};

// Columnas de la plantilla Excel, en el mismo orden en que se generan y se leen.
const COLUMNAS_EXCEL = [
  { header: 'Nombre completo *',                              campo: 'nombre' },
  { header: 'Correo electrónico *',                            campo: 'email' },
  { header: 'Contraseña *',                                    campo: 'password' },
  { header: 'Tipo de documento (RC/TI/CC/CE)',                 campo: 'tipo_documento' },
  { header: 'Número de documento',                             campo: 'numero_documento' },
  { header: 'Lugar de expedición del documento',               campo: 'lugar_expedicion_documento' },
  { header: 'Código de matrícula',                             campo: 'codigo_matricula' },
  { header: 'Fecha de nacimiento (AAAA-MM-DD)',                campo: 'fecha_nacimiento' },
  { header: 'Lugar de nacimiento',                             campo: 'lugar_nacimiento' },
  { header: 'Género (M/F/Otro)',                                campo: 'genero' },
  { header: 'Grupo sanguíneo (RH)',                             campo: 'grupo_sanguineo' },
  { header: 'Dirección de residencia',                         campo: 'direccion' },
  { header: 'Barrio',                                          campo: 'barrio' },
  { header: 'Ciudad',                                          campo: 'ciudad' },
  { header: 'Comuna',                                          campo: 'comuna' },
  { header: 'EPS o Sisbén',                                    campo: 'eps_sisben' },
  { header: 'Teléfono fijo',                                   campo: 'telefono' },
  { header: 'Celular',                                         campo: 'celular' },
  { header: 'Teléfono de contacto (WhatsApp)',                 campo: 'telefono_padres' },
  { header: 'Requiere PIAR (Sí/No)',                            campo: 'requiere_piar' },
  { header: 'Estudiante nuevo (Sí/No)',                         campo: 'estudiante_nuevo' },
  { header: 'Colegio de procedencia',                          campo: 'colegio_procedencia' },
  { header: 'Año de procedencia',                               campo: 'anio_procedencia' },
  { header: 'Discapacidad o capacidad excepcional (si aplica)', campo: 'discapacidad' },
  { header: 'Grupo étnico o resguardo indígena (si aplica)',   campo: 'grupo_etnico' },
  { header: 'Víctima de conflicto armado (Sí/No)',              campo: 'victima_conflicto' },
  { header: 'Nombre del acudiente',                            campo: 'acudiente_nombre' },
  { header: 'Parentesco del acudiente',                        campo: 'acudiente_parentesco' },
  { header: 'Tipo doc. del acudiente (CC/CE)',                 campo: 'acudiente_tipo_documento' },
  { header: 'Número doc. del acudiente',                       campo: 'acudiente_numero_documento' },
  { header: 'Correo del acudiente (opcional, crea su acceso)', campo: 'acudiente_email' },
  { header: 'Contraseña del acudiente (opcional)',              campo: 'acudiente_password' },
];

function normalizarTipoDoc(v, validos) {
  const up = String(v || '').trim().toUpperCase();
  return validos.includes(up) ? up : null;
}
function normalizarGenero(v) {
  const t = String(v || '').trim().toUpperCase();
  if (!t) return null;
  if (t.startsWith('M')) return 'M';
  if (t.startsWith('F')) return 'F';
  return 'Otro';
}
function normalizarSiNo(v) {
  return /^s(i|í)$/i.test(String(v || '').trim());
}
function normalizarFecha(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return null;
}

function filaExcelAEstudiante(row) {
  const val = campo => {
    const columna = COLUMNAS_EXCEL.find(c => c.campo === campo);
    const v = row[columna.header];
    return v === undefined || v === null ? '' : String(v).trim();
  };
  return {
    nombre: val('nombre'),
    email: val('email'),
    password: val('password') || '123456',
    tipo_documento: normalizarTipoDoc(val('tipo_documento'), ['RC', 'TI', 'CC', 'CE']),
    numero_documento: val('numero_documento') || null,
    lugar_expedicion_documento: val('lugar_expedicion_documento') || null,
    codigo_matricula: val('codigo_matricula') || null,
    fecha_nacimiento: normalizarFecha(row[COLUMNAS_EXCEL.find(c => c.campo === 'fecha_nacimiento').header]),
    lugar_nacimiento: val('lugar_nacimiento') || null,
    genero: normalizarGenero(val('genero')),
    grupo_sanguineo: val('grupo_sanguineo') || null,
    direccion: val('direccion') || null,
    barrio: val('barrio') || null,
    ciudad: val('ciudad') || null,
    comuna: val('comuna') || null,
    eps_sisben: val('eps_sisben') || null,
    telefono: val('telefono') || null,
    celular: val('celular') || null,
    telefono_padres: val('telefono_padres') || null,
    requiere_piar: normalizarSiNo(val('requiere_piar')),
    discapacidad: val('discapacidad') || null,
    grupo_etnico: val('grupo_etnico') || null,
    victima_conflicto: normalizarSiNo(val('victima_conflicto')),
    estudiante_nuevo: val('estudiante_nuevo') ? normalizarSiNo(val('estudiante_nuevo')) : true,
    colegio_procedencia: val('colegio_procedencia') || null,
    anio_procedencia: val('anio_procedencia') || null,
    acudiente_nombre: val('acudiente_nombre') || null,
    acudiente_parentesco: val('acudiente_parentesco') || null,
    acudiente_tipo_documento: normalizarTipoDoc(val('acudiente_tipo_documento'), ['CC', 'CE']),
    acudiente_numero_documento: val('acudiente_numero_documento') || null,
    acudiente_email: val('acudiente_email') || null,
    acudiente_password: val('acudiente_password') || null,
  };
}

// Campos compartidos entre "Agregar individual" y el panel de edición.
// Definidos fuera de Estudiantes() a propósito: si vivieran dentro, React los
// trataría como un tipo de componente nuevo en cada render y perdería el foco
// del input en cada tecla.
function CamposAlumno({ valores, set, grupos }) {
  return (
    <>
      <input type="text" placeholder="Nombres y apellidos completos *" required value={valores.nombre}
        onChange={e => set({ ...valores, nombre: e.target.value })} style={es.input} />
      <input type="email" placeholder="Correo electrónico *" required value={valores.email}
        onChange={e => set({ ...valores, email: e.target.value })} style={es.input} />
      <select value={valores.grupo_id} onChange={e => set({ ...valores, grupo_id: e.target.value })} style={es.select}>
        <option value="">— Grado / grupo al que ingresa —</option>
        {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
      </select>
      <select value={valores.tipo_documento} onChange={e => set({ ...valores, tipo_documento: e.target.value })} style={es.select}>
        <option value="">— Tipo de documento —</option>
        {TIPOS_DOC_ESTUDIANTE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input type="text" placeholder="Número de documento" value={valores.numero_documento}
        onChange={e => set({ ...valores, numero_documento: e.target.value })} style={es.input} />
      <input type="text" placeholder="Lugar de expedición del documento" value={valores.lugar_expedicion_documento}
        onChange={e => set({ ...valores, lugar_expedicion_documento: e.target.value })} style={es.input} />
      <label style={es.campoConLabel}>
        <span style={es.miniLabel}>Fecha de nacimiento</span>
        <input type="date" value={valores.fecha_nacimiento}
          onChange={e => set({ ...valores, fecha_nacimiento: e.target.value })} style={es.input} />
      </label>
      <input type="text" placeholder="Lugar de nacimiento" value={valores.lugar_nacimiento}
        onChange={e => set({ ...valores, lugar_nacimiento: e.target.value })} style={es.input} />
      <select value={valores.genero} onChange={e => set({ ...valores, genero: e.target.value })} style={es.select}>
        <option value="">— Género —</option>
        {GENEROS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
      <input type="text" placeholder="Grupo sanguíneo (RH) — ej. O+" value={valores.grupo_sanguineo}
        onChange={e => set({ ...valores, grupo_sanguineo: e.target.value })} style={{ ...es.input, maxWidth: '160px' }} />
      <input type="text" placeholder="Dirección de residencia" value={valores.direccion}
        onChange={e => set({ ...valores, direccion: e.target.value })} style={{ ...es.input, flexBasis: '100%' }} />
      <input type="text" placeholder="Barrio" value={valores.barrio}
        onChange={e => set({ ...valores, barrio: e.target.value })} style={es.input} />
      <input type="text" placeholder="Ciudad" value={valores.ciudad}
        onChange={e => set({ ...valores, ciudad: e.target.value })} style={es.input} />
      <input type="text" placeholder="Comuna" value={valores.comuna}
        onChange={e => set({ ...valores, comuna: e.target.value })} style={{ ...es.input, maxWidth: '140px' }} />
      <input type="text" placeholder="EPS o Sisbén" value={valores.eps_sisben}
        onChange={e => set({ ...valores, eps_sisben: e.target.value })} style={es.input} />
      <input type="tel" placeholder="Teléfono fijo" value={valores.telefono}
        onChange={e => set({ ...valores, telefono: e.target.value })} style={es.input} />
      <input type="tel" placeholder="Celular" value={valores.celular}
        onChange={e => set({ ...valores, celular: e.target.value })} style={es.input} />
      <input type="tel" placeholder="Teléfono de contacto — WhatsApp (opcional)" value={valores.telefono_padres}
        onChange={e => set({ ...valores, telefono_padres: e.target.value })} style={es.input} />
      <label style={{ ...es.checkboxRow, flexBasis: '100%' }}>
        <input type="checkbox" checked={valores.requiere_piar} onChange={e => set({ ...valores, requiere_piar: e.target.checked })} />
        Requiere PIAR (Plan Individual de Ajustes Razonables — Decreto 1421 de 2017)
      </label>
    </>
  );
}

function CamposPoblacionales({ valores, set }) {
  return (
    <>
      <input type="text" placeholder="Discapacidad o capacidad excepcional (si aplica)" value={valores.discapacidad}
        onChange={e => set({ ...valores, discapacidad: e.target.value })} style={{ ...es.input, flexBasis: '100%' }} />
      <input type="text" placeholder="Grupo étnico o resguardo indígena (si aplica)" value={valores.grupo_etnico}
        onChange={e => set({ ...valores, grupo_etnico: e.target.value })} style={{ ...es.input, flexBasis: '48%' }} />
      <label style={es.checkboxRow}>
        <input type="checkbox" checked={valores.victima_conflicto} onChange={e => set({ ...valores, victima_conflicto: e.target.checked })} />
        Víctima del conflicto armado / desplazamiento forzado
      </label>
    </>
  );
}

function CamposProcedencia({ valores, set }) {
  return (
    <>
      <input type="text" placeholder="Código de matrícula" value={valores.codigo_matricula}
        onChange={e => set({ ...valores, codigo_matricula: e.target.value })} style={es.input} />
      <input type="text" placeholder="Colegio de procedencia (si viene de otra institución)" value={valores.colegio_procedencia}
        onChange={e => set({ ...valores, colegio_procedencia: e.target.value })} style={es.input} />
      <input type="text" placeholder="Año de procedencia — ej. 2023-2024" value={valores.anio_procedencia}
        onChange={e => set({ ...valores, anio_procedencia: e.target.value })} style={{ ...es.input, maxWidth: '160px' }} />
      <label style={{ ...es.checkboxRow, flexBasis: '100%' }}>
        <input type="checkbox" checked={valores.estudiante_nuevo} onChange={e => set({ ...valores, estudiante_nuevo: e.target.checked })} />
        Estudiante nuevo en la institución este año lectivo
      </label>
    </>
  );
}

function CamposAcudiente({ valores, set }) {
  return (
    <>
      <input type="text" placeholder="Nombre completo del acudiente" value={valores.acudiente_nombre}
        onChange={e => set({ ...valores, acudiente_nombre: e.target.value })} style={es.input} />
      <input type="text" placeholder="Parentesco (padre, madre, tutor...)" value={valores.acudiente_parentesco}
        onChange={e => set({ ...valores, acudiente_parentesco: e.target.value })} style={es.input} />
      <select value={valores.acudiente_tipo_documento} onChange={e => set({ ...valores, acudiente_tipo_documento: e.target.value })} style={es.select}>
        <option value="">— Tipo de documento —</option>
        {TIPOS_DOC_ACUDIENTE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input type="text" placeholder="Número de documento" value={valores.acudiente_numero_documento}
        onChange={e => set({ ...valores, acudiente_numero_documento: e.target.value })} style={es.input} />
      <input type="email" placeholder="Correo del acudiente (opcional)" value={valores.acudiente_email}
        onChange={e => set({ ...valores, acudiente_email: e.target.value })} style={es.input} />
      <input type="password" placeholder="Contraseña del acudiente (opcional)" value={valores.acudiente_password}
        onChange={e => set({ ...valores, acudiente_password: e.target.value })} style={es.input} />
      <p style={{ ...es.ayudaCSV, flexBasis: '100%', margin: '2px 0 0' }}>
        Si diligencias el correo y la contraseña, el acudiente podrá entrar a la plataforma a ver las notas,
        asistencia y alertas de su hijo/a. Si el correo ya tiene una cuenta de acudiente, solo se vincula a este estudiante.
      </p>
    </>
  );
}

export default function Estudiantes() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [tab, setTab] = useState('individual');
  const [form, setForm] = useState(FORM_VACIO);
  const [editando,   setEditando]   = useState(null);
  const [editForm,   setEditForm]   = useState(FORM_VACIO);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Ficha básica (foto, curso, acudiente, director de grupo)
  const [fichaEstudiante, setFichaEstudiante] = useState(null);
  const [fichaDatos, setFichaDatos] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);

  // Ficha médica (peso, alergias, contactos de emergencia, etc.)
  const [fichaMedicaEstudiante, setFichaMedicaEstudiante] = useState(null);
  const [fichaMedicaDatos, setFichaMedicaDatos] = useState({});
  const [cargandoFichaMedica, setCargandoFichaMedica] = useState(false);
  const [guardandoFichaMedica, setGuardandoFichaMedica] = useState(false);
  const [errorFichaMedica, setErrorFichaMedica] = useState('');

  // Importación masiva (Excel)
  const [excelGrupoId, setExcelGrupoId] = useState('');
  const [excelPreview, setExcelPreview] = useState([]);
  const [excelNombreArchivo, setExcelNombreArchivo] = useState('');
  const [excelResultado, setExcelResultado] = useState(null);

  const navigate = useNavigate();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [rEst, rGru] = await Promise.all([
        axiosAuth.get('/api/estudiantes'),
        axiosAuth.get('/api/grupos'),
      ]);
      setEstudiantes(rEst.data.data);
      setGrupos(rGru.data.data);
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  }

  async function handleCrearIndividual(e) {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await axiosAuth.post('/api/estudiantes', form);
      setForm(FORM_VACIO);
      setFiltroGrupo('');
      setMensaje('Estudiante creado correctamente');
      await cargar();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el estudiante');
    } finally {
      setGuardando(false);
    }
  }

  function descargarPlantilla() {
    const ejemplo1 = {
      'Nombre completo *': 'Juan Pérez Gómez', 'Correo electrónico *': 'juan.perez@correo.com', 'Contraseña *': 'clave123',
      'Tipo de documento (RC/TI/CC/CE)': 'TI', 'Número de documento': '1002345678',
      'Lugar de expedición del documento': 'Bogotá D.C.', 'Código de matrícula': '2026001',
      'Fecha de nacimiento (AAAA-MM-DD)': '2013-05-14', 'Lugar de nacimiento': 'Bogotá D.C.',
      'Género (M/F/Otro)': 'M', 'Grupo sanguíneo (RH)': 'O+',
      'Dirección de residencia': 'Calle 45 # 12-30', 'Barrio': 'Centro', 'Ciudad': 'Bogotá D.C.', 'Comuna': '',
      'EPS o Sisbén': 'Nueva EPS', 'Teléfono fijo': '', 'Celular': '3001234567',
      'Teléfono de contacto (WhatsApp)': '3001234567', 'Requiere PIAR (Sí/No)': 'No',
      'Discapacidad o capacidad excepcional (si aplica)': '', 'Grupo étnico o resguardo indígena (si aplica)': '',
      'Víctima de conflicto armado (Sí/No)': 'No',
      'Estudiante nuevo (Sí/No)': 'Sí', 'Colegio de procedencia': '', 'Año de procedencia': '',
      'Nombre del acudiente': 'María Gómez', 'Parentesco del acudiente': 'Madre',
      'Tipo doc. del acudiente (CC/CE)': 'CC', 'Número doc. del acudiente': '52123456',
      'Correo del acudiente (opcional, crea su acceso)': 'maria.gomez@correo.com',
      'Contraseña del acudiente (opcional)': 'clave456',
    };
    const ejemplo2 = {
      'Nombre completo *': 'Sara López Ruiz', 'Correo electrónico *': 'sara.lopez@correo.com', 'Contraseña *': 'clave789',
      'Tipo de documento (RC/TI/CC/CE)': 'TI', 'Número de documento': '1002345679',
      'Lugar de expedición del documento': 'Cali', 'Código de matrícula': '2026002',
      'Fecha de nacimiento (AAAA-MM-DD)': '2012-11-02', 'Lugar de nacimiento': 'Medellín, Antioquia',
      'Género (M/F/Otro)': 'F', 'Grupo sanguíneo (RH)': 'A+',
      'Dirección de residencia': 'Carrera 8 # 20-15', 'Barrio': 'La Flora', 'Ciudad': 'Cali', 'Comuna': '2',
      'EPS o Sisbén': 'Sisbén nivel 2', 'Teléfono fijo': '', 'Celular': '3009876543',
      'Teléfono de contacto (WhatsApp)': '3009876543', 'Requiere PIAR (Sí/No)': 'No',
      'Discapacidad o capacidad excepcional (si aplica)': '', 'Grupo étnico o resguardo indígena (si aplica)': 'Indígena',
      'Víctima de conflicto armado (Sí/No)': 'No',
      'Estudiante nuevo (Sí/No)': 'No', 'Colegio de procedencia': 'Institución Educativa La Esperanza', 'Año de procedencia': '2023-2024',
      'Nombre del acudiente': '', 'Parentesco del acudiente': '', 'Tipo doc. del acudiente (CC/CE)': '',
      'Número doc. del acudiente': '', 'Correo del acudiente (opcional, crea su acceso)': '', 'Contraseña del acudiente (opcional)': '',
    };
    const headers = COLUMNAS_EXCEL.map(c => c.header);
    const ws = XLSX.utils.json_to_sheet([ejemplo1, ejemplo2], { header: headers });
    ws['!cols'] = headers.map(h => ({ wch: Math.max(18, Math.min(38, h.length)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
    XLSX.writeFile(wb, 'plantilla_alumnos_playfesor.xlsx');
  }

  function handleArchivoExcel(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setExcelNombreArchivo(archivo.name);
    setExcelResultado(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });
        const alumnos = filas.map(filaExcelAEstudiante).filter(a => a.nombre && a.email);
        setExcelPreview(alumnos);
        if (alumnos.length === 0) {
          setError('No se encontraron alumnos válidos en el archivo. Verifica que uses la plantilla y que estén diligenciados Nombre y Correo.');
        }
      } catch {
        setError('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.');
      }
    };
    reader.readAsArrayBuffer(archivo);
  }

  async function handleImportarExcel() {
    if (excelPreview.length === 0) return;
    setGuardando(true); setError('');
    const estudiantesAEnviar = excelPreview.map(e => ({ ...e, grupo_id: excelGrupoId || null }));
    try {
      const resp = await axiosAuth.post('/api/estudiantes/importar', { estudiantes: estudiantesAEnviar });
      setExcelResultado(resp.data);
      setExcelPreview([]);
      setExcelNombreArchivo('');
      setFiltroGrupo('');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error en la importación');
    } finally {
      setGuardando(false);
    }
  }

  function abrirEdicion(est) {
    setEditForm({
      ...FORM_VACIO,
      nombre:          est.nombre,
      email:           est.email,
      grupo_id:        est.grupo_id || '',
      telefono_padres: est.telefono_padres || '',
      requiere_piar:   !!est.requiere_piar,
      tipo_documento:  est.tipo_documento || '',
      numero_documento: est.numero_documento || '',
      lugar_expedicion_documento: est.lugar_expedicion_documento || '',
      fecha_nacimiento: est.fecha_nacimiento ? String(est.fecha_nacimiento).slice(0, 10) : '',
      lugar_nacimiento: est.lugar_nacimiento || '',
      genero:           est.genero || '',
      grupo_sanguineo:  est.grupo_sanguineo || '',
      direccion:        est.direccion || '',
      barrio:           est.barrio || '',
      ciudad:           est.ciudad || '',
      comuna:           est.comuna || '',
      eps_sisben:       est.eps_sisben || '',
      telefono:         est.telefono || '',
      celular:          est.celular || '',
      discapacidad:     est.discapacidad || '',
      grupo_etnico:     est.grupo_etnico || '',
      victima_conflicto: !!est.victima_conflicto,
      codigo_matricula: est.codigo_matricula || '',
      estudiante_nuevo: est.estudiante_nuevo !== undefined ? !!est.estudiante_nuevo : true,
      colegio_procedencia: est.colegio_procedencia || '',
      anio_procedencia: est.anio_procedencia || '',
    });
    setEditando(est);
    setError('');
  }

  async function handleGuardarEdicion() {
    if (!editForm.nombre || !editForm.email) return;
    setGuardandoEdit(true); setError('');
    try {
      await axiosAuth.put(`/api/estudiantes/${editando.id}`, editForm);
      setEditando(null);
      setMensaje('Estudiante actualizado correctamente');
      await cargar();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el estudiante');
    } finally {
      setGuardandoEdit(false);
    }
  }

  async function abrirFicha(est) {
    setFichaEstudiante(est);
    setFichaDatos(null);
    setCargandoFicha(true);
    try {
      const r = await axiosAuth.get(`/api/estudiantes/${est.id}/ficha`);
      setFichaDatos(r.data.data);
    } catch {
      setFichaDatos({ error: true });
    } finally {
      setCargandoFicha(false);
    }
  }

  async function abrirFichaMedica(est) {
    setFichaMedicaEstudiante(est);
    setFichaMedicaDatos({});
    setErrorFichaMedica('');
    setCargandoFichaMedica(true);
    try {
      const r = await axiosAuth.get(`/api/estudiantes/${est.id}/ficha-medica`);
      setFichaMedicaDatos(r.data.data || {});
    } catch {
      setErrorFichaMedica('No se pudo cargar la ficha médica.');
    } finally {
      setCargandoFichaMedica(false);
    }
  }

  function cambiarCampoFichaMedica(campo, valor) {
    setFichaMedicaDatos(prev => ({ ...prev, [campo]: valor }));
  }

  async function guardarFichaMedica() {
    setGuardandoFichaMedica(true); setErrorFichaMedica('');
    try {
      await axiosAuth.put(`/api/estudiantes/${fichaMedicaEstudiante.id}/ficha-medica`, fichaMedicaDatos);
      setFichaMedicaEstudiante(null);
      setMensaje('Ficha médica guardada correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setErrorFichaMedica(err.response?.data?.error || 'Error al guardar la ficha médica');
    } finally {
      setGuardandoFichaMedica(false);
    }
  }

  async function handleSubirFoto(id, archivo) {
    if (!archivo) return;
    setSubiendoFoto(true); setError('');
    try {
      const formData = new FormData();
      formData.append('foto', archivo);
      const r = await axiosAuth.post(`/api/estudiantes/${id}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditando(prev => (prev && prev.id === id ? { ...prev, foto_url: r.data.data.foto_url } : prev));
      await cargar();
      setMensaje('Foto actualizada correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function handleDesactivar(id) {
    if (!window.confirm('¿Desactivar este estudiante?')) return;
    try {
      await axiosAuth.delete(`/api/estudiantes/${id}`);
      await cargar();
    } catch {
      setError('Error al desactivar el estudiante');
    }
  }

  const estudiantesFiltrados = filtroGrupo
    ? estudiantes.filter(e => e.grupo_id === parseInt(filtroGrupo))
    : estudiantes;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Estudiantes" />

      {/* Panel lateral — editar estudiante */}
      {editando && (
        <>
          <div onClick={() => setEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: '440px', maxWidth: '95vw', height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 101, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff' }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>Editar estudiante</div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>{formatearApellidoPrimero(editando.nombre)}</div>
              </div>
              <button onClick={() => setEditando(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' }}>✕</button>
            </div>

            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {error && <div style={es.errorBox}>{error}</div>}

              <p style={es.seccionLabel}>Foto del alumno</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Avatar nombre={editando.nombre} fotoUrl={editando.foto_url} size={56} />
                <div>
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp" id="fotoEstudiante"
                    style={{ display: 'none' }}
                    onChange={e => handleSubirFoto(editando.id, e.target.files[0])}
                  />
                  <label htmlFor="fotoEstudiante" style={{ ...es.btnEditar, cursor: subiendoFoto ? 'wait' : 'pointer', opacity: subiendoFoto ? 0.6 : 1 }}>
                    {subiendoFoto ? 'Subiendo...' : 'Cambiar foto'}
                  </label>
                </div>
              </div>

              <p style={es.seccionLabel}>Datos del alumno</p>
              <div style={es.form}>
                <CamposAlumno valores={editForm} set={setEditForm} grupos={grupos} />
              </div>

              <p style={es.seccionLabel}>Datos poblacionales (si aplica)</p>
              <div style={es.form}>
                <CamposPoblacionales valores={editForm} set={setEditForm} />
              </div>

              <p style={es.seccionLabel}>Matrícula y procedencia</p>
              <div style={es.form}>
                <CamposProcedencia valores={editForm} set={setEditForm} />
              </div>

              <p style={es.seccionLabel}>Acudiente</p>
              <div style={es.form}>
                <CamposAcudiente valores={editForm} set={setEditForm} />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f5', display: 'flex', gap: '10px' }}>
              <button onClick={() => setEditando(null)} style={{ ...es.btnPeligro, flex: 1, textAlign: 'center' }}>Cancelar</button>
              <button
                onClick={handleGuardarEdicion}
                disabled={guardandoEdit || !editForm.nombre || !editForm.email}
                style={{ ...es.btnPrimario, flex: 2, opacity: (guardandoEdit || !editForm.nombre || !editForm.email) ? 0.5 : 1 }}
              >
                {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal — ficha básica del estudiante */}
      {fichaEstudiante && (
        <>
          <div onClick={() => setFichaEstudiante(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
          <div style={es.fichaModal}>
            <button onClick={() => setFichaEstudiante(null)} style={es.fichaCerrar}>✕</button>
            <FichaBasicaContenido datos={fichaDatos} cargando={cargandoFicha} />
          </div>
        </>
      )}

      {/* Modal — ficha médica del estudiante */}
      {fichaMedicaEstudiante && (
        <>
          <div onClick={() => setFichaMedicaEstudiante(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
          <div style={es.fichaMedicaModal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#333' }}>Ficha médica</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{formatearApellidoPrimero(fichaMedicaEstudiante.nombre)}</div>
              </div>
              <button onClick={() => setFichaMedicaEstudiante(null)} style={es.fichaCerrar}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
              {cargandoFichaMedica ? (
                <p style={es.textoGris}>Cargando...</p>
              ) : (
                <FichaMedicaEditor valores={fichaMedicaDatos} onChange={cambiarCampoFichaMedica} />
              )}
              {errorFichaMedica && <div style={es.errorBox}>{errorFichaMedica}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '1px solid #f0f0f5' }}>
              <button onClick={() => setFichaMedicaEstudiante(null)} style={{ ...es.btnPeligro, flex: 1, textAlign: 'center' }}>Cancelar</button>
              <button onClick={guardarFichaMedica} disabled={guardandoFichaMedica || cargandoFichaMedica} style={{ ...es.btnPrimario, flex: 2, opacity: guardandoFichaMedica ? 0.6 : 1 }}>
                {guardandoFichaMedica ? 'Guardando...' : 'Guardar ficha médica'}
              </button>
            </div>
          </div>
        </>
      )}

      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard')} style={es.btnVolver}>← Volver al panel</button>

        {/* Tabs */}
        <div style={es.tabs}>
          <button onClick={() => setTab('individual')} style={{ ...es.tab, ...(tab === 'individual' ? es.tabActivo : {}) }}>
            Agregar individual
          </button>
          <button onClick={() => setTab('excel')} style={{ ...es.tab, ...(tab === 'excel' ? es.tabActivo : {}) }}>
            Cargue masivo por Excel
          </button>
        </div>

        {/* Formulario individual */}
        {tab === 'individual' && (
          <div style={es.card}>
            <h3 style={es.cardTitulo}>Agregar estudiante</h3>
            <form onSubmit={handleCrearIndividual}>
              <p style={es.seccionLabel}>Datos del alumno</p>
              <div style={es.form}>
                <CamposAlumno valores={form} set={setForm} grupos={grupos} />
                <input type="password" placeholder="Contraseña *" required value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} style={es.input} />
              </div>

              <p style={es.seccionLabel}>Datos poblacionales especiales (si aplica)</p>
              <div style={es.form}>
                <CamposPoblacionales valores={form} set={setForm} />
              </div>

              <p style={es.seccionLabel}>Matrícula y procedencia</p>
              <div style={es.form}>
                <CamposProcedencia valores={form} set={setForm} />
              </div>

              <p style={es.seccionLabel}>Datos del acudiente (opcional)</p>
              <div style={es.form}>
                <CamposAcudiente valores={form} set={setForm} />
              </div>

              <button type="submit" disabled={guardando} style={{ ...es.btnPrimario, marginTop: '16px' }}>
                {guardando ? 'Guardando...' : '+ Agregar estudiante'}
              </button>
            </form>
            {mensaje && <div style={es.exito}>{mensaje}</div>}
            {error && <div style={es.errorBox}>{error}</div>}
          </div>
        )}

        {/* Importación Excel */}
        {tab === 'excel' && (
          <div style={es.card}>
            <h3 style={es.cardTitulo}>Cargue masivo de alumnos desde Excel</h3>

            {/* Paso 1 */}
            <div style={es.pasoBox}>
              <span style={es.pasoBadge}>1</span>
              <div style={{ flex: 1 }}>
                <p style={es.pasoTitulo}>Asignar grado/grupo <span style={es.opcional}>(opcional — todos los alumnos del archivo quedarán en el mismo grupo)</span></p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <select value={excelGrupoId} onChange={e => setExcelGrupoId(e.target.value)} style={{ ...es.select, maxWidth: '240px' }}>
                    <option value="">— Sin grupo —</option>
                    {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Paso 2 */}
            <div style={es.pasoBox}>
              <span style={es.pasoBadge}>2</span>
              <div style={{ flex: 1 }}>
                <p style={es.pasoTitulo}>Descargar y diligenciar la plantilla</p>
                <p style={es.ayudaCSV}>
                  La plantilla trae todos los datos del alumno, del acudiente y los datos poblacionales del MEN/SIMAT,
                  con dos filas de ejemplo. Solo Nombre y Correo son obligatorios — el resto se puede dejar en blanco.
                </p>
                <button type="button" onClick={descargarPlantilla} style={es.btnPlantilla}>
                  ⬇ Descargar plantilla de ejemplo (.xlsx)
                </button>
              </div>
            </div>

            {/* Paso 3 */}
            <div style={es.pasoBox}>
              <span style={es.pasoBadge}>3</span>
              <div style={{ flex: 1 }}>
                <p style={es.pasoTitulo}>Subir el archivo diligenciado</p>
                <div style={es.zonaArchivo}>
                  <input
                    type="file" accept=".xlsx,.xls" id="excelFile"
                    style={{ display: 'none' }}
                    onChange={handleArchivoExcel}
                  />
                  <label htmlFor="excelFile" style={es.btnSeleccionar}>
                    Seleccionar archivo .xlsx
                  </label>
                  {excelNombreArchivo && (
                    <span style={es.nombreArchivo}>Archivo: {excelNombreArchivo}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Paso 4: Vista previa */}
            {excelPreview.length > 0 && (
              <div style={es.pasoBox}>
                <span style={es.pasoBadge}>4</span>
                <div style={{ flex: 1 }}>
                  <p style={es.pasoTitulo}>
                    Vista previa — {excelPreview.length} alumno{excelPreview.length !== 1 ? 's' : ''} encontrado{excelPreview.length !== 1 ? 's' : ''}
                  </p>
                  <div style={es.previsualizacion}>
                    <table style={es.tabla}>
                      <thead>
                        <tr>
                          {['#', 'Nombre', 'Correo', 'Documento', 'Acudiente'].map(h => (
                            <th key={h} style={es.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreview.slice(0, 10).map((alumno, i) => (
                          <tr key={i} style={es.tr}>
                            <td style={{ ...es.td, color: '#bbb', fontSize: '12px' }}>{i + 1}</td>
                            <td style={es.td}>{formatearApellidoPrimero(alumno.nombre)}</td>
                            <td style={es.td}>{alumno.email}</td>
                            <td style={es.td}>{alumno.tipo_documento ? `${alumno.tipo_documento} ${alumno.numero_documento || ''}` : '—'}</td>
                            <td style={es.td}>{alumno.acudiente_email || (alumno.acudiente_nombre ? `${alumno.acudiente_nombre} (sin correo)` : '—')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {excelPreview.length > 10 && (
                      <p style={{ ...es.textoGris, marginTop: '8px', textAlign: 'center', fontSize: '13px' }}>
                        ... y {excelPreview.length - 10} alumno{excelPreview.length - 10 !== 1 ? 's' : ''} más
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleImportarExcel}
                    disabled={guardando}
                    style={{ ...es.btnPrimario, marginTop: '16px' }}
                  >
                    {guardando ? 'Importando...' : `Importar ${excelPreview.length} alumno${excelPreview.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            )}

            {/* Resultado de la importación */}
            {excelResultado && (
              <div style={(excelResultado.errores?.length ?? 0) === 0 ? es.exito : es.resultadoMixto}>
                <strong>{excelResultado.creados.length} alumno{excelResultado.creados.length !== 1 ? 's' : ''} importado{excelResultado.creados.length !== 1 ? 's' : ''} correctamente.</strong>
                {excelResultado.errores?.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <strong>{excelResultado.errores.length} error{excelResultado.errores.length !== 1 ? 'es' : ''}:</strong>
                    {excelResultado.errores.map((err, i) => (
                      <div key={i} style={{ fontSize: '13px', marginTop: '4px' }}>• {err.email}: {err.error}</div>
                    ))}
                  </div>
                )}
                {excelResultado.avisos?.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <strong>{excelResultado.avisos.length} aviso{excelResultado.avisos.length !== 1 ? 's' : ''}:</strong>
                    {excelResultado.avisos.map((a, i) => (
                      <div key={i} style={{ fontSize: '13px', marginTop: '4px' }}>• {a.email}: {a.aviso}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <div style={es.errorBox}>{error}</div>}
          </div>
        )}

        {/* Lista de estudiantes */}
        <div style={es.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ ...es.cardTitulo, marginBottom: 0 }}>Estudiantes registrados ({estudiantesFiltrados.length})</h3>
            <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} style={{ ...es.select, maxWidth: '200px' }}>
              <option value="">Todos los grupos</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
            </select>
          </div>

          {cargando ? <p style={es.textoGris}>Cargando...</p> : estudiantesFiltrados.length === 0 ? (
            <p style={es.textoGris}>No hay estudiantes registrados.</p>
          ) : (
            <table style={es.tabla}>
              <thead>
                <tr>{['Nombre', 'Correo', 'Documento', 'Grupo', 'Acudiente', 'PIAR', 'Estado', 'Acción'].map(h => <th key={h} style={es.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {estudiantesFiltrados.map(e => (
                  <tr key={e.id} style={es.tr}>
                    <td style={es.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar nombre={e.nombre} fotoUrl={e.foto_url} />
                        {formatearApellidoPrimero(e.nombre)}
                      </div>
                    </td>
                    <td style={es.td}>{e.email}</td>
                    <td style={es.td}>{e.tipo_documento ? `${e.tipo_documento} ${e.numero_documento || ''}` : <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>}</td>
                    <td style={es.td}>{e.nombre_grupo ? `${e.grado}° ${e.nombre_grupo}` : '—'}</td>
                    <td style={es.td}>{e.acudientes || <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>}</td>
                    <td style={es.td}>
                      {e.requiere_piar
                        ? <span style={{ ...es.badge, background: '#e0f2f1', color: '#00695c' }}>Sí</span>
                        : <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={es.td}>
                      <span style={{ ...es.badge, background: e.activo ? '#e8f5e9' : '#fce4ec', color: e.activo ? '#2e7d32' : '#c62828' }}>
                        {e.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={es.td}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => abrirFicha(e)} style={es.btnFicha}>Ver ficha</button>
                        <button onClick={() => abrirFichaMedica(e)} style={es.btnFicha}>Ficha médica</button>
                        <button onClick={() => abrirEdicion(e)} style={es.btnEditar}>Editar</button>
                        <button onClick={() => handleDesactivar(e.id)} style={es.btnPeligro}>Desactivar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab: { padding: '10px 20px', borderRadius: '10px', border: '2px solid #e0e0e0', background: '#fff', color: '#888', cursor: 'pointer', fontWeight: '600', fontSize: '14px', fontFamily: 'inherit' },
  tabActivo: { borderColor: '#667eea', color: '#667eea', background: '#f0f0ff' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: '17px', fontWeight: '700', color: '#333', marginBottom: '16px' },
  seccionLabel: { fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 0 10px' },
  form: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  select: { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  campoConLabel: { flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px' },
  miniLabel: { fontSize: '11px', color: '#aaa', fontWeight: '600' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnPeligro: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  exito: { marginTop: '16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '12px 16px', fontSize: '14px' },
  errorBox: { marginTop: '12px', background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' },
  resultadoMixto: { marginTop: '16px', background: '#fff8e1', color: '#e65100', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', border: '1px solid #ffe082' },
  textoGris: { color: '#888', fontSize: '14px' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#666', borderBottom: '2px solid #f0f0f0' },
  tr: { borderBottom: '1px solid #f5f5f5' },
  td: { padding: '12px', fontSize: '14px', color: '#333' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  badgeWa: { background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  // Excel
  pasoBox: { display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #f0f0f0' },
  pasoBadge: { width: '28px', height: '28px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0, marginTop: '2px' },
  pasoTitulo: { fontSize: '14px', fontWeight: '700', color: '#333', marginBottom: '10px' },
  opcional: { fontSize: '12px', fontWeight: '400', color: '#999' },
  zonaArchivo: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  btnSeleccionar: { display: 'inline-block', padding: '10px 20px', background: '#f0f0ff', border: '2px dashed #c5cae9', borderRadius: '10px', color: '#5c6bc0', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  nombreArchivo: { fontSize: '13px', color: '#555', background: '#f5f5f5', padding: '6px 12px', borderRadius: '8px' },
  ayudaCSV: { fontSize: '12px', color: '#888', marginTop: '10px', lineHeight: 1.6 },
  codigo: { background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#333' },
  btnPlantilla: { marginTop: '10px', background: '#f0f0ff', border: '1px solid #c5b8f7', color: '#5c35c2', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 16px', borderRadius: '8px' },
  previsualizacion: { background: '#fafafa', borderRadius: '10px', border: '1px solid #eee', overflow: 'hidden' },
  tagPass:    { background: '#f3f4f6', color: '#666', fontSize: '12px', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' },
  btnEditar:  { background: '#f0f0ff', border: '1px solid #c5cae9', color: '#5c6bc0', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' },
  btnFicha:   { background: '#fff', border: '1px solid #ddd', color: '#555', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' },
  labelPanel: { display: 'block', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555', cursor: 'pointer' },
  inputPanel: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' },
  // Ficha básica
  fichaModal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '360px', maxWidth: '90vw', background: '#fff', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', zIndex: 101, padding: '28px 24px 20px' },
  fichaMedicaModal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '680px', maxWidth: '94vw', maxHeight: '86vh', background: '#fff', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', zIndex: 101, padding: '24px', display: 'flex', flexDirection: 'column' },
  fichaCerrar: { position: 'absolute', top: '14px', right: '14px', background: '#f5f5f5', border: 'none', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#888', fontFamily: 'inherit' },
};
