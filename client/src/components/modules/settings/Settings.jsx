import { useState, useRef, useEffect } from 'react'
import Tabs from '../../ui/Tabs'
import Modal from '../../ui/Modal'
import { useAppSelector, useHotelActions, useUiActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import api from '../../../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ROLE_LABELS, ROLE_COLORS, canAccessSettingsTab } from '../../../utils/permissions'
import {
  ACCENT_PRESETS, RADIUS_PRESETS, getAppearance, saveAppearance, applyAppearance,
} from '../../../utils/theme'

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
    <div className={`flex flex-col gap-[5px] ${fullWidth ? 'col-[1/-1]' : ''}`}>
      <label className="form-label text-[12px] font-semibold">{label}</label>
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
      className="w-20 px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink"
      style={style}
    />
  )
}

function SaveButton({ onClick }) {
  return (
    <div className="pt-4 border-t border-line mt-2">
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
    <div className="flex flex-col gap-6">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-full border-2 border-gold flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
          style={{ background: logoPreview ? 'transparent' : 'var(--gold-bg, #3a2e0a)' }}
          title="Click to upload logo"
        >
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="t-h1 text-gold">
              {initials}
            </span>
          )}
        </div>
        <div>
          <button className="btn btn-outline text-[12px]" onClick={() => fileRef.current?.click()}>
            Upload Logo
          </button>
          <p className="mt-1 mb-0 text-[11px] text-ink3">PNG, JPG up to 2MB</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        </div>
      </div>

      {/* Form grid */}
      <div className="grid grid-cols-2 gap-4">
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
          <textarea className="form-textarea resize-y" rows={3} value={settings.address}
            onChange={e => setSettings(s => ({ ...s, address: e.target.value }))} />
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
    <div className="flex flex-col gap-5">
      {/* Capacity row */}
      <div className="card">
        <div className="card-header"><span className="card-title">Hotel Capacity</span></div>
        <div className="card-body">
          <div className="flex gap-6 flex-wrap">
            <Field label="Total Rooms">
              <input className="form-input w-[100px]" type="number" min={1}
                value={settings.totalRooms}
                onChange={e => setSettings(s => ({ ...s, totalRooms: Number(e.target.value) }))} />
            </Field>
            <Field label="Number of Floors">
              <input className="form-input w-[100px]" type="number" min={1}
                value={settings.floors}
                onChange={e => setSettings(s => ({ ...s, floors: Number(e.target.value) }))} />
            </Field>
          </div>
        </div>
      </div>

      {/* Room types table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Room Types</span>
          <button className="btn btn-primary text-[12px] px-[14px] py-[5px]" onClick={addRoom}>
            + Add Room Type
          </button>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Name', 'Daily ₹', 'Monthly ₹', 'Peak Daily ₹', 'Peak Monthly ₹', 'Count', 'Max Occ.', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomTypes.map(row => (
                <tr key={row.id} className="border-b border-line">
                  {[
                    { field: 'name',         val: row.name,         type: 'text',   w: 100 },
                    { field: 'dailyRate',     val: row.dailyRate,     type: 'number', w: 75 },
                    { field: 'monthlyRate',   val: row.monthlyRate,   type: 'number', w: 80 },
                    { field: 'peakDaily',     val: row.peakDaily,     type: 'number', w: 80 },
                    { field: 'peakMonthly',   val: row.peakMonthly,   type: 'number', w: 90 },
                    { field: 'count',         val: row.count,         type: 'number', w: 60 },
                    { field: 'maxOccupancy',  val: row.maxOccupancy,  type: 'number', w: 60 },
                  ].map(({ field, val, type, w }) => (
                    <td key={field} className="px-2.5 py-[7px]">
                      <InlineInput
                        value={val}
                        type={type}
                        min={type === 'number' ? 0 : undefined}
                        style={{ width: w }}
                        onChange={v => updateRoom(row.id, field, v)}
                      />
                    </td>
                  ))}
                  <td className="px-2.5 py-[7px]">
                    {confirmDelete === row.id ? (
                      <span className="flex gap-1.5">
                        <button className="text-[11px] text-[#ef4444] bg-none border-none cursor-pointer"
                          onClick={() => deleteRoom(row.id)}>Confirm</button>
                        <button className="text-[11px] text-ink3 bg-none border-none cursor-pointer"
                          onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button
                        className="t-sm text-[#ef4444] bg-none border-none cursor-pointer px-1.5 py-0.5"
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
    <div className="flex flex-col gap-6">
      {/* Standard facilities */}
      <div className="card">
        <div className="card-header"><span className="card-title">Standard Facilities</span></div>
        <div className="card-body">
          <div className="flex flex-wrap gap-2 mb-[14px]">
            {facilities.map(f => (
              <span
                key={f}
                className="t-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[20px] bg-[var(--gold-bg,#3a2e0a)] border border-gold text-gold"
              >
                {f}
                <button
                  onClick={() => removeFacility(f)}
                  className="t-body bg-none border-none cursor-pointer text-gold leading-[1] p-0 ml-0.5"
                  title={`Remove ${f}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="form-input max-w-[200px]"
              placeholder="Add facility..."
              value={newFacility}
              onChange={e => setNewFacility(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFacility()}
            />
            <button className="btn btn-outline text-[12px]" onClick={addFacility}>
              + Add
            </button>
          </div>
        </div>
      </div>

      {/* Chargeable amenities */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Chargeable Amenities</span>
          <button className="btn btn-primary text-[12px] px-[14px] py-[5px]" onClick={addAmenity}>
            + Add Amenity
          </button>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Amenity', 'Daily Rate ₹', 'Monthly Rate ₹', ''].map(h => (
                  <th key={h} className={`px-3 py-2 border-b border-line text-ink3 font-semibold text-[11px] ${h === 'Amenity' ? 'text-left' : 'text-center'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amenities.map(row => (
                <tr key={row.id} className="border-b border-line">
                  <td className="px-3 py-[7px]">
                    <InlineInput value={row.name} type="text" style={{ width: 160 }} onChange={v => updateAmenity(row.id, 'name', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <InlineInput value={row.daily} type="number" min={0} onChange={v => updateAmenity(row.id, 'daily', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <InlineInput value={row.monthly} type="number" min={0} onChange={v => updateAmenity(row.id, 'monthly', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <button
                      onClick={() => removeAmenity(row.id)}
                      className="t-sm text-[#ef4444] bg-none border-none cursor-pointer px-1.5 py-0.5"
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
    <div className="flex flex-col gap-5">
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Food / Meal Plans</span>
          <button className="btn btn-primary text-[12px] px-[14px] py-[5px]" onClick={addPlan}>
            + Add Meal Plan
          </button>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Meal Name', 'One-time ₹', 'Weekly ₹', 'Monthly ₹', 'Description', ''].map(h => (
                  <th key={h} className={`px-3 py-2 border-b border-line text-ink3 font-semibold text-[11px] ${h === 'Meal Name' || h === 'Description' ? 'text-left' : 'text-center'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map(row => (
                <tr key={row.id} className="border-b border-line">
                  <td className="px-3 py-[7px]">
                    <InlineInput value={row.name} type="text" style={{ width: 130 }} onChange={v => updatePlan(row.id, 'name', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <InlineInput value={row.oneTime} type="number" min={0} onChange={v => updatePlan(row.id, 'oneTime', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <InlineInput value={row.weekly} type="number" min={0} onChange={v => updatePlan(row.id, 'weekly', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <InlineInput value={row.monthly} type="number" min={0} onChange={v => updatePlan(row.id, 'monthly', v)} />
                  </td>
                  <td className="px-3 py-[7px]">
                    <InlineInput value={row.desc} type="text" style={{ width: 140 }} onChange={v => updatePlan(row.id, 'desc', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <button
                      onClick={() => removePlan(row.id)}
                      className="t-sm text-[#ef4444] bg-none border-none cursor-pointer px-1.5 py-0.5"
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
    <div className="flex flex-col gap-5">
      <div className="card">
        <div className="card-header"><span className="card-title">GST Settings</span></div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4">
            <Field label="GST Rate %">
              <input className="form-input max-w-[120px]" type="number" min={0} max={28}
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Late Fee Rate %">
              <input className="form-input max-w-[120px]" type="number" min={0}
                value={settings.lateFeeRate}
                onChange={e => setSettings(s => ({ ...s, lateFeeRate: Number(e.target.value) }))} />
            </Field>
            <Field label="Grace Period (days)">
              <input className="form-input max-w-[120px]" type="number" min={0}
                value={settings.gracePeriod}
                onChange={e => setSettings(s => ({ ...s, gracePeriod: Number(e.target.value) }))} />
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Seasonal Pricing</span></div>
        <div className="card-body">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.seasonalPricing}
              onChange={e => setSettings(s => ({ ...s, seasonalPricing: e.target.checked }))}
              className="w-4 h-4 accent-[var(--gold)]"
            />
            <span className="t-body">Enable seasonal / peak pricing for room types</span>
          </label>
          {settings.seasonalPricing && (
            <p className="t-xs mt-2.5 mb-0 text-ink3">
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
    <div className="flex flex-col gap-5">
      {/* KYC checklist */}
      <div className="card">
        <div className="card-header"><span className="card-title">Required KYC Documents</span></div>
        <div className="card-body">
          <div className="flex flex-col gap-[14px]">
            {kycDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-[14px] px-[14px] py-2.5 bg-surface2 rounded-lg border border-line flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-[160px]">
                  <input
                    type="checkbox"
                    checked={doc.enabled}
                    onChange={e => toggleDoc(doc.id, 'enabled', e.target.checked)}
                    className="w-[15px] h-[15px] accent-[var(--gold)]"
                  />
                  <span className="t-title">{doc.label}</span>
                </label>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-[10px] font-semibold"
                  style={{
                    background: doc.required ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.2)',
                    color: doc.required ? '#ef4444' : 'var(--text3)',
                  }}
                >
                  {doc.required ? 'Required' : 'Optional'}
                </span>
                <label className="t-xs flex items-center gap-1.5 text-ink3 ml-auto">
                  Max
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={doc.maxMB}
                    onChange={e => toggleDoc(doc.id, 'maxMB', Number(e.target.value))}
                    className="w-[52px] px-1.5 py-0.5 text-[12px] bg-surface border border-line rounded text-ink"
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
              className="form-input max-w-[120px]"
              type="number"
              min={1}
              value={settings.expiryReminderDays}
              onChange={e => setSettings(s => ({ ...s, expiryReminderDays: Number(e.target.value) }))}
            />
          </Field>
          <p className="t-xs mt-2 mb-0 text-ink3">
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
  const [saving, setSaving]         = useState(false)

  // Load saved dynamic-pricing rules from the backend.
  useEffect(() => {
    api.get('/pricing/rules')
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : (data.rules || [])
        if (rows.length) setRules(rows.map(r => ({
          id: r.id, name: r.name, triggerType: r.triggerType,
          threshold: r.threshold, adjustment: r.adjustment, active: r.active,
        })))
      })
      .catch(() => { /* keep defaults */ })
  }, [])

  const handleSaveRules = async () => {
    setSaving(true)
    try {
      const payload = rules.map(r => ({
        name: r.name, triggerType: r.triggerType,
        threshold: Number(r.threshold), adjustment: Number(r.adjustment), active: !!r.active,
      }))
      await api.put('/pricing/rules', { rules: payload })
      addToast('Pricing rules saved', 'success')
    } catch (e) {
      addToast(e.response?.data?.error || 'Could not save rules', 'error')
    } finally {
      setSaving(false)
    }
  }

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
    <div className="flex flex-col gap-6">
      {/* Dynamic Pricing Rules */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Revenue Engine — Dynamic Pricing Rules</span>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="w-full border-collapse">
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
                  <tr key={row.id} className="border-b border-line">
                    {/* Name */}
                    <td className="px-2.5 py-[7px]">
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => updateRule(row.id, 'name', e.target.value)}
                        className="w-[200px] px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink"
                      />
                    </td>
                    {/* Trigger type */}
                    <td className="px-2.5 py-[7px]">
                      <select
                        value={row.triggerType}
                        onChange={e => updateRule(row.id, 'triggerType', e.target.value)}
                        className="px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink"
                      >
                        <option value="occupancy">Occupancy ≥ %</option>
                        <option value="stay_length">Stay ≥ days</option>
                        <option value="lead_time">Lead Time ≥ days</option>
                      </select>
                    </td>
                    {/* Threshold */}
                    <td className="px-2.5 py-[7px]">
                      <input
                        type="number"
                        value={row.threshold}
                        min={0}
                        onChange={e => updateRule(row.id, 'threshold', Number(e.target.value))}
                        className="w-[70px] px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink"
                      />
                    </td>
                    {/* Adjustment */}
                    <td className="px-2.5 py-[7px]">
                      <span className="t-xs mr-0.5" style={{ color: adjColor }}>
                        {adjPrefix}
                      </span>
                      <input
                        type="number"
                        value={row.adjustment}
                        onChange={e => updateRule(row.id, 'adjustment', Number(e.target.value))}
                        className="w-20 px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded font-bold"
                        style={{ color: adjColor }}
                      />
                    </td>
                    {/* Active toggle */}
                    <td className="px-2.5 py-[7px]">
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={e => updateRule(row.id, 'active', e.target.checked)}
                        className="w-[15px] h-[15px] accent-[var(--gold)] cursor-pointer"
                      />
                    </td>
                    {/* Delete */}
                    <td className="px-2.5 py-[7px]">
                      <button
                        onClick={() => deleteRule(row.id)}
                        className="t-sm text-[#ef4444] bg-none border-none cursor-pointer px-1.5 py-0.5"
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
          <div className="pt-3">
            <button className="btn btn-outline text-[12px] px-[14px] py-[5px]" onClick={addRule}>
              + Add Rule
            </button>
          </div>
        </div>
      </div>

      {/* Competitor Rate Benchmarking */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Competitor Rate Benchmarking</span>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="w-full border-collapse mb-3">
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
                  <tr key={row.id} className="border-b border-line">
                    <td className="px-2.5 py-[7px]">
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => updateComp(row.id, 'name', e.target.value)}
                        className="w-40 px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink"
                      />
                    </td>
                    <td className="px-2.5 py-[7px]">
                      <select
                        value={row.roomType}
                        onChange={e => updateComp(row.id, 'roomType', e.target.value)}
                        className="px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink"
                      >
                        {['Single', 'Double', 'Suite', 'Deluxe'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-[7px]">
                      <input
                        type="number"
                        value={row.theirRate}
                        min={0}
                        onChange={e => updateComp(row.id, 'theirRate', Number(e.target.value))}
                        className="w-[90px] px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink"
                      />
                    </td>
                    <td className="t-sm px-2.5 py-[7px] text-ink3">
                      ₹{yourRate}
                    </td>
                    <td className="t-title px-2.5 py-[7px]" style={{ color: deltaColor }}>
                      {deltaPrefix}{delta}%
                    </td>
                    <td className="px-2.5 py-[7px]">
                      <button
                        onClick={() => deleteComp(row.id)}
                        className="t-sm text-[#ef4444] bg-none border-none cursor-pointer px-1.5 py-0.5"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button className="btn btn-outline text-[12px] px-[14px] py-[5px] mb-5" onClick={addCompetitor}>
            + Add Competitor
          </button>

          {/* Bar chart */}
          <div className="h-40">
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

      <div className="pt-4 border-t border-line mt-2">
        <button className="btn btn-primary" onClick={handleSaveRules} disabled={saving}>
          {saving ? 'Saving…' : 'Save Rules'}
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
    <div className="flex flex-col gap-5">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Automated Message Schedule</span>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Trigger / Event', 'Delay', 'Active', 'Template'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map(tpl => (
                <tr key={tpl.id} className="border-b border-line">
                  <td className="px-3 py-2.5">
                    <span className="t-title">{tpl.label}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-[20px] bg-[rgba(245,158,11,0.15)] text-[#f59e0b] text-[11px] font-bold">
                      {tpl.delay}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={tpl.active}
                      onChange={e => toggleActive(tpl.id, e.target.checked)}
                      className="w-[15px] h-[15px] accent-[var(--gold)] cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      className="btn btn-outline text-[11px] px-3 py-1"
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

      <div className="pt-4 border-t border-line mt-2">
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
          <div className="flex flex-col gap-3">
            <textarea
              ref={textareaRef}
              rows={5}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full px-2.5 py-2 text-[13px] bg-surface2 border border-line rounded-md text-ink resize-y box-border"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            {/* Variable chips */}
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARS.map(v => (
                <button
                  key={v}
                  onClick={() => insertVar(v)}
                  className="px-2.5 py-[3px] rounded-[20px] bg-[var(--gold-bg,#3a2e0a)] border border-gold text-gold text-[11px] font-bold cursor-pointer"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  title={`Insert ${v}`}
                >
                  {v}
                </button>
              ))}
            </div>
            {/* Actions */}
            <div className="flex gap-2.5 justify-end pt-1">
              <button className="btn btn-outline text-[12px]" onClick={closeEdit}>
                Cancel
              </button>
              <button className="btn btn-primary text-[12px]" onClick={saveTemplate}>
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
    <div className="flex flex-col gap-6">
      {/* Current Property Card */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Current Property</span>
          <button
            className="btn btn-outline text-[12px] px-[14px] py-[5px]"
            onClick={() => setEditingMain(v => !v)}
          >
            {editingMain ? 'Close' : 'Edit'}
          </button>
        </div>
        <div className="card-body">
          {!editingMain ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="t-h2">
                  {settings.hotelName}
                </span>
                <span className="px-2.5 py-0.5 rounded-[20px] bg-[rgba(34,197,94,0.15)] text-[#22c55e] text-[11px] font-bold">
                  Active
                </span>
              </div>
              <p className="t-sm m-0 text-ink3">{settings.address}</p>
              <div className="t-sm flex gap-6 flex-wrap">
                <span><span className="text-ink3">GSTIN:</span> {settings.gstin}</span>
                <span><span className="text-ink3">Rooms:</span> {settings.totalRooms}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
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
                <textarea className="form-textarea resize-y" rows={3} value={settings.address}
                  onChange={e => setSettings(s => ({ ...s, address: e.target.value }))} />
              </Field>
              <div className="col-[1/-1]">
                <button className="btn btn-primary text-[12px]"
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
        <div className="card-header flex items-center justify-between">
          <span className="card-title">Multi-Property Management</span>
          <button
            className="btn btn-primary text-[12px] px-[14px] py-[5px] opacity-50 cursor-not-allowed"
            onClick={() => addToast('Multi-property feature available in Pro plan', 'info')}
            title="Upgrade to Pro"
          >
            + Add Property
          </button>
        </div>
        <div className="card-body">
          {/* Info banner */}
          <div className="t-sm flex items-center gap-2.5 px-[14px] py-2.5 rounded-lg bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.3)] mb-4 text-ink3">
            <span className="t-h3">🔒</span>
            Upgrade to Multi-Property plan to manage multiple hotels from one account.
          </div>

          {/* Demo table — greyed out */}
          <div className="opacity-45 pointer-events-none">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Property', 'Address', 'Rooms', 'Manager', 'Status'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="t-title px-3 py-2.5">
                    Quantum Vorvex — Branch
                  </td>
                  <td className="t-sm px-3 py-2.5 text-ink3">
                    456, MG Road, Bangalore
                  </td>
                  <td className="t-sm px-3 py-2.5 text-ink3">24</td>
                  <td className="t-sm px-3 py-2.5 text-ink3">Priya Sharma</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2.5 py-0.5 rounded-[20px] bg-[rgba(34,197,94,0.15)] text-[#22c55e] text-[11px] font-bold">
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
  const token       = useAppSelector(s => s.auth.token)
  const currentUser = useAppSelector(s => s.auth.currentUser)
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
    borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none',
  }
  const labelStyle = { fontSize: 11.5, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="t-h3 m-0">Users & Access</h3>
          <p className="mt-1 mb-0 text-[12.5px] text-ink3">
            Manage login accounts and their roles
          </p>
        </div>
        {isOwner && (
          <button className="btn btn-gold btn-sm" onClick={openCreate}>+ Add User</button>
        )}
      </div>

      {/* Role legend */}
      <div className="flex gap-2.5 mb-[18px] flex-wrap">
        {[
          { role: 'owner',   desc: 'Full access to all modules and user management' },
          { role: 'manager', desc: 'Operational access, cannot manage users' },
          { role: 'staff',   desc: 'Front-desk only: check-in, rooms, guests' },
        ].map(({ role, desc }) => (
          <div key={role} className="flex items-start gap-2 px-[14px] py-2.5 bg-surface2 border border-line rounded-lg flex-[1_1_180px] min-w-[160px]">
            <div className="mt-px">
              <span
                className="t-label inline-block px-[7px] py-0.5 rounded"
                style={{ color: ROLE_COLORS[role], background: ROLE_COLORS[role] + '1a' }}
              >
                {ROLE_LABELS[role]}
              </span>
            </div>
            <p className="m-0 text-[11.5px] text-ink3 leading-[1.5]">{desc}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      {loading ? (
        <div className="p-8 text-center text-ink3">Loading users…</div>
      ) : (
        <div className="border border-line rounded-[10px] overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface2 border-b border-line">
                {['Name', 'Email', 'Phone', 'Role', 'Status', isOwner ? 'Actions' : ''].filter(Boolean).map(h => (
                  <th key={h} className="px-[14px] py-2.5 text-left font-semibold text-ink3 text-[11.5px] tracking-[0.04em] uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={i < users.length - 1 ? 'border-b border-line' : ''}>
                  <td className="px-[14px] py-[11px] font-medium text-ink">
                    <div className="flex items-center gap-[9px]">
                      <div
                        className="w-7 h-7 rounded-full text-[#000] flex items-center justify-center text-[10.5px] font-bold shrink-0"
                        style={{ background: ROLE_COLORS[u.role] || '#888' }}
                      >
                        {u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      {u.name}
                      {u.id === currentUser?.id && (
                        <span className="text-[9.5px] text-ink3 bg-surface2 border border-line rounded-[3px] px-[5px] py-px">you</span>
                      )}
                    </div>
                  </td>
                  <td className="px-[14px] py-[11px] text-ink2 text-[12px]" style={{ fontFamily: 'var(--font-mono)' }}>{u.email}</td>
                  <td className="t-xs px-[14px] py-[11px] text-ink3">{u.phone || '—'}</td>
                  <td className="px-[14px] py-[11px]">
                    <span
                      className="text-[10.5px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded"
                      style={{ color: ROLE_COLORS[u.role] || '#888', background: (ROLE_COLORS[u.role] || '#888') + '1a' }}
                    >
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-[14px] py-[11px]">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-[20px]"
                      style={{
                        color: u.status === 'active' ? '#22c55e' : '#ef4444',
                        background: u.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      }}
                    >
                      {u.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-[14px] py-[11px]">
                      <div className="flex gap-1.5">
                        <button className="btn btn-outline btn-sm px-2.5 py-[3px] text-[11.5px]" onClick={() => openEdit(u)}>Edit</button>
                        <button
                          className="btn btn-sm px-2.5 py-[3px] text-[11.5px] bg-[rgba(239,68,68,0.1)] text-[#ef4444] border border-[rgba(239,68,68,0.2)] rounded-md"
                          onClick={() => openDelete(u)}
                          disabled={u.id === currentUser?.id}
                          style={{ cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', opacity: u.id === currentUser?.id ? 0.4 : 1 }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-ink3">No users found.</td></tr>
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
            <div className="flex gap-2.5 justify-end">
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-gold btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : modal === 'create' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-x-[18px] gap-y-[14px]">
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
              <div className="relative">
                <input
                  style={{ ...inputStyle, paddingRight: 38 }}
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={modal === 'edit' ? '(unchanged)' : 'Min 6 characters'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="t-sm absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer text-ink3">
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
            <div className="flex gap-2.5 justify-end">
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-sm t-title bg-[rgba(239,68,68,0.15)] text-[#ef4444] border border-[rgba(239,68,68,0.3)] rounded-md px-4 py-1.5 cursor-pointer" onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          }
        >
          <p className="t-body m-0">
            Are you sure you want to delete <strong>{target?.name}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}

// ─── Shared controls for the configuration tabs ───────────────────────────────
function Segmented({ value, options, onChange }) {
  return (
    <div className="inline-flex bg-surface2 border border-line rounded-lg p-[3px] gap-[3px] flex-wrap">
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-[14px] py-1.5 rounded-md border-none cursor-pointer text-[13px] transition-all duration-[140ms] ${
              active ? 'font-semibold bg-gold text-[#000]' : 'font-medium bg-transparent text-ink2'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-line">
      <div>
        <div className="text-[13.5px] font-semibold text-ink">{label}</div>
        {hint && <div className="t-xs text-ink3 mt-0.5">{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`w-[42px] h-6 rounded-xl border-none cursor-pointer shrink-0 relative transition-[background] duration-[160ms] ${
          checked ? 'bg-gold' : 'bg-line2'
        }`}
      >
        <span
          className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-[#fff] transition-[left] duration-[160ms] ${
            checked ? 'left-[21px]' : 'left-[3px]'
          }`}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
        />
      </button>
    </div>
  )
}

// ─── Tab: Appearance ──────────────────────────────────────────────────────────
function AppearanceTab({ addToast }) {
  const darkMode = useAppSelector(s => s.ui.darkMode)
  const { toggleDarkMode } = useUiActions()
  const [prefs, setPrefs] = useState(getAppearance)

  // Apply + persist immediately so the whole app re-skins live as you tweak.
  function update(patch) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    applyAppearance(next)
    saveAppearance(next)
  }

  function setTheme(mode) {
    if ((mode === 'dark') !== darkMode) toggleDarkMode()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card">
        <div className="card-header"><span className="card-title">Theme</span></div>
        <div className="card-body flex flex-col gap-2">
          <label className="form-label text-[12px]">Color mode</label>
          <Segmented
            value={darkMode ? 'dark' : 'light'}
            onChange={setTheme}
            options={[{ value: 'light', label: '☀ Light' }, { value: 'dark', label: '☾ Dark' }]}
          />
          <p className="t-xs text-ink3 mt-1 mb-0">
            Light keeps the pure white &amp; gold look; dark switches to a warm charcoal palette.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Accent Color</span></div>
        <div className="card-body">
          <div className="flex gap-3 flex-wrap">
            {ACCENT_PRESETS.map(a => {
              const active = prefs.accent === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => update({ accent: a.id })}
                  className="flex flex-col items-center gap-1.5 cursor-pointer bg-none border-none p-1"
                >
                  <span
                    className={`w-11 h-11 rounded-full border-[3px] ${active ? 'border-ink' : 'border-transparent'}`}
                    style={{
                      background: `linear-gradient(135deg, ${a.gold}, ${a.gold2})`,
                      boxShadow: active ? '0 0 0 2px var(--surface) inset' : 'none',
                    }}
                  />
                  <span className={`text-[11.5px] ${active ? 'font-bold text-ink' : 'font-medium text-ink3'}`}>
                    {a.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Layout</span></div>
        <div className="card-body flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <label className="form-label text-[12px]">Density</label>
            <Segmented
              value={prefs.density}
              onChange={v => update({ density: v })}
              options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="form-label text-[12px]">Corner Style</label>
            <Segmented
              value={prefs.radius}
              onChange={v => update({ radius: v })}
              options={RADIUS_PRESETS.map(r => ({ value: r.id, label: r.label }))}
            />
          </div>
        </div>
      </div>

      <div className="pt-1">
        <button className="btn btn-primary" onClick={() => addToast('Appearance saved', 'success')}>
          Save Appearance
        </button>
        <button
          className="btn btn-outline ml-2.5"
          onClick={() => { const d = { accent: 'classic', density: 'comfortable', radius: 'soft' }; setPrefs(d); applyAppearance(d); saveAppearance(d); addToast('Reset to defaults', 'info') }}
        >
          Reset to Default
        </button>
      </div>
    </div>
  )
}

// ─── Tab: Branding ────────────────────────────────────────────────────────────
const BRANDING_KEY = 'qv-branding'
const initBranding = {
  tagline:    'Luxury Redefined',
  loginTitle: 'Welcome to Quantum Vorvex',
  footerNote: '© Quantum Vorvex. All rights reserved.',
  logoUrl:    '',
}

function BrandingTab({ settings, setSettings, addToast }) {
  const { setHotelName } = useHotelActions()
  const fileRef = useRef(null)
  const [branding, setBranding] = useState(() => {
    try { const r = localStorage.getItem(BRANDING_KEY); return r ? { ...initBranding, ...JSON.parse(r) } : initBranding }
    catch { return initBranding }
  })

  function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBranding(b => ({ ...b, logoUrl: reader.result }))
    reader.readAsDataURL(file)
  }

  function handleSave() {
    try { localStorage.setItem(BRANDING_KEY, JSON.stringify(branding)) } catch { /* ignore */ }
    setHotelName(settings.hotelName)
    addToast('Branding saved', 'success')
  }

  const initials = (settings.hotelName || 'QV').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex flex-col gap-5">
      <div className="card">
        <div className="card-header"><span className="card-title">Logo &amp; Identity</span></div>
        <div className="card-body flex items-center gap-[18px] flex-wrap">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-[84px] h-[84px] rounded-2xl cursor-pointer overflow-hidden shrink-0 border-2 border-gold flex items-center justify-center"
            style={{ background: branding.logoUrl ? '#fff' : 'var(--gold-bg)' }}
            title="Click to upload logo"
          >
            {branding.logoUrl
              ? <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <span className="t-display text-gold">{initials}</span>}
          </div>
          <div>
            <button className="btn btn-outline text-[12px]" onClick={() => fileRef.current?.click()}>Upload Logo</button>
            {branding.logoUrl && (
              <button className="btn btn-outline text-[12px] ml-2" onClick={() => setBranding(b => ({ ...b, logoUrl: '' }))}>Remove</button>
            )}
            <p className="mt-1.5 mb-0 text-[11px] text-ink3">PNG or SVG with transparent background recommended.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Brand Text</span></div>
        <div className="card-body grid grid-cols-2 gap-4">
          <Field label="Hotel / Brand Name">
            <input className="form-input" value={settings.hotelName}
              onChange={e => setSettings(s => ({ ...s, hotelName: e.target.value }))} />
          </Field>
          <Field label="Tagline">
            <input className="form-input" value={branding.tagline}
              onChange={e => setBranding(b => ({ ...b, tagline: e.target.value }))} />
          </Field>
          <Field label="Login Screen Title" fullWidth>
            <input className="form-input" value={branding.loginTitle}
              onChange={e => setBranding(b => ({ ...b, loginTitle: e.target.value }))} />
          </Field>
          <Field label="Footer Note" fullWidth>
            <input className="form-input" value={branding.footerNote}
              onChange={e => setBranding(b => ({ ...b, footerNote: e.target.value }))} />
          </Field>
        </div>
      </div>

      <SaveButton onClick={handleSave} />
    </div>
  )
}

// ─── Tab: Preferences ─────────────────────────────────────────────────────────
const PREFS_KEY = 'qv-preferences'
const initPreferences = {
  language:    'en',
  currency:    'INR',
  dateFormat:  'DD/MM/YYYY',
  timeFormat:  '12h',
  itemsPerPage: 25,
  soundAlerts:  true,
  emailDigest:  false,
  autoLogout:   true,
}

function PreferencesTab({ addToast }) {
  const [prefs, setPrefs] = useState(() => {
    try { const r = localStorage.getItem(PREFS_KEY); return r ? { ...initPreferences, ...JSON.parse(r) } : initPreferences }
    catch { return initPreferences }
  })
  const set = (patch) => setPrefs(p => ({ ...p, ...patch }))

  function handleSave() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
    addToast('Preferences saved', 'success')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card">
        <div className="card-header"><span className="card-title">Regional</span></div>
        <div className="card-body grid grid-cols-2 gap-4">
          <Field label="Language">
            <select className="form-select" value={prefs.language} onChange={e => set({ language: e.target.value })}>
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="ar">العربية (Arabic)</option>
            </select>
          </Field>
          <Field label="Currency">
            <select className="form-select" value={prefs.currency} onChange={e => set({ currency: e.target.value })}>
              <option value="INR">₹ Indian Rupee (INR)</option>
              <option value="USD">$ US Dollar (USD)</option>
              <option value="EUR">€ Euro (EUR)</option>
              <option value="GBP">£ British Pound (GBP)</option>
              <option value="AED">د.إ UAE Dirham (AED)</option>
            </select>
          </Field>
          <Field label="Date Format">
            <select className="form-select" value={prefs.dateFormat} onChange={e => set({ dateFormat: e.target.value })}>
              <option>DD/MM/YYYY</option>
              <option>MM/DD/YYYY</option>
              <option>YYYY-MM-DD</option>
              <option>DD MMM YYYY</option>
            </select>
          </Field>
          <Field label="Time Format">
            <Segmented
              value={prefs.timeFormat}
              onChange={v => set({ timeFormat: v })}
              options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]}
            />
          </Field>
          <Field label="Rows Per Page">
            <select className="form-select" value={prefs.itemsPerPage} onChange={e => set({ itemsPerPage: Number(e.target.value) })}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Notifications &amp; Session</span></div>
        <div className="card-body pt-1">
          <ToggleRow label="Sound alerts" hint="Play a chime for new bookings and check-ins"
            checked={prefs.soundAlerts} onChange={v => set({ soundAlerts: v })} />
          <ToggleRow label="Daily email digest" hint="Receive a summary of the day's activity each evening"
            checked={prefs.emailDigest} onChange={v => set({ emailDigest: v })} />
          <ToggleRow label="Auto sign-out when idle" hint="Lock the dashboard after 30 minutes of inactivity"
            checked={prefs.autoLogout} onChange={v => set({ autoLogout: v })} />
        </div>
      </div>

      <SaveButton onClick={handleSave} />
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
  { id: 'appearance',    label: 'Appearance'     },
  { id: 'branding',      label: 'Branding'       },
  { id: 'preferences',   label: 'Preferences'    },
  { id: 'properties',    label: 'Properties'     },
  { id: 'users',         label: 'Users & Access' },
]

export default function Settings({ onRunSetup }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [settings, setSettings]   = useState(initSettings)
  const addToast     = useToast()

  // Load the hotel's saved settings so profile/tax tabs reflect real data.
  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => { if (data.settings) setSettings(s => ({ ...s, ...data.settings })) })
      .catch(() => { /* keep defaults */ })
  }, [])
  const { setHotelName, setOwnerName } = useHotelActions()
  const currentUser  = useAppSelector(s => s.auth.currentUser)
  const role         = currentUser?.role || 'staff'

  // Filter tabs based on role permissions
  const tabs = ALL_TABS.filter(t => canAccessSettingsTab(role, t.id))

  // Reset to first allowed tab if current tab is no longer accessible
  const validActiveTab = tabs.find(t => t.id === activeTab) ? activeTab : (tabs[0]?.id || 'profile')

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="t-h1 m-0 tracking-[-0.02em]">
            Settings
          </h1>
          <p className="t-sm mt-1 mb-0 text-ink3">
            Configure hotel profile, room types, pricing, and system preferences
          </p>
        </div>
        {onRunSetup && (role === 'owner' || role === 'admin') && (
          <button
            className="btn btn-outline btn-sm shrink-0"
            onClick={onRunSetup}
            title="Re-run the first-time setup wizard"
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
        <div data-tab-id="appearance">
          <AppearanceTab addToast={addToast} />
        </div>
        <div data-tab-id="branding">
          <BrandingTab settings={settings} setSettings={setSettings} addToast={addToast} />
        </div>
        <div data-tab-id="preferences">
          <PreferencesTab addToast={addToast} />
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
