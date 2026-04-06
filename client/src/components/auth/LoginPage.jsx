import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { authApi } from '../../api/client'

const GOLD  = '#c9a84c'
const CREAM = '#faf8f3'
const INK   = '#0f0e0a'

const ROLES = [
  { role: 'owner',   label: 'Owner',   color: '#c9a84c', bg: 'rgba(201,168,76,0.08)',  email: 'owner@quantumvorvex.com',   pass: 'owner123'   },
  { role: 'manager', label: 'Manager', color: '#2563eb', bg: 'rgba(37,99,235,0.06)',   email: 'manager@quantumvorvex.com', pass: 'manager123' },
  { role: 'staff',   label: 'Staff',   color: '#16a34a', bg: 'rgba(22,163,74,0.06)',   email: 'staff@quantumvorvex.com',   pass: 'staff123'   },
]

const PILLS = ['Check-In', 'Billing', 'Housekeeping', 'Reports', 'AI Insights']

export default function LoginPage({ onBack }) {
  const login = useStore((s) => s.login)

  const [mode,        setMode]        = useState('login')   // 'login' | 'forgot' | 'forgot_sent'
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [resetEmail,  setResetEmail]  = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [showPass,    setShowPass]    = useState(false)
  const [focusEmail,  setFocusEmail]  = useState(false)
  const [focusPass,   setFocusPass]   = useState(false)
  const [focusReset,  setFocusReset]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    setLoading(true)
    try {
      const { data } = await authApi.login({ email, password })
      login(data.token, data.user)
    } catch (err) {
      const data = err.response?.data
      const status = err.response?.status
      setError(
        data?.error || data?.message ||
        (status === 500 ? 'Server error — database may not be configured yet.' :
         status === 429 ? 'Too many attempts. Please wait 15 minutes.' :
         status === 401 ? 'Invalid email or password.' :
         'Cannot reach server. Make sure the backend is running.')
      )
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = (e) => {
    e.preventDefault()
    if (!resetEmail) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setMode('forgot_sent')
    }, 1200)
  }

  // ── Forgot Password view ──────────────────────────────────────────────────
  if (mode === 'forgot' || mode === 'forgot_sent') {
    return (
      <div style={{
        width: '100%', height: '100dvh', overflowY: 'auto', overflowX: 'hidden',
        fontFamily: "'Inter', sans-serif", background: CREAM, color: INK,
      }}>
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(250,248,243,0.94)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          padding: '0 clamp(16px,5vw,40px)', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 17, fontWeight: 700, fontStyle: 'italic', color: INK }}>
            Quantum <span style={{ color: GOLD }}>Vorvex</span>
          </div>
          <button onClick={() => setMode('login')} style={{
            background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6,
            padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#5a5550', cursor: 'pointer',
          }}>← Back to Login</button>
        </nav>

        <div style={{ maxWidth: 440, margin: '80px auto', padding: '0 clamp(16px,5vw,24px)' }}>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 16, padding: 'clamp(28px,4vw,44px)', boxShadow: '0 8px 40px rgba(0,0,0,0.07)' }}>
            {mode === 'forgot_sent' ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: INK, margin: '0 0 10px' }}>Check your email</h2>
                <p style={{ fontSize: 14, color: '#6b6055', lineHeight: 1.8, margin: '0 0 24px' }}>
                  We've sent a password reset link to <strong>{resetEmail}</strong>. Check your inbox and follow the instructions.
                </p>
                <button onClick={() => setMode('login')} style={{
                  width: '100%', padding: '13px', background: INK, color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.12em', cursor: 'pointer',
                }}>BACK TO SIGN IN</button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: INK, margin: '0 0 8px' }}>Forgot password?</h2>
                  <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Enter your email and we'll send you a reset link.</p>
                </div>
                <form onSubmit={handleForgotSubmit}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 7 }}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none', color: focusReset ? GOLD : '#aaa', transition: 'color 0.15s' }}>✉</span>
                      <input
                        type="email" value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        placeholder="you@hotel.com"
                        onFocus={() => setFocusReset(true)}
                        onBlur={() => setFocusReset(false)}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          padding: '11px 12px 11px 38px',
                          background: focusReset ? '#fff' : '#f9f8f5',
                          border: `1px solid ${focusReset ? GOLD : 'rgba(0,0,0,0.12)'}`,
                          borderRadius: 8, fontSize: 14, color: INK, outline: 'none',
                          transition: 'all 0.15s',
                          boxShadow: focusReset ? `0 0 0 3px rgba(201,168,76,0.12)` : 'none',
                        }}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading || !resetEmail} style={{
                    width: '100%', padding: '13px',
                    background: loading || !resetEmail ? '#888' : INK,
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
                    cursor: loading || !resetEmail ? 'not-allowed' : 'pointer',
                  }}>
                    {loading ? 'SENDING…' : 'SEND RESET LINK →'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      height: '100dvh',
      overflowY: 'auto',
      overflowX: 'hidden',
      fontFamily: "'Inter', sans-serif",
      background: CREAM,
      color: INK,
    }}>

      {/* ── Sticky mini-nav ───────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,248,243,0.94)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        padding: '0 clamp(16px,5vw,40px)',
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 17, fontWeight: 700, fontStyle: 'italic', color: INK,
        }}>
          Quantum <span style={{ color: GOLD }}>Vorvex</span>
        </div>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'none', border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, color: '#5a5550',
            cursor: 'pointer', transition: 'all 0.15s',
            letterSpacing: '0.04em',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.color = '#5a5550' }}
          >← Back</button>
        )}
      </nav>

      {/* ── Main two-column layout ────────────────────────────────────── */}
      <div className="login-grid" style={{
        maxWidth: 1100,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'clamp(32px,5vw,80px)',
        alignItems: 'center',
        padding: 'clamp(40px,7vh,80px) clamp(16px,5vw,48px)',
        minHeight: 'calc(100dvh - 56px)',
        boxSizing: 'border-box',
      }}>

        {/* ── LEFT — Brand copy ─────────────────────────────────────── */}
        <div className="login-left">

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(201,168,76,0.1)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: 100, padding: '5px 14px', marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, display: 'block' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: GOLD }}>
              HOTEL MANAGEMENT SYSTEM
            </span>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(34px,4.5vw,60px)',
            fontWeight: 900, color: INK,
            margin: '0 0 2px', lineHeight: 1.05, letterSpacing: '-0.02em',
          }}>Seamless</h1>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(34px,4.5vw,60px)',
            fontWeight: 900, color: INK,
            margin: '0 0 4px', lineHeight: 1.05, letterSpacing: '-0.02em',
          }}>Operations.</h1>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(24px,3.5vw,44px)',
            fontWeight: 700, fontStyle: 'italic', color: GOLD,
            margin: '0 0 22px', lineHeight: 1.1,
          }}>Intelligent Control.</h2>

          <p style={{
            fontSize: 14, color: '#6b6055', lineHeight: 1.8,
            maxWidth: 400, margin: '0 0 32px',
          }}>
            Sign in to access your hotel's unified command centre — rooms, guests,
            billing, and more in one place.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PILLS.map(p => (
              <div key={p} style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.09)',
                borderRadius: 100, padding: '6px 14px',
                fontSize: 12, fontWeight: 500, color: '#5a5550',
              }}>{p}</div>
            ))}
          </div>
        </div>

        {/* ── RIGHT — Login card ────────────────────────────────────── */}
        <div style={{
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.09)',
          borderRadius: 16,
          padding: 'clamp(28px,4vw,44px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.07)',
        }}>

          {/* Card header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 28, fontWeight: 900, color: INK, margin: 0,
              }}>Sign In</h2>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#dcfce7', border: '1px solid #bbf7d0',
                borderRadius: 100, padding: '4px 10px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'block' }} />
                <span style={{ fontSize: 10, color: '#15803d', fontWeight: 600, letterSpacing: '0.06em' }}>System Online</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Enter your credentials to continue.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 10.5, fontWeight: 700,
                letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase',
                marginBottom: 7,
              }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, pointerEvents: 'none', color: focusEmail ? GOLD : '#aaa',
                  transition: 'color 0.15s',
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
                    padding: '11px 12px 11px 38px',
                    background: focusEmail ? '#fff' : '#f9f8f5',
                    border: `1px solid ${focusEmail ? GOLD : 'rgba(0,0,0,0.12)'}`,
                    borderRadius: 8, fontSize: 14, color: INK, outline: 'none',
                    fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
                    boxShadow: focusEmail ? `0 0 0 3px rgba(201,168,76,0.12)` : 'none',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <label style={{
                display: 'block', fontSize: 10.5, fontWeight: 700,
                letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase',
                marginBottom: 7,
              }}>Password</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, pointerEvents: 'none', color: focusPass ? GOLD : '#aaa',
                  transition: 'color 0.15s',
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
                    padding: '11px 40px 11px 38px',
                    background: focusPass ? '#fff' : '#f9f8f5',
                    border: `1px solid ${focusPass ? GOLD : 'rgba(0,0,0,0.12)'}`,
                    borderRadius: 8, fontSize: 14, color: INK, outline: 'none',
                    fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
                    boxShadow: focusPass ? `0 0 0 3px rgba(201,168,76,0.12)` : 'none',
                  }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#aaa', fontSize: 14, padding: 0, transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color = INK}
                  onMouseLeave={e => e.currentTarget.style.color = '#aaa'}
                >{showPass ? '🙈' : '👁'}</button>
              </div>
            </div>

            {/* Forgot password link */}
            <div style={{ textAlign: 'right', marginBottom: 4, marginTop: -14 }}>
              <span
                onClick={() => setMode('forgot')}
                style={{ fontSize: 11.5, color: GOLD, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.02em' }}
              >
                Forgot password?
              </span>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px',
                background: '#fee2e2', border: '1px solid #fecaca',
                borderRadius: 8, fontSize: 12.5, color: '#b91c1c',
              }}>{error}</div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? '#888' : INK,
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#2a2a28' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = INK }}
            >
              {loading ? 'SIGNING IN…' : 'SIGN IN →'}
            </button>
          </form>

          {/* Demo accounts */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa' }}>
                DEMO ACCOUNTS — CLICK TO FILL
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {ROLES.map(({ role, label, color, bg, email: e, pass }) => (
                <button key={role}
                  onClick={() => { setEmail(e); setPassword(pass); setError('') }}
                  style={{
                    background: '#f9f8f5', border: `1px solid rgba(0,0,0,0.09)`,
                    borderRadius: 8, padding: '9px 6px',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                  }}
                  onMouseEnter={ev => {
                    ev.currentTarget.style.borderColor = color
                    ev.currentTarget.style.background = bg
                    ev.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)'
                  }}
                  onMouseLeave={ev => {
                    ev.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'
                    ev.currentTarget.style.background = '#f9f8f5'
                    ev.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontSize: 10.5, fontWeight: 700, color, marginBottom: 3, letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: 9.5, color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>{pass}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input::placeholder { color: #bbb !important; }
        /* Single column below 860px — hide left panel */
        @media (max-width: 860px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  )
}
