const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(extraHeaders || {}),
      },
      ...rest,
    });
  } catch (err) {
    if (isAbortError(err) || rest.signal?.aborted) {
      const abortErr = new DOMException('Aborted', 'AbortError');
      throw abortErr;
    }
    throw err;
  }
  if (res.status === 401) {
    // Login/registro fallidos también pueden ser 401: solo cerrar si había sesión
    if (localStorage.getItem('data_token') && !path.startsWith('/auth/login') && !path.startsWith('/auth/registro')) {
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
  me: (opts) => request('/auth/me', opts),
  updateCuenta: (data, opts) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  updateDatosEquipo: (data, opts) =>
    request('/auth/me/datos', { method: 'PATCH', body: JSON.stringify(data), ...opts }),

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

  getConvocatoria: (idPartido, opts) => request(`/convocatorias/partido/${idPartido}`, opts),
  saveConvocatoria: (idPartido, data, opts) =>
    request(`/convocatorias/partido/${idPartido}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...opts,
    }),

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
  updateMiembro: (id, data, opts) =>
    request(`/miembros/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  deleteMiembro: (id, opts) => request(`/miembros/${id}`, { method: 'DELETE', ...opts }),
};
