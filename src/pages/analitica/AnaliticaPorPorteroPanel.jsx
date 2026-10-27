export default function AnaliticaPorPorteroPanel({ porPortero }) {
  return (
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
  );
}
