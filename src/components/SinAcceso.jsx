import { Link } from 'react-router-dom';
import { IcoFlecha } from './ActionIcons';

export default function SinAcceso({ que = 'esta sección' }) {
  return (
    <section className="panel">
      <h2>Sin acceso</h2>
      <p className="muted">Tu cargo no puede ver {que}.</p>
      <Link className="volver-link" to="/">
        <IcoFlecha />
        Volver al resumen
      </Link>
    </section>
  );
}
