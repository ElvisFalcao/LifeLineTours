import { api, session } from './api.js';
import { h, clear, icon, initials, toast } from './ui.js';
import { store, navigate } from './store.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderBookings } from './views/bookings.js';
import { renderCalendar } from './views/calendar.js';
import { renderCustomers } from './views/customers.js';
import { renderVehicles } from './views/vehicles.js';
import { renderReports } from './views/reports.js';
import { renderUsers } from './views/users.js';

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'staff', 'driver'], render: renderDashboard, group: 'Overview' },
  { key: 'bookings', label: 'Bookings', icon: 'bookings', roles: ['admin', 'staff', 'driver'], render: renderBookings, group: 'Operations', driverLabel: 'My Trips' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', roles: ['admin', 'staff'], render: renderCalendar, group: 'Operations' },
  { key: 'customers', label: 'Customers', icon: 'customers', roles: ['admin', 'staff'], render: renderCustomers, group: 'Operations' },
  { key: 'vehicles', label: 'Fleet', icon: 'vehicles', roles: ['admin', 'staff', 'driver'], render: renderVehicles, group: 'Operations' },
  { key: 'reports', label: 'Reports', icon: 'reports', roles: ['admin', 'staff'], render: renderReports, group: 'Insights' },
  { key: 'users', label: 'Users & Roles', icon: 'users', roles: ['admin'], render: renderUsers, group: 'Admin' },
];

const root = document.getElementById('app');

async function boot() {
  if (session.token) {
    try {
      const me = await api.get('/auth/me');
      store.user = me.user;
      store.meta = await api.get('/meta');
      renderShell();
      route();
      return;
    } catch {
      session.clear();
    }
  }
  showLogin();
}

function showLogin() {
  clear(root);
  renderLogin(root, async () => {
    store.meta = await api.get('/meta');
    renderShell();
    if (!location.hash || location.hash === '#/') navigate('/dashboard');
    else route();
  });
}

window.addEventListener('auth:expired', () => {
  toast('Session expired — please sign in again.', 'warn');
  showLogin();
});
window.addEventListener('hashchange', route);

function allowedSections() {
  return SECTIONS.filter((s) => s.roles.includes(store.user.role));
}

function renderShell() {
  clear(root);
  const allowed = allowedSections();
  const groups = [...new Set(allowed.map((s) => s.group))];

  const navEl = h('nav', { class: 'nav' });
  for (const g of groups) {
    navEl.append(h('div', { class: 'group-label' }, g));
    for (const s of allowed.filter((x) => x.group === g)) {
      const label = store.user.role === 'driver' && s.driverLabel ? s.driverLabel : s.label;
      navEl.append(
        h('a', { href: `#/${s.key}`, 'data-key': s.key, onClick: closeMobileNav }, icon(s.icon), label)
      );
    }
  }

  const sidebar = h(
    'aside',
    { class: 'sidebar', id: 'sidebar' },
    h(
      'div',
      { class: 'brand' },
      h('div', { class: 'logo' }, 'L'),
      h('div', {}, h('div', { class: 'name' }, 'LifeLine Tours'), h('div', { class: 'sub' }, 'Cape Town'))
    ),
    navEl,
    h('div', { class: 'foot' }, 'Lyfe Computer Technologies', h('br'), h('span', { style: { opacity: '0.7' } }, 'Booking & Fleet System'))
  );

  const topbar = h(
    'header',
    { class: 'topbar' },
    h('button', { class: 'menu-btn', onClick: toggleMobileNav }, icon('menu', 22)),
    h('h1', { id: 'page-title' }, 'Dashboard'),
    h('div', { class: 'spacer' }),
    h(
      'div',
      { class: 'userchip' },
      h('div', { class: 'av' }, initials(store.user.name)),
      h('div', { class: 'who' }, h('b', {}, store.user.name), h('br'), h('small', {}, store.user.role)),
      h('button', { class: 'btn ghost sm', title: 'Sign out', onClick: logout }, icon('logout', 16))
    )
  );

  const main = h(
    'div',
    { class: 'main' },
    topbar,
    h('div', { class: 'content', id: 'content' })
  );
  const backdrop = h('div', { class: 'backdrop', id: 'backdrop', onClick: closeMobileNav });

  root.append(h('div', { class: 'shell' }, sidebar, main), backdrop);
}

function toggleMobileNav() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('backdrop')?.classList.toggle('show');
}
function closeMobileNav() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('backdrop')?.classList.remove('show');
}

function logout() {
  session.clear();
  store.user = null;
  location.hash = '';
  showLogin();
}

function route() {
  if (!store.user) return;
  const content = document.getElementById('content');
  if (!content) {
    renderShell();
    return route();
  }
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const key = parts[0] || 'dashboard';
  const rest = parts.slice(1);

  let section = allowedSections().find((s) => s.key === key);
  if (!section) {
    navigate('/dashboard');
    return;
  }

  // active nav state
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.key === section.key));
  const title = store.user.role === 'driver' && section.driverLabel ? section.driverLabel : section.label;
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = title;
  document.getElementById('content').scrollTo?.(0, 0);
  window.scrollTo(0, 0);

  clear(content);
  Promise.resolve(section.render(content, rest)).catch((err) => {
    console.error(err);
    clear(content).append(
      h('div', { class: 'empty' }, h('div', { class: 'big' }, '⚠️'), h('p', {}, err.message || 'Failed to load this page.'))
    );
  });
}

boot();
