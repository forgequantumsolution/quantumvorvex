import { useState, useEffect, useRef } from 'react'

export default function OfflineBanner() {
  const [isOnline, setIsOnline]     = useState(navigator.onLine)
  const [visible, setVisible]       = useState(!navigator.onLine)
  const [fading, setFading]         = useState(false)
  const fadeTimer                   = useRef(null)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      // Start 3-second fade-out after reconnect
      setFading(true)
      fadeTimer.current = setTimeout(() => {
        setVisible(false)
        setFading(false)
      }, 3000)
    }

    function handleOffline() {
      clearTimeout(fadeTimer.current)
      setIsOnline(false)
      setFading(false)
      setVisible(true)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(fadeTimer.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:        'sticky',
        top:             0,
        zIndex:          2000,
        background:      '#92400e',
        borderBottom:    '1px solid #b45309',
        padding:         '9px 20px',
        textAlign:       'center',
        fontSize:        13,
        fontWeight:      600,
        color:           '#fef3c7',
        letterSpacing:   '0.01em',
        transition:      'opacity 0.6s ease',
        opacity:         fading ? 0 : 1,
        pointerEvents:   fading ? 'none' : 'auto',
        fontFamily:      "'Inter', sans-serif",
      }}
    >
      {isOnline
        ? '✅ Back online — syncing your changes…'
        : '📡 You\'re offline — showing cached data. Changes will sync when reconnected.'}
    </div>
  )
}
