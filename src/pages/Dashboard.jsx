import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbortError, mediaUrl } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

function resultadoVsEquipo(partido, idEquipo) {
  if (!partido || !idEquipo) return null;
  const soyLocal = partido.id_equipo_local === idEquipo;
  const gf = soyLocal ? partido.goles_local : partido.goles_visitante;
  const gc = soyLocal ? partido.goles_visitante : partido.goles_local;
  const rival = soyLocal ? partido.equipo_visitante_nombre : partido.equipo_local_nombre;
  let marca = 'E';
  if (gf > gc) marca = 'G';
  if (gf < gc) marca = 'P';
  return { marca, gf, gc, rival, fecha: partido.fecha };
}

export default function Dashboard() {
  const { equipo } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useAbortable(async ({ signal, alive }) => {
    try {
      const d = await api.getDashboard({ signal });
      if (alive()) setData(d);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const forma = useMemo(() => {
    if (!data?.ultimos_partidos?.length || !equipo?.id_equipo) return [];
    return data.ultimos_partidos
      .slice(0, 5)
      .map((p) => resultadoVsEquipo(p, equipo.id_equipo))
      .filter(Boolean);
  }, [data, equipo]);

  const proximo = data?.proximos_partidos?.[0];
  const zonaMedia = useMemo(() => {
    if (!data?.efectividad_por_posicion?.length) return 0;
    const vals = data.efectividad_por_posicion.map((r) => r.efectividad);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [data]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando resumen…</p>;

  const eyebrow = [
    'EQUIPO BALONMANO',
    equipo?.datos?.categoria,
    equipo?.datos?.competicion,
  ]
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">{eyebrow}</p>
          <h1>Resumen del equipo</h1>
        </div>
        <Link to="/partidos/nuevo">
          <button type="button">+ Registrar partido</button>
        </Link>
      </header>

      <div className="metrics">
        <div className="metric">
          <span>Partidos</span>
          <strong className="c-lime">{data.partidos_jugados}</strong>
        </div>
        <div className="metric">
          <span>Goles marcados</span>
          <strong className="c-cyan">{data.goles_totales}</strong>
        </div>
        <div className="metric">
          <span>Eficacia de tiro</span>
          <strong className="c-purple">{data.efectividad}%</strong>
        </div>
        <div className="metric">
          <span>Eficacia por zona</span>
          <strong className="c-orange">{zonaMedia}%</strong>
        </div>
      </div>

      <div className="grid-2 dash-main">
        <section className="panel">
          <h2>Producción ofensiva</h2>
          <p className="panel-hint">Distribución por posición</p>
          {data.efectividad_por_posicion.map((row, i) => (
            <div className="bar-row" key={row.posicion}>
              <span>{row.posicion}</span>
              <div className="bar-track">
                <div
                  className={`bar-fill c${i % 5}`}
                  style={{ width: `${Math.min(Math.max(row.efectividad || 0, 0), 100)}%` }}
                />
              </div>
              <strong>{row.efectividad}%</strong>
            </div>
          ))}
          {!data.efectividad_por_posicion.length && (
            <p className="muted">Sin datos de producción todavía</p>
          )}
        </section>

        <section className="match-card">
          <div className="match-card-body">
            <span className="match-tag">
              {proximo?.jornada ? `Jornada ${proximo.jornada}` : 'Próximo partido'}
            </span>
            <div className="match-teams">
              <div>
                <span className="dot lime" />
                {proximo?.equipo_local_nombre || data.equipo_nombre}
              </div>
              <strong>vs</strong>
              <div>
                <span className="dot purple" />
                {proximo?.equipo_visitante_nombre || 'Por definir'}
              </div>
            </div>
            <p className="muted">
              {proximo
                ? new Date(proximo.fecha).toLocaleString()
                : 'Aún no hay partidos programados'}
            </p>
          </div>
          <div
            className="match-card-photo"
            style={
              proximo?.img_portada
                ? {
                    backgroundImage: `linear-gradient(160deg, rgba(11, 14, 20, 0.15), rgba(11, 14, 20, 0.82)), url(${mediaUrl(proximo.img_portada)})`,
                  }
                : undefined
            }
          >
            <p>
              {proximo
                ? new Date(proximo.fecha).toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Programa tu próximo partido'}
            </p>
          </div>
        </section>
      </div>

      <section className="panel forma-panel">
        <h2>Forma reciente</h2>
        <div className="forma-row">
          {forma.length ? (
            forma.map((f, i) => (
              <div key={`${f.rival}-${i}`} className={`forma-chip ${f.marca.toLowerCase()}`}>
                <strong>
                  {f.marca} {f.gf}-{f.gc}
                </strong>
                <span>{f.rival}</span>
              </div>
            ))
          ) : (
            <p className="muted">Sin partidos jugados todavía</p>
          )}
        </div>
      </section>
    </>
  );
}
