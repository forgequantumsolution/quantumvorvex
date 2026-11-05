import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export default function OfflineBanner() {
  const { t } = useTranslation('shell')
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
      // Pinned to the bottom (above the phone bottom bar) so it never covers
      // the topbar's controls; #root is a flex row, so it can't sit in flow.
      className="t-title fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-[2000] bg-[#92400e] border-t border-[#b45309] px-4 sm:px-5 py-[9px] text-center text-[#fef3c7] transition-opacity duration-[600ms] ease"
      style={{
        letterSpacing:   '0.01em',
        opacity:         fading ? 0 : 1,
        pointerEvents:   fading ? 'none' : 'auto',
      }}
    >
      {isOnline
        ? `✅ ${t('backOnline')}`
        : `📡 ${t('offline')}`}
    </div>
  )
}
