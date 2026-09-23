import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

function temporadaActualNombre(ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const startYear = m <= 2 ? y - 1 : y;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

function temporadaActualHint(ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const startYear = m <= 2 ? y - 1 : y;
  return `oct ${startYear} – mar ${startYear + 1}`;
}

const empty = {
  entrenador_nombre: '',
  nombre: '',
  categoria: '',
  competicion: '',
  temporada_nombre: temporadaActualNombre(),
  correo: '',
  password: '',
  password2: '',
};

const playerEmpty = {
  nombre: '',
  apellido: '',
  dorsal: '',
  id_posicion: '',
  fecha_nacimiento: '',
  altura_cm: '',
};

const STEPS = [
  { id: 1, label: 'Cuenta' },
  { id: 2, label: 'Equipo' },
  { id: 3, label: 'Plantilla' },
];

const AVATAR_COLORS = ['#c4ff00', '#fb923c', '#00d1ff', '#a855f7', '#2dd4bf'];

function calcEdad(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a;
}
export default function Registro() {
  const { registro, isAuth, refreshEquipo } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(empty);
  const [player, setPlayer] = useState(playerEmpty);
  const [jugadores, setJugadores] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [escudoFile, setEscudoFile] = useState(null);
  const [escudoPreview, setEscudoPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const initials = useMemo(() => {
    const parts = (form.nombre || 'AN').trim().split(/\s+/);
    const letters = parts
      .filter((p) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(p[0] || ''))
      .slice(0, 2)
      .map((p) => p[0].toUpperCase());
    return (letters.join('') || 'AN').slice(0, 2);
  }, [form.nombre]);

  const posicionNombre = (id) =>
    posiciones.find((p) => String(p.id_posicion) === String(id))?.nombre || '—';

  useEffect(() => {
    api
      .getPosiciones()
      .then(setPosiciones)
      .catch((e) => setError(e.message));
  }, []);

  // Si ya hay sesión (registro ya terminado), ir al dashboard
  if (isAuth) return <Navigate to="/" replace />;

  const onEscudo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('El escudo debe pesar máximo 2MB');
      return;
    }
    setError('');
    if (escudoPreview) URL.revokeObjectURL(escudoPreview);
    setEscudoFile(file);
    setEscudoPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const goNextFromCuenta = (e) => {
    e.preventDefault();
    setError('');
    if (!form.entrenador_nombre.trim()) {
      setError('Indica el nombre del entrenador / responsable');
      return;
    }
    if (!form.correo || form.password.length < 8) {
      setError('Correo y contraseña (mín. 8 caracteres) son obligatorios');
      return;
    }
    if (form.password !== form.password2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setStep(2);
  };

  const goNextFromEquipo = (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim() || !form.categoria.trim() || !form.competicion.trim() || !form.temporada_nombre.trim()) {
      setError('Completa todos los datos del equipo');
      return;
    }
    setStep(3);
  };

  const addJugador = (e) => {
    e.preventDefault();
    setError('');
    if (!player.nombre.trim() || !player.apellido.trim() || player.dorsal === '') {
      setError('Nombre, apellido y dorsal son obligatorios');
      return;
    }
    const dorsal = Number(player.dorsal);
    if (jugadores.some((j) => j.dorsal === dorsal)) {
      setError('Ese dorsal ya está en la plantilla');
      return;
    }
    let altura = null;
    if (player.altura_cm !== '') {
      altura = Number(player.altura_cm);
      if (altura < 100 || altura > 250) {
        setError('La altura debe estar entre 100 y 250 cm');
        return;
      }
    }
    setJugadores((list) => [
      ...list,
      {
        tempId: crypto.randomUUID(),
        nombre: player.nombre.trim(),
        apellido: player.apellido.trim(),
        dorsal,
        id_posicion: player.id_posicion ? Number(player.id_posicion) : null,
        fecha_nacimiento: player.fecha_nacimiento || null,
        altura_cm: altura,
      },
    ]);
    setPlayer(playerEmpty);
  };

  const removeJugador = (tempId) => {
    setJugadores((list) => list.filter((j) => j.tempId !== tempId));
  };

  /** Único momento en que se escribe en BBDD */
  const finish = async () => {
    setLoading(true);
    setError('');
    try {
      await registro({
        ...form,
        entrenador_nombre: form.entrenador_nombre.trim(),
        categoria: form.categoria || null,
        competicion: form.competicion || null,
        img_escudo: null,
      });
      if (escudoFile) {
        const { path } = await api.uploadImagen(escudoFile, 'escudo');
        await api.updateDatosEquipo({ img_escudo: path });
        await refreshEquipo();
      }
      for (const j of jugadores) {
        await api.createJugador({
          nombre: j.nombre,
          apellido: j.apellido,
          dorsal: j.dorsal,
          id_posicion: j.id_posicion,
          fecha_nacimiento: j.fecha_nacimiento,
          altura_cm: j.altura_cm,
        });
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyByStep = {
    1: {
      title: 'Crea tu acceso al club.',
      text: 'Tu nombre como entrenador va aparte del nombre del equipo. El correo será el acceso a SIETE.',
      checks: [
        'Nombre del entrenador separado del club',
        'Datos seguros del cuerpo técnico',
        'Listo para configurar la temporada',
      ],
    },
    2: {
      title: 'Pon en marcha tu temporada.',
      text: 'Estos datos estructuran tus informes, filtros y comparativas. Podrás editarlos más tarde.',
      checks: [
        'Métricas específicas por posición',
        'Seguimiento de portería diferenciado',
        'Informes listos para cuerpo técnico',
      ],
    },
    3: {
      title: 'Construye tu plantilla.',
      text: 'Nada se guarda hasta pulsar finalizar. Puedes saltar y completar jugadores después.',
      checks: [
        'Dorsal y posición en un clic',
        'Fichas listas para el acta en vivo',
        'Resumen automático por jugador',
      ],
    },
  };

  const copy = copyByStep[step];

  return (
    <div className="onboard">
      <header className="onboard-top">
        <div className="brand-lockup">
          <span className="brand-badge">7M</span>
          <div>
            <strong>SIETE</strong>
            <small>METODOLOGÍA DE DEPORTE</small>
          </div>
        </div>
        <div className="onboard-meta">CONFIGURACIÓN 0{step} / 03</div>
      </header>

      <nav className="onboard-steps" aria-label="Progreso">
        {STEPS.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`step ${step === s.id ? 'active' : ''} ${step > s.id ? 'done' : ''}`}
            onClick={() => {
              if (s.id < step) setStep(s.id);
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="onboard-body">
        <aside className="onboard-copy">
          <h1>{copy.title}</h1>
          <p>{copy.text}</p>
          <ul className="check-list">
            {copy.checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </aside>

        <section className="onboard-card">
          {step === 1 && (
            <form onSubmit={goNextFromCuenta}>
              <h2>Datos de acceso</h2>
              <p className="sub">Paso 1 de 3 · Cuenta · sin guardar aún</p>
              <div className="field">
                <label>Nombre del entrenador</label>
                <input
                  placeholder="Marta Vidal"
                  value={form.entrenador_nombre}
                  onChange={(e) => setForm({ ...form, entrenador_nombre: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="marta@atleticorome.es"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              <div className="field">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  placeholder="Repite la contraseña"
                  value={form.password2}
                  onChange={(e) => setForm({ ...form, password2: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              {error && <p className="error">{error}</p>}
              <div className="onboard-actions">
                <Link to="/login" className="btn-back">
                  Atrás
                </Link>
                <button type="submit">Continuar →</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={goNextFromEquipo}>
              <h2>Datos del equipo</h2>
              <p className="sub">Paso 2 de 3 · Equipo · sin guardar aún</p>

              <div className="escudo-row">
                <div className="escudo-preview">
                  {escudoPreview ? (
                    <img src={escudoPreview} alt="Escudo" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div>
                  <label className="btn-outline">
                    Subir escudo
                    <input type="file" accept="image/png,image/jpeg" hidden onChange={onEscudo} />
                  </label>
                  <p className="hint">PNG o JPG · max. 2MB</p>
                </div>
              </div>

              <div className="field">
                <label>Nombre del equipo</label>
                <input
                  placeholder="C.D. Atlético Norte"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Categoría</label>
                <input
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Senior masculino"
                  required
                />
              </div>
              <div className="field">
                <label>Competición</label>
                <input
                  value={form.competicion}
                  onChange={(e) => setForm({ ...form, competicion: e.target.value })}
                  placeholder="División de Honor Plata"
                  required
                />
              </div>
              <div className="field">
                <label>Temporada</label>
                <input
                  value={form.temporada_nombre}
                  onChange={(e) => setForm({ ...form, temporada_nombre: e.target.value })}
                  placeholder="2026/27"
                  required
                />
                <small className="muted">Periodo: {temporadaActualHint()}</small>
              </div>

              {error && <p className="error">{error}</p>}

              <div className="onboard-actions">
                <button type="button" className="btn-back" onClick={() => setStep(1)}>
                  Atrás
                </button>
                <button type="submit">Continuar a plantilla →</button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="plantilla-onboard">
              <h2>Plantilla inicial</h2>
              <p className="sub">Paso 3 de 3 · Se guarda todo al finalizar</p>

              <form className="form-grid" onSubmit={addJugador} style={{ marginBottom: '1rem' }}>
                <div className="field">
                  <label>Nombre</label>
                  <input
                    value={player.nombre}
                    onChange={(e) => setPlayer({ ...player, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Apellido</label>
                  <input
                    value={player.apellido}
                    onChange={(e) => setPlayer({ ...player, apellido: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Dorsal</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={player.dorsal}
                    onChange={(e) => setPlayer({ ...player, dorsal: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Posición</label>
                  <select
                    value={player.id_posicion}
                    onChange={(e) => setPlayer({ ...player, id_posicion: e.target.value })}
                  >
                    <option value="">Seleccionar</option>
                    {posiciones.map((p) => (
                      <option key={p.id_posicion} value={p.id_posicion}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={player.fecha_nacimiento}
                    onChange={(e) => setPlayer({ ...player, fecha_nacimiento: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Edad</label>
                  <input
                    type="text"
                    readOnly
                    value={
                      calcEdad(player.fecha_nacimiento) != null
                        ? `${calcEdad(player.fecha_nacimiento)} años`
                        : '—'
                    }
                  />
                </div>
                <div className="field">
                  <label>Altura (cm)</label>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    placeholder="185"
                    value={player.altura_cm}
                    onChange={(e) => setPlayer({ ...player, altura_cm: e.target.value })}
                  />
                </div>
                <button type="submit">Añadir jugador</button>
              </form>

              {error && <p className="error">{error}</p>}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>#</th>
                      <th>Posición</th>
                      <th>Edad</th>
                      <th>Altura</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jugadores.map((j, idx) => (
                      <tr key={j.tempId}>
                        <td>
                          <span className="player-cell">
                            <span
                              className="avatar"
                              style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                            >
                              {(j.nombre?.[0] || '?') + (j.apellido?.[0] || '')}
                            </span>
                            {j.nombre} {j.apellido}
                          </span>
                        </td>
                        <td>{j.dorsal}</td>
                        <td>{posicionNombre(j.id_posicion)}</td>
                        <td>{calcEdad(j.fecha_nacimiento) ?? '—'}</td>
                        <td>{j.altura_cm ? `${j.altura_cm} cm` : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => removeJugador(j.tempId)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!jugadores.length && (
                      <tr>
                        <td colSpan="6" className="muted">
                          Todavía no hay jugadores · añade el primero o finaliza vacío
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="onboard-actions">
                <button type="button" className="btn-back" onClick={() => setStep(2)} disabled={loading}>
                  Atrás
                </button>
                <button type="button" onClick={finish} disabled={loading}>
                  {loading
                    ? 'Guardando en base de datos…'
                    : jugadores.length
                      ? 'Finalizar y guardar →'
                      : 'Finalizar sin plantilla →'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
