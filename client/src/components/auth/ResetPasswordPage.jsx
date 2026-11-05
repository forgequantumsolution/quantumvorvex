import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import { authApi } from '../../api/client'
import { resetPasswordSchema, resetPasswordInitialValues } from '../../validation/authSchema'
import { LockIcon, EyeIcon, EyeOffIcon, AlertIcon, CheckIcon } from './authIcons'
import goldenLogo from '../../assets/golden_blue_logo.png'
import LanguageSwitcher from '../layout/LanguageSwitcher'
import './LoginPage.css'

const BANNER_BG = '/Banner.webp'

// Shared page frame (brand panel + card). Module-level so the form inside keeps
// its state when the page re-renders (e.g. toggling password visibility).
function Shell({ children }) {
  const { t } = useTranslation('auth')
  return (
    <div className="login-page" style={{ backgroundImage: `url(${BANNER_BG})` }}>
      <div className="login-overlay" />
      <div className="login-lang"><LanguageSwitcher /></div>
      <div className="login-brand">
        <div className="login-brand-eyebrow">
          <span className="login-brand-dot" />
          <span className="login-brand-eyebrow-text">{t('brand.eyebrow')}</span>
        </div>
        <h1 className="login-brand-headline">
          {t('brand.headline1')}<br /><em>{t('brand.headline2')}</em>
        </h1>
        <p className="login-brand-desc">
          {t('reset.desc')}
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
              <h2 className="login-card-title">{t('reset.title')}</h2>
            </div>
            {children}
          </div>
          <div className="login-card-footer">
            {t('poweredBy')}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Standalone page reached from the password-reset email link:
 *   /reset-password?token=<raw token>
 * Reads the token from the URL, posts the new password, then sends the user
 * back to the login screen. `onDone` clears the reset URL and re-renders login.
 */
export default function ResetPasswordPage({ onDone }) {
  const token = new URLSearchParams(window.location.search).get('token') || ''

  const { t } = useTranslation('auth')
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
      setError(data?.error || data?.message || t('errors.unreachable'))
    } finally {
      setSubmitting(false)
    }
  }

  // Missing/blank token → can't proceed
  if (!token) {
    return (
      <Shell>
        <div className="login-error">
          <span className="shrink-0 mt-px inline-flex"><AlertIcon /></span>
          {t('reset.noToken')}
        </div>
        <button type="button" className="login-submit" onClick={onDone}>{t('backToSignIn')}</button>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <div className="login-success">
          <span className="shrink-0 mt-px inline-flex"><CheckIcon /></span>
          {t('reset.done')}
        </div>
        <button type="button" className="login-submit" onClick={onDone}>{t('reset.goToSignIn')}</button>
      </Shell>
    )
  }

  return (
    <Shell>
      {error && (
        <div className="login-error">
          <span className="shrink-0 mt-px inline-flex"><AlertIcon /></span>
          {error}
        </div>
      )}

      <Formik initialValues={resetPasswordInitialValues} validationSchema={resetPasswordSchema} onSubmit={handleSubmit}>
        {({ isSubmitting }) => (
          <Form>
            <p className="login-hint">
              <Trans t={t} i18nKey="reset.hint" components={{ b: <strong /> }} />
            </p>

            <div className="login-field">
              <label className="login-field-label">{t('reset.newPassword')}</label>
              <div className="login-field-wrap">
                <span className="login-field-icon"><LockIcon /></span>
                <Field type={showPw ? 'text' : 'password'} name="password" placeholder="••••••••"
                       className="login-input pr-12" autoComplete="new-password" autoFocus />
                <button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                          aria-label={showPw ? t('hidePassword') : t('showPassword')}>
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <ErrorMessage name="password" component="div" className="login-field-error" />
            </div>

            <div className="login-field">
              <label className="login-field-label">{t('reset.confirmPassword')}</label>
              <div className="login-field-wrap">
                <span className="login-field-icon"><LockIcon /></span>
                <Field type={showPw ? 'text' : 'password'} name="confirmPassword" placeholder="••••••••"
                       className="login-input" autoComplete="new-password" />
              </div>
              <ErrorMessage name="confirmPassword" component="div" className="login-field-error" />
            </div>

            <button type="submit" disabled={isSubmitting} className="login-submit">
              {isSubmitting && <span className="login-spinner" />}
              {isSubmitting ? t('reset.updating') : t('reset.update')}
            </button>

            <div className="login-meta-row after center">
              <button type="button" className="login-link" onClick={onDone}>← {t('backToSignIn')}</button>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  )
}
