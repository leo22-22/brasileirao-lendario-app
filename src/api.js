// Cliente da API de conta (signup/login/perfil). Fala com o backend Express
// em server/ via proxy do Vite (/api/* -> http://localhost:4000 em dev).

const TOKEN_KEY = 'brl_auth_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const error = new Error(data?.error || `Erro ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export function signup(username, email, password) {
  return request('/auth/signup', { method: 'POST', body: { username, email, password } });
}

export function login(email, password) {
  return request('/auth/login', { method: 'POST', body: { email, password } });
}

export function fetchMe() {
  return request('/me', { auth: true });
}

export function updateMe(fields) {
  return request('/me', { method: 'PUT', body: fields, auth: true });
}

export function deleteMe() {
  return request('/me', { method: 'DELETE', auth: true });
}
