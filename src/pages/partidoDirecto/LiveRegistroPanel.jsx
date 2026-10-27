import { labelPista } from '../../components/ShotMaps';
import LiveShotMapsSection from './LiveShotMapsSection';
import {
  ACCIONES_PRIMARY,
  ACCIONES_SECONDARY,
  SANCION_TIPOS,
  SECONDARY_KEYS,
} from './utils';

export default function LiveRegistroPanel({ live, canWriteDirecto }) {
  const {
    partido,
    accion,
    masAcciones,
    setMasAcciones,
    sancionTipo,
    setSancionTipo,
    jugadorId,
    setJugadorId,
    esContraataque,
    setEsContraataque,
    contexto,
    setContexto,
    rivalJugadoras,
    rivalJugadorId,
    setRivalJugadorId,
    nuevoDorsal,
    setNuevoDorsal,
    nuevoNombreRival,
    setNuevoNombreRival,
    goleadorasRival,
    saving,
    editingId,
    setError,
    needsShotMap,
    esGolRival,
    esLanzamiento,
    esPoste,
    esFuera,
    esSancion,
    esPerdida,
    needsLlegada,
    opcionesContexto,
    esPorteraAccion,
    jugadoresParaAccion,
    limpiar,
    elegirAccionPrimaria,
    elegirAccionSecundaria,
    registrar,
  } = live;

  return (
    <section className="panel club-card registro-accion live-registro">
      <h2>Registro acción</h2>

      <div className="live-acciones" role="group" aria-label="Acciones principales">
        {ACCIONES_PRIMARY.map((a) => (
          <button
            type="button"
            key={a.key}
            className={accion === a.key ? 'active' : ''}
            onClick={() => elegirAccionPrimaria(a)}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className={`live-acciones-more${masAcciones ? ' active' : ''}${
            SECONDARY_KEYS.has(accion) ? ' has-sel' : ''
          }`}
          onClick={() => setMasAcciones((v) => !v)}
          aria-expanded={masAcciones}
        >
          {masAcciones ? 'Menos' : 'Más…'}
        </button>
      </div>
      {masAcciones && (
        <div
          className="live-acciones live-acciones-sec"
          role="group"
          aria-label="Más acciones"
        >
          {ACCIONES_SECONDARY.map((a) => (
            <button
              type="button"
              key={a.key}
              className={accion === a.key ? 'active' : ''}
              onClick={() => elegirAccionSecundaria(a)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {esSancion && (
        <div className="live-sancion-tipos" role="group" aria-label="Tipo de sanción">
          {SANCION_TIPOS.map((s) => (
            <button
              type="button"
              key={s.key}
              className={`live-sancion-btn live-sancion-${s.key}${sancionTipo === s.key ? ' active' : ''}`}
              onClick={() => {
                setSancionTipo(s.key);
                setError('');
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="field" style={{ marginTop: '1rem' }}>
        <label>{esPorteraAccion ? 'Portera' : 'Jugador'}</label>
        <select value={jugadorId} onChange={(e) => setJugadorId(e.target.value)}>
          <option value="">Seleccionar…</option>
          {jugadoresParaAccion.map((j) => (
            <option key={j.id_jugador} value={j.id_jugador}>
              #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
              {j.posiciones?.[0] ? ` · ${j.posiciones[0]}` : ''}
            </option>
          ))}
        </select>
        {esPorteraAccion && !jugadoresParaAccion.length && (
          <p className="muted" style={{ marginTop: '0.4rem' }}>
            No hay porteras en la convocatoria / plantilla.
          </p>
        )}
      </div>

      {esGolRival && (
        <div className="rival-dorsal-block">
          <h3>Dorsal rival</h3>
          {!partido?.id_rival && (
            <p className="muted">Este partido no tiene rival asociado; asócialo al crearlo.</p>
          )}
          {partido?.id_rival && (
            <>
              <div className="field">
                <label>Plantilla rival (se guarda entre partidos)</label>
                <select
                  value={rivalJugadorId}
                  onChange={(e) => {
                    setRivalJugadorId(e.target.value);
                    setNuevoDorsal('');
                  }}
                >
                  <option value="">Nuevo dorsal…</option>
                  {rivalJugadoras.map((rj) => (
                    <option key={rj.id_rival_jugador} value={rj.id_rival_jugador}>
                      #{rj.dorsal}
                      {rj.nombre ? ` ${rj.nombre}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {!rivalJugadorId && (
                <div className="rival-dorsal-new">
                  <div className="field">
                    <label>Dorsal</label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={nuevoDorsal}
                      onChange={(e) => setNuevoDorsal(e.target.value)}
                      placeholder="0–99"
                    />
                  </div>
                  <div className="field">
                    <label>Nombre (opcional)</label>
                    <input
                      type="text"
                      value={nuevoNombreRival}
                      onChange={(e) => setNuevoNombreRival(e.target.value)}
                      placeholder="Nombre"
                      maxLength={120}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="rival-ranking">
            <h3>Goleadoras rivales</h3>
            {!goleadorasRival.length && (
              <p className="muted">Sin goles rivales registrados aún</p>
            )}
            {goleadorasRival.map((g) => (
              <div
                className="rival-ranking-row"
                key={g.id_rival_jugador || `sin-${g.dorsal}-${g.goles}`}
              >
                <strong>#{g.dorsal ?? '—'}</strong>
                <span>
                  {g.nombre || 'Sin nombre'} · {g.goles} gol{g.goles === 1 ? '' : 'es'}
                </span>
                <small>
                  {g.zona_top_label || (g.zona_top ? labelPista(g.zona_top) : '—')}
                </small>
              </div>
            ))}
          </div>
        </div>
      )}

      {(needsLlegada || esPerdida) && (
        <div className="live-contexto">
          <p className="live-contexto-label">
            {esPerdida ? 'Tipo de pérdida' : 'Cómo llega al lanzamiento'}
          </p>
          <div
            className="live-contexto-ops"
            role="group"
            aria-label={esPerdida ? 'Tipo de pérdida' : 'Cómo llega al lanzamiento'}
          >
            {opcionesContexto.map((o) => (
              <button
                type="button"
                key={o.key}
                className={contexto === o.key ? 'active' : ''}
                onClick={() => {
                  setContexto(o.key);
                  setError('');
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {needsShotMap && (
            <p className="muted">La misma zona se puede alcanzar de varias formas.</p>
          )}
        </div>
      )}

      {needsShotMap && (esLanzamiento || esGolRival || esPoste || esFuera) && (
        <label className="live-contra-check">
          <input
            type="checkbox"
            checked={esContraataque}
            onChange={(e) => setEsContraataque(e.target.checked)}
          />
          <span>Contraataque</span>
          <small className="muted">
            Marca zona de fin de jugada y destino; se cuenta también como contraataque
          </small>
        </label>
      )}

      {needsShotMap && <LiveShotMapsSection live={live} />}

      <div className="live-submit-row">
        <button type="button" className="ghost" onClick={limpiar} disabled={!canWriteDirecto}>
          {editingId ? 'Cancelar' : 'Limpiar'}
        </button>
        <button
          type="button"
          className="live-submit"
          disabled={saving || !canWriteDirecto}
          onClick={registrar}
          title={!canWriteDirecto ? 'Tu cargo no permite registrar' : undefined}
        >
          {saving
            ? '…'
            : !canWriteDirecto
              ? 'Solo lectura'
              : editingId
                ? 'Guardar cambios'
                : 'Registrar →'}
        </button>
      </div>
    </section>
  );
}
