import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { IcoFlecha } from '../components/ActionIcons';
import SinAcceso from '../components/SinAcceso';
import LiveFeedPanel from './partidoDirecto/LiveFeedPanel';
import LiveHeatmapsPanel from './partidoDirecto/LiveHeatmapsPanel';
import LiveMarcador from './partidoDirecto/LiveMarcador';
import LiveRegistroPanel from './partidoDirecto/LiveRegistroPanel';
import usePartidoDirectoState from './partidoDirecto/usePartidoDirectoState';

export default function PartidoDirecto() {
  const { equipo, canWriteDirecto, canWritePartidos, canRead } = useAuth();
  const live = usePartidoDirectoState();
  const {
    routeId,
    partidoId,
    partido,
    partidos,
    jugadores,
    tipos,
    acciones,
    score,
    clock,
    saving,
    editingId,
    flash,
    error,
    setError,
    onPickPartido,
    empezarEdicion,
    borrarAccion,
    cerrarPartido,
    recent,
  } = live;

  if (!canRead('directo')) return <SinAcceso que="el partido en directo" />;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">
            {partido?.jornada ? `JORNADA ${partido.jornada}` : 'PARTIDO'} ·{' '}
            {clock.parte === 1 ? '1ª PARTE' : '2ª PARTE'}
          </p>
          <h1>Partido en directo</h1>
        </div>
        <Link className="page-back" to={partidoId ? `/partidos/${partidoId}` : '/partidos'}>
          <button type="button" className="ghost">
            <IcoFlecha />
            Volver
          </button>
        </Link>
        <div className="add-player-actions page-head-actions-end">
          {!routeId && (
            <select
              value={partidoId}
              onChange={(e) => onPickPartido(e.target.value)}
              style={{ maxWidth: 240 }}
            >
              <option value="">Seleccionar partido</option>
              {partidos.map((p) => (
                <option key={p.id_partido} value={p.id_partido}>
                  {p.equipo_local_nombre} vs {p.equipo_visitante_nombre}
                </option>
              ))}
            </select>
          )}
          {partidoId &&
            canWritePartidos &&
            partido &&
            partido.estado !== 'jugado' &&
            partido.estado !== 'sin_resultado' && (
              <button
                type="button"
                className="live-cerrar-btn"
                disabled={saving}
                onClick={cerrarPartido}
              >
                Cerrar partido
              </button>
            )}
        </div>
      </header>

      <LiveMarcador partido={partido} score={score} clock={clock} />

      {error && (
        <div className="error live-error">
          <span>{error}</span>
          <button type="button" className="ghost live-error-dismiss" onClick={() => setError('')}>
            Cerrar
          </button>
        </div>
      )}
      {flash && <p className="club-status saved">{flash}</p>}

      <div className="live-grid">
        <LiveRegistroPanel live={live} canWriteDirecto={canWriteDirecto} />
        <LiveHeatmapsPanel acciones={acciones} tipos={tipos} equipo={equipo} partido={partido} />
        <LiveFeedPanel
          recent={recent}
          jugadores={jugadores}
          tipos={tipos}
          editingId={editingId}
          saving={saving}
          canWriteDirecto={canWriteDirecto}
          empezarEdicion={empezarEdicion}
          borrarAccion={borrarAccion}
        />
      </div>
    </>
  );
}
