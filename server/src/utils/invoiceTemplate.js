/**
 * Tax-invoice template generator.
 *
 * Renders a self-contained, print-ready (A4) HTML tax invoice from a booking +
 * hotel record. Modelled on a standard Indian GST hotel-accommodation invoice
 * (CGST + SGST split, taxable value, amount in words, SAC code, bank details).
 *
 * Used by bookingsController.getBookingInvoice once a stay is complete.
 */
import fs from 'fs'
import path from 'path'

// The property's logo. Settings has two uploads: Hotel Profile (Hotel.logoUrl)
// and Branding (inside the Hotel.branding JSON). Hotel Profile wins if both exist.
export const hotelLogo = (hotel) => {
  if (hotel?.logoUrl) return hotel.logoUrl
  try {
    return JSON.parse(hotel?.branding || '{}').logoUrl || null
  } catch {
    return null
  }
}

// Inline a locally-served `/uploads/<file>` asset as a base64 data URI so the
// invoice's logo/stamp render with no dependency on URL resolution — relative
// paths don't resolve inside the blob: preview, and a remote host may be
// unreachable from the PDF renderer. Returns the original value untouched if
// it isn't a local upload or can't be read.
const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
}
export const inlineUploadAsset = (url) => {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return url
  try {
    const file = path.basename(url) // guard against path traversal
    const abs = path.join(path.resolve('uploads'), file)
    if (!fs.existsSync(abs)) return url
    const mime = MIME_BY_EXT[path.extname(file).toLowerCase()] || 'application/octet-stream'
    return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`
  } catch {
    return url
  }
}

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
  // Monthly tenancy: totals come from its monthly rent invoices.
  const rent = booking.rentInvoices || []
  const taxAmount = rent.length
    ? +rent.reduce((n, i) => n + (i.gstAmount || 0), 0).toFixed(2)
    : +(booking.taxAmount || 0).toFixed(2)
  // Room rate is GST-inclusive: (subtotal − discount) already contains the tax, so
  // the taxable (base) value is what remains once the extracted GST is removed.
  const gross = rent.length
    ? rent.reduce((n, i) => n + (i.total || 0), 0)
    : Math.max(0, (booking.subtotal || 0) - (booking.discount || 0))
  const taxable = +(gross - taxAmount).toFixed(2)
  const halfTax = +(taxAmount / 2).toFixed(2)
  const total = rent.length ? +gross.toFixed(2) : +(booking.amount || 0).toFixed(2)
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

  const service = ((booking.room?.type?.name || 'ROOM')
    + (booking.bedNo ? ` · Bed ${booking.bedNo <= 26 ? String.fromCharCode(64 + booking.bedNo) : booking.bedNo}` : '')).toUpperCase()
  const sac = booking.hsnCode || DEFAULT_SAC
  // One line per rent month ("31 Oct – 29 Nov 2026" → from / to), else the stay.
  const lines = rent.length
    ? rent.map((i) => {
        const [from, to] = String(i.period).split(' – ')
        const isRent = !!to
        return {
          service: isRent ? `${service} — RENT` : String(i.period).toUpperCase(),
          sac,
          checkIn: isRent ? from : '—',
          checkOut: isRent ? to : '—',
          nights: isRent ? '1 month' : '—',
          taxAmount: +(i.gstAmount || 0).toFixed(2),
          taxRate: i.gstRate ?? taxRate,
          total: +(i.total || 0).toFixed(2),
        }
      })
    : null

  return {
    invoiceNo: booking.invoiceNo || booking.bookingNo,
    tenancy: rent.length > 0,
    invoiceDate: fmtDate(booking.checkedOutAt || new Date()),
    hotel: {
      name: hotel.name || 'Hotel',
      pan: panFromGstin(hotel.gstin),
      gstin: hotel.gstin || null,
      phone: hotel.phone || null,
      email: hotel.email || null,
      address: hotel.address || null,
      logoUrl: hotelLogo(hotel),
      stampUrl: hotel.stampUrl || null,
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
      email: booking.guestEmail || null,
      address: booking.guestAddress,
    },
    stay: {
      bookingNo: booking.bookingNo,
      room: booking.room?.number || null,
      roomType: booking.room?.type?.name || null,
      bed: booking.bedNo ? (booking.bedNo <= 26 ? String.fromCharCode(64 + booking.bedNo) : String(booking.bedNo)) : null,
      from: fmtDate(booking.checkedInAt || booking.fromDate),
      to: rent.length ? (booking.checkedOutAt ? fmtDate(booking.checkedOutAt) : 'Ongoing') : fmtDate(booking.toDate || booking.checkedOutAt),
      length: rent.length ? `${rent.filter((i) => String(i.period).includes(' – ')).length} month(s) · monthly rent`
        : booking.stayType === 'monthly' ? `${booking.months || 1} month(s)` : `${booking.nights || 1} night(s)`,
      guests: (booking.adults || 0) + (booking.children || 0) || 1,
    },
    // A PG bed is billed as that bed, e.g. "SUITE · BED B".
    lines: lines || [{
      service,
      sac,
      checkIn: fmtDate(booking.fromDate),
      checkOut: fmtDate(booking.toDate || booking.checkedOutAt),
      nights: booking.nights || booking.months || 1,
      taxAmount,
      taxRate,
      total,
    }],
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
 * Logo/stamp images are expected to be inlined as data URIs by the caller, so
 * they render regardless of how the document is loaded (blob: preview, PDF).
 */
export const renderInvoiceHtml = (booking, hotel = {}, opts = {}) => {
  const d = buildInvoiceData(booking, hotel)
  const h = d.hotel
  const t = d.totals
  const halfRate = (t.taxRate / 2).toFixed(2).replace(/\.00$/, '')
  const status = t.balance <= 0 ? { label: 'Paid', cls: 'paid' }
    : t.received > 0 ? { label: 'Partly paid', cls: 'part' } : { label: 'Payment due', cls: 'due' }
  const lineTax = d.lines.reduce((n, l) => n + l.taxAmount, 0)
  const roomLine = [d.stay.room && `Room ${d.stay.room}`, d.stay.roomType, d.stay.bed && `Bed ${d.stay.bed}`]
    .filter(Boolean).join(' · ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tax Invoice ${esc(d.invoiceNo)}</title>
<style>
  :root {
    --ink: #111827; --ink2: #374151; --muted: #6b7280; --faint: #9ca3af;
    --line: #e5e7eb; --soft: #f9fafb; --accent: #b8892b; --accent-soft: #fbf6ea;
    --green: #15803d; --green-bg: #dcfce7; --amber: #b45309; --amber-bg: #fef3c7; --red: #b91c1c; --red-bg: #fee2e2;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: var(--ink);
         background: #eef0f3; padding: 28px 16px; font-size: 12.5px; line-height: 1.45;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 210mm; max-width: 100%; min-height: 297mm; margin: 0 auto; background: #fff;
           box-shadow: 0 6px 28px rgba(17,24,39,.10); position: relative; display: flex; flex-direction: column; }
  .bar { height: 6px; background: var(--accent); }
  .wrap { padding: 30px 38px 26px; flex: 1; display: flex; flex-direction: column; }

  /* Header */
  .head { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 1px solid var(--line); }
  .brand { display: flex; gap: 14px; align-items: flex-start; min-width: 0; }
  .brand img { height: 56px; max-width: 120px; object-fit: contain; }
  .brand .name { font-size: 21px; font-weight: 800; letter-spacing: -.2px; }
  .brand .info { color: var(--muted); font-size: 11.5px; margin-top: 4px; }
  .brand .info b { color: var(--ink2); font-weight: 600; }
  .doc { text-align: right; flex-shrink: 0; }
  .doc .title { font-size: 11px; font-weight: 700; letter-spacing: 2.5px; color: var(--accent); text-transform: uppercase; }
  .doc .no { font-size: 20px; font-weight: 800; margin-top: 4px; letter-spacing: -.2px; }
  .doc .kv { margin-top: 8px; font-size: 11.5px; color: var(--muted); }
  .doc .kv span { color: var(--ink2); font-weight: 600; }
  .badge { display: inline-block; margin-top: 10px; padding: 3px 10px; border-radius: 999px; font-size: 10.5px;
           font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
  .badge.paid { color: var(--green); background: var(--green-bg); }
  .badge.part { color: var(--amber); background: var(--amber-bg); }
  .badge.due  { color: var(--red);   background: var(--red-bg); }

  /* Parties */
  .cards { display: grid; grid-template-columns: 1.15fr 1.15fr 1fr; gap: 12px; margin-top: 22px; }
  .card { background: var(--soft); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .card .lbl { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--faint); margin-bottom: 6px; }
  .card .big { font-size: 14px; font-weight: 700; }
  .card .ln { color: var(--ink2); font-size: 11.5px; margin-top: 2px; }
  .card .ln i { font-style: normal; color: var(--muted); }

  /* Items */
  table { width: 100%; border-collapse: collapse; }
  .items { margin-top: 24px; }
  .items th { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted);
              text-align: left; padding: 9px 10px; border-bottom: 1.5px solid var(--ink); }
  .items td { padding: 12px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .items .n { width: 28px; color: var(--faint); }
  .items .r { text-align: right; white-space: nowrap; }
  .items .desc b { font-weight: 600; }
  .items .desc div { color: var(--muted); font-size: 11px; margin-top: 2px; }
  .items tfoot td { border-bottom: 0; padding-top: 10px; font-weight: 700; }

  /* Lower */
  .lower { display: grid; grid-template-columns: 1fr 270px; gap: 28px; margin-top: 22px; }
  .sec + .sec { margin-top: 16px; }
  .sec .lbl { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--faint); margin-bottom: 6px; }
  .words { font-weight: 600; color: var(--ink2); }
  .mini td, .mini th { padding: 4px 0; font-size: 11.5px; text-align: left; }
  .mini th { color: var(--muted); font-weight: 600; font-size: 10.5px; }
  .mini .r { text-align: right; }
  .kvt td { padding: 2px 0; font-size: 11.5px; }
  .kvt td:first-child { color: var(--muted); width: 92px; }
  .totals { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; align-self: start; }
  .totals .row { display: flex; justify-content: space-between; padding: 7px 14px; font-size: 12px; color: var(--ink2); }
  .totals .row span:last-child { font-variant-numeric: tabular-nums; }
  .totals .grand { background: var(--ink); color: #fff; font-size: 15px; font-weight: 800; padding: 11px 14px; }
  .totals .bal { font-weight: 700; color: var(--ink); border-top: 1px solid var(--line); }
  .totals .bal.owe { color: var(--red); background: var(--red-bg); }

  /* Footer */
  .foot { display: grid; grid-template-columns: 1fr 220px; gap: 28px; margin-top: auto; padding-top: 28px; align-items: end; }
  .terms { font-size: 10.5px; color: var(--muted); }
  .terms b { color: var(--ink2); }
  .sign { text-align: center; }
  .sign .box { height: 74px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid var(--ink2); padding-bottom: 4px; }
  .sign img { max-height: 70px; max-width: 200px; object-fit: contain; }
  .sign .who { font-size: 11px; font-weight: 700; margin-top: 6px; }
  .sign .for { font-size: 10.5px; color: var(--muted); }
  .end { margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--line); text-align: center; font-size: 10px; color: var(--faint); }

  @media (max-width: 760px) {
    .wrap { padding: 22px 18px; } .head, .lower, .foot { display: block; } .doc { text-align: left; margin-top: 14px; }
    .cards { grid-template-columns: 1fr; } .totals { margin-top: 16px; } .sign { margin-top: 18px; }
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; width: 100%; min-height: auto; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="bar"></div>
  <div class="wrap">

    <div class="head">
      <div class="brand">
        ${h.logoUrl ? `<img src="${esc(h.logoUrl)}" alt="" />` : ''}
        <div>
          <div class="name">${esc(h.name)}</div>
          <div class="info">
            ${h.address ? `${esc(h.address)}<br/>` : ''}
            ${[h.phone && esc(h.phone), h.email && esc(h.email)].filter(Boolean).join(' · ')}
            ${h.gstin || h.pan ? `<br/>${h.gstin ? `<b>GSTIN</b> ${esc(h.gstin)}` : ''}${h.gstin && h.pan ? ' · ' : ''}${h.pan ? `<b>PAN</b> ${esc(h.pan)}` : ''}` : ''}
          </div>
        </div>
      </div>
      <div class="doc">
        <div class="title">Tax Invoice</div>
        <div class="no">${esc(d.invoiceNo)}</div>
        <div class="kv">Date <span>${esc(d.invoiceDate)}</span> · Booking <span>${esc(d.stay.bookingNo)}</span></div>
        <div class="badge ${status.cls}">${status.label}</div>
      </div>
    </div>

    <div class="cards">
      <div class="card">
        <div class="lbl">Billed to</div>
        <div class="big">${esc(String(d.guest.name || '').split(',')[0])}</div>
        ${d.guest.phone ? `<div class="ln">${esc(d.guest.phone)}</div>` : ''}
        ${d.guest.email ? `<div class="ln">${esc(d.guest.email)}</div>` : ''}
        ${d.guest.address ? `<div class="ln">${esc(d.guest.address)}</div>` : ''}
      </div>
      <div class="card">
        <div class="lbl">Stay</div>
        <div class="big">${esc(roomLine || '—')}</div>
        <div class="ln"><i>${d.tenancy ? 'Move-in' : 'Check-in'}</i> ${esc(d.stay.from)} · <i>${d.tenancy ? 'Move-out' : 'Check-out'}</i> ${esc(d.stay.to)}</div>
        <div class="ln">${esc(d.stay.length)} · ${esc(d.stay.guests)} guest${d.stay.guests === 1 ? '' : 's'}</div>
      </div>
      <div class="card">
        <div class="lbl">Tax details</div>
        <div class="ln"><i>Place of supply</i> ${esc(h.placeOfSupply || '—')}</div>
        <div class="ln"><i>SAC</i> ${esc(d.lines[0]?.sac || '—')}</div>
        <div class="ln"><i>GST</i> CGST ${halfRate}% + SGST ${halfRate}%</div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="n">#</th>
          <th>Description</th>
          <th>${d.tenancy ? 'Period' : 'Nights'}</th>
          <th class="r">Taxable</th>
          <th class="r">GST</th>
          <th class="r">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${d.lines.map((l, i) => `
        <tr>
          <td class="n">${i + 1}</td>
          <td class="desc"><b>${esc(l.service)}</b>
            <div>SAC ${esc(l.sac)}${l.checkIn !== '—' ? ` · ${esc(l.checkIn)} → ${esc(l.checkOut)}` : ''}</div></td>
          <td>${esc(l.nights)}</td>
          <td class="r">${money(l.total - l.taxAmount)}</td>
          <td class="r">${money(l.taxAmount)}<div style="color:var(--faint);font-size:10.5px">${esc(l.taxRate)}%</div></td>
          <td class="r"><b>${money(l.total)}</b></td>
        </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td></td><td>Subtotal</td><td></td>
          <td class="r">${money(t.taxable)}</td>
          <td class="r">${money(lineTax)}</td>
          <td class="r">${money(t.total)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="lower">
      <div>
        <div class="sec">
          <div class="lbl">Amount in words</div>
          <div class="words">${esc(d.amountInWords)}</div>
        </div>
        ${d.payments.length ? `
        <div class="sec">
          <div class="lbl">Payments received</div>
          <table class="mini">
            <tr><th>Date</th><th>Method</th><th>Reference</th><th class="r">Amount</th></tr>
            ${d.payments.map((p) => `
            <tr><td>${esc(p.date)}</td><td>${esc(p.method)}</td><td>${esc(p.reference || '—')}</td><td class="r">${money(p.amount)}</td></tr>`).join('')}
          </table>
        </div>` : ''}
        ${h.bank ? `
        <div class="sec">
          <div class="lbl">Bank details</div>
          <table class="kvt">
            <tr><td>Account name</td><td>${esc(h.bank.name)}</td></tr>
            <tr><td>Bank</td><td>${esc(h.bank.bankName)}</td></tr>
            <tr><td>Account no.</td><td>${esc(h.bank.accountNo)}</td></tr>
            <tr><td>IFSC</td><td>${esc(h.bank.ifsc)}</td></tr>
          </table>
        </div>` : ''}
      </div>
      <div class="totals">
        <div class="row"><span>Taxable value</span><span>${money(t.taxable)}</span></div>
        <div class="row"><span>CGST @ ${halfRate}%</span><span>${money(t.cgst)}</span></div>
        <div class="row"><span>SGST @ ${halfRate}%</span><span>${money(t.sgst)}</span></div>
        <div class="row grand"><span>Total</span><span>${money(t.total)}</span></div>
        <div class="row"><span>Received</span><span>${money(t.received)}</span></div>
        <div class="row bal ${t.balance > 0 ? 'owe' : ''}"><span>${t.balance > 0 ? 'Balance due' : 'Balance'}</span><span>${money(Math.max(0, t.balance))}</span></div>
      </div>
    </div>

    <div class="foot">
      <div class="terms">
        ${h.terms ? `<b>Terms &amp; conditions</b><br/>${esc(h.terms)}` : 'Thank you for staying with us.'}
      </div>
      <div class="sign">
        <div class="box">${h.stampUrl ? `<img src="${esc(h.stampUrl)}" alt="Stamp and signature" />` : ''}</div>
        <div class="who">Authorised Signatory</div>
        <div class="for">for ${esc(h.name)}</div>
      </div>
    </div>
    <div class="end">This is a computer-generated invoice.</div>

  </div>
</div>
${opts.autoPrint ? '<script>window.onload=function(){window.print()}</script>' : ''}
</body>
</html>`
}

export default renderInvoiceHtml
