import React from 'react';

export const GRUPOS_FICHA_MEDICA = [
  {
    titulo: 'Datos generales',
    campos: [
      { campo: 'peso_kg', label: 'Peso (kg)', tipo: 'number' },
      { campo: 'estatura_cm', label: 'Estatura (cm)', tipo: 'number' },
      { campo: 'tipo_sangre', label: 'Tipo de sangre', tipo: 'text' },
    ],
  },
  {
    titulo: 'Información para casos de emergencia',
    campos: [
      { campo: 'nombre_padre', label: 'Nombre del padre', tipo: 'text' },
      { campo: 'telefono_padre', label: 'Teléfono del padre', tipo: 'tel' },
      { campo: 'nombre_madre', label: 'Nombre de la madre', tipo: 'text' },
      { campo: 'telefono_madre', label: 'Teléfono de la madre', tipo: 'tel' },
      { campo: 'pediatra', label: 'Pediatra', tipo: 'text' },
      { campo: 'telefono_pediatra', label: 'Teléfono del pediatra', tipo: 'tel' },
      { campo: 'clinica_preferencia', label: 'Clínica de preferencia', tipo: 'text' },
      { campo: 'eps', label: 'EPS / medicina prepagada', tipo: 'text' },
      { campo: 'numero_afiliacion', label: 'No. de afiliación o contrato', tipo: 'text' },
      { campo: 'seguro_accidentes', label: 'Seguro contra accidentes', tipo: 'bool' },
    ],
  },
  {
    titulo: 'Esquema de vacunación',
    campos: [
      { campo: 'esquema_completo', label: 'Esquema completo', tipo: 'bool' },
      { campo: 'refuerzo_5_anios', label: 'Refuerzo 5 años', tipo: 'bool' },
      { campo: 'fiebre_amarilla', label: 'Fiebre amarilla', tipo: 'bool' },
      { campo: 'fecha_vacunacion', label: 'Fecha última vacuna', tipo: 'date' },
    ],
  },
  {
    titulo: 'Antecedentes personales',
    campos: [
      { campo: 'enfermedad_ojos', label: 'Enfermedad en los ojos', tipo: 'bool' },
      { campo: 'detalles_ojos', label: 'Detalles', tipo: 'text' },
      { campo: 'usa_lentes', label: 'Lentes permanentes', tipo: 'bool' },
      { campo: 'usa_protesis', label: 'Prótesis', tipo: 'bool' },
      { campo: 'alergias', label: 'Alergias', tipo: 'textarea' },
      { campo: 'tratamiento_alergias', label: 'Tratamiento para las alergias', tipo: 'textarea' },
      { campo: 'cirugias', label: 'Cirugías', tipo: 'textarea' },
      { campo: 'convulsiones_perdida_conocimiento', label: 'Ha convulsionado o perdido el conocimiento', tipo: 'bool' },
      { campo: 'enfermedad_actual', label: 'Enfermedad actual', tipo: 'textarea' },
      { campo: 'medicamentos_prohibidos', label: 'Medicamentos que no puede recibir', tipo: 'textarea' },
      { campo: 'puede_recibir_acetaminofen', label: 'Puede recibir acetaminofén', tipo: 'bool' },
      { campo: 'condiciones_especiales', label: 'Condiciones especiales', tipo: 'textarea' },
    ],
  },
  {
    titulo: 'Antecedentes familiares',
    campos: [
      { campo: 'antecedente_diabetes', label: 'Diabetes', tipo: 'bool' },
      { campo: 'antecedente_cancer', label: 'Cáncer', tipo: 'bool' },
      { campo: 'antecedente_hipertension', label: 'Hipertensión', tipo: 'bool' },
      { campo: 'antecedente_cardiovascular', label: 'Enfermedad cardiovascular', tipo: 'bool' },
      { campo: 'antecedente_otro', label: 'Otro', tipo: 'text' },
    ],
  },
];

function CampoEditor({ campo, label, tipo, valor, onChange }) {
  if (tipo === 'bool') {
    const v = valor === true ? 'true' : valor === false ? 'false' : '';
    return (
      <label style={fm.campo}>
        <span style={fm.label}>{label}</span>
        <select value={v} onChange={e => onChange(campo, e.target.value === '' ? null : e.target.value === 'true')} style={fm.select}>
          <option value="">No especificado</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      </label>
    );
  }
  if (tipo === 'textarea') {
    return (
      <label style={{ ...fm.campo, flexBasis: '100%' }}>
        <span style={fm.label}>{label}</span>
        <textarea value={valor || ''} onChange={e => onChange(campo, e.target.value)} style={fm.textarea} rows={2} />
      </label>
    );
  }
  return (
    <label style={fm.campo}>
      <span style={fm.label}>{label}</span>
      <input
        type={tipo === 'number' ? 'number' : tipo === 'date' ? 'date' : tipo === 'tel' ? 'tel' : 'text'}
        value={valor || ''} onChange={e => onChange(campo, e.target.value)} style={fm.input}
        step={tipo === 'number' ? '0.1' : undefined}
      />
    </label>
  );
}

export function FichaMedicaEditor({ valores, onChange }) {
  return (
    <div>
      {GRUPOS_FICHA_MEDICA.map(grupo => (
        <div key={grupo.titulo} style={{ marginBottom: 18 }}>
          <p style={fm.grupoTitulo}>{grupo.titulo}</p>
          <div style={fm.grid}>
            {grupo.campos.map(c => (
              <CampoEditor key={c.campo} {...c} valor={valores[c.campo]} onChange={onChange} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function valorLegible(tipo, valor) {
  if (tipo === 'bool') return valor === true ? 'Sí' : valor === false ? 'No' : 'No especificado';
  if (valor === null || valor === undefined || valor === '') return 'No especificado';
  return String(valor);
}

export function FichaMedicaLectura({ datos }) {
  if (!datos) return null;
  return (
    <div>
      {GRUPOS_FICHA_MEDICA.map(grupo => (
        <div key={grupo.titulo} style={{ marginBottom: 16 }}>
          <p style={fm.grupoTitulo}>{grupo.titulo}</p>
          <div style={fm.filaLectura}>
            {grupo.campos.map(c => (
              <div key={c.campo} style={fm.itemLectura}>
                <span style={fm.labelLectura}>{c.label}</span>
                <span style={fm.valorLectura}>{valorLegible(c.tipo, datos[c.campo])}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const fm = {
  grupoTitulo: { fontSize: 12, fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px' },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  campo: { flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, color: '#999', fontWeight: 600 },
  input: { padding: '8px 12px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  select: { padding: '8px 12px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' },
  textarea: { padding: '8px 12px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' },
  filaLectura: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px 16px', background: '#f9f9ff', border: '1px solid #e8e8ff', borderRadius: 10, padding: 14 },
  itemLectura: { display: 'flex', flexDirection: 'column', gap: 2 },
  labelLectura: { fontSize: 11, color: '#999', fontWeight: 600 },
  valorLectura: { fontSize: 13.5, color: '#333', fontWeight: 600 },
};
