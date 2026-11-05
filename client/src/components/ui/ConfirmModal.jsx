import { useTranslation } from 'react-i18next'
import Modal from './Modal'

/**
 * Reusable confirmation dialog — replaces window.confirm/alert.
 *
 * <ConfirmModal
 *   isOpen={...} onClose={...} onConfirm={...}
 *   title="Delete user" message={<>Delete <b>Ramesh</b>?</>}
 *   confirmLabel="Delete" danger busy={deleting}
 * />
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
}) {
  const { t } = useTranslation()
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title ?? t('areYouSure')}
      maxWidth="440px"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            {cancelLabel ?? t('cancel')}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t('working') : (confirmLabel ?? t('confirm'))}
          </button>
        </>
      }
    >
      <div className="t-body text-ink2 leading-[1.6]">{message}</div>
    </Modal>
  )
}
