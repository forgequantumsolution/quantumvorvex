import { useEffect, useState } from 'react'
import { Modal, Field, Button } from '../../ui-tw'
import { roomsApi } from '../../../api/client'
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../../data/opsSeed'

const EMPTY = {
  roomId: '', category: TICKET_CATEGORIES[0], title: '',
  description: '', priority: 'Medium', assignedTo: '', reportedBy: 'Front Desk',
}

/**
 * Create a maintenance ticket. Loads real rooms from the API and calls
 * onSave(payload) with the API-shaped body. The parent posts it.
 */
export default function NewTicketModal({ isOpen, onClose, onSave }) {
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
    if (!values.roomId) e.roomId = 'Select a room'
    if (!values.title.trim()) e.title = 'A short title is required'
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
      title="New Maintenance Ticket"
      subtitle="Log an issue for the maintenance team"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={handleSubmit} icon="＋" disabled={loadingRooms}>Create Ticket</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Room" value={values.roomId} onChange={set('roomId')} error={errors.roomId}
               options={
                 loadingRooms
                   ? [{ value: '', label: 'Loading rooms…' }]
                   : rooms.length
                     ? rooms.map((r) => ({ value: r.id, label: `Room ${r.number}` }))
                     : [{ value: '', label: 'No rooms found' }]
               } />
        <Field label="Category" value={values.category} onChange={set('category')} options={TICKET_CATEGORIES} />
        <Field label="Title" value={values.title} onChange={set('title')} placeholder="Short summary"
               error={errors.title} required className="sm:col-span-2" />
        <Field label="Description" textarea value={values.description} onChange={set('description')}
               placeholder="Details of the issue…" className="sm:col-span-2" />
        <Field label="Priority" value={values.priority} onChange={set('priority')} options={TICKET_PRIORITIES} />
        <Field label="Assign to" value={values.assignedTo} onChange={set('assignedTo')} placeholder="Technician (optional)" />
        <Field label="Reported by" value={values.reportedBy} onChange={set('reportedBy')}
               options={['Front Desk', 'Housekeeping', 'Guest', 'Manager']} className="sm:col-span-2" />
      </div>
    </Modal>
  )
}
