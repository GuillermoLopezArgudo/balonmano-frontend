import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }) => (isActive ? 'active' : undefined);

export default function FisicoTabs({ end = null }) {
  return (
    <div className="filters roster-filters fisico-tabs" style={{ marginBottom: '1rem' }}>
      <NavLink to="/preparacion/entrenamiento" end className={linkClass}>
        Entrenamientos
      </NavLink>
      <NavLink to="/preparacion/asistencia" className={linkClass}>
        Asistencia
      </NavLink>
      <NavLink to="/preparacion" end className={linkClass}>
        Físico
      </NavLink>
      {end}
    </div>
  );
}
