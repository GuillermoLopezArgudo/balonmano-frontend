import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const FILTROS = [
  { key: 'temporada', label: 'Temporada' },
  { key: 'ultimos5', label: 'Últimos 5 partidos' },
  { key: 'liga', label: 'Liga' },
];

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function Analitica() {
  const { equipo } = useAuth();
  const [dash, setDash] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [gkStats, setGkStats] = useState([]);
  const [filtro, setFiltro] = useState('temporada');
  const [error, setError] = useState('');

  useAbortable(async ({ signal, alive }) => {
    try {
      const [d, p, gk] = await Promise.all([
        api.getDashboard({ signal }),
        api.getPartidos({ signal }),
        api.getEstadisticasPorteros({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
      ]);
      if (!alive()) return;
      setDash(d);
      setPartidos(p);
      setGkStats(gk);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const myId = equipo?.id_equipo;

  const jugados = useMemo(() => {
    const now = new Date();
    let list = partidos
      .filter((p) => new Date(p.fecha) <= now)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (filtro === 'ultimos5') list = list.slice(-5);
    return list;
  }, [partidos, filtro]);

  const metrics = useMemo(() => {
    let golesFavor = 0;
    let golesContra = 0;
    for (const p of jugados) {
      if (p.id_equipo_local === myId) {
        golesFavor += p.goles_local || 0;
        golesContra += p.goles_visitante || 0;
      } else {
        golesFavor += p.goles_visitante || 0;
        golesContra += p.goles_local || 0;
      }
    }
    const n = jugados.length || 1;
    const golesPromedio = jugados.length ? golesFavor / jugados.length : 0;
    const total = golesFavor + golesContra;
    const efiEquipo = total ? Math.round((golesFavor / total) * 100) : dash?.efectividad || 0;
    const efiRival = total ? Math.round((golesContra / total) * 100) : 0;

    const paradas = gkStats.reduce((a, s) => a + (s.paradas || 0), 0);
    const recibidos = gkStats.reduce((a, s) => a + (s.lanzamientos_recibidos || 0), 0);
    const efiPortero = recibidos ? Math.round((paradas / recibidos) * 100) : 0;

    return {
      golesFavor,
      golesContra,
      golesPromedio,
      efiEquipo,
      efiRival,
      paradas,
      recibidos,
      efiPortero,
      partidos: jugados.length,
    };
  }, [jugados, myId, dash, gkStats]);

  const evolucion = useMemo(() => {
    return jugados.map((p) => {
      const goles =
        p.id_equipo_local === myId ? p.goles_local || 0 : p.goles_visitante || 0;
      return {
        id: p.id_partido,
        label: p.jornada ? String(p.jornada) : new Date(p.fecha).getDate(),
        goles,
        rival:
          p.id_equipo_local === myId ? p.equipo_visitante_nombre : p.equipo_local_nombre,
      };
    });
  }, [jugados, myId]);

  const maxGoles = Math.max(1, ...evolucion.map((e) => e.goles), 1);

  const exportar = () => {
    const lines = [
      'Métrica,Valor',
      `Partidos,${metrics.partidos}`,
      `Goles promedio,${metrics.golesPromedio.toFixed(1)}`,
      `Eficacia equipo,${metrics.efiEquipo}%`,
      `Eficacia rival,${metrics.efiRival}%`,
      `Paradas,${metrics.paradas}`,
      `Tiros recibidos,${metrics.recibidos}`,
      `Eficacia portero,${metrics.efiPortero}%`,
      '',
      'Posición,Efectividad',
      ...(dash?.efectividad_por_posicion || []).map(
        (r) => `${r.posicion},${r.efectividad}%`,
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analitica-${equipo?.datos?.nombre || 'equipo'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) return <p className="error">{error}</p>;
  if (!dash) return <p className="muted">Cargando analítica…</p>;

  const temporada =
    jugados[0]?.temporada_nombre ||
    partidos[0]?.temporada_nombre ||
    'Temporada actual';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">SCOUTING · {equipo?.datos?.nombre || 'EQUIPO'}</p>
          <h1>Analítica comparativa</h1>
        </div>
        <div className="add-player-actions">
          <Link to="/analitica/porteros">
            <button type="button" className="ghost">
              Porteros
            </button>
          </Link>
          <button type="button" onClick={exportar}>
            Exportar informe
          </button>
        </div>
      </header>

      <div className="filters roster-filters">
        {FILTROS.map((f) => (
          <button
            type="button"
            key={f.key}
            className={filtro === f.key ? 'active' : ''}
            onClick={() => setFiltro(f.key)}
          >
            {f.key === 'temporada' ? temporada : f.label}
          </button>
        ))}
      </div>

      <div className="metrics analitica-kpis">
        <div className="metric">
          <span>Goles promedio</span>
          <strong className="c-lime">{fmt(metrics.golesPromedio)}</strong>
          <small>
            Totales: {metrics.golesFavor} en {metrics.partidos} partidos
          </small>
        </div>
        <div className="metric">
          <span>Eficacia equipo</span>
          <strong className="c-cyan">{metrics.efiEquipo}%</strong>
          <small>
            GF {metrics.golesFavor} · GC {metrics.golesContra}
          </small>
        </div>
        <div className="metric">
          <span>Eficacia portero</span>
          <strong className="c-orange">{metrics.efiPortero || metrics.efiRival}%</strong>
          <small>
            {metrics.paradas
              ? `${metrics.paradas} paradas / ${metrics.recibidos}`
              : `Rival ${metrics.efiRival}% del marcador`}
          </small>
        </div>
      </div>

      <div className="grid-2 analitica-mid">
        <section className="panel">
          <h2>Eficacia de tiro por posición</h2>
          {(dash.efectividad_por_posicion || []).map((row, i) => (
            <div className="bar-row" key={row.posicion}>
              <span>{row.posicion}</span>
              <div className="bar-track">
                <div
                  className={`bar-fill c${i % 5}`}
                  style={{
                    width: `${Math.min(Math.max(row.efectividad || 0, 0), 100)}%`,
                  }}
                />
              </div>
              <strong>{row.efectividad}%</strong>
            </div>
          ))}
          {!dash.efectividad_por_posicion?.length && (
            <p className="muted">Sin datos por posición</p>
          )}
        </section>

        <section className="panel">
          <h2>Rendimiento de portería</h2>
          <div className="gk-summary">
            <div>
              <span>Paradas</span>
              <strong>{metrics.paradas}</strong>
            </div>
            <div>
              <span>Tiros recibidos</span>
              <strong>{metrics.recibidos}</strong>
            </div>
            <div>
              <span>Efectividad</span>
              <strong className="c-orange">{metrics.efiPortero}%</strong>
            </div>
            <div>
              <span>Goles encajados</span>
              <strong>{metrics.golesContra}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel forma-panel">
        <h2>Evolución de goles por partido</h2>
        {evolucion.length ? (
          <div className="analitica-bars">
            {evolucion.map((e) => (
              <div className="analitica-bar" key={e.id} title={`${e.rival}: ${e.goles}`}>
                <span className="analitica-bar-val">{e.goles}</span>
                <div className="analitica-bar-track">
                  <div
                    className="analitica-bar-fill"
                    style={{ height: `${Math.max(10, (e.goles / maxGoles) * 100)}%` }}
                  />
                </div>
                <span className="analitica-bar-label">{e.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Sin partidos finalizados todavía</p>
        )}
      </section>
    </>
  );
}
