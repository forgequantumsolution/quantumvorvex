import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { ROLE_LABELS, ROLE_COLORS } from '../../utils/permissions'

export default function LoginPage() {
  const login = useStore((s) => s.login)
  const darkMode = useStore((s) => s.darkMode)
  const toggleDarkMode = useStore((s) => s.toggleDarkMode)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Login failed.')
      } else {
        login(data.token, data.user)
      }
    } catch {
      setError('Server unreachable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const roleColor = ROLE_COLORS

  return (
    <div style={{
      minHeight: '100vh',
      background: darkMode ? '#0e0e0e' : '#f4f1ec',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
    }}>
      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'transparent',
          border: '1px solid ' + (darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
          borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
          color: darkMode ? '#888' : '#666', fontSize: 12,
        }}
      >
        {darkMode ? '☀ Light' : '🌙 Dark'}
      </button>

      <div style={{
        width: '100%', maxWidth: 420, padding: '0 20px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52,
            background: '#c9a84c',
            borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, marginBottom: 14,
          }}>🏨</div>
          <h1 style={{
            margin: 0,
            fontFamily: "'Syne', sans-serif",
            fontSize: 26, fontWeight: 800,
            color: darkMode ? '#fff' : '#111',
            letterSpacing: '-0.02em',
          }}>
            Quantum <span style={{ color: '#c9a84c' }}>Vorvex</span>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: darkMode ? '#666' : '#888' }}>
            Hotel Management System
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: darkMode ? '#1a1a1a' : '#fff',
          border: '1px solid ' + (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'),
          borderRadius: 14,
          padding: '32px 28px',
          boxShadow: darkMode ? 'none' : '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: darkMode ? '#fff' : '#111' }}>
            Sign in
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 12.5, color: darkMode ? '#555' : '#999' }}>
            Enter your credentials to access the dashboard
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: darkMode ? '#aaa' : '#555', letterSpacing: '0.02em' }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hotel.com"
                autoComplete="email"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px',
                  background: darkMode ? '#111' : '#f9f9f9',
                  border: '1px solid ' + (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'),
                  borderRadius: 8, color: darkMode ? '#fff' : '#111',
                  fontSize: 14, outline: 'none',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#c9a84c' }}
                onBlur={(e)  => { e.target.style.borderColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)' }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: darkMode ? '#aaa' : '#555', letterSpacing: '0.02em' }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 40px 10px 12px',
                    background: darkMode ? '#111' : '#f9f9f9',
                    border: '1px solid ' + (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'),
                    borderRadius: 8, color: darkMode ? '#fff' : '#111',
                    fontSize: 14, outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#c9a84c' }}
                  onBlur={(e)  => { e.target.style.borderColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: darkMode ? '#555' : '#aaa', fontSize: 14, padding: 4,
                  }}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 12px',
                background: 'rgba(220,53,69,0.1)',
                border: '1px solid rgba(220,53,69,0.3)',
                borderRadius: 7, fontSize: 12.5,
                color: '#dc3545',
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? '#999' : '#c9a84c',
                color: '#000',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'opacity 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Role hint cards */}
        <div style={{ marginTop: 24 }}>
          <p style={{ textAlign: 'center', fontSize: 11.5, color: darkMode ? '#444' : '#bbb', marginBottom: 12 }}>
            Sample credentials
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { role: 'owner',   email: 'owner@quantumvorvex.com',   pass: 'owner123'   },
              { role: 'manager', email: 'manager@quantumvorvex.com', pass: 'manager123' },
              { role: 'staff',   email: 'staff@quantumvorvex.com',   pass: 'staff123'   },
            ].map(({ role, email: e, pass }) => (
              <button
                key={role}
                onClick={() => { setEmail(e); setPassword(pass); setError('') }}
                style={{
                  background: darkMode ? '#111' : '#f9f9f9',
                  border: '1px solid ' + (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'),
                  borderRadius: 8, padding: '10px 8px',
                  cursor: 'pointer', textAlign: 'center',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(el) => { el.currentTarget.style.borderColor = roleColor[role] }}
                onMouseLeave={(el) => { el.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)' }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 700, color: roleColor[role], textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                  {ROLE_LABELS[role]}
                </div>
                <div style={{ fontSize: 9.5, color: darkMode ? '#444' : '#bbb', fontFamily: "'JetBrains Mono', monospace" }}>
                  {pass}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
