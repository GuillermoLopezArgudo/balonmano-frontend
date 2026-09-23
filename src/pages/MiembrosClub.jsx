import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const CARGOS = [
  'Entrenador principal',
  'Segundo entrenador',
  'Preparador físico',
  'Delegado',
  'Analista',
  'Staff',
];

const PERMISOS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
  { value: 'lector', label: 'Lector' },
];

function initials(nombre = '') {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function permisoLabel(p) {
  return PERMISOS.find((x) => x.value === p)?.label || p;
}

export default function MiembrosClub() {
  const { equipo } = useAuth();
  const [tab, setTab] = useState('miembros');
  const [miembros, setMiembros] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    cargo: 'Segundo entrenador',
    permiso: 'editor',
  });

  const load = async () => {
    const list = await api.getMiembros();
    setMiembros(list);
  };

  useAbortable(async ({ signal, alive }) => {
    try {
      const list = await api.getMiembros({ signal });
      if (alive()) setMiembros(list);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const counts = useMemo(() => {
    const activos = miembros.filter((m) => m.estado === 'activo');
    return {
      miembros: activos.length,
      administradores: activos.filter((m) => m.permiso === 'administrador').length,
      entrenadores: activos.filter((m) =>
        (m.cargo || '').toLowerCase().includes('entrenador'),
      ).length,
      invitaciones: miembros.filter((m) => m.estado === 'pendiente').length,
      bajas: miembros.filter((m) => m.estado === 'baja').length,
    };
  }, [miembros]);

  const listado = useMemo(() => {
    if (tab === 'invitaciones') return miembros.filter((m) => m.estado === 'pendiente');
    if (tab === 'bajas') return miembros.filter((m) => m.estado !== 'activo');
    return miembros.filter((m) => m.estado === 'activo');
  }, [miembros, tab]);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const invitar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMsg('');
    try {
      await api.createMiembro({
        nombre: form.nombre,
        correo: form.correo,
        cargo: form.cargo,
        permiso: form.permiso,
        estado: 'pendiente',
      });
      setForm({
        nombre: '',
        correo: '',
        cargo: 'Segundo entrenador',
        permiso: 'editor',
      });
      setShowInvite(false);
      setMsg('Invitación enviada');
      await load();
      setTab('invitaciones');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const aceptar = async (id) => {
    await api.updateMiembro(id, { estado: 'activo' });
    await load();
    setMsg('Miembro activado');
  };

  const darBaja = async (id) => {
    await api.updateMiembro(id, { estado: 'baja' });
    await load();
    setMsg('Miembro dado de baja');
  };

  const reactivar = async (id) => {
    await api.updateMiembro(id, { estado: 'activo' });
    await load();
    setMsg('Miembro reactivado');
  };

  const cambiarPermiso = async (id, permiso) => {
    await api.updateMiembro(id, { permiso });
    await load();
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">CLUB / EQUIPO TÉCNICO</p>
          <h1>Miembros del club</h1>
        </div>
        <div className="add-player-actions">
          <Link to="/club">
            <button type="button" className="ghost">
              Datos del equipo
            </button>
          </Link>
          <button type="button" onClick={() => setShowInvite((v) => !v)}>
            + Invitar miembro
          </button>
        </div>
      </header>

      <div className="metrics miembros-kpis">
        <div className="metric">
          <span>Miembros</span>
          <strong className="c-lime">{counts.miembros}</strong>
        </div>
        <div className="metric">
          <span>Administradores</span>
          <strong className="c-purple">{counts.administradores}</strong>
        </div>
        <div className="metric">
          <span>Entrenadores</span>
          <strong className="c-lime">{counts.entrenadores}</strong>
        </div>
      </div>

      <div className="filters roster-filters">
        <button
          type="button"
          className={tab === 'miembros' ? 'active' : ''}
          onClick={() => setTab('miembros')}
        >
          Miembros ({counts.miembros})
        </button>
        <button
          type="button"
          className={tab === 'invitaciones' ? 'active' : ''}
          onClick={() => setTab('invitaciones')}
        >
          Invitaciones ({counts.invitaciones})
        </button>
        <button
          type="button"
          className={tab === 'bajas' ? 'active' : ''}
          onClick={() => setTab('bajas')}
        >
          Bajas y permisos
        </button>
      </div>

      {showInvite && (
        <form className="panel miembros-invite" onSubmit={invitar}>
          <h2>Invitar miembro</h2>
          <div className="informes-fields">
            <div className="field">
              <label>Nombre</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                placeholder="Laura Sanz"
              />
            </div>
            <div className="field">
              <label>Correo</label>
              <input
                required
                type="email"
                value={form.correo}
                onChange={(e) => setField('correo', e.target.value)}
                placeholder="laura@club.com"
              />
            </div>
            <div className="field">
              <label>Cargo</label>
              <select value={form.cargo} onChange={(e) => setField('cargo', e.target.value)}>
                {CARGOS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Permiso</label>
              <select
                value={form.permiso}
                onChange={(e) => setField('permiso', e.target.value)}
              >
                {PERMISOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="informes-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Enviando…' : 'Enviar invitación'}
            </button>
            <button type="button" className="ghost" onClick={() => setShowInvite(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {msg && <p className="ok-msg">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel roster-panel">
        <div className="roster-head miembros-head">
          <span>Nombre</span>
          <span>Rol</span>
          <span>Estado / Acción</span>
        </div>
        <div className="roster-list">
          {listado.map((m) => (
            <div className="roster-row miembros-row" key={m.id_miembro}>
              <div className="roster-player">
                <span
                  className="avatar"
                  style={{
                    background: m.permiso === 'administrador' ? 'var(--purple)' : 'var(--panel-2)',
                    color: '#fff',
                  }}
                >
                  {initials(m.nombre)}
                </span>
                <span>
                  <strong>{m.nombre}</strong>
                  <small>{m.correo}</small>
                </span>
              </div>
              <div className="miembros-rol">
                <strong>{m.cargo}</strong>
                <span className={`miembro-badge ${m.permiso}`}>
                  {permisoLabel(m.permiso)}
                </span>
              </div>
              <div className="miembros-actions">
                {m.estado === 'activo' && (
                  <>
                    <span className="miembro-estado activo">Activo</span>
                    {tab === 'bajas' && (
                      <select
                        value={m.permiso}
                        onChange={(e) => cambiarPermiso(m.id_miembro, e.target.value)}
                      >
                        {PERMISOS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {m.correo !== equipo?.correo && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => darBaja(m.id_miembro)}
                      >
                        Dar de baja
                      </button>
                    )}
                  </>
                )}
                {m.estado === 'pendiente' && (
                  <>
                    <span className="miembro-estado pendiente">Pendiente</span>
                    <button type="button" onClick={() => aceptar(m.id_miembro)}>
                      Aceptar
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => darBaja(m.id_miembro)}
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {m.estado === 'baja' && (
                  <>
                    <span className="miembro-estado baja">Baja</span>
                    <button type="button" className="ghost" onClick={() => reactivar(m.id_miembro)}>
                      Reactivar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!listado.length && (
            <p className="muted" style={{ padding: '1rem' }}>
              {tab === 'invitaciones'
                ? 'No hay invitaciones pendientes'
                : tab === 'bajas'
                  ? 'Sin bajas ni cambios de permiso'
                  : 'Aún no hay miembros activos'}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
