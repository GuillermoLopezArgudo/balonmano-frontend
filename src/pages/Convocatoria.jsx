import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  clearConvocatoriaDraft,
  readConvocatoriaDraft,
  writeConvocatoriaDraft,
} from '../convocatoriaDraft';
import { IcoFlecha } from '../components/ActionIcons';
import ConvocatoriaPlantillaList from './convocatoria/ConvocatoriaPlantillaList';
import ConvocatoriaPlantillasGuardadas from './convocatoria/ConvocatoriaPlantillasGuardadas';
import ConvocatoriaSeleccionPanel from './convocatoria/ConvocatoriaSeleccionPanel';
import useConvocatoriaDnD from './convocatoria/useConvocatoriaDnD';
import {
  MAX_ATAQUE,
  MAX_CONV,
  MAX_TIT,
  MSG_SIN_FEDERACION,
  TABS,
  ZONA_ATAQUE_IDS,
  ZONA_IDS,
  snapConvocatoria,
} from './convocatoria/utils';

export default function Convocatoria() {
  const { id } = useParams();
  const { equipo, miembro, canWriteConvocatoria, canReadCuotas } = useAuth();
  const [tab, setTab] = useState('convocatoria');
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [selected, setSelected] = useState({}); // id -> rol
  const [plantillas, setPlantillas] = useState([]);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [fedOk, setFedOk] = useState({}); // id_jugador -> bool
  const [estadoConv, setEstadoConv] = useState('borrador');
  const [savedSnap, setSavedSnap] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const tabMeta = TABS.find((t) => t.id === tab);
  const fase = tabMeta?.fase || null;
  const esCampo = Boolean(fase);

  const byId = useMemo(() => {
    const map = {};
    for (const j of jugadores) map[j.id_jugador] = j;
    return map;
  }, [jugadores]);

  const tieneFederacion = (jid) => !canReadCuotas || Boolean(fedOk[jid]);

  const dispDe = (jid) => byId[jid]?.disponibilidad || 'disponible';

  const puedeConvocarPorEstado = (jid) => {
    const disp = dispDe(jid);
    return disp !== 'lesion' && disp !== 'sancion';
  };

  const errorDisponibilidad = (jid) => {
    const j = byId[jid];
    const nombre = j ? `${j.nombre} ${j.apellido}`.trim() : 'Esta jugadora';
    if (dispDe(jid) === 'sancion') return `${nombre} está sancionada y no se puede convocar.`;
    return `${nombre} está lesionada y no se puede convocar.`;
  };

  const {
    zonasAtaque,
    setZonasAtaque,
    zonasDefensa,
    setZonasDefensa,
    zonasActivas,
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
  } = useConvocatoriaDnD({
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
  });

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
      canReadCuotas
        ? api.getFederacionEstados().catch(() => ({ estados: {} }))
        : Promise.resolve({ estados: {} }),
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
        const serverSnap = snapConvocatoria(map, za, zd);
        const draft = readConvocatoriaDraft(equipo?.id_equipo, id);
        if (draft) {
          setSelected(draft.selected || {});
          setZonasAtaque(draft.zonasAtaque || {});
          setZonasDefensa(draft.zonasDefensa || {});
          setEstadoConv('borrador');
        } else {
          setSelected(map);
          setZonasAtaque(za);
          setZonasDefensa(zd);
          setEstadoConv(conv.estado === 'guardada' ? 'guardada' : 'borrador');
        }
        setPlantillas(alins);
        setFedOk(fed?.estados || {});
        setSavedSnap(serverSnap);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [id, equipo?.id_equipo, canReadCuotas]);

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

  const currentSnap = snapConvocatoria(selected, zonasAtaque, zonasDefensa);
  const dirty = Boolean(loaded && savedSnap != null && currentSnap !== savedSnap);
  const mostrarBorrador = estadoConv !== 'guardada' || dirty;

  // Borrador solo en este navegador (no es guardado en el servidor).
  useEffect(() => {
    if (!loaded || !canWriteConvocatoria) return;
    if (dirty) {
      writeConvocatoriaDraft(equipo?.id_equipo, id, {
        selected,
        zonasAtaque,
        zonasDefensa,
      });
      setEstadoConv('borrador');
    }
  }, [
    loaded,
    canWriteConvocatoria,
    dirty,
    selected,
    zonasAtaque,
    zonasDefensa,
    equipo?.id_equipo,
    id,
  ]);

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

  const persist = async () => {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const out = await api.saveConvocatoria(id, {
        items: buildItemsPayload(),
        estado: 'guardada',
      });
      const snap = snapConvocatoria(selected, zonasAtaque, zonasDefensa);
      setEstadoConv(out?.estado === 'guardada' ? 'guardada' : 'borrador');
      setSavedSnap(snap);
      clearConvocatoriaDraft(equipo?.id_equipo, id);
      setStatus('Convocatoria guardada');
      return true;
    } catch (err) {
      setError(err.message);
      return false;
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
      ? 'Ataque · mantén pulsado y arrastra a una zona (en móvil puedes bajar al campo sin soltar)'
      : fase === 'defensa'
        ? 'Defensa · mantén pulsado y arrastra a una zona (en móvil puedes bajar al campo sin soltar)'
        : tab === 'banquillo'
          ? 'Banquillo · mantén pulsado y arrastra aquí a las no titulares'
          : 'Mantén pulsado un jugador y arrástralo. Si deslizas sin mantener, la lista hace scroll.';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">PARTIDO · CONVOCATORIA</p>
          <h1>Convocatoria y alineación</h1>
        </div>
        <Link className="page-back" to={`/partidos/${id}`}>
          <button type="button" className="ghost">
            <IcoFlecha />
            Volver
          </button>
        </Link>
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
      <p className="conv-estado-line">
        <span className={`conv-estado-badge estado-${mostrarBorrador ? 'borrador' : 'guardada'}`}>
          {mostrarBorrador ? 'Borrador' : 'Guardada'}
        </span>
        {mostrarBorrador ? (
          <span className="muted">
            {dirty
              ? 'Borrador en este dispositivo · Guardar convocatoria lo confirma en el servidor'
              : 'Aún no se ha guardado en el servidor'}
          </span>
        ) : null}
      </p>
      <p className="conv-dnd-hint muted">{hint}</p>
      {jugadores.some((j) => !tieneFederacion(j.id_jugador)) && (
        <p className="conv-dnd-hint muted">
          Hay jugadoras sin licencia federativa
          {canReadCuotas ? (
            <>
              . Márcala en <Link to="/club/cuotas">Cuotas</Link> para poder convocarlas.
            </>
          ) : (
            '. Quien gestione las cuotas tiene que marcar la federación antes de convocarlas.'
          )}
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <div className={`conv-layout${esCampo ? ' conv-layout-field' : ''}`}>
        <ConvocatoriaPlantillaList
          tab={tab}
          q={q}
          setQ={setQ}
          filtrados={filtrados}
          selected={selected}
          zonaAtaqueDe={zonaAtaqueDe}
          zonaDefensaDe={zonaDefensaDe}
          dragId={dragId}
          dropZone={dropZone}
          setDropZone={setDropZone}
          tieneFederacion={tieneFederacion}
          puedeConvocarPorEstado={puedeConvocarPorEstado}
          toggleConvocado={toggleConvocado}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onPointerDragStart={onPointerDragStart}
          onDropPlantilla={onDropPlantilla}
        />

        <ConvocatoriaSeleccionPanel
          tab={tab}
          fase={fase}
          esCampo={esCampo}
          canWriteConvocatoria={canWriteConvocatoria}
          dirty={dirty}
          estadoConv={estadoConv}
          saving={saving}
          persist={persist}
          zonasActivas={zonasActivas}
          byId={byId}
          selected={selected}
          listForTab={listForTab}
          dragId={dragId}
          dropZone={dropZone}
          setDropZone={setDropZone}
          nombrePlantilla={nombrePlantilla}
          setNombrePlantilla={setNombrePlantilla}
          guardarPlantilla={guardarPlantilla}
          clearZone={clearZone}
          setRol={setRol}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onPointerDragStart={onPointerDragStart}
          onDropSeleccion={onDropSeleccion}
          onDropSelectedRow={onDropSelectedRow}
          onDropZone={onDropZone}
        />
      </div>

      <ConvocatoriaPlantillasGuardadas
        fase={fase}
        plantillas={plantillas}
        plantillasFiltradas={plantillasFiltradas}
        aplicarPlantilla={aplicarPlantilla}
        borrarPlantilla={borrarPlantilla}
      />

      <section className="panel club-card" style={{ marginTop: '1rem' }}>
        <h2>Cuerpo técnico</h2>
        <div className="staff-row">
          <div>
            <span>Entrenador</span>
            <strong>
              {equipo?.datos?.entrenador_nombre || miembro?.nombre || 'Entrenador'}
            </strong>
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
