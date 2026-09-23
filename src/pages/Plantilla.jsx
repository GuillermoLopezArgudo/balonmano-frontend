import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbortError, mediaUrl } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const FILTROS = [
  { key: 'Todos', match: null },
  { key: 'Porteros', match: 'Portero' },
  { key: 'Extremos', match: 'Extremo' },
  { key: 'Laterales', match: 'Lateral' },
  { key: 'Centrales', match: 'Central' },
  { key: 'Pivotes', match: 'Pivote' },
];

const AVATAR_COLORS = ['#ff7a18', '#ccff00', '#38bdf8', '#8b5cf6', '#2dd4bf', '#f472b6'];

function edad(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a;
}

function initials(j) {
  return `${(j.nombre || '?')[0]}${(j.apellido || '?')[0]}`.toUpperCase();
}

function posLabel(j) {
  return j.posiciones?.[0] || 'Sin posición';
}

function isPortero(j) {
  return (j.posiciones || []).some((p) => p.toLowerCase().includes('portero'));
}

function matchesFiltro(j, match) {
  if (!match) return true;
  return (j.posiciones || []).some((p) => p.toLowerCase().includes(match.toLowerCase()));
}

export default function Plantilla() {
  const { equipo } = useAuth();
  const [jugadores, setJugadores] = useState([]);
  const [stats, setStats] = useState({});
  const [filtro, setFiltro] = useState('Todos');
  const [error, setError] = useState('');

  const applyLoad = (j, resumen) => {
    setJugadores(j);
    const map = {};
    for (const r of resumen) {
      map[r.id_jugador] = r;
    }
    setStats(map);
  };

  const load = async () => {
    const [j, resumen] = await Promise.all([
      api.getJugadores(),
      api.getResumenJugadores().catch(() => []),
    ]);
    applyLoad(j, resumen);
  };

  useAbortable(async ({ signal, alive }) => {
    try {
      const [j, resumen] = await Promise.all([
        api.getJugadores({ signal }),
        api.getResumenJugadores({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
      ]);
      if (!alive()) return;
      applyLoad(j, resumen);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const counts = useMemo(() => {
    const c = { Todos: jugadores.length };
    for (const f of FILTROS.slice(1)) {
      c[f.key] = jugadores.filter((j) => matchesFiltro(j, f.match)).length;
    }
    return c;
  }, [jugadores]);

  const filtrados = useMemo(() => {
    const match = FILTROS.find((f) => f.key === filtro)?.match;
    return jugadores.filter((j) => matchesFiltro(j, match));
  }, [jugadores, filtro]);

  const eyebrow = [equipo?.datos?.competicion, equipo?.datos?.categoria]
    .filter(Boolean)
    .join(' / ')
    .toUpperCase();

  return (
    <>
      <header className="page-head">
        <div>
          {eyebrow && <p className="page-kicker">{eyebrow}</p>}
          <h1>Plantilla</h1>
        </div>
        <Link to="/plantilla/nuevo">
          <button type="button">+ Añadir jugador</button>
        </Link>
      </header>

      <div className="filters roster-filters">
        {FILTROS.map((f) => (
          <button
            type="button"
            key={f.key}
            className={filtro === f.key ? 'active' : ''}
            onClick={() => setFiltro(f.key)}
          >
            {f.key}: {counts[f.key] ?? 0}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <section className="roster-panel">
        <div className="roster-head">
          <span>Nombre / Posición</span>
          <span>Edad</span>
          <span>Partidos</span>
          <span>Valoración</span>
          <span />
        </div>

        <div className="roster-list">
          {filtrados.map((j, idx) => {
            const s = stats[j.id_jugador];
            const partidos = s?.partidos ?? null;
            const valor =
              s && s.lanzamientos > 0
                ? Math.round((s.goles / s.lanzamientos) * 100)
                : null;
            const portero = isPortero(j);

            return (
              <div
                key={j.id_jugador}
                className={`roster-row${portero ? ' is-gk' : ''}`}
              >
                <Link to={`/plantilla/${j.id_jugador}`} className="roster-player">
                  {j.img_foto ? (
                    <span className="avatar avatar-photo">
                      <img src={mediaUrl(j.img_foto)} alt="" />
                    </span>
                  ) : (
                    <span
                      className="avatar"
                      style={{
                        background: portero
                          ? 'var(--orange)'
                          : AVATAR_COLORS[idx % AVATAR_COLORS.length],
                      }}
                    >
                      {initials(j)}
                    </span>
                  )}
                  <span>
                    <strong>
                      {j.nombre} {j.apellido}
                    </strong>
                    <small>{posLabel(j)}</small>
                  </span>
                </Link>
                <span className="roster-cell">{edad(j.fecha_nacimiento) ?? '—'}</span>
                <span className={`roster-cell${portero ? ' accent-orange' : ''}`}>
                  {partidos != null && partidos > 0 ? partidos : '—'}
                </span>
                <span className={`roster-cell valor${portero ? ' accent-orange' : ''}`}>
                  {valor != null ? `${valor}%` : '—'}
                </span>
                <div className="roster-actions">
                  <Link
                    to={`/plantilla/${j.id_jugador}/editar`}
                    className="roster-edit"
                    title="Editar jugadora"
                    aria-label={`Editar ${j.nombre} ${j.apellido}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.5 6.5l3 3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Link>
                  <button
                    type="button"
                    className="roster-del"
                    title="Eliminar jugadora"
                    aria-label={`Eliminar ${j.nombre} ${j.apellido}`}
                    onClick={async () => {
                      if (!confirm('¿Borrar jugadora?')) return;
                      await api.deleteJugador(j.id_jugador);
                      await load();
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {!filtrados.length && (
            <p className="muted" style={{ padding: '1.25rem' }}>
              No hay jugadores en este filtro
            </p>
          )}
        </div>
      </section>
    </>
  );
}
