import { useMemo, useState } from 'react';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const STORAGE_KEY = 'siete_informes_stats';

const AMBITOS = [
  { value: 'equipo', label: 'Equipo completo' },
  { value: 'plantilla', label: 'Plantilla' },
  { value: 'porteros', label: 'Porteros' },
];

const TIPOS = [
  { value: 'temporada', label: 'Resumen de temporada' },
  { value: 'analitica', label: 'Analítica de rendimiento' },
  { value: 'partidos', label: 'Listado de partidos' },
];

const FORMATOS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
];

const INCLUDES = {
  temporada: [
    'Resultados y balance de la temporada',
    'Goles a favor / en contra y eficacia',
    'Resumen de plantilla y partidos jugados',
  ],
  analitica: [
    'Eficacia de tiro y zonas de incidencia',
    'Rendimiento de portería',
    'Comparativa por periodo seleccionado',
  ],
  partidos: [
    'Calendario filtrado por fechas',
    'Marcadores y rival de cada encuentro',
    'Estado (jugado / próximo)',
  ],
};

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { generados: 0, compartidos: 0 };
    const parsed = JSON.parse(raw);
    return {
      generados: Number(parsed.generados) || 0,
      compartidos: Number(parsed.compartidos) || 0,
    };
  } catch {
    return { generados: 0, compartidos: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { desde: iso(start), hasta: iso(end) };
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Informes() {
  const { equipo } = useAuth();
  const defaults = defaultPeriod();
  const [desde, setDesde] = useState(defaults.desde);
  const [hasta, setHasta] = useState(defaults.hasta);
  const [ambito, setAmbito] = useState('equipo');
  const [tipo, setTipo] = useState('temporada');
  const [formato, setFormato] = useState('pdf');
  const [stats, setStats] = useState(loadStats);
  const [dash, setDash] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [gkStats, setGkStats] = useState([]);
  const [fieldStats, setFieldStats] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(true);

  useAbortable(async ({ signal, alive }) => {
    try {
      const [d, p, j, gk, fs] = await Promise.all([
        api.getDashboard({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return null;
        }),
        api.getPartidos({ signal }),
        api.getJugadores({ signal }),
        api.getEstadisticasPorteros({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
        api.getEstadisticas({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
      ]);
      if (!alive()) return;
      setDash(d);
      setPartidos(p);
      setJugadores(j);
      setGkStats(gk);
      setFieldStats(fs);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const myId = equipo?.id_equipo;
  const teamName = equipo?.datos?.nombre || 'Equipo';

  const partidosPeriodo = useMemo(() => {
    const a = new Date(desde);
    const b = new Date(hasta);
    b.setHours(23, 59, 59, 999);
    return partidos.filter((p) => {
      const f = new Date(p.fecha);
      return f >= a && f <= b;
    });
  }, [partidos, desde, hasta]);

  const bump = (key) => {
    setStats((prev) => {
      const next = { ...prev, [key]: prev[key] + 1 };
      saveStats(next);
      return next;
    });
  };

  const buildPayload = () => {
    const golesFavor = partidosPeriodo.reduce((acc, p) => {
      const gf =
        p.id_equipo_local === myId ? p.goles_local || 0 : p.goles_visitante || 0;
      return acc + gf;
    }, 0);
    const golesContra = partidosPeriodo.reduce((acc, p) => {
      const gc =
        p.id_equipo_local === myId ? p.goles_visitante || 0 : p.goles_local || 0;
      return acc + gc;
    }, 0);

    const partidoIds = new Set(partidosPeriodo.map((p) => p.id_partido));
    const gk = gkStats.filter((s) => partidoIds.has(s.id_partido));
    const paradas = gk.reduce((a, s) => a + (s.paradas || 0), 0);
    const recibidos = gk.reduce((a, s) => a + (s.lanzamientos_recibidos || 0), 0);

    const plantilla = jugadores.map((j) => ({
      dorsal: j.dorsal,
      nombre: `${j.nombre} ${j.apellido}`,
      posicion: j.posicion?.nombre || j.id_posicion || '—',
    }));

    return {
      equipo: teamName,
      periodo: `${fmtDate(desde)} — ${fmtDate(hasta)}`,
      ambito: AMBITOS.find((a) => a.value === ambito)?.label,
      tipo: TIPOS.find((t) => t.value === tipo)?.label,
      partidos: partidosPeriodo.length,
      golesFavor,
      golesContra,
      eficacia:
        golesFavor + golesContra
          ? Math.round((golesFavor / (golesFavor + golesContra)) * 100)
          : 0,
      paradas,
      recibidos,
      efiPortero: recibidos ? Math.round((paradas / recibidos) * 100) : 0,
      plantilla,
      encuentros: partidosPeriodo.map((p) => {
        const local = p.id_equipo_local === myId;
        const rival =
          p.equipo_visitante_nombre ||
          p.equipo_local_nombre ||
          (local ? 'Visitante' : 'Local');
        const gf = local ? p.goles_local : p.goles_visitante;
        const gc = local ? p.goles_visitante : p.goles_local;
        return {
          fecha: fmtDate(p.fecha),
          rival,
          marcador:
            gf != null && gc != null ? `${gf}-${gc}` : 'Pendiente',
        };
      }),
      dash,
      fieldCount: fieldStats.filter((s) => partidoIds.has(s.id_partido)).length,
    };
  };

  const downloadCsv = (payload) => {
    const lines = [
      `Informe SIETE,${payload.tipo}`,
      `Equipo,${payload.equipo}`,
      `Periodo,${payload.periodo}`,
      `Ámbito,${payload.ambito}`,
      '',
    ];
    if (tipo === 'partidos') {
      lines.push('Fecha,Rival,Marcador');
      payload.encuentros.forEach((e) => {
        lines.push(`${e.fecha},${e.rival},${e.marcador}`);
      });
    } else if (tipo === 'plantilla' || ambito === 'plantilla') {
      lines.push('Dorsal,Nombre,Posición');
      payload.plantilla.forEach((j) => {
        lines.push(`${j.dorsal ?? ''},${j.nombre},${j.posicion}`);
      });
    } else {
      lines.push(
        'Métrica,Valor',
        `Partidos,${payload.partidos}`,
        `Goles a favor,${payload.golesFavor}`,
        `Goles en contra,${payload.golesContra}`,
        `Eficacia,${payload.eficacia}%`,
        `Paradas,${payload.paradas}`,
        `Tiros recibidos,${payload.recibidos}`,
        `Eficacia portero,${payload.efiPortero}%`,
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-${tipo}-${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = (payload) => {
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) {
      window.print();
      return;
    }
    const rows =
      tipo === 'partidos'
        ? payload.encuentros
            .map(
              (e) =>
                `<tr><td>${e.fecha}</td><td>${e.rival}</td><td>${e.marcador}</td></tr>`,
            )
            .join('')
        : '';
    win.document.write(`<!DOCTYPE html><html><head><title>Informe SIETE</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:2rem;color:#111}
        h1{margin:0 0 .25rem} .muted{color:#666}
        table{width:100%;border-collapse:collapse;margin-top:1.25rem}
        th,td{border-bottom:1px solid #ddd;padding:.5rem;text-align:left}
        .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.25rem 0}
        .kpi{border:1px solid #e5e5e5;border-radius:8px;padding:1rem}
        .kpi strong{display:block;font-size:1.5rem}
      </style></head><body>
      <h1>${payload.tipo}</h1>
      <p class="muted">${payload.equipo} · ${payload.periodo} · ${payload.ambito}</p>
      <div class="kpis">
        <div class="kpi"><span>Partidos</span><strong>${payload.partidos}</strong></div>
        <div class="kpi"><span>GF / GC</span><strong>${payload.golesFavor} / ${payload.golesContra}</strong></div>
        <div class="kpi"><span>Eficacia portero</span><strong>${payload.efiPortero}%</strong></div>
      </div>
      ${
        rows
          ? `<table><thead><tr><th>Fecha</th><th>Rival</th><th>Marcador</th></tr></thead><tbody>${rows}</tbody></table>`
          : `<p>Plantilla: ${payload.plantilla.length} jugadores · Estadísticas de campo: ${payload.fieldCount}</p>
             <ul>${INCLUDES[tipo].map((i) => `<li>${i}</li>`).join('')}</ul>`
      }
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  const generar = async () => {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const payload = buildPayload();
      if (formato === 'csv') downloadCsv(payload);
      else printPdf(payload);
      bump('generados');
      setMsg(
        formato === 'csv'
          ? 'Informe CSV descargado'
          : 'Informe PDF listo para imprimir / guardar',
      );
    } catch (e) {
      setError(e.message || 'No se pudo generar el informe');
    } finally {
      setBusy(false);
    }
  };

  const compartir = () => {
    bump('compartidos');
    setMsg('Marcado como compartido (registro local)');
  };

  if (error && !partidos.length) return <p className="error">{error}</p>;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">CLUB · DOCUMENTACIÓN</p>
          <h1>Informes</h1>
        </div>
        <button type="button" onClick={() => setShowForm(true)}>
          + Crear informe
        </button>
      </header>

      {showForm && (
        <section className="panel informes-form">
          <div className="informes-form-head">
            <h2>Generar nuevo informe</h2>
            <p className="muted">
              Exporta el rendimiento de {teamName} en el periodo seleccionado.
            </p>
          </div>

          <div className="informes-fields">
            <div className="field">
              <label>Periodo</label>
              <div className="informes-dates">
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
                <span className="muted">—</span>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>Ámbito</label>
              <select value={ambito} onChange={(e) => setAmbito(e.target.value)}>
                {AMBITOS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Configuración</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Formato</label>
              <select value={formato} onChange={(e) => setFormato(e.target.value)}>
                {FORMATOS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ul className="informes-includes">
            {INCLUDES[tipo].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="informes-actions">
            <button type="button" disabled={busy} onClick={generar}>
              {busy ? 'Generando…' : 'Generar y exportar'}
            </button>
            <button type="button" className="ghost" onClick={compartir}>
              Marcar compartido
            </button>
          </div>
          {msg && <p className="ok-msg">{msg}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      )}

      <div className="metrics informes-kpis">
        <div className="metric">
          <strong className="c-lime">{stats.generados}</strong>
          <span>Informes generados</span>
        </div>
        <div className="metric">
          <strong className="c-cyan">{stats.compartidos}</strong>
          <span>Informes compartidos</span>
        </div>
      </div>
    </>
  );
}
