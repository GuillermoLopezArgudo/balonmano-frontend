import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, isAbortError } from '../api';
import { useAuth } from '../auth';
import { passwordError } from '../password';

export default function AceptarInvitacion() {
  const { token } = useParams();
  const { isAuth, loginWithAuthOut } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Enlace no válido');
      setBooting(false);
      return undefined;
    }
    const ac = new AbortController();
    api
      .getInvitacion(token, { signal: ac.signal })
      .then((data) => {
        setInfo(data);
        if (data.ya_aceptada) {
          setError('Esta invitación ya fue aceptada. Inicia sesión con tu correo.');
        }
      })
      .catch((e) => {
        if (!isAbortError(e)) setError(e.message);
      })
      .finally(() => {
        if (!ac.signal.aborted) setBooting(false);
      });
    return () => ac.abort();
  }, [token]);

  if (isAuth) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    const passMsg = passwordError(password);
    if (passMsg) {
      setError(passMsg);
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.aceptarInvitacion({ token, password });
      await loginWithAuthOut(res);
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
          <p className="kicker">INVITACIÓN AL CLUB</p>
          <h1>Activa tu acceso al equipo</h1>
          <p className="lede">
            Crea tu contraseña para entrar a SIETE con tu correo de staff.
          </p>
        </div>
      </section>

      <section className="auth-card">
        <div className="card">
          <h2>Aceptar invitación</h2>
          {booting && <p className="muted">Comprobando enlace…</p>}
          {!booting && info && !info.ya_aceptada && (
            <>
              <p className="sub">
                <strong>{info.club}</strong> · {info.cargo}
                {info.permiso === 'administrador' ? ' · Admin' : ''}
              </p>
              <p className="muted" style={{ marginTop: 0 }}>
                {info.nombre} · {info.correo}
              </p>
              <form onSubmit={onSubmit}>
                <div className="field">
                  <label htmlFor="pwd">Contraseña</label>
                  <input
                    id="pwd"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="muted">Mayúscula, minúscula y un número.</p>
                </div>
                <div className="field">
                  <label htmlFor="pwd2">Repetir contraseña</label>
                  <input
                    id="pwd2"
                    type="password"
                    required
                    minLength={8}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                {error && <p className="error">{error}</p>}
                <button type="submit" disabled={loading}>
                  {loading ? 'Activando…' : 'Crear acceso y entrar'}
                </button>
              </form>
            </>
          )}
          {!booting && (error || info?.ya_aceptada) && (
            <>
              {error && <p className="error">{error}</p>}
              <p className="sub">
                <Link to="/login">Ir a iniciar sesión</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
