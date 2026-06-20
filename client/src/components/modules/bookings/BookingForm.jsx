import { useEffect, useMemo, useRef, useState } from 'react'
import { Field, Button } from '../../ui-tw'
import { bookingsApi, roomsApi, settingsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'
import { TODAY } from '../../../utils/booking'

const DAY_MS = 86400000

const EMPTY = {
  guestName: '', guestPhone: '', guestEmail: '',
  idTypes: ['Aadhaar'], idNumber: '', nationality: 'Indian', guestAddress: '',
  adults: 1, children: 0,
  roomId: '', stayType: 'daily',
  fromDate: TODAY, toDate: '', months: 1,
  roomRate: '', discount: 0, taxRate: 12, extraCharges: 0, advance: 0,
  source: 'walk_in', specialRequests: '', notes: '',
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

function nights(from, to) {
  if (!from || !to) return 0
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY_MS))
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

  // ── ID documents ──
  // idDocs is keyed by ID type → { front, back } files
  const [idDocs, setIdDocs] = useState({})
  const [extraDocs, setExtraDocs] = useState([]) // { key, label, file }
  const docKey = useRef(0)

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

  // Phone: keep digits only, capped at 10.
  const setPhone = (e) =>
    setValues((v) => ({ ...v, guestPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))

  // Load rooms + hotel settings on mount
  useEffect(() => {
    setApiError('')
    setLoadingRooms(true)
    Promise.all([roomsApi.getAll(), settingsApi.get().catch(() => ({ data: {} }))])
      .then(([roomsRes, settingsRes]) => {
        const list = roomsRes.data?.rooms || roomsRes.data || []
        const available = list.filter((r) => r.status === 'available')
        const pool = available.length ? available : list
        setRooms(pool)
        setRoomTypes(settingsRes.data?.roomTypes || [])
        const gst = settingsRes.data?.hotel?.gstRate
        setValues((v) => ({
          ...EMPTY,
          ...v,
          roomId: pool[0]?.id || '',
          roomRate: pool[0]?.dailyRate ?? '',
          taxRate: gst ?? v.taxRate,
        }))
      })
      .catch(() => setApiError('Could not load rooms. Is the backend running?'))
      .finally(() => setLoadingRooms(false))
  }, [])

  const room = useMemo(() => rooms.find((r) => r.id === values.roomId), [rooms, values.roomId])
  const typeName = (r) => roomTypes.find((t) => t.id === r?.typeId)?.name || ''

  // When the selected room or stay type changes, refresh the rate default
  useEffect(() => {
    if (!room) return
    setValues((v) => ({
      ...v,
      roomRate: v.stayType === 'daily' ? room.dailyRate : room.monthlyRate,
    }))
  }, [values.roomId, values.stayType]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live pricing preview (mirrors the server formula) ──
  const pricing = useMemo(() => {
    const rate = Number(values.roomRate) || 0
    const units = values.stayType === 'daily' ? nights(values.fromDate, values.toDate) : Number(values.months) || 0
    const subtotal = rate * units
    const taxable = Math.max(0, subtotal - (Number(values.discount) || 0))
    const taxAmount = (taxable * (Number(values.taxRate) || 0)) / 100
    const total = taxable + taxAmount + (Number(values.extraCharges) || 0)
    const balance = total - (Number(values.advance) || 0)
    return { units, subtotal, taxAmount, total, balance }
  }, [values])

  const validate = () => {
    const e = {}
    if (!values.guestName.trim()) e.guestName = 'Guest name is required'
    if (values.guestPhone && values.guestPhone.length !== 10) e.guestPhone = 'Enter a valid 10-digit number'
    if (values.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.guestEmail.trim()))
      e.guestEmail = 'Enter a valid email address'
    if (!values.roomId) e.roomId = 'Select a room'
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
  const FIELD_ORDER = ['guestName', 'guestPhone', 'guestEmail', 'roomId', 'toDate', 'months']

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
        guestName: values.guestName.trim(),
        guestPhone: values.guestPhone.trim() || undefined,
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

      onSaved(booking)
    } catch (err) {
      const d = err.response?.data
      toast(d?.message || d?.error || 'Could not create the booking. Please try again.', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return (
    <div>
      <div className="px-6 py-5">
        {apiError && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger-text">
            {apiError}
          </div>
        )}

        {/* ── Guest ── */}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-2">Guest details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Guest name" name="guestName" value={values.guestName} onChange={set('guestName')}
                 placeholder="Full name" error={errors.guestName} required />
          <Field label="Phone" name="guestPhone" type="tel" inputMode="numeric" maxLength={10}
                 value={values.guestPhone} onChange={setPhone} placeholder="10-digit number"
                 error={errors.guestPhone} />
          <Field label="Email" name="guestEmail" type="email" value={values.guestEmail} onChange={set('guestEmail')}
                 placeholder="guest@example.com" error={errors.guestEmail} />
          <Field label="Nationality" value={values.nationality} onChange={set('nationality')} placeholder="Indian" />
          <Field label="Adults" type="number" min="1" value={values.adults} onChange={set('adults')} />
          <Field label="Children" type="number" min="0" value={values.children} onChange={set('children')} />
          <Field label="Address" value={values.guestAddress} onChange={set('guestAddress')}
                 placeholder="City, State" className="sm:col-span-2 lg:col-span-3" />
        </div>

        {/* ID type — multiple allowed (e.g. Aadhaar + PAN) */}
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4 mt-4 items-start">
          <div>
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
          <Field label="ID number" value={values.idNumber} onChange={set('idNumber')} placeholder="ID / document no." />
        </div>

        {/* ── Stay ── */}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-2 mt-5">Stay</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Room" name="roomId" value={values.roomId} onChange={set('roomId')} error={errors.roomId}
                 options={
                   loadingRooms
                     ? [{ value: '', label: 'Loading rooms…' }]
                     : rooms.length
                       ? rooms.map((r) => ({ value: r.id, label: `Room ${r.number}${typeName(r) ? ` · ${typeName(r)}` : ''} · ₹${r.dailyRate}/night` }))
                       : [{ value: '', label: 'No rooms available' }]
                 } />
          <Field label="Booking source" value={values.source} onChange={set('source')} options={SOURCES} />
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

        {/* ── Pricing ── */}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-2 mt-5">Pricing</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label={`Rate (₹/${values.stayType === 'daily' ? 'night' : 'month'})`} type="number" min="0"
                 value={values.roomRate} onChange={set('roomRate')} />
          <Field label="Discount (₹)" type="number" min="0" value={values.discount} onChange={set('discount')} />
          <Field label="GST (%)" type="number" min="0" value={values.taxRate} onChange={set('taxRate')} />
          <Field label="Extra charges (₹)" type="number" min="0" value={values.extraCharges} onChange={set('extraCharges')} />
          <Field label="Advance paid (₹)" type="number" min="0" value={values.advance} onChange={set('advance')} />
        </div>

        {/* ── Documents ── */}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-2 mt-5">
          Documents <span className="normal-case font-normal text-ink3">(optional)</span>
        </h4>
        {values.idTypes.length === 0 ? (
          <p className="text-xs text-ink3">Select an ID type above to attach front/back scans.</p>
        ) : (
          <div className="space-y-4">
            {values.idTypes.map((t) => (
              <div key={t}>
                <div className="text-xs font-semibold text-ink2 mb-1.5">{t}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <UploadZone label="Front" file={idDocs[t]?.front} onPick={(f) => setIdDoc(t, 'front', f)} />
                  <UploadZone label="Back" file={idDocs[t]?.back} onPick={(f) => setIdDoc(t, 'back', f)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {extraDocs.length > 0 && (
          <div className="mt-3 space-y-3">
            {extraDocs.map((d) => (
              <div key={d.key}
                   className="rounded-lg border border-line p-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <Field label="Document type" value={d.label} placeholder="e.g. PAN card"
                       onChange={(e) => updateExtraDoc(d.key, { label: e.target.value })} />
                <UploadZone label="File" file={d.file} onPick={(f) => updateExtraDoc(d.key, { file: f })} />
                <Button variant="ghost" onClick={() => removeExtraDoc(d.key)}>Remove</Button>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={addExtraDoc}
                className="mt-3 text-sm text-gold hover:underline">
          ＋ Add another document (PAN, Passport…)
        </button>

        {/* ── Notes ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <Field label="Special requests" textarea value={values.specialRequests} onChange={set('specialRequests')}
                 placeholder="Late check-in, extra bed…" />
          <Field label="Internal notes" textarea value={values.notes} onChange={set('notes')}
                 placeholder="Staff-only notes…" />
        </div>

        {/* ── Pricing summary ── */}
        <div className="mt-5 rounded-lg bg-gold-bg border border-gold-border px-4 py-3 text-sm">
          <div className="flex justify-between text-ink2">
            <span>Subtotal{pricing.units ? ` · ${pricing.units} ${values.stayType === 'daily' ? 'night(s)' : 'month(s)'} × ${inr(values.roomRate)}` : ''}</span>
            <span>{inr(pricing.subtotal)}</span>
          </div>
          {Number(values.discount) > 0 && (
            <div className="flex justify-between text-ink2 mt-1"><span>Discount</span><span>− {inr(values.discount)}</span></div>
          )}
          <div className="flex justify-between text-ink2 mt-1"><span>GST ({values.taxRate || 0}%)</span><span>{inr(pricing.taxAmount)}</span></div>
          {Number(values.extraCharges) > 0 && (
            <div className="flex justify-between text-ink2 mt-1"><span>Extra charges</span><span>{inr(values.extraCharges)}</span></div>
          )}
          <div className="flex justify-between font-display font-bold text-base text-gold mt-2 pt-2 border-t border-gold-border">
            <span>Total</span><span>{inr(pricing.total)}</span>
          </div>
          <div className="flex justify-between text-ink2 mt-1">
            <span>Advance</span><span>{inr(values.advance)}</span>
          </div>
          <div className="flex justify-between font-medium text-ink mt-1">
            <span>Balance due</span><span>{inr(pricing.balance)}</span>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line bg-surface2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} icon="＋" disabled={submitting || loadingRooms}>
          {submitting ? 'Saving…' : 'Create Booking'}
        </Button>
      </div>
    </div>
  )
}

/** A click-to-upload tile for a single image/PDF file. */
function UploadZone({ label, file, onPick }) {
  return (
    <div>
      {label && <span className="block text-xs font-medium text-ink2 mb-1.5">{label}</span>}
      <label
        className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center cursor-pointer transition-colors ${
          file ? 'border-gold bg-gold-bg' : 'border-line2 bg-surface2 hover:border-gold'
        }`}
      >
        {file ? (
          <span className="text-xs text-gold font-medium break-all px-5">✓ {file.name}</span>
        ) : (
          <>
            <span className="text-lg text-ink3 leading-none">＋</span>
            <span className="text-[11px] text-ink3">Click to upload · JPG, PNG or PDF</span>
          </>
        )}
        <input
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />
        {file && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onPick(null) }}
            className="absolute top-1 right-1 w-5 h-5 rounded text-ink3 hover:text-danger-text text-xs leading-none"
            aria-label="Remove file"
          >
            ✕
          </button>
        )}
      </label>
    </div>
  )
}
