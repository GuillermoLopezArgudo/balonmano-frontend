import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { IcoFlecha } from '../components/ActionIcons';
import { useAbortable } from '../useAbortable';

const PAGE = 40;

const FILTROS = [
  { key: '', label: 'Todos' },
  { key: 'auth.login', label: 'Accesos' },
  { key: 'auth.login_fail', label: 'Fallos' },
  { key: 'auth.logout', label: 'Salidas' },
  { key: 'directo.accion', label: 'Directo' },
  { key: 'miembro.invitar', label: 'Miembros' },
  { key: 'partido.editar', label: 'Partidos' },
  { key: 'cuotas.editar', label: 'Cuotas' },
  { key: 'jugador.editar', label: 'Plantilla' },
];

function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function shortUa(ua) {
  if (!ua) return '—';
  const s = ua.slice(0, 72);
  return ua.length > 72 ? `${s}…` : s;
}

export default function Auditoria() {
  const { canManageClub } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [retention, setRetention] = useState(180);
  const [offset, setOffset] = useState(0);
  const [filtro, setFiltro] = useState('');
  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useAbortable(
    async ({ signal, alive }) => {
      if (!canManageClub) return;
      setLoading(true);
      setError('');
      try {
        const data = await api.getAuditoria({
          limit: PAGE,
          offset,
          accion: filtro || undefined,
          q: q || undefined,
          signal,
        });
        if (!alive()) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
        setRetention(data.retention_days || 180);
      } catch (err) {
        if (!alive() || isAbortError(err)) return;
        setError(err.message || 'No se pudo cargar la auditoría');
      } finally {
        if (alive()) setLoading(false);
      }
    },
    [canManageClub, offset, filtro, q, tick],
  );

  if (!canManageClub) return <Navigate to="/club" replace />;

  return (
    <div className="auditoria-page">
      <header className="page-head">
        <div>
          <p className="page-kicker">CLUB · SEGURIDAD</p>
          <h1>Auditoría</h1>
        </div>
        <div className="add-player-actions page-head-actions-beside">
          <button type="button" className="ghost" onClick={() => setTick((n) => n + 1)}>
            Actualizar
          </button>
          <Link className="page-back" to="/club">
            <button type="button" className="ghost">
              <IcoFlecha />
              Volver
            </button>
          </Link>
        </div>
      </header>

      <div className="filters roster-filters">
        {FILTROS.map((f) => (
          <button
            type="button"
            key={f.key || 'all'}
            className={filtro === f.key ? 'active' : ''}
            onClick={() => {
              setFiltro(f.key);
              setOffset(0);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <form
        className="auditoria-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(qDraft.trim());
          setOffset(0);
        }}
      >
        <input
          type="search"
          placeholder="Buscar por persona, IP o acción…"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          aria-label="Buscar en auditoría"
        />
        <button type="submit">Buscar</button>
      </form>

      <p className="muted auditoria-meta">
        {total} evento{total === 1 ? '' : 's'} · retención {retention} días
      </p>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Cargando…</p>}

      {!loading && !items.length && (
        <p className="muted">Aún no hay eventos registrados.</p>
      )}

      {!!items.length && (
        <div className="table-wrap auditoria-table-wrap">
          <table className="auditoria-table">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Quién</th>
                <th>Qué</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id_audit}>
                  <td data-label="Cuándo">{fmtWhen(row.creado_en)}</td>
                  <td data-label="Quién">
                    <strong>{row.actor_nombre || '—'}</strong>
                    {row.actor_correo && (
                      <small className="muted">{row.actor_correo}</small>
                    )}
                  </td>
                  <td data-label="Qué">
                    <span className="auditoria-accion">{row.resumen}</span>
                    {row.accion?.startsWith('auth.login_fail') && (
                      <span className="auditoria-badge warn">fallo</span>
                    )}
                  </td>
                  <td data-label="Desde" title={row.user_agent || ''}>
                    <code className="auditoria-ip">{row.ip || '—'}</code>
                    <small className="muted">{shortUa(row.user_agent)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE && (
        <div className="auditoria-pager">
          <button
            type="button"
            className="ghost"
            disabled={offset <= 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
          >
            Anterior
          </button>
          <span className="muted">
            {offset + 1}–{Math.min(offset + PAGE, total)} de {total}
          </span>
          <button
            type="button"
            className="ghost"
            disabled={offset + PAGE >= total}
            onClick={() => setOffset((o) => o + PAGE)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
