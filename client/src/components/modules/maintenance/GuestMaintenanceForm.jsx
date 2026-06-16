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

  // Mobile-first control styling. 16px font on inputs is deliberate: it stops
  // iOS Safari from auto-zooming the page when a field gains focus.
  const labelCls = 'block text-[13px] font-semibold text-ink2 mb-2'
  const fieldCls =
    'w-full text-base text-ink bg-surface2 border border-line rounded-xl px-4 py-3 ' +
    'outline-none transition placeholder:text-ink3 ' +
    'focus:border-gold focus:bg-surface focus:ring-4 focus:ring-gold-bg'

  return (
    // #root is a full-height flex ROW (see index.css), so this page must claim
    // the full width (flex-1) and own its vertical scroll — #root/body are
    // overflow:hidden, which would otherwise clip a tall form on small screens.
    <div className="flex-1 min-w-0 overflow-y-auto bg-surface2">
      <div className="min-h-full flex flex-col items-center justify-center px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gold-bg border border-gold-border flex items-center justify-center text-[26px] mb-3">
            🔧
          </div>
          <h1 className="text-2xl font-extrabold text-ink tracking-[-0.02em] m-0">Report an Issue</h1>
          {room && (
            <span className="inline-flex items-center gap-1.5 mt-2.5 rounded-full bg-surface2 border border-line px-3 py-1 text-sm font-medium text-ink2">
              Room {room.number}{room.floor ? ` · Floor ${room.floor}` : ''}
            </span>
          )}
        </div>

        <div className="bg-surface border border-line rounded-2xl shadow-soft p-5 sm:p-6">
          {loading && (
            <p className="text-base text-ink3 text-center py-10 m-0">Loading…</p>
          )}

          {!loading && loadError && (
            <div className="text-center py-8">
              <p className="text-4xl mb-3 m-0">⚠️</p>
              <p className="text-base font-semibold text-ink2 m-0">{loadError}</p>
              <p className="text-sm text-ink3 mt-2">Please ask the front desk for help.</p>
            </div>
          )}

          {!loading && !loadError && done && (
            <div className="text-center py-8">
              <p className="text-5xl mb-3 m-0">✅</p>
              <p className="text-lg font-bold text-ink m-0">Thank you!</p>
              <p className="text-sm text-ink3 mt-2 leading-relaxed">
                Your request has been sent to our team.
              </p>
              <span className="inline-block mt-3 rounded-lg bg-surface2 border border-line px-3 py-1.5 font-mono text-sm text-ink2">
                {done.ticketNo}
              </span>
            </div>
          )}

          {!loading && !loadError && !done && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Category */}
              <div>
                <label className={labelCls}>What needs attention?</label>
                <select
                  className={fieldCls}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className={labelCls}>Issue</label>
                <input
                  className={fieldCls}
                  type="text"
                  maxLength={120}
                  placeholder="e.g. AC not cooling"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Details <span className="text-ink3 font-normal normal-case">(optional)</span></label>
                <textarea
                  className={`${fieldCls} min-h-[110px] resize-y`}
                  maxLength={1000}
                  placeholder="Anything that helps us fix it faster"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {submitError && (
                <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2.5 m-0">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-gold text-black font-bold text-base shadow-soft active:scale-[0.99] disabled:opacity-60 transition"
              >
                {submitting ? 'Sending…' : 'Submit Request'}
              </button>
            </form>
          )}
        </div>

          <p className="text-xs text-ink3 text-center mt-5">No login needed · Your room staff will be notified</p>
        </div>
      </div>
    </div>
  )
}
