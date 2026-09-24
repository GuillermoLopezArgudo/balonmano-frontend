import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const COLORS = ['#a3e635', '#84cc16', '#d9f99d', '#93c5fd', '#60a5fa', '#fbbf24', '#f472b6'];

function defaultPiezas(fase) {
  const atk = [
    { etiqueta: 'CE', x: 50, y: 12 },
    { etiqueta: 'LD', x: 28, y: 32 },
    { etiqueta: 'LI', x: 72, y: 32 },
    { etiqueta: 'PI', x: 50, y: 40 },
    { etiqueta: 'ED', x: 14, y: 82 },
    { etiqueta: 'EI', x: 86, y: 82 },
  ];
  const def = [
    { etiqueta: 'EI', x: 8, y: 78 },
    { etiqueta: 'LI', x: 20, y: 55 },
    { etiqueta: 'CE', x: 38, y: 42 },
    { etiqueta: 'PI', x: 62, y: 42 },
    { etiqueta: 'LD', x: 80, y: 55 },
    { etiqueta: 'ED', x: 92, y: 78 },
    { etiqueta: 'PO', x: 50, y: 92 },
  ];
  return (fase === 'defensa' ? def : atk).map((p, i) => {
    const id = uid();
    return {
      pieza: {
        id_pieza: id,
        etiqueta: p.etiqueta,
        color: COLORS[i % COLORS.length],
        orden: i,
      },
      pos: { id_pieza: id, x: p.x, y: p.y },
    };
  });
}

function blankJugada(fase = 'ataque') {
  const rows = defaultPiezas(fase);
  const first = rows[0];
  const esDefensa = fase === 'defensa';
  return {
    nombre: '',
    fase,
    descripcion: '',
    piezas: rows.map((r) => r.pieza),
    pasos: [
      {
        id_paso: uid(),
        orden: 0,
        titulo: 'Inicio',
        posiciones: rows.map((r) => r.pos),
        flechas: [],
        balon_x: esDefensa ? null : first.pos.x,
        balon_y: esDefensa ? null : first.pos.y,
        id_pieza_balon: esDefensa ? null : first.pieza.id_pieza,
      },
    ],
  };
}

function ballCoords(paso, posMap) {
  if (!paso) return { x: 50, y: 50 };
  if (paso.id_pieza_balon && posMap[paso.id_pieza_balon]) {
    const p = posMap[paso.id_pieza_balon];
    return { x: p.x + 3.5, y: p.y - 3.5 };
  }
  if (paso.balon_x != null && paso.balon_y != null) {
    return { x: paso.balon_x, y: paso.balon_y };
  }
  return { x: 50, y: 50 };
}

function nearestPiezaId(posMap, x, y) {
  let bestId = null;
  let best = 1e9;
  for (const [id, p] of Object.entries(posMap)) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < best) {
      best = d;
      bestId = id;
    }
  }
  return bestId;
}

/** Estado visual al reproducir las flechas 0..actionIdx (con progreso t en la actual). */
function snapshotPlay(paso, actionIdx, t) {
  const flechas = paso?.flechas || [];
  const pos = {};
  for (const p of paso?.posiciones || []) {
    pos[p.id_pieza] = { id_pieza: p.id_pieza, x: p.x, y: p.y };
  }
  let ballOwner = paso?.id_pieza_balon ?? null;
  let ball = ballCoords(paso, pos);

  const apply = (i, progress) => {
    if (progress <= 0) return;
    const f = flechas[i];
    if (!f) return;
    const tipo = f.tipo || 'movimiento';
    if (tipo === 'movimiento') {
      const cur = pos[f.id_pieza] || { x: f.x1, y: f.y1 };
      const x = cur.x + (f.x2 - cur.x) * progress;
      const y = cur.y + (f.y2 - cur.y) * progress;
      pos[f.id_pieza] = { id_pieza: f.id_pieza, x, y };
      if (ballOwner === f.id_pieza) {
        ball = { x: x + 3.5, y: y - 3.5 };
      }
    } else if (tipo === 'pase' || tipo === 'lanzamiento') {
      ball = {
        x: f.x1 + (f.x2 - f.x1) * progress,
        y: f.y1 + (f.y2 - f.y1) * progress,
      };
      if (progress >= 1) {
        if (tipo === 'pase') {
          ballOwner =
            f.id_destino || nearestPiezaId(pos, f.x2, f.y2) || ballOwner;
          if (ballOwner && pos[ballOwner]) {
            ball = { x: pos[ballOwner].x + 3.5, y: pos[ballOwner].y - 3.5 };
          }
        } else {
          ballOwner = null;
        }
      }
    }
  };

  for (let i = 0; i < flechas.length; i += 1) {
    if (i < actionIdx) apply(i, 1);
    else if (i === actionIdx) apply(i, t);
    else break;
  }

  return { pos, ball, ballOwner };
}

function fromApi(data) {
  const esDefensa = data.fase === 'defensa';
  return {
    id_jugada: data.id_jugada,
    nombre: data.nombre,
    fase: data.fase,
    descripcion: data.descripcion || '',
    piezas: (data.piezas || []).map((p) => ({ ...p })),
    pasos: (data.pasos || []).map((paso) => ({
      id_paso: paso.id_paso,
      orden: paso.orden,
      titulo: paso.titulo || '',
      balon_x: esDefensa ? null : paso.balon_x ?? null,
      balon_y: esDefensa ? null : paso.balon_y ?? null,
      id_pieza_balon: esDefensa ? null : paso.id_pieza_balon ?? null,
      posiciones: (paso.posiciones || []).map((pos) => ({ ...pos })),
      flechas: (paso.flechas || []).map((f) => ({
        id_flecha: f.id_flecha || uid(),
        id_pieza: f.id_pieza,
        id_destino: f.id_destino || null,
        x1: f.x1,
        y1: f.y1,
        x2: f.x2,
        y2: f.y2,
        tipo: f.tipo || 'movimiento',
      })),
    })),
  };
}

function toPayload(state) {
  const esDefensa = state.fase === 'defensa';
  return {
    nombre: state.nombre.trim(),
    fase: state.fase,
    descripcion: state.descripcion.trim() || null,
    piezas: state.piezas.map((p, i) => ({
      id_pieza: p.id_pieza,
      etiqueta: p.etiqueta,
      color: p.color,
      id_jugador: p.id_jugador || null,
      orden: i,
    })),
    pasos: state.pasos.map((paso, i) => ({
      id_paso: paso.id_paso,
      orden: i,
      titulo: paso.titulo || null,
      balon_x: esDefensa ? null : paso.balon_x,
      balon_y: esDefensa ? null : paso.balon_y,
      id_pieza_balon: esDefensa ? null : paso.id_pieza_balon,
      posiciones: paso.posiciones,
      flechas: paso.flechas.map((f) => ({
        id_pieza: f.id_pieza,
        x1: f.x1,
        y1: f.y1,
        x2: f.x2,
        y2: f.y2,
        tipo: f.tipo || 'movimiento',
      })),
    })),
  };
}

export default function JugadaEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'nueva';
  const navigate = useNavigate();
  const { canWriteJugadas } = useAuth();

  const [state, setState] = useState(() => blankJugada('ataque'));
  const [pasoIdx, setPasoIdx] = useState(0);
  const [modo, setModo] = useState('mover'); // mover | flecha | pase | lanzar
  const [flechaPieza, setFlechaPieza] = useState(null);
  const [paseFrom, setPaseFrom] = useState(null);
  const [selectedFlechaId, setSelectedFlechaId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playT, setPlayT] = useState(0); // 0..1
  const [playActionIdx, setPlayActionIdx] = useState(0);
  const [playPhase, setPlayPhase] = useState('idle'); // idle | action | between
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const dragRef = useRef(null);
  const boardRef = useRef(null);
  const rafRef = useRef(null);
  const playRef = useRef({ pasoIdx: 0, actionIdx: 0, phase: 'idle' });

  useEffect(() => {
    if (isNew) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .getJugada(id)
      .then((data) => {
        if (cancelled) return;
        setState(fromApi(data));
        setPasoIdx(0);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const paso = state.pasos[pasoIdx] || state.pasos[0];
  const nextPaso = state.pasos[pasoIdx + 1];

  const posMap = useMemo(() => {
    const map = {};
    for (const p of paso?.posiciones || []) map[p.id_pieza] = p;
    return map;
  }, [paso]);

  const playSnap = useMemo(() => {
    if (!playing || !paso) return null;
    if (playPhase === 'action') {
      return snapshotPlay(paso, playActionIdx, playT);
    }
    if (playPhase === 'between') {
      const end = snapshotPlay(paso, (paso.flechas || []).length, 1);
      return end;
    }
    return null;
  }, [playing, paso, playPhase, playActionIdx, playT]);

  const displayPos = useCallback(
    (piezaId) => {
      const a = posMap[piezaId];
      if (!a) return a;
      if (!playing || !playSnap) return a;

      if (playPhase === 'action') {
        return playSnap.pos[piezaId] || a;
      }

      if (playPhase === 'between' && nextPaso) {
        const from = playSnap.pos[piezaId] || a;
        const b = nextPaso.posiciones.find((p) => p.id_pieza === piezaId) || from;
        return {
          id_pieza: piezaId,
          x: from.x + (b.x - from.x) * playT,
          y: from.y + (b.y - from.y) * playT,
        };
      }
      return playSnap.pos[piezaId] || a;
    },
    [posMap, playing, playSnap, playPhase, nextPaso, playT],
  );

  const displayBall = useMemo(() => {
    const from = ballCoords(paso, posMap);
    if (!playing || !playSnap) return from;

    if (playPhase === 'action') return playSnap.ball;

    if (playPhase === 'between' && nextPaso) {
      const nextMap = {};
      for (const p of nextPaso.posiciones || []) nextMap[p.id_pieza] = p;
      const to = ballCoords(nextPaso, nextMap);
      return {
        x: playSnap.ball.x + (to.x - playSnap.ball.x) * playT,
        y: playSnap.ball.y + (to.y - playSnap.ball.y) * playT,
      };
    }
    return playSnap.ball;
  }, [paso, posMap, playing, playSnap, playPhase, nextPaso, playT]);

  const stopPlay = () => {
    setPlaying(false);
    setPlayT(0);
    setPlayActionIdx(0);
    setPlayPhase('idle');
    playRef.current = { pasoIdx: 0, actionIdx: 0, phase: 'idle' };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const cancelPending = () => {
    setFlechaPieza(null);
    setPaseFrom(null);
    setSelectedFlechaId(null);
  };

  const removeFlecha = (flechaId) => {
    if (!flechaId || playing) return;
    stopPlay();
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

  const play = () => {
    const hasFlechas = state.pasos.some((p) => (p.flechas || []).length > 0);
    if (!hasFlechas && state.pasos.length < 2) {
      setError('Añade líneas (pase / desmarque / lanzamiento) o un segundo paso para reproducir');
      return;
    }
    setError('');
    setModo('mover');
    setFlechaPieza(null);
    setPaseFrom(null);
    setSelectedFlechaId(null);

    const ACTION_MS = 650;
    const BETWEEN_MS = 700;
    const pasos = state.pasos;
    let idx = pasoIdx;
    let actionIdx = 0;
    let phase =
      (pasos[idx]?.flechas || []).length > 0
        ? 'action'
        : idx < pasos.length - 1
          ? 'between'
          : 'idle';

    if (phase === 'idle') {
      // empezar desde el primer paso con contenido
      const startAt = pasos.findIndex(
        (p, i) => (p.flechas || []).length > 0 || i < pasos.length - 1,
      );
      if (startAt < 0) {
        setError('No hay movimientos que reproducir');
        return;
      }
      idx = startAt;
      phase = (pasos[idx]?.flechas || []).length > 0 ? 'action' : 'between';
    }

    setPasoIdx(idx);
    setPlayActionIdx(0);
    setPlayPhase(phase);
    setPlayT(0);
    setPlaying(true);
    playRef.current = { pasoIdx: idx, actionIdx: 0, phase };
    let start = performance.now();

    const tick = (now) => {
      const cur = playRef.current;
      const dur = cur.phase === 'between' ? BETWEEN_MS : ACTION_MS;
      const t = Math.min(1, (now - start) / dur);
      setPlayT(t);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const pasoCur = pasos[cur.pasoIdx];
      const flechas = pasoCur?.flechas || [];

      if (cur.phase === 'action') {
        const nextAction = cur.actionIdx + 1;
        if (nextAction < flechas.length) {
          playRef.current = { ...cur, actionIdx: nextAction, phase: 'action' };
          setPlayActionIdx(nextAction);
          setPlayT(0);
          start = performance.now();
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        // fin de líneas del paso → transición al siguiente si existe
        if (cur.pasoIdx < pasos.length - 1) {
          playRef.current = { ...cur, phase: 'between', actionIdx: flechas.length };
          setPlayPhase('between');
          setPlayActionIdx(flechas.length);
          setPlayT(0);
          start = performance.now();
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        setPlaying(false);
        setPlayPhase('idle');
        setPlayT(0);
        return;
      }

      // between terminado → avanzar paso
      const nextIdx = cur.pasoIdx + 1;
      if (nextIdx >= pasos.length) {
        setPasoIdx(pasos.length - 1);
        setPlaying(false);
        setPlayPhase('idle');
        setPlayT(0);
        return;
      }
      setPasoIdx(nextIdx);
      const nextFlechas = pasos[nextIdx]?.flechas || [];
      if (nextFlechas.length > 0) {
        playRef.current = { pasoIdx: nextIdx, actionIdx: 0, phase: 'action' };
        setPlayActionIdx(0);
        setPlayPhase('action');
        setPlayT(0);
        start = performance.now();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (nextIdx < pasos.length - 1) {
        playRef.current = { pasoIdx: nextIdx, actionIdx: 0, phase: 'between' };
        setPlayPhase('between');
        setPlayActionIdx(0);
        setPlayT(0);
        start = performance.now();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      setPasoIdx(nextIdx);
      setPlaying(false);
      setPlayPhase('idle');
      setPlayT(0);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => stopPlay(), []);

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
    if (playing) return;
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
    if (playing || !flechaPieza) return;
    if (modo !== 'flecha' && modo !== 'lanzar') return;
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
    if (playing || modo !== 'mover') return;
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
    stopPlay();
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
    if (state.pasos.length <= 1) return;
    stopPlay();
    setState((prev) => {
      const pasos = prev.pasos.filter((_, i) => i !== pasoIdx).map((p, i) => ({ ...p, orden: i }));
      return { ...prev, pasos };
    });
    setPasoIdx((i) => Math.max(0, Math.min(i, state.pasos.length - 2)));
  };

  const addPieza = () => {
    stopPlay();
    const idPieza = uid();
    setState((prev) => ({
      ...prev,
      piezas: [
        ...prev.piezas,
        {
          id_pieza: idPieza,
          etiqueta: `P${prev.piezas.length + 1}`,
          color: COLORS[prev.piezas.length % COLORS.length],
          orden: prev.piezas.length,
        },
      ],
      pasos: prev.pasos.map((p) => ({
        ...p,
        posiciones: [...p.posiciones, { id_pieza: idPieza, x: 50, y: 50 }],
      })),
    }));
  };

  const removePieza = (piezaId) => {
    stopPlay();
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

  const changeFase = (fase) => {
    if (!isNew && !window.confirm('Cambiar fase reinicia las piezas del campo. ¿Continuar?')) {
      return;
    }
    stopPlay();
    const blank = blankJugada(fase);
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

  const guardar = async () => {
    if (!state.nombre.trim()) {
      setError('Pon un nombre a la jugada');
      return;
    }
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const payload = toPayload(state);
      if (isNew) {
        const created = await api.createJugada(payload);
        setStatus('Jugada guardada');
        navigate(`/jugadas/${created.id_jugada}`, { replace: true });
      } else {
        const updated = await api.updateJugada(id, payload);
        setState(fromApi(updated));
        setStatus('Cambios guardados');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const copiar = async () => {
    if (isNew) return;
    setSaving(true);
    try {
      const copia = await api.copyJugada(id, { nombre: `${state.nombre} (copia)` });
      navigate(`/jugadas/${copia.id_jugada}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Cargando jugada…</p>;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">
            <Link to="/jugadas">JUGADAS</Link> / {isNew ? 'NUEVA' : 'EDITAR'}
          </p>
          <h1>{isNew ? 'Nueva jugada' : state.nombre || 'Jugada'}</h1>
        </div>
        <div className="add-player-actions">
          <Link to="/jugadas">
            <button type="button" className="ghost">
              Volver
            </button>
          </Link>
          {!isNew && canWriteJugadas && (
            <button type="button" className="ghost" disabled={saving} onClick={copiar}>
              Copiar
            </button>
          )}
          {canWriteJugadas && (
            <button type="button" disabled={saving} onClick={guardar}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </div>
      </header>

      {!canWriteJugadas && (
        <p className="hint">Tu cargo solo permite consultar esta jugada.</p>
      )}
      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <div className="jugada-editor-meta panel club-card">
        <div className="field">
          <label>Nombre</label>
          <input
            value={state.nombre}
            onChange={(e) => setState((s) => ({ ...s, nombre: e.target.value }))}
            placeholder="Ej. Cruce por 1.ª"
            maxLength={120}
          />
        </div>
        <div className="field">
          <label>Fase</label>
          <select value={state.fase} onChange={(e) => changeFase(e.target.value)}>
            <option value="ataque">Ataque</option>
            <option value="defensa">Defensa</option>
          </select>
        </div>
        <div className="field jugada-desc-field">
          <label>Notas</label>
          <input
            value={state.descripcion}
            onChange={(e) => setState((s) => ({ ...s, descripcion: e.target.value }))}
            placeholder="Opcional"
            maxLength={4000}
          />
        </div>
      </div>

      <div className="jugada-toolbar">
        <div className="jugada-pasos">
          {state.pasos.map((p, i) => (
            <button
              type="button"
              key={p.id_paso}
              className={`btn-seg jugada-paso-chip${i === pasoIdx ? ' active' : ''}`}
              onClick={() => {
                stopPlay();
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
        </div>
        <div className="jugada-modes btn-seg-group" role="group" aria-label="Modo de edición">
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
          {state.fase !== 'defensa' && (
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
          <button type="button" className="ghost" onClick={addPieza}>
            + Pieza
          </button>
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
          {!playing ? (
            <button type="button" className="btn-play" onClick={play}>
              ▶ Play
            </button>
          ) : (
            <button type="button" className="ghost" onClick={stopPlay}>
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {modo === 'flecha' && (
        <p className="muted jugada-hint">
          {flechaPieza
            ? 'Clic en el campo = destino del desmarque · Esc cancela'
            : 'Elige una pieza y luego el destino · Clic en una línea para seleccionarla'}
        </p>
      )}
      {modo === 'pase' && (
        <p className="muted jugada-hint">
          {paseFrom
            ? 'Ahora elige a quién pasa el balón · Esc cancela'
            : 'Elige quién tiene el balón y luego la receptora · Clic en una línea para seleccionarla'}
        </p>
      )}
      {modo === 'lanzar' && (
        <p className="muted jugada-hint">
          {flechaPieza
            ? 'Clic en el campo = destino del lanzamiento · Esc cancela'
            : 'Elige quién lanza y luego el destino · Clic en una línea para seleccionarla'}
        </p>
      )}
      {selectedFlechaId && !playing && (
        <p className="muted jugada-hint">
          Línea seleccionada ·{' '}
          <button type="button" className="linkish" onClick={() => removeFlecha(selectedFlechaId)}>
            Eliminar
          </button>
          {' · Esc deselecciona · Supr elimina'}
        </p>
      )}
      {modo === 'mover' && !selectedFlechaId && !playing && (paso?.flechas || []).length > 0 && (
        <p className="muted jugada-hint">
          Play anima todas las líneas de este paso en orden · Clic en una línea para eliminarla
        </p>
      )}
      {playing && (
        <p className="muted jugada-hint">
          Reproduciendo
          {playPhase === 'action'
            ? ` · acción ${(playActionIdx || 0) + 1}/${(paso?.flechas || []).length || 1}`
            : ' · transición al siguiente paso'}
        </p>
      )}

      <div className={`jugada-board-wrap panel club-card`}>
        <div
          ref={boardRef}
          className={`hb-court hb-court-${state.fase} jugada-board`}
          onClick={onBoardClick}
        >
          <div className="hb-court-mark hb-court-arc" aria-hidden="true" />
          <div className="hb-court-mark hb-court-goal" aria-hidden="true" />
          <span className={`hb-fase-tag hb-fase-${state.fase}`}>
            {state.fase === 'defensa' ? 'Defensa' : 'Ataque'}
          </span>

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
              const selected =
                selectedFlechaId === f.id_flecha ||
                (playing && playPhase === 'action' && fi === playActionIdx);
              const dimmed =
                playing && playPhase === 'action' && fi > playActionIdx;
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

          {state.piezas.map((pieza) => {
            const pos = displayPos(pieza.id_pieza);
            if (!pos) return null;
            const selected =
              flechaPieza === pieza.id_pieza || paseFrom === pieza.id_pieza;
            const tieneBalon =
              state.fase !== 'defensa' &&
              (playing && playSnap
                ? playSnap.ballOwner === pieza.id_pieza
                : paso?.id_pieza_balon === pieza.id_pieza);
            return (
              <div
                key={pieza.id_pieza}
                className={`jugada-pieza${selected ? ' selected' : ''}${modo === 'mover' ? ' movable' : ''}${tieneBalon ? ' has-ball' : ''}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  background: pieza.color || '#a3e635',
                }}
                onPointerDown={(e) => onPointerDownPieza(e, pieza.id_pieza)}
              >
                <strong>{pieza.etiqueta}</strong>
                {!playing && (
                  <button
                    type="button"
                    className="jugada-pieza-del"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePieza(pieza.id_pieza);
                    }}
                    aria-label="Quitar pieza"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {state.fase !== 'defensa' && (
            <div
              className={`jugada-ball${modo === 'mover' ? ' movable' : ''}`}
              style={{ left: `${displayBall.x}%`, top: `${displayBall.y}%` }}
              onPointerDown={onPointerDownBall}
              title="Balón"
            />
          )}
        </div>
      </div>
    </>
  );
}
