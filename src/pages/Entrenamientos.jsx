import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { IcoBasura, IcoLapiz, IcoVer } from '../components/ActionIcons';
import FisicoTabs from '../components/FisicoTabs';
import PageHeader from '../components/PageHeader';
import { useJugadaCatalog } from '../hooks/useJugadaCatalog';

export default function Entrenamientos() {
  const { canWriteFisico } = useAuth();
  const { items, q, setQ, error, status, busy, filtrados, copiar, borrar } = useJugadaCatalog({
    ambito: 'fisico',
    canWrite: canWriteFisico,
    labelSingular: 'entrenamiento',
  });

  return (
    <>
      <PageHeader kicker="ENTRENAMIENTOS" title="Entrenamientos">
        {canWriteFisico && (
          <Link to="/preparacion/entrenamiento/nueva">
            <button type="button">Nuevo entrenamiento</button>
          </Link>
        )}
      </PageHeader>

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
