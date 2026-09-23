import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../api';

const empty = {
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  id_posicion: '',
  altura_m: '',
  peso_kg: '',
  dorsal: '',
  activo: true,
  img_foto: '',
};

export default function AnadirJugador() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [posiciones, setPosiciones] = useState([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pos = await api.getPosiciones();
        if (!alive) return;
        setPosiciones(pos);
        if (!id) {
          setLoading(false);
          return;
        }
        const j = await api.getJugador(id);
        if (!alive) return;
        setForm({
          nombre: j.nombre || '',
          apellido: j.apellido || '',
          fecha_nacimiento: j.fecha_nacimiento || '',
          id_posicion: j.id_posicion ? String(j.id_posicion) : '',
          altura_m: j.altura_cm ? (j.altura_cm / 100).toFixed(2) : '',
          peso_kg: j.peso_kg != null ? String(j.peso_kg) : '',
          dorsal: j.dorsal != null ? String(j.dorsal) : '',
          activo: j.activo !== false,
          img_foto: j.img_foto || '',
        });
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const preview = mediaUrl(form.img_foto) || null;
  const initials = `${(form.nombre || '?')[0]}${(form.apellido || '?')[0]}`.toUpperCase();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('La foto debe pesar menos de 2 MB');
      return;
    }
    setError('');
    try {
      const { path } = await api.uploadImagen(file, 'jugador');
      setField('img_foto', path);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  const payloadFromForm = () => {
    const alturaCm = form.altura_m
      ? Math.round(Number(String(form.altura_m).replace(',', '.')) * 100)
      : null;
    return {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dorsal: Number(form.dorsal),
      id_posicion: form.id_posicion ? Number(form.id_posicion) : null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      altura_cm: alturaCm,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : null,
      img_foto: form.img_foto || null,
      activo: form.activo,
    };
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = payloadFromForm();
      if (isEdit) {
        await api.updateJugador(id, payload);
        navigate(`/plantilla/${id}`);
      } else {
        await api.createJugador(payload);
        navigate('/plantilla');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="muted">Cargando jugador…</p>;

  return (
    <form className="add-player" onSubmit={onSubmit}>
      <header className="page-head">
        <div>
          <p className="page-kicker">
            PLANTILLA / {isEdit ? 'DATOS DEL JUGADOR' : 'GESTIÓN DEL JUGADOR'}
          </p>
          <h1>{isEdit ? 'Editar jugador' : 'Añadir jugador'}</h1>
        </div>
        <div className="add-player-actions">
          <Link to={isEdit ? `/plantilla/${id}` : '/plantilla'}>
            <button type="button" className="ghost">
              Cancelar
            </button>
          </Link>
          <button type="submit" disabled={saving}>
            {saving
              ? 'Guardando…'
              : isEdit
                ? 'Guardar cambios'
                : 'Crear jugador'}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="add-player-grid">
        <aside className="panel club-card add-player-side">
          <h2>Foto y dorsal</h2>
          <div className="player-photo">
            {preview ? (
              <img src={preview} alt="Foto del jugador" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
          <button type="button" className="ghost full" onClick={() => fileRef.current?.click()}>
            {isEdit ? 'Cambiar foto' : 'Subir foto'}
          </button>

          <div className="field" style={{ marginTop: '1.1rem' }}>
            <label>Dorsal</label>
            <input
              type="number"
              min="0"
              max="99"
              value={form.dorsal}
              onChange={(e) => setField('dorsal', e.target.value)}
              required
              placeholder="7"
            />
          </div>
          <div className="field">
            <label>Estado</label>
            <select
              value={form.activo ? 'activo' : 'inactivo'}
              onChange={(e) => setField('activo', e.target.value === 'activo')}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </aside>

        <section className="panel club-card add-player-main">
          <div className="field">
            <label>Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => setField('nombre', e.target.value)}
              required
              placeholder="Daniel"
            />
          </div>
          <div className="field">
            <label>Apellidos</label>
            <input
              value={form.apellido}
              onChange={(e) => setField('apellido', e.target.value)}
              required
              placeholder="Gutiérrez"
            />
          </div>
          <div className="field">
            <label>Fecha de nacimiento</label>
            <input
              type="date"
              value={form.fecha_nacimiento}
              onChange={(e) => setField('fecha_nacimiento', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Posición principal</label>
            <select
              value={form.id_posicion}
              onChange={(e) => setField('id_posicion', e.target.value)}
            >
              <option value="">Seleccionar</option>
              {posiciones.map((p) => (
                <option key={p.id_posicion} value={p.id_posicion}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="add-player-metrics">
            <div className="field">
              <label>Altura</label>
              <div className="input-suffix">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.altura_m}
                  onChange={(e) => setField('altura_m', e.target.value)}
                  placeholder="1.82"
                />
                <span>m</span>
              </div>
            </div>
            <div className="field">
              <label>Peso</label>
              <div className="input-suffix">
                <input
                  type="number"
                  min="30"
                  max="200"
                  value={form.peso_kg}
                  onChange={(e) => setField('peso_kg', e.target.value)}
                  placeholder="78"
                />
                <span>kg</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
