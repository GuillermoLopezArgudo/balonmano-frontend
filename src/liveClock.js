/** Reloj de partido en directo (persistido entre pantallas). */

export const HALF_MINUTES = 30;
export const HALF_SEC = HALF_MINUTES * 60;

const ACTIVE_KEY = 'siete:directo-active';
const EVENT = 'siete:live-clock';

export function clockStorageKey(partidoId) {
  return `siete:directo-clock:${partidoId}`;
}

export function fmtClock(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function loadClock(partidoId) {
  if (!partidoId) return { parte: 1, elapsedSec: 0, running: false };
  try {
    const raw = localStorage.getItem(clockStorageKey(partidoId));
    if (!raw) return { parte: 1, elapsedSec: 0, running: false };
    const data = JSON.parse(raw);
    let elapsed = Math.max(0, Number(data.elapsedSec) || 0);
    let running = Boolean(data.running);
    const parte = data.parte === 2 ? 2 : 1;
    if (running && data.updatedAt) {
      const delta = Math.floor((Date.now() - Number(data.updatedAt)) / 1000);
      if (delta > 0) elapsed += delta;
    }
    if (elapsed >= HALF_SEC) {
      elapsed = HALF_SEC;
      running = false;
    }
    return { parte, elapsedSec: elapsed, running };
  } catch {
    return { parte: 1, elapsedSec: 0, running: false };
  }
}

export function saveClock(partidoId, { parte, elapsedSec, running }) {
  if (!partidoId) return;
  try {
    localStorage.setItem(
      clockStorageKey(partidoId),
      JSON.stringify({
        parte,
        elapsedSec: Math.min(HALF_SEC, Math.max(0, elapsedSec)),
        running,
        updatedAt: Date.now(),
      }),
    );
    notifyLiveClock();
  } catch {
    /* ignore quota */
  }
}

export function getActiveLive() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.id_partido) return null;
    return data;
  } catch {
    return null;
  }
}

export function setActiveLive(meta) {
  if (!meta?.id_partido) return;
  try {
    localStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify({
        id_partido: meta.id_partido,
        local: meta.local || 'Local',
        visitante: meta.visitante || 'Visitante',
        goles_local: Number(meta.goles_local) || 0,
        goles_visitante: Number(meta.goles_visitante) || 0,
      }),
    );
    notifyLiveClock();
  } catch {
    /* ignore */
  }
}

export function clearActiveLive() {
  try {
    localStorage.removeItem(ACTIVE_KEY);
    notifyLiveClock();
  } catch {
    /* ignore */
  }
}

/** Quita el banner si el partido cerrado es el que estaba en directo. */
export function clearActiveLiveIfPartido(idPartido) {
  if (!idPartido) return;
  const active = getActiveLive();
  if (active && String(active.id_partido) === String(idPartido)) {
    clearActiveLive();
  }
}

export function notifyLiveClock() {
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeLiveClock(cb) {
  const onCustom = () => cb();
  const onStorage = (e) => {
    if (
      !e.key ||
      e.key === ACTIVE_KEY ||
      e.key.startsWith('siete:directo-clock:')
    ) {
      cb();
    }
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/** ¿Hay un partido con reloj activo para mostrar el banner? */
export function liveBannerState() {
  const active = getActiveLive();
  if (!active?.id_partido) return null;
  const clock = loadClock(active.id_partido);
  if (!clock.running && clock.elapsedSec <= 0 && clock.parte === 1) return null;
  const remaining = Math.max(0, HALF_SEC - clock.elapsedSec);
  return {
    ...active,
    ...clock,
    remaining,
    labelParte: clock.parte === 1 ? '1ª' : '2ª',
  };
}
