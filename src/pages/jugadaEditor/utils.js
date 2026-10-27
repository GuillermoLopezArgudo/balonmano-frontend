export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const COLORS = ['#a3e635', '#84cc16', '#d9f99d', '#93c5fd', '#60a5fa', '#fbbf24', '#f472b6'];
export const COLOR_ATAQUE = '#ef4444';
export const COLOR_DEFENSA = '#3b82f6';

export function isColorAtaque(color) {
  if (!color) return true;
  const c = String(color).toLowerCase();
  if (c === COLOR_ATAQUE.toLowerCase()) return true;
  if (c === COLOR_DEFENSA.toLowerCase()) return false;
  if (c.startsWith('#') && c.length >= 7) {
    const r = parseInt(c.slice(1, 3), 16);
    const b = parseInt(c.slice(5, 7), 16);
    if (Number.isFinite(r) && Number.isFinite(b)) return r >= b;
  }
  return true;
}

/** Separa flechas por equipo (mantiene el orden de dibujo dentro de cada uno). */
export function flechasPorEquipo(flechas, piezas) {
  const colorById = {};
  for (const p of piezas || []) colorById[p.id_pieza] = p.color;
  const atk = [];
  const def = [];
  for (const f of flechas || []) {
    if (isColorAtaque(colorById[f.id_pieza])) atk.push(f);
    else def.push(f);
  }
  return { atk, def };
}

export function equipoPieza(pieza, fase) {
  const et = String(pieza?.etiqueta || '');
  if (et.startsWith('A-') || pieza?.color === COLOR_ATAQUE) return 'ataque';
  if (et.startsWith('D-') || pieza?.color === COLOR_DEFENSA) return 'defensa';
  return fase === 'defensa' ? 'defensa' : 'ataque';
}

export function slotsEquipo(fase, ambito, equipo) {
  return defaultPiezas(fase, ambito).filter((r) => equipoPieza(r.pieza, fase) === equipo);
}

export function defaultPiezas(fase, ambito = 'tactica') {
  // Campo completo: A-* atacan portería derecha; D-* la defienden (6-0).
  // Y=0 arriba. Atacante mirando a la derecha → EI arriba, ED abajo.
  const completo = [
    { etiqueta: 'A-PO', x: 4, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'A-CE', x: 22, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'A-LI', x: 28, y: 28, color: COLOR_ATAQUE },
    { etiqueta: 'A-LD', x: 28, y: 72, color: COLOR_ATAQUE },
    { etiqueta: 'A-EI', x: 40, y: 12, color: COLOR_ATAQUE },
    { etiqueta: 'A-ED', x: 40, y: 88, color: COLOR_ATAQUE },
    { etiqueta: 'A-PI', x: 46, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'D-PO', x: 96, y: 50, color: COLOR_DEFENSA },
    { etiqueta: 'D-ED', x: 82, y: 12, color: COLOR_DEFENSA },
    { etiqueta: 'D-LD', x: 78, y: 28, color: COLOR_DEFENSA },
    { etiqueta: 'D-CE', x: 74, y: 42, color: COLOR_DEFENSA },
    { etiqueta: 'D-PI', x: 74, y: 58, color: COLOR_DEFENSA },
    { etiqueta: 'D-LI', x: 78, y: 72, color: COLOR_DEFENSA },
    { etiqueta: 'D-EI', x: 82, y: 88, color: COLOR_DEFENSA },
  ];
  // Media pista horizontal: de la línea central a la portería (como la mitad derecha del campo).
  const media = [
    { etiqueta: 'A-CE', x: 10, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'A-LI', x: 22, y: 28, color: COLOR_ATAQUE },
    { etiqueta: 'A-LD', x: 22, y: 72, color: COLOR_ATAQUE },
    { etiqueta: 'A-EI', x: 36, y: 12, color: COLOR_ATAQUE },
    { etiqueta: 'A-ED', x: 36, y: 88, color: COLOR_ATAQUE },
    { etiqueta: 'A-PI', x: 58, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'D-PO', x: 92, y: 50, color: COLOR_DEFENSA },
    { etiqueta: 'D-ED', x: 74, y: 12, color: COLOR_DEFENSA },
    { etiqueta: 'D-LD', x: 68, y: 28, color: COLOR_DEFENSA },
    { etiqueta: 'D-CE', x: 62, y: 42, color: COLOR_DEFENSA },
    { etiqueta: 'D-PI', x: 62, y: 58, color: COLOR_DEFENSA },
    { etiqueta: 'D-LI', x: 68, y: 72, color: COLOR_DEFENSA },
    { etiqueta: 'D-EI', x: 74, y: 88, color: COLOR_DEFENSA },
  ];
  // Posiciones medidas del tablero ancho (portería abajo).
  // Atacantes siempre rojas, defensoras siempre azules.
  const atk = [
    { etiqueta: 'CE', x: 50, y: 25, color: COLOR_ATAQUE },
    { etiqueta: 'LD', x: 35, y: 28, color: COLOR_ATAQUE },
    { etiqueta: 'LI', x: 62, y: 29, color: COLOR_ATAQUE },
    { etiqueta: 'PI', x: 51, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'ED', x: 16, y: 83, color: COLOR_ATAQUE },
    { etiqueta: 'EI', x: 84, y: 85, color: COLOR_ATAQUE },
    { etiqueta: 'D-PO', x: 50, y: 87, color: COLOR_DEFENSA },
    { etiqueta: 'D-EI', x: 23, y: 68, color: COLOR_DEFENSA },
    { etiqueta: 'D-LI', x: 35, y: 52, color: COLOR_DEFENSA },
    { etiqueta: 'D-CE', x: 43, y: 51, color: COLOR_DEFENSA },
    { etiqueta: 'D-PI', x: 54, y: 50, color: COLOR_DEFENSA },
    { etiqueta: 'D-LD', x: 62, y: 52, color: COLOR_DEFENSA },
    { etiqueta: 'D-ED', x: 72, y: 60, color: COLOR_DEFENSA },
  ];
  const def = [
    { etiqueta: 'EI', x: 28, y: 62, color: COLOR_DEFENSA },
    { etiqueta: 'LI', x: 36, y: 53, color: COLOR_DEFENSA },
    { etiqueta: 'CE', x: 43, y: 50, color: COLOR_DEFENSA },
    { etiqueta: 'PI', x: 53, y: 49, color: COLOR_DEFENSA },
    { etiqueta: 'LD', x: 63, y: 52, color: COLOR_DEFENSA },
    { etiqueta: 'ED', x: 74, y: 63, color: COLOR_DEFENSA },
    { etiqueta: 'PO', x: 50, y: 81, color: COLOR_DEFENSA },
    { etiqueta: 'A-CE', x: 50, y: 27, color: COLOR_ATAQUE },
    { etiqueta: 'A-LD', x: 36, y: 30, color: COLOR_ATAQUE },
    { etiqueta: 'A-LI', x: 65, y: 30, color: COLOR_ATAQUE },
    { etiqueta: 'A-PI', x: 51, y: 50, color: COLOR_ATAQUE },
    { etiqueta: 'A-ED', x: 15, y: 85, color: COLOR_ATAQUE },
    { etiqueta: 'A-EI', x: 88, y: 85, color: COLOR_ATAQUE },
  ];
  let base;
  if (fase === 'completo') base = completo;
  else if (ambito === 'fisico') base = media;
  else base = fase === 'defensa' ? def : atk;
  return base.map((p, i) => {
    const id = uid();
    return {
      pieza: {
        id_pieza: id,
        etiqueta: p.etiqueta,
        color: p.color || COLORS[i % COLORS.length],
        orden: i,
      },
      pos: { id_pieza: id, x: p.x, y: p.y },
    };
  });
}

/** Entrenamiento: el campo empieza vacío; las piezas se cargan con el botón. */
export function blankJugada(fase = 'ataque', ambito = 'tactica') {
  const rows = ambito === 'fisico' ? [] : defaultPiezas(fase, ambito);
  const portador =
    fase === 'defensa' && ambito !== 'fisico'
      ? rows.find((r) => r.pieza.color === COLOR_ATAQUE) ||
        rows.find((r) => String(r.pieza.etiqueta).startsWith('A-'))
      : rows[0];
  const sinBalon = !portador;
  return {
    nombre: '',
    fase,
    ambito,
    descripcion: '',
    fecha_sesion: null,
    piezas: rows.map((r) => r.pieza),
    pasos: [
      {
        id_paso: uid(),
        orden: 0,
        titulo: 'Inicio',
        posiciones: rows.map((r) => r.pos),
        flechas: [],
        balon_x: sinBalon ? null : portador.pos.x,
        balon_y: sinBalon ? null : portador.pos.y,
        id_pieza_balon: sinBalon ? null : portador.pieza.id_pieza,
      },
    ],
  };
}

export function fromApi(data) {
  return {
    id_jugada: data.id_jugada,
    nombre: data.nombre,
    fase: data.fase,
    ambito: data.ambito || 'tactica',
    descripcion: data.descripcion || '',
    fecha_sesion: data.fecha_sesion || null,
    piezas: (data.piezas || []).map((p) => ({ ...p })),
    pasos: (data.pasos || []).map((paso) => ({
      id_paso: paso.id_paso,
      orden: paso.orden,
      titulo: paso.titulo || '',
      balon_x: paso.balon_x ?? null,
      balon_y: paso.balon_y ?? null,
      id_pieza_balon: paso.id_pieza_balon ?? null,
      posiciones: (paso.posiciones || []).map((pos) => ({ ...pos })),
      flechas: (paso.flechas || []).map((f) => ({
        id_flecha: f.id_flecha || uid(),
        id_pieza: f.id_pieza,
        id_destino: f.id_destino || null,
        x1: f.x1,
        y1: f.y1,
        x2: f.x2,
        y2: f.y2,
        tipo: f.tipo || 'movimiento',
      })),
    })),
  };
}

export function toPayload(state) {
  return {
    nombre: state.nombre.trim(),
    fase: state.fase,
    ambito: state.ambito || 'tactica',
    descripcion: state.descripcion.trim() || null,
    fecha_sesion: state.fecha_sesion || null,
    piezas: state.piezas.map((p, i) => ({
      id_pieza: p.id_pieza,
      etiqueta: p.etiqueta,
      color: p.color,
      id_jugador: p.id_jugador || null,
      orden: i,
    })),
    pasos: state.pasos.map((paso, i) => ({
      id_paso: paso.id_paso,
      orden: i,
      titulo: paso.titulo || null,
      balon_x: paso.balon_x,
      balon_y: paso.balon_y,
      id_pieza_balon: paso.id_pieza_balon,
      posiciones: paso.posiciones,
      flechas: paso.flechas.map((f) => ({
        id_pieza: f.id_pieza,
        x1: f.x1,
        y1: f.y1,
        x2: f.x2,
        y2: f.y2,
        tipo: f.tipo || 'movimiento',
      })),
    })),
  };
}
