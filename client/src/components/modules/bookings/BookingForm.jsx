import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, Button } from '../../ui-tw'
import CameraCaptureModal from '../../ui/CameraCaptureModal'
import { bookingsApi, roomsApi, settingsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'
import { formatDate } from '../../../utils/format'
import PhoneFields from './PhoneFields'
import NameFields from './NameFields'
import UploadZone from './UploadZone'
import PgOccupants from './PgOccupants'
import { occupantErrors, occField } from './occupants'
import { bedFillLabel, bedLabel, bedOccupancy, hasBedStays, isBedRoom, rentFirstMonthNote, rentMonthsAtMoveIn } from '../../../utils/beds'
import {
  TODAY, joinPhones, phoneErrors, phoneFieldName, splitPhones, MAX_PHONES,
  joinNames, nameErrors, nameFieldName, splitNames, MAX_NAMES,
} from '../../../utils/booking'
import { appLocale } from '../../../i18n'

const DAY_MS = 86400000

const EMPTY = {
  guestNames: [''], guestPhones: [''], guestEmail: '',
  idTypes: ['Aadhaar'], idNumber: '', nationality: 'Indian', guestAddress: '',
  adults: 1, children: 0,
  roomId: '', stayType: 'daily',
  fromDate: TODAY, toDate: '', months: 1,
  roomRate: '', discount: 0, taxRate: 12, extraCharges: 0, advance: 0,
  source: 'walk_in', specialRequests: '', notes: '',
  invoiceNo: '',
}

// Source values go to the server; labels come from bookings:sources.<value>.
const SOURCE_VALUES = ['walk_in', 'phone', 'website', 'ota', 'referral', 'corporate']
// ID type values are stored as-is (and name the uploaded scans); only the chip
// labels are translated, via bookings:idTypes.<value>.
const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Voter ID', 'Other']

// Used for the captured file's name, which is what the server stores on disk —
// keep it to safe characters so "Driving License" doesn't become a messy path.
const slugify = (s) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Can this room take a new booking right now? A PG room with a free bed is kept
// "available" by the server; full / maintenance / reserved rooms are not.
const isBookable = (r) => r.status === 'available'

function nights(from, to) {
  if (!from || !to) return 0
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY_MS))
}

// GST-inclusive pricing for one stay (mirrors the server's computePricing).
function priceStay({ rate, units, discount = 0, taxRate = 0, extra = 0, advance = 0 }) {
  const subtotal = (Number(rate) || 0) * units
  const gross = Math.max(0, subtotal - (Number(discount) || 0))
  const taxable = +(gross / (1 + (Number(taxRate) || 0) / 100)).toFixed(2)
  const taxAmount = +(gross - taxable).toFixed(2)
  const total = gross + (Number(extra) || 0)
  const balance = total - (Number(advance) || 0)
  return { units, subtotal, taxable, taxAmount, total, balance }
}

// [from, to) of the stay being entered, as ISO strings — or null while the
// dates are incomplete. Monthly stays run 30 days a month, as on the server.
// An open-ended PG tenancy has no `to`: the bed must be free from `from` on.
function stayRange(v, openEnded) {
  if (!v.fromDate) return null
  const from = new Date(v.fromDate)
  if (openEnded) return isNaN(from) ? null : { from: from.toISOString() }
  const to = v.stayType === 'daily'
    ? (v.toDate ? new Date(v.toDate) : null)
    : new Date(from.getTime() + (Number(v.months) || 0) * 30 * DAY_MS)
  if (!to || isNaN(from) || isNaN(to) || to <= from) return null
  return { from: from.toISOString(), to: to.toISOString() }
}

/**
 * One titled panel of the form. Grouping the fields into bordered sections is
 * what keeps a form this long readable — a flat run of inputs under small
 * uppercase captions gives the eye nothing to anchor on.
 */
function Section({ title, hint, children }) {
  return (
    <section className="rounded-xl border border-line overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3.5 sm:px-4 py-2.5 border-b border-line bg-surface2">
        <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
        {hint && <span className="text-xs text-ink3 min-w-0">{hint}</span>}
      </header>
      <div className="p-3.5 sm:p-4 bg-surface">{children}</div>
    </section>
  )
}

// A label/amount line in the summary rail.
function SumRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-ink2">
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Inline create-booking form. Loads real rooms from the API, previews the full
 * pricing breakdown, and POSTs to the booking API. Calls onSaved(booking) on
 * success and onCancel() when the user backs out.
 */
export default function BookingForm({ onSaved, onCancel }) {
  const { t } = useTranslation('bookings')
  const toast = useToast()
  const idTypeLabel = (type) => t(`idTypes.${type}`, { defaultValue: type })
  const sourceOptions = SOURCE_VALUES.map((value) => ({ value, label: t(`sources.${value}`) }))
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  // The auto-suggested invoice number; if the user leaves the field on this value
  // we send nothing and let the server reserve the next one atomically (avoids
  // two same-day bookings grabbing the same number).
  const [autoInvoiceNo, setAutoInvoiceNo] = useState('')

  // ── PG (room let by bed) ──
  // bookBy: 'bed' = one booking per occupant on their own bed; 'room' = the
  // ordinary whole-room booking (allowed on a PG room only when every bed is free).
  const [bookBy, setBookBy] = useState('room')
  const [occupants, setOccupants] = useState([])
  const [bedAvail, setBedAvail] = useState({ loading: false, beds: null })

  // ── ID documents ──
  // idDocs is keyed by ID type → { front, back } files
  const [idDocs, setIdDocs] = useState({})
  const [extraDocs, setExtraDocs] = useState([]) // { key, label, file }
  const docKey = useRef(0)

  // The document slot currently being photographed: { title, onPick }. Scanning
  // an ID with the camera produces the same File a picker would, so it flows
  // through the existing idDocs/extraDocs state and submit path unchanged.
  const [docCamera, setDocCamera] = useState(null)

  // ── Guest photo ──
  // Set once the booking exists; holds the camera step open until the photo is
  // saved or skipped, at which point we hand the booking up via onSaved.
  const [photoFor, setPhotoFor] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  // Toggle an ID type on/off; clear its uploaded files when removed.
  const toggleIdType = (type) => {
    const has = values.idTypes.includes(type)
    setValues((v) => ({
      ...v,
      idTypes: has ? v.idTypes.filter((x) => x !== type) : [...v.idTypes, type],
    }))
    if (has) setIdDocs((d) => { const n = { ...d }; delete n[type]; return n })
  }

  const setIdDoc = (type, side, file) =>
    setIdDocs((d) => ({ ...d, [type]: { ...d[type], [side]: file } }))

  const addExtraDoc = () =>
    setExtraDocs((d) => [...d, { key: ++docKey.current, label: '', file: null }])
  const updateExtraDoc = (key, patch) =>
    setExtraDocs((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const removeExtraDoc = (key) =>
    setExtraDocs((d) => d.filter((x) => x.key !== key))

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const setPhones = (guestPhones) => setValues((v) => ({ ...v, guestPhones }))
  const setNames = (guestNames) => setValues((v) => ({ ...v, guestNames }))

  // ── Returning-guest lookup ──
  // The first number is the guest's identity here, so as soon as it's complete we
  // pull up their most recent stay and fill the panel in. Only blank fields (and
  // the two that start on a default) are touched — anything typed is left alone,
  // and "Clear" empties the panel if this turns out to be someone else.
  const [lookup, setLookup] = useState(null)   // { state, visits?, lastStay? }

  const primaryPhone = values.guestPhones[0] || ''

  const applyGuest = (g) => {
    setValues((v) => {
      const blank = (cur) => !String(cur ?? '').trim()
      const names  = splitNames(g.guestName).slice(0, MAX_NAMES)
      const phones = splitPhones(g.guestPhone).slice(0, MAX_PHONES)
      const ids = (g.idType || '').split(',').map((x) => x.trim()).filter((x) => ID_TYPES.includes(x))
      return {
        ...v,
        guestNames:   names.length && v.guestNames.every(blank) ? names : v.guestNames,
        // Bring across the other numbers we hold, but never overwrite ones typed here.
        guestPhones:  v.guestPhones.length === 1 && phones.length > 1 ? phones : v.guestPhones,
        guestEmail:   blank(v.guestEmail)   ? g.guestEmail   || '' : v.guestEmail,
        guestAddress: blank(v.guestAddress) ? g.guestAddress || '' : v.guestAddress,
        nationality:  blank(v.nationality) || v.nationality === EMPTY.nationality
          ? g.nationality || v.nationality : v.nationality,
        idTypes: ids.length && v.idTypes.join() === EMPTY.idTypes.join() ? ids : v.idTypes,
        idNumber:     blank(v.idNumber)     ? g.idNumber     || '' : v.idNumber,
      }
    })
  }

  useEffect(() => {
    if (primaryPhone.length !== 10) { setLookup(null); return }
    let cancelled = false
    setLookup({ state: 'searching' })
    // Debounced so correcting a digit doesn't fire a request per keystroke.
    const id = setTimeout(() => {
      bookingsApi.lookupGuest(primaryPhone)
        .then(({ data }) => {
          if (cancelled) return
          if (!data.found) { setLookup({ state: 'none' }); return }
          setLookup({ state: 'found', visits: data.visits, lastStay: data.lastStay })
          applyGuest(data.guest)
        })
        .catch(() => { if (!cancelled) setLookup(null) })
    }, 350)
    return () => { cancelled = true; clearTimeout(id) }
  }, [primaryPhone])

  // Not the same person after all — empty the guest panel but keep the number.
  const clearGuest = () => {
    setValues((v) => ({
      ...v,
      guestNames: [''], guestEmail: '', guestAddress: '',
      nationality: EMPTY.nationality, idTypes: EMPTY.idTypes, idNumber: '',
      guestPhones: [v.guestPhones[0] || ''],
    }))
    setLookup({ state: 'cleared' })
  }

  // Load rooms + hotel settings on mount
  useEffect(() => {
    setApiError('')
    setLoadingRooms(true)
    Promise.all([
      roomsApi.getAll(),
      settingsApi.get().catch(() => ({ data: {} })),
      bookingsApi.nextInvoiceNo().catch(() => ({ data: {} })),
    ])
      .then(([roomsRes, settingsRes, invoiceRes]) => {
        const list = roomsRes.data?.rooms || roomsRes.data || []
        // Every room is listed so staff can see why one can't be picked; bookable
        // ones first. A PG room with a free bed stays "available" (server-side).
        const pool = [...list].sort((a, b) => Number(!isBookable(a)) - Number(!isBookable(b)))
        setRooms(pool)
        setRoomTypes(settingsRes.data?.roomTypes || [])
        const gst = settingsRes.data?.hotel?.gstRate
        const nextInvoiceNo = invoiceRes.data?.invoiceNo || ''
        setAutoInvoiceNo(nextInvoiceNo)
        setValues((v) => ({
          ...EMPTY,
          ...v,
          roomId: pool.find(isBookable)?.id || '',
          taxRate: gst ?? v.taxRate,
          invoiceNo: nextInvoiceNo,
        }))
      })
      .catch(() => setApiError(t('form.loadRoomsError')))
      .finally(() => setLoadingRooms(false))
    // Runs once on mount; t only feeds the error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typeName = (r) => roomTypes.find((rt) => rt.id === r?.typeId)?.name || ''

  const selectedRoom = rooms.find((r) => r.id === values.roomId)
  const pgRoom = isBedRoom(selectedRoom)
  const pgMode = pgRoom && bookBy === 'bed'
  // Any monthly booking (whole room or bed) is a tenancy: booked once, open-ended
  // until move-out, with each month's rent invoiced automatically and collected
  // on the booking — never re-entered. Daily stays keep fixed dates.
  const tenancyMode = values.stayType === 'monthly'
  const bedRate = (r, stayType) => (stayType === 'daily' ? r?.bedDailyRate : r?.bedMonthlyRate) || ''

  // Whole room or bed by bed is the operator's choice per booking. A new room
  // starts on "whole room", unless it's already being let bed by bed.
  const roomHasBedStays = hasBedStays(selectedRoom)
  useEffect(() => {
    setOccupants([])
    setBookBy(roomHasBedStays ? 'bed' : 'room')
  }, [values.roomId, roomHasBedStays])

  // The rate follows the room: its nightly rate for a daily stay, its monthly
  // rate for a monthly one — refilled when either changes, unless the operator
  // has typed their own (clearing the field hands it back to the room).
  const [rateEdited, setRateEdited] = useState(false)
  // A room with several beds and a per-bed rent is priced as beds × bed rent
  // when booked whole (3 × ₹6,000 = ₹18,000); otherwise the room's own rate.
  const roomRateFor = (r, stayType) => {
    const bed = stayType === 'daily' ? r?.bedDailyRate : r?.bedMonthlyRate
    if (isBedRoom(r) && bed) return bed * r.bedCount
    return (stayType === 'daily' ? r?.dailyRate : r?.monthlyRate) || ''
  }
  const autoRate = roomRateFor(selectedRoom, values.stayType)
  const perBed = isBedRoom(selectedRoom)
    && (values.stayType === 'daily' ? selectedRoom?.bedDailyRate : selectedRoom?.bedMonthlyRate)
  useEffect(() => {
    if (!rateEdited) setValues((v) => ({ ...v, roomRate: autoRate ? String(autoRate) : '' }))
  }, [autoRate, rateEdited])
  const setRate = (e) => {
    const v = e.target.value
    setRateEdited(v !== '')
    setValues((x) => ({ ...x, roomRate: v }))
  }

  // Switching to bed booking defaults to monthly (PG); the operator can still
  // change the stay type for a nightly bed (hostel).
  const chooseBookBy = (mode) => {
    setBookBy(mode)
    if (mode === 'bed') setValues((v) => ({ ...v, stayType: 'monthly' }))
  }

  // A stay-type switch changes the unit (night ↔ month): refresh rents that are
  // still the room's default; ones typed by hand are left alone.
  useEffect(() => {
    setOccupants((list) => list.map((o) => (o.rateAuto ? { ...o, rate: String(bedRate(selectedRoom, values.stayType)) } : o)))
    // selectedRoom is derived from roomId, which resets the list itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.stayType])

  // Which beds are free for the dates being entered — refetched as they change.
  const range = stayRange(values, tenancyMode)
  const rangeKey = range ? `${range.from}|${range.to || 'open'}` : ''
  useEffect(() => {
    if (!pgRoom || !range) { setBedAvail({ loading: false, beds: null }); return }
    let cancelled = false
    setBedAvail((a) => ({ ...a, loading: true }))
    bookingsApi.bedAvailability({ roomId: values.roomId, ...range })
      .then(({ data }) => { if (!cancelled) setBedAvail({ loading: false, beds: data.beds }) })
      .catch(() => { if (!cancelled) setBedAvail({ loading: false, beds: null }) })
    return () => { cancelled = true }
    // range is rebuilt each render; rangeKey is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.roomId, pgRoom, rangeKey])

  // Unknown until the dates are in — don't block whole-room before then (the
  // server re-checks every bed on save anyway).
  const allBedsFree = !bedAvail.beds || bedAvail.beds.every((b) => b.free)
  // Whole-room only while every bed is free; fall back if a bed gets taken.
  useEffect(() => {
    if (pgRoom && bookBy === 'room' && bedAvail.beds && !allBedsFree) setBookBy('bed')
  }, [pgRoom, bookBy, bedAvail.beds, allBedsFree])

  // ── Live pricing preview (mirrors the server formula) ──
  // The room rate is GST-inclusive, so GST is extracted from (subtotal − discount)
  // rather than added on top; the total stays equal to what's entered (+ extras).
  // A tenancy is shown as the rent billed at move-in, with its first month by the day.
  const units = tenancyMode ? rentMonthsAtMoveIn(values.fromDate)
    : values.stayType === 'daily' ? nights(values.fromDate, values.toDate) : Number(values.months) || 0
  const pricing = useMemo(() => priceStay({
    rate: values.roomRate, units, discount: values.discount, taxRate: values.taxRate,
    extra: values.extraCharges, advance: values.advance,
  }), [values, units])

  // PG: each occupant is priced as their own stay; the rail shows them and the sum.
  const occPricing = useMemo(() => occupants.map((o) => ({
    o, ...priceStay({ rate: o.rate, units, taxRate: values.taxRate, advance: o.advance }),
  })), [occupants, units, values.taxRate])
  const pgTotals = occPricing.reduce((t, p) => ({
    subtotal: t.subtotal + p.subtotal,
    taxAmount: t.taxAmount + p.taxAmount,
    total: t.total + p.total,
    advance: t.advance + (Number(p.o.advance) || 0),
    // Advance beyond the first bill is credit for the next, not a negative due.
    balance: t.balance + Math.max(0, p.balance),
    deposit: t.deposit + (Number(p.o.deposit) || 0),
  }), { subtotal: 0, taxAmount: 0, total: 0, advance: 0, balance: 0, deposit: 0 })

  const validate = () => {
    const e = {}
    if (pgMode) {
      if (!occupants.length) e.beds = t('form.err.selectBed')
      Object.assign(e, occupantErrors(occupants, bedAvail.beds))
    } else {
      Object.assign(e, nameErrors(values.guestNames), phoneErrors(values.guestPhones))
      if (values.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.guestEmail.trim()))
        e.guestEmail = t('form.err.email')
      if (!values.roomRate || Number(values.roomRate) <= 0) e.roomRate = t('form.err.rate')
    }
    if (!values.roomId) e.roomId = t('form.err.room')
    if (values.stayType === 'daily') {
      if (!values.toDate) e.toDate = t('form.err.checkOutRequired')
      else if (nights(values.fromDate, values.toDate) < 1) e.toDate = t('form.err.afterCheckIn')
    } else if (!tenancyMode && (!values.months || Number(values.months) < 1)) {
      e.months = t('form.err.oneMonth')
    }
    setErrors(e)
    return e
  }

  // Field order for "jump to first error" on a failed submit.
  const FIELD_ORDER = pgMode
    ? ['roomId', 'toDate', 'months', 'beds',
       ...occupants.flatMap((o) => ['bed', 'name', 'phone', 'email', 'rate'].map((k) => occField(o, k)))]
    : [...values.guestNames.map((_, i) => nameFieldName(i)),
       ...values.guestPhones.map((_, i) => phoneFieldName(i)),
       'guestEmail', 'roomId', 'roomRate', 'toDate', 'months']

  const handleSubmit = async () => {
    const e = validate()
    const errorKeys = Object.keys(e)
    if (errorKeys.length) {
      const first = FIELD_ORDER.find((k) => e[k]) || errorKeys[0]
      toast(e[first] || t('form.err.fixFields'), 'danger')
      const el = document.querySelector(`[name="${first}"], [data-field="${first}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus?.({ preventScroll: true })
      return
    }
    setSubmitting(true)
    setApiError('')
    if (pgMode) {
      try { await submitGroup() } finally { setSubmitting(false) }
      return
    }
    try {
      const payload = {
        // Names and numbers each travel as one comma-separated string; the
        // first entry is the guest the booking is billed to.
        guestName: joinNames(values.guestNames),
        guestPhone: joinPhones(values.guestPhones) || undefined,
        guestEmail: values.guestEmail.trim() || undefined,
        guestAddress: values.guestAddress.trim() || undefined,
        nationality: values.nationality.trim() || undefined,
        idType: values.idTypes.join(', ') || undefined,
        idNumber: values.idNumber.trim() || undefined,
        adults: Number(values.adults) || 1,
        children: Number(values.children) || 0,
        roomId: values.roomId,
        stayType: values.stayType,
        fromDate: new Date(values.fromDate).toISOString(),
        toDate: values.stayType === 'daily' ? new Date(values.toDate).toISOString() : undefined,
        // Monthly = open-ended tenancy: no fixed number of months.
        months: undefined,
        roomRate: Number(values.roomRate) || 0,
        discount: Number(values.discount) || 0,
        taxRate: Number(values.taxRate) || 0,
        extraCharges: Number(values.extraCharges) || 0,
        advance: Number(values.advance) || 0,
        source: values.source,
        specialRequests: values.specialRequests.trim() || undefined,
        notes: values.notes.trim() || undefined,
        // Only send an explicit number if the user edited it; otherwise let the
        // server auto-assign so concurrent same-day bookings don't collide.
        invoiceNo: values.invoiceNo.trim() && values.invoiceNo.trim() !== autoInvoiceNo
          ? values.invoiceNo.trim()
          : undefined,
      }
      const { data } = await bookingsApi.create(payload)
      const booking = data.booking

      // Attach any ID documents to the new booking (best-effort).
      const entries = []
      // Document labels are stored with the file, so they stay in English.
      values.idTypes.forEach((type) => {
        const docs = idDocs[type]
        if (docs?.front) entries.push([`${type} — Front`, docs.front])
        if (docs?.back) entries.push([`${type} — Back`, docs.back])
      })
      extraDocs.forEach((d) => {
        if (d.file) entries.push([d.label.trim() || d.file.name, d.file])
      })
      if (entries.length) {
        const form = new FormData()
        entries.forEach(([, file]) => form.append('documents', file))
        form.append('docTypes', JSON.stringify(entries.map(([label]) => label)))
        try {
          await bookingsApi.uploadDocuments(booking.id, form)
        } catch {
          toast(t('form.toast.docsFailed'), 'danger')
        }
      }

      // The booking is saved — hold the form open on the photo step. onSaved
      // fires from the camera handlers below, whichever way the user exits.
      setPhotoFor(booking)
    } catch (err) {
      const d = err.response?.data
      toast(d?.message || d?.error || t('form.toast.createFailed'), 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  // PG: one booking per occupant on their own bed, then each one's ID scans.
  const submitGroup = async () => {
    const shared = {
      roomId: values.roomId,
      stayType: values.stayType,
      fromDate: new Date(values.fromDate).toISOString(),
      toDate: values.stayType === 'daily' ? new Date(values.toDate).toISOString() : undefined,
      months: values.stayType === 'monthly' && !tenancyMode ? Number(values.months) : undefined,
      taxRate: Number(values.taxRate) || 0,
      source: values.source,
      specialRequests: values.specialRequests.trim() || undefined,
      notes: values.notes.trim() || undefined,
    }
    const list = occupants.map((o) => ({
      bedNo: o.bedNo,
      guestName: o.name.trim(),
      guestPhone: o.phone.replace(/\D/g, ''),
      guestEmail: o.email.trim() || undefined,
      idType: o.idType || undefined,
      idNumber: o.idNumber.trim() || undefined,
      roomRate: Number(o.rate) || 0,
      advance: Number(o.advance) || 0,
      securityDeposit: Number(o.deposit) || 0,
    }))
    let bookings
    try {
      const { data } = await bookingsApi.createGroup({ ...shared, occupants: list })
      bookings = data.bookings
    } catch (err) {
      const d = err.response?.data
      toast(d?.message || d?.error || t('form.toast.createGroupFailed'), 'danger')
      // A bed may have just been taken — refresh the picker so it shows why.
      if (err.response?.status === 409 && range) {
        bookingsApi.bedAvailability({ roomId: values.roomId, ...range })
          .then(({ data }) => setBedAvail({ loading: false, beds: data.beds })).catch(() => {})
      }
      return
    }

    // Bookings come back in occupant order; attach each one's ID scans.
    let failed = 0
    await Promise.all(occupants.map(async (o, i) => {
      const files = [[`${o.idType} — Front`, o.front], [`${o.idType} — Back`, o.back]].filter(([, f]) => f)
      if (!files.length || !bookings[i]) return
      const form = new FormData()
      files.forEach(([, f]) => form.append('documents', f))
      form.append('docTypes', JSON.stringify(files.map(([label]) => label)))
      try { await bookingsApi.uploadDocuments(bookings[i].id, form) } catch { failed++ }
    }))
    if (failed) toast(t('form.toast.scansFailed'), 'danger')

    onSaved({ group: true, bookings, roomNumber: selectedRoom?.number })
  }

  // Attach the captured guest photo to the booking, then finish. The booking
  // already exists, so an upload failure is reported but never discards it.
  const savePhoto = async (file) => {
    setPhotoBusy(true)
    try {
      const form = new FormData()
      form.append('documents', file)
      form.append('docTypes', JSON.stringify(['guest_photo']))
      await bookingsApi.uploadDocuments(photoFor.id, form)
    } catch {
      toast(t('form.toast.photoFailed'), 'danger')
    } finally {
      setPhotoBusy(false)
      onSaved(photoFor)
    }
  }

  const inr = (n) => `₹${Number(n || 0).toLocaleString(appLocale())}`

  // Summary-rail context: which room, how long, and how many files are queued.
  const roomLabel = selectedRoom
    ? `${t('roomN', { room: selectedRoom.number })}${typeName(selectedRoom) ? ` · ${typeName(selectedRoom)}` : ''}${
        pgMode ? ` · ${t('form.beds', { count: occupants.length })}` : ''}`
    : t('form.noRoom')
  // Room picker option. Rooms that can't take a booking now are shown greyed out
  // with the reason, rather than hidden or (worse) offered.
  const roomOption = (r) => {
    const name = `${t('roomN', { room: r.number })}${typeName(r) ? ` · ${typeName(r)}` : ''}`
    const reason = r.status === 'maintenance' ? t('form.roomState.maintenance')
      : r.status === 'reserved' ? t('form.roomState.reserved')
      : r.status === 'occupied' ? (hasBedStays(r) ? t('form.roomState.full', { count: r.bedCount }) : t('form.roomState.occupied')) : ''
    if (reason) return { value: r.id, label: `${name} — ${reason}`, disabled: true }
    if (!isBedRoom(r)) return { value: r.id, label: name }
    // Partly let bed by bed: say how many are free; otherwise just the bed count.
    if (!hasBedStays(r)) return { value: r.id, label: `${name} · ${t('form.beds', { count: r.bedCount })}` }
    const free = bedOccupancy(r).filter((b) => b.state === 'free').length
    return { value: r.id, label: `${name} · ${bedFillLabel(free, r.bedCount)}` }
  }
  const bookableCount = rooms.filter(isBookable).length
  const unitWord = values.stayType === 'daily' ? t('form.unit.night') : t('form.unit.month')
  const stayLabel = tenancyMode ? t('form.monthlyUntilMoveOut')
    : pricing.units ? t(values.stayType === 'daily' ? 'form.nights' : 'form.months', { count: pricing.units })
    : t('form.datesNotSet')
  const attachedCount = pgMode
    ? occupants.reduce((n, o) => n + [o.front, o.back].filter(Boolean).length, 0)
    : values.idTypes.reduce((n, t) => n + [idDocs[t]?.front, idDocs[t]?.back].filter(Boolean).length, 0) +
      extraDocs.filter((d) => d.file).length
  const shownTotal = pgMode ? pgTotals.total : pricing.total
  const shownBalance = pgMode ? pgTotals.balance : pricing.balance

  return (
    <div>
      <div className="px-3 py-4 sm:px-5 sm:py-5">
        {apiError && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger-text">
            {apiError}
          </div>
        )}

        {/* Form on the left, a live summary rail on the right. Below xl the rail
            drops underneath, so on a laptop nothing is squeezed and on a wide
            monitor the fields stop stretching to unreadable widths. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
          <div className="min-w-0 space-y-4">

            {/* ── Guest ── (a PG bed booking takes guests per bed, below) */}
            {!pgMode && (
            <Section title={t('form.guestDetails')} hint={t('form.guestDetailsHint')}>
              {/* Two columns even on a phone: name, phone, email and address take
                  the full row, the short fields (nationality, adults, children) pair up. */}
              <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 sm:gap-x-4 gap-y-3.5">
                <NameFields className="col-span-2 sm:col-span-1 lg:col-span-4" names={values.guestNames} errors={errors}
                            onChange={setNames} />
                <PhoneFields className="col-span-2 sm:col-span-1 lg:col-span-4" phones={values.guestPhones} errors={errors}
                             onChange={setPhones} required />
                <Field className="col-span-2 sm:col-span-1 lg:col-span-4" label={t('common:email')} name="guestEmail" type="email" value={values.guestEmail}
                       onChange={set('guestEmail')} placeholder="guest@example.com" error={errors.guestEmail} />

                {/* What the number turned up — filled details are only ever a
                    starting point, so the row stays visible and reversible. */}
                {lookup && (
                  <div className="col-span-2 lg:col-span-12">
                    {lookup.state === 'found' ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-gold-border
                                      bg-gold-bg px-3 py-2 text-xs text-ink2">
                        <span className="font-medium text-gold">{t('form.lookup.returning')}</span>
                        <span>
                          {t('form.lookup.visits', { count: lookup.visits })}
                          {lookup.lastStay && ` · ${t('form.lookup.last', { no: lookup.lastStay.bookingNo })}`}
                          {lookup.lastStay?.roomNumber && ` · ${t('roomN', { room: lookup.lastStay.roomNumber })}`}
                          {lookup.lastStay?.fromDate && ` · ${formatDate(lookup.lastStay.fromDate)}`}
                        </span>
                        <button type="button" onClick={clearGuest}
                                className="ml-auto font-medium text-ink3 hover:text-danger transition-colors pointer-coarse:min-h-11">
                          {t('form.lookup.clear')}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-ink3">
                        {lookup.state === 'searching' && t('form.lookup.searching')}
                        {lookup.state === 'none' && t('form.lookup.none')}
                        {lookup.state === 'cleared' && t('form.lookup.cleared')}
                      </p>
                    )}
                  </div>
                )}
                <Field className="col-span-2 sm:col-span-1 lg:col-span-6" label={t('form.address')} value={values.guestAddress}
                       onChange={set('guestAddress')} placeholder={t('form.addressPlaceholder')} />
                <Field className="col-span-2 sm:col-span-1 lg:col-span-2" label={t('form.nationality')} value={values.nationality}
                       onChange={set('nationality')} placeholder={t('form.nationalityPlaceholder')} />
                {/* Occupancy is a two-digit number — it never needs a full column. */}
                <Field className="lg:col-span-2" label={t('form.adults')} type="number" min="1" value={values.adults}
                       onChange={set('adults')} />
                <Field className="lg:col-span-2" label={t('form.children')} type="number" min="0" value={values.children}
                       onChange={set('children')} />
              </div>
            </Section>
            )}

            {/* ── Stay ── */}
            <Section title={t('form.stayRoom')} hint={stayLabel}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3.5">
                <Field label={t('common:room')} name="roomId" value={values.roomId} onChange={set('roomId')} error={errors.roomId}
                       options={
                         loadingRooms
                           ? [{ value: '', label: t('form.loadingRooms') }]
                           : bookableCount
                             ? rooms.map(roomOption)
                             : [{ value: '', label: t('form.noneFree') }, ...rooms.map(roomOption)]
                       } />
                <Field label={t('form.source')} value={values.source} onChange={set('source')} options={sourceOptions} />
                {pgMode || tenancyMode ? (
                  <div>
                    <span className="block text-xs font-medium text-ink2 mb-1.5">{t('form.invoices')}</span>
                    <p className="text-[12px] text-ink3 rounded-lg border border-dashed border-line2 px-3 py-2 m-0">
                      {tenancyMode
                        ? (pgMode ? t('form.invoiceMonthlyPerPerson') : t('form.invoiceMonthly'))
                        : t('form.invoicePerPerson')}
                    </p>
                  </div>
                ) : (
                  <Field label={t('form.invoiceNo')} value={values.invoiceNo} onChange={set('invoiceNo')}
                         placeholder={t('form.auto')} hint={t('form.invoiceNoHint')} />
                )}
                {pgRoom && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <span className="block text-xs font-medium text-ink2 mb-1.5">
                      {t('form.bookThisRoom', { count: selectedRoom.bedCount })}
                    </span>
                    <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto rounded-lg border border-line2 bg-surface2 p-[3px] gap-[3px]" role="radiogroup">
                      {[
                        { id: 'room', label: t('form.wholeRoom'), sub: allBedsFree ? t('form.wholeRoomSub') : t('form.wholeRoomNeedsFree') },
                        { id: 'bed', label: t('form.byBed'), sub: t('form.byBedSub') },
                      ].map((o) => {
                        const active = bookBy === o.id
                        const disabled = o.id === 'room' && !allBedsFree
                        return (
                          <button key={o.id} type="button" role="radio" aria-checked={active} disabled={disabled}
                                  onClick={() => chooseBookBy(o.id)}
                                  className={`px-3 py-1.5 rounded-md text-left transition-colors ${
                                    active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                                      : disabled ? 'text-ink3 opacity-50 cursor-not-allowed' : 'text-ink2 hover:text-ink'
                                  }`}>
                            <span className="block text-[12.5px] font-semibold">{o.label}</span>
                            <span className="block text-xs text-ink3">{o.sub}</span>
                          </button>
                        )
                      })}
                    </div>
                    {!allBedsFree && (
                      // Say why "Whole room" is off rather than leave a dead button.
                      <p className="text-xs text-ink3 mt-1.5 mb-0">
                        {t('form.bedsTaken', {
                          count: bedAvail.beds.filter((b) => !b.free).length,
                          beds: bedAvail.beds.filter((b) => !b.free)
                            .map((b) => `${t('bedN', { bed: b.label })} (${b.heldBy.name}${b.heldBy.until ? ` ${t('form.till', { date: formatDate(b.heldBy.until) })}` : ''})`)
                            .join(', '),
                        })}
                      </p>
                    )}
                  </div>
                )}
                <Field label={t('form.stayType')} value={values.stayType} onChange={set('stayType')}
                       options={[{ value: 'daily', label: t('form.daily') }, { value: 'monthly', label: t('form.monthly') }]} />
                <Field label={tenancyMode ? t('form.moveIn') : t('form.checkIn')} type="date" value={values.fromDate}
                       onChange={set('fromDate')} />
                {tenancyMode ? (
                  <div>
                    <span className="block text-xs font-medium text-ink2 mb-1.5">{t('table.columns.stay')}</span>
                    <p className="text-[12px] text-ink2 rounded-lg border border-gold-border bg-gold-bg px-3 py-2 m-0">
                      {t('form.untilMoveOut')}
                    </p>
                  </div>
                ) : values.stayType === 'daily' ? (
                  <Field label={t('form.checkOut')} name="toDate" type="date" value={values.toDate} onChange={set('toDate')}
                         error={errors.toDate} required />
                ) : (
                  <Field label={t('form.monthsLabel')} name="months" type="number" min="1" value={values.months} onChange={set('months')}
                         error={errors.months} required />
                )}
              </div>
            </Section>

            {/* ── PG occupants ── */}
            {pgMode && (
              <Section
                title={t('form.bedsOccupants')}
                hint={occupants.length ? t('form.bedsSelected', { count: occupants.length }) : t('form.pickBeds')}
              >
                <div data-field="beds">
                  <PgOccupants
                    beds={bedAvail.beds}
                    loading={bedAvail.loading}
                    occupants={occupants}
                    onChange={setOccupants}
                    errors={errors}
                    unit={unitWord}
                    defaultRate={bedRate(selectedRoom, values.stayType)}
                    idTypes={ID_TYPES}
                    onScan={setDocCamera}
                  />
                  {errors.beds && <p className="text-xs text-danger mt-2 mb-0">{errors.beds}</p>}
                </div>
              </Section>
            )}

            {/* ── Pricing ── */}
            {pgMode ? (
              <Section title={t('form.pricing')} hint={t('form.pricingPgHint')}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3.5 items-end">
                  <Field label={t('form.gstPct')} type="number" min="0" value={values.taxRate} onChange={set('taxRate')}
                         hint={t('form.gstIncludedRent')} />
                  <p className="md:col-span-2 text-xs text-ink3 m-0 pb-1">
                    {t('form.depositNote')}
                  </p>
                </div>
              </Section>
            ) : (
            <Section title={t('form.pricing')} hint={t('form.gstIncludedRate')}>
              {/* Five across only at 2xl: at 1280 the summary rail leaves the form
                  ~580px, where "Extra charges (₹)" wraps and drags its input out of
                  line with the row. Three-up keeps every label on one line. */}
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-3.5">
                <Field className="col-span-2 md:col-span-1" label={t('form.rateLabel', { unit: unitWord })} name="roomRate" type="number"
                       min="0" value={values.roomRate} onChange={setRate} placeholder={t('form.ratePlaceholder')}
                       hint={selectedRoom && autoRate
                         ? (rateEdited
                           ? <>{t('form.roomRateIs', { amount: `₹${Number(autoRate).toLocaleString(appLocale())}` })} ·{' '}
                               <button type="button" className="text-gold hover:underline"
                                       onClick={() => setRateEdited(false)}>{t('form.useIt')}</button></>
                           : perBed
                             ? t('form.rateFromBeds', { count: selectedRoom.bedCount, amount: `₹${Number(perBed).toLocaleString(appLocale())}` })
                             : t('form.rateFromRoom', { room: selectedRoom.number }))
                         : undefined}
                       error={errors.roomRate} required />
                {!tenancyMode && (
                  <Field label={t('form.discountInr')} type="number" min="0" value={values.discount} onChange={set('discount')} />
                )}
                <Field label={t('form.gstPct')} type="number" min="0" value={values.taxRate} onChange={set('taxRate')} />
                {!tenancyMode && (
                  <Field label={t('form.extraInr')} type="number" min="0" value={values.extraCharges} onChange={set('extraCharges')} />
                )}
                <Field label={t('form.advanceInr')} type="number" min="0" value={values.advance} onChange={set('advance')} />
              </div>
            </Section>
            )}

            {/* ── ID & documents ──
                The scan slots are generated from the ID types picked here, so the
                two belong in one panel: picking "Aadhaar" reveals its front/back
                tiles right below instead of further down the page. */}
            {!pgMode && (
            <Section
              title={t('form.idDocs')}
              hint={attachedCount ? t('form.filesAttached', { count: attachedCount }) : t('common:optional')}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-4 gap-y-3.5 items-start">
                <div className="lg:col-span-8">
                  <span className="block text-xs font-medium text-ink2 mb-1.5">{t('form.idTypes')}</span>
                  <div className="flex flex-wrap gap-2">
                    {ID_TYPES.map((type) => {
                      const active = values.idTypes.includes(type)
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleIdType(type)}
                          className={`px-3 py-1.5 pointer-coarse:min-h-10 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-gold-bg text-gold border-gold'
                              : 'bg-surface2 text-ink2 border-line2 hover:border-gold'
                          }`}
                        >
                          {active ? `✓ ${idTypeLabel(type)}` : idTypeLabel(type)}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <Field className="lg:col-span-4" label={t('form.idNumber')} value={values.idNumber}
                       onChange={set('idNumber')} placeholder={t('form.idNumberPlaceholder')} />
              </div>

              {values.idTypes.length === 0 ? (
                <p className="text-xs text-ink3 mt-4 rounded-lg border border-dashed border-line2 px-3 py-3 text-center">
                  {t('form.selectIdType')}
                </p>
              ) : (
                <div className="space-y-3 mt-4">
                  {values.idTypes.map((type) => {
                    const done = [idDocs[type]?.front, idDocs[type]?.back].filter(Boolean).length
                    return (
                      <div key={type} className="rounded-xl border border-line bg-surface2 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-ink2">{idTypeLabel(type)}</span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            done === 2 ? 'text-gold bg-gold-bg' : 'text-ink3 bg-surface'
                          }`}>
                            {t('form.attachedOf', { done })}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <UploadZone
                            label={t('form.front')}
                            file={idDocs[type]?.front}
                            onPick={(f) => setIdDoc(type, 'front', f)}
                            onScan={() => setDocCamera({
                              title: t('form.scanSide', { doc: idTypeLabel(type), side: t('form.front') }),
                              namePrefix: `${slugify(type)}-front`,
                              onPick: (f) => setIdDoc(type, 'front', f),
                            })}
                          />
                          <UploadZone
                            label={t('form.back')}
                            file={idDocs[type]?.back}
                            onPick={(f) => setIdDoc(type, 'back', f)}
                            onScan={() => setDocCamera({
                              title: t('form.scanSide', { doc: idTypeLabel(type), side: t('form.back') }),
                              namePrefix: `${slugify(type)}-back`,
                              onPick: (f) => setIdDoc(type, 'back', f),
                            })}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {extraDocs.length > 0 && (
                <div className="mt-3 space-y-3">
                  {extraDocs.map((d) => (
                    <div key={d.key} className="rounded-xl border border-line bg-surface2 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-ink2">{t('form.additionalDoc')}</span>
                        <button
                          type="button"
                          onClick={() => removeExtraDoc(d.key)}
                          className="text-xs text-ink3 hover:text-danger-text pointer-coarse:min-h-11 pointer-coarse:px-2"
                        >
                          {t('common:remove')}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <Field label={t('form.docType')} value={d.label} placeholder={t('form.docTypePlaceholder')}
                               onChange={(e) => updateExtraDoc(d.key, { label: e.target.value })} />
                        <UploadZone
                          label={t('form.file')}
                          file={d.file}
                          onPick={(f) => updateExtraDoc(d.key, { file: f })}
                          onScan={() => setDocCamera({
                            title: d.label.trim() ? t('form.scanDoc', { doc: d.label.trim() }) : t('form.scanDocument'),
                            namePrefix: slugify(d.label) || 'document',
                            onPick: (f) => updateExtraDoc(d.key, { file: f }),
                          })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addExtraDoc}
                className="mt-3 w-full rounded-lg border border-dashed border-line2 py-2 pointer-coarse:min-h-11 text-xs font-medium text-ink3 hover:border-gold hover:text-gold transition-colors"
              >
                ＋ {t('form.addDoc')}
              </button>
            </Section>
            )}

            {/* ── Notes ── */}
            <Section title={t('form.notes')} hint={t('common:optional')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('form.specialRequests')} textarea value={values.specialRequests}
                       onChange={set('specialRequests')} placeholder={t('form.specialRequestsPlaceholder')} />
                <Field label={t('form.internalNotes')} textarea value={values.notes} onChange={set('notes')}
                       placeholder={t('form.internalNotesPlaceholder')} />
              </div>
            </Section>
          </div>

          {/* ── Live summary ── sticks alongside the form so the total stays in
              view while the operator is still filling fields further down. */}
          <aside className="xl:sticky xl:top-4">
            <div className="rounded-xl border border-gold-border bg-gold-bg overflow-hidden">
              <div className="px-4 py-3 border-b border-gold-border">
                <h4 className="text-[13px] font-semibold text-ink">{t('form.summary')}</h4>
                <p className="text-xs text-ink3 mt-0.5">{roomLabel} · {stayLabel}</p>
              </div>

              {pgMode ? (
              <div className="px-4 py-3 text-[13px] space-y-1.5">
                {occPricing.length === 0 && <p className="text-ink3 text-[12px] m-0">{t('form.noBedsYet')}</p>}
                {occPricing.map(({ o, total, balance }) => (
                  <div key={o.key} className="pb-1.5 border-b border-gold-border/60 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-ink">
                        <span className="font-semibold text-gold">{t('bedN', { bed: bedLabel(o.bedNo) })}</span>
                        {' · '}{o.name.trim() || t('form.unnamed')}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink">{inr(total)}</span>
                    </div>
                    <div className="text-xs text-ink3 mt-0.5">
                      {tenancyMode ? `${inr(o.rate)}${t('table.perMonth')}` : units ? `${units} × ${inr(o.rate)}` : t('form.datesNotSet')}
                      {' · '}{t('form.occAdv', { amount: inr(o.advance) })} · {t('form.occDue', { amount: inr(Math.max(0, balance)) })}
                      {Number(o.deposit) > 0 && ` · ${t('form.occDep', { amount: inr(o.deposit) })}`}
                    </div>
                  </div>
                ))}
                <SumRow label={t('form.gstIncl', { rate: values.taxRate || 0 })} value={inr(pgTotals.taxAmount)} />

                <div className="flex items-baseline justify-between pt-2 mt-2 border-t border-gold-border">
                  <span className="font-display font-bold text-ink">{tenancyMode ? t('form.billedAtMoveIn') : t('form.totalRent')}</span>
                  <span className="font-display font-bold text-lg text-gold">{inr(pgTotals.total)}</span>
                </div>
                <SumRow label={tenancyMode ? t('form.advanceAgainstRent') : t('form.advanceCollected')} value={inr(pgTotals.advance)} />
                <div className="flex items-baseline justify-between font-semibold text-ink">
                  <span>{tenancyMode ? t('form.dueAtMoveIn') : t('form.balanceDue')}</span><span>{inr(pgTotals.balance)}</span>
                </div>
                {pgTotals.deposit > 0 && (
                  <SumRow label={t('form.depositsHeld')} value={inr(pgTotals.deposit)} />
                )}
                {tenancyMode && (
                  <p className="text-xs text-ink3 m-0 pt-1.5">
                    {rentFirstMonthNote(values.fromDate)} {t('form.tenancyNotePg')}
                  </p>
                )}
              </div>
              ) : (
              <div className="px-4 py-3 text-[13px] space-y-1.5">
                <SumRow
                  label={tenancyMode
                    ? t('form.rentAtMoveIn')
                    : `${t('form.roomCharge')}${pricing.units ? ` · ${pricing.units} × ${inr(values.roomRate)}` : ''}`}
                  value={inr(pricing.subtotal)}
                />
                {Number(values.discount) > 0 && <SumRow label={t('form.discount')} value={`− ${inr(values.discount)}`} />}
                <SumRow label={t('form.taxable')} value={inr(pricing.taxable)} />
                <SumRow label={t('form.gstIncl', { rate: values.taxRate || 0 })} value={inr(pricing.taxAmount)} />
                {Number(values.extraCharges) > 0 && <SumRow label={t('form.extra')} value={inr(values.extraCharges)} />}

                <div className="flex items-baseline justify-between pt-2 mt-2 border-t border-gold-border">
                  <span className="font-display font-bold text-ink">{tenancyMode ? t('form.billedAtMoveIn') : t('common:total')}</span>
                  <span className="font-display font-bold text-lg text-gold">{inr(pricing.total)}</span>
                </div>

                <SumRow label={tenancyMode ? t('form.advanceAgainstRent') : t('form.advance')} value={inr(values.advance)} />
                <div className="flex items-baseline justify-between font-semibold text-ink">
                  <span>{tenancyMode ? t('form.dueAtMoveIn') : t('form.balanceDue')}</span><span>{inr(Math.max(0, pricing.balance))}</span>
                </div>
                {tenancyMode && (
                  <p className="text-xs text-ink3 m-0 pt-1.5">
                    {rentFirstMonthNote(values.fromDate)} {t('form.tenancyNote')}
                  </p>
                )}
              </div>
              )}

              <div className="px-4 py-2.5 border-t border-gold-border text-xs text-ink3">
                {attachedCount
                  ? t('form.docsOnSave', { count: attachedCount })
                  : t('form.noDocsYet')}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Actions ── Below xl the bar sticks to the bottom of the screen (above
          the phone's bottom bar) so Create is always one tap away on a long form.
          .sticky-bottom-bar (index.css) cancels #content's bottom padding gap.
          The floating AI button sits over its bottom-right corner, so on phones the
          totals line goes last (beside the button) and from sm the bar keeps clear. */}
      <div className="sticky-bottom-bar xl:static flex flex-wrap items-center justify-end gap-2
                      px-3 sm:pl-5 sm:pr-fab xl:pr-5 py-3 sm:py-3.5 border-t border-line bg-surface2 rounded-b-[var(--radius)]">
        {/* Below xl the summary rail has scrolled away, so repeat the total here. */}
        <div className="w-full sm:w-auto sm:mr-auto order-last sm:order-none pr-fab sm:pr-0 leading-[44px] sm:leading-normal text-[13px] text-ink3 xl:hidden">
          {t('common:total')} <span className="font-semibold text-ink">{inr(shownTotal)}</span>
          <span className="mx-1.5 text-line2">·</span>
          {t('form.balance')} <span className="font-semibold text-ink">{inr(shownBalance)}</span>
        </div>
        <Button variant="ghost" className="flex-1 sm:flex-none" onClick={onCancel} disabled={submitting}>{t('common:cancel')}</Button>
        <Button className="flex-[2] sm:flex-none" onClick={handleSubmit} icon="＋" disabled={submitting || loadingRooms}>
          {submitting
            ? t('common:saving')
            : pgMode && occupants.length > 1 ? t('form.createN', { count: occupants.length }) : t('form.create')}
        </Button>
      </div>

      {/* Scanning an ID slot. Rear camera by default — the operator is pointing
          the device at a card, not at themselves. The file is held in form state
          and uploaded with the rest on submit. */}
      {docCamera && (
        <CameraCaptureModal
          isOpen
          title={docCamera.title}
          hint={t('form.camera.docHint')}
          facingMode="environment"
          namePrefix={docCamera.namePrefix}
          confirmLabel={t('form.camera.attach')}
          skipLabel={t('common:cancel')}
          onCapture={(file) => { docCamera.onPick(file); setDocCamera(null) }}
          onSkip={() => setDocCamera(null)}
        />
      )}

      {/* Guest photo — opens once the booking is saved. Skipping still completes
          the booking, so a dead webcam can't block the front desk. */}
      {photoFor && (
      <CameraCaptureModal
        isOpen
        title={t('form.camera.guestPhoto')}
        hint={t('form.camera.guestPhotoHint', { no: photoFor?.bookingNo || '' })}
        facingMode="user"
        busy={photoBusy}
        confirmLabel={t('form.camera.savePhoto')}
        skipLabel={t('form.camera.skip')}
        namePrefix="guest-photo"
        onCapture={savePhoto}
        onSkip={() => onSaved(photoFor)}
      />
      )}
    </div>
  )
}
