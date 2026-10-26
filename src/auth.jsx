import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, isAbortError, setUnauthorizedHandler } from './api';
import { permsFromSession } from './permisos';
import { syncThemeFromPrefs } from './theme';
import { useClubRealtime } from './useClubRealtime';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [equipo, setEquipo] = useState(() => {
    const raw = localStorage.getItem('data_equipo');
    return raw ? JSON.parse(raw) : null;
  });
  const [miembro, setMiembro] = useState(() => {
    const raw = localStorage.getItem('data_miembro');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('data_token'));
  const [booting, setBooting] = useState(!!localStorage.getItem('data_token'));

  useEffect(() => {
    syncThemeFromPrefs(equipo?.id_equipo);
  }, [equipo?.id_equipo]);

  const logout = useCallback(() => {
    localStorage.removeItem('data_token');
    localStorage.removeItem('data_equipo');
    localStorage.removeItem('data_miembro');
    setToken(null);
    setEquipo(null);
    setMiembro(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const applySesion = useCallback((sesion) => {
    if (sesion?.equipo) {
      setEquipo(sesion.equipo);
      localStorage.setItem('data_equipo', JSON.stringify(sesion.equipo));
    }
    if (sesion?.miembro) {
      setMiembro(sesion.miembro);
      localStorage.setItem('data_miembro', JSON.stringify(sesion.miembro));
    } else {
      setMiembro(null);
      localStorage.removeItem('data_miembro');
    }
    return sesion;
  }, []);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    const ac = new AbortController();
    api
      .sesion({ signal: ac.signal })
      .then((sesion) => {
        applySesion(sesion);
      })
      .catch((err) => {
        if (isAbortError(err) || ac.signal.aborted) return;
        localStorage.removeItem('data_token');
        localStorage.removeItem('data_equipo');
        localStorage.removeItem('data_miembro');
        setToken(null);
        setEquipo(null);
        setMiembro(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setBooting(false);
      });
    return () => ac.abort();
  }, [token, applySesion]);

  const applyAuth = useCallback((res) => {
    localStorage.setItem('data_token', res.token);
    localStorage.setItem('data_equipo', JSON.stringify(res.equipo));
    if (res.miembro) {
      localStorage.setItem('data_miembro', JSON.stringify(res.miembro));
      setMiembro(res.miembro);
    } else {
      localStorage.removeItem('data_miembro');
      setMiembro(null);
    }
    setToken(res.token);
    setEquipo(res.equipo);
    return res;
  }, []);

  const login = useCallback(
    async (correo, password) => {
      const res = await api.login({ correo, password });
      return applyAuth(res);
    },
    [applyAuth],
  );

  const loginWithAuthOut = useCallback(
    async (res) => applyAuth(res),
    [applyAuth],
  );

  const registro = useCallback(
    async (payload) => {
      const res = await api.registro(payload);
      return applyAuth(res);
    },
    [applyAuth],
  );

  const refreshEquipo = useCallback(async () => {
    const eq = await api.me();
    setEquipo(eq);
    localStorage.setItem('data_equipo', JSON.stringify(eq));
    return eq;
  }, []);

  const refreshSesion = useCallback(async () => {
    const sesion = await api.sesion();
    return applySesion(sesion);
  }, [applySesion]);

  const miembroRef = useRef(miembro);
  miembroRef.current = miembro;

  useClubRealtime({
    enabled: !!token,
    token,
    onEvent: (ev) => {
      if (ev?.type === 'sesion.revocada') {
        const mid = ev.id_miembro || null;
        const mine = miembroRef.current?.id_miembro || null;
        if (String(mid || '') === String(mine || '')) {
          sessionStorage.setItem(
            'siete_login_notice',
            'Se cambió la contraseña. Entra de nuevo.',
          );
          logout();
        }
        return;
      }
      if (ev?.refresh_sesion || ev?.type === 'miembros.changed') {
        refreshSesion().catch(() => {});
      }
    },
  });

  // Por si el WS está dormido (Render free): al volver a la pestaña, refresca sesión
  useEffect(() => {
    if (!token) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refreshSesion().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [token, refreshSesion]);

  const canManageClub = !miembro || miembro.permiso === 'administrador';

  const rolePerms = useMemo(
    () =>
      permsFromSession({
        cargo: miembro?.cargo,
        isAdmin: canManageClub,
      }),
    [miembro?.cargo, canManageClub],
  );

  const value = useMemo(
    () => ({
      equipo,
      miembro,
      token,
      booting,
      login,
      loginWithAuthOut,
      registro,
      logout,
      refreshEquipo,
      refreshSesion,
      isAuth: !!token,
      permiso: canManageClub ? 'administrador' : 'miembro',
      canManageClub,
      ...rolePerms,
    }),
    [
      equipo,
      miembro,
      token,
      booting,
      login,
      loginWithAuthOut,
      registro,
      logout,
      refreshEquipo,
      refreshSesion,
      canManageClub,
      rolePerms,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
