import { api } from '../api.js';
import { h, clear, icon, money, money2, input } from '../ui.js';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function renderReports(container) {
  const year = new Date().getFullYear();
  const fromInp = input({ type: 'date', value: `${year}-01-01`, style: { maxWidth: '170px' } });
  const toInp = input({ type: 'date', value: `${year}-12-31`, style: { maxWidth: '170px' } });

  const head = h(
    'div',
    { class: 'page-head' },
    h('div', { class: 'titles' }, h('h2', {}, 'Reports'), h('p', {}, 'Revenue & fleet performance')),
    h('div', { class: 'spacer' }),
    h('div', { class: 'toolbar', style: { margin: '0' } },
      h('span', { class: 'cell-sub' }, 'From'), fromInp,
      h('span', { class: 'cell-sub' }, 'To'), toInp,
      h('button', { class: 'btn primary sm', onClick: load }, 'Apply')
    )
  );
  const body = h('div', {});
  container.append(head, body);

  async function load() {
    clear(body).append(h('div', { class: 'empty' }, 'Crunching numbers…'));
    const qs = `?from=${fromInp.value}&to=${toInp.value}`;
    const [rev, veh] = await Promise.all([api.get('/reports/revenue' + qs), api.get('/reports/vehicles' + qs)]);
    clear(body);

    // Revenue tiles
    const t = rev.totals;
    body.append(
      h('div', { class: 'stat-grid' },
        tile('Total Bookings', String(t.total_bookings), 'bookings', 'navy'),
        tile('Total Income (collected)', money(t.total_collected), 'money', 'green'),
        tile('Contracted Value', money(t.total_contracted), 'reports', 'gold'),
        tile('Outstanding', money(t.total_outstanding), 'money', 'red')
      )
    );

    // Monthly revenue bars
    const maxC = Math.max(1, ...rev.byMonth.map((m) => m.collected));
    const monthCard = card('Revenue by Month', h('div', { class: 'card-body' },
      rev.byMonth.length
        ? h('div', { class: 'bars' }, ...rev.byMonth.map((m) => {
            const label = `${MONTH_ABBR[Number(m.month.slice(5, 7)) - 1]} ${m.month.slice(0, 4)}`;
            return h('div', { class: 'bar-row' },
              h('span', { class: 'text-muted' }, label),
              h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${(m.collected / maxC) * 100}%` } })),
              h('span', { class: 'mono cell-strong', style: { textAlign: 'right' } }, money(m.collected))
            );
          }))
        : h('p', { class: 'text-muted' }, 'No data in this range.')
    ));

    // By trip type
    const tripCard = card('Income by Trip Type', h('div', { class: 'card-body tight' },
      rev.byTripType.length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Trip Type'), h('th', { style: { textAlign: 'center' } }, 'Bookings'), h('th', { style: { textAlign: 'right' } }, 'Collected'))),
            h('tbody', {}, ...rev.byTripType.map((r) => h('tr', {},
              h('td', { class: 'cell-strong' }, r.trip_type),
              h('td', { style: { textAlign: 'center' }, class: 'mono' }, String(r.bookings)),
              h('td', { style: { textAlign: 'right' }, class: 'mono' }, money2(r.collected))
            )))
          ))
        : h('p', { class: 'text-muted', style: { padding: '20px' } }, 'No data in this range.')
    ));

    const twoCol = h('div', { style: { display: 'grid', gridTemplateColumns: window.innerWidth < 900 ? '1fr' : '1fr 1fr', gap: '18px', marginBottom: '18px' } }, monthCard, tripCard);
    body.append(twoCol);

    // Vehicle report
    const vehCard = card('Vehicle Performance', h('div', { class: 'card-body tight' },
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Vehicle'), h('th', { style: { textAlign: 'center' } }, 'Total Trips'), h('th', { style: { textAlign: 'right' } }, 'Revenue'), h('th', {}, 'Most Used Service'))),
        h('tbody', {}, ...veh.vehicles.map((v) => h('tr', {},
          h('td', {}, h('div', { class: 'cell-strong' }, v.name), h('div', { class: 'cell-sub' }, v.category || '')),
          h('td', { style: { textAlign: 'center' }, class: 'mono' }, String(v.total_trips)),
          h('td', { style: { textAlign: 'right' }, class: 'mono cell-strong' }, money2(v.revenue)),
          h('td', {}, h('span', { class: 'chip' }, v.most_used_service))
        )))
      ))
    ));
    body.append(vehCard);
  }

  await load();
}

function tile(lbl, val, ic, accent) {
  return h('div', { class: `stat accent-${accent}` }, h('div', { class: 'ic-box' }, icon(ic, 19)), h('div', { class: 'lbl' }, lbl), h('div', { class: 'val' }, val));
}
function card(title, bodyEl) {
  return h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, title)), bodyEl);
}
