import { useEffect } from 'react';
import { isAbortError } from './api';

/**
 * Ejecuta un cargador cancelable al montar / al cambiar deps.
 * Al desmontar (o al re-ejecutar) aborta el fetch y evita setState.
 *
 * @param {(ctx: { signal: AbortSignal, alive: () => boolean }) => void | Promise<void>} loader
 * @param {unknown[]} [deps]
 */
export function useAbortable(loader, deps = []) {
  useEffect(() => {
    const ac = new AbortController();
    let alive = true;

    Promise.resolve(loader({ signal: ac.signal, alive: () => alive })).catch((err) => {
      if (!alive || isAbortError(err) || ac.signal.aborted) return;
      // El loader debería manejar errores; si no, no tumbar la app.
      console.error(err);
    });

    return () => {
      alive = false;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns deps
  }, deps);
}
