import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Field, Button } from '../../ui-tw'
import { roomsApi } from '../../../api/client'
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../../data/opsSeed'

const REPORTERS = ['Front Desk', 'Housekeeping', 'Guest', 'Manager']

const EMPTY = {
  roomId: '', category: TICKET_CATEGORIES[0], title: '',
  description: '', priority: 'Medium', assignedTo: '', reportedBy: 'Front Desk',
}

/**
 * Create a maintenance ticket. Loads real rooms from the API and calls
 * onSave(payload) with the API-shaped body. The parent posts it.
 */
export default function NewTicketModal({ isOpen, onClose, onSave }) {
  const { t } = useTranslation('maintenance')
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [rooms, setRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(false)

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  useEffect(() => {
    if (!isOpen) return
    setLoadingRooms(true)
    roomsApi.getAll()
      .then((res) => {
        const list = res.data?.rooms || res.data || []
        setRooms(list)
        setValues((v) => ({ ...v, roomId: v.roomId || list[0]?.id || '' }))
      })
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false))
  }, [isOpen])

  const validate = () => {
    const e = {}
    if (!values.roomId) e.roomId = t('form.selectRoom')
    if (!values.title.trim()) e.title = t('form.titleRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave({
      roomId: values.roomId,
      category: values.category,
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      priority: values.priority,
      assignedTo: values.assignedTo.trim() || undefined,
      reportedBy: values.reportedBy,
    })
    setValues(EMPTY)
    setErrors({})
  }

  const close = () => { setValues(EMPTY); setErrors({}); onClose() }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={t('form.title')}
      subtitle={t('form.subtitle')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>{t('common:cancel')}</Button>
          <Button onClick={handleSubmit} icon="＋" disabled={loadingRooms}>{t('form.create')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('common:room')} value={values.roomId} onChange={set('roomId')} error={errors.roomId}
               options={
                 loadingRooms
                   ? [{ value: '', label: t('form.loadingRooms') }]
                   : rooms.length
                     ? rooms.map((r) => ({ value: r.id, label: t('roomNo', { number: r.number }) }))
                     : [{ value: '', label: t('form.noRooms') }]
               } />
        <Field label={t('form.category')} value={values.category} onChange={set('category')}
               options={TICKET_CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`, c) }))} />
        <Field label={t('form.titleLabel')} value={values.title} onChange={set('title')} placeholder={t('form.titlePlaceholder')}
               error={errors.title} required className="sm:col-span-2" />
        <Field label={t('form.description')} textarea value={values.description} onChange={set('description')}
               placeholder={t('form.descriptionPlaceholder')} className="sm:col-span-2" />
        <Field label={t('form.priority')} value={values.priority} onChange={set('priority')}
               options={TICKET_PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`, p) }))} />
        <Field label={t('form.assignTo')} value={values.assignedTo} onChange={set('assignedTo')} placeholder={t('form.assignPlaceholder')} />
        <Field label={t('form.reportedBy')} value={values.reportedBy} onChange={set('reportedBy')}
               options={REPORTERS.map((r) => ({ value: r, label: t(`reporter.${r}`, r) }))} className="sm:col-span-2" />
      </div>
    </Modal>
  )
}
