import { IcoBasura } from '../../components/ActionIcons';

export default function JugadaModeHints({
  canWrite,
  modo,
  flechaPieza,
  paseFrom,
  selectedFlechaId,
  playing,
  playPhase,
  playActionIdx,
  playTracks,
  paso,
  isEntrenamiento,
  removeFlecha,
}) {
  return (
    <>
      {canWrite && modo === 'flecha' && (
        <p className="muted jugada-hint">
          {flechaPieza
            ? 'Clic en el campo = destino del desmarque · Esc cancela'
            : 'Elige una pieza y luego el destino · Clic en una línea para seleccionarla'}
        </p>
      )}
      {canWrite && modo === 'pase' && (
        <p className="muted jugada-hint">
          {paseFrom
            ? 'Ahora elige a quién pasa el balón · Esc cancela'
            : 'Elige quién tiene el balón y luego la receptora · Clic en una línea para seleccionarla'}
        </p>
      )}
      {canWrite && modo === 'lanzar' && (
        <p className="muted jugada-hint">
          {flechaPieza
            ? 'Clic en el campo = destino del lanzamiento · Esc cancela'
            : 'Elige quién lanza y luego el destino · Clic en una línea para seleccionarla'}
        </p>
      )}
      {canWrite && selectedFlechaId && !playing && (
        <p className="muted jugada-hint">
          Línea seleccionada ·{' '}
          <button
            type="button"
            className="btn-icon-del"
            title="Eliminar línea"
            aria-label="Eliminar línea"
            onClick={() => removeFlecha(selectedFlechaId)}
          >
            <IcoBasura size={16} />
          </button>
          {' · Esc deselecciona · Supr elimina'}
        </p>
      )}
      {canWrite && modo === 'mover' && !selectedFlechaId && !playing && (paso?.flechas || []).length > 0 && (
        <p className="muted jugada-hint">
          {isEntrenamiento
            ? 'Play mueve atacantes (rojas) y defensoras (azules) a la vez, cada una con su secuencia · Clic en una línea para eliminarla'
            : 'Play anima todas las líneas de este paso en orden · Clic en una línea para eliminarla'}
        </p>
      )}
      {playing && (
        <p className="muted jugada-hint">
          Reproduciendo
          {playPhase === 'action'
            ? isEntrenamiento
              ? ` · paso paralelo ${(playActionIdx || 0) + 1}/${playTracks.max || 1}`
              : ` · acción ${(playActionIdx || 0) + 1}/${playTracks.max || 1}`
            : ' · transición al siguiente paso'}
        </p>
      )}
    </>
  );
}
