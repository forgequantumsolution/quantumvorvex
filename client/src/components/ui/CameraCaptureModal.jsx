import { useState } from 'react'
import Modal from './Modal'
import CameraCapture from './CameraCapture'

/**
 * Modal wrapper around <CameraCapture> for flows that ask for a photo as a
 * standalone step (e.g. right after a booking is created).
 *
 * onCapture(file) is awaited, so the caller can upload before the modal closes;
 * `busy` should be true for the duration. Skipping is always available so a
 * broken webcam can never block the front desk.
 *
 * Render this conditionally (as the check-out modal is) rather than leaving it
 * mounted behind isOpen={false} — the captured file lives in local state, and
 * unmounting is what clears it between uses.
 */
export default function CameraCaptureModal({
  isOpen,
  onCapture,
  onSkip,
  title = 'Capture photo',
  hint = '',
  facingMode = 'user',
  namePrefix = 'photo',
  busy = false,
  confirmLabel = 'Save photo',
  skipLabel = 'Skip',
}) {
  const [file, setFile] = useState(null)

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      // Dismissing without a photo is the same outcome as skipping.
      onClose={busy ? () => {} : onSkip}
      title={title}
      maxWidth="560px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" disabled={busy} onClick={onSkip}>
            {skipLabel}
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={busy || !file}
            onClick={() => onCapture(file)}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </>
      }
    >
      {hint && <p className="t-sm text-ink3 mb-3">{hint}</p>}
      <CameraCapture
        facingMode={facingMode}
        namePrefix={namePrefix}
        disabled={busy}
        onChange={setFile}
      />
    </Modal>
  )
}
