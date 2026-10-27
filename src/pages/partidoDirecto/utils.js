import { isFueraPorteria, labelPista, labelPorteria } from '../../components/ShotMaps';

export const ACCIONES_PRIMARY = [
  { key: 'lanzamiento', label: 'Lanzamiento', needsShotMap: true, needsGoalMap: true },
  { key: 'parada', label: 'Parada', tipo: 'Parada', needsShotMap: true, needsGoalMap: true },
  { key: 'gol_rival', label: 'Gol rival', tipo: 'Gol recibido', needsShotMap: true, needsGoalMap: true },
  { key: 'perdida', label: 'Pérdida', tipo: 'Pérdida', needsShotMap: false },
  { key: 'sancion', label: 'Sanción', needsShotMap: false },
];

export const ACCIONES_SECONDARY = [
  { key: 'recuperacion', label: 'Recuperación', tipo: 'Recuperación', needsShotMap: false },
  { key: 'falta_cometida', label: 'Falta com.', tipo: 'Falta cometida', needsShotMap: false },
  { key: 'falta_recibida', label: 'Falta rec.', tipo: 'Falta recibida', needsShotMap: false },
  { key: 'poste', label: 'Poste', tipo: 'Poste', needsShotMap: true, needsGoalMap: true },
];

export const ACCIONES = [...ACCIONES_PRIMARY, ...ACCIONES_SECONDARY];
export const SECONDARY_KEYS = new Set(ACCIONES_SECONDARY.map((a) => a.key));

export const SANCION_TIPOS = [
  { key: '2min', label: "2'", tipo: 'Exclusión 2 min' },
  { key: 'amarilla', label: 'Amarilla', tipo: 'Amarilla' },
  { key: 'roja', label: 'Roja', tipo: 'Roja' },
  { key: 'azul', label: 'Azul', tipo: 'Azul' },
];

export const LLEGADAS = [
  { key: 'entrada', label: 'Entrada' },
  { key: 'giro_izq', label: 'Giro izq.' },
  { key: 'giro_der', label: 'Giro der.' },
  { key: 'punto_debil', label: 'Punto débil' },
  { key: 'directo', label: 'Directo' },
];

export const PERDIDAS = [
  { key: 'falta_ataque', label: 'Falta en ataque' },
  { key: 'pasos', label: 'Pasos' },
  { key: 'dobles', label: 'Dobles' },
  { key: 'mal_pase', label: 'Mal pase' },
  { key: 'interceptado', label: 'Interceptado' },
];

export function labelContexto(key) {
  return [...LLEGADAS, ...PERDIDAS].find((x) => x.key === key)?.label || '';
}

/** Lanzamiento: dentro de portería = Gol; fuera = Lanzamiento fallado. */
export function tipoNombrePara(accionKey, zonaPorteria, sancionTipo) {
  if (accionKey === 'lanzamiento') {
    return isFueraPorteria(zonaPorteria) ? 'Lanzamiento fallado' : 'Gol';
  }
  if (accionKey === 'sancion') {
    return SANCION_TIPOS.find((s) => s.key === sancionTipo)?.tipo || null;
  }
  return ACCIONES.find((a) => a.key === accionKey)?.tipo || null;
}

export function zonaFeed(a) {
  const parts = [];
  if (a.rival_dorsal != null) parts.push(`#${a.rival_dorsal}`);
  // Contraataque se muestra aparte en el feed (live-feed-contra)
  if (a.contexto) parts.push(labelContexto(a.contexto));
  if (a.zona) parts.push(labelPista(a.zona) || a.zona);
  if (a.zona_porteria) parts.push(`→ ${labelPorteria(a.zona_porteria) || a.zona_porteria}`);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

export function isPortera(j) {
  return (j.posiciones || []).some((p) => String(p).toLowerCase().includes('portero'));
}

export function mapTipoToForm(tipoNombre) {
  const n = (tipoNombre || '').toLowerCase();
  if (n === 'gol' || n.includes('lanzamiento')) {
    return { accion: 'lanzamiento', sancionTipo: '2min' };
  }
  if (n.includes('parada')) return { accion: 'parada', sancionTipo: '2min' };
  if (n.includes('recibid') && n.includes('gol')) {
    return { accion: 'gol_rival', sancionTipo: '2min' };
  }
  if (n.includes('pérdida') || n.includes('perdida')) {
    return { accion: 'perdida', sancionTipo: '2min' };
  }
  if (n.includes('recuperación') || n.includes('recuperacion')) {
    return { accion: 'recuperacion', sancionTipo: '2min' };
  }
  if (n.includes('falta') && n.includes('recibid')) {
    return { accion: 'falta_recibida', sancionTipo: '2min' };
  }
  if (n.includes('falta')) return { accion: 'falta_cometida', sancionTipo: '2min' };
  if (n === 'poste') return { accion: 'poste', sancionTipo: '2min' };
  if (n === 'fuera') return { accion: 'fuera', sancionTipo: '2min' };
  if (n.includes('técnica') || n.includes('tecnica')) {
    return { accion: 'tecnica', sancionTipo: '2min' };
  }
  if (n.includes('exclusión') || n.includes('exclusion') || /\b2\s*min/.test(n)) {
    return { accion: 'sancion', sancionTipo: '2min' };
  }
  if (n.includes('amarilla')) return { accion: 'sancion', sancionTipo: 'amarilla' };
  if (n.includes('roja')) return { accion: 'sancion', sancionTipo: 'roja' };
  if (n.includes('azul')) return { accion: 'sancion', sancionTipo: 'azul' };
  return { accion: 'lanzamiento', sancionTipo: '2min' };
}

export function scorePatchForTipo(nombre, partido, equipoId, dir = 1) {
  if (!partido || !nombre) return null;
  const n = nombre.toLowerCase();
  const esGol = n.includes('gol') && !n.includes('recibid');
  const esRecibido = n.includes('gol') && n.includes('recibid');
  if (!esGol && !esRecibido) return null;
  const soyLocal = partido.id_equipo_local === equipoId;
  const d = dir >= 0 ? 1 : -1;
  if (esGol) {
    return soyLocal
      ? { local: d, visitante: 0 }
      : { local: 0, visitante: d };
  }
  return soyLocal
    ? { local: 0, visitante: d }
    : { local: d, visitante: 0 };
}

export function applyScorePatch(score, patch) {
  if (!patch) return score;
  return {
    local: Math.max(0, score.local + patch.local),
    visitante: Math.max(0, score.visitante + patch.visitante),
  };
}
