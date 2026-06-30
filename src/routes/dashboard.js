const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../auth');
const { asyncHandler, todayStr, round2 } = require('../util');
const { BOOKING_SELECT } = require('../services');

const router = express.Router();
router.use(authRequired);

router.get(
  '/',
  asyncHandler((req, res) => {
    const today = todayStr();
    const month = today.slice(0, 7); // YYYY-MM
    const driverFilter = req.user.role === 'driver' ? ' AND b.driver_id = ' + Number(req.user.id) : '';

    const todays = db
      .prepare(`${BOOKING_SELECT} WHERE b.travel_date = ? AND b.booking_status != 'Cancelled'${driverFilter} ORDER BY b.pickup_time`)
      .all(today);

    const upcoming = db
      .prepare(
        `${BOOKING_SELECT} WHERE b.travel_date > ? AND b.booking_status NOT IN ('Cancelled','Completed')${driverFilter} ORDER BY b.start_dt LIMIT 8`
      )
      .all(today);

    const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY name').all();
    const nowDt = new Date().toISOString().slice(0, 16);
    const vehicleStatus = vehicles.map((v) => {
      if (v.status === 'Maintenance') return { ...v, liveStatus: 'Maintenance' };
      const busy = db
        .prepare(
          `SELECT 1 FROM bookings WHERE vehicle_id = ? AND booking_status != 'Cancelled' AND start_dt <= ? AND end_dt >= ? LIMIT 1`
        )
        .get(v.id, nowDt, nowDt);
      return { ...v, liveStatus: busy ? 'Busy' : 'Available' };
    });

    // Money figures (admin/staff only — drivers get zeros).
    let monthlyRevenue = 0;
    let outstanding = 0;
    let monthExpected = 0;
    if (req.user.role !== 'driver') {
      monthlyRevenue = round2(
        db
          .prepare(
            `SELECT COALESCE(SUM(amount_paid),0) AS s FROM bookings WHERE substr(travel_date,1,7) = ? AND booking_status != 'Cancelled'`
          )
          .get(month).s
      );
      monthExpected = round2(
        db
          .prepare(
            `SELECT COALESCE(SUM(amount),0) AS s FROM bookings WHERE substr(travel_date,1,7) = ? AND booking_status != 'Cancelled'`
          )
          .get(month).s
      );
      outstanding = round2(
        db
          .prepare(
            `SELECT COALESCE(SUM(amount - amount_paid),0) AS s FROM bookings WHERE booking_status != 'Cancelled' AND amount > amount_paid`
          )
          .get().s
      );
    }

    res.json({
      today,
      todaysBookings: todays,
      upcoming,
      vehicles: vehicleStatus,
      available: vehicleStatus.filter((v) => v.liveStatus === 'Available').length,
      busy: vehicleStatus.filter((v) => v.liveStatus === 'Busy').length,
      maintenance: vehicleStatus.filter((v) => v.liveStatus === 'Maintenance').length,
      monthlyRevenue,
      monthExpected,
      outstanding,
      counts: {
        todays: todays.length,
        upcoming: db
          .prepare(
            `SELECT COUNT(*) AS n FROM bookings b WHERE b.travel_date > ? AND b.booking_status NOT IN ('Cancelled','Completed')${driverFilter}`
          )
          .get(today).n,
        newRequests: db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE booking_status = 'New Request'`).get().n,
      },
    });
  })
);

module.exports = router;
