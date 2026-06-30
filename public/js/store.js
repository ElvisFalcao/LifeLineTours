// Tiny shared state + navigation helpers used across views.
export const store = {
  user: null, // current authenticated user
  meta: null, // enums, pricing, business info from /api/meta
};

export function navigate(path) {
  if (!path.startsWith('#')) path = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash === path) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = path;
  }
}

export function can(...roles) {
  return store.user && roles.includes(store.user.role);
}
