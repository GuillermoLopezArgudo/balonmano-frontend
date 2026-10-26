import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import AuthImage from '../components/AuthImage';
import PasswordInput from '../components/PasswordInput';
import { passwordError } from '../password';
import { useAuth } from '../auth';
import { getSavedTema, saveTema } from '../theme';

const TABS_BASE = [
  { id: 'cuenta', label: 'Cuenta y seguridad' },
  { id: 'club', label: 'Club', adminOnly: true },
  { id: 'preferencias', label: 'Preferencias' },
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

function escudoInitials(nombre = '') {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'EQ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function defaultsFromSesion(equipo, miembro, saved = {}) {
  const d = equipo?.datos || {};
  const isMember = Boolean(miembro);
  return {
    nombre: isMember
      ? miembro.nombre || ''
      : (d.entrenador_nombre || saved.nombre || '').trim(),
    correo: isMember ? miembro.correo || '' : equipo?.correo || '',
    cargo: isMember ? miembro.cargo || '' : 'Entrenador principal',
    esAdmin: !miembro || miembro.permiso === 'administrador',
    tema: getSavedTema(),
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
  const {
    equipo,
    miembro,
    canManageClub,
    isOwner,
    refreshEquipo,
    refreshSesion,
    logout,
  } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = useMemo(
    () => TABS_BASE.filter((t) => !t.adminOnly || canManageClub),
    [canManageClub],
  );
  const tabIds = useMemo(() => new Set(tabs.map((t) => t.id)), [tabs]);
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(() =>
    tabIds.has(tabParam) ? tabParam : 'cuenta',
  );
  const [form, setForm] = useState(() => defaultsFromSesion(equipo, miembro));
  const [pass, setPass] = useState({ actual: '', nueva: '', confirmar: '' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Compat: ?tab=seguridad → Cuenta y seguridad
    if (tabParam === 'seguridad') {
      setTab('cuenta');
      setSearchParams({}, { replace: true });
      return;
    }
    if (tabIds.has(tabParam) && tabParam !== tab) setTab(tabParam);
    else if (tabParam && !tabIds.has(tabParam)) {
      setTab('cuenta');
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → state
  }, [tabParam, tabIds]);

  const selectTab = (id) => {
    setTab(id);
    setSearchParams(id === 'cuenta' ? {} : { tab: id }, { replace: true });
  };

  useEffect(() => {
    if (!equipo) return;
    const saved = loadPrefs(equipo.id_equipo) || {};
    setForm(defaultsFromSesion(equipo, miembro, saved));
    setDirty(false);
  }, [equipo, miembro]);

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
          tema: form.tema,
        }),
      );
      saveTema(form.tema);

      if (pass.nueva) {
        const passMsg = passwordError(pass.nueva);
        if (passMsg) throw new Error(passMsg);
        if (pass.nueva !== pass.confirmar) {
          throw new Error('Las contraseñas nuevas no coinciden');
        }
        if (!pass.actual) {
          throw new Error('Indica la contraseña actual');
        }
      }

      if (miembro) {
        if (form.nombre.trim() && form.nombre.trim() !== miembro.nombre) {
          await api.updatePerfilMiembro({ nombre: form.nombre.trim() });
        }
      } else if (canManageClub) {
        const cuentaPayload = {};
        if (form.correo && form.correo !== equipo?.correo) {
          cuentaPayload.correo = form.correo;
        }
        if (form.nombre.trim()) {
          cuentaPayload.entrenador_nombre = form.nombre.trim();
        }
        if (Object.keys(cuentaPayload).length) {
          await api.updateCuenta(cuentaPayload);
        }
      }

      if (canManageClub && tab === 'club') {
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
      }

      if (pass.nueva) {
        await api.changePassword({
          password_actual: pass.actual,
          password_nueva: pass.nueva,
        });
        sessionStorage.setItem(
          'siete_login_notice',
          'Contraseña actualizada. Entra de nuevo.',
        );
        logout();
        return;
      }

      await refreshSesion();
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
      </header>

      <div className="filters roster-filters">
        {tabs.map((t) => (
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
          <h2>Cuenta y seguridad</h2>
          <div className="ajustes-profile">
            <span className="ajustes-avatar">{avatarLetter}</span>
            <div>
              <strong>{form.nombre || 'Sin nombre'}</strong>
              <small>
                {form.cargo || 'Staff'}
                {form.esAdmin ? ' · Admin del club' : ''} · {clubName}
              </small>
            </div>
          </div>
          <div className="form-grid club-form">
            <div className="field">
              <label>{miembro ? 'Tu nombre' : 'Nombre del entrenador'}</label>
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
                onChange={(e) => isOwner && setField('correo', e.target.value)}
                readOnly={!isOwner}
                title={
                  !isOwner
                    ? 'El correo lo gestiona el administrador del club'
                    : undefined
                }
              />
            </div>
            <div className="field">
              <label>Cargo</label>
              <input
                value={
                  form.esAdmin
                    ? `${form.cargo || '—'} · Admin del club`
                    : form.cargo || '—'
                }
                readOnly
              />
            </div>
          </div>
          {!isOwner && (
            <p className="hint" style={{ marginTop: '0.75rem' }}>
              Entraste como miembro. El cargo y la administración del club los define el
              administrador.
            </p>
          )}

          <h3 className="ajustes-subhead">Cambiar contraseña</h3>
          <div className="form-grid club-form">
            <PasswordInput
              id="ajustes-pass-actual"
              label="Contraseña actual"
              value={pass.actual}
              autoComplete="current-password"
              onChange={(e) => {
                setPass((p) => ({ ...p, actual: e.target.value }));
                setDirty(true);
              }}
            />
            <PasswordInput
              id="ajustes-pass-nueva"
              label="Nueva contraseña"
              value={pass.nueva}
              autoComplete="new-password"
              minLength={8}
              placeholder="Mayúscula, minúscula y un número"
              showStrength
              onChange={(e) => {
                setPass((p) => ({ ...p, nueva: e.target.value }));
                setDirty(true);
              }}
            />
            <PasswordInput
              id="ajustes-pass-confirm"
              label="Confirmar nueva contraseña"
              value={pass.confirmar}
              autoComplete="new-password"
              onChange={(e) => {
                setPass((p) => ({ ...p, confirmar: e.target.value }));
                setDirty(true);
              }}
            />
          </div>

          <div className="ajustes-save-row">
            <button
              type="button"
              disabled={saving || (!dirty && !pass.nueva)}
              onClick={guardar}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          <div className="ajustes-danger">
            <p className="muted">Cerrar sesión en este dispositivo</p>
            <button type="button" className="ghost" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </section>
      )}

      {tab === 'club' && canManageClub && (
        <>
        <div className="club-grid">
          <section className="panel club-card">
            <h2>Identidad del club</h2>
            <div className="club-identity">
              <div className="club-escudo">
                {form.img_escudo ? (
                  <AuthImage path={form.img_escudo} alt="Escudo" />
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
            <div className="ajustes-save-row">
              <button type="button" disabled={saving || !dirty} onClick={guardar}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </section>
        </div>
        </>
      )}

      {tab === 'preferencias' && (
        <section className="panel">
          <h2>Preferencias</h2>
          <div className="form-grid club-form">
            <div className="field">
              <label>Tema</label>
              <select value={form.tema} onChange={(e) => onTemaChange(e.target.value)}>
                <option value="oscuro">Oscuro</option>
                <option value="claro">Claro</option>
                <option value="sistema">Sistema</option>
              </select>
            </div>
          </div>
        </section>
      )}

    </>
  );
}
