import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoFlecha } from '../components/ActionIcons';
import { clearActiveLiveIfPartido } from '../liveClock';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'cronologia', label: 'Cronología' },
  { id: 'acta', label: 'Acta oficial' },
];

export default function ResumenPartido() {
  const { id } = useParams();
  const { equipo, canRead, canWritePartidos } = useAuth();
  const [tab, setTab] = useState('resumen');
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [stats, setStats] = useState([]);
  const [gkStats, setGkStats] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [closing, setClosing] = useState(false);

  const reload = () =>
    Promise.all([
      api.getPartidos(),
      api.getJugadores(),
      api.getEstadisticas(),
      api.getEstadisticasPorteros().catch(() => []),
      api.getAcciones(),
      api.getTiposAccion(),
    ]).then(([partidos, jugs, st, gk, acts, tips]) => {
      const p = partidos.find((x) => String(x.id_partido) === String(id)) || null;
      setPartido(p);
      setJugadores(jugs);
      setStats(st.filter((s) => String(s.id_partido) === String(id)));
      setGkStats(gk.filter((s) => String(s.id_partido) === String(id)));
      setAcciones(
        acts
          .filter((a) => String(a.id_partido) === String(id))
          .sort((a, b) => a.minuto - b.minuto || (a.segundo || 0) - (b.segundo || 0)),
      );
      setTipos(tips);
    });

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [id]);

  const resumen = useMemo(() => {
    const goles = stats.reduce((a, s) => a + (s.goles || 0), 0);
    const lanzamientos = stats.reduce((a, s) => a + (s.lanzamientos || 0), 0);
    const perdidas = stats.reduce((a, s) => a + (s.perdidas || 0), 0);
    const recuperaciones = stats.reduce((a, s) => a + (s.recuperaciones || 0), 0);
    const faltasCom = stats.reduce((a, s) => a + (s.faltas_cometidas || 0), 0);
    const faltasRec = stats.reduce((a, s) => a + (s.faltas_recibidas || 0), 0);
    const paradas = gkStats.reduce((a, s) => a + (s.paradas || 0), 0);
    const recibidos = gkStats.reduce((a, s) => a + (s.lanzamientos_recibidos || 0), 0);
    const efiParadas = recibidos ? Math.round((paradas / recibidos) * 100) : 0;

    const tipoById = Object.fromEntries(tipos.map((t) => [t.id_tipo_accion, t.nombre]));
    const countTipo = (name) =>
      acciones.filter((a) => tipoById[a.id_tipo_accion] === name).length;
    const golesAccion = countTipo('Gol');
    const fallos =
      countTipo('Lanzamiento fallado') + countTipo('Poste') + countTipo('Fuera');
    const golesTotales = goles || golesAccion || (partido?.goles_local ?? 0);
    const lanzTotales = lanzamientos || golesAccion + fallos;

    const gf =
      partido?.id_equipo_local === equipo?.id_equipo
        ? partido?.goles_local
        : partido?.goles_visitante;
    const gc =
      partido?.id_equipo_local === equipo?.id_equipo
        ? partido?.goles_visitante
        : partido?.goles_local;

    return {
      goles: gf ?? golesTotales,
      golesContra: gc ?? 0,
      lanzamientos: lanzTotales,
      aPorteria: golesTotales,
      fuera: Math.max(0, lanzTotales - golesTotales),
      paradas,
      efiParadas,
      perdidas: perdidas || countTipo('Pérdida'),
      recuperaciones: recuperaciones || countTipo('Recuperación'),
      faltasCometidas: faltasCom || countTipo('Falta cometida'),
      faltasRecibidas: faltasRec || countTipo('Falta recibida'),
    };
  }, [stats, gkStats, acciones, tipos, partido, equipo]);

  const porJugador = useMemo(() => {
    const tipoById = Object.fromEntries(tipos.map((t) => [t.id_tipo_accion, t.nombre]));
    const empty = () => ({
      goles: 0,
      lanzamientos: 0,
      perdidas: 0,
      recuperaciones: 0,
      faltas_cometidas: 0,
      faltas_recibidas: 0,
    });
    const map = {};
    for (const s of stats) {
      map[s.id_jugador] = {
        ...empty(),
        goles: s.goles || 0,
        lanzamientos: s.lanzamientos || 0,
        perdidas: s.perdidas || 0,
        recuperaciones: s.recuperaciones || 0,
        faltas_cometidas: s.faltas_cometidas || 0,
        faltas_recibidas: s.faltas_recibidas || 0,
        fromStats: true,
      };
    }
    for (const a of acciones) {
      if (map[a.id_jugador]?.fromStats) continue;
      if (!map[a.id_jugador]) map[a.id_jugador] = empty();
      const nombre = tipoById[a.id_tipo_accion] || '';
      const n = nombre.toLowerCase();
      if (nombre === 'Gol') {
        map[a.id_jugador].goles += 1;
        map[a.id_jugador].lanzamientos += 1;
      } else if (
        nombre === 'Lanzamiento fallado' ||
        nombre === 'Poste' ||
        nombre === 'Fuera'
      ) {
        map[a.id_jugador].lanzamientos += 1;
      } else if (n.includes('pérdida') || n.includes('perdida')) {
        map[a.id_jugador].perdidas += 1;
      } else if (n.includes('recuperación') || n.includes('recuperacion')) {
        map[a.id_jugador].recuperaciones += 1;
      } else if (n.includes('falta') && n.includes('recibid')) {
        map[a.id_jugador].faltas_recibidas += 1;
      } else if (n.includes('falta')) {
        map[a.id_jugador].faltas_cometidas += 1;
      }
    }
    return Object.entries(map)
      .map(([jid, vals]) => {
        const j = jugadores.find((x) => x.id_jugador === jid);
        const { fromStats: _fs, ...rest } = vals;
        return {
          id: jid,
          nombre: j ? `${j.nombre} ${j.apellido}` : 'Jugador',
          dorsal: j?.dorsal,
          posicion: j?.posiciones?.[0] || '—',
          ...rest,
          efi: rest.lanzamientos ? Math.round((rest.goles / rest.lanzamientos) * 100) : 0,
        };
      })
      .sort(
        (a, b) =>
          b.goles - a.goles ||
          b.recuperaciones - a.recuperaciones ||
          b.lanzamientos - a.lanzamientos,
      );
  }, [stats, acciones, tipos, jugadores]);

  const exportarPdf = () => {
    window.print();
  };

  const marcarJugado = async () => {
    if (!partido || partido.estado === 'jugado' || partido.estado === 'sin_resultado') {
      return;
    }
    const conGoles =
      (Number(partido.goles_local) || 0) > 0 || (Number(partido.goles_visitante) || 0) > 0;
    const estado = conGoles ? 'jugado' : 'sin_resultado';
    setClosing(true);
    setError('');
    setStatus('');
    try {
      await api.updatePartido(id, { estado });
      clearActiveLiveIfPartido(id);
      await reload();
      setStatus(
        conGoles
          ? 'Partido marcado como jugado'
          : 'Partido cerrado sin resultado (no suma en analítica)',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
    }
  };

  const checklist = useMemo(() => {
    if (!partido) return [];
    const tieneMarcador =
      (partido.goles_local != null || partido.goles_visitante != null) &&
      !(partido.goles_local === 0 && partido.goles_visitante === 0 && !acciones.length);
    return [
      {
        id: 'marcador',
        ok: partido.goles_local != null && partido.goles_visitante != null,
        label: 'Marcador registrado',
        hint: tieneMarcador
          ? `${partido.goles_local} – ${partido.goles_visitante}`
          : 'Revisa el marcador en directo',
      },
      {
        id: 'acciones',
        ok: acciones.length > 0,
        label: 'Acciones en el feed',
        hint: acciones.length
          ? `${acciones.length} registradas`
          : 'Vuelve al directo y anota jugadas',
      },
      {
        id: 'stats',
        ok: porJugador.length > 0,
        label: 'Stats de jugadoras',
        hint: porJugador.length
          ? `${porJugador.length} con participación`
          : 'Sin participación todavía',
      },
      {
        id: 'estado',
        ok: partido.estado === 'jugado' || partido.estado === 'sin_resultado',
        label:
          partido.estado === 'sin_resultado' ? 'Estado: sin resultado' : 'Estado: jugado',
        hint:
          partido.estado === 'jugado'
            ? 'Cerrado · suma en analítica'
            : partido.estado === 'sin_resultado'
              ? 'Cerrado · no suma en analítica'
              : `Ahora: ${partido.estado || 'programado'}`,
      },
    ];
  }, [partido, acciones.length, porJugador.length]);

  if (error && !partido) return <p className="error">{error}</p>;
  if (!partido) return <p className="muted">Cargando resumen…</p>;

  const tipoById = Object.fromEntries(tipos.map((t) => [t.id_tipo_accion, t.nombre]));
  const pendientes = checklist.filter((c) => !c.ok).length;

  return (
    <div className="acta-print">
      <header className="page-head no-print">
        <div>
          <p className="page-kicker">
            {partido.jornada ? `JORNADA ${partido.jornada}` : 'PARTIDO'} · INFORME
          </p>
          <h1>Resumen del partido</h1>
        </div>
        <div className="add-player-actions page-head-actions-beside">
          <button type="button" onClick={exportarPdf}>
            Exportar PDF
          </button>
          <Link to={`/partidos/${id}`}>
            <button type="button" className="ghost">
              <IcoFlecha />
              Volver
            </button>
          </Link>
        </div>
      </header>

      <div className="filters roster-filters no-print">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error no-print">{error}</p>}
      {status && <p className="club-status saved no-print">{status}</p>}

      {tab === 'resumen' && (
        <>
          <section className="panel forma-panel">
            <h2>Resumen</h2>
            <p className="muted">
              {new Date(partido.fecha).toLocaleString('es-ES')}
              {partido.competicion ? ` · ${partido.competicion}` : ''}
              {partido.pabellon ? ` · ${partido.pabellon}` : ''}
            </p>
            <div className="confirm-grid" style={{ marginTop: '1rem' }}>
              <div>
                <dt>Resultado</dt>
                <dd>
                  {partido.goles_local} – {partido.goles_visitante}
                </dd>
              </div>
              <div>
                <dt>Temporada</dt>
                <dd>{partido.temporada_nombre || '—'}</dd>
              </div>
              <div>
                <dt>Acciones registradas</dt>
                <dd>{acciones.length}</dd>
              </div>
              <div>
                <dt>Jugadores con stats</dt>
                <dd>{porJugador.length}</dd>
              </div>
            </div>
          </section>

          <div className="acta-stat-rows">
            <div className="acta-stat-row">
              <strong className="c-lime">{resumen.goles}</strong>
              <div>
                <span>Goles</span>
                <small>
                  {resumen.goles} a favor · {resumen.golesContra} en contra
                </small>
              </div>
            </div>
            <div className="acta-stat-row">
              <strong className="c-cyan">{resumen.lanzamientos}</strong>
              <div>
                <span>Lanzamientos</span>
                <small>
                  {resumen.aPorteria} a portería / {resumen.fuera} fuera
                </small>
              </div>
            </div>
            <div className="acta-stat-row">
              <strong className="c-orange">{resumen.paradas}</strong>
              <div>
                <span>Paradas</span>
                <small>{resumen.efiParadas}% efectividad</small>
              </div>
            </div>
            <div className="acta-stat-row">
              <strong className="c-purple">{resumen.perdidas}</strong>
              <div>
                <span>Pérdidas</span>
                <small>Registradas en el partido</small>
              </div>
            </div>
            <div className="acta-stat-row">
              <strong className="c-lime">{resumen.recuperaciones}</strong>
              <div>
                <span>Recuperaciones</span>
                <small>Balones recuperados</small>
              </div>
            </div>
            <div className="acta-stat-row">
              <strong className="c-orange">
                {resumen.faltasCometidas}/{resumen.faltasRecibidas}
              </strong>
              <div>
                <span>Faltas</span>
                <small>Cometidas / recibidas</small>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'jugadores' && (
        <section className="panel forma-panel">
          <h2>Jugadores</h2>
          <div className="roster-list">
            {porJugador.map((j) => (
              <div className="roster-row acta-player-row" key={j.id}>
                <div className="roster-player">
                  <span>
                    <strong>
                      #{j.dorsal ?? '—'} {j.nombre}
                    </strong>
                    <small>{j.posicion}</small>
                  </span>
                </div>
                <span className="roster-cell" data-label="Goles">
                  {j.goles} G
                </span>
                <span className="roster-cell" data-label="Lanz.">
                  {j.goles}/{j.lanzamientos}
                </span>
                <span className="roster-cell" data-label="Rec.">
                  {j.recuperaciones}
                </span>
                <span className="roster-cell" data-label="Pérd.">
                  {j.perdidas}
                </span>
                <span className="roster-cell" data-label="Faltas">
                  {j.faltas_cometidas}/{j.faltas_recibidas}
                </span>
                <span className="roster-cell valor" data-label="Efi.">
                  {j.efi}%
                </span>
              </div>
            ))}
            {!porJugador.length && (
              <p className="muted">Sin estadísticas de jugadores todavía</p>
            )}
          </div>
        </section>
      )}

      {tab === 'cronologia' && (
        <section className="panel forma-panel">
          <h2>Cronología</h2>
          <div className="live-feed">
            {acciones.map((a) => {
              const j = jugadores.find((x) => x.id_jugador === a.id_jugador);
              return (
                <div className="live-feed-item" key={a.id_accion}>
                  <strong>
                    {a.minuto}&apos;{String(a.segundo || 0).padStart(2, '0')}
                  </strong>
                  <span>
                    {tipoById[a.id_tipo_accion] || 'Acción'}
                    {a.zona ? ` · ${a.zona}` : ''}
                  </span>
                  <small>{j ? `#${j.dorsal ?? '—'} ${j.nombre} ${j.apellido}` : '—'}</small>
                </div>
              );
            })}
            {!acciones.length && <p className="muted">Sin acciones en el feed</p>}
          </div>
        </section>
      )}

      {tab === 'acta' && (
        <section className="panel forma-panel">
          <h2>Acta oficial</h2>
          <p>
            <strong>
              {partido.equipo_local_nombre} {partido.goles_local} – {partido.goles_visitante}{' '}
              {partido.equipo_visitante_nombre}
            </strong>
          </p>
          <p className="muted">
            {new Date(partido.fecha).toLocaleString('es-ES')}
            {partido.jornada ? ` · Jornada ${partido.jornada}` : ''}
          </p>
          <hr className="acta-hr" />
          <h3>Estadísticas del equipo</h3>
          <ul className="acta-list">
            <li>Goles: {resumen.goles}</li>
            <li>Lanzamientos: {resumen.lanzamientos}</li>
            <li>Paradas: {resumen.paradas} ({resumen.efiParadas}%)</li>
            <li>Recuperaciones: {resumen.recuperaciones}</li>
            <li>Pérdidas: {resumen.perdidas}</li>
            <li>
              Faltas: {resumen.faltasCometidas} cometidas / {resumen.faltasRecibidas} recibidas
            </li>
          </ul>
          <h3>Plantilla con participación</h3>
          <ul className="acta-list">
            {porJugador.map((j) => (
              <li key={j.id}>
                #{j.dorsal ?? '—'} {j.nombre} — {j.goles} G, {j.recuperaciones} REC,{' '}
                {j.perdidas} PÉRD, {j.faltas_cometidas}/{j.faltas_recibidas} faltas, {j.efi}% efi.
              </li>
            ))}
            {!porJugador.length && <li>Sin datos</li>}
          </ul>
        </section>
      )}

      <section className="panel match-cierre no-print">
        <div className="match-cierre-head">
          <h2>Cierre del partido</h2>
          <span className={pendientes ? 'match-cierre-badge warn' : 'match-cierre-badge ok'}>
            {pendientes ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : 'Listo'}
          </span>
        </div>
        <ul className="match-cierre-list">
          {checklist.map((c) => (
            <li key={c.id} className={c.ok ? 'is-ok' : 'is-pending'}>
              <span className="match-cierre-check" aria-hidden="true">
                {c.ok ? '✓' : '!'}
              </span>
              <div>
                <strong>{c.label}</strong>
                <small>{c.hint}</small>
              </div>
            </li>
          ))}
        </ul>
        <div className="match-cierre-actions">
          {canWritePartidos &&
            partido.estado !== 'jugado' &&
            partido.estado !== 'sin_resultado' && (
            <button type="button" disabled={closing} onClick={marcarJugado}>
              {closing
                ? 'Cerrando…'
                : (Number(partido.goles_local) || 0) > 0 ||
                    (Number(partido.goles_visitante) || 0) > 0
                  ? 'Marcar como jugado'
                  : 'Cerrar sin resultado'}
            </button>
          )}
          {!acciones.length && canRead('directo') && (
            <Link to={`/partidos/${id}/directo`}>
              <button type="button" className="ghost">
                Seguir en directo
              </button>
            </Link>
          )}
          <Link to="/analitica">
            <button type="button" className="ghost">
              Ver analítica
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
