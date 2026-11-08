import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaWhatsapp } from 'react-icons/fa'
import Modal from './Modal'
import Button from './Button'
import Field from './Field'
import i18n, { LANGUAGES } from '../../i18n'
import { billingApi, remindersApi, settingsApi } from '../../api/client'
import { useAppSelector } from '../../store/hooks'
import { useToast } from '../../hooks/useToast'
import { selectActiveProperty } from '../../store/slices/authSlice'
import { formatCurrency } from '../../utils/format'
import { mapsUrl, openWhatsApp, waNumber } from '../../utils/whatsapp'

/**
 * WhatsApp click-to-chat, shared by Bookings, Billing, Guests and Today.
 *
 *   const wa = useWhatsAppComposer()        // ./useWhatsApp
 *   wa.open({ phone, guestId, name, template: 'confirmation', vars: {…}, invoiceId })
 *   …
 *   {wa.composer}
 *
 * The composer shows the number and the prefilled message (both editable, the
 * message in any of the app's languages) and opens wa.me — staff press Send in
 * WhatsApp. `invoiceId` (or an async function returning one) puts a public
 * invoice link in the message. Each send is logged as a Reminder when the
 * guest is known (best effort).
 *
 * Templates (whatsapp:msg.<template>): confirmation, arrival, payment, invoice,
 * thanks, invoiceReminder, rentReminder, departure, chat, receipt (payment
 * received + the updated invoice). Messages asking for money present the link
 * as the guest pay page (QR, UPI button, "I've paid"). `text` instead of a
 * template sends that text as-is.
 */

const WA_GREEN = '#25D366'

export function WhatsAppIcon({ size = 15, className = '' }) {
  return <FaWhatsapp size={size} className={className} style={{ color: WA_GREEN }} aria-hidden="true" />
}

/** Small green button. `iconOnly` for tight rows (Today). */
export function WhatsAppButton({ phone, onClick, label, iconOnly = false, className = '' }) {
  const { t } = useTranslation('whatsapp')
  const ok = !!waNumber(phone)
  const text = label || t('sendOnWhatsApp')
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ok}
      title={ok ? text : t('noPhone')}
      aria-label={text}
      className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium text-[13px]
                  border-[#25D366]/40 bg-[#25D366]/10 text-ink hover:bg-[#25D366]/20 transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${iconOnly ? 'w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11' : 'h-9 px-3 pointer-coarse:min-h-11'} ${className}`}
    >
      <WhatsAppIcon size={iconOnly ? 16 : 15} />
      {!iconOnly && <span>{text}</span>}
    </button>
  )
}

/** A dismissible strip offering a WhatsApp follow-up (after a booking or check-out). */
export function WhatsAppOffer({ message, actionLabel, phone, onSend, onDismiss }) {
  const { t } = useTranslation('whatsapp')
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 mb-3 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10">
      <WhatsAppIcon size={18} />
      <span className="flex-1 min-w-[160px] text-sm text-ink">{message}</span>
      <WhatsAppButton phone={phone} label={actionLabel} onClick={onSend} />
      <button type="button" onClick={onDismiss} aria-label={t('common:close')}
        className="w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-lg text-ink3 hover:text-ink hover:bg-surface2 flex items-center justify-center">
        ✕
      </button>
    </div>
  )
}

// Hotel name + address for the active property, fetched once per property.
const hotelCache = new Map()
function loadHotel(propertyId) {
  const key = propertyId || '-'
  if (!hotelCache.has(key)) {
    hotelCache.set(key, settingsApi.get()
      .then(({ data }) => data?.hotel || {})
      .catch(() => { hotelCache.delete(key); return {} }))
  }
  return hotelCache.get(key)
}

const dateIn = (lang) => (d) => {
  if (!d) return ''
  const x = new Date(d)
  if (isNaN(x)) return ''
  const locale = LANGUAGES.find((l) => l.code === lang)?.locale || 'en-IN'
  return x.toLocaleDateString(`${locale}-u-nu-latn`, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

// Fill a template in `lang`. Raw values in `vars` (dates, numbers) are formatted here.
// Messages asking for money also carry the hotel's UPI ID (pay from any UPI app).
const MONEY_TEMPLATES = ['payment', 'invoiceReminder', 'rentReminder']

function buildMessage(template, vars, lang, { hotel, link, upiId }) {
  const t = i18n.getFixedT(lang, 'whatsapp')
  const date = dateIn(lang)
  const money = (v) => formatCurrency(Number(v) || 0)
  const due = Number(vars.due) || 0
  const asksMoney = MONEY_TEMPLATES.includes(template) || (due > 0 && template !== 'receipt')
  const stay = vars.months
    ? t('months', { count: Number(vars.months) })
    : vars.nights ? t('nights', { count: Number(vars.nights) }) : vars.tenancy ? t('monthlyStay') : ''
  const values = {
    ...vars,
    name: vars.name || t('guest'),
    hotel,
    room: vars.room || '—',
    bookingNo: vars.bookingNo || '',
    checkIn: date(vars.fromDate),
    checkOut: vars.toDate ? date(vars.toDate) : t('untilMoveOut'),
    stay: stay ? ` (${stay})` : '',
    amount: money(vars.amount),
    due: money(due),
    dueDate: date(vars.dueDate),
    payment: due > 0 ? t('line.paymentDue', { paid: money(vars.paid), due: money(due) }) : t('line.paidInFull'),
    // Asking for money: the link opens the pay page (QR, UPI button, invoice).
    linkLine: link ? t(template === 'receipt' ? 'line.updatedLink' : asksMoney ? 'line.payLink' : 'line.link', { link }) : '',
    address: vars.address ? t('line.address', { address: vars.address, map: mapsUrl(vars.address) }) : '',
  }
  const upi = upiId && asksMoney ? t('line.upi', { upi: upiId }) : ''
  return `${t(`msg.${template}`, values)}${upi}\n\n${t('signoff', { hotel })}`
}

export function WhatsAppComposer({ request, onClose }) {
  const { t } = useTranslation('whatsapp')
  const toast = useToast()
  const property = useAppSelector(selectActiveProperty)
  const fallbackHotel = useAppSelector((s) => s.hotel.hotelName)
  const [lang, setLang] = useState(i18n.language in LANG_CODES ? i18n.language : 'en')
  // A booking may list several numbers: start with the first (editable).
  const [phone, setPhone] = useState(() => String(request.phone || '').split(/[,;/]/)[0].trim())
  const [text, setText] = useState(request.text || '')
  const [ctx, setCtx] = useState(null) // { hotel, address, link, linkFailed }

  // Hotel details and (when asked) the invoice link, once per open; then the
  // message in the chosen language.
  const langRef = useRef(lang)
  const propertyId = property?.id
  const propertyName = property?.name
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [hotel, link] = await Promise.all([loadHotel(propertyId), resolveLink(request)])
      if (!alive) return
      const c = {
        hotel: hotel.name || propertyName || fallbackHotel,
        address: hotel.address || '',
        upiId: hotel.upiId?.trim() || '',
        link,
        linkFailed: (request.invoiceId != null || !!request.invoiceLink) && !link,
      }
      setCtx(c)
      const next = messageFor(request, langRef.current, c)
      if (next != null) setText(next)
    })()
    return () => { alive = false }
  }, [request, propertyId, propertyName, fallbackHotel])

  const changeLang = (l) => {
    setLang(l); langRef.current = l
    const next = ctx && messageFor(request, l, ctx)
    if (next != null) setText(next)
  }

  const number = waNumber(phone)
  const loading = (!!request.template || request.invoiceId != null || !!request.invoiceLink) && !ctx

  const send = () => {
    if (!openWhatsApp(phone, text.trim())) return
    if (request.guestId) remindersApi.send({ guestId: request.guestId, channel: 'whatsapp', message: text.trim() }).catch(() => {})
    toast(t('opened'))
    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title={<span className="inline-flex items-center gap-2"><WhatsAppIcon size={18} />{request.title || t('title')}</span>}
      subtitle={request.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common:cancel')}</Button>
          <Button onClick={send} disabled={!number || !text.trim() || loading}
            className="!bg-[#25D366] !text-white hover:!bg-[#1ebe5b]" icon={<FaWhatsapp />}>
            {t('openWhatsApp')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 items-start">
          <Field label={t('number')} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
            error={phone && !number ? t('invalidNumber') : undefined}
            hint={number ? `+${number}` : t('numberHint')} />
          {request.template && (
            <Field className="w-[118px]" label={t('language')} value={lang} onChange={(e) => changeLang(e.target.value)} disabled={!ctx}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.native }))} />
          )}
        </div>
        <Field label={t('message')} textarea rows={10} value={loading ? t('preparing') : text} disabled={loading}
          onChange={(e) => setText(e.target.value)} />
        {ctx?.linkFailed && <p className="-mt-2 text-[12px] text-warning-text">{t('noLink')}</p>}
      </div>
    </Modal>
  )
}

// The message text for a composer request in `lang`, or null to keep the text as is.
function messageFor(request, lang, c) {
  // Free text (e.g. Billing's reminder box): just add the invoice link.
  if (!request.template) {
    return c.link ? `${request.text || ''}${i18n.getFixedT(lang, 'whatsapp')('line.link', { link: c.link })}` : null
  }
  return buildMessage(request.template, { address: c.address, ...request.vars }, lang, { hotel: c.hotel, link: c.link, upiId: c.upiId })
}

const LANG_CODES = Object.fromEntries(LANGUAGES.map((l) => [l.code, true]))

// The invoice link: `invoiceLink()` (an async function returning a URL — day
// bookings) or a billing `invoiceId` turned into one by billingApi.shareLink.
// On any error the message just goes without a link.
async function resolveLink({ invoiceId, invoiceLink }) {
  try {
    if (invoiceLink) return (await invoiceLink()) || ''
    const id = typeof invoiceId === 'function' ? await invoiceId() : invoiceId
    if (!id || typeof billingApi.shareLink !== 'function') return ''
    const { data } = await billingApi.shareLink(id)
    return data?.url || ''
  } catch {
    return ''
  }
}
