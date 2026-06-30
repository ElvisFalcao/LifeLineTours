// Core booking domain logic: availability, creation, updates, payments.
const { db } = require('./db');
const {
  AppError,
  nowISO,
  addHoursToTime,
  paymentStatusFor,
  round2,
  normalizePhone,
} = require('./util');
const { RULES, WHATSAPP_TEMPLATES, BUSINESS } = require('./constants');

const BOOKING_SELECT = `
  SELECT
    b.*,
    c.full_name      AS customer_name,
    c.phone          AS customer_phone,
    c.whatsapp       AS customer_whatsapp,
    c.email          AS customer_email,
    v.name           AS vehicle_name,
    v.category       AS vehicle_category,
    v.capacity       AS vehicle_capacity,
    d.name           AS driver_name,
    d.phone          AS driver_phone
  FROM bookings b
  JOIN customers c ON c.id = b.customer_id
  JOIN vehicles  v ON v.id = b.vehicle_id
  LEFT JOIN users d ON d.id = b.driver_id
`;

function getBooking(id) {
  return db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id) || null;
}

function resolveEndTime(pickupTime, endTime) {
  if (endTime && endTime > pickupTime) return endTime;
  return addHoursToTime(pickupTime, 3); // sensible default trip window
}

// Returns { available, conflicts:[], reason }.
function checkAvailability({ vehicleId, date, startTime, endTime, excludeId = null }) {
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
  if (!vehicle) return { available: false, conflicts: [], reason: 'Vehicle not found' };
  if (vehicle.status === 'Maintenance') {
    return { available: false, conflicts: [], reason: `${vehicle.name} is under maintenance` };
  }
  const resolvedEnd = resolveEndTime(startTime, endTime);
  const start = `${date}T${startTime}`;
  const end = `${date}T${resolvedEnd}`;
  // Overlap: existing.start < requested.end AND existing.end > requested.start
  const params = [vehicleId, end, start];
  let sql = `
    SELECT b.id, b.reference, b.travel_date, b.pickup_time, b.end_time,
           c.full_name AS customer_name, b.booking_status
    FROM bookings b
    JOIN customers c ON c.id = b.customer_id
    WHERE b.vehicle_id = ?
      AND b.booking_status != 'Cancelled'
      AND b.start_dt < ?
      AND b.end_dt > ?`;
  if (excludeId) {
    sql += ' AND b.id != ?';
    params.push(excludeId);
  }
  const conflicts = db.prepare(sql).all(...params);
  return {
    available: conflicts.length === 0,
    conflicts,
    reason: conflicts.length ? `${vehicle.name} is already booked for an overlapping time` : null,
  };
}

function assertNotice(travelDate, pickupTime, override) {
  if (override) return;
  const start = new Date(`${travelDate}T${pickupTime}:00`).getTime();
  if (Number.isNaN(start)) return;
  if (start < Date.now() + RULES.minNoticeHours * 3600 * 1000) {
    throw new AppError(
      `Bookings normally need ${RULES.minNoticeHours} hours notice. Confirm to override.`,
      422,
      'NOTICE_24H'
    );
  }
}

function createBooking(data, opts = {}) {
  const required = ['customer_id', 'vehicle_id', 'travel_date', 'pickup_time'];
  for (const f of required) {
    if (!data[f]) throw new AppError(`Missing required field: ${f}`, 400);
  }
  assertNotice(data.travel_date, data.pickup_time, opts.override);

  const endTime = resolveEndTime(data.pickup_time, data.end_time);
  const avail = checkAvailability({
    vehicleId: data.vehicle_id,
    date: data.travel_date,
    startTime: data.pickup_time,
    endTime,
  });
  if (!avail.available) throw new AppError(avail.reason, 409, 'UNAVAILABLE');

  const amount = round2(data.amount);
  const deposit =
    data.deposit_amount !== undefined && data.deposit_amount !== null && data.deposit_amount !== ''
      ? round2(data.deposit_amount)
      : round2((amount * RULES.depositPercent) / 100);
  const created = nowISO();
  const startDt = `${data.travel_date}T${data.pickup_time}`;
  const endDt = `${data.travel_date}T${endTime}`;
  const paymentStatus = paymentStatusFor({ amount, depositAmount: deposit, amountPaid: 0 });

  const info = db
    .prepare(
      `INSERT INTO bookings
        (reference, customer_id, vehicle_id, driver_id, trip_type, travel_date, pickup_time,
         end_time, start_dt, end_dt, pickup_location, dropoff_location, passengers, amount,
         deposit_amount, amount_paid, payment_method, payment_status, booking_status, notes,
         created_at, updated_at)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.customer_id,
      data.vehicle_id,
      data.driver_id || null,
      data.trip_type || null,
      data.travel_date,
      data.pickup_time,
      endTime,
      startDt,
      endDt,
      data.pickup_location || null,
      data.dropoff_location || null,
      data.passengers || null,
      amount,
      deposit,
      data.payment_method || null,
      paymentStatus,
      data.booking_status || 'New Request',
      data.notes || null,
      created,
      created
    );

  const id = Number(info.lastInsertRowid);
  const reference = `LLT-${created.slice(0, 4)}-${String(id).padStart(4, '0')}`;
  db.prepare('UPDATE bookings SET reference = ? WHERE id = ?').run(reference, id);
  return getBooking(id);
}

function updateBooking(id, data, opts = {}) {
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  if (!existing) throw new AppError('Booking not found', 404);

  const merged = { ...existing, ...data };
  const travelDate = merged.travel_date;
  const pickupTime = merged.pickup_time;
  const endTime = resolveEndTime(pickupTime, data.end_time !== undefined ? data.end_time : existing.end_time);

  // Re-check availability when timing or vehicle changed.
  const timingChanged =
    data.vehicle_id !== undefined ||
    data.travel_date !== undefined ||
    data.pickup_time !== undefined ||
    data.end_time !== undefined;
  if (timingChanged && merged.booking_status !== 'Cancelled') {
    assertNotice(travelDate, pickupTime, opts.override);
    const avail = checkAvailability({
      vehicleId: merged.vehicle_id,
      date: travelDate,
      startTime: pickupTime,
      endTime,
      excludeId: id,
    });
    if (!avail.available) throw new AppError(avail.reason, 409, 'UNAVAILABLE');
  }

  const amount = round2(merged.amount);
  const deposit = round2(merged.deposit_amount);
  const amountPaid = round2(merged.amount_paid);
  const paymentStatus = data.payment_status || paymentStatusFor({ amount, depositAmount: deposit, amountPaid });
  const startDt = `${travelDate}T${pickupTime}`;
  const endDt = `${travelDate}T${endTime}`;

  db.prepare(
    `UPDATE bookings SET
       customer_id = ?, vehicle_id = ?, driver_id = ?, trip_type = ?, travel_date = ?,
       pickup_time = ?, end_time = ?, start_dt = ?, end_dt = ?, pickup_location = ?,
       dropoff_location = ?, passengers = ?, amount = ?, deposit_amount = ?, payment_method = ?,
       payment_status = ?, booking_status = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    merged.customer_id,
    merged.vehicle_id,
    merged.driver_id || null,
    merged.trip_type || null,
    travelDate,
    pickupTime,
    endTime,
    startDt,
    endDt,
    merged.pickup_location || null,
    merged.dropoff_location || null,
    merged.passengers || null,
    amount,
    deposit,
    merged.payment_method || null,
    paymentStatus,
    merged.booking_status,
    merged.notes || null,
    nowISO(),
    id
  );
  return getBooking(id);
}

function recordPayment(bookingId, { amount, method, note }) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);
  const pay = round2(amount);
  if (!(pay > 0)) throw new AppError('Payment amount must be greater than zero', 400);

  const created = nowISO();
  db.prepare('INSERT INTO payments (booking_id, amount, method, note, created_at) VALUES (?, ?, ?, ?, ?)').run(
    bookingId,
    pay,
    method || null,
    note || null,
    created
  );

  const newPaid = round2(booking.amount_paid + pay);
  const status = paymentStatusFor({
    amount: booking.amount,
    depositAmount: booking.deposit_amount,
    amountPaid: newPaid,
  });

  // Auto-advance an early-stage booking once the deposit is covered.
  let bookingStatus = booking.booking_status;
  if (
    (status === 'Deposit Paid' || status === 'Fully Paid') &&
    ['New Request', 'Confirmed'].includes(bookingStatus)
  ) {
    bookingStatus = 'Deposit Received';
  }

  db.prepare(
    'UPDATE bookings SET amount_paid = ?, payment_status = ?, booking_status = ?, payment_method = COALESCE(?, payment_method), updated_at = ? WHERE id = ?'
  ).run(newPaid, status, bookingStatus, method || null, created, bookingId);

  return getBooking(bookingId);
}

function listPayments(bookingId) {
  return db.prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at').all(bookingId);
}

// Build a filled WhatsApp message + wa.me deep link for a booking.
function buildWhatsappMessage(bookingId, templateKey) {
  const booking = getBooking(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);
  const template = WHATSAPP_TEMPLATES.find((t) => t.key === templateKey) || WHATSAPP_TEMPLATES[0];

  const balance = round2(booking.amount - booking.amount_paid);
  const fields = {
    customer: booking.customer_name || 'Customer',
    reference: booking.reference || '',
    vehicle: booking.vehicle_name || '',
    date: formatLongDate(booking.travel_date),
    time: booking.pickup_time || '',
    pickup: booking.pickup_location || '—',
    dropoff: booking.dropoff_location || '—',
    driver: booking.driver_name || 'To be assigned',
    amount: booking.amount?.toFixed(0) || '0',
    deposit: booking.deposit_amount?.toFixed(0) || '0',
    balance: balance.toFixed(0),
  };
  const text = template.body.replace(/\{(\w+)\}/g, (_, k) => (fields[k] !== undefined ? fields[k] : `{${k}}`));
  const phone = normalizePhone(booking.customer_whatsapp || booking.customer_phone, BUSINESS.countryDial);
  const link = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  return { text, link, template: template.key, label: template.label };
}

function formatLongDate(d) {
  if (!d) return '';
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

module.exports = {
  getBooking,
  checkAvailability,
  createBooking,
  updateBooking,
  recordPayment,
  listPayments,
  buildWhatsappMessage,
  BOOKING_SELECT,
};
