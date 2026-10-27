import { Link } from 'react-router-dom';
import { IcoFlecha } from './ActionIcons';

function BackLink({ to, label }) {
  return (
    <Link className="page-back" to={to}>
      <button type="button" className="ghost">
        <IcoFlecha />
        {label}
      </button>
    </Link>
  );
}

/**
 * Cabecera de página (`page-head`).
 * - `children`: CTAs junto al título (`page-head-actions-beside`); si hay `backTo`, "Volver" va al final del grupo.
 * - Sin `children`, `backTo` se renderiza directamente en el header.
 */
export default function PageHeader({ kicker, title, children, backTo, backLabel = 'Volver' }) {
  const hasActions = Boolean(children);
  return (
    <header className="page-head">
      <div>
        {kicker && <p className="page-kicker">{kicker}</p>}
        <h1>{title}</h1>
      </div>
      {hasActions && (
        <div className="add-player-actions page-head-actions-beside">
          {children}
          {backTo && <BackLink to={backTo} label={backLabel} />}
        </div>
      )}
      {!hasActions && backTo && <BackLink to={backTo} label={backLabel} />}
    </header>
  );
}
