import { useState, useMemo, useEffect, useCallback } from 'react'
import { Formik, Form } from 'formik'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import FormikField from '../../ui/FormikField'
import { useToast } from '../../../hooks/useToast'
import { useUiActions } from '../../../store/hooks'
import { guestsApi } from '../../../api/client'
import { guestEditSchema } from '../../../validation/guestSchema'
import { formatDate, formatCurrency, statusColor } from '../../../utils/format'

// tags/amenities/facilities are stored as JSON strings server-side.
function parseArr(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } }
  return []
}

// Map an API guest (with room/_count/invoices relations) to the flat shape the
// UI renders. Fields the API doesn't track (commLog) get safe defaults.
function normalizeGuest(g) {
  return {
    id: g.id,
    docId: g.docId,
    name: g.name,
    phone: g.phone,
    email: g.email || '',
    room: g.room?.number || '',
    roomId: g.roomId,
    stayType: g.stayType || 'daily',
    checkInDate: g.checkInDate,
    checkOutDate: g.checkOutDate,
    months: g.months,
    status: g.status,
    foodPlan: g.foodPlan || 'No Meals',
    tags: parseArr(g.tags),
    stayCount: g.stayCount || 1,
    idType: g.idType,
    idNumber: g.idNumber,
    documents: g._count?.documents ?? (Array.isArray(g.documents) ? g.documents.length : 0),
    amenities: parseArr(g.amenities),
    facilities: parseArr(g.facilities),
    nationality: g.nationality || '',
    address: g.address || '',
    advance: g.deposit || 0,
    billingHistory: (g.invoices || []).map((inv) => ({
      invoiceNo: inv.invoiceNo,
      period: inv.period,
      total: inv.total,
      status: inv.status,
      paidOn: inv.paidAt || null,
      method: inv.method || null,
    })),
    commLog: [],
  }
}

// Only these columns may be sent to PUT /guests/:id — the rest are UI-only.
function editPayload(values) {
  const payload = {
    name: values.name,
    phone: values.phone,
    email: values.email || null,
    stayType: values.stayType,
    foodPlan: values.foodPlan,
    status: values.status,
    tags: values.tags || [],
  }
  if (values.checkInDate) payload.checkInDate = values.checkInDate
  if (values.stayType === 'monthly') payload.months = Number(values.months) || 1
  else if (values.checkOutDate) payload.checkOutDate = values.checkOutDate
  return payload
}

const FOOD_PLANS = ['Breakfast Only', 'All Meals', 'Dinner Only', 'No Meals']
const GUEST_TAGS = ['VIP', 'Corporate', 'Long-term']
const PROFILE_TABS = [
  { id: 'info',    label: 'Profile' },
  { id: 'billing', label: 'Billing' },
  { id: 'comms',   label: 'Communications' },
  { id: 'history', label: 'Stay History' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDueDate(guest) {
  if (guest.stayType === 'daily') return guest.checkOutDate
  if (guest.stayType === 'monthly' && guest.checkInDate && guest.months) {
    const d = new Date(guest.checkInDate)
    d.setMonth(d.getMonth() + guest.months)
    return d.toISOString().split('T')[0]
  }
  return null
}

function getTagClass(tag) {
  if (tag === 'VIP') return 'gtag gtag-vip'
  if (tag === 'Corporate') return 'gtag gtag-corp'
  if (tag === 'Long-term') return 'gtag gtag-long'
  return 'gtag gtag-long'
}

function calcCheckout(guest) {
  const rent = guest.stayType === 'monthly' ? 14000 : 800
  const food = guest.foodPlan === 'All Meals' ? 8000 : guest.foodPlan === 'No Meals' ? 0 : 2500
  const amenities = guest.amenities.length * 800
  const subtotal = rent + food + amenities
  const gst = Math.round(subtotal * 0.12)
  return { rent, food, amenities, gst, total: subtotal + gst }
}

function exportGuestCSV(guests) {
  const headers = ['DOC ID', 'Name', 'Phone', 'Email', 'Room', 'Stay Type', 'Check-In', 'Check-Out/Due', 'Food Plan', 'Status', 'Tags', 'Stay Count']
  const rows = guests.map(g => [
    g.docId, g.name, g.phone, g.email || '', g.room,
    g.stayType === 'monthly' ? 'Monthly' : 'Daily',
    g.checkInDate, getDueDate(g) || '',
    g.foodPlan, g.status, g.tags.join('; '), g.stayCount,
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'guests.csv'; a.click()
  URL.revokeObjectURL(url)
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold text-ink3 uppercase tracking-[0.07em] mb-[3px]">{label}</div>
      <div className="t-sm">{value || '—'}</div>
    </div>
  )
}

// ─── Guest Profile Modal (tabbed) ────────────────────────────────────────────

function GuestProfileModal({ guest, onClose, onCheckout, onEdit }) {
  const [tab, setTab] = useState('info')
  if (!guest) return null
  const dueDate = getDueDate(guest)
  const totalSpend = guest.billingHistory.reduce((s, b) => s + b.total, 0)

  return (
    <Modal
      isOpen={!!guest}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="t-title w-9 h-9 rounded-full bg-gold flex items-center justify-center text-black shrink-0">
            {guest.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="t-h3">{guest.name}</div>
            <div className="text-[11px] text-gold font-normal" style={{ fontFamily: 'var(--font-mono)' }}>{guest.docId}</div>
          </div>
        </div>
      }
      size="lg"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          {(guest.status === 'Active' || guest.status === 'Due') && (
            <button className="btn btn-danger btn-sm" onClick={() => onCheckout(guest)}>Checkout</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => onEdit(guest)}>Edit Guest</button>
        </>
      }
    >
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2.5 mb-[18px]">
        {[
          { label: 'Room', value: guest.room, mono: true },
          { label: 'Stay Type', value: guest.stayType === 'monthly' ? 'Monthly' : 'Daily' },
          { label: 'Total Stays', value: guest.stayCount },
          { label: 'Lifetime Spend', value: formatCurrency(totalSpend), mono: true },
        ].map(item => (
          <div key={item.label} className="bg-surface2 rounded-lg px-3 py-2.5 border border-line">
            <div className="t-label mb-1">{item.label}</div>
            <div className="t-title" style={{
              fontFamily: item.mono ? 'var(--font-mono)' : undefined,
            }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Status + tags row */}
      <div className="flex items-center gap-2 mb-[18px] flex-wrap">
        <Badge type={statusColor(guest.status).replace('badge-', '')}>{guest.status}</Badge>
        {guest.tags.map(t => <span key={t} className={getTagClass(t)}>{t}</span>)}
      </div>

      <Tabs tabs={PROFILE_TABS} active={tab} onChange={setTab} />

      <div className="mt-4">
        {/* ── Profile Tab ── */}
        {tab === 'info' && (
          <div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 mb-4">
              <InfoRow label="Phone" value={guest.phone} />
              <InfoRow label="Email" value={guest.email} />
              <InfoRow label="Nationality" value={guest.nationality} />
              <InfoRow label="Address" value={guest.address} />
              <InfoRow label="ID Type" value={guest.idType} />
              <InfoRow label="ID Number" value={guest.idNumber} />
              <InfoRow label="Check-In" value={formatDate(guest.checkInDate)} />
              <InfoRow label={guest.stayType === 'monthly' ? 'Duration' : 'Check-Out'} value={guest.stayType === 'monthly' ? `${guest.months} month${guest.months !== 1 ? 's' : ''}` : formatDate(dueDate)} />
              <InfoRow label="Food Plan" value={guest.foodPlan} />
              <InfoRow label="Advance Paid" value={formatCurrency(guest.advance)} />
            </div>

            {guest.facilities.length > 0 && (
              <div className="mb-3.5">
                <div className="text-[10.5px] font-semibold text-ink3 uppercase tracking-[0.07em] mb-[7px]">Facilities</div>
                <div className="flex gap-1.5 flex-wrap">
                  {guest.facilities.map(f => <span key={f} className="badge badge-grey">{f}</span>)}
                </div>
              </div>
            )}

            {guest.amenities.length > 0 && (
              <div className="mb-3.5">
                <div className="text-[10.5px] font-semibold text-ink3 uppercase tracking-[0.07em] mb-[7px]">Extra Amenities</div>
                <div className="flex gap-1.5 flex-wrap">
                  {guest.amenities.map(a => <span key={a} className="badge badge-blue">{a}</span>)}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <div className="text-[10.5px] font-semibold text-ink3 uppercase tracking-[0.07em]">Documents</div>
              <Badge type={guest.documents >= 4 ? 'green' : guest.documents >= 2 ? 'amber' : 'red'}>
                {guest.documents} / 4 uploaded
              </Badge>
            </div>
          </div>
        )}

        {/* ── Billing Tab ── */}
        {tab === 'billing' && (
          <div>
            {guest.billingHistory.length === 0 ? (
              <div className="t-sm text-center py-8 text-ink3">No billing records</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface2">
                    {['Invoice', 'Period', 'Total', 'Status', 'Paid On', 'Method'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[10.5px] font-semibold text-ink3 uppercase tracking-[0.05em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guest.billingHistory.map(b => (
                    <tr key={b.invoiceNo} className="border-b border-line">
                      <td className="t-xs px-3 py-[9px] text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{b.invoiceNo}</td>
                      <td className="px-3 py-[9px] text-[12.5px] text-ink2">{b.period}</td>
                      <td className="t-title px-3 py-[9px]" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(b.total)}</td>
                      <td className="px-3 py-[9px]">
                        <Badge type={b.status === 'Paid' ? 'green' : b.status === 'Overdue' ? 'red' : 'amber'}>{b.status}</Badge>
                      </td>
                      <td className="t-xs px-3 py-[9px] text-ink3">{b.paidOn ? formatDate(b.paidOn) : '—'}</td>
                      <td className="t-xs px-3 py-[9px] text-ink2">{b.method || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3.5 px-3.5 py-2.5 bg-[var(--gold-bg)] rounded-lg flex justify-between">
              <span className="t-title text-gold">Total Lifetime Spend</span>
              <span className="font-bold text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(totalSpend)}</span>
            </div>
          </div>
        )}

        {/* ── Communications Tab ── */}
        {tab === 'comms' && (
          <div>
            <div className="flex flex-col gap-2.5">
              {guest.commLog.map((c, i) => (
                <div key={i} className="flex items-start gap-3 px-3.5 py-3 bg-surface2 rounded-lg border border-line">
                  <div className="t-body w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{
                    background: c.type === 'WhatsApp' ? '#dcfce7' : c.type === 'SMS' ? '#dbeafe' : 'var(--gold-bg)',
                    color: c.type === 'WhatsApp' ? '#16a34a' : c.type === 'SMS' ? '#2563eb' : 'var(--gold)',
                  }}>
                    {c.type === 'WhatsApp' ? '💬' : c.type === 'SMS' ? '📱' : '📄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink mb-0.5">{c.type}</div>
                    <div className="t-xs mb-1">{c.msg}</div>
                    <div className="text-[11px] text-ink3">{c.time}</div>
                  </div>
                </div>
              ))}
              {guest.commLog.length === 0 && (
                <div className="t-sm text-center py-8 text-ink3">No communication log</div>
              )}
            </div>
            <button className="btn btn-outline btn-sm mt-3.5"
              onClick={() => {}}>
              + Log Communication
            </button>
          </div>
        )}

        {/* ── Stay History Tab ── */}
        {tab === 'history' && (
          <div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: guest.stayCount }, (_, i) => {
                const isLatest = i === 0
                return (
                  <div key={i} className={`px-3.5 py-3 bg-surface2 rounded-lg border flex justify-between items-center ${isLatest ? 'border-gold' : 'border-line'}`}>
                    <div>
                      <div className="t-title">
                        Stay #{guest.stayCount - i} {isLatest && <span className="text-[10.5px] text-gold ml-1.5">CURRENT</span>}
                      </div>
                      <div className="text-[11.5px] text-ink3 mt-[3px]">
                        {isLatest ? `Check-in: ${formatDate(guest.checkInDate)}` : `~${2 + i * 3} months ago`}
                      </div>
                    </div>
                    <Badge type={isLatest ? (guest.status === 'Checked Out' ? 'grey' : 'green') : 'grey'}>
                      {isLatest ? guest.status : 'Checked Out'}
                    </Badge>
                  </div>
                )
              })}
            </div>
            <div className="mt-3.5 px-3.5 py-2.5 bg-surface2 rounded-lg flex justify-between">
              <span className="text-[12.5px] text-ink2">
                Returning guest · {guest.stayCount} visit{guest.stayCount !== 1 ? 's' : ''} · {guest.stayCount >= 5 ? '🥇 Gold Loyalty' : guest.stayCount >= 3 ? '🥈 Silver Loyalty' : '🥉 Bronze Loyalty'}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Checkout Modal ────────────────────────────────────────────────────────────

function CheckoutModal({ guest, onClose, onConfirm }) {
  const [step, setStep] = useState(1)
  const [payMethod, setPayMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [settled, setSettled] = useState(false)

  if (!guest) return null
  const { rent, food, amenities, gst, total } = calcCheckout(guest)
  const dueDate = getDueDate(guest)
  const balance = total - guest.advance

  const handleConfirm = () => {
    if (step === 1) { setStep(2); return }
    onConfirm(guest, notes, payMethod)
  }

  return (
    <Modal
      isOpen={!!guest}
      onClose={onClose}
      title={`Check-Out — ${guest.name}`}
      maxWidth="520px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={step === 2 ? () => setStep(1) : onClose}>
            {step === 2 ? 'Back' : 'Cancel'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={step === 2 && !settled}
            onClick={handleConfirm}
          >
            {step === 1 ? 'Review & Confirm →' : 'Complete Check-Out'}
          </button>
        </>
      }
    >
      {/* Step indicator */}
      <div className="flex gap-1.5 mb-5">
        {['Bill Summary', 'Confirm & Pay'].map((s, i) => (
          <div key={s} className="flex-1 text-center">
            <div className={`h-[3px] rounded-sm mb-[5px] ${step > i ? 'bg-gold' : 'bg-line'}`} />
            <span className={`text-[10.5px] font-semibold ${step > i ? 'text-gold' : 'text-ink3'}`}>{s}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          {/* Room + period */}
          <div className="bg-surface2 rounded-lg px-3.5 py-3 mb-3.5 border border-line">
            <div className="flex justify-between mb-1.5">
              <span className="t-xs text-ink3">Room</span>
              <span className="t-title" style={{ fontFamily: 'var(--font-mono)' }}>{guest.room}</span>
            </div>
            <div className="flex justify-between">
              <span className="t-xs text-ink3">Stay Period</span>
              <span className="text-[12.5px] font-medium">{formatDate(guest.checkInDate)} → {formatDate(dueDate)}</span>
            </div>
          </div>

          {/* Bill breakdown */}
          <div className="mb-3.5">
            {[['Room Rent', rent], ['Food Plan', food], ['Amenities', amenities], ['GST (12%)', gst]].map(([k, v]) => v > 0 && (
              <div key={k} className="flex justify-between py-[7px] border-b border-line">
                <span className="t-sm text-ink2">{k}</span>
                <span className="t-sm" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(v)}</span>
              </div>
            ))}
            <div className="flex justify-between py-[9px] border-b border-line">
              <span className="t-sm text-ink2">Advance Paid</span>
              <span className="t-sm text-success-text" style={{ fontFamily: 'var(--font-mono)' }}>−{formatCurrency(guest.advance)}</span>
            </div>
            <div className="t-h3 flex justify-between py-[11px]">
              <span>Balance Due</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: balance > 0 ? 'var(--red-text)' : 'var(--green-text)' }}>
                {formatCurrency(Math.abs(balance))} {balance <= 0 ? '(refund)' : ''}
              </span>
            </div>
          </div>

          {/* Checklist */}
          <div className="t-xs text-ink3 mt-2.5">
            Room will be marked as <strong>Dirty</strong> and queued for housekeeping automatically.
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="bg-[var(--gold-bg)] rounded-lg px-3.5 py-3 mb-4 flex justify-between items-center">
            <span className="font-semibold text-gold">Amount to Collect</span>
            <span className="t-h3 text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(Math.max(balance, 0))}</span>
          </div>

          <div className="mb-3">
            <label className="form-label block mb-[5px]">Payment Method</label>
            <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="mb-3.5">
            <label className="form-label block mb-[5px]">Remarks (optional)</label>
            <textarea className="form-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Key return confirmation, damages, etc." />
          </div>

          <label className="t-sm flex items-center gap-[9px] cursor-pointer">
            <input type="checkbox" checked={settled} onChange={e => setSettled(e.target.checked)} />
            Payment received & key returned — confirm checkout
          </label>
        </>
      )}
    </Modal>
  )
}

// ─── Edit Guest Modal ──────────────────────────────────────────────────────────

function EditGuestModal({ guest, onClose, onSave }) {
  if (!guest) return null

  const initialValues = {
    ...guest,
    email: guest.email || '',
    tags: guest.tags || [],
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={guestEditSchema}
      enableReinitialize
      onSubmit={(values) => onSave(values)}
    >
      {({ values, setFieldValue, submitForm, isSubmitting }) => {
        const toggleTag = (tag) => {
          const tags = values.tags?.includes(tag)
            ? values.tags.filter(t => t !== tag)
            : [...(values.tags || []), tag]
          setFieldValue('tags', tags)
        }
        return (
          <Modal
            isOpen={!!guest}
            onClose={onClose}
            title={`Edit — ${guest.name}`}
            maxWidth="580px"
            footer={
              <>
                <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={submitForm} disabled={isSubmitting}>
                  Save Changes
                </button>
              </>
            }
          >
            <Form className="grid grid-cols-2 gap-3">
              <FormikField name="name" label="Name" required />
              <FormikField name="phone" label="Phone" required />
              <FormikField name="email" label="Email" type="email" />
              <FormikField name="room" label="Room" required />
              <FormikField name="stayType" label="Stay Type" as="select">
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </FormikField>
              <FormikField name="checkInDate" label="Check-In Date" required type="date" />
              {values.stayType === 'monthly'
                ? <FormikField name="months" label="Months" required type="number" min="1" />
                : <FormikField name="checkOutDate" label="Check-Out Date" required type="date" />}
              <FormikField name="foodPlan" label="Food Plan" as="select">
                {FOOD_PLANS.map(p => <option key={p}>{p}</option>)}
              </FormikField>
              <FormikField name="status" label="Status" as="select">
                {['Active', 'Due', 'Checked Out'].map(s => <option key={s}>{s}</option>)}
              </FormikField>
            </Form>
            <div className="mt-3.5">
              <label className="form-label block mb-[7px]">Tags</label>
              <div className="flex gap-2 flex-wrap">
                {GUEST_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    className={`${getTagClass(tag)} cursor-pointer`}
                    style={{ opacity: values.tags?.includes(tag) ? 1 : 0.4, border: values.tags?.includes(tag) ? undefined : '1px dashed var(--border2)' }}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </Modal>
        )
      }}
    </Formik>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Guests() {
  const addToast = useToast()
  const { setActivePanel } = useUiActions()

  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [stayFilter, setStayFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const [profileGuest,  setProfileGuest]  = useState(null)
  const [checkoutGuest, setCheckoutGuest] = useState(null)
  const [editGuest,     setEditGuest]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await guestsApi.getAll()
      setGuests((data.guests || []).map(normalizeGuest))
    } catch {
      setError('Could not load guests. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => guests.filter(g => {
    const q = search.toLowerCase()
    const matchSearch = !q || g.name.toLowerCase().includes(q) || g.room.includes(q) || g.docId.toLowerCase().includes(q) || g.phone.includes(q)
    const matchStay   = stayFilter   === 'All' || g.stayType === stayFilter.toLowerCase()
    const matchStatus = statusFilter  === 'All' || g.status   === statusFilter
    return matchSearch && matchStay && matchStatus
  }), [guests, search, stayFilter, statusFilter])

  const activeCount      = guests.filter(g => g.status === 'Active').length
  const dueCount         = guests.filter(g => g.status === 'Due').length
  const checkedOutCount  = guests.filter(g => g.status === 'Checked Out').length

  const handleCheckoutConfirm = async (guest) => {
    try {
      await guestsApi.checkout(guest.id)
      setCheckoutGuest(null)
      addToast(`${guest.name} checked out. Room marked for housekeeping.`, 'success')
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Checkout failed', 'error')
    }
  }

  const handleEditSave = async (updated) => {
    try {
      await guestsApi.update(updated.id, editPayload(updated))
      setEditGuest(null)
      addToast('Guest details updated', 'success')
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not update guest', 'error')
    }
  }

  // Open the profile with list data immediately, then enrich with detail
  // (documents + invoices) from GET /guests/:id.
  const openProfile = async (guest) => {
    setProfileGuest(guest)
    try {
      const { data } = await guestsApi.getOne(guest.id)
      if (data.guest) setProfileGuest(normalizeGuest(data.guest))
    } catch { /* keep list-level data */ }
  }

  const openCheckout = (guest) => { setProfileGuest(null); setCheckoutGuest(guest) }
  const openEdit     = (guest) => { setProfileGuest(null); setEditGuest(guest) }

  return (
    <div className="p-6 max-w-[1300px]">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="t-h1 m-0 tracking-[-0.03em]">All Guests</h1>
          <p className="t-sm mt-1 mb-0 text-ink3">Guest registry, stay history & billing</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>↻ Refresh</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportGuestCSV(filtered)}>↓ Export CSV</button>
          <button className="btn btn-primary" onClick={() => setActivePanel('checkin')}>+ Check-In</button>
        </div>
      </div>

      {error && (
        <div className="t-sm mb-4 px-3.5 py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 mb-[18px]">
        {[
          { label: 'Active', count: activeCount, type: 'green', bar: 'stat-bar-green' },
          { label: 'Due / Overdue', count: dueCount, type: 'amber', bar: 'stat-bar-amber' },
          { label: 'Checked Out', count: checkedOutCount, type: 'grey', bar: '' },
          { label: 'Total Guests', count: guests.length, type: 'blue', bar: 'stat-bar-blue' },
        ].map(({ label, count, type, bar }) => (
          <div key={label} className={`stat-card ${bar}`}>
            <div className="t-label mb-1.5">{label}</div>
            <div className="text-[26px] font-bold text-ink" style={{ fontFamily: 'var(--font-mono)' }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="px-4 py-3 flex gap-2.5 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="t-h3 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3">⌕</span>
            <input className="form-input pl-[30px]" placeholder="Search name, room, DOC ID, phone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select w-[140px]" value={stayFilter} onChange={e => setStayFilter(e.target.value)}>
            <option>All</option><option>Daily</option><option>Monthly</option>
          </select>
          <select className="form-select w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option>All</option><option>Active</option><option>Due</option><option>Checked Out</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>DOC ID</th><th>Guest</th><th>Room</th><th>Type</th>
                <th>Check-In</th><th>Due / Out</th><th>Food Plan</th>
                <th>Stays</th><th>Tags</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11}><div className="empty-state">{loading ? 'Loading guests…' : 'No guests found'}</div></td></tr>
              )}
              {filtered.map(guest => {
                const dueDate = getDueDate(guest)
                return (
                  <tr key={guest.id} className="cursor-pointer" onClick={() => openProfile(guest)}>
                    <td><span className="t-xs text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{guest.docId}</span></td>
                    <td>
                      <div className="font-semibold text-ink">{guest.name}</div>
                      <div className="text-[11.5px] text-ink3 mt-px">{guest.phone}</div>
                    </td>
                    <td><span className="font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>{guest.room || '—'}</span></td>
                    <td><Badge type={guest.stayType === 'monthly' ? 'purple' : 'blue'}>{guest.stayType === 'monthly' ? 'Monthly' : 'Daily'}</Badge></td>
                    <td className="whitespace-nowrap text-[12.5px]">{formatDate(guest.checkInDate)}</td>
                    <td className="whitespace-nowrap text-[12.5px]">{formatDate(dueDate)}</td>
                    <td className="t-xs whitespace-nowrap">{guest.foodPlan}</td>
                    <td><span className="t-title" style={{ fontFamily: 'var(--font-mono)' }}>{guest.stayCount}</span></td>
                    <td><div className="flex gap-1 flex-wrap">{guest.tags.map(t => <span key={t} className={getTagClass(t)}>{t}</span>)}</div></td>
                    <td><Badge type={statusColor(guest.status).replace('badge-', '')}>{guest.status}</Badge></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-[5px]">
                        <button className="btn btn-outline btn-xs" onClick={() => openProfile(guest)}>View</button>
                        {(guest.status === 'Active' || guest.status === 'Due') && (
                          <button className="btn btn-danger btn-xs" onClick={() => setCheckoutGuest(guest)}>Checkout</button>
                        )}
                        {guest.status === 'Due' && (
                          <button className="btn btn-xs bg-success-bg text-success-text"
                            onClick={() => addToast(`Renewed stay for ${guest.name}`, 'success')}>Renew</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <GuestProfileModal guest={profileGuest} onClose={() => setProfileGuest(null)} onCheckout={openCheckout} onEdit={openEdit} />
      <CheckoutModal guest={checkoutGuest} onClose={() => setCheckoutGuest(null)} onConfirm={handleCheckoutConfirm} />
      <EditGuestModal guest={editGuest} onClose={() => setEditGuest(null)} onSave={handleEditSave} />
    </div>
  )
}
