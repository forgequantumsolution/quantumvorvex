import { useState, useRef, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { useTranslation, Trans } from 'react-i18next'
import { LANGUAGES } from '../../../i18n'
import { Modal, Button, EmptyState } from '../../ui-tw'
import { Section, AddButton, ActionButton, RowDelete, TablePager } from './settingsUi'
import { usePaged } from './usePaged'
import { getCroppedBlob, blobToDataUrl } from '../../../utils/cropImage'
import { useAppSelector, useHotelActions, useUiActions, usePageHeader } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import api, { settingsApi, pricingApi, remindersApi } from '../../../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { canAccessSettingsTab } from '../../../utils/permissions'
import PropertyManager from '../properties/PropertyManager'
import {
  LuHotel, LuBuilding2, LuStamp, LuBedDouble, LuSparkles, LuUtensils, LuTrendingUp,
  LuPercent, LuReceipt, LuFileText, LuBell, LuPalette, LuSlidersHorizontal,
  LuMapPin, LuPencil, LuChevronDown, LuUpload, LuTrash2, LuRotateCcw, LuSun, LuMoon, LuSave, LuEllipsis, LuX, LuPlus, LuTag,
} from 'react-icons/lu'
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
  // Invoice config
  invoicePrefix:     'RA/',
  invoiceYear:       '2026',
  placeOfSupply:     '',
  bankAccountName:   '',
  bankName:          '',
  bankAccountNo:     '',
  bankIfsc:          '',
  termsAndConditions:'',
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
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

// Compact cell input for the editable tables. `w` is the column width from lg up;
// on phones, where rows stack as cards, the input fills its cell.
const CELL_INPUT = 'w-full lg:w-[var(--w)] px-2.5 py-2 lg:px-1.5 lg:py-[3px] text-[12px] bg-surface2 border border-line rounded text-ink focus:ring-gold/20 focus:border-gold'

function InlineInput({ value, onChange, type = 'text', min, w = 80, className = '', style }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      min={min}
      className={`${CELL_INPUT} ${className}`}
      style={{ '--w': `${w}px`, ...style }}
    />
  )
}

// Layout shared by every tab: sections stacked in a column, and forms inside a
// section 1-up on phones, 2-up from md.
const TAB_STACK = 'flex flex-col gap-5'
const FORM_GRID = 'grid grid-cols-1 md:grid-cols-2 gap-4'

// Editable tables sit full-bleed in a <Section bodyClassName="p-0">: a normal
// table from lg up; below lg (phones and portrait tablets, where 6–8 input
// columns don't fit) every row becomes a card — the first cell (the row's
// name) spans the card, the rest sit 2-up under small labels, and the delete
// button pins to the card's top-right.
// The [&_td] overrides beat the global td padding / border / nowrap.
const STACK_TABLE =
  'w-full border-collapse max-lg:block max-lg:[&_thead]:hidden max-lg:[&_tbody]:block max-lg:[&_td]:p-0 max-lg:[&_td]:border-0 max-lg:[&_td]:whitespace-normal ' +
  'lg:[&_th:first-child]:pl-5 lg:[&_td:first-child]:pl-5 lg:[&_th:last-child]:pr-5 lg:[&_td:last-child]:pr-5'
const STACK_ROW_BASE = 'border-b border-line max-lg:relative max-lg:grid max-lg:gap-x-3 max-lg:gap-y-3 max-lg:px-4 sm:max-lg:px-5 max-lg:py-4 max-lg:last:border-b-0'
// 2-up on phones, 4-up on portrait tablets.
const STACK_ROW   = `${STACK_ROW_BASE} max-lg:grid-cols-2 sm:max-lg:grid-cols-4`
const STACK_CELL  = 'px-2.5 py-2 max-lg:p-0 max-lg:min-w-0'
const STACK_TITLE = `${STACK_CELL} max-lg:col-span-full`
// The row's name input leaves room for the pinned delete button.
const TITLE_INPUT = 'max-lg:font-semibold max-lg:w-[calc(100%-3.25rem)]'
const STACK_WIDE  = `${STACK_CELL} max-lg:col-span-2`
const STACK_DEL   = `${STACK_CELL} lg:w-px lg:text-right max-lg:absolute max-lg:right-4 sm:max-lg:right-5 max-lg:top-[37px] pointer-coarse:max-lg:top-[31px]`
// Column heading (lg+ only; stacked rows label each cell with CellLabel).
const TH = 'px-2.5 py-2.5 border-b border-line text-ink3 font-semibold text-xs whitespace-nowrap text-left'

// Field label shown above a stacked cell below lg (the table header carries it on lg+).
function CellLabel({ children }) {
  return <span className="lg:hidden block text-xs font-semibold uppercase tracking-[0.05em] text-ink3 mb-1">{children}</span>
}

// Table header row from a list of column names ('' for the actions column).
function TableHead({ cols }) {
  return (
    <thead>
      <tr>
        {cols.map((h, i) => <th key={h || `col-${i}`} className={TH}>{h}</th>)}
      </tr>
    </thead>
  )
}

// A full-bleed editable table inside a Section: the table (or an empty state)
// and the pager under it. Bump `reveal` when a row is added (from the page
// header): once the new row arrives — at once, or after an API round-trip — it
// is scrolled into view and its first input focused. usePaged has already
// moved to the last page by then.
function EditableTable({ pager, empty, reveal = 0, children }) {
  const wrapRef = useRef(null)
  const seen = useRef({ reveal, total: pager.total, wantFrom: null })
  useEffect(() => {
    const s = seen.current
    if (reveal !== s.reveal) { s.reveal = reveal; s.wantFrom = s.total }
    if (s.wantFrom != null && pager.total > s.wantFrom) {
      s.wantFrom = null
      const row = wrapRef.current?.querySelector('tbody tr:last-child')
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' })
        row.querySelector('input, select')?.focus({ preventScroll: true })
      }
    }
    s.total = pager.total
  })
  return (
    <div ref={wrapRef}>
      {pager.total === 0 ? empty : (
        <>
          <div className="lg:overflow-x-auto">{children}</div>
          <TablePager pager={pager} />
        </>
      )}
    </div>
  )
}

// Every tab owns the page header bar: "Settings", the tab's name, its section
// actions (add / reset / upload… — the first two as buttons, any more under
// "More") and one gold "Save changes" when the tab has something to save.
const MAX_HEADER_ACTIONS = 2
function useSettingsHeader(tabId, { actions = [], onSave, saving = false } = {}) {
  const { t } = useTranslation('settings')
  const list = actions.filter(Boolean)
  const shown = list.slice(0, MAX_HEADER_ACTIONS)
  const extra = list.slice(MAX_HEADER_ACTIONS)
  usePageHeader({
    title: t('common:settings'),
    subtitle: t(`tabs.${tabId}.label`),
    actions: [
      ...shown,
      extra.length > 0 && { id: 'more', label: t('common:more'), icon: <LuEllipsis />, menu: extra },
      onSave && {
        id: 'save', label: saving ? t('common:saving') : t('common:saveChanges'), icon: <LuSave />,
        variant: 'primary', disabled: saving, onClick: onSave,
      },
    ],
  })
}

// Reusable crop modal: pan + zoom a picked image to a 1:1 square, then hand the
// cropped Blob to `onComplete`. Open when `src` (a data URL) is set.
function LogoCropModal({
  src, onCancel, onComplete, busy = false,
  title, cropShape = 'round',
  confirmLabel, busyLabel,
}) {
  const { t } = useTranslation('settings')
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
      title={title || t('crop.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{t('common:cancel')}</Button>
          <Button onClick={confirm} disabled={busy || !areaPixels}>
            {busy ? (busyLabel || t('common:saving')) : (confirmLabel || t('crop.confirm'))}
          </Button>
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
          <span className="t-sm text-ink3 shrink-0">{t('crop.zoom')}</span>
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
  const { t } = useTranslation('settings')
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

  // Stamp + authorised-signature image printed on tax invoices. Uploaded as-is
  // (rectangular, no crop) since it combines a round stamp with a signature.
  const [stampPreview, setStampPreview] = useState(null)
  const [stampUploading, setStampUploading] = useState(false)
  const stampFileRef = useRef(null)
  const stampSrc = stampPreview || settings.stampUrl || null

  async function handleStampSelect(e) {
    const file = e.target.files[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setStampUploading(true)
    try {
      const form = new FormData()
      form.append('stamp', file, file.name)
      const { data } = await settingsApi.uploadStamp(form)
      if (data.stampUrl) {
        setStampPreview(data.stampUrl)
        setSettings(s => ({ ...s, stampUrl: data.stampUrl }))
      }
      addToast(t('profile.stampUploaded'), 'success')
    } catch {
      addToast(t('profile.stampFailed'), 'error')
    } finally {
      setStampUploading(false)
    }
  }

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
      addToast(t('profile.logoUploaded'), 'success')
      setCropSrc(null)
    } catch {
      addToast(t('profile.logoFailed'), 'error')
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
      addToast(t('toast.saved'), 'success')
    } catch {
      addToast(t('toast.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const initials = settings.name
    ? settings.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'HM'

  useSettingsHeader('profile', {
    actions: [
      { id: 'logo', label: uploading ? t('profile.uploadingLogo') : t('profile.uploadLogo'), icon: <LuUpload />, disabled: uploading, onClick: () => fileRef.current?.click() },
      { id: 'stamp', label: stampUploading ? t('profile.uploadingStamp') : t('profile.uploadStamp'), icon: <LuStamp />, disabled: stampUploading, onClick: () => stampFileRef.current?.click() },
    ],
    onSave: handleSave,
    saving,
  })

  return (
    <div className={TAB_STACK}>
      {/* Brand assets: logo + stamp side by side. Each uploads as soon as it's picked. */}
      <Section title={t('profile.assetsTitle')} subtitle={t('profile.assetsSubtitle')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex items-center gap-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-full border-2 border-gold flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
              style={{ background: logoSrc ? 'transparent' : 'var(--gold-bg, #3a2e0a)' }}
              title={t('profile.clickLogo')}
            >
              {logoSrc ? (
                <img src={logoSrc} alt={t('profile.logoAlt')} className="w-full h-full object-cover" />
              ) : (
                <span className="t-h2 text-gold">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="t-title mb-0.5">{t('profile.hotelLogo')}</div>
              <p className="t-xs text-ink3 m-0">{t('profile.logoHint')}</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>

          {/* Stamp & signature (printed on tax invoices) */}
          <div className="flex items-center gap-4">
            <div
              onClick={() => stampFileRef.current?.click()}
              className="w-24 h-16 rounded-lg border-2 border-dashed border-line2 flex items-center justify-center cursor-pointer overflow-hidden shrink-0 bg-surface2"
              title={t('profile.clickStamp')}
            >
              {stampSrc ? (
                <img src={stampSrc} alt={t('profile.stamp')} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-ink3 text-center px-1.5 leading-tight">{t('profile.noStamp')}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="t-title mb-0.5">{t('profile.stamp')}</div>
              <p className="t-xs text-ink3 m-0">
                {t('profile.stampHint')} {stampUploading ? t('profile.uploading') : t('profile.clickBox')}
              </p>
              <input ref={stampFileRef} type="file" accept="image/*" className="hidden" onChange={handleStampSelect} />
            </div>
          </div>
        </div>
      </Section>

      <LogoCropModal
        key={cropSrc || 'closed'}
        src={cropSrc}
        busy={uploading}
        title={t('crop.cropLogo')}
        cropShape="round"
        confirmLabel={t('crop.cropUpload')}
        busyLabel={t('crop.uploading')}
        onCancel={() => setCropSrc(null)}
        onComplete={uploadCropped}
      />

      <Section title={t('profile.businessTitle')} subtitle={t('profile.businessSubtitle')}>
        <div className={FORM_GRID}>
          <Field label={t('fields.hotelName')}>
            <input className="form-input" value={settings.name}
              onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} />
          </Field>
          <Field label={t('fields.ownerName')}>
            <input className="form-input" value={settings.ownerName}
              onChange={e => setSettings(s => ({ ...s, ownerName: e.target.value }))} />
          </Field>
          <Field label={t('fields.phone')}>
            <input className="form-input" value={settings.phone}
              onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))} />
          </Field>
          <Field label={t('fields.email')}>
            <input className="form-input" type="email" value={settings.email}
              onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} />
          </Field>
          <Field label={t('fields.gstin')}>
            <input className="form-input t-mono" value={settings.gstin}
              onChange={e => setSettings(s => ({ ...s, gstin: e.target.value }))} />
          </Field>
          <Field label={t('fields.licenseNo')}>
            <input className="form-input" value={settings.licenseNo}
              onChange={e => setSettings(s => ({ ...s, licenseNo: e.target.value }))} />
          </Field>
          <Field label={t('fields.address')} fullWidth>
            <textarea className="form-textarea resize-y" rows={2} value={settings.address}
              onChange={e => setSettings(s => ({ ...s, address: e.target.value }))} />
          </Field>
        </div>
      </Section>
    </div>
  )
}

// ─── Tab 2: Room Config ───────────────────────────────────────────────────────
function RoomConfigTab({ settings, setSettings, roomTypes, setRoomTypes, addToast }) {
  const { t } = useTranslation('settings')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [saving, setSaving] = useState(false)

  function updateRoom(id, field, value) {
    setRoomTypes(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const [reveal, setReveal] = useState(0)
  function addRoom() {
    setReveal(n => n + 1)
    setRoomTypes(rows => [...rows, {
      id: newRowId(), name: t('rooms.newType'), dailyRate: 500, monthlyRate: 9000,
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
      addToast(t('toast.saved'), 'success')
    } catch {
      addToast(t('rooms.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const pager = usePaged(roomTypes)
  useSettingsHeader('rooms', {
    actions: [{ id: 'add-room', label: t('rooms.addType'), icon: <LuPlus />, onClick: addRoom }],
    onSave: handleSave,
    saving,
  })

  return (
    <div className={TAB_STACK}>
      <Section title={t('rooms.capacityTitle')} subtitle={t('rooms.capacitySubtitle')}>
        <div className="grid grid-cols-2 gap-4 md:max-w-md">
          <Field label={t('fields.totalRooms')}>
            <input className="form-input" type="number" min={1}
              value={settings.totalRooms}
              onChange={e => setSettings(s => ({ ...s, totalRooms: Number(e.target.value) }))} />
          </Field>
          <Field label={t('rooms.floors')}>
            <input className="form-input" type="number" min={1}
              value={settings.floors}
              onChange={e => setSettings(s => ({ ...s, floors: Number(e.target.value) }))} />
          </Field>
        </div>
      </Section>

      <Section
        title={t('rooms.typesTitle')}
        subtitle={t('rooms.typesSubtitle')}
        bodyClassName="p-0"
      >
        <EditableTable
          pager={pager}
          reveal={reveal}
          empty={
            <EmptyState icon={<LuBedDouble />} title={t('rooms.emptyTitle')} message={t('rooms.emptyMessage')}
              action={<AddButton onClick={addRoom}>{t('rooms.addType')}</AddButton>} />
          }
        >
          <table className={STACK_TABLE}>
            <TableHead cols={[t('rooms.colName'), t('rooms.colDaily'), t('rooms.colMonthly'), t('rooms.colPeakDaily'), t('rooms.colPeakMonthly'), t('rooms.colCount'), t('rooms.colMaxOcc'), '']} />
            <tbody>
              {pager.rows.map(row => (
                <tr key={row.id} className={STACK_ROW}>
                  {[
                    { field: 'name',            label: t('rooms.colName'),        val: row.name,            type: 'text',   w: 100 },
                    { field: 'dailyRate',       label: t('rooms.colDaily'),       val: row.dailyRate,       type: 'number', w: 75 },
                    { field: 'monthlyRate',     label: t('rooms.colMonthly'),     val: row.monthlyRate,     type: 'number', w: 80 },
                    { field: 'peakDailyRate',   label: t('rooms.colPeakDaily'),   val: row.peakDailyRate,   type: 'number', w: 80 },
                    { field: 'peakMonthlyRate', label: t('rooms.colPeakMonthly'), val: row.peakMonthlyRate, type: 'number', w: 90 },
                    { field: 'count',           label: t('rooms.colCount'),       val: row.count ?? 0,      type: 'number', w: 60 },
                    { field: 'maxOccupancy',    label: t('rooms.colMaxOcc'),      val: row.maxOccupancy,    type: 'number', w: 60 },
                  ].map(({ field, label, val, type, w }) => (
                    <td key={field} className={field === 'name' ? STACK_TITLE : STACK_CELL}>
                      <CellLabel>{label}</CellLabel>
                      <InlineInput
                        value={val}
                        type={type}
                        min={type === 'number' ? 0 : undefined}
                        w={w}
                        className={field === 'name' ? TITLE_INPUT : ''}
                        onChange={v => updateRoom(row.id, field, v)}
                      />
                    </td>
                  ))}
                  <td className={STACK_DEL}>
                    {confirmDelete === row.id ? (
                      <span className="inline-flex gap-1.5 max-lg:bg-surface max-lg:pl-2">
                        <Button size="sm" variant="danger" onClick={() => deleteRoom(row.id)}>{t('common:delete')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>{t('common:cancel')}</Button>
                      </span>
                    ) : (
                      <RowDelete onClick={() => setConfirmDelete(row.id)} label={t('row.delete', { name: row.name })} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EditableTable>
      </Section>
    </div>
  )
}

// ─── Tab 3: Facilities ────────────────────────────────────────────────────────
function FacilitiesTab({ amenities, setAmenities, addToast }) {
  const { t } = useTranslation('settings')
  // Free-text facility chips stay client-side — there is no DB model for them.
  const [facilities, setFacilities] = useState(initFacilities)
  const [newFacility, setNewFacility]   = useState('')
  const [saving, setSaving] = useState(false)

  const newFacilityRef = useRef(null)
  function addFacility() {
    const trimmed = newFacility.trim()
    // From the header with nothing typed: point at the box to type in.
    if (!trimmed) {
      newFacilityRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      newFacilityRef.current?.focus({ preventScroll: true })
      return
    }
    if (facilities.includes(trimmed)) return
    setFacilities(f => [...f, trimmed])
    setNewFacility('')
  }

  function removeFacility(name) {
    setFacilities(f => f.filter(x => x !== name))
  }

  function updateAmenity(id, field, value) {
    setAmenities(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const [reveal, setReveal] = useState(0)
  function addAmenity() {
    setReveal(n => n + 1)
    setAmenities(rows => [...rows, { id: newRowId(), name: t('facilities.newAmenity'), dailyRate: 0, monthlyRate: 0 }])
  }

  function removeAmenity(id) {
    setAmenities(rows => rows.filter(r => r.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({ amenities: amenities.map(r => stripForSave(r)) })
      addToast(t('toast.saved'), 'success')
    } catch {
      addToast(t('facilities.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const pager = usePaged(amenities)
  useSettingsHeader('facilities', {
    actions: [
      { id: 'add-facility', label: t('facilities.addFacility'), icon: <LuTag />, onClick: addFacility },
      { id: 'add-amenity', label: t('facilities.addAmenity'), icon: <LuPlus />, onClick: addAmenity },
    ],
    onSave: handleSave,
    saving,
  })

  return (
    <div className={TAB_STACK}>
      <Section title={t('facilities.standardTitle')} subtitle={t('facilities.standardSubtitle')}>
        {facilities.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {facilities.map(f => (
              <span
                key={f}
                className="t-xs inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-gold-bg border border-gold-border text-gold font-medium"
              >
                {f}
                <button
                  type="button"
                  onClick={() => removeFacility(f)}
                  className="bg-transparent border-none cursor-pointer text-gold inline-flex items-center justify-center w-6 h-6 pointer-coarse:w-8 pointer-coarse:h-8 rounded-full hover:bg-gold/20"
                  title={t('row.remove', { name: f })}
                  aria-label={t('row.remove', { name: f })}
                >
                  <LuX size={12} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="t-sm text-ink3 mt-0 mb-4">{t('facilities.noFacilities')}</p>
        )}
        <div className="flex gap-2">
          <label htmlFor="new-facility" className="sr-only">{t('facilities.newFacility')}</label>
          <input
            id="new-facility"
            ref={newFacilityRef}
            className="form-input flex-1 min-w-0 sm:flex-none sm:w-[300px]"
            placeholder={t('facilities.newFacilityPlaceholder')}
            enterKeyHint="done"
            value={newFacility}
            onChange={e => setNewFacility(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addFacility()}
          />
        </div>
      </Section>

      <Section
        title={t('facilities.amenitiesTitle')}
        subtitle={t('facilities.amenitiesSubtitle')}
        bodyClassName="p-0"
      >
        <EditableTable
          pager={pager}
          reveal={reveal}
          empty={
            <EmptyState icon={<LuSparkles />} title={t('facilities.emptyTitle')} message={t('facilities.emptyMessage')}
              action={<AddButton onClick={addAmenity}>{t('facilities.addAmenity')}</AddButton>} />
          }
        >
          <table className={STACK_TABLE}>
            <TableHead cols={[t('facilities.colAmenity'), t('facilities.colDaily'), t('facilities.colMonthly'), '']} />
            <tbody>
              {pager.rows.map(row => (
                <tr key={row.id} className={STACK_ROW}>
                  <td className={STACK_TITLE}>
                    <CellLabel>{t('facilities.colAmenity')}</CellLabel>
                    <InlineInput value={row.name} type="text" w={200} className={TITLE_INPUT} onChange={v => updateAmenity(row.id, 'name', v)} />
                  </td>
                  <td className={STACK_CELL}>
                    <CellLabel>{t('facilities.colDaily')}</CellLabel>
                    <InlineInput value={row.dailyRate} type="number" min={0} w={110} onChange={v => updateAmenity(row.id, 'dailyRate', v)} />
                  </td>
                  <td className={STACK_CELL}>
                    <CellLabel>{t('facilities.colMonthly')}</CellLabel>
                    <InlineInput value={row.monthlyRate} type="number" min={0} w={110} onChange={v => updateAmenity(row.id, 'monthlyRate', v)} />
                  </td>
                  <td className={STACK_DEL}>
                    <RowDelete onClick={() => removeAmenity(row.id)} label={t('row.remove', { name: row.name })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EditableTable>
      </Section>
    </div>
  )
}

// ─── Tab 4: Food Plans ────────────────────────────────────────────────────────
function FoodPlansTab({ plans, setPlans, addToast }) {
  const { t } = useTranslation('settings')
  const [saving, setSaving] = useState(false)

  function updatePlan(id, field, value) {
    setPlans(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const [reveal, setReveal] = useState(0)
  function addPlan() {
    setReveal(n => n + 1)
    setPlans(rows => [...rows, { id: newRowId(), name: t('food.newPlan'), oneTimeRate: 0, weeklyRate: 0, monthlyRate: 0, description: '' }])
  }

  function removePlan(id) {
    setPlans(rows => rows.filter(r => r.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({ foodPlans: plans.map(r => stripForSave(r)) })
      addToast(t('toast.saved'), 'success')
    } catch {
      addToast(t('food.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const pager = usePaged(plans)
  useSettingsHeader('food', {
    actions: [{ id: 'add-plan', label: t('food.addPlan'), icon: <LuPlus />, onClick: addPlan }],
    onSave: handleSave,
    saving,
  })

  return (
    <div className={TAB_STACK}>
      <Section
        title={t('food.title')}
        subtitle={t('food.subtitle')}
        bodyClassName="p-0"
      >
        <EditableTable
          pager={pager}
          reveal={reveal}
          empty={
            <EmptyState icon={<LuUtensils />} title={t('food.emptyTitle')} message={t('food.emptyMessage')}
              action={<AddButton onClick={addPlan}>{t('food.addPlan')}</AddButton>} />
          }
        >
          <table className={STACK_TABLE}>
            <TableHead cols={[t('food.colName'), t('food.colOneTime'), t('food.colWeekly'), t('food.colMonthly'), t('food.colDescription'), '']} />
            <tbody>
              {pager.rows.map(row => (
                <tr key={row.id} className={`${STACK_ROW_BASE} max-lg:grid-cols-3`}>
                  <td className={STACK_TITLE}>
                    <CellLabel>{t('food.colName')}</CellLabel>
                    <InlineInput value={row.name} type="text" w={140} className={TITLE_INPUT} onChange={v => updatePlan(row.id, 'name', v)} />
                  </td>
                  <td className={STACK_CELL}>
                    <CellLabel>{t('food.colOneTime')}</CellLabel>
                    <InlineInput value={row.oneTimeRate} type="number" min={0} onChange={v => updatePlan(row.id, 'oneTimeRate', v)} />
                  </td>
                  <td className={STACK_CELL}>
                    <CellLabel>{t('food.colWeekly')}</CellLabel>
                    <InlineInput value={row.weeklyRate} type="number" min={0} onChange={v => updatePlan(row.id, 'weeklyRate', v)} />
                  </td>
                  <td className={STACK_CELL}>
                    <CellLabel>{t('food.colMonthly')}</CellLabel>
                    <InlineInput value={row.monthlyRate} type="number" min={0} onChange={v => updatePlan(row.id, 'monthlyRate', v)} />
                  </td>
                  <td className={`${STACK_CELL} max-lg:col-span-3`}>
                    <CellLabel>{t('food.colDescription')}</CellLabel>
                    <InlineInput value={row.description} type="text" w={180} onChange={v => updatePlan(row.id, 'description', v)} />
                  </td>
                  <td className={STACK_DEL}>
                    <RowDelete onClick={() => removePlan(row.id)} label={t('row.remove', { name: row.name })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EditableTable>
      </Section>
    </div>
  )
}

// ─── Tab 5: Tax & Pricing ─────────────────────────────────────────────────────
function TaxPricingTab({ settings, setSettings, addToast }) {
  const { t } = useTranslation('settings')
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
      addToast(t('toast.saved'), 'success')
    } catch {
      addToast(t('toast.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  useSettingsHeader('tax', { onSave: handleSave, saving })

  return (
    <div className={TAB_STACK}>
      <Section title={t('tax.gstTitle')} subtitle={t('tax.gstSubtitle')}>
        <div className={FORM_GRID}>
          <Field label={t('tax.gstRate')}>
            <input className="form-input" type="number" min={0} max={28}
              value={settings.gstRate}
              onChange={e => setSettings(s => ({ ...s, gstRate: Number(e.target.value) }))} />
          </Field>
          <Field label={t('tax.gstType')}>
            <select className="form-select" value={settings.gstType}
              onChange={e => setSettings(s => ({ ...s, gstType: e.target.value }))}>
              <option value="CGST+SGST">CGST + SGST</option>
              <option value="IGST">IGST</option>
            </select>
          </Field>
          <Field label={t('fields.gstin')}>
            <input className="form-input" value={settings.gstin}
              onChange={e => setSettings(s => ({ ...s, gstin: e.target.value }))} />
          </Field>
          <Field label={t('tax.applyOn')}>
            <select className="form-select" value={settings.gstApplyOn}
              onChange={e => setSettings(s => ({ ...s, gstApplyOn: e.target.value }))}>
              <option value="All">{t('tax.applyAll')}</option>
              <option value="Rent Only">{t('tax.applyRent')}</option>
              <option value="Rent+Food">{t('tax.applyRentFood')}</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title={t('tax.lateTitle')} subtitle={t('tax.lateSubtitle')}>
        <div className={FORM_GRID}>
          <Field label={t('tax.lateFee')}>
            <input className="form-input" type="number" min={0}
              value={settings.lateFeeRate}
              onChange={e => setSettings(s => ({ ...s, lateFeeRate: Number(e.target.value) }))} />
          </Field>
          <Field label={t('tax.grace')}>
            <input className="form-input" type="number" min={0}
              value={settings.gracePeriod}
              onChange={e => setSettings(s => ({ ...s, gracePeriod: Number(e.target.value) }))} />
          </Field>
        </div>
      </Section>

      <Section title={t('tax.seasonalTitle')}>
        <label className="flex items-center gap-2.5 cursor-pointer select-none pointer-coarse:min-h-11">
          <input
            type="checkbox"
            checked={settings.seasonalPricing}
            onChange={e => setSettings(s => ({ ...s, seasonalPricing: e.target.checked }))}
            className="w-4 h-4 accent-[var(--gold)]"
          />
          <span className="t-body">{t('tax.seasonalEnable')}</span>
        </label>
        {settings.seasonalPricing && (
          <p className="t-xs mt-2.5 mb-0 text-ink3">
            {t('tax.seasonalHint')}
          </p>
        )}
      </Section>
    </div>
  )
}

// ─── Tab 6: Documents ─────────────────────────────────────────────────────────
function DocumentsTab({ settings, addToast }) {
  const { t } = useTranslation('settings')
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
      addToast(t('documents.saved'), 'success')
    } catch (e) {
      addToast(e.response?.data?.message || t('documents.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const pager = usePaged(kycDocs)
  useSettingsHeader('documents', { onSave: handleSave, saving })

  return (
    <div className={TAB_STACK}>
      <Section
        title={t('documents.kycTitle')}
        subtitle={t('documents.kycSubtitle')}
        bodyClassName="p-0"
      >
        <ul className="list-none m-0 p-0 divide-y divide-[var(--border)]">
          {pager.rows.map(doc => {
            const docLabel = t(`documents.kyc.${doc.id}`, { defaultValue: doc.label })
            return (
            <li key={doc.id} className="flex items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3 flex-wrap">
              <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[160px] pointer-coarse:min-h-11">
                <input
                  type="checkbox"
                  checked={doc.enabled}
                  onChange={e => toggleDoc(doc.id, 'enabled', e.target.checked)}
                  className="w-4 h-4 accent-[var(--gold)]"
                />
                <span className={`t-title ${doc.enabled ? '' : 'text-ink3'}`}>{docLabel}</span>
              </label>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  doc.required ? 'bg-danger-bg text-danger-text' : 'bg-surface2 text-ink3 border border-line'
                }`}
              >
                {doc.required ? t('documents.required') : t('documents.optional')}
              </span>
              <label className="t-xs flex items-center gap-1.5 text-ink3 ml-auto">
                {t('documents.max')}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={doc.maxMB}
                  onChange={e => toggleDoc(doc.id, 'maxMB', Number(e.target.value))}
                  className={`${CELL_INPUT} !w-[64px]`}
                  aria-label={t('documents.maxAria', { label: docLabel })}
                />
                {t('documents.mb')}
              </label>
            </li>
            )
          })}
        </ul>
        <TablePager pager={pager} />
      </Section>

      <Section title={t('documents.expiryTitle')}>
        <div className={FORM_GRID}>
          <Field label={t('documents.expiryDays')}>
            <input
              className="form-input"
              type="number"
              min={1}
              value={expiryReminderDays}
              onChange={e => setExpiryReminderDays(Number(e.target.value))}
            />
          </Field>
        </div>
        <p className="t-xs mt-2 mb-0 text-ink3">
          {t('documents.expiryHint')}
        </p>
      </Section>
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
  const { t } = useTranslation('settings')
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
      addToast(t('pricing.saved'), 'success')
    } catch (e) {
      addToast(e.response?.data?.error || t('pricing.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  function updateRule(id, field, value) {
    setRules(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const [ruleReveal, setRuleReveal] = useState(0)
  const [compReveal, setCompReveal] = useState(0)
  function addRule() {
    setRuleReveal(n => n + 1)
    setRules(rows => [...rows, {
      id: String(Date.now()), name: t('pricing.newRule'), triggerType: 'occupancy',
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
      addToast(e.response?.data?.error || t('pricing.compSaveFailed'), 'error')
    }
  }

  async function addCompetitor() {
    setCompReveal(n => n + 1)
    try {
      await pricingApi.createCompetitor({ name: t('pricing.newHotel'), roomType: 'Single', theirRate: 500 })
      loadCompetitors()
    } catch (e) {
      addToast(e.response?.data?.error || t('pricing.compAddFailed'), 'error')
    }
  }

  async function deleteComp(id) {
    try {
      await pricingApi.deleteCompetitor(id)
      setCompetitors(rows => rows.filter(r => r.id !== id))
    } catch (e) {
      addToast(e.response?.data?.error || t('pricing.compDeleteFailed'), 'error')
    }
  }

  // Build bar chart data: for each room type, compute avg competitor rate
  const chartTypes = ['Single', 'Double', 'Suite']
  const chartData = chartTypes.map(rt => {
    const compsForType = competitors.filter(c => c.roomType === rt)
    const avgComp = compsForType.length
      ? Math.round(compsForType.reduce((s, c) => s + c.theirRate, 0) / compsForType.length)
      : 0
    return { name: rt, yours: YOUR_RATES[rt] || 0, comp: avgComp }
  })

  const rulesPager = usePaged(rules)
  const compPager  = usePaged(competitors)
  useSettingsHeader('pricing', {
    actions: [
      { id: 'add-rule', label: t('pricing.addRule'), icon: <LuPlus />, onClick: addRule },
      { id: 'add-competitor', label: t('pricing.addCompetitor'), icon: <LuBuilding2 />, onClick: addCompetitor },
    ],
    onSave: handleSaveRules,
    saving,
  })

  return (
    <div className={TAB_STACK}>
      {/* Dynamic Pricing Rules */}
      <Section
        title={t('pricing.rulesTitle')}
        subtitle={t('pricing.rulesSubtitle')}
        bodyClassName="p-0"
      >
        <EditableTable
          pager={rulesPager}
          reveal={ruleReveal}
          empty={
            <EmptyState icon={<LuTrendingUp />} title={t('pricing.rulesEmptyTitle')} message={t('pricing.rulesEmptyMessage')}
              action={<AddButton onClick={addRule}>{t('pricing.addRule')}</AddButton>} />
          }
        >
          <table className={STACK_TABLE}>
            <TableHead cols={[t('pricing.colRuleName'), t('pricing.colTrigger'), t('pricing.colThreshold'), t('pricing.colAdjustment'), t('pricing.colActive'), '']} />
            <tbody>
              {rulesPager.rows.map(row => {
                const isPositive = row.adjustment > 0
                const adjColor = isPositive ? 'text-danger' : 'text-success'
                const adjPrefix = isPositive ? '+' : ''
                return (
                  <tr key={row.id} className={STACK_ROW}>
                    {/* Name */}
                    <td className={STACK_TITLE}>
                      <CellLabel>{t('pricing.colRuleName')}</CellLabel>
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => updateRule(row.id, 'name', e.target.value)}
                        className={`${CELL_INPUT} ${TITLE_INPUT}`}
                        style={{ '--w': '170px' }}
                        aria-label={t('pricing.ruleNameAria')}
                      />
                    </td>
                    {/* Trigger type */}
                    <td className={STACK_WIDE}>
                      <CellLabel>{t('pricing.colTrigger')}</CellLabel>
                      <select
                        value={row.triggerType}
                        onChange={e => updateRule(row.id, 'triggerType', e.target.value)}
                        className={`${CELL_INPUT} lg:w-auto lg:min-w-[96px] pr-8 lg:pr-7`}
                        aria-label={t('pricing.triggerAria', { name: row.name })}
                      >
                        <option value="occupancy">{t('pricing.trigger.occupancy')}</option>
                        <option value="stay_length">{t('pricing.trigger.stay_length')}</option>
                        <option value="lead_time">{t('pricing.trigger.lead_time')}</option>
                      </select>
                    </td>
                    {/* Threshold */}
                    <td className={STACK_CELL}>
                      <CellLabel>{t('pricing.colThreshold')}</CellLabel>
                      <input
                        type="number"
                        value={row.threshold}
                        min={0}
                        onChange={e => updateRule(row.id, 'threshold', Number(e.target.value))}
                        className={CELL_INPUT}
                        style={{ '--w': '70px' }}
                        aria-label={t('pricing.thresholdAria', { name: row.name })}
                      />
                    </td>
                    {/* Adjustment */}
                    <td className={STACK_CELL}>
                      <CellLabel>{t('pricing.colAdjustment')}</CellLabel>
                      <div className="flex items-center gap-0.5">
                        <span className={`t-xs ${adjColor}`}>
                          {adjPrefix}
                        </span>
                        <input
                          type="number"
                          value={row.adjustment}
                          onChange={e => updateRule(row.id, 'adjustment', Number(e.target.value))}
                          className={`${CELL_INPUT} font-bold ${adjColor}`}
                          style={{ '--w': '80px' }}
                          aria-label={t('pricing.adjustmentAria', { name: row.name })}
                        />
                      </div>
                    </td>
                    {/* Active toggle */}
                    <td className={`${STACK_WIDE} max-lg:order-last`}>
                      <label className="inline-flex items-center gap-2 cursor-pointer pointer-coarse:min-h-11">
                        <input
                          type="checkbox"
                          checked={row.active}
                          onChange={e => updateRule(row.id, 'active', e.target.checked)}
                          className="w-[15px] h-[15px] pointer-coarse:w-5 pointer-coarse:h-5 rounded text-gold focus:ring-gold/30 accent-[var(--gold)] cursor-pointer"
                          aria-label={t('row.activeAria', { name: row.name })}
                        />
                        <span className="lg:hidden t-sm text-ink2">{t('row.active')}</span>
                      </label>
                    </td>
                    {/* Delete */}
                    <td className={STACK_DEL}>
                      <RowDelete onClick={() => deleteRule(row.id)} label={t('row.delete', { name: row.name })} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </EditableTable>
      </Section>

      {/* Competitor Rate Benchmarking — each row saves as you edit it */}
      <Section
        title={t('pricing.compTitle')}
        subtitle={t('pricing.compSubtitle')}
        bodyClassName="p-0"
      >
        <EditableTable
          pager={compPager}
          reveal={compReveal}
          empty={
            <EmptyState icon={<LuTrendingUp />} title={t('pricing.compEmptyTitle')} message={t('pricing.compEmptyMessage')}
              action={<AddButton onClick={addCompetitor}>{t('pricing.addCompetitor')}</AddButton>} />
          }
        >
          <table className={STACK_TABLE}>
            <TableHead cols={[t('pricing.colCompName'), t('pricing.colRoomType'), t('pricing.colTheirRate'), t('pricing.colYourRate'), t('pricing.colDelta'), '']} />
            <tbody>
              {compPager.rows.map(row => {
                const yourRate = YOUR_RATES[row.roomType] || 0
                const delta = row.theirRate ? ((yourRate - row.theirRate) / row.theirRate * 100).toFixed(1) : 0
                const deltaNum = Number(delta)
                const deltaColor = deltaNum < 0 ? 'text-success' : 'text-danger'
                const deltaPrefix = deltaNum > 0 ? '+' : ''
                return (
                  <tr key={row.id} className={STACK_ROW}>
                    <td className={STACK_TITLE}>
                      <CellLabel>{t('pricing.colCompName')}</CellLabel>
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => updateComp(row.id, 'name', e.target.value)}
                        onBlur={() => persistComp(row)}
                        className={`${CELL_INPUT} ${TITLE_INPUT}`}
                        style={{ '--w': '160px' }}
                        aria-label={t('pricing.compNameAria')}
                      />
                    </td>
                    <td className={STACK_CELL}>
                      <CellLabel>{t('pricing.colRoomType')}</CellLabel>
                      <select
                        value={row.roomType}
                        onChange={e => { updateComp(row.id, 'roomType', e.target.value); persistComp({ ...row, roomType: e.target.value }) }}
                        className={`${CELL_INPUT} lg:w-auto lg:min-w-[96px] pr-8 lg:pr-7`}
                        aria-label={t('pricing.roomTypeAria', { name: row.name })}
                      >
                        {['Single', 'Double', 'Suite', 'Deluxe'].map(rt => (
                          <option key={rt} value={rt}>{rt}</option>
                        ))}
                      </select>
                    </td>
                    <td className={STACK_CELL}>
                      <CellLabel>{t('pricing.colTheirRate')}</CellLabel>
                      <input
                        type="number"
                        value={row.theirRate}
                        min={0}
                        onChange={e => updateComp(row.id, 'theirRate', Number(e.target.value))}
                        onBlur={() => persistComp(row)}
                        className={CELL_INPUT}
                        style={{ '--w': '90px' }}
                        aria-label={t('pricing.dailyRateAria', { name: row.name })}
                      />
                    </td>
                    <td className={`${STACK_CELL} t-sm text-ink3`}>
                      <CellLabel>{t('pricing.colYourRate')}</CellLabel>
                      ₹{yourRate}
                    </td>
                    <td className={`${STACK_CELL} t-title ${deltaColor}`}>
                      <CellLabel>{t('pricing.colDelta')}</CellLabel>
                      {deltaPrefix}{delta}%
                    </td>
                    <td className={STACK_DEL}>
                      <RowDelete onClick={() => deleteComp(row.id)} label={t('row.remove', { name: row.name })} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </EditableTable>
      </Section>

      <Section title={t('pricing.chartTitle')} subtitle={t('pricing.chartSubtitle')}>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} width={50} />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                formatter={(value) => [`₹${value}`, undefined]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="yours" name={t('pricing.yourRate')}      fill="#c9a84c" radius={[3, 3, 0, 0]} />
              <Bar dataKey="comp"  name={t('pricing.competitorAvg')} fill="#6b7280" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
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
  const { t } = useTranslation('settings')
  // Display label / delay for a template, in the current language.
  const tplLabel = (tpl) => t(`notifications.templates.${tpl.trigger}`, { defaultValue: tpl.label })
  const tplDelay = (tpl) => t(`notifications.delays.${tpl.trigger}`, { defaultValue: tpl.delay })
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
      addToast(t('notifications.templateSaved'), 'success')
      closeEdit()
    } catch (e) {
      addToast(e.response?.data?.error || t('notifications.templateSaveFailed'), 'error')
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
      addToast(e.response?.data?.error || t('notifications.templateUpdateFailed'), 'error')
    }
  }

  const pager = usePaged(templates)
  useSettingsHeader('notifications', { onSave: () => addToast(t('notifications.scheduleSaved'), 'success') })

  return (
    <div className={TAB_STACK}>
      <Section
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        bodyClassName="p-0"
      >
        <EditableTable
          pager={pager}
          empty={<EmptyState icon={<LuBell />} title={t('notifications.emptyTitle')} message={t('notifications.emptyMessage')} />}
        >
          <table className={STACK_TABLE}>
            <TableHead cols={[t('notifications.colTrigger'), t('notifications.colDelay'), t('notifications.colActive'), '']} />
            <tbody>
              {pager.rows.map(tpl => (
                <tr key={tpl.id} className={`${STACK_ROW_BASE} max-lg:items-center max-lg:grid-cols-[minmax(0,1fr)_auto]`}>
                  <td className={`${STACK_CELL} lg:py-3`}>
                    <span className="t-title">{tplLabel(tpl)}</span>
                  </td>
                  <td className={`${STACK_CELL} lg:py-3 max-lg:col-start-1 max-lg:row-start-2`}>
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-warning-bg text-warning-text text-xs font-bold">
                      {tplDelay(tpl)}
                    </span>
                  </td>
                  <td className={`${STACK_CELL} lg:py-3 max-lg:col-start-2 max-lg:row-start-1 max-lg:row-span-2`}>
                    <label className="inline-flex items-center gap-2 cursor-pointer pointer-coarse:min-h-11">
                      <input
                        type="checkbox"
                        checked={tpl.active}
                        onChange={e => toggleActive(tpl.id, e.target.checked)}
                        className="w-[15px] h-[15px] pointer-coarse:w-5 pointer-coarse:h-5 rounded text-gold focus:ring-gold/30 accent-[var(--gold)] cursor-pointer"
                        aria-label={t('row.activeAria', { name: tplLabel(tpl) })}
                      />
                      <span className="lg:hidden t-sm text-ink2">{t('row.active')}</span>
                    </label>
                  </td>
                  <td className={`${STACK_CELL} lg:py-3 lg:text-right max-lg:col-span-2`}>
                    <ActionButton icon={<LuPencil />} onClick={() => openEdit(tpl)} className="max-lg:w-full">
                      {t('notifications.editTemplate')}
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EditableTable>
      </Section>

      {/* Edit Template Modal */}
      {editingId && editingTpl && (
        <Modal
          isOpen
          title={t('notifications.editTitle', { label: tplLabel(editingTpl) })}
          onClose={closeEdit}
          footer={
            <>
              <Button variant="ghost" onClick={closeEdit}>{t('common:cancel')}</Button>
              <Button onClick={saveTemplate} disabled={saving}>
                {saving ? t('common:saving') : t('notifications.saveTemplate')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <textarea
              ref={textareaRef}
              rows={5}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              aria-label={t('notifications.messageAria')}
              className="w-full px-2.5 py-2 text-base sm:text-[13px] bg-surface2 border border-line rounded-lg text-ink resize-y box-border focus:border-gold focus:ring-gold/20"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            {/* Variable chips */}
            <div>
              <div className="text-xs font-medium text-ink2 mb-1.5">{t('notifications.insertVariable')}</div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVar(v)}
                    className="px-2.5 py-[3px] pointer-coarse:py-2 rounded-full bg-gold-bg border border-gold-border text-gold text-[12px] font-bold cursor-pointer hover:border-gold"
                    style={{ fontFamily: 'var(--font-mono)' }}
                    title={t('notifications.insertVar', { v })}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab 9: Properties ────────────────────────────────────────────────────────
function PropertiesTab({ settings, setSettings, addToast }) {
  const { t } = useTranslation('settings')
  const [editingMain, setEditingMain] = useState(false)
  const [saving, setSaving] = useState(false)
  const snapshot = useRef(null)
  const { setHotelName, setOwnerName } = useHotelActions()

  function startEdit() {
    snapshot.current = settings
    setEditingMain(true)
  }

  // Cancel throws away unsaved typing instead of leaving it in the page state.
  function cancelEdit() {
    if (snapshot.current) setSettings(snapshot.current)
    setEditingMain(false)
  }

  async function handleSaveProperty() {
    setSaving(true)
    try {
      await settingsApi.update({ hotel: {
        name: settings.name, ownerName: settings.ownerName, phone: settings.phone,
        email: settings.email, gstin: settings.gstin, address: settings.address,
      } })
      setHotelName(settings.name)
      setOwnerName(settings.ownerName)
      addToast(t('properties.updated'), 'success')
      setEditingMain(false)
    } catch (e) {
      addToast(e.response?.data?.message || t('properties.updateFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const managerRef = useRef(null)
  // Header: add a property; edit this one's details (Cancel + Save while editing).
  useSettingsHeader('properties', {
    actions: [
      { id: 'add-property', label: t('properties.add'), icon: <LuPlus />, onClick: () => managerRef.current?.add() },
      editingMain
        ? { id: 'cancel-edit', label: t('properties.cancelEditing'), icon: <LuX />, disabled: saving, onClick: cancelEdit }
        : { id: 'edit-property', label: t('properties.editDetails'), icon: <LuPencil />, onClick: startEdit },
    ],
    onSave: editingMain ? handleSaveProperty : undefined,
    saving,
  })

  const set = (key, num) => e => setSettings(s => ({ ...s, [key]: num ? Number(e.target.value) : e.target.value }))
  const initials = (settings.name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const details = [
    { label: t('fields.owner'),      value: settings.ownerName },
    { label: t('fields.phone'),      value: settings.phone },
    { label: t('fields.email'),      value: settings.email, wide: true },
    { label: t('fields.gstin'),      value: settings.gstin, mono: true },
    { label: t('fields.totalRooms'), value: settings.totalRooms },
  ]

  return (
    <div className={TAB_STACK}>
      {/* Current Property — the active property's own profile */}
      <Section
        title={t('properties.currentTitle')}
        subtitle={editingMain ? t('properties.editingHint') : t('properties.currentHint')}
        bodyClassName="p-0"
      >
        <div className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4">
          <span className="w-12 h-12 rounded-xl bg-gold-bg border border-gold-border text-gold text-[16px] font-bold flex items-center justify-center shrink-0">
            {initials}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="t-h2 m-0 break-words min-w-0">{settings.name}</h3>
              <span className="badge badge-green">{t('common:active')}</span>
            </div>
            {settings.address && (
              <p className="t-sm text-ink2 mt-1.5 mb-0 flex items-start gap-1.5">
                <LuMapPin size={14} className="text-ink3 mt-[3px] shrink-0" aria-hidden />
                {settings.address}
              </p>
            )}
          </div>
        </div>

        {!editingMain ? (
          <dl className="m-0 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] border-t border-line bg-surface2/60 rounded-b-xl">
            {details.map(d => (
              <div key={d.label} className={`px-4 sm:px-5 py-3.5 min-w-0 ${d.wide ? 'col-span-2 md:col-span-1' : ''}`}>
                <dt className="t-label mb-1 whitespace-nowrap">{d.label}</dt>
                <dd className={`m-0 text-[13.5px] font-medium text-ink truncate ${d.mono ? 't-mono text-[13px]' : ''}`} title={String(d.value ?? '')}>
                  {d.value || <span className="text-ink3 font-normal">{t('properties.notSet')}</span>}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className={`${FORM_GRID} border-t border-line px-4 sm:px-5 py-4 sm:py-5`}>
            <Field label={t('fields.hotelName')}>
              <input className="form-input" value={settings.name} onChange={set('name')} autoFocus />
            </Field>
            <Field label={t('fields.ownerName')}>
              <input className="form-input" value={settings.ownerName} onChange={set('ownerName')} />
            </Field>
            <Field label={t('fields.phone')}>
              <input className="form-input" value={settings.phone} onChange={set('phone')} />
            </Field>
            <Field label={t('fields.email')}>
              <input className="form-input" type="email" value={settings.email} onChange={set('email')} />
            </Field>
            <Field label={t('fields.gstin')}>
              <input className="form-input t-mono" value={settings.gstin} onChange={set('gstin')} />
            </Field>
            <Field label={t('fields.totalRooms')}>
              <input className="form-input" type="number" min={1} value={settings.totalRooms} onChange={set('totalRooms', true)} />
            </Field>
            <Field label={t('fields.address')} fullWidth>
              <textarea className="form-textarea resize-y" rows={2} value={settings.address} onChange={set('address')} />
            </Field>
          </div>
        )}
      </Section>

      {/* Every property: add, rename, archive / restore, who has access */}
      <PropertyManager ref={managerRef} />
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
            type="button"
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-[14px] py-1.5 pointer-coarse:min-h-10 rounded-md border-none cursor-pointer text-[13px] transition-all duration-[140ms] ${
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
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-ink">{label}</div>
        {hint && <div className="t-xs text-ink3 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        aria-label={label}
        className={`w-[42px] h-6 rounded-xl border-none cursor-pointer shrink-0 relative transition-[background] duration-[160ms] pointer-coarse:after:content-[''] pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 ${
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
  const { t } = useTranslation('settings')
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
      addToast(t('appearance.saved'), 'success')
    } catch (e) {
      addToast(e.response?.data?.message || t('appearance.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  function resetDefaults() {
    const d = { accent: 'classic', density: 'comfortable', radius: 'soft' }
    setPrefs(d); applyAppearance(d); saveAppearance(d); addToast(t('appearance.resetDone'), 'info')
  }

  useSettingsHeader('appearance', {
    actions: [{ id: 'reset', label: t('appearance.reset'), icon: <LuRotateCcw />, onClick: resetDefaults }],
    onSave: handleSave,
    saving,
  })

  return (
    <div className={TAB_STACK}>
      <Section title={t('appearance.themeTitle')} subtitle={t('appearance.themeSubtitle')}>
        <div className="flex flex-col gap-2">
          <span className="form-label text-[12px]">{t('appearance.colorMode')}</span>
          <Segmented
            value={darkMode ? 'dark' : 'light'}
            onChange={setTheme}
            options={[
              { value: 'light', label: <><LuSun size={14} aria-hidden /> {t('appearance.light')}</> },
              { value: 'dark', label: <><LuMoon size={14} aria-hidden /> {t('appearance.dark')}</> },
            ]}
          />
          <p className="t-xs text-ink3 mt-1 mb-0">
            {t('appearance.themeHint')}
          </p>
        </div>
      </Section>

      <Section
        title={t('appearance.accentTitle')}
        subtitle={t('appearance.accentSubtitle')}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="form-label text-[12px]">{t('appearance.accentColor')}</span>
            <div className="flex gap-3 flex-wrap">
              {ACCENT_PRESETS.map(a => {
                const active = prefs.accent === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => update({ accent: a.id })}
                    aria-pressed={active}
                    className="flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none p-1"
                  >
                    <span
                      className={`w-11 h-11 rounded-full border-[3px] ${active ? 'border-ink' : 'border-transparent'}`}
                      style={{
                        background: `linear-gradient(135deg, ${a.gold}, ${a.gold2})`,
                        boxShadow: active ? '0 0 0 2px var(--surface) inset' : 'none',
                      }}
                    />
                    <span className={`text-xs ${active ? 'font-bold text-ink' : 'font-medium text-ink3'}`}>
                      {t(`appearance.accents.${a.id}`, { defaultValue: a.label })}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className={FORM_GRID}>
            <div className="flex flex-col gap-2">
              <span className="form-label text-[12px]">{t('appearance.density')}</span>
              <Segmented
                value={prefs.density}
                onChange={v => update({ density: v })}
                options={[{ value: 'comfortable', label: t('appearance.comfortable') }, { value: 'compact', label: t('appearance.compact') }]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="form-label text-[12px]">{t('appearance.cornerStyle')}</span>
              <Segmented
                value={prefs.radius}
                onChange={v => update({ radius: v })}
                options={RADIUS_PRESETS.map(r => ({ value: r.id, label: t(`appearance.radius.${r.id}`, { defaultValue: r.label }) }))}
              />
            </div>
          </div>
        </div>
      </Section>
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
  const { t } = useTranslation('settings')
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
    addToast(t('branding.logoCropped'), 'success')
  }

  async function handleSave() {
    setSaving(true)
    // Persist to localStorage immediately so the login/footer pick it up app-wide.
    try { localStorage.setItem(BRANDING_KEY, JSON.stringify(branding)) } catch { /* ignore */ }
    setHotelName(settings.name)
    try {
      await settingsApi.update({ hotel: { name: settings.name, branding: JSON.stringify(branding) } })
      addToast(t('branding.saved'), 'success')
    } catch (e) {
      addToast(e.response?.data?.message || t('branding.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const initials = (settings.name || 'QV').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  useSettingsHeader('branding', {
    actions: [
      { id: 'upload-logo', label: t('branding.uploadLogo'), icon: <LuUpload />, onClick: () => fileRef.current?.click() },
      branding.logoUrl && { id: 'remove-logo', label: t('branding.removeLogo'), icon: <LuTrash2 />, onClick: () => setBranding(b => ({ ...b, logoUrl: '' })) },
    ],
    onSave: handleSave,
    saving,
  })

  return (
    <div className={TAB_STACK}>
      <Section
        title={t('branding.identityTitle')}
        subtitle={t('branding.identitySubtitle')}
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-[84px] h-[84px] rounded-2xl cursor-pointer overflow-hidden shrink-0 border-2 border-gold flex items-center justify-center p-0"
            style={{ background: branding.logoUrl ? '#fff' : 'var(--gold-bg)' }}
            title={t('branding.clickLogo')}
            aria-label={t('branding.uploadLogo')}
          >
            {branding.logoUrl
              ? <img src={branding.logoUrl} alt={t('profile.logoAlt')} className="w-full h-full object-contain" />
              : <span className="t-display text-gold">{initials}</span>}
          </button>
          <p className="m-0 text-xs text-ink3 min-w-0">
            {t('branding.tileHint')}
          </p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
        </div>
      </Section>

      <LogoCropModal
        key={cropSrc || 'closed'}
        src={cropSrc}
        title={t('crop.cropLogo')}
        cropShape="rect"
        confirmLabel={t('crop.cropApply')}
        onCancel={() => setCropSrc(null)}
        onComplete={applyCropped}
      />

      <Section title={t('branding.textTitle')}>
        <div className={FORM_GRID}>
          <Field label={t('branding.brandName')}>
            <input className="form-input" value={settings.name}
              onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} />
          </Field>
          <Field label={t('branding.tagline')}>
            <input className="form-input" value={branding.tagline}
              onChange={e => setBranding(b => ({ ...b, tagline: e.target.value }))} />
          </Field>
          <Field label={t('branding.loginTitle')} fullWidth>
            <input className="form-input" value={branding.loginTitle}
              onChange={e => setBranding(b => ({ ...b, loginTitle: e.target.value }))} />
          </Field>
          <Field label={t('branding.footerNote')} fullWidth>
            <input className="form-input" value={branding.footerNote}
              onChange={e => setBranding(b => ({ ...b, footerNote: e.target.value }))} />
          </Field>
        </div>
      </Section>
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
  const { t, i18n } = useTranslation('settings')
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
      addToast(t('preferences.saved'), 'success')
    } catch (e) {
      addToast(e.response?.data?.message || t('preferences.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  useSettingsHeader('preferences', { onSave: handleSave, saving })

  return (
    <div className={TAB_STACK}>
      <Section title={t('preferences.regionalTitle')} subtitle={t('preferences.regionalSubtitle')}>
        <div className={FORM_GRID}>
          {/* The app language: applies at once on this device (no Save needed). */}
          <Field label={t('common:language')}>
            <select
              className="form-select"
              value={LANGUAGES.some(l => l.code === i18n.language) ? i18n.language : 'en'}
              onChange={e => { i18n.changeLanguage(e.target.value); set({ language: e.target.value }) }}
              aria-describedby="pref-language-hint"
            >
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
            <span id="pref-language-hint" className="text-xs text-ink3">{t('preferences.languageHint')}</span>
          </Field>
          <Field label={t('preferences.currency')}>
            <select className="form-select" value={prefs.currency} onChange={e => set({ currency: e.target.value })}>
              {['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => (
                <option key={c} value={c}>{t(`preferences.currencies.${c}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('preferences.dateFormat')}>
            <select className="form-select" value={prefs.dateFormat} onChange={e => set({ dateFormat: e.target.value })}>
              <option>DD/MM/YYYY</option>
              <option>MM/DD/YYYY</option>
              <option>YYYY-MM-DD</option>
              <option>DD MMM YYYY</option>
            </select>
          </Field>
          <Field label={t('preferences.timeFormat')}>
            <Segmented
              value={prefs.timeFormat}
              onChange={v => set({ timeFormat: v })}
              options={[{ value: '12h', label: t('preferences.hour12') }, { value: '24h', label: t('preferences.hour24') }]}
            />
          </Field>
          <Field label={t('preferences.rowsPerPage')}>
            <select className="form-select" value={prefs.itemsPerPage} onChange={e => set({ itemsPerPage: Number(e.target.value) })}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section
        title={t('preferences.sessionTitle')}
        bodyClassName="px-4 sm:px-5 py-1"
      >
        <div className="[&>*:last-child]:border-b-0">
          <ToggleRow label={t('preferences.soundAlerts')} hint={t('preferences.soundAlertsHint')}
            checked={prefs.soundAlerts} onChange={v => set({ soundAlerts: v })} />
          <ToggleRow label={t('preferences.emailDigest')} hint={t('preferences.emailDigestHint')}
            checked={prefs.emailDigest} onChange={v => set({ emailDigest: v })} />
          <ToggleRow label={t('preferences.autoLogout')} hint={t('preferences.autoLogoutHint')}
            checked={prefs.autoLogout} onChange={v => set({ autoLogout: v })} />
        </div>
      </Section>
    </div>
  )
}

// ─── Tab: Invoice config ──────────────────────────────────────────────────────
// Serial numbering + the details printed on the tax invoice (place of supply,
// bank details, terms). The serial is "<prefix><year>-<DD>/<MM>/<NN>" where
// prefix + year are set here, DD/MM come from the booking date, and NN is the
// per-day count. It can be overridden per invoice from the invoice preview.

// Build the serial preview the same way the server does (see buildSerial in
// bookingsController). `seq` is the per-day count; `d` is the booking date.
function previewSerial(prefix, year, seq, d) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yr = year || String(d.getFullYear())
  return `${prefix ?? ''}${yr}-${dd}/${mm}/${String(seq).padStart(2, '0')}`
}

function InvoiceConfigTab({ settings, setSettings, addToast }) {
  const { t } = useTranslation('settings')
  const [saving, setSaving] = useState(false)

  // Preview for a booking made today, first invoice of the day.
  const nextSerial = previewSerial(settings.invoicePrefix, settings.invoiceYear, 1, new Date())

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update({
        hotel: {
          invoicePrefix:      settings.invoicePrefix ?? '',
          invoiceYear:        settings.invoiceYear ?? '',
          placeOfSupply:      settings.placeOfSupply ?? '',
          bankAccountName:    settings.bankAccountName ?? '',
          bankName:           settings.bankName ?? '',
          bankAccountNo:      settings.bankAccountNo ?? '',
          bankIfsc:           settings.bankIfsc ?? '',
          termsAndConditions: settings.termsAndConditions ?? '',
        },
      })
      addToast(t('invoice.saved'), 'success')
    } catch (e) {
      addToast(e.response?.data?.message || t('invoice.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const set = (field) => (e) => setSettings(s => ({ ...s, [field]: e.target.value }))

  useSettingsHeader('invoice', { onSave: handleSave, saving })

  return (
    <div className={TAB_STACK}>
      {/* Serial numbering */}
      <Section title={t('invoice.numberingTitle')} subtitle={t('invoice.numberingSubtitle')}>
        <div className={FORM_GRID}>
          <Field label={t('invoice.prefix')}>
            <input className="form-input" value={settings.invoicePrefix ?? ''}
              onChange={set('invoicePrefix')} placeholder="RA/" />
          </Field>
          <Field label={t('invoice.year')}>
            <input className="form-input" value={settings.invoiceYear ?? ''}
              onChange={set('invoiceYear')} placeholder="2026" />
          </Field>
        </div>

        {/* Live preview */}
        <div className="mt-4 rounded-lg bg-surface2 border border-line px-4 py-3">
          <span className="t-xs text-ink3">{t('invoice.preview')}</span>
          <div className="font-mono text-lg font-bold text-ink mt-1">{nextSerial}</div>
        </div>

        <p className="t-xs mt-3 mb-0 text-ink3">
          <Trans
            t={t}
            i18nKey="invoice.serialHelp"
            values={{ fixed: `${settings.invoicePrefix || 'RA/'}${settings.invoiceYear || '2026'}` }}
            components={{ mono: <span className="font-mono" /> }}
          />
        </p>
      </Section>

      {/* GST place of supply */}
      <Section title={t('invoice.supplyTitle')}>
        <div className={FORM_GRID}>
          <Field label={t('invoice.supplyLabel')}>
            <input className="form-input" value={settings.placeOfSupply ?? ''}
              onChange={set('placeOfSupply')} placeholder={t('invoice.supplyPlaceholder')} />
          </Field>
        </div>
      </Section>

      {/* Bank details */}
      <Section title={t('invoice.bankTitle')} subtitle={t('invoice.bankSubtitle')}>
        <div className={FORM_GRID}>
          <Field label={t('invoice.accountName')}>
            <input className="form-input" value={settings.bankAccountName ?? ''}
              onChange={set('bankAccountName')} placeholder={t('invoice.accountNamePlaceholder')} />
          </Field>
          <Field label={t('invoice.bankName')}>
            <input className="form-input" value={settings.bankName ?? ''}
              onChange={set('bankName')} />
          </Field>
          <Field label={t('invoice.accountNo')}>
            <input className="form-input" value={settings.bankAccountNo ?? ''}
              onChange={set('bankAccountNo')} />
          </Field>
          <Field label={t('invoice.ifsc')}>
            <input className="form-input" value={settings.bankIfsc ?? ''}
              onChange={set('bankIfsc')} />
          </Field>
        </div>
      </Section>

      {/* Terms */}
      <Section title={t('invoice.termsTitle')}>
        <Field label={t('invoice.termsLabel')}>
          <textarea className="form-textarea resize-y" rows={3} value={settings.termsAndConditions ?? ''}
            onChange={set('termsAndConditions')} placeholder={t('invoice.termsPlaceholder')} />
        </Field>
      </Section>
    </div>
  )
}

// ─── Settings (Root) ──────────────────────────────────────────────────────────
// Grouped so 13 sections stay scannable: the sidebar renders one heading per group.
// Labels and descriptions live in settings.json (tabs.<id>.label / .description,
// groups.<group>) and are looked up at render time so they follow the language.
const ALL_TABS = [
  { id: 'profile',       group: 'property',   icon: LuHotel },
  { id: 'properties',    group: 'property',   icon: LuBuilding2 },
  { id: 'branding',      group: 'property',   icon: LuStamp },
  { id: 'rooms',         group: 'roomsRates', icon: LuBedDouble },
  { id: 'facilities',    group: 'roomsRates', icon: LuSparkles },
  { id: 'food',          group: 'roomsRates', icon: LuUtensils },
  { id: 'pricing',       group: 'roomsRates', icon: LuTrendingUp },
  { id: 'tax',           group: 'billing',    icon: LuPercent },
  { id: 'invoice',       group: 'billing',    icon: LuReceipt },
  { id: 'documents',     group: 'guests',     icon: LuFileText },
  { id: 'notifications', group: 'guests',     icon: LuBell },
  { id: 'appearance',    group: 'system',     icon: LuPalette },
  { id: 'preferences',   group: 'system',     icon: LuSlidersHorizontal },
]

const TAB_IDS = ALL_TABS.map(t => t.id)

// Read the active tab from the URL (?tab=…). Falls back when absent/invalid.
function tabFromUrl(fallback = 'profile') {
  if (typeof window === 'undefined') return fallback
  const t = new URLSearchParams(window.location.search).get('tab')
  return TAB_IDS.includes(t) ? t : fallback
}

// `onRunSetup` (re-run the setup wizard) is accepted but its button is disabled below.
export default function Settings() {
  const { t } = useTranslation('settings')
  // A deep link (navigateTo({ panel: 'settings', params: { tab } })) wins over the URL.
  const panelParams = useAppSelector(s => s.ui.activePanelParams)
  const [activeTab, setActiveTab] = useState(() => (TAB_IDS.includes(panelParams?.tab) ? panelParams.tab : tabFromUrl()))
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

  // Filter tabs based on the user's resolved permissions
  const tabs = ALL_TABS
    .filter(tab => canAccessSettingsTab(currentUser, tab.id))
    .map(tab => ({
      ...tab,
      label: t(`tabs.${tab.id}.label`),
      description: t(`tabs.${tab.id}.description`),
      groupLabel: t(`groups.${tab.group}`),
    }))

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

  const panels = {
    profile: (
      <HotelProfileTab
        settings={settings}
        setSettings={setSettings}
        addToast={addToast}
        setHotelName={setHotelName}
        setOwnerName={setOwnerName}
      />
    ),
    rooms: (
      <RoomConfigTab settings={settings} setSettings={setSettings}
        roomTypes={roomTypes} setRoomTypes={setRoomTypes} addToast={addToast} />
    ),
    facilities:    <FacilitiesTab amenities={amenities} setAmenities={setAmenities} addToast={addToast} />,
    food:          <FoodPlansTab plans={foodPlans} setPlans={setFoodPlans} addToast={addToast} />,
    tax:           <TaxPricingTab settings={settings} setSettings={setSettings} addToast={addToast} />,
    invoice:       <InvoiceConfigTab settings={settings} setSettings={setSettings} addToast={addToast} />,
    documents:     <DocumentsTab settings={settings} setSettings={setSettings} addToast={addToast} />,
    pricing:       <PricingRulesTab addToast={addToast} />,
    notifications: <NotificationsTab addToast={addToast} />,
    appearance:    <AppearanceTab settings={settings} addToast={addToast} />,
    branding:      <BrandingTab settings={settings} setSettings={setSettings} addToast={addToast} />,
    preferences:   <PreferencesTab settings={settings} addToast={addToast} />,
    properties:    <PropertiesTab settings={settings} setSettings={setSettings} addToast={addToast} />,
  }
  const activeMeta = tabs.find(t => t.id === validActiveTab)

  // The page header bar ("Settings", the open tab, its actions and Save) is set
  // by each tab through useSettingsHeader: child effects run before the
  // parent's, so setting it here too would overwrite the tab's actions.

  return (
    <div className="w-full min-w-0">
      {/* {onRunSetup && isOwner && (
        <button
          className="btn btn-outline btn-sm shrink-0"
          onClick={onRunSetup}
          title="Re-run the first-time setup wizard"
        >
          ⚙ Re-run Setup
        </button>
      )} */}

      <div className="flex flex-col xl:flex-row xl:items-start gap-3 xl:gap-7">
        <SettingsNav tabs={tabs} active={validActiveTab} onChange={setActiveTab} />

        <section className="flex-1 min-w-0" aria-label={activeMeta?.label || t('common:settings')}>
          {/* The section name is the header subtitle; its description sits above the form. */}
          {activeMeta && <p className="t-xs text-ink3 -mt-1 xl:mt-0 mb-4 xl:mb-5 xl:pb-4 xl:border-b xl:border-line">{activeMeta.description}</p>}
          {panels[validActiveTab]}
        </section>
      </div>
    </div>
  )
}

// Height of the sticky page header bar (layout/PageHeader.jsx), kept current as
// it wraps or its subtitle changes; 88px until it's measured.
function usePageHeaderHeight() {
  const [h, setH] = useState(88)
  useEffect(() => {
    const el = document.querySelector('#content .page-header')
    if (!el) return
    const measure = () => setH(el.offsetHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return h
}

// Left rail from xl (grouped, sticky); a grouped select below that — phones,
// tablets and small laptops, where a 13-item rail would squeeze the editable
// tables and a tab strip would push the content off-screen.
function SettingsNav({ tabs, active, onChange }) {
  const { t } = useTranslation('settings')
  const pageHeaderH = usePageHeaderHeight()
  const groups = []
  for (const tab of tabs) {
    const g = groups.find(x => x.name === tab.group)
    if (g) g.items.push(tab)
    else groups.push({ name: tab.group, label: tab.groupLabel, items: [tab] })
  }

  return (
    <>
      <div className="xl:hidden relative">
        <label htmlFor="settings-section" className="sr-only">{t('nav.section')}</label>
        <LuChevronDown size={16} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" />
        <select id="settings-section" className="form-select appearance-none pr-9 py-2.5 min-h-11 text-[14px] font-medium"
          value={active} onChange={e => onChange(e.target.value)}>
          {groups.map(g => (
            <optgroup key={g.name} label={g.label}>
              {g.items.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Sticks just under the page header bar, which is itself pinned to the
          top of #content (sticky offsets count from #content's padding edge,
          hence the - --content-pt). */}
      <nav aria-label={t('nav.sections')}
        style={{ top: `calc(${pageHeaderH}px - var(--content-pt) + 1rem)` }}
        className="hidden xl:flex flex-col gap-4 w-[196px] shrink-0 sticky -ml-2.5">
        {groups.map(g => (
          <div key={g.name}>
            <div className="t-label text-xs px-2.5 mb-1">{g.label}</div>
            <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
              {g.items.map(tab => {
                const isActive = tab.id === active
                const Icon = tab.icon
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => onChange(tab.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md border-none cursor-pointer text-left text-[13px] transition-colors duration-[140ms] ${
                        isActive
                          ? 'bg-[var(--gold-bg)] text-ink font-semibold'
                          : 'bg-transparent text-ink2 font-medium hover:bg-surface2 hover:text-ink'
                      }`}
                    >
                      <Icon size={15} aria-hidden className={isActive ? 'text-gold' : 'text-ink3'} />
                      {tab.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  )
}
