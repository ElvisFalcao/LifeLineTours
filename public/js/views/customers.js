import { api } from '../api.js';
import { h, clear, icon, money2, fmtDate, initials, toast, modal, field, input, textarea, bookingBadge } from '../ui.js';

let listEl = null;

export async function renderCustomers(container) {
  const head = h(
    'div',
    { class: 'page-head' },
    h('div', { class: 'titles' }, h('h2', {}, 'Customers'), h('p', {}, 'Client database & trip history')),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn gold', onClick: () => openForm() }, icon('plus', 16), 'Add Customer')
  );
  const search = input({ placeholder: 'Search customers…', oninput: debounce(load, 250) });
  const toolbar = h('div', { class: 'toolbar' }, h('div', { class: 'search' }, h('span', { class: 'si' }, icon('search', 16)), search));
  listEl = h('div', { class: 'card' });
  container.append(head, toolbar, listEl);

  async function load() {
    clear(listEl).append(h('div', { class: 'empty' }, 'Loading…'));
    const rows = await api.get('/customers' + (search.value.trim() ? `?search=${encodeURIComponent(search.value.trim())}` : ''));
    clear(listEl);
    if (!rows.length) {
      listEl.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '👥'), h('p', {}, 'No customers yet.')));
      return;
    }
    const table = h(
      'table',
      { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Customer'), h('th', {}, 'Contact'), h('th', { style: { textAlign: 'center' } }, 'Trips'), h('th', { style: { textAlign: 'right' } }, 'Total Spent'), h('th', {}, 'Last Booking'))),
      h(
        'tbody',
        {},
        ...rows.map((c) =>
          h(
            'tr',
            { class: 'clickable', onClick: () => openDetail(c.id) },
            h('td', {}, h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('div', { class: 'av', style: { width: '32px', height: '32px', borderRadius: '50%', background: '#0e1726', color: '#e7d3a1', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: '700' } }, initials(c.full_name)), h('span', { class: 'cell-strong' }, c.full_name))),
            h('td', {}, h('div', {}, c.phone || '—'), h('div', { class: 'cell-sub' }, c.email || '')),
            h('td', { style: { textAlign: 'center' }, class: 'mono' }, String(c.trips)),
            h('td', { style: { textAlign: 'right' }, class: 'mono cell-strong' }, money2(c.total_spent)),
            h('td', {}, c.last_booking ? fmtDate(c.last_booking) : h('span', { class: 'text-muted' }, 'Never'))
          )
        )
      )
    );
    listEl.append(h('div', { class: 'table-wrap' }, table));
  }
  reload = load;
  await load();
}

let reload = () => {};

async function openDetail(id) {
  const c = await api.get(`/customers/${id}`);
  const body = h(
    'div',
    {},
    h(
      'div',
      { style: { display: 'flex', gap: '14px', marginBottom: '6px' } },
      h('div', { class: 'stat', style: { flex: '1', boxShadow: 'none' } }, h('div', { class: 'lbl' }, 'Total Trips'), h('div', { class: 'val' }, String(c.trip_count))),
      h('div', { class: 'stat', style: { flex: '1', boxShadow: 'none' } }, h('div', { class: 'lbl' }, 'Total Spent'), h('div', { class: 'val' }, money2(c.total_spent)))
    ),
    h('div', { class: 'section-title' }, 'Contact'),
    h('dl', { class: 'kv' },
      h('dt', {}, 'Phone'), h('dd', {}, c.phone || '—'),
      h('dt', {}, 'WhatsApp'), h('dd', {}, c.whatsapp || '—'),
      h('dt', {}, 'Email'), h('dd', {}, c.email || '—'),
      c.notes ? h('dt', {}, 'Notes') : null, c.notes ? h('dd', {}, c.notes) : null
    ),
    h('div', { class: 'section-title' }, 'Trip History'),
    c.trips.length
      ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Ref'), h('th', {}, 'Date'), h('th', {}, 'Vehicle'), h('th', {}, 'Trip'), h('th', {}, 'Status'), h('th', { style: { textAlign: 'right' } }, 'Paid'))),
          h('tbody', {}, ...c.trips.map((t) => h('tr', {},
            h('td', { class: 'mono cell-sub' }, t.reference),
            h('td', {}, fmtDate(t.travel_date)),
            h('td', {}, t.vehicle_name),
            h('td', {}, h('span', { class: 'chip' }, t.trip_type || '—')),
            h('td', {}, bookingBadge(t.booking_status)),
            h('td', { style: { textAlign: 'right' }, class: 'mono' }, money2(t.amount_paid))
          )))
        ))
      : h('p', { class: 'text-muted' }, 'No trips recorded yet.')
  );
  const m = modal({
    title: c.full_name,
    sub: 'Customer profile',
    body,
    wide: true,
    footer: [h('button', { class: 'btn', onClick: () => { m.close(); openForm(c); } }, icon('edit', 15), 'Edit')],
  });
}

function openForm(existing) {
  const c = existing || {};
  const name = input({ value: c.full_name || '' });
  const phone = input({ value: c.phone || '' });
  const whatsapp = input({ value: c.whatsapp || '' });
  const email = input({ value: c.email || '' });
  const notes = textarea({ value: c.notes || '' });
  const m = modal({
    title: existing ? 'Edit Customer' : 'Add Customer',
    body: h('div', {},
      h('div', { class: 'form-grid' },
        field('Full name', name, { required: true, full: true }),
        field('Phone', phone),
        field('WhatsApp', whatsapp),
        field('Email', email, { full: true })
      ),
      field('Notes', notes, { full: true })
    ),
    footer: [
      h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onClick: save }, 'Save'),
    ],
  });
  async function save() {
    if (!name.value.trim()) return toast('Name is required', 'error');
    const payload = { full_name: name.value.trim(), phone: phone.value.trim(), whatsapp: whatsapp.value.trim(), email: email.value.trim(), notes: notes.value.trim() };
    try {
      if (existing) await api.put(`/customers/${existing.id}`, payload);
      else await api.post('/customers', payload);
      toast('Customer saved', 'success');
      m.close();
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
