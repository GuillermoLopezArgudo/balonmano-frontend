import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const PERIODOS = [
  { key: 'completa', label: 'Temporada completa' },
  { key: 'ultimos5', label: 'Últimos 5 partidos' },
  { key: 'ultimos10', label: 'Últimos 10 partidos' },
];

const ZONE_TABS = [
  { id: 'paradas', label: 'Metas' },
  { id: 'tiros', label: 'Tiros' },
  { id: 'efectividad', label: 'Distancias' },
];

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function zoneTone(pct) {
  if (pct >= 40) return 'good';
  if (pct >= 30) return 'mid';
  return 'bad';
}

export default function AnaliticaPorteros() {
  const { equipo } = useAuth();
  const [periodo, setPeriodo] = useState('completa');
  const [zoneTab, setZoneTab] = useState('paradas');
  const [partidos, setPartidos] = useState([]);
  const [gkStats, setGkStats] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [error, setError] = useState('');

  useAbortable(async ({ signal, alive }) => {
    try {
      const [p, gk, j] = await Promise.all([
        api.getPartidos({ signal }),
        api.getEstadisticasPorteros({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
        api.getJugadores({ signal }),
      ]);
      if (!alive()) return;
      setPartidos(p);
      setGkStats(gk);
      setJugadores(j);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const myId = equipo?.id_equipo;

  const partidosFiltrados = useMemo(() => {
    const now = new Date();
    let list = partidos
      .filter((p) => new Date(p.fecha) <= now)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (periodo === 'ultimos5') list = list.slice(0, 5);
    if (periodo === 'ultimos10') list = list.slice(0, 10);
    return list;
  }, [partidos, periodo]);

  const partidoIds = useMemo(
    () => new Set(partidosFiltrados.map((p) => p.id_partido)),
    [partidosFiltrados],
  );

  const statsFiltradas = useMemo(
    () => gkStats.filter((s) => partidoIds.has(s.id_partido)),
    [gkStats, partidoIds],
  );

  const metrics = useMemo(() => {
    const paradas = statsFiltradas.reduce((a, s) => a + (s.paradas || 0), 0);
    const recibidos = statsFiltradas.reduce((a, s) => a + (s.lanzamientos_recibidos || 0), 0);
    const efi = recibidos ? (paradas / recibidos) * 100 : 0;
    const n = partidosFiltrados.length || 1;

    let limpias = 0;
    for (const p of partidosFiltrados) {
      const gc =
        p.id_equipo_local === myId ? p.goles_visitante || 0 : p.goles_local || 0;
      if (gc === 0) limpias += 1;
    }

    const zonas = {
      '6m': { paradas: 0, lanzamientos: 0 },
      '9m': { paradas: 0, lanzamientos: 0 },
      '7m': { paradas: 0, lanzamientos: 0 },
      extremo: { paradas: 0, lanzamientos: 0 },
      contraataque: { paradas: 0, lanzamientos: 0 },
    };
    for (const s of statsFiltradas) {
      zonas['6m'].paradas += s.paradas_6m || 0;
      zonas['6m'].lanzamientos += s.lanzamientos_6m || 0;
      zonas['9m'].paradas += s.paradas_9m || 0;
      zonas['9m'].lanzamientos += s.lanzamientos_9m || 0;
      zonas['7m'].paradas += s.paradas_7m || 0;
      zonas['7m'].lanzamientos += s.lanzamientos_7m || 0;
      zonas.extremo.paradas += s.paradas_extremo || 0;
      zonas.extremo.lanzamientos += s.lanzamientos_extremo || 0;
      zonas.contraataque.paradas += s.paradas_contraataque || 0;
      zonas.contraataque.lanzamientos += s.lanzamientos_contraataque || 0;
    }

    return {
      paradas,
      recibidos,
      efi,
      limpias,
      partidos: partidosFiltrados.length,
      porPartidoParadas: partidosFiltrados.length ? paradas / partidosFiltrados.length : 0,
      porPartidoTiros: partidosFiltrados.length ? recibidos / partidosFiltrados.length : 0,
      zonas,
    };
  }, [statsFiltradas, partidosFiltrados, myId]);

  const porPortero = useMemo(() => {
    const map = {};
    for (const s of statsFiltradas) {
      if (!map[s.id_jugador]) {
        map[s.id_jugador] = { paradas: 0, recibidos: 0, partidos: 0 };
      }
      map[s.id_jugador].paradas += s.paradas || 0;
      map[s.id_jugador].recibidos += s.lanzamientos_recibidos || 0;
      map[s.id_jugador].partidos += 1;
    }
    return Object.entries(map)
      .map(([jid, vals]) => {
        const j = jugadores.find((x) => x.id_jugador === jid);
        return {
          id: jid,
          nombre: j ? `${j.nombre} ${j.apellido}` : 'Portero',
          dorsal: j?.dorsal,
          ...vals,
          efi: vals.recibidos ? Math.round((vals.paradas / vals.recibidos) * 100) : 0,
        };
      })
      .sort((a, b) => b.paradas - a.paradas);
  }, [statsFiltradas, jugadores]);

  const exportar = () => {
    const lines = [
      'Métrica,Valor',
      `Paradas,${metrics.paradas}`,
      `Tiros recibidos,${metrics.recibidos}`,
      `Efectividad,${metrics.efi.toFixed(1)}%`,
      `Porterías a cero,${metrics.limpias}`,
      `Partidos,${metrics.partidos}`,
      '',
      'Portero,Paradas,Recibidos,Eficacia',
      ...porPortero.map(
        (p) => `${p.nombre},${p.paradas},${p.recibidos},${p.efi}%`,
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analitica-porteros-${equipo?.datos?.nombre || 'equipo'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const zoneEntries = Object.entries(metrics.zonas).map(([key, vals]) => {
    const pct = vals.lanzamientos
      ? Math.round((vals.paradas / vals.lanzamientos) * 100)
      : 0;
    const labels = {
      '6m': '6 m',
      '9m': '9 m',
      '7m': '7 m',
      extremo: 'Extremo',
      contraataque: 'Contra',
    };
    let value = vals.paradas;
    if (zoneTab === 'tiros') value = vals.lanzamientos;
    if (zoneTab === 'efectividad') value = `${pct}%`;
    return { key, label: labels[key] || key, pct, value, ratio: `${vals.paradas}/${vals.lanzamientos}` };
  });

  if (error) return <p className="error">{error}</p>;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">ENTRENAMIENTO / PORTERÍA</p>
          <h1>Analítica de porteros</h1>
        </div>
        <div className="add-player-actions">
          <button type="button" className="ghost" onClick={exportar}>
            Exportar datos
          </button>
          <Link to="/partidos/nuevo">
            <button type="button">Nueva Sesión</button>
          </Link>
        </div>
      </header>

      <div className="gk-anal-filters">
        <div className="filters roster-filters" style={{ marginBottom: 0 }}>
          <Link to="/analitica">
            <button type="button">Comparativa</button>
          </Link>
          <button type="button" className="active">
            Porteros
          </button>
        </div>
        <div className="field" style={{ minWidth: 200 }}>
          <label>Periodo</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="acta-stat-rows gk-anal-kpis">
        <div className="acta-stat-row">
          <strong className="c-orange">{metrics.paradas}</strong>
          <div>
            <span>Paradas</span>
            <small>{fmt(metrics.porPartidoParadas)} por partido</small>
          </div>
        </div>
        <div className="acta-stat-row">
          <strong className="c-cyan">{metrics.recibidos}</strong>
          <div>
            <span>Tiros recibidos</span>
            <small>{fmt(metrics.porPartidoTiros)} por partido</small>
          </div>
        </div>
        <div className="acta-stat-row">
          <strong className="c-lime">{fmt(metrics.efi)}%</strong>
          <div>
            <span>Efectividad</span>
            <small>
              {metrics.paradas}/{metrics.recibidos} · {metrics.partidos} partidos
            </small>
          </div>
        </div>
        <div className="acta-stat-row">
          <strong className="c-purple">
            {metrics.partidos
              ? Math.round((metrics.limpias / metrics.partidos) * 100)
              : 0}
            %
          </strong>
          <div>
            <span>Limpias</span>
            <small>
              {metrics.limpias} de {metrics.partidos} partidos
            </small>
          </div>
        </div>
      </div>

      <section className="panel forma-panel">
        <div className="gk-zone-head">
          <h2>Zonas de incidencia</h2>
          <div className="filters roster-filters" style={{ marginBottom: 0 }}>
            {ZONE_TABS.map((t) => (
              <button
                type="button"
                key={t.id}
                className={zoneTab === t.id ? 'active' : ''}
                onClick={() => setZoneTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="gk-goal">
          <div className="gk-goal-frame">
            {zoneEntries.slice(0, 3).map((z) => (
              <div key={z.key} className={`gk-goal-cell tone-${zoneTone(z.pct)}`}>
                <strong>{z.value}</strong>
                <small>{z.label}</small>
              </div>
            ))}
          </div>
          <div className="gk-goal-extras">
            {zoneEntries.slice(3).map((z) => (
              <div key={z.key} className={`zone-card tone-${zoneTone(z.pct)}`}>
                <span className="muted">{z.label}</span>
                <strong>{z.value}</strong>
                <small className="muted">{z.ratio}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel forma-panel">
        <h2>Por portero</h2>
        <div className="roster-list">
          {porPortero.map((p) => (
            <div className="roster-row acta-player-row" key={p.id}>
              <div className="roster-player">
                <span>
                  <strong>
                    #{p.dorsal ?? '—'} {p.nombre}
                  </strong>
                  <small>{p.partidos} partidos</small>
                </span>
              </div>
              <span className="roster-cell accent-orange">{p.paradas}</span>
              <span className="roster-cell">{p.recibidos}</span>
              <span className="roster-cell valor">{p.efi}%</span>
            </div>
          ))}
          {!porPortero.length && (
            <p className="muted">Sin estadísticas de porteros todavía</p>
          )}
        </div>
      </section>
    </>
  );
}
