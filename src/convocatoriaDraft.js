function draftKey(idPartido) {
  return `bm-conv-draft:${idPartido}`;
}

export function readConvocatoriaDraft(_idEquipo, idPartido) {
  if (!idPartido || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(draftKey(idPartido));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const selected =
      data.selected && typeof data.selected === 'object' ? data.selected : {};
    // Borrador vacío no cuenta
    if (!Object.keys(selected).length) return null;
    return {
      selected,
      zonasAtaque:
        data.zonasAtaque && typeof data.zonasAtaque === 'object' ? data.zonasAtaque : {},
      zonasDefensa:
        data.zonasDefensa && typeof data.zonasDefensa === 'object' ? data.zonasDefensa : {},
    };
  } catch {
    return null;
  }
}

export function writeConvocatoriaDraft(_idEquipo, idPartido, { selected, zonasAtaque, zonasDefensa }) {
  if (!idPartido || typeof localStorage === 'undefined') return;
  try {
    const sel = selected || {};
    if (!Object.keys(sel).length) {
      localStorage.removeItem(draftKey(idPartido));
      return;
    }
    localStorage.setItem(
      draftKey(idPartido),
      JSON.stringify({
        selected: sel,
        zonasAtaque: zonasAtaque || {},
        zonasDefensa: zonasDefensa || {},
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearConvocatoriaDraft(_idEquipo, idPartido) {
  if (!idPartido || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(draftKey(idPartido));
  } catch {
    /* ignore */
  }
}

/** Convierte el draft local a items compatibles con saveConvocatoria / ficha. */
export function draftToItems(draft, jugadoresById = {}) {
  if (!draft) return [];
  const { selected = {}, zonasAtaque = {}, zonasDefensa = {} } = draft;
  const zonaAtaqueDe = {};
  const zonaDefensaDe = {};
  for (const [zona, jid] of Object.entries(zonasAtaque)) zonaAtaqueDe[jid] = zona;
  for (const [zona, jid] of Object.entries(zonasDefensa)) zonaDefensaDe[jid] = zona;

  return Object.entries(selected).map(([id_jugador, rol]) => {
    let za = zonaAtaqueDe[id_jugador] || null;
    if (za === 'portero') za = null;
    const zd = zonaDefensaDe[id_jugador] || null;
    let r = rol;
    if (za || zd) r = 'titular';
    const j = jugadoresById[id_jugador];
    return {
      id_jugador,
      rol: r,
      zona_campo: za,
      zona_ataque: za,
      zona_defensa: zd,
      nombre: j?.nombre,
      apellido: j?.apellido,
      dorsal: j?.dorsal,
      posiciones: j?.posiciones || [],
    };
  });
}
