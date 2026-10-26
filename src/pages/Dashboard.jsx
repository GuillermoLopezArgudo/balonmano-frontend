import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

function soyLocalPartido(partido, idEquipo) {
  if (!partido || !idEquipo) return true;
  const myId = String(idEquipo);
  if (
    partido.es_local != null &&
    partido.id_equipo != null &&
    String(partido.id_equipo) === myId
  ) {
    return Boolean(partido.es_local);
  }
  return String(partido.id_equipo_local) === myId;
}

function rivalPartido(partido, idEquipo) {
  const local = soyLocalPartido(partido, idEquipo);
  return (
    (local ? partido.equipo_visitante_nombre : partido.equipo_local_nombre) ||
    'Rival por definir'
  );
}

function resultadoVsEquipo(partido, idEquipo) {
  if (!partido || !idEquipo) return null;
  const soyLocal = soyLocalPartido(partido, idEquipo);
  const gf = soyLocal ? partido.goles_local ?? 0 : partido.goles_visitante ?? 0;
  const gc = soyLocal ? partido.goles_visitante ?? 0 : partido.goles_local ?? 0;
  const rival = rivalPartido(partido, idEquipo);
  let marca = 'E';
  let marcaLabel = 'Empate';
  if (gf > gc) {
    marca = 'V';
    marcaLabel = 'Victoria';
  } else if (gf < gc) {
    marca = 'D';
    marcaLabel = 'Derrota';
  }
  return {
    marca,
    marcaLabel,
    gf,
    gc,
    rival,
    condicion: soyLocal ? 'Local' : 'Visitante',
    fecha: partido.fecha,
  };
}

function fmtFechaPartido(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Dashboard() {
  const { equipo, canWritePartidos } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useAbortable(async ({ signal, alive }) => {
    try {
      const d = await api.getDashboard({ signal });
      if (!alive()) return;
      setData(d);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const forma = useMemo(() => {
    if (!data?.ultimos_partidos?.length || !equipo?.id_equipo) return [];
    return data.ultimos_partidos
      .filter((p) => (p.estado || 'jugado') === 'jugado')
      .slice(0, 5)
      .map((p) => resultadoVsEquipo(p, equipo.id_equipo))
      .filter(Boolean);
  }, [data, equipo]);

  const proximo = data?.proximos_partidos?.[0];
  const proximoLocal = proximo ? soyLocalPartido(proximo, equipo?.id_equipo) : true;
  const proximoRival = proximo
    ? rivalPartido(proximo, equipo?.id_equipo)
    : null;
  const nosotrosNombre =
    equipo?.datos?.nombre_corto ||
    equipo?.datos?.nombre ||
    data?.equipo_nombre ||
    'Tu equipo';

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando resumen…</p>;

  const eyebrow = [
    'EQUIPO BALONMANO',
    equipo?.datos?.categoria,
    equipo?.datos?.competicion,
  ]
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">{eyebrow}</p>
          <h1>Resumen del equipo</h1>
        </div>
      </header>

      <div className="metrics">
        <div className="metric">
          <span>Partidos</span>
          <strong className="c-lime">{data.partidos_jugados}</strong>
        </div>
        <div className="metric">
          <span>Goles marcados</span>
          <strong className="c-cyan">{data.goles_totales}</strong>
        </div>
        <div className="metric">
          <span>Eficacia de tiro</span>
          <strong className="c-purple">{data.efectividad}%</strong>
        </div>
      </div>

      <div className="grid-2 dash-main">
        <section className="panel dash-gk-panel">
          <div className="dash-panel-head">
            <div>
              <h2>Portería</h2>
              <p className="panel-hint">Paradas y goles recibidos del equipo</p>
            </div>
            <Link to="/analitica?seccion=porteros">
              <button type="button" className="ghost">
                Detalle
              </button>
            </Link>
          </div>
          <div className="dash-gk-grid">
            <div className="dash-gk-stat">
              <span>Paradas</span>
              <strong className="c-lime">{data.paradas ?? 0}</strong>
              <small>
                {(data.lanzamientos_recibidos ?? 0) > 0
                  ? `${data.lanzamientos_recibidos} tiros recibidos`
                  : 'Sin tiros aún'}
              </small>
            </div>
            <div className="dash-gk-stat">
              <span>Goles encajados</span>
              <strong className="c-orange">{data.goles_recibidos ?? 0}</strong>
              <small>En portería propia</small>
            </div>
            <div className="dash-gk-stat">
              <span>% paradas</span>
              <strong className="c-cyan">{data.efectividad_paradas ?? 0}%</strong>
              <small>Paradas / tiros</small>
            </div>
          </div>
        </section>

        <section className="match-card dash-next-card">
          <div className="match-card-body">
            <div className="dash-next-tags">
              <span className="match-tag">Próximo partido</span>
              {proximo?.jornada != null && (
                <span className="match-tag match-tag-muted">Jornada {proximo.jornada}</span>
              )}
              {proximo && (
                <span className="match-tag match-tag-muted">
                  {proximoLocal ? 'Local' : 'Visitante'}
                </span>
              )}
            </div>
            {proximo ? (
              <>
                <div className="dash-next-vs">
                  <div className="dash-next-side is-us">
                    <span className="dot lime" />
                    <strong>{nosotrosNombre}</strong>
                  </div>
                  <span className="dash-next-sep">vs</span>
                  <div className="dash-next-side is-rival">
                    <span className="dot purple" />
                    <strong title={proximoRival}>{proximoRival}</strong>
                  </div>
                </div>
                <p className="dash-next-when">{fmtFechaPartido(proximo.fecha)}</p>
                {(proximo.pabellon || proximo.competicion) && (
                  <p className="muted dash-next-meta">
                    {[proximo.competicion, proximo.pabellon].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="dash-next-actions">
                  <Link to={`/partidos/${proximo.id_partido}`}>
                    <button type="button" className="ghost">
                      Ver partido
                    </button>
                  </Link>
                  <Link to="/partidos">
                    <button type="button" className="ghost">
                      Calendario
                    </button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
                  No hay partidos programados todavía.
                </p>
                {canWritePartidos && (
                  <Link to="/partidos/nuevo">
                    <button type="button">Programar partido</button>
                  </Link>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Eficacia por posición</h2>
        <p className="panel-hint">Goles / lanzamientos por familia de posición</p>
        {data.efectividad_por_posicion.map((row, i) => (
          <div className="bar-row" key={row.posicion}>
            <span>{row.posicion}</span>
            <div className="bar-track">
              <div
                className={`bar-fill c${i % 5}`}
                style={{ width: `${Math.min(Math.max(row.efectividad || 0, 0), 100)}%` }}
              />
            </div>
            <strong>{row.efectividad}%</strong>
          </div>
        ))}
        {!data.efectividad_por_posicion.length && (
          <p className="muted">Sin datos de eficacia todavía</p>
        )}
      </section>

      <section className="panel forma-panel">
        <h2>Últimos resultados</h2>
        <div className="forma-row">
          {forma.length ? (
            forma.map((f, i) => (
              <div
                key={`${f.rival}-${f.fecha}-${i}`}
                className={`forma-chip ${f.marca.toLowerCase()}`}
                title={`${f.marcaLabel} ${f.gf}-${f.gc} · ${f.condicion} vs ${f.rival}`}
              >
                <strong>
                  {f.marca} {f.gf}-{f.gc}
                </strong>
                <span className="forma-chip-rival">{f.rival}</span>
                <small className="forma-chip-meta">{f.condicion}</small>
              </div>
            ))
          ) : (
            <p className="muted">Sin partidos jugados todavía</p>
          )}
        </div>
      </section>
    </>
  );
}
