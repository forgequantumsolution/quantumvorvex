import { Formik, Form } from 'formik'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import FormikField from './FormikField'
import { useToast } from '../../hooks/useToast'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setCredentials } from '../../store/slices/authSlice'
import { authApi } from '../../api/client'

// Built per render so the messages follow the chosen language.
const makeSchema = (t) => Yup.object({
  currentPassword: Yup.string().required(t('password.enterCurrent')),
  newPassword: Yup.string().max(128).required(t('password.enterNew')),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], t('password.mismatch'))
    .required(t('password.confirmNew')),
})

// Self-service password change — available to every signed-in user (not gated by any
// module), launched from the sidebar user menu.
export default function ChangePasswordModal({ isOpen, onClose }) {
  const addToast = useToast()
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const { t } = useTranslation('shell')

  return (
    <Formik
      initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
      validationSchema={makeSchema(t)}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        try {
          const { data } = await authApi.changePassword({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          })
          // The server reissues a token (other sessions are revoked). Keep this
          // session signed in by swapping the stored token; preserve the panel.
          if (data?.token) {
            localStorage.setItem('qv_token', data.token)
            dispatch(setCredentials({ token: data.token, user: currentUser }))
          }
          addToast(t('password.updated'), 'success')
          resetForm()
          onClose()
        } catch (err) {
          addToast(err.response?.data?.error || t('password.failed'), 'error')
        } finally {
          setSubmitting(false)
        }
      }}
    >
      {({ submitForm, isSubmitting }) => (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title={t('password.title')}
          footer={
            <>
              <button className="btn btn-outline" onClick={onClose}>{t('common:cancel')}</button>
              <button className="btn btn-primary" onClick={submitForm} disabled={isSubmitting}>
                {t('password.update')}
              </button>
            </>
          }
        >
          <Form className="flex flex-col gap-3.5">
            <FormikField name="currentPassword" label={t('password.current')} type="password" required placeholder={t('password.current')} />
            <FormikField name="newPassword" label={t('password.new')} type="password" required placeholder={t('password.enterNew')} />
            <FormikField name="confirmPassword" label={t('password.confirm')} type="password" required placeholder={t('password.reenter')} />
          </Form>
        </Modal>
      )}
    </Formik>
  )
}
