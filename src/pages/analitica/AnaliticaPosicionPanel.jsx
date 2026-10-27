export default function AnaliticaPosicionPanel({ efiPorPosicion }) {
  return (
    <section className="panel forma-panel">
      <h2>Eficacia de tiro por posición</h2>
      <p className="panel-hint">Según temporada y filtro seleccionados</p>
      {efiPorPosicion.map((row, i) => (
        <div className="bar-row" key={row.posicion}>
          <span>{row.posicion}</span>
          <div className="bar-track">
            <div
              className={`bar-fill c${i % 5}`}
              style={{
                width: `${Math.min(Math.max(row.efectividad || 0, 0), 100)}%`,
              }}
            />
          </div>
          <strong title={`${row.goles}/${row.lanzamientos}`}>
            {row.efectividad}%
          </strong>
        </div>
      ))}
      {!efiPorPosicion.some((r) => r.lanzamientos > 0) && (
        <p className="muted">Sin lanzamientos de campo en este periodo</p>
      )}
    </section>
  );
}
