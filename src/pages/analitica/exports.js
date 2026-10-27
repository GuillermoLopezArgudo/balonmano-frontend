import { escHtml, fmt } from './utils';

export function periodoExportLabel({ temporada, filtro, temporadaEstadoLabel }) {
  const base = temporada;
  if (filtro === 'ultimos5') return `${base} · últimos 5`;
  if (filtro === 'ultimos10') return `${base} · últimos 10`;
  return temporadaEstadoLabel ? `${base} (${temporadaEstadoLabel})` : base;
}

export function buildCsv({
  team,
  filtroLabel,
  seccion,
  metrics,
  porPortero,
  rankingJugadoras,
}) {
  const lines = [
    ['Equipo', team],
    ['Sección', seccion === 'porteros' ? 'Porteros' : 'Equipo'],
    ['Periodo', filtroLabel],
    ['Generado', new Date().toLocaleString('es-ES')],
    [],
  ];
  if (seccion === 'porteros') {
    lines.push(['KPI', 'Valor']);
    lines.push(['Paradas', metrics.paradas]);
    lines.push(['Tiros recibidos', metrics.recibidos]);
    lines.push(['Efectividad %', metrics.efiPortero]);
    lines.push([]);
    lines.push(['Portera', 'Paradas', 'Recibidos', 'Efi %']);
    for (const p of porPortero) {
      lines.push([p.nombre, p.paradas, p.recibidos, p.efi]);
    }
  } else {
    lines.push(['KPI', 'Valor']);
    lines.push(['Partidos', metrics.partidos]);
    lines.push(['Goles a favor', metrics.golesFavor]);
    lines.push(['Goles en contra', metrics.golesContra]);
    lines.push(['Eficacia tiro %', metrics.efiTiro]);
    lines.push(['Recuperaciones', metrics.recuperaciones]);
    lines.push(['Pérdidas', metrics.perdidas]);
    lines.push([]);
    lines.push(['Jugadora', 'Goles', 'Lanzamientos', 'Recuperaciones', 'Pérdidas', 'Efi %']);
    for (const j of rankingJugadoras) {
      lines.push([
        `#${j.dorsal ?? '—'} ${j.nombre}`,
        j.goles,
        j.lanzamientos,
        j.recuperaciones,
        j.perdidas,
        j.efi,
      ]);
    }
  }
  const csv = lines
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';'),
    )
    .join('\n');
  return csv;
}

export function downloadCsv(csv, seccion) {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analitica-${seccion}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Devuelve { title, body } del informe imprimible (PDF via dialogo de impresion). */
export function buildPdfReport({
  seccion,
  team,
  filtroLabel,
  metrics,
  porPortero,
  zoneEntries,
  efiPorPosicion,
  evolucion,
  jugados,
}) {
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
    return { title: `Analítica porteros · ${team}`, body };
  }

  const posRows = efiPorPosicion
    .map(
      (r) =>
        `<tr><td>${escHtml(r.posicion)}</td><td>${r.goles}/${r.lanzamientos}</td><td>${escHtml(r.efectividad)}%</td></tr>`,
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
    <table><thead><tr><th>Posición</th><th>Goles / lanz.</th><th>Efectividad</th></tr></thead>
    <tbody>${posRows || '<tr><td colspan="3">Sin datos por posición</td></tr>'}</tbody></table>
    <h2>Evolución de goles por partido</h2>
    <table><thead><tr><th>Fecha</th><th>Jor.</th><th>Rival</th><th>GF</th><th>GC</th><th>Diff</th><th>Res.</th></tr></thead>
    <tbody>${evoRows || '<tr><td colspan="7">Sin partidos finalizados</td></tr>'}</tbody></table>
    <p class="muted no-print" style="margin-top:1.5rem">SIETE · Usa «Guardar como PDF» en el diálogo de impresión</p>`;

  return { title: `Analítica · ${team}`, body };
}
