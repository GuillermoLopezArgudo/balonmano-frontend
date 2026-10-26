import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoBasura, IcoFlecha, IcoLapiz } from '../components/ActionIcons';
import SinAcceso from '../components/SinAcceso';
import {
  CourtHeatMap,
  CourtShotMap,
  GoalShotMap,
  isFueraPorteria,
  labelPista,
  labelPorteria,
} from '../components/ShotMaps';
import {
  HALF_MINUTES,
  HALF_SEC,
  fmtClock,
  loadClock,
  saveClock,
  clearActiveLiveIfPartido,
  setActiveLive,
} from '../liveClock';

const ACCIONES_PRIMARY = [
  { key: 'lanzamiento', label: 'Lanzamiento', needsShotMap: true, needsGoalMap: true },
  { key: 'parada', label: 'Parada', tipo: 'Parada', needsShotMap: true, needsGoalMap: true },
  { key: 'gol_rival', label: 'Gol rival', tipo: 'Gol recibido', needsShotMap: true, needsGoalMap: true },
  { key: 'perdida', label: 'Pérdida', tipo: 'Pérdida', needsShotMap: false },
  { key: 'sancion', label: 'Sanción', needsShotMap: false },
];

const ACCIONES_SECONDARY = [
  { key: 'recuperacion', label: 'Recuperación', tipo: 'Recuperación', needsShotMap: false },
  { key: 'falta_cometida', label: 'Falta com.', tipo: 'Falta cometida', needsShotMap: false },
  { key: 'falta_recibida', label: 'Falta rec.', tipo: 'Falta recibida', needsShotMap: false },
  { key: 'poste', label: 'Poste', tipo: 'Poste', needsShotMap: true, needsGoalMap: true },
];

const ACCIONES = [...ACCIONES_PRIMARY, ...ACCIONES_SECONDARY];
const SECONDARY_KEYS = new Set(ACCIONES_SECONDARY.map((a) => a.key));

const SANCION_TIPOS = [
  { key: '2min', label: "2'", tipo: 'Exclusión 2 min' },
  { key: 'amarilla', label: 'Amarilla', tipo: 'Amarilla' },
  { key: 'roja', label: 'Roja', tipo: 'Roja' },
  { key: 'azul', label: 'Azul', tipo: 'Azul' },
];

const LLEGADAS = [
  { key: 'entrada', label: 'Entrada' },
  { key: 'giro_izq', label: 'Giro izq.' },
  { key: 'giro_der', label: 'Giro der.' },
  { key: 'punto_debil', label: 'Punto débil' },
  { key: 'directo', label: 'Directo' },
];

const PERDIDAS = [
  { key: 'falta_ataque', label: 'Falta en ataque' },
  { key: 'pasos', label: 'Pasos' },
  { key: 'dobles', label: 'Dobles' },
  { key: 'mal_pase', label: 'Mal pase' },
  { key: 'interceptado', label: 'Interceptado' },
];

function labelContexto(key) {
  return [...LLEGADAS, ...PERDIDAS].find((x) => x.key === key)?.label || '';
}

/** Lanzamiento: dentro de portería = Gol; fuera = Lanzamiento fallado. */
function tipoNombrePara(accionKey, zonaPorteria, sancionTipo) {
  if (accionKey === 'lanzamiento') {
    return isFueraPorteria(zonaPorteria) ? 'Lanzamiento fallado' : 'Gol';
  }
  if (accionKey === 'sancion') {
    return SANCION_TIPOS.find((s) => s.key === sancionTipo)?.tipo || null;
  }
  return ACCIONES.find((a) => a.key === accionKey)?.tipo || null;
}

function zonaFeed(a) {
  const parts = [];
  if (a.rival_dorsal != null) parts.push(`#${a.rival_dorsal}`);
  // Contraataque se muestra aparte en el feed (live-feed-contra)
  if (a.contexto) parts.push(labelContexto(a.contexto));
  if (a.zona) parts.push(labelPista(a.zona) || a.zona);
  if (a.zona_porteria) parts.push(`→ ${labelPorteria(a.zona_porteria) || a.zona_porteria}`);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

function isPortera(j) {
  return (j.posiciones || []).some((p) => String(p).toLowerCase().includes('portero'));
}

function mapTipoToForm(tipoNombre) {
  const n = (tipoNombre || '').toLowerCase();
  if (n === 'gol' || n.includes('lanzamiento')) {
    return { accion: 'lanzamiento', sancionTipo: '2min' };
  }
  if (n.includes('parada')) return { accion: 'parada', sancionTipo: '2min' };
  if (n.includes('recibid') && n.includes('gol')) {
    return { accion: 'gol_rival', sancionTipo: '2min' };
  }
  if (n.includes('pérdida') || n.includes('perdida')) {
    return { accion: 'perdida', sancionTipo: '2min' };
  }
  if (n.includes('recuperación') || n.includes('recuperacion')) {
    return { accion: 'recuperacion', sancionTipo: '2min' };
  }
  if (n.includes('falta') && n.includes('recibid')) {
    return { accion: 'falta_recibida', sancionTipo: '2min' };
  }
  if (n.includes('falta')) return { accion: 'falta_cometida', sancionTipo: '2min' };
  if (n === 'poste') return { accion: 'poste', sancionTipo: '2min' };
  if (n === 'fuera') return { accion: 'fuera', sancionTipo: '2min' };
  if (n.includes('técnica') || n.includes('tecnica')) {
    return { accion: 'tecnica', sancionTipo: '2min' };
  }
  if (n.includes('exclusión') || n.includes('exclusion') || /\b2\s*min/.test(n)) {
    return { accion: 'sancion', sancionTipo: '2min' };
  }
  if (n.includes('amarilla')) return { accion: 'sancion', sancionTipo: 'amarilla' };
  if (n.includes('roja')) return { accion: 'sancion', sancionTipo: 'roja' };
  if (n.includes('azul')) return { accion: 'sancion', sancionTipo: 'azul' };
  return { accion: 'lanzamiento', sancionTipo: '2min' };
}

function scorePatchForTipo(nombre, partido, equipoId, dir = 1) {
  if (!partido || !nombre) return null;
  const n = nombre.toLowerCase();
  const esGol = n.includes('gol') && !n.includes('recibid');
  const esRecibido = n.includes('gol') && n.includes('recibid');
  if (!esGol && !esRecibido) return null;
  const soyLocal = partido.id_equipo_local === equipoId;
  const d = dir >= 0 ? 1 : -1;
  if (esGol) {
    return soyLocal
      ? { local: d, visitante: 0 }
      : { local: 0, visitante: d };
  }
  return soyLocal
    ? { local: 0, visitante: d }
    : { local: d, visitante: 0 };
}

function applyScorePatch(score, patch) {
  if (!patch) return score;
  return {
    local: Math.max(0, score.local + patch.local),
    visitante: Math.max(0, score.visitante + patch.visitante),
  };
}

export default function PartidoDirecto() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { equipo, canWriteDirecto, canWritePartidos, canRead } = useAuth();
  const [partidoId, setPartidoId] = useState(routeId || '');
  const [partido, setPartido] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [score, setScore] = useState({ local: 0, visitante: 0 });
  const [parte, setParte] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [clockForId, setClockForId] = useState(null);
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
  const tickRef = useRef(null);

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

  const refreshGoleadoras = async (pid = partidoId) => {
    if (!pid) return;
    try {
      setGoleadorasRival(await api.getRivalGoleadorasPartido(pid));
    } catch {
      /* ignore */
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

  const recent = [...acciones].slice(-8).reverse();

  const { calorEquipo, calorRival } = useMemo(() => {
    const tipoById = Object.fromEntries(tipos.map((t) => [t.id_tipo_accion, t.nombre]));
    const equipoCounts = {};
    const rivalCounts = {};
    for (const a of acciones) {
      if (!a.zona) continue;
      const n = (tipoById[a.id_tipo_accion] || '').toLowerCase();
      const esRival =
        (n.includes('gol') && n.includes('recibid')) || n.includes('parada');
      const bucket = esRival ? rivalCounts : equipoCounts;
      bucket[a.zona] = (bucket[a.zona] || 0) + 1;
    }
    return { calorEquipo: equipoCounts, calorRival: rivalCounts };
  }, [acciones, tipos]);

  if (!canRead('directo')) return <SinAcceso que="el partido en directo" />;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">
            {partido?.jornada ? `JORNADA ${partido.jornada}` : 'PARTIDO'} ·{' '}
            {parte === 1 ? '1ª PARTE' : '2ª PARTE'}
          </p>
          <h1>Partido en directo</h1>
        </div>
        <Link className="page-back" to={partidoId ? `/partidos/${partidoId}` : '/partidos'}>
          <button type="button" className="ghost">
            <IcoFlecha />
            Volver
          </button>
        </Link>
        <div className="add-player-actions page-head-actions-end">
          {!routeId && (
            <select
              value={partidoId}
              onChange={(e) => onPickPartido(e.target.value)}
              style={{ maxWidth: 240 }}
            >
              <option value="">Seleccionar partido</option>
              {partidos.map((p) => (
                <option key={p.id_partido} value={p.id_partido}>
                  {p.equipo_local_nombre} vs {p.equipo_visitante_nombre}
                </option>
              ))}
            </select>
          )}
          {partidoId &&
            canWritePartidos &&
            partido &&
            partido.estado !== 'jugado' &&
            partido.estado !== 'sin_resultado' && (
              <button
                type="button"
                className="live-cerrar-btn"
                disabled={saving}
                onClick={async () => {
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
                }}
              >
                Cerrar partido
              </button>
            )}
        </div>
      </header>

      <div className="live-board">
        <div className="live-board-team left">{partido?.equipo_local_nombre || 'Local'}</div>
        <div className="live-board-center">
          <div className="live-board-score">
            {score.local} – {score.visitante}
          </div>
          <div className="live-board-meta">
            <span className="live-dot" />
            EN DIRECTO {fmtClock(remaining)}
            <span className="muted" style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}>
              / {HALF_MINUTES}&apos;
            </span>
            <button
              type="button"
              className="ghost live-clock-btn"
              onClick={() => {
                if (seconds >= HALF_SEC) return;
                setRunning((r) => !r);
              }}
              disabled={seconds >= HALF_SEC}
              title={seconds >= HALF_SEC ? 'Parte terminada' : running ? 'Pausar' : 'Reanudar'}
            >
              {running ? '❚❚' : '▶'}
            </button>
            <button
              type="button"
              className="ghost live-clock-btn live-clock-btn-wide"
              onClick={() => {
                setRunning(false);
                setParte((p) => (p === 1 ? 2 : 1));
                setSeconds(0);
              }}
              title="Cambiar parte (reinicia el reloj de esa parte)"
            >
              {parte === 1 ? '2ª parte' : '1ª parte'}
            </button>
          </div>
        </div>
        <div className="live-board-team right">{partido?.equipo_visitante_nombre || 'Visitante'}</div>
      </div>

      {error && (
        <div className="error live-error">
          <span>{error}</span>
          <button type="button" className="ghost live-error-dismiss" onClick={() => setError('')}>
            Cerrar
          </button>
        </div>
      )}
      {flash && <p className="club-status saved">{flash}</p>}

      <div className="live-grid">
        <section className="panel club-card registro-accion live-registro">
          <h2>Registro acción</h2>

          <div className="live-acciones" role="group" aria-label="Acciones principales">
            {ACCIONES_PRIMARY.map((a) => (
              <button
                type="button"
                key={a.key}
                className={accion === a.key ? 'active' : ''}
                onClick={() => {
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
                }}
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              className={`live-acciones-more${masAcciones ? ' active' : ''}${
                SECONDARY_KEYS.has(accion) ? ' has-sel' : ''
              }`}
              onClick={() => setMasAcciones((v) => !v)}
              aria-expanded={masAcciones}
            >
              {masAcciones ? 'Menos' : 'Más…'}
            </button>
          </div>
          {masAcciones && (
            <div
              className="live-acciones live-acciones-sec"
              role="group"
              aria-label="Más acciones"
            >
              {ACCIONES_SECONDARY.map((a) => (
                <button
                  type="button"
                  key={a.key}
                  className={accion === a.key ? 'active' : ''}
                  onClick={() => {
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
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {esSancion && (
            <div className="live-sancion-tipos" role="group" aria-label="Tipo de sanción">
              {SANCION_TIPOS.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  className={`live-sancion-btn live-sancion-${s.key}${sancionTipo === s.key ? ' active' : ''}`}
                  onClick={() => {
                    setSancionTipo(s.key);
                    setError('');
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="field" style={{ marginTop: '1rem' }}>
            <label>{esPorteraAccion ? 'Portera' : 'Jugador'}</label>
            <select value={jugadorId} onChange={(e) => setJugadorId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {jugadoresParaAccion.map((j) => (
                <option key={j.id_jugador} value={j.id_jugador}>
                  #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                  {j.posiciones?.[0] ? ` · ${j.posiciones[0]}` : ''}
                </option>
              ))}
            </select>
            {esPorteraAccion && !jugadoresParaAccion.length && (
              <p className="muted" style={{ marginTop: '0.4rem' }}>
                No hay porteras en la convocatoria / plantilla.
              </p>
            )}
          </div>

          {esGolRival && (
            <div className="rival-dorsal-block">
              <h3>Dorsal rival</h3>
              {!partido?.id_rival && (
                <p className="muted">Este partido no tiene rival asociado; asócialo al crearlo.</p>
              )}
              {partido?.id_rival && (
                <>
                  <div className="field">
                    <label>Plantilla rival (se guarda entre partidos)</label>
                    <select
                      value={rivalJugadorId}
                      onChange={(e) => {
                        setRivalJugadorId(e.target.value);
                        setNuevoDorsal('');
                      }}
                    >
                      <option value="">Nuevo dorsal…</option>
                      {rivalJugadoras.map((rj) => (
                        <option key={rj.id_rival_jugador} value={rj.id_rival_jugador}>
                          #{rj.dorsal}
                          {rj.nombre ? ` ${rj.nombre}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!rivalJugadorId && (
                    <div className="rival-dorsal-new">
                      <div className="field">
                        <label>Dorsal</label>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={nuevoDorsal}
                          onChange={(e) => setNuevoDorsal(e.target.value)}
                          placeholder="0–99"
                        />
                      </div>
                      <div className="field">
                        <label>Nombre (opcional)</label>
                        <input
                          type="text"
                          value={nuevoNombreRival}
                          onChange={(e) => setNuevoNombreRival(e.target.value)}
                          placeholder="Nombre"
                          maxLength={120}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="rival-ranking">
                <h3>Goleadoras rivales</h3>
                {!goleadorasRival.length && (
                  <p className="muted">Sin goles rivales registrados aún</p>
                )}
                {goleadorasRival.map((g) => (
                  <div
                    className="rival-ranking-row"
                    key={g.id_rival_jugador || `sin-${g.dorsal}-${g.goles}`}
                  >
                    <strong>#{g.dorsal ?? '—'}</strong>
                    <span>
                      {g.nombre || 'Sin nombre'} · {g.goles} gol{g.goles === 1 ? '' : 'es'}
                    </span>
                    <small>
                      {g.zona_top_label || (g.zona_top ? labelPista(g.zona_top) : '—')}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(needsLlegada || esPerdida) && (
            <div className="live-contexto">
              <p className="live-contexto-label">
                {esPerdida ? 'Tipo de pérdida' : 'Cómo llega al lanzamiento'}
              </p>
              <div
                className="live-contexto-ops"
                role="group"
                aria-label={esPerdida ? 'Tipo de pérdida' : 'Cómo llega al lanzamiento'}
              >
                {opcionesContexto.map((o) => (
                  <button
                    type="button"
                    key={o.key}
                    className={contexto === o.key ? 'active' : ''}
                    onClick={() => {
                      setContexto(o.key);
                      setError('');
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {needsShotMap && (
                <p className="muted">La misma zona se puede alcanzar de varias formas.</p>
              )}
            </div>
          )}

          {needsShotMap && (esLanzamiento || esGolRival || esPoste || esFuera) && (
            <label className="live-contra-check">
              <input
                type="checkbox"
                checked={esContraataque}
                onChange={(e) => setEsContraataque(e.target.checked)}
              />
              <span>Contraataque</span>
              <small className="muted">
                Marca zona de fin de jugada y destino; se cuenta también como contraataque
              </small>
            </label>
          )}

          {needsShotMap && (
            <div className="shot-maps">
              <CourtShotMap
                value={zona}
                onChange={setZona}
                title={esPorteraAccion ? 'Origen · tiro rival' : 'Origen · pista'}
                emptyLabel={esPorteraAccion ? 'Desde dónde lanzó el rival' : 'Toca una zona'}
              />
              {needsGoalMap && (
                <GoalShotMap
                  value={zonaPorteria}
                  onChange={setZonaPorteria}
                  showFuera={esLanzamiento}
                  mode={esPoste ? 'posts' : 'goal'}
                  title={
                    esParada
                      ? 'Destino · parada'
                      : esGolRival
                        ? 'Destino · gol recibido'
                        : esPoste
                          ? 'Destino · poste'
                          : 'Destino · portería'
                  }
                  emptyLabel={
                    esPorteraAccion
                      ? 'Casilla de portería'
                      : esPoste
                        ? 'Elige un palo'
                        : 'Puerta o fuera'
                  }
                  hint={
                    esParada
                      ? 'Pista = tiro rival · Portería = zona de la parada'
                      : esGolRival
                        ? 'Pista = tiro rival · Portería = dónde entró el gol'
                        : esPoste
                          ? 'Solo los palos: izquierdo, larguero o derecho'
                          : 'Dentro = gol · Fuera = fallado'
                  }
                />
              )}
            </div>
          )}

          <div className="live-submit-row">
            <button type="button" className="ghost" onClick={limpiar} disabled={!canWriteDirecto}>
              {editingId ? 'Cancelar' : 'Limpiar'}
            </button>
            <button
              type="button"
              className="live-submit"
              disabled={saving || !canWriteDirecto}
              onClick={registrar}
              title={!canWriteDirecto ? 'Tu cargo no permite registrar' : undefined}
            >
              {saving
                ? '…'
                : !canWriteDirecto
                  ? 'Solo lectura'
                  : editingId
                    ? 'Guardar cambios'
                    : 'Registrar →'}
            </button>
          </div>
        </section>

        <section className="panel club-card live-heat">
          <h2>Mapas de actividad</h2>
          <p className="panel-hint">
            Origen en pista. Verde más intenso = zona más usada. Izquierda: tu equipo ·
            Derecha: rival (paradas y goles recibidos).
          </p>
          <div className="live-heat-pair">
            <div className="live-heat-col">
              <CourtHeatMap
                counts={calorEquipo}
                title={equipo?.datos?.nombre_corto || equipo?.datos?.nombre || 'Tu equipo'}
                gradientId="heatEquipo"
              />
            </div>
            <div className="live-heat-col">
              <CourtHeatMap
                counts={calorRival}
                title={
                  partido?.es_local === false
                    ? partido?.equipo_local_nombre || 'Rival'
                    : partido?.equipo_visitante_nombre || 'Rival'
                }
                gradientId="heatRival"
              />
            </div>
          </div>
        </section>

        <section className="panel club-card live-feed-panel">
          <h2>Últimas acciones</h2>
          <div className="live-feed">
            {recent.map((a) => {
              const j = jugadores.find((x) => x.id_jugador === a.id_jugador);
              const t = tipos.find((x) => x.id_tipo_accion === a.id_tipo_accion);
              const isEditing = editingId === a.id_accion;
              return (
                <div
                  className={`live-feed-item${isEditing ? ' is-editing' : ''}`}
                  key={a.id_accion}
                >
                  <strong>
                    {a.minuto}&apos;{String(a.segundo || 0).padStart(2, '0')}
                  </strong>
                  <span>
                    {t?.nombre || 'Acción'}
                    {a.es_contraataque ? (
                      <em className="live-feed-contra"> · Contraataque</em>
                    ) : null}
                    {zonaFeed(a)}
                  </span>
                  <small>
                    {j ? `#${j.dorsal ?? '—'} ${j.nombre}` : '—'}
                    {a.rival_dorsal != null ? ` · rival #${a.rival_dorsal}` : ''}
                  </small>
                  {canWriteDirecto && (
                    <div className="live-feed-actions">
                      <button
                        type="button"
                        className="btn-icon-edit"
                        disabled={saving}
                        onClick={() => empezarEdicion(a)}
                        title="Editar"
                        aria-label="Editar acción"
                      >
                        <IcoLapiz size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-del"
                        disabled={saving}
                        onClick={() => borrarAccion(a)}
                        title="Borrar"
                        aria-label="Borrar acción"
                      >
                        <IcoBasura size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!recent.length && <p className="muted">Sin acciones todavía</p>}
          </div>
        </section>
      </div>
    </>
  );
}
