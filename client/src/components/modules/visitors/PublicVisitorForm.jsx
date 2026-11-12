import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { visitorsApi } from '../../../api/client'
import GuestLanguageToggle from '../portal/GuestLanguageToggle'
import { PURPOSES, ID_TYPES, PHONE_RE, EMAIL_RE, cleanPhone, formatTime } from './visitorUtils'

// Standalone, no-login pages:
//   /visit?t=<property visitorToken>  — the registration form (the gate QR)
//   /visit?p=<passToken>              — the visitor's own pass, polled for status
// The last pass per property is remembered on the phone, so re-scanning the QR
// brings the visitor back to their pass instead of a blank form.

const PASS_KEY = (token) => `qv-visit-pass:${token}`
const POLL_MS = 10000
const params = () => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search))
const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k) } catch { /* private mode */ } },
}

const EMPTY = { name: '', phone: '', email: '', company: '', purpose: 'guest_visit', hostName: '', roomNumber: '', idType: '', idNumber: '', vehicleNo: '', companions: '0' }

const STATUS = {
  pending:     { icon: '⏳', title: 'statusPending', hint: 'statusPendingHint', cls: 'bg-warning-bg text-warning-text border-warning' },
  expected:    { icon: '📅', title: 'statusExpected', hint: 'statusExpectedHint', cls: 'bg-info-bg text-info-text border-info' },
  checked_in:  { icon: '✅', title: 'statusIn', hint: 'statusInHint', cls: 'bg-success-bg text-success-text border-success' },
  checked_out: { icon: '👋', title: 'statusOut', hint: 'statusOutHint', cls: 'bg-surface2 text-ink2 border-line' },
  rejected:    { icon: '⛔', title: 'statusRejected', hint: 'statusRejectedHint', cls: 'bg-danger-bg text-danger-text border-danger' },
}

function Brand({ property, title }) {
  return (
    <div className="flex flex-col items-center text-center mb-5">
      {property?.logoUrl
        ? <img src={property.logoUrl} alt="" className="w-14 h-14 rounded-2xl object-contain bg-surface border border-line mb-3" />
        : <div className="w-14 h-14 rounded-2xl bg-gold-bg border border-gold-border flex items-center justify-center text-[26px] mb-3">🪪</div>}
      {property?.name && <div className="text-sm font-semibold text-ink2">{property.name}</div>}
      <h1 className="text-2xl font-extrabold text-ink tracking-[-0.02em] m-0 mt-0.5">{title}</h1>
    </div>
  )
}

function Pass({ pass, onCheckOut, busy, onNew }) {
  const { t } = useTranslation('visitors')
  const s = STATUS[pass.status] || STATUS.pending
  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-2 px-4 py-4 text-center ${s.cls}`} role="status" aria-live="polite">
        <div className="text-4xl leading-none mb-2" aria-hidden>{s.icon}</div>
        <div className="text-lg font-bold">{t(`public.${s.title}`)}</div>
        <div className="text-sm mt-1 opacity-90">{t(`public.${s.hint}`)}</div>
        {pass.status === 'rejected' && pass.rejectReason && <div className="text-sm mt-2 font-medium">{pass.rejectReason}</div>}
      </div>

      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="bg-ink text-surface px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-bold tracking-[.2em]">{t('badge.visitor')}</span>
          <span className="text-xs opacity-80">{t('public.passNo')}</span>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xl font-extrabold text-ink break-words">{pass.name}</div>
              <div className="text-sm text-ink3 mt-0.5">{t(`purposes.${pass.purpose}`, { defaultValue: pass.purpose })}</div>
            </div>
            <div className="font-mono text-2xl font-extrabold text-ink shrink-0">{pass.passNo}</div>
          </div>
          <dl className="m-0 mt-3 grid grid-cols-2 gap-2 text-sm">
            {pass.hostName && <div><dt className="text-xs text-ink3">{t('badge.host')}</dt><dd className="m-0 text-ink">{pass.hostName}{pass.roomNumber ? ` · #${pass.roomNumber}` : ''}</dd></div>}
            {pass.companions > 0 && <div><dt className="text-xs text-ink3">{t('public.companions')}</dt><dd className="m-0 text-ink">{pass.companions}</dd></div>}
            {pass.checkInAt && <div><dt className="text-xs text-ink3">{t('table.in')}</dt><dd className="m-0 text-ink">{t('public.inSince', { time: formatTime(pass.checkInAt) })}</dd></div>}
            {pass.checkOutAt && <div><dt className="text-xs text-ink3">{t('table.out')}</dt><dd className="m-0 text-ink">{t('public.outAt', { time: formatTime(pass.checkOutAt) })}</dd></div>}
          </dl>
        </div>
      </div>

      {pass.status === 'checked_in' && (
        <button type="button" disabled={busy}
          onClick={() => { if (window.confirm(t('public.checkOutConfirm'))) onCheckOut() }}
          className="w-full min-h-12 rounded-xl bg-ink text-surface font-bold text-base border-0 cursor-pointer disabled:opacity-60">
          {t('public.checkOut')}
        </button>
      )}
      {onNew && (pass.status === 'checked_out' || pass.status === 'rejected' || pass.status === 'pending') && (
        <button type="button" onClick={onNew}
          className="w-full min-h-11 rounded-xl bg-transparent border border-line2 text-ink2 font-semibold text-sm cursor-pointer hover:border-gold hover:text-gold">
          {t('public.newVisit')}
        </button>
      )}
    </div>
  )
}

export default function PublicVisitorForm() {
  const { t } = useTranslation('visitors')
  const [{ token, passParam }] = useState(() => ({ token: params().get('t') || '', passParam: params().get('p') || '' }))
  const [passToken, setPassToken] = useState(() => passParam || (token && store.get(PASS_KEY(token))) || '')
  const [form, setForm] = useState(null)       // { property, autoApprove }
  const [pass, setPass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [values, setValues] = useState(EMPTY)
  const [consent, setConsent] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)

  // Load the form (QR) and/or the remembered pass.
  useEffect(() => {
    let off = false
    const jobs = []
    if (token) {
      jobs.push(visitorsApi.publicForm(token).then(({ data }) => { if (!off) setForm(data) }))
    }
    if (passToken) {
      jobs.push(visitorsApi.publicPass(passToken)
        .then(({ data }) => { if (!off) setPass(data.pass) })
        .catch(() => { if (token) store.del(PASS_KEY(token)); if (!off) setPassToken('') }))
    }
    if (!token && !passToken) { setLoadError(t('public.missingCode')); setLoading(false); return }
    Promise.all(jobs)
      .catch((e) => { if (!off) setLoadError(e.response?.data?.message || t('public.unknownCode')) })
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
    // Runs once: later pass changes are handled by the poller below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll the pass until it reaches a final state.
  const refreshPass = useCallback(() => {
    if (!passToken) return
    visitorsApi.publicPass(passToken).then(({ data }) => setPass(data.pass)).catch(() => {})
  }, [passToken])
  const live = pass && (pass.status === 'pending' || pass.status === 'expected' || pass.status === 'checked_in')
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => document.visibilityState === 'visible' && refreshPass(), POLL_MS)
    return () => clearInterval(id)
  }, [live, refreshPass])

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const phone = cleanPhone(values.phone)
    const errs = {}
    if (values.name.trim().length < 2) errs.name = t('form.errors.name')
    if (!PHONE_RE.test(phone)) errs.phone = t('form.errors.phone')
    if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) errs.email = t('form.errors.email')
    setErrors(errs)
    if (Object.keys(errs).length || !consent) return
    setBusy(true); setSubmitError('')
    try {
      const { data } = await visitorsApi.publicSubmit(token, {
        name: values.name.trim(), phone, email: values.email.trim(), company: values.company.trim(),
        purpose: values.purpose, hostName: values.hostName.trim(), roomNumber: values.roomNumber.trim(),
        idType: values.idType, idNumber: values.idType ? values.idNumber.trim() : '',
        vehicleNo: values.vehicleNo.trim().toUpperCase(),
        companions: Math.max(0, Math.min(20, parseInt(values.companions, 10) || 0)), consent: true,
      })
      store.set(PASS_KEY(token), data.passToken)
      setPassToken(data.passToken)
      setPass(data.pass)
      window.scrollTo?.(0, 0)
    } catch (err) {
      const d = err.response?.data
      if (d?.details?.length) setErrors(Object.fromEntries(d.details.map((x) => [x.field, x.message])))
      setSubmitError(d?.message || (d?.details ? d.details[0].message : t('public.submitFailed')))
    } finally {
      setBusy(false)
    }
  }

  const checkOut = async () => {
    setBusy(true)
    try { const { data } = await visitorsApi.publicCheckOut(passToken); setPass(data.pass) }
    catch { refreshPass() }
    finally { setBusy(false) }
  }

  const startNew = () => {
    store.del(PASS_KEY(token))
    setPass(null); setPassToken(''); setValues(EMPTY); setConsent(false); setErrors({}); setSubmitError('')
  }

  // 16px inputs: smaller text makes iOS Safari zoom into the field.
  const labelCls = 'block text-[13px] font-semibold text-ink2 mb-1.5'
  const fieldCls = 'w-full text-base text-ink bg-surface2 border border-line rounded-xl px-4 py-3 outline-none transition placeholder:text-ink3 focus:border-gold focus:bg-surface focus:ring-4 focus:ring-gold-bg'
  const opt = <span className="text-ink3 font-normal">({t('public.optional')})</span>
  const err = (k) => errors[k] && <p className="text-xs text-danger-text mt-1 mb-0">{errors[k]}</p>
  const property = form?.property || pass?.property

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-surface2">
      <div className="min-h-full flex flex-col items-center px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-5"><GuestLanguageToggle /></div>
          <Brand property={property} title={pass ? t('public.pass') : t('public.title')} />

          <div className="bg-surface border border-line rounded-2xl shadow-soft p-5 sm:p-6">
            {loading && <p className="text-base text-ink3 text-center py-10 m-0">{t('common:loading')}</p>}

            {!loading && loadError && !pass && (
              <div className="text-center py-8">
                <p className="text-4xl mb-3 m-0">⚠️</p>
                <p className="text-base font-semibold text-ink2 m-0">{loadError}</p>
                <p className="text-sm text-ink3 mt-2">{t('public.askReception')}</p>
              </div>
            )}

            {!loading && pass && <Pass pass={pass} busy={busy} onCheckOut={checkOut} onNew={form ? startNew : null} />}

            {!loading && !pass && form && (
              <form onSubmit={submit} noValidate className="flex flex-col gap-4">
                <p className="m-0 text-sm text-ink3">{t('public.intro')}</p>

                <div>
                  <label htmlFor="v-name" className={labelCls}>{t('public.name')} <span className="text-danger-text">*</span></label>
                  <input id="v-name" className={fieldCls} autoComplete="name" maxLength={80} placeholder={t('public.namePlaceholder')}
                    value={values.name} onChange={set('name')} aria-invalid={!!errors.name} />
                  {err('name')}
                </div>
                <div>
                  <label htmlFor="v-phone" className={labelCls}>{t('public.phone')} <span className="text-danger-text">*</span></label>
                  <input id="v-phone" className={fieldCls} type="tel" inputMode="tel" autoComplete="tel" maxLength={18}
                    value={values.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
                  {err('phone')}
                </div>
                <div>
                  <label htmlFor="v-purpose" className={labelCls}>{t('public.purpose')}</label>
                  <select id="v-purpose" className={fieldCls} value={values.purpose} onChange={set('purpose')}>
                    {(form.purposes || PURPOSES).map((p) => <option key={p} value={p}>{t(`purposes.${p}`, { defaultValue: p })}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="v-host" className={labelCls}>{t('public.hostName')} {opt}</label>
                  <input id="v-host" className={fieldCls} maxLength={80} placeholder={t('public.hostPlaceholder')} value={values.hostName} onChange={set('hostName')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="v-room" className={labelCls}>{t('public.roomNumber')}</label>
                    <input id="v-room" className={fieldCls} maxLength={10} value={values.roomNumber} onChange={set('roomNumber')} />
                  </div>
                  <div>
                    <label htmlFor="v-comp" className={labelCls}>{t('public.companions')}</label>
                    <input id="v-comp" className={fieldCls} type="number" inputMode="numeric" min={0} max={20} value={values.companions} onChange={set('companions')} />
                  </div>
                </div>
                <div>
                  <label htmlFor="v-company" className={labelCls}>{t('public.company')} {opt}</label>
                  <input id="v-company" className={fieldCls} maxLength={80} value={values.company} onChange={set('company')} />
                </div>

                {!showMore ? (
                  <button type="button" onClick={() => setShowMore(true)}
                    className="self-start bg-transparent border-0 p-0 text-sm font-semibold text-gold cursor-pointer hover:underline">
                    + {t('public.moreDetails')} ({t('public.optional')})
                  </button>
                ) : (
                  <div className="flex flex-col gap-4 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="v-idt" className={labelCls}>{t('public.idType')}</label>
                        <select id="v-idt" className={fieldCls} value={values.idType} onChange={set('idType')}>
                          <option value="">{t('form.none')}</option>
                          {ID_TYPES.map((p) => <option key={p} value={p}>{t(`idTypes.${p}`)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="v-idn" className={labelCls}>{t('public.idNumber')}</label>
                        <input id="v-idn" className={fieldCls} maxLength={30} autoComplete="off" disabled={!values.idType}
                          value={values.idNumber} onChange={set('idNumber')} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="v-veh" className={labelCls}>{t('public.vehicleNo')}</label>
                        <input id="v-veh" className={fieldCls} maxLength={20} value={values.vehicleNo} onChange={set('vehicleNo')} />
                      </div>
                      <div>
                        <label htmlFor="v-email" className={labelCls}>{t('public.email')}</label>
                        <input id="v-email" className={fieldCls} type="email" inputMode="email" autoComplete="email" maxLength={120}
                          value={values.email} onChange={set('email')} aria-invalid={!!errors.email} />
                        {err('email')}
                      </div>
                    </div>
                  </div>
                )}

                <label className="flex items-start gap-3 rounded-xl bg-surface2 border border-line px-3.5 py-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--gold)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span className="text-[13px] text-ink2 leading-snug">{t('public.consent', { property: property?.name || '' })}</span>
                </label>

                {submitError && <div role="alert" className="rounded-xl px-3.5 py-2.5 text-sm bg-danger-bg text-danger-text">{submitError}</div>}

                <button type="submit" disabled={busy || !consent}
                  className="w-full min-h-12 rounded-xl bg-gold text-[#1a1712] font-bold text-base border-0 cursor-pointer shadow-[0_4px_12px_rgba(201,168,76,0.35)] disabled:opacity-50 disabled:cursor-not-allowed">
                  {busy ? t('public.submitting') : t('public.submit')}
                </button>
                <p className="m-0 text-xs text-ink3 text-center">{t('public.privacy', { property: property?.name || '' })}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
