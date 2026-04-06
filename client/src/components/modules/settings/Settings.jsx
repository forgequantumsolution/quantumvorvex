import { useState, useRef, useEffect } from 'react'
import Tabs from '../../ui/Tabs'
import Modal from '../../ui/Modal'
import { useStore } from '../../../store/useStore'
import { useToast } from '../../../hooks/useToast'
import api from '../../../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ROLE_LABELS, ROLE_COLORS, canAccessSettingsTab } from '../../../utils/permissions'

// ─── Initial State ────────────────────────────────────────────────────────────
const initSettings = {
  hotelName:  'Quantum Vorvex',
  ownerName:  'Ramesh Gupta',
  phone:      '9876543210',
  email:      'manager@quantumvorvex.com',
  gstin:      '22AAAAA0000A1Z5',
  licenseNo:  'MH-2024-HOTEL-001',
  address:    '123, Hotel Street, Mumbai, Maharashtra - 400001',
  gstRate:    12,
  gstType:    'CGST+SGST',
  gstApplyOn: 'All',
  lateFeeRate: 5,
  gracePeriod: 3,
  totalRooms:  32,
  floors:      4,
  seasonalPricing: false,
  expiryReminderDays: 30,
}

const initFacilities = ['AC', 'WiFi', 'TV', 'Geyser', 'Hot Water', 'Parking', 'Balcony', 'CCTV']

const initAmenities = [
  { id: 'a1', name: 'Mini Fridge',        daily: 50,  monthly: 800  },
  { id: 'a2', name: 'Washing Machine',    daily: 80,  monthly: 1200 },
  { id: 'a3', name: 'Parking (Premium)',  daily: 100, monthly: 1500 },
  { id: 'a4', name: 'Gym Access',         daily: 150, monthly: 2000 },
  { id: 'a5', name: 'Laundry Service',    daily: 200, monthly: 0    },
]

const initRoomTypes = [
  { id: '1', name: 'Single', dailyRate: 500,  monthlyRate: 9000,  peakDaily: 700,  peakMonthly: 13000, count: 12, maxOccupancy: 1 },
  { id: '2', name: 'Double', dailyRate: 800,  monthlyRate: 14000, peakDaily: 1100, peakMonthly: 20000, count: 10, maxOccupancy: 2 },
  { id: '3', name: 'Suite',  dailyRate: 1500, monthlyRate: 28000, peakDaily: 2200, peakMonthly: 40000, count: 6,  maxOccupancy: 3 },
  { id: '4', name: 'Deluxe', dailyRate: 1200, monthlyRate: 22000, peakDaily: 1800, peakMonthly: 32000, count: 4,  maxOccupancy: 2 },
]

const initFoodPlans = [
  { id: '1', name: 'Breakfast Only', oneTime: 120, weekly: 700,  monthly: 2500, desc: 'Morning meal'    },
  { id: '2', name: 'All Meals',      oneTime: 350, weekly: 2100, monthly: 8000, desc: 'Full board'       },
  { id: '3', name: 'Dinner Only',    oneTime: 180, weekly: 1050, monthly: 3500, desc: 'Evening meal'     },
  { id: '4', name: 'Lunch Only',     oneTime: 150, weekly: 900,  monthly: 3000, desc: 'Afternoon meal'   },
]

const initKycDocs = [
  { id: 'front', label: 'ID Front',            required: true,  maxMB: 5, enabled: true },
  { id: 'back',  label: 'ID Back',             required: false, maxMB: 5, enabled: true },
  { id: 'photo', label: 'Guest Photo',         required: true,  maxMB: 2, enabled: true },
  { id: 'extra', label: 'Additional Document', required: false, maxMB: 5, enabled: false },
]

// ─── Reusable field components ────────────────────────────────────────────────
function Field({ label, children, fullWidth }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

function InlineInput({ value, onChange, type = 'text', min, style }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      min={min}
      style={{
        width: 80,
        padding: '3px 6px',
        fontSize: 12,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        color: 'var(--text)',
        ...style,
      }}
    />
  )
}

function SaveButton({ onClick }) {
  return (
    <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
      <button className="btn btn-primary" onClick={onClick}>
        Save Changes
      </button>
    </div>
  )
}

// ─── Tab 1: Hotel Profile ─────────────────────────────────────────────────────
function HotelProfileTab({ settings, setSettings, addToast, setHotelName, setOwnerName }) {
  const [logoPreview, setLogoPreview] = useState(null)
  const fileRef = useRef(null)

  function handleLogoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
  }

  function handleSave() {
    setHotelName(settings.hotelName)
    setOwnerName(settings.ownerName)
    addToast('Settings saved successfully', 'success')
  }

  const initials = settings.hotelName
    ? settings.hotelName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'HM'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: logoPreview ? 'transparent' : 'var(--gold-bg, #3a2e0a)',
            border: '2px solid var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            flexShrink: 0,
          }}
          title="Click to upload logo"
        >
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', fontFamily: "'Syne', sans-serif" }}>
              {initials}
            </span>
          )}
        </div>
        <div>
          <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>
            Upload Logo
          </button>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text3)' }}>PNG, JPG up to 2MB</p>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
        </div>
      </div>

      {/* Form grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Hotel Name">
          <input className="form-input" value={settings.hotelName}
            onChange={e => setSettings(s => ({ ...s, hotelName: e.target.value }))} />
        </Field>
        <Field label="Owner Name">
          <input className="form-input" value={settings.ownerName}
            onChange={e => setSettings(s => ({ ...s, ownerName: e.target.value }))} />
        </Field>
        <Field label="Phone">
          <input className="form-input" value={settings.phone}
            onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))} />
        </Field>
        <Field label="Email" fullWidth>
          <input className="form-input" type="email" value={settings.email}
            onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} />
        </Field>
        <Field label="GSTIN">
          <input className="form-input" value={settings.gstin}
            onChange={e => setSettings(s => ({ ...s, gstin: e.target.value }))} />
        </Field>
        <Field label="License No.">
          <input className="form-input" value={settings.licenseNo}
            onChange={e => setSettings(s => ({ ...s, licenseNo: e.target.value }))} />
        </Field>
        <Field label="Address" fullWidth>
          <textarea className="form-textarea" rows={3} value={settings.address}
            onChange={e => setSettings(s => ({ ...s, address: e.target.value }))}
            style={{ resize: 'vertical' }} />
        </Field>
      </div>

      <SaveButton onClick={handleSave} />
    </div>
  )
}

// ─── Tab 2: Room Config ───────────────────────────────────────────────────────
function RoomConfigTab({ settings, setSettings, addToast }) {
  const [roomTypes, setRoomTypes] = useState(initRoomTypes)
  const [confirmDelete, setConfirmDelete] = useState(null)

  function updateRoom(id, field, value) {
    setRoomTypes(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRoom() {
    const newId = String(Date.now())
    setRoomTypes(rows => [...rows, {
      id: newId, name: 'New Type', dailyRate: 500, monthlyRate: 9000,
      peakDaily: 700, peakMonthly: 13000, count: 1, maxOccupancy: 1,
    }])
  }

  function deleteRoom(id) {
    setRoomTypes(rows => rows.filter(r => r.id !== id))
    setConfirmDelete(null)
  }

  const thStyle = {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text3)',
    fontWeight: 600,
    fontSize: 11,
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Capacity row */}
      <div className="card">
        <div className="card-header"><span className="card-title">Hotel Capacity</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Field label="Total Rooms">
              <input className="form-input" type="number" min={1} style={{ width: 100 }}
                value={settings.totalRooms}
                onChange={e => setSettings(s => ({ ...s, totalRooms: Number(e.target.value) }))} />
            </Field>
            <Field label="Number of Floors">
              <input className="form-input" type="number" min={1} style={{ width: 100 }}
                value={settings.floors}
                onChange={e => setSettings(s => ({ ...s, floors: Number(e.target.value) }))} />
            </Field>
          </div>
        </div>
      </div>

      {/* Room types table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Room Types</span>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={addRoom}>
            + Add Room Type
          </button>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Daily ₹', 'Monthly ₹', 'Peak Daily ₹', 'Peak Monthly ₹', 'Count', 'Max Occ.', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomTypes.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    { field: 'name',         val: row.name,         type: 'text',   w: 100 },
                    { field: 'dailyRate',     val: row.dailyRate,     type: 'number', w: 75 },
                    { field: 'monthlyRate',   val: row.monthlyRate,   type: 'number', w: 80 },
                    { field: 'peakDaily',     val: row.peakDaily,     type: 'number', w: 80 },
                    { field: 'peakMonthly',   val: row.peakMonthly,   type: 'number', w: 90 },
                    { field: 'count',         val: row.count,         type: 'number', w: 60 },
                    { field: 'maxOccupancy',  val: row.maxOccupancy,  type: 'number', w: 60 },
                  ].map(({ field, val, type, w }) => (
                    <td key={field} style={{ padding: '7px 10px' }}>
                      <InlineInput
                        value={val}
                        type={type}
                        min={type === 'number' ? 0 : undefined}
                        style={{ width: w }}
                        onChange={v => updateRoom(row.id, field, v)}
                      />
                    </td>
                  ))}
                  <td style={{ padding: '7px 10px' }}>
                    {confirmDelete === row.id ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => deleteRoom(row.id)}>Confirm</button>
                        <button style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button
                        style={{ fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                        onClick={() => setConfirmDelete(row.id)}
                        title="Delete room type"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SaveButton onClick={() => addToast('Settings saved successfully', 'success')} />
    </div>
  )
}

// ─── Tab 3: Facilities ────────────────────────────────────────────────────────
function FacilitiesTab({ addToast }) {
  const [facilities, setFacilities] = useState(initFacilities)
  const [newFacility, setNewFacility]   = useState('')
  const [amenities, setAmenities]       = useState(initAmenities)

  function addFacility() {
    const trimmed = newFacility.trim()
    if (!trimmed || facilities.includes(trimmed)) return
    setFacilities(f => [...f, trimmed])
    setNewFacility('')
  }

  function removeFacility(name) {
    setFacilities(f => f.filter(x => x !== name))
  }

  function updateAmenity(id, field, value) {
    setAmenities(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addAmenity() {
    setAmenities(rows => [...rows, { id: String(Date.now()), name: 'New Amenity', daily: 0, monthly: 0 }])
  }

  function removeAmenity(id) {
    setAmenities(rows => rows.filter(r => r.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Standard facilities */}
      <div className="card">
        <div className="card-header"><span className="card-title">Standard Facilities</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {facilities.map(f => (
              <span
                key={f}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'var(--gold-bg, #3a2e0a)',
                  border: '1px solid var(--gold)',
                  color: 'var(--gold)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {f}
                <button
                  onClick={() => removeFacility(f)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--gold)', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2,
                  }}
                  title={`Remove ${f}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              placeholder="Add facility..."
              value={newFacility}
              onChange={e => setNewFacility(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFacility()}
              style={{ maxWidth: 200 }}
            />
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={addFacility}>
              + Add
            </button>
          </div>
        </div>
      </div>

      {/* Chargeable amenities */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Chargeable Amenities</span>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={addAmenity}>
            + Add Amenity
          </button>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Amenity', 'Daily Rate ₹', 'Monthly Rate ₹', ''].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', borderBottom: '1px solid var(--border)',
                    color: 'var(--text3)', fontWeight: 600, fontSize: 11,
                    textAlign: h === 'Amenity' ? 'left' : 'center',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amenities.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 12px' }}>
                    <InlineInput value={row.name} type="text" style={{ width: 160 }} onChange={v => updateAmenity(row.id, 'name', v)} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <InlineInput value={row.daily} type="number" min={0} onChange={v => updateAmenity(row.id, 'daily', v)} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <InlineInput value={row.monthly} type="number" min={0} onChange={v => updateAmenity(row.id, 'monthly', v)} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => removeAmenity(row.id)}
                      style={{ fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SaveButton onClick={() => addToast('Settings saved successfully', 'success')} />
    </div>
  )
}

// ─── Tab 4: Food Plans ────────────────────────────────────────────────────────
function FoodPlansTab({ addToast }) {
  const [plans, setPlans] = useState(initFoodPlans)

  function updatePlan(id, field, value) {
    setPlans(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addPlan() {
    setPlans(rows => [...rows, { id: String(Date.now()), name: 'New Plan', oneTime: 0, weekly: 0, monthly: 0, desc: '' }])
  }

  function removePlan(id) {
    setPlans(rows => rows.filter(r => r.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Food / Meal Plans</span>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={addPlan}>
            + Add Meal Plan
          </button>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Meal Name', 'One-time ₹', 'Weekly ₹', 'Monthly ₹', 'Description', ''].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', borderBottom: '1px solid var(--border)',
                    color: 'var(--text3)', fontWeight: 600, fontSize: 11,
                    textAlign: h === 'Meal Name' || h === 'Description' ? 'left' : 'center',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 12px' }}>
                    <InlineInput value={row.name} type="text" style={{ width: 130 }} onChange={v => updatePlan(row.id, 'name', v)} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <InlineInput value={row.oneTime} type="number" min={0} onChange={v => updatePlan(row.id, 'oneTime', v)} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <InlineInput value={row.weekly} type="number" min={0} onChange={v => updatePlan(row.id, 'weekly', v)} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <InlineInput value={row.monthly} type="number" min={0} onChange={v => updatePlan(row.id, 'monthly', v)} />
                  </td>
                  <td style={{ padding: '7px 12px' }}>
                    <InlineInput value={row.desc} type="text" style={{ width: 140 }} onChange={v => updatePlan(row.id, 'desc', v)} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => removePlan(row.id)}
                      style={{ fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SaveButton onClick={() => addToast('Settings saved successfully', 'success')} />
    </div>
  )
}

// ─── Tab 5: Tax & Pricing ─────────────────────────────────────────────────────
function TaxPricingTab({ settings, setSettings, addToast }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-header"><span className="card-title">GST Settings</span></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="GST Rate %">
              <input className="form-input" type="number" min={0} max={28} style={{ maxWidth: 120 }}
                value={settings.gstRate}
                onChange={e => setSettings(s => ({ ...s, gstRate: Number(e.target.value) }))} />
            </Field>
            <Field label="GST Type">
              <select className="form-select" value={settings.gstType}
                onChange={e => setSettings(s => ({ ...s, gstType: e.target.value }))}>
                <option value="CGST+SGST">CGST + SGST</option>
                <option value="IGST">IGST</option>
              </select>
            </Field>
            <Field label="GSTIN">
              <input className="form-input" value={settings.gstin}
                onChange={e => setSettings(s => ({ ...s, gstin: e.target.value }))} />
            </Field>
            <Field label="Apply GST On">
              <select className="form-select" value={settings.gstApplyOn}
                onChange={e => setSettings(s => ({ ...s, gstApplyOn: e.target.value }))}>
                <option value="All">All</option>
                <option value="Rent Only">Rent Only</option>
                <option value="Rent+Food">Rent + Food</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Late Fee & Grace Period</span></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Late Fee Rate %">
              <input className="form-input" type="number" min={0} style={{ maxWidth: 120 }}
                value={settings.lateFeeRate}
                onChange={e => setSettings(s => ({ ...s, lateFeeRate: Number(e.target.value) }))} />
            </Field>
            <Field label="Grace Period (days)">
              <input className="form-input" type="number" min={0} style={{ maxWidth: 120 }}
                value={settings.gracePeriod}
                onChange={e => setSettings(s => ({ ...s, gracePeriod: Number(e.target.value) }))} />
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Seasonal Pricing</span></div>
        <div className="card-body">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={settings.seasonalPricing}
              onChange={e => setSettings(s => ({ ...s, seasonalPricing: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--gold)' }}
            />
            <span style={{ fontSize: 14 }}>Enable seasonal / peak pricing for room types</span>
          </label>
          {settings.seasonalPricing && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text3)' }}>
              Peak rates defined per room type will be applied during marked peak periods.
            </p>
          )}
        </div>
      </div>

      <SaveButton onClick={() => addToast('Settings saved successfully', 'success')} />
    </div>
  )
}

// ─── Tab 6: Documents ─────────────────────────────────────────────────────────
function DocumentsTab({ settings, setSettings, addToast }) {
  const [kycDocs, setKycDocs] = useState(initKycDocs)

  function toggleDoc(id, field, value) {
    setKycDocs(docs => docs.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KYC checklist */}
      <div className="card">
        <div className="card-header"><span className="card-title">Required KYC Documents</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {kycDocs.map(doc => (
              <div key={doc.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '10px 14px',
                background: 'var(--surface2)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                flexWrap: 'wrap',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, minWidth: 160 }}>
                  <input
                    type="checkbox"
                    checked={doc.enabled}
                    onChange={e => toggleDoc(doc.id, 'enabled', e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: 'var(--gold)' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{doc.label}</span>
                </label>
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: doc.required ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.2)',
                  color: doc.required ? '#ef4444' : 'var(--text3)',
                  fontWeight: 600,
                }}>
                  {doc.required ? 'Required' : 'Optional'}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>
                  Max
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={doc.maxMB}
                    onChange={e => toggleDoc(doc.id, 'maxMB', Number(e.target.value))}
                    style={{
                      width: 52,
                      padding: '2px 6px',
                      fontSize: 12,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text)',
                    }}
                  />
                  MB
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expiry reminder */}
      <div className="card">
        <div className="card-header"><span className="card-title">Document Expiry Reminder</span></div>
        <div className="card-body">
          <Field label="Remind before expiry (days)">
            <input
              className="form-input"
              type="number"
              min={1}
              style={{ maxWidth: 120 }}
              value={settings.expiryReminderDays}
              onChange={e => setSettings(s => ({ ...s, expiryReminderDays: Number(e.target.value) }))}
            />
          </Field>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            System will send alerts when guest KYC documents are about to expire within this window.
          </p>
        </div>
      </div>

      <SaveButton onClick={() => addToast('Settings saved successfully', 'success')} />
    </div>
  )
}

// ─── Tab 7: Pricing Rules ─────────────────────────────────────────────────────
const initRules = [
  { id: '1', name: 'High Demand Surge',      triggerType: 'occupancy',   threshold: 80, adjustment: 15,  active: true  },
  { id: '2', name: 'Long Stay Discount',     triggerType: 'stay_length', threshold: 30, adjustment: -10, active: true  },
  { id: '3', name: 'Extended Stay Discount', triggerType: 'stay_length', threshold: 90, adjustment: -20, active: true  },
  { id: '4', name: 'Early Bird Discount',    triggerType: 'lead_time',   threshold: 15, adjustment: -8,  active: false },
]

const initCompetitors = [
  { id: '1', name: 'Hotel Sunrise', roomType: 'Single', theirRate: 650  },
  { id: '2', name: 'Grand Palms',   roomType: 'Double', theirRate: 1100 },
  { id: '3', name: 'City Inn',      roomType: 'Suite',  theirRate: 1800 },
]

const YOUR_RATES = { Single: 500, Double: 800, Suite: 1500, Deluxe: 1200 }

function PricingRulesTab({ addToast }) {
  const [rules, setRules]           = useState(initRules)
  const [competitors, setCompetitors] = useState(initCompetitors)

  const thStyle = {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text3)',
    fontWeight: 600,
    fontSize: 11,
    whiteSpace: 'nowrap',
    textAlign: 'left',
  }

  function updateRule(id, field, value) {
    setRules(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRule() {
    setRules(rows => [...rows, {
      id: String(Date.now()), name: 'New Rule', triggerType: 'occupancy',
      threshold: 50, adjustment: 5, active: true,
    }])
  }

  function deleteRule(id) {
    setRules(rows => rows.filter(r => r.id !== id))
  }

  function updateComp(id, field, value) {
    setCompetitors(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addCompetitor() {
    setCompetitors(rows => [...rows, {
      id: String(Date.now()), name: 'New Hotel', roomType: 'Single', theirRate: 500,
    }])
  }

  function deleteComp(id) {
    setCompetitors(rows => rows.filter(r => r.id !== id))
  }

  // Build bar chart data: for each room type, compute avg competitor rate
  const chartTypes = ['Single', 'Double', 'Suite']
  const chartData = chartTypes.map(rt => {
    const compsForType = competitors.filter(c => c.roomType === rt)
    const avgComp = compsForType.length
      ? Math.round(compsForType.reduce((s, c) => s + c.theirRate, 0) / compsForType.length)
      : 0
    return { name: rt, 'Your Rate': YOUR_RATES[rt] || 0, 'Competitor Avg': avgComp }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Dynamic Pricing Rules */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Revenue Engine — Dynamic Pricing Rules</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Rule Name', 'Trigger', 'Threshold', 'Adjustment %', 'Active', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map(row => {
                const isPositive = row.adjustment > 0
                const adjColor = isPositive ? '#ef4444' : '#22c55e'
                const adjPrefix = isPositive ? '+' : ''
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Name */}
                    <td style={{ padding: '7px 10px' }}>
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => updateRule(row.id, 'name', e.target.value)}
                        style={{
                          width: 200, padding: '3px 6px', fontSize: 12,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text)',
                        }}
                      />
                    </td>
                    {/* Trigger type */}
                    <td style={{ padding: '7px 10px' }}>
                      <select
                        value={row.triggerType}
                        onChange={e => updateRule(row.id, 'triggerType', e.target.value)}
                        style={{
                          padding: '3px 6px', fontSize: 12,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text)',
                        }}
                      >
                        <option value="occupancy">Occupancy ≥ %</option>
                        <option value="stay_length">Stay ≥ days</option>
                        <option value="lead_time">Lead Time ≥ days</option>
                      </select>
                    </td>
                    {/* Threshold */}
                    <td style={{ padding: '7px 10px' }}>
                      <input
                        type="number"
                        value={row.threshold}
                        min={0}
                        onChange={e => updateRule(row.id, 'threshold', Number(e.target.value))}
                        style={{
                          width: 70, padding: '3px 6px', fontSize: 12,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text)',
                        }}
                      />
                    </td>
                    {/* Adjustment */}
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: 12, color: adjColor, fontWeight: 700, marginRight: 2 }}>
                        {adjPrefix}
                      </span>
                      <input
                        type="number"
                        value={row.adjustment}
                        onChange={e => updateRule(row.id, 'adjustment', Number(e.target.value))}
                        style={{
                          width: 80, padding: '3px 6px', fontSize: 12,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 4, color: adjColor, fontWeight: 700,
                        }}
                      />
                    </td>
                    {/* Active toggle */}
                    <td style={{ padding: '7px 10px' }}>
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={e => updateRule(row.id, 'active', e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }}
                      />
                    </td>
                    {/* Delete */}
                    <td style={{ padding: '7px 10px' }}>
                      <button
                        onClick={() => deleteRule(row.id)}
                        style={{ fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                        title="Delete rule"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ paddingTop: 12 }}>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '5px 14px' }} onClick={addRule}>
              + Add Rule
            </button>
          </div>
        </div>
      </div>

      {/* Competitor Rate Benchmarking */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Competitor Rate Benchmarking</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead>
              <tr>
                {['Competitor Name', 'Room Type', 'Their Daily Rate ₹', 'Your Rate ₹', 'Δ %', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitors.map(row => {
                const yourRate = YOUR_RATES[row.roomType] || 0
                const delta = row.theirRate ? ((yourRate - row.theirRate) / row.theirRate * 100).toFixed(1) : 0
                const deltaNum = Number(delta)
                const deltaColor = deltaNum < 0 ? '#22c55e' : '#ef4444'
                const deltaPrefix = deltaNum > 0 ? '+' : ''
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px' }}>
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => updateComp(row.id, 'name', e.target.value)}
                        style={{
                          width: 160, padding: '3px 6px', fontSize: 12,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text)',
                        }}
                      />
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <select
                        value={row.roomType}
                        onChange={e => updateComp(row.id, 'roomType', e.target.value)}
                        style={{
                          padding: '3px 6px', fontSize: 12,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text)',
                        }}
                      >
                        {['Single', 'Double', 'Suite', 'Deluxe'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <input
                        type="number"
                        value={row.theirRate}
                        min={0}
                        onChange={e => updateComp(row.id, 'theirRate', Number(e.target.value))}
                        style={{
                          width: 90, padding: '3px 6px', fontSize: 12,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text)',
                        }}
                      />
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: 13, color: 'var(--text3)' }}>
                      ₹{yourRate}
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 700, color: deltaColor }}>
                      {deltaPrefix}{delta}%
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <button
                        onClick={() => deleteComp(row.id)}
                        style={{ fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button className="btn btn-outline" style={{ fontSize: 12, padding: '5px 14px', marginBottom: 20 }} onClick={addCompetitor}>
            + Add Competitor
          </button>

          {/* Bar chart */}
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} width={50} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                  formatter={(value) => [`₹${value}`, undefined]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Your Rate"        fill="#c9a84c" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Competitor Avg"   fill="#6b7280" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <button className="btn btn-primary" onClick={() => addToast('Pricing rules saved', 'success')}>
          Save Rules
        </button>
      </div>
    </div>
  )
}

// ─── Tab 8: Notifications ─────────────────────────────────────────────────────
const initTemplates = [
  {
    id: '1', trigger: 'checkin', label: 'Check-In Completed', delay: 'Immediate', active: true,
    content: 'Hi {{guestName}} 👋 Welcome to {{hotelName}}!\nRoom: {{roomNumber}} | Check-out: {{checkOutDate}}\nWiFi: {{wifiPassword}} | Reception: {{hotelPhone}}\nReply HELP for assistance.',
  },
  {
    id: '2', trigger: 'due', label: 'Due Date Reached', delay: 'Day 0', active: true,
    content: 'Dear {{guestName}}, your payment of ₹{{amount}} for Room {{roomNumber}} is due today. Please contact reception.',
  },
  {
    id: '3', trigger: 'overdue_3', label: 'Overdue Warning (Day 3)', delay: '+3 days', active: true,
    content: 'Dear {{guestName}}, your payment of ₹{{amount}} is now 3 days overdue. Please settle at the earliest to avoid a late fee.',
  },
  {
    id: '4', trigger: 'overdue_7', label: 'Final Notice (Day 7)', delay: '+7 days', active: false,
    content: 'FINAL NOTICE: Dear {{guestName}}, your overdue balance of ₹{{amount}} must be paid immediately. Contact us to avoid further action.',
  },
  {
    id: '5', trigger: 'bill', label: 'Monthly Bill Generated', delay: 'Immediate', active: true,
    content: 'Dear {{guestName}}, your bill for {{period}} has been generated: ₹{{amount}}. View details at reception.',
  },
]

const TEMPLATE_VARS = [
  '{{guestName}}', '{{hotelName}}', '{{roomNumber}}', '{{checkOutDate}}',
  '{{amount}}', '{{period}}', '{{wifiPassword}}', '{{hotelPhone}}',
]

function NotificationsTab({ addToast }) {
  const [templates, setTemplates] = useState(initTemplates)
  const [editingId, setEditingId]   = useState(null)
  const [editContent, setEditContent] = useState('')
  const textareaRef = useRef(null)

  const editingTpl = templates.find(t => t.id === editingId)

  function openEdit(tpl) {
    setEditingId(tpl.id)
    setEditContent(tpl.content)
  }

  function closeEdit() {
    setEditingId(null)
    setEditContent('')
  }

  function saveTemplate() {
    setTemplates(rows => rows.map(t => t.id === editingId ? { ...t, content: editContent } : t))
    addToast('Template saved', 'success')
    closeEdit()
  }

  function insertVar(v) {
    const ta = textareaRef.current
    if (!ta) {
      setEditContent(c => c + v)
      return
    }
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const next  = editContent.slice(0, start) + v + editContent.slice(end)
    setEditContent(next)
    // restore cursor after inserted text
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + v.length
      ta.focus()
    })
  }

  function toggleActive(id, val) {
    setTemplates(rows => rows.map(t => t.id === id ? { ...t, active: val } : t))
  }

  const thStyle = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text3)',
    fontWeight: 600,
    fontSize: 11,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Automated Message Schedule</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Trigger / Event', 'Delay', 'Active', 'Template'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map(tpl => (
                <tr key={tpl.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tpl.label}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 20,
                      background: 'rgba(245,158,11,0.15)',
                      color: '#f59e0b',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {tpl.delay}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <input
                      type="checkbox"
                      checked={tpl.active}
                      onChange={e => toggleActive(tpl.id, e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: 11, padding: '4px 12px' }}
                      onClick={() => openEdit(tpl)}
                    >
                      Edit Template
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <button className="btn btn-primary" onClick={() => addToast('Notification schedule saved', 'success')}>
          Save Schedule
        </button>
      </div>

      {/* Edit Template Modal */}
      {editingId && editingTpl && (
        <Modal
          title={`Edit Template — ${editingTpl.label}`}
          onClose={closeEdit}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              ref={textareaRef}
              rows={5}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                resize: 'vertical',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
            {/* Variable chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEMPLATE_VARS.map(v => (
                <button
                  key={v}
                  onClick={() => insertVar(v)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'var(--gold-bg, #3a2e0a)',
                    border: '1px solid var(--gold)',
                    color: 'var(--gold)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                  title={`Insert ${v}`}
                >
                  {v}
                </button>
              ))}
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={closeEdit}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab 9: Properties ────────────────────────────────────────────────────────
function PropertiesTab({ settings, setSettings, addToast }) {
  const [editingMain, setEditingMain] = useState(false)

  const thStyle = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text3)',
    fontWeight: 600,
    fontSize: 11,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Current Property Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Current Property</span>
          <button
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '5px 14px' }}
            onClick={() => setEditingMain(v => !v)}
          >
            {editingMain ? 'Close' : 'Edit'}
          </button>
        </div>
        <div className="card-body">
          {!editingMain ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: 'var(--text)' }}>
                  {settings.hotelName}
                </span>
                <span style={{
                  padding: '2px 10px', borderRadius: 20,
                  background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                  fontSize: 11, fontWeight: 700,
                }}>
                  Active
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>{settings.address}</p>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                <span><span style={{ color: 'var(--text3)' }}>GSTIN:</span> {settings.gstin}</span>
                <span><span style={{ color: 'var(--text3)' }}>Rooms:</span> {settings.totalRooms}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Hotel Name">
                <input className="form-input" value={settings.hotelName}
                  onChange={e => setSettings(s => ({ ...s, hotelName: e.target.value }))} />
              </Field>
              <Field label="Owner Name">
                <input className="form-input" value={settings.ownerName}
                  onChange={e => setSettings(s => ({ ...s, ownerName: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <input className="form-input" value={settings.phone}
                  onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))} />
              </Field>
              <Field label="Email">
                <input className="form-input" type="email" value={settings.email}
                  onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} />
              </Field>
              <Field label="GSTIN">
                <input className="form-input" value={settings.gstin}
                  onChange={e => setSettings(s => ({ ...s, gstin: e.target.value }))} />
              </Field>
              <Field label="Total Rooms">
                <input className="form-input" type="number" min={1} value={settings.totalRooms}
                  onChange={e => setSettings(s => ({ ...s, totalRooms: Number(e.target.value) }))} />
              </Field>
              <Field label="Address" fullWidth>
                <textarea className="form-textarea" rows={3} value={settings.address}
                  onChange={e => setSettings(s => ({ ...s, address: e.target.value }))}
                  style={{ resize: 'vertical' }} />
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <button className="btn btn-primary" style={{ fontSize: 12 }}
                  onClick={() => { addToast('Property updated', 'success'); setEditingMain(false) }}>
                  Save Property
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-property section */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">Multi-Property Management</span>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '5px 14px', opacity: 0.5, cursor: 'not-allowed' }}
            onClick={() => addToast('Multi-property feature available in Pro plan', 'info')}
            title="Upgrade to Pro"
          >
            + Add Property
          </button>
        </div>
        <div className="card-body">
          {/* Info banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.3)',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--text3)',
          }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            Upgrade to Multi-Property plan to manage multiple hotels from one account.
          </div>

          {/* Demo table — greyed out */}
          <div style={{ opacity: 0.45, pointerEvents: 'none' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Property', 'Address', 'Rooms', 'Manager', 'Status'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    Quantum Vorvex — Branch
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text3)' }}>
                    456, MG Road, Bangalore
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text3)' }}>24</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text3)' }}>Priya Sharma</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: 20,
                      background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      Active
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Users & Access Tab ───────────────────────────────────────────────────────
const EMPTY_USER_FORM = { name: '', email: '', phone: '', role: 'staff', password: '', status: 'active' }

function UsersAccessTab({ addToast }) {
  const token       = useStore(s => s.token)
  const currentUser = useStore(s => s.currentUser)
  const isOwner     = currentUser?.role === 'owner' || currentUser?.role === 'admin'

  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)   // null | 'create' | 'edit' | 'delete'
  const [target, setTarget]   = useState(null)   // user being edited/deleted
  const [form, setForm]       = useState(EMPTY_USER_FORM)
  const [saving, setSaving]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/users')
      setUsers(Array.isArray(data.users ?? data) ? (data.users ?? data) : [])
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to load users', 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const openCreate = () => {
    setForm(EMPTY_USER_FORM)
    setShowPass(false)
    setModal('create')
  }

  const openEdit = (u) => {
    setTarget(u)
    setForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role, password: '', status: u.status })
    setShowPass(false)
    setModal('edit')
  }

  const openDelete = (u) => {
    setTarget(u)
    setModal('delete')
  }

  const handleSave = async () => {
    if (!form.name || !form.email) { addToast('Name and email are required', 'error'); return }
    if (modal === 'create' && !form.password) { addToast('Password is required', 'error'); return }
    setSaving(true)
    try {
      const body = { ...form }
      if (!body.password) delete body.password
      if (modal === 'create') await api.post('/users', body)
      else await api.put(`/users/${target.id}`, body)
      addToast(modal === 'create' ? 'User created' : 'User updated')
      setModal(null)
      fetchUsers()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save', 'error')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/users/${target.id}`)
      addToast('User deleted')
      setModal(null)
      fetchUsers()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete', 'error')
    } finally { setSaving(false) }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 11px',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 7, color: 'var(--text)', fontSize: 13,
    fontFamily: "'Inter', sans-serif", outline: 'none',
  }
  const labelStyle = { fontSize: 11.5, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Users & Access</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text3)' }}>
            Manage login accounts and their roles
          </p>
        </div>
        {isOwner && (
          <button className="btn btn-gold btn-sm" onClick={openCreate}>+ Add User</button>
        )}
      </div>

      {/* Role legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { role: 'owner',   desc: 'Full access to all modules and user management' },
          { role: 'manager', desc: 'Operational access, cannot manage users' },
          { role: 'staff',   desc: 'Front-desk only: check-in, rooms, guests' },
        ].map(({ role, desc }) => (
          <div key={role} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 14px', background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 8,
            flex: '1 1 180px', minWidth: 160,
          }}>
            <div style={{ marginTop: 1 }}>
              <span style={{
                display: 'inline-block', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: ROLE_COLORS[role], background: ROLE_COLORS[role] + '1a',
                padding: '2px 7px', borderRadius: 4,
              }}>
                {ROLE_LABELS[role]}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Loading users…</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Email', 'Phone', 'Role', 'Status', isOwner ? 'Actions' : ''].filter(Boolean).map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 500, color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: ROLE_COLORS[u.role] || '#888',
                        color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                      }}>
                        {u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      {u.name}
                      {u.id === currentUser?.id && (
                        <span style={{ fontSize: 9.5, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px' }}>you</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text3)', fontSize: 12 }}>{u.phone || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: ROLE_COLORS[u.role] || '#888',
                      background: (ROLE_COLORS[u.role] || '#888') + '1a',
                      padding: '2px 8px', borderRadius: 4,
                    }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: u.status === 'active' ? '#22c55e' : '#ef4444',
                      background: u.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      padding: '2px 8px', borderRadius: 20,
                    }}>
                      {u.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isOwner && (
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)} style={{ padding: '3px 10px', fontSize: 11.5 }}>Edit</button>
                        <button
                          className="btn btn-sm"
                          onClick={() => openDelete(u)}
                          disabled={u.id === currentUser?.id}
                          style={{ padding: '3px 10px', fontSize: 11.5, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', opacity: u.id === currentUser?.id ? 0.4 : 1 }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Add User' : 'Edit User'}
          onClose={() => setModal(null)}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-gold btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : modal === 'create' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ramesh Gupta" />
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@hotel.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="staff">Staff — Front desk only</option>
                <option value="manager">Manager — Operational access</option>
                <option value="owner">Owner — Full access</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>{modal === 'edit' ? 'New Password (leave blank to keep)' : 'Password'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 38 }}
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={modal === 'edit' ? '(unchanged)' : 'Min 6 characters'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13 }}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {modal === 'edit' && (
              <div>
                <label style={labelStyle}>Status</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {modal === 'delete' && (
        <Modal title="Delete User" onClose={() => setModal(null)}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={handleDelete} disabled={saving}
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          }
        >
          <p style={{ margin: 0, color: 'var(--text)', fontSize: 14 }}>
            Are you sure you want to delete <strong>{target?.name}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}

// ─── Settings (Root) ──────────────────────────────────────────────────────────
const ALL_TABS = [
  { id: 'profile',       label: 'Hotel Profile'  },
  { id: 'rooms',         label: 'Room Config'    },
  { id: 'facilities',    label: 'Facilities'     },
  { id: 'food',          label: 'Food Plans'     },
  { id: 'tax',           label: 'Tax & Pricing'  },
  { id: 'documents',     label: 'Documents'      },
  { id: 'pricing',       label: 'Pricing Rules'  },
  { id: 'notifications', label: 'Notifications'  },
  { id: 'properties',    label: 'Properties'     },
  { id: 'users',         label: 'Users & Access' },
]

export default function Settings({ onRunSetup }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [settings, setSettings]   = useState(initSettings)
  const addToast     = useToast()
  const setHotelName = useStore(s => s.setHotelName)
  const setOwnerName = useStore(s => s.setOwnerName)
  const currentUser  = useStore(s => s.currentUser)
  const role         = currentUser?.role || 'staff'

  // Filter tabs based on role permissions
  const tabs = ALL_TABS.filter(t => canAccessSettingsTab(role, t.id))

  // Reset to first allowed tab if current tab is no longer accessible
  const validActiveTab = tabs.find(t => t.id === activeTab) ? activeTab : (tabs[0]?.id || 'profile')

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: "'Syne', sans-serif",
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
          }}>
            Settings
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Configure hotel profile, room types, pricing, and system preferences
          </p>
        </div>
        {onRunSetup && (role === 'owner' || role === 'admin') && (
          <button
            className="btn btn-outline btn-sm"
            onClick={onRunSetup}
            title="Re-run the first-time setup wizard"
            style={{ flexShrink: 0 }}
          >
            ⚙ Re-run Setup
          </button>
        )}
      </div>

      <Tabs tabs={tabs} active={validActiveTab} onChange={setActiveTab}>
        <div data-tab-id="profile">
          <HotelProfileTab
            settings={settings}
            setSettings={setSettings}
            addToast={addToast}
            setHotelName={setHotelName}
            setOwnerName={setOwnerName}
          />
        </div>
        <div data-tab-id="rooms">
          <RoomConfigTab settings={settings} setSettings={setSettings} addToast={addToast} />
        </div>
        <div data-tab-id="facilities">
          <FacilitiesTab addToast={addToast} />
        </div>
        <div data-tab-id="food">
          <FoodPlansTab addToast={addToast} />
        </div>
        <div data-tab-id="tax">
          <TaxPricingTab settings={settings} setSettings={setSettings} addToast={addToast} />
        </div>
        <div data-tab-id="documents">
          <DocumentsTab settings={settings} setSettings={setSettings} addToast={addToast} />
        </div>
        <div data-tab-id="pricing">
          <PricingRulesTab addToast={addToast} />
        </div>
        <div data-tab-id="notifications">
          <NotificationsTab addToast={addToast} />
        </div>
        <div data-tab-id="properties">
          <PropertiesTab settings={settings} setSettings={setSettings} addToast={addToast} />
        </div>
        <div data-tab-id="users">
          <UsersAccessTab addToast={addToast} />
        </div>
      </Tabs>
    </div>
  )
}
