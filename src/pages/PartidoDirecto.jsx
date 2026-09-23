import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

const ACCIONES = [
  { key: 'gol', label: 'Gol', tipo: 'Gol' },
  { key: 'fallo', label: 'Fallo', tipo: 'Lanzamiento fallado' },
  { key: 'parada', label: 'Parada', tipo: 'Parada' },
  { key: 'perdida', label: 'Pérdida', tipo: 'Pérdida' },
  { key: 'sancion', label: 'Sanción', tipo: 'Exclusión 2 min' },
];

const ZONAS = [
  { key: 'frontal', label: 'Frontal' },
  { key: 'extremo', label: 'Ext.' },
  { key: 'interior', label: 'Int.' },
  { key: 'pivote', label: '6 m' },
  { key: '7m', label: '7 m' },
  { key: 'contra', label: 'Contra' },
];

function fmtTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  const [running, setRunning] = useState(true);
  const [accion, setAccion] = useState('gol');
  const [jugadorId, setJugadorId] = useState('');
  const [zona, setZona] = useState('frontal');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');
  const tickRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.getPartidos(),
      api.getJugadores(),
      api.getTiposAccion(),
      api.getAcciones(),
    ])
      .then(async ([plist, jugs, tips, acts]) => {
        setPartidos(plist);
        setTipos(tips);
        const pid = routeId || plist[0]?.id_partido || '';
        setPartidoId(pid);
        const p = plist.find((x) => x.id_partido === pid) || null;
        setPartido(p);
        if (p) setScore({ local: p.goles_local, visitante: p.goles_visitante });
        setAcciones(acts.filter((a) => a.id_partido === pid));

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
        setJugadores(pool);
        if (pool[0]) setJugadorId(pool[0].id_jugador);
      })
      .catch((e) => setError(e.message));
  }, [routeId]);

  useEffect(() => {
    if (!running) return undefined;
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const minuto = Math.min(60, Math.floor(seconds / 60) + (parte === 2 ? 30 : 0));
  const segundo = seconds % 60;

  const tipoSeleccionado = useMemo(() => {
    const def = ACCIONES.find((a) => a.key === accion);
    return tipos.find((t) => t.nombre === def?.tipo) || null;
  }, [accion, tipos]);

  const onPickPartido = (pid) => {
    setPartidoId(pid);
    navigate(`/partidos/${pid}/directo`, { replace: true });
  };

  const registrar = async () => {
    if (!partidoId || !jugadorId || !tipoSeleccionado) {
      setError('Selecciona partido, jugador y tipo de acción');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api.createAccion({
        id_partido: partidoId,
        id_jugador: jugadorId,
        id_tipo_accion: tipoSeleccionado.id_tipo_accion,
        minuto,
        segundo,
        zona,
      });

      if (accion === 'gol' && partido) {
        const soyLocal = partido.id_equipo_local === equipo?.id_equipo;
        const nextScore = soyLocal
          ? { ...score, local: score.local + 1 }
          : { ...score, visitante: score.visitante + 1 };
        setScore(nextScore);
        await api.updatePartido(partidoId, {
          goles_local: nextScore.local,
          goles_visitante: nextScore.visitante,
        });
      }

      setAcciones((prev) => [...prev, created]);
      setFlash(`${ACCIONES.find((a) => a.key === accion)?.label} registrado`);
      setTimeout(() => setFlash(''), 1200);
    } catch (err) {
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
              <Link to={`/partidos/${partidoId}/estadisticas`}>
                <button type="button" className="ghost">
                  Acta
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
            EN DIRECTO {fmtTime(seconds)}
            <button
              type="button"
              className="ghost mini"
              onClick={() => setRunning((r) => !r)}
              style={{ marginLeft: '0.5rem' }}
            >
              {running ? '❚❚' : '▶'}
            </button>
            <button
              type="button"
              className="ghost mini"
              onClick={() => {
                setParte((p) => (p === 1 ? 2 : 1));
                setSeconds(0);
              }}
              style={{ marginLeft: '0.35rem' }}
            >
              {parte === 1 ? '→ 2ª' : '→ 1ª'}
            </button>
          </div>
        </div>
        <div className="live-board-team right">{partido?.equipo_visitante_nombre || 'Visitante'}</div>
      </div>

      {error && <p className="error">{error}</p>}
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
                onClick={() => setAccion(a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: '1rem' }}>
            <label>Jugador</label>
            <select value={jugadorId} onChange={(e) => setJugadorId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {jugadores.map((j) => (
                <option key={j.id_jugador} value={j.id_jugador}>
                  #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                  {j.posiciones?.[0] ? ` · ${j.posiciones[0]}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Zona</label>
            <div className="live-zonas">
              {ZONAS.map((z) => (
                <button
                  type="button"
                  key={z.key}
                  className={zona === z.key ? 'active' : ''}
                  onClick={() => setZona(z.key)}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          <div className="live-submit-row">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setAccion('gol');
                setZona('frontal');
              }}
            >
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
                    {a.zona ? ` · ${a.zona}` : ''}
                  </span>
                  <small>{j ? `#${j.dorsal ?? '—'} ${j.nombre}` : '—'}</small>
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
