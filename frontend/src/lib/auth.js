const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access, refresh) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Calls POST /api/admin/refresh with the stored refresh token.
 * On success, stores the new tokens and returns the new access token.
 */
export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('Aucun token de rafraîchissement disponible.');
  }

  const res = await fetch('/api/admin/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error('Impossible de rafraîchir la session.');
  }

  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

/**
 * Decodes the JWT payload (without cryptographic verification) to extract
 * user information such as role and username.
 * Returns null if no valid token is stored.
 */
export function getUserFromToken() {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;

    // Handle base64url encoding: replace URL-safe chars and pad
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(json);
    return {
      username: payload.username || payload.sub || null,
      role: payload.role || null,
      exp: payload.exp || null,
    };
  } catch {
    return null;
  }
}
