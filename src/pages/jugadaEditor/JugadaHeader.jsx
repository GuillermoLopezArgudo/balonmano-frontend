import { Link } from 'react-router-dom';
import { IcoFlecha, IcoLapiz } from '../../components/ActionIcons';

export default function JugadaHeader({
  isEntrenamiento,
  isNew,
  editing,
  canWrite,
  mayWrite,
  state,
  basePath,
  id,
  saving,
  exportarPng,
  copiar,
  guardar,
}) {
  return (
    <header className="page-head">
      <div>
        <p className="page-kicker">
          {isEntrenamiento ? 'ENTRENAMIENTOS' : 'JUGADAS'}
          {' · '}
          {isNew ? 'NUEVA' : editing ? 'EDITAR' : 'VER'}
        </p>
        <h1>
          {isNew
            ? isEntrenamiento
              ? 'Nuevo entrenamiento'
              : 'Nueva jugada'
            : state.nombre || (isEntrenamiento ? 'Entrenamiento' : 'Jugada')}
        </h1>
      </div>
      <Link className="page-back" to={basePath}>
        <button type="button" className="ghost">
          <IcoFlecha />
          Volver
        </button>
      </Link>
      <div className="add-player-actions">
        <button type="button" className="ghost" onClick={exportarPng} title="Descargar imagen PNG">
          Exportar PNG
        </button>
        {mayWrite && !editing && !isNew && (
          <Link
            to={`${basePath}/${id}/editar`}
            className="btn-icon-edit"
            title="Editar"
            aria-label="Editar"
          >
            <IcoLapiz />
          </Link>
        )}
        {!isNew && mayWrite && (
          <button type="button" className="ghost" disabled={saving} onClick={copiar}>
            Copiar
          </button>
        )}
        {canWrite && (
          <button type="button" disabled={saving} onClick={guardar}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        )}
      </div>
    </header>
  );
}
