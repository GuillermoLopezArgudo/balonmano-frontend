import { useMemo, useState } from 'react';
import { api, isAbortError } from '../../api';
import { useAbortable } from '../../useAbortable';
import {
  calcEfiPorPosicion,
  calcEvolucion,
  calcMetrics,
  calcPorPortero,
  calcRankingJugadoras,
  calcRivalesOpts,
  calcVsRival,
  calcZoneEntries,
} from './aggregations';

/** Carga de datos y series derivadas de la analÃ­tica. */
export function useAnaliticaData({ equipo }) {
  const [dash, setDash] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [idTemporada, setIdTemporada] = useState('');
  const [gkStats, setGkStats] = useState([]);
  const [jugStats, setJugStats] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [filtro, setFiltro] = useState('temporada');
  const [zoneTab, setZoneTab] = useState('paradas');
  const [rivalSel, setRivalSel] = useState('');
  const [error, setError] = useState('');

  useAbortable(async ({ signal, alive }) => {
    try {
      const [d, p, temps, gk, js, j] = await Promise.all([
        api.getDashboard({ signal }),
        api.getPartidos({ signal }),
        api.getTemporadas({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
        api.getEstadisticasPorteros({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
        api.getEstadisticas({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
        api.getJugadores({ signal }).catch((e) => {
          if (isAbortError(e)) throw e;
          return [];
        }),
      ]);
      if (!alive()) return;
      setDash(d);
      setPartidos(p);
      setTemporadas(temps || []);
      setGkStats(gk);
      setJugStats(js);
      setJugadores(j);
      const activa = (temps || []).find((t) => t.estado === 'activa');
      const fallback =
        activa?.id_temporada ||
        (temps || [])[0]?.id_temporada ||
        p.find((x) => x.id_temporada)?.id_temporada ||
        '';
      setIdTemporada((prev) => prev || (fallback ? String(fallback) : ''));
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const myId = equipo?.id_equipo;

  const temporadaSel = useMemo(
    () => temporadas.find((t) => String(t.id_temporada) === String(idTemporada)) || null,
    [temporadas, idTemporada],
  );

  const partidosTemporada = useMemo(() => {
    if (!idTemporada) return partidos;
    return partidos.filter((p) => String(p.id_temporada) === String(idTemporada));
  }, [partidos, idTemporada]);

  const jugados = useMemo(() => {
    // Solo partidos cerrados manualmente como jugados (sin_resultado no suma).
    let list = partidosTemporada
      .filter((p) => p.estado === 'jugado')
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (filtro === 'ultimos5') list = list.slice(-5);
    if (filtro === 'ultimos10') list = list.slice(-10);
    return list;
  }, [partidosTemporada, filtro]);

  const partidoIds = useMemo(
    () => new Set(jugados.map((p) => p.id_partido)),
    [jugados],
  );

  const gkFiltradas = useMemo(
    () => gkStats.filter((s) => partidoIds.has(s.id_partido)),
    [gkStats, partidoIds],
  );

  const metrics = useMemo(
    () => calcMetrics({ jugados, myId, dash, gkFiltradas, jugStats, partidoIds }),
    [jugados, myId, dash, gkFiltradas, jugStats, partidoIds],
  );

  const rankingJugadoras = useMemo(
    () => calcRankingJugadoras({ jugStats, partidoIds, jugadores }),
    [jugStats, partidoIds, jugadores],
  );

  const efiPorPosicion = useMemo(
    () => calcEfiPorPosicion({ jugStats, partidoIds, jugadores }),
    [jugStats, partidoIds, jugadores],
  );

  const porPortero = useMemo(
    () => calcPorPortero({ gkFiltradas, jugadores }),
    [gkFiltradas, jugadores],
  );

  const evolucion = useMemo(() => calcEvolucion({ jugados, myId }), [jugados, myId]);

  const maxGoles = Math.max(
    1,
    ...evolucion.flatMap((e) => [e.gf, e.gc]),
    1,
  );

  const rivalesOpts = useMemo(() => calcRivalesOpts(evolucion), [evolucion]);

  const vsRival = useMemo(() => calcVsRival(evolucion, rivalSel), [evolucion, rivalSel]);

  const temporada =
    temporadaSel?.nombre ||
    jugados[0]?.temporada_nombre ||
    partidosTemporada[0]?.temporada_nombre ||
    'Temporada';

  const temporadaEstadoLabel =
    temporadaSel?.estado === 'activa'
      ? 'activa'
      : temporadaSel?.estado === 'cerrada'
        ? 'cerrada'
        : temporadaSel?.estado === 'archivada'
          ? 'archivada'
          : '';

  const zoneEntries = calcZoneEntries(metrics.zonas, zoneTab);

  return {
    dash,
    temporadas,
    idTemporada,
    setIdTemporada,
    filtro,
    setFiltro,
    zoneTab,
    setZoneTab,
    rivalSel,
    setRivalSel,
    error,
    setError,
    jugados,
    metrics,
    rankingJugadoras,
    efiPorPosicion,
    porPortero,
    evolucion,
    maxGoles,
    rivalesOpts,
    vsRival,
    temporada,
    temporadaEstadoLabel,
    zoneEntries,
  };
}
