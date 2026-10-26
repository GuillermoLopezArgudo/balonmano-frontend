import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { IcoBasura, IcoFlecha } from '../components/ActionIcons';
import { useAbortable } from '../useAbortable';

const MES_LABEL = {
  9: 'Sep',
  10: 'Oct',
  11: 'Nov',
  12: 'Dic',
  1: 'Ene',
  2: 'Feb',
  3: 'Mar',
  4: 'Abr',
  5: 'May',
  6: 'Jun',
};

function euro(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

function mesPagado(j, m) {
  return Boolean((j.meses || []).find((x) => x.mes === m)?.pagado);
}

export default function Cuotas() {
  const { canWriteCuotas, canReadCuotas } = useAuth();
  const [temporadas, setTemporadas] = useState([]);
  const [idTemporada, setIdTemporada] = useState('');
  const [data, setData] = useState(null);
  const [importeMensual, setImporteMensual] = useState('');
  const [importeFed, setImporteFed] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const loadCuotas = async (tempId, { signal } = {}) => {
    const res = await api.getCuotas({
      id_temporada: tempId || undefined,
      signal,
    });
    setData(res);
    setIdTemporada(res.id_temporada);
    setImporteMensual(String(res.config?.importe_mensual ?? 0));
    setImporteFed(String(res.config?.importe_federacion ?? 0));
    setSelected(new Set());
    return res;
  };

  useAbortable(async ({ signal, alive }) => {
    try {
      const temps = await api.getTemporadas({ signal });
      if (!alive()) return;
      setTemporadas(temps);
      const activa = temps.find((t) => t.estado === 'activa') || temps[0];
      if (activa) {
        await loadCuotas(activa.id_temporada, { signal });
      }
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const meses = data?.meses || [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  const soloLectura = Boolean(data?.solo_lectura) || !canWriteCuotas;
  const resumen = data?.resumen;
  const jugadoras = data?.jugadoras || [];

  const allIds = useMemo(() => jugadoras.map((j) => j.id_jugador), [jugadoras]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const onChangeTemporada = async (tid) => {
    setError('');
    setStatus('');
    setIdTemporada(tid);
    try {
      setBusy(true);
      await loadCuotas(tid);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const guardarConfig = async (e) => {
    e.preventDefault();
    if (soloLectura) return;
    setError('');
    setStatus('');
    try {
      setBusy(true);
      const res = await api.updateCuotasConfig(
        {
          importe_mensual: Number(importeMensual) || 0,
          importe_federacion: Number(importeFed) || 0,
        },
        { id_temporada: idTemporada },
      );
      setData(res);
      setStatus('Importes guardados');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMes = async (idJugador, mes, pagado) => {
    if (soloLectura || busy) return;
    setError('');
    try {
      setBusy(true);
      const res = await api.patchCuotaMensual(
        { id_jugador: idJugador, mes, pagado: !pagado },
        { id_temporada: idTemporada },
      );
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleFed = async (idJugador, pagado) => {
    if (soloLectura || busy) return;
    setError('');
    try {
      setBusy(true);
      const res = await api.patchFederacion(
        { id_jugador: idJugador, pagado: !pagado },
        { id_temporada: idTemporada },
      );
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async (accion) => {
    if (soloLectura || busy || !selected.size) return;
    if (accion === 'limpiar') {
      const ok = confirm(
        `¿Borrar todos los pagos (federación + cuotas) de ${selected.size} jugadora${
          selected.size === 1 ? '' : 's'
        }?`,
      );
      if (!ok) return;
    }
    setError('');
    setStatus('');
    try {
      setBusy(true);
      const res = await api.bulkCuotas(
        { id_jugadores: [...selected], accion },
        { id_temporada: idTemporada },
      );
      setData(res);
      setSelected(new Set());
      if (accion === 'limpiar') setStatus('Pagos borrados');
      else if (accion === 'cuotas_pagadas') setStatus('Cuotas marcadas como pagadas');
      else if (accion === 'cuotas_pendientes') setStatus('Cuotas marcadas como pendientes');
      else if (accion === 'federacion_pagada') setStatus('Federación marcada como pagada');
      else setStatus('Federación marcada como pendiente');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const kicker = useMemo(() => {
    if (!data) return 'CLUB';
    return `TEMPORADA ${data.temporada_nombre || ''}`.trim();
  }, [data]);

  if (!canReadCuotas) {
    return <Navigate to="/club" replace />;
  }

  return (
    <div className="cuotas-page">
      <header className="page-head">
        <div>
          <p className="page-kicker">{kicker}</p>
          <h1>Cuotas y federación</h1>
        </div>
        <Link className="page-back" to="/club">
          <button type="button" className="ghost">
            <IcoFlecha />
            Volver
          </button>
        </Link>
      </header>

      <div className="cuotas-toolbar">
        <div className="field cuotas-temp-field">
          <label htmlFor="cuotas-temp">Temporada</label>
          <select
            id="cuotas-temp"
            value={idTemporada}
            onChange={(e) => onChangeTemporada(e.target.value)}
            disabled={busy || !temporadas.length}
          >
            {temporadas.map((t) => (
              <option key={t.id_temporada} value={t.id_temporada}>
                {t.nombre}
                {t.estado === 'activa' ? ' · activa' : t.estado === 'cerrada' ? ' · cerrada' : ''}
              </option>
            ))}
          </select>
        </div>
        {soloLectura && <p className="cuotas-readonly">Solo lectura</p>}
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="ok-msg">{status}</p>}

      {data && (
        <>
          <form className="panel cuotas-config" onSubmit={guardarConfig}>
            <h2>Importes</h2>
            <div className="cuotas-config-grid">
              <div className="field">
                <label htmlFor="imp-mensual">Cuota mensual</label>
                <div className="cuotas-input-euro">
                  <input
                    id="imp-mensual"
                    type="number"
                    min="0"
                    step="0.01"
                    value={importeMensual}
                    onChange={(e) => setImporteMensual(e.target.value)}
                    disabled={soloLectura || busy}
                  />
                  <span>€</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="imp-fed">Federación</label>
                <div className="cuotas-input-euro">
                  <input
                    id="imp-fed"
                    type="number"
                    min="0"
                    step="0.01"
                    value={importeFed}
                    onChange={(e) => setImporteFed(e.target.value)}
                    disabled={soloLectura || busy}
                  />
                  <span>€</span>
                </div>
              </div>
              {!soloLectura && (
                <div className="cuotas-config-actions">
                  <button type="submit" disabled={busy}>
                    Guardar
                  </button>
                </div>
              )}
            </div>
            <p className="cuotas-config-hint">
              Federación: pago único de la temporada (no se prorratea).
            </p>
          </form>

          {resumen && (
            <div className="cuotas-metrics">
              <div className="cuotas-metric">
                <span>Federación</span>
                <strong>
                  {resumen.federacion_pagadas}
                  <em>/{resumen.total_jugadoras}</em>
                </strong>
                <small>
                  {resumen.federacion_pendientes} pendiente
                  {resumen.federacion_pendientes === 1 ? '' : 's'} ·{' '}
                  {euro(resumen.cobrado_federacion)} / {euro(resumen.esperado_federacion)}
                </small>
              </div>
              <div className="cuotas-metric">
                <span>Cuotas</span>
                <strong>
                  {resumen.cuotas_pagadas}
                  <em>/{resumen.cuotas_pagadas + resumen.cuotas_pendientes}</em>
                </strong>
                <small>
                  {euro(resumen.cobrado_mensual)} / {euro(resumen.esperado_mensual)}
                </small>
              </div>
            </div>
          )}

          <section className="panel cuotas-panel">
            <div className="cuotas-panel-head">
              <div>
                <h2>Control de pagos</h2>
                <p className="panel-hint">
                  Selecciona jugadoras para marcar todas sus cuotas, o toca una celda.
                  Verde = pagado.
                </p>
              </div>
            </div>

            {!soloLectura && (
              <div className="cuotas-bulk-bar" role="toolbar" aria-label="Acciones en masa">
                <p className="cuotas-bulk-count">
                  {someSelected
                    ? `${selected.size} seleccionada${selected.size === 1 ? '' : 's'}`
                    : 'Ninguna seleccionada'}
                </p>
                <div className="cuotas-bulk-actions">
                  <div className="cuotas-bulk-group">
                    <button
                      type="button"
                      disabled={busy || !someSelected}
                      onClick={() => runBulk('cuotas_pagadas')}
                    >
                      Cuotas pagadas
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy || !someSelected}
                      onClick={() => runBulk('cuotas_pendientes')}
                    >
                      Cuotas pendientes
                    </button>
                  </div>
                  <div className="cuotas-bulk-group">
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy || !someSelected}
                      onClick={() => runBulk('federacion_pagada')}
                    >
                      Fed. pagada
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy || !someSelected}
                      onClick={() => runBulk('federacion_pendiente')}
                    >
                      Fed. pendiente
                    </button>
                  </div>
                  <div className="cuotas-bulk-group cuotas-bulk-group-end">
                    <button
                      type="button"
                      className="btn-icon-del"
                      disabled={busy || !someSelected}
                      title="Borrar pagos seleccionados"
                      aria-label="Borrar pagos seleccionados"
                      onClick={() => runBulk('limpiar')}
                    >
                      <IcoBasura />
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy || !someSelected}
                      onClick={() => setSelected(new Set())}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop / tablet landscape table */}
            <div className="cuotas-table-wrap">
              <table className="cuotas-table">
                <thead>
                  <tr>
                    <th className="cuotas-col-check">
                      {!soloLectura && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          disabled={!jugadoras.length}
                          onChange={toggleAll}
                          aria-label="Seleccionar todas"
                        />
                      )}
                    </th>
                    <th className="cuotas-col-name">Jugadora</th>
                    <th className="cuotas-col-fed">Fed.</th>
                    {meses.map((m) => (
                      <th key={m}>{MES_LABEL[m] || m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jugadoras.map((j) => {
                    const isOn = selected.has(j.id_jugador);
                    return (
                      <tr key={j.id_jugador} className={isOn ? 'is-selected' : ''}>
                        <td className="cuotas-col-check">
                          {!soloLectura && (
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={() => toggleOne(j.id_jugador)}
                              aria-label={`Seleccionar ${j.nombre} ${j.apellido}`}
                            />
                          )}
                        </td>
                        <td className="cuotas-col-name">
                          <span className="cuotas-player">
                            {j.dorsal != null && (
                              <span className="cuotas-dorsal">#{j.dorsal}</span>
                            )}
                            <strong>
                              {j.nombre} {j.apellido}
                            </strong>
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`cuota-cell cuota-fed${
                              j.federacion_pagada ? ' is-paid' : ' is-pending'
                            }${soloLectura ? ' is-locked' : ''}`}
                            disabled={soloLectura || busy}
                            title={
                              j.federacion_pagada
                                ? 'Federación pagada'
                                : 'Federación pendiente'
                            }
                            aria-pressed={j.federacion_pagada}
                            onClick={() => toggleFed(j.id_jugador, j.federacion_pagada)}
                          >
                            {j.federacion_pagada ? 'Sí' : 'No'}
                          </button>
                        </td>
                        {meses.map((m) => {
                          const pagado = mesPagado(j, m);
                          return (
                            <td key={m}>
                              <button
                                type="button"
                                className={`cuota-cell${pagado ? ' is-paid' : ' is-pending'}${
                                  soloLectura ? ' is-locked' : ''
                                }`}
                                disabled={soloLectura || busy}
                                title={`${MES_LABEL[m]} · ${pagado ? 'Pagado' : 'Pendiente'}`}
                                aria-pressed={pagado}
                                onClick={() => toggleMes(j.id_jugador, m, pagado)}
                              >
                                <span className="sr-only">
                                  {MES_LABEL[m]} {pagado ? 'pagado' : 'pendiente'}
                                </span>
                                {pagado ? '✓' : ''}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / narrow cards */}
            <div className="cuotas-cards">
              {!soloLectura && jugadoras.length > 0 && (
                <label className="cuotas-select-all">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                  <span>Seleccionar todas</span>
                </label>
              )}
              {jugadoras.map((j) => {
                const isOn = selected.has(j.id_jugador);
                const paidMonths = meses.filter((m) => mesPagado(j, m)).length;
                return (
                  <article
                    key={j.id_jugador}
                    className={`cuotas-card${isOn ? ' is-selected' : ''}`}
                  >
                    <header className="cuotas-card-head">
                      {!soloLectura && (
                        <input
                          type="checkbox"
                          className="cuotas-card-check"
                          checked={isOn}
                          onChange={() => toggleOne(j.id_jugador)}
                          aria-label={`Seleccionar ${j.nombre} ${j.apellido}`}
                        />
                      )}
                      <div className="cuotas-card-id">
                        <strong>
                          {j.dorsal != null ? `#${j.dorsal} ` : ''}
                          {j.nombre} {j.apellido}
                        </strong>
                        <small>
                          {paidMonths}/{meses.length} meses · Fed.{' '}
                          {j.federacion_pagada ? 'ok' : 'pendiente'}
                        </small>
                      </div>
                      <button
                        type="button"
                        className={`cuota-cell cuota-fed${
                          j.federacion_pagada ? ' is-paid' : ' is-pending'
                        }`}
                        disabled={soloLectura || busy}
                        onClick={() => toggleFed(j.id_jugador, j.federacion_pagada)}
                      >
                        Fed. {j.federacion_pagada ? 'Sí' : 'No'}
                      </button>
                    </header>
                    <div className="cuotas-card-meses" role="group" aria-label="Meses">
                      {meses.map((m) => {
                        const pagado = mesPagado(j, m);
                        return (
                          <button
                            type="button"
                            key={m}
                            className={`cuota-cell cuota-mes${
                              pagado ? ' is-paid' : ' is-pending'
                            }`}
                            disabled={soloLectura || busy}
                            onClick={() => toggleMes(j.id_jugador, m, pagado)}
                            aria-pressed={pagado}
                          >
                            {MES_LABEL[m]}
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>

            {!jugadoras.length && (
              <p className="muted cuotas-empty">No hay jugadoras activas en la plantilla.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
