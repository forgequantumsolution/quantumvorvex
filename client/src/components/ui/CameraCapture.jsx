import { useCallback, useEffect, useRef, useState } from 'react'

const JPEG_QUALITY = 0.85
const IDEAL_WIDTH = 1280
// Which camera the operator picked last, so a desk with a USB webcam plugged in
// doesn't have to re-select it on every capture.
const STORAGE_KEY = 'qv.camera.deviceId'

// Laptop and tablet cameras name themselves; anything else is assumed to be the
// external webcam, which is what a front desk actually wants pointed at a guest.
const BUILT_IN = /facetime|built[-\s]?in|integrated|internal|isight/i

/**
 * getUserMedia only exists in a secure context — https:// or localhost. On a LAN
 * address (http://192.168.x.x:5173) the API is simply absent, which is exactly
 * how a front-desk tablet reaches a dev or self-hosted server. When that happens
 * we fall back to a file input with `capture`, which hands off to the OS camera
 * app and needs no secure context.
 */
const hasLiveCamera = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  window.isSecureContext

// The server filters uploads on the file *extension* of originalname, so a bare
// canvas Blob (which has no name) would be rejected — always wrap it in a File
// with an explicit .jpg name.
const blobToFile = (blob, prefix) =>
  new File([blob], `${prefix}-${Date.now()}.jpg`, { type: 'image/jpeg' })

// localStorage throws outright in some privacy modes; a forgotten camera choice
// is never worth breaking the capture over.
const readStoredId = () => {
  try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}
const writeStoredId = (id) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

const ERRORS = {
  NotAllowedError: 'Camera permission was denied. Allow access in your browser, or upload a photo instead.',
  NotFoundError: 'No camera was found on this device.',
  NotReadableError: 'The camera is already in use by another app.',
  OverconstrainedError: 'No camera matches the requested settings.',
}

/**
 * Live camera preview with capture / retake, plus an always-available upload
 * fallback. Reports the chosen photo up via onChange(File | null); the parent
 * owns the confirm/skip actions and the upload itself.
 *
 * When more than one camera is attached, a picker appears and an external webcam
 * is preferred over the built-in one; an explicit pick is remembered per browser.
 *
 * Mount it only when it should be running — the camera starts on mount and every
 * track is stopped on unmount, which is what turns the recording light back off.
 */
export default function CameraCapture({
  onChange,
  facingMode = 'user',
  namePrefix = 'photo',
  disabled = false,
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const previewUrlRef = useRef(null)
  const cancelledRef = useRef(false)
  // The external-camera preference is applied once per mount; after that the
  // operator's choice (or the browser's) stands.
  const autoPickedRef = useRef(false)

  const [live] = useState(hasLiveCamera)
  // starting | live | preview | error — seeded from `live` so the effect below
  // never has to set state synchronously just to report an unusable camera.
  const [phase, setPhase] = useState(() => (hasLiveCamera() ? 'starting' : 'error'))
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [devices, setDevices] = useState([])
  // '' means "let the browser choose"; anything else is requested with exact:.
  const [requestedId, setRequestedId] = useState(readStoredId)
  // The device the running stream actually resolved to — what the picker shows.
  const [activeId, setActiveId] = useState('')

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Swap the preview, releasing the object URL the old one held.
  const showPreview = useCallback((url) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = url
    setPreviewUrl(url)
  }, [])

  // Labels are blank until camera permission has been granted, so this is only
  // worth calling once a stream is up (and again when hardware is plugged in).
  // Pass the device the browser picked on its own to also apply the
  // external-camera preference once, here in a promise callback rather than in
  // an effect body.
  const refreshDevices = useCallback((autoPickAgainst) => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then((all) => {
        if (cancelledRef.current) return
        const cams = all.filter((d) => d.kind === 'videoinput')
        setDevices(cams)
        if (!autoPickAgainst || autoPickedRef.current || cams.length < 2) return
        autoPickedRef.current = true
        const external = cams.find((d) => d.label && !BUILT_IN.test(d.label))
        if (external && external.deviceId !== autoPickAgainst) {
          setPhase('starting')
          setRequestedId(external.deviceId)
        }
      })
      .catch(() => {})
  }, [])

  // Runs from an effect, so it sets no state synchronously — every setState
  // happens in a promise callback once the camera has actually responded.
  const startStream = useCallback((id) => {
    if (!live) return
    const video = id
      ? { deviceId: { exact: id }, width: { ideal: IDEAL_WIDTH } }
      : { facingMode, width: { ideal: IDEAL_WIDTH } }
    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .then((stream) => {
        // Unmounted, or switched again, while the permission prompt was open.
        if (cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        const resolved = stream.getVideoTracks()[0]?.getSettings?.().deviceId || id || ''
        setActiveId(resolved)
        setError('')
        setPhase('live')
        refreshDevices(id ? null : resolved)
      })
      .catch((err) => {
        if (cancelledRef.current) return
        // A remembered webcam that has since been unplugged: forget it and let
        // the effect re-run against whatever camera is still attached.
        if (id && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
          writeStoredId('')
          setRequestedId('')
          return
        }
        setError(ERRORS[err.name] || 'Could not start the camera.')
        setPhase('error')
      })
  }, [facingMode, live, refreshDevices])

  // Stream lifecycle — also re-runs when the operator switches cameras.
  useEffect(() => {
    cancelledRef.current = false
    startStream(requestedId)
    return () => {
      cancelledRef.current = true
      stopStream()
    }
  }, [requestedId, startStream, stopStream])

  // The preview URL outlives camera switches, so it is released on unmount only.
  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  // Plugging in or removing a webcam mid-session updates the picker.
  useEffect(() => {
    const md = navigator.mediaDevices
    if (!live || !md?.addEventListener) return undefined
    const onDeviceChange = () => refreshDevices()
    md.addEventListener('devicechange', onDeviceChange)
    return () => md.removeEventListener('devicechange', onDeviceChange)
  }, [live, refreshDevices])

  const selectCamera = (id) => {
    if (id === activeId) return
    writeStoredId(id)
    setPhase('starting')
    autoPickedRef.current = true
    setRequestedId(id)
  }

  const capture = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    // Draw the raw frame — the preview is mirrored in CSS for the operator's
    // benefit, but a mirrored photo on a guest file would read as wrong.
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) { setError('Could not capture the photo. Try again.'); return }
        showPreview(URL.createObjectURL(blob))
        stopStream()
        setPhase('preview')
        onChange(blobToFile(blob, namePrefix))
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  }

  const retake = () => {
    showPreview(null)
    onChange(null)
    setError('')
    setPhase(live ? 'starting' : 'error')
    startStream(requestedId)
  }

  // Fallback path: the OS camera app (or file picker) returns a real File.
  const pickFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    stopStream()
    showPreview(URL.createObjectURL(file))
    setPhase('preview')
    onChange(file)
  }

  const activeLabel = devices.find((d) => d.deviceId === activeId)?.label || ''
  // An external camera faces the guest, not the operator, so mirroring it would
  // be wrong; only the built-in (or an unidentified) camera gets flipped.
  const mirrored = facingMode === 'user' && (!activeLabel || BUILT_IN.test(activeLabel))
  // Stays available in the error phase: a camera that is busy or unplugged is
  // exactly when the operator needs to switch to the other one.
  const showPicker = live && devices.length > 1 && phase !== 'preview'

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg bg-surface2 border border-line aspect-[4/3] flex items-center justify-center">
        {phase === 'preview' && previewUrl ? (
          <img src={previewUrl} alt="Captured preview" className="w-full h-full object-contain" />
        ) : live && phase !== 'error' ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
            />
            {phase !== 'live' && <span className="absolute t-sm text-ink3">Starting camera…</span>}
          </>
        ) : (
          <div className="px-6 py-8 text-center">
            <div className="text-3xl mb-2">📷</div>
            <p className="t-sm text-ink3">
              {error || 'Live camera is unavailable here — use your device camera instead.'}
            </p>
          </div>
        )}
      </div>

      {showPicker && (
        <label className="flex items-center gap-2 mt-3">
          <span className="t-sm text-ink3 shrink-0">Camera</span>
          <select
            className="form-select flex-1"
            value={activeId}
            disabled={disabled || phase === 'starting'}
            onChange={(e) => selectCamera(e.target.value)}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-2 mt-3">
        {phase === 'preview' ? (
          <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={retake}>
            Retake
          </button>
        ) : (
          live && phase !== 'error' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={disabled || phase !== 'live'}
              onClick={capture}
            >
              📷 Capture
            </button>
          )
        )}

        {/* Always reachable: covers permission denial, a missing camera, and
            insecure-origin access from a tablet on the local network. */}
        <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-lg border border-dashed border-line2 bg-surface px-3 py-2 t-sm text-ink3 hover:border-gold hover:text-ink2">
          <span className="text-base">⬆</span>
          <span>{live && phase !== 'error' ? 'Or upload a photo' : 'Take or upload a photo'}</span>
          <input
            type="file"
            accept="image/*"
            capture={mirrored ? 'user' : 'environment'}
            className="hidden"
            disabled={disabled}
            onChange={pickFile}
          />
        </label>
      </div>

      {error && phase === 'preview' && (
        <span className="block text-[11.5px] text-danger mt-1">{error}</span>
      )}
    </div>
  )
}
