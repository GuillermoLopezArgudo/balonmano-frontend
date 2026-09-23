import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { useAbortable } from '../useAbortable';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function monthKey(fecha) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

function dayLabel(fecha) {
  const d = new Date(fecha);
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`;
}

function isFinished(p) {
  return p.estado === 'jugado' || p.estado === 'no_disputado';
}

function isAplazado(p) {
  return p.estado === 'aplazado';
}

export default function Partidos() {
  const { equipo } = useAuth();
  const [partidos, setPartidos] = useState([]);
  const [temporadas, setTemporadas] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [condicion, setCondicion] = useState('ambos');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [p, t] = await Promise.all([api.getPartidos(), api.getTemporadas()]);
    setPartidos(p);
    setTemporadas(t);
  };

  useAbortable(async ({ signal, alive }) => {
    try {
      const [p, t] = await Promise.all([
        api.getPartidos({ signal }),
        api.getTemporadas({ signal }),
      ]);
      if (!alive()) return;
      setPartidos(p);
      setTemporadas(t);
    } catch (e) {
      if (!alive() || isAbortError(e)) return;
      setError(e.message);
    }
  }, []);

  const counts = useMemo(() => {
    return {
      todos: partidos.length,
      proximos: partidos.filter((p) => p.estado === 'programado' || (!p.estado && new Date(p.fecha) > new Date())).length,
      aplazados: partidos.filter((p) => p.estado === 'aplazado').length,
      finalizados: partidos.filter((p) => isFinished(p)).length,
    };
  }, [partidos]);

  const periodos = useMemo(() => {
    const keys = [...new Set(partidos.map((p) => monthKey(p.fecha)))].sort().reverse();
    return keys;
  }, [partidos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const myId = equipo?.id_equipo;
    return partidos.filter((p) => {
      if (filtro === 'proximos' && p.estado !== 'programado' && !(!p.estado && new Date(p.fecha) > new Date()))
        return false;
      if (filtro === 'aplazados' && p.estado !== 'aplazado') return false;
      if (filtro === 'finalizados' && !isFinished(p)) return false;
      if (periodo !== 'todos' && monthKey(p.fecha) !== periodo) return false;
      if (condicion === 'local' && p.id_equipo_local !== myId) return false;
      if (condicion === 'visitante' && p.id_equipo_visitante !== myId) return false;
      if (q) {
        const hay = `${p.equipo_local_nombre} ${p.equipo_visitante_nombre}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [partidos, filtro, periodo, condicion, busqueda, equipo]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of [...filtrados].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))) {
      const key = monthKey(p.fecha);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return [...map.entries()];
  }, [filtrados]);

  const temporadaLabel =
    temporadas.find((t) => t.estado === 'activa')?.nombre || temporadas[0]?.nombre || 'Temporada';
  const competicion = equipo?.datos?.competicion || 'Competición';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">TEMPORADA {temporadaLabel}</p>
          <h1>Partidos</h1>
        </div>
        <Link to="/partidos/nuevo">
          <button type="button">+ Nuevo partido</button>
        </Link>
      </header>

      <div className="filters roster-filters">
        {[
          { key: 'todos', label: `Todos · ${counts.todos}` },
          { key: 'proximos', label: `Próximos · ${counts.proximos}` },
          { key: 'aplazados', label: `Aplazados · ${counts.aplazados}` },
          { key: 'finalizados', label: `Finalizados · ${counts.finalizados}` },
        ].map((f) => (
          <button
            type="button"
            key={f.key}
            className={filtro === f.key ? 'active' : ''}
            onClick={() => setFiltro(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="panel cal-filters">
        <div className="field">
          <label>Competición</label>
          <input value={competicion} readOnly />
        </div>
        <div className="field">
          <label>Periodo</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="todos">Todos los meses</option>
            {periodos.map((k) => (
              <option key={k} value={k}>
                {monthLabel(k)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Condición</label>
          <select value={condicion} onChange={(e) => setCondicion(e.target.value)}>
            <option value="ambos">Local y visitante</option>
            <option value="local">Solo local</option>
            <option value="visitante">Solo visitante</option>
          </select>
        </div>
        <div className="field">
          <label>Buscar rival</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
          />
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="cal-months">
        {grouped.map(([key, items]) => (
          <section className="panel cal-month" key={key}>
            <div className="cal-month-head">
              <span className="cal-ico">▦</span>
              <h2>{monthLabel(key)}</h2>
            </div>
            <div className="cal-days">
              {items.map((p) => {
                const finished = isFinished(p);
                const soyLocal = p.id_equipo_local === equipo?.id_equipo;
                return (
                  <div className={`cal-row${finished ? ' done' : ''}${isAplazado(p) ? ' aplazado' : ''}`} key={p.id_partido}>
                    <div className="cal-day">{dayLabel(p.fecha)}</div>
                    <div className="cal-match">
                      <strong>
                        {p.equipo_local_nombre}{' '}
                        <span className="cal-score">
                          {finished ? `${p.goles_local} - ${p.goles_visitante}` : 'vs'}
                        </span>{' '}
                        {p.equipo_visitante_nombre}
                      </strong>
                      <small>
                        {p.jornada ? `Jornada ${p.jornada} · ` : ''}
                        {soyLocal ? 'Local' : 'Visitante'} ·{' '}
                        {new Date(p.fecha).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {p.estado === 'aplazado' ? ' · Aplazado' : ''}
                        {p.temporada_estado === 'cerrada' ? ' · Temp. cerrada' : ''}
                      </small>
                    </div>
                    <div className="cal-actions">
                      {!finished && p.estado !== 'aplazado' && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={async () => {
                            await api.updatePartido(p.id_partido, { estado: 'aplazado' });
                            await load();
                          }}
                        >
                          Aplazar
                        </button>
                      )}
                      {p.estado === 'aplazado' && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={async () => {
                            await api.updatePartido(p.id_partido, { estado: 'programado' });
                            await load();
                          }}
                        >
                          Reprogramar
                        </button>
                      )}
                      {!finished && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={async () => {
                            await api.updatePartido(p.id_partido, { estado: 'jugado' });
                            await load();
                          }}
                        >
                          Marcar jugado
                        </button>
                      )}
                      <Link to={`/partidos/${p.id_partido}/resumen`}>
                        <button type="button" className="ghost">
                          Resumen
                        </button>
                      </Link>
                      <Link to={`/partidos/${p.id_partido}/directo`}>
                        <button type="button" className="ghost">
                          Directo
                        </button>
                      </Link>
                      <Link to={`/partidos/${p.id_partido}/convocatoria`}>
                        <button type="button" className="ghost">
                          Convocatoria
                        </button>
                      </Link>
                      <Link to={`/partidos/${p.id_partido}/estadisticas`}>
                        <button type="button" className="ghost">
                          {finished ? 'Acta' : 'Registrar'}
                        </button>
                      </Link>
                      <button
                        type="button"
                        className="ghost roster-del"
                        onClick={async () => {
                          if (!confirm('¿Borrar partido?')) return;
                          await api.deletePartido(p.id_partido);
                          await load();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {!grouped.length && (
          <section className="panel">
            <p className="muted">No hay partidos con estos filtros</p>
          </section>
        )}
      </div>
    </>
  );
}
