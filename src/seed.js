// Seeds demo data (users, vehicles, customers, sample bookings) on first run.
const bcrypt = require('bcryptjs');
const { db } = require('./db');
const { nowISO } = require('./util');
const { createBooking, recordPayment } = require('./services');

function dateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function run() {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount > 0) return; // already seeded

  const now = nowISO();
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, phone, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  insertUser.run('System Admin', 'admin@lifelinetours.co.za', bcrypt.hashSync('admin123', 10), 'admin', '0718281221', now);
  insertUser.run('Front Desk', 'staff@lifelinetours.co.za', bcrypt.hashSync('staff123', 10), 'staff', '0710000002', now);
  const driverInfo = insertUser.run(
    'Sipho (Driver)',
    'driver@lifelinetours.co.za',
    bcrypt.hashSync('driver123', 10),
    'driver',
    '0710000003',
    now
  );
  const driverId = Number(driverInfo.lastInsertRowid);

  const insertVehicle = db.prepare(
    'INSERT INTO vehicles (name, category, capacity, services, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const hummerId = Number(
    insertVehicle.run(
      'Hummer H3',
      'Classic VIP Vehicle',
      4,
      'Matric Dance, Weddings, VIP Transfers',
      'Available',
      'Premium VIP vehicle for special occasions.',
      now
    ).lastInsertRowid
  );
  const hyundaiId = Number(
    insertVehicle.run(
      'Hyundai H1 2017',
      'Tours / Family / Group Transfers',
      9,
      'Airport Transfers, Tours, Family Transport, Group Trips',
      'Available',
      '9-seater for tours, airport runs and group travel.',
      now
    ).lastInsertRowid
  );

  const insertCustomer = db.prepare(
    'INSERT INTO customers (full_name, phone, whatsapp, email, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const john = Number(
    insertCustomer.run('John Smith', '0821234567', '0821234567', 'john.smith@example.com', 'Frequent airport client.', now).lastInsertRowid
  );
  const sarah = Number(
    insertCustomer.run('Sarah Adams', '0834567890', '0834567890', 'sarah.adams@example.com', 'Wedding party.', now).lastInsertRowid
  );
  const thabo = Number(
    insertCustomer.run('Thabo Mokoena', '0729876543', '0729876543', 'thabo.m@example.com', 'Matric dance group.', now).lastInsertRowid
  );

  const opts = { override: true }; // bypass 24h-notice rule when seeding

  // Past, completed + fully paid trip (history for John).
  const past = createBooking(
    {
      customer_id: john,
      vehicle_id: hyundaiId,
      driver_id: driverId,
      trip_type: 'Tour',
      travel_date: dateOffset(-12),
      pickup_time: '09:00',
      end_time: '15:00',
      pickup_location: 'V&A Waterfront',
      dropoff_location: 'Cape Point',
      passengers: 6,
      amount: 3500,
      booking_status: 'Completed',
    },
    opts
  );
  recordPayment(past.id, { amount: 3500, method: 'EFT', note: 'Paid in full' });

  // Today — airport transfer, deposit paid, driver assigned.
  const todayBooking = createBooking(
    {
      customer_id: john,
      vehicle_id: hyundaiId,
      driver_id: driverId,
      trip_type: 'Airport Transfer',
      travel_date: dateOffset(0),
      pickup_time: '08:00',
      end_time: '10:00',
      pickup_location: 'Hout Bay',
      dropoff_location: 'Cape Town International Airport',
      passengers: 3,
      amount: 1200,
      booking_status: 'Driver Assigned',
    },
    opts
  );
  recordPayment(todayBooking.id, { amount: 600, method: 'Cash', note: 'Deposit' });

  // Tomorrow — wedding on the Hummer.
  createBooking(
    {
      customer_id: sarah,
      vehicle_id: hummerId,
      trip_type: 'Wedding',
      travel_date: dateOffset(1),
      pickup_time: '14:00',
      end_time: '17:00',
      pickup_location: 'Constantia',
      dropoff_location: 'Groot Constantia Wine Estate',
      passengers: 2,
      amount: 2500,
      booking_status: 'Confirmed',
    },
    opts
  );

  // 15 July 2026 — matches the specification example (Hyundai 10:00–16:00).
  const julyDate = '2026-07-15';
  const julyAirport = createBooking(
    {
      customer_id: john,
      vehicle_id: hyundaiId,
      trip_type: 'Airport Transfer',
      travel_date: julyDate,
      pickup_time: '10:00',
      end_time: '16:00',
      pickup_location: 'Hout Bay',
      dropoff_location: 'Cape Town International Airport',
      passengers: 4,
      amount: 1600,
      booking_status: 'Confirmed',
    },
    opts
  );
  recordPayment(julyAirport.id, { amount: 800, method: 'EFT', note: 'Deposit' });

  // Same day, different vehicle — matric dance on the Hummer.
  createBooking(
    {
      customer_id: thabo,
      vehicle_id: hummerId,
      trip_type: 'Matric Dance',
      travel_date: julyDate,
      pickup_time: '18:00',
      end_time: '21:00',
      pickup_location: 'Sea Point',
      dropoff_location: 'Century City Hotel',
      passengers: 4,
      amount: 1800,
      booking_status: 'New Request',
    },
    opts
  );

  console.log('[seed] Demo data created (users, vehicles, customers, 5 sample bookings).');
}

module.exports = { run };
