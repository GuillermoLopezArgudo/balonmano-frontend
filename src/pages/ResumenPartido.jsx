import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'cronologia', label: 'Cronología' },
  { id: 'acta', label: 'Acta oficial' },
];

export default function ResumenPartido() {
  const { id } = useParams();
  const { equipo } = useAuth();
  const [tab, setTab] = useState('resumen');
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [stats, setStats] = useState([]);
  const [gkStats, setGkStats] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getPartidos(),
      api.getJugadores(),
      api.getEstadisticas(),
      api.getEstadisticasPorteros().catch(() => []),
      api.getAcciones(),
      api.getTiposAccion(),
    ])
      .then(([partidos, jugs, st, gk, acts, tips]) => {
        const p = partidos.find((x) => x.id_partido === id) || null;
        setPartido(p);
        setJugadores(jugs);
        setStats(st.filter((s) => s.id_partido === id));
        setGkStats(gk.filter((s) => s.id_partido === id));
        setAcciones(
          acts
            .filter((a) => a.id_partido === id)
            .sort((a, b) => a.minuto - b.minuto || (a.segundo || 0) - (b.segundo || 0)),
        );
        setTipos(tips);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const resumen = useMemo(() => {
    const goles = stats.reduce((a, s) => a + (s.goles || 0), 0);
    const lanzamientos = stats.reduce((a, s) => a + (s.lanzamientos || 0), 0);
    const perdidas = stats.reduce((a, s) => a + (s.perdidas || 0), 0);
    const paradas = gkStats.reduce((a, s) => a + (s.paradas || 0), 0);
    const recibidos = gkStats.reduce((a, s) => a + (s.lanzamientos_recibidos || 0), 0);
    const efiParadas = recibidos ? Math.round((paradas / recibidos) * 100) : 0;

    const tipoById = Object.fromEntries(tipos.map((t) => [t.id_tipo_accion, t.nombre]));
    const golesAccion = acciones.filter((a) => tipoById[a.id_tipo_accion] === 'Gol').length;
    const fallos = acciones.filter((a) => tipoById[a.id_tipo_accion] === 'Lanzamiento fallado').length;
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
      perdidas: perdidas || acciones.filter((a) => tipoById[a.id_tipo_accion] === 'Pérdida').length,
    };
  }, [stats, gkStats, acciones, tipos, partido, equipo]);

  const porJugador = useMemo(() => {
    const tipoById = Object.fromEntries(tipos.map((t) => [t.id_tipo_accion, t.nombre]));
    const map = {};
    for (const s of stats) {
      map[s.id_jugador] = {
        goles: s.goles || 0,
        lanzamientos: s.lanzamientos || 0,
        perdidas: s.perdidas || 0,
        asistencias: s.asistencias || 0,
      };
    }
    for (const a of acciones) {
      if (!map[a.id_jugador]) {
        map[a.id_jugador] = { goles: 0, lanzamientos: 0, perdidas: 0, asistencias: 0 };
      }
      const nombre = tipoById[a.id_tipo_accion];
      if (nombre === 'Gol') {
        map[a.id_jugador].goles += 1;
        map[a.id_jugador].lanzamientos += 1;
      }
      if (nombre === 'Lanzamiento fallado') map[a.id_jugador].lanzamientos += 1;
      if (nombre === 'Pérdida') map[a.id_jugador].perdidas += 1;
      if (nombre === 'Asistencia') map[a.id_jugador].asistencias += 1;
    }
    return Object.entries(map)
      .map(([jid, vals]) => {
        const j = jugadores.find((x) => x.id_jugador === jid);
        return {
          id: jid,
          nombre: j ? `${j.nombre} ${j.apellido}` : 'Jugador',
          dorsal: j?.dorsal,
          posicion: j?.posiciones?.[0] || '—',
          ...vals,
          efi: vals.lanzamientos ? Math.round((vals.goles / vals.lanzamientos) * 100) : 0,
        };
      })
      .sort((a, b) => b.goles - a.goles || b.lanzamientos - a.lanzamientos);
  }, [stats, acciones, tipos, jugadores]);

  const exportarPdf = () => {
    window.print();
  };

  if (error) return <p className="error">{error}</p>;
  if (!partido) return <p className="muted">Cargando resumen…</p>;

  const tipoById = Object.fromEntries(tipos.map((t) => [t.id_tipo_accion, t.nombre]));

  return (
    <div className="acta-print">
      <header className="page-head no-print">
        <div>
          <p className="page-kicker">
            {partido.jornada ? `JORNADA ${partido.jornada}` : 'PARTIDO'} · INFORME
          </p>
          <h1>Resumen del partido</h1>
        </div>
        <div className="add-player-actions">
          <Link to={`/partidos/${id}/directo`}>
            <button type="button" className="ghost">
              Directo
            </button>
          </Link>
          <button type="button" onClick={exportarPdf}>
            Exportar acta PDF
          </button>
        </div>
      </header>

      <section className="panel match-result-card">
        <div className="match-result-side">
          <strong>{partido.equipo_local_nombre}</strong>
        </div>
        <div className="match-result-score">
          {partido.goles_local} – {partido.goles_visitante}
        </div>
        <div className="match-result-side right">
          <strong>{partido.equipo_visitante_nombre}</strong>
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
      </div>

      <div className="filters roster-filters no-print" style={{ marginTop: '1.15rem' }}>
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

      {tab === 'resumen' && (
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
                <span className="roster-cell">{j.goles} G</span>
                <span className="roster-cell">
                  {j.goles}/{j.lanzamientos}
                </span>
                <span className="roster-cell valor">{j.efi}%</span>
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
            <li>Pérdidas: {resumen.perdidas}</li>
          </ul>
          <h3>Plantilla con participación</h3>
          <ul className="acta-list">
            {porJugador.map((j) => (
              <li key={j.id}>
                #{j.dorsal ?? '—'} {j.nombre} — {j.goles} goles, {j.lanzamientos} lanz., {j.efi}%
              </li>
            ))}
            {!porJugador.length && <li>Sin datos</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
