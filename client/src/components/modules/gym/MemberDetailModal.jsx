import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LuRefreshCw, LuIndianRupee, LuPause, LuPlay, LuPencil, LuTrash2, LuPhone, LuX, LuBedDouble, LuHeartPulse,
} from 'react-icons/lu'
import { Modal, Button } from '../../ui-tw'
import { gymApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import { STATUS_TONE, daysLeftLabel, durationLabel, shortDate, initials } from './gymUtils'

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
  const { t } = useTranslation('gym')
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${STATUS_TONE[status] || STATUS_TONE.no_plan}`}>
      {t(`status.${status}`)}
    </span>
  )
}

// Where a membership sits in time, for its badge in the history.
const phaseOf = (ms) => {
  if (ms.status === 'cancelled') return 'cancelled'
  if (ms.status === 'frozen') return 'frozen'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (new Date(ms.startDate) > today) return 'upcoming'
  if (new Date(ms.endDate) < today) return 'expired'
  return 'active'
}

/**
 * One member: profile, plan history with payments, and the desk actions —
 * renew, collect dues, freeze / unfreeze, cancel a plan (admin), edit, delete.
 */
export default function MemberDetailModal({ memberId, canManage, onClose, onEdit, onRenew, onPay, onDelete, onChanged, reloadKey }) {
  const { t } = useTranslation('gym')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    gymApi.member(memberId).then(({ data: d }) => setData(d)).catch(() => setError(t('detail.loadError')))
  }, [memberId, t])
  useEffect(() => { load() }, [load, reloadKey])

  const act = async (fn, okMsg) => {
    setBusy(true)
    try { await fn(); load(); onChanged(okMsg) } catch (err) { setError(err.response?.data?.message || t('toast.failed')) } finally { setBusy(false) }
  }

  const m = data?.member
  const current = m?.memberships?.find((x) => x.id === m.current?.id)

  return (
    <Modal isOpen onClose={onClose} size="lg" title={t('detail.title')}
      footer={<Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>}>
      {!m ? (
        <p className="m-0 text-sm text-ink3 py-8 text-center">{error || t('common:loading')}</p>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span aria-hidden className="w-12 h-12 shrink-0 rounded-full bg-gold-bg text-gold flex items-center justify-center font-bold text-[16px]">{initials(m.name)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[17px] text-ink break-words">{m.name}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                <StatusPill status={m.status} />
                {m.guest && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-violet-bg text-violet-text font-semibold">
                    <LuBedDouble size={11} aria-hidden /> {m.guest.room?.number ? t('room', { room: m.guest.room.number }) : t('sources.guest')}
                  </span>
                )}
                <span className="text-ink3">{m.memberNo}</span>
              </div>
            </div>
            {m.due > 0 && (
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-ink3">{t('detail.due')}</div>
                <div className="font-bold text-[16px] text-danger-text tabular-nums">{formatCurrency(m.due)}</div>
              </div>
            )}
          </div>

          {error && <div role="alert" className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{error}</div>}

          {/* Current plan */}
          {m.current && (
            <div className="rounded-xl border border-line bg-surface2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-ink3">{t('detail.currentPlan')}</div>
                  <div className="font-semibold text-ink">{m.current.planName} · {durationLabel(t, m.current.durationDays)}</div>
                  <div className="text-xs text-ink2 mt-0.5">{shortDate(m.current.startDate)} → {shortDate(m.current.endDate)} · {daysLeftLabel(t, m)}</div>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" icon={<LuRefreshCw />} disabled={busy} onClick={() => onRenew(m)}>{m.status === 'no_plan' ? t('actions.sellPlan') : t('actions.renew')}</Button>
                    {current?.status === 'active' && phaseOf(current) === 'active' && (
                      <Button size="sm" variant="ghost" icon={<LuPause />} disabled={busy}
                        onClick={() => act(() => gymApi.freeze(current.id), t('toast.frozen', { name: m.name }))}>{t('actions.freeze')}</Button>
                    )}
                    {current?.status === 'frozen' && (
                      <Button size="sm" variant="ghost" icon={<LuPlay />} disabled={busy}
                        onClick={() => act(() => gymApi.unfreeze(current.id), t('toast.unfrozen', { name: m.name }))}>{t('actions.unfreeze')}</Button>
                    )}
                  </div>
                )}
              </div>
              {current?.status === 'frozen' && current.frozenAt && (
                <p className="m-0 mt-2 text-xs text-info-text">{t('detail.frozenSince', { date: shortDate(current.frozenAt) })}</p>
              )}
            </div>
          )}
          {!m.current && canManage && (
            <Button icon={<LuRefreshCw />} onClick={() => onRenew(m)}>{t('actions.sellPlan')}</Button>
          )}

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" icon={<LuPencil />} onClick={() => onEdit(m)}>{t('actions.edit')}</Button>
              <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line2 px-3 py-1.5 text-sm text-ink2 hover:border-gold hover:text-gold no-underline">
                <LuPhone size={14} aria-hidden /> {t('actions.call')}
              </a>
              {data.canDelete && <Button size="sm" variant="danger" icon={<LuTrash2 />} onClick={() => onDelete(m)}>{t('actions.delete')}</Button>}
            </div>
          )}

          {/* Profile */}
          <dl className="m-0 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5">
            <Item label={t('form.phone')}><a href={`tel:${m.phone}`} className="text-ink hover:text-gold">{m.phone}</a></Item>
            <Item label={t('form.email')}>{m.email}</Item>
            <Item label={t('form.gender')}>{m.gender && t(`genders.${m.gender}`)}</Item>
            <Item label={t('form.dob')}>{m.dob && shortDate(m.dob)}</Item>
            <Item label={t('form.goal')}>{m.goal && t(`goals.${m.goal}`)}</Item>
            <Item label={t('form.joinedAt')}>{shortDate(m.joinedAt)}</Item>
            <Item label={t('form.source')}>{t(`sources.${m.source}`, { defaultValue: m.source })}</Item>
            <Item label={t('form.idNumber')}>{m.idType ? `${t(`idTypes.${m.idType}`, { defaultValue: m.idType })}${m.idNumber ? ` · ${m.idNumber}` : ''}` : null}</Item>
            <Item label={t('form.emergency')}>{[m.emergencyName, m.emergencyPhone].filter(Boolean).join(' · ')}</Item>
            <Item label={t('form.address')} wide>{m.address}</Item>
            <Item label={t('form.notes')} wide>{m.notes}</Item>
          </dl>
          {m.healthNotes && (
            <div className="flex gap-2 rounded-lg px-3 py-2.5 text-sm bg-warning-bg text-warning-text">
              <LuHeartPulse className="shrink-0 mt-0.5" aria-hidden />
              <span><b>{t('form.healthNotes')}:</b> {m.healthNotes}</span>
            </div>
          )}

          {/* Plan history */}
          <div className="pt-4 border-t border-line">
            <div className="text-xs font-semibold text-ink2 mb-2.5">{t('detail.history')}</div>
            {!m.memberships.length && <p className="m-0 text-sm text-ink3">{t('detail.noPlans')}</p>}
            <ol className="m-0 p-0 list-none space-y-2.5">
              {m.memberships.map((ms) => {
                const phase = phaseOf(ms)
                return (
                  <li key={ms.id} className={`rounded-lg border border-line px-3.5 py-3 ${phase === 'cancelled' ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-ink text-sm">{ms.planName}</span>
                          <StatusPill status={phase} />
                          {ms.isRenewal && <span className="text-[11px] text-ink3">{t('detail.renewal')}</span>}
                        </div>
                        <div className="text-xs text-ink2 mt-0.5">
                          {shortDate(ms.startDate)} → {shortDate(ms.endDate)}
                          {ms.frozenDays > 0 && ` · ${t('detail.frozenDays', { count: ms.frozenDays })}`}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums">
                        <div className="text-ink">{formatCurrency(ms.price - ms.discount)}{ms.discount > 0 && <span className="text-ink3"> ({t('detail.off', { amount: formatCurrency(ms.discount) })})</span>}</div>
                        <div className={ms.due > 0 ? 'text-danger-text font-semibold' : 'text-success-text'}>
                          {ms.due > 0 ? t('detail.dueAmount', { amount: formatCurrency(ms.due) }) : t('detail.paidFull')}
                        </div>
                      </div>
                    </div>
                    {ms.payments?.length > 0 && (
                      <ul className="m-0 mt-2 p-0 list-none flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink3">
                        {ms.payments.map((p) => (
                          <li key={p.id}>{formatCurrency(p.amount)} · {t(`payModes.${p.mode}`)} · {shortDate(p.paidAt)}</li>
                        ))}
                      </ul>
                    )}
                    {canManage && phase !== 'cancelled' && (ms.due > 0 || data.canDelete) && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {ms.due > 0 && (
                          <Button size="sm" icon={<LuIndianRupee />} disabled={busy} onClick={() => onPay(m, ms)}>
                            {t('actions.collect', { amount: formatCurrency(ms.due) })}
                          </Button>
                        )}
                        {data.canDelete && (
                          <Button size="sm" variant="ghost" icon={<LuX />} disabled={busy}
                            onClick={() => window.confirm(t('detail.cancelConfirm', { plan: ms.planName }))
                              && act(() => gymApi.cancel(ms.id), t('toast.cancelled'))}>
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
