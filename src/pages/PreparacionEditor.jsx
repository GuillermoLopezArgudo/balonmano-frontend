import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoFlecha, IcoLapiz } from '../components/ActionIcons';
import { TIPOS_PREP } from './PreparacionFisica';

const empty = {
  nombre: '',
  tipo: 'fuerza',
  objetivo: '',
  contenido: '',
  duracion_min: '',
  intensidad: '',
};

export default function PreparacionEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'nueva';
  const navigate = useNavigate();
  const location = useLocation();
  const { canWriteFisico } = useAuth();
  const mayWrite = canWriteFisico;
  const editing = isNew || (mayWrite && location.pathname.endsWith('/editar'));
  const soloLectura = !editing;

  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (isNew) {
      setForm(empty);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getPreparacion(id)
      .then((p) => {
        if (cancelled) return;
        setForm({
          nombre: p.nombre || '',
          tipo: p.tipo || 'fuerza',
          objetivo: p.objetivo || '',
          contenido: p.contenido || '',
          duracion_min: p.duracion_min != null ? String(p.duracion_min) : '',
          intensidad: p.intensidad || '',
        });
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
  }, [id, isNew]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (soloLectura) return;
    const nombre = form.nombre.trim();
    if (!nombre) {
      setError('Pon un nombre a la preparación');
      return;
    }
    setSaving(true);
    setError('');
    setStatus('');
    const payload = {
      nombre,
      tipo: form.tipo,
      objetivo: form.objetivo.trim() || null,
      contenido: form.contenido.trim() || null,
      duracion_min: form.duracion_min ? Number(form.duracion_min) : null,
      intensidad: form.intensidad || null,
    };
    try {
      if (isNew) {
        const created = await api.createPreparacion(payload);
        setStatus('Preparación creada');
        navigate(`/preparacion/${created.id_preparacion}/editar`, { replace: true });
      } else {
        await api.updatePreparacion(id, payload);
        setStatus('Guardado');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="muted" style={{ padding: '1rem 0' }}>Cargando…</p>;
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">CONDICIÓN FÍSICA</p>
          <h1>
            {isNew
              ? 'Nueva preparación'
              : editing
                ? `Editar · ${form.nombre || 'Preparación'}`
                : form.nombre || 'Preparación'}
          </h1>
        </div>
        <Link className="page-back" to="/preparacion">
          <button type="button" className="ghost">
            <IcoFlecha />
            Volver
          </button>
        </Link>
        <div className="add-player-actions">
          {mayWrite && !editing && !isNew && (
            <Link
              to={`/preparacion/${id}/editar`}
              className="btn-icon-edit"
              title="Editar"
              aria-label="Editar preparación"
            >
              <IcoLapiz />
            </Link>
          )}
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}
      {soloLectura && (
        <p className="hint">
          {mayWrite
            ? 'Modo consulta. Usa Editar para cambiar la sesión.'
            : 'Solo lectura. El preparador físico o un entrenador pueden editar.'}
        </p>
      )}

      <form className="panel club-card prep-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="prep-nombre">Nombre</label>
            <input
              id="prep-nombre"
              value={form.nombre}
              onChange={(e) => setField('nombre', e.target.value)}
              placeholder="Ej. Fuerza tren inferior · Pretemporada"
              disabled={soloLectura}
              required
              maxLength={120}
              autoFocus={isNew}
            />
          </div>

          <div className="field">
            <label htmlFor="prep-tipo">Tipo</label>
            <select
              id="prep-tipo"
              value={form.tipo}
              onChange={(e) => setField('tipo', e.target.value)}
              disabled={soloLectura}
            >
              {TIPOS_PREP.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="prep-duracion">Duración (min)</label>
            <input
              id="prep-duracion"
              type="number"
              min={1}
              max={600}
              value={form.duracion_min}
              onChange={(e) => setField('duracion_min', e.target.value)}
              placeholder="45"
              disabled={soloLectura}
            />
          </div>

          <div className="field">
            <label htmlFor="prep-intensidad">Intensidad</label>
            <select
              id="prep-intensidad"
              value={form.intensidad}
              onChange={(e) => setField('intensidad', e.target.value)}
              disabled={soloLectura}
            >
              <option value="">Sin definir</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          <div className="field full">
            <label htmlFor="prep-objetivo">Objetivo</label>
            <input
              id="prep-objetivo"
              value={form.objetivo}
              onChange={(e) => setField('objetivo', e.target.value)}
              placeholder="Ej. Mejorar potencia de salto y estabilidad de rodilla"
              disabled={soloLectura}
              maxLength={300}
            />
          </div>

          <div className="field full">
            <label htmlFor="prep-contenido">Contenido / ejercicios</label>
            <textarea
              id="prep-contenido"
              rows={12}
              value={form.contenido}
              onChange={(e) => setField('contenido', e.target.value)}
              placeholder={
                'Describe la sesión: calentamiento, bloques, series/reps, descansos, notas…\n\n' +
                'Ej.\n1. Movilidad cadera 8′\n2. Sentadilla goblet 3×8\n3. Saltos laterales 3×6/lado\n4. Core antirotación 3×20″'
              }
              disabled={soloLectura}
            />
          </div>
        </div>

        {!soloLectura && (
          <div className="prep-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : isNew ? 'Crear preparación' : 'Guardar cambios'}
            </button>
            {!isNew && (
              <Link to={`/preparacion/${id}`}>
                <button type="button" className="ghost">
                  Cancelar
                </button>
              </Link>
            )}
          </div>
        )}
      </form>
    </>
  );
}
