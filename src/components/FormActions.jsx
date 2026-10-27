import { Link } from 'react-router-dom';

/** Pie de formulario: Cancelar (izquierda, ghost) + enviar (derecha). */
export default function FormActions({
  cancelTo,
  cancelLabel = 'Cancelar',
  submitLabel,
  saving = false,
  disabled = false,
}) {
  return (
    <div className="add-player-actions add-player-actions-foot">
      <Link to={cancelTo}>
        <button type="button" className="ghost">
          {cancelLabel}
        </button>
      </Link>
      <button type="submit" disabled={saving || disabled}>
        {submitLabel}
      </button>
    </div>
  );
}
