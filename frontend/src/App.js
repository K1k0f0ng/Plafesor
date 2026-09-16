import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import CambioPasswordObligatorio from './components/CambioPasswordObligatorio';

// Páginas públicas
import Login          from './pages/Login';
import OlvidePassword from './pages/OlvidePassword';
import ResetPassword  from './pages/ResetPassword';
import LandingPage    from './pages/LandingPage';

// Páginas Admin
import Dashboard from './pages/Dashboard';
import Colegios from './pages/Colegios';
import Periodos from './pages/Periodos';
import Grupos from './pages/Grupos';
import SemanaAcademica from './pages/SemanaAcademica';
import Salones from './pages/Salones';
import AreasAcademicas from './pages/AreasAcademicas';
import AsignaturasPorGrado from './pages/AsignaturasPorGrado';
import ReasignacionCarga from './pages/ReasignacionCarga';
import TrasladoClases from './pages/TrasladoClases';
import Docentes from './pages/Docentes';
import Estudiantes from './pages/Estudiantes';
import Materias from './pages/Materias';

// Páginas Director
import DirectorDashboard from './pages/DirectorDashboard';
import EvaluacionDocentes from './pages/EvaluacionDocentes';
import Comparativas from './pages/Comparativas';
import MetricasInstitucional from './pages/MetricasInstitucional';
import RiesgoAcademico from './pages/RiesgoAcademico';
import CoPiloto from './pages/CoPiloto';
import ObservadorAcademico from './pages/ObservadorAcademico';
import Padres from './pages/Padres';
import DashboardPadre from './pages/DashboardPadre';
import PlanesMejoramiento from './pages/PlanesMejoramiento';
import GemeloDigital from './pages/GemeloDigital';
import PIAR from './pages/PIAR';

// Páginas Docente
import DashboardDocente from './pages/DashboardDocente';
import CoPilotoDocente from './pages/CoPilotoDocente';
import BancoActividades from './pages/BancoActividades';
import HorarioDocente from './pages/HorarioDocente';
import CrearActividad from './pages/CrearActividad';
import VerActividades from './pages/VerActividades';
import RevisarEntregas from './pages/RevisarEntregas';
import Mensajeria from './pages/Mensajeria';
import PasarLista from './pages/PasarLista';
import Anotaciones from './pages/Anotaciones';
import Boletin from './pages/Boletin';
import LibroNotas from './pages/LibroNotas';
import Auditoria from './pages/Auditoria';
import CargueHistorico from './pages/CargueHistorico';
import CierreAnioLectivo from './pages/CierreAnioLectivo';
import GradosAcademicos from './pages/GradosAcademicos';
import MotivosRetiro from './pages/MotivosRetiro';
import PreferenciasNotificacion from './pages/PreferenciasNotificacion';
import ModulosPortal from './pages/ModulosPortal';
import Agenda from './pages/Agenda';
import Personal from './pages/Personal';
import Citaciones from './pages/Citaciones';
import MensajesMasivos from './pages/MensajesMasivos';

// Páginas Estudiante
import DashboardEstudiante from './pages/DashboardEstudiante';
import MateriaEstudiante from './pages/MateriaEstudiante';
import Actividad from './pages/Actividad';
import TutorIA from './pages/TutorIA';
import HistorialEstudiante from './pages/HistorialEstudiante';

const RUTAS_POR_ROL = {
  admin:      '/dashboard',
  docente:    '/dashboard-docente',
  estudiante: '/dashboard-estudiante',
  director:   '/dashboard-director',
  padre:      '/dashboard-padre',
};

function PantallaCarga() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid #e0e0e0', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  );
}

// Todas las rutas privadas incluyen automáticamente el Layout con sidebar
function RutaPrivada({ children, rolesPermitidos, variante, modulo }) {
  const { usuario, cargando, modulosDesactivados } = useAuth();
  if (cargando) return <PantallaCarga />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to={RUTAS_POR_ROL[usuario.rol] || '/login'} replace />;
  }
  if (modulo && modulosDesactivados?.includes(modulo)) {
    return <Navigate to={RUTAS_POR_ROL[usuario.rol] || '/login'} replace />;
  }
  return (
    <>
      <CambioPasswordObligatorio />
      <Layout variante={variante}>{children}</Layout>
    </>
  );
}

function RutaPublica({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  if (usuario) return <Navigate to={RUTAS_POR_ROL[usuario.rol] || '/login'} replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RutaPublica><LandingPage /></RutaPublica>} />
      <Route path="/login"           element={<RutaPublica><Login /></RutaPublica>} />
      <Route path="/forgot-password" element={<RutaPublica><OlvidePassword /></RutaPublica>} />
      <Route path="/reset-password"  element={<RutaPublica><ResetPassword /></RutaPublica>} />

      {/* Rutas Admin */}
      <Route path="/dashboard"   element={<RutaPrivada rolesPermitidos={['admin']}><Dashboard /></RutaPrivada>} />
      <Route path="/colegios"    element={<RutaPrivada rolesPermitidos={['admin']}><Colegios /></RutaPrivada>} />
      <Route path="/grupos"      element={<RutaPrivada rolesPermitidos={['admin', 'director']} modulo="institucion_academica"><Grupos /></RutaPrivada>} />
      <Route path="/semana-academica" element={<RutaPrivada rolesPermitidos={['admin', 'director']} modulo="institucion_academica"><SemanaAcademica /></RutaPrivada>} />
      <Route path="/salones"     element={<RutaPrivada rolesPermitidos={['admin', 'director']} modulo="institucion_academica"><Salones /></RutaPrivada>} />
      <Route path="/areas-academicas" element={<RutaPrivada rolesPermitidos={['admin', 'director']} modulo="asignaturas"><AreasAcademicas /></RutaPrivada>} />
      <Route path="/asignaturas-por-grado" element={<RutaPrivada rolesPermitidos={['admin', 'director']} modulo="asignaturas"><AsignaturasPorGrado /></RutaPrivada>} />
      <Route path="/reasignacion-carga" element={<RutaPrivada rolesPermitidos={['admin', 'director']} modulo="asignaturas"><ReasignacionCarga /></RutaPrivada>} />
      <Route path="/traslado-clases" element={<RutaPrivada rolesPermitidos={['admin', 'director']} modulo="asignaturas"><TrasladoClases /></RutaPrivada>} />
      <Route path="/docentes"    element={<RutaPrivada rolesPermitidos={['admin']}><Docentes /></RutaPrivada>} />
      <Route path="/estudiantes" element={<RutaPrivada rolesPermitidos={['admin']}><Estudiantes /></RutaPrivada>} />
      <Route path="/materias"    element={<RutaPrivada rolesPermitidos={['admin', 'director']} modulo="asignaturas"><Materias /></RutaPrivada>} />
      <Route path="/padres"      element={<RutaPrivada rolesPermitidos={['admin']}><Padres /></RutaPrivada>} />
      <Route path="/periodos"    element={<RutaPrivada rolesPermitidos={['admin']}><Periodos /></RutaPrivada>} />

      {/* Rutas Director */}
      <Route path="/dashboard-director" element={<RutaPrivada rolesPermitidos={['director']} variante="director"><DirectorDashboard /></RutaPrivada>} />
      <Route path="/evaluacion-docentes" element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="evaluacion_docentes"><EvaluacionDocentes /></RutaPrivada>} />
      <Route path="/comparativas"        element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="comparativas"><Comparativas /></RutaPrivada>} />
      <Route path="/metricas"            element={<RutaPrivada rolesPermitidos={['director', 'admin']}><MetricasInstitucional /></RutaPrivada>} />
      <Route path="/riesgo"              element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="motor_riesgo"><RiesgoAcademico /></RutaPrivada>} />
      <Route path="/copiloto"            element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="copiloto_ia"><CoPiloto /></RutaPrivada>} />
      <Route path="/observador"          element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="observador_academico"><ObservadorAcademico /></RutaPrivada>} />
      <Route path="/planes"              element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="planes_mejoramiento"><PlanesMejoramiento /></RutaPrivada>} />
      <Route path="/gemelo"              element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="gemelo_digital"><GemeloDigital /></RutaPrivada>} />

      {/* Rutas Docente */}
      <Route path="/dashboard-docente"  element={<RutaPrivada rolesPermitidos={['docente']}><DashboardDocente /></RutaPrivada>} />
      <Route path="/copiloto-docente"  element={<RutaPrivada rolesPermitidos={['docente']} modulo="copiloto_ia"><CoPilotoDocente /></RutaPrivada>} />
      <Route path="/banco-actividades" element={<RutaPrivada rolesPermitidos={['docente']}><BancoActividades /></RutaPrivada>} />
      <Route path="/mi-horario"        element={<RutaPrivada rolesPermitidos={['docente']}><HorarioDocente /></RutaPrivada>} />
      <Route path="/crear-actividad"         element={<RutaPrivada rolesPermitidos={['docente']}><CrearActividad /></RutaPrivada>} />
      <Route path="/editar-actividad/:id"    element={<RutaPrivada rolesPermitidos={['docente']}><CrearActividad /></RutaPrivada>} />
      <Route path="/mis-actividades"   element={<RutaPrivada rolesPermitidos={['docente']}><VerActividades /></RutaPrivada>} />
      <Route path="/revisar-entregas/:id" element={<RutaPrivada rolesPermitidos={['docente']}><RevisarEntregas /></RutaPrivada>} />
      <Route path="/pasar-lista"       element={<RutaPrivada rolesPermitidos={['docente']}><PasarLista /></RutaPrivada>} />
      <Route path="/anotaciones"       element={<RutaPrivada rolesPermitidos={['docente']}><Anotaciones /></RutaPrivada>} />
      <Route path="/boletin"            element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']} modulo="boletines"><Boletin /></RutaPrivada>} />
      <Route path="/citaciones"         element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']} modulo="citaciones"><Citaciones /></RutaPrivada>} />
      <Route path="/mensajes-masivos"   element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']} modulo="mensajes_masivos"><MensajesMasivos /></RutaPrivada>} />
      <Route path="/libro-notas"        element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']}><LibroNotas /></RutaPrivada>} />
      <Route path="/auditoria"          element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="auditoria"><Auditoria /></RutaPrivada>} />
      <Route path="/cargue-historico"   element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="cargue_historico"><CargueHistorico /></RutaPrivada>} />
      <Route path="/cierre-anio-lectivo" element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="cierre_anio_lectivo"><CierreAnioLectivo /></RutaPrivada>} />
      <Route path="/grados-academicos"  element={<RutaPrivada rolesPermitidos={['director', 'admin']} modulo="institucion_academica"><GradosAcademicos /></RutaPrivada>} />
      <Route path="/motivos-retiro"     element={<RutaPrivada rolesPermitidos={['director', 'admin']}><MotivosRetiro /></RutaPrivada>} />
      <Route path="/piar"               element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']} modulo="piar"><PIAR /></RutaPrivada>} />
      <Route path="/mensajeria"         element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin', 'padre']}><Mensajeria /></RutaPrivada>} />
      <Route path="/preferencias-notificacion" element={<RutaPrivada><PreferenciasNotificacion /></RutaPrivada>} />
      <Route path="/modulos-portal"     element={<RutaPrivada rolesPermitidos={['director', 'admin']}><ModulosPortal /></RutaPrivada>} />
      <Route path="/agenda"             element={<RutaPrivada><Agenda /></RutaPrivada>} />
      <Route path="/personal"           element={<RutaPrivada rolesPermitidos={['admin', 'director']}><Personal /></RutaPrivada>} />

      {/* Rutas Estudiante */}
      <Route path="/dashboard-estudiante" element={<RutaPrivada rolesPermitidos={['estudiante']}><DashboardEstudiante /></RutaPrivada>} />
      <Route path="/tutor"                element={<RutaPrivada rolesPermitidos={['estudiante']} modulo="tutor_ia"><TutorIA /></RutaPrivada>} />
      <Route path="/mi-historial"         element={<RutaPrivada rolesPermitidos={['estudiante']}><HistorialEstudiante /></RutaPrivada>} />
      <Route path="/historial/:id"        element={<RutaPrivada rolesPermitidos={['admin','docente','director','padre']}><HistorialEstudiante /></RutaPrivada>} />
      <Route path="/materia/:materiaId"   element={<RutaPrivada rolesPermitidos={['estudiante']}><MateriaEstudiante /></RutaPrivada>} />
      <Route path="/actividad/:id"        element={<RutaPrivada rolesPermitidos={['estudiante']}><Actividad /></RutaPrivada>} />

      {/* Rutas Padre */}
      <Route path="/dashboard-padre" element={<RutaPrivada rolesPermitidos={['padre']}><DashboardPadre /></RutaPrivada>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
