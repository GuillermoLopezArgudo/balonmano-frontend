import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../api';

function edad(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a;
}

function zoneTone(pct) {
  if (pct >= 40) return 'good';
  if (pct >= 33) return 'mid';
  return 'bad';
}

const ZONE_LABELS = {
  '6m': '6 m',
  '9m': '9 m',
  '7m': '7 m',
  extremo: 'Extremo',
  contraataque: 'Contra',
};

export default function JugadorDetalle() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getJugadorDetalle(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  const maxBar = useMemo(() => {
    if (!data?.ultimos_partidos?.length) return 100;
    return Math.max(100, ...data.ultimos_partidos.map((p) => p.valor || 0));
  }, [data]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando ficha…</p>;

  const j = data.jugador;
  const initials = `${(j.nombre || '?')[0]}${(j.apellido || '?')[0]}`.toUpperCase();
  const pos = (j.posiciones || [])[0] || 'Sin posición';
  const age = edad(j.fecha_nacimiento);
  const altura = j.altura_cm ? `${(j.altura_cm / 100).toFixed(2).replace('.', ',')} m` : '—';
  const peso = j.peso_kg != null ? `${j.peso_kg} kg` : '—';
  const isGk = data.es_portero;

  const metrics = isGk
    ? [
        {
          label: 'Paradas',
          value: data.paradas,
          hint:
            data.partidos > 0
              ? `${(data.paradas / data.partidos).toFixed(1)} por partido`
              : 'Sin partidos',
          tone: 'orange',
        },
        {
          label: 'Tiros recibidos',
          value: data.lanzamientos_recibidos,
          hint:
            data.partidos > 0
              ? `${(data.lanzamientos_recibidos / data.partidos).toFixed(1)} por partido`
              : 'Sin partidos',
          tone: 'cyan',
        },
        {
          label: 'Efectividad',
          value: `${data.efectividad_paradas}%`,
          hint: `${data.paradas} / ${data.lanzamientos_recibidos}`,
          tone: 'lime',
        },
      ]
    : [
        {
          label: 'Goles',
          value: data.goles,
          hint:
            data.partidos > 0
              ? `${(data.goles / data.partidos).toFixed(1)} por partido`
              : 'Sin partidos',
          tone: 'orange',
        },
        {
          label: 'Lanzamientos',
          value: data.lanzamientos,
          hint:
            data.partidos > 0
              ? `${(data.lanzamientos / data.partidos).toFixed(1)} por partido`
              : 'Sin partidos',
          tone: 'cyan',
        },
        {
          label: 'Efectividad',
          value: `${data.efectividad}%`,
          hint: `${data.goles} / ${data.lanzamientos}`,
          tone: 'lime',
        },
      ];

  const mapaEntries = isGk
    ? Object.entries(data.mapa_paradas || {}).map(([key, vals]) => {
        const pct = vals.lanzamientos
          ? Math.round((vals.paradas / vals.lanzamientos) * 100)
          : 0;
        return {
          key,
          label: ZONE_LABELS[key] || key,
          pct,
          ratio: `${vals.paradas}/${vals.lanzamientos}`,
        };
      })
    : Object.entries(data.zonas || {}).map(([key, vals]) => {
        const pct = vals.lanzamientos
          ? Math.round((vals.goles / vals.lanzamientos) * 100)
          : 0;
        return {
          key,
          label: ZONE_LABELS[key] || key,
          pct,
          ratio: `${vals.goles}/${vals.lanzamientos}`,
        };
      });

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">
            <Link to="/plantilla">PLANTILLA</Link> / FICHA
          </p>
          <h1>
            {j.nombre} {j.apellido}
          </h1>
        </div>
        <Link to={`/plantilla/${id}/editar`}>
          <button type="button">Editar perfil</button>
        </Link>
      </header>

      <div className="ficha-top">
        <section className="panel ficha-bio">
          <div className="ficha-bio-head">
            <div
              className={`ficha-avatar${j.img_foto ? '' : ' is-fallback'}`}
              style={
                j.img_foto
                  ? undefined
                  : { background: isGk ? 'var(--orange)' : 'var(--lime)' }
              }
            >
              {j.img_foto ? (
                <img src={mediaUrl(j.img_foto)} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div>
              <h2>
                {j.nombre} {j.apellido}
              </h2>
              <p className="ficha-role">
                {pos.toUpperCase()}
                {j.dorsal != null ? ` · #${j.dorsal}` : ''}
              </p>
            </div>
          </div>
          <dl className="ficha-meta">
            <div>
              <dt>Edad</dt>
              <dd>{age != null ? `${age} años` : '—'}</dd>
            </div>
            <div>
              <dt>Altura</dt>
              <dd>{altura}</dd>
            </div>
            <div>
              <dt>Peso</dt>
              <dd>{peso}</dd>
            </div>
            <div>
              <dt>Partidos</dt>
              <dd>{data.partidos}</dd>
            </div>
          </dl>
        </section>

        <div className="ficha-metrics">
          {metrics.map((m) => (
            <div className="metric ficha-metric" key={m.label}>
              <span>{m.label}</span>
              <strong className={`c-${m.tone}`}>{m.value}</strong>
              <small>{m.hint}</small>
            </div>
          ))}
        </div>
      </div>

      <section className="panel forma-panel">
        <h2>{isGk ? 'Mapa de paradas' : 'Eficiencia por zona'}</h2>
        <div className="zone-grid ficha-zones">
          {mapaEntries.map((z) => (
            <div className={`zone-card tone-${zoneTone(z.pct)}`} key={z.key}>
              <span className="muted">{z.label}</span>
              <strong>{z.pct}%</strong>
              <small className="muted">{z.ratio}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel forma-panel">
        <h2>Últimos {Math.min(8, data.ultimos_partidos?.length || 8)} partidos</h2>
        {data.ultimos_partidos?.length ? (
          <div className="ficha-bars">
            {data.ultimos_partidos.map((p, i) => (
              <div className="ficha-bar" key={`${p.fecha}-${i}`} title={`${p.fecha}: ${p.detalle}`}>
                <span className="ficha-bar-val">{p.valor}%</span>
                <div className="ficha-bar-track">
                  <div
                    className={`ficha-bar-fill${i % 2 === 0 ? ' accent' : ''}`}
                    style={{ height: `${Math.max(8, (p.valor / maxBar) * 100)}%` }}
                  />
                </div>
                <span className="ficha-bar-label">
                  {String(p.fecha).slice(5).replace('-', '/')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Sin partidos registrados todavía</p>
        )}
      </section>
    </>
  );
}
