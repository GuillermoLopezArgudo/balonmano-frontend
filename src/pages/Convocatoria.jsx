import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import CampoAlineacion, {
  ZONAS_CAMPO,
  zonasParaFase,
  usePointerDnD,
} from '../components/CampoAlineacion';

const MAX_CONV = 16;
const MAX_TIT = 7;
const MAX_ATAQUE = 6;
const TABS = [
  { id: 'convocatoria', label: 'Convocatoria' },
  { id: 'alineacion_ataque', label: 'Ataque', fase: 'ataque' },
  { id: 'alineacion_defensa', label: 'Defensa', fase: 'defensa' },
  { id: 'banquillo', label: 'Banquillo' },
];
const DND_TYPE = 'application/x-balonmano-jugador';
const ZONA_IDS = new Set(ZONAS_CAMPO.map((z) => z.id));
const ZONA_ATAQUE_IDS = new Set(zonasParaFase('ataque').map((z) => z.id));

const shortZona = (zonaId) => ZONAS_CAMPO.find((z) => z.id === zonaId)?.short || zonaId;

function clearJugadorDeMapa(map, jid) {
  const next = { ...map };
  for (const k of Object.keys(next)) {
    if (next[k] === jid) delete next[k];
  }
  return next;
}

export default function Convocatoria() {
  const { id } = useParams();
  const { equipo, canWriteConvocatoria } = useAuth();
  const [tab, setTab] = useState('convocatoria');
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [selected, setSelected] = useState({}); // id -> rol
  const [zonasAtaque, setZonasAtaque] = useState({});
  const [zonasDefensa, setZonasDefensa] = useState({});
  const [plantillas, setPlantillas] = useState([]);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState(null);
  const [dropZone, setDropZone] = useState(null);
  const [fedOk, setFedOk] = useState({}); // id_jugador -> bool

  const tabMeta = TABS.find((t) => t.id === tab);
  const fase = tabMeta?.fase || null;
  const esCampo = Boolean(fase);
  const zonasActivas = fase === 'defensa' ? zonasDefensa : zonasAtaque;
  const setZonasActivas = fase === 'defensa' ? setZonasDefensa : setZonasAtaque;

  const loadPlantillas = () =>
    api
      .getAlineaciones()
      .then(setPlantillas)
      .catch(() => setPlantillas([]));

  useEffect(() => {
    Promise.all([
      api.getPartidos(),
      api.getJugadores(),
      api.getConvocatoria(id).catch(() => ({ items: [] })),
      api.getAlineaciones().catch(() => []),
      api.getFederacionEstados().catch(() => ({ estados: {} })),
    ])
      .then(([partidos, jugs, conv, alins, fed]) => {
        setPartido(partidos.find((p) => p.id_partido === id) || null);
        setJugadores(jugs.filter((j) => j.activo !== false));
        const map = {};
        const za = {};
        const zd = {};
        for (const item of conv.items || []) {
          map[item.id_jugador] = item.rol;
          const ataque = item.zona_ataque || item.zona_campo;
          if (ataque && ataque !== 'portero') za[ataque] = item.id_jugador;
          if (item.zona_defensa) zd[item.zona_defensa] = item.id_jugador;
        }
        setSelected(map);
        setZonasAtaque(za);
        setZonasDefensa(zd);
        setPlantillas(alins);
        setFedOk(fed?.estados || {});
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const convocados = useMemo(
    () => Object.keys(selected).filter((jid) => selected[jid]),
    [selected],
  );
  const enAtaque = useMemo(() => new Set(Object.values(zonasAtaque)), [zonasAtaque]);
  const enDefensa = useMemo(() => new Set(Object.values(zonasDefensa)), [zonasDefensa]);
  const banquillo = useMemo(
    () =>
      convocados.filter(
        (jid) =>
          selected[jid] === 'banquillo' ||
          selected[jid] === 'convocado' ||
          (selected[jid] === 'titular' && !enAtaque.has(jid) && !enDefensa.has(jid)),
      ),
    [convocados, selected, enAtaque, enDefensa],
  );

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    const soloConvocadas = esCampo || tab === 'banquillo';
    return jugadores.filter((j) => {
      if (soloConvocadas && !selected[j.id_jugador]) return false;
      if (!term) return true;
      const hay = `${j.nombre} ${j.apellido} ${j.dorsal ?? ''} ${(j.posiciones || []).join(' ')}`.toLowerCase();
      return hay.includes(term);
    });
  }, [jugadores, q, tab, selected, esCampo]);

  const byId = useMemo(() => {
    const map = {};
    for (const j of jugadores) map[j.id_jugador] = j;
    return map;
  }, [jugadores]);

  const zonaAtaqueDe = useMemo(() => {
    const map = {};
    for (const [zona, jid] of Object.entries(zonasAtaque)) map[jid] = zona;
    return map;
  }, [zonasAtaque]);

  const zonaDefensaDe = useMemo(() => {
    const map = {};
    for (const [zona, jid] of Object.entries(zonasDefensa)) map[jid] = zona;
    return map;
  }, [zonasDefensa]);

  const roleForTab = () => {
    if (esCampo) return 'titular';
    if (tab === 'banquillo') return 'banquillo';
    return 'convocado';
  };

  const removeFromZonas = (jid) => {
    setZonasAtaque((z) => clearJugadorDeMapa(z, jid));
    setZonasDefensa((z) => clearJugadorDeMapa(z, jid));
  };

  const syncRolTrasZonas = (jid, nextAtaque, nextDefensa, baseSelected) => {
    const next = { ...baseSelected };
    if (!next[jid]) return next;
    const inA = Object.values(nextAtaque).includes(jid);
    const inD = Object.values(nextDefensa).includes(jid);
    if (inA || inD) next[jid] = 'titular';
    else if (next[jid] === 'titular') next[jid] = 'banquillo';
    return next;
  };

  const tieneFederacion = (jid) => Boolean(fedOk[jid]);

  const toggleConvocado = (jid) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[jid]) {
        delete next[jid];
        removeFromZonas(jid);
      } else {
        if (!tieneFederacion(jid)) {
          setError('Sin federación pagada no se puede convocar. Márcala en Club → Cuotas.');
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

      if (!already && !tieneFederacion(jid)) {
        setError('Sin federación pagada no se puede convocar. Márcala en Club → Cuotas.');
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
    if (tab === 'convocatoria' && !selected[jid] && !tieneFederacion(jid)) {
      e.preventDefault();
      setError('Sin federación pagada no se puede convocar. Márcala en Club → Cuotas.');
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
      if (tab === 'convocatoria' && !selected[jid] && !tieneFederacion(jid)) {
        setError('Sin federación pagada no se puede convocar. Márcala en Club → Cuotas.');
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

  const buildItemsPayload = () =>
    Object.entries(selected).map(([id_jugador, rol]) => {
      let za = zonaAtaqueDe[id_jugador] || null;
      if (za === 'portero') za = null;
      const zd = zonaDefensaDe[id_jugador] || null;
      let r = rol;
      if (za || zd) r = 'titular';
      return {
        id_jugador,
        rol: r,
        zona_campo: za,
        zona_ataque: za,
        zona_defensa: zd,
      };
    });

  const persist = async (confirmada = false) => {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await api.saveConvocatoria(id, {
        items: buildItemsPayload(),
        confirmada,
      });
      setStatus(confirmada ? 'Convocatoria confirmada' : 'Convocatoria guardada');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const guardarPlantilla = async () => {
    const nombre = nombrePlantilla.trim();
    if (!nombre) {
      setError('Pon un nombre para la alineación');
      return;
    }
    if (!fase) {
      setError('Abre Ataque o Defensa para guardar');
      return;
    }
    const items = Object.entries(zonasActivas).map(([zona_campo, id_jugador]) => ({
      id_jugador,
      zona_campo,
    }));
    if (!items.length) {
      setError('Coloca al menos una jugadora en el campo');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createAlineacion({ nombre, tipo: fase, items });
      setNombrePlantilla('');
      await loadPlantillas();
      setStatus(`Alineación de ${fase} «${nombre}» guardada`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const aplicarPlantilla = (plantilla) => {
    const tipo = plantilla.tipo === 'defensa' ? 'defensa' : 'ataque';
    const known = new Set(jugadores.map((j) => j.id_jugador));
    const items = (plantilla.items || []).filter((i) => {
      if (!known.has(i.id_jugador)) return false;
      if (tipo === 'ataque') return ZONA_ATAQUE_IDS.has(i.zona_campo);
      return ZONA_IDS.has(i.zona_campo);
    });
    if (!items.length) {
      setError('Esta alineación no tiene jugadoras válidas de la plantilla actual');
      return;
    }

    setSelected((prev) => {
      const convocadas = new Set(Object.keys(prev));
      const aplicables = items.filter((i) => convocadas.has(i.id_jugador));
      if (!aplicables.length) {
        setError('Ninguna jugadora de esa alineación está convocada. Convócalas primero.');
        return prev;
      }

      const next = { ...prev };
      const zmap = {};
      let nTit = 0;
      const maxFase = tipo === 'ataque' ? MAX_ATAQUE : MAX_TIT;
      for (const item of aplicables) {
        if (nTit >= maxFase) break;
        next[item.id_jugador] = 'titular';
        zmap[item.zona_campo] = item.id_jugador;
        nTit += 1;
      }

      if (tipo === 'defensa') setZonasDefensa(zmap);
      else setZonasAtaque(zmap);

      setError('');
      setStatus(
        aplicables.length < items.length
          ? `Alineación de ${tipo} «${plantilla.nombre}» aplicada (solo convocadas)`
          : `Alineación de ${tipo} «${plantilla.nombre}» aplicada`,
      );
      return next;
    });
    setTab(tipo === 'defensa' ? 'alineacion_defensa' : 'alineacion_ataque');
  };

  const borrarPlantilla = async (plantilla) => {
    if (!window.confirm(`¿Eliminar la alineación «${plantilla.nombre}»?`)) return;
    try {
      await api.deleteAlineacion(plantilla.id_alineacion);
      await loadPlantillas();
      setStatus('Alineación eliminada');
    } catch (err) {
      setError(err.message);
    }
  };

  const kicker = partido
    ? `${partido.equipo_local_nombre} vs ${partido.equipo_visitante_nombre}`
    : 'PARTIDOS';

  const fechaLabel = partido
    ? new Date(partido.fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  const listForTab = () => {
    if (esCampo) return Object.values(zonasActivas);
    if (tab === 'banquillo') return banquillo;
    return convocados;
  };

  const plantillasFiltradas = useMemo(() => {
    if (!fase) return plantillas;
    return plantillas.filter((p) => (p.tipo || 'ataque') === fase);
  }, [plantillas, fase]);

  const hint =
    fase === 'ataque'
      ? 'Alineación de ataque · mantén pulsado y arrastra a una zona'
      : fase === 'defensa'
        ? 'Alineación de defensa · mantén pulsado y arrastra a una zona'
        : tab === 'banquillo'
          ? 'Solo convocadas. Arrástralas al banquillo.'
          : 'Arrastra jugadoras entre plantilla y selección, o reordénalas en la lista.';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">MI CLUB / CONVOCATORIAS</p>
          <h1>Convocatoria y alineación</h1>
        </div>
        <div className="add-player-actions">
          <Link to="/partidos">
            <button type="button" className="ghost">
              Volver
            </button>
          </Link>
          <button type="button" disabled={saving || !canWriteConvocatoria} onClick={() => persist(true)}>
            {saving
              ? 'Guardando…'
              : canWriteConvocatoria
                ? 'Confirmar convocatoria'
                : 'Solo lectura'}
          </button>
        </div>
      </header>

      <div className="conv-toolbar">
        <button
          type="button"
          className={`conv-badge${tab === 'convocatoria' ? ' active' : ''}`}
          onClick={() => setTab('convocatoria')}
        >
          Convocatoria {convocados.length}/{MAX_CONV}
        </button>
        {TABS.filter((t) => t.id !== 'convocatoria').map((t) => (
          <button
            type="button"
            key={t.id}
            className={`conv-tab${tab === t.id ? ' active' : ''}${t.fase ? ` conv-tab-${t.fase}` : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.fase === 'ataque' ? ` ${Object.keys(zonasAtaque).length}/${MAX_ATAQUE}` : ''}
            {t.fase === 'defensa' ? ` ${Object.keys(zonasDefensa).length}/${MAX_TIT}` : ''}
            {t.id === 'banquillo' ? ` ${banquillo.length}` : ''}
          </button>
        ))}
      </div>

      <p className="conv-status-line">
        {fechaLabel}
        {fechaLabel ? ' · ' : ''}
        {kicker}
        {partido && new Date(partido.fecha) > new Date() ? ' — Se aproxima el partido' : ''}
      </p>
      <p className="conv-dnd-hint muted">{hint}</p>
      <p className="conv-dnd-hint muted">
        Solo se pueden convocar jugadoras con <strong>federación pagada</strong> (Club → Cuotas).
      </p>

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <div className={`conv-layout${esCampo ? ' conv-layout-field' : ''}`}>
        <section className="panel club-card">
          <h2>{tab === 'convocatoria' ? 'Plantilla disponible' : 'Convocadas'}</h2>
          <div className="field">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, dorsal o posición…"
            />
          </div>
          <div
            className={`conv-list${dropZone === 'plantilla' ? ' drop-ready' : ''}`}
            data-drop-target="plantilla"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropZone('plantilla');
            }}
            onDragLeave={() => setDropZone((z) => (z === 'plantilla' ? null : z))}
            onDrop={onDropPlantilla}
          >
            {filtrados.map((j) => {
              const checked = Boolean(selected[j.id_jugador]);
              const za = zonaAtaqueDe[j.id_jugador];
              const zd = zonaDefensaDe[j.id_jugador];
              const esConvTab = tab === 'convocatoria';
              const fed = tieneFederacion(j.id_jugador);
              const bloqueada = esConvTab && !checked && !fed;
              return (
                <div
                  key={j.id_jugador}
                  className={`conv-player${checked ? ' on' : ''}${dragId === j.id_jugador ? ' dragging' : ''}${
                    bloqueada ? ' conv-player-blocked' : ''
                  }`}
                  data-drag-id={j.id_jugador}
                  draggable={!bloqueada}
                  onDragStart={(e) => onDragStart(e, j.id_jugador)}
                  onDragEnd={onDragEnd}
                  onPointerDown={
                    bloqueada
                      ? undefined
                      : (e) => onPointerDragStart(e, j.id_jugador, { allowScrollCancel: true })
                  }
                >
                  {esConvTab && (
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={bloqueada}
                      onChange={() => toggleConvocado(j.id_jugador)}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label={`Convocar a ${j.nombre} ${j.apellido}`}
                    />
                  )}
                  <span className="conv-dorsal">#{j.dorsal ?? '—'}</span>
                  <span className="conv-name">
                    <strong>
                      {j.nombre} {j.apellido}
                    </strong>
                    <small>
                      {j.posiciones?.[0] || 'Sin posición'}
                      {za ? ` · ATK ${shortZona(za)}` : ''}
                      {zd ? ` · DEF ${shortZona(zd)}` : ''}
                      {bloqueada ? ' · Sin federación' : ''}
                    </small>
                  </span>
                  <span className="conv-grip" aria-hidden="true">
                    ⋮⋮
                  </span>
                </div>
              );
            })}
            {!filtrados.length && (
              <p className="muted">
                {tab === 'convocatoria'
                  ? 'Sin jugadores'
                  : 'No hay convocadas. Márcalas en la pestaña Convocatoria.'}
              </p>
            )}
          </div>
        </section>

        <section className="panel club-card">
          <h2>
            {fase === 'ataque'
              ? 'Alineación ataque'
              : fase === 'defensa'
                ? 'Alineación defensa'
                : tab === 'banquillo'
                  ? 'Banquillo'
                  : 'Selección actual'}
          </h2>

          {esCampo ? (
            <>
              <CampoAlineacion
                fase={fase}
                zonas={zonasActivas}
                byId={byId}
                dragId={dragId}
                dropZone={dropZone}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOverZone={(zonaId) => setDropZone(`zona:${zonaId}`)}
                onDropZone={onDropZone}
                onClearZone={clearZone}
                onPointerDragStart={onPointerDragStart}
              />
              <div className="alin-save-row">
                <input
                  value={nombrePlantilla}
                  onChange={(e) => setNombrePlantilla(e.target.value)}
                  placeholder={`Nombre alineación ${fase}…`}
                  maxLength={120}
                />
                <button type="button" disabled={saving || !canWriteConvocatoria} onClick={guardarPlantilla}>
                  Guardar {fase}
                </button>
              </div>
            </>
          ) : (
            <div
              className={`conv-selected${dropZone === 'seleccion' ? ' drop-ready' : ''}`}
              data-drop-target="seleccion"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropZone('seleccion');
              }}
              onDragLeave={() => setDropZone((z) => (z === 'seleccion' ? null : z))}
              onDrop={onDropSeleccion}
            >
              {listForTab().map((jid) => {
                const j = byId[jid];
                if (!j) return null;
                return (
                  <div
                    className={`conv-selected-row${dragId === jid ? ' dragging' : ''}${
                      dropZone === jid || dropZone === `row:${jid}` ? ' drag-over' : ''
                    }`}
                    key={jid}
                    data-drag-id={jid}
                    data-drop-target={`row:${jid}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, jid)}
                    onDragEnd={onDragEnd}
                    onPointerDown={(e) => onPointerDragStart(e, jid, { allowScrollCancel: true })}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      setDropZone(`row:${jid}`);
                    }}
                    onDrop={(e) => onDropSelectedRow(e, jid)}
                  >
                    <div>
                      <strong>
                        #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                      </strong>
                      <small>{j.posiciones?.[0] || '—'}</small>
                    </div>
                    <div className="conv-selected-actions">
                      <select
                        value={selected[jid]}
                        onChange={(e) => setRol(jid, e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <option value="convocado">Convocado</option>
                        <option value="titular">Titular</option>
                        <option value="banquillo">Banquillo</option>
                      </select>
                      <span className="conv-grip" aria-hidden="true">
                        ⋮⋮
                      </span>
                    </div>
                  </div>
                );
              })}
              {!listForTab().length && (
                <p className="muted conv-drop-placeholder">
                  {tab === 'banquillo'
                    ? 'Arrastra aquí para el banquillo'
                    : 'Arrastra jugadoras de la plantilla'}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            className="ghost full"
            style={{ marginTop: '1rem' }}
            disabled={saving || !canWriteConvocatoria}
            onClick={() => persist(false)}
          >
            {canWriteConvocatoria ? 'Guardar borrador' : 'Solo lectura'}
          </button>
        </section>
      </div>

      <section className="panel club-card" style={{ marginTop: '1rem' }}>
        <h2>
          Alineaciones guardadas
          {fase ? ` · ${fase}` : ''}
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {fase
            ? `Plantillas de ${fase} reutilizables en este club.`
            : 'Abre Ataque o Defensa para filtrar, o aplica cualquiera desde aquí.'}
        </p>
        {(fase ? plantillasFiltradas : plantillas).length ? (
          <div className="alin-templates">
            {(fase ? plantillasFiltradas : plantillas).map((p) => (
              <div className="alin-template-row" key={p.id_alineacion}>
                <div>
                  <strong>{p.nombre}</strong>
                  <small>
                    <span className={`alin-tipo-badge alin-tipo-${p.tipo || 'ataque'}`}>
                      {p.tipo === 'defensa' ? 'Defensa' : 'Ataque'}
                    </span>
                    {' · '}
                    {(p.items || []).length}/7 posiciones ·{' '}
                    {p.actualizado_en
                      ? new Date(p.actualizado_en).toLocaleDateString('es-ES')
                      : ''}
                  </small>
                </div>
                <div className="alin-template-actions">
                  <button type="button" className="ghost" onClick={() => aplicarPlantilla(p)}>
                    Aplicar
                  </button>
                  <button type="button" className="ghost danger" onClick={() => borrarPlantilla(p)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            {fase
              ? `Aún no hay alineaciones de ${fase} guardadas.`
              : 'Aún no hay alineaciones guardadas.'}
          </p>
        )}
      </section>

      <section className="panel club-card" style={{ marginTop: '1rem' }}>
        <h2>Cuerpo técnico</h2>
        <div className="staff-row">
          <div>
            <span>Entrenador</span>
            <strong>{equipo?.correo?.split('@')[0] || 'Entrenador'}</strong>
          </div>
          <div>
            <span>Club</span>
            <strong>{equipo?.datos?.nombre || '—'}</strong>
          </div>
        </div>
      </section>

      {ghost && (
        <div
          className="conv-drag-ghost"
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden="true"
        >
          {ghost.label}
        </div>
      )}
    </>
  );
}
