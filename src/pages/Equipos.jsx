import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = {
  correo: '',
  password: '',
  nombre: '',
  categoria: '',
  competicion: '',
};

export default function Equipos() {
  const [equipos, setEquipos] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setEquipos(await api.getEquipos());
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
      await api.createEquipo({
        correo: form.correo,
        password: form.password,
        datos: {
          nombre: form.nombre,
          categoria: form.categoria || null,
          competicion: form.competicion || null,
        },
      });
      setForm(empty);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm('¿Borrar equipo?')) return;
    await api.deleteEquipo(id);
    await load();
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Equipos</h2>
        <p>Clubes y datos públicos</p>
      </header>

      <form className="form-grid" onSubmit={onSubmit}>
        <input
          placeholder="Nombre del equipo"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Correo (login)"
          value={form.correo}
          onChange={(e) => setForm({ ...form, correo: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={8}
        />
        <input
          placeholder="Categoría"
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
        />
        <input
          placeholder="Competición"
          value={form.competicion}
          onChange={(e) => setForm({ ...form, competicion: e.target.value })}
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
                <th>Nombre</th>
                <th>Correo</th>
                <th>Categoría</th>
                <th>Competición</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((eq) => (
                <tr key={eq.id_equipo}>
                  <td>{eq.datos?.nombre}</td>
                  <td>{eq.correo}</td>
                  <td>{eq.datos?.categoria || '—'}</td>
                  <td>{eq.datos?.competicion || '—'}</td>
                  <td>
                    <button type="button" className="ghost" onClick={() => onDelete(eq.id_equipo)}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
              {!equipos.length && (
                <tr>
                  <td colSpan="5" className="muted">
                    Crea al menos un equipo para empezar
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
