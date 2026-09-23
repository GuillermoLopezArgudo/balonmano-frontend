export const ZONAS_CAMPO = [
  { id: 'extremo_izq', label: 'Extremo izq.', short: 'EI', area: 'ei' },
  { id: 'extremo_der', label: 'Extremo der.', short: 'ED', area: 'ed' },
  { id: 'lateral_izq', label: 'Lateral izq.', short: 'LI', area: 'li' },
  { id: 'central', label: 'Central', short: 'CE', area: 'ce' },
  { id: 'lateral_der', label: 'Lateral der.', short: 'LD', area: 'ld' },
  { id: 'pivote', label: 'Pivote', short: 'PI', area: 'pi' },
  { id: 'portero', label: 'Portero', short: 'PO', area: 'po' },
];

/** En defensa, central y pivote son intercambiables en el centro del 6-0 */
const LABEL_DEFENSA = {
  central: 'Central / Pivote',
  pivote: 'Central / Pivote',
};

export const zonasParaFase = (fase) =>
  fase === 'ataque' ? ZONAS_CAMPO.filter((z) => z.id !== 'portero') : ZONAS_CAMPO;

function labelZona(zona, fase) {
  if (fase === 'defensa' && LABEL_DEFENSA[zona.id]) return LABEL_DEFENSA[zona.id];
  return zona.label;
}

export default function CampoAlineacion({
  fase = 'ataque',
  zonas,
  byId,
  dragId,
  dropZone,
  onDragStart,
  onDragEnd,
  onDragOverZone,
  onDropZone,
  onClearZone,
}) {
  const slots = zonasParaFase(fase);

  return (
    <div
      className={`hb-court hb-court-${fase}`}
      aria-label={`Campo de alineación ${fase}`}
    >
      <div className="hb-court-mark hb-court-arc" aria-hidden="true" />
      <div className="hb-court-mark hb-court-goal" aria-hidden="true" />
      <span className={`hb-fase-tag hb-fase-${fase}`}>
        {fase === 'defensa' ? 'Defensa' : 'Ataque'}
      </span>
      {slots.map((zona) => {
        const jid = zonas[zona.id];
        const j = jid ? byId[jid] : null;
        const isOver = dropZone === `zona:${zona.id}`;
        return (
          <div
            key={zona.id}
            className={`hb-zone hb-zone-${zona.area}${isOver ? ' drop-ready' : ''}${j ? ' filled' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              onDragOverZone(zona.id);
            }}
            onDrop={(e) => onDropZone(e, zona.id)}
          >
            <span className="hb-zone-label">{labelZona(zona, fase)}</span>
            {j ? (
              <div
                className={`hb-zone-player${dragId === jid ? ' dragging' : ''}`}
                draggable
                onDragStart={(e) => onDragStart(e, jid)}
                onDragEnd={onDragEnd}
              >
                <strong>
                  #{j.dorsal ?? '—'} {j.nombre}
                </strong>
                <small>{j.apellido}</small>
                <button
                  type="button"
                  className="hb-zone-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearZone(zona.id);
                  }}
                  aria-label={`Quitar de ${labelZona(zona, fase)}`}
                >
                  ×
                </button>
              </div>
            ) : (
              <span className="hb-zone-empty">Soltar aquí</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
