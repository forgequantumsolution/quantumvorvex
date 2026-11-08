/**
 * Pay-by-UPI for invoices: the standard `upi://pay` link (opens GPay, PhonePe,
 * Paytm… with the payee and amount filled in) and a QR code of it. Free — the
 * money goes straight to the hotel's UPI ID; no gateway involved.
 */
import QRCode from 'qrcode'

// Same check UPI apps apply loosely: handle@psp.
export const isUpiId = (v) => typeof v === 'string' && /^[\w.\-]{2,256}@[a-zA-Z][\w.\-]{1,64}$/.test(v.trim())

export const upiUri = ({ upiId, name, amount, note }) => {
  const q = new URLSearchParams({ pa: upiId.trim(), pn: (name || '').slice(0, 50), cu: 'INR' })
  if (amount > 0) q.set('am', Number(amount).toFixed(2))
  if (note) q.set('tn', String(note).slice(0, 80))
  // Keep the "@" of the UPI ID literal — some UPI apps don't decode %40.
  return `upi://pay?${q.toString().replace(/%40/g, '@')}`
}

// Inline SVG of the QR (null when the hotel has no valid UPI ID).
export const upiQrSvg = async (opts) => {
  if (!isUpiId(opts.upiId)) return null
  return QRCode.toString(upiUri(opts), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1a1a1a', light: '#ffffff' } })
}
