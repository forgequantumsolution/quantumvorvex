import { useState, useRef, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import Tabs from '../../ui/Tabs'
import Modal from '../../ui/Modal'
import { getCroppedBlob, blobToDataUrl } from '../../../utils/cropImage'
import { useAppSelector, useHotelActions, useUiActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import api, { settingsApi, pricingApi, remindersApi } from '../../../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { canAccessSettingsTab } from '../../../utils/permissions'
import {
  ACCENT_PRESETS, RADIUS_PRESETS, getAppearance, saveAppearance, applyAppearance,
} from '../../../utils/theme'

// ─── Initial State ────────────────────────────────────────────────────────────
const initSettings = {
  name:       'Quantum Vorvex',
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
  { id: 'a1', name: 'Mini Fridge',        dailyRate: 50,  monthlyRate: 800  },
  { id: 'a2', name: 'Washing Machine',    dailyRate: 80,  monthlyRate: 1200 },
  { id: 'a3', name: 'Parking (Premium)',  dailyRate: 100, monthlyRate: 1500 },
  { id: 'a4', name: 'Gym Access',         dailyRate: 150, monthlyRate: 2000 },
  { id: 'a5', name: 'Laundry Service',    dailyRate: 200, monthlyRate: 0    },
]

const initRoomTypes = [
  { id: '1', name: 'Single', dailyRate: 500,  monthlyRate: 9000,  peakDailyRate: 700,  peakMonthlyRate: 13000, count: 12, maxOccupancy: 1 },
  { id: '2', name: 'Double', dailyRate: 800,  monthlyRate: 14000, peakDailyRate: 1100, peakMonthlyRate: 20000, count: 10, maxOccupancy: 2 },
  { id: '3', name: 'Suite',  dailyRate: 1500, monthlyRate: 28000, peakDailyRate: 2200, peakMonthlyRate: 40000, count: 6,  maxOccupancy: 3 },
  { id: '4', name: 'Deluxe', dailyRate: 1200, monthlyRate: 22000, peakDailyRate: 1800, peakMonthlyRate: 32000, count: 4,  maxOccupancy: 2 },
]

const initFoodPlans = [
  { id: '1', name: 'Breakfast Only', oneTimeRate: 120, weeklyRate: 700,  monthlyRate: 2500, description: 'Morning meal'    },
  { id: '2', name: 'All Meals',      oneTimeRate: 350, weeklyRate: 2100, monthlyRate: 8000, description: 'Full board'       },
  { id: '3', name: 'Dinner Only',    oneTimeRate: 180, weeklyRate: 1050, monthlyRate: 3500, description: 'Evening meal'     },
  { id: '4', name: 'Lunch Only',     oneTimeRate: 150, weeklyRate: 900,  monthlyRate: 3000, description: 'Afternoon meal'   },
]

// Rows added in the UI carry a temporary `new-…` id used only as a React key;
// the local seed defaults use short fake ids ('1', 'a1', …). Only real persisted
// rows carry a cuid. At save time we keep the id only when it's a cuid (so the
// server updates by id) and otherwise drop it (so the server upserts by name),
// plus we drop UI-only fields that have no DB column.
let _newRowSeq = 0
const newRowId = () => `new-${_newRowSeq++}`
const isPersistedId = (id) => typeof id === 'string' && /^c[a-z0-9]{20,}$/i.test(id)

function stripForSave(row, uiOnlyFields = []) {
  const out = { ...row }
  if (!isPersistedId(out.id)) delete out.id
  for (const f of uiOnlyFields) delete out[f]
  return out
}

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

function SaveButton({ onClick, saving }) {
  return (
    <div className="pt-4 border-t border-line mt-2">
      <button className="btn btn-primary" onClick={onClick} disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

// Reusable crop modal: pan + zoom a picked image to a 1:1 square, then hand the
// cropped Blob to `onComplete`. Open when `src` (a data URL) is set.
function LogoCropModal({
  src, onCancel, onComplete, busy = false,
  title = 'Crop image', cropShape = 'round',
  confirmLabel = 'Crop & Save', busyLabel = 'Saving…',
}) {
  // Callers pass key={src} so this remounts (resetting pan/zoom) per image.
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState(null)

  const onCropComplete = useCallback((_, a) => setAreaPixels(a), [])

  async function confirm() {
    if (!areaPixels) return
    const blob = await getCroppedBlob(src, areaPixels)
    await onComplete(blob)
  }

  return (
    <Modal
      isOpen={!!src}
      onClose={busy ? () => {} : onCancel}
      title={title}
      footer={
        <>
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={busy || !areaPixels}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative w-full h-[300px] bg-surface2 rounded-lg overflow-hidden">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <label className="flex items-center gap-3">
          <span className="t-sm text-ink3 shrink-0">Zoom</span>
          <input
            type="range" min={1} max={3} step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-[var(--gold)]"
          />
        </label>
      </div>
    </Modal>
  )
}

// ─── Tab 1: Hotel Profile ─────────────────────────────────────────────────────
function HotelProfileTab({ settings, setSettings, addToast, setHotelName, setOwnerName }) {
  const [logoPreview, setLogoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  // The picked file is read into `cropSrc` to open the crop modal; the cropped
  // square is then uploaded.
  const [cropSrc, setCropSrc] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Local preview wins (just-uploaded); otherwise fall back to the saved logo,
  // which arrives asynchronously from GET /settings — so it shows after reload.
  const logoSrc = logoPreview || settings.logoUrl || null

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
    e.target.value = '' // allow re-selecting the same file
  }

  async function uploadCropped(blob) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('logo', blob, 'logo.png')
      const { data } = await settingsApi.uploadLogo(form)
      if (data.logoUrl) {
        setLogoPreview(data.logoUrl)
        setSettings(s => ({ ...s, logoUrl: data.logoUrl }))
      }
      addToast('Logo uploaded', 'success')
      setCropSrc(null)
    } catch {
      addToast('Logo upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({
        hotel: {
          name:      settings.name,
          ownerName: settings.ownerName,
          phone:     settings.phone,
          email:     settings.email,
          gstin:     settings.gstin,
          licenseNo: settings.licenseNo,
          address:   settings.address,
        },
      })
      setHotelName(settings.name)
      setOwnerName(settings.ownerName)
      addToast('Settings saved successfully', 'success')
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const initials = settings.name
    ? settings.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'HM'

  return (
    <div className="flex flex-col gap-6">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-full border-2 border-gold flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
          style={{ background: logoSrc ? 'transparent' : 'var(--gold-bg, #3a2e0a)' }}
          title="Click to upload logo"
        >
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
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
          <p className="mt-1 mb-0 text-[11px] text-ink3">PNG, JPG up to 2MB · you can crop after selecting</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      <LogoCropModal
        key={cropSrc || 'closed'}
        src={cropSrc}
        busy={uploading}
        title="Crop logo"
        cropShape="round"
        confirmLabel="Crop & Upload"
        busyLabel="Uploading…"
        onCancel={() => setCropSrc(null)}
        onComplete={uploadCropped}
      />

      {/* Form grid */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Hotel Name">
          <input className="form-input" value={settings.name}
            onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} />
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

      <SaveButton onClick={handleSave} saving={saving} />
    </div>
  )
}

// ─── Tab 2: Room Config ───────────────────────────────────────────────────────
function RoomConfigTab({ settings, setSettings, roomTypes, setRoomTypes, addToast }) {
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [saving, setSaving] = useState(false)

  function updateRoom(id, field, value) {
    setRoomTypes(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRoom() {
    setRoomTypes(rows => [...rows, {
      id: newRowId(), name: 'New Type', dailyRate: 500, monthlyRate: 9000,
      peakDailyRate: 700, peakMonthlyRate: 13000, count: 1, maxOccupancy: 1,
    }])
  }

  function deleteRoom(id) {
    setRoomTypes(rows => rows.filter(r => r.id !== id))
    setConfirmDelete(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // `count` has no DB column — strip it (and temp ids) before sending.
      await settingsApi.update({ roomTypes: roomTypes.map(r => stripForSave(r, ['count'])) })
      addToast('Settings saved successfully', 'success')
    } catch {
      addToast('Failed to save room types', 'error')
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
                    { field: 'peakDailyRate',   val: row.peakDailyRate,   type: 'number', w: 80 },
                    { field: 'peakMonthlyRate', val: row.peakMonthlyRate, type: 'number', w: 90 },
                    { field: 'count',         val: row.count ?? 0,    type: 'number', w: 60 },
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

      <SaveButton onClick={handleSave} saving={saving} />
    </div>
  )
}

// ─── Tab 3: Facilities ────────────────────────────────────────────────────────
function FacilitiesTab({ amenities, setAmenities, addToast }) {
  // Free-text facility chips stay client-side — there is no DB model for them.
  const [facilities, setFacilities] = useState(initFacilities)
  const [newFacility, setNewFacility]   = useState('')
  const [saving, setSaving] = useState(false)

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
    setAmenities(rows => [...rows, { id: newRowId(), name: 'New Amenity', dailyRate: 0, monthlyRate: 0 }])
  }

  function removeAmenity(id) {
    setAmenities(rows => rows.filter(r => r.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({ amenities: amenities.map(r => stripForSave(r)) })
      addToast('Settings saved successfully', 'success')
    } catch {
      addToast('Failed to save amenities', 'error')
    } finally {
      setSaving(false)
    }
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
                    <InlineInput value={row.dailyRate} type="number" min={0} onChange={v => updateAmenity(row.id, 'dailyRate', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <InlineInput value={row.monthlyRate} type="number" min={0} onChange={v => updateAmenity(row.id, 'monthlyRate', v)} />
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

      <SaveButton onClick={handleSave} saving={saving} />
    </div>
  )
}

// ─── Tab 4: Food Plans ────────────────────────────────────────────────────────
function FoodPlansTab({ plans, setPlans, addToast }) {
  const [saving, setSaving] = useState(false)

  function updatePlan(id, field, value) {
    setPlans(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addPlan() {
    setPlans(rows => [...rows, { id: newRowId(), name: 'New Plan', oneTimeRate: 0, weeklyRate: 0, monthlyRate: 0, description: '' }])
  }

  function removePlan(id) {
    setPlans(rows => rows.filter(r => r.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({ foodPlans: plans.map(r => stripForSave(r)) })
      addToast('Settings saved successfully', 'success')
    } catch {
      addToast('Failed to save food plans', 'error')
    } finally {
      setSaving(false)
    }
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
                    <InlineInput value={row.oneTimeRate} type="number" min={0} onChange={v => updatePlan(row.id, 'oneTimeRate', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <InlineInput value={row.weeklyRate} type="number" min={0} onChange={v => updatePlan(row.id, 'weeklyRate', v)} />
                  </td>
                  <td className="px-3 py-[7px] text-center">
                    <InlineInput value={row.monthlyRate} type="number" min={0} onChange={v => updatePlan(row.id, 'monthlyRate', v)} />
                  </td>
                  <td className="px-3 py-[7px]">
                    <InlineInput value={row.description} type="text" style={{ width: 140 }} onChange={v => updatePlan(row.id, 'description', v)} />
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

      <SaveButton onClick={handleSave} saving={saving} />
    </div>
  )
}

// ─── Tab 5: Tax & Pricing ─────────────────────────────────────────────────────
function TaxPricingTab({ settings, setSettings, addToast }) {
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({
        hotel: {
          gstRate:     settings.gstRate,
          gstType:     settings.gstType,
          gstin:       settings.gstin,
          gstApplyOn:  settings.gstApplyOn,
          lateFeeRate: settings.lateFeeRate,
          gracePeriod: settings.gracePeriod,
        },
      })
      addToast('Settings saved successfully', 'success')
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

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

      <SaveButton onClick={handleSave} saving={saving} />
    </div>
  )
}

// ─── Tab 6: Documents ─────────────────────────────────────────────────────────
function DocumentsTab({ settings, addToast }) {
  const [kycDocs, setKycDocs] = useState(initKycDocs)
  const [expiryReminderDays, setExpiryReminderDays] = useState(30)
  const [saving, setSaving] = useState(false)

  // Hydrate from the persisted documentsConfig blob (JSON string on the hotel).
  useEffect(() => {
    if (!settings.documentsConfig) return
    try {
      const cfg = typeof settings.documentsConfig === 'string'
        ? JSON.parse(settings.documentsConfig) : settings.documentsConfig
      if (Array.isArray(cfg.kycDocs) && cfg.kycDocs.length) setKycDocs(cfg.kycDocs)
      if (cfg.expiryReminderDays != null) setExpiryReminderDays(cfg.expiryReminderDays)
    } catch { /* keep defaults */ }
  }, [settings.documentsConfig])

  function toggleDoc(id, field, value) {
    setKycDocs(docs => docs.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({ hotel: { documentsConfig: JSON.stringify({ kycDocs, expiryReminderDays }) } })
      addToast('Document settings saved', 'success')
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to save document settings', 'error')
    } finally {
      setSaving(false)
    }
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
              value={expiryReminderDays}
              onChange={e => setExpiryReminderDays(Number(e.target.value))}
            />
          </Field>
          <p className="t-xs mt-2 mb-0 text-ink3">
            System will send alerts when guest KYC documents are about to expire within this window.
          </p>
        </div>
      </div>

      <SaveButton onClick={handleSave} saving={saving} />
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

const YOUR_RATES = { Single: 500, Double: 800, Suite: 1500, Deluxe: 1200 }

function PricingRulesTab({ addToast }) {
  const [rules, setRules]           = useState(initRules)
  const [competitors, setCompetitors] = useState([])
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

  // Load competitor rates from the backend.
  const loadCompetitors = useCallback(() => {
    pricingApi.getCompetitors()
      .then(({ data }) => setCompetitors(Array.isArray(data) ? data : (data.competitors || [])))
      .catch(() => { /* keep empty */ })
  }, [])
  useEffect(() => { loadCompetitors() }, [loadCompetitors])

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

  // Persist a competitor row to the backend (called on blur / select change).
  // Accepts an explicit row so callers can pass freshly-changed values without
  // waiting for the async state update to settle.
  async function persistComp(row) {
    if (!row?.id) return
    try {
      await pricingApi.updateCompetitor(row.id, { name: row.name, roomType: row.roomType, theirRate: Number(row.theirRate) })
    } catch (e) {
      addToast(e.response?.data?.error || 'Could not save competitor', 'error')
    }
  }

  async function addCompetitor() {
    try {
      await pricingApi.createCompetitor({ name: 'New Hotel', roomType: 'Single', theirRate: 500 })
      loadCompetitors()
    } catch (e) {
      addToast(e.response?.data?.error || 'Could not add competitor', 'error')
    }
  }

  async function deleteComp(id) {
    try {
      await pricingApi.deleteCompetitor(id)
      setCompetitors(rows => rows.filter(r => r.id !== id))
    } catch (e) {
      addToast(e.response?.data?.error || 'Could not delete competitor', 'error')
    }
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
                        onBlur={() => persistComp(row)}
                        className="w-40 px-1.5 py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink"
                      />
                    </td>
                    <td className="px-2.5 py-[7px]">
                      <select
                        value={row.roomType}
                        onChange={e => { updateComp(row.id, 'roomType', e.target.value); persistComp({ ...row, roomType: e.target.value }) }}
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
                        onBlur={() => persistComp(row)}
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

// UI-only label/delay metadata keyed by trigger (the backend stores only
// trigger/content/active). Used to enrich rows loaded from the server.
const TEMPLATE_META = Object.fromEntries(
  initTemplates.map(t => [t.trigger, { label: t.label, delay: t.delay }])
)
const enrichTemplate = (t) => ({
  ...t,
  label: TEMPLATE_META[t.trigger]?.label || t.trigger,
  delay: TEMPLATE_META[t.trigger]?.delay || '—',
})

function NotificationsTab({ addToast }) {
  const [templates, setTemplates] = useState([])
  const [editingId, setEditingId]   = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  // Load templates; if the table is empty, seed the default set once so the
  // tab is usable out of the box.
  const loadTemplates = useCallback(async () => {
    try {
      let { data } = await remindersApi.getTemplates()
      let rows = Array.isArray(data) ? data : (data.templates || [])
      if (rows.length === 0) {
        await Promise.all(initTemplates.map(t =>
          remindersApi.createTemplate({ trigger: t.trigger, content: t.content, active: t.active }).catch(() => null)
        ))
        const res = await remindersApi.getTemplates()
        rows = Array.isArray(res.data) ? res.data : (res.data.templates || [])
      }
      setTemplates(rows.map(enrichTemplate))
    } catch {
      // Backend unavailable — fall back to local defaults so the UI still renders.
      setTemplates(initTemplates.map(enrichTemplate))
    }
  }, [])
  useEffect(() => { loadTemplates() }, [loadTemplates])

  const editingTpl = templates.find(t => t.id === editingId)

  function openEdit(tpl) {
    setEditingId(tpl.id)
    setEditContent(tpl.content)
  }

  function closeEdit() {
    setEditingId(null)
    setEditContent('')
  }

  async function saveTemplate() {
    setSaving(true)
    try {
      await remindersApi.updateTemplate(editingId, { content: editContent })
      setTemplates(rows => rows.map(t => t.id === editingId ? { ...t, content: editContent } : t))
      addToast('Template saved', 'success')
      closeEdit()
    } catch (e) {
      addToast(e.response?.data?.error || 'Could not save template', 'error')
    } finally {
      setSaving(false)
    }
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

  async function toggleActive(id, val) {
    setTemplates(rows => rows.map(t => t.id === id ? { ...t, active: val } : t))
    try {
      await remindersApi.updateTemplate(id, { active: val })
    } catch (e) {
      // Revert on failure.
      setTemplates(rows => rows.map(t => t.id === id ? { ...t, active: !val } : t))
      addToast(e.response?.data?.error || 'Could not update template', 'error')
    }
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
              <button className="btn btn-primary text-[12px]" onClick={saveTemplate} disabled={saving}>
                {saving ? 'Saving…' : 'Save Template'}
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
  const [saving, setSaving] = useState(false)
  const { setHotelName, setOwnerName } = useHotelActions()

  async function handleSaveProperty() {
    setSaving(true)
    try {
      await settingsApi.update({ hotel: {
        name: settings.name, ownerName: settings.ownerName, phone: settings.phone,
        email: settings.email, gstin: settings.gstin, address: settings.address,
      } })
      setHotelName(settings.name)
      setOwnerName(settings.ownerName)
      addToast('Property updated', 'success')
      setEditingMain(false)
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to update property', 'error')
    } finally {
      setSaving(false)
    }
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
                  {settings.name}
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
                <input className="form-input" value={settings.name}
                  onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} />
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
                  onClick={handleSaveProperty} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Property'}
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
function AppearanceTab({ settings, addToast }) {
  const darkMode = useAppSelector(s => s.ui.darkMode)
  const { toggleDarkMode } = useUiActions()
  const [prefs, setPrefs] = useState(getAppearance)
  const [saving, setSaving] = useState(false)

  // Hydrate from the persisted appearance blob and re-skin the app to match.
  useEffect(() => {
    if (!settings?.appearance) return
    try {
      const a = typeof settings.appearance === 'string' ? JSON.parse(settings.appearance) : settings.appearance
      const next = { ...getAppearance(), ...a }
      setPrefs(next)
      applyAppearance(next)
      saveAppearance(next)
    } catch { /* keep local */ }
  }, [settings?.appearance])

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

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({ hotel: { appearance: JSON.stringify(prefs) } })
      addToast('Appearance saved', 'success')
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to save appearance', 'error')
    } finally {
      setSaving(false)
    }
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
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Appearance'}
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
  const [cropSrc, setCropSrc] = useState(null)
  const [branding, setBranding] = useState(() => {
    try { const r = localStorage.getItem(BRANDING_KEY); return r ? { ...initBranding, ...JSON.parse(r) } : initBranding }
    catch { return initBranding }
  })
  const [saving, setSaving] = useState(false)

  // Hydrate from the persisted branding blob (backend wins over the local cache).
  useEffect(() => {
    if (!settings.branding) return
    try {
      const b = typeof settings.branding === 'string' ? JSON.parse(settings.branding) : settings.branding
      setBranding(prev => ({ ...prev, ...b }))
      try { localStorage.setItem(BRANDING_KEY, JSON.stringify({ ...initBranding, ...b })) } catch { /* ignore */ }
    } catch { /* keep local */ }
  }, [settings.branding])

  function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
    e.target.value = '' // allow re-selecting the same file
  }

  // Branding logo lives in localStorage as a base64 data URL (no server upload).
  async function applyCropped(blob) {
    const dataUrl = await blobToDataUrl(blob)
    setBranding(b => ({ ...b, logoUrl: dataUrl }))
    setCropSrc(null)
    addToast('Logo cropped — remember to Save', 'success')
  }

  async function handleSave() {
    setSaving(true)
    // Persist to localStorage immediately so the login/footer pick it up app-wide.
    try { localStorage.setItem(BRANDING_KEY, JSON.stringify(branding)) } catch { /* ignore */ }
    setHotelName(settings.name)
    try {
      await settingsApi.update({ hotel: { name: settings.name, branding: JSON.stringify(branding) } })
      addToast('Branding saved', 'success')
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to save branding', 'error')
    } finally {
      setSaving(false)
    }
  }

  const initials = (settings.name || 'QV').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

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
            <p className="mt-1.5 mb-0 text-[11px] text-ink3">PNG or SVG with transparent background recommended · crop after selecting.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </div>
        </div>
      </div>

      <LogoCropModal
        key={cropSrc || 'closed'}
        src={cropSrc}
        title="Crop logo"
        cropShape="rect"
        confirmLabel="Crop & Apply"
        onCancel={() => setCropSrc(null)}
        onComplete={applyCropped}
      />

      <div className="card">
        <div className="card-header"><span className="card-title">Brand Text</span></div>
        <div className="card-body grid grid-cols-2 gap-4">
          <Field label="Hotel / Brand Name">
            <input className="form-input" value={settings.name}
              onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} />
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

      <SaveButton onClick={handleSave} saving={saving} />
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

function PreferencesTab({ settings, addToast }) {
  const [prefs, setPrefs] = useState(() => {
    try { const r = localStorage.getItem(PREFS_KEY); return r ? { ...initPreferences, ...JSON.parse(r) } : initPreferences }
    catch { return initPreferences }
  })
  const [saving, setSaving] = useState(false)
  const set = (patch) => setPrefs(p => ({ ...p, ...patch }))

  // Hydrate from the persisted preferences blob (backend wins over local cache).
  useEffect(() => {
    if (!settings?.preferences) return
    try {
      const p = typeof settings.preferences === 'string' ? JSON.parse(settings.preferences) : settings.preferences
      setPrefs(prev => ({ ...prev, ...p }))
      try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...initPreferences, ...p })) } catch { /* ignore */ }
    } catch { /* keep local */ }
  }, [settings?.preferences])

  async function handleSave() {
    setSaving(true)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
    try {
      await settingsApi.update({ hotel: { preferences: JSON.stringify(prefs) } })
      addToast('Preferences saved', 'success')
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to save preferences', 'error')
    } finally {
      setSaving(false)
    }
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

      <SaveButton onClick={handleSave} saving={saving} />
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
]

const TAB_IDS = ALL_TABS.map(t => t.id)

// Read the active tab from the URL (?tab=…). Falls back when absent/invalid.
function tabFromUrl(fallback = 'profile') {
  if (typeof window === 'undefined') return fallback
  const t = new URLSearchParams(window.location.search).get('tab')
  return TAB_IDS.includes(t) ? t : fallback
}

export default function Settings({ onRunSetup }) {
  const [activeTab, setActiveTab] = useState(tabFromUrl)
  const [settings, setSettings]   = useState(initSettings)
  const [roomTypes, setRoomTypes] = useState(initRoomTypes)
  const [foodPlans, setFoodPlans] = useState(initFoodPlans)
  const [amenities, setAmenities] = useState(initAmenities)
  const addToast     = useToast()

  // Load the hotel's saved settings so every backed tab reflects real data.
  // The controller returns { hotel, roomTypes, foodPlans, amenities }.
  useEffect(() => {
    settingsApi.get()
      .then(({ data }) => {
        if (data.hotel)              setSettings(s => ({ ...s, ...data.hotel }))
        if (data.roomTypes?.length)  setRoomTypes(data.roomTypes)
        if (data.foodPlans?.length)  setFoodPlans(data.foodPlans)
        if (data.amenities?.length)  setAmenities(data.amenities)
      })
      .catch(() => { /* keep defaults */ })
  }, [])
  const { setHotelName, setOwnerName } = useHotelActions()
  const currentUser  = useAppSelector(s => s.auth.currentUser)
  const isOwner      = !!currentUser?.isOwner

  // Filter tabs based on the user's resolved permissions
  const tabs = ALL_TABS.filter(t => canAccessSettingsTab(currentUser, t.id))

  // Reset to first allowed tab if current tab is no longer accessible
  const validActiveTab = tabs.find(t => t.id === activeTab) ? activeTab : (tabs[0]?.id || 'profile')

  // Keep the URL's ?tab in sync with the active tab so the page is addressable
  // and survives a refresh. The app's panel router only reads location.pathname
  // (always "/settings" here), so this query param never interferes with it.
  // replaceState (not push) keeps tab switches out of the back-button history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === validActiveTab) return
    params.set('tab', validActiveTab)
    window.history.replaceState(
      { ...window.history.state, tab: validActiveTab },
      '',
      `${window.location.pathname}?${params}`,
    )
  }, [validActiveTab])

  // Browser back/forward (or a programmatic panel change) → re-read the tab.
  useEffect(() => {
    const onPop = () => setActiveTab(tabFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

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
        {/* {onRunSetup && isOwner && (
          <button
            className="btn btn-outline btn-sm shrink-0"
            onClick={onRunSetup}
            title="Re-run the first-time setup wizard"
          >
            ⚙ Re-run Setup
          </button>
        )} */}
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
          <RoomConfigTab settings={settings} setSettings={setSettings}
            roomTypes={roomTypes} setRoomTypes={setRoomTypes} addToast={addToast} />
        </div>
        <div data-tab-id="facilities">
          <FacilitiesTab amenities={amenities} setAmenities={setAmenities} addToast={addToast} />
        </div>
        <div data-tab-id="food">
          <FoodPlansTab plans={foodPlans} setPlans={setFoodPlans} addToast={addToast} />
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
          <AppearanceTab settings={settings} addToast={addToast} />
        </div>
        <div data-tab-id="branding">
          <BrandingTab settings={settings} setSettings={setSettings} addToast={addToast} />
        </div>
        <div data-tab-id="preferences">
          <PreferencesTab settings={settings} addToast={addToast} />
        </div>
        <div data-tab-id="properties">
          <PropertiesTab settings={settings} setSettings={setSettings} addToast={addToast} />
        </div>
      </Tabs>
    </div>
  )
}
