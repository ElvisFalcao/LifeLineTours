const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');
const { asyncHandler, nowISO, AppError } = require('../util');

const router = express.Router();
router.use(authRequired);

// List customers with aggregate history (trips, spend, last booking).
router.get(
  '/',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    const search = (req.query.search || '').trim();
    let sql = `
      SELECT c.*,
        COUNT(b.id) AS trips,
        COALESCE(SUM(CASE WHEN b.booking_status != 'Cancelled' THEN b.amount_paid ELSE 0 END), 0) AS total_spent,
        MAX(b.travel_date) AS last_booking
      FROM customers c
      LEFT JOIN bookings b ON b.customer_id = c.id`;
    const params = [];
    if (search) {
      sql += ' WHERE c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' GROUP BY c.id ORDER BY c.full_name';
    res.json(db.prepare(sql).all(...params));
  })
);

// Customer detail + full trip history.
router.get(
  '/:id',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) throw new AppError('Customer not found', 404);
    const trips = db
      .prepare(
        `SELECT b.id, b.reference, b.travel_date, b.pickup_time, b.trip_type, b.booking_status,
                b.payment_status, b.amount, b.amount_paid, v.name AS vehicle_name
         FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id
         WHERE b.customer_id = ? ORDER BY b.start_dt DESC`
      )
      .all(req.params.id);
    const totalSpent = trips
      .filter((t) => t.booking_status !== 'Cancelled')
      .reduce((s, t) => s + (t.amount_paid || 0), 0);
    res.json({ ...customer, trips, total_spent: totalSpent, trip_count: trips.length });
  })
);

router.post(
  '/',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    const { full_name, phone, whatsapp, email, notes } = req.body || {};
    if (!full_name) throw new AppError('Customer name is required', 400);
    const info = db
      .prepare('INSERT INTO customers (full_name, phone, whatsapp, email, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(full_name, phone || null, whatsapp || null, email || null, notes || null, nowISO());
    res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) throw new AppError('Customer not found', 404);
    const m = { ...customer, ...req.body };
    db.prepare('UPDATE customers SET full_name = ?, phone = ?, whatsapp = ?, email = ?, notes = ? WHERE id = ?').run(
      m.full_name,
      m.phone || null,
      m.whatsapp || null,
      m.email || null,
      m.notes || null,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
  })
);

module.exports = router;
