import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { CARGOS, CARGOS_UNICOS, writeLabelsForCargo } from '../permisos';
import { useAbortable } from '../useAbortable';
import { onMiembrosChanged } from '../useClubRealtime';

function initials(nombre = '') {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function absoluteInviteUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${window.location.origin}${path}`;
}

function cargoHint(cargo) {
  if (CARGOS_UNICOS.has(cargo)) return 'Solo uno en el club';
  return 'Varios permitidos';
}

function CargoSelect({ value, disabled, onChange, name, occupied }) {
  const current = CARGOS.includes(value) ? value : value || 'Staff';
  return (
    <select
      className="miembro-select"
      value={CARGOS.includes(current) ? current : current}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Cargo de ${name}`}
    >
      {!CARGOS.includes(current) && <option value={current}>{current}</option>}
      {CARGOS.map((c) => {
        const taken = occupied?.has(c) && c !== current;
        return (
          <option key={c} value={c} disabled={taken}>
            {c}
            {CARGOS_UNICOS.has(c) ? ' · único' : ''}
            {taken ? ' · ocupado' : ''}
          </option>
        );
      })}
    </select>
  );
}

export default function MiembrosClub() {
  const { equipo, canManageClub, refreshSesion } = useAuth();
  const [tab, setTab] = useState('miembros');
  const [miembros, setMiembros] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    cargo: 'Staff',
  });

  const load = async () => {
    setMiembros(await api.getMiembros());
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

  useEffect(() => onMiembrosChanged(() => {
    load().catch(() => {});
  }), []);

  const ocupados = useMemo(() => {
    const set = new Set();
    for (const m of miembros) {
      if (m.estado === 'baja') continue;
      if (CARGOS_UNICOS.has(m.cargo)) set.add(m.cargo);
    }
    return set;
  }, [miembros]);

  const counts = useMemo(() => {
    const activos = miembros.filter((m) => m.estado === 'activo');
    return {
      miembros: activos.length,
      invitaciones: miembros.filter((m) => m.estado === 'pendiente').length,
      bajas: miembros.filter((m) => m.estado === 'baja').length,
    };
  }, [miembros]);

  const listado = useMemo(() => {
    if (tab === 'invitaciones') return miembros.filter((m) => m.estado === 'pendiente');
    if (tab === 'bajas') return miembros.filter((m) => m.estado === 'baja');
    return miembros.filter((m) => m.estado === 'activo');
  }, [miembros, tab]);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const cargosInvite = useMemo(
    () => CARGOS.filter((c) => !CARGOS_UNICOS.has(c) || !ocupados.has(c)),
    [ocupados],
  );

  const copiarEnlace = async (url) => {
    const full = absoluteInviteUrl(url);
    try {
      await navigator.clipboard.writeText(full);
      setMsg('Enlace copiado. Envíaselo para que cree su contraseña.');
    } catch {
      setLastInviteUrl(full);
      setMsg(`Copia este enlace: ${full}`);
    }
  };

  const invitar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMsg('');
    setLastInviteUrl('');
    try {
      const created = await api.createMiembro({
        nombre: form.nombre,
        correo: form.correo,
        cargo: form.cargo,
        estado: 'pendiente',
      });
      setForm({ nombre: '', correo: '', cargo: cargosInvite[0] || 'Staff' });
      setShowInvite(false);
      await load();
      setTab('invitaciones');
      if (created.invite_url) {
        setLastInviteUrl(absoluteInviteUrl(created.invite_url));
        await copiarEnlace(created.invite_url);
      } else {
        setMsg('Invitación creada');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const withBusy = async (id, fn) => {
    setError('');
    setBusyId(id);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  const reinvitar = (id) =>
    withBusy(id, async () => {
      const updated = await api.reinvitarMiembro(id);
      await load();
      setTab('invitaciones');
      if (updated.invite_url) {
        setLastInviteUrl(absoluteInviteUrl(updated.invite_url));
        await copiarEnlace(updated.invite_url);
      }
    });

  const darBaja = (id) =>
    withBusy(id, async () => {
      await api.updateMiembro(id, { estado: 'baja' });
      await load();
      setMsg('Miembro dado de baja');
    });

  const reactivar = (id) =>
    withBusy(id, async () => {
      await api.updateMiembro(id, { estado: 'activo' });
      await load();
      setMsg('Miembro reactivado');
    });

  const cambiarCargo = (id, cargo) =>
    withBusy(id, async () => {
      const prev = miembros.find((m) => m.id_miembro === id)?.cargo;
      setMiembros((list) =>
        list.map((m) => (m.id_miembro === id ? { ...m, cargo } : m)),
      );
      try {
        await api.updateMiembro(id, { cargo });
        setMsg('Cargo actualizado');
        await refreshSesion();
      } catch (e) {
        if (prev != null) {
          setMiembros((list) =>
            list.map((m) => (m.id_miembro === id ? { ...m, cargo: prev } : m)),
          );
        } else {
          await load();
        }
        throw e;
      }
    });

  const traspasarAdmin = async (m) => {
    if (
      !window.confirm(
        `¿Traspasar la administración a ${m.nombre}?\n\nPerderás la gestión del club. Su cargo (${m.cargo}) define qué páginas puede editar.`,
      )
    ) {
      return;
    }
    setSaving(true);
    await withBusy(m.id_miembro, async () => {
      await api.hacerAdministrador(m.id_miembro);
      setMsg(`Administración traspasada a ${m.nombre}`);
      await refreshSesion();
      await load();
    });
    setSaving(false);
  };

  if (!canManageClub) {
    return <Navigate to="/club" replace />;
  }

  const emptyCopy =
    tab === 'invitaciones'
      ? 'No hay invitaciones pendientes'
      : tab === 'bajas'
        ? 'Sin bajas'
        : 'Aún no hay miembros activos';

  return (
    <div className="miembros-page">
      <header className="page-head miembros-page-head">
        <div>
          <p className="page-kicker">CLUB · EQUIPO TÉCNICO</p>
          <h1>Miembros</h1>
        </div>
      </header>

      {canManageClub && (
        <details className="miembros-leyenda">
          <summary>Qué puede editar cada cargo</summary>
          <ul className="miembros-leyenda-list">
            {CARGOS.map((cargo) => {
              const areas = writeLabelsForCargo(cargo);
              return (
                <li key={cargo}>
                  <strong>{cargo}</strong>
                  <span>{areas.length ? areas.join(' · ') : 'Solo lectura'}</span>
                </li>
              );
            })}
            <li>
              <strong>Administrador del club</strong>
              <span>
                Todo lo anterior + gestionar club (independiente del cargo)
              </span>
            </li>
          </ul>
        </details>
      )}

      <div className="miembros-tabs" role="tablist">
        {[
          { id: 'miembros', label: 'Activos', n: counts.miembros },
          { id: 'invitaciones', label: 'Invitaciones', n: counts.invitaciones },
          { id: 'bajas', label: 'Bajas', n: counts.bajas },
        ].map((t) => (
          <button
            type="button"
            role="tab"
            key={t.id}
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
            <em>{t.n}</em>
          </button>
        ))}
        <div className="filters-end">
          <Link to="/club">
            <button type="button" className="ghost">
              Club
            </button>
          </Link>
          <button
            type="button"
            className={showInvite ? 'ghost' : ''}
            onClick={() => setShowInvite((v) => !v)}
          >
            {showInvite ? 'Cerrar' : 'Invitar'}
          </button>
        </div>
      </div>

      {showInvite && (
        <form className="panel miembros-invite" onSubmit={invitar}>
          <div className="miembros-invite-top">
            <h2>Invitar miembro</h2>
            <p>Recibirá un enlace para crear su contraseña.</p>
          </div>
          <div className="miembros-invite-grid">
            <div className="field">
              <label htmlFor="inv-nombre">Nombre</label>
              <input
                id="inv-nombre"
                required
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                placeholder="Laura Sanz"
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="inv-correo">Correo</label>
              <input
                id="inv-correo"
                required
                type="email"
                value={form.correo}
                onChange={(e) => setField('correo', e.target.value)}
                placeholder="laura@club.com"
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <div className="field">
              <label htmlFor="inv-cargo">Cargo</label>
              <select
                id="inv-cargo"
                value={cargosInvite.includes(form.cargo) ? form.cargo : cargosInvite[0] || 'Staff'}
                onChange={(e) => setField('cargo', e.target.value)}
              >
                {cargosInvite.map((c) => (
                  <option key={c} value={c}>
                    {c}
                    {CARGOS_UNICOS.has(c) ? ' (único)' : ''}
                  </option>
                ))}
              </select>
              <small className="hint">{cargoHint(form.cargo)}</small>
            </div>
          </div>
          <div className="miembros-invite-actions">
            <button type="submit" disabled={saving || !cargosInvite.length}>
              {saving ? 'Creando…' : 'Crear invitación'}
            </button>
            <button type="button" className="ghost" onClick={() => setShowInvite(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {lastInviteUrl && (
        <div className="panel miembros-invite-link">
          <h2>Enlace listo</h2>
          <p className="muted">Caduca en 7 días. Compártelo solo con esa persona.</p>
          <code>{lastInviteUrl}</code>
          <button type="button" onClick={() => copiarEnlace(lastInviteUrl)}>
            Copiar enlace
          </button>
        </div>
      )}

      {msg && <p className="ok-msg">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <div className="miembros-cards">
        {listado.map((m) => {
          const isAdmin = m.permiso === 'administrador';
          const isYou = m.correo === equipo?.correo;
          const rowBusy = busyId === m.id_miembro || saving;
          return (
            <article
              key={m.id_miembro}
              className={`miembro-card${isAdmin ? ' is-admin' : ''}${
                m.estado === 'pendiente' ? ' is-pending' : ''
              }${m.estado === 'baja' ? ' is-baja' : ''}`}
            >
              <header className="miembro-card-head">
                <span className={`miembro-avatar${isAdmin ? ' is-admin' : ''}`}>
                  {initials(m.nombre)}
                </span>
                <div className="miembro-card-id">
                  <strong>
                    {m.nombre}
                    {isYou ? <span className="miembro-you">tú</span> : null}
                  </strong>
                  <small>{m.correo}</small>
                </div>
                {isAdmin && <span className="miembro-pill admin">Admin</span>}
                {m.estado === 'pendiente' && (
                  <span className="miembro-pill pending">Pendiente</span>
                )}
                {m.estado === 'baja' && <span className="miembro-pill baja">Baja</span>}
              </header>

              <div className="miembro-card-body">
                <label className="miembro-field-label" htmlFor={`cargo-${m.id_miembro}`}>
                  Cargo
                </label>
                {m.estado === 'baja' ? (
                  <p className="miembros-static">{m.cargo || '—'}</p>
                ) : (
                  <CargoSelect
                    value={m.cargo}
                    name={m.nombre}
                    disabled={rowBusy}
                    occupied={ocupados}
                    onChange={(cargo) => cambiarCargo(m.id_miembro, cargo)}
                  />
                )}
              </div>

              {!(m.estado === 'activo' && isAdmin) && (
              <footer className="miembro-card-actions">
                {m.estado === 'activo' && !isAdmin && (
                  <>
                    {!m.tiene_acceso && (
                      <button
                        type="button"
                        className="ghost"
                        disabled={rowBusy}
                        onClick={() => reinvitar(m.id_miembro)}
                      >
                        Enlace
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost"
                      disabled={rowBusy}
                      onClick={() => traspasarAdmin(m)}
                    >
                      Hacer admin
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      disabled={rowBusy}
                      onClick={() => darBaja(m.id_miembro)}
                    >
                      Baja
                    </button>
                  </>
                )}
                {m.estado === 'pendiente' && (
                  <>
                    <button
                      type="button"
                      disabled={rowBusy}
                      onClick={() => reinvitar(m.id_miembro)}
                    >
                      Copiar enlace
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      disabled={rowBusy}
                      onClick={() => darBaja(m.id_miembro)}
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {m.estado === 'baja' && (
                  <>
                    <button
                      type="button"
                      disabled={rowBusy}
                      onClick={() => reactivar(m.id_miembro)}
                    >
                      Reactivar
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={rowBusy}
                      onClick={() => reinvitar(m.id_miembro)}
                    >
                      Nuevo enlace
                    </button>
                  </>
                )}
              </footer>
              )}
            </article>
          );
        })}

        {!listado.length && (
          <div className="miembros-empty panel">
            <p>{emptyCopy}</p>
            {tab === 'miembros' && (
              <button type="button" onClick={() => setShowInvite(true)}>
                Invitar miembro
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
