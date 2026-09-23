import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

const STEPS = [
  { id: 1, label: 'Partido' },
  { id: 2, label: 'Rival' },
  { id: 3, label: 'Confirmar' },
];

const COMPETICIONES = [
  'División de Honor',
  'División de Honor Plata',
  'Primera Nacional',
  'Autonómica',
  'Provincial',
  'Amistoso',
];

function initials(nombre = '') {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'RV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function temporadaActual(ref = new Date()) {
  // Temporada oct → mar. Abr–sep apuntan a la que empieza en octubre de este año.
  const y = ref.getFullYear();
  const m = ref.getMonth(); // 0=ene
  const startYear = m <= 2 ? y - 1 : y;
  const endYear = startYear + 1;
  return {
    nombre: `${startYear}/${String(endYear).slice(-2)}`,
    fecha_inicio: `${startYear}-10-01`,
    fecha_fin: `${endYear}-03-31`,
    etiqueta: `${startYear}/${String(endYear).slice(-2)} · oct ${startYear} – mar ${endYear}`,
  };
}

function labelTemporada(t) {
  if (!t) return '';
  const ini = t.fecha_inicio ? new Date(t.fecha_inicio) : null;
  const fin = t.fecha_fin ? new Date(t.fecha_fin) : null;
  if (ini && fin && !Number.isNaN(ini) && !Number.isNaN(fin)) {
    const fmt = (d) =>
      d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).replace('.', '');
    return `${t.nombre} · ${fmt(ini)} – ${fmt(fin)}`;
  }
  return t.nombre;
}

async function ensureTemporadaActual() {
  const actual = temporadaActual();
  const list = await api.getTemporadas();
  const found = list.find(
    (t) =>
      t.nombre === actual.nombre ||
      (t.fecha_inicio || '').slice(0, 7) === actual.fecha_inicio.slice(0, 7),
  );
  if (found) return { list, actual: found };
  const created = await api.createTemporada({
    nombre: actual.nombre,
    fecha_inicio: actual.fecha_inicio,
    fecha_fin: actual.fecha_fin,
    activar: true,
  });
  return { list: [...list, created], actual: created };
}

export default function CrearPartido() {
  const navigate = useNavigate();
  const { equipo } = useAuth();
  const [step, setStep] = useState(1);
  const [rivales, setRivales] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [nuevoRival, setNuevoRival] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    competicion: equipo?.datos?.competicion || '',
    jornada: '1',
    fecha: new Date().toISOString().slice(0, 10),
    hora: '19:30',
    condicion: 'local',
    pabellon: equipo?.datos?.pabellon || '',
    id_temporada: '',
    id_rival: '',
  });

  useEffect(() => {
    Promise.all([api.getRivales(), ensureTemporadaActual()])
      .then(([r, { list, actual }]) => {
        setRivales(r);
        setTemporadas(list);
        setForm((f) => ({
          ...f,
          id_temporada: actual.id_temporada,
          competicion: f.competicion || equipo?.datos?.competicion || '',
          pabellon: f.pabellon || equipo?.datos?.pabellon || '',
        }));
      })
      .catch((err) => setError(err.message));
  }, [equipo]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const rivalesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rivales;
    return rivales.filter((e) => (e.nombre || '').toLowerCase().includes(q));
  }, [rivales, busqueda]);

  const rival = useMemo(
    () => rivales.find((e) => e.id_rival === form.id_rival),
    [rivales, form.id_rival],
  );

  const temporada = temporadas.find((t) => t.id_temporada === form.id_temporada);

  const canStep1 = Boolean(form.fecha && form.hora && form.id_temporada);
  const canStep2 = Boolean(form.id_rival);
  const canSave = canStep1 && canStep2;

  const crearRival = async () => {
    if (!nuevoRival.trim()) return;
    try {
      const created = await api.createRival({ nombre: nuevoRival.trim() });
      setNuevoRival('');
      setBusqueda(created.nombre);
      setRivales(await api.getRivales());
      setField('id_rival', created.id_rival);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminarRival = async (id, nombre) => {
    if (!confirm(`¿Eliminar el rival "${nombre}"?`)) return;
    try {
      await api.deleteRival(id);
      setRivales((prev) => prev.filter((e) => e.id_rival !== id));
      if (form.id_rival === id) setField('id_rival', '');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const onSave = async () => {
    if (!canSave) {
      setError('Completa los datos del encuentro y el rival');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fechaIso = new Date(`${form.fecha}T${form.hora}:00`).toISOString();
      const created = await api.createPartido({
        id_rival: form.id_rival,
        es_local: form.condicion === 'local',
        id_temporada: form.id_temporada,
        fecha: fechaIso,
        jornada:
          form.competicion === 'Amistoso'
            ? null
            : form.jornada
              ? Number(String(form.jornada).replace(/\D/g, '')) || null
              : null,
        pabellon: form.pabellon || null,
        competicion: form.competicion || null,
        estado: 'programado',
      });
      navigate(`/partidos/${created.id_partido}/convocatoria`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">PARTIDO NUEVO</p>
          <h1>Crear partido</h1>
        </div>
        <div className="add-player-actions">
          <Link to="/partidos">
            <button type="button" className="ghost">
              Cancelar
            </button>
          </Link>
          <button type="button" disabled={saving || !canSave} onClick={onSave}>
            {saving ? 'Guardando…' : 'Guardar partido'}
          </button>
        </div>
      </header>

      <div className="wizard-steps">
        {STEPS.map((s) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <button
              type="button"
              key={s.id}
              className={`wizard-step${active ? ' active' : ''}${done ? ' done' : ''}`}
              onClick={() => {
                if (s.id === 1) setStep(1);
                if (s.id === 2 && canStep1) setStep(2);
                if (s.id === 3 && canStep1 && canStep2) setStep(3);
              }}
            >
              {done ? '✓ ' : `${s.id}. `}
              {s.label}
            </button>
          );
        })}
      </div>

      {error && <p className="error">{error}</p>}

      {step === 1 && (
        <section className="panel club-card">
          <h2>Datos del encuentro</h2>
          <div className="form-grid club-form crear-partido-form">
            <div className="field">
              <label>Competición</label>
              <select
                value={form.competicion}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    competicion: value,
                    jornada: value === 'Amistoso' ? '' : prev.jornada,
                  }));
                }}
              >
                <option value="">Seleccionar…</option>
                {COMPETICIONES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {form.competicion && !COMPETICIONES.includes(form.competicion) && (
                  <option value={form.competicion}>{form.competicion}</option>
                )}
              </select>
            </div>
            {form.competicion !== 'Amistoso' && (
              <div className="field">
                <label>Jornada</label>
                <input
                  value={form.jornada}
                  onChange={(e) => setField('jornada', e.target.value)}
                  placeholder="1ª"
                />
              </div>
            )}
            <div className="field">
              <label>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setField('fecha', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Hora</label>
              <input
                type="time"
                value={form.hora}
                onChange={(e) => setField('hora', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Condición</label>
              <select
                value={form.condicion}
                onChange={(e) => setField('condicion', e.target.value)}
              >
                <option value="local">Local</option>
                <option value="visitante">Visitante</option>
              </select>
            </div>
            <div className="field">
              <label>Pabellón</label>
              <input
                value={form.pabellon}
                onChange={(e) => setField('pabellon', e.target.value)}
                placeholder="Pabellón…"
              />
            </div>
            <div className="field">
              <label>Temporada</label>
              <select
                value={form.id_temporada}
                onChange={(e) => setField('id_temporada', e.target.value)}
                required
              >
                <option value="">Seleccionar…</option>
                {temporadas
                  .filter((t) => t.estado === 'activa' || t.id_temporada === form.id_temporada)
                  .map((t) => (
                    <option key={t.id_temporada} value={t.id_temporada}>
                      {labelTemporada(t)}
                      {t.estado === 'activa' ? ' · activa' : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="wizard-nav">
            <button type="button" disabled={!canStep1} onClick={() => setStep(2)}>
              Continuar → Rival
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel club-card">
          <h2>Rival</h2>
          <div className="field">
            <label>Buscar club</label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="BM Alcobendas"
            />
          </div>

          <div className="rival-list">
            {rivalesFiltrados.map((rv) => {
              const nombre = rv.nombre;
              const selected = form.id_rival === rv.id_rival;
              return (
                <div
                  key={rv.id_rival}
                  className={`rival-item${selected ? ' selected' : ''}`}
                >
                  <button
                    type="button"
                    className="rival-item-main"
                    onClick={() => setField('id_rival', rv.id_rival)}
                  >
                    <span className="rival-avatar">{initials(nombre)}</span>
                    <span>
                      <strong>{nombre}</strong>
                      <small>Rival</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rival-delete"
                    title="Eliminar rival"
                    aria-label={`Eliminar ${nombre}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarRival(rv.id_rival, nombre);
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {!rivalesFiltrados.length && (
              <p className="muted">No hay rivales. Crea uno abajo.</p>
            )}
          </div>

          <div className="form-grid" style={{ marginTop: '1rem' }}>
            <input
              placeholder="Nuevo rival (nombre)"
              value={nuevoRival}
              onChange={(e) => setNuevoRival(e.target.value)}
            />
            <button type="button" className="ghost" onClick={crearRival}>
              Añadir rival
            </button>
          </div>

          {rival && (
            <div className="rival-selected">
              <span className="rival-avatar xl">{initials(rival.nombre || '')}</span>
              <div>
                <strong>{rival.nombre}</strong>
                <small>Seleccionado como rival</small>
              </div>
            </div>
          )}

          <div className="wizard-nav">
            <button type="button" className="ghost" onClick={() => setStep(1)}>
              ← Partido
            </button>
            <button type="button" disabled={!canStep2} onClick={() => setStep(3)}>
              Continuar → Confirmar
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="panel club-card">
          <h2>Confirmar</h2>
          <dl className="confirm-grid">
            <div>
              <dt>Competición</dt>
              <dd>{form.competicion || '—'}</dd>
            </div>
            {form.competicion !== 'Amistoso' && (
              <div>
                <dt>Jornada</dt>
                <dd>{form.jornada || '—'}</dd>
              </div>
            )}
            <div>
              <dt>Fecha y hora</dt>
              <dd>
                {form.fecha} · {form.hora}
              </dd>
            </div>
            <div>
              <dt>Condición</dt>
              <dd>{form.condicion === 'local' ? 'Local' : 'Visitante'}</dd>
            </div>
            <div>
              <dt>Pabellón</dt>
              <dd>{form.pabellon || '—'}</dd>
            </div>
            <div>
              <dt>Temporada</dt>
              <dd>{labelTemporada(temporada) || '—'}</dd>
            </div>
            <div>
              <dt>Tu equipo</dt>
              <dd>{equipo?.datos?.nombre || '—'}</dd>
            </div>
            <div>
              <dt>Rival</dt>
              <dd>{rival?.nombre || '—'}</dd>
            </div>
          </dl>
          <div className="wizard-nav">
            <button type="button" className="ghost" onClick={() => setStep(2)}>
              ← Rival
            </button>
            <button type="button" disabled={saving || !canSave} onClick={onSave}>
              {saving ? 'Guardando…' : 'Guardar partido'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
