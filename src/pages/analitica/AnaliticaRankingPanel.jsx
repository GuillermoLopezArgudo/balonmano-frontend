export default function AnaliticaRankingPanel({ rankingJugadoras }) {
  return (
    <section className="panel forma-panel">
      <h2>Ranking de jugadoras</h2>
      <div className="roster-list">
        {Boolean(rankingJugadoras.length) && (
          <div className="roster-row ranking-head" aria-hidden="true">
            <div className="roster-player">
              <span>
                <strong>Jugadora</strong>
              </span>
            </div>
            <span className="roster-cell">Goles</span>
            <span className="roster-cell" title="Goles / lanzamientos">
              Gol/Lanz
            </span>
            <span className="roster-cell" title="Recuperaciones">
              Rec.
            </span>
            <span className="roster-cell" title="Pérdidas">
              Pérd.
            </span>
            <span className="roster-cell" title="Faltas cometidas / recibidas">
              Faltas
            </span>
            <span className="roster-cell" title="Eficacia de tiro">
              Efi.
            </span>
          </div>
        )}
        {rankingJugadoras.map((j) => (
          <div className="roster-row ranking-row" key={j.id}>
            <div className="roster-player">
              <span>
                <strong>
                  #{j.dorsal ?? '—'} {j.nombre}
                </strong>
                <small>
                  {j.partidos} partido{j.partidos === 1 ? '' : 's'}
                </small>
              </span>
            </div>
            <span className="roster-cell" data-label="Goles">
              {j.goles}
            </span>
            <span className="roster-cell" data-label="Gol/Lanz">
              {j.goles}/{j.lanzamientos}
            </span>
            <span className="roster-cell" data-label="Rec.">
              {j.recuperaciones}
            </span>
            <span className="roster-cell" data-label="Pérd.">
              {j.perdidas}
            </span>
            <span className="roster-cell" data-label="Faltas">
              {j.faltas_cometidas}/{j.faltas_recibidas}
            </span>
            <span className="roster-cell valor" data-label="Efi.">
              {j.efi}%
            </span>
          </div>
        ))}
        {!rankingJugadoras.length && (
          <p className="muted">Sin estadísticas de campo en este periodo</p>
        )}
      </div>
    </section>
  );
}
