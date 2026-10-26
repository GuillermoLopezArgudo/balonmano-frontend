import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { isAbortError } from '../api';
import { useAuth } from '../auth';
import PasswordInput from '../components/PasswordInput';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [notice] = useState(() => {
    const text = sessionStorage.getItem('siete_login_notice') || '';
    if (text) sessionStorage.removeItem('siete_login_notice');
    return text;
  });

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
            <PasswordInput
              id="password"
              label="Contraseña"
              value={password}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className={fieldErrors.password ? 'has-error' : ''}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((f) => ({ ...f, password: undefined }));
                }
              }}
            />
            {fieldErrors.password && (
              <p id="password-error" className="field-error">
                {fieldErrors.password}
              </p>
            )}
            {notice && <p className="club-status saved">{notice}</p>}
            {error && <p className="error">{error}</p>}
            <button type="submit" className="full" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar en SIETE'}
            </button>
            <p className="auth-foot muted">
              {/* Olvidé la contraseña desactivado: no hay servicio SMTP.
              <Link to="/recuperar">¿Olvidaste la contraseña?</Link>
              <br />
              */}
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
