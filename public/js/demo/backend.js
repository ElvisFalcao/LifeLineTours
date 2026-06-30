// In-browser mock backend for the GitHub Pages demo. Mirrors the Express API
// (src/routes + src/services) so the same frontend works with no server.
// Data is seeded once and persisted in localStorage.
import * as C from './constants.js';

const STORE_KEY = 'llt_demo_db_v1';
let db = null;

// ---- error + helpers -------------------------------------------------------
function err(message, status = 400, code = null) {
  return Object.assign(new Error(message), { status, code });
}
function nowISO() {
  return new Date().toISOString();
}
function todayStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function dateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function addHoursToTime(time, hours) {
  const [hh, mm] = String(time).split(':').map(Number);
  let total = hh * 60 + mm + Math.round(hours * 60);
  if (total > 1439) total = 1439;
  if (total < 0) total = 0;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function paymentStatusFor({ amount, depositAmount, amountPaid }) {
  amount = Number(amount) || 0; depositAmount = Number(depositAmount) || 0; amountPaid = Number(amountPaid) || 0;
  if (amount > 0 && amountPaid >= amount) return 'Fully Paid';
  if (depositAmount > 0 && amountPaid >= depositAmount) return 'Deposit Paid';
  if (amountPaid > 0) return 'Outstanding';
  return 'Deposit Pending';
}
function normalizePhone(num, dial = '27') {
  let digits = String(num || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(dial)) return digits;
  if (digits.startsWith('0')) return dial + digits.slice(1);
  return digits;
}
function nextId(list) {
  return list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

// ---- seed ------------------------------------------------------------------
function seed() {
  db = { users: [], vehicles: [], customers: [], bookings: [], payments: [] };
  const now = nowISO();

  db.users.push(
    { id: 1, name: 'System Admin', email: 'admin@lifelinetours.co.za', password: 'admin123', role: 'admin', phone: '0718281221', active: 1, created_at: now },
    { id: 2, name: 'Front Desk', email: 'staff@lifelinetours.co.za', password: 'staff123', role: 'staff', phone: '0710000002', active: 1, created_at: now },
    { id: 3, name: 'Sipho (Driver)', email: 'driver@lifelinetours.co.za', password: 'driver123', role: 'driver', phone: '0710000003', active: 1, created_at: now }
  );
  db.vehicles.push(
    { id: 1, name: 'Hummer H3', category: 'Classic VIP Vehicle', capacity: 4, services: 'Matric Dance, Weddings, VIP Transfers', status: 'Available', notes: 'Premium VIP vehicle for special occasions.', created_at: now },
    { id: 2, name: 'Hyundai H1 2017', category: 'Tours / Family / Group Transfers', capacity: 9, services: 'Airport Transfers, Tours, Family Transport, Group Trips', status: 'Available', notes: '9-seater for tours, airport runs and group travel.', created_at: now }
  );
  db.customers.push(
    { id: 1, full_name: 'John Smith', phone: '0821234567', whatsapp: '0821234567', email: 'john.smith@example.com', notes: 'Frequent airport client.', created_at: now },
    { id: 2, full_name: 'Sarah Adams', phone: '0834567890', whatsapp: '0834567890', email: 'sarah.adams@example.com', notes: 'Wedding party.', created_at: now },
    { id: 3, full_name: 'Thabo Mokoena', phone: '0729876543', whatsapp: '0729876543', email: 'thabo.m@example.com', notes: 'Matric dance group.', created_at: now }
  );

  const o = { override: true };
  const past = createBooking({ customer_id: 1, vehicle_id: 2, driver_id: 3, trip_type: 'Tour', travel_date: dateOffset(-12), pickup_time: '09:00', end_time: '15:00', pickup_location: 'V&A Waterfront', dropoff_location: 'Cape Point', passengers: 6, amount: 3500, booking_status: 'Completed' }, o);
  recordPayment(past.id, { amount: 3500, method: 'EFT', note: 'Paid in full' });

  const today = createBooking({ customer_id: 1, vehicle_id: 2, driver_id: 3, trip_type: 'Airport Transfer', travel_date: dateOffset(0), pickup_time: '08:00', end_time: '10:00', pickup_location: 'Hout Bay', dropoff_location: 'Cape Town International Airport', passengers: 3, amount: 1200, booking_status: 'Driver Assigned' }, o);
  recordPayment(today.id, { amount: 600, method: 'Cash', note: 'Deposit' });

  createBooking({ customer_id: 2, vehicle_id: 1, trip_type: 'Wedding', travel_date: dateOffset(1), pickup_time: '14:00', end_time: '17:00', pickup_location: 'Constantia', dropoff_location: 'Groot Constantia Wine Estate', passengers: 2, amount: 2500, booking_status: 'Confirmed' }, o);

  const july = createBooking({ customer_id: 1, vehicle_id: 2, trip_type: 'Airport Transfer', travel_date: '2026-07-15', pickup_time: '10:00', end_time: '16:00', pickup_location: 'Hout Bay', dropoff_location: 'Cape Town International Airport', passengers: 4, amount: 1600, booking_status: 'Confirmed' }, o);
  recordPayment(july.id, { amount: 800, method: 'EFT', note: 'Deposit' });

  createBooking({ customer_id: 3, vehicle_id: 1, trip_type: 'Matric Dance', travel_date: '2026-07-15', pickup_time: '18:00', end_time: '21:00', pickup_location: 'Sea Point', dropoff_location: 'Century City Hotel', passengers: 4, amount: 1800, booking_status: 'New Request' }, o);

  save();
}

export function init() {
  if (db) return;
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try { db = JSON.parse(raw); } catch { db = null; }
  }
  if (!db) seed();
  if (typeof window !== 'undefined') {
    window.__LLT_RESET__ = () => { localStorage.removeItem(STORE_KEY); db = null; init(); };
  }
}

// ---- domain logic (ported from services.js) --------------------------------
function findVehicle(id) { return db.vehicles.find((v) => v.id === Number(id)); }
function findCustomer(id) { return db.customers.find((c) => c.id === Number(id)); }
function findUser(id) { return db.users.find((u) => u.id === Number(id)); }

function enrich(b) {
  if (!b) return null;
  const c = findCustomer(b.customer_id) || {};
  const v = findVehicle(b.vehicle_id) || {};
  const d = b.driver_id ? findUser(b.driver_id) : null;
  return {
    ...b,
    customer_name: c.full_name, customer_phone: c.phone, customer_whatsapp: c.whatsapp, customer_email: c.email,
    vehicle_name: v.name, vehicle_category: v.category, vehicle_capacity: v.capacity,
    driver_name: d ? d.name : null, driver_phone: d ? d.phone : null,
  };
}
function getBooking(id) {
  return enrich(db.bookings.find((b) => b.id === Number(id)));
}
function resolveEndTime(pickup, end) {
  if (end && end > pickup) return end;
  return addHoursToTime(pickup, 3);
}

function checkAvailability({ vehicleId, date, startTime, endTime, excludeId = null }) {
  const vehicle = findVehicle(vehicleId);
  if (!vehicle) return { available: false, conflicts: [], reason: 'Vehicle not found' };
  if (vehicle.status === 'Maintenance') return { available: false, conflicts: [], reason: `${vehicle.name} is under maintenance` };
  const end = `${date}T${resolveEndTime(startTime, endTime)}`;
  const start = `${date}T${startTime}`;
  const conflicts = db.bookings
    .filter((b) => b.vehicle_id === Number(vehicleId) && b.booking_status !== 'Cancelled' && b.start_dt < end && b.end_dt > start && (!excludeId || b.id !== Number(excludeId)))
    .map((b) => ({ id: b.id, reference: b.reference, travel_date: b.travel_date, pickup_time: b.pickup_time, end_time: b.end_time, customer_name: (findCustomer(b.customer_id) || {}).full_name, booking_status: b.booking_status }));
  return { available: conflicts.length === 0, conflicts, reason: conflicts.length ? `${vehicle.name} is already booked for an overlapping time` : null };
}

function assertNotice(travelDate, pickupTime, override) {
  if (override) return;
  const start = new Date(`${travelDate}T${pickupTime}:00`).getTime();
  if (Number.isNaN(start)) return;
  if (start < Date.now() + C.RULES.minNoticeHours * 3600 * 1000) {
    throw err(`Bookings normally need ${C.RULES.minNoticeHours} hours notice. Confirm to override.`, 422, 'NOTICE_24H');
  }
}

function createBooking(data, opts = {}) {
  for (const f of ['customer_id', 'vehicle_id', 'travel_date', 'pickup_time']) {
    if (!data[f]) throw err(`Missing required field: ${f}`, 400);
  }
  assertNotice(data.travel_date, data.pickup_time, opts.override);
  const endTime = resolveEndTime(data.pickup_time, data.end_time);
  const avail = checkAvailability({ vehicleId: data.vehicle_id, date: data.travel_date, startTime: data.pickup_time, endTime });
  if (!avail.available) throw err(avail.reason, 409, 'UNAVAILABLE');

  const amount = round2(data.amount);
  const deposit = data.deposit_amount !== undefined && data.deposit_amount !== null && data.deposit_amount !== ''
    ? round2(data.deposit_amount) : round2((amount * C.RULES.depositPercent) / 100);
  const created = nowISO();
  const id = nextId(db.bookings);
  const booking = {
    id,
    reference: `LLT-${created.slice(0, 4)}-${String(id).padStart(4, '0')}`,
    customer_id: Number(data.customer_id),
    vehicle_id: Number(data.vehicle_id),
    driver_id: data.driver_id ? Number(data.driver_id) : null,
    trip_type: data.trip_type || null,
    travel_date: data.travel_date,
    pickup_time: data.pickup_time,
    end_time: endTime,
    start_dt: `${data.travel_date}T${data.pickup_time}`,
    end_dt: `${data.travel_date}T${endTime}`,
    pickup_location: data.pickup_location || null,
    dropoff_location: data.dropoff_location || null,
    passengers: data.passengers || null,
    amount,
    deposit_amount: deposit,
    amount_paid: 0,
    payment_method: data.payment_method || null,
    payment_status: paymentStatusFor({ amount, depositAmount: deposit, amountPaid: 0 }),
    booking_status: data.booking_status || 'New Request',
    notes: data.notes || null,
    created_at: created,
    updated_at: created,
  };
  db.bookings.push(booking);
  return getBooking(id);
}

function updateBooking(id, data) {
  const existing = db.bookings.find((b) => b.id === Number(id));
  if (!existing) throw err('Booking not found', 404);
  const merged = { ...existing, ...data };
  const endTime = resolveEndTime(merged.pickup_time, data.end_time !== undefined ? data.end_time : existing.end_time);
  const timingChanged = data.vehicle_id !== undefined || data.travel_date !== undefined || data.pickup_time !== undefined || data.end_time !== undefined;
  if (timingChanged && merged.booking_status !== 'Cancelled') {
    assertNotice(merged.travel_date, merged.pickup_time, true); // edits don't re-block on notice
    const avail = checkAvailability({ vehicleId: merged.vehicle_id, date: merged.travel_date, startTime: merged.pickup_time, endTime, excludeId: id });
    if (!avail.available) throw err(avail.reason, 409, 'UNAVAILABLE');
  }
  const amount = round2(merged.amount);
  const deposit = round2(merged.deposit_amount);
  const amountPaid = round2(merged.amount_paid);
  Object.assign(existing, {
    customer_id: Number(merged.customer_id),
    vehicle_id: Number(merged.vehicle_id),
    driver_id: merged.driver_id ? Number(merged.driver_id) : null,
    trip_type: merged.trip_type || null,
    travel_date: merged.travel_date,
    pickup_time: merged.pickup_time,
    end_time: endTime,
    start_dt: `${merged.travel_date}T${merged.pickup_time}`,
    end_dt: `${merged.travel_date}T${endTime}`,
    pickup_location: merged.pickup_location || null,
    dropoff_location: merged.dropoff_location || null,
    passengers: merged.passengers || null,
    amount,
    deposit_amount: deposit,
    payment_method: merged.payment_method || null,
    payment_status: data.payment_status || paymentStatusFor({ amount, depositAmount: deposit, amountPaid }),
    booking_status: merged.booking_status,
    notes: merged.notes || null,
    updated_at: nowISO(),
  });
  return getBooking(id);
}

function recordPayment(bookingId, { amount, method, note }) {
  const booking = db.bookings.find((b) => b.id === Number(bookingId));
  if (!booking) throw err('Booking not found', 404);
  const pay = round2(amount);
  if (!(pay > 0)) throw err('Payment amount must be greater than zero', 400);
  const created = nowISO();
  db.payments.push({ id: nextId(db.payments), booking_id: booking.id, amount: pay, method: method || null, note: note || null, created_at: created });
  booking.amount_paid = round2(booking.amount_paid + pay);
  booking.payment_status = paymentStatusFor({ amount: booking.amount, depositAmount: booking.deposit_amount, amountPaid: booking.amount_paid });
  if ((booking.payment_status === 'Deposit Paid' || booking.payment_status === 'Fully Paid') && ['New Request', 'Confirmed'].includes(booking.booking_status)) {
    booking.booking_status = 'Deposit Received';
  }
  if (method) booking.payment_method = method;
  booking.updated_at = created;
  return getBooking(bookingId);
}

function listPayments(bookingId) {
  return db.payments.filter((p) => p.booking_id === Number(bookingId)).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function buildWhatsapp(bookingId, key) {
  const b = getBooking(bookingId);
  if (!b) throw err('Booking not found', 404);
  const t = C.WHATSAPP_TEMPLATES.find((x) => x.key === key) || C.WHATSAPP_TEMPLATES[0];
  const balance = round2(b.amount - b.amount_paid);
  const longDate = new Date(`${b.travel_date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fields = {
    customer: b.customer_name || 'Customer', reference: b.reference || '', vehicle: b.vehicle_name || '',
    date: longDate, time: b.pickup_time || '', pickup: b.pickup_location || '—', dropoff: b.dropoff_location || '—',
    driver: b.driver_name || 'To be assigned', amount: (b.amount || 0).toFixed(0), deposit: (b.deposit_amount || 0).toFixed(0), balance: balance.toFixed(0),
  };
  const text = t.body.replace(/\{(\w+)\}/g, (_, k) => (fields[k] !== undefined ? fields[k] : `{${k}}`));
  const phone = normalizePhone(b.customer_whatsapp || b.customer_phone, C.BUSINESS.countryDial);
  const link = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  return { text, link, template: t.key, label: t.label };
}

// ---- aggregations ----------------------------------------------------------
function vehiclesList() {
  const nowDt = nowISO().slice(0, 16);
  const today = todayStr();
  return db.vehicles.slice().sort((a, b) => a.name.localeCompare(b.name)).map((v) => {
    const current = db.bookings.find((b) => b.vehicle_id === v.id && b.booking_status !== 'Cancelled' && b.start_dt <= nowDt && b.end_dt >= nowDt);
    const todayCount = db.bookings.filter((b) => b.vehicle_id === v.id && b.travel_date === today && b.booking_status !== 'Cancelled').length;
    let liveStatus = v.status;
    if (v.status !== 'Maintenance') liveStatus = current ? 'Busy' : 'Available';
    const currentTrip = current ? { id: current.id, reference: current.reference, booking_status: current.booking_status, customer_name: (findCustomer(current.customer_id) || {}).full_name } : null;
    return { ...v, liveStatus, currentTrip, todayCount };
  });
}

function customersList(search) {
  const s = (search || '').toLowerCase();
  return db.customers
    .filter((c) => !s || (c.full_name || '').toLowerCase().includes(s) || (c.phone || '').includes(s) || (c.email || '').toLowerCase().includes(s))
    .map((c) => {
      const trips = db.bookings.filter((b) => b.customer_id === c.id);
      const active = trips.filter((t) => t.booking_status !== 'Cancelled');
      return {
        ...c,
        trips: trips.length,
        total_spent: round2(active.reduce((sum, t) => sum + (t.amount_paid || 0), 0)),
        last_booking: trips.reduce((m, t) => (t.travel_date > m ? t.travel_date : m), ''),
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function customerDetail(id) {
  const c = findCustomer(id);
  if (!c) throw err('Customer not found', 404);
  const trips = db.bookings.filter((b) => b.customer_id === c.id)
    .sort((a, b) => b.start_dt.localeCompare(a.start_dt))
    .map((b) => ({ id: b.id, reference: b.reference, travel_date: b.travel_date, pickup_time: b.pickup_time, trip_type: b.trip_type, booking_status: b.booking_status, payment_status: b.payment_status, amount: b.amount, amount_paid: b.amount_paid, vehicle_name: (findVehicle(b.vehicle_id) || {}).name }));
  const total = trips.filter((t) => t.booking_status !== 'Cancelled').reduce((s, t) => s + (t.amount_paid || 0), 0);
  return { ...c, trips, total_spent: round2(total), trip_count: trips.length };
}

function dashboard(user) {
  const today = todayStr();
  const month = today.slice(0, 7);
  const isDriver = user.role === 'driver';
  const mine = (b) => !isDriver || b.driver_id === user.id;
  const todays = db.bookings.filter((b) => b.travel_date === today && b.booking_status !== 'Cancelled' && mine(b)).map(enrich).sort((a, b) => (a.pickup_time || '').localeCompare(b.pickup_time || ''));
  const upcoming = db.bookings.filter((b) => b.travel_date > today && !['Cancelled', 'Completed'].includes(b.booking_status) && mine(b)).map(enrich).sort((a, b) => a.start_dt.localeCompare(b.start_dt));
  const vehicles = vehiclesList().map((v) => ({ ...v, liveStatus: v.status === 'Maintenance' ? 'Maintenance' : v.liveStatus }));

  let monthlyRevenue = 0, monthExpected = 0, outstanding = 0;
  if (!isDriver) {
    const monthB = db.bookings.filter((b) => b.travel_date.slice(0, 7) === month && b.booking_status !== 'Cancelled');
    monthlyRevenue = round2(monthB.reduce((s, b) => s + (b.amount_paid || 0), 0));
    monthExpected = round2(monthB.reduce((s, b) => s + (b.amount || 0), 0));
    outstanding = round2(db.bookings.filter((b) => b.booking_status !== 'Cancelled' && b.amount > b.amount_paid).reduce((s, b) => s + (b.amount - b.amount_paid), 0));
  }
  return {
    today,
    todaysBookings: todays,
    upcoming: upcoming.slice(0, 8),
    vehicles,
    available: vehicles.filter((v) => v.liveStatus === 'Available').length,
    busy: vehicles.filter((v) => v.liveStatus === 'Busy').length,
    maintenance: vehicles.filter((v) => v.liveStatus === 'Maintenance').length,
    monthlyRevenue, monthExpected, outstanding,
    counts: {
      todays: todays.length,
      upcoming: db.bookings.filter((b) => b.travel_date > today && !['Cancelled', 'Completed'].includes(b.booking_status) && mine(b)).length,
      newRequests: db.bookings.filter((b) => b.booking_status === 'New Request').length,
    },
  };
}

function revenueReport(from, to) {
  const inRange = db.bookings.filter((b) => b.travel_date >= from && b.travel_date <= to && b.booking_status !== 'Cancelled');
  const totals = {
    total_bookings: inRange.length,
    total_contracted: round2(inRange.reduce((s, b) => s + b.amount, 0)),
    total_collected: round2(inRange.reduce((s, b) => s + b.amount_paid, 0)),
    total_deposits: round2(inRange.reduce((s, b) => s + b.deposit_amount, 0)),
    total_outstanding: round2(inRange.reduce((s, b) => s + (b.amount - b.amount_paid), 0)),
  };
  const monthMap = {};
  for (const b of inRange) {
    const m = b.travel_date.slice(0, 7);
    (monthMap[m] ||= { month: m, bookings: 0, collected: 0, contracted: 0 });
    monthMap[m].bookings++; monthMap[m].collected += b.amount_paid; monthMap[m].contracted += b.amount;
  }
  const byMonth = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, collected: round2(m.collected), contracted: round2(m.contracted) }));
  const tripMap = {};
  for (const b of inRange) {
    const k = b.trip_type || 'Unspecified';
    (tripMap[k] ||= { trip_type: k, bookings: 0, collected: 0 });
    tripMap[k].bookings++; tripMap[k].collected += b.amount_paid;
  }
  const byTripType = Object.values(tripMap).sort((a, b) => b.collected - a.collected).map((t) => ({ ...t, collected: round2(t.collected) }));
  return { range: { from, to }, totals, byMonth, byTripType, byPayment: [] };
}

function vehicleReport(from, to) {
  const vehicles = db.vehicles.slice().sort((a, b) => a.name.localeCompare(b.name)).map((v) => {
    const trips = db.bookings.filter((b) => b.vehicle_id === v.id && b.travel_date >= from && b.travel_date <= to && b.booking_status !== 'Cancelled');
    const tripCount = {};
    for (const b of trips) if (b.trip_type) tripCount[b.trip_type] = (tripCount[b.trip_type] || 0) + 1;
    const top = Object.entries(tripCount).sort((a, b) => b[1] - a[1])[0];
    return {
      id: v.id, name: v.name, category: v.category,
      total_trips: trips.length,
      revenue: round2(trips.reduce((s, b) => s + b.amount_paid, 0)),
      contracted: round2(trips.reduce((s, b) => s + b.amount, 0)),
      most_used_service: top ? top[0] : '—',
    };
  });
  return { range: { from, to }, vehicles };
}

// ---- role guard ------------------------------------------------------------
function requireRole(user, ...roles) {
  if (!user) throw err('Authentication required', 401);
  if (!roles.includes(user.role)) throw err('You do not have permission for this action', 403);
}

// ---- router ----------------------------------------------------------------
export function handle(method, pathname, query = {}, body = {}, user = null) {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/');
  body = body || {};

  // auth
  if (pathname === '/auth/login' && method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    const u = db.users.find((x) => x.email === email && x.active);
    if (!u || u.password !== body.password) throw err('Invalid email or password', 401);
    return { token: `demo.${u.id}.${Date.now()}`, user: { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone } };
  }
  if (pathname === '/auth/me' && method === 'GET') {
    if (!user) throw err('Authentication required', 401);
    const u = findUser(user.id);
    if (!u || !u.active) throw err('Session no longer valid', 401);
    return { user: { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, active: u.active } };
  }
  if (!user) throw err('Authentication required', 401);

  if (pathname === '/meta' && method === 'GET') {
    return {
      business: C.BUSINESS, roles: C.ROLES, tripTypes: C.TRIP_TYPES, bookingStatuses: C.BOOKING_STATUSES,
      paymentStatuses: C.PAYMENT_STATUSES, paymentMethods: C.PAYMENT_METHODS, vehicleStatuses: C.VEHICLE_STATUSES,
      rules: C.RULES, pricing: C.PRICING, whatsappTemplates: C.WHATSAPP_TEMPLATES.map((t) => ({ key: t.key, label: t.label })),
    };
  }
  if (pathname === '/dashboard' && method === 'GET') return dashboard(user);

  // vehicles
  if (seg[0] === 'vehicles') {
    if (seg.length === 1 && method === 'GET') return vehiclesList();
    if (seg.length === 1 && method === 'POST') {
      requireRole(user, 'admin');
      const v = { id: nextId(db.vehicles), name: body.name, category: body.category || null, capacity: body.capacity || null, services: body.services || null, status: body.status || 'Available', notes: body.notes || null, created_at: nowISO() };
      if (!v.name) throw err('Vehicle name is required', 400);
      db.vehicles.push(v); save(); return v;
    }
    const vid = Number(seg[1]);
    if (seg[2] === 'availability' && method === 'GET') {
      if (!query.date || !query.start) throw err('date and start are required', 400);
      return checkAvailability({ vehicleId: vid, date: query.date, startTime: query.start, endTime: query.end, excludeId: query.excludeId ? Number(query.excludeId) : null });
    }
    if (seg[2] === 'schedule' && method === 'GET') {
      return db.bookings.filter((b) => b.vehicle_id === vid && b.booking_status !== 'Cancelled').sort((a, b) => b.start_dt.localeCompare(a.start_dt))
        .map((b) => ({ id: b.id, reference: b.reference, travel_date: b.travel_date, pickup_time: b.pickup_time, end_time: b.end_time, trip_type: b.trip_type, booking_status: b.booking_status, customer_name: (findCustomer(b.customer_id) || {}).full_name }));
    }
    if (seg[2] === 'status' && method === 'PATCH') {
      requireRole(user, 'admin', 'staff');
      const v = findVehicle(vid); if (!v) throw err('Vehicle not found', 404);
      if (!C.VEHICLE_STATUSES.includes(body.status)) throw err('Invalid vehicle status', 400);
      v.status = body.status; save(); return v;
    }
    if (seg.length === 2 && method === 'PUT') {
      requireRole(user, 'admin');
      const v = findVehicle(vid); if (!v) throw err('Vehicle not found', 404);
      Object.assign(v, { name: body.name ?? v.name, category: body.category ?? null, capacity: body.capacity ?? null, services: body.services ?? null, status: body.status ?? v.status, notes: body.notes ?? null });
      save(); return v;
    }
    if (seg.length === 2 && method === 'GET') { const v = findVehicle(vid); if (!v) throw err('Vehicle not found', 404); return v; }
  }

  // customers
  if (seg[0] === 'customers') {
    requireRole(user, 'admin', 'staff');
    if (seg.length === 1 && method === 'GET') return customersList(query.search);
    if (seg.length === 1 && method === 'POST') {
      if (!body.full_name) throw err('Customer name is required', 400);
      const c = { id: nextId(db.customers), full_name: body.full_name, phone: body.phone || null, whatsapp: body.whatsapp || null, email: body.email || null, notes: body.notes || null, created_at: nowISO() };
      db.customers.push(c); save(); return c;
    }
    const cid = Number(seg[1]);
    if (seg.length === 2 && method === 'GET') return customerDetail(cid);
    if (seg.length === 2 && method === 'PUT') {
      const c = findCustomer(cid); if (!c) throw err('Customer not found', 404);
      Object.assign(c, { full_name: body.full_name ?? c.full_name, phone: body.phone || null, whatsapp: body.whatsapp || null, email: body.email || null, notes: body.notes || null });
      save(); return c;
    }
  }

  // bookings
  if (seg[0] === 'bookings') {
    if (seg.length === 1 && method === 'GET') {
      let rows = db.bookings.map(enrich);
      if (user.role === 'driver') rows = rows.filter((b) => b.driver_id === user.id);
      if (query.status) rows = rows.filter((b) => b.booking_status === query.status);
      if (query.vehicleId) rows = rows.filter((b) => b.vehicle_id === Number(query.vehicleId));
      if (query.tripType) rows = rows.filter((b) => b.trip_type === query.tripType);
      if (query.from) rows = rows.filter((b) => b.travel_date >= query.from);
      if (query.to) rows = rows.filter((b) => b.travel_date <= query.to);
      if (query.search) {
        const s = query.search.toLowerCase();
        rows = rows.filter((b) => (b.customer_name || '').toLowerCase().includes(s) || (b.reference || '').toLowerCase().includes(s) || (b.pickup_location || '').toLowerCase().includes(s));
      }
      rows.sort((a, b) => (query.scope === 'calendar' ? a.start_dt.localeCompare(b.start_dt) : b.start_dt.localeCompare(a.start_dt)));
      return rows;
    }
    if (seg.length === 1 && method === 'POST') {
      requireRole(user, 'admin', 'staff');
      const b = createBooking(body, { override: !!body.override }); save(); return b;
    }
    const bid = Number(seg[1]);
    if (seg.length === 2 && method === 'GET') {
      const b = getBooking(bid); if (!b) throw err('Booking not found', 404);
      if (user.role === 'driver' && b.driver_id !== user.id) throw err('You do not have permission for this action', 403);
      return { ...b, payments: listPayments(bid) };
    }
    if (seg.length === 2 && method === 'PUT') {
      requireRole(user, 'admin', 'staff');
      const b = updateBooking(bid, body); save(); return b;
    }
    if (seg.length === 2 && method === 'DELETE') {
      requireRole(user, 'admin');
      const i = db.bookings.findIndex((x) => x.id === bid); if (i < 0) throw err('Booking not found', 404);
      db.bookings.splice(i, 1); db.payments = db.payments.filter((p) => p.booking_id !== bid); save(); return { ok: true };
    }
    if (seg[2] === 'status' && method === 'PATCH') {
      if (!C.BOOKING_STATUSES.includes(body.status)) throw err('Invalid booking status', 400);
      const b = getBooking(bid); if (!b) throw err('Booking not found', 404);
      if (user.role === 'driver') {
        const allowed = ['Picked Up', 'Trip In Progress', 'Completed'];
        if (b.driver_id !== user.id || !allowed.includes(body.status)) throw err('You do not have permission for this action', 403);
      }
      const out = updateBooking(bid, { booking_status: body.status }); save(); return out;
    }
    if (seg[2] === 'payments' && method === 'POST') {
      requireRole(user, 'admin', 'staff');
      const b = recordPayment(bid, body); save(); return { ...b, payments: listPayments(bid) };
    }
    if (seg[2] === 'whatsapp' && method === 'GET') {
      const b = getBooking(bid); if (!b) throw err('Booking not found', 404);
      if (user.role === 'driver' && b.driver_id !== user.id) throw err('You do not have permission for this action', 403);
      return buildWhatsapp(bid, query.template || 'confirmation');
    }
  }

  // reports
  if (seg[0] === 'reports') {
    requireRole(user, 'admin', 'staff');
    const year = new Date().getFullYear();
    const from = query.from || `${year}-01-01`;
    const to = query.to || `${year}-12-31`;
    if (seg[1] === 'revenue') return revenueReport(from, to);
    if (seg[1] === 'vehicles') return vehicleReport(from, to);
  }

  // users
  if (seg[0] === 'users') {
    if (seg[1] === 'drivers' && method === 'GET') {
      requireRole(user, 'admin', 'staff');
      return db.users.filter((u) => u.role === 'driver' && u.active).map((u) => ({ id: u.id, name: u.name, phone: u.phone }));
    }
    requireRole(user, 'admin');
    if (seg.length === 1 && method === 'GET') return db.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, active: u.active, created_at: u.created_at })).sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
    if (seg.length === 1 && method === 'POST') {
      if (!body.name || !body.email || !body.password) throw err('Name, email and password are required', 400);
      if (body.role && !C.ROLES.includes(body.role)) throw err('Invalid role', 400);
      const email = String(body.email).toLowerCase().trim();
      if (db.users.some((u) => u.email === email)) throw err('A user with that email already exists', 409);
      const u = { id: nextId(db.users), name: body.name, email, password: body.password, role: body.role || 'staff', phone: body.phone || null, active: 1, created_at: nowISO() };
      db.users.push(u); save(); return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, active: u.active };
    }
    const uid = Number(seg[1]);
    if (seg.length === 2 && method === 'PUT') {
      const u = findUser(uid); if (!u) throw err('User not found', 404);
      if (body.role && !C.ROLES.includes(body.role)) throw err('Invalid role', 400);
      Object.assign(u, { name: body.name ?? u.name, role: body.role ?? u.role, phone: body.phone ?? u.phone, active: body.active === undefined ? u.active : (body.active ? 1 : 0) });
      if (body.password) u.password = body.password;
      save(); return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, active: u.active };
    }
  }

  throw err(`Not found: ${method} ${pathname}`, 404);
}
