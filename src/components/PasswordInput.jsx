import { useState } from 'react';
import { passwordStrength } from '../password';

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M2.1 3.51 3.51 2.1l18.38 18.39-1.41 1.41-3.13-3.13A12.3 12.3 0 0 1 12 19c-5 0-9.27-3.11-11-7a13.5 13.5 0 0 1 4.3-5.15L2.1 3.51zM12 7a5 5 0 0 1 4.9 6.07l-1.55-1.55A3 3 0 0 0 12 9c-.4 0-.78.08-1.13.22L9.3 7.65A4.9 4.9 0 0 1 12 7zm9.9 5a13.4 13.4 0 0 1-3.2 4.18l-1.45-1.45A11.2 11.2 0 0 0 21.1 12c-.8-1.8-2.1-3.35-3.7-4.5l1.4-1.4A13.4 13.4 0 0 1 21.9 12z"
      />
    </svg>
  );
}

/**
 * Campo contraseña con ojo para mostrar/ocultar.
 * Si showStrength, muestra Débil / Es válida / Es segura bajo el input.
 */
export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder,
  minLength,
  required,
  showStrength = false,
  className = '',
}) {
  const [show, setShow] = useState(false);
  const strength = showStrength ? passwordStrength(value) : null;

  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="password-field">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={show}
          title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <EyeIcon open={show} />
        </button>
      </div>
      {strength && (
        <div className={`password-strength password-strength--${strength.level}`}>
          <strong>{strength.label}</strong>
          <span>{strength.hint}</span>
        </div>
      )}
    </div>
  );
}
