// Browser-mode copy of the server constants (src/constants.js), as ES exports.
export const BUSINESS = {
  name: 'LifeLine Tours',
  parent: 'Lyfe Computer Technologies',
  address: 'Penzance Avenue, Hout Bay, Cape Town, South Africa',
  phone: '0718281221',
  whatsapp: '0718281221',
  email: 'info@lyfecomputertechnologies.co.za',
  currency: 'R',
  countryDial: '27',
};

export const ROLES = ['admin', 'staff', 'driver'];

export const TRIP_TYPES = [
  'Airport Transfer', 'Tour', 'Family Trip', 'Group Trip',
  'Wedding', 'Matric Dance', 'VIP Transfer', 'Corporate Trip',
];

export const BOOKING_STATUSES = [
  'New Request', 'Confirmed', 'Deposit Received', 'Driver Assigned',
  'Picked Up', 'Trip In Progress', 'Completed', 'Cancelled',
];

export const PAYMENT_STATUSES = ['Deposit Pending', 'Deposit Paid', 'Fully Paid', 'Outstanding'];
export const PAYMENT_METHODS = ['Cash', 'EFT'];
export const VEHICLE_STATUSES = ['Available', 'Booked', 'Maintenance'];

export const RULES = { minNoticeHours: 24, depositPercent: 50 };

export const PRICING = [
  {
    vehicle: 'Hummer H3',
    lines: [
      { service: 'Matric Dance', detail: 'R1800 for 3 hours · +R300 per extra hour' },
      { service: 'Weddings', detail: 'R2500 for 3 hours · Full day R3800' },
    ],
  },
  {
    vehicle: 'Hyundai H1 2017',
    lines: [
      { service: 'Airport Transfer — Cape Town Metro', detail: 'R1200' },
      { service: 'Airport Transfer — Outside Cape Town', detail: 'From R1600' },
      { service: 'Daily Hire — Cape Town Local', detail: 'From R3500' },
      { service: 'Daily Hire — Outside Cape Town', detail: 'From R4500' },
      { service: 'Hourly Rate', detail: 'From R500 / hour' },
    ],
  },
];

export const WHATSAPP_TEMPLATES = [
  {
    key: 'confirmation',
    label: 'Booking Confirmation',
    body: [
      'Dear {customer},', '', 'Your LifeLine Tours booking has been confirmed.', '',
      'Reference: {reference}', 'Vehicle: {vehicle}', 'Date: {date}',
      'Pickup Time: {time}', 'Pickup Location: {pickup}', '',
      'Thank you for choosing LifeLine Tours.',
    ].join('\n'),
  },
  {
    key: 'deposit_reminder',
    label: 'Deposit Reminder',
    body: [
      'Dear {customer},', '', 'Thank you for booking with LifeLine Tours (Ref {reference}).',
      'To secure your trip on {date}, a 50% deposit of R{deposit} is required.',
      'Balance due: R{balance}.', '', 'Payment methods: Cash or EFT.',
      'Reply to this message once paid and we will confirm. Thank you!',
    ].join('\n'),
  },
  {
    key: 'driver_assigned',
    label: 'Driver & Pickup Details',
    body: [
      'Dear {customer},', '', 'Your LifeLine Tours trip is all set (Ref {reference}).',
      'Date: {date} at {time}', 'Vehicle: {vehicle}', 'Driver: {driver}',
      'Pickup: {pickup}', 'Drop-off: {dropoff}', '',
      'We look forward to driving you. Safe travels!',
    ].join('\n'),
  },
  {
    key: 'trip_reminder',
    label: 'Trip Reminder',
    body: [
      'Hi {customer}, a friendly reminder of your LifeLine Tours trip tomorrow.', '',
      'Date: {date}', 'Pickup Time: {time}', 'Pickup Location: {pickup}', 'Vehicle: {vehicle}', '',
      'Please be ready 5 minutes early. Any questions? Just reply here.',
    ].join('\n'),
  },
];
