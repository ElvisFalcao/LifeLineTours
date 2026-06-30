// Small shared helpers used across the backend.

class AppError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function nowISO() {
  return new Date().toISOString();
}

function todayStr() {
  // Local YYYY-MM-DD
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Wrap async route handlers so thrown errors hit Express error middleware.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Add whole/partial hours to an "HH:MM" string, clamped to 23:59.
function addHoursToTime(time, hours) {
  const [hh, mm] = String(time).split(':').map(Number);
  let total = hh * 60 + mm + Math.round(hours * 60);
  if (total > 23 * 60 + 59) total = 23 * 60 + 59;
  if (total < 0) total = 0;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// Derive a payment status from the spec's allowed set.
function paymentStatusFor({ amount, depositAmount, amountPaid }) {
  amount = Number(amount) || 0;
  depositAmount = Number(depositAmount) || 0;
  amountPaid = Number(amountPaid) || 0;
  if (amount > 0 && amountPaid >= amount) return 'Fully Paid';
  if (depositAmount > 0 && amountPaid >= depositAmount) return 'Deposit Paid';
  if (amountPaid > 0) return 'Outstanding';
  return 'Deposit Pending';
}

// Convert a local SA number (e.g. 0718281221) to wa.me format (27718281221).
function normalizePhone(num, dial = '27') {
  let digits = String(num || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(dial)) return digits;
  if (digits.startsWith('0')) return dial + digits.slice(1);
  return digits;
}

module.exports = {
  AppError,
  nowISO,
  todayStr,
  asyncHandler,
  round2,
  addHoursToTime,
  paymentStatusFor,
  normalizePhone,
};
