const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');
const { asyncHandler, nowISO, AppError } = require('../util');
const { checkAvailability } = require('../services');
const { VEHICLE_STATUSES } = require('../constants');

const router = express.Router();
router.use(authRequired);

// List vehicles, each annotated with whether it is busy right now.
router.get(
  '/',
  asyncHandler((req, res) => {
    const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY name').all();
    const nowDt = nowISO().slice(0, 16); // YYYY-MM-DDTHH:MM
    const today = nowDt.slice(0, 10);
    const result = vehicles.map((v) => {
      const current = db
        .prepare(
          `SELECT b.id, b.reference, b.booking_status, c.full_name AS customer_name
           FROM bookings b JOIN customers c ON c.id = b.customer_id
           WHERE b.vehicle_id = ? AND b.booking_status != 'Cancelled'
             AND b.start_dt <= ? AND b.end_dt >= ? LIMIT 1`
        )
        .get(v.id, nowDt, nowDt);
      const todayCount = db
        .prepare(
          `SELECT COUNT(*) AS n FROM bookings WHERE vehicle_id = ? AND travel_date = ? AND booking_status != 'Cancelled'`
        )
        .get(v.id, today).n;
      let liveStatus = v.status;
      if (v.status !== 'Maintenance') liveStatus = current ? 'Busy' : 'Available';
      return { ...v, liveStatus, currentTrip: current || null, todayCount };
    });
    res.json(result);
  })
);

router.get(
  '/:id',
  asyncHandler((req, res) => {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!vehicle) throw new AppError('Vehicle not found', 404);
    res.json(vehicle);
  })
);

// Availability check for a vehicle within a window.
router.get(
  '/:id/availability',
  asyncHandler((req, res) => {
    const { date, start, end, excludeId } = req.query;
    if (!date || !start) throw new AppError('date and start are required', 400);
    const result = checkAvailability({
      vehicleId: Number(req.params.id),
      date,
      startTime: start,
      endTime: end,
      excludeId: excludeId ? Number(excludeId) : null,
    });
    res.json(result);
  })
);

// Upcoming bookings for a vehicle.
router.get(
  '/:id/schedule',
  asyncHandler((req, res) => {
    const rows = db
      .prepare(
        `SELECT b.id, b.reference, b.travel_date, b.pickup_time, b.end_time, b.trip_type, b.booking_status,
                c.full_name AS customer_name
         FROM bookings b JOIN customers c ON c.id = b.customer_id
         WHERE b.vehicle_id = ? AND b.booking_status != 'Cancelled'
         ORDER BY b.start_dt DESC LIMIT 50`
      )
      .all(req.params.id);
    res.json(rows);
  })
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const { name, category, capacity, services, status, notes } = req.body || {};
    if (!name) throw new AppError('Vehicle name is required', 400);
    const info = db
      .prepare(
        'INSERT INTO vehicles (name, category, capacity, services, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(name, category || null, capacity || null, services || null, status || 'Available', notes || null, nowISO());
    res.status(201).json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!vehicle) throw new AppError('Vehicle not found', 404);
    const m = { ...vehicle, ...req.body };
    if (m.status && !VEHICLE_STATUSES.includes(m.status)) throw new AppError('Invalid vehicle status', 400);
    db.prepare(
      'UPDATE vehicles SET name = ?, category = ?, capacity = ?, services = ?, status = ?, notes = ? WHERE id = ?'
    ).run(m.name, m.category || null, m.capacity || null, m.services || null, m.status, m.notes || null, req.params.id);
    res.json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id));
  })
);

// Quick status toggle (Available / Maintenance) — admin or staff.
router.patch(
  '/:id/status',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    const { status } = req.body || {};
    if (!VEHICLE_STATUSES.includes(status)) throw new AppError('Invalid vehicle status', 400);
    const info = db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(status, req.params.id);
    if (!info.changes) throw new AppError('Vehicle not found', 404);
    res.json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id));
  })
);

module.exports = router;
