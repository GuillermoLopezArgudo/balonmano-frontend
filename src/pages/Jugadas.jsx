import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { IcoBasura, IcoLapiz, IcoVer } from '../components/ActionIcons';
import FilterChips from '../components/FilterChips';
import PageHeader from '../components/PageHeader';
import SinAcceso from '../components/SinAcceso';
import { useJugadaCatalog } from '../hooks/useJugadaCatalog';

const FASES = [
  { id: '', label: 'Todas' },
  { id: 'ataque', label: 'Ataque' },
  { id: 'defensa', label: 'Defensa' },
];

export default function Jugadas() {
  const { canWriteJugadas, canRead } = useAuth();
  const puedeVer = canRead('jugadas');
  const [fase, setFase] = useState('');
  const { items, q, setQ, error, status, busy, filtrados, copiar, borrar } = useJugadaCatalog({
    ambito: 'tactica',
    fase,
    canWrite: canWriteJugadas,
    labelSingular: 'jugada',
    enabled: puedeVer,
  });

  if (!puedeVer) return <SinAcceso que="las jugadas" />;

  return (
    <>
      <PageHeader kicker="TACTICA" title="Jugadas">
        {canWriteJugadas && (
          <Link to="/jugadas/nueva">
            <button type="button">Nueva jugada</button>
          </Link>
        )}
      </PageHeader>

      <FilterChips options={FASES} value={fase} onChange={setFase} style={{ marginBottom: '1rem' }} />

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
