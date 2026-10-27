/**
 * Exporta el campo como PNG. Devuelve 'sin-campo' | 'sin-contexto' | 'ok'.
 */
export function exportarJugadaPng({ board, state, paso, displayPos, displayBall, isEntrenamiento }) {
  const el = board;
  if (!el) return 'sin-campo';
  const w = Math.max(640, el.clientWidth || 800);
  const h = Math.max(360, el.clientHeight || 450);
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'sin-contexto';
  ctx.scale(scale, scale);
  ctx.fillStyle = '#1b5e3b';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  const labelFase =
    state.fase === 'completo'
      ? 'Campo completo'
      : state.ambito === 'fisico' && state.fase === 'ataque'
        ? 'Media pista'
        : state.fase === 'defensa'
          ? 'Defensa'
          : 'Ataque';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 15px system-ui,sans-serif';
  ctx.fillText(state.nombre || (isEntrenamiento ? 'Entrenamiento' : 'Jugada'), 18, 32);
  ctx.font = '500 12px system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(labelFase, 18, 50);

  const px = (x) => (Number(x) / 100) * w;
  const py = (y) => (Number(y) / 100) * h;

  for (const f of paso?.flechas || []) {
    const tipo = f.tipo || 'movimiento';
    ctx.beginPath();
    ctx.moveTo(px(f.x1), py(f.y1));
    ctx.lineTo(px(f.x2), py(f.y2));
    ctx.strokeStyle =
      tipo === 'lanzamiento' ? '#fbbf24' : tipo === 'pase' ? '#38bdf8' : '#f8fafc';
    ctx.lineWidth = tipo === 'pase' ? 2 : 2.5;
    if (tipo === 'pase') ctx.setLineDash([6, 5]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(py(f.y2) - py(f.y1), px(f.x2) - px(f.x1));
    const ah = 9;
    ctx.beginPath();
    ctx.moveTo(px(f.x2), py(f.y2));
    ctx.lineTo(
      px(f.x2) - ah * Math.cos(ang - 0.4),
      py(f.y2) - ah * Math.sin(ang - 0.4),
    );
    ctx.lineTo(
      px(f.x2) - ah * Math.cos(ang + 0.4),
      py(f.y2) - ah * Math.sin(ang + 0.4),
    );
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  for (const pieza of state.piezas) {
    const pos = displayPos(pieza.id_pieza);
    if (!pos) continue;
    const x = px(pos.x);
    const y = py(pos.y);
    const r = Math.max(14, Math.min(w, h) * 0.028);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = pieza.color || '#a3e635';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${Math.max(9, r * 0.7)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pieza.etiqueta || '').slice(0, 5), x, y);
  }

  if (displayBall && displayBall.x != null) {
    const bx = px(displayBall.x);
    const by = py(displayBall.y);
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const safe = (state.nombre || (isEntrenamiento ? 'entrenamiento' : 'jugada'))
    .trim()
    .replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  const a = document.createElement('a');
  a.download = `${safe || 'jugada'}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  return 'ok';
}
