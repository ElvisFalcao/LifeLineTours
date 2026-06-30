const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, authRequired } = require('../auth');
const { asyncHandler } = require('../util');

const router = express.Router();

router.post(
  '/login',
  asyncHandler((req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(String(email).toLowerCase().trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  })
);

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
