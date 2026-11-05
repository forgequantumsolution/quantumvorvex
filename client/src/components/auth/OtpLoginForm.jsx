import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import { useAuthActions } from '../../store/hooks'
import { authApi } from '../../api/client'
import {
  otpEmailSchema, otpEmailInitialValues,
  otpCodeSchema, otpCodeInitialValues,
} from '../../validation/authSchema'
import { MailIcon, AlertIcon, CheckIcon } from './authIcons'

/**
 * Passwordless email-OTP login.
 * Step 1: enter email → backend sends a 6-digit code.
 * Step 2: enter the code → backend returns a JWT + user, then we log in.
 */
export default function OtpLoginForm() {
  const { login } = useAuthActions()
  const { t } = useTranslation('auth')

  const [step, setStep]   = useState('email')   // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo]   = useState('')

  const friendlyError = (err) => {
    const data = err.response?.data
    const status = err.response?.status
    return (
      data?.error || data?.message ||
      (status === 500 ? t('errors.server') :
       status === 429 ? t('errors.tooMany') :
       t('errors.unreachable'))
    )
  }

  // ── Step 1: request a code ──────────────────────────────────────────────────
  const requestCode = async (values, { setSubmitting }) => {
    setError(''); setInfo('')
    try {
      await authApi.requestOtp({ email: values.email.trim() })
      setEmail(values.email.trim())
      setStep('code')
      setInfo(t('otp.sent'))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step 2: verify the code ─────────────────────────────────────────────────
  const verifyCode = async (values, { setSubmitting }) => {
    setError('')
    try {
      const { data } = await authApi.verifyOtp({ email, code: values.code.trim() })
      login(data.token, data.user)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    setError(''); setInfo('')
    try {
      await authApi.requestOtp({ email })
      setInfo(t('otp.resent'))
    } catch (err) {
      setError(friendlyError(err))
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
      {info && !error && (
        <div className="login-success">
          <span className="shrink-0 mt-px inline-flex"><CheckIcon /></span>
          {info}
        </div>
      )}

      {step === 'email' ? (
        <Formik initialValues={otpEmailInitialValues} validationSchema={otpEmailSchema} onSubmit={requestCode}>
          {({ isSubmitting }) => (
            <Form>
              <p className="login-hint">
                {t('otp.hint')}
              </p>
              <div className="login-field">
                <label className="login-field-label">{t('email')}</label>
                <div className="login-field-wrap">
                  <span className="login-field-icon"><MailIcon /></span>
                  <Field type="email" name="email" placeholder={t('emailPlaceholder')}
                         className="login-input" autoComplete="email" />
                </div>
                <ErrorMessage name="email" component="div" className="login-field-error" />
              </div>
              <button type="submit" disabled={isSubmitting} className="login-submit">
                {isSubmitting && <span className="login-spinner" />}
                {isSubmitting ? t('otp.sending') : t('otp.send')}
              </button>
            </Form>
          )}
        </Formik>
      ) : (
        <Formik initialValues={otpCodeInitialValues} validationSchema={otpCodeSchema} onSubmit={verifyCode}>
          {({ isSubmitting }) => (
            <Form>
              <p className="login-hint">
                <Trans t={t} i18nKey="otp.enterCode" values={{ email }} components={{ b: <strong /> }} />
              </p>
              <div className="login-field">
                <label className="login-field-label">{t('otp.code')}</label>
                <Field type="text" name="code" inputMode="numeric" maxLength={6}
                       placeholder="••••••" className="login-otp-input" autoComplete="one-time-code" autoFocus />
                <ErrorMessage name="code" component="div" className="login-field-error" />
              </div>
              <button type="submit" disabled={isSubmitting} className="login-submit">
                {isSubmitting && <span className="login-spinner" />}
                {isSubmitting ? t('otp.verifying') : t('otp.verify')}
              </button>

              <div className="login-meta-row between after">
                <button type="button" className="login-link"
                        onClick={() => { setStep('email'); setError(''); setInfo('') }}>
                  ← {t('otp.differentEmail')}
                </button>
                <button type="button" className="login-link" onClick={resend}>
                  {t('otp.resend')}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      )}
    </>
  )
}
