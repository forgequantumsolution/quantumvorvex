import { useState } from 'react'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import { authApi } from '../../api/client'
import { resetPasswordSchema, resetPasswordInitialValues } from '../../validation/authSchema'
import { LockIcon, EyeIcon, EyeOffIcon, AlertIcon, CheckIcon } from './authIcons'
import goldenLogo from '../../assets/golden_blue_logo.png'
import './LoginPage.css'

const BANNER_BG = '/Banner.webp'

/**
 * Standalone page reached from the password-reset email link:
 *   /reset-password?token=<raw token>
 * Reads the token from the URL, posts the new password, then sends the user
 * back to the login screen. `onDone` clears the reset URL and re-renders login.
 */
export default function ResetPasswordPage({ onDone }) {
  const token = new URLSearchParams(window.location.search).get('token') || ''

  const [showPw, setShowPw] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  const handleSubmit = async (values, { setSubmitting }) => {
    setError('')
    try {
      await authApi.resetPassword({ token, password: values.password })
      setDone(true)
    } catch (err) {
      const data = err.response?.data
      setError(data?.error || data?.message || 'Cannot reach server. Make sure the backend is running.')
    } finally {
      setSubmitting(false)
    }
  }

  const Shell = ({ children }) => (
    <div className="login-page" style={{ backgroundImage: `url(${BANNER_BG})` }}>
      <div className="login-overlay" />
      <div className="login-brand">
        <div className="login-brand-eyebrow">
          <span className="login-brand-dot" />
          <span className="login-brand-eyebrow-text">Hotel Management System</span>
        </div>
        <h1 className="login-brand-headline">
          Seamless Operations.<br /><em>Intelligent Control.</em>
        </h1>
        <p className="login-brand-desc">
          Choose a new password to get back into your hotel's command centre.
        </p>
      </div>

      <div className="login-card-wrap">
        <div className="login-card">
          <div className="login-card-top">
            <img src={goldenLogo} alt="Quantum Vorvex" className="login-card-logo" />
            <div className="login-card-product">Quantum <span>Vorvex</span></div>
          </div>
          <div className="login-card-body">
            <div className="login-card-title-row">
              <h2 className="login-card-title">New Password</h2>
            </div>
            {children}
          </div>
          <div className="login-card-footer">
            Powered by Quantum Vorvex · Forge Quantum Solutions
          </div>
        </div>
      </div>
    </div>
  )

  // Missing/blank token → can't proceed
  if (!token) {
    return (
      <Shell>
        <div className="login-error">
          <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><AlertIcon /></span>
          This reset link is missing its token. Please request a new link from the login page.
        </div>
        <button type="button" className="login-submit" onClick={onDone}>Back to Sign In</button>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <div className="login-success">
          <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><CheckIcon /></span>
          Your password has been updated. You can now sign in with your new password.
        </div>
        <button type="button" className="login-submit" onClick={onDone}>Go to Sign In</button>
      </Shell>
    )
  }

  return (
    <Shell>
      {error && (
        <div className="login-error">
          <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><AlertIcon /></span>
          {error}
        </div>
      )}

      <Formik initialValues={resetPasswordInitialValues} validationSchema={resetPasswordSchema} onSubmit={handleSubmit}>
        {({ isSubmitting }) => (
          <Form>
            <p className="login-hint">
              Pick a strong password — at least <strong>8 characters</strong>, with an uppercase letter and a number.
            </p>

            <div className="login-field">
              <label className="login-field-label">New password</label>
              <div className="login-field-wrap">
                <span className="login-field-icon"><LockIcon /></span>
                <Field type={showPw ? 'text' : 'password'} name="password" placeholder="••••••••"
                       className="login-input" style={{ paddingRight: 40 }} autoComplete="new-password" autoFocus />
                <button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <ErrorMessage name="password" component="div" className="login-field-error" />
            </div>

            <div className="login-field">
              <label className="login-field-label">Confirm password</label>
              <div className="login-field-wrap">
                <span className="login-field-icon"><LockIcon /></span>
                <Field type={showPw ? 'text' : 'password'} name="confirmPassword" placeholder="••••••••"
                       className="login-input" autoComplete="new-password" />
              </div>
              <ErrorMessage name="confirmPassword" component="div" className="login-field-error" />
            </div>

            <button type="submit" disabled={isSubmitting} className="login-submit">
              {isSubmitting && <span className="login-spinner" />}
              {isSubmitting ? 'Updating…' : 'Update Password'}
            </button>

            <div className="login-meta-row" style={{ marginTop: 14, justifyContent: 'center' }}>
              <button type="button" className="login-link" onClick={onDone}>← Back to Sign In</button>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  )
}
