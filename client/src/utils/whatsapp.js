/**
 * Free WhatsApp messaging via click-to-chat: https://wa.me/<digits>?text=<message>
 * opens WhatsApp (app or web) with the message typed in — staff press Send.
 * No paid API, nothing leaves the browser until they do.
 */

// Digits WhatsApp wants: country code + number, no "+", spaces or leading 0.
// A 10-digit number is taken as local (defaultCountry, India); 11–15 digits are
// assumed to already carry a country code. Anything else isn't usable → null.
export function waNumber(phone, defaultCountry = '91') {
  if (phone == null) return null
  // A booking can hold several numbers ("98…, 97…"): use the first.
  const first = String(phone).split(/[,;/]/)[0]
  let digits = first.replace(/\D/g, '')
  if (first.trim().startsWith('00')) digits = digits.slice(2) // 00 = international prefix
  digits = digits.replace(/^0+/, '')
  if (digits.length === 10) return `${defaultCountry}${digits}`
  if (digits.length >= 11 && digits.length <= 15) return digits
  return null
}

export function whatsappUrl(phone, text = '') {
  const n = waNumber(phone)
  if (!n) return null
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

// Open the chat in a new tab (or the WhatsApp app on phones). Returns false when
// the number isn't usable so the caller can say so.
export function openWhatsApp(phone, text) {
  const url = whatsappUrl(phone, text)
  if (!url) return false
  window.open(url, '_blank', 'noopener')
  return true
}

/**
 * For a message that needs an API call first (e.g. an invoice link): opens a
 * blank window synchronously — still inside the click, so popup blockers allow
 * it — then points it at WhatsApp once the text is ready. On failure the blank
 * window is closed and `onError(err)` is called (show a toast there).
 */
export async function openWhatsAppAsync(phone, buildText, onError) {
  if (!waNumber(phone)) { onError?.(new Error('invalid-number')); return false }
  const win = window.open('', '_blank')
  try {
    const text = await buildText()
    const url = whatsappUrl(phone, text)
    if (win) { win.opener = null; win.location.href = url } else window.open(url, '_blank', 'noopener')
    return true
  } catch (err) {
    win?.close()
    onError?.(err)
    return false
  }
}

// Google Maps search link for an address (used in arrival reminders).
export const mapsUrl = (address) => `https://maps.google.com/?q=${encodeURIComponent(address)}`
