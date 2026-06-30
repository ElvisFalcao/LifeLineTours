import { api } from '../api.js';
import { store, navigate } from '../store.js';
import { h, icon, money, fmtTime, fmtLongDate, fmtDate, bookingBadge, vehicleBadge } from '../ui.js';

export async function renderDashboard(container) {
  container.append(h('div', { class: 'empty' }, 'Loading dashboard…'));
  const d = await api.get('/dashboard');
  container.innerHTML = '';
  const isDriver = store.user.role === 'driver';

  const head = h(
    'div',
    { class: 'page-head' },
    h(
      'div',
      { class: 'titles' },
      h('h2', {}, isDriver ? 'My Day' : 'Dashboard'),
      h('p', {}, fmtLongDate(d.today))
    ),
    h('div', { class: 'spacer' }),
    !isDriver
      ? h('button', { class: 'btn gold', onClick: () => navigate('/bookings/new') }, icon('plus', 16), 'New Booking')
      : null
  );

  // Stat tiles
  const tiles = [];
  tiles.push(statTile("Today's Trips", String(d.counts.todays), 'calendar', 'navy', `${d.counts.upcoming} upcoming`));
  if (!isDriver) {
    tiles.push(statTile('Monthly Revenue', money(d.monthlyRevenue), 'money', 'green', `of ${money(d.monthExpected)} expected`));
    tiles.push(statTile('Outstanding', money(d.outstanding), 'money', 'red', 'across active bookings'));
    tiles.push(statTile('Available Fleet', `${d.available}/${d.vehicles.length}`, 'vehicles', 'gold', `${d.busy} busy · ${d.maintenance} maintenance`));
    tiles.push(statTile('New Requests', String(d.counts.newRequests), 'bookings', 'navy', 'awaiting confirmation'));
  } else {
    tiles.push(statTile('Upcoming Trips', String(d.counts.upcoming), 'clock', 'gold', 'assigned to you'));
  }
  const statGrid = h('div', { class: 'stat-grid' }, ...tiles);

  // Today's schedule
  const todayCard = card(
    "Today's Schedule",
    d.todaysBookings.length
      ? bookingTable(d.todaysBookings, true)
      : emptyBlock('🚙', 'No trips scheduled for today.'),
    d.todaysBookings.length ? `${d.todaysBookings.length} trip(s)` : null
  );

  // Fleet status (hidden detail for drivers but still useful)
  const fleetCard = card(
    'Fleet Status',
    h(
      'div',
      { class: 'card-body', style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      ...d.vehicles.map((v) =>
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          h('div', { style: { width: '40px', height: '40px', borderRadius: '10px', background: '#f1f4f9', display: 'grid', placeItems: 'center', color: '#48536a' } }, icon('vehicles', 20)),
          h('div', { style: { flex: '1' } }, h('div', { style: { fontWeight: '600', fontSize: '14px' } }, v.name), h('div', { class: 'cell-sub' }, v.category || '')),
          vehicleBadge(v.liveStatus)
        )
      )
    ),
    null,
    true
  );

  const grid = h(
    'div',
    { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '18px', alignItems: 'start' } },
    todayCard,
    fleetCard
  );
  grid.style.gridTemplateColumns = window.innerWidth < 900 ? '1fr' : 'minmax(0, 2fr) minmax(260px, 1fr)';

  // Upcoming
  const upcomingCard = card(
    'Upcoming Trips',
    d.upcoming.length ? bookingTable(d.upcoming, false) : emptyBlock('📅', 'No upcoming trips.'),
    null
  );
  upcomingCard.style.marginTop = '18px';

  container.append(head, statGrid, grid, upcomingCard);
}

function statTile(lbl, val, ic, accent, sub) {
  return h(
    'div',
    { class: `stat accent-${accent}` },
    h('div', { class: 'ic-box' }, icon(ic, 19)),
    h('div', { class: 'lbl' }, lbl),
    h('div', { class: 'val' }, val),
    sub ? h('div', { class: 'sub' }, sub) : null
  );
}

function card(title, bodyOrCard, badgeText, bodyIsRaw) {
  const head = h('div', { class: 'card-head' }, h('h3', {}, title), h('div', { class: 'spacer' }), badgeText ? h('span', { class: 'cell-sub' }, badgeText) : null);
  const body = bodyIsRaw ? bodyOrCard : h('div', { class: 'card-body tight' }, bodyOrCard);
  return h('div', { class: 'card' }, head, body);
}

function bookingTable(rows, showTime) {
  const table = h(
    'table',
    { class: 'tbl' },
    h('thead', {}, h('tr', {}, showTime ? h('th', {}, 'Time') : h('th', {}, 'Date'), h('th', {}, 'Customer'), h('th', {}, 'Vehicle'), h('th', {}, 'Trip'), h('th', {}, 'Status'))),
    h(
      'tbody',
      {},
      ...rows.map((b) =>
        h(
          'tr',
          { class: 'clickable', onClick: () => navigate(`/bookings/${b.id}`) },
          h('td', { class: 'cell-strong mono' }, showTime ? fmtTime(b.pickup_time) : fmtDate(b.travel_date)),
          h('td', {}, h('div', { class: 'cell-strong' }, b.customer_name), h('div', { class: 'cell-sub' }, b.pickup_location || '')),
          h('td', {}, b.vehicle_name),
          h('td', {}, h('span', { class: 'chip' }, b.trip_type || '—')),
          h('td', {}, bookingBadge(b.booking_status))
        )
      )
    )
  );
  return table;
}

function emptyBlock(emoji, text) {
  return h('div', { class: 'empty' }, h('div', { class: 'big' }, emoji), h('p', {}, text));
}
