export default function JugadaPasoList({
  state,
  pasoIdx,
  setPasoIdx,
  canWrite,
  playing,
  play,
  stopPlay,
  clearFrozen,
  addPaso,
  removePaso,
  setSelectedFlechaId,
  setFlechaPieza,
  setPaseFrom,
}) {
  return (
    <div className="jugada-toolbar-row">
      <div className="jugada-tool-group jugada-pasos" aria-label="Pasos">
        <span className="jugada-tool-label">Pasos</span>
        {state.pasos.map((p, i) => (
          <button
            type="button"
            key={p.id_paso}
            className={`btn-seg jugada-paso-chip${i === pasoIdx ? ' active' : ''}`}
            onClick={() => {
              stopPlay();
              clearFrozen();
              setPasoIdx(i);
              setSelectedFlechaId(null);
              setFlechaPieza(null);
              setPaseFrom(null);
            }}
          >
            {i + 1}
            {p.titulo ? ` · ${p.titulo}` : ''}
          </button>
        ))}
        {canWrite && (
          <>
            <button type="button" className="ghost" onClick={addPaso}>
              + Paso
            </button>
            <button
              type="button"
              className="ghost danger"
              disabled={state.pasos.length <= 1}
              onClick={removePaso}
            >
              − Paso
            </button>
          </>
        )}
        {!playing ? (
          <button type="button" className="btn-play" onClick={play}>
            ▶ Play
          </button>
        ) : (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              stopPlay();
              clearFrozen();
            }}
          >
            ■ Stop
          </button>
        )}
      </div>
    </div>
  );
}
