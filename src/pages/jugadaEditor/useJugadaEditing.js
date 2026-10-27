import { useEffect, useRef } from 'react';
import {
  blankJugada,
  defaultPiezas,
  equipoPieza,
  slotsEquipo,
  uid,
} from './utils';

/** Edición del tablero: flechas, piezas, pasos, arrastre y atajos de teclado. */
export function useJugadaEditing({
  state,
  setState,
  pasoIdx,
  setPasoIdx,
  paso,
  posMap,
  canWrite,
  isEntrenamiento,
  isNew,
  boardRef,
  playing,
  stopPlay,
  clearFrozen,
  modes,
}) {
  const {
    modo,
    setModo,
    flechaPieza,
    setFlechaPieza,
    paseFrom,
    setPaseFrom,
    selectedFlechaId,
    setSelectedFlechaId,
    cancelPending,
  } = modes;
  const dragRef = useRef(null);

  const removeFlecha = (flechaId) => {
    if (!canWrite || !flechaId || playing) return;
    stopPlay();
    clearFrozen();
    setState((prev) => {
      const pasos = [...prev.pasos];
      const cur = { ...pasos[pasoIdx] };
      const flechas = cur.flechas || [];
      const flecha = flechas.find((f) => f.id_flecha === flechaId);
      if (!flecha) return prev;

      cur.flechas = flechas.filter((f) => f.id_flecha !== flechaId);
      pasos[pasoIdx] = cur;

      if (pasos[pasoIdx + 1]) {
        const nxt = { ...pasos[pasoIdx + 1] };
        const tipo = flecha.tipo || 'movimiento';
        if (tipo === 'movimiento') {
          const fromPos = (cur.posiciones || []).find((p) => p.id_pieza === flecha.id_pieza);
          if (fromPos) {
            const posiciones = [...(nxt.posiciones || [])];
            const ix = posiciones.findIndex((p) => p.id_pieza === flecha.id_pieza);
            const dest = { id_pieza: flecha.id_pieza, x: fromPos.x, y: fromPos.y };
            if (ix >= 0) posiciones[ix] = dest;
            else posiciones.push(dest);
            nxt.posiciones = posiciones;
          }
        } else if (tipo === 'pase' || tipo === 'lanzamiento') {
          nxt.id_pieza_balon = cur.id_pieza_balon;
          nxt.balon_x = cur.balon_x;
          nxt.balon_y = cur.balon_y;
        }
        pasos[pasoIdx + 1] = nxt;
      }
      return { ...prev, pasos };
    });
    setSelectedFlechaId(null);
  };

  const removeLastFlecha = () => {
    const flechas = paso?.flechas || [];
    if (!flechas.length) return;
    removeFlecha(flechas[flechas.length - 1].id_flecha);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (flechaPieza || paseFrom || selectedFlechaId) {
          e.preventDefault();
          cancelPending();
        }
        return;
      }
      if (playing) return;
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedFlechaId) {
        e.preventDefault();
        removeFlecha(selectedFlechaId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flechaPieza, paseFrom, selectedFlechaId, playing, pasoIdx]);


  const updatePasoPos = (piezaId, x, y) => {
    clearFrozen();
    setState((prev) => {
      const pasos = prev.pasos.map((p, i) => {
        if (i !== pasoIdx) return p;
        const posiciones = [...p.posiciones];
        const ix = posiciones.findIndex((pos) => pos.id_pieza === piezaId);
        const next = { id_pieza: piezaId, x, y };
        if (ix >= 0) posiciones[ix] = next;
        else posiciones.push(next);
        const updated = { ...p, posiciones };
        if (p.id_pieza_balon === piezaId) {
          updated.balon_x = x;
          updated.balon_y = y;
        }
        return updated;
      });
      return { ...prev, pasos };
    });
  };

  const onPointerDownPieza = (e, piezaId) => {
    if (!canWrite || playing) return;
    clearFrozen();
    e.preventDefault();
    e.stopPropagation();

    if (modo === 'pase') {
      if (!paseFrom) {
        setPaseFrom(piezaId);
        // solo fija el balón del diagrama si aún no hay dueña en este paso
        setState((prev) => {
          const pasos = prev.pasos.map((p, i) => {
            if (i !== pasoIdx) return p;
            if (p.id_pieza_balon) return p;
            const pos = p.posiciones.find((x) => x.id_pieza === piezaId);
            return {
              ...p,
              id_pieza_balon: piezaId,
              balon_x: pos?.x ?? p.balon_x,
              balon_y: pos?.y ?? p.balon_y,
            };
          });
          return { ...prev, pasos };
        });
        return;
      }
      if (paseFrom === piezaId) {
        setPaseFrom(null);
        return;
      }
      // completar pase (puede haber varios en el mismo paso; Play los anima en orden)
      const from = posMap[paseFrom];
      const to = posMap[piezaId];
      if (!from || !to) return;
      setState((prev) => {
        const pasos = [...prev.pasos];
        const cur = { ...pasos[pasoIdx] };
        const flechas = [...(cur.flechas || [])];
        flechas.push({
          id_flecha: uid(),
          id_pieza: paseFrom,
          id_destino: piezaId,
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          tipo: 'pase',
        });
        cur.flechas = flechas;
        // balón del diagrama: quien inicia la secuencia en este paso
        if (!cur.id_pieza_balon) {
          cur.id_pieza_balon = paseFrom;
          cur.balon_x = from.x;
          cur.balon_y = from.y;
        }
        pasos[pasoIdx] = cur;

        // si ya hay paso siguiente, actualizar balón final (opcional)
        if (pasos[pasoIdx + 1]) {
          const nxt = { ...pasos[pasoIdx + 1] };
          nxt.id_pieza_balon = piezaId;
          nxt.balon_x = to.x;
          nxt.balon_y = to.y;
          pasos[pasoIdx + 1] = nxt;
        }
        return { ...prev, pasos };
      });
      setPaseFrom(null);
      return;
    }

    if (modo === 'flecha' || modo === 'lanzar') {
      setFlechaPieza(piezaId);
      if (modo === 'lanzar') {
        // quien lanza tiene el balón
        setState((prev) => {
          const pasos = prev.pasos.map((p, i) => {
            if (i !== pasoIdx) return p;
            const pos = p.posiciones.find((x) => x.id_pieza === piezaId);
            return {
              ...p,
              id_pieza_balon: piezaId,
              balon_x: pos?.x ?? p.balon_x,
              balon_y: pos?.y ?? p.balon_y,
            };
          });
          return { ...prev, pasos };
        });
      }
      return;
    }
    const board = boardRef.current;
    if (!board) return;
    dragRef.current = { piezaId };
    const move = (ev) => {
      const rect = board.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      updatePasoPos(piezaId, x, y);
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onBoardClick = (e) => {
    if (!canWrite) return;
    if (playing || !flechaPieza) return;
    if (modo !== 'flecha' && modo !== 'lanzar') return;
    clearFrozen();
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x2 = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y2 = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const from = posMap[flechaPieza];
    if (!from) return;
    const tipoFlecha = modo === 'lanzar' ? 'lanzamiento' : 'movimiento';

    setState((prev) => {
      const pasos = [...prev.pasos];
      const cur = { ...pasos[pasoIdx] };
      // varios desmarques/lanzamientos en el mismo paso; Play los anima en orden
      const flechas = [...(cur.flechas || [])];
      flechas.push({
        id_flecha: uid(),
        id_pieza: flechaPieza,
        x1: from.x,
        y1: from.y,
        x2,
        y2,
        tipo: tipoFlecha,
      });
      cur.flechas = flechas;
      if (tipoFlecha === 'lanzamiento' && !cur.id_pieza_balon) {
        cur.id_pieza_balon = flechaPieza;
        cur.balon_x = from.x;
        cur.balon_y = from.y;
      }
      pasos[pasoIdx] = cur;

      // si ya existe paso siguiente, reflejar destino final
      if (pasos[pasoIdx + 1]) {
        const nxt = { ...pasos[pasoIdx + 1] };
        if (tipoFlecha === 'lanzamiento') {
          nxt.balon_x = x2;
          nxt.balon_y = y2;
          nxt.id_pieza_balon = null;
        } else {
          const posiciones = [...(nxt.posiciones || [])];
          const ix = posiciones.findIndex((p) => p.id_pieza === flechaPieza);
          const dest = { id_pieza: flechaPieza, x: x2, y: y2 };
          if (ix >= 0) posiciones[ix] = dest;
          else posiciones.push(dest);
          nxt.posiciones = posiciones;
        }
        pasos[pasoIdx + 1] = nxt;
      }
      return { ...prev, pasos };
    });
    setFlechaPieza(null);
    setSelectedFlechaId(null);
  };

  const onPointerDownBall = (e) => {
    if (!canWrite || playing || modo !== 'mover') return;
    e.preventDefault();
    e.stopPropagation();
    const board = boardRef.current;
    if (!board) return;
    const move = (ev) => {
      const rect = board.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      setState((prev) => {
        const pasos = prev.pasos.map((p, i) => {
          if (i !== pasoIdx) return p;
          // asignar a la pieza más cercana si está a < 8%
          let nearest = null;
          let best = 1e9;
          for (const pos of p.posiciones) {
            const d = (pos.x - x) ** 2 + (pos.y - y) ** 2;
            if (d < best) {
              best = d;
              nearest = pos;
            }
          }
          if (nearest && best < 64) {
            return {
              ...p,
              id_pieza_balon: nearest.id_pieza,
              balon_x: nearest.x,
              balon_y: nearest.y,
            };
          }
          return { ...p, id_pieza_balon: null, balon_x: x, balon_y: y };
        });
        return { ...prev, pasos };
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const addPaso = () => {
    if (!canWrite) return;
    stopPlay();
    clearFrozen();
    setState((prev) => {
      const last = prev.pasos[prev.pasos.length - 1];
      const nuevo = {
        id_paso: uid(),
        orden: prev.pasos.length,
        titulo: `Paso ${prev.pasos.length + 1}`,
        posiciones: (last?.posiciones || []).map((p) => ({ ...p })),
        flechas: [],
        balon_x: last?.balon_x ?? null,
        balon_y: last?.balon_y ?? null,
        id_pieza_balon: last?.id_pieza_balon ?? null,
      };
      return { ...prev, pasos: [...prev.pasos, nuevo] };
    });
    setPasoIdx((i) => i + 1);
  };

  const removePaso = () => {
    if (!canWrite || state.pasos.length <= 1) return;
    stopPlay();
    clearFrozen();
    setState((prev) => {
      const pasos = prev.pasos.filter((_, i) => i !== pasoIdx).map((p, i) => ({ ...p, orden: i }));
      return { ...prev, pasos };
    });
    setPasoIdx((i) => Math.max(0, Math.min(i, state.pasos.length - 2)));
  };

  const addPieza = (equipo) => {
    if (!canWrite) return;
    const lado = equipo === 'defensa' ? 'defensa' : 'ataque';
    const usadas = new Set(
      state.piezas
        .filter((p) => equipoPieza(p, state.fase) === lado)
        .map((p) => p.etiqueta),
    );
    const libre = slotsEquipo(state.fase, state.ambito, lado).find(
      (r) => !usadas.has(r.pieza.etiqueta),
    );
    if (!libre) return;
    stopPlay();
    clearFrozen();
    const idPieza = uid();
    setState((prev) => ({
      ...prev,
      piezas: [
        ...prev.piezas,
        {
          id_pieza: idPieza,
          etiqueta: libre.pieza.etiqueta,
          color: libre.pieza.color,
          orden: prev.piezas.length,
        },
      ],
      pasos: prev.pasos.map((p) => ({
        ...p,
        posiciones: [
          ...p.posiciones,
          { id_pieza: idPieza, x: libre.pos.x, y: libre.pos.y },
        ],
      })),
    }));
  };

  const removePieza = (piezaId) => {
    if (!canWrite) return;
    stopPlay();
    clearFrozen();
    setState((prev) => ({
      ...prev,
      piezas: prev.piezas.filter((p) => p.id_pieza !== piezaId),
      pasos: prev.pasos.map((paso) => ({
        ...paso,
        posiciones: paso.posiciones.filter((p) => p.id_pieza !== piezaId),
        flechas: paso.flechas.filter((f) => f.id_pieza !== piezaId),
        id_pieza_balon: paso.id_pieza_balon === piezaId ? null : paso.id_pieza_balon,
      })),
    }));
  };

  const ponerTodasJugadoras = () => {
    if (!isEntrenamiento || !canWrite) return;
    if (
      state.piezas.length &&
      !window.confirm('¿Sustituir las piezas actuales por todas las jugadoras de esta pista?')
    ) {
      return;
    }
    stopPlay();
    clearFrozen();
    cancelPending();
    const rows = defaultPiezas(state.fase, 'fisico');
    const first = rows[0];
    setState((prev) => ({
      ...prev,
      piezas: rows.map((r) => r.pieza),
      pasos: prev.pasos.map((paso, i) => ({
        ...paso,
        posiciones: rows.map((r) => ({ ...r.pos })),
        flechas: i === 0 ? [] : paso.flechas,
        balon_x: first ? first.pos.x : null,
        balon_y: first ? first.pos.y : null,
        id_pieza_balon: first ? first.pieza.id_pieza : null,
      })),
    }));
    setPasoIdx(0);
  };

  const quitarTodasJugadoras = () => {
    if (!isEntrenamiento || !canWrite || !state.piezas.length) return;
    if (!window.confirm('¿Quitar todas las jugadoras del campo?')) return;
    stopPlay();
    clearFrozen();
    cancelPending();
    setState((prev) => ({
      ...prev,
      piezas: [],
      pasos: prev.pasos.map((paso) => ({
        ...paso,
        posiciones: [],
        flechas: [],
        balon_x: null,
        balon_y: null,
        id_pieza_balon: null,
      })),
    }));
    setPasoIdx(0);
  };

  const changeFase = (fase) => {
    if (!isNew && !window.confirm('Cambiar fase reinicia las piezas del campo. ¿Continuar?')) {
      return;
    }
    stopPlay();
    clearFrozen();
    const blank = blankJugada(fase, state.ambito);
    setState((prev) => ({
      ...prev,
      fase,
      piezas: blank.piezas,
      pasos: blank.pasos,
    }));
    setPasoIdx(0);
    setFlechaPieza(null);
    setPaseFrom(null);
    setModo('mover');
  };

  return {
    removeFlecha,
    removeLastFlecha,
    onPointerDownPieza,
    onBoardClick,
    onPointerDownBall,
    addPaso,
    removePaso,
    addPieza,
    removePieza,
    ponerTodasJugadoras,
    quitarTodasJugadoras,
    changeFase,
  };
}
