import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { IcoFlecha } from '../components/ActionIcons';
import { useAuth } from '../auth';

export default function Restablecer() {
  const { isAuth } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => (params.get('token') || '').trim(), [params]);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuth) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Falta el enlace de restablecimiento. Solicita uno nuevo.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword({ token, password });
      setOk(res.message || 'Contraseña actualizada');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err.message || 'No se pudo restablecer la contraseña');
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
          <h1>Nueva contraseña</h1>
          <p className="lede">Elige una contraseña segura para volver a entrar en SIETE.</p>
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
          <h2>Restablecer contraseña</h2>
          {!token ? (
            <>
              <p className="error">Enlace incompleto o inválido.</p>
              <p className="auth-foot muted">
                <Link to="/recuperar">Solicitar un nuevo enlace</Link>
              </p>
            </>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="field">
                <label htmlFor="pwd-new">Nueva contraseña</label>
                <input
                  id="pwd-new"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="pwd-new2">Confirmar contraseña</label>
                <input
                  id="pwd-new2"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="error">{error}</p>}
              {ok && <p className="club-status saved">{ok}</p>}
              <button type="submit" className="full" disabled={loading || Boolean(ok)}>
                {loading ? 'Guardando…' : 'Guardar contraseña'}
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
