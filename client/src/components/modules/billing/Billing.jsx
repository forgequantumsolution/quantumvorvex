import { useState, useEffect, useCallback } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { LuTrash2, LuReceipt, LuBell, LuWallet, LuClock, LuCircleAlert, LuPercent, LuRefreshCw, LuDownload, LuCalendarClock, LuPlus } from 'react-icons/lu'
import { PageWrapper, StatCard, Card, DataTable, FilterTabs, Pagination, EmptyState, useWhatsAppComposer, waMenuItem } from '../../ui-tw'
import ActionMenu from '../../ui-tw/ActionMenu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector } from '../../../store/hooks'
import { billingApi, guestsApi, remindersApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'
import { PaymentClaimsBanner } from './PaymentClaims'

// Flatten an API invoice (guest is a relation) to the flat shape the UI renders.
function normalizeInvoice(inv) {
  return {
    id: inv.id,
    invoiceNo: inv.invoiceNo,
    guestId: inv.guestId || inv.guest?.id,
    guest: inv.guest?.name || '—',
    phone: inv.guest?.phone || '',
    room: inv.guest?.room?.number || '—',
    period: inv.period,
    rent: inv.rent || 0,
    food: inv.food || 0,
    amenities: inv.amenities || 0,
    gstRate: inv.gstRate || 12,
    gstAmount: inv.gstAmount || 0,
    total: inv.total || 0,
    amountPaid: inv.amountPaid || 0,
    status: inv.status,
    createdAt: inv.createdAt,
    paidAt: inv.paidAt || null,
  }
}

// WhatsApp composer request for an invoice: the message plus its public link.
function invoiceMessage(inv, template, text) {
  return {
    phone: inv.phone,
    guestId: inv.guestId,
    name: `${inv.guest} · ${inv.invoiceNo}`,
    template: text ? undefined : template,
    text,
    invoiceId: inv.id,
    vars: {
      name: inv.guest, room: inv.room, invoiceNo: inv.invoiceNo, period: inv.period,
      amount: inv.total, due: Math.max(0, inv.total - inv.amountPaid),
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadgeType(status) {
  if (status === 'Paid')    return 'green'
  if (status === 'Overdue') return 'red'
  if (status === 'Pending') return 'amber'
  return 'grey'
}

// Display label for an invoice status value (the value itself stays English).
function useStatusLabel() {
  const { t } = useTranslation('billing')
  return (status) => t(`status.${status}`, { defaultValue: status })
}

function cashTypeBadge(type, t) {
  if (type === 'collection') return { bg: 'var(--green-bg)',  color: 'var(--green-text)',  label: t('cash.type.collection') }
  if (type === 'advance')    return { bg: 'var(--blue-bg)',   color: 'var(--blue-text)',   label: t('cash.type.advance')    }
  if (type === 'refund')     return { bg: 'var(--red-bg)',    color: 'var(--red-text)',    label: t('cash.type.refund')     }
  return { bg: 'var(--surface2)', color: 'var(--text2)', label: type }
}

// ─── Invoice Print Modal ──────────────────────────────────────────────────────
function InvoiceModal({ invoice, onClose }) {
  const { t } = useTranslation('billing')
  const statusLabel = useStatusLabel()
  // Header details and logo of the active property, as set in Settings.
  const [hotel, setHotel] = useState(null)
  const isOpen = !!invoice
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    billingApi.getLetterhead()
      .then(({ data }) => { if (!cancelled) setHotel(data.hotel) })
      .catch(() => { if (!cancelled) setHotel(null) })
    return () => { cancelled = true }
  }, [isOpen])

  if (!invoice) return null
  // Rent is GST-inclusive, so its taxable (base) value is rent ÷ (1 + GST%); food &
  // amenities are exclusive, so they're already net. Taxable + CGST + SGST = total.
  const taxable = invoice.rent / (1 + (invoice.gstRate || 0) / 100) + invoice.food + invoice.amenities
  const halfGst = invoice.gstAmount / 2

  return (
    <Modal
      isOpen={!!invoice}
      onClose={onClose}
      title={t('invoice.title', { no: invoice.invoiceNo })}
      size="lg"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common:close')}</button>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('invoice.print')}</button>
        </>
      }
    >
      <div>
        {/* Hotel header */}
        <div className="text-center border-b-2 border-line pb-4 mb-5">
          {hotel?.logoUrl && (
            <img src={hotel.logoUrl} alt="" className="h-14 max-w-[140px] object-contain mx-auto mb-2" />
          )}
          <p className="t-h1 m-0 text-gold tracking-[-0.02em]">
            {hotel?.name}
          </p>
          <p className="mt-0.5 mb-0 text-xs text-ink3 break-words">
            {[hotel?.address, hotel?.phone, hotel?.email, hotel?.gstin && `GSTIN: ${hotel.gstin}`].filter(Boolean).join(' · ')}
          </p>
          <p className="t-title mt-3 mb-0 tracking-[0.12em] uppercase">
            {t('invoice.taxInvoice')}
          </p>
        </div>

        {/* Invoice meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 mb-5">
          {[
            ['invoiceNo', t('invoice.invoiceNo'), invoice.invoiceNo],
            ['date',      t('common:date'),       formatDate(invoice.createdAt)],
            ['guest',     t('common:guest'),      invoice.guest],
            ['room',      t('common:room'),       invoice.room],
            ['period',    t('invoice.period'),    invoice.period],
          ].map(([id, label, val]) => (
            <div key={id} className={`min-w-0 bg-surface2 border border-line rounded-md px-3 py-2 ${id === 'guest' ? 'col-span-2 sm:col-span-1' : ''}`}>
              <p className="t-label m-0">
                {label}
              </p>
              <p className={`t-title mt-[3px] mb-0 break-words ${id === 'invoiceNo' || id === 'room' ? 'font-mono' : ''}`}>
                {val}
              </p>
            </div>
          ))}
        </div>

        {/* Line items */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="bg-surface2">
              <th className="t-label text-left px-3 py-2">{t('invoice.description')}</th>
              <th className="t-label text-right px-3 py-2">{t('common:amount')}</th>
            </tr>
          </thead>
          <tbody>
            {[
              [t('invoice.roomRent'),  invoice.rent],
              invoice.food       > 0 ? [t('invoice.foodPlan'),  invoice.food]       : null,
              invoice.amenities  > 0 ? [t('invoice.amenities'), invoice.amenities]  : null,
            ].filter(Boolean).map(([desc, amt]) => (
              <tr key={desc} className="border-b border-line">
                <td className="t-sm px-3 py-[9px]">{desc}</td>
                <td className="t-sm px-3 py-[9px] text-right font-mono">
                  {formatCurrency(amt)}
                </td>
              </tr>
            ))}

            {/* Taxable value (rent is GST-inclusive, so its base is shown net of tax) */}
            <tr className="border-b border-line bg-surface2">
              <td className="t-title px-3 py-[9px] text-ink2">{t('invoice.taxableValue')}</td>
              <td className="t-title px-3 py-[9px] text-right text-ink2 font-mono">
                {formatCurrency(taxable)}
              </td>
            </tr>

            {/* CGST */}
            <tr className="border-b border-line">
              <td className="t-sm px-3 py-[9px] text-ink3">
                CGST ({invoice.gstRate / 2}%)
              </td>
              <td className="t-sm px-3 py-[9px] text-right text-ink3 font-mono">
                {formatCurrency(halfGst)}
              </td>
            </tr>

            {/* SGST */}
            <tr className="border-b-2 border-line">
              <td className="t-sm px-3 py-[9px] text-ink3">
                SGST ({invoice.gstRate / 2}%)
              </td>
              <td className="t-sm px-3 py-[9px] text-right text-ink3 font-mono">
                {formatCurrency(halfGst)}
              </td>
            </tr>

            {/* Grand Total */}
            <tr className="bg-[var(--gold-bg)]">
              <td className="t-title px-3 py-[11px] text-gold">
                {t('invoice.grandTotal')}
              </td>
              <td className="t-h3 px-3 py-[11px] text-right text-gold font-mono">
                {formatCurrency(invoice.total)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payment status */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 sm:px-[14px] py-2.5 bg-surface2 rounded-md border border-line mb-4">
          <span className="t-xs text-ink3">{t('invoice.paymentStatus')}</span>
          <Badge type={statusBadgeType(invoice.status)}>{statusLabel(invoice.status)}</Badge>
          {invoice.paidAt && (
            <span className="t-xs text-ink3">
              · {t('invoice.paidOn', { date: formatDate(invoice.paidAt) })}
            </span>
          )}
        </div>

        {/* Footer */}
        <p className="m-0 text-center text-xs text-ink3 pt-3 border-t border-line">
          {t('invoice.poweredBy')}
        </p>
      </div>
    </Modal>
  )
}

// ─── Collect Payment Confirmation ─────────────────────────────────────────────
const PAY_METHODS = [
  { id: 'Cash', key: 'collect.method.cash' },
  { id: 'UPI', key: 'collect.method.upi' },
  { id: 'Card', key: 'collect.method.card' },
  { id: 'Bank Transfer', key: 'collect.method.bank' },
]

function CollectModal({ invoice, onClose, onConfirm }) {
  const { t } = useTranslation('billing')
  const [method, setMethod] = useState('Cash')
  const [ref, setRef]       = useState('')
  if (!invoice) return null
  return (
    <Modal
      isOpen={!!invoice}
      onClose={onClose}
      title={t('collect.title')}
      maxWidth="420px"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common:cancel')}</button>
          <button className="btn btn-success" onClick={() => onConfirm(method)}>{t('collect.confirm')}</button>
        </>
      }
    >
      {/* Amount highlight */}
      <div className="bg-[var(--gold-bg)] rounded-lg px-[14px] py-3 mb-4 flex justify-between items-center gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-gold uppercase tracking-[0.08em] mb-0.5">{t('collect.amountDue')}</div>
          <div className="t-h1 text-gold font-mono">{formatCurrency(invoice.total)}</div>
        </div>
        <div className="t-xs text-right text-ink3 min-w-0 break-words">
          <div>{invoice.guest}</div>
          <div>{t('roomNo', { room: invoice.room })}</div>
          <div>{invoice.invoiceNo}</div>
        </div>
      </div>

      {/* Payment method */}
      <div className="mb-3">
        <label className="form-label block mb-[5px]">{t('collect.paymentMethod')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PAY_METHODS.map(m => (
            <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`t-xs px-1.5 py-2 min-h-10 pointer-coarse:min-h-11 rounded-[7px] cursor-pointer text-center transition-all duration-150 ${method === m.id ? 'bg-[var(--gold-bg)] border-[1.5px] border-gold text-gold' : 'bg-surface2 border border-line text-ink2'}`}>{t(m.key)}</button>
          ))}
        </div>
      </div>

      {/* Reference */}
      <div>
        <label className="form-label block mb-[5px]">{t('collect.reference')}</label>
        <input className="form-input" placeholder={t('collect.referencePlaceholder')} value={ref} onChange={e => setRef(e.target.value)} />
      </div>
    </Modal>
  )
}

// ─── Remind Modal ─────────────────────────────────────────────────────────────
function RemindModal({ invoice, onClose, onSend }) {
  const { t } = useTranslation('billing')
  const [channel, setChannel] = useState('WhatsApp')
  // Pre-filled from the invoice. The parent keys this modal by invoice id, so it
  // remounts per invoice and this initializer re-runs with the right values.
  const [message, setMessage] = useState(() =>
    invoice
      ? t('remind.defaultMessage', { guest: invoice.guest, amount: formatCurrency(invoice.total), room: invoice.room })
      : ''
  )

  if (!invoice) return null

  // Values sent to the server stay English; only Email has a translated label.
  const CHANNELS = [
    { id: 'WhatsApp', label: 'WhatsApp' },
    { id: 'SMS', label: 'SMS' },
    { id: 'Email', label: t('common:email') },
  ]

  return (
    <Modal
      isOpen={!!invoice}
      onClose={onClose}
      title={t('remind.title')}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common:cancel')}</button>
          <button className="btn btn-primary" onClick={() => onSend(channel, message)}>
            {t('remind.send')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Recipient */}
        <div>
          <label className="form-label block mb-[5px]">{t('remind.recipient')}</label>
          <input
            className="form-input w-full"
            value={invoice.guest}
            readOnly
          />
        </div>

        {/* Channel toggle */}
        <div>
          <label className="form-label block mb-2">{t('remind.channel')}</label>
          <div className="flex gap-2">
            {CHANNELS.map(ch => (
              <button
                key={ch.id}
                type="button"
                className={`food-opt flex-1 min-w-0 text-center pointer-coarse:min-h-11${channel === ch.id ? ' sel' : ''}`}
                onClick={() => setChannel(ch.id)}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="form-label block mb-[5px]">{t('remind.message')}</label>
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
  const { t } = useTranslation('billing')
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

  // Rent is GST-inclusive (tax extracted); food & amenities are GST-exclusive (added on top).
  const r = parseFloat(form.rent) || 0, f = parseFloat(form.food) || 0, a = parseFloat(form.amenities) || 0
  const entered     = r + f + a
  const taxable     = r / (1 + form.gstRate / 100) + f + a
  const gstAmount   = Math.round((r - r / (1 + form.gstRate / 100)) + (f + a) * (form.gstRate / 100))
  const total       = r + f + a + (f + a) * (form.gstRate / 100)

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
      title={t('generate.title')}
      footer={
        <>
          <button className="btn btn-outline" onClick={() => { onClose(); setForm(EMPTY) }}>{t('common:cancel')}</button>
          <button className="btn btn-primary" onClick={handleGenerate}>{t('generate.submit')}</button>
        </>
      }
    >
      <div className="flex flex-col gap-[14px]">
        {/* Guest */}
        <div>
          <label className="form-label block mb-[5px]">{t('common:guest')}</label>
          <select
            className="form-select w-full"
            value={form.guestId}
            onChange={e => setForm(p => ({ ...p, guestId: e.target.value }))}
          >
            {guests.length === 0
              ? <option value="">{t('generate.noGuests')}</option>
              : guests.map(g => <option key={g.id} value={g.id}>{g.name} · {g.docId}</option>)}
          </select>
        </div>

        {/* Period */}
        <div>
          <label className="form-label block mb-[5px]">{t('invoice.period')}</label>
          <input
            className="form-input w-full"
            placeholder={t('generate.periodPlaceholder')}
            value={form.period}
            onChange={e => setForm(p => ({ ...p, period: e.target.value }))}
          />
        </div>

        {/* Amount fields */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
          {[
            [`${t('col.rent')} ₹`,      'rent'],
            [`${t('col.food')} ₹`,      'food'],
            [`${t('col.amenities')} ₹`, 'amenities'],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="form-label block mb-[5px]">{label}</label>
              <input
                className="form-input w-full"
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
          <label className="form-label block mb-[5px]">{t('generate.gstRate')}</label>
          <select
            className="form-select w-full"
            value={form.gstRate}
            onChange={e => setForm(p => ({ ...p, gstRate: parseInt(e.target.value) }))}
          >
            {[5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>

        {/* Calculated total */}
        {entered > 0 && (
          <div className="bg-[var(--gold-bg)] border border-[var(--gold-border)] rounded-md px-[14px] py-3">
            <div className="flex flex-col gap-[5px]">
              {[
                ['taxable', t('invoice.taxableValue'), taxable],
                ['gst',     `GST (${form.gstRate}%)`,  gstAmount],
              ].map(([id, label, val]) => (
                <div key={id} className="t-xs flex justify-between">
                  <span>{label}</span>
                  <span className="font-mono">{formatCurrency(val)}</span>
                </div>
              ))}
              <div className="t-title flex justify-between text-gold border-t border-[var(--gold-border)] pt-1.5 mt-0.5">
                <span>{t('common:total')}</span>
                <span className="font-mono">{formatCurrency(total)}</span>
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
  const { t } = useTranslation('billing')
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
      addToast(t('ledger.loadFailed'), 'error'); setLedgerRows([])
    } finally {
      setLoading(false)
    }
  }, [selectedGuestId, addToast, t])
  useEffect(() => { loadLedger() }, [loadLedger])

  const filteredGuests = guests.filter(g =>
    g.name.toLowerCase().includes(guestSearch.toLowerCase())
  )

  const ledgerColumns = [
    { key: 'date', header: t('common:date'), render: (row) => <span className="t-xs text-ink3 font-mono">{row.date}</span> },
    {
      key: 'type', header: t('col.type'),
      render: (row) => (
        <span className={`t-xs font-mono ${row.type === 'Credit' ? 'text-success-text' : 'text-danger-text'}`}>{t(`ledger.entryType.${row.type}`, { defaultValue: row.type })}</span>
      ),
    },
    { key: 'desc', header: t('invoice.description'), primary: true, className: 'whitespace-normal min-w-[180px]', render: (row) => <span className="t-sm">{row.desc}</span> },
    { key: 'amount', header: `${t('common:amount')} ₹`, align: 'right', render: (row) => <span className="t-sm text-ink2 font-mono">{formatCurrency(row.amount)}</span> },
    {
      key: 'balance', header: `${t('ledger.runningBalance')} ₹`, mobileLabel: t('ledger.balance'), align: 'right', primary: true,
      render: (row) => (
        <span className={`t-title font-mono ${row.balance >= 0 ? 'text-success-text' : 'text-danger-text'}`}>
          {row.balance >= 0 ? '+' : ''}{formatCurrency(row.balance)}
        </span>
      ),
    },
  ]

  return (
    <div>
      {/* Guest selector */}
      <div className="mb-4 sm:mb-5 w-full sm:max-w-[340px] relative">
        <label className="form-label block mb-1.5">{t('ledger.selectGuest')}</label>
        <input
          className="form-input w-full"
          placeholder={t('ledger.searchGuest')}
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
                className="t-sm px-[14px] py-[9px] pointer-coarse:py-3 cursor-pointer border-b border-line last:border-b-0 transition-[background] duration-100 hover:bg-surface2 active:bg-surface2"
              >
                {g.name}{g.room?.number ? ` · ${t('roomNo', { room: g.room.number })}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger table */}
      {selectedGuestId && (
        <>
          {loading ? (
            <EmptyState icon="◌" title={t('ledger.loading')} />
          ) : ledgerRows.length === 0 ? (
            <EmptyState icon="₹" title={t('ledger.noEntries', { guest: selectedGuest })} />
          ) : (
            <>
              <div className="border border-line rounded-xl overflow-hidden mb-[14px]">
                <DataTable columns={ledgerColumns} rows={ledgerRows} rowKey={(row) => ledgerRows.indexOf(row)} />
              </div>

              {/* Closing balance */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-surface2 border border-line rounded-md px-4 py-3 mb-4">
                <span className="t-title text-ink2 min-w-0">
                  {t('ledger.closingBalanceFor', { guest: selectedGuest })}
                </span>
                <span className={`t-h3 font-mono ${closingBalance >= 0 ? 'text-success-text' : 'text-danger-text'}`}>
                  {closingBalance >= 0 ? '+' : ''}{formatCurrency(closingBalance)}
                </span>
              </div>

              <button className="btn btn-outline w-full sm:w-auto justify-center" onClick={() => window.print()}>
                {t('ledger.print')}
              </button>
            </>
          )}
        </>
      )}

      {!selectedGuest && (
        <EmptyState icon="☰" title={t('ledger.noGuestTitle')} message={t('ledger.noGuestMessage')} />
      )}
    </div>
  )
}

// ─── Cash Register Tab ────────────────────────────────────────────────────────
function CashRegisterTab() {
  const { t } = useTranslation('billing')
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
      addToast(t('cash.loadFailed'), 'error'); setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [date, addToast, t])
  useEffect(() => { loadCashRegister() }, [loadCashRegister])

  const totalIn  = transactions.reduce((s, txn) => s + txn.cashIn,  0)
  const totalOut = transactions.reduce((s, txn) => s + txn.cashOut, 0)
  const closing  = openingBalance + totalIn - totalOut

  const handleExportCSV = () => {
    const header = 'Time,Type,Description,Cash In,Cash Out'
    const rows   = transactions.map(txn =>
      `${txn.time},${txn.type},"${txn.desc}",${txn.cashIn},${txn.cashOut}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cash-register-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
    addToast(t('cash.exported'), 'success')
  }

  const cashColumns = [
    { key: 'time', header: t('cash.time'), render: (txn) => <span className="t-xs text-ink3 font-mono">{txn.time}</span> },
    {
      key: 'type', header: t('col.type'),
      render: (txn) => {
        const badge = cashTypeBadge(txn.type, t)
        return (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold capitalize" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        )
      },
    },
    { key: 'desc', header: t('invoice.description'), primary: true, className: 'whitespace-normal min-w-[180px]', render: (txn) => <span className="t-sm">{txn.desc}</span> },
    {
      key: 'cashIn', header: `${t('cash.cashIn')} ₹`, align: 'right',
      render: (txn) => txn.cashIn > 0
        ? <span className="t-sm font-mono font-semibold text-success-text">{formatCurrency(txn.cashIn)}</span>
        : <span className="t-sm text-ink3">—</span>,
    },
    {
      key: 'cashOut', header: `${t('cash.cashOut')} ₹`, align: 'right',
      render: (txn) => txn.cashOut > 0
        ? <span className="t-sm font-mono font-semibold text-danger-text">{formatCurrency(txn.cashOut)}</span>
        : <span className="t-sm text-ink3">—</span>,
    },
  ]

  return (
    <div>
      {/* Controls row */}
      <div className="grid grid-cols-2 sm:flex gap-3 sm:gap-4 sm:flex-wrap items-end mb-4 sm:mb-5">
        <div className="min-w-0">
          <label className="form-label block mb-[5px]">{t('common:date')}</label>
          <input
            className="form-input w-full sm:w-[180px]"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <label className="form-label block mb-[5px]">{t('cash.openingBalance')} ₹</label>
          <input
            className="form-input w-full sm:w-40 font-mono"
            type="number"
            min="0"
            value={openingBalance}
            onChange={e => setOpening(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Transactions table */}
      <div className="border border-line rounded-xl overflow-hidden mb-[14px]">
        {loading || transactions.length === 0 ? (
          <div className="t-sm px-[14px] py-6 text-center text-ink3">
            {loading ? t('common:loading') : t('cash.empty')}
          </div>
        ) : (
          <DataTable columns={cashColumns} rows={transactions} rowKey={(txn) => transactions.indexOf(txn)} />
        )}

        {/* Totals row */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t-2 border-line bg-surface2 px-4 lg:px-5 py-[11px]">
          <span className="t-title text-ink2">{t('cash.totals')}</span>
          <div className="flex items-center gap-4 sm:gap-8">
            <span className="t-title font-mono text-success-text"><span className="sm:hidden t-xs text-ink3 font-sans font-normal mr-1">{t('cash.in')}</span>{formatCurrency(totalIn)}</span>
            <span className="t-title font-mono text-danger-text"><span className="sm:hidden t-xs text-ink3 font-sans font-normal mr-1">{t('cash.out')}</span>{formatCurrency(totalOut)}</span>
          </div>
        </div>
      </div>

      {/* Closing balance summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-[18px]">
        {[
          { id: 'opening', label: t('cash.openingBalance'), value: formatCurrency(openingBalance), color: 'var(--text2)' },
          { id: 'in',      label: t('cash.totalIn'),        value: formatCurrency(totalIn),        color: 'var(--green-text)' },
          { id: 'out',     label: t('cash.totalOut'),       value: formatCurrency(totalOut),       color: 'var(--red-text)'   },
          { id: 'closing', label: t('cash.closingBalance'), value: formatCurrency(closing),        color: closing >= 0 ? 'var(--green-text)' : 'var(--red-text)', bold: true },
        ].map(item => (
          <div key={item.id} className="min-w-0 bg-surface2 border border-line rounded-md px-3 sm:px-[14px] py-2.5">
            <p className="t-label m-0">
              {item.label}
            </p>
            <p className="t-h3 mt-1 mb-0 font-mono truncate" style={{ color: item.color }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2.5">
        <button className="btn btn-outline flex-1 sm:flex-none justify-center" onClick={() => window.print()}>
          {t('cash.print')}
        </button>
        <button className="btn btn-primary flex-1 sm:flex-none justify-center" onClick={handleExportCSV}>
          {t('common:exportCsv')}
        </button>
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const BILLING_TABS = [
  { id: 'invoices',      labelKey: 'tabs.invoices'     },
  { id: 'ledger',        labelKey: 'tabs.ledger'       },
  { id: 'cash-register', labelKey: 'tabs.cashRegister' },
]
const STATUS_FILTERS = [
  { id: 'All',     labelKey: 'common:all'     },
  { id: 'Paid',    labelKey: 'common:paid'    },
  { id: 'Pending', labelKey: 'common:pending' },
  { id: 'Overdue', labelKey: 'common:overdue' },
]

// ─── Main Component ───────────────────────────────────────────────────────────
const PAGE_SIZE = 20

export default function Billing() {
  const { t } = useTranslation('billing')
  const statusLabel = useStatusLabel()
  const addToast = useToast()

  const [activeTab, setActiveTab]           = useState('invoices')
  const [invoices, setInvoices]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [search, setSearch]                 = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // Another page can open Billing on a status (e.g. Portfolio's Collected → Paid).
  const navStatus = useAppSelector((s) => s.ui.activePanelParams?.status)
  const [statusFilter, setStatusFilter]     = useState(() => (['Paid', 'Pending', 'Overdue'].includes(navStatus) ? navStatus : 'All'))
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
  const wa = useWhatsAppComposer()
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
      setError(t('errors.loadInvoices'))
    } finally {
      setLoading(false)
    }
  }, [listParams, page, t])

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

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCollect = async (method) => {
    if (!collectModal) return
    const target = collectModal
    try {
      await billingApi.collect(target.id)
      const m = PAY_METHODS.find(p => p.id === (method || 'Cash'))
      addToast(t('toast.collected', { amount: formatCurrency(target.total), method: m ? t(m.key) : method, guest: target.guest }), 'success')
      setCollectModal(null)
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.collectFailed'), 'error')
    }
  }

  const handleRemind = async (channel, message) => {
    if (!remindModal) return
    // WhatsApp goes through the composer (number + message, opens wa.me); the
    // composer records the reminder itself once it's opened.
    if (channel === 'WhatsApp') {
      wa.open(invoiceMessage(remindModal, null, message))
      setRemindModal(null)
      return
    }
    try {
      if (remindModal.guestId) {
        await remindersApi.send({ guestId: remindModal.guestId, channel, message })
      }
      addToast(t('toast.reminderSent', { channel: channel === 'Email' ? t('common:email') : channel }), 'success')
      setRemindModal(null)
    } catch (err) {
      addToast(err.response?.data?.error || t('toast.reminderFailed'), 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await billingApi.delete(deleteModal.id)
      addToast(t('toast.deleted', { no: deleteModal.invoiceNo }), 'success')
      setDeleteModal(null)
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.deleteFailed'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const [billingRent, setBillingRent] = useState(false)
  const handleBillPgRent = async () => {
    setBillingRent(true)
    try {
      const { data } = await billingApi.billPgRent()
      addToast(data.created
        ? t('toast.pgRentCreated', { count: data.created })
        : t('toast.pgRentUpToDate'), 'success')
      if (data.created) reload()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.pgRentFailed'), 'danger')
    } finally {
      setBillingRent(false)
    }
  }

  const handleGenerate = async (payload) => {
    try {
      const { data } = await billingApi.generate(payload)
      addToast(t('toast.generated', { no: data.invoice?.invoiceNo || '' }), 'success')
      setShowGenerate(false)
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.generateFailed'), 'error')
    }
  }

  // Export every invoice matching the current filters (not just the visible page).
  const handleExportCSV = async () => {
    let list = []
    try {
      const { data } = await billingApi.getAll(listParams())
      list = (data.invoices || []).map(normalizeInvoice)
    } catch {
      addToast(t('toast.exportFailed'), 'error')
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
    addToast(t('toast.exported'), 'success')
  }

  // ── Invoice columns (table from xl up, stacked cards below) ────────────────
  const money = (v) => <span className="t-xs text-ink2 font-mono">{formatCurrency(v)}</span>
  const optionalMoney = (v) => (
    <span className={`t-xs font-mono ${v > 0 ? 'text-ink2' : 'text-ink3'}`}>{v > 0 ? formatCurrency(v) : '—'}</span>
  )
  const invoiceColumns = [
    {
      key: 'guest', header: t('common:guest'), primary: true, className: 'max-w-[200px]',
      render: (inv) => (
        <div className="min-w-0">
          <div className="t-title truncate">{inv.guest}</div>
          <div className="t-xs text-gold font-mono mt-0.5">{inv.invoiceNo}</div>
        </div>
      ),
    },
    { key: 'room', header: t('common:room'), render: (inv) => <span className="t-sm text-ink2 font-mono">{inv.room}</span> },
    { key: 'period', header: t('invoice.period'), className: 'whitespace-normal', render: (inv) => <span className="t-xs text-ink3">{inv.period}</span> },
    { key: 'rent', header: t('col.rent'), align: 'right', hideOnMobile: true, render: (inv) => money(inv.rent) },
    { key: 'food', header: t('col.food'), align: 'right', hideOnMobile: true, render: (inv) => optionalMoney(inv.food) },
    { key: 'amenities', header: t('col.amenities'), align: 'right', hideOnMobile: true, render: (inv) => optionalMoney(inv.amenities) },
    { key: 'gst', header: 'GST', align: 'right', hideOnMobile: true, render: (inv) => money(inv.gstAmount) },
    {
      // Cards only (the table, xl+, has a column per charge): one compact breakdown
      key: 'charges', header: t('col.charges'), mobileOnly: true,
      render: (inv) => (
        <span className="block font-mono text-xs text-ink2 leading-relaxed">
          {t('col.rent')} {formatCurrency(inv.rent)}
          {inv.food > 0 && <> · {t('col.food')} {formatCurrency(inv.food)}</>}
          {inv.amenities > 0 && <> · {t('col.amenities')} {formatCurrency(inv.amenities)}</>}
          {' '}· GST {formatCurrency(inv.gstAmount)}
        </span>
      ),
    },
    {
      key: 'total', header: t('common:total'), align: 'right', primary: true,
      render: (inv) => (
        <div className="text-right">
          <div className="t-title font-mono">{formatCurrency(inv.total)}</div>
          {/* Cards: the status rides under the total on the card's title line */}
          <div className="xl:hidden mt-1"><Badge type={statusBadgeType(inv.status)}>{statusLabel(inv.status)}</Badge></div>
        </div>
      ),
    },
    { key: 'status', header: t('common:status'), hideOnMobile: true, render: (inv) => <Badge type={statusBadgeType(inv.status)}>{statusLabel(inv.status)}</Badge> },
    {
      key: 'actions', header: '', align: 'right',
      render: (inv) => (
        <div className="flex items-center justify-end gap-1.5">
          {/* Collect is the next step for a pending bill; otherwise the invoice itself */}
          {inv.status === 'Pending' ? (
            <button className="btn btn-sm bg-[var(--amber-bg)] text-warning-text border border-[var(--amber)] font-semibold" onClick={() => setCollectModal(inv)}>
              {t('actions.collect')}
            </button>
          ) : (
            <button className="btn btn-sm bg-[var(--gold-bg)] text-gold border border-[var(--gold-border)] font-semibold" onClick={() => setInvoiceModal(inv)}>
              {t('actions.invoice')}
            </button>
          )}
          <ActionMenu
            items={[
              inv.status === 'Pending' && { label: t('actions.viewInvoice'), icon: <LuReceipt size={14} />, onClick: () => setInvoiceModal(inv) },
              waMenuItem(t('whatsapp:actions.invoice'), inv.phone, () => wa.open(invoiceMessage(inv, 'invoice'))),
              ['Pending', 'Overdue'].includes(inv.status) && waMenuItem(t('whatsapp:actions.invoiceReminder'), inv.phone, () => wa.open(invoiceMessage(inv, 'invoiceReminder'))),
              inv.status !== 'Paid' && { label: t('actions.sendReminder'), icon: <LuBell size={14} />, onClick: () => setRemindModal(inv) },
              { label: t('actions.deleteInvoice'), icon: <LuTrash2 size={14} />, danger: true, onClick: () => setDeleteModal(inv) },
            ]}
          />
        </div>
      ),
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      // Search and buttons belong to the Invoices tab; Ledger and Cash Register
      // keep their own controls inside the tab.
      search={activeTab === 'invoices' ? { value: search, onChange: setSearch, placeholder: t('searchPlaceholder') } : null}
      headerActions={activeTab === 'invoices' ? [
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: reload },
        { id: 'export', label: t('common:exportCsv'), icon: <LuDownload />, onClick: handleExportCSV },
        // PG rent is billed automatically each day; this runs it now.
        { id: 'pg-rent', label: billingRent ? t('actions.billing') : t('actions.billPgRent'), icon: <LuCalendarClock />, disabled: billingRent, onClick: handleBillPgRent },
        { id: 'generate', label: t('actions.generateInvoice'), icon: <LuPlus />, variant: 'primary', onClick: () => setShowGenerate(true) },
      ] : []}
      stats={
        <>
          {/* Each card filters the Invoices list to the invoices it counts.
              GST collected also filters to Paid, but only Collected shows as selected. */}
          {[
            { id: 'collected', filter: 'Paid', icon: <LuWallet />, tone: 'green', label: t('stats.collected'), value: formatCurrency(stats.collected), hint: t('stats.invoicesPaid', { count: stats.paidCount }) },
            { id: 'pending', filter: 'Pending', icon: <LuClock />, tone: 'amber', label: t('common:pending'), value: formatCurrency(stats.pendingTotal), hint: t('stats.invoices', { count: stats.pendingCount }) },
            { id: 'overdue', filter: 'Overdue', icon: <LuCircleAlert />, tone: 'red', label: t('common:overdue'), value: formatCurrency(stats.overdueTotal), hint: t('stats.invoices', { count: stats.overdueCount }) },
            { id: 'gst', filter: 'Paid', icon: <LuPercent />, tone: 'blue', label: t('stats.gstCollected'), value: formatCurrency(stats.gstCollected), hint: t('stats.fromPaid') },
          ].map(({ id, filter, ...k }) => {
            const selected = activeTab === 'invoices' && statusFilter === filter && id !== 'gst'
            return (
              <StatCard key={id} {...k} selected={selected} onClick={() => {
                setActiveTab('invoices')
                // Clicking the selected card again goes back to every invoice.
                handleStatusFilter(selected ? 'All' : filter)
              }} />
            )
          })}
        </>
      }
      toolbar={<FilterTabs tabs={BILLING_TABS.map(tab => ({ id: tab.id, label: t(tab.labelKey) }))} active={activeTab} onChange={setActiveTab} wrap={false} />}
    >
      {/* UPI payments guests reported from the pay page, waiting for staff */}
      <PaymentClaimsBanner onConfirmed={reload} />

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* ── Invoices Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <Card>
          {/* Status pills (they scroll sideways on phones) + record count */}
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-line">
            <div className="min-w-0 max-w-full">
              <FilterTabs
                wrap={false}
                tabs={STATUS_FILTERS.map(s => ({ id: s.id, label: t(s.labelKey) }))}
                active={statusFilter}
                onChange={handleStatusFilter}
              />
            </div>
            <p className="t-xs m-0 text-ink3 shrink-0 ml-auto">
              {t('records', { count: total })}
            </p>
          </div>

          {/* Payment Records */}
          <DataTable
            columns={invoiceColumns}
            rows={invoices}
            tableFrom="xl"
            empty={
              <EmptyState
                icon="₹"
                title={loading ? t('empty.loading') : t('empty.title')}
                message={loading ? undefined : t('empty.message')}
              />
            }
          />

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} disabled={loading} onChange={setPage} />
        </Card>
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
        title={t('delete.title')}
        message={deleteModal ? (
          <Trans
            t={t}
            i18nKey="delete.message"
            values={{ no: deleteModal.invoiceNo, guest: deleteModal.guest, amount: formatCurrency(deleteModal.total) }}
            components={{ b: <b /> }}
          />
        ) : null}
        confirmLabel={t('common:delete')}
        danger
        busy={deleting}
      />
      {wa.composer}
    </PageWrapper>
  )
}
