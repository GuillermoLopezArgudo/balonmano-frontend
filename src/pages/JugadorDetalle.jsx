import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../api';
import { HandballCourtMarks, PISTA_CELLS } from '../components/ShotMaps';

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
  ext_izq: 'Ext. izq.',
  ext_der: 'Ext. der.',
  '6m_izq': '6 m izq.',
  '6m_cen': '6 m cen.',
  '6m_der': '6 m der.',
  '7m': '7 m',
  '9m_izq': '9 m izq.',
  '9m_cen': '9 m cen.',
  '9m_der': '9 m der.',
  contraataque: 'Contra',
};

function zoneEntry(map, key, mode) {
  const vals = (map || {})[key] || { lanzamientos: 0, goles: 0, paradas: 0 };
  if (mode === 'gk') {
    const pct = vals.lanzamientos
      ? Math.round((vals.paradas / vals.lanzamientos) * 100)
      : 0;
    return {
      key,
      label: ZONE_LABELS[key] || key,
      pct,
      ratio: `${vals.paradas || 0}/${vals.lanzamientos || 0}`,
    };
  }
  const pct = vals.lanzamientos
    ? Math.round((vals.goles / vals.lanzamientos) * 100)
    : 0;
  return {
    key,
    label: ZONE_LABELS[key] || key,
    pct,
    ratio: `${vals.goles || 0}/${vals.lanzamientos || 0}`,
  };
}

function ZoneCard({ z, compact = false }) {
  if (!z) return null;
  return (
    <div
      className={`zone-card tone-${zoneTone(z.pct)}${compact ? ' zone-card-compact' : ''}`}
      data-zone={z.key}
    >
      <span className="muted">{z.label}</span>
      <strong>{z.pct}%</strong>
      <small className="muted">{z.ratio}</small>
    </div>
  );
}

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
          label: 'Goles recibidos',
          value: data.goles_recibidos ?? Math.max(0, data.lanzamientos_recibidos - data.paradas),
          hint:
            data.partidos > 0
              ? `${((data.goles_recibidos ?? Math.max(0, data.lanzamientos_recibidos - data.paradas)) / data.partidos).toFixed(1)} por partido`
              : 'Sin partidos',
          tone: 'cyan',
        },
        {
          label: 'Efectividad',
          value: `${data.efectividad_paradas}%`,
          hint: `${data.paradas} / ${data.lanzamientos_recibidos} tiros`,
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
        {
          label: '% Pérdidas',
          value: `${data.pct_perdidas ?? 0}%`,
          hint: `${data.perdidas || 0} pérdidas de balón`,
          tone: 'purple',
        },
      ];

  const sanciones = [
    { label: "2'", value: data.exclusiones_2min || 0, cls: 'sanc-2min' },
    { label: 'Amarillas', value: data.amarillas || 0, cls: 'sanc-am' },
    { label: 'Rojas', value: data.rojas || 0, cls: 'sanc-ro' },
    { label: 'Azules', value: data.azules || 0, cls: 'sanc-az' },
  ];

  const zoneMode = isGk ? 'gk' : 'campo';
  const zoneMap = isGk ? data.mapa_paradas : data.zonas;
  const z = (key) => zoneEntry(zoneMap, key, zoneMode);

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

      {!isGk && (
        <section className="panel forma-panel">
          <h2>Sanciones</h2>
          <div className="ficha-sanciones">
            {sanciones.map((s) => (
              <div className={`ficha-sanc-card ${s.cls}`} key={s.label}>
                <span>{s.label}</span>
                <strong>{s.value}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel forma-panel">
        <h2>{isGk ? 'Mapa de paradas' : 'Eficiencia por zona'}</h2>
        <div className="zone-eff ficha-zones" aria-label="Eficiencia por zona de pista">
          <div className="zone-eff-court">
            <svg
              className="zone-eff-svg"
              viewBox="0 0 200 118"
              role="img"
              aria-label="Pista de balonmano"
            >
              <HandballCourtMarks gradientId="zoneEff" />
            </svg>
            <div className="zone-eff-overlay">
              {PISTA_CELLS.map((c) => (
                <div
                  key={c.key}
                  className="zone-eff-slot"
                  data-zone={c.key}
                  style={{
                    left: `${(c.x / 200) * 100}%`,
                    top: `${(c.y / 118) * 100}%`,
                    width: `${(c.w / 200) * 100}%`,
                    height: `${(c.h / 118) * 100}%`,
                  }}
                >
                  <ZoneCard z={z(c.key)} compact />
                </div>
              ))}
            </div>
          </div>
          <div className="zone-eff-contra">
            <ZoneCard z={z('contraataque')} />
          </div>
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
