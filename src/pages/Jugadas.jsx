import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoBasura, IcoLapiz, IcoVer } from '../components/ActionIcons';
import SinAcceso from '../components/SinAcceso';

export default function Jugadas() {
  const { canWriteJugadas, canRead } = useAuth();
  const puedeVer = canRead('jugadas');
  const [items, setItems] = useState([]);
  const [fase, setFase] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (f = fase) =>
    api
      .getJugadas(f ? { fase: f, ambito: 'tactica' } : { ambito: 'tactica' })
      .then(setItems)
      .catch((e) => setError(e.message));

  useEffect(() => {
    if (!puedeVer) return undefined;
    let cancelled = false;
    api
      .getJugadas(fase ? { fase, ambito: 'tactica' } : { ambito: 'tactica' })
      .then((all) => {
        if (!cancelled) setItems(all);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [fase, puedeVer]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((j) => {
      const hay = `${j.nombre || ''} ${j.descripcion || ''} ${j.fase || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [items, q]);

  const copiar = async (j) => {
    setBusy(true);
    setError('');
    try {
      await api.copyJugada(j.id_jugada);
      setStatus('Copia creada');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (j) => {
    if (!window.confirm(`¿Eliminar la jugada «${j.nombre}»?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteJugada(j.id_jugada);
      setStatus('Jugada eliminada');
      setItems((prev) => prev.filter((x) => x.id_jugada !== j.id_jugada));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!puedeVer) return <SinAcceso que="las jugadas" />;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">TACTICA</p>
          <h1>Jugadas</h1>
        </div>
        {canWriteJugadas && (
          <div className="add-player-actions page-head-actions-beside">
            <Link to="/jugadas/nueva">
              <button type="button">Nueva jugada</button>
            </Link>
          </div>
        )}
      </header>

      <div className="filters roster-filters" style={{ marginBottom: '1rem' }}>
        <button type="button" className={!fase ? 'active' : ''} onClick={() => setFase('')}>
          Todas
        </button>
        <button
          type="button"
          className={fase === 'ataque' ? 'active' : ''}
          onClick={() => setFase('ataque')}
        >
          Ataque
        </button>
        <button
          type="button"
          className={fase === 'defensa' ? 'active' : ''}
          onClick={() => setFase('defensa')}
        >
          Defensa
        </button>
      </div>

      <div className="field roster-search">
        <label htmlFor="jugadas-q" className="sr-only">
          Buscar jugada
        </label>
        <input
          id="jugadas-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, descripción o fase…"
          autoComplete="off"
        />
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <section className="panel club-card">
        {!items.length && (
          <p className="muted">
            Aún no hay jugadas. Crea una para dibujar movimientos paso a paso.
          </p>
        )}
        {Boolean(items.length) && !filtrados.length && (
          <p className="muted">Ninguna jugada coincide con la búsqueda</p>
        )}
        <div className="jugadas-list">
          {filtrados.map((j) => (
            <div className="jugada-row" key={j.id_jugada}>
              <div>
                <strong>{j.nombre}</strong>
                <small>
                  <span className={`alin-tipo-badge alin-tipo-${j.fase}`}>
                    {j.fase === 'defensa' ? 'Defensa' : 'Ataque'}
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
                  to={`/jugadas/${j.id_jugada}`}
                  className="btn-icon-view"
                  title="Ver"
                  aria-label="Ver jugada"
                >
                  <IcoVer />
                </Link>
                {canWriteJugadas && (
                  <>
                    <Link
                      to={`/jugadas/${j.id_jugada}/editar`}
                      className="btn-icon-edit"
                      title="Editar"
                      aria-label="Editar jugada"
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
                      aria-label="Eliminar jugada"
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
