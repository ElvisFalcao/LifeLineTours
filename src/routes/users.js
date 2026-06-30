const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');
const { asyncHandler, nowISO, AppError } = require('../util');
const { ROLES } = require('../constants');

const router = express.Router();
router.use(authRequired);

// Drivers list — available to admin/staff for assigning bookings.
router.get(
  '/drivers',
  requireRole('admin', 'staff'),
  asyncHandler((req, res) => {
    res.json(db.prepare("SELECT id, name, phone FROM users WHERE role = 'driver' AND active = 1 ORDER BY name").all());
  })
);

router.get(
  '/',
  requireRole('admin'),
  asyncHandler((req, res) => {
    res.json(db.prepare('SELECT id, name, email, role, phone, active, created_at FROM users ORDER BY role, name').all());
  })
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const { name, email, password, role, phone } = req.body || {};
    if (!name || !email || !password) throw new AppError('Name, email and password are required', 400);
    if (role && !ROLES.includes(role)) throw new AppError('Invalid role', 400);
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
    if (exists) throw new AppError('A user with that email already exists', 409);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role, phone, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
      .run(
        name,
        String(email).toLowerCase().trim(),
        bcrypt.hashSync(password, 10),
        role || 'staff',
        phone || null,
        nowISO()
      );
    res.status(201).json(db.prepare('SELECT id, name, email, role, phone, active FROM users WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) throw new AppError('User not found', 404);
    const { name, role, phone, active, password } = req.body || {};
    if (role && !ROLES.includes(role)) throw new AppError('Invalid role', 400);
    db.prepare('UPDATE users SET name = ?, role = ?, phone = ?, active = ? WHERE id = ?').run(
      name ?? user.name,
      role ?? user.role,
      phone ?? user.phone,
      active === undefined ? user.active : active ? 1 : 0,
      req.params.id
    );
    if (password) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.params.id);
    }
    res.json(db.prepare('SELECT id, name, email, role, phone, active FROM users WHERE id = ?').get(req.params.id));
  })
);

module.exports = router;
