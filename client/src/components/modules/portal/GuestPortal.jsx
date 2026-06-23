import { useState, useRef } from 'react'
import { useToast } from '../../../hooks/useToast'
import { formatDate } from '../../../utils/format'

// ─── Mock Booking ─────────────────────────────────────────────────────────────

const MOCK_BOOKING = {
  bookingNo: 'BK-2026-001',
  guestName:  'Deepak Mehta',
  room:       '104',
  type:       'Deluxe',
  checkIn:    '2026-04-08',
  checkOut:   '2026-04-12',
  hotelName:  'Quantum Vorvex',
  hotelPhone: '9876543210',
}

const STEP_LABELS = ['Welcome', 'Verify Details', 'Documents', 'Sign Terms', 'Confirmation']

const TERMS_TEXT = `
1. Check-In & Check-Out Policy
Guests are required to check in between 12:00 PM and 11:00 PM on the scheduled date. Standard checkout time is 11:00 AM. Late checkout is subject to availability and may incur additional charges at the hotel's discretion. Early check-in requests are accommodated based on room availability.

2. Identification & Verification
All guests must present a valid government-issued photo ID at the time of check-in. This includes Aadhaar Card, Passport, Driving Licence, or Voter ID. Foreign nationals must present a valid passport with applicable visa. The hotel reserves the right to decline check-in if valid identification is not provided.

3. Room & Property Conduct
Guests are expected to maintain decorum and respect fellow guests and staff at all times. Smoking is strictly prohibited in all indoor areas. Loud music or disruptive behavior between 10:00 PM and 7:00 AM is not permitted. Any damage to hotel property caused by the guest will be charged to the registered payment method.

4. Food, Amenities & Extra Services
Meals and amenities purchased during your stay are governed by the rates and plans agreed at booking. Outside food delivery is permitted in guest rooms. In-room dining services may be available based on hotel configuration. Any additional service requests must be made through the front desk.

5. Liability & Privacy
The hotel is not liable for loss of personal belongings. Guests are advised to use the in-room safe for valuables. All personal data collected during this check-in process is processed solely for hotel management purposes and will not be shared with third parties without consent, in compliance with applicable data protection laws.
`.trim()

// ─── Step Progress Bar ────────────────────────────────────────────────────────

function PortalProgressBar({ current, total }) {
  return (
    <div className="flex items-center justify-center mb-7">
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1
        const isCompleted = stepNum < current
        const isActive = stepNum === current
        return (
          <div key={stepNum} className="flex items-center">
            <div
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center font-bold text-[12px] shrink-0 transition-all duration-200"
              style={
                isCompleted
                  ? { background: 'var(--green)', color: '#fff', border: '2px solid var(--green)' }
                  : isActive
                  ? { background: 'var(--gold)', color: '#000', border: '2px solid var(--gold)' }
                  : { background: 'transparent', color: 'var(--text3)', border: '2px solid var(--border2)' }
              }
              title={STEP_LABELS[i]}
            >
              {isCompleted ? '✓' : stepNum}
            </div>
            {stepNum < total && (
              <div
                className="w-8 h-0.5 transition-[background] duration-200"
                style={{ background: isCompleted ? 'var(--green)' : 'var(--border2)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Field Helper ─────────────────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <label className="t-label text-ink3">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function Step1Welcome({ booking, onNext }) {
  const firstName = booking.guestName.split(' ')[0]
  return (
    <div className="flex flex-col gap-5">
      {/* Welcome message */}
      <div className="text-center pt-2 pb-1">
        <div className="t-display mb-2">👋</div>
        <h2 className="t-h1 text-ink m-0 tracking-[-0.03em]">
          Welcome, {firstName}!
        </h2>
        <p className="t-sm text-ink2 mt-1.5">
          Complete your self check-in in just a few steps.
        </p>
      </div>

      {/* Booking summary card */}
      <div className="bg-surface2 border border-line rounded-[10px] overflow-hidden">
        <div className="bg-[var(--gold)] px-4 py-2.5 flex items-center justify-between">
          <span className="t-title text-[#000]">
            {booking.hotelName}
          </span>
          <span className="text-[11px] text-[#000] opacity-80" style={{ fontFamily: 'var(--font-mono)' }}>
            {booking.bookingNo}
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-5">
            <div>
              <div className="t-label text-ink3 mb-1">Room</div>
              <div className="t-h3 text-ink">{booking.room}</div>
              <div className="t-xs text-ink3">{booking.type}</div>
            </div>
            <div>
              <div className="t-label text-ink3 mb-1">Guest</div>
              <div className="t-title text-ink">{booking.guestName}</div>
            </div>
            <div>
              <div className="t-label text-ink3 mb-1">Check-In</div>
              <div className="t-title text-ink">{formatDate(booking.checkIn)}</div>
            </div>
            <div>
              <div className="t-label text-ink3 mb-1">Check-Out</div>
              <div className="t-title text-ink">{formatDate(booking.checkOut)}</div>
            </div>
          </div>
          <div className="t-xs mt-3.5 pt-3 border-t border-line text-ink3 flex items-center gap-1.5">
            📞 {booking.hotelPhone}
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary t-title w-full justify-center p-[13px] rounded-[9px]"
        onClick={onNext}
      >
        Begin Self Check-In →
      </button>
    </div>
  )
}

// ─── Step 2: Verify Details ───────────────────────────────────────────────────

function Step2Verify({ booking, data, onChange, onNext }) {
  const set = (k, v) => onChange({ ...data, [k]: v })

  const handleSubmit = () => {
    if (!data.fullName.trim() || !data.phone.trim()) return
    onNext()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="t-sm text-ink2 m-0">
        Please verify and complete your personal details below.
      </p>

      <Field label="Full Name" required>
        <input className="form-input" value={data.fullName}
          onChange={(e) => set('fullName', e.target.value)} placeholder="As per ID" />
      </Field>
      <Field label="Phone Number" required>
        <input className="form-input" type="tel" value={data.phone}
          onChange={(e) => set('phone', e.target.value)} placeholder="10-digit mobile" maxLength={10} />
      </Field>
      <Field label="Email Address">
        <input className="form-input" type="email" value={data.email}
          onChange={(e) => set('email', e.target.value)} placeholder="your@email.com" />
      </Field>
      <Field label="Date of Birth">
        <input className="form-input" type="date" value={data.dob}
          onChange={(e) => set('dob', e.target.value)} />
      </Field>
      <Field label="Nationality">
        <input className="form-input" value={data.nationality}
          onChange={(e) => set('nationality', e.target.value)} placeholder="Indian" />
      </Field>
      <Field label="Permanent Address">
        <textarea className="form-textarea" value={data.address}
          onChange={(e) => set('address', e.target.value)} placeholder="Full permanent address..." rows={3} />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-3.5">
        <Field label="Emergency Contact Name">
          <input className="form-input" value={data.emergencyName}
            onChange={(e) => set('emergencyName', e.target.value)} placeholder="Name" />
        </Field>
        <Field label="Emergency Phone">
          <input className="form-input" type="tel" value={data.emergencyPhone}
            onChange={(e) => set('emergencyPhone', e.target.value)} placeholder="Phone" maxLength={10} />
        </Field>
      </div>

      <button
        className="btn btn-primary t-title w-full justify-center p-3 rounded-[9px] mt-1.5"
        onClick={handleSubmit}
      >
        Confirm Details →
      </button>
    </div>
  )
}

// ─── Upload Zone Sub-component ─────────────────────────────────────────────────

function UploadZone({ label, required, hint, file, onFile }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    onFile({ name: f.name, url: URL.createObjectURL(f), type: f.type })
  }

  return (
    <div>
      <div className="t-label text-ink3 mb-1.5">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </div>
      {file ? (
        <div className="border-2 border-success rounded-lg px-3.5 py-3 bg-success-bg flex items-center gap-2.5">
          {file.type?.startsWith('image/') ? (
            <img src={file.url} alt="preview" className="w-12 h-12 object-cover rounded-md" />
          ) : (
            <div className="t-display">📄</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-success-text whitespace-nowrap overflow-hidden text-ellipsis">
              {file.name}
            </div>
            <div className="t-label text-ink3 mt-0.5">Uploaded successfully ✓</div>
          </div>
          <button
            className="btn btn-outline btn-xs"
            onClick={() => onFile(null)}
          >
            Change
          </button>
        </div>
      ) : (
        <div
          className={`upload-zone cursor-pointer${drag ? ' dragover' : ''}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <div className="t-h1 mb-1">📤</div>
          <div className="t-sm text-ink2">Tap to upload or drag & drop</div>
          {hint && <div className="t-xs text-ink3 mt-[3px]">{hint}</div>}
          <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} capture="environment" />
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Upload Documents ─────────────────────────────────────────────────

const ID_TYPES = ['Aadhaar Card', 'Passport', 'Driving Licence', 'Voter ID', 'PAN Card']

function Step3Documents({ data, onChange, onNext }) {
  const addToast = useToast()
  const set = (k, v) => onChange({ ...data, [k]: v })

  const handleContinue = () => {
    if (!data.idFront) { addToast('ID Front photo is required', 'danger'); return }
    if (!data.guestPhoto) { addToast('Guest photo is required', 'danger'); return }
    onNext()
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="t-sm text-ink2 m-0">
        Upload your government ID and a clear photo of yourself.
      </p>

      <Field label="ID Type" required>
        <select className="form-select" value={data.idType} onChange={(e) => set('idType', e.target.value)}>
          {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>

      <Field label="ID Number" required>
        <input className="form-input" value={data.idNumber}
          onChange={(e) => set('idNumber', e.target.value)} placeholder="Enter ID number" />
      </Field>

      <UploadZone
        label="ID Front"
        required
        hint="Use your device camera for best results"
        file={data.idFront}
        onFile={(f) => set('idFront', f)}
      />

      <UploadZone
        label="Guest Photo"
        required
        hint="Take a clear selfie — no caps or sunglasses"
        file={data.guestPhoto}
        onFile={(f) => set('guestPhoto', f)}
      />

      {/* Camera hint */}
      <div className="t-xs bg-info-bg border border-info rounded-lg px-3.5 py-2.5 text-info-text flex items-center gap-2">
        📷 <span>On mobile? Tap the upload zones above to use your device camera directly.</span>
      </div>

      <button
        className="btn btn-primary t-title w-full justify-center p-3 rounded-[9px]"
        onClick={handleContinue}
      >
        Continue →
      </button>
    </div>
  )
}

// ─── Step 4: Sign Terms ───────────────────────────────────────────────────────

function Step4Terms({ data, onChange, onNext }) {
  const addToast = useToast()
  const set = (k, v) => onChange({ ...data, [k]: v })

  const handleSubmit = () => {
    if (!data.signature.trim()) { addToast('Please enter your signature', 'danger'); return }
    if (!data.agreed) { addToast('Please agree to the terms and conditions', 'danger'); return }
    onNext()
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="t-sm text-ink2 m-0">
        Please read and accept our terms and conditions to complete your pre check-in.
      </p>

      {/* Terms scroll box */}
      <div
        className="t-xs h-[150px] overflow-y-auto bg-surface2 border border-line rounded-lg px-4 py-3.5 text-ink2 leading-[1.7]"
        style={{ scrollbarWidth: 'thin' }}
      >
        {TERMS_TEXT.split('\n\n').map((para, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0' }}>{para}</p>
        ))}
      </div>

      {/* Digital signature */}
      <div>
        <div className="t-label text-ink3 mb-1.5">
          Digital Signature <span className="text-danger">*</span>
        </div>
        <div
          className="rounded-lg overflow-hidden transition-[border-color] duration-[140ms] bg-surface border-2"
          style={{ borderColor: data.signature.trim() ? 'var(--gold)' : 'var(--border2)' }}
        >
          <div className="t-label text-ink3 px-3 pt-1.5">
            TYPE YOUR FULL NAME AS SIGNATURE
          </div>
          <input
            type="text"
            value={data.signature}
            onChange={(e) => set('signature', e.target.value)}
            placeholder="Sign here..."
            className="w-full border-none outline-none bg-transparent px-3.5 pt-2 pb-3 text-[20px] italic underline text-ink"
          />
        </div>
        <div className="t-xs text-ink3 mt-1">
          This constitutes a legally binding digital signature.
        </div>
      </div>

      {/* Agreement checkbox */}
      <label
        className="flex items-start gap-2.5 cursor-pointer px-3.5 py-3 rounded-lg border-[1.5px] transition-all duration-[140ms]"
        style={{
          borderColor: data.agreed ? 'var(--gold)' : 'var(--border)',
          background: data.agreed ? 'var(--gold-bg)' : 'var(--surface2)',
        }}
      >
        <input
          type="checkbox"
          checked={data.agreed}
          onChange={(e) => set('agreed', e.target.checked)}
          className="w-4 h-4 shrink-0 mt-px"
          style={{ accentColor: 'var(--gold)' }}
        />
        <span className="t-sm text-ink2 leading-[1.5]">
          I agree to the <strong className="text-ink">Terms and Conditions</strong> of {MOCK_BOOKING.hotelName} and confirm that all information provided is accurate.
        </span>
      </label>

      <button
        className="btn btn-primary t-title w-full justify-center p-3 rounded-[9px]"
        onClick={handleSubmit}
      >
        Confirm & Submit ✓
      </button>
    </div>
  )
}

// ─── Step 5: Confirmation ─────────────────────────────────────────────────────

function Step5Confirmation({ booking, guestName }) {
  const addToast = useToast()

  const handleDownload = () => {
    addToast('PDF download will be ready at check-in', 'info')
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi! I've completed my pre check-in for ${booking.hotelName}.\n\nBooking: ${booking.bookingNo}\nRoom: ${booking.room} (${booking.type})\nCheck-In: ${formatDate(booking.checkIn)}\nCheck-Out: ${formatDate(booking.checkOut)}\n\nGuest: ${guestName}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center py-2">
      {/* Green checkmark */}
      <div className="t-display w-[72px] h-[72px] rounded-full bg-success-bg border-[3px] border-success flex items-center justify-center text-success">
        ✓
      </div>

      {/* Title */}
      <div>
        <h2 className="t-h1 text-ink mt-0 mx-0 mb-1.5 tracking-[-0.03em]">
          Pre-Check-In Complete!
        </h2>
        <p className="t-sm text-ink2 m-0">
          Your details have been submitted successfully. Our team will verify everything before your arrival.
        </p>
      </div>

      {/* Summary card */}
      <div className="w-full bg-surface2 border border-line rounded-[10px] px-5 py-4 text-left">
        <div className="t-label text-ink3 mb-3.5">
          Booking Summary
        </div>
        {[
          { label: 'Guest',    value: guestName },
          { label: 'Room',     value: `${booking.room} · ${booking.type}` },
          { label: 'Check-In', value: formatDate(booking.checkIn) },
          { label: 'Check-Out', value: formatDate(booking.checkOut) },
          { label: 'Booking No', value: booking.bookingNo },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-[7px] border-b border-line">
            <span className="t-xs text-ink3">{label}</span>
            <span className="t-title text-ink">{value}</span>
          </div>
        ))}
      </div>

      {/* See you message */}
      <div className="t-title bg-[var(--gold-bg)] border border-[var(--gold-border)] rounded-lg px-4 py-3 w-full text-gold">
        See you on {formatDate(booking.checkIn)}! 🎉
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2.5 w-full">
        <button
          className="btn btn-outline t-sm w-full justify-center p-[11px]"
          onClick={handleDownload}
        >
          📄 Download Confirmation
        </button>
        <button
          className="t-title w-full p-[11px] rounded-md border-none cursor-pointer text-[#fff] flex items-center justify-center gap-[7px] transition-opacity duration-[140ms]"
          onClick={handleWhatsApp}
          style={{ background: '#25D366' }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Share via WhatsApp
        </button>
      </div>
    </div>
  )
}

// ─── Main GuestPortal ─────────────────────────────────────────────────────────

export default function GuestPortal() {
  const [step, setStep] = useState(1)

  const [verifyData, setVerifyData] = useState({
    fullName: MOCK_BOOKING.guestName,
    phone: MOCK_BOOKING.hotelPhone,
    email: '',
    dob: '',
    nationality: 'Indian',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
  })

  const [docsData, setDocsData] = useState({
    idType: 'Aadhaar Card',
    idNumber: '',
    idFront: null,
    guestPhoto: null,
  })

  const [termsData, setTermsData] = useState({
    signature: '',
    agreed: false,
  })

  const goNext = () => setStep((s) => Math.min(5, s + 1))
  const goBack = () => setStep((s) => Math.max(1, s - 1))

  return (
    <div className="fixed inset-0 bg-canvas z-[1500] flex flex-col items-center overflow-y-auto pt-7 px-4 pb-[60px]">
      <div className="w-full max-w-[480px]">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--gold)] mb-2.5">
            <span className="t-h2 text-[#000]">QV</span>
          </div>
          <div className="t-h2 text-ink tracking-[-0.03em]">
            {MOCK_BOOKING.hotelName}
          </div>
          <div className="text-[12px] text-ink3 mt-0.5 font-semibold uppercase tracking-[0.08em]">
            Self Check-In
          </div>
        </div>

        {/* Progress */}
        <PortalProgressBar current={step} total={5} />

        {/* Card */}
        <div className="bg-surface border border-line rounded-xl p-[22px] shadow-[var(--shadow-md)]">
          {/* Step heading */}
          <div className="mb-[18px]">
            <div className="t-h3 text-ink tracking-[-0.02em]">
              {STEP_LABELS[step - 1]}
            </div>
            <div className="w-7 h-0.5 bg-[var(--gold)] mt-[5px] rounded-[2px]" />
          </div>

          {/* Step content */}
          {step === 1 && <Step1Welcome booking={MOCK_BOOKING} onNext={goNext} />}
          {step === 2 && <Step2Verify booking={MOCK_BOOKING} data={verifyData} onChange={setVerifyData} onNext={goNext} />}
          {step === 3 && <Step3Documents data={docsData} onChange={setDocsData} onNext={goNext} />}
          {step === 4 && <Step4Terms data={termsData} onChange={setTermsData} onNext={goNext} />}
          {step === 5 && <Step5Confirmation booking={MOCK_BOOKING} guestName={verifyData.fullName} />}

          {/* Back link (steps 2–4) */}
          {step >= 2 && step <= 4 && (
            <div className="mt-3.5 text-center">
              <button
                onClick={goBack}
                className="t-xs bg-none border-none cursor-pointer text-ink3 p-0 transition-[color] duration-[140ms]"
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
              >
                ← Go Back
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="t-xs text-center mt-5 text-ink3">
          Secure self check-in powered by{' '}
          <span className="text-gold font-semibold">Quantum Vorvex</span>
        </div>
      </div>
    </div>
  )
}
