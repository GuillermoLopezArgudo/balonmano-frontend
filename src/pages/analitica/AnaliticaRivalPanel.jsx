import { fmt } from './utils';

export default function AnaliticaRivalPanel({ rivalesOpts, rivalSel, setRivalSel, vsRival }) {
  return (
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
  );
}
