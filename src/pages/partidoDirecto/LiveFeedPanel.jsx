import { IcoBasura, IcoLapiz } from '../../components/ActionIcons';
import { zonaFeed } from './utils';

export default function LiveFeedPanel({
  recent,
  jugadores,
  tipos,
  editingId,
  saving,
  canWriteDirecto,
  empezarEdicion,
  borrarAccion,
}) {
  return (
    <section className="panel club-card live-feed-panel">
      <h2>Últimas acciones</h2>
      <div className="live-feed">
        {recent.map((a) => {
          const j = jugadores.find((x) => x.id_jugador === a.id_jugador);
          const t = tipos.find((x) => x.id_tipo_accion === a.id_tipo_accion);
          const isEditing = editingId === a.id_accion;
          return (
            <div
              className={`live-feed-item${isEditing ? ' is-editing' : ''}`}
              key={a.id_accion}
            >
              <strong>
                {a.minuto}&apos;{String(a.segundo || 0).padStart(2, '0')}
              </strong>
              <span>
                {t?.nombre || 'Acción'}
                {a.es_contraataque ? (
                  <em className="live-feed-contra"> · Contraataque</em>
                ) : null}
                {zonaFeed(a)}
              </span>
              <small>
                {j ? `#${j.dorsal ?? '—'} ${j.nombre}` : '—'}
                {a.rival_dorsal != null ? ` · rival #${a.rival_dorsal}` : ''}
              </small>
              {canWriteDirecto && (
                <div className="live-feed-actions">
                  <button
                    type="button"
                    className="btn-icon-edit"
                    disabled={saving}
                    onClick={() => empezarEdicion(a)}
                    title="Editar"
                    aria-label="Editar acción"
                  >
                    <IcoLapiz size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-del"
                    disabled={saving}
                    onClick={() => borrarAccion(a)}
                    title="Borrar"
                    aria-label="Borrar acción"
                  >
                    <IcoBasura size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!recent.length && <p className="muted">Sin acciones todavía</p>}
      </div>
    </section>
  );
}
