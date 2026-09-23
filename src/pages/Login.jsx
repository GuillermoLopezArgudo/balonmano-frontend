import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login, isAuth } = useAuth();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuth) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(correo, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen login-screen">
      <section className="auth-hero login-hero">
        <div className="brand-lockup">
          <span className="brand-badge">7M</span>
          <div>
            <strong>SIETE</strong>
            <small>MÁS QUE EL JUEGO</small>
          </div>
        </div>

        <div className="login-hero-copy">
          <p className="kicker">INTELIGENCIA PARA BALONMANO</p>
          <h1>Cada posesión cuenta. Cada dato decide.</h1>
          <p className="lede">
            Gestiona tu equipo, registra partidos y convierte el rendimiento en decisiones
            competitivas.
          </p>
        </div>

        <ul className="stat-pills">
          <li>
            <span className="dot cyan" />
            24 jugadores
          </li>
          <li>
            <span className="dot lime" />
            18 partidos
          </li>
          <li>
            <span className="dot purple" />
            1 objetivo
          </li>
        </ul>
      </section>

      <section className="auth-card">
        <div className="card">
          <div className="auth-mobile-brand brand-lockup">
            <span className="brand-badge">7M</span>
            <div>
              <strong>SIETE</strong>
              <small>MÁS QUE EL JUEGO</small>
            </div>
          </div>
          <h2>Bienvenido de nuevo</h2>
          <p className="sub">Accede al espacio de trabajo de tu club.</p>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="correo">Correo electrónico</label>
              <input
                id="correo"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="marta@atleticorome.es"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="full" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar en SIETE'}
            </button>
            <p className="auth-foot muted">
              ¿Nuevo club? <Link to="/registro">Registrar equipo</Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
