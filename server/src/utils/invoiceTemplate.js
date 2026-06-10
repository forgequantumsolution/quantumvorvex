/**
 * Tax-invoice template generator.
 *
 * Renders a self-contained, print-ready (A4) HTML tax invoice from a booking +
 * hotel record. Modelled on a standard Indian GST hotel-accommodation invoice
 * (CGST + SGST split, taxable value, amount in words, SAC code, bank details).
 *
 * Used by bookingsController.getBookingInvoice once a stay is complete.
 */

// Default SAC for hotel room accommodation services (GST).
const DEFAULT_SAC = '996311'

// Human labels for the payment methods recorded at check-out.
const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
}

const paymentMethodLabel = (m) => PAYMENT_METHOD_LABELS[m] || (m ? String(m) : 'Cash')

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const money = (n) =>
  `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '—'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${dt.getFullYear()}`
}

// ── Indian-system number → words (handles paise) ──────────────────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`)

const threeDigits = (n) => {
  const h = Math.floor(n / 100)
  const r = n % 100
  return `${h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : ''}${r ? twoDigits(r) : ''}`
}

const numToWords = (num) => {
  num = Math.floor(Math.abs(num))
  if (num === 0) return 'Zero'
  const crore = Math.floor(num / 10000000); num %= 10000000
  const lakh = Math.floor(num / 100000); num %= 100000
  const thousand = Math.floor(num / 1000); num %= 1000
  const hundred = num
  let out = ''
  if (crore) out += `${threeDigits(crore)} Crore `
  if (lakh) out += `${twoDigits(lakh)} Lakh `
  if (thousand) out += `${twoDigits(thousand)} Thousand `
  if (hundred) out += threeDigits(hundred)
  return out.trim()
}

export const amountInWords = (amount) => {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  let words = `${numToWords(rupees)} Rupees`
  if (paise) words += ` and ${numToWords(paise)} Paise`
  return `${words} Only`
}

// Derive a 10-char PAN from a 15-char GSTIN (chars 3–12), else null.
const panFromGstin = (gstin) =>
  gstin && gstin.length >= 12 ? gstin.slice(2, 12) : null

/**
 * Build the structured invoice payload from a booking + hotel.
 * Splits the booking's tax into CGST + SGST (intra-state default).
 */
export const buildInvoiceData = (booking, hotel = {}) => {
  const taxable = +Math.max(0, (booking.subtotal || 0) - (booking.discount || 0)).toFixed(2)
  const taxAmount = +(booking.taxAmount || 0).toFixed(2)
  const halfTax = +(taxAmount / 2).toFixed(2)
  const total = +(booking.amount || 0).toFixed(2)
  const received = +(booking.advance || 0).toFixed(2)
  const balance = +(booking.balance ?? total - received).toFixed(2)
  const taxRate = booking.taxRate || 0

  // Collection payments logged against the guest (cash/card/upi/… at check-out).
  const payments = (booking.guest?.payments || [])
    .filter((p) => p.type === 'collection')
    .map((p) => ({
      amount: +(p.amount || 0).toFixed(2),
      method: paymentMethodLabel(p.method),
      reference: p.reference || null,
      date: fmtDate(p.createdAt),
    }))

  return {
    invoiceNo: booking.invoiceNo || booking.bookingNo,
    invoiceDate: fmtDate(booking.checkedOutAt || new Date()),
    hotel: {
      name: hotel.name || 'Hotel',
      pan: panFromGstin(hotel.gstin),
      gstin: hotel.gstin || null,
      phone: hotel.phone || null,
      email: hotel.email || null,
      address: hotel.address || null,
      logoUrl: hotel.logoUrl || null,
      placeOfSupply: hotel.placeOfSupply || hotel.state || null,
      bank: hotel.bankName
        ? {
            name: hotel.bankAccountName || hotel.name,
            ifsc: hotel.bankIfsc,
            accountNo: hotel.bankAccountNo,
            bankName: hotel.bankName,
          }
        : null,
      terms: hotel.termsAndConditions || null,
    },
    guest: {
      name: booking.guestName,
      phone: booking.guestPhone,
      address: booking.guestAddress,
    },
    line: {
      service: (booking.room?.type?.name || 'ROOM').toUpperCase(),
      sac: booking.hsnCode || DEFAULT_SAC,
      checkIn: fmtDate(booking.fromDate),
      checkOut: fmtDate(booking.toDate || booking.checkedOutAt),
      nights: booking.nights || booking.months || 1,
      taxAmount,
      taxRate,
      total,
    },
    totals: {
      taxable,
      cgst: halfTax,
      sgst: halfTax,
      taxRate,
      total,
      received,
      balance,
    },
    payments,
    amountInWords: amountInWords(total),
  }
}

/**
 * Render the full HTML invoice document. `opts.autoPrint` injects a print
 * trigger (caller must relax CSP for inline script on that response).
 */
export const renderInvoiceHtml = (booking, hotel = {}, opts = {}) => {
  const d = buildInvoiceData(booking, hotel)
  const h = d.hotel
  const halfRate = (d.totals.taxRate / 2).toFixed(2).replace(/\.00$/, '')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tax Invoice ${esc(d.invoiceNo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #f3f4f6; padding: 24px; }
  .sheet { width: 800px; margin: 0 auto; background: #fff; border: 3px double #c79a3a; padding: 0; }
  .pad { padding: 22px 28px; }
  .row { display: flex; }
  .between { justify-content: space-between; }
  .header { border-bottom: 2px solid #c79a3a; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand img { max-height: 64px; max-width: 120px; object-fit: contain; }
  .hotel-name { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #1e3a5f; }
  .muted { color: #6b7280; font-size: 12px; line-height: 1.5; }
  .muted b { color: #374151; }
  .tax-tag { text-align: right; }
  .tax-tag .t { font-size: 18px; font-weight: 800; color: #1e3a5f; letter-spacing: 1px; }
  .tax-tag .o { display: inline-block; margin-top: 6px; border: 1px solid #9ca3af; padding: 2px 8px; font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .meta { border-bottom: 1px solid #e5e7eb; }
  .meta .label { font-size: 11px; font-weight: 700; color: #1e3a5f; }
  .meta .val { font-size: 13px; }
  .billto { border-bottom: 1px solid #e5e7eb; }
  .billto .label { font-size: 11px; font-weight: 700; color: #1e3a5f; margin-bottom: 3px; }
  .billto .name { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #eef3f8; color: #1e3a5f; font-size: 11px; text-transform: uppercase; text-align: left; padding: 10px 12px; border-bottom: 2px solid #c79a3a; }
  thead th.num, tbody td.num { text-align: right; }
  thead th.ctr, tbody td.ctr { text-align: center; }
  tbody td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f1f1; }
  .subtotal td { background: #faf6ec; font-weight: 700; font-size: 13px; padding: 10px 12px; }
  .lower { display: flex; gap: 24px; }
  .lower .left { flex: 1; }
  .lower .right { width: 300px; }
  .bank .label { font-size: 11px; font-weight: 700; color: #1e3a5f; margin-bottom: 6px; }
  .bank table td { border: 0; padding: 3px 0; font-size: 12px; }
  .bank table td:first-child { color: #6b7280; width: 90px; }
  .payments { margin-top: 16px; }
  .payments .paytable td:first-child { color: inherit; width: auto; }
  .payments .paytable th { font-size: 10px; text-transform: uppercase; color: #6b7280; text-align: left; padding: 0 8px 4px 0; border: 0; background: none; }
  .payments .paytable td { padding: 3px 8px 3px 0; font-size: 12px; }
  .payments .paytable .num { text-align: right; padding-right: 0; }
  .totals td { padding: 6px 0; font-size: 13px; }
  .totals td:last-child { text-align: right; }
  .totals .grand td { border-top: 2px solid #c79a3a; border-bottom: 2px solid #c79a3a; font-size: 16px; font-weight: 800; color: #1e3a5f; padding: 10px 0; }
  .totals .sub td { color: #6b7280; }
  .totals .bal td { font-weight: 700; }
  .words { font-size: 13px; margin-top: 18px; }
  .words .label { font-size: 11px; font-weight: 700; color: #1e3a5f; }
  .sign { margin-top: 28px; border: 1px solid #d1d5db; border-radius: 6px; height: 110px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 12px; }
  .sign .s { font-size: 12px; font-weight: 700; }
  .sign .h { font-size: 11px; color: #6b7280; }
  .terms { margin-top: 16px; font-size: 10px; color: #9ca3af; line-height: 1.5; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: 100%; border: 0; }
    @page { size: A4; margin: 12mm; }
  }
</style>
</head>
<body>
<div class="sheet">

  <!-- Header -->
  <div class="pad header row between">
    <div class="brand">
      ${h.logoUrl ? `<img src="${esc(h.logoUrl)}" alt="logo" />` : ''}
      <div>
        <div class="hotel-name">${esc(h.name)}</div>
        <div class="muted">
          ${h.pan ? `<b>PAN</b> ${esc(h.pan)}&nbsp;&nbsp;` : ''}${h.gstin ? `<b>GSTIN</b> ${esc(h.gstin)}` : ''}<br/>
          ${h.phone ? `${esc(h.phone)}&nbsp;&nbsp;` : ''}${h.email ? esc(h.email) : ''}${h.address ? `<br/>${esc(h.address)}` : ''}
        </div>
      </div>
    </div>
    <div class="tax-tag">
      <div class="t">TAX INVOICE</div>
      <div class="o">Original for Recipient</div>
    </div>
  </div>

  <!-- Invoice meta -->
  <div class="pad meta row" style="gap:60px;">
    <div>
      <div class="label">Invoice No.</div>
      <div class="val">${esc(d.invoiceNo)}</div>
    </div>
    <div>
      <div class="label">Invoice Date</div>
      <div class="val">${esc(d.invoiceDate)}</div>
    </div>
  </div>

  <!-- Bill To -->
  <div class="pad billto">
    <div class="label">Bill To</div>
    <div class="name">${esc(d.guest.name)}</div>
    ${d.guest.phone ? `<div class="muted"><b>Mobile</b> ${esc(d.guest.phone)}</div>` : ''}
    ${d.guest.address ? `<div class="muted">${esc(d.guest.address)}</div>` : ''}
    ${h.placeOfSupply ? `<div class="muted"><b>Place of Supply</b> ${esc(h.placeOfSupply)}</div>` : ''}
  </div>

  <!-- Line items -->
  <div class="pad">
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Services</th>
          <th>SAC</th>
          <th class="ctr">Check In</th>
          <th class="ctr">Check Out</th>
          <th class="ctr">No. of Nights</th>
          <th class="num">Tax</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>${esc(d.line.service)}</td>
          <td>${esc(d.line.sac)}</td>
          <td class="ctr">${esc(d.line.checkIn)}</td>
          <td class="ctr">${esc(d.line.checkOut)}</td>
          <td class="ctr">${esc(d.line.nights)}</td>
          <td class="num">${money(d.line.taxAmount)}<br/><span class="muted">(${esc(d.line.taxRate)}%)</span></td>
          <td class="num">${money(d.line.total)}</td>
        </tr>
        <tr class="subtotal">
          <td colspan="6">Subtotal</td>
          <td class="num">${money(d.line.taxAmount)}</td>
          <td class="num">${money(d.line.total)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Lower: bank + totals -->
  <div class="pad lower">
    <div class="left">
      ${h.bank ? `
      <div class="bank">
        <div class="label">Bank Details</div>
        <table>
          <tr><td>Name</td><td>${esc(h.bank.name)}</td></tr>
          <tr><td>IFSC</td><td>${esc(h.bank.ifsc)}</td></tr>
          <tr><td>Account No</td><td>${esc(h.bank.accountNo)}</td></tr>
          <tr><td>Bank Name</td><td>${esc(h.bank.bankName)}</td></tr>
        </table>
      </div>` : ''}
      ${d.payments.length ? `
      <div class="bank payments">
        <div class="label">Payment Details</div>
        <table class="paytable">
          <thead>
            <tr><th>Date</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr>
          </thead>
          <tbody>
            ${d.payments.map((p) => `
            <tr>
              <td>${esc(p.date)}</td>
              <td>${esc(p.method)}</td>
              <td>${esc(p.reference || '—')}</td>
              <td class="num">${money(p.amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>
    <div class="right">
      <table class="totals">
        <tr class="sub"><td>Taxable Amount</td><td>${money(d.totals.taxable)}</td></tr>
        <tr class="sub"><td>CGST @${halfRate}%</td><td>${money(d.totals.cgst)}</td></tr>
        <tr class="sub"><td>SGST @${halfRate}%</td><td>${money(d.totals.sgst)}</td></tr>
        <tr class="grand"><td>Total Amount</td><td>${money(d.totals.total)}</td></tr>
        <tr class="sub"><td>Received Amount</td><td>${money(d.totals.received)}</td></tr>
        <tr class="bal"><td>Balance</td><td>${money(d.totals.balance)}</td></tr>
      </table>
    </div>
  </div>

  <!-- Amount in words + signature -->
  <div class="pad">
    <div class="words">
      <div class="label">Total Amount (in words)</div>
      ${esc(d.amountInWords)}
    </div>
    <div class="sign">
      <div class="s">Signature</div>
      <div class="h">${esc(h.name)}</div>
    </div>
    ${h.terms ? `<div class="terms"><b>Terms &amp; Conditions:</b> ${esc(h.terms)}</div>` : ''}
  </div>

</div>
${opts.autoPrint ? '<script>window.onload=function(){window.print()}</script>' : ''}
</body>
</html>`
}

export default renderInvoiceHtml
