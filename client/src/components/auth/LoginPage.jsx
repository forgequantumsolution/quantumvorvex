import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { authApi } from '../../api/client'
import hotelBg from '../../assets/hotel-bg.jpg'
import goldenLogo from '../../assets/golden_blue_logo.png'
import './LoginPage.css'

/* Inline Lucide-style icons */
const Icon = ({ size = 14, children }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)
const MailIcon = () => (<Icon><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></Icon>)
const LockIcon = () => (<Icon><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>)
const EyeIcon = () => (<Icon><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Icon>)
const EyeOffIcon = () => (<Icon><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></Icon>)
const AlertIcon = () => (<Icon><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></Icon>)

const PILLS = ['Check-In', 'Billing', 'Housekeeping', 'Reports', 'AI Insights']

const DEMO_ACCOUNTS = [
  { role: 'owner',   label: 'Owner',   email: 'owner@quantumvorvex.com',   pass: 'owner123'   },
  { role: 'manager', label: 'Manager', email: 'manager@quantumvorvex.com', pass: 'manager123' },
  { role: 'staff',   label: 'Staff',   email: 'staff@quantumvorvex.com',   pass: 'staff123'   },
]

export default function LoginPage() {
  const login = useStore((s) => s.login)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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

  return (
    <div className="login-page" style={{ backgroundImage: `url(${hotelBg})` }}>
      <div className="login-overlay" />

      <div className="login-brand">
        <div className="login-brand-eyebrow">
          <span className="login-brand-dot" />
          <span className="login-brand-eyebrow-text">Hotel Management System</span>
        </div>

        <h1 className="login-brand-headline">
          Seamless Operations.<br />
          <em>Intelligent Control.</em>
        </h1>

        <p className="login-brand-desc">
          Sign in to access your hotel's unified command centre — rooms, guests,
          billing, housekeeping, and more in one place.
        </p>

        <div className="login-brand-pills">
          {PILLS.map((p) => (
            <span key={p} className="login-brand-pill">{p}</span>
          ))}
        </div>
      </div>

      <div className="login-card-wrap">
        <div className="login-card">
          <div className="login-card-top">
            <img src={goldenLogo} alt="Quantum Vorvex" className="login-card-logo" />
            <div className="login-card-product">
              Quantum <span>Vorvex</span>
            </div>
          </div>

          <div className="login-card-body">
            <div className="login-card-title-row">
              <h2 className="login-card-title">Sign In</h2>
              <div className="login-status">
                <span className="login-status-dot" />
                System Online
              </div>
            </div>

            {error && (
              <div className="login-error">
                <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><AlertIcon /></span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label className="login-field-label">Email address</label>
                <div className="login-field-wrap">
                  <span className="login-field-icon"><MailIcon /></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@hotel.com"
                    className="login-input"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-field-label">Password</label>
                <div className="login-field-wrap">
                  <span className="login-field-icon"><LockIcon /></span>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="login-input"
                    style={{ paddingRight: 40 }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-pw-toggle"
                    onClick={() => setShowPw(!showPw)}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="login-submit">
                {loading && <span className="login-spinner" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="login-demo-section">
              <span className="login-demo-label">Demo Accounts — Click to Fill</span>
              <div className="login-demo-chips">
                {DEMO_ACCOUNTS.map(({ role, label, email: e, pass }) => (
                  <button
                    key={role}
                    type="button"
                    className="login-demo-chip"
                    onClick={() => { setEmail(e); setPassword(pass); setError('') }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="login-card-footer">
            Powered by Quantum Vorvex · Forge Quantum Solutions
          </div>
        </div>
      </div>
    </div>
  )
}
