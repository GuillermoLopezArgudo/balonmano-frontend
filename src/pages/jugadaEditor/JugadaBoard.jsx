import JugadaArrows from './JugadaArrows';
import JugadaCourtMarks from './JugadaCourtMarks';
import JugadaPiezas from './JugadaPiezas';

export default function JugadaBoard({
  boardRef,
  state,
  paso,
  esCompleto,
  esMediaPista,
  esCampoHorizontal,
  onBoardClick,
  playTracks,
  selectedFlechaId,
  playing,
  playPhase,
  playActionIdx,
  playSnap,
  frozenSnap,
  flechaPieza,
  paseFrom,
  setFlechaPieza,
  setPaseFrom,
  setSelectedFlechaId,
  removeFlecha,
  displayPos,
  displayBall,
  canWrite,
  modo,
  onPointerDownPieza,
  onPointerDownBall,
  removePieza,
}) {
  const faseLabel = esCompleto
    ? 'Campo completo'
    : esMediaPista
      ? 'Media pista'
      : state.fase === 'defensa'
        ? 'Defensa'
        : 'Ataque';

  return (
    <div
      className={`jugada-board-wrap panel club-card${esCampoHorizontal ? ' jugada-board-wrap-full' : ''}`}
    >
      <div
        ref={boardRef}
        className={`hb-court ${esMediaPista ? 'hb-court-media' : `hb-court-${state.fase}`} jugada-board${esCampoHorizontal ? ' jugada-board-full' : ''}${esMediaPista ? ' jugada-board-media' : ''}`}
        onClick={onBoardClick}
      >
        <JugadaCourtMarks esCompleto={esCompleto} esMediaPista={esMediaPista} />
        <span className={`hb-fase-tag ${esMediaPista ? 'hb-fase-ataque' : `hb-fase-${state.fase}`}`}>
          {faseLabel}
        </span>

        <JugadaArrows
          paso={paso}
          playTracks={playTracks}
          selectedFlechaId={selectedFlechaId}
          playing={playing}
          playPhase={playPhase}
          playActionIdx={playActionIdx}
          setFlechaPieza={setFlechaPieza}
          setPaseFrom={setPaseFrom}
          setSelectedFlechaId={setSelectedFlechaId}
          removeFlecha={removeFlecha}
        />

        <JugadaPiezas
          state={state}
          paso={paso}
          displayPos={displayPos}
          displayBall={displayBall}
          flechaPieza={flechaPieza}
          paseFrom={paseFrom}
          playing={playing}
          playSnap={playSnap}
          frozenSnap={frozenSnap}
          canWrite={canWrite}
          modo={modo}
          onPointerDownPieza={onPointerDownPieza}
          onPointerDownBall={onPointerDownBall}
          removePieza={removePieza}
        />
      </div>
    </div>
  );
}
