const express = require('express');
const PDFDocument = require('pdfkit');
const { authRequired } = require('../auth');
const { asyncHandler, AppError, round2 } = require('../util');
const { getBooking, listPayments } = require('../services');
const { BUSINESS } = require('../constants');

const router = express.Router();
router.use(authRequired);

const GOLD = '#b8893b';
const NAVY = '#0e1726';
const MUTED = '#6b7280';

function money(n) {
  return `${BUSINESS.currency} ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function longDate(d) {
  if (!d) return '—';
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

// GET /api/invoices/:bookingId  -> streams a PDF invoice / booking confirmation.
router.get(
  '/:bookingId',
  asyncHandler((req, res) => {
    const booking = getBooking(req.params.bookingId);
    if (!booking) throw new AppError('Booking not found', 404);
    if (req.user.role === 'driver') throw new AppError('You do not have permission for this action', 403);
    const payments = listPayments(booking.id);
    const balance = round2(booking.amount - booking.amount_paid);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${booking.reference || booking.id}.pdf"`);
    doc.pipe(res);

    const left = 50;
    const right = 545;

    // Header band
    doc.rect(0, 0, doc.page.width, 110).fill(NAVY);
    doc.fillColor(GOLD).fontSize(26).font('Helvetica-Bold').text('LifeLine Tours', left, 38);
    doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text('Cape Town · Operated under Lyfe Computer Technologies', left, 70);
    doc
      .fillColor('#ffffff')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('INVOICE', right - 150, 42, { width: 150, align: 'right' });
    doc
      .fillColor('#cbd5e1')
      .fontSize(9)
      .font('Helvetica')
      .text(booking.reference || `#${booking.id}`, right - 150, 70, { width: 150, align: 'right' });

    doc.fillColor('#111827');

    // Business + customer columns
    let y = 135;
    doc.fontSize(9).fillColor(MUTED).font('Helvetica-Bold').text('FROM', left, y);
    doc.fontSize(10).fillColor('#111827').font('Helvetica');
    doc.text(BUSINESS.name, left, y + 14);
    doc.fillColor(MUTED).fontSize(9);
    doc.text(BUSINESS.address, left, y + 28, { width: 230 });
    doc.text(`Tel / WhatsApp: ${BUSINESS.phone}`, left, y + 52);
    doc.text(BUSINESS.email, left, y + 64);

    doc.fontSize(9).fillColor(MUTED).font('Helvetica-Bold').text('BILL TO', 320, y);
    doc.fontSize(10).fillColor('#111827').font('Helvetica');
    doc.text(booking.customer_name || '—', 320, y + 14);
    doc.fillColor(MUTED).fontSize(9);
    if (booking.customer_phone) doc.text(`Phone: ${booking.customer_phone}`, 320, y + 28);
    if (booking.customer_email) doc.text(booking.customer_email, 320, y + 40);
    doc.text(`Invoice date: ${longDate(new Date().toISOString().slice(0, 10))}`, 320, y + 56);

    // Trip details box
    y = 230;
    doc.roundedRect(left, y, right - left, 96, 6).fill('#f4f6fb');
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('TRIP DETAILS', left + 16, y + 12);
    doc.font('Helvetica').fontSize(10).fillColor('#111827');
    const col1 = left + 16;
    const col2 = 320;
    doc.text(`Vehicle: ${booking.vehicle_name || '—'}`, col1, y + 30);
    doc.text(`Trip type: ${booking.trip_type || '—'}`, col1, y + 46);
    doc.text(`Travel date: ${longDate(booking.travel_date)}`, col1, y + 62);
    doc.text(`Pickup time: ${booking.pickup_time || '—'}`, col2, y + 30);
    doc.text(`Pickup: ${booking.pickup_location || '—'}`, col2, y + 46, { width: 210 });
    doc.text(`Drop-off: ${booking.dropoff_location || '—'}`, col2, y + 62, { width: 210 });

    // Charges table
    y = 350;
    doc.rect(left, y, right - left, 24).fill(NAVY);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
    doc.text('DESCRIPTION', left + 12, y + 7);
    doc.text('AMOUNT', right - 130, y + 7, { width: 118, align: 'right' });

    y += 24;
    doc.fillColor('#111827').font('Helvetica').fontSize(10);
    const desc = `${booking.trip_type || 'Chauffeur service'} — ${booking.vehicle_name || ''}`.trim();
    doc.text(desc, left + 12, y + 8, { width: 360 });
    doc.text(money(booking.amount), right - 130, y + 8, { width: 118, align: 'right' });
    doc.moveTo(left, y + 30).lineTo(right, y + 30).strokeColor('#e5e7eb').stroke();

    // Totals
    y += 44;
    const labelX = 330;
    const valX = right - 130;
    const rowH = 18;
    const rows = [
      ['Total', money(booking.amount)],
      ['Deposit (50%)', money(booking.deposit_amount)],
      ['Paid to date', money(booking.amount_paid)],
    ];
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    rows.forEach(([label, val], i) => {
      doc.text(label, labelX, y + i * rowH, { width: 130 });
      doc.text(val, valX, y + i * rowH, { width: 118, align: 'right' });
    });
    const balY = y + rows.length * rowH + 6;
    doc.rect(labelX - 10, balY - 4, right - (labelX - 10), 26).fill(GOLD);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12);
    doc.text('Balance Due', labelX, balY + 3, { width: 130 });
    doc.text(money(balance), valX, balY + 3, { width: 118, align: 'right' });

    // Payment history
    let py = balY + 46;
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('PAYMENTS RECEIVED', left, py);
    doc.font('Helvetica').fontSize(9).fillColor('#374151');
    py += 14;
    if (!payments.length) {
      doc.fillColor(MUTED).text('No payments recorded yet.', left, py);
      py += 14;
    } else {
      payments.forEach((p) => {
        doc.fillColor('#374151').text(
          `${p.created_at.slice(0, 10)}  ·  ${p.method || 'Payment'}${p.note ? ' — ' + p.note : ''}`,
          left,
          py,
          { width: 360 }
        );
        doc.text(money(p.amount), valX, py, { width: 118, align: 'right' });
        py += 14;
      });
    }

    doc.fillColor(MUTED).fontSize(8).text(`Payment status: ${booking.payment_status}  ·  Methods accepted: Cash, EFT`, left, py + 8);

    // Footer
    const fy = 770;
    doc.moveTo(left, fy).lineTo(right, fy).strokeColor('#e5e7eb').stroke();
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .text('Thank you for choosing LifeLine Tours. A 50% deposit secures your booking.', left, fy + 8, {
        width: right - left,
        align: 'center',
      });

    doc.end();
  })
);

module.exports = router;
