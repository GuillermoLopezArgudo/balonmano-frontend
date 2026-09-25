import { useEffect, useRef, useState } from 'react';

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
  onPointerDragStart,
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
            data-drop-target={`zona:${zona.id}`}
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
                data-drag-id={jid}
                draggable
                onDragStart={(e) => onDragStart(e, jid)}
                onDragEnd={onDragEnd}
                onPointerDown={(e) => onPointerDragStart?.(e, jid)}
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
                  onPointerDown={(e) => e.stopPropagation()}
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

/**
 * Arrastre táctil / pointer para convocatoria y alineación.
 * HTML5 DnD no funciona en la mayoría de móviles.
 *
 * En touch: mantener ~220ms para “coger” al jugador; así el scroll vertical
 * de la lista sigue funcionando y luego se puede arrastrar en cualquier dirección
 * (en móvil plantilla está encima del campo → el gesto es hacia abajo).
 */
export function usePointerDnD({
  canStart,
  onDropTarget,
  setDragId,
  setDropZone,
  labelFor,
}) {
  const [ghost, setGhost] = useState(null);
  const stateRef = useRef(null);

  useEffect(
    () => () => {
      const s = stateRef.current;
      if (s?.holdTimer) clearTimeout(s.holdTimer);
      if (s) {
        window.removeEventListener('pointermove', s.onMove);
        window.removeEventListener('pointerup', s.onUp);
        window.removeEventListener('pointercancel', s.onUp);
      }
      document.body.classList.remove('conv-pointer-dragging');
    },
    [],
  );

  const onPointerDragStart = (e, jid, opts = {}) => {
    if (e.button != null && e.button !== 0) return;
    if (e.pointerType === 'mouse' && e.detail > 1) return;
    // En ratón dejamos HTML5 DnD; pointer solo para touch/pen
    if (e.pointerType === 'mouse') return;
    if (e.target?.closest?.('button, input, a, label')) return;
    if (canStart && !canStart(jid)) return;

    const holdMs = opts.holdMs ?? 280;
    const startX = e.clientX;
    const startY = e.clientY;
    const originEl = e.currentTarget;
    let active = false;
    let cancelled = false;
    const pointerId = e.pointerId;

    const cleanup = () => {
      const s = stateRef.current;
      if (s?.holdTimer) clearTimeout(s.holdTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      stateRef.current = null;
      setGhost(null);
      setDragId(null);
      setDropZone(null);
      document.body.classList.remove('conv-pointer-dragging');
      try {
        originEl?.releasePointerCapture?.(pointerId);
      } catch {
        /* ignore */
      }
    };

    const hitTarget = (x, y) => {
      const stack = document.elementsFromPoint?.(x, y) || [document.elementFromPoint(x, y)];
      for (const el of stack) {
        if (!el || el.nodeType !== 1) continue;
        if (el.classList?.contains('conv-drag-ghost')) continue;
        const dragEl = el.closest?.('[data-drag-id]');
        if (dragEl?.getAttribute('data-drag-id') === jid) continue;
        const node = el.closest?.('[data-drop-target]');
        if (node) return node.getAttribute('data-drop-target');
      }
      return null;
    };

    const activate = () => {
      if (active || cancelled) return;
      active = true;
      setDragId(jid);
      document.body.classList.add('conv-pointer-dragging');
      try {
        originEl?.setPointerCapture?.(pointerId);
      } catch {
        /* ignore */
      }
      setGhost({
        x: startX,
        y: startY,
        label: labelFor?.(jid) || '…',
      });
    };

    const holdTimer = setTimeout(activate, holdMs);

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dist = Math.hypot(dx, dy);

      if (!active) {
        // Antes de coger: si el dedo se mueve, es scroll → cancelar hold
        if (dist > 8) {
          cancelled = true;
          cleanup();
        }
        return;
      }

      ev.preventDefault();
      const target = hitTarget(ev.clientX, ev.clientY);
      setDropZone(target);
      setGhost({
        x: ev.clientX,
        y: ev.clientY,
        label: labelFor?.(jid) || '…',
      });
    };

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      if (active) {
        const target = hitTarget(ev.clientX, ev.clientY);
        if (target) onDropTarget(target, jid);
      }
      cleanup();
    };

    stateRef.current = { onMove, onUp, holdTimer };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return { onPointerDragStart, ghost };
}
