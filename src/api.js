const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

export function apiOrigin() {
  return API_URL.replace(/\/api\/?$/, '');
}

/** Convierte ruta relativa de BBDD en URL usable por <img>. Soporta data: legacy. */
export function mediaUrl(path) {
  if (!path) return '';
  if (
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }
  const base = apiOrigin();
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

export function isAbortError(err) {
  return (
    err?.name === 'AbortError' ||
    err?.code === 20 ||
    (typeof err?.message === 'string' && /aborted|abort/i.test(err.message))
  );
}

function authHeaders() {
  const token = localStorage.getItem('data_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const method = (rest.method || 'GET').toUpperCase();
  const headers = {
    ...authHeaders(),
    ...(extraHeaders || {}),
  };
  // No forzar Content-Type en GET/HEAD: provoca preflight CORS innecesario
  if (method !== 'GET' && method !== 'HEAD' && rest.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers,
      ...rest,
    });
  } catch (err) {
    if (isAbortError(err) || rest.signal?.aborted) {
      const abortErr = new DOMException('Aborted', 'AbortError');
      throw abortErr;
    }
    const msg = err?.message || '';
    if (/failed to fetch|networkerror|load failed|fetch/i.test(msg)) {
      throw new Error(
        `No se pudo conectar con la API (${API_URL}). ¿Está el backend en marcha?`,
      );
    }
    throw err;
  }
  if (res.status === 401) {
    // Login/registro fallidos también pueden ser 401: solo cerrar si había sesión
    if (
      localStorage.getItem('data_token') &&
      !path.startsWith('/auth/login') &&
      !path.startsWith('/auth/registro') &&
      !path.startsWith('/auth/invitacion') &&
      !path.startsWith('/auth/aceptar-invitacion')
    ) {
      unauthorizedHandler?.();
    }
    const err = await res.json().catch(() => ({ detail: 'No autorizado' }));
    const detail = err.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Sesión expirada. Vuelve a iniciar sesión.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
          : 'Error en la petición';
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

let unauthorizedHandler = null;

/** Registra el callback de AuthProvider para cerrar sesión ante 401. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = typeof fn === 'function' ? fn : null;
}

export const api = {
  login: (data, opts) => request('/auth/login', { method: 'POST', body: JSON.stringify(data), ...opts }),
  registro: (data, opts) =>
    request('/auth/registro', { method: 'POST', body: JSON.stringify(data), ...opts }),
  getInvitacion: (token, opts) => request(`/auth/invitacion/${token}`, opts),
  aceptarInvitacion: (data, opts) =>
    request('/auth/aceptar-invitacion', { method: 'POST', body: JSON.stringify(data), ...opts }),
  me: (opts) => request('/auth/me', opts),
  sesion: (opts) => request('/auth/sesion', opts),
  updateCuenta: (data, opts) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  updateDatosEquipo: (data, opts) =>
    request('/auth/me/datos', { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  updatePerfilMiembro: (data, opts) =>
    request('/auth/me/perfil', { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  changePassword: (data, opts) =>
    request('/auth/me/password', { method: 'PATCH', body: JSON.stringify(data), ...opts }),

  uploadImagen: async (file, tipo = 'jugador') => {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`${API_URL}/uploads/?tipo=${encodeURIComponent(tipo)}`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body,
    });
    if (res.status === 401) {
      if (localStorage.getItem('data_token')) unauthorizedHandler?.();
      throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = err.detail;
      throw new Error(typeof detail === 'string' ? detail : 'Error al subir imagen');
    }
    return res.json();
  },

  getDashboard: (opts) => request('/dashboard/', opts),
  getJugadorDetalle: (id, opts) => request(`/dashboard/jugador/${id}`, opts),

  getTemporadas: (opts) => request('/temporadas/', opts),
  getTemporadaActiva: (opts) => request('/temporadas/activa', opts),
  createTemporada: (data, opts) =>
    request('/temporadas/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  abrirTemporada: (data, opts) =>
    request('/temporadas/abrir', { method: 'POST', body: JSON.stringify(data), ...opts }),
  cerrarTemporada: (id, opts) =>
    request(`/temporadas/${id}/cerrar`, { method: 'POST', body: '{}', ...opts }),
  activarTemporada: (id, opts) =>
    request(`/temporadas/${id}/activar`, { method: 'POST', body: '{}', ...opts }),
  archivarTemporada: (id, opts) =>
    request(`/temporadas/${id}/archivar`, { method: 'POST', body: '{}', ...opts }),
  deleteTemporada: (id, opts) => request(`/temporadas/${id}`, { method: 'DELETE', ...opts }),

  getPosiciones: (opts) => request('/posiciones/', opts),
  getTiposAccion: (opts) => request('/tipos-accion/', opts),

  getJugadores: (opts) => request('/jugadores/', opts),
  getJugador: (id, opts) => request(`/jugadores/${id}`, opts),
  createJugador: (data, opts) =>
    request('/jugadores/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  updateJugador: (id, data, opts) =>
    request(`/jugadores/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  deleteJugador: (id, opts) => request(`/jugadores/${id}`, { method: 'DELETE', ...opts }),

  getPartidos: (opts) => request('/partidos/', opts),
  createPartido: (data, opts) =>
    request('/partidos/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  updatePartido: (id, data, opts) =>
    request(`/partidos/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  deletePartido: (id, opts) => request(`/partidos/${id}`, { method: 'DELETE', ...opts }),

  getRivales: (opts) => request('/rivales/', opts),
  createRival: (data, opts) =>
    request('/rivales/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  deleteRival: (id, opts) => request(`/rivales/${id}`, { method: 'DELETE', ...opts }),
  getRivalJugadoras: (idRival, opts) => request(`/rivales/${idRival}/jugadoras`, opts),
  upsertRivalJugadora: (idRival, data, opts) =>
    request(`/rivales/${idRival}/jugadoras`, {
      method: 'POST',
      body: JSON.stringify(data),
      ...opts,
    }),
  getRivalGoleadorasPartido: (idPartido, opts) =>
    request(`/rivales/partido/${idPartido}/goleadoras`, opts),

  getConvocatoria: (idPartido, opts) => request(`/convocatorias/partido/${idPartido}`, opts),
  saveConvocatoria: (idPartido, data, opts) =>
    request(`/convocatorias/partido/${idPartido}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...opts,
    }),

  getAlineaciones: (opts) => request('/alineaciones/', opts),
  createAlineacion: (data, opts) =>
    request('/alineaciones/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  updateAlineacion: (id, data, opts) =>
    request(`/alineaciones/${id}`, { method: 'PUT', body: JSON.stringify(data), ...opts }),
  deleteAlineacion: (id, opts) =>
    request(`/alineaciones/${id}`, { method: 'DELETE', ...opts }),

  getJugadas: (opts = {}) => {
    const { fase, ...rest } = opts;
    const path = fase ? `/jugadas/?fase=${encodeURIComponent(fase)}` : '/jugadas/';
    return request(path, rest);
  },
  getJugada: (id, opts) => request(`/jugadas/${id}`, opts),
  createJugada: (data, opts) =>
    request('/jugadas/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  updateJugada: (id, data, opts) =>
    request(`/jugadas/${id}`, { method: 'PUT', body: JSON.stringify(data), ...opts }),
  copyJugada: (id, data, opts) =>
    request(`/jugadas/${id}/copiar`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
      ...opts,
    }),
  deleteJugada: (id, opts) => request(`/jugadas/${id}`, { method: 'DELETE', ...opts }),

  getEstadisticas: (opts) => request('/estadisticas/jugadores/', opts),
  getEstadisticasPorteros: (opts) => request('/estadisticas/porteros/', opts),
  getResumenJugadores: (opts) => request('/estadisticas/resumen/jugadores', opts),
  createEstadistica: (data, opts) =>
    request('/estadisticas/jugadores/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  upsertEstadistica: (data, opts) =>
    request('/estadisticas/jugadores/', { method: 'PUT', body: JSON.stringify(data), ...opts }),
  upsertEstadisticaPortero: (data, opts) =>
    request('/estadisticas/porteros/', { method: 'PUT', body: JSON.stringify(data), ...opts }),
  createAccion: (data, opts) =>
    request('/estadisticas/acciones/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  getAcciones: (opts) => request('/estadisticas/acciones/', opts),

  getEquipos: (opts) => request('/equipos/me', opts),
  createEquipo: () => Promise.reject(new Error('Usa registro para crear un club')),
  deleteEquipo: () => Promise.reject(new Error('No disponible')),

  getMiembros: (opts) => request('/miembros/', opts),
  createMiembro: (data, opts) =>
    request('/miembros/', { method: 'POST', body: JSON.stringify(data), ...opts }),
  reinvitarMiembro: (id, opts) =>
    request(`/miembros/${id}/reinvitar`, { method: 'POST', body: '{}', ...opts }),
  hacerAdministrador: (id, opts) =>
    request(`/miembros/${id}/hacer-administrador`, { method: 'POST', body: '{}', ...opts }),
  updateMiembro: (id, data, opts) =>
    request(`/miembros/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  deleteMiembro: (id, opts) => request(`/miembros/${id}`, { method: 'DELETE', ...opts }),

  getCuotas: (opts = {}) => {
    const { id_temporada, ...rest } = opts;
    const path = id_temporada
      ? `/cuotas/?id_temporada=${encodeURIComponent(id_temporada)}`
      : '/cuotas/';
    return request(path, rest);
  },
  updateCuotasConfig: (data, opts = {}) => {
    const { id_temporada, ...rest } = opts;
    const q = id_temporada ? `?id_temporada=${encodeURIComponent(id_temporada)}` : '';
    return request(`/cuotas/config${q}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...rest,
    });
  },
  patchCuotaMensual: (data, opts = {}) => {
    const { id_temporada, ...rest } = opts;
    const q = id_temporada ? `?id_temporada=${encodeURIComponent(id_temporada)}` : '';
    return request(`/cuotas/mensual${q}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...rest,
    });
  },
  patchFederacion: (data, opts = {}) => {
    const { id_temporada, ...rest } = opts;
    const q = id_temporada ? `?id_temporada=${encodeURIComponent(id_temporada)}` : '';
    return request(`/cuotas/federacion${q}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...rest,
    });
  },
  bulkCuotas: (data, opts = {}) => {
    const { id_temporada, ...rest } = opts;
    const q = id_temporada ? `?id_temporada=${encodeURIComponent(id_temporada)}` : '';
    return request(`/cuotas/bulk${q}`, {
      method: 'POST',
      body: JSON.stringify(data),
      ...rest,
    });
  },
  getFederacionEstados: (opts = {}) => {
    const { id_temporada, ...rest } = opts;
    const q = id_temporada ? `?id_temporada=${encodeURIComponent(id_temporada)}` : '';
    return request(`/cuotas/federacion/estado${q}`, rest);
  },
};
