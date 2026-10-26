import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Registro from './pages/Registro';
// import Recuperar from './pages/Recuperar';
// import Restablecer from './pages/Restablecer';
import AceptarInvitacion from './pages/AceptarInvitacion';
import Dashboard from './pages/Dashboard';
import Plantilla from './pages/Plantilla';
import JugadorDetalle from './pages/JugadorDetalle';
import Partidos from './pages/Partidos';
import PartidoDetalle from './pages/PartidoDetalle';
import PartidoDirecto from './pages/PartidoDirecto';
import ResumenPartido from './pages/ResumenPartido';
import Analitica from './pages/Analitica';
import Club from './pages/Club';
import Cuotas from './pages/Cuotas';
import MiembrosClub from './pages/MiembrosClub';
import Ajustes from './pages/Ajustes';
import AnadirJugador from './pages/AnadirJugador';
import CrearPartido from './pages/CrearPartido';
import Convocatoria from './pages/Convocatoria';
import Jugadas from './pages/Jugadas';
import JugadaEditor from './pages/JugadaEditor';
import PreparacionFisica from './pages/PreparacionFisica';
import PreparacionEditor from './pages/PreparacionEditor';
import Entrenamientos from './pages/Entrenamientos';
import EntrenamientoEditor from './pages/EntrenamientoEditor';
import Asistencias from './pages/Asistencias';
import AsistenciaDetalle from './pages/AsistenciaDetalle';

function PrivateRoute() {
  const { isAuth, booting } = useAuth();
  if (booting) return <p className="muted" style={{ padding: '2rem' }}>Cargando…</p>;
  if (!isAuth) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/registro', element: <Registro /> },
      { path: '/invitar/:token', element: <AceptarInvitacion /> },
      // Olvidé la contraseña desactivado: no hay servicio SMTP.
      // { path: '/recuperar', element: <Recuperar /> },
      // { path: '/restablecer', element: <Restablecer /> },
      {
        path: '/',
        element: <PrivateRoute />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'plantilla', element: <Plantilla /> },
          { path: 'plantilla/nuevo', element: <AnadirJugador /> },
          { path: 'plantilla/:id/editar', element: <AnadirJugador /> },
          { path: 'plantilla/:id', element: <JugadorDetalle /> },
          { path: 'partidos', element: <Partidos /> },
          { path: 'partidos/nuevo', element: <CrearPartido /> },
          { path: 'partidos/:id/editar', element: <CrearPartido /> },
          { path: 'partidos/:id/convocatoria', element: <Convocatoria /> },
          { path: 'partidos/:id/directo', element: <PartidoDirecto /> },
          { path: 'partidos/:id/resumen', element: <ResumenPartido /> },
          { path: 'partidos/:id', element: <PartidoDetalle /> },
          { path: 'jugadas', element: <Jugadas /> },
          { path: 'jugadas/nueva', element: <JugadaEditor /> },
          { path: 'jugadas/:id/editar', element: <JugadaEditor /> },
          { path: 'jugadas/:id', element: <JugadaEditor /> },
          { path: 'preparacion', element: <PreparacionFisica /> },
          { path: 'preparacion/nueva', element: <PreparacionEditor /> },
          { path: 'preparacion/entrenamiento', element: <Entrenamientos /> },
          { path: 'preparacion/entrenamiento/nueva', element: <EntrenamientoEditor /> },
          { path: 'preparacion/entrenamiento/:id/editar', element: <EntrenamientoEditor /> },
          { path: 'preparacion/entrenamiento/:id', element: <EntrenamientoEditor /> },
          { path: 'preparacion/asistencia', element: <Asistencias /> },
          { path: 'preparacion/asistencia/:id/editar', element: <AsistenciaDetalle /> },
          { path: 'preparacion/asistencia/:id', element: <AsistenciaDetalle /> },
          { path: 'preparacion/:id/editar', element: <PreparacionEditor /> },
          { path: 'preparacion/:id', element: <PreparacionEditor /> },
          { path: 'analitica', element: <Analitica /> },
          {
            path: 'analitica/porteros',
            element: <Navigate to="/analitica?seccion=porteros" replace />,
          },
          { path: 'informes', element: <Navigate to="/analitica" replace /> },
          { path: 'club', element: <Club /> },
          { path: 'club/cuotas', element: <Cuotas /> },
          { path: 'club/miembros', element: <MiembrosClub /> },
          { path: 'ajustes', element: <Ajustes /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
