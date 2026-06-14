import { Formik, Form } from 'formik'
import * as Yup from 'yup'
import Modal from './Modal'
import FormikField from './FormikField'
import { useToast } from '../../hooks/useToast'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setCredentials } from '../../store/slices/authSlice'
import { authApi } from '../../api/client'

const schema = Yup.object({
  currentPassword: Yup.string().required('Enter your current password'),
  newPassword: Yup.string().max(128).required('Enter a new password'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match')
    .required('Confirm your new password'),
})

// Self-service password change — available to every signed-in user (not gated by any
// module), launched from the sidebar user menu.
export default function ChangePasswordModal({ isOpen, onClose }) {
  const addToast = useToast()
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.currentUser)

  return (
    <Formik
      initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
      validationSchema={schema}
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
          addToast('Password updated.', 'success')
          resetForm()
          onClose()
        } catch (err) {
          addToast(err.response?.data?.error || 'Could not change password.', 'error')
        } finally {
          setSubmitting(false)
        }
      }}
    >
      {({ submitForm, isSubmitting }) => (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Change Password"
          footer={
            <>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={submitForm} disabled={isSubmitting}>
                Update Password
              </button>
            </>
          }
        >
          <Form className="flex flex-col gap-3.5">
            <FormikField name="currentPassword" label="Current Password" type="password" required placeholder="Current password" />
            <FormikField name="newPassword" label="New Password" type="password" required placeholder="Enter a new password" />
            <FormikField name="confirmPassword" label="Confirm New Password" type="password" required placeholder="Re-enter new password" />
          </Form>
        </Modal>
      )}
    </Formik>
  )
}
