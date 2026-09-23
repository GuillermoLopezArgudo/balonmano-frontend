import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  CourtShotMap,
  GoalShotMap,
  isFueraPorteria,
  labelPista,
  labelPorteria,
} from '../components/ShotMaps';

const ACCIONES = [
  { key: 'lanzamiento', label: 'Lanzamiento', needsShotMap: true },
  { key: 'parada', label: 'Parada', tipo: 'Parada', needsShotMap: true },
  { key: 'gol_rival', label: 'Gol rival', tipo: 'Gol recibido', needsShotMap: true },
  { key: 'perdida', label: 'Pérdida', tipo: 'Pérdida', needsShotMap: false },
  { key: 'sancion', label: 'Sanción', needsShotMap: false },
];

const SANCION_TIPOS = [
  { key: '2min', label: "2'", tipo: 'Exclusión 2 min' },
  { key: 'amarilla', label: 'Amarilla', tipo: 'Amarilla' },
  { key: 'roja', label: 'Roja', tipo: 'Roja' },
  { key: 'azul', label: 'Azul', tipo: 'Azul' },
];

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

function fmtTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Duración de cada parte (balonmano oficial). */
const HALF_MINUTES = 30;
const HALF_SEC = HALF_MINUTES * 60;

function clockStorageKey(partidoId) {
  return `siete:directo-clock:${partidoId}`;
}

function loadClock(partidoId) {
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

function saveClock(partidoId, { parte, elapsedSec, running }) {
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
  } catch {
    /* ignore quota */
  }
}

function zonaFeed(a) {
  const parts = [];
  if (a.rival_dorsal != null) parts.push(`#${a.rival_dorsal}`);
  if (a.es_contraataque) parts.push('Contraataque');
  if (a.zona) parts.push(labelPista(a.zona) || a.zona);
  if (a.zona_porteria) parts.push(`→ ${labelPorteria(a.zona_porteria) || a.zona_porteria}`);
  return parts.length ? ` · ${parts.join(' ')}` : '';
}

function isPortera(j) {
  return (j.posiciones || []).some((p) => String(p).toLowerCase().includes('portero'));
}

export default function PartidoDirecto() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { equipo } = useAuth();
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
  const [sancionTipo, setSancionTipo] = useState('2min');
  const [jugadorId, setJugadorId] = useState('');
  const [zona, setZona] = useState('');
  const [zonaPorteria, setZonaPorteria] = useState('');
  const [esContraataque, setEsContraataque] = useState(false);
  const [rivalJugadoras, setRivalJugadoras] = useState([]);
  const [rivalJugadorId, setRivalJugadorId] = useState('');
  const [nuevoDorsal, setNuevoDorsal] = useState('');
  const [nuevoNombreRival, setNuevoNombreRival] = useState('');
  const [goleadorasRival, setGoleadorasRival] = useState([]);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');
  const tickRef = useRef(null);

  const needsShotMap = ACCIONES.find((a) => a.key === accion)?.needsShotMap ?? false;
  const esParada = accion === 'parada';
  const esGolRival = accion === 'gol_rival';
  const esLanzamiento = accion === 'lanzamiento';
  const esSancion = accion === 'sancion';
  const esPorteraAccion = esParada || esGolRival;

  const jugadoresParaAccion = useMemo(() => {
    if (esPorteraAccion) return jugadores.filter(isPortera);
    // Lanzamientos: solo jugadoras de campo (sin porteras)
    if (esLanzamiento) return jugadores.filter((j) => !isPortera(j));
    return jugadores;
  }, [jugadores, esPorteraAccion, esLanzamiento]);

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

        let pool = jugs.filter((j) => j.activo !== false);
        if (pid) {
          try {
            const conv = await api.getConvocatoria(pid);
            const convIds = new Set((conv.items || []).map((i) => i.id_jugador));
            if (convIds.size) pool = jugs.filter((j) => convIds.has(j.id_jugador));
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
  }, [partidoId, clockForId, parte, seconds, running]);

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
    setRivalJugadorId('');
    setNuevoDorsal('');
    setNuevoNombreRival('');
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
    if (needsShotMap && (!zona || !zonaPorteria)) {
      setError(
        esPorteraAccion
          ? 'Marca desde dónde lanzó el rival y la casilla de portería'
          : 'Marca origen en la pista y destino (portería o fuera)',
      );
      return;
    }
    if (accion === 'lanzamiento' && isPortera(jugadores.find((j) => j.id_jugador === jugadorId) || {})) {
      setError('Un lanzamiento se asigna a una jugadora de campo, no a la portera');
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
    if (!tipoSeleccionado) {
      setError(
        esSancion
          ? 'Tipo de sanción no encontrado. Reinicia el backend para cargar «Azul».'
          : 'Tipo de acción no encontrado. Reinicia el backend para cargar «Gol recibido».',
      );
      return;
    }
    const esGolPropio = tipoSeleccionado.nombre === 'Gol';
    const esGolRecibido = tipoSeleccionado.nombre === 'Gol recibido';
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

      const created = await api.createAccion({
        id_partido: partidoId,
        id_jugador: jugadorId,
        id_tipo_accion: tipoSeleccionado.id_tipo_accion,
        minuto,
        segundo,
        zona: needsShotMap ? zona : null,
        zona_porteria: needsShotMap ? zonaPorteria : null,
        es_contraataque: needsShotMap && (esLanzamiento || esGolRival) ? esContraataque : false,
        id_rival_jugador: idRivalJug,
      });

      if ((esGolPropio || esGolRecibido) && partido) {
        const soyLocal = partido.id_equipo_local === equipo?.id_equipo;
        let nextScore = { ...score };
        if (esGolPropio) {
          nextScore = soyLocal
            ? { ...score, local: score.local + 1 }
            : { ...score, visitante: score.visitante + 1 };
        } else {
          nextScore = soyLocal
            ? { ...score, visitante: score.visitante + 1 }
            : { ...score, local: score.local + 1 };
        }
        setScore(nextScore);
        try {
          await api.updatePartido(partidoId, {
            goles_local: nextScore.local,
            goles_visitante: nextScore.visitante,
          });
        } catch {
          /* la acción ya está guardada */
        }
      }

      setAcciones((prev) => [...prev, created]);
      if (esGolRival) await refreshGoleadoras();
      setFlash(
        `${tipoSeleccionado.nombre}${esContraataque && needsShotMap ? ' (contraataque)' : ''} registrado`,
      );
      setZona('');
      setZonaPorteria('');
      setEsContraataque(false);
      setTimeout(() => setFlash(''), 1200);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const recent = [...acciones].slice(-8).reverse();

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
        <div className="add-player-actions">
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
          {partidoId && (
            <>
              <Link to={`/partidos/${partidoId}/resumen`}>
                <button type="button" className="ghost">
                  Resumen
                </button>
              </Link>
            </>
          )}
          <Link to="/partidos">
            <button type="button" className="ghost">
              Salir
            </button>
          </Link>
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
            EN DIRECTO {fmtTime(remaining)}
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
        <section className="panel club-card registro-accion">
          <h2>Registro acción</h2>

          <div className="live-acciones">
            {ACCIONES.map((a) => (
              <button
                type="button"
                key={a.key}
                className={accion === a.key ? 'active' : ''}
                onClick={() => {
                  setAccion(a.key);
                  setError('');
                  if (!a.needsShotMap) {
                    setZona('');
                    setZonaPorteria('');
                    setEsContraataque(false);
                  } else if (a.key === 'parada') {
                    setEsContraataque(false);
                  }
                }}
              >
                {a.label}
              </button>
            ))}
          </div>

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

          {needsShotMap && (esLanzamiento || esGolRival) && (
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
              <GoalShotMap
                value={zonaPorteria}
                onChange={setZonaPorteria}
                showFuera={esLanzamiento}
                title={
                  esParada
                    ? 'Destino · parada'
                    : esGolRival
                      ? 'Destino · gol recibido'
                      : 'Destino · portería'
                }
                emptyLabel={esPorteraAccion ? 'Casilla de portería' : 'Puerta o fuera'}
                hint={
                  esParada
                    ? 'Pista = tiro rival · Portería = zona de la parada'
                    : esGolRival
                      ? 'Pista = tiro rival · Portería = dónde entró el gol'
                      : 'Dentro = gol · Fuera = fallado'
                }
              />
            </div>
          )}

          <div className="live-submit-row">
            <button type="button" className="ghost" onClick={limpiar}>
              Limpiar
            </button>
            <button type="button" className="live-submit" disabled={saving} onClick={registrar}>
              {saving ? '…' : 'Registrar →'}
            </button>
          </div>
        </section>

        <section className="panel club-card">
          <h2>Últimas acciones</h2>
          <div className="live-feed">
            {recent.map((a) => {
              const j = jugadores.find((x) => x.id_jugador === a.id_jugador);
              const t = tipos.find((x) => x.id_tipo_accion === a.id_tipo_accion);
              return (
                <div className="live-feed-item" key={a.id_accion}>
                  <strong>
                    {a.minuto}&apos;{String(a.segundo || 0).padStart(2, '0')}
                  </strong>
                  <span>
                    {t?.nombre || 'Acción'}
                    {zonaFeed(a)}
                  </span>
                  <small>
                    {j ? `#${j.dorsal ?? '—'} ${j.nombre}` : '—'}
                    {a.rival_dorsal != null ? ` · rival #${a.rival_dorsal}` : ''}
                  </small>
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
