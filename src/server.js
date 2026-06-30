const express = require('express');
const path = require('path');
const { PORT, PUBLIC_DIR } = require('./config');
const { AppError } = require('./util');
require('./db'); // initialise schema
const seed = require('./seed');

const app = express();
app.use(express.json());

// Lightweight request logger.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/invoices', require('./routes/invoices'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'LifeLine Tours API' }));

// Static frontend
app.use(express.static(PUBLIC_DIR));

// SPA fallback for non-API GET requests.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

seed.run();

app.listen(PORT, () => {
  console.log('');
  console.log('  LifeLine Tours — Booking & Fleet Management');
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log('  Login: admin@lifelinetours.co.za / admin123');
  console.log('');
});
