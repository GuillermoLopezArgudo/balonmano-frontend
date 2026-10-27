import { HALF_MINUTES, HALF_SEC, fmtClock } from '../../liveClock';

export default function LiveMarcador({ partido, score, clock }) {
  const { parte, setParte, seconds, setSeconds, running, setRunning, remaining } = clock;
  return (
    <div className="live-board">
      <div className="live-board-team left">{partido?.equipo_local_nombre || 'Local'}</div>
      <div className="live-board-center">
        <div className="live-board-score">
          {score.local} – {score.visitante}
        </div>
        <div className="live-board-meta">
          <span className="live-dot" />
          EN DIRECTO {fmtClock(remaining)}
          <span className="muted" style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}>
            / {HALF_MINUTES}&apos;
          </span>
          <button
            type="button"
            className="ghost live-clock-btn"
            onClick={() => {
              if (seconds >= HALF_SEC) return;
              setRunning((r) => !r);
            }}
            disabled={seconds >= HALF_SEC}
            title={seconds >= HALF_SEC ? 'Parte terminada' : running ? 'Pausar' : 'Reanudar'}
          >
            {running ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className="ghost live-clock-btn live-clock-btn-wide"
            onClick={() => {
              setRunning(false);
              setParte((p) => (p === 1 ? 2 : 1));
              setSeconds(0);
            }}
            title="Cambiar parte (reinicia el reloj de esa parte)"
          >
            {parte === 1 ? '2ª parte' : '1ª parte'}
          </button>
        </div>
      </div>
      <div className="live-board-team right">{partido?.equipo_visitante_nombre || 'Visitante'}</div>
    </div>
  );
}
