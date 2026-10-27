import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoBasura, IcoLapiz, IcoVer } from '../components/ActionIcons';
import FisicoTabs from '../components/FisicoTabs';

function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(value) {
  if (!value) return null;
  // Mediodía local para evitar cambios de día por timezone
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function defaultFechaLocal() {
  return toDateInput(new Date().toISOString());
}

function sameLocalDay(isoA, isoB) {
  return toDateInput(isoA) && toDateInput(isoA) === toDateInput(isoB);
}

export default function Asistencias() {
  const { canWriteFisico } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [fecha, setFecha] = useState(defaultFechaLocal);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = () =>
    api
      .getAsistencias()
      .then(setItems)
      .catch((e) => setError(e.message));

  useEffect(() => {
    let cancelled = false;
    api
      .getAsistencias()
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

  const ordenados = useMemo(
    () =>
      [...items].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [items]
  );

  const crear = async (e) => {
    e.preventDefault();
    if (!canWriteFisico) return;
    const iso = fromDateInput(fecha);
    if (!iso) {
      setError('Indica una fecha válida');
      return;
    }
    const yaHay = items.some((s) => sameLocalDay(s.fecha, iso));
    if (yaHay) {
      setError('Ya hay una sesión ese día. Solo se permite un entrenamiento al día.');
      return;
    }
    setCreating(true);
    setError('');
    setStatus('');
    try {
      const created = await api.createAsistencia({
        fecha: iso,
        notas: notas.trim() || null,
      });
      navigate(`/preparacion/asistencia/${created.id_sesion}/editar`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  };

  const borrar = async (s) => {
    if (!window.confirm('¿Eliminar esta sesión y sus marcajes?')) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteAsistencia(s.id_sesion);
      setStatus('Sesión eliminada');
      setItems((prev) => prev.filter((x) => x.id_sesion !== s.id_sesion));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">ASISTENCIA</p>
          <h1>Asistencia</h1>
        </div>
      </header>

      <FisicoTabs />

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}

      {canWriteFisico && (
        <form className="panel club-card" onSubmit={crear} style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Nueva sesión</h2>
          <div className="jugada-editor-meta" style={{ padding: 0, background: 'transparent', border: 0 }}>
            <div className="field">
              <label htmlFor="asis-fecha">Día del entrenamiento</label>
              <input
                id="asis-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
            <div className="field jugada-desc-field">
              <label htmlFor="asis-notas">Notas</label>
              <input
                id="asis-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional (ej. técnica, físico…)"
                maxLength={2000}
              />
            </div>
          </div>
          <div className="add-player-actions" style={{ marginTop: '0.75rem' }}>
            <button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear sesión'}
            </button>
          </div>
        </form>
      )}

      <section className="panel club-card">
        {!ordenados.length && (
          <p className="muted">Aún no hay sesiones. Crea una para marcar presentes y faltas.</p>
        )}
        <div className="jugadas-list">
          {ordenados.map((s) => {
            const when = new Date(s.fecha);
            return (
              <div className="jugada-row" key={s.id_sesion}>
                <div>
                  <strong>
                    {when.toLocaleDateString('es-ES', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                  <small>
                    {s.marcadas || 0} marcadas
                    {s.presentes || s.faltas || s.justificadas
                      ? ` · ${s.presentes || 0} presentes · ${s.faltas || 0} faltas · ${
                          s.justificadas || 0
                        } just.`
                      : ''}
                  </small>
                  {s.notas && <p className="muted jugada-desc">{s.notas}</p>}
                </div>
                <div className="jugada-row-actions">
                  <Link
                    to={`/preparacion/asistencia/${s.id_sesion}`}
                    className="btn-icon-view"
                    title="Ver"
                    aria-label="Ver asistencia"
                  >
                    <IcoVer />
                  </Link>
                  {canWriteFisico && (
                    <>
                      <Link
                        to={`/preparacion/asistencia/${s.id_sesion}/editar`}
                        className="btn-icon-edit"
                        title="Editar"
                        aria-label="Editar asistencia"
                      >
                        <IcoLapiz />
                      </Link>
                      <button
                        type="button"
                        className="btn-icon-del"
                        disabled={busy}
                        title="Eliminar"
                        aria-label="Eliminar asistencia"
                        onClick={() => borrar(s)}
                      >
                        <IcoBasura />
                      </button>
                    </>
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
