import { useState, useEffect, useRef } from 'react'

const VISIT_KEY     = 'qv_visit_count'
const DISMISSED_KEY = 'qv_install_dismissed'
const SHOW_AFTER    = 3

export default function InstallPrompt() {
  const deferredPrompt          = useRef(null)
  const [visible, setVisible]   = useState(false)

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    // Increment persistent visit count
    const prev  = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10)
    const count = prev + 1
    localStorage.setItem(VISIT_KEY, String(count))

    const handleBeforeInstall = (e) => {
      e.preventDefault()
      deferredPrompt.current = e
      if (count >= SHOW_AFTER) {
        setVisible(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // If prompt already fired before this effect ran (rare), show after threshold
    if (count >= SHOW_AFTER && deferredPrompt.current) {
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    const prompt = deferredPrompt.current
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredPrompt.current = null
    setVisible(false)
    if (outcome === 'accepted') {
      localStorage.setItem(VISIT_KEY, '0')
    }
  }

  const handleLater = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Install Quantum Vortex app"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1400] w-[calc(100%-32px)] max-w-[400px] bg-surface border border-line rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] px-5 py-[18px] [animation:qv-slide-up_0.25s_ease]"
    >
      <style>{`
        @keyframes qv-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon + heading */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="t-h1 w-10 h-10 rounded-[10px] bg-[var(--gold-bg)] border border-[var(--gold-border)] flex items-center justify-center shrink-0">
          🏨
        </div>
        <div>
          <p className="t-title m-0 text-gold tracking-[-0.02em]">
            Quantum Vortex Hotel
          </p>
          <p className="t-xs mt-px mx-0 mb-0 text-ink3">
            Forge Quantum Solutions
          </p>
        </div>
      </div>

      {/* Message */}
      <p className="t-sm mt-0 mx-0 mb-4 text-ink2 leading-[1.55]">
        Add Quantum Vortex to your home screen for faster access
      </p>

      {/* Buttons */}
      <div className="flex gap-2.5">
        <button
          onClick={handleInstall}
          className="t-title flex-1 px-4 py-[9px] rounded-[7px] cursor-pointer bg-gold border-none text-[#141414] transition-all duration-[150ms]"
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Install
        </button>
        <button
          onClick={handleLater}
          className="t-title flex-1 px-4 py-[9px] rounded-[7px] cursor-pointer bg-transparent border border-line text-ink2 transition-all duration-[150ms]"
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
        >
          Later
        </button>
      </div>
    </div>
  )
}
