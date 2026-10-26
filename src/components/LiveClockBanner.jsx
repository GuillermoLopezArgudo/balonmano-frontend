import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  HALF_MINUTES,
  fmtClock,
  liveBannerState,
  subscribeLiveClock,
} from '../liveClock';

export default function LiveClockBanner() {
  const { canRead } = useAuth();
  const location = useLocation();
  const [state, setState] = useState(() => liveBannerState());

  useEffect(() => {
    const refresh = () => setState(liveBannerState());
    refresh();
    const unsub = subscribeLiveClock(refresh);
    const tick = setInterval(refresh, 1000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, []);

  if (!state || !canRead('directo')) return null;

  const onDirecto =
    location.pathname === `/partidos/${state.id_partido}/directo` ||
    location.pathname.startsWith(`/partidos/${state.id_partido}/directo/`);

  if (onDirecto) return null;

  const to = `/partidos/${state.id_partido}/directo`;

  return (
    <Link
      to={to}
      className={`live-clock-banner${state.running ? ' is-running' : ' is-paused'}`}
      aria-label={`Volver al partido en directo. ${state.labelParte} parte, ${fmtClock(state.remaining)} restantes`}
    >
      <span className="live-clock-banner-dot" aria-hidden="true" />
      <span className="live-clock-banner-main">
        <strong>
          {state.local} {state.goles_local}–{state.goles_visitante} {state.visitante}
        </strong>
        <span>
          {state.running ? 'EN DIRECTO' : 'PAUSADO'} · {state.labelParte} ·{' '}
          {fmtClock(state.remaining)}
          <span className="live-clock-banner-max"> / {HALF_MINUTES}&apos;</span>
        </span>
      </span>
      <span className="live-clock-banner-cta">Abrir</span>
    </Link>
  );
}
