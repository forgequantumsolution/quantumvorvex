import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuRefreshCw, LuIndianRupee, LuPause, LuPlay, LuPencil, LuTrash2, LuPhone, LuX, LuBedDouble } from 'react-icons/lu'
import { Modal, Button } from '../../ui-tw'
import { foodApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import { STATUS_TONE, DIET_TONE, MEAL_ICONS, cycleLabel, daysLeftLabel, shortDate, initials } from './foodUtils'

function Item({ label, children, wide }) {
  if (children == null || children === '' || children === false) return null
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs text-ink3 mb-0.5">{label}</dt>
      <dd className="m-0 text-sm text-ink break-words whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

export function StatusPill({ status }) {
  const { t } = useTranslation('food')
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${STATUS_TONE[status] || STATUS_TONE.no_plan}`}>
      {t(`status.${status}`)}
    </span>
  )
}

export function DietTag({ diet }) {
  const { t } = useTranslation('food')
  if (!diet) return null
  return <span className={`text-[11px] font-semibold ${DIET_TONE[diet] || 'text-ink3'}`}>● {t(`diets.${diet}`)}</span>
}

// Where a subscription sits in time, for its badge in the history.
const phaseOf = (s) => {
  if (s.status === 'cancelled') return 'cancelled'
  if (s.status === 'paused') return 'paused'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (new Date(s.startDate) > today) return 'upcoming'
  if (new Date(s.endDate) < today) return 'expired'
  return 'active'
}

/**
 * One food customer: profile, room / booking link, meal plan history with
 * payments, the last two weeks of meals, and the desk actions — renew, collect
 * dues, pause / resume, cancel a plan (admin), edit, delete.
 */
export default function CustomerDetailModal({ customerId, canManage, onClose, onEdit, onRenew, onPay, onDelete, onChanged, reloadKey }) {
  const { t } = useTranslation('food')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    foodApi.customer(customerId).then(({ data: d }) => setData(d)).catch(() => setError(t('detail.loadError')))
  }, [customerId, t])
  useEffect(() => { load() }, [load, reloadKey])

  const act = async (fn, okMsg) => {
    setBusy(true)
    try { await fn(); load(); onChanged(okMsg) } catch (err) { setError(err.response?.data?.message || t('toast.failed')) } finally { setBusy(false) }
  }

  const c = data?.customer
  const current = c?.subscriptions?.find((x) => x.id === c.current?.id)
  // Meals taken in the last 14 days, grouped by day.
  const mealDays = []
  for (const m of c?.recentMeals || []) {
    const key = new Date(m.date).toDateString()
    const day = mealDays.find((d) => d.key === key) || (mealDays.push({ key, date: m.date, meals: [] }), mealDays[mealDays.length - 1])
    day.meals.push(m.meal)
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" title={t('detail.title')}
      footer={<Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>}>
      {!c ? (
        <p className="m-0 text-sm text-ink3 py-8 text-center">{error || t('common:loading')}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <span aria-hidden className="w-12 h-12 shrink-0 rounded-full bg-gold-bg text-gold flex items-center justify-center font-bold text-[16px]">{initials(c.name)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[17px] text-ink break-words">{c.name}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                <StatusPill status={c.status} />
                {(c.guestId || c.bookingId) && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-violet-bg text-violet-text font-semibold">
                    <LuBedDouble size={11} aria-hidden /> {c.roomNumber ? t('room', { room: c.roomNumber }) : t('source.guest')}
                    {c.bedNo ? ` · ${t('bed', { bed: c.bedNo })}` : ''}
                  </span>
                )}
                <DietTag diet={c.diet} />
                <span className="text-ink3">{c.customerNo}</span>
              </div>
            </div>
            {c.due > 0 && (
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-ink3">{t('detail.due')}</div>
                <div className="font-bold text-[16px] text-danger-text tabular-nums">{formatCurrency(c.due)}</div>
              </div>
            )}
          </div>

          {error && <div role="alert" className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{error}</div>}

          {c.current && (
            <div className="rounded-xl border border-line bg-surface2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-ink3">{t('detail.currentPlan')}</div>
                  <div className="font-semibold text-ink">{c.current.planName} · {cycleLabel(t, c.current.cycle, c.current.units)}</div>
                  <div className="text-xs text-ink2 mt-0.5">
                    {c.current.meals.map((m) => `${MEAL_ICONS[m]} ${t(`meals.${m}`)}`).join('  ')}
                  </div>
                  <div className="text-xs text-ink2 mt-0.5">{shortDate(c.current.startDate)} → {shortDate(c.current.endDate)} · {daysLeftLabel(t, c)}</div>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" icon={<LuRefreshCw />} disabled={busy} onClick={() => onRenew(c)}>{t('actions.renew')}</Button>
                    {current?.status === 'active' && phaseOf(current) === 'active' && (
                      <Button size="sm" variant="ghost" icon={<LuPause />} disabled={busy}
                        onClick={() => act(() => foodApi.pause(current.id), t('toast.paused', { name: c.name }))}>{t('actions.pause')}</Button>
                    )}
                    {current?.status === 'paused' && (
                      <Button size="sm" variant="ghost" icon={<LuPlay />} disabled={busy}
                        onClick={() => act(() => foodApi.resume(current.id), t('toast.resumed', { name: c.name }))}>{t('actions.resume')}</Button>
                    )}
                  </div>
                )}
              </div>
              {current?.status === 'paused' && current.pausedAt && (
                <p className="m-0 mt-2 text-xs text-info-text">{t('detail.pausedSince', { date: shortDate(current.pausedAt) })}</p>
              )}
            </div>
          )}
          {!c.current && canManage && (
            <Button icon={<LuRefreshCw />} onClick={() => onRenew(c)}>{t('actions.subscribe')}</Button>
          )}

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" icon={<LuPencil />} onClick={() => onEdit(c)}>{t('actions.edit')}</Button>
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line2 px-3 py-1.5 text-sm text-ink2 hover:border-gold hover:text-gold no-underline">
                <LuPhone size={14} aria-hidden /> {t('actions.call')}
              </a>
              {data.canDelete && <Button size="sm" variant="danger" icon={<LuTrash2 />} onClick={() => onDelete(c)}>{t('actions.delete')}</Button>}
            </div>
          )}

          <dl className="m-0 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5">
            <Item label={t('form.phone')}><a href={`tel:${c.phone}`} className="text-ink hover:text-gold">{c.phone}</a></Item>
            <Item label={t('form.email')}>{c.email}</Item>
            <Item label={t('detail.booking')}>{c.booking && `${c.booking.bookingNo} · ${t(`bookingStatus.${c.booking.status}`, { defaultValue: c.booking.status })}`}</Item>
            <Item label={t('detail.since')}>{shortDate(c.createdAt)}</Item>
            <Item label={t('form.address')} wide>{c.address}</Item>
            <Item label={t('form.notes')} wide>{c.notes}</Item>
          </dl>

          <div className="pt-4 border-t border-line">
            <div className="text-xs font-semibold text-ink2 mb-2.5">{t('detail.recentMeals')}</div>
            {mealDays.length ? (
              <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5">
                {mealDays.map((d) => (
                  <li key={d.key} className="rounded-lg bg-surface2 px-2.5 py-1 text-xs text-ink2">
                    {shortDate(d.date)} <span aria-label={d.meals.map((m) => t(`meals.${m}`)).join(', ')}>{d.meals.map((m) => MEAL_ICONS[m]).join('')}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="m-0 text-sm text-ink3">{t('detail.noMeals')}</p>}
          </div>

          <div className="pt-4 border-t border-line">
            <div className="text-xs font-semibold text-ink2 mb-2.5">{t('detail.history')}</div>
            {!c.subscriptions.length && <p className="m-0 text-sm text-ink3">{t('detail.noPlans')}</p>}
            <ol className="m-0 p-0 list-none space-y-2.5">
              {c.subscriptions.map((s) => {
                const phase = phaseOf(s)
                return (
                  <li key={s.id} className={`rounded-lg border border-line px-3.5 py-3 ${phase === 'cancelled' ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-ink text-sm">{s.planName}</span>
                          <StatusPill status={phase} />
                          {s.isRenewal && <span className="text-[11px] text-ink3">{t('detail.renewal')}</span>}
                          {s.bookingId && <span className="text-[11px] text-ink3">{t('detail.withBooking')}</span>}
                        </div>
                        <div className="text-xs text-ink2 mt-0.5">
                          {cycleLabel(t, s.cycle, s.units)} · {shortDate(s.startDate)} → {shortDate(s.endDate)}
                          {s.pausedDays > 0 && ` · ${t('detail.pausedDays', { count: s.pausedDays })}`}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums">
                        <div className="text-ink">{formatCurrency(s.price - s.discount)}{s.discount > 0 && <span className="text-ink3"> ({t('detail.off', { amount: formatCurrency(s.discount) })})</span>}</div>
                        <div className={s.due > 0 ? 'text-danger-text font-semibold' : 'text-success-text'}>
                          {s.due > 0 ? t('detail.dueAmount', { amount: formatCurrency(s.due) }) : phase === 'cancelled' ? '' : t('detail.paidFull')}
                        </div>
                      </div>
                    </div>
                    {s.payments?.length > 0 && (
                      <ul className="m-0 mt-2 p-0 list-none flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink3">
                        {s.payments.map((p) => (
                          <li key={p.id}>{formatCurrency(p.amount)} · {t(`payModes.${p.mode}`)} · {shortDate(p.paidAt)}</li>
                        ))}
                      </ul>
                    )}
                    {canManage && phase !== 'cancelled' && (s.due > 0 || data.canDelete) && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {s.due > 0 && (
                          <Button size="sm" icon={<LuIndianRupee />} disabled={busy} onClick={() => onPay(c, s)}>
                            {t('actions.collect', { amount: formatCurrency(s.due) })}
                          </Button>
                        )}
                        {data.canDelete && (
                          <Button size="sm" variant="ghost" icon={<LuX />} disabled={busy}
                            onClick={() => window.confirm(t('detail.cancelConfirm', { plan: s.planName }))
                              && act(() => foodApi.cancel(s.id), t('toast.cancelled'))}>
                            {t('actions.cancelPlan')}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  )
}
