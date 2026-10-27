export function calcMetrics({ jugados, myId, dash, gkFiltradas, jugStats, partidoIds }) {
  let golesFavor = 0;
  let golesContra = 0;
  let limpias = 0;
  for (const p of jugados) {
    let gf;
    let gc;
    if (p.id_equipo_local === myId) {
      gf = p.goles_local || 0;
      gc = p.goles_visitante || 0;
    } else {
      gf = p.goles_visitante || 0;
      gc = p.goles_local || 0;
    }
    golesFavor += gf;
    golesContra += gc;
    if (gc === 0) limpias += 1;
  }
  const golesPromedio = jugados.length ? golesFavor / jugados.length : 0;
  const total = golesFavor + golesContra;
  const efiEquipo = total ? Math.round((golesFavor / total) * 100) : dash?.efectividad || 0;
  const efiRival = total ? Math.round((golesContra / total) * 100) : 0;

  const jugFiltradas = jugStats.filter((s) => partidoIds.has(s.id_partido));
  const recuperaciones = jugFiltradas.reduce((a, s) => a + (s.recuperaciones || 0), 0);
  const perdidas = jugFiltradas.reduce((a, s) => a + (s.perdidas || 0), 0);
  const faltasCom = jugFiltradas.reduce((a, s) => a + (s.faltas_cometidas || 0), 0);
  const faltasRec = jugFiltradas.reduce((a, s) => a + (s.faltas_recibidas || 0), 0);
  const lanzCampo = jugFiltradas.reduce((a, s) => a + (s.lanzamientos || 0), 0);
  const golesCampo = jugFiltradas.reduce((a, s) => a + (s.goles || 0), 0);
  const efiTiro = lanzCampo ? Math.round((golesCampo / lanzCampo) * 100) : 0;

  const paradas = gkFiltradas.reduce((a, s) => a + (s.paradas || 0), 0);
  const recibidos = gkFiltradas.reduce((a, s) => a + (s.lanzamientos_recibidos || 0), 0);
  const efiPortero = recibidos ? Math.round((paradas / recibidos) * 100) : 0;

  const zonas = {
    '6m': { paradas: 0, lanzamientos: 0 },
    '9m': { paradas: 0, lanzamientos: 0 },
    '7m': { paradas: 0, lanzamientos: 0 },
    extremo: { paradas: 0, lanzamientos: 0 },
    contraataque: { paradas: 0, lanzamientos: 0 },
  };
  for (const s of gkFiltradas) {
    zonas['6m'].paradas += s.paradas_6m || 0;
    zonas['6m'].lanzamientos += s.lanzamientos_6m || 0;
    zonas['9m'].paradas += s.paradas_9m || 0;
    zonas['9m'].lanzamientos += s.lanzamientos_9m || 0;
    zonas['7m'].paradas += s.paradas_7m || 0;
    zonas['7m'].lanzamientos += s.lanzamientos_7m || 0;
    zonas.extremo.paradas += s.paradas_extremo || 0;
    zonas.extremo.lanzamientos += s.lanzamientos_extremo || 0;
    zonas.contraataque.paradas += s.paradas_contraataque || 0;
    zonas.contraataque.lanzamientos += s.lanzamientos_contraataque || 0;
  }

  return {
    golesFavor,
    golesContra,
    golesPromedio,
    efiEquipo,
    efiRival,
    efiTiro,
    recuperaciones,
    perdidas,
    faltasCom,
    faltasRec,
    paradas,
    recibidos,
    efiPortero,
    limpias,
    partidos: jugados.length,
    porPartidoParadas: jugados.length ? paradas / jugados.length : 0,
    porPartidoTiros: jugados.length ? recibidos / jugados.length : 0,
    zonas,
  };
}

export function calcRankingJugadoras({ jugStats, partidoIds, jugadores }) {
  const map = {};
  for (const s of jugStats) {
    if (!partidoIds.has(s.id_partido)) continue;
    if (!map[s.id_jugador]) {
      map[s.id_jugador] = {
        goles: 0,
        lanzamientos: 0,
        recuperaciones: 0,
        perdidas: 0,
        faltas_cometidas: 0,
        faltas_recibidas: 0,
        partidos: 0,
      };
    }
    const row = map[s.id_jugador];
    row.goles += s.goles || 0;
    row.lanzamientos += s.lanzamientos || 0;
    row.recuperaciones += s.recuperaciones || 0;
    row.perdidas += s.perdidas || 0;
    row.faltas_cometidas += s.faltas_cometidas || 0;
    row.faltas_recibidas += s.faltas_recibidas || 0;
    row.partidos += 1;
  }
  return Object.entries(map)
    .map(([jid, vals]) => {
      const j = jugadores.find((x) => x.id_jugador === jid);
      return {
        id: jid,
        nombre: j ? `${j.nombre} ${j.apellido}` : 'Jugadora',
        dorsal: j?.dorsal,
        ...vals,
        efi: vals.lanzamientos ? Math.round((vals.goles / vals.lanzamientos) * 100) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.goles - a.goles || b.recuperaciones - a.recuperaciones || b.lanzamientos - a.lanzamientos,
    );
}

export function calcEfiPorPosicion({ jugStats, partidoIds, jugadores }) {
  const familias = {
    Extremo: { goles: 0, lanzamientos: 0 },
    Lateral: { goles: 0, lanzamientos: 0 },
    Central: { goles: 0, lanzamientos: 0 },
    Pivote: { goles: 0, lanzamientos: 0 },
  };
  for (const s of jugStats) {
    if (!partidoIds.has(s.id_partido)) continue;
    const j = jugadores.find((x) => x.id_jugador === s.id_jugador);
    const raw = Array.isArray(j?.posiciones) ? j.posiciones.join(' ') : j?.posiciones || '';
    const pos = String(raw).toLowerCase();
    if (pos.includes('portero')) continue;
    const key = Object.keys(familias).find((k) => pos.includes(k.toLowerCase()));
    if (!key) continue;
    familias[key].goles += s.goles || 0;
    familias[key].lanzamientos += s.lanzamientos || 0;
  }
  return Object.entries(familias).map(([posicion, v]) => ({
    posicion,
    efectividad: v.lanzamientos
      ? Math.round((v.goles / v.lanzamientos) * 1000) / 10
      : 0,
    goles: v.goles,
    lanzamientos: v.lanzamientos,
  }));
}

export function calcPorPortero({ gkFiltradas, jugadores }) {
  const map = {};
  for (const s of gkFiltradas) {
    if (!map[s.id_jugador]) {
      map[s.id_jugador] = { paradas: 0, recibidos: 0, partidos: 0 };
    }
    map[s.id_jugador].paradas += s.paradas || 0;
    map[s.id_jugador].recibidos += s.lanzamientos_recibidos || 0;
    map[s.id_jugador].partidos += 1;
  }
  return Object.entries(map)
    .map(([jid, vals]) => {
      const j = jugadores.find((x) => x.id_jugador === jid);
      return {
        id: jid,
        nombre: j ? `${j.nombre} ${j.apellido}` : 'Portero',
        dorsal: j?.dorsal,
        ...vals,
        efi: vals.recibidos ? Math.round((vals.paradas / vals.recibidos) * 100) : 0,
      };
    })
    .sort((a, b) => b.paradas - a.paradas);
}

export function calcEvolucion({ jugados, myId }) {
  return jugados.map((p) => {
    const local = p.id_equipo_local === myId;
    const gf = local ? p.goles_local || 0 : p.goles_visitante || 0;
    const gc = local ? p.goles_visitante || 0 : p.goles_local || 0;
    const diff = gf - gc;
    return {
      id: p.id_partido,
      label: p.jornada ? String(p.jornada) : new Date(p.fecha).getDate(),
      goles: gf,
      gf,
      gc,
      diff,
      resultado: diff > 0 ? 'V' : diff < 0 ? 'D' : 'E',
      rival:
        local ? p.equipo_visitante_nombre : p.equipo_local_nombre,
    };
  });
}

export function calcRivalesOpts(evolucion) {
  const map = new Map();
  for (const e of evolucion) {
    const name = (e.rival || '').trim();
    if (!name) continue;
    map.set(name, (map.get(name) || 0) + 1);
  }
  return [...map.entries()]
    .map(([nombre, n]) => ({ nombre, n }))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
}

export function calcVsRival(evolucion, rivalSel) {
  if (!rivalSel) return null;
  const matches = evolucion.filter((e) => e.rival === rivalSel);
  if (!matches.length) return null;
  let v = 0;
  let e = 0;
  let d = 0;
  let gf = 0;
  let gc = 0;
  for (const m of matches) {
    gf += m.gf;
    gc += m.gc;
    if (m.resultado === 'V') v += 1;
    else if (m.resultado === 'D') d += 1;
    else e += 1;
  }
  return {
    partidos: matches.length,
    v,
    e,
    d,
    gf,
    gc,
    diff: gf - gc,
    gfAvg: gf / matches.length,
    gcAvg: gc / matches.length,
    matches: [...matches].reverse(),
  };
}

export function calcZoneEntries(zonas, zoneTab) {
  return Object.entries(zonas).map(([key, vals]) => {
    const pct = vals.lanzamientos
      ? Math.round((vals.paradas / vals.lanzamientos) * 100)
      : 0;
    const labels = {
      '6m': '6 m',
      '9m': '9 m',
      '7m': '7 m',
      extremo: 'Extremo',
      contraataque: 'Contra',
    };
    let value = vals.paradas;
    if (zoneTab === 'tiros') value = vals.lanzamientos;
    if (zoneTab === 'efectividad') value = `${pct}%`;
    return {
      key,
      label: labels[key] || key,
      pct,
      value,
      ratio: `${vals.paradas}/${vals.lanzamientos}`,
    };
  });
}
