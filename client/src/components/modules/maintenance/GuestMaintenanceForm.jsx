import { useEffect, useState } from 'react'
import { maintenanceApi } from '../../../api/client'

// Standalone, no-login page reached by scanning a room's maintenance QR code:
//   /report?t=<room qrToken>
// Mobile-first; intentionally renders outside the authenticated app shell.

const CATEGORIES = ['Plumbing', 'Electrical', 'HVAC', 'Furniture', 'Housekeeping', 'Other']

function getToken() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('t') || ''
}

export default function GuestMaintenanceForm() {
  const [token]                 = useState(getToken)
  const [room, setRoom]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')

  const [category, setCategory]       = useState('Other')
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone]             = useState(null) // { ticketNo }

  // Resolve the room from the token so the guest can confirm where they are.
  useEffect(() => {
    let active = true
    if (!token) { setLoading(false); setLoadError('This link is missing its room code.'); return }
    maintenanceApi.getPublicRoom(token)
      .then(({ data }) => { if (active) setRoom(data.room) })
      .catch((err) => { if (active) setLoadError(err.response?.data?.message || 'This QR code is not recognised.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (title.trim().length < 2) { setSubmitError('Please describe the issue.'); return }
    setSubmitting(true); setSubmitError('')
    try {
      const { data } = await maintenanceApi.createPublic({
        qrToken: token,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
      })
      setDone({ ticketNo: data.ticketNo })
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Could not submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface2 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.02em] m-0">Report an Issue</h1>
          {room && (
            <p className="t-sm text-ink3 mt-1">
              Room {room.number}{room.floor ? ` · Floor ${room.floor}` : ''}
            </p>
          )}
        </div>

        <div className="bg-surface border border-line rounded-[var(--radius)] p-5">
          {loading && (
            <p className="t-sm text-ink3 text-center py-8 m-0">Loading…</p>
          )}

          {!loading && loadError && (
            <div className="text-center py-6">
              <p className="t-display mb-2">⚠️</p>
              <p className="font-semibold text-ink2 m-0">{loadError}</p>
              <p className="t-xs text-ink3 mt-2">Please ask the front desk for help.</p>
            </div>
          )}

          {!loading && !loadError && done && (
            <div className="text-center py-6">
              <p className="t-display mb-2">✅</p>
              <p className="font-semibold text-ink m-0">Thank you!</p>
              <p className="t-sm text-ink3 mt-2">
                Your request has been sent to our team. Reference <strong>{done.ticketNo}</strong>.
              </p>
            </div>
          )}

          {!loading && !loadError && !done && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Category */}
              <div>
                <label className="form-label block mb-[5px]">What needs attention?</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="form-label block mb-[5px]">Issue</label>
                <input
                  className="form-input"
                  type="text"
                  maxLength={120}
                  placeholder="e.g. AC not cooling"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className="form-label block mb-[5px]">Details <span className="text-ink3 font-normal">(optional)</span></label>
                <textarea
                  className="form-input min-h-[90px] resize-y"
                  maxLength={1000}
                  placeholder="Anything that helps us fix it faster"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {submitError && (
                <p className="t-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2 m-0">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-gold text-white font-semibold text-[15px] disabled:opacity-60 transition-opacity"
              >
                {submitting ? 'Sending…' : 'Submit Request'}
              </button>
            </form>
          )}
        </div>

        <p className="t-xs text-ink3 text-center mt-4">No login needed · Your room staff will be notified</p>
      </div>
    </div>
  )
}
