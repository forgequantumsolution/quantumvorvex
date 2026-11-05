import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency } from '../../../utils/format'
import { useAppSelector, useHotelActions } from '../../../store/hooks'

// ─── Constants ────────────────────────────────────────────────────────────────

// Step titles: locales/*/setup.json → steps.<key>
const STEP_KEYS = ['profile', 'floors', 'roomTypes', 'facilities', 'food', 'staff', 'preview']

const ROOM_TYPE_PRESETS = [
  { name: 'Single',  dailyRate: 500,  monthlyRate: 9000  },
  { name: 'Double',  dailyRate: 800,  monthlyRate: 14000 },
  { name: 'Suite',   dailyRate: 1500, monthlyRate: 28000 },
  { name: 'Deluxe',  dailyRate: 1200, monthlyRate: 22000 },
]

// Preset names / facility names are stored values; the UI shows roomTypes.<name> / facilities.<name>.
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
  const { t } = useTranslation('setup')
  return (
    <div className="mb-5 sm:mb-9">
      {/* Circles joined by connectors that stretch to fit — 28px circles on
          phones keep all 7 steps on one line at 360px */}
      <ol className="flex items-center px-1" aria-label={t('progress')}>
        {Array.from({ length: total }, (_, i) => {
          const stepNum = i + 1
          const isCompleted = stepNum < current
          const isActive = stepNum === current
          return (
            <li key={stepNum} className={`flex items-center ${stepNum < total ? 'flex-1' : ''}`}
                aria-current={isActive ? 'step' : undefined}>
              {/* Circle */}
              <div
                className={`w-7 h-7 sm:w-9 sm:h-9 text-[12px] sm:text-[13px] font-semibold rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-200 ${
                  isCompleted
                    ? 'bg-success border-success text-white'
                    : isActive
                    ? 'bg-gold border-gold text-black shadow-[0_0_0_4px_var(--gold-bg)]'
                    : 'bg-transparent border-line2 text-ink3'
                }`}
                title={t(`steps.${STEP_KEYS[i]}`)}
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              {/* Connector */}
              {stepNum < total && (
                <div className={`flex-1 h-0.5 mx-1 rounded-full transition-[background] duration-200 ${isCompleted ? 'bg-success' : 'bg-line2'}`} />
              )}
            </li>
          )
        })}
      </ol>
      <div className="sm:hidden mt-2.5 text-center t-xs text-ink3">
        {t('stepOf', { current, total })} · <span className="text-ink2 font-semibold">{t(`steps.${STEP_KEYS[current - 1]}`)}</span>
      </div>
    </div>
  )
}

// ─── Field Helper ─────────────────────────────────────────────────────────────

function Field({ label, required, children, fullWidth, className = '', style }) {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${fullWidth ? 'col-span-full' : ''} ${className}`} style={style}>
      <label className="t-label">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// Compact input/select used inside the editable tables (md+) — and, full size,
// inside the phone card lists below them.
const CELL_INPUT = 'form-input px-2 py-[5px] text-[12px]'
const CELL_SELECT = 'form-select min-w-[110px] px-2 py-[5px] text-[12px]'
const CARD_INPUT = 'form-input min-h-11'
const CARD_SELECT = 'form-select min-h-11'

// Labelled field inside a phone row-card
function CardField({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <span className="t-label">{label}</span>
      {children}
    </label>
  )
}

// Phone row-card shell: a bordered tile in a stacked list
function RowCard({ children }) {
  return (
    <li className="bg-surface2 border border-line rounded-lg p-3 flex flex-col gap-3">
      {children}
    </li>
  )
}

// ─── Step 1: Hotel Profile ────────────────────────────────────────────────────

function Step1Profile({ data, onChange }) {
  const { t } = useTranslation('setup')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef()

  const set = (k, v) => onChange({ ...data, [k]: v })

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) {
      alert(t('profile.logoTooBig'))
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
    <div className="flex flex-col gap-5 sm:gap-[22px]">
      {/* Logo upload */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Preview circle */}
        <div
          className="t-h1 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-line2 overflow-hidden shrink-0 bg-gold-bg flex items-center justify-center text-gold"
        >
          {data.logoUrl
            ? <img src={data.logoUrl} alt={t('profile.logoAlt')} className="w-full h-full object-cover" />
            : initials}
        </div>
        {/* Drop zone */}
        <div
          className={`upload-zone flex-1 min-w-0 cursor-pointer p-4 sm:p-[22px]${drag ? ' dragover' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current.click() } }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <div className="t-h1 mb-1">📷</div>
          <div className="t-sm text-ink2">
            {data.logoUrl
              ? <>{t('profile.changeLogo')}</>
              : <><span className="pointer-fine:hidden">{t('profile.tapLogo')}</span><span className="hidden pointer-fine:inline">{t('profile.dragLogo')}</span></>}
          </div>
          <div className="text-[12px] text-ink3 mt-[3px]">{t('profile.logoHint')}</div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[18px] gap-y-4 sm:gap-y-[14px]">
        <Field label={t('profile.hotelName')} required>
          <input className="form-input" value={data.hotelName} onChange={(e) => set('hotelName', e.target.value)} placeholder={t('profile.hotelNamePlaceholder')} />
        </Field>
        <Field label={t('profile.ownerName')} required>
          <input className="form-input" value={data.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder={t('profile.ownerNamePlaceholder')} />
        </Field>
        <Field label={t('profile.phone')} required>
          <input className="form-input" type="tel" inputMode="numeric" value={data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9876543210" maxLength={10} />
        </Field>
        <Field label={t('profile.email')}>
          <input className="form-input" type="email" value={data.email} onChange={(e) => set('email', e.target.value)} placeholder="manager@hotel.com" />
        </Field>
        <Field label="GSTIN">
          <input className="form-input" value={data.gstin} onChange={(e) => set('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
        </Field>
        <Field label={t('profile.licenseNo')}>
          <input className="form-input" value={data.licenseNo} onChange={(e) => set('licenseNo', e.target.value)} placeholder="MH-2024-HOTEL-001" />
        </Field>
        <Field label={t('profile.address')} fullWidth>
          <textarea className="form-textarea" value={data.address} onChange={(e) => set('address', e.target.value)} placeholder={t('profile.addressPlaceholder')} rows={3} />
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
  const { t } = useTranslation('setup')
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
    <div className="flex flex-col gap-5 sm:gap-[22px]">
      <div className="grid grid-cols-2 gap-x-3 sm:gap-x-[18px] gap-y-[14px]">
        <Field label={t('floors.count')} required>
          <input
            className="form-input" type="number" inputMode="numeric" min={1} max={10}
            value={data.floors} onChange={(e) => set('floors', Math.min(10, Math.max(1, +e.target.value)))}
          />
        </Field>
        <Field label={t('floors.perFloor')} required>
          <input
            className="form-input" type="number" inputMode="numeric" min={1} max={20}
            value={data.roomsPerFloor} onChange={(e) => set('roomsPerFloor', Math.min(20, Math.max(1, +e.target.value)))}
          />
        </Field>
      </div>

      {/* Format selection */}
      <Field label={t('floors.format')} required>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 mt-1" role="radiogroup">
          {[
            { id: 'floor_seq', label: t('floors.formatFloorSeq'), example: '101, 102, 201...' },
            { id: 'seq_only',  label: t('floors.formatSeq'), example: '1, 2, 3...' },
            { id: 'custom',    label: t('floors.formatCustom'), example: 'A-101, A-102...' },
          ].map((opt) => {
            const isActive = data.format === opt.id
            return (
              <button
                type="button"
                key={opt.id}
                role="radio"
                aria-checked={isActive}
                onClick={() => set('format', opt.id)}
                className={`text-left min-h-11 px-3.5 py-3 rounded-lg cursor-pointer border-2 transition-all duration-[140ms] flex sm:block items-center justify-between gap-3 ${isActive ? 'border-gold bg-gold-bg' : 'border-line bg-surface2'}`}
              >
                <div className={`t-xs sm:mb-1 ${isActive ? 'text-gold' : 'text-ink'}`}>
                  {opt.label}
                </div>
                <div className="text-[12px] text-ink3 font-mono">
                  {opt.example}
                </div>
              </button>
            )
          })}
        </div>
      </Field>

      {data.format === 'custom' && (
        <Field label={t('floors.formatCustom')}>
          <input
            value={data.prefix}
            onChange={(e) => set('prefix', e.target.value)}
            placeholder={t('floors.prefixPlaceholder')}
            className="form-input w-full sm:max-w-[200px]"
          />
        </Field>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <span className="t-xs text-ink3 text-center sm:text-left">
          {t('floors.total', { count: totalCount, floors: t('floors.floorCount', { count: data.floors }), perFloor: data.roomsPerFloor })}
        </span>
        <button className="btn btn-primary btn-sm justify-center w-full sm:w-auto" onClick={handleGenerate}>
          {t('floors.generate')}
        </button>
      </div>

      {previewRooms.length > 0 && (
        <div className="bg-surface2 rounded-lg px-3.5 py-3">
          <div className="t-label mb-2.5">
            {t('floors.preview')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {display.map((r) => (
              <span key={r} className="px-[9px] py-[3px] rounded text-[12px] bg-surface border border-line text-ink2 font-mono">
                {r}
              </span>
            ))}
            {extra > 0 && (
              <span className="px-[9px] py-[3px] text-[12px] text-ink3 italic">
                {t('floors.andMore', { count: extra })}
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
  const { t } = useTranslation('setup')
  const typeLabel = (name) => t(`roomTypes.${name}`, name)
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
  const allSelected = bulkSelected.length === roomTypes.length && roomTypes.length > 0
  const toggleAll = (checked) => onChange({ ...data, bulkSelected: checked ? roomTypes.map(r => r.roomNo) : [] })
  const changeType = (r, value) => {
    const preset = ROOM_TYPE_PRESETS.find(p => p.name === value)
    setTypes(roomTypes.map(room => room.roomNo === r.roomNo
      ? { ...room, type: value, dailyRate: preset?.dailyRate ?? room.dailyRate, monthlyRate: preset?.monthlyRate ?? room.monthlyRate }
      : room
    ))
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-[18px]">
      {/* Rate reference cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {ROOM_TYPE_PRESETS.map((p) => (
          <div key={p.name} className="bg-surface2 border border-line rounded-lg px-3 py-2.5 min-w-0">
            <div className="t-xs text-ink mb-1">{typeLabel(p.name)}</div>
            <div className="text-[12px] text-ink3 truncate">{t('rates.daily')}: {formatCurrency(p.dailyRate)}</div>
            <div className="text-[12px] text-ink3 truncate">{t('rates.monthly')}: {formatCurrency(p.monthlyRate)}</div>
          </div>
        ))}
      </div>

      {/* Bulk assign */}
      {roomTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 bg-gold-bg border border-gold-border rounded-lg px-3 sm:px-3.5 py-2.5">
          <span className="t-xs text-ink2 shrink-0 basis-full sm:basis-auto">
            {t('types.bulkAssign', { count: bulkSelected.length })}
          </span>
          <select
            className="form-select flex-1 sm:flex-none w-auto min-w-[120px]"
            value={bulkType}
            onChange={(e) => onChange({ ...data, bulkType: e.target.value })}
          >
            <option value="">— {t('types.chooseType')} —</option>
            {ROOM_TYPE_PRESETS.map((p) => <option key={p.name} value={p.name}>{typeLabel(p.name)}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={applyBulk} disabled={!bulkSelected.length || !bulkType}>
            {t('types.apply')}
          </button>
          {bulkSelected.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => onChange({ ...data, bulkSelected: [] })}>
              {t('types.clear')}
            </button>
          )}
        </div>
      )}

      {/* Table (md+) / card list (phones) */}
      {roomTypes.length === 0 ? (
        <div className="empty-state">{t('types.empty')}</div>
      ) : (
        <>
          <div className="hidden md:block max-h-80 overflow-auto border border-line rounded-lg">
            <table>
              <thead>
                <tr>
                  <th className="w-9">
                    <input
                      type="checkbox"
                      className="rounded text-gold focus:ring-gold/30"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th>{t('types.roomNo')}</th>
                  <th>{t('types.type')}</th>
                  <th>{t('rates.dailyRate')} ₹</th>
                  <th>{t('rates.monthlyRate')} ₹</th>
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((r) => (
                  <tr key={r.roomNo}>
                    <td>
                      <input type="checkbox" className="rounded text-gold focus:ring-gold/30" checked={bulkSelected.includes(r.roomNo)} onChange={() => toggleBulk(r.roomNo)} />
                    </td>
                    <td className="font-semibold text-ink font-mono">{r.roomNo}</td>
                    <td>
                      <select className={CELL_SELECT} value={r.type} onChange={(e) => changeType(r, e.target.value)}>
                        {ROOM_TYPE_PRESETS.map((p) => <option key={p.name} value={p.name}>{typeLabel(p.name)}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className={CELL_INPUT} type="number" min={0}
                        value={r.dailyRate}
                        onChange={(e) => setField(r.roomNo, 'dailyRate', +e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={CELL_INPUT} type="number" min={0}
                        value={r.monthlyRate}
                        onChange={(e) => setField(r.roomNo, 'monthlyRate', +e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex flex-col gap-2">
            <label className="flex items-center gap-2.5 min-h-11 px-1 t-xs text-ink2 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded accent-gold text-gold focus:ring-gold/30" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
              {t('types.selectAll', { count: roomTypes.length })}
            </label>
            <ul className="flex flex-col gap-2">
              {roomTypes.map((r) => (
                <RowCard key={r.roomNo}>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2.5 min-h-11 shrink-0 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded accent-gold text-gold focus:ring-gold/30" checked={bulkSelected.includes(r.roomNo)} onChange={() => toggleBulk(r.roomNo)}
                             aria-label={t('types.selectRoom', { number: r.roomNo })} />
                      <span className="t-title text-ink font-mono">{r.roomNo}</span>
                    </label>
                    <select className={`${CARD_SELECT} flex-1 min-w-0`} value={r.type} onChange={(e) => changeType(r, e.target.value)}
                            aria-label={t('types.roomType', { number: r.roomNo })}>
                      {ROOM_TYPE_PRESETS.map((p) => <option key={p.name} value={p.name}>{typeLabel(p.name)}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <CardField label={`${t('rates.dailyRate')} ₹`}>
                      <input className={CARD_INPUT} type="number" inputMode="numeric" min={0} value={r.dailyRate}
                             onChange={(e) => setField(r.roomNo, 'dailyRate', +e.target.value)} />
                    </CardField>
                    <CardField label={`${t('rates.monthlyRate')} ₹`}>
                      <input className={CARD_INPUT} type="number" inputMode="numeric" min={0} value={r.monthlyRate}
                             onChange={(e) => setField(r.roomNo, 'monthlyRate', +e.target.value)} />
                    </CardField>
                  </div>
                </RowCard>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Step 4: Facilities & Amenities ──────────────────────────────────────────

function Step4Facilities({ data, onChange }) {
  const { t } = useTranslation('setup')
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
    <div className="flex flex-col gap-5 sm:gap-[22px]">
      {/* Standard facilities */}
      <div>
        <div className="t-xs text-ink mb-3">
          {t('facilities.standard')}
          <span className="ml-2 text-[12px] font-normal text-ink3">
            ({t('selected', { count: facilities.length })})
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_FACILITIES.map((f) => {
            const checked = facilities.includes(f)
            return (
              <label
                key={f}
                className={`flex items-center gap-[9px] min-h-11 px-3 py-2.5 rounded-lg cursor-pointer border-[1.5px] transition-all duration-[140ms] select-none min-w-0 ${checked ? 'border-gold bg-gold-bg' : 'border-line bg-surface2'}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFacility(f)}
                  className="w-4 h-4 shrink-0 rounded accent-gold text-gold focus:ring-gold/30"
                />
                <span className={`text-[13px] truncate ${checked ? 'text-gold font-semibold' : 'text-ink2 font-normal'}`}>
                  {t(`facilities.names.${f}`, f)}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Chargeable amenities */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="t-xs text-ink">{t('facilities.chargeable')}</div>
          <button className="btn btn-outline btn-sm shrink-0" onClick={addAmenity}>+ {t('add')}</button>
        </div>
        <div className="hidden md:block border border-line rounded-lg overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>{t('facilities.amenityName')}</th>
                <th>{t('rates.daily')} ₹</th>
                <th>{t('rates.monthly')} ₹</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {amenities.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input className={CELL_INPUT} value={a.name} placeholder={t('facilities.amenityPlaceholder')}
                      onChange={(e) => setAmenity(a.id, 'name', e.target.value)} />
                  </td>
                  <td>
                    <input className={CELL_INPUT} type="number" value={a.daily}
                      onChange={(e) => setAmenity(a.id, 'daily', +e.target.value)} />
                  </td>
                  <td>
                    <input className={CELL_INPUT} type="number" value={a.monthly}
                      onChange={(e) => setAmenity(a.id, 'monthly', +e.target.value)} />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-xs" onClick={() => removeAmenity(a.id)} aria-label={t('facilities.remove')}>✕</button>
                  </td>
                </tr>
              ))}
              {amenities.length === 0 && (
                <tr><td colSpan={4} className="t-xs text-center text-ink3">{t('facilities.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <ul className="md:hidden flex flex-col gap-2">
          {amenities.map((a) => (
            <RowCard key={a.id}>
              <div className="flex items-end gap-2">
                <CardField label={t('facilities.amenityName')} className="flex-1">
                  <input className={CARD_INPUT} value={a.name} placeholder={t('facilities.amenityPlaceholder')}
                    onChange={(e) => setAmenity(a.id, 'name', e.target.value)} />
                </CardField>
                <button className="btn btn-danger min-h-11 w-11 justify-center shrink-0" onClick={() => removeAmenity(a.id)} aria-label={t('facilities.remove')}>✕</button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <CardField label={`${t('rates.daily')} ₹`}>
                  <input className={CARD_INPUT} type="number" inputMode="numeric" value={a.daily}
                    onChange={(e) => setAmenity(a.id, 'daily', +e.target.value)} />
                </CardField>
                <CardField label={`${t('rates.monthly')} ₹`}>
                  <input className={CARD_INPUT} type="number" inputMode="numeric" value={a.monthly}
                    onChange={(e) => setAmenity(a.id, 'monthly', +e.target.value)} />
                </CardField>
              </div>
            </RowCard>
          ))}
          {amenities.length === 0 && (
            <li className="t-xs text-center text-ink3 border border-dashed border-line rounded-lg py-5">{t('facilities.empty')}</li>
          )}
        </ul>
      </div>
    </div>
  )
}

// ─── Step 5: Food Plans ───────────────────────────────────────────────────────

function Step5Food({ data, onChange }) {
  const { t } = useTranslation('setup')
  const { foodPlans } = data
  const setPlan = (id, field, val) => onChange({ ...data, foodPlans: foodPlans.map((p) => p.id === id ? { ...p, [field]: val } : p) })
  const removePlan = (id) => onChange({ ...data, foodPlans: foodPlans.filter((p) => p.id !== id) })
  const addPlan = () => onChange({
    ...data,
    foodPlans: [...foodPlans, { id: `fp${Date.now()}`, name: '', oneTime: 0, weekly: 0, monthly: 0 }],
  })

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="t-sm text-ink2 min-w-0">{t('food.intro')}</div>
        <button className="btn btn-outline btn-sm shrink-0" onClick={addPlan}>+ {t('add')}</button>
      </div>
      <div className="hidden md:block border border-line rounded-lg overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{t('food.mealName')}</th>
              <th>{t('rates.oneTime')} ₹</th>
              <th>{t('rates.weekly')} ₹</th>
              <th>{t('rates.monthly')} ₹</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {foodPlans.map((p) => (
              <tr key={p.id}>
                <td>
                  <input className={CELL_INPUT} value={p.name} placeholder={t('food.mealPlaceholder')}
                    onChange={(e) => setPlan(p.id, 'name', e.target.value)} />
                </td>
                <td>
                  <input className={CELL_INPUT} type="number" value={p.oneTime}
                    onChange={(e) => setPlan(p.id, 'oneTime', +e.target.value)} />
                </td>
                <td>
                  <input className={CELL_INPUT} type="number" value={p.weekly}
                    onChange={(e) => setPlan(p.id, 'weekly', +e.target.value)} />
                </td>
                <td>
                  <input className={CELL_INPUT} type="number" value={p.monthly}
                    onChange={(e) => setPlan(p.id, 'monthly', +e.target.value)} />
                </td>
                <td>
                  <button className="btn btn-danger btn-xs" onClick={() => removePlan(p.id)} aria-label={t('food.remove')}>✕</button>
                </td>
              </tr>
            ))}
            {foodPlans.length === 0 && (
              <tr><td colSpan={5} className="t-xs text-center text-ink3">{t('food.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden flex flex-col gap-2">
        {foodPlans.map((p) => (
          <RowCard key={p.id}>
            <div className="flex items-end gap-2">
              <CardField label={t('food.mealName')} className="flex-1">
                <input className={CARD_INPUT} value={p.name} placeholder={t('food.mealPlaceholder')}
                  onChange={(e) => setPlan(p.id, 'name', e.target.value)} />
              </CardField>
              <button className="btn btn-danger min-h-11 w-11 justify-center shrink-0" onClick={() => removePlan(p.id)} aria-label={t('food.remove')}>✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <CardField label={`${t('rates.oneTime')} ₹`}>
                <input className={CARD_INPUT} type="number" inputMode="numeric" value={p.oneTime}
                  onChange={(e) => setPlan(p.id, 'oneTime', +e.target.value)} />
              </CardField>
              <CardField label={`${t('rates.weekly')} ₹`}>
                <input className={CARD_INPUT} type="number" inputMode="numeric" value={p.weekly}
                  onChange={(e) => setPlan(p.id, 'weekly', +e.target.value)} />
              </CardField>
              <CardField label={`${t('rates.monthly')} ₹`}>
                <input className={CARD_INPUT} type="number" inputMode="numeric" value={p.monthly}
                  onChange={(e) => setPlan(p.id, 'monthly', +e.target.value)} />
              </CardField>
            </div>
          </RowCard>
        ))}
        {foodPlans.length === 0 && (
          <li className="t-xs text-center text-ink3 border border-dashed border-line rounded-lg py-5">{t('food.empty')}</li>
        )}
      </ul>
    </div>
  )
}

// ─── Step 6: Staff Accounts ───────────────────────────────────────────────────

function Step6Staff({ data, onChange }) {
  const { t } = useTranslation('setup')
  const roleLabel = (r) => t(`roles.${r}`)
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 mb-3.5">
        <div className="t-sm text-ink2">{t('staff.intro')}</div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button className="btn btn-outline btn-sm justify-center" onClick={copyAll} title={t('staff.copyAllTitle')}>
            {t('staff.copyAll')}
          </button>
          <button className="btn btn-primary btn-sm justify-center" onClick={addStaff}>+ {t('staff.add')}</button>
        </div>
      </div>

      {!hasAdmin && (
        <div className="t-xs bg-warning-bg border border-warning rounded-lg px-3.5 py-2.5 mb-3.5 text-warning-text flex items-start gap-2">
          ⚠ {t('staff.needAdmin')}
        </div>
      )}

      <div className="hidden md:block border border-line rounded-lg overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{t('staff.name')}</th>
              <th>{t('staff.email')}</th>
              <th>{t('staff.role')}</th>
              <th>{t('staff.password')}</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>
                  <input className={CELL_INPUT} value={s.name} placeholder={t('staff.namePlaceholder')}
                    onChange={(e) => setStaff(s.id, 'name', e.target.value)} />
                </td>
                <td>
                  <input className={CELL_INPUT} type="email" value={s.email} placeholder="email@hotel.com"
                    onChange={(e) => setStaff(s.id, 'email', e.target.value)} />
                </td>
                <td>
                  <select className={CELL_SELECT} value={s.role} onChange={(e) => setStaff(s.id, 'role', e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[12px] bg-surface2 border border-line px-[7px] py-[3px] rounded text-ink2 font-mono">
                      {s.password}
                    </code>
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => setStaff(s.id, 'password', genPassword())}
                      title={t('staff.regenerate')}
                      aria-label={t('staff.regeneratePassword')}
                    >↻</button>
                  </div>
                </td>
                <td>
                  <button className="btn btn-danger btn-xs" onClick={() => removeStaff(s.id)} aria-label={t('staff.remove')}>✕</button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr><td colSpan={5} className="t-xs text-center text-ink3">{t('staff.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden flex flex-col gap-2">
        {staff.map((s) => (
          <RowCard key={s.id}>
            <div className="flex items-end gap-2">
              <CardField label={t('staff.name')} className="flex-1">
                <input className={CARD_INPUT} value={s.name} placeholder={t('staff.namePlaceholder')}
                  onChange={(e) => setStaff(s.id, 'name', e.target.value)} />
              </CardField>
              <button className="btn btn-danger min-h-11 w-11 justify-center shrink-0" onClick={() => removeStaff(s.id)} aria-label={t('staff.remove')}>✕</button>
            </div>
            <CardField label={t('staff.email')}>
              <input className={CARD_INPUT} type="email" value={s.email} placeholder="email@hotel.com"
                onChange={(e) => setStaff(s.id, 'email', e.target.value)} />
            </CardField>
            <CardField label={t('staff.role')}>
              <select className={CARD_SELECT} value={s.role} onChange={(e) => setStaff(s.id, 'role', e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </CardField>
            <div className="flex flex-col gap-1">
              <span className="t-label">{t('staff.password')}</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate text-[13px] bg-surface border border-line px-3 py-2.5 rounded text-ink2 font-mono">
                  {s.password}
                </code>
                <button
                  className="btn btn-outline min-h-11 w-11 justify-center shrink-0"
                  onClick={() => setStaff(s.id, 'password', genPassword())}
                  title={t('staff.regenerate')}
                  aria-label={t('staff.regeneratePassword')}
                >↻</button>
              </div>
            </div>
          </RowCard>
        ))}
        {staff.length === 0 && (
          <li className="t-xs text-center text-ink3 border border-dashed border-line rounded-lg py-5">{t('staff.empty')}</li>
        )}
      </ul>
    </div>
  )
}

// ─── Step 7: Preview & Launch ─────────────────────────────────────────────────

function Step7Preview({ wizardData, onLaunch }) {
  const { t } = useTranslation('setup')
  const { profile, floorSetup, roomTypes, facilities, foodPlans, staff } = wizardData
  const uniqueTypes = [...new Set(roomTypes.roomTypes.map((r) => r.type))]
  const warnings = []
  if (!profile.logoUrl) warnings.push(t('preview.warnNoLogo'))
  if (staff.staff.length < 2) warnings.push(t('preview.warnOneStaff'))
  if (foodPlans.foodPlans.length === 0) warnings.push(t('preview.warnNoFood'))

  const summaryCards = [
    {
      id: 'hotel',
      icon: '🏨',
      title: profile.hotelName || t('preview.unnamed'),
      sub: profile.ownerName ? t('preview.owner', { name: profile.ownerName }) : t('preview.noOwner'),
      color: 'var(--gold)',
    },
    {
      id: 'rooms',
      icon: '🛏',
      title: t('preview.rooms', { count: floorSetup.rooms.length }),
      sub: t('preview.acrossFloors', { count: floorSetup.floors }),
      color: 'var(--blue)',
    },
    {
      id: 'types',
      icon: '🏷',
      title: t('preview.roomTypes', { count: uniqueTypes.length }),
      sub: uniqueTypes.map((n) => t(`roomTypes.${n}`, n)).join(', ') || t('preview.noneConfigured'),
      color: 'var(--purple)',
    },
    {
      id: 'facilities',
      icon: '⚙️',
      title: t('preview.facilities', { count: facilities.facilities.length }),
      sub: facilities.facilities.slice(0, 3).map((f) => t(`facilities.names.${f}`, f)).join(', ') + (facilities.facilities.length > 3 ? '...' : ''),
      color: 'var(--green)',
    },
    {
      id: 'food',
      icon: '🍽',
      title: t('preview.foodPlans', { count: foodPlans.foodPlans.length }),
      sub: foodPlans.foodPlans.map((p) => p.name).slice(0, 2).join(', ') || t('preview.none'),
      color: 'var(--amber)',
    },
    {
      id: 'staff',
      icon: '👥',
      title: t('preview.staff', { count: staff.staff.length }),
      sub: staff.staff.map((s) => s.name).slice(0, 2).join(', ') || t('preview.none'),
      color: 'var(--red)',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-warning-bg border border-warning rounded-lg px-4 py-3">
          <div className="t-xs text-warning-text mb-1.5">
            ⚠ {t('preview.warnings')}
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="t-xs text-warning-text mt-[3px]">• {w}</div>
          ))}
        </div>
      )}

      {/* Summary grid */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {summaryCards.map((card) => (
          <div key={card.id} className="min-w-0 bg-surface2 border border-line rounded-[10px] px-4 py-3.5 border-l-[3px] flex min-[420px]:block items-center gap-3" style={{ borderLeftColor: card.color }}>
            <div className="t-h1 min-[420px]:mb-1.5 shrink-0">{card.icon}</div>
            <div className="min-w-0">
              <div className="t-title text-ink mb-[3px] truncate">{card.title}</div>
              <div className="text-[12px] text-ink3 truncate">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Launch button */}
      <button
        className="btn btn-primary t-h3 w-full justify-center min-h-12 p-3.5 rounded-[10px] tracking-[-0.01em]"
        onClick={onLaunch}
      >
        🚀 {t('preview.goLive')}
      </button>
    </div>
  )
}

// ─── Main SetupWizard ─────────────────────────────────────────────────────────

export default function SetupWizard({ onComplete }) {
  const { t } = useTranslation('setup')
  const addToast = useToast()
  const hotelName = useAppSelector((s) => s.hotel.hotelName)
  const ownerName = useAppSelector((s) => s.hotel.ownerName)
  const { setHotelName, setOwnerName } = useHotelActions()

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
      if (!profile.hotelName.trim()) { addToast(t('validation.hotelName'), 'danger'); return false }
      if (!profile.ownerName.trim()) { addToast(t('validation.ownerName'), 'danger'); return false }
      if (!profile.phone.trim()) { addToast(t('validation.phone'), 'danger'); return false }
      return true
    }
    if (step === 2) {
      if (floorSetup.rooms.length === 0) { addToast(t('validation.generateFirst'), 'warning'); return false }
      return true
    }
    if (step === 6) {
      const hasAdmin = staffData.staff.some((s) => s.role === 'super_admin' || s.role === 'manager')
      if (!hasAdmin) { addToast(t('validation.needAdmin'), 'danger'); return false }
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
    addToast(t('launched', { name: profile.hotelName }), 'success')
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

  const saveForLater = () => addToast(t('savedLocally'), 'info')

  // Keep the active step visible in the phone's sideways-scrolling legend
  const legendRef = useRef(null)
  useEffect(() => {
    const el = legendRef.current?.querySelector('[aria-current="step"]')
    const row = legendRef.current
    if (el && row && row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
    }
  }, [step])

  return (
    <div
      className="fixed inset-0 bg-canvas z-[2000] flex flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain
                 pt-[max(16px,env(safe-area-inset-top))] sm:pt-8
                 px-[max(12px,env(safe-area-inset-left))] sm:px-5
                 pb-[max(24px,env(safe-area-inset-bottom))] sm:pb-[60px]"
    >
      {/* Inner content */}
      <div className="w-full max-w-[760px]">
        {/* Logo + title — inline on phones, stacked from sm */}
        <div className="flex sm:flex-col items-center gap-3 sm:gap-0 mb-5 sm:mb-8 px-1 sm:text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 sm:w-[52px] sm:h-[52px] rounded-full bg-gold shrink-0 sm:mb-3">
            <span className="t-h2 sm:t-h1 text-black">
              QV
            </span>
          </div>
          <div className="min-w-0">
            <div className="t-h2 sm:t-h1 text-ink tracking-[-0.03em]">
              {t('title')}
            </div>
            <div className="t-xs sm:t-sm text-ink3 mt-0.5 sm:mt-1">
              {t('subtitle')}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <StepProgressBar current={step} total={7} />

        {/* Step card */}
        <div
          className="bg-surface border border-line rounded-xl px-4 pt-5 sm:px-8 sm:pt-7 shadow-[var(--shadow-md)]"
        >
          {/* Step heading */}
          <div className="mb-5 sm:mb-[22px]">
            <div className="t-h2 text-ink tracking-[-0.02em]">
              <span className="hidden sm:inline">{t('stepN', { step })}: </span>{t(`steps.${STEP_KEYS[step - 1]}`)}
            </div>
            <div className="w-8 h-0.5 bg-gold mt-1.5 rounded-sm" />
          </div>

          {/* Step body */}
          {stepContent[step - 1]}

          {/* Navigation — sticks to the bottom of the screen on phones so
              Next/Back stay in reach on long steps */}
          {step < 7 && (
            <div className="sticky bottom-0 z-10 -mx-4 px-4 sm:static sm:mx-0 sm:px-0 mt-6 sm:mt-7 pt-3 sm:pt-5 pb-3 sm:pb-7 bg-surface border-t border-line rounded-b-xl">
              <div className="flex items-center gap-2.5 sm:gap-3">
                {step > 1 && (
                  <button className="btn btn-outline justify-center" onClick={handlePrev}>
                    ← {t('back')}
                  </button>
                )}
                <button
                  className="hidden sm:inline-flex bg-transparent border-none text-[12px] text-ink3 hover:text-ink cursor-pointer p-0"
                  onClick={saveForLater}
                >
                  {t('saveLater')}
                </button>
                <button className="btn btn-primary justify-center flex-1 sm:flex-none sm:ml-auto" onClick={handleNext}>
                  {t('next')} →
                </button>
              </div>
            </div>
          )}

          {/* Back button for step 7 */}
          {step === 7 && (
            <div className="mt-5 pt-4 pb-5 sm:pb-7 border-t border-line flex items-center gap-4">
              <button className="btn btn-outline" onClick={handlePrev}>← {t('back')}</button>
              <button
                className="t-xs bg-transparent border-none text-ink3 hover:text-ink cursor-pointer min-h-11 px-1"
                onClick={saveForLater}
              >
                {t('saveLater')}
              </button>
            </div>
          )}
        </div>

        {/* Save link (phones — on larger screens it sits in the nav row) */}
        {step < 7 && (
          <div className="sm:hidden text-center mt-1">
            <button
              className="t-xs bg-transparent border-none text-ink3 hover:text-ink cursor-pointer min-h-11 px-4"
              onClick={saveForLater}
            >
              {t('saveLater')}
            </button>
          </div>
        )}

        {/* Step label legend — jump to any step; one scrolling line on phones */}
        <nav className="-mx-3 sm:mx-0 mt-2 sm:mt-[18px]" aria-label={t('stepsNav')}>
          <div ref={legendRef} className="relative flex sm:flex-wrap sm:justify-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none px-3 sm:px-0">
            {STEP_KEYS.map((key, i) => (
              <button
                key={key}
                onClick={() => setStep(i + 1)}
                aria-current={step === i + 1 ? 'step' : undefined}
                className={`shrink-0 whitespace-nowrap bg-transparent border-none cursor-pointer text-[12px] px-2 sm:px-1.5 py-0.5 min-h-11 sm:min-h-0 rounded transition-[color] duration-[140ms] ${step === i + 1 ? 'text-gold font-bold' : 'text-ink3 font-normal hover:text-ink'}`}
              >
                {i + 1}. {t(`steps.${key}`)}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
