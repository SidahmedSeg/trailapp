import { getAccessToken, refreshAccessToken, clearTokens } from './auth.js';

const BASE = '/api';

async function api(path, options = {}) {
  const { body, ...rest } = options;

  const headers = { ...rest.headers };

  const token = getAccessToken();
  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // On 401, attempt a silent token refresh and retry once
  if (res.status === 401) {
    try {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${BASE}${path}`, {
          ...rest,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      }
    } catch {
      clearTokens();
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const message = errorBody?.message || errorBody?.error || `Erreur ${res.status}`;
    throw new Error(message);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return null;
  }

  return res.json();
}

export function get(path) {
  return api(path, { method: 'GET' });
}

export function post(path, body) {
  return api(path, { method: 'POST', body });
}

export function put(path, body) {
  return api(path, { method: 'PUT', body });
}

export function del(path) {
  return api(path, { method: 'DELETE' });
}

export default api;
