import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = {
  id_jugador: '',
  id_partido: '',
  goles: 0,
  asistencias: 0,
  lanzamientos: 0,
  lanzamientos_fallados: 0,
  exclusiones_2min: 0,
  minutos_jugados: 0,
};

export default function Estadisticas() {
  const [jugadores, setJugadores] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [stats, setStats] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [j, p, s] = await Promise.all([
        api.getJugadores(),
        api.getPartidos(),
        api.getEstadisticas(),
      ]);
      setJugadores(j);
      setPartidos(p);
      setStats(s);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createEstadistica({
        id_jugador: form.id_jugador,
        id_partido: form.id_partido,
        goles: Number(form.goles),
        asistencias: Number(form.asistencias),
        lanzamientos: Number(form.lanzamientos),
        lanzamientos_fallados: Number(form.lanzamientos_fallados),
        exclusiones_2min: Number(form.exclusiones_2min),
        minutos_jugados: Number(form.minutos_jugados),
      });
      setForm(empty);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const nombreJugador = (id) => {
    const j = jugadores.find((x) => x.id_jugador === id);
    return j ? `${j.nombre} ${j.apellido}` : id;
  };
  const labelPartido = (id) => {
    const p = partidos.find((x) => x.id_partido === id);
    return p ? `${p.equipo_local_nombre} vs ${p.equipo_visitante_nombre}` : id;
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Estadísticas</h2>
        <p>Rendimiento por partido (campo)</p>
      </header>

      <form className="form-grid" onSubmit={onSubmit}>
        <select
          value={form.id_jugador}
          onChange={(e) => setForm({ ...form, id_jugador: e.target.value })}
          required
        >
          <option value="">Jugador</option>
          {jugadores.map((j) => (
            <option key={j.id_jugador} value={j.id_jugador}>
              #{j.dorsal} {j.nombre} {j.apellido}
            </option>
          ))}
        </select>
        <select
          value={form.id_partido}
          onChange={(e) => setForm({ ...form, id_partido: e.target.value })}
          required
        >
          <option value="">Partido</option>
          {partidos.map((p) => (
            <option key={p.id_partido} value={p.id_partido}>
              {p.equipo_local_nombre} vs {p.equipo_visitante_nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          placeholder="Goles"
          value={form.goles}
          onChange={(e) => setForm({ ...form, goles: e.target.value })}
        />
        <input
          type="number"
          min="0"
          placeholder="Asistencias"
          value={form.asistencias}
          onChange={(e) => setForm({ ...form, asistencias: e.target.value })}
        />
        <input
          type="number"
          min="0"
          placeholder="Lanzamientos"
          value={form.lanzamientos}
          onChange={(e) => setForm({ ...form, lanzamientos: e.target.value })}
        />
        <input
          type="number"
          min="0"
          placeholder="Fallados"
          value={form.lanzamientos_fallados}
          onChange={(e) => setForm({ ...form, lanzamientos_fallados: e.target.value })}
        />
        <input
          type="number"
          min="0"
          placeholder="Exclusiones 2'"
          value={form.exclusiones_2min}
          onChange={(e) => setForm({ ...form, exclusiones_2min: e.target.value })}
        />
        <input
          type="number"
          min="0"
          max="60"
          placeholder="Minutos"
          value={form.minutos_jugados}
          onChange={(e) => setForm({ ...form, minutos_jugados: e.target.value })}
        />
        <button type="submit">Registrar</button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Partido</th>
                <th>Goles</th>
                <th>Asist.</th>
                <th>Lanz.</th>
                <th>Exc.</th>
                <th>Min</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id_estadistica}>
                  <td>{nombreJugador(s.id_jugador)}</td>
                  <td>{labelPartido(s.id_partido)}</td>
                  <td>{s.goles}</td>
                  <td>{s.asistencias}</td>
                  <td>{s.lanzamientos}</td>
                  <td>{s.exclusiones_2min}</td>
                  <td>{s.minutos_jugados}</td>
                </tr>
              ))}
              {!stats.length && (
                <tr>
                  <td colSpan="7" className="muted">
                    Sin estadísticas todavía
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
