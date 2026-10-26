import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { IcoFlecha } from '../components/ActionIcons';
import { useAuth } from '../auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Recuperar() {
  const { isAuth } = useAuth();
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [loading, setLoading] = useState(false);

  if (isAuth) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const mail = correo.trim();
    if (!mail || !EMAIL_RE.test(mail)) {
      setError('Introduce un correo válido');
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword({ correo: mail });
      setDone(res);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err.message || 'No se pudo enviar la solicitud');
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
          <p className="kicker">CUENTA</p>
          <h1>Recupera el acceso a tu club</h1>
          <p className="lede">
            Te enviaremos un enlace para crear una contraseña nueva. Caduca en dos horas.
          </p>
        </div>
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
          <h2>¿Olvidaste la contraseña?</h2>
          <p className="sub">Indica el correo del club o de un miembro con acceso.</p>

          {done ? (
            <div>
              <p className="club-status saved">{done.message}</p>
              {done.reset_url && (
                <p className="muted" style={{ marginTop: '0.75rem', wordBreak: 'break-all' }}>
                  Modo local (sin SMTP):{' '}
                  <a href={done.reset_url}>abrir enlace de restablecimiento</a>
                </p>
              )}
              <p className="auth-foot muted" style={{ marginTop: '1.25rem' }}>
                <Link className="volver-link" to="/login">
                  <IcoFlecha />
                  Volver al inicio de sesión
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="field">
                <label htmlFor="correo-rec">Correo electrónico</label>
                <input
                  id="correo-rec"
                  type="email"
                  autoComplete="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="marta@atleticorome.es"
                  required
                />
              </div>
              {error && <p className="error">{error}</p>}
              <button type="submit" className="full" disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </button>
              <p className="auth-foot muted">
                <Link className="volver-link" to="/login">
                  <IcoFlecha />
                  Volver al inicio de sesión
                </Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
