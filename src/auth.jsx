import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, isAbortError, setUnauthorizedHandler } from './api';
import { syncThemeFromPrefs } from './theme';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [equipo, setEquipo] = useState(() => {
    const raw = localStorage.getItem('data_equipo');
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
    setToken(null);
    setEquipo(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    const ac = new AbortController();
    api
      .me({ signal: ac.signal })
      .then((eq) => {
        setEquipo(eq);
        localStorage.setItem('data_equipo', JSON.stringify(eq));
      })
      .catch((err) => {
        if (isAbortError(err) || ac.signal.aborted) return;
        localStorage.removeItem('data_token');
        localStorage.removeItem('data_equipo');
        setToken(null);
        setEquipo(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setBooting(false);
      });
    return () => ac.abort();
  }, [token]);

  const login = useCallback(async (correo, password) => {
    const res = await api.login({ correo, password });
    localStorage.setItem('data_token', res.token);
    localStorage.setItem('data_equipo', JSON.stringify(res.equipo));
    setToken(res.token);
    setEquipo(res.equipo);
    return res;
  }, []);

  const registro = useCallback(async (payload) => {
    const res = await api.registro(payload);
    localStorage.setItem('data_token', res.token);
    localStorage.setItem('data_equipo', JSON.stringify(res.equipo));
    setToken(res.token);
    setEquipo(res.equipo);
    return res;
  }, []);

  const refreshEquipo = useCallback(async () => {
    const eq = await api.me();
    setEquipo(eq);
    localStorage.setItem('data_equipo', JSON.stringify(eq));
    return eq;
  }, []);

  const value = useMemo(
    () => ({
      equipo,
      token,
      booting,
      login,
      registro,
      logout,
      refreshEquipo,
      isAuth: !!token,
    }),
    [equipo, token, booting, login, registro, logout, refreshEquipo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
