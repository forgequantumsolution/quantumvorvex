import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('auth')
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (values, { setSubmitting }) => {
    setError('')
    try {
      await authApi.forgotPassword({ email: values.email.trim() })
      setSent(true)
    } catch (err) {
      const data = err.response?.data
      setError(data?.error || data?.message || t('errors.unreachable'))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <>
        <div className="login-success">
          <span className="shrink-0 mt-px inline-flex"><CheckIcon /></span>
          {t('forgot.sent')}
        </div>
        <button type="button" className="login-submit" onClick={onBack}>
          {t('backToSignIn')}
        </button>
      </>
    )
  }

  return (
    <>
      {error && (
        <div className="login-error">
          <span className="shrink-0 mt-px inline-flex"><AlertIcon /></span>
          {error}
        </div>
      )}

      <Formik initialValues={forgotPasswordInitialValues} validationSchema={forgotPasswordSchema} onSubmit={handleSubmit}>
        {({ isSubmitting }) => (
          <Form>
            <p className="login-hint">
              {t('forgot.hint')}
            </p>
            <div className="login-field">
              <label className="login-field-label">{t('email')}</label>
              <div className="login-field-wrap">
                <span className="login-field-icon"><MailIcon /></span>
                <Field type="email" name="email" placeholder={t('emailPlaceholder')}
                       className="login-input" autoComplete="email" autoFocus />
              </div>
              <ErrorMessage name="email" component="div" className="login-field-error" />
            </div>
            <button type="submit" disabled={isSubmitting} className="login-submit">
              {isSubmitting && <span className="login-spinner" />}
              {isSubmitting ? t('forgot.sending') : t('forgot.send')}
            </button>

            <div className="login-meta-row after center">
              <button type="button" className="login-link" onClick={onBack}>
                ← {t('backToSignIn')}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </>
  )
}
