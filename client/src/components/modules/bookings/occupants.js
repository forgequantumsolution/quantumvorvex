/** PG occupant-card helpers shared by PgOccupants and BookingForm. */
import { bedLabel } from '../../../utils/beds'

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
export function occupantErrors(occupants, beds) {
  const e = {}
  occupants.forEach((o) => {
    if (o.name.trim().length < 2) e[occField(o, 'name')] = `Bed ${bedLabel(o.bedNo)}: enter the occupant's name`
    if (!/^\d{10}$/.test(o.phone.replace(/\D/g, ''))) e[occField(o, 'phone')] = `Bed ${bedLabel(o.bedNo)}: enter a 10-digit phone`
    if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email.trim())) e[occField(o, 'email')] = 'Enter a valid email'
    if (!(Number(o.rate) > 0)) e[occField(o, 'rate')] = `Bed ${bedLabel(o.bedNo)}: enter the rent`
    const bed = beds?.find((b) => b.bedNo === o.bedNo)
    if (bed && !bed.free) e[occField(o, 'bed')] = `Bed ${bedLabel(o.bedNo)} is taken for these dates`
  })
  return e
}
