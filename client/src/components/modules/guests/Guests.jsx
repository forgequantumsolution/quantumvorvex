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
      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value || '—'}</div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0,
          }}>
            {guest.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', sans-serif", fontSize: 15, fontWeight: 700 }}>{guest.name}</div>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 400 }}>{guest.docId}</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Room', value: guest.room, mono: true },
          { label: 'Stay Type', value: guest.stayType === 'monthly' ? 'Monthly' : 'Daily' },
          { label: 'Total Stays', value: guest.stayCount },
          { label: 'Lifetime Spend', value: formatCurrency(totalSpend), mono: true },
        ].map(item => (
          <div key={item.label} style={{
            background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text)',
              fontFamily: item.mono ? "'JetBrains Mono', monospace" : undefined,
            }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Status + tags row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Badge type={statusColor(guest.status).replace('badge-', '')}>{guest.status}</Badge>
        {guest.tags.map(t => <span key={t} className={getTagClass(t)}>{t}</span>)}
      </div>

      <Tabs tabs={PROFILE_TABS} active={tab} onChange={setTab} />

      <div style={{ marginTop: 16 }}>
        {/* ── Profile Tab ── */}
        {tab === 'info' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 16 }}>
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
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Facilities</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {guest.facilities.map(f => <span key={f} className="badge badge-grey">{f}</span>)}
                </div>
              </div>
            )}

            {guest.amenities.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Extra Amenities</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {guest.amenities.map(a => <span key={a} className="badge badge-blue">{a}</span>)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Documents</div>
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
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>No billing records</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Invoice', 'Period', 'Total', 'Status', 'Paid On', 'Method'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guest.billingHistory.map(b => (
                    <tr key={b.invoiceNo} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--gold)' }}>{b.invoiceNo}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12.5, color: 'var(--text2)' }}>{b.period}</td>
                      <td style={{ padding: '9px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(b.total)}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <Badge type={b.status === 'Paid' ? 'green' : b.status === 'Overdue' ? 'red' : 'amber'}>{b.status}</Badge>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text3)' }}>{b.paidOn ? formatDate(b.paidOn) : '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text2)' }}>{b.method || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--gold-bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>Total Lifetime Spend</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--gold)' }}>{formatCurrency(totalSpend)}</span>
            </div>
          </div>
        )}

        {/* ── Communications Tab ── */}
        {tab === 'comms' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {guest.commLog.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', background: 'var(--surface2)',
                  borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: c.type === 'WhatsApp' ? '#dcfce7' : c.type === 'SMS' ? '#dbeafe' : 'var(--gold-bg)',
                    color: c.type === 'WhatsApp' ? '#16a34a' : c.type === 'SMS' ? '#2563eb' : 'var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0,
                  }}>
                    {c.type === 'WhatsApp' ? '💬' : c.type === 'SMS' ? '📱' : '📄'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{c.type}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{c.msg}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.time}</div>
                  </div>
                </div>
              ))}
              {guest.commLog.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>No communication log</div>
              )}
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 14 }}
              onClick={() => {}}>
              + Log Communication
            </button>
          </div>
        )}

        {/* ── Stay History Tab ── */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: guest.stayCount }, (_, i) => {
                const isLatest = i === 0
                return (
                  <div key={i} style={{
                    padding: '12px 14px', background: 'var(--surface2)',
                    borderRadius: 8, border: `1px solid ${isLatest ? 'var(--gold)' : 'var(--border)'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        Stay #{guest.stayCount - i} {isLatest && <span style={{ fontSize: 10.5, color: 'var(--gold)', marginLeft: 6 }}>CURRENT</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>
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
            <div style={{
              marginTop: 14, padding: '10px 14px', background: 'var(--surface2)',
              borderRadius: 8, display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['Bill Summary', 'Confirm & Pay'].map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 3, borderRadius: 2, marginBottom: 5,
              background: step > i ? 'var(--gold)' : 'var(--border)',
            }} />
            <span style={{ fontSize: 10.5, color: step > i ? 'var(--gold)' : 'var(--text3)', fontWeight: 600 }}>{s}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          {/* Room + period */}
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Room</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>{guest.room}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Stay Period</span>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{formatDate(guest.checkInDate)} → {formatDate(dueDate)}</span>
            </div>
          </div>

          {/* Bill breakdown */}
          <div style={{ marginBottom: 14 }}>
            {[['Room Rent', rent], ['Food Plan', food], ['Amenities', amenities], ['GST (12%)', gst]].map(([k, v]) => v > 0 && (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{k}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{formatCurrency(v)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Advance Paid</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--green-text)' }}>−{formatCurrency(guest.advance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', fontWeight: 700, fontSize: 15 }}>
              <span>Balance Due</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: balance > 0 ? 'var(--red-text)' : 'var(--green-text)' }}>
                {formatCurrency(Math.abs(balance))} {balance <= 0 ? '(refund)' : ''}
              </span>
            </div>
          </div>

          {/* Checklist */}
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
            Room will be marked as <strong>Dirty</strong> and queued for housekeeping automatically.
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ background: 'var(--gold-bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--gold)' }}>Amount to Collect</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>{formatCurrency(Math.max(balance, 0))}</span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Payment Method</label>
            <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Remarks (optional)</label>
            <textarea className="form-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Key return confirmation, damages, etc." />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
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
            <Form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
            <div style={{ marginTop: 14 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 7 }}>Tags</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {GUEST_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    className={getTagClass(tag)}
                    style={{ cursor: 'pointer', opacity: values.tags?.includes(tag) ? 1 : 0.4, border: values.tags?.includes(tag) ? undefined : '1px dashed var(--border2)' }}>
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
    <div style={{ padding: '24px', maxWidth: '1300px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', sans-serif", fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>All Guests</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: '13px' }}>Guest registry, stay history & billing</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>↻ Refresh</button>
          <button className="btn btn-outline btn-sm" onClick={() => exportGuestCSV(filtered)}>↓ Export CSV</button>
          <button className="btn btn-primary" onClick={() => setActivePanel('checkin')}>+ Check-In</button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { label: 'Active', count: activeCount, type: 'green', bar: 'stat-bar-green' },
          { label: 'Due / Overdue', count: dueCount, type: 'amber', bar: 'stat-bar-amber' },
          { label: 'Checked Out', count: checkedOutCount, type: 'grey', bar: '' },
          { label: 'Total Guests', count: guests.length, type: 'blue', bar: 'stat-bar-blue' },
        ].map(({ label, count, type, bar }) => (
          <div key={label} className={`stat-card ${bar}`}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '26px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)' }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '15px' }}>⌕</span>
            <input className="form-input" style={{ paddingLeft: '30px' }} placeholder="Search name, room, DOC ID, phone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: '140px' }} value={stayFilter} onChange={e => setStayFilter(e.target.value)}>
            <option>All</option><option>Daily</option><option>Monthly</option>
          </select>
          <select className="form-select" style={{ width: '150px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option>All</option><option>Active</option><option>Due</option><option>Checked Out</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
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
                  <tr key={guest.id} style={{ cursor: 'pointer' }} onClick={() => openProfile(guest)}>
                    <td><span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontSize: '12px', fontWeight: 600 }}>{guest.docId}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{guest.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text3)', marginTop: '1px' }}>{guest.phone}</div>
                    </td>
                    <td><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{guest.room || '—'}</span></td>
                    <td><Badge type={guest.stayType === 'monthly' ? 'purple' : 'blue'}>{guest.stayType === 'monthly' ? 'Monthly' : 'Daily'}</Badge></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px' }}>{formatDate(guest.checkInDate)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px' }}>{formatDate(dueDate)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{guest.foodPlan}</td>
                    <td><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600 }}>{guest.stayCount}</span></td>
                    <td><div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{guest.tags.map(t => <span key={t} className={getTagClass(t)}>{t}</span>)}</div></td>
                    <td><Badge type={statusColor(guest.status).replace('badge-', '')}>{guest.status}</Badge></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="btn btn-outline btn-xs" onClick={() => openProfile(guest)}>View</button>
                        {(guest.status === 'Active' || guest.status === 'Due') && (
                          <button className="btn btn-danger btn-xs" onClick={() => setCheckoutGuest(guest)}>Checkout</button>
                        )}
                        {guest.status === 'Due' && (
                          <button className="btn btn-xs" style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
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
