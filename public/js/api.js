// Thin fetch wrapper that attaches the JWT and centralises error handling.
const TOKEN_KEY = 'llt_token';
const USER_KEY = 'llt_user';

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },
  set({ token, user }) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Demo mode (GitHub Pages): no backend — route calls to an in-browser mock.
const DEMO = typeof window !== 'undefined' && window.__LLT_DEMO__ === true;
export const IS_DEMO = DEMO;

let mockPromise = null;
function loadMock() {
  if (!mockPromise) mockPromise = import('./demo/backend.js').then((m) => { m.init(); return m; });
  return mockPromise;
}

async function request(method, path, body) {
  if (DEMO) {
    const mock = await loadMock();
    const [p, qs] = path.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    try {
      const result = mock.handle(method, p, query, body, session.user);
      return result == null ? result : JSON.parse(JSON.stringify(result));
    } catch (e) {
      if (e && e.status === 401 && session.token) {
        session.clear();
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      throw new ApiError(e.message || 'Request failed', e.status || 400, e.code);
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && session.token) {
    session.clear();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json();
  if (!res.ok) {
    throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status, data && data.code);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
  ApiError,
};

export { ApiError };
