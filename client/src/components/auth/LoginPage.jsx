import { useState } from 'react'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import { useAuthActions } from '../../store/hooks'
import { authApi } from '../../api/client'
import { loginSchema, loginInitialValues } from '../../validation/authSchema'
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, AlertIcon } from './authIcons'
import OtpLoginForm from './OtpLoginForm'
import ForgotPasswordForm from './ForgotPasswordForm'
import goldenLogo from '../../assets/golden_blue_logo.png'
import './LoginPage.css'

// Background lives in /public so it's served from the site root
const BANNER_BG = '/Banner.webp'

const PILLS = ['Check-In', 'Billing', 'Housekeeping', 'Reports', 'AI Insights']

const DEMO_ACCOUNTS = [
  { role: 'owner',   label: 'Owner',   email: 'owner@quantumvorvex.com',   pass: 'owner123'   },
  { role: 'manager', label: 'Manager', email: 'manager@quantumvorvex.com', pass: 'manager123' },
  { role: 'staff',   label: 'Staff',   email: 'staff@quantumvorvex.com',   pass: 'staff123'   },
]

// ── Password sign-in form (the original flow) ──────────────────────────────────
function PasswordLoginForm({ onForgot }) {
  const { login } = useAuthActions()
  const [showPw, setShowPw] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (values, { setSubmitting }) => {
    setError('')
    try {
      const { data } = await authApi.login({
        email: values.email.trim(),
        password: values.password,
      })
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
      setSubmitting(false)
    }
  }

  return (
    <>
      {error && (
        <div className="login-error">
          <span className="shrink-0 mt-px inline-flex"><AlertIcon /></span>
          {error}
        </div>
      )}

      <Formik initialValues={loginInitialValues} validationSchema={loginSchema} onSubmit={handleSubmit}>
        {({ isSubmitting, setFieldValue }) => (
          <>
            <Form>
              <div className="login-field">
                <label className="login-field-label">Email address</label>
                <div className="login-field-wrap">
                  <span className="login-field-icon"><MailIcon /></span>
                  <Field type="email" name="email" placeholder="you@hotel.com"
                         className="login-input" autoComplete="email" />
                </div>
                <ErrorMessage name="email" component="div" className="login-field-error" />
              </div>

              <div className="login-field">
                <label className="login-field-label">Password</label>
                <div className="login-field-wrap">
                  <span className="login-field-icon"><LockIcon /></span>
                  <Field type={showPw ? 'text' : 'password'} name="password" placeholder="••••••••"
                         className="login-input pr-10" autoComplete="current-password" />
                  <button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <ErrorMessage name="password" component="div" className="login-field-error" />
              </div>

              <div className="login-meta-row">
                <button type="button" className="login-link" onClick={onForgot}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={isSubmitting} className="login-submit">
                {isSubmitting && <span className="login-spinner" />}
                {isSubmitting ? 'Signing in…' : 'Sign In'}
              </button>
            </Form>

            <div className="login-demo-section">
              <span className="login-demo-label">Demo Accounts — Click to Fill</span>
              <div className="login-demo-chips">
                {DEMO_ACCOUNTS.map(({ role, label, email: e, pass }) => (
                  <button key={role} type="button" className="login-demo-chip"
                          onClick={() => {
                            setFieldValue('email', e)
                            setFieldValue('password', pass)
                            setError('')
                          }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </Formik>
    </>
  )
}

export default function LoginPage() {
  // view: 'login' (with method tabs) | 'forgot'
  const [view, setView]     = useState('login')
  const [method, setMethod] = useState('password')   // 'password' | 'otp'

  // Surface a logout reason left by the API client (read once at mount, then clear).
  const [notice] = useState(() => {
    const reason = sessionStorage.getItem('qv_logout_reason')
    if (reason) sessionStorage.removeItem('qv_logout_reason')
    return reason || ''
  })

  const title =
    view === 'forgot' ? 'Reset Password' :
    method === 'otp'  ? 'Sign In with Code' :
                        'Sign In'

  return (
    <div className="login-page" style={{ backgroundImage: `url(${BANNER_BG})` }}>
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
          {PILLS.map((p) => (<span key={p} className="login-brand-pill">{p}</span>))}
        </div>
      </div>

      <div className="login-card-wrap">
        <div className="login-card">
          <div className="login-card-top">
            <img src={goldenLogo} alt="Quantum Vorvex" className="login-card-logo" />
            <div className="login-card-product">Quantum <span>Vorvex</span></div>
          </div>

          <div className="login-card-body">
            {notice && (
              <div className="flex items-start gap-2 mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span className="shrink-0 mt-0.5 inline-flex"><AlertIcon /></span>
                <span>{notice}</span>
              </div>
            )}

            <div className="login-card-title-row">
              <h2 className="login-card-title">{title}</h2>
              <div className="login-status">
                <span className="login-status-dot" />
                System Online
              </div>
            </div>

            {view === 'forgot' ? (
              <ForgotPasswordForm onBack={() => setView('login')} />
            ) : (
              <>
                <div className="login-tabs">
                  <button type="button"
                          className={`login-tab ${method === 'password' ? 'active' : ''}`}
                          onClick={() => setMethod('password')}>
                    Password
                  </button>
                  <button type="button"
                          className={`login-tab ${method === 'otp' ? 'active' : ''}`}
                          onClick={() => setMethod('otp')}>
                    Email OTP
                  </button>
                </div>

                {method === 'password'
                  ? <PasswordLoginForm onForgot={() => setView('forgot')} />
                  : <OtpLoginForm />}
              </>
            )}
          </div>

          <div className="login-card-footer">
            Powered by Quantum Vorvex · Forge Quantum Solutions
          </div>
        </div>
      </div>
    </div>
  )
}
