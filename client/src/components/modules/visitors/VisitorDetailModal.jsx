import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LuLogIn, LuLogOut, LuX, LuPencil, LuTrash2, LuPrinter, LuShieldBan, LuShieldCheck, LuTriangleAlert,
} from 'react-icons/lu'
import Modal from '../../ui/Modal'
import { Button } from '../../ui-tw'
import { visitorsApi } from '../../../api/client'
import { formatDateTime } from '../../../utils/format'
import { STATUS_TONE, formatDuration } from './visitorUtils'

function Item({ label, children, wide }) {
  if (children == null || children === '' || children === false) return null
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs text-ink3 mb-0.5">{label}</dt>
      <dd className="m-0 text-sm text-ink break-words whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

function Step({ done, tone = 'bg-gold', label, time, by }) {
  return (
    <li className="relative pl-6 pb-3 last:pb-0">
      <span aria-hidden className={`absolute left-0 top-1 w-3 h-3 rounded-full ${done ? tone : 'bg-line2'}`} />
      <div className={`text-sm ${done ? 'text-ink font-medium' : 'text-ink3'}`}>{label}</div>
      {time && <div className="text-xs text-ink3">{formatDateTime(time)}{by ? ` · ${by}` : ''}</div>}
    </li>
  )
}

/**
 * One visitor: details, timeline (registered → in → out) and actions.
 * `visitor` is the list row (shown at once); the full record — the unmasked ID,
 * who handled it, visit count, block state — comes from GET /visitors/:id.
 */
export default function VisitorDetailModal({
  visitor: row, canManage, busy, onClose, onCheckIn, onCheckOut, onReject, onEdit, onDelete, onBlock, onUnblock, onPrint,
}) {
  const { t } = useTranslation('visitors')
  const [info, setInfo] = useState(null) // { visitor, visits, blocked, canDelete }
  const [error, setError] = useState('')

  useEffect(() => {
    let off = false
    visitorsApi.get(row.id)
      .then(({ data }) => { if (!off) setInfo(data) })
      .catch(() => { if (!off) setError(t('detail.loadError')) })
    return () => { off = true }
  }, [row.id, row.updatedAt, t])

  const v = { ...row, ...info?.visitor }
  const blocked = info?.blocked
  const waiting = v.status === 'pending' || v.status === 'expected'
  const inside = v.status === 'checked_in'
  const by = (name) => (name ? t('detail.by', { name }) : null)

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('detail.title')}
      maxWidth="600px"
      footer={canManage ? <>
        {waiting && <Button variant="danger" icon={<LuX />} disabled={busy} onClick={() => onReject(v)}>{t('actions.reject')}</Button>}
        {waiting && (
          <Button icon={<LuLogIn />} disabled={busy} onClick={() => onCheckIn(v)}>
            {v.status === 'pending' ? t('actions.approve') : t('actions.checkIn')}
          </Button>
        )}
        {inside && <Button variant="ghost" icon={<LuPrinter />} onClick={() => onPrint(v)}>{t('actions.printBadge')}</Button>}
        {inside && <Button icon={<LuLogOut />} disabled={busy} onClick={() => onCheckOut(v)}>{t('actions.checkOut')}</Button>}
        {!waiting && !inside && <Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>}
      </> : <Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span aria-hidden className="w-11 h-11 shrink-0 rounded-full bg-gold-bg text-gold flex items-center justify-center font-bold text-[16px]">
            {(v.name || '?').trim().charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[16px] text-ink break-words">{v.name}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] font-semibold">
              <span className={`rounded-full px-2 py-px ${STATUS_TONE[v.status] || STATUS_TONE.checked_out}`}>{t(`status.${v.status}`)}</span>
              <span className="rounded-full px-2 py-px bg-surface2 text-ink2">{t(`source.${v.source}`)}</span>
              {(blocked || v.flagged) && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-px bg-danger-bg text-danger-text"><LuShieldBan size={11} /> {t('flagged')}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-ink3">{t('detail.pass')}</div>
            <div className="font-mono font-bold text-[15px] text-ink">{v.passNo}</div>
          </div>
        </div>

        {blocked && (
          <div role="alert" className="flex gap-2 rounded-lg px-3 py-2.5 text-sm bg-danger-bg text-danger-text">
            <LuTriangleAlert className="shrink-0 mt-0.5" aria-hidden />
            <span>{t('flaggedHint')}{blocked.reason ? ` — ${blocked.reason}` : ''}</span>
          </div>
        )}
        {v.status === 'rejected' && v.rejectReason && (
          <div className="rounded-lg px-3 py-2 text-sm bg-danger-bg text-danger-text">{t('detail.rejected')}: {v.rejectReason}</div>
        )}
        {error && <div className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{error}</div>}

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<LuPencil />} disabled={busy} onClick={() => onEdit(v)}>{t('actions.edit')}</Button>
            {!inside && v.status !== 'rejected' && v.status !== 'expected' && (
              <Button size="sm" variant="ghost" icon={<LuPrinter />} onClick={() => onPrint(v)}>{t('actions.printBadge')}</Button>
            )}
            {info && (blocked
              ? <Button size="sm" variant="ghost" icon={<LuShieldCheck />} disabled={busy} onClick={() => onUnblock(v)}>{t('actions.unblock')}</Button>
              : <Button size="sm" variant="ghost" icon={<LuShieldBan />} disabled={busy} onClick={() => onBlock(v)}>{t('actions.block')}</Button>)}
            {info?.canDelete && (
              <Button size="sm" variant="danger" icon={<LuTrash2 />} disabled={busy} onClick={() => onDelete(v)}>{t('actions.delete')}</Button>
            )}
          </div>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5 m-0">
          <Item label={t('detail.phone')}><a href={`tel:${v.phone}`} className="text-ink hover:text-gold">{v.phone}</a></Item>
          <Item label={t('detail.email')}>{v.email}</Item>
          <Item label={t('detail.purpose')}>{t(`purposes.${v.purpose}`, { defaultValue: v.purpose })}</Item>
          <Item label={t('detail.company')}>{v.company}</Item>
          <Item label={t('detail.host')}>{v.hostName}</Item>
          <Item label={t('detail.room')}>{v.roomNumber}</Item>
          <Item label={t('detail.companions')}>{v.companions > 0 ? v.companions : null}</Item>
          <Item label={t('detail.id')}>{v.idType ? `${t(`idTypes.${v.idType}`)}${v.idNumber ? ` · ${v.idNumber}` : ''}` : null}</Item>
          <Item label={t('detail.vehicle')}>{v.vehicleNo}</Item>
          <Item label={t('detail.visits')}>{info?.visits > 1 ? info.visits : null}</Item>
          <Item label={t('detail.notes')} wide>{v.notes}</Item>
        </dl>

        <div className="pt-4 border-t border-line">
          <div className="text-xs font-semibold text-ink2 mb-2.5">{t('detail.timeline')}</div>
          <ol className="m-0 p-0 list-none">
            <Step done label={t('detail.registered')} time={v.createdAt}
              by={v.source === 'qr' ? t('detail.selfQr') : by(v.createdByName)} />
            {v.expectedAt && <Step done tone="bg-info" label={t('detail.expected')} time={v.expectedAt} />}
            {v.status === 'rejected'
              ? <Step done tone="bg-danger" label={t('detail.rejected')} time={v.updatedAt} />
              : <>
                  <Step done={!!v.checkInAt} tone="bg-success" label={t('detail.checkedIn')} time={v.checkInAt} by={by(v.checkedInByName)} />
                  <Step done={!!v.checkOutAt} label={t('detail.checkedOut')} time={v.checkOutAt} />
                </>}
          </ol>
          {v.checkInAt && (
            <div className="mt-3 text-xs text-ink3">{t('detail.duration')}: <span className="font-semibold text-ink2">{formatDuration(v.checkInAt, v.checkOutAt || new Date())}</span></div>
          )}
          {v.consentAt && <div className="mt-1 text-xs text-ink3">{t('detail.consent', { time: formatDateTime(v.consentAt) })}</div>}
        </div>

        {canManage && info && !info.canDelete && <p className="m-0 text-xs text-ink3">{t('detail.noDeleteHint')}</p>}
      </div>
    </Modal>
  )
}
