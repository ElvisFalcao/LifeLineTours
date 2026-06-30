import { api } from '../api.js';
import { can } from '../store.js';
import { h, clear, icon, fmtDate, fmtTime, toast, modal, field, input, select, textarea, vehicleBadge, bookingBadge } from '../ui.js';

let grid = null;

export async function renderVehicles(container) {
  const head = h(
    'div',
    { class: 'page-head' },
    h('div', { class: 'titles' }, h('h2', {}, 'Fleet'), h('p', {}, 'Vehicles, availability & status')),
    h('div', { class: 'spacer' }),
    can('admin') ? h('button', { class: 'btn gold', onClick: () => openForm() }, icon('plus', 16), 'Add Vehicle') : null
  );
  grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' } });
  container.append(head, grid);
  reload = load;
  await load();
}

let reload = () => {};

async function load() {
  clear(grid).append(h('div', { class: 'empty' }, 'Loading…'));
  const vehicles = await api.get('/vehicles');
  clear(grid);
  for (const v of vehicles) grid.append(vehicleCard(v));
}

function vehicleCard(v) {
  const services = (v.services || '').split(',').map((s) => s.trim()).filter(Boolean);
  const statusToggle = can('admin', 'staff')
    ? h('select', { class: 'select', style: { maxWidth: '160px' }, onchange: (e) => setStatus(v.id, e.target.value) },
        ...['Available', 'Maintenance'].map((s) => { const o = h('option', { value: s }, s); if (v.status === s) o.selected = true; return o; }))
    : null;

  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'card-body' },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'flex-start', gap: '14px' } },
        h('div', { style: { width: '54px', height: '54px', borderRadius: '13px', background: 'linear-gradient(135deg,#0e1726,#22304f)', color: '#e7d3a1', display: 'grid', placeItems: 'center', flex: 'none' } }, icon('vehicles', 26)),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('h3', { style: { fontSize: '17px' } }, v.name),
          h('div', { class: 'cell-sub' }, v.category || '')
        ),
        vehicleBadge(v.liveStatus || v.status)
      ),
      h('div', { class: 'divider' }),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '12px' } },
        h('span', { class: 'text-muted' }, 'Capacity'),
        h('span', { class: 'cell-strong' }, `${v.capacity || '—'} seats`)
      ),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '12px' } },
        h('span', { class: 'text-muted' }, 'Trips today'),
        h('span', { class: 'cell-strong mono' }, String(v.todayCount ?? 0))
      ),
      services.length ? h('div', { class: 'chips', style: { marginBottom: '14px' } }, ...services.map((s) => h('span', { class: 'chip' }, s))) : null,
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn sm', onClick: () => openSchedule(v) }, icon('calendar', 15), 'Schedule'),
        statusToggle,
        can('admin') ? h('button', { class: 'btn sm', onClick: () => openForm(v) }, icon('edit', 15), 'Edit') : null
      )
    )
  );
}

async function setStatus(id, status) {
  try {
    await api.patch(`/vehicles/${id}/status`, { status });
    toast(`Status set to ${status}`, 'success');
    load();
  } catch (e) {
    toast(e.message, 'error');
    load();
  }
}

async function openSchedule(v) {
  const rows = await api.get(`/vehicles/${v.id}/schedule`);
  modal({
    title: `${v.name} — Schedule`,
    sub: `${rows.length} booking(s)`,
    wide: true,
    body: rows.length
      ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Ref'), h('th', {}, 'Date'), h('th', {}, 'Time'), h('th', {}, 'Customer'), h('th', {}, 'Trip'), h('th', {}, 'Status'))),
          h('tbody', {}, ...rows.map((b) => h('tr', {},
            h('td', { class: 'mono cell-sub' }, b.reference),
            h('td', {}, fmtDate(b.travel_date)),
            h('td', { class: 'mono' }, fmtTime(b.pickup_time) + (b.end_time ? '–' + fmtTime(b.end_time) : '')),
            h('td', { class: 'cell-strong' }, b.customer_name),
            h('td', {}, h('span', { class: 'chip' }, b.trip_type || '—')),
            h('td', {}, bookingBadge(b.booking_status))
          )))
        ))
      : h('div', { class: 'empty' }, h('div', { class: 'big' }, '🗓️'), h('p', {}, 'No bookings for this vehicle yet.')),
  });
}

function openForm(existing) {
  const v = existing || {};
  const name = input({ value: v.name || '' });
  const category = input({ value: v.category || '' });
  const capacity = input({ type: 'number', min: '1', value: v.capacity || '' });
  const services = input({ value: v.services || '', placeholder: 'Comma separated, e.g. Tours, Airport Transfers' });
  const statusSel = select(['Available', 'Maintenance'], { value: v.status || 'Available' });
  const notes = textarea({ value: v.notes || '' });
  const m = modal({
    title: existing ? `Edit ${v.name}` : 'Add Vehicle',
    body: h('div', {},
      h('div', { class: 'form-grid' },
        field('Vehicle name', name, { required: true, full: true }),
        field('Category', category),
        field('Capacity (seats)', capacity),
        field('Status', statusSel),
        field('Services', services, { full: true })
      ),
      field('Notes', notes, { full: true })
    ),
    footer: [
      h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onClick: save }, 'Save'),
    ],
  });
  async function save() {
    if (!name.value.trim()) return toast('Vehicle name is required', 'error');
    const payload = { name: name.value.trim(), category: category.value.trim(), capacity: capacity.value ? Number(capacity.value) : null, services: services.value.trim(), status: statusSel.value, notes: notes.value.trim() };
    try {
      if (existing) await api.put(`/vehicles/${existing.id}`, payload);
      else await api.post('/vehicles', payload);
      toast('Vehicle saved', 'success');
      m.close();
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }
}
