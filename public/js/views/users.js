import { api } from '../api.js';
import { store } from '../store.js';
import { h, clear, icon, fmtDate, toast, modal, field, input, select, badge } from '../ui.js';

let listEl = null;
const ROLE_COLORS = { admin: 'purple', staff: 'blue', driver: 'teal' };
const ROLE_DESC = {
  admin: 'Full access — bookings, fleet, reports, users',
  staff: 'Create & edit bookings, customers, calendar',
  driver: 'View assigned trips & pickup details',
};

export async function renderUsers(container) {
  const head = h(
    'div',
    { class: 'page-head' },
    h('div', { class: 'titles' }, h('h2', {}, 'Users & Roles'), h('p', {}, 'Manage staff, drivers and access')),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn gold', onClick: () => openForm() }, icon('plus', 16), 'Add User')
  );

  // Role legend
  const legend = h('div', { class: 'stat-grid' },
    ...['admin', 'staff', 'driver'].map((r) =>
      h('div', { class: 'stat' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } }, badge(r.charAt(0).toUpperCase() + r.slice(1), ROLE_COLORS[r])),
        h('div', { class: 'sub', style: { fontSize: '12.5px' } }, ROLE_DESC[r])
      )
    )
  );

  listEl = h('div', { class: 'card' });
  container.append(head, legend, listEl);
  reload = load;
  await load();
}

let reload = () => {};

async function load() {
  clear(listEl).append(h('div', { class: 'empty' }, 'Loading…'));
  const users = await api.get('/users');
  clear(listEl);
  const table = h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Email'), h('th', {}, 'Role'), h('th', {}, 'Phone'), h('th', {}, 'Status'), h('th', { style: { textAlign: 'right' } }, 'Actions'))),
    h('tbody', {}, ...users.map((u) => h('tr', {},
      h('td', { class: 'cell-strong' }, u.name, u.id === store.user.id ? h('span', { class: 'chip', style: { marginLeft: '8px' } }, 'You') : null),
      h('td', { class: 'cell-sub' }, u.email),
      h('td', {}, badge(u.role.charAt(0).toUpperCase() + u.role.slice(1), ROLE_COLORS[u.role])),
      h('td', {}, u.phone || '—'),
      h('td', {}, u.active ? badge('Active', 'green') : badge('Disabled', 'gray')),
      h('td', { style: { textAlign: 'right' } }, h('button', { class: 'btn sm', onClick: () => openForm(u) }, icon('edit', 14), 'Edit'))
    )))
  );
  listEl.append(h('div', { class: 'table-wrap' }, table));
}

function openForm(existing) {
  const u = existing || {};
  const name = input({ value: u.name || '' });
  const email = input({ type: 'email', value: u.email || '', disabled: !!existing });
  const roleSel = select(store.meta.roles.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) })), { value: u.role || 'staff' });
  const phone = input({ value: u.phone || '' });
  const password = input({ type: 'password', placeholder: existing ? 'Leave blank to keep current' : 'Set a password' });
  const activeSel = existing ? select([{ value: '1', label: 'Active' }, { value: '0', label: 'Disabled' }], { value: u.active ? '1' : '0' }) : null;

  const m = modal({
    title: existing ? `Edit ${u.name}` : 'Add User',
    body: h('div', {},
      h('div', { class: 'form-grid' },
        field('Full name', name, { required: true }),
        field('Email', email, { required: true, hint: existing ? 'Email cannot be changed' : '' }),
        field('Role', roleSel),
        field('Phone', phone),
        field(existing ? 'Reset password' : 'Password', password, { required: !existing }),
        existing ? field('Account status', activeSel) : null
      )
    ),
    footer: [
      h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onClick: save }, 'Save'),
    ],
  });

  async function save() {
    if (!name.value.trim()) return toast('Name is required', 'error');
    try {
      if (existing) {
        const payload = { name: name.value.trim(), role: roleSel.value, phone: phone.value.trim(), active: activeSel.value === '1' };
        if (password.value) payload.password = password.value;
        await api.put(`/users/${existing.id}`, payload);
      } else {
        if (!email.value.trim() || !password.value) return toast('Email and password are required', 'error');
        await api.post('/users', { name: name.value.trim(), email: email.value.trim(), role: roleSel.value, phone: phone.value.trim(), password: password.value });
      }
      toast('User saved', 'success');
      m.close();
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }
}
