import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuPrinter, LuFileX, LuCopy, LuCheck, LuSmartphone, LuCircleCheck, LuClock, LuFileText, LuDownload } from 'react-icons/lu'
import { QRCodeSVG } from 'qrcode.react'
import Badge from '../../ui/Badge'
import api, { payApi, publicApi } from '../../../api/client'
import { LANGUAGES, LANG_KEY } from '../../../i18n'
import { formatCurrency, formatDate } from '../../../utils/format'

// Standalone, no-login pay page reached from the link sent to a guest on
// WhatsApp:  /invoice?t=<billing invoice token>  or  /invoice?b=<booking token>
// Mobile-first; renders outside the authenticated app shell.
//   1. amount due (or Paid ✅)
//   2. pay card: the property's QR (uploaded image, else made from its UPI ID),
//      UPI ID + copy, a button opening the phone's UPI app with the amount
//   3. "I've paid" → UTR form → staff confirm it in Billing
//   4. the invoice (?t= rendered here; ?b= opens the server's tax invoice / PDF)

function getLink() {
  if (typeof window === 'undefined') return { kind: null, token: '' }
  const q = new URLSearchParams(window.location.search)
  if (q.get('t')) return { kind: 'i', token: q.get('t') }
  if (q.get('b')) return { kind: 'b', token: q.get('b') }
  return { kind: null, token: '' }
}

function statusBadgeType(status) {
  if (status === 'Paid')    return 'green'
  if (status === 'Overdue') return 'red'
  if (status === 'Pending') return 'amber'
  return 'grey'
}

// A guest has no saved app language: follow the phone's language when we have it.
function useBrowserLanguage(i18n) {
  useEffect(() => {
    let saved = null
    try { saved = localStorage.getItem(LANG_KEY) } catch { /* private mode */ }
    if (saved) return
    const code = (navigator.language || '').slice(0, 2).toLowerCase()
    if (code !== i18n.language && LANGUAGES.some((l) => l.code === code)) i18n.changeLanguage(code)
  }, [i18n])
}

// Server paths (/api/v1/…) resolve against the API's origin when it is elsewhere.
function apiHref(path) {
  const base = api.defaults.baseURL || ''
  return /^https?:/.test(base) && path.startsWith('/') ? `${new URL(base).origin}${path}` : path
}

// The old server-rendered booking invoice: used when the pay endpoint is unavailable.
function forwardBookingInvoice(token) {
  window.location.replace(`${api.defaults.baseURL}/public/booking-invoice/${encodeURIComponent(token)}`)
}

function upiUri(upi, amount, invoiceNo) {
  return `upi://pay?${new URLSearchParams({
    pa: upi.id, pn: (upi.name || '').slice(0, 50), am: Number(amount).toFixed(2), cu: 'INR', tn: `Invoice ${invoiceNo || ''}`.trim().slice(0, 80),
  })}`.replace(/%40/g, '@') // some UPI apps don't decode %40
}

export default function PublicInvoice() {
  const { t, i18n } = useTranslation('publicInvoice')
  useBrowserLanguage(i18n)
  const [{ kind, token }] = useState(getLink)
  const [pay, setPay]         = useState(null) // GET /public/pay payload
  const [invoice, setInvoice] = useState(null) // { invoice, hotel } for ?t=
  const [loading, setLoading] = useState(() => !!token)
  const [failed, setFailed]   = useState(() => !token)

  useEffect(() => {
    if (!token) return
    let active = true
    ;(async () => {
      const [p, inv] = await Promise.allSettled([
        payApi.get(kind, token),
        kind === 'i' ? publicApi.invoice(token) : Promise.resolve(null),
      ])
      if (!active) return
      const payData = p.status === 'fulfilled' ? p.value.data : null
      const invData = inv.status === 'fulfilled' ? inv.value?.data : null
      if (kind === 'b' && !payData) { forwardBookingInvoice(token); return }
      if (payData?.kind || payData?.invoiceNo != null) setPay(payData)
      if (invData?.invoice) setInvoice(invData)
      if (!payData && !invData?.invoice) setFailed(true)
      setLoading(false)
    })()
    return () => { active = false }
  }, [kind, token])

  // No pay endpoint (older server): build the pay card from the invoice itself.
  const view = pay || (invoice && fromInvoice(invoice))
  const hotelName = view?.hotel?.name || invoice?.hotel?.name

  useEffect(() => {
    if (view?.invoiceNo) document.title = `${t('title', { no: view.invoiceNo })}${hotelName ? ` · ${hotelName}` : ''}`
  }, [view?.invoiceNo, hotelName, t])

  return (
    // #root is a full-height flex ROW (see index.css): claim the width and own
    // the vertical scroll, as the guest maintenance page does.
    <div className="flex-1 min-w-0 overflow-y-auto bg-surface2 print:bg-white">
      <div className="min-h-full flex flex-col items-center px-4 pt-5 sm:pt-10 pb-[max(2rem,env(safe-area-inset-bottom))] print:p-0">
        <div className="w-full max-w-xl">
          {loading && (
            <p className="text-base text-ink3 text-center py-16 m-0">{t('common:loading')}</p>
          )}

          {!loading && (failed || !view) && (
            <div className="bg-surface border border-line rounded-2xl shadow-soft p-6 text-center">
              <LuFileX className="mx-auto mb-3 text-ink3" size={40} aria-hidden />
              <p className="text-base font-semibold text-ink2 m-0">{t('notFound')}</p>
              <p className="text-sm text-ink3 mt-2 mb-0">{t('notFoundHint')}</p>
            </div>
          )}

          {!loading && view && (
            <>
              <PaySummary view={view} />
              {view.due > 0 && (view.hotel?.upi || view.hotel?.qrImage) && <PayCard view={view} />}
              {view.due > 0 && pay && <ClaimBox kind={kind} token={token} view={view} />}
              {kind === 'b' && view.invoiceUrl && <BookingInvoiceLinks url={view.invoiceUrl} />}
              {kind === 'i' && invoice?.invoice && (
                <>
                  <h2 className="print:hidden t-label mt-6 mb-2 px-1">{t('pay.invoiceTitle')}</h2>
                  <InvoiceSheet invoice={invoice.invoice} hotel={invoice.hotel} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Pay-page shape from a /public/invoice payload (fallback; no claim form).
function fromInvoice({ invoice: inv, hotel }) {
  const total = inv.total || 0
  const paid = Math.min(inv.status === 'Paid' ? Math.max(inv.amountPaid || 0, total) : inv.amountPaid || 0, total)
  return {
    invoiceNo: inv.invoiceNo, guestName: inv.guest?.name, total, paid, due: Math.max(0, total - paid), status: inv.status,
    hotel: { name: hotel?.name, logoUrl: hotel?.logoUrl, upi: hotel?.upi || null, qrImage: null },
  }
}

// Hotel, guest, invoice no. and the big amount due — or a green Paid state.
function PaySummary({ view }) {
  const { t } = useTranslation('publicInvoice')
  const paidUp = !(view.due > 0)
  return (
    <section className="print:hidden bg-surface border border-line rounded-2xl shadow-soft p-5 mb-4 text-center">
      {view.hotel?.logoUrl && <img src={view.hotel.logoUrl} alt="" className="h-12 max-w-[140px] object-contain mx-auto mb-2" />}
      <h1 className="text-xl font-bold m-0 text-gold tracking-[-0.02em] break-words">{view.hotel?.name}</h1>
      <p className="mt-1 mb-0 text-sm text-ink2 break-words">
        {[view.guestName, view.invoiceNo && t('pay.invoiceRef', { no: view.invoiceNo })].filter(Boolean).join(' · ')}
      </p>
      {paidUp ? (
        <div className="mt-4 rounded-xl bg-success-bg text-success-text px-4 py-4">
          <LuCircleCheck size={34} className="mx-auto mb-1" aria-hidden />
          <p className="m-0 text-2xl font-bold">{t('pay.paidTitle')}</p>
          <p className="m-0 mt-1 text-sm">{t('pay.paidText', { amount: formatCurrency(view.total) })}</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="t-label m-0">{t('pay.amountDue')}</p>
          <p className="m-0 mt-1 text-[38px] leading-tight font-bold text-ink font-mono tracking-[-0.02em]">{formatCurrency(view.due)}</p>
          {view.paid > 0 && (
            <p className="m-0 mt-1 text-xs text-ink3">{t('pay.paidSoFar', { paid: formatCurrency(view.paid), total: formatCurrency(view.total) })}</p>
          )}
        </div>
      )}
    </section>
  )
}

// Pay the balance from any UPI app: QR to scan (desktop / another phone) and a
// button that opens GPay, PhonePe, Paytm… on this phone with the amount filled in.
function PayCard({ view }) {
  const { t } = useTranslation('publicInvoice')
  const [copied, setCopied] = useState(false)
  const { upi, qrImage } = view.hotel
  const amount = view.due
  const uri = upi ? upiUri(upi, amount, view.invoiceNo) : null
  const copy = () => {
    navigator.clipboard?.writeText(upi.id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }
  return (
    <section className="print:hidden rounded-2xl border-2 border-gold/50 bg-surface p-4 sm:p-5 mb-4 shadow-soft">
      <p className="m-0 mb-3 text-center font-semibold text-ink">{t('upi.title', { amount: formatCurrency(amount) })}</p>
      <div className="flex flex-col items-center gap-3">
        <div className="bg-white p-3 rounded-xl border border-line">
          {qrImage
            ? <img src={qrImage} alt={t('upi.qrLabel')} className="block w-[220px] h-[220px] object-contain" />
            : <QRCodeSVG value={uri} size={208} level="M" aria-label={t('upi.qrLabel')} />}
        </div>
        <p className="m-0 text-xs text-ink3 text-center">{t('upi.scan')}</p>
        {qrImage && <p className="m-0 text-xs font-semibold text-warning-text text-center">{t('pay.staticQrHint', { amount: formatCurrency(amount) })}</p>}
        {upi && (
          <div className="flex items-center justify-center gap-2 min-w-0 max-w-full">
            <span className="font-mono font-semibold text-ink break-all">{upi.id}</span>
            <button type="button" onClick={copy}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-line2 bg-surface px-2.5 py-1.5 text-xs text-ink2 cursor-pointer hover:border-gold">
              {copied ? <LuCheck size={13} aria-hidden /> : <LuCopy size={13} aria-hidden />}
              {copied ? t('upi.copied') : t('upi.copy')}
            </button>
          </div>
        )}
        {upi?.name && <p className="m-0 -mt-1 text-xs text-ink3">{t('upi.payee', { name: upi.name })}</p>}
        {uri && (
          <a href={uri}
            className="sm:hidden flex items-center justify-center gap-2 w-full min-h-[52px] rounded-xl bg-gold text-black text-base font-bold no-underline shadow-soft active:scale-[0.99] transition">
            <LuSmartphone size={19} aria-hidden /> {t('upi.payButton', { amount: formatCurrency(amount) })}
          </a>
        )}
        <p className="m-0 text-xs text-ink3 text-center">{t('pay.helper')}</p>
      </div>
    </section>
  )
}

const UTR_RE = /^[A-Za-z0-9]{6,30}$/

// "I've paid" → UTR + amount + name; or the pending / thank-you state.
function ClaimBox({ kind, token, view }) {
  const { t } = useTranslation('publicInvoice')
  const [mode, setMode]     = useState(view.pendingClaim ? 'pending' : 'idle') // idle | form | sent | pending
  const [pending, setPending] = useState(view.pendingClaim)
  const [utr, setUtr]       = useState('')
  const [amount, setAmount] = useState(() => String(Math.round(view.due * 100) / 100))
  const [name, setName]     = useState(view.guestName || '')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  const cleanUtr = utr.replace(/\s/g, '')
  const amt = Number(amount)
  const utrBad = !UTR_RE.test(cleanUtr)
  const amtBad = !(amt > 0) || amt > view.due + 1

  const submit = async (e) => {
    e.preventDefault()
    setTouched(true)
    if (utrBad || amtBad) return
    setBusy(true); setError('')
    try {
      await payApi.claim(kind, token, { utr: cleanUtr, amount: amt, payerName: name.trim() || undefined })
      setPending({ amount: amt, utr: cleanUtr, createdAt: new Date().toISOString() })
      setMode('sent')
    } catch (err) {
      setError(err.response?.data?.message || t('pay.failed'))
    } finally {
      setBusy(false)
    }
  }

  const box = 'print:hidden bg-surface border border-line rounded-2xl shadow-soft p-4 sm:p-5 mb-4'

  if (mode === 'sent' || mode === 'pending') {
    const sent = mode === 'sent'
    return (
      <section className={`${box} text-center`} role="status">
        {sent
          ? <LuCircleCheck size={32} className="mx-auto mb-2 text-success-text" aria-hidden />
          : <LuClock size={30} className="mx-auto mb-2 text-gold" aria-hidden />}
        <p className="m-0 text-lg font-bold text-ink">{sent ? t('pay.thanksTitle') : t('pay.pendingTitle')}</p>
        <p className="m-0 mt-1 text-sm text-ink2">{t('pay.thanksText')}</p>
        {pending && (
          <p className="m-0 mt-2 text-xs text-ink3">
            {t('pay.pendingDetails', { amount: formatCurrency(pending.amount), utr: pending.utr })}
          </p>
        )}
        <button type="button" onClick={() => { setUtr(pending?.utr || ''); setMode('form') }}
          className="mt-3 text-xs text-gold underline bg-transparent border-0 cursor-pointer">
          {t('pay.reportAgain')}
        </button>
      </section>
    )
  }

  if (mode === 'idle') {
    return (
      <button type="button" onClick={() => setMode('form')}
        className="print:hidden w-full mb-4 min-h-[52px] rounded-xl border-2 border-gold bg-surface text-ink text-base font-bold shadow-soft inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition">
        <LuCheck size={19} className="text-gold" aria-hidden /> {t('pay.iPaid')}
      </button>
    )
  }

  const input = 'w-full bg-surface border border-line2 rounded-lg px-3 py-2.5 text-base text-ink min-h-11 placeholder:text-ink3 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'
  return (
    <form className={box} onSubmit={submit} noValidate>
      <p className="m-0 mb-3 font-semibold text-ink">{t('pay.claimTitle')}</p>
      <label className="block mb-3">
        <span className="block text-xs font-medium text-ink2 mb-1.5">{t('pay.utr')}</span>
        <input className={`${input} font-mono tracking-wider`} value={utr} onChange={(e) => setUtr(e.target.value)}
          inputMode="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={34}
          placeholder="412345678901" aria-invalid={touched && utrBad} autoFocus />
        <span className={`block text-xs mt-1.5 ${touched && utrBad ? 'text-danger-text' : 'text-ink3'}`}>
          {touched && utrBad ? t('pay.utrInvalid') : t('pay.utrHint')}
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink2 mb-1.5">{t('pay.amount')}</span>
          <input className={`${input} font-mono`} value={amount} onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal" aria-invalid={touched && amtBad} />
          {touched && amtBad && <span className="block text-xs mt-1.5 text-danger-text">{t('pay.amountInvalid', { max: formatCurrency(view.due) })}</span>}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink2 mb-1.5">{t('pay.name')}</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
        </label>
      </div>
      {error && <p className="m-0 mt-3 text-sm text-danger-text">{error}</p>}
      <div className="mt-4 flex gap-2.5">
        <button type="button" onClick={() => setMode(pending ? 'pending' : 'idle')}
          className="min-h-12 px-4 rounded-xl border border-line2 bg-surface text-ink2 font-semibold cursor-pointer">
          {t('common:cancel')}
        </button>
        <button type="submit" disabled={busy}
          className="flex-1 min-h-12 rounded-xl bg-gold text-black font-bold cursor-pointer disabled:opacity-60">
          {busy ? t('pay.sending') : t('pay.submit')}
        </button>
      </div>
    </form>
  )
}

// A booking's tax invoice is rendered by the server: open it, or get the PDF.
function BookingInvoiceLinks({ url }) {
  const { t } = useTranslation('publicInvoice')
  const href = apiHref(url)
  const pdf = `${href}${href.includes('?') ? '&' : '?'}format=pdf`
  const btn = 'flex-1 min-h-12 rounded-xl inline-flex items-center justify-center gap-2 font-semibold no-underline'
  return (
    <section className="bg-surface border border-line rounded-2xl shadow-soft p-4 sm:p-5">
      <p className="m-0 mb-3 font-semibold text-ink">{t('pay.invoiceTitle')}</p>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <a href={href} target="_blank" rel="noopener" className={`${btn} border border-gold text-ink bg-surface`}>
          <LuFileText size={17} className="text-gold" aria-hidden /> {t('pay.viewInvoice')}
        </a>
        <a href={pdf} target="_blank" rel="noopener" className={`${btn} border border-line2 text-ink2 bg-surface`}>
          <LuDownload size={17} aria-hidden /> {t('pay.downloadPdf')}
        </a>
      </div>
    </section>
  )
}

function InvoiceSheet({ invoice, hotel }) {
  const { t } = useTranslation('publicInvoice')
  const gstRate   = invoice.gstRate || 0
  const rent      = invoice.rent || 0
  const food      = invoice.food || 0
  const amenities = invoice.amenities || 0
  const total     = invoice.total || 0
  const paid      = Math.min(invoice.status === 'Paid' ? Math.max(invoice.amountPaid || 0, total) : invoice.amountPaid || 0, total)
  const balance   = Math.max(0, total - paid)
  // Rent is GST-inclusive (its taxable base is rent ÷ (1 + GST%)); food and
  // amenities are already net. Taxable + CGST + SGST = total.
  const taxable   = rent / (1 + gstRate / 100) + food + amenities
  const halfGst   = (invoice.gstAmount || 0) / 2
  const guest     = invoice.guest || {}
  const bed       = guest.bedNo ? ` · ${t('bed', { bed: String.fromCharCode(64 + guest.bedNo) })}` : ''
  const room      = guest.room ? `${guest.room.number}${bed}${guest.room.type?.name ? ` · ${guest.room.type.name}` : ''}` : '—'
  const stay      = guest.checkInDate ? `${formatDate(guest.checkInDate)}${guest.checkOutDate ? ` – ${formatDate(guest.checkOutDate)}` : ''}` : null

  const meta = [
    ['invoiceNo', t('invoiceNo'), invoice.invoiceNo, true],
    ['date',      t('date'),      formatDate(invoice.createdAt)],
    ['guest',     t('guest'),     guest.name || '—'],
    ['room',      t('room'),      room],
    stay ? ['stay', t('stay'), stay] : null,
    invoice.period ? ['period', t('period'), invoice.period] : null,
  ].filter(Boolean)

  const lines = [
    [t('roomRent'), rent],
    food > 0 ? [t('food'), food] : null,
    amenities > 0 ? [t('amenities'), amenities] : null,
  ].filter(Boolean)

  const cell = 'px-3 py-[9px] text-sm'

  return (
    <>
      <article className="bg-surface border border-line rounded-2xl shadow-soft p-4 sm:p-7 print:border-0 print:shadow-none print:p-0">
        {/* Letterhead */}
        <header className="text-center border-b-2 border-line pb-4 mb-5">
          {hotel?.logoUrl && (
            <img src={hotel.logoUrl} alt="" className="h-14 max-w-[150px] object-contain mx-auto mb-2" />
          )}
          <h1 className="text-[22px] sm:text-2xl font-bold m-0 text-gold tracking-[-0.02em] break-words">{hotel?.name}</h1>
          <p className="mt-1 mb-0 text-xs text-ink3 break-words leading-relaxed">
            {[hotel?.address, hotel?.phone, hotel?.email].filter(Boolean).join(' · ')}
          </p>
          {hotel?.gstin && <p className="mt-0.5 mb-0 text-xs text-ink3">GSTIN: {hotel.gstin}</p>}
          <p className="text-sm font-semibold mt-3 mb-0 tracking-[0.12em] uppercase text-ink">{t('taxInvoice')}</p>
        </header>

        {/* Invoice details */}
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 mb-5">
          {meta.map(([id, label, val, mono]) => (
            <div key={id} className={`min-w-0 bg-surface2 border border-line rounded-lg px-3 py-2 ${id === 'guest' || id === 'room' ? 'col-span-2 sm:col-span-1' : ''}`}>
              <p className="t-label m-0">{label}</p>
              <p className={`text-sm font-semibold text-ink mt-[3px] mb-0 break-words ${mono ? 'font-mono' : ''}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* Line items */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="bg-surface2">
              <th className="t-label text-left px-3 py-2">{t('description')}</th>
              <th className="t-label text-right px-3 py-2">{t('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(([desc, amt]) => (
              <tr key={desc} className="border-b border-line">
                <td className={cell}>{desc}</td>
                <td className={`${cell} text-right font-mono`}>{formatCurrency(amt)}</td>
              </tr>
            ))}
            <tr className="border-b border-line bg-surface2">
              <td className={`${cell} font-semibold text-ink2`}>{t('taxableValue')}</td>
              <td className={`${cell} font-semibold text-right text-ink2 font-mono`}>{formatCurrency(taxable)}</td>
            </tr>
            <tr className="border-b border-line">
              <td className={`${cell} text-ink3`}>CGST ({gstRate / 2}%)</td>
              <td className={`${cell} text-right text-ink3 font-mono`}>{formatCurrency(halfGst)}</td>
            </tr>
            <tr className="border-b-2 border-line">
              <td className={`${cell} text-ink3`}>SGST ({gstRate / 2}%)</td>
              <td className={`${cell} text-right text-ink3 font-mono`}>{formatCurrency(halfGst)}</td>
            </tr>
            <tr className="bg-[var(--gold-bg)]">
              <td className="px-3 py-[11px] font-semibold text-gold">{t('grandTotal')}</td>
              <td className="px-3 py-[11px] text-right text-lg font-bold text-gold font-mono">{formatCurrency(total)}</td>
            </tr>
            <tr className="border-b border-line">
              <td className={`${cell} text-ink2`}>{t('amountPaid')}</td>
              <td className={`${cell} text-right font-mono text-ink2`}>{formatCurrency(paid)}</td>
            </tr>
            <tr>
              <td className="px-3 py-[11px] font-semibold text-ink">{t('balanceDue')}</td>
              <td className={`px-3 py-[11px] text-right text-lg font-bold font-mono ${balance > 0 ? 'text-danger-text' : 'text-ink'}`}>
                {formatCurrency(balance)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Status */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2.5 bg-surface2 rounded-lg border border-line mb-4">
          <span className="text-xs text-ink3">{t('paymentStatus')}</span>
          <Badge type={statusBadgeType(invoice.status)}>{t(`status.${invoice.status}`, { defaultValue: invoice.status })}</Badge>
          {invoice.paidAt && <span className="text-xs text-ink3">· {t('paidOn', { date: formatDate(invoice.paidAt) })}</span>}
        </div>

        {/* Bank details — only while something is still owed */}
        {hotel?.bank && balance > 0 && (
          <div className="px-3 py-2.5 rounded-lg border border-line mb-4 text-sm">
            <p className="t-label m-0 mb-1.5">{t('payTo')}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-ink2">
              {[
                [t('accountName'), hotel.bank.name],
                [t('bankName'),    hotel.bank.bankName],
                [t('accountNo'),   hotel.bank.accountNo],
                ['IFSC',           hotel.bank.ifsc],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink3">{k}</dt>
                  <dd className="m-0 font-mono break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="m-0 text-center text-xs text-ink3 pt-3 border-t border-line">{t('thanks')}</p>
      </article>

      <button
        type="button"
        onClick={() => window.print()}
        className="no-print mt-4 w-full py-3.5 rounded-xl bg-gold text-black font-bold text-base shadow-soft active:scale-[0.99] transition inline-flex items-center justify-center gap-2"
      >
        <LuPrinter size={18} aria-hidden /> {t('downloadPrint')}
      </button>
      <p className="no-print text-xs text-ink3 text-center mt-3 mb-0">{t('printHint')}</p>
    </>
  )
}
