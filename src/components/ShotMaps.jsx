/** Zonas de origen (pista) y destino (portería / fuera) para lanzamientos. */

export const PISTA_ZONAS = [
  { key: 'ext_izq', label: 'Ext. izq.', short: 'EI' },
  { key: '9m_izq', label: '9 m izq.', short: '9I' },
  { key: '9m_cen', label: '9 m centro', short: '9C' },
  { key: '9m_der', label: '9 m der.', short: '9D' },
  { key: 'ext_der', label: 'Ext. der.', short: 'ED' },
  { key: '6m_izq', label: '6 m izq.', short: '6I' },
  { key: '6m_cen', label: '6 m / pivote', short: '6C' },
  { key: '6m_der', label: '6 m der.', short: '6D' },
  { key: '7m', label: '7 m', short: '7m' },
];

/** Casillas dentro de la portería (gol / parada / tiro a puerta). */
export const PORTERIA_ZONAS = [
  { key: 'AI', label: 'Alto izq.' },
  { key: 'AC', label: 'Alto centro' },
  { key: 'AD', label: 'Alto der.' },
  { key: 'MI', label: 'Medio izq.' },
  { key: 'MC', label: 'Medio centro' },
  { key: 'MD', label: 'Medio der.' },
  { key: 'BI', label: 'Bajo izq.' },
  { key: 'BC', label: 'Bajo centro' },
  { key: 'BD', label: 'Bajo der.' },
];

/** Fuera de portería → lanzamiento fallado (no hay "fuera bajo": el suelo es la línea de gol). */
export const FUERA_ZONAS = [
  { key: 'FA', label: 'Fuera alto', short: '↑' },
  { key: 'FI', label: 'Fuera izq.', short: '←' },
  { key: 'FD', label: 'Fuera der.', short: '→' },
];

const PISTA_LABEL = Object.fromEntries(PISTA_ZONAS.map((z) => [z.key, z.label]));
const PORTERIA_LABEL = Object.fromEntries(
  [...PORTERIA_ZONAS, ...FUERA_ZONAS].map((z) => [z.key, z.label]),
);

export function labelPista(key) {
  return PISTA_LABEL[key] || key || '';
}

export function labelPorteria(key) {
  return PORTERIA_LABEL[key] || key || '';
}

export function isFueraPorteria(key) {
  return FUERA_ZONAS.some((z) => z.key === key);
}

/** Half-court SVG: ataque hacia arriba (portería rival arriba). */
/** Arriba = portería. Coordenadas en viewBox 200×118. */
export const PISTA_CELLS = [
  { key: 'ext_izq', x: 5, y: 6, w: 26, h: 32 },
  { key: 'ext_der', x: 169, y: 6, w: 26, h: 32 },
  { key: '6m_izq', x: 38, y: 12, w: 32, h: 20 },
  { key: '6m_der', x: 130, y: 12, w: 32, h: 20 },
  { key: '6m_cen', x: 80, y: 34, w: 40, h: 17 },
  { key: '7m', x: 84, y: 54, w: 32, h: 11 },
  { key: '9m_izq', x: 8, y: 56, w: 40, h: 36 },
  { key: '9m_cen', x: 78, y: 70, w: 44, h: 40 },
  { key: '9m_der', x: 152, y: 56, w: 40, h: 36 },
];

export function HandballCourtMarks({ gradientId = 'court' }) {
  const floor = `${gradientId}Floor`;
  const area = `${gradientId}Area`;
  return (
    <>
      <defs>
        <linearGradient id={floor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="court-floor-stop-a" />
          <stop offset="100%" className="court-floor-stop-b" />
        </linearGradient>
        <linearGradient id={area} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="court-area-stop-a" />
          <stop offset="100%" className="court-area-stop-b" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="197" height="115" rx="8" className="shot-map-bg" fill={`url(#${floor})`} />
      <path
        d="M42 2 H158 Q158 46 100 46 Q42 46 42 2 Z"
        className="shot-map-area"
        fill={`url(#${area})`}
      />
      <path
        d="M28 2 Q28 66 100 66 Q172 66 172 2"
        className="shot-map-line soft arc"
        fill="none"
      />
      <rect x="86" y="1.5" width="28" height="5" rx="1" className="shot-map-goal" />
      <line x1="86" y1="1.5" x2="86" y2="8" className="shot-map-line" />
      <line x1="114" y1="1.5" x2="114" y2="8" className="shot-map-line" />
      <line x1="8" y1="68" x2="192" y2="68" className="shot-map-line soft" />
    </>
  );
}

function heatFill(count, max) {
  if (!count || !max) return '#163828';
  const t = count / max;
  const alpha = 0.22 + t * 0.78;
  return `rgba(191, 255, 0, ${alpha.toFixed(2)})`;
}

/** Pista de solo lectura: más verde cuanto más se ha lanzado desde esa zona. */
export function CourtHeatMap({ counts = {} }) {
  const values = Object.values(counts);
  const total = values.reduce((sum, n) => sum + n, 0);
  const max = values.reduce((m, n) => Math.max(m, n), 0);
  return (
    <div className="shot-map shot-map-heat">
      <div className="shot-map-head">
        <strong>Origen · pista</strong>
        <span>{total ? `${total} acción${total === 1 ? '' : 'es'}` : 'Sin actividad'}</span>
      </div>
      <svg
        className="shot-map-svg court-map"
        viewBox="0 0 200 118"
        role="img"
        aria-label="Mapa de actividad por zona"
      >
        <HandballCourtMarks gradientId="courtHeat" />
        {PISTA_CELLS.map((c) => {
          const n = counts[c.key] || 0;
          const hot = max > 0 && n === max;
          return (
            <g key={c.key}>
              <rect
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx="5"
                className={`shot-map-cell shot-heat-cell${hot && n ? ' is-hot' : ''}`}
                style={{ fill: heatFill(n, max) }}
              />
              <text
                x={c.x + c.w / 2}
                y={c.y + c.h / 2 + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`shot-map-label shot-heat-label${n / (max || 1) > 0.55 ? ' is-hot' : ''}`}
              >
                {n ? String(n) : PISTA_ZONAS.find((z) => z.key === c.key)?.short}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="shot-heat-legend">
        <span>Menos</span>
        <i aria-hidden="true" />
        <span>Más actividad</span>
      </p>
    </div>
  );
}

export function CourtShotMap({
  value,
  onChange,
  title = 'Origen · pista',
  emptyLabel = 'Toca una zona',
}) {
  return (
    <div className="shot-map shot-map-court">
      <div className="shot-map-head">
        <strong>{title}</strong>
        <span>{value ? labelPista(value) : emptyLabel}</span>
      </div>
      <svg
        className="shot-map-svg court-map"
        viewBox="0 0 200 118"
        role="img"
        aria-label="Zonas de la pista"
      >
        <HandballCourtMarks gradientId="courtShot" />

        {PISTA_CELLS.map((c) => {
          const selected = value === c.key;
          return (
            <g
              key={c.key}
              className={`shot-map-zone${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(c.key)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx="5"
                className={`shot-map-cell${selected ? ' selected' : ''}`}
              />
              <text
                x={c.x + c.w / 2}
                y={c.y + c.h / 2 + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`shot-map-label${selected ? ' selected' : ''}`}
                pointerEvents="none"
              >
                {PISTA_ZONAS.find((z) => z.key === c.key)?.short}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Portería 3×3; opcionalmente zonas fuera (alto / izq / der). */
export function GoalShotMap({
  value,
  onChange,
  hint = 'Dentro = gol · Fuera = fallado',
  showFuera = true,
  title = 'Destino · portería',
  emptyLabel = 'Puerta o fuera',
}) {
  const grid = [
    ['AI', 'AC', 'AD'],
    ['MI', 'MC', 'MD'],
    ['BI', 'BC', 'BD'],
  ];

  const pick = (key) => () => onChange(key);

  const frame = (
    <div className="goal-map-frame">
      {grid.map((row) =>
        row.map((key) => (
          <button
            type="button"
            key={key}
            className={`goal-map-cell${value === key ? ' selected' : ''}`}
            onClick={pick(key)}
            aria-pressed={value === key}
            title={labelPorteria(key)}
          >
            {key}
          </button>
        )),
      )}
    </div>
  );

  return (
    <div className={`shot-map${showFuera ? '' : ' shot-map-goal-only'}`}>
      <div className="shot-map-head">
        <strong>{title}</strong>
        <span>{value ? labelPorteria(value) : emptyLabel}</span>
      </div>
      {showFuera ? (
        <div className="goal-map goal-map-with-out" role="group" aria-label="Zonas de la portería">
          <button
            type="button"
            className={`goal-map-out top${value === 'FA' ? ' selected' : ''}`}
            onClick={pick('FA')}
            aria-pressed={value === 'FA'}
            title="Fuera alto (por encima del larguero)"
          >
            Fuera alto
          </button>
          <button
            type="button"
            className={`goal-map-out side left${value === 'FI' ? ' selected' : ''}`}
            onClick={pick('FI')}
            aria-pressed={value === 'FI'}
            title="Fuera izquierda"
          >
            FI
          </button>
          {frame}
          <button
            type="button"
            className={`goal-map-out side right${value === 'FD' ? ' selected' : ''}`}
            onClick={pick('FD')}
            aria-pressed={value === 'FD'}
            title="Fuera derecha"
          >
            FD
          </button>
        </div>
      ) : (
        <div className="goal-map goal-map-save" role="group" aria-label="Zona de la parada">
          {frame}
        </div>
      )}
      {hint ? <p className="goal-map-hint">{hint}</p> : null}
    </div>
  );
}
