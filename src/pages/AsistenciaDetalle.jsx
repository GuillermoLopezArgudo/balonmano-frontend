import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoFlecha, IcoLapiz } from '../components/ActionIcons';
import { FisicoTabs } from './Entrenamientos';

const ESTADOS = [
  { key: 'presente', label: 'Presente' },
  { key: 'falta', label: 'Falta' },
  { key: 'justificada', label: 'Justificada' },
];

function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(value) {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AsistenciaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { canWriteFisico } = useAuth();
  const editing = canWriteFisico && location.pathname.endsWith('/editar');
  const [data, setData] = useState(null);
  const [estados, setEstados] = useState({});
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getAsistencia(id)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setFecha(toDateInput(res.fecha));
        setNotas(res.notas || '');
        const map = {};
        for (const item of res.items || []) {
          if (item.estado) map[item.id_jugador] = item.estado;
        }
        setEstados(map);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const counts = useMemo(() => {
    let presentes = 0;
    let faltas = 0;
    let justificadas = 0;
    let sinMarcar = 0;
    const total = data?.items?.length || 0;
    for (const item of data?.items || []) {
      const v = estados[item.id_jugador];
      if (v === 'presente') presentes += 1;
      else if (v === 'falta') faltas += 1;
      else if (v === 'justificada') justificadas += 1;
      else sinMarcar += 1;
    }
    return { presentes, faltas, justificadas, sinMarcar, total };
  }, [estados, data]);

  const setAll = (estado) => {
    if (!editing || !data?.items?.length) return;
    if (estado == null) {
      setEstados({});
      return;
    }
    const next = {};
    for (const item of data.items) next[item.id_jugador] = estado;
    setEstados(next);
  };

  const toggleEstado = (idJugador, key) => {
    if (!editing) return;
    setEstados((prev) => {
      const next = { ...prev };
      if (next[idJugador] === key) delete next[idJugador];
      else next[idJugador] = key;
      return next;
    });
  };

  const guardar = async () => {
    if (!editing) return;
    const iso = fromDateInput(fecha);
    if (!iso) {
      setError('Indica una fecha válida');
      return;
    }
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await api.updateAsistencia(id, {
        fecha: iso,
        notas: notas.trim() || null,
      });
      const items = Object.entries(estados)
        .filter(([, estado]) => estado === 'presente' || estado === 'falta' || estado === 'justificada')
        .map(([id_jugador, estado]) => ({ id_jugador, estado }));
      const res = await api.putAsistenciaMarcajes(id, { items });
      setData(res);
      setFecha(toDateInput(res.fecha));
      setNotas(res.notas || '');
      const map = {};
      for (const item of res.items || []) {
        if (item.estado) map[item.id_jugador] = item.estado;
      }
      setEstados(map);
      setStatus('Asistencia guardada');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="muted" style={{ padding: '2rem' }}>
        Cargando asistencia…
      </p>
    );
  }

  if (!data && error) {
    return (
      <>
        <p className="error">{error}</p>
        <Link className="volver-link" to="/preparacion/asistencia">
          <IcoFlecha />
          Volver a asistencia
        </Link>
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">
            <Link to="/preparacion/asistencia">ASISTENCIA</Link>
            {' / SESIÓN'}
          </p>
          <h1>{editing ? 'Editar asistencia' : 'Asistencia'}</h1>
        </div>
        <button
          type="button"
          className="ghost page-back"
          onClick={() => navigate('/preparacion/asistencia')}
        >
          <IcoFlecha />
          Volver
        </button>
        <div className="add-player-actions">
          {canWriteFisico && !editing && (
            <Link
              to={`/preparacion/asistencia/${id}/editar`}
              className="btn-icon-edit"
              title="Editar"
              aria-label="Editar asistencia"
            >
              <IcoLapiz />
            </Link>
          )}
          {editing && (
            <button type="button" disabled={saving} onClick={guardar}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </div>
      </header>

      <FisicoTabs />

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}
      {!editing && (
        <p className="hint">
          {canWriteFisico
            ? 'Estás en modo consulta. Usa Editar para cambiar marcajes.'
            : 'Tu cargo solo permite consultar la asistencia.'}
        </p>
      )}

      <div className="jugada-editor-meta panel club-card" style={{ marginBottom: '1rem' }}>
        <div className="field">
          <label htmlFor="asis-det-fecha">Día del entrenamiento</label>
          <input
            id="asis-det-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={!editing}
          />
        </div>
        <div className="field jugada-desc-field">
          <label htmlFor="asis-det-notas">Notas</label>
          <input
            id="asis-det-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Opcional"
            maxLength={2000}
            disabled={!editing}
          />
        </div>
      </div>

      <div className="metrics analitica-kpis" style={{ marginBottom: '1rem' }}>
        <div className="metric">
          <span>Presentes</span>
          <strong className="c-lime">{counts.presentes}</strong>
        </div>
        <div className="metric">
          <span>Faltas</span>
          <strong className="c-orange">{counts.faltas}</strong>
        </div>
        <div className="metric">
          <span>Justificadas</span>
          <strong className="c-cyan">{counts.justificadas}</strong>
        </div>
        <div className="metric">
          <span>Sin marcar</span>
          <strong className="muted">{counts.sinMarcar}</strong>
        </div>
      </div>

      {editing && (
        <div className="filters roster-filters" style={{ marginBottom: '0.85rem' }}>
          <button type="button" className="ghost" onClick={() => setAll('presente')}>
            Todas presentes
          </button>
          <button type="button" className="ghost" onClick={() => setAll('falta')}>
            Todas falta
          </button>
          <button type="button" className="ghost" onClick={() => setAll(null)}>
            Quitar marcas
          </button>
        </div>
      )}

      <section className="panel club-card">
        <p className="muted" style={{ marginTop: 0 }}>
          Nadie viene marcado por defecto. Elige Presente, Falta o Justificada
          {editing ? ' (vuelve a pulsar para quitar la marca)' : ''}.
        </p>
        <div className="roster-list">
          {(data?.items || []).map((j) => {
            const marcado = estados[j.id_jugador];
            return (
              <div
                className={`roster-row asis-row${!marcado ? ' asis-sin-marcar' : ''}`}
                key={j.id_jugador}
              >
                <div className="roster-player">
                  <span>
                    <strong>
                      #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                    </strong>
                    {!marcado && <small>Sin marcar</small>}
                  </span>
                </div>
                <div className="asis-estados" role="group" aria-label={`Asistencia de ${j.nombre}`}>
                  {ESTADOS.map((e) => (
                    <button
                      type="button"
                      key={e.key}
                      className={`asis-estado asis-${e.key}${
                        marcado === e.key ? ' active' : ''
                      }`}
                      disabled={!editing}
                      onClick={() => toggleEstado(j.id_jugador, e.key)}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!data?.items?.length && (
            <p className="muted">No hay jugadoras activas en la plantilla.</p>
          )}
        </div>
      </section>
    </>
  );
}
