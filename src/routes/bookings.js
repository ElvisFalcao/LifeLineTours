const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');
const { asyncHandler, AppError } = require('../util');
const {
  getBooking,
  createBooking,
  updateBooking,
  recordPayment,
  listPayments,
  buildWhatsappMessage,
  BOOKING_SELECT,
} = require('../services');
const { BOOKING_STATUSES } = require('../constants');

const router = express.Router();
router.use(authRequired);

// List bookings with filters. Drivers only see their own assigned trips.
router.get(
  '/',
  asyncHandler((req, res) => {
    const { status, vehicleId, from, to, search, tripType, scope } = req.query;
    const where = [];
    const params = [];

    if (req.user.role === 'driver') {
      where.push('b.driver_id = ?');
      params.push(req.user.id);
    }
    if (status) {
      where.push('b.booking_status = ?');
      params.push(status);
    }
    if (vehicleId) {
      where.push('b.vehicle_id = ?');
      params.push(Number(vehicleId));
    }
    if (tripType) {
      where.push('b.trip_type = ?');
      params.push(tripType);
    }
    if (from) {
      where.push('b.travel_date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('b.travel_date <= ?');
      params.push(to);
    }
    if (search) {
      where.push('(c.full_name LIKE ? OR b.reference LIKE ? OR b.pickup_location LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const order = scope === 'calendar' ? 'b.start_dt ASC' : 'b.start_dt DESC';
    const rows = db.prepare(`${BOOKING_SELECT} ${clause} ORDER BY ${order} LIMIT 500`).all(...params);
    res.json(rows);
  })
);

router.get(
  '/:id',
  asyncHandler((req, res) => {
    const booking = getBooking(req.params.id);
    if (!booking) throw new AppError('Booking not found', 404);
    if (req.user.role === 'driver' && booking.driver_id !== req.user.id) {
      throw new AppError('You do not have permission for this action', 403);
    }
    booking.payments = listPayments(booking.id);
    res.json(booking);
  })
);

router.post(
  '/',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    const booking = createBooking(req.body || {}, { override: !!req.body.override });
    res.status(201).json(booking);
  })
);

router.put(
  '/:id',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    const booking = updateBooking(Number(req.params.id), req.body || {}, { override: !!req.body.override });
    res.json(booking);
  })
);

// Update booking workflow status. Drivers may advance their own trips.
router.patch(
  '/:id/status',
  asyncHandler((req, res) => {
    const { status } = req.body || {};
    if (!BOOKING_STATUSES.includes(status)) throw new AppError('Invalid booking status', 400);
    const booking = getBooking(req.params.id);
    if (!booking) throw new AppError('Booking not found', 404);
    if (req.user.role === 'driver') {
      const allowed = ['Picked Up', 'Trip In Progress', 'Completed'];
      if (booking.driver_id !== req.user.id || !allowed.includes(status)) {
        throw new AppError('You do not have permission for this action', 403);
      }
    }
    const updated = updateBooking(Number(req.params.id), { booking_status: status });
    res.json(updated);
  })
);

router.post(
  '/:id/payments',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    const { amount, method, note } = req.body || {};
    const booking = recordPayment(Number(req.params.id), { amount, method, note });
    booking.payments = listPayments(booking.id);
    res.status(201).json(booking);
  })
);

router.get(
  '/:id/whatsapp',
  asyncHandler((req, res) => {
    const booking = getBooking(req.params.id);
    if (!booking) throw new AppError('Booking not found', 404);
    if (req.user.role === 'driver' && booking.driver_id !== req.user.id) {
      throw new AppError('You do not have permission for this action', 403);
    }
    res.json(buildWhatsappMessage(Number(req.params.id), req.query.template || 'confirmation'));
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const info = db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
    if (!info.changes) throw new AppError('Booking not found', 404);
    res.json({ ok: true });
  })
);

module.exports = router;
