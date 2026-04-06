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
      style={{
        position:        'fixed',
        bottom:          24,
        left:            '50%',
        transform:       'translateX(-50%)',
        zIndex:          1400,
        width:           'calc(100% - 32px)',
        maxWidth:        400,
        background:      'var(--surface)',
        border:          '1px solid var(--border)',
        borderRadius:    12,
        boxShadow:       '0 8px 32px rgba(0,0,0,0.45)',
        padding:         '18px 20px',
        fontFamily:      "'Inter', sans-serif",
        animation:       'qv-slide-up 0.25s ease',
      }}
    >
      <style>{`
        @keyframes qv-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon + heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{
          width:        40,
          height:       40,
          borderRadius: 10,
          background:   'var(--gold-bg)',
          border:       '1px solid var(--gold-border)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     20,
          flexShrink:   0,
        }}>
          🏨
        </div>
        <div>
          <p style={{
            margin:      0,
            fontFamily:  "'Syne', sans-serif",
            fontSize:    14,
            fontWeight:  800,
            color:       'var(--gold)',
            letterSpacing: '-0.02em',
          }}>
            Quantum Vortex Hotel
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text3)' }}>
            Forge Quantum Solutions
          </p>
        </div>
      </div>

      {/* Message */}
      <p style={{
        margin:     '0 0 16px',
        fontSize:   13,
        color:      'var(--text2)',
        lineHeight: 1.55,
      }}>
        Add Quantum Vortex to your home screen for faster access
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleInstall}
          style={{
            flex:         1,
            padding:      '9px 16px',
            borderRadius: 7,
            fontSize:     13,
            fontWeight:   700,
            cursor:       'pointer',
            background:   'var(--gold)',
            border:       'none',
            color:        '#141414',
            fontFamily:   "'Inter', sans-serif",
            transition:   'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Install
        </button>
        <button
          onClick={handleLater}
          style={{
            flex:         1,
            padding:      '9px 16px',
            borderRadius: 7,
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            background:   'transparent',
            border:       '1px solid var(--border)',
            color:        'var(--text2)',
            fontFamily:   "'Inter', sans-serif",
            transition:   'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
        >
          Later
        </button>
      </div>
    </div>
  )
}
