import { useEffect, useMemo, useRef, useState } from 'react'
import { Field, Button } from '../../ui-tw'
import CameraCaptureModal from '../../ui/CameraCaptureModal'
import { bookingsApi, roomsApi, settingsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'
import { formatDate } from '../../../utils/format'
import PhoneFields from './PhoneFields'
import NameFields from './NameFields'
import {
  TODAY, joinPhones, phoneErrors, phoneFieldName, splitPhones, MAX_PHONES,
  joinNames, nameErrors, nameFieldName, splitNames, MAX_NAMES,
} from '../../../utils/booking'

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

const SOURCES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'website', label: 'Website' },
  { value: 'ota', label: 'OTA (Booking.com / MMT)' },
  { value: 'referral', label: 'Referral' },
  { value: 'corporate', label: 'Corporate' },
]
const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Voter ID', 'Other']

// Used for the captured file's name, which is what the server stores on disk —
// keep it to safe characters so "Driving License" doesn't become a messy path.
const slugify = (s) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function nights(from, to) {
  if (!from || !to) return 0
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY_MS))
}

/**
 * One titled panel of the form. Grouping the fields into bordered sections is
 * what keeps a form this long readable — a flat run of inputs under small
 * uppercase captions gives the eye nothing to anchor on.
 */
function Section({ title, hint, children }) {
  return (
    <section className="rounded-xl border border-line overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 px-4 py-2.5 border-b border-line bg-surface2">
        <h4 className="text-[12.5px] font-semibold text-ink">{title}</h4>
        {hint && <span className="text-[11px] text-ink3 shrink-0">{hint}</span>}
      </header>
      <div className="p-4 bg-surface">{children}</div>
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
  const toast = useToast()
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
  const toggleIdType = (t) => {
    const has = values.idTypes.includes(t)
    setValues((v) => ({
      ...v,
      idTypes: has ? v.idTypes.filter((x) => x !== t) : [...v.idTypes, t],
    }))
    if (has) setIdDocs((d) => { const n = { ...d }; delete n[t]; return n })
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
        const available = list.filter((r) => r.status === 'available')
        const pool = available.length ? available : list
        setRooms(pool)
        setRoomTypes(settingsRes.data?.roomTypes || [])
        const gst = settingsRes.data?.hotel?.gstRate
        const nextInvoiceNo = invoiceRes.data?.invoiceNo || ''
        setAutoInvoiceNo(nextInvoiceNo)
        setValues((v) => ({
          ...EMPTY,
          ...v,
          roomId: pool[0]?.id || '',
          taxRate: gst ?? v.taxRate,
          invoiceNo: nextInvoiceNo,
        }))
      })
      .catch(() => setApiError('Could not load rooms. Is the backend running?'))
      .finally(() => setLoadingRooms(false))
  }, [])

  const typeName = (r) => roomTypes.find((t) => t.id === r?.typeId)?.name || ''

  // ── Live pricing preview (mirrors the server formula) ──
  // The room rate is GST-inclusive, so GST is extracted from (subtotal − discount)
  // rather than added on top; the total stays equal to what's entered (+ extras).
  const pricing = useMemo(() => {
    const rate = Number(values.roomRate) || 0
    const units = values.stayType === 'daily' ? nights(values.fromDate, values.toDate) : Number(values.months) || 0
    const subtotal = rate * units
    const gross = Math.max(0, subtotal - (Number(values.discount) || 0))
    const taxable = +(gross / (1 + (Number(values.taxRate) || 0) / 100)).toFixed(2)
    const taxAmount = +(gross - taxable).toFixed(2)
    const total = gross + (Number(values.extraCharges) || 0)
    const balance = total - (Number(values.advance) || 0)
    return { units, subtotal, taxable, taxAmount, total, balance }
  }, [values])

  const validate = () => {
    const e = {}
    Object.assign(e, nameErrors(values.guestNames), phoneErrors(values.guestPhones))
    if (values.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.guestEmail.trim()))
      e.guestEmail = 'Enter a valid email address'
    if (!values.roomId) e.roomId = 'Select a room'
    if (!values.roomRate || Number(values.roomRate) <= 0) e.roomRate = 'Enter the room rate'
    if (values.stayType === 'daily') {
      if (!values.toDate) e.toDate = 'Check-out date is required'
      else if (nights(values.fromDate, values.toDate) < 1) e.toDate = 'Must be after check-in'
    } else if (!values.months || Number(values.months) < 1) {
      e.months = 'At least 1 month'
    }
    setErrors(e)
    return e
  }

  // Field order for "jump to first error" on a failed submit.
  const FIELD_ORDER = [...values.guestNames.map((_, i) => nameFieldName(i)),
                       ...values.guestPhones.map((_, i) => phoneFieldName(i)),
                       'guestEmail', 'roomId', 'roomRate', 'toDate', 'months']

  const handleSubmit = async () => {
    const e = validate()
    const errorKeys = Object.keys(e)
    if (errorKeys.length) {
      const first = FIELD_ORDER.find((k) => e[k]) || errorKeys[0]
      toast(e[first] || 'Please fix the highlighted fields', 'danger')
      const el = document.querySelector(`[name="${first}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus?.({ preventScroll: true })
      return
    }
    setSubmitting(true)
    setApiError('')
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
        months: values.stayType === 'monthly' ? Number(values.months) : undefined,
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
      values.idTypes.forEach((t) => {
        const docs = idDocs[t]
        if (docs?.front) entries.push([`${t} — Front`, docs.front])
        if (docs?.back) entries.push([`${t} — Back`, docs.back])
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
          toast('Booking created, but some documents failed to upload.', 'danger')
        }
      }

      // The booking is saved — hold the form open on the photo step. onSaved
      // fires from the camera handlers below, whichever way the user exits.
      setPhotoFor(booking)
    } catch (err) {
      const d = err.response?.data
      toast(d?.message || d?.error || 'Could not create the booking. Please try again.', 'danger')
    } finally {
      setSubmitting(false)
    }
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
      toast('Booking created, but the photo failed to upload.', 'danger')
    } finally {
      setPhotoBusy(false)
      onSaved(photoFor)
    }
  }

  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  // Summary-rail context: which room, how long, and how many files are queued.
  const selectedRoom = rooms.find((r) => r.id === values.roomId)
  const roomLabel = selectedRoom
    ? `Room ${selectedRoom.number}${typeName(selectedRoom) ? ` · ${typeName(selectedRoom)}` : ''}`
    : 'No room selected'
  const unitWord = values.stayType === 'daily' ? 'night' : 'month'
  const stayLabel = pricing.units
    ? `${pricing.units} ${unitWord}${pricing.units === 1 ? '' : 's'}`
    : 'Dates not set'
  const attachedCount =
    values.idTypes.reduce((n, t) => n + [idDocs[t]?.front, idDocs[t]?.back].filter(Boolean).length, 0) +
    extraDocs.filter((d) => d.file).length

  return (
    <div>
      <div className="px-5 py-5">
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

            {/* ── Guest ── */}
            <Section title="Guest details" hint="Name and phone are required">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-4 gap-y-3.5">
                <NameFields className="lg:col-span-4" names={values.guestNames} errors={errors}
                            onChange={setNames} />
                <PhoneFields className="lg:col-span-4" phones={values.guestPhones} errors={errors}
                             onChange={setPhones} required />
                <Field className="lg:col-span-4" label="Email" name="guestEmail" type="email" value={values.guestEmail}
                       onChange={set('guestEmail')} placeholder="guest@example.com" error={errors.guestEmail} />

                {/* What the number turned up — filled details are only ever a
                    starting point, so the row stays visible and reversible. */}
                {lookup && (
                  <div className="sm:col-span-2 lg:col-span-12">
                    {lookup.state === 'found' ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-gold-border
                                      bg-gold-bg px-3 py-2 text-[12px] text-ink2">
                        <span className="font-medium text-gold">Returning guest</span>
                        <span>
                          {lookup.visits} booking{lookup.visits === 1 ? '' : 's'} on this number
                          {lookup.lastStay && ` · last: ${lookup.lastStay.bookingNo}`}
                          {lookup.lastStay?.roomNumber && ` · Room ${lookup.lastStay.roomNumber}`}
                          {lookup.lastStay?.fromDate && ` · ${formatDate(lookup.lastStay.fromDate)}`}
                        </span>
                        <button type="button" onClick={clearGuest}
                                className="ml-auto font-medium text-ink3 hover:text-danger transition-colors">
                          Clear filled details
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11.5px] text-ink3">
                        {lookup.state === 'searching' && 'Checking for a previous stay…'}
                        {lookup.state === 'none' && 'New guest — nothing on file for this number.'}
                        {lookup.state === 'cleared' && 'Details cleared — enter them manually.'}
                      </p>
                    )}
                  </div>
                )}
                <Field className="sm:col-span-2 lg:col-span-6" label="Address" value={values.guestAddress}
                       onChange={set('guestAddress')} placeholder="City, State" />
                <Field className="lg:col-span-2" label="Nationality" value={values.nationality}
                       onChange={set('nationality')} placeholder="Indian" />
                {/* Occupancy is a two-digit number — it never needs a full column. */}
                <Field className="lg:col-span-2" label="Adults" type="number" min="1" value={values.adults}
                       onChange={set('adults')} />
                <Field className="lg:col-span-2" label="Children" type="number" min="0" value={values.children}
                       onChange={set('children')} />
              </div>
            </Section>

            {/* ── Stay ── */}
            <Section title="Stay & room" hint={stayLabel}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3.5">
                <Field label="Room" name="roomId" value={values.roomId} onChange={set('roomId')} error={errors.roomId}
                       options={
                         loadingRooms
                           ? [{ value: '', label: 'Loading rooms…' }]
                           : rooms.length
                             ? rooms.map((r) => ({ value: r.id, label: `Room ${r.number}${typeName(r) ? ` · ${typeName(r)}` : ''}` }))
                             : [{ value: '', label: 'No rooms available' }]
                       } />
                <Field label="Booking source" value={values.source} onChange={set('source')} options={SOURCES} />
                <Field label="Invoice no." value={values.invoiceNo} onChange={set('invoiceNo')}
                       placeholder="Auto" hint="Auto-generated — edit to override" />
                <Field label="Stay type" value={values.stayType} onChange={set('stayType')}
                       options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }]} />
                <Field label="Check-in" type="date" value={values.fromDate} onChange={set('fromDate')} />
                {values.stayType === 'daily' ? (
                  <Field label="Check-out" name="toDate" type="date" value={values.toDate} onChange={set('toDate')}
                         error={errors.toDate} required />
                ) : (
                  <Field label="Months" name="months" type="number" min="1" value={values.months} onChange={set('months')}
                         error={errors.months} required />
                )}
              </div>
            </Section>

            {/* ── Pricing ── */}
            <Section title="Pricing" hint="GST is included in the rate">
              {/* Five across only at 2xl: at 1280 the summary rail leaves the form
                  ~580px, where "Extra charges (₹)" wraps and drags its input out of
                  line with the row. Three-up keeps every label on one line. */}
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-x-4 gap-y-3.5">
                <Field label={`Rate (₹/${values.stayType === 'daily' ? 'night' : 'month'})`} name="roomRate" type="number"
                       min="0" value={values.roomRate} onChange={set('roomRate')} placeholder="Enter rate"
                       error={errors.roomRate} required />
                <Field label="Discount (₹)" type="number" min="0" value={values.discount} onChange={set('discount')} />
                <Field label="GST (%)" type="number" min="0" value={values.taxRate} onChange={set('taxRate')} />
                <Field label="Extra charges (₹)" type="number" min="0" value={values.extraCharges} onChange={set('extraCharges')} />
                <Field label="Advance paid (₹)" type="number" min="0" value={values.advance} onChange={set('advance')} />
              </div>
            </Section>

            {/* ── ID & documents ──
                The scan slots are generated from the ID types picked here, so the
                two belong in one panel: picking "Aadhaar" reveals its front/back
                tiles right below instead of further down the page. */}
            <Section
              title="Identification & documents"
              hint={attachedCount ? `${attachedCount} file${attachedCount === 1 ? '' : 's'} attached` : 'Optional'}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-4 gap-y-3.5 items-start">
                <div className="lg:col-span-8">
                  <span className="block text-xs font-medium text-ink2 mb-1.5">ID type(s)</span>
                  <div className="flex flex-wrap gap-2">
                    {ID_TYPES.map((t) => {
                      const active = values.idTypes.includes(t)
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleIdType(t)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-gold-bg text-gold border-gold'
                              : 'bg-surface2 text-ink2 border-line2 hover:border-gold'
                          }`}
                        >
                          {active ? `✓ ${t}` : t}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <Field className="lg:col-span-4" label="ID number" value={values.idNumber}
                       onChange={set('idNumber')} placeholder="ID / document no." />
              </div>

              {values.idTypes.length === 0 ? (
                <p className="text-xs text-ink3 mt-4 rounded-lg border border-dashed border-line2 px-3 py-3 text-center">
                  Select an ID type above to attach front & back scans.
                </p>
              ) : (
                <div className="space-y-3 mt-4">
                  {values.idTypes.map((t) => {
                    const done = [idDocs[t]?.front, idDocs[t]?.back].filter(Boolean).length
                    return (
                      <div key={t} className="rounded-xl border border-line bg-surface2 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-ink2">{t}</span>
                          <span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded ${
                            done === 2 ? 'text-gold bg-gold-bg' : 'text-ink3 bg-surface'
                          }`}>
                            {done}/2 attached
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <UploadZone
                            label="Front"
                            file={idDocs[t]?.front}
                            onPick={(f) => setIdDoc(t, 'front', f)}
                            onScan={() => setDocCamera({
                              title: `Scan ${t} — Front`,
                              namePrefix: `${slugify(t)}-front`,
                              onPick: (f) => setIdDoc(t, 'front', f),
                            })}
                          />
                          <UploadZone
                            label="Back"
                            file={idDocs[t]?.back}
                            onPick={(f) => setIdDoc(t, 'back', f)}
                            onScan={() => setDocCamera({
                              title: `Scan ${t} — Back`,
                              namePrefix: `${slugify(t)}-back`,
                              onPick: (f) => setIdDoc(t, 'back', f),
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
                        <span className="text-xs font-semibold text-ink2">Additional document</span>
                        <button
                          type="button"
                          onClick={() => removeExtraDoc(d.key)}
                          className="text-[11px] text-ink3 hover:text-danger-text"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <Field label="Document type" value={d.label} placeholder="e.g. PAN card"
                               onChange={(e) => updateExtraDoc(d.key, { label: e.target.value })} />
                        <UploadZone
                          label="File"
                          file={d.file}
                          onPick={(f) => updateExtraDoc(d.key, { file: f })}
                          onScan={() => setDocCamera({
                            title: d.label.trim() ? `Scan ${d.label.trim()}` : 'Scan document',
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
                className="mt-3 w-full rounded-lg border border-dashed border-line2 py-2 text-xs font-medium text-ink3 hover:border-gold hover:text-gold transition-colors"
              >
                ＋ Add another document (PAN, Passport…)
              </button>
            </Section>

            {/* ── Notes ── */}
            <Section title="Notes" hint="Optional">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Special requests" textarea value={values.specialRequests}
                       onChange={set('specialRequests')} placeholder="Late check-in, extra bed…" />
                <Field label="Internal notes" textarea value={values.notes} onChange={set('notes')}
                       placeholder="Staff-only notes…" />
              </div>
            </Section>
          </div>

          {/* ── Live summary ── sticks alongside the form so the total stays in
              view while the operator is still filling fields further down. */}
          <aside className="xl:sticky xl:top-4">
            <div className="rounded-xl border border-gold-border bg-gold-bg overflow-hidden">
              <div className="px-4 py-3 border-b border-gold-border">
                <h4 className="text-[13px] font-semibold text-ink">Booking summary</h4>
                <p className="text-[11.5px] text-ink3 mt-0.5">{roomLabel} · {stayLabel}</p>
              </div>

              <div className="px-4 py-3 text-[13px] space-y-1.5">
                <SumRow
                  label={`Room charge (incl. GST)${pricing.units ? ` · ${pricing.units} × ${inr(values.roomRate)}` : ''}`}
                  value={inr(pricing.subtotal)}
                />
                {Number(values.discount) > 0 && <SumRow label="Discount" value={`− ${inr(values.discount)}`} />}
                <SumRow label="Taxable value" value={inr(pricing.taxable)} />
                <SumRow label={`GST (${values.taxRate || 0}%) incl.`} value={inr(pricing.taxAmount)} />
                {Number(values.extraCharges) > 0 && <SumRow label="Extra charges" value={inr(values.extraCharges)} />}

                <div className="flex items-baseline justify-between pt-2 mt-2 border-t border-gold-border">
                  <span className="font-display font-bold text-ink">Total</span>
                  <span className="font-display font-bold text-lg text-gold">{inr(pricing.total)}</span>
                </div>

                <SumRow label="Advance" value={inr(values.advance)} />
                <div className="flex items-baseline justify-between font-semibold text-ink">
                  <span>Balance due</span><span>{inr(pricing.balance)}</span>
                </div>
              </div>

              <div className="px-4 py-2.5 border-t border-gold-border text-[11.5px] text-ink3">
                {attachedCount
                  ? `${attachedCount} document${attachedCount === 1 ? '' : 's'} will be attached on save`
                  : 'No documents attached yet'}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3.5 border-t border-line bg-surface2">
        {/* Below xl the summary rail has scrolled away, so repeat the total here. */}
        <div className="mr-auto text-[12.5px] text-ink3 xl:hidden">
          Total <span className="font-semibold text-ink">{inr(pricing.total)}</span>
          <span className="mx-1.5 text-line2">·</span>
          Balance <span className="font-semibold text-ink">{inr(pricing.balance)}</span>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} icon="＋" disabled={submitting || loadingRooms}>
          {submitting ? 'Saving…' : 'Create Booking'}
        </Button>
      </div>

      {/* Scanning an ID slot. Rear camera by default — the operator is pointing
          the device at a card, not at themselves. The file is held in form state
          and uploaded with the rest on submit. */}
      {docCamera && (
        <CameraCaptureModal
          isOpen
          title={docCamera.title}
          hint="Fill the frame with the document and keep it flat."
          facingMode="environment"
          namePrefix={docCamera.namePrefix}
          confirmLabel="Attach scan"
          skipLabel="Cancel"
          onCapture={(file) => { docCamera.onPick(file); setDocCamera(null) }}
          onSkip={() => setDocCamera(null)}
        />
      )}

      {/* Guest photo — opens once the booking is saved. Skipping still completes
          the booking, so a dead webcam can't block the front desk. */}
      {photoFor && (
      <CameraCaptureModal
        isOpen
        title="Guest photo"
        hint={`Booking ${photoFor?.bookingNo || ''} created. Capture a photo of the guest for the file.`}
        facingMode="user"
        busy={photoBusy}
        confirmLabel="Save photo"
        skipLabel="Skip for now"
        namePrefix="guest-photo"
        onCapture={savePhoto}
        onSkip={() => onSaved(photoFor)}
      />
      )}
    </div>
  )
}

/**
 * A tile for a single image/PDF file, fillable either way: pick a file, or scan
 * it with the camera. onScan is omitted for slots where scanning makes no sense.
 *
 * Once filled, the tile previews the actual scan so the operator can see the ID
 * is legible before submitting — a filename alone hides a blurry capture.
 */
function UploadZone({ label, file, onPick, onScan }) {
  const isImage = !!file?.type?.startsWith('image/')
  // Built during render (not in an effect) so the preview paints with the file;
  // the effect below only revokes it once it is no longer in use.
  const previewUrl = useMemo(
    () => (isImage ? URL.createObjectURL(file) : null),
    [file, isImage],
  )
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // Upload is a <label> wrapping a hidden input; scan is a real button. Keeping
  // them siblings stops a scan click from also opening the file picker.
  const actions = (
    <div className="grid grid-cols-2 divide-x divide-line2 border-t border-line2">
      <label className="flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium text-ink2 cursor-pointer hover:bg-gold-bg hover:text-gold transition-colors">
        <span className="text-[13px] leading-none">⬆</span>
        {file ? 'Replace' : 'Upload'}
        <input
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />
      </label>
      <button
        type="button"
        onClick={onScan}
        disabled={!onScan}
        className="flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium text-ink2 hover:bg-gold-bg hover:text-gold transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span className="text-[13px] leading-none">📷</span>
        {file ? 'Rescan' : 'Scan'}
      </button>
    </div>
  )

  return (
    <div>
      {label && <span className="block text-xs font-medium text-ink2 mb-1.5">{label}</span>}
      <div
        className={`rounded-lg border overflow-hidden transition-colors ${
          file ? 'border-gold' : 'border-dashed border-line2 hover:border-gold'
        }`}
      >
        <div className="relative h-24 bg-surface2 flex items-center justify-center">
          {file ? (
            <>
              {previewUrl ? (
                <img src={previewUrl} alt={label || 'Attached document'} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-3">
                  <div className="text-xl leading-none mb-1">📄</div>
                  <div className="text-[10.5px] text-ink3 break-all line-clamp-2">{file.name}</div>
                </div>
              )}
              <button
                type="button"
                onClick={() => onPick(null)}
                title="Remove"
                aria-label="Remove file"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 text-white text-xs leading-none flex items-center justify-center hover:bg-danger-text transition-colors"
              >
                ✕
              </button>
              {previewUrl && (
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-2 py-0.5 truncate">
                  {file.name}
                </span>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="text-lg text-ink3 leading-none mb-0.5">🪪</div>
              <div className="text-[10.5px] text-ink3">JPG, PNG or PDF</div>
            </div>
          )}
        </div>
        {actions}
      </div>
    </div>
  )
}
