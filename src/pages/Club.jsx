import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbortError, mediaUrl } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const TABS = [
  { id: 'datos', label: 'Datos del equipo' },
  { id: 'temporada', label: 'Temporada' },
];

function initials(nombre = '') {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'EQ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function Field({ label, value }) {
  return (
    <div className="field">
      <label>{label}</label>
      <p className="club-readonly-value">{value || '—'}</p>
    </div>
  );
}

export default function Club() {
  const { equipo } = useAuth();
  const [tab, setTab] = useState('datos');
  const [temporadas, setTemporadas] = useState([]);
  const [tempMsg, setTempMsg] = useState('');
  const [tempBusy, setTempBusy] = useState(false);
  const [error, setError] = useState('');
  const [nuevaTemp, setNuevaTemp] = useState(() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    const start = m <= 2 ? y - 1 : y;
    return {
      nombre: `${start}/${String(start + 1).slice(-2)}`,
      fecha_inicio: `${start}-10-01`,
      fecha_fin: `${start + 1}-03-31`,
    };
  });

  const d = equipo?.datos;

  useAbortable(async ({ signal, alive }) => {
    try {
      const list = await api.getTemporadas({ signal });
      if (alive()) setTemporadas(list);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setTemporadas([]);
    }
  }, []);

  const loadTemporadas = async () => {
    setTemporadas(await api.getTemporadas());
  };

  const temporadaActiva = useMemo(
    () => temporadas.find((t) => t.estado === 'activa') || null,
    [temporadas],
  );

  const escudoLabel = useMemo(
    () => initials(d?.nombre_corto || d?.nombre),
    [d?.nombre_corto, d?.nombre],
  );

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">CLUB</p>
          <h1>Datos del equipo</h1>
        </div>
        <div className="add-player-actions">
          <Link to="/club/miembros">
            <button type="button" className="ghost">
              Miembros
            </button>
          </Link>
          {tab === 'datos' && (
            <Link to="/ajustes?tab=club">
              <button type="button">Editar en Ajustes</button>
            </Link>
          )}
        </div>
      </header>

      <div className="filters roster-filters club-tabs">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'datos' && (
        <>
          <p className="club-status saved">
            <span className="club-status-dot" />
            Solo consulta · los cambios se hacen en Ajustes
          </p>

          <div className="club-grid">
            <section className="panel club-card">
              <h2>Identidad del club</h2>
              <div className="club-identity">
                <div className="club-escudo">
                  {d?.img_escudo ? (
                    <img src={mediaUrl(d.img_escudo)} alt="Escudo" />
                  ) : (
                    <span>{escudoLabel}</span>
                  )}
                </div>
                <div className="club-identity-fields">
                  <Field label="Nombre corto" value={d?.nombre_corto} />
                  <Field label="Código federativo" value={d?.codigo_federativo} />
                </div>
              </div>
            </section>

            <section className="panel club-card">
              <h2>Datos generales</h2>
              <div className="form-grid club-form">
                <Field label="Nombre del club" value={d?.nombre} />
                <Field label="Nombre del entrenador" value={d?.entrenador_nombre} />
                <Field label="Categoría" value={d?.categoria} />
                <Field label="Pabellón" value={d?.pabellon} />
                <Field label="Competición" value={d?.competicion} />
              </div>
            </section>
          </div>
        </>
      )}

      {tab === 'temporada' && (
        <section className="panel club-card">
          <div className="acta-panel-head">
            <h2>Temporadas del club</h2>
            {temporadaActiva && (
              <span className="miembro-badge administrador">
                Activa: {temporadaActiva.nombre}
              </span>
            )}
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Al abrir una nueva se cierra la anterior. Los aplazados se quedan en la cerrada
            hasta jugarlos; luego puedes archivarla.
          </p>

          <div className="informes-fields" style={{ marginBottom: '1rem' }}>
            <div className="field">
              <label>Nombre</label>
              <input
                value={nuevaTemp.nombre}
                onChange={(e) => setNuevaTemp((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="2026/27"
              />
            </div>
            <div className="field">
              <label>Inicio</label>
              <input
                type="date"
                value={nuevaTemp.fecha_inicio}
                onChange={(e) => setNuevaTemp((p) => ({ ...p, fecha_inicio: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Fin</label>
              <input
                type="date"
                value={nuevaTemp.fecha_fin}
                onChange={(e) => setNuevaTemp((p) => ({ ...p, fecha_fin: e.target.value }))}
              />
            </div>
          </div>
          <div className="informes-actions" style={{ marginBottom: '1.25rem' }}>
            <button
              type="button"
              disabled={tempBusy}
              onClick={async () => {
                setTempBusy(true);
                setTempMsg('');
                setError('');
                try {
                  await api.abrirTemporada({
                    ...nuevaTemp,
                    cerrar_anterior: true,
                  });
                  await loadTemporadas();
                  setTempMsg('Temporada abierta. La anterior quedó cerrada.');
                } catch (e) {
                  setError(e.message);
                } finally {
                  setTempBusy(false);
                }
              }}
            >
              Abrir nueva temporada
            </button>
          </div>
          {tempMsg && <p className="ok-msg">{tempMsg}</p>}
          {error && <p className="error">{error}</p>}

          {temporadas.length ? (
            <div className="roster-list">
              {temporadas.map((t) => (
                <div key={t.id_temporada} className="roster-row temporada-row">
                  <div>
                    <strong>
                      {t.nombre}{' '}
                      <span className={`temp-estado ${t.estado}`}>{t.estado}</span>
                    </strong>
                    <small className="muted">
                      {t.fecha_inicio} → {t.fecha_fin}
                      {t.pendientes ? ` · ${t.pendientes} pendiente(s)` : ''}
                    </small>
                  </div>
                  <div className="miembros-actions">
                    {t.estado === 'activa' && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={async () => {
                          if (
                            !confirm(
                              t.pendientes
                                ? `Cerrar ${t.nombre}? Quedarán ${t.pendientes} partido(s) pendientes (aplazados se podrán terminar).`
                                : `¿Cerrar la temporada ${t.nombre}?`,
                            )
                          )
                            return;
                          await api.cerrarTemporada(t.id_temporada);
                          await loadTemporadas();
                          setTempMsg('Temporada cerrada');
                        }}
                      >
                        Cerrar
                      </button>
                    )}
                    {t.estado === 'cerrada' && (
                      <>
                        <button
                          type="button"
                          className="ghost"
                          onClick={async () => {
                            if (!confirm(`¿Reactivar ${t.nombre}? Se cerrará la activa actual.`))
                              return;
                            await api.activarTemporada(t.id_temporada);
                            await loadTemporadas();
                            setTempMsg('Temporada reactivada');
                          }}
                        >
                          Reactivar
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={async () => {
                            try {
                              await api.archivarTemporada(t.id_temporada);
                              await loadTemporadas();
                              setTempMsg('Temporada archivada');
                            } catch (e) {
                              setError(e.message);
                            }
                          }}
                        >
                          Archivar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Aún no hay temporadas registradas</p>
          )}
        </section>
      )}
    </>
  );
}
