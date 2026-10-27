export function ballCoords(paso, posMap) {
  if (!paso) return { x: 50, y: 50 };
  if (paso.id_pieza_balon && posMap[paso.id_pieza_balon]) {
    const p = posMap[paso.id_pieza_balon];
    return { x: p.x + 3.5, y: p.y - 3.5 };
  }
  if (paso.balon_x != null && paso.balon_y != null) {
    return { x: paso.balon_x, y: paso.balon_y };
  }
  return { x: 50, y: 50 };
}

export function nearestPiezaId(posMap, x, y) {
  let bestId = null;
  let best = 1e9;
  for (const [id, p] of Object.entries(posMap)) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < best) {
      best = d;
      bestId = id;
    }
  }
  return bestId;
}

/** Estado visual al reproducir las flechas 0..actionIdx (con progreso t en la actual). */
export function snapshotPlay(paso, actionIdx, t, flechasOverride) {
  const flechas = flechasOverride || paso?.flechas || [];
  const pos = {};
  for (const p of paso?.posiciones || []) {
    pos[p.id_pieza] = { id_pieza: p.id_pieza, x: p.x, y: p.y };
  }
  let ballOwner = paso?.id_pieza_balon ?? null;
  let ball = ballCoords(paso, pos);

  const apply = (f, progress) => {
    if (!f || progress <= 0) return;
    const tipo = f.tipo || 'movimiento';
    if (tipo === 'movimiento') {
      const cur = pos[f.id_pieza] || { x: f.x1, y: f.y1 };
      const x = cur.x + (f.x2 - cur.x) * progress;
      const y = cur.y + (f.y2 - cur.y) * progress;
      pos[f.id_pieza] = { id_pieza: f.id_pieza, x, y };
      if (ballOwner === f.id_pieza) {
        ball = { x: x + 3.5, y: y - 3.5 };
      }
    } else if (tipo === 'pase' || tipo === 'lanzamiento') {
      ball = {
        x: f.x1 + (f.x2 - f.x1) * progress,
        y: f.y1 + (f.y2 - f.y1) * progress,
      };
      if (progress >= 1) {
        if (tipo === 'pase') {
          ballOwner =
            f.id_destino || nearestPiezaId(pos, f.x2, f.y2) || ballOwner;
          if (ballOwner && pos[ballOwner]) {
            ball = { x: pos[ballOwner].x + 3.5, y: pos[ballOwner].y - 3.5 };
          }
        } else {
          ballOwner = null;
        }
      }
    }
  };

  for (let i = 0; i < flechas.length; i += 1) {
    if (i < actionIdx) apply(flechas[i], 1);
    else if (i === actionIdx) apply(flechas[i], t);
    else break;
  }

  return { pos, ball, ballOwner };
}

/**
 * Campo completo: atacantes y defensoras avanzan en paralelo.
 * actionIdx es el índice de la acción dentro de la secuencia de CADA equipo.
 */
export function snapshotPlayParallel(paso, actionIdx, t, atkFlechas, defFlechas) {
  const pos = {};
  for (const p of paso?.posiciones || []) {
    pos[p.id_pieza] = { id_pieza: p.id_pieza, x: p.x, y: p.y };
  }

  const applyMov = (list) => {
    for (let i = 0; i < list.length; i += 1) {
      const progress = i < actionIdx ? 1 : i === actionIdx ? t : 0;
      if (progress <= 0) break;
      const f = list[i];
      if ((f.tipo || 'movimiento') !== 'movimiento') continue;
      const cur = pos[f.id_pieza] || { x: f.x1, y: f.y1 };
      pos[f.id_pieza] = {
        id_pieza: f.id_pieza,
        x: cur.x + (f.x2 - cur.x) * progress,
        y: cur.y + (f.y2 - cur.y) * progress,
      };
    }
  };

  applyMov(atkFlechas || []);
  applyMov(defFlechas || []);

  let ballOwner = paso?.id_pieza_balon ?? null;
  let ball = ballCoords(paso, pos);
  if (ballOwner && pos[ballOwner]) {
    ball = { x: pos[ballOwner].x + 3.5, y: pos[ballOwner].y - 3.5 };
  }

  const applyBall = (list) => {
    for (let i = 0; i < list.length; i += 1) {
      const progress = i < actionIdx ? 1 : i === actionIdx ? t : 0;
      if (progress <= 0) break;
      const f = list[i];
      const tipo = f.tipo || 'movimiento';
      if (tipo === 'movimiento') {
        if (ballOwner === f.id_pieza && pos[f.id_pieza]) {
          ball = { x: pos[f.id_pieza].x + 3.5, y: pos[f.id_pieza].y - 3.5 };
        }
      } else if (tipo === 'pase' || tipo === 'lanzamiento') {
        ball = {
          x: f.x1 + (f.x2 - f.x1) * progress,
          y: f.y1 + (f.y2 - f.y1) * progress,
        };
        if (progress >= 1) {
          if (tipo === 'pase') {
            ballOwner =
              f.id_destino || nearestPiezaId(pos, f.x2, f.y2) || ballOwner;
            if (ballOwner && pos[ballOwner]) {
              ball = { x: pos[ballOwner].x + 3.5, y: pos[ballOwner].y - 3.5 };
            }
          } else {
            ballOwner = null;
          }
        }
      }
    }
  };

  // Defensa primero; ataque manda en el balón si también actúa
  applyBall(defFlechas || []);
  applyBall(atkFlechas || []);

  return { pos, ball, ballOwner };
}
