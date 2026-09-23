import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = {
  nombre: '',
  fecha_inicio: '',
  fecha_fin: '',
};

export default function Temporadas() {
  const [temporadas, setTemporadas] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setTemporadas(await api.getTemporadas());
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
      await api.createTemporada(form);
      setForm(empty);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm('¿Borrar temporada?')) return;
    await api.deleteTemporada(id);
    await load();
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Temporadas</h2>
        <p>Periodos de competición</p>
      </header>

      <form className="form-grid" onSubmit={onSubmit}>
        <input
          placeholder="Nombre (ej. 2025/26)"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
        />
        <input
          type="date"
          value={form.fecha_inicio}
          onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
          required
        />
        <input
          type="date"
          value={form.fecha_fin}
          onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
          required
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
                <th>Inicio</th>
                <th>Fin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {temporadas.map((t) => (
                <tr key={t.id_temporada}>
                  <td>{t.nombre}</td>
                  <td>{t.fecha_inicio}</td>
                  <td>{t.fecha_fin}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => onDelete(t.id_temporada)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
              {!temporadas.length && (
                <tr>
                  <td colSpan="4" className="muted">
                    Todavía no hay temporadas
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
