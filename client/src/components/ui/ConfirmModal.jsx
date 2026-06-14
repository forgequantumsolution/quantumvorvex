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
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="440px"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="t-body text-ink2 leading-[1.6]">{message}</div>
    </Modal>
  )
}
