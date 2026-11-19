import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LuPlay, LuPause, LuCircleCheck, LuCircleCheckBig, LuRotateCcw, LuBan, LuHand, LuPencil, LuTrash2,
  LuSend, LuPlus, LuX, LuMessageSquare, LuListChecks, LuInfo,
} from 'react-icons/lu'
import Modal from '../../ui/Modal'
import { Button } from '../../ui-tw'
import { ticketsApi } from '../../../api/client'
import { formatDateTime } from '../../../utils/format'
import { assigneeOptions, timeAgo, formatWhen } from './ticketUtils'
import { Avatar, StatusPill, PriorityPill, Due } from './TicketBits'

// Workflow buttons, in the order they are offered. `note`: ask for a note
// first ('required' blocks an empty one).
const STEPS = [
  { id: 'take',    icon: <LuHand />, variant: 'primary' },
  { id: 'start',   icon: <LuPlay />, variant: 'primary' },
  { id: 'resume',  icon: <LuPlay />, variant: 'primary' },
  { id: 'resolve', icon: <LuCircleCheck />, variant: 'success', note: 'optional' },
  { id: 'verify',  icon: <LuCircleCheckBig />, variant: 'success' },
  { id: 'hold',    icon: <LuPause />, variant: 'ghost', note: 'required' },
  { id: 'reopen',  icon: <LuRotateCcw />, variant: 'ghost', note: 'required' },
  { id: 'cancel',  icon: <LuBan />, variant: 'danger', note: 'optional' },
]

function Meta({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-ink3 mb-1">{label}</dt>
      <dd className="m-0 text-sm text-ink break-words">{children}</dd>
    </div>
  )
}

// One line of the activity log.
function ActivityLine({ a }) {
  const { t } = useTranslation('tickets')
  const who = a.userName || t('activity.someone')
  if (a.type === 'comment') {
    return (
      <li className="flex gap-2.5">
        <Avatar name={who} size={28} />
        <div className="flex-1 min-w-0 rounded-xl rounded-tl-sm bg-surface2 border border-line px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink">{who}</span>
            <time className="text-[11px] text-ink3" title={formatDateTime(a.createdAt)}>{formatWhen(a.createdAt)}</time>
          </div>
          <p className="m-0 mt-0.5 text-sm text-ink2 whitespace-pre-wrap break-words">{a.message}</p>
        </div>
      </li>
    )
  }
  const st = (s) => t(`status.${s}`, { defaultValue: s })
  let text
  switch (a.type) {
    case 'created': text = t('activity.created'); break
    case 'assigned':
      text = !a.toValue ? t('activity.unassigned', { from: a.fromName || t('activity.nobody') })
        : a.fromValue ? t('activity.reassigned', { from: a.fromName || t('activity.someone'), to: a.toName || t('activity.someone') })
          : t('activity.assigned', { to: a.toName || t('activity.someone') })
      break
    case 'status': text = a.fromValue ? t('activity.statusFrom', { from: st(a.fromValue), to: st(a.toValue) }) : t('activity.status', { to: st(a.toValue) }); break
    case 'priority': text = t('activity.priority', { to: t(`priority.${a.toValue}`, { defaultValue: a.toValue }) }); break
    case 'due': text = a.toValue ? t('activity.due', { to: formatWhen(a.toValue) }) : t('activity.dueCleared'); break
    case 'checklist': text = t(a.toValue === 'done' ? 'activity.checkDone' : 'activity.checkUndone', { item: a.message }); break
    default: text = t('activity.edited')
  }
  return (
    <li className="flex gap-2.5 items-start">
      <span aria-hidden className="w-7 shrink-0 flex justify-center pt-1.5"><span className="w-2 h-2 rounded-full bg-line2" /></span>
      <div className="flex-1 min-w-0 text-[13px] text-ink2 leading-snug">
        <span className="font-semibold text-ink">{who}</span> {text}
        {a.type === 'status' && a.message && <span className="block mt-0.5 text-ink3 italic break-words">“{a.message}”</span>}
        <time className="ml-1.5 text-[11px] text-ink3" title={formatDateTime(a.createdAt)}>· {timeAgo(a.createdAt)}</time>
      </div>
    </li>
  )
}

/**
 * One ticket: workflow buttons for the steps this user may take, the checklist,
 * reassignment and the activity log with comments. Every change returns the
 * fresh ticket; `onChanged` tells the list to refresh.
 */
export default function TicketDetail({ ticketId, assignees, meId, onClose, onChanged, onEdit, onDelete, toast }) {
  const { t } = useTranslation('tickets')
  const [data, setData] = useState(null) // { ticket, checklist, activity, can }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [noteFor, setNoteFor] = useState(null) // step needing a note
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [comment, setComment] = useState('')
  const [step, setStep] = useState('')

  useEffect(() => {
    let off = false
    ticketsApi.get(ticketId).then(({ data: d }) => { if (!off) setData(d) }).catch(() => { if (!off) setError(t('detail.loadError')) })
    return () => { off = true }
  }, [ticketId, t])

  // Runs one change; the response is the updated ticket.
  const run = async (call, msg) => {
    setBusy(true)
    try {
      const { data: d } = await call()
      setData(d)
      if (msg) toast(typeof msg === 'function' ? msg(d) : msg)
      onChanged()
      return true
    } catch (e) {
      toast(e.response?.data?.message || t('toast.failed'), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const doStep = async (s, noteText) => {
    if (s.id === 'take') return run(() => ticketsApi.assign(ticketId, meId), (d) => t('toast.taken', { no: d.ticket.ticketNo }))
    const ok = await run(() => ticketsApi.status(ticketId, s.id, noteText || undefined),
      (d) => t('toast.status', { no: d.ticket.ticketNo, status: t(`status.${d.ticket.status}`) }))
    if (ok) { setNoteFor(null); setNote('') }
  }

  const onStep = (s) => {
    if (s.note) { setNoteFor(s); setNote(''); setNoteError('') } else doStep(s)
  }

  const confirmNote = () => {
    if (noteFor.note === 'required' && !note.trim()) { setNoteError(t('note.required')); return }
    doStep(noteFor, note.trim())
  }

  const send = async () => {
    const m = comment.trim()
    if (!m) return
    if (await run(() => ticketsApi.comment(ticketId, m))) setComment('')
  }

  const addStep = async () => {
    const s = step.trim()
    if (!s) return
    if (await run(() => ticketsApi.addStep(ticketId, s))) setStep('')
  }

  if (!data) {
    return (
      <Modal isOpen onClose={onClose} title={t('title')} size="lg">
        {error ? <div className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{error}</div>
          : <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-line animate-pulse" />)}</div>}
      </Modal>
    )
  }

  const { ticket: tk, checklist, activity, can } = data
  const steps = STEPS.filter((s) => can[s.id])
  const done = checklist.filter((c) => c.done).length

  return (
    <Modal isOpen onClose={onClose} size="lg"
      title={<span className="flex items-center gap-2 min-w-0"><span className="font-mono text-ink3 text-[14px]">{tk.ticketNo}</span></span>}
      footer={<>
        {can.delete && <Button variant="danger" icon={<LuTrash2 />} disabled={busy} onClick={() => onDelete(tk)}>{t('actions.delete')}</Button>}
        {can.edit && <Button variant="ghost" icon={<LuPencil />} disabled={busy} onClick={() => onEdit(tk)}>{t('actions.edit')}</Button>}
        <Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>
      </>}>
      <div className="space-y-5">
        {/* Title + state */}
        <div>
          <h2 className="m-0 text-[19px] font-bold text-ink leading-snug break-words">{tk.title}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusPill status={tk.status} />
            <PriorityPill priority={tk.priority} />
            <span className="text-xs text-ink3">{t(`categories.${tk.category}`, { defaultValue: tk.category })}</span>
            {tk.reopenCount > 0 && <span className="text-xs text-warning-text font-medium">· {t('detail.reopened', { count: tk.reopenCount })}</span>}
          </div>
        </div>

        {/* Workflow */}
        {steps.length > 0 && (
          <div className="rounded-xl border border-line bg-surface2/60 p-3">
            {tk.status === 'resolved' && can.verify && (
              <p className="m-0 mb-2.5 flex gap-2 text-[13px] text-violet-text"><LuInfo className="shrink-0 mt-0.5" aria-hidden />{t('detail.verifyHint')}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <Button key={s.id} size="sm" variant={s.variant} icon={s.icon} disabled={busy}
                  onClick={() => onStep(s)} aria-pressed={noteFor?.id === s.id}>
                  {t(`actions.${s.id}`)}
                </Button>
              ))}
            </div>
            {noteFor && (
              <div className="mt-3 space-y-2">
                <label className="block">
                  <span className="block text-xs font-medium text-ink2 mb-1">{t(`note.${noteFor.id}`)}</span>
                  <textarea rows={2} autoFocus maxLength={1000} value={note} onChange={(e) => { setNote(e.target.value); setNoteError('') }}
                    className="w-full bg-surface border border-line2 rounded-lg px-3 py-2 text-base sm:text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" />
                </label>
                {noteError && <p className="m-0 text-xs text-danger-text">{noteError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant={noteFor.variant === 'danger' ? 'danger' : 'primary'} disabled={busy} onClick={confirmNote}>
                    {t(`actions.${noteFor.id}`)}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setNoteFor(null)}>{t('common:cancel')}</Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-5">
          {/* Main column */}
          <div className="min-w-0 space-y-5 order-2 md:order-1">
            <section>
              <h3 className="m-0 mb-1.5 text-xs font-semibold text-ink2">{t('detail.description')}</h3>
              <p className={`m-0 text-sm whitespace-pre-wrap break-words ${tk.description ? 'text-ink' : 'text-ink3'}`}>{tk.description || t('detail.noDescription')}</p>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="m-0 text-xs font-semibold text-ink2 inline-flex items-center gap-1.5"><LuListChecks aria-hidden /> {t('detail.checklist')}</h3>
                {checklist.length > 0 && <span className="text-xs text-ink3">{t('detail.checklistProgress', { done, total: checklist.length })}</span>}
              </div>
              {checklist.length > 0 && (
                <div className="h-1.5 rounded-full bg-line mb-2.5 overflow-hidden">
                  <div className="h-full bg-success transition-all" style={{ width: `${(done / checklist.length) * 100}%` }} />
                </div>
              )}
              {checklist.length === 0 && !can.checklist && <p className="m-0 text-sm text-ink3">{t('detail.noChecklist')}</p>}
              <ul className="m-0 p-0 list-none space-y-1">
                {checklist.map((c) => (
                  <li key={c.id} className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface2">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--green)] cursor-pointer disabled:cursor-default"
                      checked={c.done} disabled={!can.checklist || busy} aria-label={c.text}
                      onChange={(e) => run(() => ticketsApi.updateStep(ticketId, c.id, { done: e.target.checked }))} />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm break-words ${c.done ? 'line-through text-ink3' : 'text-ink'}`}>{c.text}</span>
                      {c.done && c.doneByName && <span className="block text-[11px] text-ink3">{c.doneByName} · {formatWhen(c.doneAt)}</span>}
                    </div>
                    {can.checklist && (
                      <button type="button" aria-label={t('form.removeStep')} title={t('form.removeStep')} disabled={busy}
                        onClick={() => run(() => ticketsApi.removeStep(ticketId, c.id))}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 bg-transparent border-0 p-1 cursor-pointer text-ink3 hover:text-danger-text">
                        <LuX size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {can.checklist && (
                <div className="flex gap-2 mt-2">
                  <input value={step} onChange={(e) => setStep(e.target.value)} maxLength={200} placeholder={t('form.stepPlaceholder')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }}
                    className="flex-1 min-w-0 bg-surface border border-line2 rounded-lg px-3 py-1.5 text-base sm:text-sm text-ink min-h-11 sm:min-h-0 placeholder:text-ink3 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" />
                  <Button size="sm" variant="ghost" icon={<LuPlus />} disabled={busy || !step.trim()} onClick={addStep}>{t('form.addStep')}</Button>
                </div>
              )}
            </section>

            <section>
              <h3 className="m-0 mb-2.5 text-xs font-semibold text-ink2 inline-flex items-center gap-1.5"><LuMessageSquare aria-hidden /> {t('detail.activity')}</h3>
              <ol className="m-0 p-0 list-none space-y-3">
                {activity.map((a) => <ActivityLine key={a.id} a={a} />)}
              </ol>
              <div className="mt-3 flex gap-2 items-end">
                <textarea rows={2} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder={t('detail.commentPlaceholder')} aria-label={t('detail.comment')}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
                  className="flex-1 min-w-0 bg-surface border border-line2 rounded-lg px-3 py-2 text-base sm:text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" />
                <Button icon={<LuSend />} disabled={busy || !comment.trim()} onClick={send}>{t('detail.comment')}</Button>
              </div>
            </section>
          </div>

          {/* Side panel */}
          <dl className="order-1 md:order-2 m-0 grid grid-cols-2 md:grid-cols-1 gap-4 content-start rounded-xl border border-line p-4 h-fit">
            <Meta label={t('detail.assignee')}>
              <span className="flex items-center gap-2">
                <Avatar name={tk.assigneeName} size={24} muted={!tk.assigneeId} />
                <span className={tk.assigneeId ? '' : 'text-ink3'}>{tk.assigneeName || t('table.unassigned')}</span>
              </span>
              {can.assign && (
                <select aria-label={t('detail.reassign')} disabled={busy} value={tk.assigneeId || ''}
                  onChange={(e) => run(() => ticketsApi.assign(ticketId, e.target.value || null),
                    (d) => (d.ticket.assigneeName ? t('toast.assigned', { name: d.ticket.assigneeName }) : t('toast.unassigned')))}
                  className="mt-2 w-full bg-surface border border-line2 rounded-lg px-2 py-1.5 text-base sm:text-xs text-ink2 min-h-11 sm:min-h-0 focus:outline-none focus:border-gold">
                  <option value="">{t('form.nobody')}</option>
                  {assigneeOptions(assignees, meId, t).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </Meta>
            <Meta label={t('detail.raisedBy')}>
              <span className="flex items-center gap-2"><Avatar name={tk.createdByName} size={24} />{tk.createdByName || '—'}</span>
            </Meta>
            <Meta label={t('detail.due')}><Due ticket={tk} /></Meta>
            {tk.roomNumber && <Meta label={t('detail.room')}>{tk.roomNumber}</Meta>}
            <Meta label={t('detail.created')}>{formatDateTime(tk.createdAt)}</Meta>
            {tk.startedAt && <Meta label={t('detail.started')}>{formatDateTime(tk.startedAt)}</Meta>}
            {tk.resolvedAt && <Meta label={t('detail.resolved')}>{formatDateTime(tk.resolvedAt)}</Meta>}
            {tk.closedAt && <Meta label={t('detail.closed')}>{formatDateTime(tk.closedAt)}</Meta>}
          </dl>
        </div>
      </div>
    </Modal>
  )
}
