import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { FisicoTabs } from './Entrenamientos';

export const TIPOS_PREP = [
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'resistencia', label: 'Resistencia' },
  { value: 'potencia', label: 'Potencia' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'prevencion', label: 'Prevención' },
  { value: 'prepartido', label: 'Prepartido' },
  { value: 'recuperacion', label: 'Recuperación' },
  { value: 'otro', label: 'Otro' },
];

const TIPO_LABEL = Object.fromEntries(TIPOS_PREP.map((t) => [t.value, t.label]));

const INTENSIDAD_LABEL = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

export function labelTipo(tipo) {
  return TIPO_LABEL[tipo] || tipo || '—';
}

export function labelIntensidad(i) {
  return INTENSIDAD_LABEL[i] || null;
}

export default function PreparacionFisica() {
  const { canWriteFisico } = useAuth();
  const [items, setItems] = useState([]);
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (t = tipo) =>
    api
      .getPreparaciones(t ? { tipo: t } : {})
      .then(setItems)
      .catch((e) => setError(e.message));

  useEffect(() => {
    let cancelled = false;
    api
      .getPreparaciones(tipo ? { tipo } : {})
      .then((all) => {
        if (!cancelled) setItems(all);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [tipo]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((p) => {
      const hay = `${p.nombre || ''} ${p.objetivo || ''} ${p.contenido || ''} ${p.tipo || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [items, q]);

  const borrar = async (p) => {
    if (!window.confirm(`¿Eliminar la preparación «${p.nombre}»?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deletePreparacion(p.id_preparacion);
      setStatus('Preparación eliminada');
      setItems((prev) => prev.filter((x) => x.id_preparacion !== p.id_preparacion));
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
          <p className="page-kicker">CONDICIÓN FÍSICA</p>
          <h1>Preparación física</h1>
        </div>
        {canWriteFisico && (
          <div className="add-player-actions">
            <Link to="/preparacion/nueva">
              <button type="button">Nueva preparación</button>
            </Link>
          </div>
        )}
      </header>

      <FisicoTabs />

      <div className="filters roster-filters prep-filters" style={{ marginBottom: '1rem' }}>
        <button type="button" className={!tipo ? 'active' : ''} onClick={() => setTipo('')}>
          Todas
        </button>
        {TIPOS_PREP.map((t) => (
          <button
            key={t.value}
            type="button"
            className={tipo === t.value ? 'active' : ''}
            onClick={() => setTipo(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="field roster-search">
        <label htmlFor="prep-q" className="sr-only">
          Buscar preparación
        </label>
        <input
          id="prep-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, objetivo o contenido…"
          autoComplete="off"
        />
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      <section className="panel club-card">
        {!items.length && (
          <p className="muted">
            Aún no hay preparaciones. Crea una sesión de fuerza, prevención, prepartido…
          </p>
        )}
        {Boolean(items.length) && !filtrados.length && (
          <p className="muted">Ninguna preparación coincide con la búsqueda</p>
        )}
        <div className="prep-list">
          {filtrados.map((p) => {
            const intens = labelIntensidad(p.intensidad);
            return (
              <div className="prep-row" key={p.id_preparacion}>
                <div>
                  <strong>{p.nombre}</strong>
                  <small>
                    <span className={`prep-tipo-badge prep-tipo-${p.tipo}`}>
                      {labelTipo(p.tipo)}
                    </span>
                    {p.duracion_min ? ` · ${p.duracion_min} min` : ''}
                    {intens ? ` · Intensidad ${intens.toLowerCase()}` : ''}
                    {p.actualizado_en
                      ? ` · ${new Date(p.actualizado_en).toLocaleDateString('es-ES')}`
                      : ''}
                  </small>
                  {p.objetivo && <p className="muted prep-objetivo">{p.objetivo}</p>}
                </div>
                <div className="prep-row-actions">
                  <Link to={`/preparacion/${p.id_preparacion}`}>
                    <button type="button" className="ghost">
                      {canWriteFisico ? 'Abrir' : 'Ver'}
                    </button>
                  </Link>
                  {canWriteFisico && (
                    <button
                      type="button"
                      className="ghost danger"
                      disabled={busy}
                      onClick={() => borrar(p)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
