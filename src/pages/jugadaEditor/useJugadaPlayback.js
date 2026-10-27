import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flechasPorEquipo } from './utils';
import { ballCoords, snapshotPlay, snapshotPlayParallel } from './playback';

/** Reproducción animada (Play) y posiciones mostradas en el campo. */
export function useJugadaPlayback({
  state,
  paso,
  nextPaso,
  posMap,
  playTracks,
  esCampoHorizontal,
  setPasoIdx,
  setError,
  setModo,
  setFlechaPieza,
  setPaseFrom,
  setSelectedFlechaId,
}) {
  const [playing, setPlaying] = useState(false);
  const [playT, setPlayT] = useState(0); // 0..1
  const [playActionIdx, setPlayActionIdx] = useState(0);
  const [playPhase, setPlayPhase] = useState('idle'); // idle | action | between
  const [frozenSnap, setFrozenSnap] = useState(null); // posición final tras Play
  const rafRef = useRef(null);
  const playRef = useRef({ pasoIdx: 0, actionIdx: 0, phase: 'idle' });

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

  return {
    playing,
    playT,
    playActionIdx,
    playPhase,
    frozenSnap,
    playSnap,
    displayPos,
    displayBall,
    stopPlay,
    clearFrozen,
    play,
  };
}
