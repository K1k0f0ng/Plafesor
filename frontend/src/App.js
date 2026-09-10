import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

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
function RutaPrivada({ children, rolesPermitidos, variante }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to={RUTAS_POR_ROL[usuario.rol] || '/login'} replace />;
  }
  return <Layout variante={variante}>{children}</Layout>;
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
      <Route path="/grupos"      element={<RutaPrivada rolesPermitidos={['admin']}><Grupos /></RutaPrivada>} />
      <Route path="/docentes"    element={<RutaPrivada rolesPermitidos={['admin']}><Docentes /></RutaPrivada>} />
      <Route path="/estudiantes" element={<RutaPrivada rolesPermitidos={['admin']}><Estudiantes /></RutaPrivada>} />
      <Route path="/materias"    element={<RutaPrivada rolesPermitidos={['admin']}><Materias /></RutaPrivada>} />
      <Route path="/padres"      element={<RutaPrivada rolesPermitidos={['admin']}><Padres /></RutaPrivada>} />
      <Route path="/periodos"    element={<RutaPrivada rolesPermitidos={['admin']}><Periodos /></RutaPrivada>} />

      {/* Rutas Director */}
      <Route path="/dashboard-director" element={<RutaPrivada rolesPermitidos={['director']} variante="director"><DirectorDashboard /></RutaPrivada>} />
      <Route path="/evaluacion-docentes" element={<RutaPrivada rolesPermitidos={['director', 'admin']}><EvaluacionDocentes /></RutaPrivada>} />
      <Route path="/comparativas"        element={<RutaPrivada rolesPermitidos={['director', 'admin']}><Comparativas /></RutaPrivada>} />
      <Route path="/metricas"            element={<RutaPrivada rolesPermitidos={['director', 'admin']}><MetricasInstitucional /></RutaPrivada>} />
      <Route path="/riesgo"              element={<RutaPrivada rolesPermitidos={['director', 'admin']}><RiesgoAcademico /></RutaPrivada>} />
      <Route path="/copiloto"            element={<RutaPrivada rolesPermitidos={['director', 'admin']}><CoPiloto /></RutaPrivada>} />
      <Route path="/observador"          element={<RutaPrivada rolesPermitidos={['director', 'admin']}><ObservadorAcademico /></RutaPrivada>} />
      <Route path="/planes"              element={<RutaPrivada rolesPermitidos={['director', 'admin']}><PlanesMejoramiento /></RutaPrivada>} />
      <Route path="/gemelo"              element={<RutaPrivada rolesPermitidos={['director', 'admin']}><GemeloDigital /></RutaPrivada>} />

      {/* Rutas Docente */}
      <Route path="/dashboard-docente"  element={<RutaPrivada rolesPermitidos={['docente']}><DashboardDocente /></RutaPrivada>} />
      <Route path="/copiloto-docente"  element={<RutaPrivada rolesPermitidos={['docente']}><CoPilotoDocente /></RutaPrivada>} />
      <Route path="/banco-actividades" element={<RutaPrivada rolesPermitidos={['docente']}><BancoActividades /></RutaPrivada>} />
      <Route path="/mi-horario"        element={<RutaPrivada rolesPermitidos={['docente']}><HorarioDocente /></RutaPrivada>} />
      <Route path="/crear-actividad"         element={<RutaPrivada rolesPermitidos={['docente']}><CrearActividad /></RutaPrivada>} />
      <Route path="/editar-actividad/:id"    element={<RutaPrivada rolesPermitidos={['docente']}><CrearActividad /></RutaPrivada>} />
      <Route path="/mis-actividades"   element={<RutaPrivada rolesPermitidos={['docente']}><VerActividades /></RutaPrivada>} />
      <Route path="/revisar-entregas/:id" element={<RutaPrivada rolesPermitidos={['docente']}><RevisarEntregas /></RutaPrivada>} />
      <Route path="/pasar-lista"       element={<RutaPrivada rolesPermitidos={['docente']}><PasarLista /></RutaPrivada>} />
      <Route path="/anotaciones"       element={<RutaPrivada rolesPermitidos={['docente']}><Anotaciones /></RutaPrivada>} />
      <Route path="/boletin"            element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']}><Boletin /></RutaPrivada>} />
      <Route path="/citaciones"         element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']}><Citaciones /></RutaPrivada>} />
      <Route path="/mensajes-masivos"   element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']}><MensajesMasivos /></RutaPrivada>} />
      <Route path="/libro-notas"        element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']}><LibroNotas /></RutaPrivada>} />
      <Route path="/piar"               element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin']}><PIAR /></RutaPrivada>} />
      <Route path="/mensajeria"         element={<RutaPrivada rolesPermitidos={['docente', 'director', 'admin', 'padre']}><Mensajeria /></RutaPrivada>} />

      {/* Rutas Estudiante */}
      <Route path="/dashboard-estudiante" element={<RutaPrivada rolesPermitidos={['estudiante']}><DashboardEstudiante /></RutaPrivada>} />
      <Route path="/tutor"                element={<RutaPrivada rolesPermitidos={['estudiante']}><TutorIA /></RutaPrivada>} />
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
