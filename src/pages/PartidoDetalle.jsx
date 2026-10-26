import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { IcoFlecha, IcoLapiz } from '../components/ActionIcons';
import { clearActiveLiveIfPartido } from '../liveClock';
import { useAbortable } from '../useAbortable';

function soyLocalPartido(partido, idEquipo) {
  if (!partido || !idEquipo) return true;
  const myId = String(idEquipo);
  if (
    partido.es_local != null &&
    partido.id_equipo != null &&
    String(partido.id_equipo) === myId
  ) {
    return Boolean(partido.es_local);
  }
  return String(partido.id_equipo_local) === myId;
}

function rivalNombre(partido, idEquipo) {
  const local = soyLocalPartido(partido, idEquipo);
  return (
    (local ? partido.equipo_visitante_nombre : partido.equipo_local_nombre) ||
    'Rival por definir'
  );
}

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function estadoLabel(estado) {
  const e = (estado || 'programado').toLowerCase();
  if (e === 'jugado') return 'Jugado';
  if (e === 'sin_resultado') return 'Sin resultado';
  if (e === 'aplazado') return 'Aplazado';
  return 'Programado';
}

function tieneGoles(p) {
  return (Number(p?.goles_local) || 0) > 0 || (Number(p?.goles_visitante) || 0) > 0;
}

/** Cierra el partido: con goles → jugado; sin goles → sin_resultado (no suma en analítica). */
function estadoCierre(p) {
  return tieneGoles(p) ? 'jugado' : 'sin_resultado';
}

function rolLabel(rol) {
  if (rol === 'titular') return 'Titular';
  if (rol === 'banquillo') return 'Banquillo';
  return 'Convocada';
}

export default function PartidoDetalle() {
  const { id } = useParams();
  const { equipo, canWritePartidos, canRead } = useAuth();
  const [partido, setPartido] = useState(null);
  const [convocatoria, setConvocatoria] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useAbortable(async ({ signal, alive }) => {
    try {
      setError('');
      const [p, conv] = await Promise.all([
        api.getPartido(id, { signal }),
        api.getConvocatoria(id, { signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return { items: [], estado: 'borrador' };
        }),
      ]);
      if (!alive()) return;
      setPartido(p);
      setConvocatoria(conv);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, [id]);

  const closed =
    partido?.estado === 'jugado' || partido?.estado === 'sin_resultado';
  const finished = partido?.estado === 'jugado';
  const aplazado = (partido?.estado || '') === 'aplazado';
  const soyLocal = partido ? soyLocalPartido(partido, equipo?.id_equipo) : true;
  const rival = partido ? rivalNombre(partido, equipo?.id_equipo) : '';
  const nosotros =
    equipo?.datos?.nombre_corto || equipo?.datos?.nombre || 'Tu equipo';

  const marcador = useMemo(() => {
    if (!partido || !finished || !tieneGoles(partido)) return null;
    const gf = soyLocal ? partido.goles_local : partido.goles_visitante;
    const gc = soyLocal ? partido.goles_visitante : partido.goles_local;
    return { gf: gf ?? 0, gc: gc ?? 0 };
  }, [partido, finished, soyLocal]);

  const convGuardada = convocatoria?.estado === 'guardada';

  const convocadas = useMemo(() => {
    // Solo lo guardado en servidor; el borrador local solo vive en /convocatoria
    if (!convGuardada) return [];
    const items = [...(convocatoria?.items || [])];
    const peso = { titular: 0, banquillo: 1, convocado: 2 };
    return items.sort((a, b) => {
      const pa = peso[a.rol] ?? 9;
      const pb = peso[b.rol] ?? 9;
      if (pa !== pb) return pa - pb;
      const da = a.dorsal ?? 999;
      const db = b.dorsal ?? 999;
      if (da !== db) return da - db;
      return `${a.apellido || ''} ${a.nombre || ''}`.localeCompare(
        `${b.apellido || ''} ${b.nombre || ''}`,
        'es',
      );
    });
  }, [convocatoria, convGuardada]);

  const setEstado = async (estado) => {
    if (!canWritePartidos || !partido) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api.updatePartido(partido.id_partido, { estado });
      setPartido(updated);
      if (estado === 'jugado' || estado === 'sin_resultado') {
        clearActiveLiveIfPartido(partido.id_partido);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cerrarPartido = () => setEstado(estadoCierre(partido));

  if (error && !partido) {
    return (
      <>
        <p className="error">{error}</p>
        <Link className="volver-link" to="/partidos">
          <IcoFlecha />
          Volver a partidos
        </Link>
      </>
    );
  }

  if (!partido) {
    return <p className="muted">Cargando partido…</p>;
  }

  const accesos = [
    {
      to: `/partidos/${id}/convocatoria`,
      title: 'Convocatoria',
      hint: convocadas.length
        ? `${convocadas.length} jugadora${convocadas.length === 1 ? '' : 's'}`
        : 'Aún sin convocadas',
      primary: !closed,
    },
    canRead('directo')
      ? {
          to: `/partidos/${id}/directo`,
          title: closed ? 'Ver registro' : 'Directo',
          hint: closed
            ? 'Repasa o completa las acciones del partido'
            : 'Registra el partido en vivo',
          primary: !closed,
        }
      : null,
    {
      to: `/partidos/${id}/resumen`,
      title: 'Acta / resumen',
      hint: 'Estadísticas y cronología',
      primary: closed,
    },
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">
            <Link to="/partidos">PARTIDOS</Link>
            {' / FICHA'}
          </p>
          <h1>Ficha del partido</h1>
        </div>
        <div className="add-player-actions">
          <Link to="/partidos">
            <button type="button" className="ghost">
              Calendario
            </button>
          </Link>
          {canWritePartidos && !closed && (
            <Link
              to={`/partidos/${id}/editar`}
              className="btn-icon-edit"
              title="Editar partido"
              aria-label="Editar partido"
            >
              <IcoLapiz />
            </Link>
          )}
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="panel partido-ficha-hero">
        <div className="partido-ficha-badges">
          <span
            className={`partido-ficha-badge estado-${(partido.estado || 'programado').toLowerCase()}`}
          >
            {estadoLabel(partido.estado)}
          </span>
          <span className="partido-ficha-badge muted">
            {soyLocal ? 'Local' : 'Visitante'}
          </span>
          {partido.jornada != null && (
            <span className="partido-ficha-badge muted">Jornada {partido.jornada}</span>
          )}
          {partido.temporada_nombre && (
            <span className="partido-ficha-badge muted">{partido.temporada_nombre}</span>
          )}
        </div>

        <div className="partido-ficha-scoreboard">
          <div className="partido-ficha-team is-us">
            <small>Tu equipo</small>
            <strong>{nosotros}</strong>
          </div>
          <div className="partido-ficha-score">
            {marcador ? (
              <>
                <span className="partido-ficha-score-num">{marcador.gf}</span>
                <span className="partido-ficha-score-sep">–</span>
                <span className="partido-ficha-score-num">{marcador.gc}</span>
              </>
            ) : (
              <span className="partido-ficha-score-vs">vs</span>
            )}
          </div>
          <div className="partido-ficha-team is-rival">
            <small>Rival</small>
            <strong title={rival}>{rival}</strong>
          </div>
        </div>

        <p className="partido-ficha-when">{fmtFecha(partido.fecha)}</p>

        <div className="partido-ficha-meta">
          <div>
            <span>Competición</span>
            <strong>{partido.competicion || 'Sin competición'}</strong>
          </div>
          <div>
            <span>Pabellón</span>
            <strong>{partido.pabellon || 'Sin pabellón'}</strong>
          </div>
        </div>
      </section>

      <section className="partido-ficha-accesos">
        <h2>Qué quieres hacer</h2>
        <div className="partido-ficha-cards">
          {accesos.filter(Boolean).map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className={`partido-ficha-card${a.primary ? ' primary' : ''}`}
            >
              <strong>{a.title}</strong>
              <span>{a.hint}</span>
            </Link>
          ))}
        </div>

        {canWritePartidos && !closed && (
          <div className="partido-ficha-secondary">
            {!aplazado && (
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => setEstado('aplazado')}
              >
                Aplazar
              </button>
            )}
            {aplazado && (
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => setEstado('programado')}
              >
                Reprogramar
              </button>
            )}
            <button type="button" className="ghost" disabled={busy} onClick={cerrarPartido}>
              {tieneGoles(partido) ? 'Marcar jugado' : 'Cerrar sin resultado'}
            </button>
          </div>
        )}
      </section>

      <section className="panel partido-ficha-conv" style={{ marginTop: '1.15rem' }}>
        <div className="dash-panel-head">
          <div>
            <h2>Convocadas</h2>
            <p className="panel-hint">
              {convocadas.length
                ? `${convocadas.length} jugadora${convocadas.length === 1 ? '' : 's'} · Guardada`
                : 'Todavía no hay convocatoria guardada'}
            </p>
          </div>
          {convocadas.length ? (
            <Link
              to={`/partidos/${id}/convocatoria`}
              className="btn-icon-edit"
              title="Editar convocatoria"
              aria-label="Editar convocatoria"
            >
              <IcoLapiz />
            </Link>
          ) : (
            <Link to={`/partidos/${id}/convocatoria`}>
              <button type="button" className="ghost">
                Hacer convocatoria
              </button>
            </Link>
          )}
        </div>

        {Boolean(convocadas.length) && (
          <div className="roster-list partido-ficha-conv-list">
            {convocadas.map((j) => (
              <div className="roster-row" key={j.id_jugador}>
                <div className="roster-player">
                  <span>
                    <strong>
                      #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                    </strong>
                    <small>
                      {(j.posiciones || []).join(', ') || 'Sin posición'}
                    </small>
                  </span>
                </div>
                <span className={`partido-ficha-rol rol-${j.rol || 'convocado'}`}>
                  {rolLabel(j.rol)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
