import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoBasura, IcoLapiz, IcoVer } from '../components/ActionIcons';

export function FisicoTabs({ end = null }) {
  return (
    <div className="filters roster-filters fisico-tabs" style={{ marginBottom: '1rem' }}>
      <NavLink
        to="/preparacion/entrenamiento"
        end
        className={({ isActive }) => (isActive ? 'active' : undefined)}
      >
        Entrenamientos
      </NavLink>
      <NavLink
        to="/preparacion/asistencia"
        className={({ isActive }) => (isActive ? 'active' : undefined)}
      >
        Asistencia
      </NavLink>
      <NavLink to="/preparacion" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
        Físico
      </NavLink>
      {end}
    </div>
  );
}

export default function Entrenamientos() {
  const { canWriteFisico } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .getJugadas({ ambito: 'fisico' })
      .then(setItems)
      .catch((e) => setError(e.message));

  useEffect(() => {
    let cancelled = false;
    api
      .getJugadas({ ambito: 'fisico' })
      .then((all) => {
        if (!cancelled) setItems(all);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((j) => {
      const hay = `${j.nombre || ''} ${j.descripcion || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [items, q]);

  const copiar = async (j) => {
    setBusy(true);
    setError('');
    try {
      await api.copyJugada(j.id_jugada, { nombre: `${j.nombre} (copia)` });
      setStatus('Copia creada');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (j) => {
    if (!window.confirm(`¿Eliminar el entrenamiento «${j.nombre}»?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteJugada(j.id_jugada);
      setStatus('Entrenamiento eliminado');
      setItems((prev) => prev.filter((x) => x.id_jugada !== j.id_jugada));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">ENTRENAMIENTOS</p>
          <h1>Entrenamientos</h1>
        </div>
        {canWriteFisico && (
          <div className="add-player-actions page-head-actions-beside">
            <Link to="/preparacion/entrenamiento/nueva">
              <button type="button">Nuevo entrenamiento</button>
            </Link>
          </div>
        )}
      </header>

      <FisicoTabs />

      <div className="field roster-search">
        <label htmlFor="ent-q" className="sr-only">
          Buscar entrenamiento
        </label>
        <input
          id="ent-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o notas…"
          autoComplete="off"
        />
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <section className="panel club-card">
        {!items.length && (
          <p className="muted">
            Aún no hay entrenamientos. Crea uno en campo completo o en media pista para reutilizarlo
            en pista.
          </p>
        )}
        {Boolean(items.length) && !filtrados.length && (
          <p className="muted">Ningún entrenamiento coincide con la búsqueda</p>
        )}
        <div className="jugadas-list">
          {filtrados.map((j) => (
            <div className="jugada-row" key={j.id_jugada}>
              <div>
                <strong>{j.nombre}</strong>
                <small>
                  <span className="prep-tipo-badge">
                    {j.fase === 'completo' ? 'Campo completo' : 'Media pista'}
                  </span>
                  {' · '}
                  {j.num_pasos} paso{j.num_pasos === 1 ? '' : 's'} · {j.num_piezas} piezas
                  {j.actualizado_en
                    ? ` · ${new Date(j.actualizado_en).toLocaleDateString('es-ES')}`
                    : ''}
                </small>
                {j.descripcion && <p className="muted jugada-desc">{j.descripcion}</p>}
              </div>
              <div className="jugada-row-actions">
                <Link
                  to={`/preparacion/entrenamiento/${j.id_jugada}`}
                  className="btn-icon-view"
                  title="Ver"
                  aria-label="Ver entrenamiento"
                >
                  <IcoVer />
                </Link>
                {canWriteFisico && (
                  <>
                    <Link
                      to={`/preparacion/entrenamiento/${j.id_jugada}/editar`}
                      className="btn-icon-edit"
                      title="Editar"
                      aria-label="Editar entrenamiento"
                    >
                      <IcoLapiz />
                    </Link>
                    <button type="button" className="ghost" disabled={busy} onClick={() => copiar(j)}>
                      Copiar
                    </button>
                    <button
                      type="button"
                      className="btn-icon-del"
                      disabled={busy}
                      title="Eliminar"
                      aria-label="Eliminar entrenamiento"
                      onClick={() => borrar(j)}
                    >
                      <IcoBasura />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
