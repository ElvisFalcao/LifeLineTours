const express = require('express');
const { authRequired } = require('../auth');
const constants = require('../constants');

const router = express.Router();

// Single source of truth for enums, pricing, business info and templates.
router.get('/', authRequired, (req, res) => {
  res.json({
    business: constants.BUSINESS,
    roles: constants.ROLES,
    tripTypes: constants.TRIP_TYPES,
    bookingStatuses: constants.BOOKING_STATUSES,
    paymentStatuses: constants.PAYMENT_STATUSES,
    paymentMethods: constants.PAYMENT_METHODS,
    vehicleStatuses: constants.VEHICLE_STATUSES,
    rules: constants.RULES,
    pricing: constants.PRICING,
    whatsappTemplates: constants.WHATSAPP_TEMPLATES.map((t) => ({ key: t.key, label: t.label })),
  });
});

module.exports = router;
