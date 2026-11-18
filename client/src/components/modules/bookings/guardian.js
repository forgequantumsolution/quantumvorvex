/** Guardian / native-address helpers shared by the booking forms. */
import i18n from '../../../i18n'

/** The guardian/native-address keys a booking carries, all optional. */
export const GUARDIAN_KEYS = ['nativeAddress', 'guardianName', 'guardianPhone', 'guardianAadhaar']
export const EMPTY_GUARDIAN = {
  nativeAddress: '', guardianName: '', guardianPhone: '', guardianAadhaar: '',
  guardianFront: null, guardianBack: null,   // Aadhaar scans (File), uploaded after save
}

/** [label, file] pairs for the guardian's Aadhaar scans, as stored on the booking. */
export const guardianDocs = (v) => [
  ['Guardian Aadhaar — Front', v.guardianFront],
  ['Guardian Aadhaar — Back', v.guardianBack],
].filter(([, f]) => f)

export const digits = (s) => String(s || '').replace(/\D/g, '')

/** Trimmed values for the API — blanks become `blank` (undefined on create, null on edit). */
export const guardianPayload = (v, blank = undefined) => ({
  nativeAddress:   v.nativeAddress?.trim() || blank,
  guardianName:    v.guardianName?.trim() || blank,
  guardianPhone:   digits(v.guardianPhone) || blank,
  guardianAadhaar: digits(v.guardianAadhaar) || blank,
})

/** Optional fields, but a number that is filled in must be complete. */
export function guardianErrors(v, fieldName = (k) => k) {
  const t = (key) => i18n.t(`bookings:guardian.err.${key}`)
  const e = {}
  const phone = digits(v.guardianPhone)
  const aadhaar = digits(v.guardianAadhaar)
  if (phone && phone.length !== 10) e[fieldName('guardianPhone')] = t('phone')
  if (aadhaar && aadhaar.length !== 12) e[fieldName('guardianAadhaar')] = t('aadhaar')
  return e
}
