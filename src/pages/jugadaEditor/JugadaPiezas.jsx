import { IcoBasura } from '../../components/ActionIcons';

export default function JugadaPiezas({
  state,
  paso,
  displayPos,
  displayBall,
  flechaPieza,
  paseFrom,
  playing,
  playSnap,
  frozenSnap,
  canWrite,
  modo,
  onPointerDownPieza,
  onPointerDownBall,
  removePieza,
}) {
  return (
    <>
      {state.piezas.map((pieza) => {
        const pos = displayPos(pieza.id_pieza);
        if (!pos) return null;
        const selected =
          flechaPieza === pieza.id_pieza || paseFrom === pieza.id_pieza;
        const tieneBalon =
          playing && playSnap
            ? playSnap.ballOwner === pieza.id_pieza
            : !playing && frozenSnap
              ? frozenSnap.ballOwner === pieza.id_pieza
              : paso?.id_pieza_balon === pieza.id_pieza;
        return (
          <div
            key={pieza.id_pieza}
            className={`jugada-pieza${selected ? ' selected' : ''}${canWrite && modo === 'mover' ? ' movable' : ''}${tieneBalon ? ' has-ball' : ''}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              background: pieza.color || '#a3e635',
            }}
            onPointerDown={(e) => onPointerDownPieza(e, pieza.id_pieza)}
          >
            <strong>{pieza.etiqueta}</strong>
            {canWrite && !playing && (
              <button
                type="button"
                className="jugada-pieza-del"
                onClick={(e) => {
                  e.stopPropagation();
                  removePieza(pieza.id_pieza);
                }}
                title="Quitar pieza"
                aria-label="Quitar pieza"
              >
                <IcoBasura size={11} />
              </button>
            )}
          </div>
        );
      })}

      <div
        className={`jugada-ball${canWrite && modo === 'mover' ? ' movable' : ''}`}
        style={{ left: `${displayBall.x}%`, top: `${displayBall.y}%` }}
        onPointerDown={onPointerDownBall}
        title="Balón"
      />
    </>
  );
}
