import { useState, useRef, useCallback } from 'react'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency } from '../../../utils/format'
import { useStore } from '../../../store/useStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Hotel Profile',
  'Floor & Rooms',
  'Room Types',
  'Facilities',
  'Food Plans',
  'Staff',
  'Preview',
]

const ROOM_TYPE_PRESETS = [
  { name: 'Single',  dailyRate: 500,  monthlyRate: 9000  },
  { name: 'Double',  dailyRate: 800,  monthlyRate: 14000 },
  { name: 'Suite',   dailyRate: 1500, monthlyRate: 28000 },
  { name: 'Deluxe',  dailyRate: 1200, monthlyRate: 22000 },
]

const ALL_FACILITIES = [
  'AC', 'WiFi', 'TV', 'Geyser', 'Hot Water', 'RO Water',
  'CCTV', 'Parking', 'Elevator', 'Laundry',
]

const INIT_AMENITIES = [
  { id: 'am1', name: 'Mini Fridge',     daily: 50,  monthly: 800  },
  { id: 'am2', name: 'Washing Machine', daily: 80,  monthly: 1200 },
  { id: 'am3', name: 'Gym Access',      daily: 150, monthly: 2000 },
]

const INIT_FOOD_PLANS = [
  { id: 'fp1', name: 'Breakfast Only', oneTime: 120, weekly: 700,  monthly: 2500 },
  { id: 'fp2', name: 'Lunch Only',     oneTime: 150, weekly: 900,  monthly: 3000 },
  { id: 'fp3', name: 'Dinner Only',    oneTime: 180, weekly: 1050, monthly: 3500 },
  { id: 'fp4', name: 'All Meals',      oneTime: 350, weekly: 2100, monthly: 8000 },
]

const ROLES = ['super_admin', 'manager', 'receptionist', 'housekeeping', 'accountant']

function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────

function StepProgressBar({ current, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1
        const isCompleted = stepNum < current
        const isActive = stepNum === current
        const isFuture = stepNum > current
        return (
          <div key={stepNum} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Circle */}
            <div
              style={{
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
                ...(isCompleted
                  ? { background: 'var(--green)', color: '#fff', border: '2px solid var(--green)' }
                  : isActive
                  ? { background: 'var(--gold)', color: '#000', border: '2px solid var(--gold)', boxShadow: '0 0 0 4px var(--gold-bg)' }
                  : { background: 'transparent', color: 'var(--text3)', border: '2px solid var(--border2)' }),
              }}
              title={STEP_LABELS[i]}
            >
              {isCompleted ? '✓' : stepNum}
            </div>
            {/* Connector */}
            {stepNum < total && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  background: isCompleted ? 'var(--green)' : 'var(--border2)',
                  transition: 'background 0.2s',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Field Helper ─────────────────────────────────────────────────────────────

function Field({ label, required, children, fullWidth, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: fullWidth ? '1 / -1' : undefined, ...style }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Step 1: Hotel Profile ────────────────────────────────────────────────────

function Step1Profile({ data, onChange }) {
  const [drag, setDrag] = useState(false)
  const fileRef = useRef()

  const set = (k, v) => onChange({ ...data, [k]: v })

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be under 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => set('logoUrl', e.target.result)
    reader.readAsDataURL(file)
  }

  const initials = (data.hotelName || 'QV')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Logo upload */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Preview circle */}
        <div
          style={{
            width: 80, height: 80, borderRadius: '50%',
            border: '2px solid var(--border2)',
            overflow: 'hidden', flexShrink: 0,
            background: 'var(--gold-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne', sans-serif", fontWeight: 700,
            fontSize: 22, color: 'var(--gold)',
          }}
        >
          {data.logoUrl
            ? <img src={data.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials}
        </div>
        {/* Drop zone */}
        <div
          className={`upload-zone${drag ? ' dragover' : ''}`}
          style={{ flex: 1, cursor: 'pointer' }}
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>
            {data.logoUrl ? 'Click to change logo' : 'Drag & drop hotel logo'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>PNG, JPG — max 2MB</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
        <Field label="Hotel Name" required>
          <input className="form-input" value={data.hotelName} onChange={(e) => set('hotelName', e.target.value)} placeholder="e.g. Quantum Vorvex" />
        </Field>
        <Field label="Owner Name" required>
          <input className="form-input" value={data.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="e.g. Ramesh Gupta" />
        </Field>
        <Field label="Phone" required>
          <input className="form-input" value={data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9876543210" maxLength={10} />
        </Field>
        <Field label="Email">
          <input className="form-input" type="email" value={data.email} onChange={(e) => set('email', e.target.value)} placeholder="manager@hotel.com" />
        </Field>
        <Field label="GSTIN">
          <input className="form-input" value={data.gstin} onChange={(e) => set('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
        </Field>
        <Field label="License No">
          <input className="form-input" value={data.licenseNo} onChange={(e) => set('licenseNo', e.target.value)} placeholder="MH-2024-HOTEL-001" />
        </Field>
        <Field label="Address" fullWidth>
          <textarea className="form-textarea" value={data.address} onChange={(e) => set('address', e.target.value)} placeholder="Hotel street address..." rows={3} />
        </Field>
      </div>
    </div>
  )
}

// ─── Step 2: Floor & Room Setup ───────────────────────────────────────────────

function generateRoomNumbers({ floors, roomsPerFloor, format, prefix }) {
  const rooms = []
  let seq = 1
  for (let f = 1; f <= floors; f++) {
    for (let r = 1; r <= roomsPerFloor; r++) {
      if (format === 'floor_seq') {
        rooms.push(`${f}${String(r).padStart(2, '0')}`)
      } else if (format === 'seq_only') {
        rooms.push(String(seq++))
      } else {
        rooms.push(`${prefix || 'A'}-${f}${String(r).padStart(2, '0')}`)
      }
    }
  }
  return rooms
}

function Step2Floors({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })

  const previewRooms = data.rooms.length > 0 ? data.rooms : []
  const totalCount = data.floors * data.roomsPerFloor
  const display = previewRooms.slice(0, 12)
  const extra = previewRooms.length - display.length

  const handleGenerate = () => {
    const rooms = generateRoomNumbers({
      floors: data.floors,
      roomsPerFloor: data.roomsPerFloor,
      format: data.format,
      prefix: data.prefix,
    })
    onChange({ ...data, rooms })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
        <Field label="Number of Floors" required>
          <input
            className="form-input" type="number" min={1} max={10}
            value={data.floors} onChange={(e) => set('floors', Math.min(10, Math.max(1, +e.target.value)))}
          />
        </Field>
        <Field label="Rooms Per Floor" required>
          <input
            className="form-input" type="number" min={1} max={20}
            value={data.roomsPerFloor} onChange={(e) => set('roomsPerFloor', Math.min(20, Math.max(1, +e.target.value)))}
          />
        </Field>
      </div>

      {/* Format selection */}
      <Field label="Room Number Format" required>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 4 }}>
          {[
            { id: 'floor_seq', label: 'Floor + Sequential', example: '101, 102, 201...' },
            { id: 'seq_only',  label: 'Sequential Only',    example: '1, 2, 3...' },
            { id: 'custom',    label: 'Custom Prefix',       example: 'A-101, A-102...' },
          ].map((opt) => {
            const isActive = data.format === opt.id
            return (
              <div
                key={opt.id}
                onClick={() => set('format', opt.id)}
                style={{
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                  background: isActive ? 'var(--gold-bg)' : 'var(--surface2)',
                  transition: 'all 0.14s',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--gold)' : 'var(--text)', marginBottom: 4 }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {opt.example}
                </div>
              </div>
            )
          })}
        </div>
      </Field>

      {data.format === 'custom' && (
        <Field label="Custom Prefix">
          <input
            className="form-input"
            value={data.prefix}
            onChange={(e) => set('prefix', e.target.value)}
            placeholder="e.g. A, B, WING-1"
            style={{ maxWidth: 200 }}
          />
        </Field>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {totalCount} total rooms ({data.floors} floor{data.floors !== 1 ? 's' : ''} × {data.roomsPerFloor} rooms)
        </span>
        <button className="btn btn-primary btn-sm" onClick={handleGenerate}>
          Generate Rooms
        </button>
      </div>

      {previewRooms.length > 0 && (
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            Room Preview
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {display.map((r) => (
              <span key={r} style={{
                padding: '3px 9px', borderRadius: 4, fontSize: 11.5,
                background: 'var(--surface)', border: '1px solid var(--border)',
                fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)',
              }}>
                {r}
              </span>
            ))}
            {extra > 0 && (
              <span style={{ padding: '3px 9px', fontSize: 11.5, color: 'var(--text3)', fontStyle: 'italic' }}>
                ...and {extra} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Room Types & Rates ───────────────────────────────────────────────

function Step3RoomTypes({ data, onChange }) {
  const { roomTypes, bulkSelected, bulkType } = data
  const setTypes = (rt) => onChange({ ...data, roomTypes: rt })
  const setField = (roomNo, field, val) => {
    setTypes(roomTypes.map((r) => r.roomNo === roomNo ? { ...r, [field]: val } : r))
  }
  const toggleBulk = (roomNo) => {
    const sel = bulkSelected.includes(roomNo)
      ? bulkSelected.filter((r) => r !== roomNo)
      : [...bulkSelected, roomNo]
    onChange({ ...data, bulkSelected: sel })
  }
  const applyBulk = () => {
    if (!bulkType) return
    setTypes(roomTypes.map((r) => bulkSelected.includes(r.roomNo)
      ? { ...r, type: bulkType, dailyRate: ROOM_TYPE_PRESETS.find(p => p.name === bulkType)?.dailyRate || r.dailyRate, monthlyRate: ROOM_TYPE_PRESETS.find(p => p.name === bulkType)?.monthlyRate || r.monthlyRate }
      : r))
    onChange({ ...data, bulkSelected: [], bulkType: '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Rate reference cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {ROOM_TYPE_PRESETS.map((p) => (
          <div key={p.name} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Daily: {formatCurrency(p.dailyRate)}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Monthly: {formatCurrency(p.monthlyRate)}</div>
          </div>
        ))}
      </div>

      {/* Bulk assign */}
      {roomTypes.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--gold-bg)', border: '1px solid var(--gold-border)',
          borderRadius: 8, padding: '10px 14px',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>
            Bulk Assign ({bulkSelected.length} selected):
          </span>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 120 }}
            value={bulkType}
            onChange={(e) => onChange({ ...data, bulkType: e.target.value })}
          >
            <option value="">— Choose Type —</option>
            {ROOM_TYPE_PRESETS.map((p) => <option key={p.name}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={applyBulk} disabled={!bulkSelected.length || !bulkType}>
            Apply
          </button>
          {bulkSelected.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => onChange({ ...data, bulkSelected: [] })}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {roomTypes.length === 0 ? (
        <div className="empty-state">No rooms generated yet. Go back to Step 2 and click "Generate Rooms".</div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={bulkSelected.length === roomTypes.length && roomTypes.length > 0}
                    onChange={(e) => onChange({ ...data, bulkSelected: e.target.checked ? roomTypes.map(r => r.roomNo) : [] })}
                  />
                </th>
                <th>Room No</th>
                <th>Type</th>
                <th>Daily Rate ₹</th>
                <th>Monthly Rate ₹</th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((r) => (
                <tr key={r.roomNo}>
                  <td>
                    <input type="checkbox" checked={bulkSelected.includes(r.roomNo)} onChange={() => toggleBulk(r.roomNo)} />
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--text)' }}>{r.roomNo}</td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '5px 8px', fontSize: 12 }}
                      value={r.type}
                      onChange={(e) => {
                        const preset = ROOM_TYPE_PRESETS.find(p => p.name === e.target.value)
                        setTypes(roomTypes.map(room => room.roomNo === r.roomNo
                          ? { ...room, type: e.target.value, dailyRate: preset?.dailyRate ?? room.dailyRate, monthlyRate: preset?.monthlyRate ?? room.monthlyRate }
                          : room
                        ))
                      }}
                    >
                      {ROOM_TYPE_PRESETS.map((p) => <option key={p.name}>{p.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      className="form-input" type="number" min={0}
                      style={{ padding: '5px 8px', fontSize: 12 }}
                      value={r.dailyRate}
                      onChange={(e) => setField(r.roomNo, 'dailyRate', +e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input" type="number" min={0}
                      style={{ padding: '5px 8px', fontSize: 12 }}
                      value={r.monthlyRate}
                      onChange={(e) => setField(r.roomNo, 'monthlyRate', +e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Facilities & Amenities ──────────────────────────────────────────

function Step4Facilities({ data, onChange }) {
  const { facilities, amenities } = data
  const toggleFacility = (f) => {
    const next = facilities.includes(f) ? facilities.filter((x) => x !== f) : [...facilities, f]
    onChange({ ...data, facilities: next })
  }
  const setAmenity = (id, field, val) => {
    onChange({ ...data, amenities: amenities.map((a) => a.id === id ? { ...a, [field]: val } : a) })
  }
  const removeAmenity = (id) => onChange({ ...data, amenities: amenities.filter((a) => a.id !== id) })
  const addAmenity = () => {
    onChange({
      ...data,
      amenities: [...amenities, { id: `am${Date.now()}`, name: '', daily: 0, monthly: 0 }],
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Standard facilities */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Standard Facilities
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>
            ({facilities.length} selected)
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {ALL_FACILITIES.map((f) => {
            const checked = facilities.includes(f)
            return (
              <label
                key={f}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${checked ? 'var(--gold)' : 'var(--border)'}`,
                  background: checked ? 'var(--gold-bg)' : 'var(--surface2)',
                  transition: 'all 0.14s', userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFacility(f)}
                  style={{ accentColor: 'var(--gold)', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 13, color: checked ? 'var(--gold)' : 'var(--text2)', fontWeight: checked ? 600 : 400 }}>
                  {f}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Chargeable amenities */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Chargeable Amenities</div>
          <button className="btn btn-outline btn-sm" onClick={addAmenity}>+ Add</button>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Amenity Name</th>
                <th>Daily ₹</th>
                <th>Monthly ₹</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {amenities.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input className="form-input" value={a.name} placeholder="e.g. Mini Fridge"
                      onChange={(e) => setAmenity(a.id, 'name', e.target.value)}
                      style={{ padding: '5px 8px', fontSize: 12 }} />
                  </td>
                  <td>
                    <input className="form-input" type="number" value={a.daily}
                      onChange={(e) => setAmenity(a.id, 'daily', +e.target.value)}
                      style={{ padding: '5px 8px', fontSize: 12 }} />
                  </td>
                  <td>
                    <input className="form-input" type="number" value={a.monthly}
                      onChange={(e) => setAmenity(a.id, 'monthly', +e.target.value)}
                      style={{ padding: '5px 8px', fontSize: 12 }} />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-xs" onClick={() => removeAmenity(a.id)}>✕</button>
                  </td>
                </tr>
              ))}
              {amenities.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No amenities added.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Step 5: Food Plans ───────────────────────────────────────────────────────

function Step5Food({ data, onChange }) {
  const { foodPlans } = data
  const setPlan = (id, field, val) => onChange({ ...data, foodPlans: foodPlans.map((p) => p.id === id ? { ...p, [field]: val } : p) })
  const removePlan = (id) => onChange({ ...data, foodPlans: foodPlans.filter((p) => p.id !== id) })
  const addPlan = () => onChange({
    ...data,
    foodPlans: [...foodPlans, { id: `fp${Date.now()}`, name: '', oneTime: 0, weekly: 0, monthly: 0 }],
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Define meal plans and pricing for guests.</div>
        <button className="btn btn-outline btn-sm" onClick={addPlan}>+ Add</button>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Meal Name</th>
              <th>One-time ₹</th>
              <th>Weekly ₹</th>
              <th>Monthly ₹</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {foodPlans.map((p) => (
              <tr key={p.id}>
                <td>
                  <input className="form-input" value={p.name} placeholder="e.g. Breakfast Only"
                    onChange={(e) => setPlan(p.id, 'name', e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12 }} />
                </td>
                <td>
                  <input className="form-input" type="number" value={p.oneTime}
                    onChange={(e) => setPlan(p.id, 'oneTime', +e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12 }} />
                </td>
                <td>
                  <input className="form-input" type="number" value={p.weekly}
                    onChange={(e) => setPlan(p.id, 'weekly', +e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12 }} />
                </td>
                <td>
                  <input className="form-input" type="number" value={p.monthly}
                    onChange={(e) => setPlan(p.id, 'monthly', +e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12 }} />
                </td>
                <td>
                  <button className="btn btn-danger btn-xs" onClick={() => removePlan(p.id)}>✕</button>
                </td>
              </tr>
            ))}
            {foodPlans.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No food plans added.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Step 6: Staff Accounts ───────────────────────────────────────────────────

function Step6Staff({ data, onChange }) {
  const { staff } = data
  const setStaff = (id, field, val) => onChange({ ...data, staff: staff.map((s) => s.id === id ? { ...s, [field]: val } : s) })
  const removeStaff = (id) => onChange({ ...data, staff: staff.filter((s) => s.id !== id) })
  const addStaff = () => onChange({
    ...data,
    staff: [...staff, { id: `st${Date.now()}`, name: '', email: '', role: 'receptionist', password: genPassword() }],
  })
  const copyAll = () => {
    const text = staff.map((s) => `${s.name} | ${s.email} | ${s.role} | ${s.password}`).join('\n')
    navigator.clipboard?.writeText(text)
  }

  const hasAdmin = staff.some((s) => s.role === 'super_admin' || s.role === 'manager')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Create login accounts for your team.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={copyAll} title="Copy all credentials">
            Copy All Passwords
          </button>
          <button className="btn btn-primary btn-sm" onClick={addStaff}>+ Add Staff</button>
        </div>
      </div>

      {!hasAdmin && (
        <div style={{
          background: 'var(--amber-bg)', border: '1px solid var(--amber)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          fontSize: 12, color: 'var(--amber-text)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠ At least one Super Admin or Manager account is required.
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Password</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>
                  <input className="form-input" value={s.name} placeholder="Full name"
                    onChange={(e) => setStaff(s.id, 'name', e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12 }} />
                </td>
                <td>
                  <input className="form-input" type="email" value={s.email} placeholder="email@hotel.com"
                    onChange={(e) => setStaff(s.id, 'email', e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12 }} />
                </td>
                <td>
                  <select className="form-select" value={s.role} onChange={(e) => setStaff(s.id, 'role', e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12 }}>
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <code style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      padding: '3px 7px', borderRadius: 4, color: 'var(--text2)',
                    }}>
                      {s.password}
                    </code>
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => setStaff(s.id, 'password', genPassword())}
                      title="Regenerate"
                    >↻</button>
                  </div>
                </td>
                <td>
                  <button className="btn btn-danger btn-xs" onClick={() => removeStaff(s.id)}>✕</button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No staff added.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Step 7: Preview & Launch ─────────────────────────────────────────────────

function Step7Preview({ wizardData, onLaunch }) {
  const { profile, floorSetup, roomTypes, facilities, foodPlans, staff } = wizardData
  const uniqueTypes = [...new Set(roomTypes.roomTypes.map((r) => r.type))]
  const warnings = []
  if (!profile.logoUrl) warnings.push('No hotel logo uploaded')
  if (staff.staff.length < 2) warnings.push('Only 1 staff member — consider adding more')
  if (foodPlans.foodPlans.length === 0) warnings.push('No food plans configured')

  const summaryCards = [
    {
      icon: '🏨',
      title: profile.hotelName || 'Unnamed Hotel',
      sub: profile.ownerName ? `Owner: ${profile.ownerName}` : 'No owner set',
      color: 'var(--gold)',
    },
    {
      icon: '🛏',
      title: `${floorSetup.rooms.length} Rooms`,
      sub: `Across ${floorSetup.floors} floor${floorSetup.floors !== 1 ? 's' : ''}`,
      color: 'var(--blue)',
    },
    {
      icon: '🏷',
      title: `${uniqueTypes.length} Room Type${uniqueTypes.length !== 1 ? 's' : ''}`,
      sub: uniqueTypes.join(', ') || 'None configured',
      color: 'var(--purple)',
    },
    {
      icon: '⚙️',
      title: `${facilities.facilities.length} Facilities`,
      sub: facilities.facilities.slice(0, 3).join(', ') + (facilities.facilities.length > 3 ? '...' : ''),
      color: 'var(--green)',
    },
    {
      icon: '🍽',
      title: `${foodPlans.foodPlans.length} Food Plan${foodPlans.foodPlans.length !== 1 ? 's' : ''}`,
      sub: foodPlans.foodPlans.map((p) => p.name).slice(0, 2).join(', ') || 'None',
      color: 'var(--amber)',
    },
    {
      icon: '👥',
      title: `${staff.staff.length} Staff Member${staff.staff.length !== 1 ? 's' : ''}`,
      sub: staff.staff.map((s) => s.name).slice(0, 2).join(', ') || 'None',
      color: 'var(--red)',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{
          background: 'var(--amber-bg)', border: '1px solid var(--amber)',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 6 }}>
            ⚠ Setup Warnings
          </div>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--amber-text)', marginTop: 3 }}>• {w}</div>
          ))}
        </div>
      )}

      {/* Summary grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {summaryCards.map((card) => (
          <div key={card.title} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px 16px',
            borderLeft: `3px solid ${card.color}`,
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{card.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{card.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Launch button */}
      <button
        className="btn btn-primary"
        onClick={onLaunch}
        style={{
          width: '100%', justifyContent: 'center',
          padding: '14px', fontSize: 15, fontWeight: 700,
          borderRadius: 10, letterSpacing: '-0.01em',
        }}
      >
        🚀 Go Live
      </button>
    </div>
  )
}

// ─── Main SetupWizard ─────────────────────────────────────────────────────────

export default function SetupWizard({ onComplete }) {
  const addToast = useToast()
  const { setHotelName, setOwnerName, hotelName, ownerName } = useStore()

  const [step, setStep] = useState(1)

  // Per-step state objects
  const [profile, setProfile] = useState({
    hotelName: hotelName || '',
    ownerName: ownerName || '',
    phone: '',
    email: '',
    gstin: '',
    licenseNo: '',
    address: '',
    logoUrl: '',
  })

  const [floorSetup, setFloorSetup] = useState({
    floors: 3,
    roomsPerFloor: 10,
    format: 'floor_seq',
    prefix: 'A',
    rooms: [],
  })

  const [roomTypeData, setRoomTypeData] = useState({
    roomTypes: [],
    bulkSelected: [],
    bulkType: '',
  })

  const [facilitiesData, setFacilitiesData] = useState({
    facilities: [...ALL_FACILITIES],
    amenities: INIT_AMENITIES,
  })

  const [foodPlanData, setFoodPlanData] = useState({
    foodPlans: INIT_FOOD_PLANS,
  })

  const [staffData, setStaffData] = useState({
    staff: [
      { id: 'st0', name: ownerName || 'Admin', email: '', role: 'super_admin', password: genPassword() },
    ],
  })

  // Sync roomTypes when floorSetup.rooms changes
  const syncRoomTypes = useCallback((rooms) => {
    setRoomTypeData((prev) => {
      const existing = new Map(prev.roomTypes.map((r) => [r.roomNo, r]))
      const next = rooms.map((roomNo) => existing.get(roomNo) || {
        roomNo,
        type: 'Single',
        dailyRate: 500,
        monthlyRate: 9000,
      })
      return { ...prev, roomTypes: next }
    })
  }, [])

  const handleFloorChange = (data) => {
    setFloorSetup(data)
    if (data.rooms.length > 0) syncRoomTypes(data.rooms)
  }

  // Validation per step
  const validateStep = () => {
    if (step === 1) {
      if (!profile.hotelName.trim()) { addToast('Hotel Name is required', 'danger'); return false }
      if (!profile.ownerName.trim()) { addToast('Owner Name is required', 'danger'); return false }
      if (!profile.phone.trim()) { addToast('Phone is required', 'danger'); return false }
      return true
    }
    if (step === 2) {
      if (floorSetup.rooms.length === 0) { addToast('Please generate rooms first', 'warning'); return false }
      return true
    }
    if (step === 6) {
      const hasAdmin = staffData.staff.some((s) => s.role === 'super_admin' || s.role === 'manager')
      if (!hasAdmin) { addToast('At least one Super Admin or Manager is required', 'danger'); return false }
      return true
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    setStep((s) => Math.min(7, s + 1))
  }

  const handlePrev = () => setStep((s) => Math.max(1, s - 1))

  const handleLaunch = () => {
    setHotelName(profile.hotelName)
    setOwnerName(profile.ownerName)
    addToast(`${profile.hotelName} is live! Welcome aboard.`, 'success')
    onComplete?.()
  }

  const stepContent = [
    <Step1Profile key="s1" data={profile} onChange={setProfile} />,
    <Step2Floors key="s2" data={floorSetup} onChange={handleFloorChange} />,
    <Step3RoomTypes key="s3" data={roomTypeData} onChange={setRoomTypeData} />,
    <Step4Facilities key="s4" data={facilitiesData} onChange={setFacilitiesData} />,
    <Step5Food key="s5" data={foodPlanData} onChange={setFoodPlanData} />,
    <Step6Staff key="s6" data={staffData} onChange={setStaffData} />,
    <Step7Preview
      key="s7"
      wizardData={{ profile, floorSetup, roomTypes: roomTypeData, facilities: facilitiesData, foodPlans: foodPlanData, staff: staffData }}
      onLaunch={handleLaunch}
    />,
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--main-bg)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        padding: '32px 20px 60px',
      }}
    >
      {/* Inner content */}
      <div style={{ width: '100%', maxWidth: 700 }}>
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--gold)', marginBottom: 12,
          }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: '#000' }}>
              QV
            </span>
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Quantum Vorvex Setup
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            Let's configure your property in a few quick steps
          </div>
        </div>

        {/* Progress bar */}
        <StepProgressBar current={step} total={7} />

        {/* Step card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '28px 32px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Step heading */}
          <div style={{ marginBottom: 22 }}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700,
              color: 'var(--text)', letterSpacing: '-0.02em',
            }}>
              Step {step}: {STEP_LABELS[step - 1]}
            </div>
            <div style={{ width: 32, height: 2, background: 'var(--gold)', marginTop: 6, borderRadius: 2 }} />
          </div>

          {/* Step body */}
          {stepContent[step - 1]}

          {/* Navigation */}
          {step < 7 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {step > 1 && (
                  <button className="btn btn-outline" onClick={handlePrev}>
                    ← Back
                  </button>
                )}
                <button
                  style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', padding: 0 }}
                  onClick={() => addToast('Progress saved locally', 'info')}
                >
                  Save & Resume Later
                </button>
              </div>
              <button className="btn btn-primary" onClick={handleNext}>
                Next →
              </button>
            </div>
          )}

          {/* Back button for step 7 */}
          {step === 7 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-outline" onClick={handlePrev}>← Back</button>
              <button
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', padding: 0 }}
                onClick={() => addToast('Progress saved locally', 'info')}
              >
                Save & Resume Later
              </button>
            </div>
          )}
        </div>

        {/* Step label legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i + 1)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, padding: '2px 6px', borderRadius: 4,
                color: step === i + 1 ? 'var(--gold)' : 'var(--text3)',
                fontWeight: step === i + 1 ? 700 : 400,
                transition: 'color 0.14s',
              }}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
