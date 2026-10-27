import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { isFueraPorteria } from '../../components/ShotMaps';
import { clearActiveLiveIfPartido } from '../../liveClock';
import useLiveClockState from './useLiveClockState';
import {
  ACCIONES,
  LLEGADAS,
  PERDIDAS,
  SECONDARY_KEYS,
  applyScorePatch,
  isPortera,
  mapTipoToForm,
  scorePatchForTipo,
  tipoNombrePara,
} from './utils';

/**
 * Estado completo del partido en directo: carga, formulario de registro,
 * reloj, alta/edición/borrado de acciones y marcador.
 */
export default function usePartidoDirectoState() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { equipo, canWriteDirecto } = useAuth();
  const [partidoId, setPartidoId] = useState(routeId || '');
  const [partido, setPartido] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [score, setScore] = useState({ local: 0, visitante: 0 });
  const [accion, setAccion] = useState('lanzamiento');
  const [masAcciones, setMasAcciones] = useState(false);
  const [sancionTipo, setSancionTipo] = useState('2min');
  const [jugadorId, setJugadorId] = useState('');
  const [zona, setZona] = useState('');
  const [zonaPorteria, setZonaPorteria] = useState('');
  const [esContraataque, setEsContraataque] = useState(false);
  const [contexto, setContexto] = useState('');
  const [rivalJugadoras, setRivalJugadoras] = useState([]);
  const [rivalJugadorId, setRivalJugadorId] = useState('');
  const [nuevoDorsal, setNuevoDorsal] = useState('');
  const [nuevoNombreRival, setNuevoNombreRival] = useState('');
  const [goleadorasRival, setGoleadorasRival] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const clock = useLiveClockState({ partidoId, partido, score });
  const { minuto, segundo, setRunning } = clock;

  const accionMeta = ACCIONES.find((a) => a.key === accion);
  const needsShotMap = accionMeta?.needsShotMap ?? false;
  const needsGoalMap = accionMeta?.needsGoalMap ?? false;
  const esParada = accion === 'parada';
  const esGolRival = accion === 'gol_rival';
  const esLanzamiento = accion === 'lanzamiento';
  const esPoste = accion === 'poste';
  const esFuera = accion === 'fuera';
  const esSancion = accion === 'sancion';
  const esPerdida = accion === 'perdida';
  const needsLlegada = needsShotMap && !esPerdida;
  const opcionesContexto = esPerdida ? PERDIDAS : LLEGADAS;
  const esPorteraAccion = esParada || esGolRival;

  const jugadoresParaAccion = useMemo(() => {
    if (esPorteraAccion) return jugadores.filter(isPortera);
    // Tiros de campo: solo jugadoras de campo (sin porteras)
    if (esLanzamiento || esPoste || esFuera) return jugadores.filter((j) => !isPortera(j));
    return jugadores;
  }, [jugadores, esPorteraAccion, esLanzamiento, esPoste, esFuera]);

  // Ajustar selección al cambiar de acción (portera ↔ campo)
  useEffect(() => {
    if (esPorteraAccion && isFueraPorteria(zonaPorteria)) setZonaPorteria('');
    const ok = jugadoresParaAccion.some((j) => j.id_jugador === jugadorId);
    if (!ok) {
      setJugadorId(jugadoresParaAccion[0]?.id_jugador || '');
    }
  }, [esPorteraAccion, esLanzamiento, jugadoresParaAccion, jugadorId, zonaPorteria]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plist, jugs, tips] = await Promise.all([
          api.getPartidos(),
          api.getJugadores(),
          api.getTiposAccion(),
        ]);
        if (cancelled) return;
        setPartidos(plist);
        setTipos(tips);
        const pid = routeId || plist[0]?.id_partido || '';
        setPartidoId(pid);
        const p = plist.find((x) => x.id_partido === pid) || null;
        setPartido(p);
        if (p) setScore({ local: p.goles_local, visitante: p.goles_visitante });

        // Convocatoria guardada → solo convocadas; si no → plantilla completa
        let pool = jugs.filter((j) => j.activo !== false);
        if (pid) {
          try {
            const conv = await api.getConvocatoria(pid);
            if (conv.estado === 'guardada' && (conv.items || []).length) {
              const convIds = new Set(conv.items.map((i) => i.id_jugador));
              pool = jugs.filter((j) => convIds.has(j.id_jugador));
            }
          } catch {
            /* plantilla completa */
          }
        }
        if (cancelled) return;
        setJugadores(pool);
        if (pool[0]) setJugadorId(pool[0].id_jugador);
        setError(''); // limpiar error de intentos previos si la carga base ok

        if (pid) {
          try {
            const acts = await api.getAcciones();
            if (!cancelled) setAcciones(acts.filter((a) => a.id_partido === pid));
          } catch (e) {
            if (!cancelled) setError(e.message);
          }
        }

        // Plantilla + ranking del rival del partido
        if (p?.id_rival) {
          try {
            const [rjs, goleadoras] = await Promise.all([
              api.getRivalJugadoras(p.id_rival),
              pid ? api.getRivalGoleadorasPartido(pid).catch(() => []) : Promise.resolve([]),
            ]);
            if (!cancelled) {
              setRivalJugadoras(rjs);
              setGoleadorasRival(goleadoras);
            }
          } catch {
            if (!cancelled) {
              setRivalJugadoras([]);
              setGoleadorasRival([]);
            }
          }
        } else if (!cancelled) {
          setRivalJugadoras([]);
          setGoleadorasRival([]);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const tipoSeleccionado = useMemo(() => {
    const nombre = tipoNombrePara(accion, zonaPorteria, sancionTipo);
    if (!nombre) return null;
    // Lanzamiento sin destino aún: no resolvemos tipo hasta marcar portería/fuera
    if (accion === 'lanzamiento' && !zonaPorteria) return null;
    if (accion === 'sancion' && !sancionTipo) return null;
    return tipos.find((t) => t.nombre === nombre) || null;
  }, [accion, zonaPorteria, sancionTipo, tipos]);

  const onPickPartido = (pid) => {
    setPartidoId(pid);
    navigate(`/partidos/${pid}/directo`, { replace: true });
  };

  const limpiar = () => {
    setAccion('lanzamiento');
    setSancionTipo('2min');
    setZona('');
    setZonaPorteria('');
    setEsContraataque(false);
    setContexto('');
    setRivalJugadorId('');
    setNuevoDorsal('');
    setNuevoNombreRival('');
    setEditingId(null);
  };

  const persistScore = async (nextScore) => {
    setScore(nextScore);
    try {
      await api.updatePartido(partidoId, {
        goles_local: nextScore.local,
        goles_visitante: nextScore.visitante,
      });
    } catch {
      /* ignore */
    }
  };

  const elegirAccionPrimaria = (a) => {
    setAccion(a.key);
    setError('');
    setContexto('');
    if (!a.needsShotMap) {
      setZona('');
      setZonaPorteria('');
      setEsContraataque(false);
    } else {
      if (!a.needsGoalMap) setZonaPorteria('');
      else if (a.key === 'poste') setZonaPorteria('');
      if (a.key === 'parada') setEsContraataque(false);
    }
  };

  const elegirAccionSecundaria = (a) => {
    setAccion(a.key);
    setError('');
    setContexto('');
    if (!a.needsShotMap) {
      setZona('');
      setZonaPorteria('');
      setEsContraataque(false);
    } else {
      if (!a.needsGoalMap) setZonaPorteria('');
      else if (a.key === 'poste') setZonaPorteria('');
    }
  };

  const empezarEdicion = (a) => {
    const t = tipos.find((x) => x.id_tipo_accion === a.id_tipo_accion);
    const mapped = mapTipoToForm(t?.nombre);
    setEditingId(a.id_accion);
    setAccion(mapped.accion);
    if (SECONDARY_KEYS.has(mapped.accion)) setMasAcciones(true);
    setSancionTipo(mapped.sancionTipo);
    setJugadorId(a.id_jugador || '');
    setZona(a.zona || '');
    setZonaPorteria(a.zona_porteria || '');
    setEsContraataque(Boolean(a.es_contraataque));
    setContexto(a.contexto || '');
    setRivalJugadorId(a.id_rival_jugador || '');
    setError('');
    setFlash('Editando acción — guarda o cancela');
    setTimeout(() => setFlash(''), 1800);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refreshGoleadoras = async (pid = partidoId) => {
    if (!pid) return;
    try {
      setGoleadorasRival(await api.getRivalGoleadorasPartido(pid));
    } catch {
      /* ignore */
    }
  };

  const borrarAccion = async (a) => {
    if (!canWriteDirecto) return;
    const t = tipos.find((x) => x.id_tipo_accion === a.id_tipo_accion);
    if (!confirm(`¿Borrar «${t?.nombre || 'acción'}» del ${a.minuto}'?`)) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteAccion(a.id_accion);
      const patch = scorePatchForTipo(t?.nombre, partido, equipo?.id_equipo, -1);
      if (patch) await persistScore(applyScorePatch(score, patch));
      setAcciones((prev) => prev.filter((x) => x.id_accion !== a.id_accion));
      if (editingId === a.id_accion) limpiar();
      if (t?.nombre === 'Gol recibido') await refreshGoleadoras();
      setFlash('Acción borrada');
      setTimeout(() => setFlash(''), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const asegurarRivalJugadora = async () => {
    if (!esGolRival) return null;
    if (rivalJugadorId) return rivalJugadorId;
    const dorsal = Number(nuevoDorsal);
    if (!Number.isFinite(dorsal) || dorsal < 0 || dorsal > 99) {
      setError('Indica el dorsal rival (0–99) o elige uno de la lista');
      return null;
    }
    if (!partido?.id_rival) {
      setError('Este partido no tiene rival asociado');
      return null;
    }
    const created = await api.upsertRivalJugadora(partido.id_rival, {
      dorsal,
      nombre: nuevoNombreRival.trim() || null,
    });
    setRivalJugadoras((prev) => {
      const rest = prev.filter((x) => x.id_rival_jugador !== created.id_rival_jugador);
      return [...rest, created].sort((a, b) => a.dorsal - b.dorsal);
    });
    setRivalJugadorId(created.id_rival_jugador);
    setNuevoDorsal('');
    setNuevoNombreRival('');
    return created.id_rival_jugador;
  };

  const registrar = async () => {
    if (!partidoId || !jugadorId) {
      setError('Selecciona partido y jugador');
      return;
    }
    if (needsShotMap && !zona) {
      setError(
        esPorteraAccion
          ? 'Marca desde dónde lanzó el rival'
          : 'Marca el origen en la pista',
      );
      return;
    }
    if (needsGoalMap && !zonaPorteria) {
      setError(
        esPorteraAccion
          ? 'Marca la casilla de portería'
          : esPoste
            ? 'Marca dónde tocó el poste'
            : 'Marca destino (portería o fuera)',
      );
      return;
    }
    if (
      (esLanzamiento || esPoste || esFuera) &&
      isPortera(jugadores.find((j) => j.id_jugador === jugadorId) || {})
    ) {
      setError('Esa acción se asigna a una jugadora de campo, no a la portera');
      return;
    }
    if (esPorteraAccion && !isPortera(jugadores.find((j) => j.id_jugador === jugadorId) || {})) {
      setError('Parada y gol rival se asignan a una portera del equipo');
      return;
    }
    if (esPorteraAccion && isFueraPorteria(zonaPorteria)) {
      setError('Elige una casilla dentro de la portería (no fuera).');
      return;
    }
    if ((needsLlegada || esPerdida) && !opcionesContexto.some((o) => o.key === contexto)) {
      setError(esPerdida ? 'Elige el tipo de pérdida' : 'Elige cómo llega el lanzamiento');
      return;
    }
    if (!tipoSeleccionado) {
      setError(
        esSancion
          ? 'Tipo de sanción no encontrado. Reinicia el backend para cargar «Azul».'
          : 'Tipo de acción no encontrado. Reinicia el backend para cargar «Gol recibido».',
      );
      return;
    }
    const prev = editingId ? acciones.find((x) => x.id_accion === editingId) : null;
    const prevTipo = prev
      ? tipos.find((x) => x.id_tipo_accion === prev.id_tipo_accion)
      : null;

    setSaving(true);
    setError('');
    try {
      let idRivalJug = null;
      if (esGolRival) {
        idRivalJug = await asegurarRivalJugadora();
        if (!idRivalJug) {
          setSaving(false);
          return;
        }
      }

      const payload = {
        id_jugador: jugadorId,
        id_tipo_accion: tipoSeleccionado.id_tipo_accion,
        minuto: editingId && prev ? prev.minuto : minuto,
        segundo: editingId && prev ? prev.segundo : segundo,
        zona: needsShotMap ? zona : null,
        zona_porteria: needsGoalMap ? zonaPorteria : null,
        es_contraataque:
          needsShotMap && (esLanzamiento || esGolRival || esPoste || esFuera)
            ? esContraataque
            : false,
        contexto: needsLlegada || esPerdida ? contexto : null,
        id_rival_jugador: idRivalJug,
      };

      let saved;
      if (editingId) {
        saved = await api.updateAccion(editingId, payload);
        let nextScore = score;
        const rem = scorePatchForTipo(prevTipo?.nombre, partido, equipo?.id_equipo, -1);
        const add = scorePatchForTipo(tipoSeleccionado.nombre, partido, equipo?.id_equipo, 1);
        if (rem || add) {
          nextScore = applyScorePatch(applyScorePatch(score, rem), add);
          await persistScore(nextScore);
        }
        setAcciones((prevList) =>
          prevList.map((x) =>
            x.id_accion === editingId
              ? {
                  ...saved,
                  es_contraataque: Boolean(
                    saved?.es_contraataque ?? payload.es_contraataque,
                  ),
                }
              : x,
          ),
        );
        setFlash('Acción actualizada');
      } else {
        saved = await api.createAccion({
          id_partido: partidoId,
          ...payload,
        });
        const add = scorePatchForTipo(tipoSeleccionado.nombre, partido, equipo?.id_equipo, 1);
        if (add) await persistScore(applyScorePatch(score, add));
        setAcciones((prevList) => [
          ...prevList,
          {
            ...saved,
            es_contraataque: Boolean(
              saved?.es_contraataque ?? payload.es_contraataque,
            ),
          },
        ]);
        setFlash(
          `${tipoSeleccionado.nombre}${esContraataque && needsShotMap ? ' (contraataque)' : ''} registrado`,
        );
      }

      if (esGolRival) await refreshGoleadoras();
      limpiar();
      setTimeout(() => setFlash(''), 1200);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cerrarPartido = async () => {
    const conGoles = (score.local || 0) > 0 || (score.visitante || 0) > 0;
    const estado = conGoles ? 'jugado' : 'sin_resultado';
    if (
      !window.confirm(
        conGoles
          ? '¿Cerrar el partido? Se marcará como jugado y irás al resumen.'
          : '¿Cerrar sin resultado? No sumará en analítica. Irás al resumen.',
      )
    ) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      setRunning(false);
      await api.updatePartido(partidoId, {
        estado,
        goles_local: score.local,
        goles_visitante: score.visitante,
      });
      clearActiveLiveIfPartido(partidoId);
      navigate(`/partidos/${partidoId}/resumen`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const recent = [...acciones].slice(-8).reverse();

  return {
    routeId,
    partidoId,
    partido,
    partidos,
    jugadores,
    tipos,
    acciones,
    score,
    clock,
    accion,
    masAcciones,
    setMasAcciones,
    sancionTipo,
    setSancionTipo,
    jugadorId,
    setJugadorId,
    zona,
    setZona,
    zonaPorteria,
    setZonaPorteria,
    esContraataque,
    setEsContraataque,
    contexto,
    setContexto,
    rivalJugadoras,
    rivalJugadorId,
    setRivalJugadorId,
    nuevoDorsal,
    setNuevoDorsal,
    nuevoNombreRival,
    setNuevoNombreRival,
    goleadorasRival,
    saving,
    editingId,
    flash,
    error,
    setError,
    needsShotMap,
    needsGoalMap,
    esParada,
    esGolRival,
    esLanzamiento,
    esPoste,
    esFuera,
    esSancion,
    esPerdida,
    needsLlegada,
    opcionesContexto,
    esPorteraAccion,
    jugadoresParaAccion,
    onPickPartido,
    limpiar,
    elegirAccionPrimaria,
    elegirAccionSecundaria,
    empezarEdicion,
    borrarAccion,
    registrar,
    cerrarPartido,
    recent,
  };
}
