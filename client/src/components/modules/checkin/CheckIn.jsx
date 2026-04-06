import { useState } from 'react'
import FileUpload from '../../ui/FileUpload'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency, generateDocId } from '../../../utils/format'

// ─── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: 'Guest Details' },
  { number: 2, label: 'Room & Stay' },
  { number: 3, label: 'Food Options' },
  { number: 4, label: 'Documents' },
  { number: 5, label: 'Amenities' },
]

const AVAILABLE_ROOMS = [
  { id: '101', label: '101 — Single', type: 'Single', rate: 500 },
  { id: '201', label: '201 — Single', type: 'Single', rate: 500 },
  { id: '203', label: '203 — Suite',  type: 'Suite',  rate: 1500 },
  { id: '301', label: '301 — Single', type: 'Single', rate: 500 },
  { id: '304', label: '304 — Single', type: 'Single', rate: 500 },
]

const FOOD_PLANS = [
  { id: 1, name: 'Breakfast Only', desc: 'Morning meal included',       oneTime: 120, weekly: 700,  monthly: 2500 },
  { id: 2, name: 'All Meals',      desc: 'Breakfast, Lunch & Dinner',   oneTime: 350, weekly: 2100, monthly: 8000 },
  { id: 3, name: 'Dinner Only',    desc: 'Evening meal included',       oneTime: 180, weekly: 1050, monthly: 3500 },
  { id: 4, name: 'No Meals',       desc: 'Self-catering',               oneTime: 0,   weekly: 0,    monthly: 0    },
]

const STANDARD_FACILITIES = ['AC', 'WiFi', 'TV', 'Geyser', 'Hot Water', 'Parking (basic)', 'Balcony']

const EXTRA_AMENITIES = [
  { name: 'Mini Fridge',        daily: 50,  monthly: 800  },
  { name: 'Washing Machine',    daily: 80,  monthly: 1200 },
  { name: 'Parking (Premium)',  daily: 100, monthly: 1500 },
  { name: 'Gym Access',         daily: 150, monthly: 2000 },
  { name: 'Laundry Service',    daily: 200, monthly: null },
]

const GUEST_TAGS = ['VIP', 'Corporate', 'Long-term']

const today = new Date().toISOString().split('T')[0]

// ─── Initial State ─────────────────────────────────────────────────────────────

const initialFormData = {
  // Step 1
  name: '',
  phone: '',
  email: '',
  gender: '',
  dob: '',
  nationality: 'Indian',
  idType: '',
  idNumber: '',
  guestTags: [],
  source: 'walk_in',
  whatsappOptIn: true,
  address: '',
  emergencyName: '',
  emergencyPhone: '',
  notes: '',
  // Step 2
  stayType: 'daily',
  roomId: '',
  roomRate: '',
  checkInDate: today,
  checkOutDate: '',
  months: 1,
  securityDeposit: '',
  occupants: 1,
  specialRequests: '',
}

const initialDocs = {
  idFront: null,
  idBack: null,
  guestPhoto: null,
  additional: null,
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label style={{ display: 'block', marginBottom: 5 }}>
      <span className="form-label">{children}</span>
      {required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
    </label>
  )
}

function FieldGroup({ children, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
      {children}
    </div>
  )
}

function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <span style={{ fontSize: 11.5, color: 'var(--red-text)', display: 'block', marginTop: 4 }}>
      {msg}
    </span>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      fontFamily: "'Syne', sans-serif",
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--text)',
      letterSpacing: '-0.01em',
      paddingBottom: 6,
      borderBottom: '1px solid var(--border)',
      marginBottom: 2,
    }}>
      {children}
    </div>
  )
}

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 0,
      marginBottom: 32,
      overflowX: 'auto',
      paddingBottom: 4,
    }}>
      {STEPS.map((s, i) => {
        const isCompleted = step > s.number
        const isActive    = step === s.number
        return (
          <div key={s.number} style={{ display: 'flex', alignItems: 'flex-start' }}>
            {/* Circle + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
                transition: 'all 0.2s',
                background: isCompleted
                  ? 'var(--green)'
                  : isActive
                  ? 'var(--gold)'
                  : 'var(--surface2)',
                color: isCompleted
                  ? '#fff'
                  : isActive
                  ? '#000'
                  : 'var(--text3)',
                border: isCompleted
                  ? '2px solid var(--green)'
                  : isActive
                  ? '2px solid var(--gold)'
                  : '2px solid var(--border)',
                boxShadow: isActive ? '0 0 0 4px var(--gold-bg)' : 'none',
              }}>
                {isCompleted ? '✓' : s.number}
              </div>
              <span style={{
                marginTop: 6,
                fontSize: 10.5,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--gold)' : isCompleted ? 'var(--green-text)' : 'var(--text3)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
              }}>
                {s.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div style={{
                height: 2,
                width: 40,
                marginTop: 17,
                flexShrink: 0,
                background: step > s.number ? 'var(--green)' : 'var(--border)',
                transition: 'background 0.2s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Guest Details ─────────────────────────────────────────────────────

function Step1({ formData, onChange, errors }) {
  const toggle = (tag) => {
    const tags = formData.guestTags.includes(tag)
      ? formData.guestTags.filter(t => t !== tag)
      : [...formData.guestTags, tag]
    onChange('guestTags', tags)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px 20px' }}>
      <SectionTitle>Personal Information</SectionTitle>

      <FieldGroup>
        <Label required>Full Name</Label>
        <input className="form-input" value={formData.name}
          onChange={e => onChange('name', e.target.value)} placeholder="e.g. Ravi Kumar" />
        <ErrorMsg msg={errors.name} />
      </FieldGroup>

      <FieldGroup>
        <Label required>Phone</Label>
        <input className="form-input" value={formData.phone} type="tel"
          onChange={e => onChange('phone', e.target.value)} placeholder="10-digit mobile" />
        <ErrorMsg msg={errors.phone} />
      </FieldGroup>

      <FieldGroup fullWidth>
        <Label>Email</Label>
        <input className="form-input" value={formData.email} type="email"
          onChange={e => onChange('email', e.target.value)} placeholder="guest@example.com" />
      </FieldGroup>

      <FieldGroup>
        <Label>Gender</Label>
        <select className="form-select" value={formData.gender} onChange={e => onChange('gender', e.target.value)}>
          <option value="">— Select —</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
          <option>Prefer not to say</option>
        </select>
      </FieldGroup>

      <FieldGroup>
        <Label>Date of Birth</Label>
        <input className="form-input" type="date" value={formData.dob}
          onChange={e => onChange('dob', e.target.value)} />
      </FieldGroup>

      <FieldGroup>
        <Label>Nationality</Label>
        <input className="form-input" value={formData.nationality}
          onChange={e => onChange('nationality', e.target.value)} />
      </FieldGroup>

      <SectionTitle>Identity Verification</SectionTitle>

      <FieldGroup>
        <Label required>ID Type</Label>
        <select className="form-select" value={formData.idType} onChange={e => onChange('idType', e.target.value)}>
          <option value="">— Select —</option>
          <option>Aadhaar</option>
          <option>PAN</option>
          <option>Passport</option>
          <option>Voter ID</option>
          <option>Driving Licence</option>
        </select>
        <ErrorMsg msg={errors.idType} />
      </FieldGroup>

      <FieldGroup>
        <Label required>ID Number</Label>
        <input className="form-input" value={formData.idNumber}
          onChange={e => onChange('idNumber', e.target.value)} placeholder="Enter ID number" />
        <ErrorMsg msg={errors.idNumber} />
      </FieldGroup>

      <FieldGroup fullWidth>
        <Label>Guest Tags</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {GUEST_TAGS.map(tag => {
            const active = formData.guestTags.includes(tag)
            return (
              <button key={tag} type="button" onClick={() => toggle(tag)} style={{
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: active ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                background: active ? 'var(--gold-bg)' : 'var(--surface2)',
                color: active ? 'var(--gold)' : 'var(--text2)',
                transition: 'all 0.14s',
              }}>
                {tag}
              </button>
            )
          })}
        </div>
      </FieldGroup>

      <FieldGroup>
        <Label>Booking Source</Label>
        <select className="form-select" value={formData.source} onChange={e => onChange('source', e.target.value)}>
          <option value="walk_in">Walk-in</option>
          <option value="direct_call">Direct Call</option>
          <option value="referral">Referral</option>
          <option value="booking_com">Booking.com</option>
          <option value="makemytrip">MakeMyTrip</option>
          <option value="goibibo">Goibibo</option>
          <option value="airbnb">Airbnb</option>
          <option value="other">Other</option>
        </select>
      </FieldGroup>

      <FieldGroup>
        <Label>Communication Preferences</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input
            type="checkbox"
            id="whatsappOptIn"
            checked={formData.whatsappOptIn}
            onChange={e => onChange('whatsappOptIn', e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gold)' }}
          />
          <label htmlFor="whatsappOptIn" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
            ☑ Send updates &amp; reminders via WhatsApp
          </label>
        </div>
      </FieldGroup>

      <SectionTitle>Additional Details</SectionTitle>

      <FieldGroup fullWidth>
        <Label>Permanent Address</Label>
        <textarea className="form-textarea" value={formData.address}
          onChange={e => onChange('address', e.target.value)}
          placeholder="Full permanent address" rows={2} />
      </FieldGroup>

      <FieldGroup>
        <Label>Emergency Contact Name</Label>
        <input className="form-input" value={formData.emergencyName}
          onChange={e => onChange('emergencyName', e.target.value)} placeholder="Contact person name" />
      </FieldGroup>

      <FieldGroup>
        <Label>Emergency Contact Phone</Label>
        <input className="form-input" value={formData.emergencyPhone} type="tel"
          onChange={e => onChange('emergencyPhone', e.target.value)} placeholder="Emergency phone number" />
      </FieldGroup>

      <FieldGroup fullWidth>
        <Label>Notes</Label>
        <textarea className="form-textarea" value={formData.notes}
          onChange={e => onChange('notes', e.target.value)}
          placeholder="Any additional notes about the guest…" rows={2} />
      </FieldGroup>
    </div>
  )
}

// ─── Step 2: Room & Stay ───────────────────────────────────────────────────────

function computeSmartRate(baseRate, stayType, months) {
  if (stayType === 'monthly' && months >= 3) return { rate: Math.round(baseRate * 0.9), rule: 'Long Stay −10%' }
  if (stayType === 'monthly' && months >= 1) return { rate: baseRate, rule: 'Standard Rate' }
  return { rate: baseRate, rule: 'Standard Rate' }
}

function Step2({ formData, onChange, errors }) {
  const handleRoomChange = (roomId) => {
    const room = AVAILABLE_ROOMS.find(r => r.id === roomId)
    onChange('roomId', roomId)
    if (room) onChange('roomRate', room.rate)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px 20px' }}>
      {/* Stay Type Toggle */}
      <FieldGroup fullWidth>
        <Label>Stay Type</Label>
        <div style={{
          display: 'inline-flex',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 3,
          gap: 3,
          marginTop: 4,
        }}>
          {['daily', 'monthly'].map(type => (
            <button key={type} type="button"
              onClick={() => onChange('stayType', type)}
              style={{
                padding: '7px 22px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.15s',
                background: formData.stayType === type ? 'var(--gold)' : 'transparent',
                color: formData.stayType === type ? '#000' : 'var(--text2)',
                textTransform: 'capitalize',
              }}>
              {type}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup>
        <Label required>Room Number</Label>
        <select className="form-select" value={formData.roomId}
          onChange={e => handleRoomChange(e.target.value)}>
          <option value="">— Select Room —</option>
          {AVAILABLE_ROOMS.map(r => (
            <option key={r.id} value={r.id}>
              {r.label} — {formatCurrency(r.rate)}/day
            </option>
          ))}
        </select>
        <ErrorMsg msg={errors.roomId} />
        {formData.roomId && (() => {
          const room = AVAILABLE_ROOMS.find(r => r.id === formData.roomId)
          if (!room) return null
          const { rate: computedRate, rule: appliedRule } = computeSmartRate(room.rate, formData.stayType, formData.months)
          return (
            <div style={{ padding: '8px 12px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 6, fontSize: 12, color: 'var(--gold)', marginTop: 6 }}>
              ✦ Smart Rate: ₹{computedRate}/day — {appliedRule}
            </div>
          )
        })()}
      </FieldGroup>

      <FieldGroup>
        <Label required>Check-In Date</Label>
        <input className="form-input" type="date" value={formData.checkInDate}
          onChange={e => onChange('checkInDate', e.target.value)} />
        <ErrorMsg msg={errors.checkInDate} />
      </FieldGroup>

      {formData.stayType === 'daily' ? (
        <FieldGroup>
          <Label>Check-Out Date</Label>
          <input className="form-input" type="date" value={formData.checkOutDate}
            min={formData.checkInDate}
            onChange={e => onChange('checkOutDate', e.target.value)} />
        </FieldGroup>
      ) : (
        <FieldGroup>
          <Label>Number of Months</Label>
          <input className="form-input" type="number" value={formData.months} min={1}
            onChange={e => onChange('months', parseInt(e.target.value) || 1)} />
        </FieldGroup>
      )}

      <FieldGroup>
        <Label>Room Rate (₹)</Label>
        <input className="form-input" type="number" value={formData.roomRate}
          onChange={e => onChange('roomRate', e.target.value)}
          placeholder="Auto-filled from room" />
      </FieldGroup>

      <FieldGroup>
        <Label>Security Deposit (₹)</Label>
        <input className="form-input" type="number" value={formData.securityDeposit}
          onChange={e => onChange('securityDeposit', e.target.value)} placeholder="0" />
      </FieldGroup>

      <FieldGroup>
        <Label>No. of Occupants</Label>
        <input className="form-input" type="number" value={formData.occupants} min={1}
          onChange={e => onChange('occupants', parseInt(e.target.value) || 1)} />
      </FieldGroup>

      <FieldGroup fullWidth>
        <Label>Special Requests</Label>
        <textarea className="form-textarea" value={formData.specialRequests}
          onChange={e => onChange('specialRequests', e.target.value)}
          placeholder="e.g. ground floor preference, extra pillows…" rows={2} />
      </FieldGroup>
    </div>
  )
}

// ─── Step 3: Food Options ──────────────────────────────────────────────────────

function Step3({ selectedFoodPlan, setSelectedFoodPlan, foodBilling, setFoodBilling }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>
        Select a meal plan for the guest. Only one plan can be active at a time.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {FOOD_PLANS.map(plan => {
          const isSelected = selectedFoodPlan === plan.id
          return (
            <div key={plan.id} onClick={() => setSelectedFoodPlan(plan.id)} style={{
              border: isSelected ? '2px solid var(--gold)' : '1.5px solid var(--border)',
              borderRadius: 10,
              padding: '16px',
              cursor: 'pointer',
              background: isSelected ? 'var(--gold-bg)' : 'var(--surface)',
              transition: 'all 0.15s',
              boxShadow: isSelected ? '0 0 0 3px var(--gold-bg)' : 'none',
            }}>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                color: isSelected ? 'var(--gold)' : 'var(--text)',
                marginBottom: 3,
              }}>
                {plan.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                {plan.desc}
              </div>

              {/* Pricing rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {[
                  { label: 'One-time', value: plan.oneTime },
                  { label: 'Weekly',   value: plan.weekly  },
                  { label: 'Monthly',  value: plan.monthly },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)' }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {row.value > 0 ? formatCurrency(row.value) : 'Free'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Billing type toggle (only for non-free plans) */}
              {plan.oneTime > 0 && isSelected && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['oneTime', 'weekly', 'monthly'].map(b => (
                    <button key={b} type="button"
                      onClick={e => { e.stopPropagation(); setFoodBilling(b) }}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 500,
                        border: foodBilling === b ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                        background: foodBilling === b ? 'var(--gold)' : 'transparent',
                        color: foodBilling === b ? '#000' : 'var(--text2)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}>
                      {b === 'oneTime' ? 'One-time' : b.charAt(0).toUpperCase() + b.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 4: Documents ─────────────────────────────────────────────────────────

function Step4({ formData, docs, setDocs }) {
  const update = (key, file) => setDocs(prev => ({ ...prev, [key]: file }))

  return (
    <div>
      {/* KYC Info */}
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 20,
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
      }}>
        <div>
          <span className="form-label">ID Type</span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>
            {formData.idType || '—'}
          </div>
        </div>
        <div>
          <span className="form-label">ID Number</span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
            {formData.idNumber || '—'}
          </div>
        </div>
      </div>

      {/* Upload Zones 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <div>
          <Label required>ID Front</Label>
          <FileUpload
            label="Upload ID Front"
            accept=".jpg,.jpeg,.png,.pdf"
            maxSizeMB={5}
            onFile={f => update('idFront', f)}
          />
        </div>
        <div>
          <Label>ID Back</Label>
          <FileUpload
            label="Upload ID Back"
            accept=".jpg,.jpeg,.png,.pdf"
            maxSizeMB={5}
            onFile={f => update('idBack', f)}
          />
        </div>
        <div>
          <Label required>Guest Photo</Label>
          <FileUpload
            label="Upload Guest Photo"
            accept=".jpg,.jpeg,.png"
            maxSizeMB={2}
            onFile={f => update('guestPhoto', f)}
          />
        </div>
        <div>
          <Label>Additional Document</Label>
          <FileUpload
            label="Upload Document"
            accept="*"
            maxSizeMB={5}
            onFile={f => update('additional', f)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 5: Amenities ─────────────────────────────────────────────────────────

function Step5({ formData, selectedFacilities, setSelectedFacilities, selectedAmenities, setSelectedAmenities, amenityNotes, setAmenityNotes }) {
  const toggleFacility = (name) => {
    setSelectedFacilities(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    )
  }

  const toggleAmenity = (name) => {
    setSelectedAmenities(prev =>
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    )
  }

  const isMonthly = formData.stayType === 'monthly'

  return (
    <div>
      {/* Standard Facilities */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}>
          Standard Facilities
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginLeft: 8, fontFamily: 'Inter' }}>No additional charge</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STANDARD_FACILITIES.map(name => {
            const active = selectedFacilities.includes(name)
            return (
              <button key={name} type="button" onClick={() => toggleFacility(name)} style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                border: active ? '1.5px solid var(--green)' : '1.5px solid var(--border)',
                background: active ? 'var(--green-bg)' : 'var(--surface2)',
                color: active ? 'var(--green-text)' : 'var(--text2)',
                transition: 'all 0.14s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}>
                {active && <span style={{ fontSize: 10 }}>✓</span>}
                {name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Extra Amenities */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}>
          Extra Amenities
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--amber-text)', marginLeft: 8, fontFamily: 'Inter' }}>Chargeable</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXTRA_AMENITIES.map(amenity => {
            const active = selectedAmenities.includes(amenity.name)
            const rate = isMonthly
              ? (amenity.monthly != null ? `${formatCurrency(amenity.monthly)}/mo` : `${formatCurrency(amenity.daily)}/day`)
              : `${formatCurrency(amenity.daily)}/day`

            return (
              <button key={amenity.name} type="button" onClick={() => toggleAmenity(amenity.name)} style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                border: active ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                background: active ? 'var(--gold-bg)' : 'var(--surface2)',
                color: active ? 'var(--gold)' : 'var(--text2)',
                transition: 'all 0.14s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {active && <span style={{ fontSize: 10 }}>✓</span>}
                <span>{amenity.name}</span>
                <span style={{
                  fontSize: 10.5,
                  background: active ? 'rgba(201,168,76,0.2)' : 'var(--surface)',
                  border: '1px solid',
                  borderColor: active ? 'var(--gold-border)' : 'var(--border)',
                  borderRadius: 10,
                  padding: '1px 6px',
                  color: active ? 'var(--gold)' : 'var(--text3)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {rate}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Amenity Notes */}
      <div>
        <Label>Amenity Notes</Label>
        <textarea className="form-textarea" value={amenityNotes}
          onChange={e => setAmenityNotes(e.target.value)}
          placeholder="Any specific requests or notes about amenities…"
          rows={2} />
      </div>
    </div>
  )
}

// ─── Main CheckIn Component ────────────────────────────────────────────────────

export default function CheckIn() {
  const addToast = useToast()

  const [step, setStep] = useState(1)
  const [formData, setFormData]                 = useState(initialFormData)
  const [selectedFoodPlan, setSelectedFoodPlan] = useState(4)   // default: No Meals
  const [foodBilling, setFoodBilling]           = useState('monthly')
  const [selectedFacilities, setSelectedFacilities] = useState(['WiFi', 'AC'])
  const [selectedAmenities, setSelectedAmenities]   = useState([])
  const [amenityNotes, setAmenityNotes]         = useState('')
  const [docs, setDocs]                         = useState(initialDocs)
  const [errors, setErrors]                     = useState({})

  const update = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  // ── Per-step validation ──────────────────────────────────────────────────────

  const validate = () => {
    const errs = {}

    if (step === 1) {
      if (!formData.name.trim())    errs.name    = 'Full name is required'
      if (!formData.phone.trim())   errs.phone   = 'Phone number is required'
      if (!formData.idType)         errs.idType  = 'ID type is required'
      if (!formData.idNumber.trim()) errs.idNumber = 'ID number is required'
    }

    if (step === 2) {
      if (!formData.roomId)           errs.roomId     = 'Please select a room'
      if (!formData.checkInDate)      errs.checkInDate = 'Check-in date is required'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (!validate()) return
    setStep(s => Math.min(s + 1, 5))
  }

  const handleBack = () => {
    setErrors({})
    setStep(s => Math.max(s - 1, 1))
  }

  // ── Complete Check-In ────────────────────────────────────────────────────────

  const handleComplete = () => {
    // Final validation on required fields
    const required = {
      name:        formData.name.trim(),
      phone:       formData.phone.trim(),
      idType:      formData.idType,
      idNumber:    formData.idNumber.trim(),
      roomId:      formData.roomId,
      checkInDate: formData.checkInDate,
    }
    const missing = Object.entries(required).filter(([, v]) => !v)
    if (missing.length > 0) {
      addToast({ type: 'error', message: 'Please complete all required fields before submitting.' })
      return
    }

    const docId = generateDocId()
    const SOURCE_LABELS = {
      walk_in: 'Walk-in', direct_call: 'Direct Call', referral: 'Referral',
      booking_com: 'Booking.com', makemytrip: 'MakeMyTrip', goibibo: 'Goibibo',
      airbnb: 'Airbnb', other: 'Other',
    }
    const sourceLabel = SOURCE_LABELS[formData.source] || formData.source
    addToast({ type: 'success', message: `Check-in complete! ${docId} created for ${formData.name} via ${sourceLabel}` })

    // Reset
    setStep(1)
    setFormData(initialFormData)
    setSelectedFoodPlan(4)
    setFoodBilling('monthly')
    setSelectedFacilities(['WiFi', 'AC'])
    setSelectedAmenities([])
    setAmenityNotes('')
    setDocs(initialDocs)
    setErrors({})
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: '-0.03em',
          margin: 0,
        }}>
          New Check-In
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
          Register a new guest across 5 easy steps
        </p>
      </div>

      {/* Wizard Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '28px 28px 22px',
        boxShadow: 'var(--shadow)',
      }}>
        <StepIndicator step={step} />

        {/* Step Content */}
        <div style={{ minHeight: 300 }}>
          {step === 1 && (
            <Step1 formData={formData} onChange={update} errors={errors} />
          )}
          {step === 2 && (
            <Step2 formData={formData} onChange={update} errors={errors} />
          )}
          {step === 3 && (
            <Step3
              selectedFoodPlan={selectedFoodPlan}
              setSelectedFoodPlan={setSelectedFoodPlan}
              foodBilling={foodBilling}
              setFoodBilling={setFoodBilling}
            />
          )}
          {step === 4 && (
            <Step4 formData={formData} docs={docs} setDocs={setDocs} />
          )}
          {step === 5 && (
            <Step5
              formData={formData}
              selectedFacilities={selectedFacilities}
              setSelectedFacilities={setSelectedFacilities}
              selectedAmenities={selectedAmenities}
              setSelectedAmenities={setSelectedAmenities}
              amenityNotes={amenityNotes}
              setAmenityNotes={setAmenityNotes}
            />
          )}
        </div>

        {/* Navigation Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 28,
          paddingTop: 18,
          borderTop: '1px solid var(--border)',
          gap: 12,
        }}>
          {/* Back */}
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="btn btn-outline"
            style={{ opacity: step === 1 ? 0.4 : 1, cursor: step === 1 ? 'not-allowed' : 'pointer' }}
          >
            ← Back
          </button>

          {/* Step label */}
          <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
            Step {step} of {STEPS.length}
          </span>

          {/* Next / Complete */}
          {step < 5 ? (
            <button type="button" onClick={handleNext} className="btn btn-primary">
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 24px', fontSize: 14, fontWeight: 700, maxWidth: 280 }}
            >
              Complete Check-In
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
