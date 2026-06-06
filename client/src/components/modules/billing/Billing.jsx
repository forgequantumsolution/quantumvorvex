import { useState, useMemo, useEffect, useCallback } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'
import { billingApi, guestsApi, remindersApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'

// Flatten an API invoice (guest is a relation) to the flat shape the UI renders.
function normalizeInvoice(inv) {
  return {
    id: inv.id,
    invoiceNo: inv.invoiceNo,
    guestId: inv.guestId || inv.guest?.id,
    guest: inv.guest?.name || '—',
    room: inv.guest?.room?.number || '—',
    period: inv.period,
    rent: inv.rent || 0,
    food: inv.food || 0,
    amenities: inv.amenities || 0,
    gstRate: inv.gstRate || 12,
    gstAmount: inv.gstAmount || 0,
    total: inv.total || 0,
    status: inv.status,
    createdAt: inv.createdAt,
    paidAt: inv.paidAt || null,
  }
}

// Used only by the (backend-less) Ledger tab mock below.
const GUEST_OPTIONS = ['Rahul Sharma', 'Priya Patel', 'Ankit Singh', 'Neha Gupta', 'Vijay Kumar']

// ─── Ledger mock data ─────────────────────────────────────────────────────────
const MOCK_LEDGER = {
  'Rahul Sharma': [
    { date: '2026-03-01', type: 'Debit',  desc: 'Room Rent - Mar 2026',      amount: 9000,  balance: -9000  },
    { date: '2026-03-01', type: 'Debit',  desc: 'Food Plan - Mar 2026',      amount: 2500,  balance: -11500 },
    { date: '2026-03-01', type: 'Debit',  desc: 'Amenities - Mar 2026',      amount: 800,   balance: -12300 },
    { date: '2026-03-01', type: 'Debit',  desc: 'GST (12%)',                 amount: 1476,  balance: -13776 },
    { date: '2026-04-02', type: 'Credit', desc: 'Payment Received - UPI',    amount: 13776, balance: 0      },
    { date: '2026-04-01', type: 'Debit',  desc: 'Room Rent - Apr 2026',      amount: 9000,  balance: -9000  },
  ],
}

// ─── Cash register mock data ──────────────────────────────────────────────────
const MOCK_CASH_TXN = [
  { time: '09:15', type: 'collection', desc: 'INV-001 - Rahul Sharma',      cashIn: 13776, cashOut: 0    },
  { time: '11:30', type: 'advance',    desc: 'Advance - BK-2026-002',       cashIn: 10000, cashOut: 0    },
  { time: '14:00', type: 'refund',     desc: 'Deposit Refund - DOC-0005',   cashIn: 0,     cashOut: 4200 },
  { time: '16:45', type: 'collection', desc: 'INV-002 - Priya Patel',       cashIn: 9016,  cashOut: 0    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadgeType(status) {
  if (status === 'Paid')    return 'green'
  if (status === 'Overdue') return 'red'
  if (status === 'Pending') return 'amber'
  return 'grey'
}

function cashTypeBadge(type) {
  if (type === 'collection') return { bg: 'var(--green-bg)',  color: 'var(--green-text)',  label: 'Collection' }
  if (type === 'advance')    return { bg: 'var(--blue-bg)',   color: 'var(--blue-text)',   label: 'Advance'    }
  if (type === 'refund')     return { bg: 'var(--red-bg)',    color: 'var(--red-text)',    label: 'Refund'     }
  return { bg: 'var(--surface2)', color: 'var(--text2)', label: type }
}

// ─── Invoice Print Modal ──────────────────────────────────────────────────────
function InvoiceModal({ invoice, onClose }) {
  if (!invoice) return null
  const subtotal = invoice.rent + invoice.food + invoice.amenities
  const halfGst  = invoice.gstAmount / 2

  return (
    <Modal
      isOpen={!!invoice}
      onClose={onClose}
      title={`Invoice — ${invoice.invoiceNo}`}
      size="lg"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print Invoice</button>
        </>
      }
    >
      <div>
        {/* Hotel header */}
        <div style={{
          textAlign: 'center',
          borderBottom: '2px solid var(--border)',
          paddingBottom: 16,
          marginBottom: 20,
        }}>
          <p className="t-h1" style={{
            margin: 0,
            color: 'var(--gold)',
            letterSpacing: '-0.02em',
          }}>
            Quantum Vorvex
          </p>
          <p className="t-xs" style={{ margin: '3px 0 0', color: 'var(--text3)' }}>
            Hotel Management System
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>
            123 Quantum Nagar, Bengaluru — 560001 · GSTIN: 22AAAAA0000A1Z5
          </p>
          <p className="t-title" style={{
            margin: '12px 0 0',
            letterSpacing: '0.12em',
            color: 'var(--text)',
            textTransform: 'uppercase',
          }}>
            Tax Invoice
          </p>
        </div>

        {/* Invoice meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            ['Invoice No',  invoice.invoiceNo],
            ['Date',        formatDate(invoice.createdAt)],
            ['Guest',       invoice.guest],
            ['Room',        invoice.room],
            ['Period',      invoice.period],
          ].map(([label, val]) => (
            <div key={label} style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 12px',
            }}>
              <p className="t-label" style={{ margin: 0, color: 'var(--text3)' }}>
                {label}
              </p>
              <p className="t-title" style={{
                margin: '3px 0 0',
                color: 'var(--text)',
                fontFamily: label === 'Invoice No' || label === 'Room'
                  ? 'var(--font-mono)'
                  : undefined,
              }}>
                {val}
              </p>
            </div>
          ))}
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th className="t-label" style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text3)' }}>Description</th>
              <th className="t-label" style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text3)' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Room Rent',  invoice.rent],
              invoice.food       > 0 ? ['Food Plan',  invoice.food]       : null,
              invoice.amenities  > 0 ? ['Amenities',  invoice.amenities]  : null,
            ].filter(Boolean).map(([desc, amt]) => (
              <tr key={desc} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="t-sm" style={{ padding: '9px 12px', color: 'var(--text)' }}>{desc}</td>
                <td className="t-sm" style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                  {formatCurrency(amt)}
                </td>
              </tr>
            ))}

            {/* Subtotal */}
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <td className="t-title" style={{ padding: '9px 12px', color: 'var(--text2)' }}>Subtotal</td>
              <td className="t-title" style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
                {formatCurrency(subtotal)}
              </td>
            </tr>

            {/* CGST */}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="t-sm" style={{ padding: '9px 12px', color: 'var(--text3)' }}>
                CGST ({invoice.gstRate / 2}%)
              </td>
              <td className="t-sm" style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
                {formatCurrency(halfGst)}
              </td>
            </tr>

            {/* SGST */}
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <td className="t-sm" style={{ padding: '9px 12px', color: 'var(--text3)' }}>
                SGST ({invoice.gstRate / 2}%)
              </td>
              <td className="t-sm" style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
                {formatCurrency(halfGst)}
              </td>
            </tr>

            {/* Grand Total */}
            <tr style={{ background: 'var(--gold-bg)' }}>
              <td className="t-title" style={{
                padding: '11px 12px',
                color: 'var(--gold)',
              }}>
                Grand Total
              </td>
              <td className="t-h3" style={{
                padding: '11px 12px',
                textAlign: 'right',
                fontFamily: 'var(--font-mono)',
                color: 'var(--gold)',
              }}>
                {formatCurrency(invoice.total)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payment status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'var(--surface2)',
          borderRadius: 6,
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}>
          <span className="t-xs" style={{ color: 'var(--text3)' }}>Payment Status:</span>
          <Badge type={statusBadgeType(invoice.status)}>{invoice.status}</Badge>
          {invoice.paidAt && (
            <span className="t-xs" style={{ color: 'var(--text3)', marginLeft: 4 }}>
              · Paid on {formatDate(invoice.paidAt)}
            </span>
          )}
        </div>

        {/* Footer */}
        <p style={{
          margin: 0,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text3)',
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
        }}>
          Powered by Quantum Vorvex · Forge Quantum Solutions
        </p>
      </div>
    </Modal>
  )
}

// ─── Collect Payment Confirmation ─────────────────────────────────────────────
function CollectModal({ invoice, onClose, onConfirm }) {
  const [method, setMethod] = useState('Cash')
  const [ref, setRef]       = useState('')
  if (!invoice) return null
  return (
    <Modal
      isOpen={!!invoice}
      onClose={onClose}
      title="Record Payment"
      maxWidth="420px"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={() => onConfirm(method)}>Confirm Payment</button>
        </>
      }
    >
      {/* Amount highlight */}
      <div style={{ background: 'var(--gold-bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Amount Due</div>
          <div className="t-h1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{formatCurrency(invoice.total)}</div>
        </div>
        <div className="t-xs" style={{ textAlign: 'right', color: 'var(--text3)' }}>
          <div>{invoice.guest}</div>
          <div>Room {invoice.room}</div>
          <div>{invoice.invoiceNo}</div>
        </div>
      </div>

      {/* Payment method */}
      <div style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Payment Method</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {['Cash', 'UPI', 'Card', 'Bank Transfer'].map(m => (
            <button key={m} onClick={() => setMethod(m)} className="t-xs" style={{
              padding: '8px 6px', borderRadius: 7,
              cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
              background: method === m ? 'var(--gold-bg)' : 'var(--surface2)',
              border: method === m ? '1.5px solid var(--gold)' : '1px solid var(--border)',
              color: method === m ? 'var(--gold)' : 'var(--text2)',
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Reference */}
      <div>
        <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Reference / Transaction ID (optional)</label>
        <input className="form-input" placeholder="UPI ref, cheque no., etc." value={ref} onChange={e => setRef(e.target.value)} />
      </div>
    </Modal>
  )
}

// ─── Remind Modal ─────────────────────────────────────────────────────────────
function RemindModal({ invoice, onClose, onSend }) {
  const [channel, setChannel] = useState('WhatsApp')
  const [message, setMessage] = useState('')

  // Pre-fill message whenever invoice changes
  useMemo(() => {
    if (invoice) {
      setMessage(
        `Dear ${invoice.guest}, Your payment of ${formatCurrency(invoice.total)} for Room ${invoice.room} is due. Please contact us at the earliest.`
      )
      setChannel('WhatsApp')
    }
  }, [invoice])

  if (!invoice) return null

  const CHANNELS = ['WhatsApp', 'SMS', 'Email']

  return (
    <Modal
      isOpen={!!invoice}
      onClose={onClose}
      title="Send Payment Reminder"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSend(channel, message)}>
            Send Reminder
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Recipient */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Recipient</label>
          <input
            className="form-input"
            style={{ width: '100%' }}
            value={invoice.guest}
            readOnly
          />
        </div>

        {/* Channel toggle */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>Channel</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {CHANNELS.map(ch => (
              <button
                key={ch}
                type="button"
                className={`food-opt${channel === ch ? ' sel' : ''}`}
                onClick={() => setChannel(ch)}
                style={{ flex: 1, textAlign: 'center' }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Message</label>
          <textarea
            className="form-textarea"
            style={{ width: '100%', minHeight: 96, resize: 'vertical' }}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}

// ─── Generate Invoice Modal ───────────────────────────────────────────────────
function GenerateInvoiceModal({ isOpen, onClose, onGenerate }) {
  const EMPTY = { guestId: '', period: '', rent: '', food: '', amenities: '', gstRate: 12 }
  const [form, setForm] = useState(EMPTY)
  const [guests, setGuests] = useState([])

  // Load real guests to invoice against whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return
    guestsApi.getAll()
      .then(({ data }) => {
        const list = data.guests || []
        setGuests(list)
        setForm(p => ({ ...p, guestId: p.guestId || list[0]?.id || '' }))
      })
      .catch(() => setGuests([]))
  }, [isOpen])

  const subtotal    = (parseFloat(form.rent) || 0) + (parseFloat(form.food) || 0) + (parseFloat(form.amenities) || 0)
  const gstAmount   = Math.round(subtotal * (form.gstRate / 100))
  const total       = subtotal + gstAmount

  const handleGenerate = () => {
    if (!form.guestId || !form.period.trim() || !form.rent) return
    onGenerate({
      guestId:   form.guestId,
      period:    form.period.trim(),
      rent:      parseFloat(form.rent) || 0,
      food:      parseFloat(form.food) || 0,
      amenities: parseFloat(form.amenities) || 0,
    })
    setForm(EMPTY)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); setForm(EMPTY) }}
      title="Generate Invoice"
      footer={
        <>
          <button className="btn btn-outline" onClick={() => { onClose(); setForm(EMPTY) }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGenerate}>Generate</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Guest */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Guest</label>
          <select
            className="form-select"
            style={{ width: '100%' }}
            value={form.guestId}
            onChange={e => setForm(p => ({ ...p, guestId: e.target.value }))}
          >
            {guests.length === 0
              ? <option value="">No guests available</option>
              : guests.map(g => <option key={g.id} value={g.id}>{g.name} · {g.docId}</option>)}
          </select>
        </div>

        {/* Period */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Period</label>
          <input
            className="form-input"
            style={{ width: '100%' }}
            placeholder="e.g. Apr 2026"
            value={form.period}
            onChange={e => setForm(p => ({ ...p, period: e.target.value }))}
          />
        </div>

        {/* Amount fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            ['Rent ₹',       'rent'],
            ['Food ₹',       'food'],
            ['Amenities ₹',  'amenities'],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>{label}</label>
              <input
                className="form-input"
                type="number"
                min="0"
                placeholder="0"
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        {/* GST Rate */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>GST Rate (%)</label>
          <select
            className="form-select"
            style={{ width: '100%' }}
            value={form.gstRate}
            onChange={e => setForm(p => ({ ...p, gstRate: parseInt(e.target.value) }))}
          >
            {[5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>

        {/* Calculated total */}
        {subtotal > 0 && (
          <div style={{
            background: 'var(--gold-bg)',
            border: '1px solid var(--gold-border)',
            borderRadius: 6,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                ['Subtotal',              subtotal],
                [`GST (${form.gstRate}%)`, gstAmount],
              ].map(([label, val]) => (
                <div key={label} className="t-xs" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                  <span>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(val)}</span>
                </div>
              ))}
              <div className="t-title" style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--gold)',
                borderTop: '1px solid var(--gold-border)',
                paddingTop: 6,
                marginTop: 2,
              }}>
                <span>Total</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────
function LedgerTab() {
  const [guestSearch, setGuestSearch] = useState('')
  const [selectedGuest, setSelectedGuest] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const filteredGuests = GUEST_OPTIONS.filter(g =>
    g.toLowerCase().includes(guestSearch.toLowerCase())
  )

  const ledgerRows = selectedGuest ? (MOCK_LEDGER[selectedGuest] || []) : []
  const closingBalance = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].balance : null

  const monoStyle = { fontFamily: 'var(--font-mono)' }

  return (
    <div>
      {/* Guest selector */}
      <div style={{ marginBottom: 20, maxWidth: 340, position: 'relative' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Select Guest</label>
        <input
          className="form-input"
          style={{ width: '100%' }}
          placeholder="Search guest…"
          value={selectedGuest || guestSearch}
          onFocus={() => { setDropdownOpen(true); if (selectedGuest) { setGuestSearch(''); setSelectedGuest('') } }}
          onChange={e => { setGuestSearch(e.target.value); setSelectedGuest(''); setDropdownOpen(true) }}
        />
        {dropdownOpen && filteredGuests.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            marginTop: 2,
            zIndex: 100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}>
            {filteredGuests.map(g => (
              <div
                key={g}
                onClick={() => { setSelectedGuest(g); setGuestSearch(g); setDropdownOpen(false) }}
                className="t-sm"
                style={{
                  padding: '9px 14px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {g}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger table */}
      {selectedGuest && (
        <>
          {ledgerRows.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>No ledger entries for {selectedGuest}</p>
            </div>
          ) : (
            <>
              <div className="card" style={{ overflowX: 'auto', marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Date', 'Type', 'Description', 'Amount ₹', 'Running Balance ₹'].map(h => (
                        <th key={h} style={{
                          textAlign: h === 'Amount ₹' || h === 'Running Balance ₹' ? 'right' : 'left',
                          padding: '10px 14px',
                          whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="t-xs" style={{ padding: '11px 14px', color: 'var(--text3)', ...monoStyle }}>
                          {row.date}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span className="t-xs" style={{
                            color: row.type === 'Credit' ? 'var(--green-text)' : 'var(--red-text)',
                            ...monoStyle,
                          }}>
                            {row.type}
                          </span>
                        </td>
                        <td className="t-sm" style={{ padding: '11px 14px', color: 'var(--text)' }}>
                          {row.desc}
                        </td>
                        <td className="t-sm" style={{ padding: '11px 14px', textAlign: 'right', ...monoStyle, color: 'var(--text2)' }}>
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="t-title" style={{
                          padding: '11px 14px',
                          textAlign: 'right',
                          ...monoStyle,
                          color: row.balance >= 0 ? 'var(--green-text)' : 'var(--red-text)',
                        }}>
                          {row.balance >= 0 ? '+' : ''}{formatCurrency(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Closing balance */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '12px 16px',
                marginBottom: 16,
              }}>
                <span className="t-title" style={{ color: 'var(--text2)' }}>
                  Closing Balance — {selectedGuest}
                </span>
                <span className="t-h3" style={{
                  fontFamily: 'var(--font-mono)',
                  color: closingBalance >= 0 ? 'var(--green-text)' : 'var(--red-text)',
                }}>
                  {closingBalance >= 0 ? '+' : ''}{formatCurrency(closingBalance)}
                </span>
              </div>

              <button className="btn btn-outline" onClick={() => window.print()}>
                Print Ledger
              </button>
            </>
          )}
        </>
      )}

      {!selectedGuest && (
        <div className="empty-state">
          <p className="t-sm" style={{ margin: 0, color: 'var(--text3)' }}>
            Select a guest to view their account ledger
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Cash Register Tab ────────────────────────────────────────────────────────
function CashRegisterTab() {
  const addToast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]             = useState(today)
  const [openingBalance, setOpening] = useState(5000)

  const transactions = MOCK_CASH_TXN

  const totalIn  = transactions.reduce((s, t) => s + t.cashIn,  0)
  const totalOut = transactions.reduce((s, t) => s + t.cashOut, 0)
  const closing  = openingBalance + totalIn - totalOut

  const monoStyle = { fontFamily: 'var(--font-mono)' }

  const handleExportCSV = () => {
    const header = 'Time,Type,Description,Cash In,Cash Out'
    const rows   = transactions.map(t =>
      `${t.time},${t.type},"${t.desc}",${t.cashIn},${t.cashOut}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cash-register-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
    addToast('Cash register exported as CSV', 'success')
  }

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Date</label>
          <input
            className="form-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: 180 }}
          />
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Opening Balance ₹</label>
          <input
            className="form-input"
            type="number"
            min="0"
            value={openingBalance}
            onChange={e => setOpening(parseFloat(e.target.value) || 0)}
            style={{ width: 160, fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      {/* Transactions table */}
      <div className="card" style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Time', 'Type', 'Description', 'Cash In ₹', 'Cash Out ₹'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Cash In ₹' || h === 'Cash Out ₹' ? 'right' : 'left',
                  padding: '10px 14px',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, i) => {
              const badge = cashTypeBadge(txn.type)
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="t-xs" style={{ padding: '11px 14px', ...monoStyle, color: 'var(--text3)' }}>
                    {txn.time}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: badge.bg,
                      color: badge.color,
                      textTransform: 'capitalize',
                    }}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="t-sm" style={{ padding: '11px 14px', color: 'var(--text)' }}>
                    {txn.desc}
                  </td>
                  <td className="t-sm" style={{ padding: '11px 14px', textAlign: 'right', ...monoStyle }}>
                    {txn.cashIn > 0
                      ? <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>{formatCurrency(txn.cashIn)}</span>
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td className="t-sm" style={{ padding: '11px 14px', textAlign: 'right', ...monoStyle }}>
                    {txn.cashOut > 0
                      ? <span style={{ color: 'var(--red-text)', fontWeight: 600 }}>{formatCurrency(txn.cashOut)}</span>
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                </tr>
              )
            })}

            {/* Totals row */}
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
              <td colSpan={3} className="t-title" style={{ padding: '11px 14px', color: 'var(--text2)' }}>
                Totals
              </td>
              <td className="t-title" style={{ padding: '11px 14px', textAlign: 'right', ...monoStyle, color: 'var(--green-text)' }}>
                {formatCurrency(totalIn)}
              </td>
              <td className="t-title" style={{ padding: '11px 14px', textAlign: 'right', ...monoStyle, color: 'var(--red-text)' }}>
                {formatCurrency(totalOut)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Closing balance summary */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 18,
      }}>
        {[
          { label: 'Opening Balance', value: formatCurrency(openingBalance), color: 'var(--text2)' },
          { label: 'Total In',        value: formatCurrency(totalIn),        color: 'var(--green-text)' },
          { label: 'Total Out',       value: formatCurrency(totalOut),       color: 'var(--red-text)'   },
          { label: 'Closing Balance', value: formatCurrency(closing),        color: closing >= 0 ? 'var(--green-text)' : 'var(--red-text)', bold: true },
        ].map(item => (
          <div key={item.label} style={{
            flex: '1 1 140px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '10px 14px',
          }}>
            <p className="t-label" style={{ margin: 0, color: 'var(--text3)' }}>
              {item.label}
            </p>
            <p className="t-h3" style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-mono)',
              color: item.color,
            }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-outline" onClick={() => window.print()}>
          Print Register
        </button>
        <button className="btn btn-primary" onClick={handleExportCSV}>
          Export CSV
        </button>
      </div>
    </div>
  )
}

// ─── Tab styles helper ────────────────────────────────────────────────────────
const TAB_STYLE_ACTIVE = {
  padding: '8px 18px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'var(--gold-bg)',
  border: '1px solid var(--gold)',
  color: 'var(--gold)',
  transition: 'all 0.13s',
}
const TAB_STYLE_INACTIVE = {
  padding: '8px 18px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text2)',
  transition: 'all 0.13s',
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Billing() {
  const addToast = useToast()

  const [activeTab, setActiveTab]           = useState('invoices')
  const [invoices, setInvoices]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState('All')
  const [invoiceModal, setInvoiceModal]     = useState(null)   // invoice obj
  const [collectModal, setCollectModal]     = useState(null)   // invoice obj
  const [remindModal, setRemindModal]       = useState(null)   // invoice obj
  const [showGenerate, setShowGenerate]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await billingApi.getAll()
      setInvoices((data.invoices || []).map(normalizeInvoice))
    } catch {
      setError('Could not load invoices. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const paid    = invoices.filter(i => i.status === 'Paid')
    const pending = invoices.filter(i => i.status === 'Pending')
    const overdue = invoices.filter(i => i.status === 'Overdue')
    return {
      collected:    paid.reduce((s, i) => s + i.total, 0),
      pendingTotal: pending.reduce((s, i) => s + i.total, 0),
      pendingCount: pending.length,
      overdueTotal: overdue.reduce((s, i) => s + i.total, 0),
      overdueCount: overdue.length,
      gstCollected: paid.reduce((s, i) => s + i.gstAmount, 0),
    }
  }, [invoices])

  // ── Filtered invoices ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return invoices.filter(inv => {
      const matchStatus = statusFilter === 'All' || inv.status === statusFilter
      const matchSearch = !q ||
        inv.guest.toLowerCase().includes(q) ||
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.room.toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [invoices, search, statusFilter])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCollect = async (method) => {
    if (!collectModal) return
    const target = collectModal
    try {
      await billingApi.collect(target.id)
      addToast(`${formatCurrency(target.total)} collected via ${method || 'Cash'} for ${target.guest}`, 'success')
      setCollectModal(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not record payment', 'error')
    }
  }

  const handleRemind = async (channel, message) => {
    if (!remindModal) return
    try {
      if (remindModal.guestId) {
        await remindersApi.send({ guestId: remindModal.guestId, channel, message })
      }
      addToast(`Reminder sent via ${channel}`, 'success')
      setRemindModal(null)
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not send reminder', 'error')
    }
  }

  const handleGenerate = async (payload) => {
    try {
      const { data } = await billingApi.generate(payload)
      addToast(`Invoice ${data.invoice?.invoiceNo || ''} generated`, 'success')
      setShowGenerate(false)
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not generate invoice', 'error')
    }
  }

  const handleExportCSV = () => {
    const headers = ['Invoice No', 'Guest', 'Room', 'Period', 'Rent', 'Food', 'Amenities', 'GST', 'Total', 'Status', 'Created', 'Paid On']
    const rows = filtered.map(inv => [
      inv.invoiceNo, inv.guest, inv.room, inv.period,
      inv.rent, inv.food, inv.amenities, inv.gstAmount, inv.total,
      inv.status, inv.createdAt, inv.paidAt || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'invoices.csv'; a.click()
    URL.revokeObjectURL(url)
    addToast('Invoice CSV exported', 'success')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 22,
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
          }}>
            Billing &amp; Payments
          </h1>
          <p className="t-sm" style={{ margin: '3px 0 0', color: 'var(--text3)' }}>
            Invoice management with GST compliance
          </p>
        </div>
        {activeTab === 'invoices' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>↻ Refresh</button>
            <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>↓ Export CSV</button>
            <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>+ Generate Invoice</button>
          </div>
        )}
      </div>

      {error && (
        <div className="t-sm" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red-text)' }}>
          {error}
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 22 }}>
        {/* Collected */}
        <div className="stat-card stat-bar-green">
          <p className="t-label" style={{ margin: '0 0 4px', color: 'var(--text3)' }}>
            Collected this month
          </p>
          <p className="t-h1" style={{ margin: 0, color: 'var(--green-text)' }}>
            {formatCurrency(stats.collected)}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>
            {invoices.filter(i => i.status === 'Paid').length} invoices paid
          </p>
        </div>

        {/* Pending */}
        <div className="stat-card stat-bar-amber">
          <p className="t-label" style={{ margin: '0 0 4px', color: 'var(--text3)' }}>
            Pending
          </p>
          <p className="t-h1" style={{ margin: 0, color: 'var(--amber-text)' }}>
            {formatCurrency(stats.pendingTotal)}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>
            {stats.pendingCount} invoice{stats.pendingCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Overdue */}
        <div className="stat-card stat-bar-red">
          <p className="t-label" style={{ margin: '0 0 4px', color: 'var(--text3)' }}>
            Overdue
          </p>
          <p className="t-h1" style={{ margin: 0, color: 'var(--red-text)' }}>
            {formatCurrency(stats.overdueTotal)}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>
            {stats.overdueCount} invoice{stats.overdueCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* GST Collected */}
        <div className="stat-card stat-bar-blue">
          <p className="t-label" style={{ margin: '0 0 4px', color: 'var(--text3)' }}>
            GST Collected
          </p>
          <p className="t-h1" style={{ margin: 0, color: 'var(--blue-text)' }}>
            {formatCurrency(stats.gstCollected)}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>From paid invoices</p>
        </div>
      </div>

      {/* ── Tab Navigation ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'invoices',      label: 'Invoices'      },
          { id: 'ledger',        label: 'Ledger'        },
          { id: 'cash-register', label: 'Cash Register' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={activeTab === tab.id ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Invoices Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <>
          {/* Filter Row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <span className="t-sm" style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', pointerEvents: 'none',
              }}>
                ⌕
              </span>
              <input
                className="form-input"
                type="text"
                placeholder="Search guest or invoice..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 28, width: 220, fontSize: 12 }}
              />
            </div>

            {/* Status filter pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {['All', 'Paid', 'Pending', 'Overdue'].map(s => {
                const active = statusFilter === s
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="t-xs"
                    style={{
                      padding: '5px 13px',
                      borderRadius: 20,
                      cursor: 'pointer',
                      background: active ? 'var(--gold-bg)' : 'var(--surface)',
                      border: active ? '1px solid var(--gold)' : '1px solid var(--border)',
                      color: active ? 'var(--gold)' : 'var(--text2)',
                      transition: 'all 0.13s',
                    }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>

            <div style={{ flex: 1 }} />
            <p className="t-xs" style={{ margin: 0, color: 'var(--text3)', flexShrink: 0 }}>
              {filtered.length} of {invoices.length} records
            </p>
          </div>

          {/* Payment Records Table */}
          <div className="card" style={{ overflowX: 'auto' }}>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>{loading ? 'Loading invoices…' : 'No invoices found'}</p>
                {!loading && <p className="t-xs" style={{ margin: '4px 0 0' }}>Generate an invoice or adjust your filters</p>}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Invoice #', 'Guest', 'Room', 'Period', 'Rent', 'Food', 'Amenities', 'GST (12%)', 'Total', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{
                        textAlign: h === 'Actions' ? 'center' : h === 'Rent' || h === 'Food' || h === 'Amenities' || h === 'GST (12%)' || h === 'Total' ? 'right' : 'left',
                        padding: '10px 12px',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => (
                    <tr key={inv.id} style={{ transition: 'background 0.1s' }}>
                      {/* Invoice # */}
                      <td style={{ padding: '11px 12px' }}>
                        <span className="t-xs" style={{
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--gold)',
                        }}>
                          {inv.invoiceNo}
                        </span>
                      </td>

                      {/* Guest */}
                      <td style={{ padding: '11px 12px' }}>
                        <span className="t-title" style={{ color: 'var(--text)' }}>
                          {inv.guest}
                        </span>
                      </td>

                      {/* Room */}
                      <td style={{ padding: '11px 12px' }}>
                        <span className="t-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
                          {inv.room}
                        </span>
                      </td>

                      {/* Period */}
                      <td className="t-xs" style={{ padding: '11px 12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {inv.period}
                      </td>

                      {/* Rent */}
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <span className="t-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
                          {formatCurrency(inv.rent)}
                        </span>
                      </td>

                      {/* Food */}
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <span className="t-xs" style={{ fontFamily: 'var(--font-mono)', color: inv.food > 0 ? 'var(--text2)' : 'var(--text3)' }}>
                          {inv.food > 0 ? formatCurrency(inv.food) : '—'}
                        </span>
                      </td>

                      {/* Amenities */}
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <span className="t-xs" style={{ fontFamily: 'var(--font-mono)', color: inv.amenities > 0 ? 'var(--text2)' : 'var(--text3)' }}>
                          {inv.amenities > 0 ? formatCurrency(inv.amenities) : '—'}
                        </span>
                      </td>

                      {/* GST */}
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <span className="t-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
                          {formatCurrency(inv.gstAmount)}
                        </span>
                      </td>

                      {/* Total */}
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <span className="t-title" style={{
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text)',
                        }}>
                          {formatCurrency(inv.total)}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '11px 12px' }}>
                        <Badge type={statusBadgeType(inv.status)}>{inv.status}</Badge>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'nowrap' }}>
                          {/* Collect — only for pending */}
                          {inv.status === 'Pending' && (
                            <button
                              className="btn btn-xs"
                              style={{
                                background: 'var(--amber-bg)',
                                color: 'var(--amber-text)',
                                border: '1px solid var(--amber)',
                                borderRadius: 4,
                                padding: '3px 8px',
                                fontSize: 11,
                                cursor: 'pointer',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                              onClick={() => setCollectModal(inv)}
                            >
                              Collect
                            </button>
                          )}

                          {/* Remind */}
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={() => setRemindModal(inv)}
                          >
                            Remind
                          </button>

                          {/* Invoice */}
                          <button
                            className="btn btn-xs"
                            style={{
                              background: 'var(--gold-bg)',
                              color: 'var(--gold)',
                              border: '1px solid var(--gold-border)',
                              borderRadius: 4,
                              padding: '3px 8px',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            onClick={() => setInvoiceModal(inv)}
                          >
                            Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Ledger Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'ledger' && <LedgerTab />}

      {/* ── Cash Register Tab ───────────────────────────────────────────────── */}
      {activeTab === 'cash-register' && <CashRegisterTab />}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <InvoiceModal
        invoice={invoiceModal}
        onClose={() => setInvoiceModal(null)}
      />

      <CollectModal
        invoice={collectModal}
        onClose={() => setCollectModal(null)}
        onConfirm={handleCollect}
      />

      <RemindModal
        invoice={remindModal}
        onClose={() => setRemindModal(null)}
        onSend={handleRemind}
      />

      <GenerateInvoiceModal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerate={handleGenerate}
      />
    </div>
  )
}
