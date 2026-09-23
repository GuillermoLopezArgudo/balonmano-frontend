import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

const MAX_CONV = 16;
const MAX_TIT = 7;
const TABS = [
  { id: 'convocatoria', label: 'Convocatoria' },
  { id: 'alineacion', label: 'Alineación inicial' },
  { id: 'banquillo', label: 'Banquillo' },
];

export default function Convocatoria() {
  const { id } = useParams();
  const { equipo } = useAuth();
  const [tab, setTab] = useState('convocatoria');
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [selected, setSelected] = useState({}); // id -> rol
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getPartidos(),
      api.getJugadores(),
      api.getConvocatoria(id).catch(() => ({ items: [] })),
    ])
      .then(([partidos, jugs, conv]) => {
        setPartido(partidos.find((p) => p.id_partido === id) || null);
        setJugadores(jugs.filter((j) => j.activo !== false));
        const map = {};
        for (const item of conv.items || []) {
          map[item.id_jugador] = item.rol;
        }
        setSelected(map);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const convocados = useMemo(
    () => Object.keys(selected).filter((jid) => selected[jid]),
    [selected],
  );
  const titulares = useMemo(
    () => convocados.filter((jid) => selected[jid] === 'titular'),
    [convocados, selected],
  );
  const banquillo = useMemo(
    () => convocados.filter((jid) => selected[jid] === 'banquillo' || selected[jid] === 'convocado'),
    [convocados, selected],
  );

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jugadores.filter((j) => {
      if (!term) return true;
      const hay = `${j.nombre} ${j.apellido} ${j.dorsal ?? ''} ${(j.posiciones || []).join(' ')}`.toLowerCase();
      return hay.includes(term);
    });
  }, [jugadores, q]);

  const byId = useMemo(() => {
    const map = {};
    for (const j of jugadores) map[j.id_jugador] = j;
    return map;
  }, [jugadores]);

  const toggleConvocado = (jid) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[jid]) {
        delete next[jid];
      } else {
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
      if (rol === 'titular') {
        const nTit = Object.values(prev).filter((r) => r === 'titular').length;
        if (prev[jid] !== 'titular' && nTit >= MAX_TIT) {
          setError(`Máximo ${MAX_TIT} titulares`);
          return prev;
        }
      }
      setError('');
      return { ...prev, [jid]: rol };
    });
  };

  const persist = async (confirmada = false) => {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const payload = {
        items: Object.entries(selected).map(([id_jugador, rol]) => ({ id_jugador, rol })),
        confirmada,
      };
      await api.saveConvocatoria(id, payload);
      setStatus(confirmada ? 'Convocatoria confirmada' : 'Convocatoria guardada');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
    if (tab === 'alineacion') return titulares;
    if (tab === 'banquillo') return banquillo;
    return convocados;
  };

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
          <button type="button" disabled={saving} onClick={() => persist(true)}>
            {saving ? 'Guardando…' : 'Confirmar convocatoria'}
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
            className={`conv-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'alineacion' ? ` ${titulares.length}/${MAX_TIT}` : ''}
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

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <div className="conv-layout">
        <section className="panel club-card">
          <h2>Plantilla disponible</h2>
          <div className="field">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, dorsal o posición…"
            />
          </div>
          <div className="conv-list">
            {filtrados.map((j) => {
              const checked = Boolean(selected[j.id_jugador]);
              return (
                <label
                  key={j.id_jugador}
                  className={`conv-player${checked ? ' on' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleConvocado(j.id_jugador)}
                  />
                  <span className="conv-dorsal">#{j.dorsal ?? '—'}</span>
                  <span className="conv-name">
                    <strong>
                      {j.nombre} {j.apellido}
                    </strong>
                    <small>{j.posiciones?.[0] || 'Sin posición'}</small>
                  </span>
                </label>
              );
            })}
            {!filtrados.length && <p className="muted">Sin jugadores</p>}
          </div>
        </section>

        <section className="panel club-card">
          <h2>
            {tab === 'alineacion'
              ? 'Alineación inicial'
              : tab === 'banquillo'
                ? 'Banquillo'
                : 'Selección actual'}
          </h2>
          <div className="conv-selected">
            {listForTab().map((jid) => {
              const j = byId[jid];
              if (!j) return null;
              return (
                <div className="conv-selected-row" key={jid}>
                  <div>
                    <strong>
                      #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                    </strong>
                    <small>{j.posiciones?.[0] || '—'}</small>
                  </div>
                  <select
                    value={selected[jid]}
                    onChange={(e) => setRol(jid, e.target.value)}
                  >
                    <option value="convocado">Convocado</option>
                    <option value="titular">Titular</option>
                    <option value="banquillo">Banquillo</option>
                  </select>
                </div>
              );
            })}
            {!listForTab().length && (
              <p className="muted">
                {tab === 'alineacion'
                  ? 'Marca titulares desde la selección'
                  : tab === 'banquillo'
                    ? 'Los convocados no titulares aparecen aquí'
                    : 'Selecciona jugadores de la plantilla'}
              </p>
            )}
          </div>
          <button
            type="button"
            className="ghost full"
            style={{ marginTop: '1rem' }}
            disabled={saving}
            onClick={() => persist(false)}
          >
            Guardar borrador
          </button>
        </section>
      </div>

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
    </>
  );
}
