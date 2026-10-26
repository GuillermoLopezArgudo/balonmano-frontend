export const PASSWORD_RULE =
  'Mínimo 8 caracteres, con una mayúscula, una minúscula y un número.';

export function passwordError(password) {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir una minúscula.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir una mayúscula.';
  if (!/\d/.test(password)) return 'La contraseña debe incluir un número.';
  return '';
}

/** Estado visual bajo el campo de nueva contraseña. */
export function passwordStrength(password) {
  if (!password) return null;
  const err = passwordError(password);
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (err) {
    return {
      level: score <= 2 ? 'weak' : 'fair',
      label: score <= 2 ? 'Débil' : 'Mejorable',
      hint: err,
      ok: false,
    };
  }
  if (score >= 5) {
    return {
      level: 'strong',
      label: 'Es segura',
      hint: 'Cumple los requisitos y es robusta.',
      ok: true,
    };
  }
  return {
    level: 'ok',
    label: 'Es válida',
    hint: 'Cumple los requisitos mínimos.',
    ok: true,
  };
}
