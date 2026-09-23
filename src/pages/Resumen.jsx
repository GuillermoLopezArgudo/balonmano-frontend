import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Resumen() {
  const [resumen, setResumen] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setResumen(await api.getResumen());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Resumen</h2>
        <p>Totales acumulados por jugador</p>
      </header>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Partidos</th>
                <th>Goles</th>
                <th>Asistencias</th>
                <th>Lanzamientos</th>
                <th>Exclusiones</th>
                <th>Minutos</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.id_jugador}>
                  <td>
                    {r.nombre} {r.apellido}
                  </td>
                  <td>{r.partidos}</td>
                  <td>{r.goles}</td>
                  <td>{r.asistencias}</td>
                  <td>{r.lanzamientos}</td>
                  <td>{r.exclusiones_2min}</td>
                  <td>{r.minutos_jugados}</td>
                </tr>
              ))}
              {!resumen.length && (
                <tr>
                  <td colSpan="7" className="muted">
                    Añade jugadores para ver el resumen
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
