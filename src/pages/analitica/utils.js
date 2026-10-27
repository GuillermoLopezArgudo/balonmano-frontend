export const SECCIONES = [
  { key: 'equipo', label: 'Equipo' },
  { key: 'porteros', label: 'Porteros' },
];

export const FILTROS = [
  { key: 'temporada', label: 'Temporada' },
  { key: 'ultimos5', label: 'Últimos 5' },
  { key: 'ultimos10', label: 'Últimos 10' },
];

export const ZONE_TABS = [
  { id: 'paradas', label: 'Paradas' },
  { id: 'tiros', label: 'Tiros' },
  { id: 'efectividad', label: 'Eficacia' },
];

export function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function zoneTone(pct) {
  if (pct >= 40) return 'good';
  if (pct >= 30) return 'mid';
  return 'bad';
}

export function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printHtml(title, bodyHtml) {
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
