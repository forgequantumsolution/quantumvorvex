import { useState, useEffect, useCallback } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
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
        <div className="text-center border-b-2 border-line pb-4 mb-5">
          <p className="t-h1 m-0 text-gold tracking-[-0.02em]">
            Quantum Vorvex
          </p>
          <p className="t-xs mt-[3px] mb-0 text-ink3">
            Hotel Management System
          </p>
          <p className="mt-0.5 mb-0 text-[11px] text-ink3">
            123 Quantum Nagar, Bengaluru — 560001 · GSTIN: 22AAAAA0000A1Z5
          </p>
          <p className="t-title mt-3 mb-0 tracking-[0.12em] uppercase">
            Tax Invoice
          </p>
        </div>

        {/* Invoice meta */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {[
            ['Invoice No',  invoice.invoiceNo],
            ['Date',        formatDate(invoice.createdAt)],
            ['Guest',       invoice.guest],
            ['Room',        invoice.room],
            ['Period',      invoice.period],
          ].map(([label, val]) => (
            <div key={label} className="bg-surface2 border border-line rounded-md px-3 py-2">
              <p className="t-label m-0">
                {label}
              </p>
              <p className="t-title mt-[3px] mb-0" style={{
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
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="bg-surface2">
              <th className="t-label text-left px-3 py-2">Description</th>
              <th className="t-label text-right px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Room Rent',  invoice.rent],
              invoice.food       > 0 ? ['Food Plan',  invoice.food]       : null,
              invoice.amenities  > 0 ? ['Amenities',  invoice.amenities]  : null,
            ].filter(Boolean).map(([desc, amt]) => (
              <tr key={desc} className="border-b border-line">
                <td className="t-sm px-3 py-[9px]">{desc}</td>
                <td className="t-sm px-3 py-[9px] text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(amt)}
                </td>
              </tr>
            ))}

            {/* Subtotal */}
            <tr className="border-b border-line bg-surface2">
              <td className="t-title px-3 py-[9px] text-ink2">Subtotal</td>
              <td className="t-title px-3 py-[9px] text-right text-ink2" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(subtotal)}
              </td>
            </tr>

            {/* CGST */}
            <tr className="border-b border-line">
              <td className="t-sm px-3 py-[9px] text-ink3">
                CGST ({invoice.gstRate / 2}%)
              </td>
              <td className="t-sm px-3 py-[9px] text-right text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(halfGst)}
              </td>
            </tr>

            {/* SGST */}
            <tr className="border-b-2 border-line">
              <td className="t-sm px-3 py-[9px] text-ink3">
                SGST ({invoice.gstRate / 2}%)
              </td>
              <td className="t-sm px-3 py-[9px] text-right text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(halfGst)}
              </td>
            </tr>

            {/* Grand Total */}
            <tr className="bg-[var(--gold-bg)]">
              <td className="t-title px-3 py-[11px] text-gold">
                Grand Total
              </td>
              <td className="t-h3 px-3 py-[11px] text-right text-gold" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(invoice.total)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payment status */}
        <div className="flex items-center gap-2.5 px-[14px] py-2.5 bg-surface2 rounded-md border border-line mb-4">
          <span className="t-xs text-ink3">Payment Status:</span>
          <Badge type={statusBadgeType(invoice.status)}>{invoice.status}</Badge>
          {invoice.paidAt && (
            <span className="t-xs text-ink3 ml-1">
              · Paid on {formatDate(invoice.paidAt)}
            </span>
          )}
        </div>

        {/* Footer */}
        <p className="m-0 text-center text-[11px] text-ink3 pt-3 border-t border-line">
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
      <div className="bg-[var(--gold-bg)] rounded-lg px-[14px] py-3 mb-4 flex justify-between items-center">
        <div>
          <div className="text-[10.5px] font-bold text-gold uppercase tracking-[0.08em] mb-0.5">Amount Due</div>
          <div className="t-h1 text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(invoice.total)}</div>
        </div>
        <div className="t-xs text-right text-ink3">
          <div>{invoice.guest}</div>
          <div>Room {invoice.room}</div>
          <div>{invoice.invoiceNo}</div>
        </div>
      </div>

      {/* Payment method */}
      <div className="mb-3">
        <label className="form-label block mb-[5px]">Payment Method</label>
        <div className="grid grid-cols-4 gap-2">
          {['Cash', 'UPI', 'Card', 'Bank Transfer'].map(m => (
            <button key={m} onClick={() => setMethod(m)} className={`t-xs px-1.5 py-2 rounded-[7px] cursor-pointer text-center transition-all duration-150 ${method === m ? 'bg-[var(--gold-bg)] border-[1.5px] border-gold text-gold' : 'bg-surface2 border border-line text-ink2'}`}>{m}</button>
          ))}
        </div>
      </div>

      {/* Reference */}
      <div>
        <label className="form-label block mb-[5px]">Reference / Transaction ID (optional)</label>
        <input className="form-input" placeholder="UPI ref, cheque no., etc." value={ref} onChange={e => setRef(e.target.value)} />
      </div>
    </Modal>
  )
}

// ─── Remind Modal ─────────────────────────────────────────────────────────────
function RemindModal({ invoice, onClose, onSend }) {
  const [channel, setChannel] = useState('WhatsApp')
  // Pre-filled from the invoice. The parent keys this modal by invoice id, so it
  // remounts per invoice and this initializer re-runs with the right values.
  const [message, setMessage] = useState(() =>
    invoice
      ? `Dear ${invoice.guest}, Your payment of ${formatCurrency(invoice.total)} for Room ${invoice.room} is due. Please contact us at the earliest.`
      : ''
  )

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
      <div className="flex flex-col gap-4">
        {/* Recipient */}
        <div>
          <label className="form-label block mb-[5px]">Recipient</label>
          <input
            className="form-input w-full"
            value={invoice.guest}
            readOnly
          />
        </div>

        {/* Channel toggle */}
        <div>
          <label className="form-label block mb-2">Channel</label>
          <div className="flex gap-2">
            {CHANNELS.map(ch => (
              <button
                key={ch}
                type="button"
                className={`food-opt flex-1 text-center${channel === ch ? ' sel' : ''}`}
                onClick={() => setChannel(ch)}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="form-label block mb-[5px]">Message</label>
          <textarea
            className="form-textarea w-full min-h-24 resize-y"
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
      <div className="flex flex-col gap-[14px]">
        {/* Guest */}
        <div>
          <label className="form-label block mb-[5px]">Guest</label>
          <select
            className="form-select w-full"
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
          <label className="form-label block mb-[5px]">Period</label>
          <input
            className="form-input w-full"
            placeholder="e.g. Apr 2026"
            value={form.period}
            onChange={e => setForm(p => ({ ...p, period: e.target.value }))}
          />
        </div>

        {/* Amount fields */}
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Rent ₹',       'rent'],
            ['Food ₹',       'food'],
            ['Amenities ₹',  'amenities'],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="form-label block mb-[5px]">{label}</label>
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
          <label className="form-label block mb-[5px]">GST Rate (%)</label>
          <select
            className="form-select w-full"
            value={form.gstRate}
            onChange={e => setForm(p => ({ ...p, gstRate: parseInt(e.target.value) }))}
          >
            {[5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>

        {/* Calculated total */}
        {subtotal > 0 && (
          <div className="bg-[var(--gold-bg)] border border-[var(--gold-border)] rounded-md px-[14px] py-3">
            <div className="flex flex-col gap-[5px]">
              {[
                ['Subtotal',              subtotal],
                [`GST (${form.gstRate}%)`, gstAmount],
              ].map(([label, val]) => (
                <div key={label} className="t-xs flex justify-between">
                  <span>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(val)}</span>
                </div>
              ))}
              <div className="t-title flex justify-between text-gold border-t border-[var(--gold-border)] pt-1.5 mt-0.5">
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
  const addToast = useToast()
  const [guestSearch, setGuestSearch] = useState('')
  const [selectedGuest, setSelectedGuest] = useState('')   // guest display name
  const [selectedGuestId, setSelectedGuestId] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [guests, setGuests] = useState([])
  const [ledgerRows, setLedgerRows] = useState([])
  const [closingBalance, setClosingBalance] = useState(null)
  const [loading, setLoading] = useState(false)

  // Load the guest list once for the selector.
  useEffect(() => {
    guestsApi.getAll()
      .then(res => setGuests(res.data.guests || []))
      .catch(() => setGuests([]))
  }, [])

  // Fetch the ledger from the API whenever a guest is selected.
  const loadLedger = useCallback(async () => {
    if (!selectedGuestId) { setLedgerRows([]); setClosingBalance(null); return }
    setLoading(true)
    try {
      const res = await billingApi.getLedger(selectedGuestId)
      setLedgerRows(res.data.entries || [])
      setClosingBalance(res.data.closingBalance ?? null)
    } catch {
      addToast('Failed to load ledger', 'error'); setLedgerRows([])
    } finally {
      setLoading(false)
    }
  }, [selectedGuestId, addToast])
  useEffect(() => { loadLedger() }, [loadLedger])

  const filteredGuests = guests.filter(g =>
    g.name.toLowerCase().includes(guestSearch.toLowerCase())
  )

  const monoStyle = { fontFamily: 'var(--font-mono)' }

  return (
    <div>
      {/* Guest selector */}
      <div className="mb-5 max-w-[340px] relative">
        <label className="form-label block mb-1.5">Select Guest</label>
        <input
          className="form-input w-full"
          placeholder="Search guest…"
          value={selectedGuest || guestSearch}
          onFocus={() => { setDropdownOpen(true); if (selectedGuest) { setGuestSearch(''); setSelectedGuest(''); setSelectedGuestId('') } }}
          onChange={e => { setGuestSearch(e.target.value); setSelectedGuest(''); setSelectedGuestId(''); setDropdownOpen(true) }}
        />
        {dropdownOpen && filteredGuests.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-surface border border-line rounded-md mt-0.5 z-[100] shadow-[0_4px_16px_rgba(0,0,0,0.3)] max-h-[260px] overflow-y-auto">
            {filteredGuests.map(g => (
              <div
                key={g.id}
                onClick={() => { setSelectedGuest(g.name); setSelectedGuestId(g.id); setGuestSearch(g.name); setDropdownOpen(false) }}
                className="t-sm px-[14px] py-[9px] cursor-pointer border-b border-line transition-[background] duration-100"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {g.name}{g.room?.number ? ` · Room ${g.room.number}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger table */}
      {selectedGuestId && (
        <>
          {loading ? (
            <div className="empty-state"><p className="t-sm m-0 text-ink3">Loading ledger…</p></div>
          ) : ledgerRows.length === 0 ? (
            <div className="empty-state">
              <p className="m-0 font-semibold text-ink2">No ledger entries for {selectedGuest}</p>
            </div>
          ) : (
            <>
              <div className="card overflow-x-auto mb-[14px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Date', 'Type', 'Description', 'Amount ₹', 'Running Balance ₹'].map(h => (
                        <th key={h} className={`px-[14px] py-2.5 whitespace-nowrap ${h === 'Amount ₹' || h === 'Running Balance ₹' ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((row, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="t-xs px-[14px] py-[11px] text-ink3" style={{ ...monoStyle }}>
                          {row.date}
                        </td>
                        <td className="px-[14px] py-[11px]">
                          <span className="t-xs" style={{
                            color: row.type === 'Credit' ? 'var(--green-text)' : 'var(--red-text)',
                            ...monoStyle,
                          }}>
                            {row.type}
                          </span>
                        </td>
                        <td className="t-sm px-[14px] py-[11px]">
                          {row.desc}
                        </td>
                        <td className="t-sm px-[14px] py-[11px] text-right text-ink2" style={{ ...monoStyle }}>
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="t-title px-[14px] py-[11px] text-right" style={{
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
              <div className="flex items-center justify-between bg-surface2 border border-line rounded-md px-4 py-3 mb-4">
                <span className="t-title text-ink2">
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
          <p className="t-sm m-0 text-ink3">
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
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]       = useState(false)

  // Fetch the day's cash movements from the API whenever the date changes.
  const loadCashRegister = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billingApi.getCashRegister(date)
      setTransactions(res.data.transactions || [])
    } catch {
      addToast('Failed to load cash register', 'error'); setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [date, addToast])
  useEffect(() => { loadCashRegister() }, [loadCashRegister])

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
      <div className="flex gap-4 flex-wrap items-end mb-5">
        <div>
          <label className="form-label block mb-[5px]">Date</label>
          <input
            className="form-input w-[180px]"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label block mb-[5px]">Opening Balance ₹</label>
          <input
            className="form-input w-40"
            type="number"
            min="0"
            value={openingBalance}
            onChange={e => setOpening(parseFloat(e.target.value) || 0)}
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      {/* Transactions table */}
      <div className="card overflow-x-auto mb-[14px]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Time', 'Type', 'Description', 'Cash In ₹', 'Cash Out ₹'].map(h => (
                <th key={h} className={`px-[14px] py-2.5 whitespace-nowrap ${h === 'Cash In ₹' || h === 'Cash Out ₹' ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(loading || transactions.length === 0) && (
              <tr className="border-t border-line">
                <td colSpan={5} className="t-sm px-[14px] py-6 text-center text-ink3">
                  {loading ? 'Loading…' : 'No cash transactions for this date'}
                </td>
              </tr>
            )}
            {transactions.map((txn, i) => {
              const badge = cashTypeBadge(txn.type)
              return (
                <tr key={i} className="border-t border-line">
                  <td className="t-xs px-[14px] py-[11px] text-ink3" style={{ ...monoStyle }}>
                    {txn.time}
                  </td>
                  <td className="px-[14px] py-[11px]">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold capitalize" style={{
                      background: badge.bg,
                      color: badge.color,
                    }}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="t-sm px-[14px] py-[11px]">
                    {txn.desc}
                  </td>
                  <td className="t-sm px-[14px] py-[11px] text-right" style={{ ...monoStyle }}>
                    {txn.cashIn > 0
                      ? <span className="font-semibold text-success-text">{formatCurrency(txn.cashIn)}</span>
                      : <span className="text-ink3">—</span>}
                  </td>
                  <td className="t-sm px-[14px] py-[11px] text-right" style={{ ...monoStyle }}>
                    {txn.cashOut > 0
                      ? <span className="font-semibold text-danger-text">{formatCurrency(txn.cashOut)}</span>
                      : <span className="text-ink3">—</span>}
                  </td>
                </tr>
              )
            })}

            {/* Totals row */}
            <tr className="border-t-2 border-line bg-surface2">
              <td colSpan={3} className="t-title px-[14px] py-[11px] text-ink2">
                Totals
              </td>
              <td className="t-title px-[14px] py-[11px] text-right text-success-text" style={{ ...monoStyle }}>
                {formatCurrency(totalIn)}
              </td>
              <td className="t-title px-[14px] py-[11px] text-right text-danger-text" style={{ ...monoStyle }}>
                {formatCurrency(totalOut)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Closing balance summary */}
      <div className="flex flex-wrap gap-2.5 mb-[18px]">
        {[
          { label: 'Opening Balance', value: formatCurrency(openingBalance), color: 'var(--text2)' },
          { label: 'Total In',        value: formatCurrency(totalIn),        color: 'var(--green-text)' },
          { label: 'Total Out',       value: formatCurrency(totalOut),       color: 'var(--red-text)'   },
          { label: 'Closing Balance', value: formatCurrency(closing),        color: closing >= 0 ? 'var(--green-text)' : 'var(--red-text)', bold: true },
        ].map(item => (
          <div key={item.label} className="flex-[1_1_140px] bg-surface2 border border-line rounded-md px-[14px] py-2.5">
            <p className="t-label m-0">
              {item.label}
            </p>
            <p className="t-h3 mt-1 mb-0" style={{
              fontFamily: 'var(--font-mono)',
              color: item.color,
            }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2.5">
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
const TAB_CLASS_BASE = 'px-[18px] py-2 rounded-md text-[13px] cursor-pointer transition-all duration-[130ms]'
const TAB_CLASS_ACTIVE = 'font-semibold bg-[var(--gold-bg)] border border-gold text-gold'
const TAB_CLASS_INACTIVE = 'font-medium bg-surface border border-line text-ink2'

// ─── Main Component ───────────────────────────────────────────────────────────
const PAGE_SIZE = 20

export default function Billing() {
  const addToast = useToast()

  const [activeTab, setActiveTab]           = useState('invoices')
  const [invoices, setInvoices]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [search, setSearch]                 = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter]     = useState('All')
  const [page, setPage]                     = useState(1)
  const [total, setTotal]                   = useState(0)
  // Full-dataset aggregates for the stat cards (independent of search/filter/page).
  const [stats, setStats] = useState({
    collected: 0, gstCollected: 0, paidCount: 0,
    pendingTotal: 0, pendingCount: 0, overdueTotal: 0, overdueCount: 0,
  })
  const [invoiceModal, setInvoiceModal]     = useState(null)   // invoice obj
  const [collectModal, setCollectModal]     = useState(null)   // invoice obj
  const [remindModal, setRemindModal]       = useState(null)   // invoice obj
  const [deleteModal, setDeleteModal]       = useState(null)   // invoice obj
  const [deleting, setDeleting]             = useState(false)
  const [showGenerate, setShowGenerate]     = useState(false)

  // Query params shared by the list fetch and the "export all" action.
  const listParams = useCallback((extra = {}) => ({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'All' ? statusFilter : undefined,
    ...extra,
  }), [debouncedSearch, statusFilter])

  // Debounce the search box; a new query resets to the first page.
  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [search])

  // Server-driven list: search, status filter and pagination all run on the
  // backend, so we only ever hold one page in memory.
  const loadList = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await billingApi.getAll(listParams({ page, pageSize: PAGE_SIZE }))
      setInvoices((data.invoices || []).map(normalizeInvoice))
      setTotal(data.total ?? 0)
    } catch {
      setError('Could not load invoices. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [listParams, page])

  const loadStats = useCallback(async () => {
    try {
      const { data } = await billingApi.getStats()
      setStats({
        collected: data.collected || 0,
        gstCollected: data.gstCollected || 0,
        paidCount: data.paidCount || 0,
        pendingTotal: data.pendingTotal || 0,
        pendingCount: data.pendingCount || 0,
        overdueTotal: data.overdueTotal || 0,
        overdueCount: data.overdueCount || 0,
      })
    } catch { /* non-critical; the list error banner covers outages */ }
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadStats() }, [loadStats])

  // Collecting a payment / generating an invoice shifts both the page and the
  // aggregates — reload both rather than patching a single row in place.
  const reload = useCallback(() => { loadList(); loadStats() }, [loadList, loadStats])

  const handleStatusFilter = (s) => { setStatusFilter(s); setPage(1) }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCollect = async (method) => {
    if (!collectModal) return
    const target = collectModal
    try {
      await billingApi.collect(target.id)
      addToast(`${formatCurrency(target.total)} collected via ${method || 'Cash'} for ${target.guest}`, 'success')
      setCollectModal(null)
      reload()
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

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await billingApi.delete(deleteModal.id)
      addToast(`Invoice ${deleteModal.invoiceNo} deleted`, 'success')
      setDeleteModal(null)
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not delete invoice', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleGenerate = async (payload) => {
    try {
      const { data } = await billingApi.generate(payload)
      addToast(`Invoice ${data.invoice?.invoiceNo || ''} generated`, 'success')
      setShowGenerate(false)
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not generate invoice', 'error')
    }
  }

  // Export every invoice matching the current filters (not just the visible page).
  const handleExportCSV = async () => {
    let list = []
    try {
      const { data } = await billingApi.getAll(listParams())
      list = (data.invoices || []).map(normalizeInvoice)
    } catch {
      addToast('Could not export invoices', 'error')
      return
    }
    const headers = ['Invoice No', 'Guest', 'Room', 'Period', 'Rent', 'Food', 'Amenities', 'GST', 'Total', 'Status', 'Created', 'Paid On']
    const rows = list.map(inv => [
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
    <div>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-[22px] gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-extrabold m-0 text-ink tracking-[-0.03em]">
            Billing &amp; Payments
          </h1>
          <p className="t-sm mt-[3px] mb-0 text-ink3">
            Invoice management with GST compliance
          </p>
        </div>
        {activeTab === 'invoices' && (
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={reload} disabled={loading}>↻ Refresh</button>
            <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>↓ Export CSV</button>
            <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>+ Generate Invoice</button>
          </div>
        )}
      </div>

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-[22px]">
        {/* Collected */}
        <div className="stat-card stat-bar-green">
          <p className="t-label mt-0 mx-0 mb-1">
            Collected this month
          </p>
          <p className="t-h1 m-0 text-success-text">
            {formatCurrency(stats.collected)}
          </p>
          <p className="mt-[3px] mb-0 text-[11px] text-ink3">
            {stats.paidCount} invoices paid
          </p>
        </div>

        {/* Pending */}
        <div className="stat-card stat-bar-amber">
          <p className="t-label mt-0 mx-0 mb-1">
            Pending
          </p>
          <p className="t-h1 m-0 text-warning-text">
            {formatCurrency(stats.pendingTotal)}
          </p>
          <p className="mt-[3px] mb-0 text-[11px] text-ink3">
            {stats.pendingCount} invoice{stats.pendingCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Overdue */}
        <div className="stat-card stat-bar-red">
          <p className="t-label mt-0 mx-0 mb-1">
            Overdue
          </p>
          <p className="t-h1 m-0 text-danger-text">
            {formatCurrency(stats.overdueTotal)}
          </p>
          <p className="mt-[3px] mb-0 text-[11px] text-ink3">
            {stats.overdueCount} invoice{stats.overdueCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* GST Collected */}
        <div className="stat-card stat-bar-blue">
          <p className="t-label mt-0 mx-0 mb-1">
            GST Collected
          </p>
          <p className="t-h1 m-0 text-info-text">
            {formatCurrency(stats.gstCollected)}
          </p>
          <p className="mt-[3px] mb-0 text-[11px] text-ink3">From paid invoices</p>
        </div>
      </div>

      {/* ── Tab Navigation ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { id: 'invoices',      label: 'Invoices'      },
          { id: 'ledger',        label: 'Ledger'        },
          { id: 'cash-register', label: 'Cash Register' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${TAB_CLASS_BASE} ${activeTab === tab.id ? TAB_CLASS_ACTIVE : TAB_CLASS_INACTIVE}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Invoices Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <>
          {/* Filter Row */}
          <div className="flex gap-2.5 mb-4 flex-wrap items-center">
            {/* Search */}
            <div className="relative shrink-0">
              <span className="t-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none">
                ⌕
              </span>
              <input
                className="form-input pl-7 w-[220px] text-[12px]"
                type="text"
                placeholder="Search guest or invoice..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status filter pills */}
            <div className="flex gap-1.5">
              {['All', 'Paid', 'Pending', 'Overdue'].map(s => {
                const active = statusFilter === s
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusFilter(s)}
                    className={`t-xs px-[13px] py-[5px] rounded-[20px] cursor-pointer transition-all duration-[130ms] ${active ? 'bg-[var(--gold-bg)] border border-gold text-gold' : 'bg-surface border border-line text-ink2'}`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>

            <div className="flex-1" />
            <p className="t-xs m-0 text-ink3 shrink-0">
              {total} record{total !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Payment Records Table */}
          <div className="card overflow-x-auto">
            {invoices.length === 0 ? (
              <div className="empty-state">
                <p className="m-0 font-semibold text-ink2">{loading ? 'Loading invoices…' : 'No invoices found'}</p>
                {!loading && <p className="t-xs mt-1 mx-0 mb-0">Generate an invoice or adjust your filters</p>}
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Invoice #', 'Guest', 'Room', 'Period', 'Rent', 'Food', 'Amenities', 'GST (12%)', 'Total', 'Status', 'Actions'].map(h => (
                      <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${h === 'Actions' ? 'text-center' : h === 'Rent' || h === 'Food' || h === 'Amenities' || h === 'GST (12%)' || h === 'Total' ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="transition-[background] duration-100">
                      {/* Invoice # */}
                      <td className="px-3 py-[11px]">
                        <span className="t-xs text-gold" style={{ fontFamily: 'var(--font-mono)' }}>
                          {inv.invoiceNo}
                        </span>
                      </td>

                      {/* Guest */}
                      <td className="px-3 py-[11px]">
                        <span className="t-title">
                          {inv.guest}
                        </span>
                      </td>

                      {/* Room */}
                      <td className="px-3 py-[11px]">
                        <span className="t-sm text-ink2" style={{ fontFamily: 'var(--font-mono)' }}>
                          {inv.room}
                        </span>
                      </td>

                      {/* Period */}
                      <td className="t-xs px-3 py-[11px] text-ink3 whitespace-nowrap">
                        {inv.period}
                      </td>

                      {/* Rent */}
                      <td className="px-3 py-[11px] text-right">
                        <span className="t-xs text-ink2" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(inv.rent)}
                        </span>
                      </td>

                      {/* Food */}
                      <td className="px-3 py-[11px] text-right">
                        <span className="t-xs" style={{ fontFamily: 'var(--font-mono)', color: inv.food > 0 ? 'var(--text2)' : 'var(--text3)' }}>
                          {inv.food > 0 ? formatCurrency(inv.food) : '—'}
                        </span>
                      </td>

                      {/* Amenities */}
                      <td className="px-3 py-[11px] text-right">
                        <span className="t-xs" style={{ fontFamily: 'var(--font-mono)', color: inv.amenities > 0 ? 'var(--text2)' : 'var(--text3)' }}>
                          {inv.amenities > 0 ? formatCurrency(inv.amenities) : '—'}
                        </span>
                      </td>

                      {/* GST */}
                      <td className="px-3 py-[11px] text-right">
                        <span className="t-xs text-ink2" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(inv.gstAmount)}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-[11px] text-right">
                        <span className="t-title" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(inv.total)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-[11px]">
                        <Badge type={statusBadgeType(inv.status)}>{inv.status}</Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-[11px]">
                        <div className="flex gap-[5px] justify-center flex-nowrap">
                          {/* Collect — only for pending */}
                          {inv.status === 'Pending' && (
                            <button
                              className="btn btn-xs bg-[var(--amber-bg)] text-warning-text border border-[var(--amber)] rounded px-2 py-[3px] text-[11px] cursor-pointer font-semibold whitespace-nowrap"
                              onClick={() => setCollectModal(inv)}
                            >
                              Collect
                            </button>
                          )}

                          {/* Remind — only if not paid */}
                          {inv.status !== 'Paid' && (
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={() => setRemindModal(inv)}
                            >
                              Remind
                            </button>
                          )}

                          {/* Invoice */}
                          <button
                            className="btn btn-xs bg-[var(--gold-bg)] text-gold border border-[var(--gold-border)] rounded px-2 py-[3px] text-[11px] cursor-pointer font-semibold"
                            onClick={() => setInvoiceModal(inv)}
                          >
                            Invoice
                          </button>

                          {/* Delete */}
                          <button
                            className="btn btn-danger btn-xs inline-flex items-center"
                            title="Delete invoice"
                            onClick={() => setDeleteModal(inv)}
                          >
                            <LuTrash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3 t-xs text-ink3">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-outline btn-xs" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button className="btn btn-outline btn-xs" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next →</button>
              </div>
            </div>
          )}
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
        key={remindModal?.id}
        invoice={remindModal}
        onClose={() => setRemindModal(null)}
        onSend={handleRemind}
      />

      <GenerateInvoiceModal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerate={handleGenerate}
      />

      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message={deleteModal ? <>Delete invoice <b>{deleteModal.invoiceNo}</b> for <b>{deleteModal.guest}</b> ({formatCurrency(deleteModal.total)})? It will be removed from billing, the ledger, the cash register and revenue reports. This cannot be undone.</> : null}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />
    </div>
  )
}
