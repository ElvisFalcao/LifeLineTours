import { api } from '../api.js';
import { navigate } from '../store.js';
import { h, clear, icon, fmtTime, fmtLongDate, calColor, modal, bookingBadge } from '../ui.js';
import { openBookingDetail, openBookingForm } from './bookings.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export async function renderCalendar(container) {
  const today = new Date();
  let view = { year: today.getFullYear(), month: today.getMonth() };

  const head = h(
    'div',
    { class: 'page-head' },
    h('div', { class: 'titles' }, h('h2', {}, 'Calendar'), h('p', {}, 'All trips at a glance')),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn gold', onClick: () => navigate('/bookings/new') }, icon('plus', 16), 'New Booking')
  );

  const title = h('h3', { style: { fontSize: '18px', minWidth: '180px' } });
  const grid = h('div', { class: 'cal-grid' });
  const nav = h(
    'div',
    { class: 'cal-head' },
    h('button', { class: 'btn sm', onClick: () => shift(-1) }, icon('chevronLeft', 16)),
    h('button', { class: 'btn sm', onClick: () => shift(1) }, icon('chevronRight', 16)),
    h('button', { class: 'btn sm', onClick: goToday }, 'Today'),
    title
  );

  const card = h('div', { class: 'card' }, h('div', { class: 'card-body' }, nav, grid));
  container.append(head, card);

  function shift(delta) {
    view.month += delta;
    if (view.month < 0) { view.month = 11; view.year--; }
    if (view.month > 11) { view.month = 0; view.year++; }
    load();
  }
  function goToday() {
    view = { year: today.getFullYear(), month: today.getMonth() };
    load();
  }

  async function load() {
    title.textContent = `${MONTHS[view.month]} ${view.year}`;
    const first = new Date(view.year, view.month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-start
    const gridStart = new Date(view.year, view.month, 1 - startOffset);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    const from = iso(cells[0]);
    const to = iso(cells[41]);
    const rows = await api.get(`/bookings?scope=calendar&from=${from}&to=${to}`);
    const byDate = {};
    for (const b of rows) (byDate[b.travel_date] ||= []).push(b);

    clear(grid);
    for (const dow of DOW) grid.append(h('div', { class: 'cal-dow' }, dow));

    for (const d of cells) {
      const key = iso(d);
      const inMonth = d.getMonth() === view.month;
      const isToday = key === iso(today);
      const events = (byDate[key] || []).sort((a, b) => (a.pickup_time || '').localeCompare(b.pickup_time || ''));
      const cell = h(
        'div',
        { class: `cal-cell ${inMonth ? '' : 'dim'} ${isToday ? 'today' : ''}` },
        h('div', { class: 'daynum' }, String(d.getDate()))
      );
      cell.addEventListener('dblclick', () => openBookingForm({ travel_date: key }, { onSaved: load }));

      events.slice(0, 3).forEach((b) => {
        const color = calColor(b.booking_status);
        cell.append(
          h(
            'div',
            {
              class: 'cal-ev',
              style: { background: color + '1a', color, borderLeftColor: color },
              title: `${fmtTime(b.pickup_time)} ${b.customer_name} · ${b.vehicle_name} · ${b.trip_type || ''}`,
              onClick: (e) => { e.stopPropagation(); openBookingDetail(b.id, load); },
            },
            h('span', { class: 't' }, fmtTime(b.pickup_time) + ' '),
            b.customer_name
          )
        );
      });
      if (events.length > 3) {
        cell.append(h('div', { class: 'cal-more', onClick: (e) => { e.stopPropagation(); openDay(key, events); } }, `+${events.length - 3} more`));
      }
      grid.append(cell);
    }
  }

  function openDay(key, events) {
    modal({
      title: fmtLongDate(key),
      sub: `${events.length} trip(s)`,
      body: h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        ...events.map((b) =>
          h(
            'div',
            {
              class: 'card',
              style: { padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' },
              onClick: () => openBookingDetail(b.id, load),
            },
            h('div', { class: 'mono cell-strong', style: { minWidth: '54px' } }, fmtTime(b.pickup_time)),
            h('div', { style: { flex: '1' } }, h('div', { class: 'cell-strong' }, b.customer_name), h('div', { class: 'cell-sub' }, `${b.vehicle_name} · ${b.trip_type || ''}`)),
            bookingBadge(b.booking_status)
          )
        )
      ),
    });
  }

  await load();
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
