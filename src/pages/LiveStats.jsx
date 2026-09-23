import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

function isGk(j) {
  return (j.posiciones || []).some((p) => p.toLowerCase().includes('portero'));
}

function eff(goles, tiros) {
  if (!tiros) return 0;
  return Math.round((goles / tiros) * 100);
}

export default function LiveStats() {
  const { id: routePartidoId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { equipo } = useAuth();

  const [partidos, setPartidos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [partidoId, setPartidoId] = useState(routePartidoId || search.get('partido') || '');
  const [score, setScore] = useState({ local: 0, visitante: 0 });
  const [campo, setCampo] = useState({});
  const [porteros, setPorteros] = useState({});
  const [parte1Done, setParte1Done] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getPartidos(), api.getJugadores(), api.getEstadisticas(), api.getEstadisticasPorteros().catch(() => [])])
      .then(([p, j, stats, gkStats]) => {
        setPartidos(p);
        setJugadores(j);
        const pid = routePartidoId || search.get('partido') || p[0]?.id_partido || '';
        setPartidoId(pid);
        const partido = p.find((x) => x.id_partido === pid) || p[0];
        if (partido) {
          setScore({ local: partido.goles_local, visitante: partido.goles_visitante });
        }

        const c = {};
        const g = {};
        for (const player of j) {
          if (isGk(player)) {
            const existing = gkStats.find(
              (s) => s.id_partido === pid && s.id_jugador === player.id_jugador,
            );
            g[player.id_jugador] = {
              paradas: existing?.paradas ?? 0,
              recibidos: existing?.lanzamientos_recibidos ?? 0,
            };
          } else {
            const existing = stats.find(
              (s) => s.id_partido === pid && s.id_jugador === player.id_jugador,
            );
            c[player.id_jugador] = {
              goles: existing?.goles ?? 0,
              lanzamientos: existing?.lanzamientos ?? 0,
            };
          }
        }
        setCampo(c);
        setPorteros(g);
      })
      .catch((e) => setError(e.message));
  }, [routePartidoId, search]);

  const partido = useMemo(
    () => partidos.find((p) => p.id_partido === partidoId),
    [partidos, partidoId],
  );

  const fieldPlayers = useMemo(() => jugadores.filter((j) => !isGk(j)), [jugadores]);
  const gkPlayers = useMemo(() => jugadores.filter((j) => isGk(j)), [jugadores]);

  const kicker = useMemo(() => {
    if (!partido) return 'PARTIDOS / ACTA';
    const fecha = new Date(partido.fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return partido.jornada ? `Jornada ${partido.jornada} · ${fecha}` : fecha;
  }, [partido]);

  const bumpCampo = (id, key, delta) => {
    setCampo((prev) => {
      const cur = prev[id] || { goles: 0, lanzamientos: 0 };
      const next = {
        ...cur,
        [key]: Math.max(0, (cur[key] || 0) + delta),
      };
      if (key === 'goles' && next.goles > next.lanzamientos) {
        next.lanzamientos = next.goles;
      }
      return { ...prev, [id]: next };
    });
    if (key === 'goles') {
      setScore((s) => ({ ...s, local: Math.max(0, s.local + delta) }));
    }
  };

  const bumpGk = (id, key, delta) => {
    setPorteros((prev) => {
      const cur = prev[id] || { paradas: 0, recibidos: 0 };
      const next = {
        ...cur,
        [key]: Math.max(0, (cur[key] || 0) + delta),
      };
      if (key === 'paradas' && next.paradas > next.recibidos) {
        next.recibidos = next.paradas;
      }
      return { ...prev, [id]: next };
    });
  };

  const setCampoValue = (id, key, value) => {
    const n = Math.max(0, Number(value) || 0);
    setCampo((prev) => {
      const cur = prev[id] || { goles: 0, lanzamientos: 0 };
      const next = { ...cur, [key]: n };
      if (key === 'goles' && next.goles > next.lanzamientos) next.lanzamientos = next.goles;
      if (key === 'lanzamientos' && next.lanzamientos < next.goles) next.goles = next.lanzamientos;
      return { ...prev, [id]: next };
    });
  };

  const setGkValue = (id, key, value) => {
    const n = Math.max(0, Number(value) || 0);
    setPorteros((prev) => {
      const cur = prev[id] || { paradas: 0, recibidos: 0 };
      const next = { ...cur, [key]: n };
      if (key === 'paradas' && next.paradas > next.recibidos) next.recibidos = next.paradas;
      if (key === 'recibidos' && next.recibidos < next.paradas) next.paradas = next.recibidos;
      return { ...prev, [id]: next };
    });
  };

  const persist = async (finalize = false) => {
    if (!partidoId) {
      setError('Selecciona un partido');
      return;
    }
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await api.updatePartido(partidoId, {
        goles_local: Number(score.local),
        goles_visitante: Number(score.visitante),
      });

      for (const j of fieldPlayers) {
        const s = campo[j.id_jugador] || { goles: 0, lanzamientos: 0 };
        if (!s.goles && !s.lanzamientos) continue;
        await api.upsertEstadistica({
          id_partido: partidoId,
          id_jugador: j.id_jugador,
          goles: s.goles,
          lanzamientos: s.lanzamientos,
          lanzamientos_fallados: Math.max(0, s.lanzamientos - s.goles),
          minutos_jugados: 60,
        });
      }

      for (const j of gkPlayers) {
        const s = porteros[j.id_jugador] || { paradas: 0, recibidos: 0 };
        if (!s.paradas && !s.recibidos) continue;
        await api.upsertEstadisticaPortero({
          id_partido: partidoId,
          id_jugador: j.id_jugador,
          paradas: s.paradas,
          lanzamientos_recibidos: s.recibidos,
          goles_recibidos: Math.max(0, s.recibidos - s.paradas),
          minutos_jugados: 60,
        });
      }

      setStatus(finalize ? 'Partido finalizado y estadísticas guardadas' : 'Borrador guardado');
      if (finalize) {
        setTimeout(() => navigate('/partidos'), 700);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">{kicker}</p>
          <h1>Registrar estadísticas</h1>
        </div>
        <select
          value={partidoId}
          onChange={(e) => {
            const id = e.target.value;
            setPartidoId(id);
            const p = partidos.find((x) => x.id_partido === id);
            if (p) setScore({ local: p.goles_local, visitante: p.goles_visitante });
            navigate(`/partidos/${id}/estadisticas`, { replace: true });
          }}
          style={{ maxWidth: 280 }}
        >
          <option value="">Seleccionar partido</option>
          {partidos.map((p) => (
            <option key={p.id_partido} value={p.id_partido}>
              {p.equipo_local_nombre} vs {p.equipo_visitante_nombre}
            </option>
          ))}
        </select>
      </header>

      <div className="scoreboard">
        <div className="side" style={{ textAlign: 'left' }}>
          {partido?.equipo_local_nombre || equipo?.datos?.nombre || 'Local'}
        </div>
        <div className="score-edit">
          <input
            type="number"
            min="0"
            value={score.local}
            onChange={(e) => setScore((s) => ({ ...s, local: Number(e.target.value) || 0 }))}
          />
          <span>-</span>
          <input
            type="number"
            min="0"
            value={score.visitante}
            onChange={(e) => setScore((s) => ({ ...s, visitante: Number(e.target.value) || 0 }))}
          />
        </div>
        <div className="side" style={{ textAlign: 'right' }}>
          {partido?.equipo_visitante_nombre || 'Visitante'}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <div className="live-layout acta-layout">
        <section className="panel acta-panel">
          <div className="acta-panel-head">
            <h2>Jugadores de campo</h2>
            <span className="muted">{parte1Done ? '1ª parte cerrada' : '1ª parte'}</span>
          </div>

          <div className="acta-table-head">
            <span>Nombre</span>
            <span>Goles / lanz</span>
            <span>Eficacia</span>
          </div>

          <div className="acta-rows">
            {fieldPlayers.map((j) => {
              const s = campo[j.id_jugador] || { goles: 0, lanzamientos: 0 };
              const pct = eff(s.goles, s.lanzamientos);
              return (
                <div className="acta-row" key={j.id_jugador}>
                  <div className="acta-player">
                    <strong>
                      #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                    </strong>
                    <small>{j.posiciones?.[0] || '—'}</small>
                  </div>
                  <div className="acta-ratio">
                    <button type="button" className="ghost mini" onClick={() => bumpCampo(j.id_jugador, 'goles', -1)}>
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={s.goles}
                      onChange={(e) => setCampoValue(j.id_jugador, 'goles', e.target.value)}
                    />
                    <span>/</span>
                    <input
                      type="number"
                      min="0"
                      value={s.lanzamientos}
                      onChange={(e) => setCampoValue(j.id_jugador, 'lanzamientos', e.target.value)}
                    />
                    <button type="button" className="ghost mini" onClick={() => bumpCampo(j.id_jugador, 'lanzamientos', 1)}>
                      +
                    </button>
                  </div>
                  <strong className="acta-eff">{pct}%</strong>
                </div>
              );
            })}
            {!fieldPlayers.length && <p className="muted">Sin jugadores de campo</p>}
          </div>

          <label className="acta-check">
            <input
              type="checkbox"
              checked={parte1Done}
              onChange={(e) => setParte1Done(e.target.checked)}
            />
            Finalizar la captura de la 1ª parte
          </label>
        </section>

        <section className="panel acta-panel">
          <div className="acta-panel-head">
            <h2>Porteros</h2>
            <span className="muted">Paradas / recibidos</span>
          </div>

          <div className="gk-cards">
            {gkPlayers.map((j) => {
              const s = porteros[j.id_jugador] || { paradas: 0, recibidos: 0 };
              const pct = eff(s.paradas, s.recibidos);
              return (
                <div className="gk-card" key={j.id_jugador}>
                  <h3>
                    #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                  </h3>
                  <div className="gk-stats">
                    <div>
                      <span>Paradas</span>
                      <div className="acta-ratio">
                        <button type="button" className="ghost mini" onClick={() => bumpGk(j.id_jugador, 'paradas', -1)}>
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={s.paradas}
                          onChange={(e) => setGkValue(j.id_jugador, 'paradas', e.target.value)}
                        />
                        <button type="button" className="ghost mini" onClick={() => bumpGk(j.id_jugador, 'paradas', 1)}>
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <span>Tiros recibidos</span>
                      <div className="acta-ratio">
                        <button type="button" className="ghost mini" onClick={() => bumpGk(j.id_jugador, 'recibidos', -1)}>
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={s.recibidos}
                          onChange={(e) => setGkValue(j.id_jugador, 'recibidos', e.target.value)}
                        />
                        <button type="button" className="ghost mini" onClick={() => bumpGk(j.id_jugador, 'recibidos', 1)}>
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <span>Eficacia</span>
                      <strong className="acta-eff">{pct}%</strong>
                    </div>
                  </div>
                </div>
              );
            })}
            {!gkPlayers.length && <p className="muted">Sin porteros en plantilla</p>}
          </div>
        </section>
      </div>

      <div className="acta-footer">
        <p className="muted">
          Finaliza el partido para que se suban las estadísticas al resumen y a las fichas.
        </p>
        <div className="acta-footer-actions">
          <button type="button" className="ghost" disabled={saving || !partidoId} onClick={() => persist(false)}>
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button type="button" disabled={saving || !partidoId} onClick={() => persist(true)}>
            Finalizar partido
          </button>
        </div>
      </div>

      {!partidos.length && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          No hay partidos. <Link to="/partidos">Crea uno en Partidos</Link>.
        </p>
      )}
    </>
  );
}
