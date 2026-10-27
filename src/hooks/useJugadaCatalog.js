import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

/**
 * Estado compartido del listado de jugadas (táctica) y entrenamientos (físico).
 *
 * @param {object} opts
 * @param {'tactica'|'fisico'} opts.ambito
 * @param {string} [opts.fase] filtro opcional de fase
 * @param {boolean} [opts.canWrite] permite copiar/borrar
 * @param {string} [opts.labelSingular] 'jugada' | 'entrenamiento' (mensajes de confirmación)
 * @param {boolean} [opts.enabled] si es false no se carga nada
 */
export function useJugadaCatalog({
  ambito,
  fase = '',
  canWrite = false,
  labelSingular = 'jugada',
  enabled = true,
}) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const params = useMemo(() => (fase ? { fase, ambito } : { ambito }), [fase, ambito]);

  const load = useCallback(
    () => api.getJugadas(params).then(setItems).catch((e) => setError(e.message)),
    [params],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    api
      .getJugadas(params)
      .then((all) => {
        if (!cancelled) setItems(all);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [params, enabled]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    const incluyeFase = ambito === 'tactica';
    return items.filter((j) => {
      const hay = `${j.nombre || ''} ${j.descripcion || ''}${
        incluyeFase ? ` ${j.fase || ''}` : ''
      }`.toLowerCase();
      return hay.includes(term);
    });
  }, [items, q, ambito]);

  const femenino = labelSingular.endsWith('a');
  const articulo = femenino ? 'la' : 'el';
  const eliminado = `${labelSingular.charAt(0).toUpperCase()}${labelSingular.slice(1)} ${
    femenino ? 'eliminada' : 'eliminado'
  }`;

  const copiar = async (j) => {
    if (!canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api.copyJugada(j.id_jugada);
      setStatus('Copia creada');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (j) => {
    if (!canWrite) return;
    if (!window.confirm(`¿Eliminar ${articulo} ${labelSingular} «${j.nombre}»?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteJugada(j.id_jugada);
      setStatus(eliminado);
      setItems((prev) => prev.filter((x) => x.id_jugada !== j.id_jugada));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return { items, q, setQ, error, status, busy, filtrados, load, copiar, borrar };
}
