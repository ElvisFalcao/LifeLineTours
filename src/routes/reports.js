const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');
const { asyncHandler, round2 } = require('../util');

const router = express.Router();
router.use(authRequired, requireRole('admin', 'staff'));

function dateRange(req) {
  const year = new Date().getFullYear();
  const from = req.query.from || `${year}-01-01`;
  const to = req.query.to || `${year}-12-31`;
  return { from, to };
}

// Revenue report: totals, monthly series, breakdown by trip type.
router.get(
  '/revenue',
  asyncHandler((req, res) => {
    const { from, to } = dateRange(req);
    const base = `FROM bookings WHERE travel_date BETWEEN ? AND ? AND booking_status != 'Cancelled'`;

    const totals = db
      .prepare(
        `SELECT COUNT(*) AS total_bookings,
                COALESCE(SUM(amount),0) AS total_contracted,
                COALESCE(SUM(amount_paid),0) AS total_collected,
                COALESCE(SUM(deposit_amount),0) AS total_deposits,
                COALESCE(SUM(amount - amount_paid),0) AS total_outstanding
         ${base}`
      )
      .get(from, to);

    const byMonth = db
      .prepare(
        `SELECT substr(travel_date,1,7) AS month, COUNT(*) AS bookings,
                COALESCE(SUM(amount_paid),0) AS collected,
                COALESCE(SUM(amount),0) AS contracted
         ${base} GROUP BY month ORDER BY month`
      )
      .all(from, to);

    const byTripType = db
      .prepare(
        `SELECT COALESCE(trip_type,'Unspecified') AS trip_type, COUNT(*) AS bookings,
                COALESCE(SUM(amount_paid),0) AS collected
         ${base} GROUP BY trip_type ORDER BY collected DESC`
      )
      .all(from, to);

    const byPayment = db
      .prepare(`SELECT payment_status, COUNT(*) AS n ${base} GROUP BY payment_status`)
      .all(from, to);

    res.json({
      range: { from, to },
      totals: {
        total_bookings: totals.total_bookings,
        total_contracted: round2(totals.total_contracted),
        total_collected: round2(totals.total_collected),
        total_deposits: round2(totals.total_deposits),
        total_outstanding: round2(totals.total_outstanding),
      },
      byMonth,
      byTripType,
      byPayment,
    });
  })
);

// Vehicle report: per-vehicle trips, revenue, most-used service.
router.get(
  '/vehicles',
  asyncHandler((req, res) => {
    const { from, to } = dateRange(req);
    const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY name').all();
    const report = vehicles.map((v) => {
      const stats = db
        .prepare(
          `SELECT COUNT(*) AS total_trips,
                  COALESCE(SUM(amount_paid),0) AS revenue,
                  COALESCE(SUM(amount),0) AS contracted
           FROM bookings
           WHERE vehicle_id = ? AND travel_date BETWEEN ? AND ? AND booking_status != 'Cancelled'`
        )
        .get(v.id, from, to);
      const topService = db
        .prepare(
          `SELECT trip_type, COUNT(*) AS n FROM bookings
           WHERE vehicle_id = ? AND travel_date BETWEEN ? AND ? AND booking_status != 'Cancelled' AND trip_type IS NOT NULL
           GROUP BY trip_type ORDER BY n DESC LIMIT 1`
        )
        .get(v.id, from, to);
      return {
        id: v.id,
        name: v.name,
        category: v.category,
        total_trips: stats.total_trips,
        revenue: round2(stats.revenue),
        contracted: round2(stats.contracted),
        most_used_service: topService ? topService.trip_type : '—',
      };
    });
    res.json({ range: { from, to }, vehicles: report });
  })
);

module.exports = router;
