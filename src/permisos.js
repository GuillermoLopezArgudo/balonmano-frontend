/** Permisos por cargo. El administrador del club es independiente del cargo. */

export const CARGOS = [
  'Entrenador principal',
  'Segundo entrenador',
  'Preparador físico',
  'Delegado',
  'Staff',
];

export const CARGOS_UNICOS = new Set(['Entrenador principal', 'Segundo entrenador']);

export const AREA_LABELS = {
  plantilla: 'Plantilla',
  partidos: 'Partidos',
  directo: 'Directo',
  convocatoria: 'Convocatoria',
  jugadas: 'Jugadas',
  fisico: 'Preparación física',
  cuotas: 'Cuotas',
  analitica: 'Analítica',
  club: 'Club',
};

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
  ]),
  'Segundo entrenador': new Set([
    'plantilla',
    'partidos',
    'directo',
    'convocatoria',
    'jugadas',
    'fisico',
    'analitica',
  ]),
  'Preparador físico': new Set(['fisico', 'analitica']),
  Delegado: new Set(['partidos', 'convocatoria', 'cuotas']),
  Staff: new Set(),
};

/** Quién puede ver (y editar si WRITE) cada área. Cuotas: solo entrenadores + delegado. */
const READ = {
  'Entrenador principal': new Set([
    'plantilla',
    'partidos',
    'directo',
    'convocatoria',
    'jugadas',
    'fisico',
    'cuotas',
    'analitica',
    'club',
  ]),
  'Segundo entrenador': new Set([
    'plantilla',
    'partidos',
    'directo',
    'convocatoria',
    'jugadas',
    'fisico',
    'cuotas',
    'analitica',
    'club',
  ]),
  'Preparador físico': new Set([
    'plantilla',
    'partidos',
    'convocatoria',
    'fisico',
    'analitica',
    'club',
  ]),
  Delegado: new Set([
    'plantilla',
    'partidos',
    'convocatoria',
    'fisico',
    'cuotas',
    'analitica',
    'club',
  ]),
  Staff: new Set([
    'plantilla',
    'partidos',
    'directo',
    'convocatoria',
    'jugadas',
    'fisico',
    'analitica',
    'club',
  ]),
};

/** Áreas editables por cargo, con etiqueta legible (para leyenda admin). */
export function writeLabelsForCargo(cargo) {
  const c = normalizeCargo(cargo);
  const set = WRITE[c] || new Set();
  const labels = [...set].map((a) => AREA_LABELS[a] || a);
  // Segundo ve cuotas en solo lectura
  if (c === 'Segundo entrenador' && !set.has('cuotas')) {
    labels.push('Cuotas (solo ver)');
  }
  if (c === 'Preparador físico') {
    labels.push('Disponibilidad de jugadoras');
  }
  return labels;
}

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
        'club',
      ])
    : WRITE[c] || new Set();
  const read = isAdmin
    ? new Set([...write])
    : new Set([...(READ[c] || []), ...write]);

  const can = (area) => write.has(area);
  const canRead = (area) => read.has(area) || write.has(area);

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
    canReadCuotas: canRead('cuotas'),
    canWrite: write.size > 0,
    can,
    canRead,
  };
}
