import { ZONE_TABS, zoneTone } from './utils';

export default function AnaliticaZonasPanel({ zoneTab, setZoneTab, zoneEntries }) {
  return (
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
  );
}
