import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuPlus, LuX, LuSave } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import { Button, Field } from '../../ui-tw'
import { ticketsApi } from '../../../api/client'
import { CATEGORIES, PRIORITIES, assigneeOptions, localInput, suggestedDue } from './ticketUtils'

/**
 * Raise a ticket (with an optional checklist) or edit one's details.
 * Assigning on edit and status changes happen in the ticket view.
 */
export default function TicketModal({ ticket, assignees, meId, onClose, onSaved }) {
  const { t } = useTranslation('tickets')
  const editing = !!ticket?.id
  const [form, setForm] = useState(() => ({
    title: ticket?.title || '',
    description: ticket?.description || '',
    category: ticket?.category || 'general',
    priority: ticket?.priority || 'medium',
    assigneeId: '',
    dueAt: ticket ? (ticket.dueAt ? localInput(ticket.dueAt) : '') : suggestedDue('medium'),
    roomNumber: ticket?.roomNumber || '',
  }))
  // Until the due date is touched it follows the priority's suggested time.
  const [dueTouched, setDueTouched] = useState(editing)
  const [steps, setSteps] = useState([])
  const [step, setStep] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => {
    const value = e.target.value
    setForm((f) => ({
      ...f, [k]: value,
      ...(k === 'priority' && !dueTouched ? { dueAt: suggestedDue(value) } : {}),
    }))
    if (k === 'dueAt') setDueTouched(true)
  }

  const addStep = () => {
    const s = step.trim()
    if (!s) return
    setSteps((x) => [...x, s].slice(0, 30))
    setStep('')
  }

  const submit = async (ev) => {
    ev?.preventDefault()
    if (form.title.trim().length < 3) { setErrors({ title: t('form.errors.title') }); return }
    setErrors({}); setApiError(''); setSaving(true)
    const body = {
      title: form.title.trim(), description: form.description.trim(), category: form.category,
      priority: form.priority, roomNumber: form.roomNumber.trim(),
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    }
    try {
      const pending = step.trim() ? [...steps, step.trim()] : steps
      const { data } = editing
        ? await ticketsApi.update(ticket.id, body)
        : await ticketsApi.create({ ...body, assigneeId: form.assigneeId || null, checklist: pending })
      onSaved(data, editing)
    } catch (err) {
      const d = err.response?.data
      if (d?.details?.length) setErrors(Object.fromEntries(d.details.map((x) => [x.field, x.message])))
      else setApiError(d?.message || t('toast.failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={editing ? t('form.editTitle') : t('form.newTitle')} maxWidth="640px"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={editing ? <LuSave /> : <LuPlus />} onClick={submit} disabled={saving}>
          {saving ? t('common:saving') : editing ? t('form.save') : t('form.create')}
        </Button>
      </>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && <div role="alert" className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{apiError}</div>}
        <Field label={t('form.title')} required autoFocus value={form.title} onChange={set('title')} error={errors.title}
          placeholder={t('form.titlePlaceholder')} maxLength={140} />
        <Field label={t('form.description')} textarea rows={4} value={form.description} onChange={set('description')}
          placeholder={t('form.descriptionPlaceholder')} maxLength={4000} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label={t('form.priority')} value={form.priority} onChange={set('priority')}
            options={PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) }))} />
          <Field label={t('form.category')} value={form.category} onChange={set('category')}
            options={CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
          {!editing && (
            <Field label={t('form.assignee')} value={form.assigneeId} onChange={set('assigneeId')}
              options={[{ value: '', label: t('form.nobody') }, ...assigneeOptions(assignees, meId, t)]} />
          )}
          <Field label={t('form.due')} type="datetime-local" value={form.dueAt} onChange={set('dueAt')} error={errors.dueAt}
            hint={!dueTouched ? t('form.dueHint') : undefined} />
          <Field label={t('form.roomNumber')} value={form.roomNumber} onChange={set('roomNumber')} maxLength={10} />
        </div>

        {!editing && (
          <div>
            <div className="text-xs font-medium text-ink2 mb-0.5">{t('form.checklist')}</div>
            <div className="text-[12px] text-ink3 mb-2">{t('form.checklistHint')}</div>
            {steps.length > 0 && (
              <ol className="m-0 mb-2 p-0 list-none space-y-1.5">
                {steps.map((s, i) => (
                  <li key={`${i}-${s}`} className="flex items-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-1.5 text-sm text-ink">
                    <span className="text-ink3 text-xs w-4">{i + 1}.</span>
                    <span className="flex-1 min-w-0 break-words">{s}</span>
                    <button type="button" aria-label={t('form.removeStep')} title={t('form.removeStep')}
                      onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}
                      className="bg-transparent border-0 p-1 cursor-pointer text-ink3 hover:text-danger-text"><LuX size={14} /></button>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex gap-2">
              <input value={step} onChange={(e) => setStep(e.target.value)} maxLength={200} placeholder={t('form.stepPlaceholder')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }}
                className="flex-1 min-w-0 bg-surface border border-line2 rounded-lg px-3 py-2 text-base sm:text-sm text-ink min-h-11 sm:min-h-0 placeholder:text-ink3 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" />
              <Button variant="ghost" icon={<LuPlus />} onClick={addStep} disabled={!step.trim()}>{t('form.addStep')}</Button>
            </div>
          </div>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
