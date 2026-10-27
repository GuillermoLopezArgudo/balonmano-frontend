export default function JugadaArrows({
  paso,
  playTracks,
  selectedFlechaId,
  playing,
  playPhase,
  playActionIdx,
  setFlechaPieza,
  setPaseFrom,
  setSelectedFlechaId,
  removeFlecha,
}) {
  return (
  <svg className="jugada-arrows" viewBox="0 0 100 100" preserveAspectRatio="none">
    <defs>
      <marker
        id="jugada-arrowhead"
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="3"
        orient="auto"
        className="jugada-marker-mov"
      >
        <path d="M0,0 L6,3 L0,6 Z" />
      </marker>
      <marker
        id="jugada-arrowhead-pase"
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="3"
        orient="auto"
        className="jugada-marker-pase"
      >
        <path d="M0,0 L6,3 L0,6 Z" />
      </marker>
      <marker
        id="jugada-arrowhead-lanzamiento"
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="3"
        orient="auto"
        className="jugada-marker-lanz"
      >
        <path d="M0,0 L6,3 L0,6 Z" />
      </marker>
    </defs>
    {(paso?.flechas || []).map((f, fi) => {
      const tipo = f.tipo || 'movimiento';
      const marker =
        tipo === 'lanzamiento'
          ? 'url(#jugada-arrowhead-lanzamiento)'
          : tipo === 'pase'
            ? 'url(#jugada-arrowhead-pase)'
            : 'url(#jugada-arrowhead)';
      const atkIdx = playTracks.atk.findIndex(
        (x) => x.id_flecha === f.id_flecha || x === f,
      );
      const defIdx = playTracks.def.findIndex(
        (x) => x.id_flecha === f.id_flecha || x === f,
      );
      const trackIdx = atkIdx >= 0 ? atkIdx : defIdx;
      const selected =
        selectedFlechaId === f.id_flecha ||
        (playing && playPhase === 'action' && trackIdx === playActionIdx);
      const dimmed =
        playing && playPhase === 'action' && trackIdx > playActionIdx;
      return (
        <g
          key={f.id_flecha || `${f.id_pieza}-${f.x2}-${tipo}-${fi}`}
          className={`jugada-arrow-group${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
        >
          <line
            className="jugada-arrow-hit"
            x1={f.x1}
            y1={f.y1}
            x2={f.x2}
            y2={f.y2}
            vectorEffect="non-scaling-stroke"
            onClick={(e) => {
              e.stopPropagation();
              if (playing) return;
              setFlechaPieza(null);
              setPaseFrom(null);
              setSelectedFlechaId((cur) =>
                cur === f.id_flecha ? null : f.id_flecha,
              );
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (playing) return;
              removeFlecha(f.id_flecha);
            }}
          />
          <line
            className={`jugada-arrow jugada-arrow-${tipo === 'lanzamiento' ? 'lanz' : tipo === 'pase' ? 'pase' : 'mov'}${selected ? ' selected' : ''}`}
            x1={f.x1}
            y1={f.y1}
            x2={f.x2}
            y2={f.y2}
            markerEnd={marker}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </g>
      );
    })}
  </svg>
  );
}
