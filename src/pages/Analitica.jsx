import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const SECCIONES = [
  { key: 'equipo', label: 'Equipo' },
  { key: 'porteros', label: 'Porteros' },
];

const FILTROS = [
  { key: 'temporada', label: 'Temporada' },
  { key: 'ultimos5', label: 'Últimos 5' },
  { key: 'ultimos10', label: 'Últimos 10' },
];

const ZONE_TABS = [
  { id: 'paradas', label: 'Paradas' },
  { id: 'tiros', label: 'Tiros' },
  { id: 'efectividad', label: 'Eficacia' },
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

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function printHtml(title, bodyHtml) {
  const prev = document.getElementById('siete-print-frame');
  if (prev) prev.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'siete-print-frame';
  iframe.title = 'Impresión informe';
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error('No se pudo preparar la impresión');
  }

  doc.open();
  doc.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:2rem;color:#111;max-width:900px;margin:0 auto}
      h1{margin:0 0 .25rem;font-size:1.55rem}
      h2{margin:1.4rem 0 .55rem;font-size:1.05rem}
      .muted{color:#666;margin:0 0 1rem}
      table{width:100%;border-collapse:collapse;margin-top:.45rem;font-size:.9rem}
      th,td{border-bottom:1px solid #ddd;padding:.45rem .35rem;text-align:left}
      th{color:#555;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
      .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.85rem;margin:1rem 0}
      .kpi{border:1px solid #e5e5e5;border-radius:8px;padding:.85rem}
      .kpi span{display:block;color:#666;font-size:.75rem}
      .kpi strong{display:block;font-size:1.3rem;margin-top:.2rem}
      @media print{.no-print{display:none}}
    </style></head><body>${bodyHtml}</body></html>`);
  doc.close();

  const doPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      setTimeout(() => iframe.remove(), 1000);
    }
  };

  if (iframe.contentDocument?.readyState === 'complete') {
    setTimeout(doPrint, 50);
  } else {
    iframe.onload = () => setTimeout(doPrint, 50);
  }
}

export default function Analitica() {
  const { equipo } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const seccionParam = searchParams.get('seccion');
  const seccion = seccionParam === 'porteros' ? 'porteros' : 'equipo';

  const [dash, setDash] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [gkStats, setGkStats] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [filtro, setFiltro] = useState('temporada');
  const [zoneTab, setZoneTab] = useState('paradas');
  const [rivalSel, setRivalSel] = useState('');
  const [error, setError] = useState('');

  useAbortable(async ({ signal, alive }) => {
    try {
      const [d, p, gk, j] = await Promise.all([
        api.getDashboard({ signal }),
        api.getPartidos({ signal }),
        api.getEstadisticasPorteros({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
        api.getJugadores({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
      ]);
      if (!alive()) return;
      setDash(d);
      setPartidos(p);
      setGkStats(gk);
      setJugadores(j);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const myId = equipo?.id_equipo;

  const setSeccion = (key) => {
    if (key === 'porteros') setSearchParams({ seccion: 'porteros' });
    else setSearchParams({});
  };

  const jugados = useMemo(() => {
    const now = new Date();
    let list = partidos
      .filter((p) => new Date(p.fecha) <= now)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (filtro === 'ultimos5') list = list.slice(-5);
    if (filtro === 'ultimos10') list = list.slice(-10);
    return list;
  }, [partidos, filtro]);

  const partidoIds = useMemo(
    () => new Set(jugados.map((p) => p.id_partido)),
    [jugados],
  );

  const gkFiltradas = useMemo(
    () => gkStats.filter((s) => partidoIds.has(s.id_partido)),
    [gkStats, partidoIds],
  );

  const metrics = useMemo(() => {
    let golesFavor = 0;
    let golesContra = 0;
    let limpias = 0;
    for (const p of jugados) {
      let gf;
      let gc;
      if (p.id_equipo_local === myId) {
        gf = p.goles_local || 0;
        gc = p.goles_visitante || 0;
      } else {
        gf = p.goles_visitante || 0;
        gc = p.goles_local || 0;
      }
      golesFavor += gf;
      golesContra += gc;
      if (gc === 0) limpias += 1;
    }
    const golesPromedio = jugados.length ? golesFavor / jugados.length : 0;
    const total = golesFavor + golesContra;
    const efiEquipo = total ? Math.round((golesFavor / total) * 100) : dash?.efectividad || 0;
    const efiRival = total ? Math.round((golesContra / total) * 100) : 0;

    const paradas = gkFiltradas.reduce((a, s) => a + (s.paradas || 0), 0);
    const recibidos = gkFiltradas.reduce((a, s) => a + (s.lanzamientos_recibidos || 0), 0);
    const efiPortero = recibidos ? Math.round((paradas / recibidos) * 100) : 0;

    const zonas = {
      '6m': { paradas: 0, lanzamientos: 0 },
      '9m': { paradas: 0, lanzamientos: 0 },
      '7m': { paradas: 0, lanzamientos: 0 },
      extremo: { paradas: 0, lanzamientos: 0 },
      contraataque: { paradas: 0, lanzamientos: 0 },
    };
    for (const s of gkFiltradas) {
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
      golesFavor,
      golesContra,
      golesPromedio,
      efiEquipo,
      efiRival,
      paradas,
      recibidos,
      efiPortero,
      limpias,
      partidos: jugados.length,
      porPartidoParadas: jugados.length ? paradas / jugados.length : 0,
      porPartidoTiros: jugados.length ? recibidos / jugados.length : 0,
      zonas,
    };
  }, [jugados, myId, dash, gkFiltradas]);

  const porPortero = useMemo(() => {
    const map = {};
    for (const s of gkFiltradas) {
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
  }, [gkFiltradas, jugadores]);

  const evolucion = useMemo(() => {
    return jugados.map((p) => {
      const local = p.id_equipo_local === myId;
      const gf = local ? p.goles_local || 0 : p.goles_visitante || 0;
      const gc = local ? p.goles_visitante || 0 : p.goles_local || 0;
      const diff = gf - gc;
      return {
        id: p.id_partido,
        label: p.jornada ? String(p.jornada) : new Date(p.fecha).getDate(),
        goles: gf,
        gf,
        gc,
        diff,
        resultado: diff > 0 ? 'V' : diff < 0 ? 'D' : 'E',
        rival:
          local ? p.equipo_visitante_nombre : p.equipo_local_nombre,
      };
    });
  }, [jugados, myId]);

  const maxGoles = Math.max(
    1,
    ...evolucion.flatMap((e) => [e.gf, e.gc]),
    1,
  );

  const rivalesOpts = useMemo(() => {
    const map = new Map();
    for (const e of evolucion) {
      const name = (e.rival || '').trim();
      if (!name) continue;
      map.set(name, (map.get(name) || 0) + 1);
    }
    return [...map.entries()]
      .map(([nombre, n]) => ({ nombre, n }))
      .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
  }, [evolucion]);

  const vsRival = useMemo(() => {
    if (!rivalSel) return null;
    const matches = evolucion.filter((e) => e.rival === rivalSel);
    if (!matches.length) return null;
    let v = 0;
    let e = 0;
    let d = 0;
    let gf = 0;
    let gc = 0;
    for (const m of matches) {
      gf += m.gf;
      gc += m.gc;
      if (m.resultado === 'V') v += 1;
      else if (m.resultado === 'D') d += 1;
      else e += 1;
    }
    return {
      partidos: matches.length,
      v,
      e,
      d,
      gf,
      gc,
      diff: gf - gc,
      gfAvg: gf / matches.length,
      gcAvg: gc / matches.length,
      matches: [...matches].reverse(),
    };
  }, [evolucion, rivalSel]);

  const temporada =
    jugados[0]?.temporada_nombre ||
    partidos[0]?.temporada_nombre ||
    'Temporada actual';

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
    return {
      key,
      label: labels[key] || key,
      pct,
      value,
      ratio: `${vals.paradas}/${vals.lanzamientos}`,
    };
  });

  const exportar = () => {
    const team = equipo?.datos?.nombre || 'Equipo';
    const filtroLabel =
      filtro === 'ultimos5'
        ? 'Últimos 5 partidos'
        : filtro === 'ultimos10'
          ? 'Últimos 10 partidos'
          : temporada;

    if (seccion === 'porteros') {
      const porteroRows = porPortero
        .map(
          (p) =>
            `<tr><td>${escHtml(p.nombre)}</td><td>${p.paradas}</td><td>${p.recibidos}</td><td>${p.efi}%</td></tr>`,
        )
        .join('');
      const zonaRows = zoneEntries
        .map(
          (z) =>
            `<tr><td>${escHtml(z.label)}</td><td>${escHtml(z.ratio)}</td><td>${z.pct}%</td></tr>`,
        )
        .join('');
      const body = `
        <h1>Analítica de porteros</h1>
        <p class="muted">${escHtml(team)} · ${escHtml(filtroLabel)} · Generado ${escHtml(new Date().toLocaleString('es-ES'))}</p>
        <div class="kpis">
          <div class="kpi"><span>Paradas</span><strong>${metrics.paradas}</strong></div>
          <div class="kpi"><span>Tiros recibidos</span><strong>${metrics.recibidos}</strong></div>
          <div class="kpi"><span>Efectividad</span><strong>${fmt(metrics.efiPortero, 0)}%</strong></div>
        </div>
        <div class="kpis">
          <div class="kpi"><span>Partidos</span><strong>${metrics.partidos}</strong></div>
          <div class="kpi"><span>Porterías a cero</span><strong>${metrics.limpias}</strong></div>
          <div class="kpi"><span>Paradas / partido</span><strong>${escHtml(fmt(metrics.porPartidoParadas))}</strong></div>
        </div>
        <h2>Zonas</h2>
        <table><thead><tr><th>Zona</th><th>Paradas / tiros</th><th>Eficacia</th></tr></thead>
        <tbody>${zonaRows || '<tr><td colspan="3">Sin datos</td></tr>'}</tbody></table>
        <h2>Por portera</h2>
        <table><thead><tr><th>Nombre</th><th>Paradas</th><th>Recibidos</th><th>Efi.</th></tr></thead>
        <tbody>${porteroRows || '<tr><td colspan="4">Sin estadísticas</td></tr>'}</tbody></table>
        <p class="muted no-print" style="margin-top:1.5rem">SIETE · Usa «Guardar como PDF» en el diálogo de impresión</p>`;
      try {
        printHtml(`Analítica porteros · ${team}`, body);
      } catch (e) {
        setError(e.message || 'No se pudo exportar el PDF');
      }
      return;
    }

    const posRows = (dash?.efectividad_por_posicion || [])
      .map(
        (r) =>
          `<tr><td>${escHtml(r.posicion)}</td><td>${escHtml(r.efectividad)}%</td></tr>`,
      )
      .join('');
    const evoRows = evolucion
      .map((e) => {
        const p = jugados.find((x) => x.id_partido === e.id);
        const fecha = p?.fecha
          ? new Date(p.fecha).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—';
        return `<tr><td>${escHtml(fecha)}</td><td>${escHtml(e.label)}</td><td>${escHtml(e.rival || '—')}</td><td>${e.gf}</td><td>${e.gc}</td><td>${e.diff >= 0 ? '+' : ''}${e.diff}</td><td>${e.resultado}</td></tr>`;
      })
      .join('');

    const body = `
      <h1>Analítica de equipo</h1>
      <p class="muted">${escHtml(team)} · ${escHtml(filtroLabel)} · Generado ${escHtml(new Date().toLocaleString('es-ES'))}</p>
      <div class="kpis">
        <div class="kpi"><span>Partidos</span><strong>${metrics.partidos}</strong></div>
        <div class="kpi"><span>Goles promedio</span><strong>${escHtml(fmt(metrics.golesPromedio))}</strong></div>
        <div class="kpi"><span>GF / GC</span><strong>${metrics.golesFavor} / ${metrics.golesContra}</strong></div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Eficacia equipo</span><strong>${metrics.efiEquipo}%</strong></div>
        <div class="kpi"><span>Goles encajados</span><strong>${metrics.golesContra}</strong></div>
        <div class="kpi"><span>Diferencia</span><strong>${metrics.golesFavor - metrics.golesContra >= 0 ? '+' : ''}${metrics.golesFavor - metrics.golesContra}</strong></div>
      </div>
      <h2>Eficacia de tiro por posición</h2>
      <table><thead><tr><th>Posición</th><th>Efectividad</th></tr></thead>
      <tbody>${posRows || '<tr><td colspan="2">Sin datos por posición</td></tr>'}</tbody></table>
      <h2>Evolución de goles por partido</h2>
      <table><thead><tr><th>Fecha</th><th>Jor.</th><th>Rival</th><th>GF</th><th>GC</th><th>Diff</th><th>Res.</th></tr></thead>
      <tbody>${evoRows || '<tr><td colspan="7">Sin partidos finalizados</td></tr>'}</tbody></table>
      <p class="muted no-print" style="margin-top:1.5rem">SIETE · Usa «Guardar como PDF» en el diálogo de impresión</p>`;

    try {
      printHtml(`Analítica · ${team}`, body);
    } catch (e) {
      setError(e.message || 'No se pudo exportar el PDF');
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!dash) return <p className="muted">Cargando analítica…</p>;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">SCOUTING · {equipo?.datos?.nombre || 'EQUIPO'}</p>
          <h1>Analítica</h1>
        </div>
        <div className="add-player-actions">
          <button type="button" onClick={exportar}>
            Exportar PDF
          </button>
        </div>
      </header>

      <div className="analitica-toolbar">
        <div className="filters roster-filters" style={{ marginBottom: 0 }}>
          {SECCIONES.map((s) => (
            <button
              type="button"
              key={s.key}
              className={seccion === s.key ? 'active' : ''}
              onClick={() => setSeccion(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="filters roster-filters" style={{ marginBottom: 0 }}>
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
      </div>

      {seccion === 'equipo' && (
        <>
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
              <span>Goles encajados / partido</span>
              <strong className="c-orange">
                {fmt(metrics.partidos ? metrics.golesContra / metrics.partidos : 0)}
              </strong>
              <small>
                {metrics.golesContra} en contra · diff{' '}
                {metrics.golesFavor - metrics.golesContra >= 0 ? '+' : ''}
                {metrics.golesFavor - metrics.golesContra}
              </small>
            </div>
          </div>

          <section className="panel forma-panel">
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

          <section className="panel forma-panel">
            <div className="forma-panel-head">
              <h2>Evolución de goles por partido</h2>
              {!!evolucion.length && (
                <div className="analitica-bars-legend" aria-hidden="true">
                  <span>
                    <i className="analitica-dot gf" /> GF
                  </span>
                  <span>
                    <i className="analitica-dot gc" /> GC
                  </span>
                </div>
              )}
            </div>
            {evolucion.length ? (
              <div className="analitica-bars">
                {evolucion.map((e) => (
                  <div
                    className={`analitica-bar result-${e.resultado}`}
                    key={e.id}
                    title={`${e.rival}: ${e.gf}-${e.gc} (${e.diff >= 0 ? '+' : ''}${e.diff})`}
                  >
                    <span className="analitica-bar-val">
                      {e.gf}-{e.gc}
                    </span>
                    <div className="analitica-bar-track analitica-bar-pair">
                      <div
                        className="analitica-bar-fill gf"
                        style={{
                          height: `${Math.max(8, (e.gf / maxGoles) * 100)}%`,
                        }}
                      />
                      <div
                        className="analitica-bar-fill gc"
                        style={{
                          height: `${Math.max(8, (e.gc / maxGoles) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="analitica-bar-diff">
                      {e.diff > 0 ? `+${e.diff}` : e.diff}
                    </span>
                    <span className="analitica-bar-label">{e.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Sin partidos finalizados todavía</p>
            )}
          </section>

          <section className="panel forma-panel">
            <div className="forma-panel-head">
              <h2>Comparativa vs rival</h2>
              {!!rivalesOpts.length && (
                <label className="analitica-rival-pick">
                  <span className="sr-only">Rival</span>
                  <select
                    value={
                      rivalesOpts.some((r) => r.nombre === rivalSel) ? rivalSel : ''
                    }
                    onChange={(ev) => setRivalSel(ev.target.value)}
                  >
                    <option value="">Elegir rival…</option>
                    {rivalesOpts.map((r) => (
                      <option key={r.nombre} value={r.nombre}>
                        {r.nombre} ({r.n})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {!rivalesOpts.length && (
              <p className="muted">Sin rivales en el periodo seleccionado</p>
            )}
            {rivalesOpts.length > 0 && !rivalSel && (
              <p className="muted">Elige un rival para ver el historial de enfrentamientos</p>
            )}
            {vsRival && (
              <>
                <div className="metrics analitica-kpis analitica-h2h-kpis">
                  <div className="metric">
                    <span>Balance</span>
                    <strong className="c-lime">
                      {vsRival.v}-{vsRival.e}-{vsRival.d}
                    </strong>
                    <small>
                      {vsRival.partidos} partido{vsRival.partidos === 1 ? '' : 's'}
                    </small>
                  </div>
                  <div className="metric">
                    <span>GF / GC</span>
                    <strong className="c-cyan">
                      {vsRival.gf} / {vsRival.gc}
                    </strong>
                    <small>
                      Diff {vsRival.diff >= 0 ? '+' : ''}
                      {vsRival.diff} · media {fmt(vsRival.gfAvg)}–
                      {fmt(vsRival.gcAvg)}
                    </small>
                  </div>
                  <div className="metric">
                    <span>% victorias</span>
                    <strong className="c-orange">
                      {Math.round((vsRival.v / vsRival.partidos) * 100)}%
                    </strong>
                    <small>
                      {vsRival.v} victoria{vsRival.v === 1 ? '' : 's'}
                    </small>
                  </div>
                </div>
                <div className="analitica-h2h-list">
                  {vsRival.matches.map((m) => (
                    <div
                      key={m.id}
                      className={`analitica-h2h-row result-${m.resultado}`}
                    >
                      <span className="analitica-h2h-res">{m.resultado}</span>
                      <span className="analitica-h2h-score">
                        {m.gf}–{m.gc}
                      </span>
                      <span className="analitica-h2h-meta">
                        Jor. {m.label}
                        {m.diff !== 0 ? ` · ${m.diff > 0 ? '+' : ''}${m.diff}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {seccion === 'porteros' && (
        <>
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
              <strong className="c-lime">{metrics.efiPortero}%</strong>
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
            <h2>Por portera</h2>
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
                  <span className="roster-cell accent-orange" data-label="Paradas">
                    {p.paradas}
                  </span>
                  <span className="roster-cell" data-label="Recibidos">
                    {p.recibidos}
                  </span>
                  <span className="roster-cell valor" data-label="Efi.">
                    {p.efi}%
                  </span>
                </div>
              ))}
              {!porPortero.length && (
                <p className="muted">Sin estadísticas de porteros todavía</p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
