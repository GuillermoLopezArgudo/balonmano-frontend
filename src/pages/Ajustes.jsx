import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, mediaUrl } from '../api';
import { useAuth } from '../auth';
import { getSavedTema, saveTema } from '../theme';

const TABS = [
  { id: 'cuenta', label: 'Cuenta' },
  { id: 'club', label: 'Club' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'preferencias', label: 'Preferencias' },
  { id: 'seguridad', label: 'Seguridad' },
];

const TAB_IDS = new Set(TABS.map((t) => t.id));

const ROLES = [
  'Director / Gestor',
  'Entrenador principal',
  'Segundo entrenador',
  'Analista',
  'Delegado',
];

const IDIOMAS = [
  { value: 'es', label: 'Español' },
  { value: 'ca', label: 'Catalán' },
  { value: 'en', label: 'English' },
];

const CATEGORIAS = [
  'Senior masculino',
  'Senior femenino',
  'Junior masculino',
  'Junior femenino',
  'Cadete',
  'Infantil',
];

const COMPETICIONES = [
  'División de Honor',
  'División de Honor Plata',
  'Primera Nacional',
  'Autonómica',
  'Provincial',
  'Amistoso',
];

function prefsKey(id) {
  return `siete_ajustes_${id || 'default'}`;
}

function loadPrefs(id) {
  try {
    const raw = localStorage.getItem(prefsKey(id));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function coachNameFromEquipo(equipo, saved = {}) {
  const fromDb = (equipo?.datos?.entrenador_nombre || '').trim();
  if (fromDb) return fromDb;

  const teamNames = [equipo?.datos?.nombre, equipo?.datos?.nombre_corto]
    .filter(Boolean)
    .map((n) => n.trim().toLowerCase());
  const savedName = (saved.nombre || '').trim();
  if (savedName && !teamNames.includes(savedName.toLowerCase())) return savedName;

  return '';
}

function escudoInitials(nombre = '') {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'EQ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function defaultsFromEquipo(equipo, saved = {}) {
  const mail = equipo?.correo || '';
  const d = equipo?.datos || {};
  return {
    nombre: coachNameFromEquipo(equipo, saved),
    correo: mail,
    idioma: saved.idioma || 'es',
    rol: saved.rol || 'Entrenador principal',
    notifEmail: saved.notifEmail !== false,
    notifDirecto: saved.notifDirecto !== false,
    notifResumen: !!saved.notifResumen,
    notifConvocatoria: saved.notifConvocatoria !== false,
    tema: getSavedTema(),
    zonaHoraria: saved.zonaHoraria || 'Europe/Madrid',
    semanaInicio: saved.semanaInicio || 'lunes',
    club_nombre: d.nombre || '',
    nombre_corto: d.nombre_corto || d.nombre || '',
    entrenador_nombre: d.entrenador_nombre || '',
    codigo_federativo: d.codigo_federativo || '',
    categoria: d.categoria || '',
    competicion: d.competicion || '',
    pabellon: d.pabellon || '',
    img_escudo: d.img_escudo || '',
  };
}

export default function Ajustes() {
  const { equipo, refreshEquipo, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(() => (TAB_IDS.has(tabParam) ? tabParam : 'cuenta'));
  const [form, setForm] = useState(() => defaultsFromEquipo(equipo));
  const [pass, setPass] = useState({ actual: '', nueva: '', confirmar: '' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (TAB_IDS.has(tabParam) && tabParam !== tab) setTab(tabParam);
    // Solo reaccionar a cambios de URL; no reentrar con `tab` en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → state
  }, [tabParam]);

  const selectTab = (id) => {
    setTab(id);
    setSearchParams(id === 'cuenta' ? {} : { tab: id }, { replace: true });
  };

  useEffect(() => {
    if (!equipo) return;
    const saved = loadPrefs(equipo.id_equipo) || {};
    setForm(defaultsFromEquipo(equipo, saved));
    setDirty(false);
  }, [equipo]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMsg('');
  };

  const onTemaChange = (tema) => {
    setField('tema', tema);
    saveTema(tema);
    try {
      const id = equipo?.id_equipo;
      const prev = loadPrefs(id) || {};
      localStorage.setItem(prefsKey(id), JSON.stringify({ ...prev, tema }));
    } catch {
      /* ignore */
    }
  };

  const onEscudo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('El escudo debe pesar máximo 2MB');
      return;
    }
    try {
      const { path } = await api.uploadImagen(file, 'escudo');
      setField('img_escudo', path);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  const avatarLetter = useMemo(
    () => (form.nombre?.[0] || form.correo?.[0] || 'U').toUpperCase(),
    [form.nombre, form.correo],
  );

  const clubName = form.club_nombre || equipo?.datos?.nombre || 'Tu club';
  const escudoLabel = useMemo(
    () => escudoInitials(form.nombre_corto || clubName),
    [form.nombre_corto, clubName],
  );

  const guardar = async () => {
    setSaving(true);
    setError('');
    setMsg('');
    try {
      localStorage.setItem(
        prefsKey(equipo?.id_equipo),
        JSON.stringify({
          nombre: form.nombre,
          idioma: form.idioma,
          rol: form.rol,
          notifEmail: form.notifEmail,
          notifDirecto: form.notifDirecto,
          notifResumen: form.notifResumen,
          notifConvocatoria: form.notifConvocatoria,
          tema: form.tema,
          zonaHoraria: form.zonaHoraria,
          semanaInicio: form.semanaInicio,
        }),
      );
      saveTema(form.tema);

      await api.updateDatosEquipo({
        nombre: form.club_nombre.trim() || 'Mi equipo',
        nombre_corto: form.nombre_corto || null,
        entrenador_nombre: form.entrenador_nombre || form.nombre || null,
        codigo_federativo: form.codigo_federativo || null,
        categoria: form.categoria || null,
        competicion: form.competicion || null,
        pabellon: form.pabellon || null,
        img_escudo: form.img_escudo || null,
      });

      const cuentaPayload = {};
      if (form.correo && form.correo !== equipo?.correo) {
        cuentaPayload.correo = form.correo;
      }
      if (form.nombre.trim()) {
        cuentaPayload.entrenador_nombre = form.nombre.trim();
      }

      if (pass.nueva) {
        if (pass.nueva.length < 8) {
          throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
        }
        if (pass.nueva !== pass.confirmar) {
          throw new Error('Las contraseñas nuevas no coinciden');
        }
        cuentaPayload.password_actual = pass.actual;
        cuentaPayload.password_nueva = pass.nueva;
      }

      if (Object.keys(cuentaPayload).length) {
        await api.updateCuenta(cuentaPayload);
      }

      await refreshEquipo();
      setPass({ actual: '', nueva: '', confirmar: '' });
      setDirty(false);
      setMsg('Cambios guardados');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">CUENTA · CONFIGURACIÓN</p>
          <h1>Ajustes</h1>
        </div>
        <button type="button" disabled={saving || (!dirty && !pass.nueva)} onClick={guardar}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </header>

      <div className="filters roster-filters">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="ok-msg">{msg}</p>}
      {error && <p className="error">{error}</p>}

      {tab === 'cuenta' && (
        <section className="panel">
          <h2>Datos de la cuenta</h2>
          <div className="ajustes-profile">
            <span className="ajustes-avatar">{avatarLetter}</span>
            <div>
              <strong>{form.nombre || 'Sin nombre de entrenador'}</strong>
              <small>
                {form.rol} · {clubName}
              </small>
            </div>
          </div>
          <div className="form-grid club-form">
            <div className="field">
              <label>Nombre del entrenador</label>
              <input
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                placeholder="Tu nombre y apellidos"
              />
            </div>
            <div className="field">
              <label>Correo</label>
              <input
                type="email"
                value={form.correo}
                onChange={(e) => setField('correo', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Idioma</label>
              <select value={form.idioma} onChange={(e) => setField('idioma', e.target.value)}>
                {IDIOMAS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Rol en el club</label>
              <select value={form.rol} onChange={(e) => setField('rol', e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {tab === 'club' && (
        <div className="club-grid">
          <section className="panel club-card">
            <h2>Identidad del club</h2>
            <div className="club-identity">
              <div className="club-escudo">
                {form.img_escudo ? (
                  <img src={mediaUrl(form.img_escudo)} alt="Escudo" />
                ) : (
                  <span>{escudoLabel}</span>
                )}
              </div>
              <div className="club-identity-fields">
                <div className="escudo-actions">
                  <label className="btn-outline" style={{ display: 'inline-block', cursor: 'pointer' }}>
                    {form.img_escudo ? 'Cambiar escudo' : 'Subir escudo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={onEscudo}
                    />
                  </label>
                  {form.img_escudo && (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setField('img_escudo', '')}
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <p className="hint" style={{ margin: '0.35rem 0 0.75rem' }}>
                  PNG o JPG · máx. 2MB
                </p>
                <div className="field">
                  <label>Nombre corto</label>
                  <input
                    value={form.nombre_corto}
                    onChange={(e) => setField('nombre_corto', e.target.value)}
                    placeholder="Atlético Norte"
                  />
                </div>
                <div className="field">
                  <label>Código federativo</label>
                  <input
                    value={form.codigo_federativo}
                    onChange={(e) => setField('codigo_federativo', e.target.value)}
                    placeholder="MAD-08719"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="panel club-card">
            <h2>Datos generales</h2>
            <div className="form-grid club-form">
              <div className="field">
                <label>Nombre del club</label>
                <input
                  value={form.club_nombre}
                  onChange={(e) => setField('club_nombre', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Nombre del entrenador</label>
                <input
                  value={form.entrenador_nombre}
                  onChange={(e) => setField('entrenador_nombre', e.target.value)}
                  placeholder="Marta Vidal"
                />
              </div>
              <div className="field">
                <label>Categoría</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setField('categoria', e.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {form.categoria && !CATEGORIAS.includes(form.categoria) && (
                    <option value={form.categoria}>{form.categoria}</option>
                  )}
                </select>
              </div>
              <div className="field">
                <label>Pabellón</label>
                <input
                  value={form.pabellon}
                  onChange={(e) => setField('pabellon', e.target.value)}
                  placeholder="Polideportivo Municipal"
                />
              </div>
              <div className="field">
                <label>Competición</label>
                <select
                  value={form.competicion}
                  onChange={(e) => setField('competicion', e.target.value)}
                >
                  <option value="">Seleccionar</option>
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
            </div>
          </section>
        </div>
      )}

      {tab === 'notificaciones' && (
        <section className="panel">
          <h2>Notificaciones</h2>
          <div className="ajustes-toggles">
            <label className="ajustes-toggle">
              <div>
                <strong>Recibir por correo electrónico</strong>
                <small>Avisos relevantes del club y la temporada</small>
              </div>
              <input
                type="checkbox"
                checked={form.notifEmail}
                onChange={(e) => setField('notifEmail', e.target.checked)}
              />
            </label>
            <label className="ajustes-toggle">
              <div>
                <strong>Estadísticas en directo</strong>
                <small>Alertas cuando hay un partido en vivo</small>
              </div>
              <input
                type="checkbox"
                checked={form.notifDirecto}
                onChange={(e) => setField('notifDirecto', e.target.checked)}
              />
            </label>
            <label className="ajustes-toggle">
              <div>
                <strong>Resumen semanal</strong>
                <small>Informe automático cada lunes</small>
              </div>
              <input
                type="checkbox"
                checked={form.notifResumen}
                onChange={(e) => setField('notifResumen', e.target.checked)}
              />
            </label>
            <label className="ajustes-toggle">
              <div>
                <strong>Convocatorias</strong>
                <small>Cuando se confirma o cambia una convocatoria</small>
              </div>
              <input
                type="checkbox"
                checked={form.notifConvocatoria}
                onChange={(e) => setField('notifConvocatoria', e.target.checked)}
              />
            </label>
          </div>
        </section>
      )}

      {tab === 'preferencias' && (
        <section className="panel">
          <h2>Preferencias de la app</h2>
          <div className="form-grid club-form">
            <div className="field">
              <label>Tema</label>
              <select value={form.tema} onChange={(e) => onTemaChange(e.target.value)}>
                <option value="oscuro">Oscuro</option>
                <option value="claro">Claro</option>
                <option value="sistema">Sistema</option>
              </select>
            </div>
            <div className="field">
              <label>Zona horaria</label>
              <select
                value={form.zonaHoraria}
                onChange={(e) => setField('zonaHoraria', e.target.value)}
              >
                <option value="Europe/Madrid">Europe/Madrid</option>
                <option value="Atlantic/Canary">Atlantic/Canary</option>
                <option value="Europe/Lisbon">Europe/Lisbon</option>
              </select>
            </div>
            <div className="field">
              <label>Inicio de semana</label>
              <select
                value={form.semanaInicio}
                onChange={(e) => setField('semanaInicio', e.target.value)}
              >
                <option value="lunes">Lunes</option>
                <option value="domingo">Domingo</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {tab === 'seguridad' && (
        <section className="panel">
          <h2>Seguridad</h2>
          <div className="form-grid club-form">
            <div className="field">
              <label>Contraseña actual</label>
              <input
                type="password"
                value={pass.actual}
                onChange={(e) => {
                  setPass((p) => ({ ...p, actual: e.target.value }));
                  setDirty(true);
                }}
                autoComplete="current-password"
              />
            </div>
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={pass.nueva}
                onChange={(e) => {
                  setPass((p) => ({ ...p, nueva: e.target.value }));
                  setDirty(true);
                }}
                autoComplete="new-password"
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="field">
              <label>Confirmar nueva contraseña</label>
              <input
                type="password"
                value={pass.confirmar}
                onChange={(e) => {
                  setPass((p) => ({ ...p, confirmar: e.target.value }));
                  setDirty(true);
                }}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="ajustes-danger">
            <p className="muted">Cerrar sesión en este dispositivo</p>
            <button type="button" className="ghost" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </section>
      )}
    </>
  );
}
