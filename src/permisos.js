/** Permisos por cargo. El administrador del club es independiente del cargo. */

export const CARGOS = [
  'Entrenador principal',
  'Segundo entrenador',
  'Preparador físico',
  'Delegado',
  'Staff',
];

export const CARGOS_UNICOS = new Set(['Entrenador principal', 'Segundo entrenador']);

const WRITE = {
  'Entrenador principal': new Set([
    'plantilla',
    'partidos',
    'directo',
    'convocatoria',
    'jugadas',
    'fisico',
    'cuotas',
    'analitica',
    'informes',
  ]),
  'Segundo entrenador': new Set([
    'plantilla',
    'partidos',
    'directo',
    'convocatoria',
    'jugadas',
    'fisico',
    'analitica',
    'informes',
  ]),
  'Preparador físico': new Set(['plantilla', 'fisico', 'analitica', 'informes']),
  Delegado: new Set(['partidos', 'convocatoria', 'cuotas', 'informes']),
  Staff: new Set(),
};

export function normalizeCargo(cargo) {
  const c = (cargo || '').trim();
  if (c === 'Analista' || c === 'Director / Gestor' || c === 'Administrador') return 'Staff';
  if (CARGOS.includes(c)) return c;
  return 'Staff';
}

export function permsFromSession({ cargo, isAdmin }) {
  const c = normalizeCargo(cargo);
  const write = isAdmin
    ? new Set([
        'plantilla',
        'partidos',
        'directo',
        'convocatoria',
        'jugadas',
        'fisico',
        'cuotas',
        'analitica',
        'informes',
        'club',
      ])
    : WRITE[c] || new Set();

  const can = (area) => write.has(area);

  return {
    cargo: c,
    canManageClub: !!isAdmin,
    canWritePlantilla: can('plantilla'),
    canWritePartidos: can('partidos'),
    canWriteDirecto: can('directo'),
    canWriteConvocatoria: can('convocatoria'),
    canWriteJugadas: can('jugadas'),
    canWriteFisico: can('fisico'),
    canWriteCuotas: can('cuotas'),
    canWrite: write.size > 0,
    can,
  };
}
