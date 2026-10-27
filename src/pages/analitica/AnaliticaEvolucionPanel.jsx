export default function AnaliticaEvolucionPanel({ evolucion, maxGoles }) {
  return (
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
  );
}
