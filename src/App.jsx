import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import Plantilla from './pages/Plantilla';
import JugadorDetalle from './pages/JugadorDetalle';
import Partidos from './pages/Partidos';
import PartidoDirecto from './pages/PartidoDirecto';
import ResumenPartido from './pages/ResumenPartido';
import Analitica from './pages/Analitica';
import AnaliticaPorteros from './pages/AnaliticaPorteros';
import Informes from './pages/Informes';
import Club from './pages/Club';
import MiembrosClub from './pages/MiembrosClub';
import Ajustes from './pages/Ajustes';
import AnadirJugador from './pages/AnadirJugador';
import CrearPartido from './pages/CrearPartido';
import Convocatoria from './pages/Convocatoria';
import Jugadas from './pages/Jugadas';
import JugadaEditor from './pages/JugadaEditor';

function PrivateRoute({ children }) {
  const { isAuth, booting } = useAuth();
  if (booting) return <p className="muted" style={{ padding: '2rem' }}>Cargando…</p>;
  if (!isAuth) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar" element={<Navigate to="/login" replace />} />
      <Route path="/restablecer" element={<Navigate to="/login" replace />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="plantilla" element={<Plantilla />} />
        <Route path="plantilla/nuevo" element={<AnadirJugador />} />
        <Route path="plantilla/:id/editar" element={<AnadirJugador />} />
        <Route path="plantilla/:id" element={<JugadorDetalle />} />
        <Route path="partidos" element={<Partidos />} />
        <Route path="partidos/nuevo" element={<CrearPartido />} />
        <Route path="partidos/:id/convocatoria" element={<Convocatoria />} />
        <Route path="jugadas" element={<Jugadas />} />
        <Route path="jugadas/nueva" element={<JugadaEditor />} />
        <Route path="jugadas/:id" element={<JugadaEditor />} />
        <Route path="partidos/:id/directo" element={<PartidoDirecto />} />
        <Route path="partidos/:id/resumen" element={<ResumenPartido />} />
        <Route path="live" element={<PartidoDirecto />} />
        <Route path="live/:id" element={<PartidoDirecto />} />
        <Route path="analitica" element={<Analitica />} />
        <Route path="analitica/porteros" element={<AnaliticaPorteros />} />
        <Route path="informes" element={<Informes />} />
        <Route path="club" element={<Club />} />
        <Route path="club/miembros" element={<MiembrosClub />} />
        <Route path="ajustes" element={<Ajustes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
