import { ZONAS_CAMPO, zonasParaFase } from '../../components/CampoAlineacion';

export const MAX_CONV = 16;
export const MAX_TIT = 7;
export const MAX_ATAQUE = 6;

export const TABS = [
  { id: 'convocatoria', label: 'Convocatoria' },
  { id: 'alineacion_ataque', label: 'Ataque', fase: 'ataque' },
  { id: 'alineacion_defensa', label: 'Defensa', fase: 'defensa' },
  { id: 'banquillo', label: 'Banquillo' },
];

export const DND_TYPE = 'application/x-balonmano-jugador';
export const ZONA_IDS = new Set(ZONAS_CAMPO.map((z) => z.id));
export const ZONA_ATAQUE_IDS = new Set(zonasParaFase('ataque').map((z) => z.id));

export const shortZona = (zonaId) => ZONAS_CAMPO.find((z) => z.id === zonaId)?.short || zonaId;

export const DISP_LABEL = {
  disponible: 'Disponible',
  dudosa: 'Dudosa',
  lesion: 'Lesión',
  sancion: 'Sanción',
};

export const MSG_SIN_FEDERACION =
  'Sin federación pagada no se puede convocar. Márcala en Club → Cuotas.';

export function snapConvocatoria(selected, zonasAtaque, zonasDefensa) {
  const selKeys = Object.keys(selected).sort();
  const sel = {};
  for (const k of selKeys) sel[k] = selected[k];
  const sortMap = (m) => {
    const out = {};
    for (const k of Object.keys(m).sort()) out[k] = m[k];
    return out;
  };
  return JSON.stringify({
    selected: sel,
    zonasAtaque: sortMap(zonasAtaque),
    zonasDefensa: sortMap(zonasDefensa),
  });
}

export function clearJugadorDeMapa(map, jid) {
  const next = { ...map };
  for (const k of Object.keys(next)) {
    if (next[k] === jid) delete next[k];
  }
  return next;
}

export function syncRolTrasZonas(jid, nextAtaque, nextDefensa, baseSelected) {
  const next = { ...baseSelected };
  if (!next[jid]) return next;
  const inA = Object.values(nextAtaque).includes(jid);
  const inD = Object.values(nextDefensa).includes(jid);
  if (inA || inD) next[jid] = 'titular';
  else if (next[jid] === 'titular') next[jid] = 'banquillo';
  return next;
}
