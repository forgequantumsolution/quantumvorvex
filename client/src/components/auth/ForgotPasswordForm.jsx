import { useState } from 'react'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import { authApi } from '../../api/client'
import { forgotPasswordSchema, forgotPasswordInitialValues } from '../../validation/authSchema'
import { MailIcon, AlertIcon, CheckIcon } from './authIcons'

/**
 * "Forgot password" — requests a reset link by email.
 * The backend always responds 200 (no account enumeration), so we always show
 * the same success message once the request goes through.
 * `onBack` returns to the login form.
 */
export default function ForgotPasswordForm({ onBack }) {
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (values, { setSubmitting }) => {
    setError('')
    try {
      await authApi.forgotPassword({ email: values.email.trim() })
      setSent(true)
    } catch (err) {
      const data = err.response?.data
      setError(data?.error || data?.message || 'Cannot reach server. Make sure the backend is running.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <>
        <div className="login-success">
          <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><CheckIcon /></span>
          If an account exists for that email, a password-reset link is on its way.
          The link expires in 30 minutes.
        </div>
        <button type="button" className="login-submit" onClick={onBack}>
          Back to Sign In
        </button>
      </>
    )
  }

  return (
    <>
      {error && (
        <div className="login-error">
          <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><AlertIcon /></span>
          {error}
        </div>
      )}

      <Formik initialValues={forgotPasswordInitialValues} validationSchema={forgotPasswordSchema} onSubmit={handleSubmit}>
        {({ isSubmitting }) => (
          <Form>
            <p className="login-hint">
              Enter the email tied to your account and we'll send you a link to reset your password.
            </p>
            <div className="login-field">
              <label className="login-field-label">Email address</label>
              <div className="login-field-wrap">
                <span className="login-field-icon"><MailIcon /></span>
                <Field type="email" name="email" placeholder="you@hotel.com"
                       className="login-input" autoComplete="email" autoFocus />
              </div>
              <ErrorMessage name="email" component="div" className="login-field-error" />
            </div>
            <button type="submit" disabled={isSubmitting} className="login-submit">
              {isSubmitting && <span className="login-spinner" />}
              {isSubmitting ? 'Sending link…' : 'Send Reset Link'}
            </button>

            <div className="login-meta-row" style={{ marginTop: 14, justifyContent: 'center' }}>
              <button type="button" className="login-link" onClick={onBack}>
                ← Back to Sign In
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </>
  )
}
