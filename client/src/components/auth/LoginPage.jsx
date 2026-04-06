import { useState } from 'react'
import { useStore } from '../../store/useStore'

const GOLD   = '#9a7820'
const GOLD_L = '#c9a84c'
const WHITE  = '#ffffff'
const INK    = '#0f0f0f'
const FAINT  = 'rgba(255,255,255,0.4)'

const ROLES = [
  { role: 'owner',   label: 'Owner',   color: '#c9a84c', email: 'owner@quantumvorvex.com',   pass: 'owner123'   },
  { role: 'manager', label: 'Manager', color: '#6fa3d8', email: 'manager@quantumvorvex.com', pass: 'manager123' },
  { role: 'staff',   label: 'Staff',   color: '#5cb85c', email: 'staff@quantumvorvex.com',   pass: 'staff123'   },
]

const PILLS = ['Check-In', 'Billing', 'Housekeeping', 'Reports', 'AI Insights']

export default function LoginPage({ onBack }) {
  const login = useStore((s) => s.login)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [focusEmail, setFocusEmail] = useState(false)
  const [focusPass,  setFocusPass]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      let data = {}
      try { data = await res.json() } catch { /* non-JSON response */ }
      if (!res.ok) {
        setError(
          data.error || data.message ||
          (res.status === 500 ? 'Server error — database may not be configured yet.' :
           res.status === 429 ? 'Too many attempts. Please wait 15 minutes.' :
           `Login failed (${res.status}).`)
        )
      } else {
        login(data.token, data.user)
      }
    } catch (err) {
      setError(
        err?.message?.includes('fetch')
          ? 'Cannot reach server. Make sure the backend is running.'
          : 'Network error. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
    }}>
      {/* ── Background ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(154,120,32,0.12) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 20%, rgba(60,40,10,0.3) 0%, transparent 50%),
          linear-gradient(135deg, #0a0906 0%, #141008 30%, #1a1408 60%, #0d0c08 100%)
        `,
      }} />

      {/* Subtle texture dots */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle, rgba(154,120,32,0.07) 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
        pointerEvents: 'none',
      }} />

      {/* Gold ambient glow bottom-left */}
      <div style={{
        position: 'absolute', bottom: '-15%', left: '-5%',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(154,120,32,0.18) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* ── Layout ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 1280,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) min(460px,100%)',
        gap: 0,
        alignItems: 'center',
        padding: 'clamp(24px,5vh,48px) clamp(16px,6vw,80px)',
        minHeight: '100dvh',
        boxSizing: 'border-box',
      }} className="lp-grid">

        {/* ── LEFT — Text overlay (hidden on mobile) ───────────────── */}
        <div className="desktop-only" style={{ padding: '0 48px 0 0' }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(154,120,32,0.12)',
            border: '1px solid rgba(154,120,32,0.3)',
            borderRadius: 100, padding: '6px 14px',
            marginBottom: 32,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD_L, display: 'block' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: GOLD_L }}>
              HOTEL MANAGEMENT SYSTEM
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(40px, 5vw, 66px)',
            fontWeight: 900,
            color: WHITE,
            margin: '0 0 4px',
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
          }}>
            Seamless
          </h1>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(40px, 5vw, 66px)',
            fontWeight: 900,
            color: WHITE,
            margin: '0 0 8px',
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
          }}>
            Operations.
          </h1>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(32px, 4vw, 52px)',
            fontWeight: 700,
            fontStyle: 'italic',
            color: GOLD_L,
            margin: '0 0 28px',
            lineHeight: 1.1,
          }}>
            Intelligent Control.
          </h2>

          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.52)',
            lineHeight: 1.75, maxWidth: 460, margin: '0 0 40px',
          }}>
            One unified platform for Indian hospitality — GST-compliant billing,
            smart guest check-in, real-time room tracking, and intelligent analytics.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {PILLS.map((pill) => (
              <div key={pill} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 100,
                padding: '7px 16px',
                fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.65)',
                letterSpacing: '0.03em',
              }}>{pill}</div>
            ))}
          </div>

          {/* Back link */}
          {onBack && (
            <button onClick={onBack} style={{
              marginTop: 48, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              letterSpacing: '0.04em', transition: 'color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
            >← Back to home</button>
          )}
        </div>

        {/* ── RIGHT — Glass card ────────────────────────────────────── */}
        <div style={{
          background: 'rgba(18,14,8,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(154,120,32,0.22)',
          borderRadius: 20,
          padding: 'clamp(24px,4vw,40px) clamp(20px,4vw,36px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
          width: '100%',
        }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(154,120,32,0.3), rgba(154,120,32,0.08))',
              border: '1px solid rgba(154,120,32,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, margin: '0 auto 12px',
            }}>🏨</div>
            <div style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 17, fontWeight: 700, fontStyle: 'italic',
              color: GOLD_L, letterSpacing: '0.02em',
            }}>Quantum Vorvex</div>
          </div>

          {/* Heading + status */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 26, fontWeight: 900,
                color: WHITE, margin: 0,
              }}>Sign In</h2>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(50,200,80,0.1)',
                border: '1px solid rgba(50,200,80,0.25)',
                borderRadius: 100, padding: '4px 10px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#32c850', display: 'block', boxShadow: '0 0 6px #32c850' }} />
                <span style={{ fontSize: 10, color: '#32c850', fontWeight: 600, letterSpacing: '0.06em' }}>System Online</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '6px 0 0' }}>
              Enter your credentials to continue.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)',
                marginBottom: 7,
              }}>EMAIL ADDRESS</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 15, pointerEvents: 'none', opacity: focusEmail ? 0.9 : 0.4,
                  transition: 'opacity 0.15s',
                }}>✉</span>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@hotel.com"
                  autoComplete="email"
                  onFocus={() => setFocusEmail(true)}
                  onBlur={() => setFocusEmail(false)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 13px 11px 40px',
                    background: focusEmail ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${focusEmail ? 'rgba(154,120,32,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 9,
                    fontSize: 14, color: WHITE, outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.15s',
                    boxShadow: focusEmail ? '0 0 0 3px rgba(154,120,32,0.1)' : 'none',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)',
                marginBottom: 7,
              }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 15, pointerEvents: 'none', opacity: focusPass ? 0.9 : 0.4,
                  transition: 'opacity 0.15s',
                }}>🔒</span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  onFocus={() => setFocusPass(true)}
                  onBlur={() => setFocusPass(false)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 42px 11px 40px',
                    background: focusPass ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${focusPass ? 'rgba(154,120,32,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 9,
                    fontSize: 14, color: WHITE, outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.15s',
                    boxShadow: focusPass ? '0 0 0 3px rgba(154,120,32,0.1)' : 'none',
                  }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)', fontSize: 14, padding: 0,
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
                >{showPass ? '🙈' : '👁'}</button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px',
                background: 'rgba(180,30,30,0.12)',
                border: '1px solid rgba(180,30,30,0.3)',
                borderRadius: 8, fontSize: 12.5, color: '#e07070',
              }}>{error}</div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading
                ? 'rgba(154,120,32,0.5)'
                : 'linear-gradient(135deg, #b89030, #9a7820)',
              color: WHITE, border: 'none', borderRadius: 9,
              fontSize: 11.5, fontWeight: 700, letterSpacing: '0.14em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(154,120,32,0.4)',
            }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #c9a030, #a88225)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(154,120,32,0.55)' } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #b89030, #9a7820)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(154,120,32,0.4)' } }}
            >
              {loading ? 'SIGNING IN…' : 'SIGN IN →'}
            </button>
          </form>

          {/* Demo accounts */}
          <div style={{ marginTop: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)' }}>
                DEMO ACCOUNTS — CLICK TO FILL
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {ROLES.map(({ role, label, color, email: e, pass }) => (
                <button
                  key={role}
                  onClick={() => { setEmail(e); setPassword(pass); setError('') }}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '9px 6px',
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={ev => {
                    ev.currentTarget.style.borderColor = color
                    ev.currentTarget.style.background = `rgba(${color === '#c9a84c' ? '201,168,76' : color === '#6fa3d8' ? '111,163,216' : '92,184,92'},0.1)`
                    ev.currentTarget.style.boxShadow = `0 4px 14px rgba(0,0,0,0.3)`
                  }}
                  onMouseLeave={ev => {
                    ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    ev.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    ev.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>{pass}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.22) !important; }
        /* On mobile: single column, card takes full width */
        @media (max-width: 1023px) {
          .lp-grid { grid-template-columns: 1fr !important; justify-items: center; }
        }
      `}</style>
    </div>
  )
}
