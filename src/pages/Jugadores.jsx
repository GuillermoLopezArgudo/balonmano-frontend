import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = {
  nombre: '',
  apellido: '',
  dorsal: '',
  id_equipo: '',
  id_posicion: '',
  altura_cm: '',
};

export default function Jugadores() {
  const [jugadores, setJugadores] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [j, e, p] = await Promise.all([
        api.getJugadores(),
        api.getEquipos(),
        api.getPosiciones(),
      ]);
      setJugadores(j);
      setEquipos(e);
      setPosiciones(p);
      setError('');
    } catch (err) {
      setError(err.message);
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
      await api.createJugador({
        nombre: form.nombre,
        apellido: form.apellido,
        dorsal: Number(form.dorsal),
        id_equipo: form.id_equipo,
        id_posicion: form.id_posicion ? Number(form.id_posicion) : null,
        altura_cm: form.altura_cm ? Number(form.altura_cm) : null,
      });
      setForm(empty);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm('¿Borrar jugador?')) return;
    await api.deleteJugador(id);
    await load();
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Jugadores</h2>
        <p>Plantilla y ficha</p>
      </header>

      <form className="form-grid" onSubmit={onSubmit}>
        <input
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
        />
        <input
          placeholder="Apellido"
          value={form.apellido}
          onChange={(e) => setForm({ ...form, apellido: e.target.value })}
          required
        />
        <input
          type="number"
          placeholder="Dorsal"
          min="0"
          max="99"
          value={form.dorsal}
          onChange={(e) => setForm({ ...form, dorsal: e.target.value })}
          required
        />
        <select
          value={form.id_equipo}
          onChange={(e) => setForm({ ...form, id_equipo: e.target.value })}
          required
        >
          <option value="">Equipo</option>
          {equipos.map((eq) => (
            <option key={eq.id_equipo} value={eq.id_equipo}>
              {eq.datos?.nombre}
            </option>
          ))}
        </select>
        <select
          value={form.id_posicion}
          onChange={(e) => setForm({ ...form, id_posicion: e.target.value })}
        >
          <option value="">Posición</option>
          {posiciones.map((p) => (
            <option key={p.id_posicion} value={p.id_posicion}>
              {p.nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Altura (cm)"
          min="100"
          max="250"
          value={form.altura_cm}
          onChange={(e) => setForm({ ...form, altura_cm: e.target.value })}
        />
        <button type="submit">Añadir</button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Posición</th>
                <th>Equipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jugadores.map((j) => (
                <tr key={j.id_jugador}>
                  <td>{j.dorsal ?? '—'}</td>
                  <td>
                    {j.nombre} {j.apellido}
                  </td>
                  <td>{j.posiciones?.join(', ') || '—'}</td>
                  <td>{j.equipo_nombre || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => onDelete(j.id_jugador)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
              {!jugadores.length && (
                <tr>
                  <td colSpan="5" className="muted">
                    Todavía no hay jugadores
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
