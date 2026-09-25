import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { isAbortError } from '../api';
import { useAuth } from '../auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M2.1 3.51 3.51 2.1l18.38 18.39-1.41 1.41-3.13-3.13A12.3 12.3 0 0 1 12 19c-5 0-9.27-3.11-11-7a13.5 13.5 0 0 1 4.3-5.15L2.1 3.51zM12 7a5 5 0 0 1 4.9 6.07l-1.55-1.55A3 3 0 0 0 12 9c-.4 0-.78.08-1.13.22L9.3 7.65A4.9 4.9 0 0 1 12 7zm9.9 5a13.4 13.4 0 0 1-3.2 4.18l-1.45-1.45A11.2 11.2 0 0 0 21.1 12c-.8-1.8-2.1-3.35-3.7-4.5l1.4-1.4A13.4 13.4 0 0 1 21.9 12z"
      />
    </svg>
  );
}

function mapLoginError(err) {
  const raw = (err?.message || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return {
      form: 'No se pudo iniciar sesión. Inténtalo de nuevo.',
      fields: {},
    };
  }

  if (/correo o contraseña incorrectos|credenciales|unauthorized|no autorizado/i.test(raw)) {
    return {
      form: 'Correo o contraseña incorrectos',
      fields: {
        correo: 'Revisa el correo',
        password: 'Revisa la contraseña',
      },
    };
  }

  if (/correo|email|e-mail/i.test(raw) && /inválid|invalid|formato|válid/i.test(raw)) {
    return { form: raw, fields: { correo: raw } };
  }

  if (/contraseña|password/i.test(raw)) {
    return { form: raw, fields: { password: raw } };
  }

  if (/conectar|network|fetch|api/i.test(lower)) {
    return { form: raw, fields: {} };
  }

  return { form: raw, fields: {} };
}

export default function Login() {
  const { login, isAuth } = useAuth();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  if (isAuth) return <Navigate to="/" replace />;

  const validate = () => {
    const next = {};
    const mail = correo.trim();

    if (!mail) {
      next.correo = 'Introduce un correo electrónico';
    } else if (!EMAIL_RE.test(mail)) {
      next.correo = 'El correo no es válido';
    }

    if (!password) {
      next.password = 'Introduce la contraseña';
    } else if (password.length < 6) {
      next.password = 'La contraseña es demasiado corta';
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!validate()) return;

    setLoading(true);
    try {
      await login(correo.trim(), password);
      navigate('/');
    } catch (err) {
      if (isAbortError(err)) return;
      const mapped = mapLoginError(err);
      setError(mapped.form);
      setFieldErrors(mapped.fields);
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
          <p className="sub">Accede con el correo del club o el de un miembro invitado.</p>
          <form onSubmit={onSubmit} noValidate>
            <div className={`field${fieldErrors.correo ? ' has-error' : ''}`}>
              <label htmlFor="correo">Correo electrónico</label>
              <input
                id="correo"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="marta@atleticorome.es"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  if (fieldErrors.correo) {
                    setFieldErrors((f) => ({ ...f, correo: undefined }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.correo)}
                aria-describedby={fieldErrors.correo ? 'correo-error' : undefined}
                required
              />
              {fieldErrors.correo && (
                <p id="correo-error" className="field-error">
                  {fieldErrors.correo}
                </p>
              )}
            </div>
            <div className={`field${fieldErrors.password ? ' has-error' : ''}`}>
              <label htmlFor="password">Contraseña</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((f) => ({ ...f, password: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="field-error">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="full" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar en SIETE'}
            </button>
            <p className="auth-foot muted">
              ¿Nuevo club? <Link to="/registro">Registrar equipo</Link>
              <br />
              ¿Te invitaron? Usa el enlace que te enviaron para crear tu contraseña.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
