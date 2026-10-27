import JugadaPasoList from './JugadaPasoList';

function BotonesEquipo({ playing, cupo, addPieza }) {
  return (
    <>
      <button
        type="button"
        className="ghost"
        disabled={playing || !cupo.puedeAtk}
        onClick={() => addPieza('ataque')}
        title={cupo.puedeAtk ? 'Añadir atacante' : 'Ya están todas las atacantes'}
      >
        + Atacante
      </button>
      <button
        type="button"
        className="ghost"
        disabled={playing || !cupo.puedeDef}
        onClick={() => addPieza('defensa')}
        title={cupo.puedeDef ? 'Añadir defensora' : 'Ya están todas las defensoras'}
      >
        + Defensora
      </button>
    </>
  );
}

export default function JugadaToolbar({
  state,
  pasoIdx,
  setPasoIdx,
  paso,
  canWrite,
  isEntrenamiento,
  esCompleto,
  esMediaPista,
  cupo,
  playing,
  play,
  stopPlay,
  clearFrozen,
  addPaso,
  removePaso,
  addPieza,
  removeLastFlecha,
  ponerTodasJugadoras,
  quitarTodasJugadoras,
  modo,
  setModo,
  flechaPieza,
  setFlechaPieza,
  paseFrom,
  setPaseFrom,
  setSelectedFlechaId,
  cancelPending,
}) {
  const botonesEquipo = <BotonesEquipo playing={playing} cupo={cupo} addPieza={addPieza} />;

  return (
    <div className="jugada-toolbar">
      <JugadaPasoList
        state={state}
        pasoIdx={pasoIdx}
        setPasoIdx={setPasoIdx}
        canWrite={canWrite}
        playing={playing}
        play={play}
        stopPlay={stopPlay}
        clearFrozen={clearFrozen}
        addPaso={addPaso}
        removePaso={removePaso}
        setSelectedFlechaId={setSelectedFlechaId}
        setFlechaPieza={setFlechaPieza}
        setPaseFrom={setPaseFrom}
      />

        {canWrite && (
        <div className="jugada-toolbar-row">
          <div
            className="jugada-tool-group jugada-modes btn-seg-group"
            role="group"
            aria-label="Modo de edición"
          >
            <span className="jugada-tool-label">Acción</span>
            <button
              type="button"
              className={`btn-seg${modo === 'mover' ? ' active' : ''}`}
              onClick={() => {
                setModo('mover');
                setFlechaPieza(null);
                setPaseFrom(null);
              }}
            >
              Mover
            </button>
            <button
              type="button"
              className={`btn-seg${modo === 'flecha' ? ' active' : ''}`}
              onClick={() => {
                setModo('flecha');
                setPaseFrom(null);
                setFlechaPieza(null);
              }}
            >
              Desmarque
            </button>
            {(state.fase !== 'defensa' || esMediaPista || !isEntrenamiento) && (
              <>
                <button
                  type="button"
                  className={`btn-seg${modo === 'pase' ? ' active' : ''}`}
                  onClick={() => {
                    setModo('pase');
                    setFlechaPieza(null);
                  }}
                >
                  Pase
                </button>
                <button
                  type="button"
                  className={`btn-seg${modo === 'lanzar' ? ' active' : ''}`}
                  onClick={() => {
                    setModo('lanzar');
                    setPaseFrom(null);
                    setFlechaPieza(null);
                  }}
                >
                  Lanzar
                </button>
              </>
            )}
            <button
              type="button"
              className="ghost danger"
              disabled={playing || !(paso?.flechas || []).length}
              onClick={removeLastFlecha}
              title="Elimina la última línea del paso (pase, desmarque o lanzamiento)"
            >
              Quitar línea
            </button>
            {(flechaPieza || paseFrom) && (
              <button type="button" className="ghost" onClick={cancelPending}>
                Cancelar
              </button>
            )}
            {!isEntrenamiento && botonesEquipo}
          </div>
        </div>
        )}

        {canWrite && isEntrenamiento && (
          <div className="jugada-toolbar-row">
            <div className="jugada-tool-group" aria-label="Jugadoras">
              <span className="jugada-tool-label">Jugadoras</span>
              <button
                type="button"
                className="ghost"
                onClick={ponerTodasJugadoras}
                title={
                  esCompleto
                    ? 'Colocar las 14 jugadoras en campo completo'
                    : 'Colocar las jugadoras en media pista'
                }
              >
                Poner todas
              </button>
              <button
                type="button"
                className="ghost danger"
                disabled={!state.piezas.length}
                onClick={quitarTodasJugadoras}
                title="Quitar todas las jugadoras del campo"
              >
                Quitar todas
              </button>
              {botonesEquipo}
            </div>
          </div>
        )}
    </div>
  );
}
