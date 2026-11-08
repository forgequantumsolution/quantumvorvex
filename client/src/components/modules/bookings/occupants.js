/** PG occupant-card helpers shared by PgOccupants and BookingForm. */
import { bedLabel } from '../../../utils/beds'
import i18n from '../../../i18n'

let occKey = 0

// A blank occupant for `bedNo`, rent pre-filled from the room's bed rate.
// `rateAuto` marks the rent as the default so a stay-type switch can refresh it.
export const newOccupant = (bedNo, rate) => ({
  key: ++occKey,
  bedNo,
  name: '', phone: '', email: '',
  idType: 'Aadhaar', idNumber: '',
  rate: rate ? String(rate) : '', rateAuto: true,
  advance: '', deposit: '',
  front: null, back: null,
})

// Form-field names, so a failed submit can scroll to the first bad field.
export const occField = (o, k) => `occ-${o.key}-${k}`

/** Per-occupant validation; merges keyed errors into `e`. */
// Messages are looked up when validating (not at import), so they follow the language.
export function occupantErrors(occupants, beds) {
  const t = (key, vars) => i18n.t(`bookings:pg.err.${key}`, vars)
  const e = {}
  occupants.forEach((o) => {
    const bed = bedLabel(o.bedNo)
    if (o.name.trim().length < 2) e[occField(o, 'name')] = t('name', { bed })
    if (!/^\d{10}$/.test(o.phone.replace(/\D/g, ''))) e[occField(o, 'phone')] = t('phone', { bed })
    if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email.trim())) e[occField(o, 'email')] = t('email')
    if (!(Number(o.rate) > 0)) e[occField(o, 'rate')] = t('rent', { bed })
    const held = beds?.find((b) => b.bedNo === o.bedNo)
    if (held && !held.free) e[occField(o, 'bed')] = t('taken', { bed })
  })
  return e
}
