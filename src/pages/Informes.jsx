import { useMemo, useState } from 'react';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const AMBITOS = [
  { value: 'equipo', label: 'Equipo completo' },
  { value: 'plantilla', label: 'Plantilla' },
  { value: 'porteros', label: 'Porteros' },
  { value: 'jugadora', label: 'Una jugadora' },
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
    'Goles a favor / en contra',
    'Resumen de plantilla y partidos jugados',
  ],
  analitica: [
    'Eficacia de tiro (lanzamientos / goles)',
    'Rendimiento de portería',
    'Comparativa del periodo seleccionado',
  ],
  partidos: [
    'Calendario filtrado por fechas (o un partido concreto)',
    'Marcadores y rival de cada encuentro',
    'Estado (jugado / próximo / aplazado)',
  ],
};

const INCLUDES_PARTIDO = [
  'Ficha del partido seleccionado',
  'Rival, condición y marcador',
  'Estado del encuentro',
];

const INCLUDES_JUGADORA = [
  'Goles, lanzamientos y eficacia de tiro',
  'Asistencias, pérdidas y sanciones',
  'Paradas / eficacia si es portera',
];

function defaultPeriod() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  // Temporada deportiva típica: sep → jun
  const startY = m < 8 ? y - 1 : y;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    desde: `${startY}-09-01`,
    hasta: `${startY + 1}-06-30`,
  };
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = iso.includes('T') ? new Date(iso) : new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function dateKey(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function isFinished(p) {
  return p.estado === 'jugado' || p.estado === 'no_disputado';
}

function isPortero(j) {
  return (j.posiciones || []).some((p) => String(p).toLowerCase().includes('portero'));
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function Informes() {
  const { equipo } = useAuth();
  const defaults = defaultPeriod();
  const [desde, setDesde] = useState(defaults.desde);
  const [hasta, setHasta] = useState(defaults.hasta);
  const [ambito, setAmbito] = useState('equipo');
  const [idJugadora, setIdJugadora] = useState('');
  const [tipo, setTipo] = useState('temporada');
  const [idPartido, setIdPartido] = useState(''); // '' = todos (solo tipo partidos)
  const [formato, setFormato] = useState('pdf');
  const [dash, setDash] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [gkStats, setGkStats] = useState([]);
  const [fieldStats, setFieldStats] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

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
    return partidos.filter((p) => {
      const f = dateKey(p.fecha);
      if (!f) return false;
      return f >= desde && f <= hasta;
    });
  }, [partidos, desde, hasta]);

  const partidosPeriodoOrdenados = useMemo(
    () =>
      [...partidosPeriodo].sort((a, b) => dateKey(a.fecha).localeCompare(dateKey(b.fecha))),
    [partidosPeriodo],
  );

  const partidosInforme = useMemo(() => {
    if (tipo === 'partidos' && idPartido) {
      return partidosPeriodo.filter((p) => p.id_partido === idPartido);
    }
    return partidosPeriodo;
  }, [tipo, idPartido, partidosPeriodo]);

  const partidosJugados = useMemo(
    () => partidosInforme.filter((p) => isFinished(p)),
    [partidosInforme],
  );

  const partidosJugadosPeriodo = useMemo(
    () => partidosPeriodo.filter((p) => isFinished(p)),
    [partidosPeriodo],
  );

  const plantillaFiltrada = useMemo(() => {
    if (ambito === 'porteros') return jugadores.filter(isPortero);
    if (ambito === 'jugadora') {
      return jugadores.filter((j) => j.id_jugador === idJugadora);
    }
    return jugadores;
  }, [jugadores, ambito, idJugadora]);

  const jugadorasOrdenadas = useMemo(
    () =>
      [...jugadores].sort((a, b) => {
        const da = a.dorsal ?? 999;
        const db = b.dorsal ?? 999;
        if (da !== db) return da - db;
        return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es');
      }),
    [jugadores],
  );

  const soyLocal = (p) => {
    if (typeof p.es_local === 'boolean') return p.es_local;
    return p.id_equipo_local === myId;
  };

  const rivalDe = (p) => {
    const local = soyLocal(p);
    if (local) return p.equipo_visitante_nombre || p.rival_nombre || 'Visitante';
    return p.equipo_local_nombre || p.rival_nombre || 'Local';
  };

  const buildPayload = () => {
    if (desde > hasta) {
      throw new Error('La fecha «desde» no puede ser posterior a «hasta»');
    }
    if (ambito === 'jugadora' && !idJugadora) {
      throw new Error('Selecciona una jugadora para el informe');
    }
    if (tipo === 'partidos' && idPartido && !partidosInforme.length) {
      throw new Error('El partido seleccionado no está en el periodo');
    }

    const jugadora =
      ambito === 'jugadora'
        ? jugadores.find((j) => j.id_jugador === idJugadora) || null
        : null;

    const partidoUnico =
      tipo === 'partidos' && idPartido && partidosInforme[0] ? partidosInforme[0] : null;

    let golesFavor = 0;
    let golesContra = 0;
    let victorias = 0;
    let empates = 0;
    let derrotas = 0;

    for (const p of partidosJugados) {
      const local = soyLocal(p);
      const gf = local ? p.goles_local ?? 0 : p.goles_visitante ?? 0;
      const gc = local ? p.goles_visitante ?? 0 : p.goles_local ?? 0;
      golesFavor += gf;
      golesContra += gc;
      if (p.estado === 'no_disputado') continue;
      if (gf > gc) victorias += 1;
      else if (gf < gc) derrotas += 1;
      else empates += 1;
    }

    const partidoIds = new Set(partidosInforme.map((p) => p.id_partido));
    let gk = gkStats.filter((s) => partidoIds.has(s.id_partido));
    let field = fieldStats.filter((s) => partidoIds.has(s.id_partido));

    if (jugadora) {
      gk = gk.filter((s) => s.id_jugador === jugadora.id_jugador);
      field = field.filter((s) => s.id_jugador === jugadora.id_jugador);
    }

    const paradas = gk.reduce((a, s) => a + (s.paradas || 0), 0);
    const recibidos = gk.reduce(
      (a, s) => a + (s.lanzamientos_recibidos || s.goles_recibidos || 0),
      0,
    );
    const golesCampo = field.reduce((a, s) => a + (s.goles || 0), 0);
    const lanzamientos = field.reduce((a, s) => a + (s.lanzamientos || 0), 0);
    const asistencias = field.reduce((a, s) => a + (s.asistencias || 0), 0);
    const perdidas = field.reduce((a, s) => a + (s.perdidas || 0), 0);
    const amarillas = field.reduce((a, s) => a + (s.amarillas || 0), 0);
    const exclusiones = field.reduce((a, s) => a + (s.exclusiones_2min || 0), 0);
    const rojas = field.reduce((a, s) => a + (s.rojas || 0), 0);
    const partidosJugadora = new Set(field.map((s) => s.id_partido).concat(gk.map((s) => s.id_partido))).size;

    const plantilla = plantillaFiltrada.map((j) => ({
      dorsal: j.dorsal,
      nombre: `${j.nombre} ${j.apellido}`.trim(),
      posicion: (j.posiciones && j.posiciones[0]) || 'Sin posición',
    }));

    const encuentros = partidosInforme
      .slice()
      .sort((a, b) => dateKey(a.fecha).localeCompare(dateKey(b.fecha)))
      .map((p) => {
        const local = soyLocal(p);
        const gf = local ? p.goles_local : p.goles_visitante;
        const gc = local ? p.goles_visitante : p.goles_local;
        const finished = isFinished(p);
        return {
          fecha: fmtDate(p.fecha),
          rival: rivalDe(p),
          condicion: local ? 'Local' : 'Visitante',
          jornada: p.jornada ?? '',
          estado: p.estado || 'programado',
          marcador:
            finished && gf != null && gc != null ? `${gf}-${gc}` : 'Pendiente',
        };
      });

    const ambitoLabel = jugadora
      ? `Jugadora · #${jugadora.dorsal ?? '—'} ${jugadora.nombre} ${jugadora.apellido}`
      : AMBITOS.find((a) => a.value === ambito)?.label;

    const tipoLabel = partidoUnico
      ? `Partido · ${fmtDate(partidoUnico.fecha)} vs ${rivalDe(partidoUnico)}`
      : TIPOS.find((t) => t.value === tipo)?.label;

    const periodoLabel = partidoUnico
      ? fmtDate(partidoUnico.fecha)
      : `${fmtDate(desde)} — ${fmtDate(hasta)}`;

    return {
      equipo: teamName,
      periodo: periodoLabel,
      ambito: ambitoLabel,
      tipo: tipoLabel,
      esJugadora: Boolean(jugadora),
      esPartidoUnico: Boolean(partidoUnico),
      jugadora: jugadora
        ? {
            id: jugadora.id_jugador,
            dorsal: jugadora.dorsal,
            nombre: `${jugadora.nombre} ${jugadora.apellido}`.trim(),
            posicion: (jugadora.posiciones && jugadora.posiciones[0]) || 'Sin posición',
          }
        : null,
      partidos: partidosInforme.length,
      partidosJugados: partidosJugados.length,
      partidosJugadora,
      golesFavor,
      golesContra,
      victorias,
      empates,
      derrotas,
      eficaciaTiro: lanzamientos ? Math.round((golesCampo / lanzamientos) * 100) : 0,
      golesCampo,
      lanzamientos,
      asistencias,
      perdidas,
      amarillas,
      exclusiones,
      rojas,
      paradas,
      recibidos,
      efiPortero: recibidos || paradas
        ? Math.round((paradas / Math.max(1, paradas + recibidos)) * 100)
        : 0,
      plantilla,
      encuentros,
      dash,
      fieldCount: field.length,
    };
  };

  const downloadCsv = (payload) => {
    const lines = [
      ['Informe SIETE', payload.tipo],
      ['Equipo', payload.equipo],
      ['Periodo', payload.periodo],
      ['Ámbito', payload.ambito],
      [],
    ];

    if (payload.esJugadora && payload.jugadora) {
      lines.push(['Campo', 'Valor']);
      lines.push(['Jugadora', payload.jugadora.nombre]);
      lines.push(['Dorsal', payload.jugadora.dorsal ?? '']);
      lines.push(['Posición', payload.jugadora.posicion]);
      lines.push(['Partidos con stats', payload.partidosJugadora]);
      lines.push(['Goles', payload.golesCampo]);
      lines.push(['Lanzamientos', payload.lanzamientos]);
      lines.push(['Eficacia tiro', `${payload.eficaciaTiro}%`]);
      lines.push(['Asistencias', payload.asistencias]);
      lines.push(['Pérdidas', payload.perdidas]);
      lines.push(['Amarillas', payload.amarillas]);
      lines.push(["Exclusiones 2'", payload.exclusiones]);
      lines.push(['Rojas', payload.rojas]);
      lines.push(['Paradas', payload.paradas]);
      lines.push(['Eficacia portero', `${payload.efiPortero}%`]);
    } else if (tipo === 'partidos') {
      lines.push(['Fecha', 'Jornada', 'Rival', 'Condición', 'Estado', 'Marcador']);
      payload.encuentros.forEach((e) => {
        lines.push([e.fecha, e.jornada, e.rival, e.condicion, e.estado, e.marcador]);
      });
    } else if (ambito === 'plantilla' || ambito === 'porteros') {
      lines.push(['Dorsal', 'Nombre', 'Posición']);
      payload.plantilla.forEach((j) => {
        lines.push([j.dorsal ?? '', j.nombre, j.posicion]);
      });
      lines.push([]);
      lines.push(
        ['Métrica', 'Valor'],
        ['Partidos en periodo', payload.partidos],
        ['Partidos jugados', payload.partidosJugados],
        ['Paradas', payload.paradas],
        ['Eficacia portero', `${payload.efiPortero}%`],
      );
    } else {
      lines.push(
        ['Métrica', 'Valor'],
        ['Partidos en periodo', payload.partidos],
        ['Partidos jugados', payload.partidosJugados],
        ['Victorias', payload.victorias],
        ['Empates', payload.empates],
        ['Derrotas', payload.derrotas],
        ['Goles a favor', payload.golesFavor],
        ['Goles en contra', payload.golesContra],
        ['Goles (stats campo)', payload.golesCampo],
        ['Lanzamientos', payload.lanzamientos],
        ['Eficacia tiro', `${payload.eficaciaTiro}%`],
        ['Paradas', payload.paradas],
        ['Tiros recibidos', payload.recibidos],
        ['Eficacia portero', `${payload.efiPortero}%`],
      );
      if (tipo === 'temporada') {
        lines.push([]);
        lines.push(['Fecha', 'Jornada', 'Rival', 'Condición', 'Estado', 'Marcador']);
        payload.encuentros.forEach((e) => {
          lines.push([e.fecha, e.jornada, e.rival, e.condicion, e.estado, e.marcador]);
        });
      }
    }

    const body = lines.map((row) => (row.length ? row.map(csvCell).join(',') : '')).join('\n');
    const blob = new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-${tipo}-${ambito}${payload.esJugadora && payload.jugadora ? `-${payload.jugadora.nombre.replace(/\s+/g, '-')}` : ''}-${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = (payload) => {
    const encuentrosRows = payload.encuentros
      .map(
        (e) =>
          `<tr><td>${escHtml(e.fecha)}</td><td>${escHtml(e.jornada)}</td><td>${escHtml(e.rival)}</td><td>${escHtml(e.condicion)}</td><td>${escHtml(e.estado)}</td><td>${escHtml(e.marcador)}</td></tr>`,
      )
      .join('');

    const plantillaRows = payload.plantilla
      .map(
        (j) =>
          `<tr><td>${escHtml(j.dorsal ?? '—')}</td><td>${escHtml(j.nombre)}</td><td>${escHtml(j.posicion)}</td></tr>`,
      )
      .join('');

    const showPartidos = !payload.esJugadora && (tipo === 'partidos' || tipo === 'temporada');
    const showPlantilla =
      !payload.esJugadora &&
      (ambito === 'plantilla' || ambito === 'porteros' || tipo === 'temporada');
    const showAnalitica = !payload.esJugadora && (tipo === 'analitica' || tipo === 'temporada');
    const showJugadora = Boolean(payload.esJugadora && payload.jugadora);

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Informe SIETE</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:2rem;color:#111;max-width:900px;margin:0 auto}
        h1{margin:0 0 .25rem;font-size:1.6rem}
        h2{margin:1.5rem 0 .65rem;font-size:1.1rem}
        .muted{color:#666;margin:0 0 1rem}
        table{width:100%;border-collapse:collapse;margin-top:.5rem;font-size:.9rem}
        th,td{border-bottom:1px solid #ddd;padding:.45rem .35rem;text-align:left}
        th{color:#555;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
        .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.85rem;margin:1.1rem 0}
        .kpi{border:1px solid #e5e5e5;border-radius:8px;padding:.85rem}
        .kpi span{display:block;color:#666;font-size:.75rem}
        .kpi strong{display:block;font-size:1.35rem;margin-top:.25rem}
        @media print{.no-print{display:none}}
      </style></head><body>
      <h1>${escHtml(payload.tipo)}</h1>
      <p class="muted">${escHtml(payload.equipo)} · ${escHtml(payload.periodo)} · ${escHtml(payload.ambito)}</p>
      ${
        showJugadora
          ? `<div class="kpis">
              <div class="kpi"><span>Partidos</span><strong>${payload.partidosJugadora}</strong></div>
              <div class="kpi"><span>Goles / lanz.</span><strong>${payload.golesCampo} / ${payload.lanzamientos}</strong></div>
              <div class="kpi"><span>Eficacia</span><strong>${payload.eficaciaTiro}%</strong></div>
            </div>
            <div class="kpis">
              <div class="kpi"><span>Asistencias</span><strong>${payload.asistencias}</strong></div>
              <div class="kpi"><span>Pérdidas</span><strong>${payload.perdidas}</strong></div>
              <div class="kpi"><span>Sanciones</span><strong>${payload.amarillas}A · ${payload.exclusiones}·2' · ${payload.rojas}R</strong></div>
            </div>
            ${
              payload.paradas || payload.recibidos
                ? `<div class="kpis">
                    <div class="kpi"><span>Paradas</span><strong>${payload.paradas}</strong></div>
                    <div class="kpi"><span>Recibidos</span><strong>${payload.recibidos}</strong></div>
                    <div class="kpi"><span>Efi. portero</span><strong>${payload.efiPortero}%</strong></div>
                  </div>`
                : ''
            }
            <h2>Ficha</h2>
            <table><tbody>
              <tr><th>Nombre</th><td>${escHtml(payload.jugadora.nombre)}</td></tr>
              <tr><th>Dorsal</th><td>${escHtml(payload.jugadora.dorsal ?? '—')}</td></tr>
              <tr><th>Posición</th><td>${escHtml(payload.jugadora.posicion)}</td></tr>
            </tbody></table>`
          : `<div class="kpis">
        <div class="kpi"><span>Partidos / jugados</span><strong>${payload.partidos} / ${payload.partidosJugados}</strong></div>
        <div class="kpi"><span>GF / GC</span><strong>${payload.golesFavor} / ${payload.golesContra}</strong></div>
        <div class="kpi"><span>V-E-D</span><strong>${payload.victorias}-${payload.empates}-${payload.derrotas}</strong></div>
      </div>
      ${
        showAnalitica
          ? `<div class="kpis">
              <div class="kpi"><span>Eficacia tiro</span><strong>${payload.eficaciaTiro}%</strong></div>
              <div class="kpi"><span>Paradas</span><strong>${payload.paradas}</strong></div>
              <div class="kpi"><span>Efi. portero</span><strong>${payload.efiPortero}%</strong></div>
            </div>`
          : ''
      }`
      }
      ${
        showPartidos
          ? `<h2>Partidos del periodo</h2>
             <table><thead><tr><th>Fecha</th><th>Jor.</th><th>Rival</th><th>Cond.</th><th>Estado</th><th>Marcador</th></tr></thead>
             <tbody>${encuentrosRows || '<tr><td colspan="6">Sin partidos en el periodo</td></tr>'}</tbody></table>`
          : ''
      }
      ${
        showPlantilla
          ? `<h2>${ambito === 'porteros' ? 'Porteros' : 'Plantilla'}</h2>
             <table><thead><tr><th>Dorsal</th><th>Nombre</th><th>Posición</th></tr></thead>
             <tbody>${plantillaRows || '<tr><td colspan="3">Sin jugadoras</td></tr>'}</tbody></table>`
          : ''
      }
      <p class="muted no-print" style="margin-top:1.5rem">SIETE · Generado ${escHtml(new Date().toLocaleString('es-ES'))}</p>
      </body></html>`;

    // iframe oculto: no dispara el bloqueo de pop-ups
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
    doc.write(html);
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
  };

  const generar = async () => {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const payload = buildPayload();
      if (formato === 'csv') downloadCsv(payload);
      else printPdf(payload);
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

  const buildShareText = (payload) => {
    const header = ['SIETE · Resumen', `${payload.equipo}`, `${payload.periodo}`, ''];

    if (payload.esJugadora && payload.jugadora) {
      const j = payload.jugadora;
      const lines = [
        ...header,
        `Jugadora: ${j.nombre}`,
        `Dorsal #${j.dorsal ?? '—'} · ${j.posicion}`,
        '',
        `Partidos con estadísticas: ${payload.partidosJugadora}`,
        `Goles: ${payload.golesCampo}  ·  Lanzamientos: ${payload.lanzamientos}`,
        `Eficacia de tiro: ${payload.eficaciaTiro}%`,
        `Asistencias: ${payload.asistencias}  ·  Pérdidas: ${payload.perdidas}`,
        `Sanciones: ${payload.amarillas} amarilla(s) · ${payload.exclusiones} exclusión(es) · ${payload.rojas} roja(s)`,
      ];
      if (payload.paradas || payload.recibidos) {
        lines.push(
          '',
          `Portería: ${payload.paradas} parada(s) · ${payload.recibidos} recibidos`,
          `Eficacia portera: ${payload.efiPortero}%`,
        );
      }
      return lines.join('\n');
    }

    if (payload.esPartidoUnico && payload.encuentros[0]) {
      const e = payload.encuentros[0];
      return [
        ...header,
        `Partido ${e.condicion.toLowerCase()}`,
        `Rival: ${e.rival}`,
        e.jornada !== '' && e.jornada != null ? `Jornada: ${e.jornada}` : null,
        `Resultado: ${e.marcador}`,
        `Estado: ${e.estado}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (tipo === 'partidos') {
      const rows = payload.encuentros.map(
        (e) =>
          `· ${e.fecha}${e.jornada !== '' && e.jornada != null ? ` (J${e.jornada})` : ''} — ${e.condicion} vs ${e.rival}: ${e.marcador}`,
      );
      return [
        ...header,
        `Listado de partidos (${payload.encuentros.length})`,
        '',
        ...(rows.length ? rows : ['Sin partidos en el periodo']),
      ].join('\n');
    }

    const lines = [
      ...header,
      `Informe: ${payload.tipo}`,
      `Ámbito: ${payload.ambito}`,
      '',
      `Partidos: ${payload.partidosJugados} jugados de ${payload.partidos} en el periodo`,
      `Balance: ${payload.victorias}V · ${payload.empates}E · ${payload.derrotas}D`,
      `Goles: ${payload.golesFavor} a favor · ${payload.golesContra} en contra`,
    ];

    if (tipo === 'analitica' || tipo === 'temporada') {
      lines.push(
        '',
        `Eficacia de tiro: ${payload.eficaciaTiro}% (${payload.golesCampo}/${payload.lanzamientos})`,
        `Portería: ${payload.paradas} paradas · eficacia ${payload.efiPortero}%`,
      );
    }

    return lines.join('\n');
  };

  const compartir = async () => {
    setError('');
    setMsg('');
    try {
      const payload = buildPayload();
      const text = buildShareText(payload);
      const title =
        payload.esJugadora && payload.jugadora
          ? `SIETE · ${payload.jugadora.nombre}`
          : payload.esPartidoUnico
            ? `SIETE · ${payload.equipo} vs ${payload.encuentros[0]?.rival || 'rival'}`
            : `SIETE · ${payload.equipo}`;

      if (navigator.share) {
        await navigator.share({ title, text });
        setMsg('Resumen compartido');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setMsg('Resumen copiado. Ya puedes pegarlo en WhatsApp, email o chat.');
      } else {
        setMsg('No se pudo compartir el texto. Usa «Generar y exportar» para el PDF.');
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setError(e.message || 'No se pudo compartir');
    }
  };

  if (error && !partidos.length) {
    return <p className="error">{error}</p>;
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">CLUB · DOCUMENTACIÓN</p>
          <h1>Informes</h1>
          <p className="muted" style={{ marginTop: '0.35rem' }}>
            {partidosPeriodo.length} partido{partidosPeriodo.length === 1 ? '' : 's'} en el periodo
            seleccionado · {partidosJugadosPeriodo.length} jugado
            {partidosJugadosPeriodo.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

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
                  onChange={(e) => {
                    setDesde(e.target.value);
                    setIdPartido('');
                  }}
                />
                <span className="muted">—</span>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => {
                    setHasta(e.target.value);
                    setIdPartido('');
                  }}
                />
              </div>
            </div>
            <div className="field">
              <label>Ámbito</label>
              <select
                value={ambito}
                onChange={(e) => {
                  const next = e.target.value;
                  setAmbito(next);
                  if (next !== 'jugadora') setIdJugadora('');
                  else {
                    setTipo('analitica');
                    setIdPartido('');
                  }
                }}
              >
                {AMBITOS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            {ambito === 'jugadora' && (
              <div className="field">
                <label>Jugadora</label>
                <select
                  value={idJugadora}
                  onChange={(e) => setIdJugadora(e.target.value)}
                >
                  <option value="">Selecciona jugadora…</option>
                  {jugadorasOrdenadas.map((j) => (
                    <option key={j.id_jugador} value={j.id_jugador}>
                      {j.dorsal != null ? `#${j.dorsal} · ` : ''}
                      {j.nombre} {j.apellido}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>Tipo de informe</label>
              <select
                value={tipo}
                onChange={(e) => {
                  const next = e.target.value;
                  setTipo(next);
                  if (next !== 'partidos') setIdPartido('');
                }}
                disabled={ambito === 'jugadora'}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {tipo === 'partidos' && ambito !== 'jugadora' && (
              <div className="field informes-field-wide">
                <label>Partidos</label>
                <select
                  value={idPartido}
                  onChange={(e) => setIdPartido(e.target.value)}
                >
                  <option value="">
                    Todos los del periodo ({partidosPeriodoOrdenados.length})
                  </option>
                  {partidosPeriodoOrdenados.map((p) => {
                    const local = soyLocal(p);
                    const gf = local ? p.goles_local : p.goles_visitante;
                    const gc = local ? p.goles_visitante : p.goles_local;
                    const finished = isFinished(p);
                    const score =
                      finished && gf != null && gc != null ? ` · ${gf}-${gc}` : '';
                    return (
                      <option key={p.id_partido} value={p.id_partido}>
                        {fmtDate(p.fecha)}
                        {p.jornada != null ? ` · J${p.jornada}` : ''}
                        {' · '}
                        {local ? 'vs' : '@'} {rivalDe(p)}
                        {score}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
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
            {(ambito === 'jugadora'
              ? INCLUDES_JUGADORA
              : tipo === 'partidos' && idPartido
                ? INCLUDES_PARTIDO
                : INCLUDES[tipo]
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="informes-actions">
            <button type="button" disabled={busy} onClick={generar}>
              {busy ? 'Generando…' : 'Generar y exportar'}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy}
              onClick={compartir}
              title="Comparte un resumen en texto listo para WhatsApp, email o chat."
            >
              Compartir resumen
            </button>
          </div>
          {msg && <p className="ok-msg">{msg}</p>}
          {error && <p className="error">{error}</p>}
        </section>
    </>
  );
}
