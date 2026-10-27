import { useState } from 'react';
import { usePointerDnD } from '../../components/CampoAlineacion';
import {
  DND_TYPE,
  MAX_ATAQUE,
  MAX_CONV,
  MAX_TIT,
  MSG_SIN_FEDERACION,
  ZONA_ATAQUE_IDS,
  ZONA_IDS,
  clearJugadorDeMapa,
  syncRolTrasZonas,
} from './utils';

/**
 * Estado de zonas de alineación + drag/drop y mutaciones de selección.
 * `selected` / `setSelected` viven en la página (se cargan desde el servidor/borrador).
 */
export default function useConvocatoriaDnD({
  tab,
  fase,
  esCampo,
  selected,
  setSelected,
  setError,
  byId,
  puedeConvocarPorEstado,
  errorDisponibilidad,
  tieneFederacion,
}) {
  const [zonasAtaque, setZonasAtaque] = useState({});
  const [zonasDefensa, setZonasDefensa] = useState({});
  const [dragId, setDragId] = useState(null);
  const [dropZone, setDropZone] = useState(null);

  const zonasActivas = fase === 'defensa' ? zonasDefensa : zonasAtaque;
  const setZonasActivas = fase === 'defensa' ? setZonasDefensa : setZonasAtaque;

  const roleForTab = () => {
    if (esCampo) return 'titular';
    if (tab === 'banquillo') return 'banquillo';
    return 'convocado';
  };

  const removeFromZonas = (jid) => {
    setZonasAtaque((z) => clearJugadorDeMapa(z, jid));
    setZonasDefensa((z) => clearJugadorDeMapa(z, jid));
  };

  const toggleConvocado = (jid) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[jid]) {
        delete next[jid];
        removeFromZonas(jid);
      } else {
        if (!puedeConvocarPorEstado(jid)) {
          setError(errorDisponibilidad(jid));
          return prev;
        }
        if (!tieneFederacion(jid)) {
          setError(MSG_SIN_FEDERACION);
          return prev;
        }
        if (Object.keys(next).length >= MAX_CONV) {
          setError(`Máximo ${MAX_CONV} convocados`);
          return prev;
        }
        next[jid] = 'convocado';
        setError('');
      }
      return next;
    });
  };

  const setRol = (jid, rol) => {
    setSelected((prev) => {
      if (!prev[jid]) return prev;
      if (rol !== 'titular') {
        removeFromZonas(jid);
      }
      setError('');
      return { ...prev, [jid]: rol };
    });
  };

  const applySelectionChange = (updater) => {
    setSelected((prev) => {
      const result = updater(prev);
      if (result === prev) return prev;
      setError('');
      return result;
    });
  };

  const assignPlayer = (jid, rol, beforeId = null) => {
    applySelectionChange((prev) => {
      const already = Boolean(prev[jid]);

      if ((rol === 'titular' || rol === 'banquillo') && !already) {
        setError('Solo jugadoras convocadas pueden ir a alineación o banquillo');
        return prev;
      }

      if (!already && !puedeConvocarPorEstado(jid)) {
        setError(errorDisponibilidad(jid));
        return prev;
      }

      if (!already && !tieneFederacion(jid)) {
        setError(MSG_SIN_FEDERACION);
        return prev;
      }

      if (!already && Object.keys(prev).length >= MAX_CONV) {
        setError(`Máximo ${MAX_CONV} convocados`);
        return prev;
      }

      if (rol !== 'titular') {
        removeFromZonas(jid);
      }

      const keys = Object.keys(prev).filter((k) => k !== jid);
      if (beforeId && keys.includes(beforeId)) {
        keys.splice(keys.indexOf(beforeId), 0, jid);
      } else {
        keys.push(jid);
      }

      const next = {};
      for (const k of keys) next[k] = k === jid ? rol : prev[k];
      return next;
    });
  };

  const removePlayer = (jid) => {
    applySelectionChange((prev) => {
      if (!prev[jid]) return prev;
      const next = { ...prev };
      delete next[jid];
      return next;
    });
    removeFromZonas(jid);
  };

  const reorderSelected = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    applySelectionChange((prev) => {
      const keys = Object.keys(prev);
      const fromIdx = keys.indexOf(fromId);
      const toIdx = keys.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const nextKeys = [...keys];
      nextKeys.splice(fromIdx, 1);
      nextKeys.splice(toIdx, 0, fromId);
      const next = {};
      for (const k of nextKeys) next[k] = prev[k];
      return next;
    });
  };

  const placeInZone = (jid, zonaId) => {
    if (!fase) return;
    const idsOk = fase === 'ataque' ? ZONA_ATAQUE_IDS : ZONA_IDS;
    if (!idsOk.has(zonaId)) return;
    if (fase === 'ataque' && zonaId === 'portero') return;

    setSelected((prev) => {
      if (!prev[jid]) {
        setError('Solo jugadoras convocadas pueden entrar en alineación');
        return prev;
      }

      const currentMap = fase === 'defensa' ? zonasDefensa : zonasAtaque;
      const otherMap = fase === 'defensa' ? zonasAtaque : zonasDefensa;
      const occupant = currentMap[zonaId] && currentMap[zonaId] !== jid ? currentMap[zonaId] : null;
      const jidYaEnFase = Object.values(currentMap).includes(jid);
      const maxFase = fase === 'ataque' ? MAX_ATAQUE : MAX_TIT;

      let nEnFase = Object.keys(currentMap).length;
      if (!jidYaEnFase && !currentMap[zonaId]) nEnFase += 1;
      if (nEnFase > maxFase) {
        setError(`Máximo ${maxFase} en alineación de ${fase}`);
        return prev;
      }

      const nextMap = clearJugadorDeMapa(currentMap, jid);
      nextMap[zonaId] = jid;

      let nextOther = otherMap;
      let nextSelected = { ...prev, [jid]: 'titular' };
      if (occupant) {
        const stillOther = Object.values(otherMap).includes(occupant);
        nextSelected[occupant] = stillOther ? 'titular' : 'banquillo';
      }

      if (fase === 'defensa') {
        setZonasDefensa(nextMap);
        nextSelected = syncRolTrasZonas(jid, nextOther, nextMap, nextSelected);
      } else {
        setZonasAtaque(nextMap);
        nextSelected = syncRolTrasZonas(jid, nextMap, nextOther, nextSelected);
      }

      setError('');
      return nextSelected;
    });
  };

  const clearZone = (zonaId) => {
    if (!fase) return;
    const jid = zonasActivas[zonaId];
    if (!jid) return;

    const nextMap = { ...zonasActivas };
    delete nextMap[zonaId];
    setZonasActivas(nextMap);

    setSelected((prev) => {
      if (!prev[jid]) return prev;
      const other = fase === 'defensa' ? zonasAtaque : zonasDefensa;
      if (Object.values(other).includes(jid)) {
        return { ...prev, [jid]: 'titular' };
      }
      return { ...prev, [jid]: 'banquillo' };
    });
  };

  const onDragStart = (e, jid) => {
    if (tab === 'convocatoria' && !selected[jid] && !puedeConvocarPorEstado(jid)) {
      e.preventDefault();
      setError(errorDisponibilidad(jid));
      return;
    }
    if (tab === 'convocatoria' && !selected[jid] && !tieneFederacion(jid)) {
      e.preventDefault();
      setError(MSG_SIN_FEDERACION);
      return;
    }
    e.dataTransfer.setData(DND_TYPE, jid);
    e.dataTransfer.setData('text/plain', jid);
    e.dataTransfer.effectAllowed = 'move';
    setDragId(jid);
  };

  const onDragEnd = () => {
    setDragId(null);
    setDropZone(null);
  };

  const readDragId = (e) =>
    e.dataTransfer.getData(DND_TYPE) || e.dataTransfer.getData('text/plain') || dragId;

  const applyDrop = (target, jid) => {
    if (!jid || !target) {
      onDragEnd();
      return;
    }
    if (target === 'plantilla') {
      if (esCampo) {
        const nextMap = clearJugadorDeMapa(zonasActivas, jid);
        setZonasActivas(nextMap);
        setSelected((prev) => {
          if (!prev[jid]) return prev;
          const other = fase === 'defensa' ? zonasAtaque : zonasDefensa;
          if (Object.values(other).includes(jid)) return { ...prev, [jid]: 'titular' };
          return { ...prev, [jid]: 'banquillo' };
        });
      } else if (tab === 'banquillo') {
        setRol(jid, 'convocado');
      } else {
        removePlayer(jid);
      }
    } else if (target === 'seleccion') {
      assignPlayer(jid, roleForTab());
    } else if (target.startsWith('zona:')) {
      placeInZone(jid, target.slice(5));
    } else if (target.startsWith('row:')) {
      const targetId = target.slice(4);
      if (selected[jid]) {
        if (tab !== 'convocatoria') assignPlayer(jid, roleForTab(), targetId);
        else reorderSelected(jid, targetId);
      } else {
        assignPlayer(jid, roleForTab(), targetId);
      }
    }
    onDragEnd();
  };

  const onDropPlantilla = (e) => {
    e.preventDefault();
    applyDrop('plantilla', readDragId(e));
  };

  const onDropSeleccion = (e) => {
    e.preventDefault();
    applyDrop('seleccion', readDragId(e));
  };

  const onDropSelectedRow = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    applyDrop(`row:${targetId}`, readDragId(e));
  };

  const onDropZone = (e, zonaId) => {
    e.preventDefault();
    e.stopPropagation();
    applyDrop(`zona:${zonaId}`, readDragId(e));
  };

  const { onPointerDragStart, ghost } = usePointerDnD({
    canStart: (jid) => {
      if (tab === 'convocatoria' && !selected[jid] && !puedeConvocarPorEstado(jid)) {
        setError(errorDisponibilidad(jid));
        return false;
      }
      if (tab === 'convocatoria' && !selected[jid] && !tieneFederacion(jid)) {
        setError(MSG_SIN_FEDERACION);
        return false;
      }
      return true;
    },
    onDropTarget: applyDrop,
    setDragId,
    setDropZone,
    labelFor: (jid) => {
      const j = byId[jid];
      return j ? `#${j.dorsal ?? '—'} ${j.nombre}` : '…';
    },
  });

  return {
    zonasAtaque,
    setZonasAtaque,
    zonasDefensa,
    setZonasDefensa,
    zonasActivas,
    setZonasActivas,
    dragId,
    dropZone,
    setDropZone,
    toggleConvocado,
    setRol,
    clearZone,
    onDragStart,
    onDragEnd,
    onDropPlantilla,
    onDropSeleccion,
    onDropSelectedRow,
    onDropZone,
    onPointerDragStart,
    ghost,
  };
}
