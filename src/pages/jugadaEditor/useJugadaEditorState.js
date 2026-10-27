import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import {
  blankJugada,
  equipoPieza,
  flechasPorEquipo,
  fromApi,
  slotsEquipo,
  toPayload,
} from './utils';

/** Carga, guardado, copia y datos derivados del paso actual. */
export function useJugadaEditorState({ id, isNew, isEntrenamiento, basePath, mayWrite }) {
  const navigate = useNavigate();
  const [state, setState] = useState(() =>
    blankJugada('ataque', isEntrenamiento ? 'fisico' : 'tactica'),
  );
  const [pasoIdx, setPasoIdx] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

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
      const copia = await api.copyJugada(id);
      navigate(`${basePath}/${copia.id_jugada}/editar`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return {
    state,
    setState,
    pasoIdx,
    setPasoIdx,
    error,
    setError,
    status,
    setStatus,
    saving,
    loading,
    paso,
    nextPaso,
    esCompleto,
    esMediaPista,
    esCampoHorizontal,
    cupo,
    playTracks,
    posMap,
    guardar,
    copiar,
  };
}
