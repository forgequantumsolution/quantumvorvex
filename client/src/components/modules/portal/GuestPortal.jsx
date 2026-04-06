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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1
        const isCompleted = stepNum < current
        const isActive = stepNum === current
        return (
          <div key={stepNum} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
                transition: 'all 0.2s',
                ...(isCompleted
                  ? { background: 'var(--green)', color: '#fff', border: '2px solid var(--green)' }
                  : isActive
                  ? { background: 'var(--gold)', color: '#000', border: '2px solid var(--gold)' }
                  : { background: 'transparent', color: 'var(--text3)', border: '2px solid var(--border2)' }),
              }}
              title={STEP_LABELS[i]}
            >
              {isCompleted ? '✓' : stepNum}
            </div>
            {stepNum < total && (
              <div style={{
                width: 32, height: 2,
                background: isCompleted ? 'var(--green)' : 'var(--border2)',
                transition: 'background 0.2s',
              }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function Step1Welcome({ booking, onNext }) {
  const firstName = booking.guestName.split(' ')[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome message */}
      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
        <h2 style={{
          fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800,
          color: 'var(--text)', margin: 0, letterSpacing: '-0.03em',
        }}>
          Welcome, {firstName}!
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
          Complete your self check-in in just a few steps.
        </p>
      </div>

      {/* Booking summary card */}
      <div style={{
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          background: 'var(--gold)', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: '#000' }}>
            {booking.hotelName}
          </span>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#000', opacity: 0.8 }}>
            {booking.bookingNo}
          </span>
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Room</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{booking.room}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{booking.type}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Guest</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{booking.guestName}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Check-In</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{formatDate(booking.checkIn)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Check-Out</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{formatDate(booking.checkOut)}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            📞 {booking.hotelPhone}
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={onNext}
        style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, fontWeight: 700, borderRadius: 9 }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
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
        className="btn btn-primary"
        onClick={handleSubmit}
        style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, fontWeight: 700, borderRadius: 9, marginTop: 6 }}
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
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </div>
      {file ? (
        <div style={{
          border: '2px solid var(--green)', borderRadius: 8, padding: '12px 14px',
          background: 'var(--green-bg)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {file.type?.startsWith('image/') ? (
            <img src={file.url} alt="preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
          ) : (
            <div style={{ fontSize: 28 }}>📄</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Uploaded successfully ✓</div>
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
          className={`upload-zone${drag ? ' dragover' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>📤</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>Tap to upload or drag & drop</div>
          {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{hint}</div>}
          <input ref={inputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
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
      <div style={{
        background: 'var(--blue-bg)', border: '1px solid var(--blue)',
        borderRadius: 8, padding: '10px 14px',
        fontSize: 12, color: 'var(--blue-text)', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        📷 <span>On mobile? Tap the upload zones above to use your device camera directly.</span>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleContinue}
        style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, fontWeight: 700, borderRadius: 9 }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
        Please read and accept our terms and conditions to complete your pre check-in.
      </p>

      {/* Terms scroll box */}
      <div style={{
        height: 150, overflowY: 'auto',
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '14px 16px',
        fontSize: 12, color: 'var(--text2)', lineHeight: 1.7,
        scrollbarWidth: 'thin',
      }}>
        {TERMS_TEXT.split('\n\n').map((para, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0' }}>{para}</p>
        ))}
      </div>

      {/* Digital signature */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
          Digital Signature <span style={{ color: 'var(--red)' }}>*</span>
        </div>
        <div style={{
          border: `2px solid ${data.signature.trim() ? 'var(--gold)' : 'var(--border2)'}`,
          borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.14s',
          background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', padding: '6px 12px 0', fontWeight: 600, letterSpacing: '0.03em' }}>
            TYPE YOUR FULL NAME AS SIGNATURE
          </div>
          <input
            type="text"
            value={data.signature}
            onChange={(e) => set('signature', e.target.value)}
            placeholder="Sign here..."
            style={{
              width: '100%', border: 'none', outline: 'none',
              background: 'transparent', padding: '8px 14px 12px',
              fontSize: 20, fontStyle: 'italic', textDecoration: 'underline',
              color: 'var(--text)', fontFamily: 'Georgia, serif',
            }}
          />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          This constitutes a legally binding digital signature.
        </div>
      </div>

      {/* Agreement checkbox */}
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
        padding: '12px 14px', borderRadius: 8,
        border: `1.5px solid ${data.agreed ? 'var(--gold)' : 'var(--border)'}`,
        background: data.agreed ? 'var(--gold-bg)' : 'var(--surface2)',
        transition: 'all 0.14s',
      }}>
        <input
          type="checkbox"
          checked={data.agreed}
          onChange={(e) => set('agreed', e.target.checked)}
          style={{ accentColor: 'var(--gold)', width: 16, height: 16, flexShrink: 0, marginTop: 1 }}
        />
        <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
          I agree to the <strong style={{ color: 'var(--text)' }}>Terms and Conditions</strong> of {MOCK_BOOKING.hotelName} and confirm that all information provided is accurate.
        </span>
      </label>

      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, fontWeight: 700, borderRadius: 9 }}
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', padding: '8px 0' }}>
      {/* Green checkmark */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'var(--green-bg)', border: '3px solid var(--green)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 34, color: 'var(--green)',
      }}>
        ✓
      </div>

      {/* Title */}
      <div>
        <h2 style={{
          fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
          color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.03em',
        }}>
          Pre-Check-In Complete!
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
          Your details have been submitted successfully. Our team will verify everything before your arrival.
        </p>
      </div>

      {/* Summary card */}
      <div style={{
        width: '100%', background: 'var(--surface2)',
        border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px',
        textAlign: 'left',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
          Booking Summary
        </div>
        {[
          { label: 'Guest',    value: guestName },
          { label: 'Room',     value: `${booking.room} · ${booking.type}` },
          { label: 'Check-In', value: formatDate(booking.checkIn) },
          { label: 'Check-Out', value: formatDate(booking.checkOut) },
          { label: 'Booking No', value: booking.bookingNo },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* See you message */}
      <div style={{
        background: 'var(--gold-bg)', border: '1px solid var(--gold-border)',
        borderRadius: 8, padding: '12px 16px', width: '100%',
        fontSize: 13, color: 'var(--gold)', fontWeight: 600,
      }}>
        See you on {formatDate(booking.checkIn)}! 🎉
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <button
          className="btn btn-outline"
          onClick={handleDownload}
          style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 13 }}
        >
          📄 Download Confirmation
        </button>
        <button
          onClick={handleWhatsApp}
          style={{
            width: '100%', padding: '11px', fontSize: 13, fontWeight: 600,
            borderRadius: 6, border: 'none', cursor: 'pointer',
            background: '#25D366', color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'opacity 0.14s',
          }}
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
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--main-bg)',
        zIndex: 1500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        padding: '28px 16px 60px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--gold)', marginBottom: 10,
          }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#000' }}>QV</span>
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
            {MOCK_BOOKING.hotelName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Self Check-In
          </div>
        </div>

        {/* Progress */}
        <PortalProgressBar current={step} total={5} />

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '22px 22px',
          boxShadow: 'var(--shadow-md)',
        }}>
          {/* Step heading */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
              color: 'var(--text)', letterSpacing: '-0.02em',
            }}>
              {STEP_LABELS[step - 1]}
            </div>
            <div style={{ width: 28, height: 2, background: 'var(--gold)', marginTop: 5, borderRadius: 2 }} />
          </div>

          {/* Step content */}
          {step === 1 && <Step1Welcome booking={MOCK_BOOKING} onNext={goNext} />}
          {step === 2 && <Step2Verify booking={MOCK_BOOKING} data={verifyData} onChange={setVerifyData} onNext={goNext} />}
          {step === 3 && <Step3Documents data={docsData} onChange={setDocsData} onNext={goNext} />}
          {step === 4 && <Step4Terms data={termsData} onChange={setTermsData} onNext={goNext} />}
          {step === 5 && <Step5Confirmation booking={MOCK_BOOKING} guestName={verifyData.fullName} />}

          {/* Back link (steps 2–4) */}
          {step >= 2 && step <= 4 && (
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button
                onClick={goBack}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--text3)', padding: 0,
                  transition: 'color 0.14s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
              >
                ← Go Back
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text3)' }}>
          Secure self check-in powered by{' '}
          <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Quantum Vorvex</span>
        </div>
      </div>
    </div>
  )
}
