import { useMemo } from 'react';
import { CourtHeatMap } from '../../components/ShotMaps';

export default function LiveHeatmapsPanel({ acciones, tipos, equipo, partido }) {
  const { calorEquipo, calorRival } = useMemo(() => {
    const tipoById = Object.fromEntries(tipos.map((t) => [t.id_tipo_accion, t.nombre]));
    const equipoCounts = {};
    const rivalCounts = {};
    for (const a of acciones) {
      if (!a.zona) continue;
      const n = (tipoById[a.id_tipo_accion] || '').toLowerCase();
      const esRival =
        (n.includes('gol') && n.includes('recibid')) || n.includes('parada');
      const bucket = esRival ? rivalCounts : equipoCounts;
      bucket[a.zona] = (bucket[a.zona] || 0) + 1;
    }
    return { calorEquipo: equipoCounts, calorRival: rivalCounts };
  }, [acciones, tipos]);

  return (
    <section className="panel club-card live-heat">
      <h2>Mapas de actividad</h2>
      <p className="panel-hint">
        Origen en pista. Verde más intenso = zona más usada. Izquierda: tu equipo ·
        Derecha: rival (paradas y goles recibidos).
      </p>
      <div className="live-heat-pair">
        <div className="live-heat-col">
          <CourtHeatMap
            counts={calorEquipo}
            title={equipo?.datos?.nombre_corto || equipo?.datos?.nombre || 'Tu equipo'}
            gradientId="heatEquipo"
          />
        </div>
        <div className="live-heat-col">
          <CourtHeatMap
            counts={calorRival}
            title={
              partido?.es_local === false
                ? partido?.equipo_local_nombre || 'Rival'
                : partido?.equipo_visitante_nombre || 'Rival'
            }
            gradientId="heatRival"
          />
        </div>
      </div>
    </section>
  );
}
