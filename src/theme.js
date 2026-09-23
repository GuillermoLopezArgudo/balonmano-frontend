const STORAGE_KEY = 'siete_theme';

export function resolveTheme(tema) {
  if (tema === 'claro') return 'claro';
  if (tema === 'oscuro') return 'oscuro';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'claro';
  }
  return 'oscuro';
}

export function applyTheme(tema) {
  const resolved = resolveTheme(tema || 'oscuro');
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-tema-pref', tema || 'oscuro');
  return resolved;
}

export function getSavedTema() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'oscuro';
  } catch {
    return 'oscuro';
  }
}

export function saveTema(tema) {
  localStorage.setItem(STORAGE_KEY, tema);
  applyTheme(tema);
}

/** Aplica el tema guardado (clave global; Ajustes la actualiza al cambiar). */
export function syncThemeFromPrefs(_equipoId) {
  const tema = getSavedTema();
  applyTheme(tema);
  return tema;
}
