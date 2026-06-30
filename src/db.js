// SQLite database using Node's built-in node:sqlite (no native build needed).
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('./config');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'staff',
    phone         TEXT,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    category    TEXT,
    capacity    INTEGER,
    services    TEXT,
    status      TEXT NOT NULL DEFAULT 'Available',
    notes       TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name   TEXT NOT NULL,
    phone       TEXT,
    whatsapp    TEXT,
    email       TEXT,
    notes       TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reference       TEXT UNIQUE,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id),
    driver_id       INTEGER REFERENCES users(id),
    trip_type       TEXT,
    travel_date     TEXT NOT NULL,
    pickup_time     TEXT NOT NULL,
    end_time        TEXT,
    start_dt        TEXT NOT NULL,
    end_dt          TEXT NOT NULL,
    pickup_location TEXT,
    dropoff_location TEXT,
    passengers      INTEGER,
    amount          REAL NOT NULL DEFAULT 0,
    deposit_amount  REAL NOT NULL DEFAULT 0,
    amount_paid     REAL NOT NULL DEFAULT 0,
    payment_method  TEXT,
    payment_status  TEXT NOT NULL DEFAULT 'Deposit Pending',
    booking_status  TEXT NOT NULL DEFAULT 'New Request',
    notes           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount      REAL NOT NULL,
    method      TEXT,
    note        TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(travel_date);
  CREATE INDEX IF NOT EXISTS idx_bookings_window ON bookings(vehicle_id, start_dt, end_dt);
  CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
`);

module.exports = { db };
