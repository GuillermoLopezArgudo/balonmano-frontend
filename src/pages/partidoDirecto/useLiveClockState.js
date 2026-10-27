import { useEffect, useRef, useState } from 'react';
import { HALF_SEC, loadClock, saveClock, setActiveLive } from '../../liveClock';

/** Reloj de la parte: restaurar/persistir en localStorage y tick de 1 s. */
export default function useLiveClockState({ partidoId, partido, score }) {
  const [parte, setParte] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [clockForId, setClockForId] = useState(null);
  const tickRef = useRef(null);

  // Restaurar reloj del partido (no reiniciar al entrar)
  useEffect(() => {
    if (!partidoId) {
      setClockForId(null);
      return;
    }
    const clock = loadClock(partidoId);
    setParte(clock.parte);
    setSeconds(clock.elapsedSec);
    setRunning(clock.running);
    setClockForId(partidoId);
  }, [partidoId]);

  // Persistir reloj (solo cuando el estado ya corresponde a este partido)
  useEffect(() => {
    if (!partidoId || clockForId !== partidoId) return;
    saveClock(partidoId, { parte, elapsedSec: seconds, running });
    if (partido) {
      setActiveLive({
        id_partido: partidoId,
        local: partido.equipo_local_nombre,
        visitante: partido.equipo_visitante_nombre,
        goles_local: score.local,
        goles_visitante: score.visitante,
      });
    }
  }, [partidoId, clockForId, parte, seconds, running, partido, score]);

  useEffect(() => {
    if (!running) return undefined;
    tickRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s >= HALF_SEC - 1) {
          setRunning(false);
          return HALF_SEC;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const remaining = Math.max(0, HALF_SEC - seconds);
  const minuto = Math.min(60, Math.floor(seconds / 60) + (parte === 2 ? 30 : 0));
  const segundo = seconds % 60;

  return {
    parte,
    setParte,
    seconds,
    setSeconds,
    running,
    setRunning,
    remaining,
    minuto,
    segundo,
  };
}
