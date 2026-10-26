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
