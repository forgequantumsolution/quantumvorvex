import { useState } from 'react'
import { Modal, Field, Button } from '../../ui-tw'
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../../data/opsSeed'
import { TODAY } from '../../../utils/booking'

const EMPTY = {
  room: '', category: TICKET_CATEGORIES[0], title: '',
  description: '', priority: 'Medium', assignedTo: '', reportedBy: 'Front Desk',
}

function nextTicketNo(tickets) {
  const max = tickets.reduce((m, t) => {
    const n = parseInt((t.ticketNo || '').split('-').pop(), 10)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return `MT-2026-${String(max + 1).padStart(3, '0')}`
}

/** Create a maintenance ticket. Calls onSave(ticket) with a shaped record. */
export default function NewTicketModal({ isOpen, onClose, onSave, existing }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!values.room.trim()) e.room = 'Room number is required'
    if (!values.title.trim()) e.title = 'A short title is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave({
      id: `mt-${Date.now()}`,
      ticketNo: nextTicketNo(existing),
      room: values.room.trim(),
      category: values.category,
      title: values.title.trim(),
      description: values.description.trim(),
      priority: values.priority,
      status: 'Open',
      assignedTo: values.assignedTo.trim() || 'Unassigned',
      reportedBy: values.reportedBy,
      createdAt: TODAY,
      resolvedAt: null,
    })
    setValues(EMPTY)
    setErrors({})
  }

  const close = () => {
    setValues(EMPTY)
    setErrors({})
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="New Maintenance Ticket"
      subtitle="Log an issue for the maintenance team"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={handleSubmit} icon="＋">Create Ticket</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Room" value={values.room} onChange={set('room')} placeholder="e.g. 204" error={errors.room} required />
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
