import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoBasura, IcoFlecha, IcoLapiz } from '../components/ActionIcons';
import SinAcceso from '../components/SinAcceso';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const COLORS = ['#a3e635', '#84cc16', '#d9f99d', '#93c5fd', '#60a5fa', '#fbbf24', '#f472b6'];
const COLOR_ATAQUE = '#ef4444';
const COLOR_DEFENSA = '#3b82f6';

function isColorAtaque(color) {
  if (!color) return true;
  const c = String(color).toLowerCase();
  if (c === COLOR_ATAQUE.toLowerCase()) return true;
  if (c === COLOR_DEFENSA.toLowerCase()) return false;
  if (c.startsWith('#') && c.length >= 7) {
    const r = parseInt(c.slice(1, 3), 16);
    const b = parseInt(c.slice(5, 7), 16);
    if (Number.isFinite(r) && Number.isFinite(b)) return r >= b;
  }
  return true;
}

/** Separa flechas por equipo (mantiene el orden de dibujo dentro de cada uno). */
function flechasPorEquipo(flechas, piezas) {
  const colorById = {};
  for (const p of piezas || []) colorById[p.id_pieza] = p.color;
  const atk = [];
  const def = [];
  for (const f of flechas || []) {
    if (isColorAtaque(colorById[f.id_pieza])) atk.push(f);
    else def.push(f);
  }
  return { atk, def };
}

function equipoPieza(pieza, fase) {
  const et = String(pieza?.etiqueta || '');
  if (et.startsWith('A-') || pieza?.color === COLOR_ATAQUE) return 'ataque';
  if (et.startsWith('D-') || pieza?.color === COLOR_DEFENSA) return 'defensa';
  return fase === 'defensa' ? 'defensa' : 'ataque';
}

function slotsEquipo(fase, ambito, equipo) {
  return defaultPiezas(fase, ambito).filter((r) => equipoPieza(r.pieza, fase) === equipo);
}

function defaultPiezas(fase, ambito = 'tactica') {
  // Campo completo: A-* atacan portería derecha; D-* la defienden (6-0).
  // Y=0 arriba. Atacante mirando a la derecha → EI arriba, ED abajo.
  const completo = [
    { etiqueta: 'A-PO', x: 4, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'A-CE', x: 22, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'A-LI', x: 28, y: 28, color: COLOR_ATAQUE },
    { etiqueta: 'A-LD', x: 28, y: 72, color: COLOR_ATAQUE },
    { etiqueta: 'A-EI', x: 40, y: 12, color: COLOR_ATAQUE },
    { etiqueta: 'A-ED', x: 40, y: 88, color: COLOR_ATAQUE },
    { etiqueta: 'A-PI', x: 46, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'D-PO', x: 96, y: 50, color: COLOR_DEFENSA },
    { etiqueta: 'D-ED', x: 82, y: 12, color: COLOR_DEFENSA },
    { etiqueta: 'D-LD', x: 78, y: 28, color: COLOR_DEFENSA },
    { etiqueta: 'D-CE', x: 74, y: 42, color: COLOR_DEFENSA },
    { etiqueta: 'D-PI', x: 74, y: 58, color: COLOR_DEFENSA },
    { etiqueta: 'D-LI', x: 78, y: 72, color: COLOR_DEFENSA },
    { etiqueta: 'D-EI', x: 82, y: 88, color: COLOR_DEFENSA },
  ];
  // Media pista horizontal: de la línea central a la portería (como la mitad derecha del campo).
  const media = [
    { etiqueta: 'A-CE', x: 10, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'A-LI', x: 22, y: 28, color: COLOR_ATAQUE },
    { etiqueta: 'A-LD', x: 22, y: 72, color: COLOR_ATAQUE },
    { etiqueta: 'A-EI', x: 36, y: 12, color: COLOR_ATAQUE },
    { etiqueta: 'A-ED', x: 36, y: 88, color: COLOR_ATAQUE },
    { etiqueta: 'A-PI', x: 58, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'D-PO', x: 92, y: 50, color: COLOR_DEFENSA },
    { etiqueta: 'D-ED', x: 74, y: 12, color: COLOR_DEFENSA },
    { etiqueta: 'D-LD', x: 68, y: 28, color: COLOR_DEFENSA },
    { etiqueta: 'D-CE', x: 62, y: 42, color: COLOR_DEFENSA },
    { etiqueta: 'D-PI', x: 62, y: 58, color: COLOR_DEFENSA },
    { etiqueta: 'D-LI', x: 68, y: 72, color: COLOR_DEFENSA },
    { etiqueta: 'D-EI', x: 74, y: 88, color: COLOR_DEFENSA },
  ];
  // Posiciones medidas del tablero ancho (portería abajo).
  // Atacantes siempre rojas, defensoras siempre azules.
  const atk = [
    { etiqueta: 'CE', x: 50, y: 25, color: COLOR_ATAQUE },
    { etiqueta: 'LD', x: 35, y: 28, color: COLOR_ATAQUE },
    { etiqueta: 'LI', x: 62, y: 29, color: COLOR_ATAQUE },
    { etiqueta: 'PI', x: 51, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'ED', x: 16, y: 83, color: COLOR_ATAQUE },
    { etiqueta: 'EI', x: 84, y: 85, color: COLOR_ATAQUE },
    { etiqueta: 'D-PO', x: 50, y: 87, color: COLOR_DEFENSA },
    { etiqueta: 'D-EI', x: 23, y: 68, color: COLOR_DEFENSA },
    { etiqueta: 'D-LI', x: 35, y: 52, color: COLOR_DEFENSA },
    { etiqueta: 'D-CE', x: 43, y: 51, color: COLOR_DEFENSA },
    { etiqueta: 'D-PI', x: 54, y: 50, color: COLOR_DEFENSA },
    { etiqueta: 'D-LD', x: 62, y: 52, color: COLOR_DEFENSA },
    { etiqueta: 'D-ED', x: 72, y: 60, color: COLOR_DEFENSA },
  ];
  const def = [
    { etiqueta: 'EI', x: 28, y: 62, color: COLOR_DEFENSA },
    { etiqueta: 'LI', x: 36, y: 53, color: COLOR_DEFENSA },
    { etiqueta: 'CE', x: 43, y: 50, color: COLOR_DEFENSA },
    { etiqueta: 'PI', x: 53, y: 49, color: COLOR_DEFENSA },
    { etiqueta: 'LD', x: 63, y: 52, color: COLOR_DEFENSA },
    { etiqueta: 'ED', x: 74, y: 63, color: COLOR_DEFENSA },
    { etiqueta: 'PO', x: 50, y: 81, color: COLOR_DEFENSA },
    { etiqueta: 'A-CE', x: 50, y: 27, color: COLOR_ATAQUE },
    { etiqueta: 'A-LD', x: 36, y: 30, color: COLOR_ATAQUE },
    { etiqueta: 'A-LI', x: 65, y: 30, color: COLOR_ATAQUE },
    { etiqueta: 'A-PI', x: 51, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'A-ED', x: 15, y: 85, color: COLOR_ATAQUE },
    { etiqueta: 'A-EI', x: 88, y: 85, color: COLOR_ATAQUE },
  ];
  let base;
  if (fase === 'completo') base = completo;
  else if (ambito === 'fisico') base = media;
  else base = fase === 'defensa' ? def : atk;
  return base.map((p, i) => {
    const id = uid();
    return {
      pieza: {
        id_pieza: id,
        etiqueta: p.etiqueta,
        color: p.color || COLORS[i % COLORS.length],
        orden: i,
      },
      pos: { id_pieza: id, x: p.x, y: p.y },
    };
  });
}

/** Entrenamiento: el campo empieza vacío; las piezas se cargan con el botón. */
function blankJugada(fase = 'ataque', ambito = 'tactica') {
  const rows = ambito === 'fisico' ? [] : defaultPiezas(fase, ambito);
  const portador =
    fase === 'defensa' && ambito !== 'fisico'
      ? rows.find((r) => r.pieza.color === COLOR_ATAQUE) ||
        rows.find((r) => String(r.pieza.etiqueta).startsWith('A-'))
      : rows[0];
  const sinBalon = !portador;
  return {
    nombre: '',
    fase,
    ambito,
    descripcion: '',
    fecha_sesion: null,
    piezas: rows.map((r) => r.pieza),
    pasos: [
      {
        id_paso: uid(),
        orden: 0,
        titulo: 'Inicio',
        posiciones: rows.map((r) => r.pos),
        flechas: [],
        balon_x: sinBalon ? null : portador.pos.x,
        balon_y: sinBalon ? null : portador.pos.y,
        id_pieza_balon: sinBalon ? null : portador.pieza.id_pieza,
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
function snapshotPlay(paso, actionIdx, t, flechasOverride) {
  const flechas = flechasOverride || paso?.flechas || [];
  const pos = {};
  for (const p of paso?.posiciones || []) {
    pos[p.id_pieza] = { id_pieza: p.id_pieza, x: p.x, y: p.y };
  }
  let ballOwner = paso?.id_pieza_balon ?? null;
  let ball = ballCoords(paso, pos);

  const apply = (f, progress) => {
    if (!f || progress <= 0) return;
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
    if (i < actionIdx) apply(flechas[i], 1);
    else if (i === actionIdx) apply(flechas[i], t);
    else break;
  }

  return { pos, ball, ballOwner };
}

/**
 * Campo completo: atacantes y defensoras avanzan en paralelo.
 * actionIdx es el índice de la acción dentro de la secuencia de CADA equipo.
 */
function snapshotPlayParallel(paso, actionIdx, t, atkFlechas, defFlechas) {
  const pos = {};
  for (const p of paso?.posiciones || []) {
    pos[p.id_pieza] = { id_pieza: p.id_pieza, x: p.x, y: p.y };
  }

  const applyMov = (list) => {
    for (let i = 0; i < list.length; i += 1) {
      const progress = i < actionIdx ? 1 : i === actionIdx ? t : 0;
      if (progress <= 0) break;
      const f = list[i];
      if ((f.tipo || 'movimiento') !== 'movimiento') continue;
      const cur = pos[f.id_pieza] || { x: f.x1, y: f.y1 };
      pos[f.id_pieza] = {
        id_pieza: f.id_pieza,
        x: cur.x + (f.x2 - cur.x) * progress,
        y: cur.y + (f.y2 - cur.y) * progress,
      };
    }
  };

  applyMov(atkFlechas || []);
  applyMov(defFlechas || []);

  let ballOwner = paso?.id_pieza_balon ?? null;
  let ball = ballCoords(paso, pos);
  if (ballOwner && pos[ballOwner]) {
    ball = { x: pos[ballOwner].x + 3.5, y: pos[ballOwner].y - 3.5 };
  }

  const applyBall = (list) => {
    for (let i = 0; i < list.length; i += 1) {
      const progress = i < actionIdx ? 1 : i === actionIdx ? t : 0;
      if (progress <= 0) break;
      const f = list[i];
      const tipo = f.tipo || 'movimiento';
      if (tipo === 'movimiento') {
        if (ballOwner === f.id_pieza && pos[f.id_pieza]) {
          ball = { x: pos[f.id_pieza].x + 3.5, y: pos[f.id_pieza].y - 3.5 };
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
    }
  };

  // Defensa primero; ataque manda en el balón si también actúa
  applyBall(defFlechas || []);
  applyBall(atkFlechas || []);

  return { pos, ball, ballOwner };
}

function fromApi(data) {
  return {
    id_jugada: data.id_jugada,
    nombre: data.nombre,
    fase: data.fase,
    ambito: data.ambito || 'tactica',
    descripcion: data.descripcion || '',
    fecha_sesion: data.fecha_sesion || null,
    piezas: (data.piezas || []).map((p) => ({ ...p })),
    pasos: (data.pasos || []).map((paso) => ({
      id_paso: paso.id_paso,
      orden: paso.orden,
      titulo: paso.titulo || '',
      balon_x: paso.balon_x ?? null,
      balon_y: paso.balon_y ?? null,
      id_pieza_balon: paso.id_pieza_balon ?? null,
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
  return {
    nombre: state.nombre.trim(),
    fase: state.fase,
    ambito: state.ambito || 'tactica',
    descripcion: state.descripcion.trim() || null,
    fecha_sesion: state.fecha_sesion || null,
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
      balon_x: paso.balon_x,
      balon_y: paso.balon_y,
      id_pieza_balon: paso.id_pieza_balon,
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

export default function JugadaEditor({ variant = 'jugada' }) {
  const isEntrenamiento = variant === 'entrenamiento';
  const basePath = isEntrenamiento ? '/preparacion/entrenamiento' : '/jugadas';
  const { id } = useParams();
  const isNew = !id || id === 'nueva';
  const navigate = useNavigate();
  const location = useLocation();
  const { canWriteJugadas, canWriteFisico, canRead } = useAuth();
  const mayWrite = isEntrenamiento ? canWriteFisico : canWriteJugadas;
  const editing = mayWrite && (isNew || location.pathname.endsWith('/editar'));
  const canWrite = editing;

  const [state, setState] = useState(() =>
    blankJugada('ataque', isEntrenamiento ? 'fisico' : 'tactica'),
  );
  const [pasoIdx, setPasoIdx] = useState(0);
  const [modo, setModo] = useState('mover'); // mover | flecha | pase | lanzar
  const [flechaPieza, setFlechaPieza] = useState(null);
  const [paseFrom, setPaseFrom] = useState(null);
  const [selectedFlechaId, setSelectedFlechaId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playT, setPlayT] = useState(0); // 0..1
  const [playActionIdx, setPlayActionIdx] = useState(0);
  const [playPhase, setPlayPhase] = useState('idle'); // idle | action | between
  const [frozenSnap, setFrozenSnap] = useState(null); // posición final tras Play
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
  const esCompleto = state.fase === 'completo';
  // Entrenamiento en media pista: misma vista horizontal que el completo, solo mitad.
  const esMediaPista = isEntrenamiento && !esCompleto;
  const esCampoHorizontal = esCompleto || esMediaPista;
  const cupo = useMemo(() => {
    const usadas = (equipo) =>
      new Set(
        state.piezas
          .filter((p) => equipoPieza(p, state.fase) === equipo)
          .map((p) => p.etiqueta),
      );
    const atk = usadas('ataque');
    const def = usadas('defensa');
    return {
      puedeAtk: slotsEquipo(state.fase, state.ambito, 'ataque').some(
        (r) => !atk.has(r.pieza.etiqueta),
      ),
      puedeDef: slotsEquipo(state.fase, state.ambito, 'defensa').some(
        (r) => !def.has(r.pieza.etiqueta),
      ),
    };
  }, [state.fase, state.ambito, state.piezas]);

  const playTracks = useMemo(() => {
    if (!paso) return { atk: [], def: [], max: 0, flat: [] };
    if (esCampoHorizontal) {
      const { atk, def } = flechasPorEquipo(paso.flechas, state.piezas);
      return { atk, def, max: Math.max(atk.length, def.length), flat: [...atk, ...def] };
    }
    const flat = paso.flechas || [];
    return { atk: flat, def: [], max: flat.length, flat };
  }, [paso, esCampoHorizontal, state.piezas]);

  const posMap = useMemo(() => {
    const map = {};
    for (const p of paso?.posiciones || []) map[p.id_pieza] = p;
    return map;
  }, [paso]);

  const playSnap = useMemo(() => {
    if (!playing || !paso) return null;
    if (playPhase === 'action') {
      if (esCampoHorizontal) {
        return snapshotPlayParallel(paso, playActionIdx, playT, playTracks.atk, playTracks.def);
      }
      return snapshotPlay(paso, playActionIdx, playT, playTracks.flat);
    }
    if (playPhase === 'between') {
      if (esCampoHorizontal) {
        return snapshotPlayParallel(
          paso,
          playTracks.max,
          1,
          playTracks.atk,
          playTracks.def,
        );
      }
      return snapshotPlay(paso, playTracks.flat.length, 1, playTracks.flat);
    }
    return null;
  }, [playing, paso, playPhase, playActionIdx, playT, playTracks, esCampoHorizontal]);

  const displayPos = useCallback(
    (piezaId) => {
      const a = posMap[piezaId];
      if (!a) return a;

      if (!playing && frozenSnap?.pos?.[piezaId]) {
        return frozenSnap.pos[piezaId];
      }

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
    [posMap, playing, playSnap, playPhase, nextPaso, playT, frozenSnap],
  );

  const displayBall = useMemo(() => {
    const from = ballCoords(paso, posMap);
    if (!playing && frozenSnap?.ball) return frozenSnap.ball;
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
  }, [paso, posMap, playing, playSnap, playPhase, nextPaso, playT, frozenSnap]);

  const stopPlay = () => {
    setPlaying(false);
    setPlayT(0);
    setPlayActionIdx(0);
    setPlayPhase('idle');
    playRef.current = { pasoIdx: 0, actionIdx: 0, phase: 'idle' };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const clearFrozen = () => setFrozenSnap(null);

  const cancelPending = () => {
    setFlechaPieza(null);
    setPaseFrom(null);
    setSelectedFlechaId(null);
  };

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
    clearFrozen();

    const ACTION_MS = 650;
    const BETWEEN_MS = 700;
    const pasos = state.pasos;
    const piezas = state.piezas;
    const paralelo = state.fase === 'completo' || state.ambito === 'fisico';

    const maxAcciones = (p) => {
      if (!paralelo) return (p?.flechas || []).length;
      const { atk, def } = flechasPorEquipo(p?.flechas, piezas);
      return Math.max(atk.length, def.length);
    };

    const snapFinalDe = (p) => {
      if (!p) return null;
      if (paralelo) {
        const { atk, def } = flechasPorEquipo(p.flechas, piezas);
        return snapshotPlayParallel(p, Math.max(atk.length, def.length), 1, atk, def);
      }
      const flechas = p.flechas || [];
      return snapshotPlay(p, flechas.length, 1, flechas);
    };

    const finishPlay = (finalIdx) => {
      const last = Math.max(0, Math.min(finalIdx, pasos.length - 1));
      const snap = snapFinalDe(pasos[last]);
      setPasoIdx(last);
      setFrozenSnap(snap);
      setPlaying(false);
      setPlayPhase('idle');
      setPlayT(0);
      setPlayActionIdx(0);
      playRef.current = { pasoIdx: last, actionIdx: 0, phase: 'idle' };
    };

    // Siempre reproducir desde el principio hasta el último paso
    let idx = 0;
    let phase =
      maxAcciones(pasos[0]) > 0
        ? 'action'
        : pasos.length > 1
          ? 'between'
          : 'idle';

    if (phase === 'idle') {
      setError('No hay movimientos que reproducir');
      return;
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
      const nAcciones = maxAcciones(pasoCur);

      if (cur.phase === 'action') {
        const nextAction = cur.actionIdx + 1;
        if (nextAction < nAcciones) {
          playRef.current = { ...cur, actionIdx: nextAction, phase: 'action' };
          setPlayActionIdx(nextAction);
          setPlayT(0);
          start = performance.now();
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (cur.pasoIdx < pasos.length - 1) {
          playRef.current = { ...cur, phase: 'between', actionIdx: nAcciones };
          setPlayPhase('between');
          setPlayActionIdx(nAcciones);
          setPlayT(0);
          start = performance.now();
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        finishPlay(cur.pasoIdx);
        return;
      }

      const nextIdx = cur.pasoIdx + 1;
      if (nextIdx >= pasos.length) {
        finishPlay(pasos.length - 1);
        return;
      }
      setPasoIdx(nextIdx);
      const nextN = maxAcciones(pasos[nextIdx]);
      if (nextN > 0) {
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
      finishPlay(nextIdx);
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

  const guardar = async () => {
    if (!state.nombre.trim()) {
      setError(isEntrenamiento ? 'Pon un nombre al entrenamiento' : 'Pon un nombre a la jugada');
      return;
    }
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const payload = toPayload(state);
      if (isNew) {
        const created = await api.createJugada(payload);
        setStatus(isEntrenamiento ? 'Entrenamiento guardado' : 'Jugada guardada');
        navigate(`${basePath}/${created.id_jugada}/editar`, { replace: true });
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
    if (isNew || !mayWrite) return;
    setSaving(true);
    try {
      const copia = await api.copyJugada(id, { nombre: `${state.nombre} (copia)` });
      navigate(`${basePath}/${copia.id_jugada}/editar`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportarPng = () => {
    const el = boardRef.current;
    if (!el) {
      setError('No hay campo para exportar');
      return;
    }
    const w = Math.max(640, el.clientWidth || 800);
    const h = Math.max(360, el.clientHeight || 450);
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#1b5e3b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    const labelFase =
      state.fase === 'completo'
        ? 'Campo completo'
        : state.ambito === 'fisico' && state.fase === 'ataque'
          ? 'Media pista'
          : state.fase === 'defensa'
            ? 'Defensa'
            : 'Ataque';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 15px system-ui,sans-serif';
    ctx.fillText(state.nombre || (isEntrenamiento ? 'Entrenamiento' : 'Jugada'), 18, 32);
    ctx.font = '500 12px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(labelFase, 18, 50);

    const px = (x) => (Number(x) / 100) * w;
    const py = (y) => (Number(y) / 100) * h;

    for (const f of paso?.flechas || []) {
      const tipo = f.tipo || 'movimiento';
      ctx.beginPath();
      ctx.moveTo(px(f.x1), py(f.y1));
      ctx.lineTo(px(f.x2), py(f.y2));
      ctx.strokeStyle =
        tipo === 'lanzamiento' ? '#fbbf24' : tipo === 'pase' ? '#38bdf8' : '#f8fafc';
      ctx.lineWidth = tipo === 'pase' ? 2 : 2.5;
      if (tipo === 'pase') ctx.setLineDash([6, 5]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(py(f.y2) - py(f.y1), px(f.x2) - px(f.x1));
      const ah = 9;
      ctx.beginPath();
      ctx.moveTo(px(f.x2), py(f.y2));
      ctx.lineTo(
        px(f.x2) - ah * Math.cos(ang - 0.4),
        py(f.y2) - ah * Math.sin(ang - 0.4),
      );
      ctx.lineTo(
        px(f.x2) - ah * Math.cos(ang + 0.4),
        py(f.y2) - ah * Math.sin(ang + 0.4),
      );
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }

    for (const pieza of state.piezas) {
      const pos = displayPos(pieza.id_pieza);
      if (!pos) continue;
      const x = px(pos.x);
      const y = py(pos.y);
      const r = Math.max(14, Math.min(w, h) * 0.028);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = pieza.color || '#a3e635';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 ${Math.max(9, r * 0.7)}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(pieza.etiqueta || '').slice(0, 5), x, y);
    }

    if (displayBall && displayBall.x != null) {
      const bx = px(displayBall.x);
      const by = py(displayBall.y);
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const safe = (state.nombre || (isEntrenamiento ? 'entrenamiento' : 'jugada'))
      .trim()
      .replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/gi, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    const a = document.createElement('a');
    a.download = `${safe || 'jugada'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    setStatus('Imagen descargada');
  };

  if (loading) {
    return (
      <p className="muted" style={{ padding: '2rem' }}>
        {isEntrenamiento ? 'Cargando entrenamiento…' : 'Cargando jugada…'}
      </p>
    );
  }

  const faseLabel = esCompleto
    ? 'Campo completo'
    : esMediaPista
      ? 'Media pista'
      : state.fase === 'defensa'
        ? 'Defensa'
        : 'Ataque';

  const botonesEquipo = (
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

  if (!isEntrenamiento && !canRead('jugadas')) {
    return <SinAcceso que="las jugadas" />;
  }
  if (isNew && !mayWrite) {
    return <Navigate to={basePath} replace />;
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">
            {isEntrenamiento ? 'ENTRENAMIENTOS' : 'JUGADAS'}
            {' · '}
            {isNew ? 'NUEVA' : editing ? 'EDITAR' : 'VER'}
          </p>
          <h1>
            {isNew
              ? isEntrenamiento
                ? 'Nuevo entrenamiento'
                : 'Nueva jugada'
              : state.nombre || (isEntrenamiento ? 'Entrenamiento' : 'Jugada')}
          </h1>
        </div>
        <Link className="page-back" to={basePath}>
          <button type="button" className="ghost">
            <IcoFlecha />
            Volver
          </button>
        </Link>
        <div className="add-player-actions">
          <button type="button" className="ghost" onClick={exportarPng} title="Descargar imagen PNG">
            Exportar PNG
          </button>
          {mayWrite && !editing && !isNew && (
            <Link
              to={`${basePath}/${id}/editar`}
              className="btn-icon-edit"
              title="Editar"
              aria-label="Editar"
            >
              <IcoLapiz />
            </Link>
          )}
          {!isNew && mayWrite && (
            <button type="button" className="ghost" disabled={saving} onClick={copiar}>
              Copiar
            </button>
          )}
          {canWrite && (
            <button type="button" disabled={saving} onClick={guardar}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </div>
      </header>

      {!mayWrite && (
        <p className="hint">
          Tu cargo solo permite consultar {isEntrenamiento ? 'este entrenamiento' : 'esta jugada'}.
          Usa Play para reproducir los pasos.
        </p>
      )}
      {mayWrite && !editing && !isNew && (
        <p className="hint">
          Modo reproducción. Usa Play para ver la secuencia o Editar para cambiarla.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <div className="jugada-editor-meta panel club-card">
        <div className="field">
          <label>Nombre</label>
          <input
            value={state.nombre}
            onChange={(e) => setState((s) => ({ ...s, nombre: e.target.value }))}
            placeholder={
              isEntrenamiento ? 'Ej. Posesión 4×4 o cruce en media pista' : 'Ej. Cruce por 1.ª'
            }
            maxLength={120}
          />
        </div>
        <div className="field">
          <label>{isEntrenamiento ? 'Campo' : 'Fase'}</label>
          <select
            value={state.fase}
            onChange={(e) => changeFase(e.target.value)}
            disabled={!canWrite}
          >
            {isEntrenamiento ? (
              <>
                <option value="ataque">Media pista</option>
                <option value="completo">Campo completo</option>
              </>
            ) : (
              <>
                <option value="ataque">Ataque</option>
                <option value="defensa">Defensa</option>
              </>
            )}
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
        <div className="jugada-toolbar-row">
          <div className="jugada-tool-group jugada-pasos" aria-label="Pasos">
            <span className="jugada-tool-label">Pasos</span>
            {state.pasos.map((p, i) => (
              <button
                type="button"
                key={p.id_paso}
                className={`btn-seg jugada-paso-chip${i === pasoIdx ? ' active' : ''}`}
                onClick={() => {
                  stopPlay();
                  clearFrozen();
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
            {canWrite && (
              <>
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
              </>
            )}
            {!playing ? (
              <button type="button" className="btn-play" onClick={play}>
                ▶ Play
              </button>
            ) : (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  stopPlay();
                  clearFrozen();
                }}
              >
                ■ Stop
              </button>
            )}
          </div>
        </div>

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

      <div
        className={`jugada-board-wrap panel club-card${esCampoHorizontal ? ' jugada-board-wrap-full' : ''}`}
      >
        <div
          ref={boardRef}
          className={`hb-court ${esMediaPista ? 'hb-court-media' : `hb-court-${state.fase}`} jugada-board${esCampoHorizontal ? ' jugada-board-full' : ''}${esMediaPista ? ' jugada-board-media' : ''}`}
          onClick={onBoardClick}
        >
          {esCompleto ? (
            <>
              <div className="hb-full-mark hb-full-border" aria-hidden="true" />
              <div className="hb-full-mark hb-full-center-line" aria-hidden="true" />
              <div className="hb-full-mark hb-full-center-circle" aria-hidden="true" />
              <div className="hb-full-mark hb-full-goal hb-full-goal-l" aria-hidden="true" />
              <div className="hb-full-mark hb-full-goal hb-full-goal-r" aria-hidden="true" />
              <div className="hb-full-mark hb-full-arc hb-full-arc-l" aria-hidden="true" />
              <div className="hb-full-mark hb-full-arc hb-full-arc-r" aria-hidden="true" />
              <div className="hb-full-mark hb-full-6m hb-full-6m-l" aria-hidden="true" />
              <div className="hb-full-mark hb-full-6m hb-full-6m-r" aria-hidden="true" />
            </>
          ) : esMediaPista ? (
            <>
              <div className="hb-full-mark hb-full-border" aria-hidden="true" />
              <div className="hb-full-mark hb-half-center-line" aria-hidden="true" />
              <div className="hb-full-mark hb-half-center-circle" aria-hidden="true" />
              <div className="hb-full-mark hb-full-goal hb-full-goal-r" aria-hidden="true" />
              <div className="hb-full-mark hb-full-arc hb-full-arc-r" aria-hidden="true" />
              <div className="hb-full-mark hb-full-6m hb-full-6m-r" aria-hidden="true" />
            </>
          ) : (
            <svg
              className="hb-court-marks-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* Portería abajo, tablero ancho: 9 m (discontinua) y 6 m */}
              <path
                className="hb-court-line hb-court-line-9m"
                d="M 8 98 Q 8 42 50 42 Q 92 42 92 98"
                fill="none"
              />
              <path
                className="hb-court-line hb-court-line-6m"
                d="M 22 98 Q 22 58 50 58 Q 78 58 78 98"
                fill="none"
              />
              <rect className="hb-court-line-goal" x="38" y="96.2" width="24" height="2.6" rx="0.4" />
            </svg>
          )}
          <span className={`hb-fase-tag ${esMediaPista ? 'hb-fase-ataque' : `hb-fase-${state.fase}`}`}>
            {faseLabel}
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
        </div>
      </div>
    </>
  );
}
