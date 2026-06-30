// Demo invoice: opens a styled, printable invoice in a new window
// (browser "Save as PDF"). Used instead of the server's PDFKit output.
import { BUSINESS } from './constants.js';

function money(n) {
  return `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function longDate(d) {
  if (!d) return '—';
  const date = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  return isNaN(date) ? d : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function openDemoInvoice(b) {
  const balance = (b.amount || 0) - (b.amount_paid || 0);
  const payments = b.payments || [];
  const today = longDate(new Date().toISOString().slice(0, 10));

  const paymentRows = payments.length
    ? payments.map((p) => `<tr><td>${esc(p.created_at.slice(0, 10))} · ${esc(p.method || 'Payment')}${p.note ? ' — ' + esc(p.note) : ''}</td><td class="r">${money(p.amount)}</td></tr>`).join('')
    : '<tr><td class="muted">No payments recorded yet.</td><td></td></tr>';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${esc(b.reference || b.id)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1b2433; margin: 0; padding: 32px; }
  .sheet { max-width: 760px; margin: 0 auto; }
  .band { background: #0e1726; color: #fff; border-radius: 12px; padding: 22px 26px; display: flex; justify-content: space-between; align-items: center; }
  .band h1 { margin: 0; color: #c8a24a; font-size: 26px; }
  .band .sub { color: #cbd5e1; font-size: 12px; margin-top: 4px; }
  .band .doc { text-align: right; }
  .band .doc b { font-size: 20px; }
  .cols { display: flex; justify-content: space-between; gap: 24px; margin: 26px 4px; }
  .cols h3 { font-size: 11px; letter-spacing: .08em; color: #6b7280; margin: 0 0 8px; }
  .cols p { margin: 2px 0; font-size: 13px; }
  .trip { background: #f4f6fb; border-radius: 10px; padding: 16px 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 13px; }
  th { background: #0e1726; color: #fff; text-align: left; padding: 10px 12px; }
  th.r, td.r { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid #e6e9f0; }
  .totals { margin-top: 18px; margin-left: auto; width: 300px; font-size: 13px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 2px; }
  .totals .bal { background: #c8a24a; color: #fff; font-weight: 700; padding: 9px 12px; border-radius: 8px; margin-top: 6px; font-size: 15px; }
  .muted { color: #6b7280; }
  .foot { text-align: center; color: #6b7280; font-size: 11px; margin-top: 36px; border-top: 1px solid #e6e9f0; padding-top: 12px; }
  .actions { max-width: 760px; margin: 0 auto 18px; display: flex; gap: 10px; }
  .actions button { background: #0e1726; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
  .actions button.alt { background: #fff; color: #0e1726; border: 1px solid #d3d8e2; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style></head>
<body>
  <div class="actions">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="alt" onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    <div class="band">
      <div><h1>LifeLine Tours</h1><div class="sub">Cape Town · Operated under Lyfe Computer Technologies</div></div>
      <div class="doc"><b>INVOICE</b><div class="sub">${esc(b.reference || '#' + b.id)}</div></div>
    </div>
    <div class="cols">
      <div>
        <h3>FROM</h3>
        <p><b>${esc(BUSINESS.name)}</b></p>
        <p class="muted">${esc(BUSINESS.address)}</p>
        <p class="muted">Tel / WhatsApp: ${esc(BUSINESS.phone)}</p>
        <p class="muted">${esc(BUSINESS.email)}</p>
      </div>
      <div>
        <h3>BILL TO</h3>
        <p><b>${esc(b.customer_name || '—')}</b></p>
        ${b.customer_phone ? `<p class="muted">Phone: ${esc(b.customer_phone)}</p>` : ''}
        ${b.customer_email ? `<p class="muted">${esc(b.customer_email)}</p>` : ''}
        <p class="muted">Invoice date: ${esc(today)}</p>
      </div>
    </div>
    <div class="trip">
      <div><b>Vehicle:</b> ${esc(b.vehicle_name || '—')}</div>
      <div><b>Pickup time:</b> ${esc(b.pickup_time || '—')}</div>
      <div><b>Trip type:</b> ${esc(b.trip_type || '—')}</div>
      <div><b>Pickup:</b> ${esc(b.pickup_location || '—')}</div>
      <div><b>Travel date:</b> ${esc(longDate(b.travel_date))}</div>
      <div><b>Drop-off:</b> ${esc(b.dropoff_location || '—')}</div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
      <tbody><tr><td>${esc((b.trip_type || 'Chauffeur service') + ' — ' + (b.vehicle_name || ''))}</td><td class="r">${money(b.amount)}</td></tr></tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Total</span><span>${money(b.amount)}</span></div>
      <div class="row"><span>Deposit (50%)</span><span>${money(b.deposit_amount)}</span></div>
      <div class="row"><span>Paid to date</span><span>${money(b.amount_paid)}</span></div>
      <div class="bal"><div class="row" style="padding:0"><span>Balance Due</span><span>${money(balance)}</span></div></div>
    </div>
    <table>
      <thead><tr><th>Payments received</th><th class="r">Amount</th></tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>
    <p class="muted" style="font-size:11px;margin-top:8px">Payment status: ${esc(b.payment_status)} · Methods accepted: Cash, EFT</p>
    <div class="foot">Thank you for choosing LifeLine Tours. A 50% deposit secures your booking.</div>
  </div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Please allow pop-ups to view the invoice.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
