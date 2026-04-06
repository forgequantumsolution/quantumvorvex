import { useEffect } from 'react'
import { useStore } from '../store/useStore'

// Keyboard shortcuts:
//   D = dashboard      R = rooms        F = floorplan
//   T = reports        C = checkin      G = guests
//   B = billing        S = settings     M = maintenance
//   H = housekeeping
//   Shift+S = staff
//   Shift+A = toggle AI assistant
//   Escape = close modal (handled locally by Modal component)
//   ? = open shortcuts modal (handled by Dashboard)
//
// Only fires when not focused on an input / textarea / select / contenteditable.

const PANEL_MAP = {
  d: 'dashboard',
  r: 'rooms',
  f: 'floorplan',
  t: 'reports',
  c: 'checkin',
  g: 'guests',
  b: 'billing',
  s: 'settings',
  m: 'maintenance',
  h: 'housekeeping',
}

function isTyping(e) {
  const tag = e.target?.tagName?.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    e.target?.isContentEditable
  )
}

/**
 * useKeyboardShortcuts
 *
 * @param {object} [options]
 * @param {function} [options.onShortcutsModal]   - Callback to open the shortcuts modal (bound to '?')
 * @param {function} [options.onAssistantToggle]  - Callback to toggle the AI assistant (bound to Shift+A)
 */
export function useKeyboardShortcuts({ onShortcutsModal, onAssistantToggle } = {}) {
  const setActivePanel = useStore((s) => s.setActivePanel)

  useEffect(() => {
    function handleKeyDown(e) {
      // Never fire on input elements
      if (isTyping(e)) return

      const key = e.key?.toLowerCase()

      // Shift+A → toggle AI assistant
      if (e.shiftKey && key === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        onAssistantToggle?.()
        return
      }

      // Shift+S → staff panel
      if (e.shiftKey && key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setActivePanel('staff')
        return
      }

      // Panel navigation (single-key, no modifiers)
      if (PANEL_MAP[key] && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        setActivePanel(PANEL_MAP[key])
        return
      }

      // Shortcuts modal
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        onShortcutsModal?.()
        return
      }

      // Escape is intentionally left to Modal components to handle locally
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActivePanel, onShortcutsModal, onAssistantToggle])
}
