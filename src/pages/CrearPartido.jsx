import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IcoBasura, IcoFlecha, IcoLapiz } from '../components/ActionIcons';

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
  const meta = temporadaActual();
  let list = await api.getTemporadas();

  // Preferir siempre la temporada activa del club
  const activa = list.find((t) => t.estado === 'activa');
  if (activa) return { list, actual: activa };

  const found = list.find(
    (t) =>
      t.nombre === meta.nombre ||
      (t.fecha_inicio || '').slice(0, 7) === meta.fecha_inicio.slice(0, 7),
  );
  if (found && found.estado !== 'archivada') {
    const activated = await api.activarTemporada(found.id_temporada);
    list = await api.getTemporadas();
    return { list, actual: activated };
  }

  const created = await api.createTemporada({
    nombre: meta.nombre,
    fecha_inicio: meta.fecha_inicio,
    fecha_fin: meta.fecha_fin,
    activar: true,
  });
  list = await api.getTemporadas();
  return { list, actual: created };
}

export default function CrearPartido() {
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const navigate = useNavigate();
  const { equipo, canWritePartidos } = useAuth();
  const [step, setStep] = useState(1);
  const [rivales, setRivales] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [nuevoRival, setNuevoRival] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
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
    estado: 'programado',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, { list, actual }] = await Promise.all([
          api.getRivales(),
          ensureTemporadaActual(),
        ]);
        if (cancelled) return;
        setRivales(r);
        setTemporadas(list);

        if (isEdit) {
          const partidos = await api.getPartidos();
          if (cancelled) return;
          const p = partidos.find((x) => x.id_partido === editId);
          if (!p) {
            setError('Partido no encontrado');
            setLoadingEdit(false);
            return;
          }
          const d = new Date(p.fecha);
          const pad = (n) => String(n).padStart(2, '0');
          setForm({
            competicion: p.competicion || equipo?.datos?.competicion || '',
            jornada: p.jornada != null ? String(p.jornada) : '',
            fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
            hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
            condicion: p.es_local === false ? 'visitante' : 'local',
            pabellon: p.pabellon || equipo?.datos?.pabellon || '',
            id_temporada: p.id_temporada || actual.id_temporada,
            id_rival: p.id_rival || '',
            estado: p.estado || 'programado',
          });
          if (p.id_rival) {
            const riv = r.find((x) => x.id_rival === p.id_rival);
            if (riv) setBusqueda(riv.nombre || '');
          }
          setLoadingEdit(false);
        } else {
          setForm((f) => ({
            ...f,
            id_temporada: actual.id_temporada,
            competicion: f.competicion || equipo?.datos?.competicion || '',
            pabellon: f.pabellon || equipo?.datos?.pabellon || '',
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoadingEdit(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [equipo, editId, isEdit]);

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

  const editarRival = async (id, nombreActual) => {
    const siguiente = window.prompt('Nuevo nombre del rival', nombreActual || '');
    if (siguiente == null) return;
    const nombre = siguiente.trim();
    if (!nombre || nombre === nombreActual) return;
    try {
      const updated = await api.updateRival(id, { nombre });
      setRivales((prev) =>
        prev.map((e) => (e.id_rival === id ? { ...e, nombre: updated.nombre } : e)),
      );
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
      const jornada =
        form.competicion === 'Amistoso'
          ? null
          : form.jornada
            ? Number(String(form.jornada).replace(/\D/g, '')) || null
            : null;
      const basePayload = {
        id_rival: form.id_rival,
        es_local: form.condicion === 'local',
        fecha: fechaIso,
        jornada,
        pabellon: form.pabellon || null,
        competicion: form.competicion || null,
      };

      if (isEdit) {
        await api.updatePartido(editId, basePayload);
        navigate(`/partidos/${editId}`);
        return;
      }

      let idTemporada = form.id_temporada;
      const sel = temporadas.find((t) => t.id_temporada === idTemporada);
      if (!sel || sel.estado !== 'activa') {
        const { list, actual } = await ensureTemporadaActual();
        setTemporadas(list);
        idTemporada = actual.id_temporada;
        setForm((f) => ({ ...f, id_temporada: idTemporada }));
      }

      const created = await api.createPartido({
        ...basePayload,
        id_temporada: idTemporada,
        estado: 'programado',
      });
      navigate(`/partidos/${created.id_partido}/convocatoria`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return <p className="muted" style={{ padding: '2rem' }}>Cargando partido…</p>;
  }

  return (
    <>
      {!canWritePartidos ? (
        <>
          <header className="page-head">
            <div>
              <p className="page-kicker">{isEdit ? 'EDITAR PARTIDO' : 'PARTIDO NUEVO'}</p>
              <h1>{isEdit ? 'Editar partido' : 'Crear partido'}</h1>
            </div>
            <Link className="page-back" to={isEdit && editId ? `/partidos/${editId}` : '/partidos'}>
              <button type="button" className="ghost">
                <IcoFlecha />
                Volver
              </button>
            </Link>
          </header>
          <p className="error">
            Tu cargo no permite {isEdit ? 'editar' : 'crear'} partidos.
          </p>
        </>
      ) : (
        <>
      <header className="page-head">
        <div>
          <p className="page-kicker">{isEdit ? 'EDITAR PARTIDO' : 'PARTIDO NUEVO'}</p>
          <h1>{isEdit ? 'Editar partido' : 'Crear partido'}</h1>
        </div>
        <div className="add-player-actions">
          <Link to={isEdit && editId ? `/partidos/${editId}` : '/partidos'}>
            <button type="button" className="ghost">
              Cancelar
            </button>
          </Link>
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
                disabled={isEdit}
                title={isEdit ? 'La temporada no se cambia al editar' : undefined}
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
                    className="btn-icon-edit"
                    title="Editar nombre"
                    aria-label={`Editar ${nombre}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      editarRival(rv.id_rival, nombre);
                    }}
                  >
                    <IcoLapiz size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-del"
                    title="Eliminar rival"
                    aria-label={`Eliminar ${nombre}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarRival(rv.id_rival, nombre);
                    }}
                  >
                    <IcoBasura size={16} />
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
      )}
    </>
  );
}
