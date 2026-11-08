import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuBadgeIndianRupee, LuCopy, LuCheck, LuChevronRight } from 'react-icons/lu'
import { Modal, Button, EmptyState, useWhatsAppComposer } from '../../ui-tw'
import { claimsApi } from '../../../api/client'
import { useAppSelector } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import { canAccess } from '../../../utils/permissions'
import { formatCurrency, timeAgo } from '../../../utils/format'
import { refreshClaims, resetClaims, usePendingClaims } from '../../../utils/paymentClaims'

/**
 * UPI payments guests reported from the pay page ("I've paid" + UTR), waiting
 * for staff to check them in the hotel's UPI app and confirm.
 *
 *   <PaymentClaimsWatcher />   app shell: polls the pending list every 60s, toasts on new ones
 *   usePendingClaims()          { claims, pending } — utils/paymentClaims (Sidebar badge, banner)
 *   <PaymentClaimsBanner />     Billing: "N UPI payments to confirm" → review modal
 */

const POLL_MS = 60_000

/** Mount once inside the signed-in shell. */
export function PaymentClaimsWatcher() {
  const { t } = useTranslation('payClaims')
  const toast = useToast()
  const user = useAppSelector((s) => s.auth.currentUser)
  const propertyId = useAppSelector((s) => s.auth.activePropertyId)
  const allowed = canAccess(user, 'billing')
  const toastRef = useRef(toast)
  const tRef = useRef(t)
  useEffect(() => { toastRef.current = toast; tRef.current = t })

  useEffect(() => {
    if (!allowed) { resetClaims(); return }
    let alive = true
    let last = null // pending count at the previous poll (null: first poll of this property)
    resetClaims()
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden && last !== null) return
      const s = await refreshClaims()
      if (!alive || !s.loaded) return
      if (last !== null && s.pending > last) {
        toastRef.current(tRef.current('newToast', { count: s.pending - last }), 'info')
      }
      last = s.pending
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    // Back on the tab: catch up straight away.
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [allowed, propertyId])

  return null
}

// ── Billing banner + review modal ──────────────────────────────────────────────
export function PaymentClaimsBanner({ onConfirmed }) {
  const { t } = useTranslation('payClaims')
  const { pending } = usePendingClaims()
  const [open, setOpen] = useState(false)
  const wa = useWhatsAppComposer()

  return (
    <>
      {pending > 0 && (
        <button
          type="button"
          onClick={() => { refreshClaims(); setOpen(true) }}
          className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--gold-border)] bg-[var(--gold-bg)] text-left cursor-pointer hover:border-gold transition-colors"
        >
          <span className="w-9 h-9 rounded-full bg-gold text-black flex items-center justify-center shrink-0">
            <LuBadgeIndianRupee size={19} aria-hidden />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block t-title text-ink">{t('banner', { count: pending })}</span>
            <span className="block t-xs text-ink3">{t('bannerHint')}</span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 t-sm font-semibold text-gold">
            {t('review')} <LuChevronRight size={16} aria-hidden />
          </span>
        </button>
      )}
      {open && (
        <ClaimsModal
          onClose={() => setOpen(false)}
          onConfirmed={(claim, amount, shareUrl) => {
            setOpen(false)
            onConfirmed?.()
            const ref = claim.ref || {}
            const no = ref.invoiceNo || ref.bookingNo || ''
            const guest = ref.guestName || claim.guestName || ''
            wa.open({
              phone: ref.guestPhone,
              guestId: ref.guestId,
              name: [guest, no].filter(Boolean).join(' · '),
              title: t('whatsapp:actions.receipt'),
              template: 'receipt',
              invoiceLink: shareUrl ? async () => shareUrl : undefined,
              vars: { name: guest, invoiceNo: no, amount, due: 0 },
            })
          }}
        />
      )}
      {wa.composer}
    </>
  )
}

function ClaimsModal({ onClose, onConfirmed }) {
  const { t } = useTranslation('payClaims')
  const { claims, loaded } = usePendingClaims()
  return (
    <Modal isOpen onClose={onClose} size="md" title={t('title')} subtitle={t('subtitle')}>
      {claims.length === 0 ? (
        <EmptyState icon="₹" title={loaded ? t('empty') : t('common:loading')} />
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {claims.map((c) => <ClaimRow key={c.id} claim={c} onConfirmed={onConfirmed} />)}
        </ul>
      )}
    </Modal>
  )
}

function ClaimRow({ claim, onConfirmed }) {
  const { t } = useTranslation('payClaims')
  const toast = useToast()
  const ref = claim.ref || {}
  const [amount, setAmount] = useState(String(claim.amount ?? ''))
  const [busy, setBusy] = useState(null) // 'confirm' | 'reject'
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [copied, setCopied] = useState(false)
  const amt = Number(amount)
  const amtOk = amt > 0
  const guest = ref.guestName || claim.guestName || '—'
  const no = ref.invoiceNo || ref.bookingNo || ''

  const copy = () => {
    navigator.clipboard?.writeText(claim.utr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }

  const confirm = async () => {
    if (!amtOk) return
    setBusy('confirm')
    try {
      const { data } = await claimsApi.confirm(claim.id, amt !== claim.amount ? { amount: amt } : {})
      toast(t('confirmed', { amount: formatCurrency(amt), guest }), 'success')
      await refreshClaims()
      onConfirmed(claim, amt, data?.shareUrl || '')
    } catch (err) {
      // Someone else already confirmed / rejected it: say so and drop it from the list.
      if (err.response?.status === 409) {
        toast(t('alreadyReviewed'), 'info')
        await refreshClaims()
        return
      }
      toast(err.response?.data?.message || t('confirmFailed'), 'error')
      setBusy(null)
    }
  }

  const reject = async () => {
    setBusy('reject')
    try {
      await claimsApi.reject(claim.id, reason.trim() ? { reason: reason.trim() } : {})
      toast(t('rejected'), 'success')
      await refreshClaims()
    } catch (err) {
      toast(err.response?.data?.message || t('rejectFailed'), 'error')
      setBusy(null)
    }
  }

  const input = 'w-full bg-surface border border-line2 rounded-lg px-3 py-2 text-base sm:text-sm text-ink min-h-11 sm:min-h-0 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'

  return (
    <li className="rounded-xl border border-line bg-surface2 p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 t-title text-ink truncate">{guest}</p>
          <p className="m-0 mt-0.5 t-xs text-ink3">
            {no && <span className="font-mono text-gold">{no}</span>}
            {no && ' · '}{timeAgo(claim.createdAt)}
            {claim.payerName && claim.payerName !== guest && <> · {t('payer', { name: claim.payerName })}</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="m-0 font-mono font-bold text-lg text-ink">{formatCurrency(claim.amount)}</p>
          {ref.due != null && <p className="m-0 t-xs text-ink3">{t('due', { amount: formatCurrency(ref.due) })}</p>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="t-xs text-ink3">UTR</span>
        <span className="font-mono font-semibold text-ink tracking-wider break-all">{claim.utr}</span>
        <button type="button" onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border border-line2 bg-surface px-2 py-1 text-xs text-ink2 cursor-pointer hover:border-gold pointer-coarse:min-h-9">
          {copied ? <LuCheck size={13} aria-hidden /> : <LuCopy size={13} aria-hidden />}
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
      <p className="m-0 mt-1.5 t-xs text-warning-text">{t('checkHint')}</p>

      {rejecting ? (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('reasonPlaceholder')} maxLength={200} />
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} disabled={!!busy}>{t('common:cancel')}</Button>
            <Button variant="danger" size="sm" onClick={reject} disabled={!!busy}>{busy === 'reject' ? t('working') : t('rejectConfirm')}</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-end gap-2 flex-wrap">
          <label className="block w-[140px]">
            <span className="block text-xs font-medium text-ink2 mb-1">{t('amount')}</span>
            <input className={`${input} font-mono`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!amtOk} />
          </label>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => setRejecting(true)} disabled={!!busy}>{t('reject')}</Button>
            <Button variant="success" size="sm" icon={<LuCheck />} onClick={confirm} disabled={!!busy || !amtOk}>
              {busy === 'confirm' ? t('working') : t('confirm')}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
