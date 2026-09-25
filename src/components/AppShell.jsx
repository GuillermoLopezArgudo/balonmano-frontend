import { useEffect, useId, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import LiveClockBanner from './LiveClockBanner';

function Icon({ children }) {
  return (
    <span className="ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

const IcoResumen = (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

const IcoPlantilla = (
  <Icon>
    <circle cx="9" cy="7" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <circle cx="17" cy="8" r="2.2" />
    <path d="M21 20c0-2.4-1.6-4.4-3.8-5.1" />
  </Icon>
);

const IcoPartidos = (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <line x1="12" y1="5" x2="12" y2="19" />
    <circle cx="12" cy="12" r="2.2" />
    <path d="M3 9.5h3.2a2.5 2.5 0 0 1 0 5H3" />
    <path d="M21 9.5h-3.2a2.5 2.5 0 0 0 0 5H21" />
  </Icon>
);

const IcoAnalitica = (
  <Icon>
    <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
  </Icon>
);

const IcoInformes = (
  <Icon>
    <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v4h4M9 12h7M9 16h7M9 8h2" />
  </Icon>
);

const IcoClub = (
  <Icon>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z" />
    <path d="M9 21v-7h6v7" />
  </Icon>
);

const IcoAjustes = (
  <Icon>
    <path
      d="M10.2 2.6h3.6l.5 2.1c.5.15 1 .4 1.4.7l2-.9 1.8 1.8-.9 2c.3.4.55.9.7 1.4l2.1.5v3.6l-2.1.5c-.15.5-.4 1-.7 1.4l.9 2-1.8 1.8-2-.9c-.4.3-.9.55-1.4.7l-.5 2.1h-3.6l-.5-2.1a6.2 6.2 0 0 1-1.4-.7l-2 .9-1.8-1.8.9-2a6.2 6.2 0 0 1-.7-1.4l-2.1-.5v-3.6l2.1-.5c.15-.5.4-1 .7-1.4l-.9-2 1.8-1.8 2 .9c.4-.3.9-.55 1.4-.7l.5-2.1z"
    />
    <circle cx="12" cy="12" r="3.2" />
  </Icon>
);

const IcoJugadas = (
  <Icon>
    <circle cx="8" cy="8" r="2.2" />
    <circle cx="16" cy="12" r="2.2" />
    <circle cx="9" cy="17" r="2.2" />
    <path d="M10 9.2 14.2 11.2M10.2 15.5 14.2 13.2" />
  </Icon>
);

const IcoFisico = (
  <Icon>
    <path d="M6.5 8.5 4 11.5l2.5 3 2-1.5" />
    <path d="M17.5 8.5 20 11.5l-2.5 3-2-1.5" />
    <path d="M9 7.5h6v9H9z" />
    <path d="M11 4.5h2v3h-2zM11 16.5h2v3h-2z" />
  </Icon>
);

const links = [
  { to: '/', label: 'Resumen', ico: IcoResumen, end: true },
  { to: '/plantilla', label: 'Plantilla', ico: IcoPlantilla },
  { to: '/partidos', label: 'Partidos', ico: IcoPartidos },
  { to: '/jugadas', label: 'Jugadas', ico: IcoJugadas },
  {
    to: '/preparacion/entrenamiento',
    label: 'Físico/Entrenamiento',
    ico: IcoFisico,
    match: '/preparacion',
  },
  { to: '/analitica', label: 'Analítica', ico: IcoAnalitica },
  { to: '/informes', label: 'Informes', ico: IcoInformes },
  { to: '/club', label: 'Club', ico: IcoClub },
  { to: '/ajustes', label: 'Ajustes', ico: IcoAjustes },
];

export default function AppShell() {
  const { equipo, miembro, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();

  const team = equipo?.datos?.nombre_corto || equipo?.datos?.nombre || 'Tu equipo';
  const subtitle = equipo?.datos?.categoria || '';
  const mail = miembro?.correo || equipo?.correo || '';
  const userName =
    miembro?.nombre ||
    equipo?.datos?.entrenador_nombre ||
    mail.split('@')[0] ||
    'Usuario';
  const userRole = miembro
    ? `${miembro.cargo || 'Staff'}${
        miembro.permiso === 'administrador' ? ' · Admin' : ''
      }`
    : 'Administrador del club';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className={`app-shell${menuOpen ? ' nav-open' : ''}`}>
      <header className="mobile-top">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-expanded={menuOpen}
          aria-controls={navId}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="burger" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        <NavLink to="/" className="mobile-brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-badge">7M</span>
          <strong>SIETE</strong>
        </NavLink>
        <div className="mobile-team" title={team}>
          {team}
        </div>
      </header>

      <button
        type="button"
        className="rail-backdrop"
        aria-label="Cerrar menú"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />

      <aside className="rail" id={navId}>
        <div className="rail-drawer-head">
          <NavLink to="/" className="rail-brand" onClick={() => setMenuOpen(false)}>
            <span className="brand-badge">7M</span>
            <div>
              <strong>SIETE</strong>
              <small>BALONMANO</small>
            </div>
          </NavLink>
          <button
            type="button"
            className="rail-close ghost"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="rail-team" title={team}>
          <span className="rail-team-dot" />
          <div className="rail-team-text">
            <strong>{team}</strong>
            {subtitle && <small>{subtitle}</small>}
          </div>
        </div>

        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => {
                const matched = l.match
                  ? location.pathname === l.match || location.pathname.startsWith(`${l.match}/`)
                  : isActive;
                return matched ? 'nav-item active' : 'nav-item';
              }}
            >
              {l.ico}
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="rail-footer">
          <div className="rail-user">
            <span className="avatar" style={{ background: 'var(--purple)', color: '#fff', marginRight: 0 }}>
              {(userName[0] || 'U').toUpperCase()}
            </span>
            <div>
              <strong>{userName}</strong>
              <small>{userRole}</small>
              {mail ? <small className="rail-user-mail">{mail}</small> : null}
            </div>
          </div>
          <button type="button" className="ghost full" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="workspace">
        <LiveClockBanner />
        <Outlet />
      </div>
    </div>
  );
}
