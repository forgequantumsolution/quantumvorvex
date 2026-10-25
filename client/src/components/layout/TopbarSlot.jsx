import { useState } from 'react'
import { createPortal } from 'react-dom'

// Topbar slots a page can fill so its header shares the topbar row instead of
// adding a second one: 'title' (after the property switcher), 'actions' (before
// search / notifications) and 'primary' (far right, where "New Booking" sits).
// Pages render inside <Layout>, so the topbar is already mounted by the time a
// (lazy) panel renders.
const SLOT_IDS = { title: 'topbar-title-slot', actions: 'topbar-actions-slot', primary: 'topbar-primary-slot' }

export function TopbarSlotTarget({ name, className = '' }) {
  return <div id={SLOT_IDS[name]} className={`tb-slot ${className}`} />
}

export default function TopbarSlot({ name, children }) {
  const [target] = useState(() => document.getElementById(SLOT_IDS[name]))
  return target ? createPortal(children, target) : null
}
