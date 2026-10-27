import { DISP_LABEL, shortZona } from './utils';

export default function ConvocatoriaPlantillaList({
  tab,
  q,
  setQ,
  filtrados,
  selected,
  zonaAtaqueDe,
  zonaDefensaDe,
  dragId,
  dropZone,
  setDropZone,
  tieneFederacion,
  puedeConvocarPorEstado,
  toggleConvocado,
  onDragStart,
  onDragEnd,
  onPointerDragStart,
  onDropPlantilla,
}) {
  return (
    <section className="panel club-card">
      <h2>{tab === 'convocatoria' ? 'Plantilla disponible' : 'Convocadas'}</h2>
      <div className="field">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, dorsal o posición…"
        />
      </div>
      <div
        className={`conv-list${dropZone === 'plantilla' ? ' drop-ready' : ''}`}
        data-drop-target="plantilla"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropZone('plantilla');
        }}
        onDragLeave={() => setDropZone((z) => (z === 'plantilla' ? null : z))}
        onDrop={onDropPlantilla}
      >
        {filtrados.map((j) => {
          const checked = Boolean(selected[j.id_jugador]);
          const za = zonaAtaqueDe[j.id_jugador];
          const zd = zonaDefensaDe[j.id_jugador];
          const esConvTab = tab === 'convocatoria';
          const fed = tieneFederacion(j.id_jugador);
          const convocable = puedeConvocarPorEstado(j.id_jugador);
          const bloqueada = esConvTab && !checked && (!fed || !convocable);
          const disp = j.disponibilidad || 'disponible';
          return (
            <div
              key={j.id_jugador}
              className={`conv-player${checked ? ' on' : ''}${dragId === j.id_jugador ? ' dragging' : ''}${
                bloqueada ? ' conv-player-blocked' : ''
              }${disp !== 'disponible' ? ` conv-disp-${disp}` : ''}`}
              data-drag-id={j.id_jugador}
              draggable={!bloqueada}
              onDragStart={(e) => onDragStart(e, j.id_jugador)}
              onDragEnd={onDragEnd}
              onPointerDown={
                bloqueada
                  ? undefined
                  : (e) => onPointerDragStart(e, j.id_jugador)
              }
            >
              {esConvTab && (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={bloqueada}
                  onChange={() => toggleConvocado(j.id_jugador)}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={`Convocar a ${j.nombre} ${j.apellido}`}
                />
              )}
              <span className="conv-dorsal">#{j.dorsal ?? '—'}</span>
              <span className="conv-name">
                <strong>
                  {j.nombre} {j.apellido}
                </strong>
                <small>
                  {j.posiciones?.[0] || 'Sin posición'}
                  {za ? ` · ATK ${shortZona(za)}` : ''}
                  {zd ? ` · DEF ${shortZona(zd)}` : ''}
                  {!convocable
                    ? ` · ${disp === 'sancion' ? 'Sancionada' : 'Lesionada'} · no se puede convocar`
                    : ''}
                  {convocable && bloqueada ? ' · Sin federación' : ''}
                </small>
              </span>
              <span className={`conv-disp-badge conv-disp-badge-${disp}`}>
                {DISP_LABEL[disp] || disp}
              </span>
              <span className="conv-grip" aria-hidden="true">
                ⋮⋮
              </span>
            </div>
          );
        })}
        {!filtrados.length && (
          <p className="muted">
            {tab === 'convocatoria'
              ? 'Sin jugadores'
              : 'No hay convocadas. Márcalas en la pestaña Convocatoria.'}
          </p>
        )}
      </div>
    </section>
  );
}
