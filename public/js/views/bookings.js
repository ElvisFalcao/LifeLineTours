import { api, session } from '../api.js';
import { store, navigate, can } from '../store.js';
import {
  h, clear, icon, money, money2, fmtDate, fmtTime, fmtLongDate,
  bookingBadge, paymentBadge, toast, modal, confirmDialog, field, input, select, textarea,
} from '../ui.js';

let cache = { vehicles: [], customers: [], drivers: [] };
let listContainer = null;
let currentFilters = {};

export async function renderBookings(container, rest) {
  const isDriver = store.user.role === 'driver';

  // Load reference data needed by filters/forms.
  const [vehicles] = await Promise.all([api.get('/vehicles')]);
  cache.vehicles = vehicles;
  if (!isDriver) {
    const [customers, drivers] = await Promise.all([api.get('/customers'), api.get('/users/drivers')]);
    cache.customers = customers;
    cache.drivers = drivers;
  }

  clear(container);
  const head = h(
    'div',
    { class: 'page-head' },
    h('div', { class: 'titles' }, h('h2', {}, isDriver ? 'My Trips' : 'Bookings'), h('p', {}, isDriver ? 'Trips assigned to you' : 'Capture, track and manage all trips')),
    h('div', { class: 'spacer' }),
    !isDriver ? h('button', { class: 'btn gold', onClick: () => openBookingForm() }, icon('plus', 16), 'New Booking') : null
  );

  // Toolbar / filters
  const search = input({ placeholder: 'Search name, reference, pickup…', oninput: debounce(applyFilters, 250) });
  const statusSel = select(['All statuses', ...store.meta.bookingStatuses], { onchange: applyFilters });
  const vehicleSel = select(['All vehicles', ...cache.vehicles.map((v) => ({ value: v.id, label: v.name }))], { onchange: applyFilters });
  const fromInp = input({ type: 'date', onchange: applyFilters, style: { maxWidth: '160px' } });

  const toolbar = h(
    'div',
    { class: 'toolbar' },
    h('div', { class: 'search' }, h('span', { class: 'si' }, icon('search', 16)), search),
    statusSel,
    !isDriver ? vehicleSel : null,
    h('span', { class: 'cell-sub' }, 'From'),
    fromInp
  );

  listContainer = h('div', { class: 'card' });
  container.append(head, toolbar, listContainer);

  function applyFilters() {
    currentFilters = {
      search: search.value.trim() || undefined,
      status: statusSel.value !== 'All statuses' ? statusSel.value : undefined,
      vehicleId: vehicleSel.value && vehicleSel.value !== 'All vehicles' ? vehicleSel.value : undefined,
      from: fromInp.value || undefined,
    };
    loadList();
  }
  await loadList();

  // Deep links: /bookings/new or /bookings/:id
  if (rest[0] === 'new' && !isDriver) openBookingForm();
  else if (rest[0] && /^\d+$/.test(rest[0])) openBookingDetail(Number(rest[0]));
}

function defaultReload() {
  if (listContainer && listContainer.isConnected) loadList();
}

// Ensure the form's reference data is loaded (e.g. when opened from the calendar).
async function ensureCache() {
  if (!cache.vehicles.length) cache.vehicles = await api.get('/vehicles');
  if (can('admin', 'staff')) {
    if (!cache.customers.length) cache.customers = await api.get('/customers');
    if (!cache.drivers.length) cache.drivers = await api.get('/users/drivers');
  }
}

async function loadList() {
  if (!listContainer || !listContainer.isConnected) return;
  clear(listContainer).append(h('div', { class: 'empty' }, 'Loading…'));
  const qs = new URLSearchParams(Object.entries(currentFilters).filter(([, v]) => v != null)).toString();
  const rows = await api.get('/bookings' + (qs ? `?${qs}` : ''));
  clear(listContainer);
  if (!rows.length) {
    listContainer.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '🔎'), h('p', {}, 'No bookings match your filters.')));
    return;
  }
  const table = h(
    'table',
    { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Ref'), h('th', {}, 'Customer'), h('th', {}, 'Date / Time'), h('th', {}, 'Vehicle'), h('th', {}, 'Trip'), h('th', {}, 'Status'), h('th', {}, 'Payment'), h('th', { style: { textAlign: 'right' } }, 'Amount'))),
    h(
      'tbody',
      {},
      ...rows.map((b) =>
        h(
          'tr',
          { class: 'clickable', onClick: () => openBookingDetail(b.id) },
          h('td', { class: 'mono cell-sub' }, b.reference),
          h('td', {}, h('div', { class: 'cell-strong' }, b.customer_name), h('div', { class: 'cell-sub' }, b.pickup_location || '')),
          h('td', {}, h('div', { class: 'cell-strong' }, fmtDate(b.travel_date)), h('div', { class: 'cell-sub mono' }, fmtTime(b.pickup_time) + (b.end_time ? '–' + fmtTime(b.end_time) : ''))),
          h('td', {}, b.vehicle_name),
          h('td', {}, h('span', { class: 'chip' }, b.trip_type || '—')),
          h('td', {}, bookingBadge(b.booking_status)),
          h('td', {}, paymentBadge(b.payment_status)),
          h('td', { style: { textAlign: 'right' }, class: 'mono cell-strong' }, money(b.amount))
        )
      )
    )
  );
  listContainer.append(h('div', { class: 'table-wrap' }, table));
}

// ---------------------------------------------------------------- detail
export async function openBookingDetail(id, refreshUnderlying = defaultReload) {
  const b = await api.get(`/bookings/${id}`);
  const isDriver = store.user.role === 'driver';
  const balance = (b.amount || 0) - (b.amount_paid || 0);

  // Workflow stepper
  const steps = store.meta.bookingStatuses.filter((s) => s !== 'Cancelled');
  const currentIdx = steps.indexOf(b.booking_status);
  const stepper = h(
    'div',
    { class: 'steps' },
    ...steps.map((s, i) => {
      const cls = b.booking_status === s ? 'current' : i < currentIdx ? 'done' : '';
      const driverAllowed = ['Picked Up', 'Trip In Progress', 'Completed'].includes(s);
      const clickable = !isDriver || driverAllowed;
      return h(
        'span',
        {
          class: `step ${cls}`,
          style: clickable ? {} : { opacity: '0.5', cursor: 'default' },
          onClick: clickable ? () => changeStatus(b.id, s, refresh) : undefined,
        },
        s
      );
    }),
    b.booking_status !== 'Cancelled'
      ? h('span', { class: 'step', style: { color: '#b53434', borderColor: '#f0c9c9' }, onClick: () => changeStatus(b.id, 'Cancelled', refresh) }, 'Cancel')
      : h('span', { class: 'step current', style: { background: '#b53434', borderColor: '#b53434' } }, 'Cancelled')
  );

  const trip = h(
    'dl',
    { class: 'kv' },
    h('dt', {}, 'Vehicle'), h('dd', {}, b.vehicle_name || '—'),
    h('dt', {}, 'Trip type'), h('dd', {}, b.trip_type || '—'),
    h('dt', {}, 'Travel date'), h('dd', {}, fmtLongDate(b.travel_date)),
    h('dt', {}, 'Pickup time'), h('dd', {}, fmtTime(b.pickup_time) + (b.end_time ? ' – ' + fmtTime(b.end_time) : '')),
    h('dt', {}, 'Pickup'), h('dd', {}, b.pickup_location || '—'),
    h('dt', {}, 'Drop-off'), h('dd', {}, b.dropoff_location || '—'),
    h('dt', {}, 'Passengers'), h('dd', {}, b.passengers || '—'),
    h('dt', {}, 'Driver'), h('dd', {}, b.driver_name || h('span', { class: 'text-muted' }, 'Not assigned'))
  );

  const customer = h(
    'dl',
    { class: 'kv' },
    h('dt', {}, 'Name'), h('dd', {}, b.customer_name),
    h('dt', {}, 'Phone'), h('dd', {}, b.customer_phone || '—'),
    h('dt', {}, 'WhatsApp'), h('dd', {}, b.customer_whatsapp || '—'),
    h('dt', {}, 'Email'), h('dd', {}, b.customer_email || '—')
  );

  const financial = !isDriver
    ? h(
        'div',
        {},
        h('div', { class: 'section-title' }, 'Payment'),
        h(
          'dl',
          { class: 'kv' },
          h('dt', {}, 'Total'), h('dd', { class: 'cell-strong' }, money2(b.amount)),
          h('dt', {}, 'Deposit (50%)'), h('dd', {}, money2(b.deposit_amount)),
          h('dt', {}, 'Paid to date'), h('dd', { class: 'money-pos' }, money2(b.amount_paid)),
          h('dt', {}, 'Balance due'), h('dd', { class: balance > 0 ? 'money-due' : 'money-pos' }, money2(balance)),
          h('dt', {}, 'Status'), h('dd', {}, paymentBadge(b.payment_status)),
          h('dt', {}, 'Method'), h('dd', {}, b.payment_method || '—')
        ),
        b.payments && b.payments.length
          ? h(
              'div',
              { style: { marginTop: '12px' } },
              ...b.payments.map((p) =>
                h(
                  'div',
                  { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid #f0f2f6' } },
                  h('span', { class: 'text-muted' }, `${fmtDate(p.created_at)} · ${p.method || 'Payment'}${p.note ? ' — ' + p.note : ''}`),
                  h('span', { class: 'mono money-pos' }, money2(p.amount))
                )
              )
            )
          : null,
        can('admin', 'staff') && balance > 0
          ? h('button', { class: 'btn sm', style: { marginTop: '12px' }, onClick: () => openPaymentForm(b, refresh) }, icon('money', 15), 'Record Payment')
          : null
      )
    : null;

  const body = h(
    'div',
    {},
    h('div', { class: 'section-title' }, 'Status'),
    stepper,
    b.notes ? h('div', { style: { marginTop: '14px', background: '#f7f9fc', padding: '12px', borderRadius: '10px', fontSize: '13px' } }, h('b', {}, 'Notes: '), b.notes) : null,
    h('div', { style: { display: 'grid', gridTemplateColumns: window.innerWidth < 640 ? '1fr' : '1fr 1fr', gap: '8px 24px' } },
      h('div', {}, h('div', { class: 'section-title' }, 'Trip'), trip),
      h('div', {}, h('div', { class: 'section-title' }, 'Customer'), customer)
    ),
    financial
  );

  // WhatsApp template menu
  const waButtons = store.meta.whatsappTemplates.map((t) =>
    h('button', { class: 'btn sm', onClick: () => sendWhatsapp(b.id, t.key) }, icon('whatsapp', 14), t.label)
  );

  const footer = h(
    'div',
    { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', alignItems: 'center' } },
    ...(isDriver ? [] : waButtons),
    h('div', { class: 'spacer', style: { flex: '1' } }),
    !isDriver ? h('button', { class: 'btn', onClick: () => openInvoice(b.id) }, icon('file', 15), 'Invoice') : null,
    can('admin', 'staff') ? h('button', { class: 'btn primary', onClick: () => openBookingForm(b, { parentModal: m, onSaved: refreshUnderlying }) }, icon('edit', 15), 'Edit') : null,
    can('admin') ? h('button', { class: 'btn danger sm', onClick: () => deleteBooking(b.id, m) }, icon('trash', 15)) : null
  );

  const m = modal({
    title: b.reference,
    sub: `${b.customer_name} · ${fmtDate(b.travel_date)}`,
    body,
    footer,
    wide: true,
    onClose: () => {
      if (location.hash.includes(`/bookings/${b.id}`)) history.replaceState(null, '', '#/bookings');
    },
  });

  function refresh() {
    m.close();
    refreshUnderlying();
    openBookingDetail(id, refreshUnderlying);
  }
}

async function changeStatus(id, status, after) {
  try {
    await api.patch(`/bookings/${id}/status`, { status });
    toast(`Status updated to “${status}”`, 'success');
    after();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function openPaymentForm(b, after) {
  const balance = (b.amount || 0) - (b.amount_paid || 0);
  const amountInp = input({ type: 'number', min: '0', step: '0.01', value: balance > 0 ? balance : '', placeholder: '0.00' });
  const methodSel = select(store.meta.paymentMethods, {});
  const noteInp = input({ placeholder: 'e.g. Deposit, balance…' });
  const m = modal({
    title: 'Record Payment',
    sub: b.reference,
    body: h(
      'div',
      {},
      field('Amount', amountInp, { required: true, hint: `Balance due: ${money2(balance)}` }),
      field('Method', methodSel),
      field('Note', noteInp)
    ),
    footer: [
      h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onClick: save }, 'Save Payment'),
    ],
  });
  async function save() {
    const amount = Number(amountInp.value);
    if (!(amount > 0)) return toast('Enter a valid amount', 'error');
    try {
      await api.post(`/bookings/${b.id}/payments`, { amount, method: methodSel.value, note: noteInp.value.trim() });
      toast('Payment recorded', 'success');
      m.close();
      after();
    } catch (e) {
      toast(e.message, 'error');
    }
  }
}

// ---------------------------------------------------------------- create / edit form
export async function openBookingForm(existing, { parentModal, onSaved } = {}) {
  await ensureCache();
  const editing = !!(existing && existing.id); // a prefill object without id = new booking
  const b = existing || {};

  // Customer field — select existing or add new inline.
  const customerSel = select(
    [{ value: '', label: '— Select customer —' }, ...cache.customers.map((c) => ({ value: c.id, label: `${c.full_name}${c.phone ? ' · ' + c.phone : ''}` })), { value: '__new', label: '➕ Add new customer' }],
    { value: b.customer_id || '', onchange: onCustomerChange }
  );
  const newName = input({ placeholder: 'Full name' });
  const newPhone = input({ placeholder: 'Phone' });
  const newWhatsapp = input({ placeholder: 'WhatsApp' });
  const newEmail = input({ placeholder: 'Email' });
  const newCustomerBlock = h(
    'div',
    { class: 'full', style: { display: 'none', gridColumn: '1 / -1', background: '#f7f9fc', padding: '14px', borderRadius: '10px', marginBottom: '12px' } },
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' } },
      field('New customer name', newName, { required: true }),
      field('Phone', newPhone),
      field('WhatsApp', newWhatsapp),
      field('Email', newEmail)
    )
  );
  function onCustomerChange() {
    newCustomerBlock.style.display = customerSel.value === '__new' ? 'block' : 'none';
  }

  const vehicleSel = select(cache.vehicles.map((v) => ({ value: v.id, label: `${v.name} (${v.capacity} seats)` })), { value: b.vehicle_id || cache.vehicles[0]?.id, onchange: checkAvail });
  const tripSel = select(store.meta.tripTypes, { value: b.trip_type || 'Airport Transfer' });
  const dateInp = input({ type: 'date', value: b.travel_date || '', onchange: checkAvail });
  const pickupTime = input({ type: 'time', value: b.pickup_time || '', onchange: () => { autofillEnd(); checkAvail(); } });
  const endTime = input({ type: 'time', value: b.end_time || '', onchange: checkAvail });
  const pickupLoc = input({ value: b.pickup_location || '', placeholder: 'Pickup location' });
  const dropLoc = input({ value: b.dropoff_location || '', placeholder: 'Drop-off location' });
  const passengers = input({ type: 'number', min: '1', value: b.passengers || '', placeholder: 'No. of passengers' });

  const amountInp = input({ type: 'number', min: '0', step: '0.01', value: b.amount || '', placeholder: '0.00', oninput: onAmount });
  let depositEdited = editing;
  const depositInp = input({ type: 'number', min: '0', step: '0.01', value: b.deposit_amount || '', placeholder: 'Auto 50%', oninput: () => (depositEdited = true) });
  const methodSel = select([{ value: '', label: '—' }, ...store.meta.paymentMethods], { value: b.payment_method || '' });
  const driverSel = select([{ value: '', label: '— Unassigned —' }, ...cache.drivers.map((d) => ({ value: d.id, label: d.name }))], { value: b.driver_id || '' });
  const statusSel = editing ? select(store.meta.bookingStatuses, { value: b.booking_status }) : null;
  const notesInp = textarea({ value: b.notes || '', placeholder: 'Internal notes…' });

  function onAmount() {
    if (!depositEdited) {
      const a = Number(amountInp.value) || 0;
      depositInp.value = a ? Math.round(a / 2) : '';
    }
  }
  function autofillEnd() {
    if (!endTime.value && pickupTime.value) {
      const [hh, mm] = pickupTime.value.split(':').map(Number);
      let t = hh * 60 + mm + 180;
      if (t > 1439) t = 1439;
      endTime.value = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    }
  }

  // Pricing reference for the chosen vehicle
  const pricingBox = h('div', { class: 'hint', style: { marginTop: '6px' } });
  function renderPricing() {
    const veh = cache.vehicles.find((v) => String(v.id) === String(vehicleSel.value));
    const ref = store.meta.pricing.find((p) => veh && veh.name.startsWith(p.vehicle.split(' ')[0]));
    clear(pricingBox);
    if (ref) pricingBox.append(h('b', {}, 'Guide: '), ref.lines.map((l) => `${l.service}: ${l.detail}`).join('  ·  '));
  }

  const availBanner = h('div', { class: 'avail-banner idle' }, 'Select vehicle, date & time to check availability');
  let availTimer;
  function checkAvail() {
    renderPricing();
    clearTimeout(availTimer);
    if (!vehicleSel.value || !dateInp.value || !pickupTime.value) {
      availBanner.className = 'avail-banner idle';
      availBanner.textContent = 'Select vehicle, date & time to check availability';
      return;
    }
    availBanner.className = 'avail-banner idle';
    availBanner.textContent = 'Checking availability…';
    availTimer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ date: dateInp.value, start: pickupTime.value, end: endTime.value || '', excludeId: editing ? b.id : '' });
        const r = await api.get(`/vehicles/${vehicleSel.value}/availability?${qs}`);
        if (r.available) {
          availBanner.className = 'avail-banner ok';
          clear(availBanner).append(icon('check', 16), 'Available for this time slot');
        } else {
          availBanner.className = 'avail-banner bad';
          clear(availBanner).append(icon('x', 16), r.reason || 'Not available');
        }
      } catch (e) {
        availBanner.className = 'avail-banner idle';
        availBanner.textContent = '';
      }
    }, 300);
  }

  const formBody = h(
    'div',
    {},
    h('div', { class: 'section-title' }, 'Customer'),
    h('div', { class: 'form-grid' }, field('Customer', customerSel, { required: true, full: true })),
    newCustomerBlock,
    h('div', { class: 'section-title' }, 'Trip details'),
    h(
      'div',
      { class: 'form-grid' },
      field('Vehicle', vehicleSel, { required: true }),
      field('Trip type', tripSel),
      field('Travel date', dateInp, { required: true }),
      field('Passengers', passengers),
      field('Pickup time', pickupTime, { required: true }),
      field('End time', endTime, { hint: 'Defaults to +3h' }),
      field('Pickup location', pickupLoc, { full: true }),
      field('Drop-off location', dropLoc, { full: true })
    ),
    pricingBox,
    availBanner,
    h('div', { class: 'section-title' }, 'Payment & assignment'),
    h(
      'div',
      { class: 'form-grid' },
      field('Total amount (R)', amountInp, { required: true }),
      field('Deposit (R)', depositInp, { hint: 'Auto-fills to 50%' }),
      field('Payment method', methodSel),
      field('Assign driver', driverSel),
      editing ? field('Booking status', statusSel, { full: true }) : null
    ),
    field('Notes', notesInp, { full: true })
  );

  const saveBtn = h('button', { class: 'btn primary', onClick: () => save(false) }, editing ? 'Save Changes' : 'Create Booking');
  const m = modal({
    title: editing ? `Edit ${b.reference}` : 'New Booking',
    sub: editing ? null : 'Capture a new trip',
    body: formBody,
    footer: [h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Cancel'), saveBtn],
    wide: true,
  });
  onCustomerChange();
  renderPricing();
  if (b.travel_date && b.pickup_time) checkAvail();

  async function save(override) {
    // Resolve customer (create new if needed)
    let customerId = customerSel.value;
    if (customerId === '__new') {
      if (!newName.value.trim()) return toast('Enter the new customer name', 'error');
      try {
        const c = await api.post('/customers', {
          full_name: newName.value.trim(),
          phone: newPhone.value.trim(),
          whatsapp: newWhatsapp.value.trim(),
          email: newEmail.value.trim(),
        });
        customerId = c.id;
      } catch (e) {
        return toast(e.message, 'error');
      }
    }
    if (!customerId) return toast('Please select a customer', 'error');
    if (!dateInp.value || !pickupTime.value) return toast('Travel date and pickup time are required', 'error');
    if (!amountInp.value) return toast('Enter the total amount', 'error');

    const payload = {
      customer_id: Number(customerId),
      vehicle_id: Number(vehicleSel.value),
      trip_type: tripSel.value,
      travel_date: dateInp.value,
      pickup_time: pickupTime.value,
      end_time: endTime.value || null,
      pickup_location: pickupLoc.value.trim(),
      dropoff_location: dropLoc.value.trim(),
      passengers: passengers.value ? Number(passengers.value) : null,
      amount: Number(amountInp.value),
      deposit_amount: depositInp.value !== '' ? Number(depositInp.value) : null,
      payment_method: methodSel.value || null,
      driver_id: driverSel.value ? Number(driverSel.value) : null,
      notes: notesInp.value.trim(),
      override,
    };
    if (editing) payload.booking_status = statusSel.value;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      if (editing) await api.put(`/bookings/${b.id}`, payload);
      else await api.post('/bookings', payload);
      toast(editing ? 'Booking updated' : 'Booking created', 'success');
      m.close();
      if (parentModal) parentModal.close();
      (onSaved || defaultReload)();
      if (location.hash.includes('/bookings/new')) history.replaceState(null, '', '#/bookings');
    } catch (e) {
      saveBtn.disabled = false;
      saveBtn.textContent = editing ? 'Save Changes' : 'Create Booking';
      if (e.code === 'NOTICE_24H') {
        confirmDialog({
          title: 'Less than 24 hours notice',
          message: 'This trip is within the 24-hour minimum notice window. Do you want to override the rule and book it anyway?',
          confirmText: 'Override & Book',
          onConfirm: () => save(true),
        });
      } else {
        toast(e.message, 'error');
      }
    }
  }
}

async function deleteBooking(id, parentModal) {
  confirmDialog({
    title: 'Delete booking?',
    message: 'This permanently removes the booking and its payment records. This cannot be undone.',
    confirmText: 'Delete',
    danger: true,
    onConfirm: async () => {
      try {
        await api.del(`/bookings/${id}`);
        toast('Booking deleted', 'success');
        parentModal.close();
        loadList();
      } catch (e) {
        toast(e.message, 'error');
      }
    },
  });
}

async function sendWhatsapp(id, template) {
  try {
    const r = await api.get(`/bookings/${id}/whatsapp?template=${template}`);
    window.open(r.link, '_blank');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function openInvoice(id) {
  try {
    const res = await fetch(`/api/invoices/${id}`, { headers: { Authorization: `Bearer ${session.token}` } });
    if (!res.ok) throw new Error('Could not generate invoice');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
