// Shared UI utilities: hyperscript, icons, formatters, badges, toast, modal.

// ---- hyperscript ----
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(4)) {
    if (c == null || c === false || c === true) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}
export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

// ---- icons (feather-style, 24x24 stroke) ----
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  bookings: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  customers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  vehicles: '<path d="M5 17H3V7a1 1 0 0 1 1-1h11v11h-2"/><path d="M15 9h4l3 3v5h-3"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>',
  reports: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-2-2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  money: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
};
export function icon(name, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('ic');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

// ---- formatters ----
export function money(n, withSymbol = true) {
  const v = Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return withSymbol ? `R ${v}` : v;
}
export function money2(n) {
  return `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtDateShort(d) {
  if (!d) return '—';
  const date = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}
export function fmtLongDate(d) {
  if (!d) return '—';
  const date = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function fmtTime(t) {
  return t ? t.slice(0, 5) : '—';
}
export function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ---- badges ----
const BOOKING_COLORS = {
  'New Request': 'gray',
  Confirmed: 'blue',
  'Deposit Received': 'teal',
  'Driver Assigned': 'purple',
  'Picked Up': 'amber',
  'Trip In Progress': 'amber',
  Completed: 'green',
  Cancelled: 'red',
};
const PAYMENT_COLORS = {
  'Deposit Pending': 'gray',
  'Deposit Paid': 'blue',
  'Fully Paid': 'green',
  Outstanding: 'red',
};
const VEHICLE_COLORS = { Available: 'green', Busy: 'amber', Booked: 'amber', Maintenance: 'red' };

export function badge(text, color = 'gray') {
  return h('span', { class: `badge ${color}` }, h('span', { class: 'dot' }), text);
}
export const bookingBadge = (s) => badge(s, BOOKING_COLORS[s] || 'gray');
export const paymentBadge = (s) => badge(s, PAYMENT_COLORS[s] || 'gray');
export const vehicleBadge = (s) => badge(s, VEHICLE_COLORS[s] || 'gray');
export const calColor = (s) => {
  const map = { gray: '#7a8499', blue: '#2257c5', teal: '#137c72', purple: '#6b3fc0', amber: '#9a6608', green: '#15824c', red: '#b53434' };
  return map[BOOKING_COLORS[s] || 'gray'];
};

// ---- toast ----
export function toast(message, type = 'info', ms = 3200) {
  const root = document.getElementById('toast-root');
  const el = h('div', { class: `toast ${type}` }, icon(type === 'error' ? 'x' : type === 'success' ? 'check' : 'clock', 16), message);
  root.append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, ms);
}

// ---- modal ----
export function modal({ title, sub, body, footer, wide, onClose }) {
  const root = document.getElementById('modal-root');
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  const m = h(
    'div',
    { class: `modal ${wide ? 'wide' : ''}` },
    h(
      'div',
      { class: 'm-head' },
      h('div', {}, h('h3', {}, title), sub ? h('div', { class: 'sub' }, sub) : null),
      h('button', { class: 'x', onClick: close, title: 'Close' }, '×')
    ),
    h('div', { class: 'm-body' }, body),
    footer ? h('div', { class: 'm-foot' }, footer) : null
  );
  const overlay = h('div', { class: 'modal-overlay', onClick: (e) => { if (e.target === overlay) close(); } }, m);
  root.append(overlay);
  document.addEventListener('keydown', onKey);
  return { close, el: m };
}

export function confirmDialog({ title = 'Are you sure?', message, confirmText = 'Confirm', danger, onConfirm }) {
  const m = modal({
    title,
    body: h('p', { class: 'text-muted', style: { margin: 0, lineHeight: '1.6' } }, message),
    footer: frag(
      h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Cancel'),
      h(
        'button',
        {
          class: `btn ${danger ? 'danger' : 'primary'}`,
          onClick: async () => {
            await onConfirm();
            m.close();
          },
        },
        confirmText
      )
    ),
  });
  return m;
}

// Build a labelled form field.
export function field(label, control, { required, hint, full } = {}) {
  return h(
    'div',
    { class: `field ${full ? 'full' : ''}` },
    h('label', {}, label, required ? h('span', { class: 'req' }, ' *') : null),
    control,
    hint ? h('div', { class: 'hint' }, hint) : null
  );
}
export function input(props = {}) {
  return h('input', { class: 'input', ...props });
}
export function select(options, props = {}) {
  const el = h('select', { class: 'select', ...props });
  for (const o of options) {
    const value = typeof o === 'object' ? o.value : o;
    const label = typeof o === 'object' ? o.label : o;
    const opt = h('option', { value }, label);
    if (String(value) === String(props.value)) opt.selected = true;
    el.append(opt);
  }
  return el;
}
export function textarea(props = {}) {
  return h('textarea', { class: 'input', ...props });
}
