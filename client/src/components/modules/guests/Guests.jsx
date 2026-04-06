import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { useStore } from '../../../store/useStore'
import { formatDate, formatCurrency, statusColor } from '../../../utils/format'

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_GUESTS = [
  {
    id: '1', docId: 'DOC-0001', name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@email.com',
    room: '102', stayType: 'monthly', checkInDate: '2026-03-01', checkOutDate: null, months: 3,
    status: 'Active', foodPlan: 'Breakfast Only', tags: ['VIP'], stayCount: 3, idType: 'Aadhaar',
    idNumber: '1234-5678-9012', documents: 2, amenities: ['AC', 'WiFi'], facilities: ['AC', 'WiFi', 'TV'],
    nationality: 'Indian', address: '14, Residency Road, Bengaluru', advance: 5000,
    billingHistory: [
      { invoiceNo: 'INV-001', period: 'Mar 2026', total: 13776, status: 'Paid',    paidOn: '2026-04-02', method: 'UPI' },
    ],
    commLog: [
      { type: 'WhatsApp', msg: 'Welcome message sent', time: '2026-03-01 12:05' },
      { type: 'Receipt',  msg: 'INV-001 PDF shared',   time: '2026-04-02 11:30' },
    ],
  },
  {
    id: '2', docId: 'DOC-0002', name: 'Priya Patel', phone: '9123456789', email: 'priya@email.com',
    room: '205', stayType: 'daily', checkInDate: '2026-04-03', checkOutDate: '2026-04-10', months: null,
    status: 'Active', foodPlan: 'All Meals', tags: ['Corporate'], stayCount: 1, idType: 'PAN',
    idNumber: 'ABCDE1234F', documents: 3, amenities: [], facilities: ['AC', 'WiFi'],
    nationality: 'Indian', address: 'C-12, Sector 5, Gurugram', advance: 2000,
    billingHistory: [
      { invoiceNo: 'INV-002', period: '03–10 Apr 2026', total: 9016, status: 'Pending', paidOn: null, method: null },
    ],
    commLog: [
      { type: 'WhatsApp', msg: 'Booking confirmation sent', time: '2026-04-03 09:10' },
    ],
  },
  {
    id: '3', docId: 'DOC-0003', name: 'Ankit Singh', phone: '9988776655', email: '',
    room: '312', stayType: 'monthly', checkInDate: '2026-03-15', checkOutDate: null, months: 1,
    status: 'Due', foodPlan: 'No Meals', tags: ['Long-term'], stayCount: 5, idType: 'Aadhaar',
    idNumber: '9876-5432-1098', documents: 4, amenities: ['Mini Fridge'], facilities: ['AC'],
    nationality: 'Indian', address: 'Plot 7, Anand Nagar, Pune', advance: 0,
    billingHistory: [
      { invoiceNo: 'INV-003', period: 'Mar 2026', total: 17024, status: 'Overdue', paidOn: null, method: null },
    ],
    commLog: [
      { type: 'SMS', msg: 'Payment due reminder sent', time: '2026-04-01 10:00' },
    ],
  },
  {
    id: '4', docId: 'DOC-0004', name: 'Sneha Rao', phone: '9654321098', email: 'sneha@email.com',
    room: '118', stayType: 'daily', checkInDate: '2026-04-01', checkOutDate: '2026-04-06', months: null,
    status: 'Due', foodPlan: 'Dinner Only', tags: [], stayCount: 2, idType: 'Passport',
    idNumber: 'P1234567', documents: 2, amenities: [], facilities: ['WiFi'],
    nationality: 'Indian', address: '8B, Marine Drive, Mumbai', advance: 1000,
    billingHistory: [
      { invoiceNo: 'INV-006', period: '01–06 Apr 2026', total: 6000, status: 'Pending', paidOn: null, method: null },
    ],
    commLog: [
      { type: 'WhatsApp', msg: 'Check-out reminder sent', time: '2026-04-05 08:00' },
    ],
  },
  {
    id: '5', docId: 'DOC-0005', name: 'Vijay Kumar', phone: '9543210987', email: 'vijay@email.com',
    room: '221', stayType: 'monthly', checkInDate: '2026-02-01', checkOutDate: '2026-04-01', months: 2,
    status: 'Checked Out', foodPlan: 'Breakfast Only', tags: ['VIP', 'Long-term'], stayCount: 8, idType: 'Voter ID',
    idNumber: 'ABC1234567', documents: 3, amenities: [], facilities: ['AC', 'WiFi', 'TV', 'Geyser'],
    nationality: 'Indian', address: '22, Vasant Vihar, New Delhi', advance: 10000,
    billingHistory: [
      { invoiceNo: 'INV-004', period: 'Feb 2026', total: 15288, status: 'Paid', paidOn: '2026-03-02', method: 'Bank Transfer' },
      { invoiceNo: 'INV-005', period: 'Mar 2026', total: 15288, status: 'Paid', paidOn: '2026-04-01', method: 'UPI' },
    ],
    commLog: [
      { type: 'WhatsApp', msg: 'Farewell message sent', time: '2026-04-01 11:00' },
      { type: 'Receipt',  msg: 'Final invoice PDF shared', time: '2026-04-01 11:05' },
    ],
  },
]

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
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700 }}>{guest.name}</div>
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
  const [form, setForm] = useState(guest ? { ...guest } : {})
  if (!guest) return null
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const toggleTag = (tag) => {
    const tags = form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]
    set('tags', tags)
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
          <button className="btn btn-primary btn-sm" onClick={() => onSave(form)}>Save Changes</button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Name</label><input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)} /></div>
        <div><label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Phone</label><input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
        <div><label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Email</label><input className="form-input" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
        <div><label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Room</label><input className="form-input" value={form.room || ''} onChange={e => set('room', e.target.value)} /></div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Stay Type</label>
          <select className="form-select" value={form.stayType} onChange={e => set('stayType', e.target.value)}>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div><label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Check-In Date</label><input type="date" className="form-input" value={form.checkInDate || ''} onChange={e => set('checkInDate', e.target.value)} /></div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>{form.stayType === 'monthly' ? 'Months' : 'Check-Out Date'}</label>
          {form.stayType === 'monthly'
            ? <input type="number" className="form-input" min="1" value={form.months || ''} onChange={e => set('months', Number(e.target.value))} />
            : <input type="date" className="form-input" value={form.checkOutDate || ''} onChange={e => set('checkOutDate', e.target.value)} />}
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Food Plan</label>
          <select className="form-select" value={form.foodPlan} onChange={e => set('foodPlan', e.target.value)}>
            {FOOD_PLANS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            {['Active', 'Due', 'Checked Out'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label" style={{ display: 'block', marginBottom: 7 }}>Tags</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GUEST_TAGS.map(tag => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}
              className={getTagClass(tag)}
              style={{ cursor: 'pointer', opacity: form.tags?.includes(tag) ? 1 : 0.4, border: form.tags?.includes(tag) ? undefined : '1px dashed var(--border2)' }}>
              {tag}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Guests() {
  const addToast = useToast()
  const setActivePanel = useStore(s => s.setActivePanel)

  const [guests, setGuests] = useState(MOCK_GUESTS)
  const [search, setSearch] = useState('')
  const [stayFilter, setStayFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const [profileGuest,  setProfileGuest]  = useState(null)
  const [checkoutGuest, setCheckoutGuest] = useState(null)
  const [editGuest,     setEditGuest]     = useState(null)

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

  const handleCheckoutConfirm = (guest) => {
    setGuests(gs => gs.map(g => g.id === guest.id ? { ...g, status: 'Checked Out', room: '' } : g))
    setCheckoutGuest(null)
    addToast(`${guest.name} checked out. Room marked for housekeeping.`, 'success')
  }

  const handleEditSave = (updated) => {
    setGuests(gs => gs.map(g => g.id === updated.id ? updated : g))
    setEditGuest(null)
    addToast('Guest details updated', 'success')
  }

  const openCheckout = (guest) => { setProfileGuest(null); setCheckoutGuest(guest) }
  const openEdit     = (guest) => { setProfileGuest(null); setEditGuest(guest) }

  return (
    <div style={{ padding: '24px', maxWidth: '1300px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>All Guests</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: '13px' }}>Guest registry, stay history & billing</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => exportGuestCSV(filtered)}>↓ Export CSV</button>
          <button className="btn btn-primary" onClick={() => setActivePanel('checkin')}>+ Check-In</button>
        </div>
      </div>

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
                <tr><td colSpan={11}><div className="empty-state">No guests found</div></td></tr>
              )}
              {filtered.map(guest => {
                const dueDate = getDueDate(guest)
                return (
                  <tr key={guest.id} style={{ cursor: 'pointer' }} onClick={() => setProfileGuest(guest)}>
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
                        <button className="btn btn-outline btn-xs" onClick={() => setProfileGuest(guest)}>View</button>
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
