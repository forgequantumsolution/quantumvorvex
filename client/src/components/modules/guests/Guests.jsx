import { useState, useEffect, useCallback } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Formik, Form } from 'formik'
import { LuTrash2, LuUserCheck, LuCircleAlert, LuLogOut, LuUsers, LuRefreshCw, LuDownload, LuUserPlus } from 'react-icons/lu'
import { PageWrapper, StatCard, Card, DataTable, Pagination, EmptyState } from '../../ui-tw'
import ActionMenu from '../../ui-tw/ActionMenu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import CheckOutModal from '../checkout/CheckOutModal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import FormikField from '../../ui/FormikField'
import { useToast } from '../../../hooks/useToast'
import { useUiActions } from '../../../store/hooks'
import { guestsApi } from '../../../api/client'
import { guestEditSchema } from '../../../validation/guestSchema'
import { formatDate, formatCurrency, statusColor } from '../../../utils/format'

// tags/amenities/facilities are stored as JSON strings server-side.
function parseArr(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } }
  return []
}

// Map an API guest (with room/_count/invoices relations) to the flat shape the
// UI renders. Fields the API doesn't track (commLog) get safe defaults.
function normalizeGuest(g) {
  return {
    id: g.id,
    docId: g.docId,
    name: g.name,
    phone: g.phone,
    email: g.email || '',
    room: g.room?.number || '',
    roomId: g.roomId,
    stayType: g.stayType || 'daily',
    checkInDate: g.checkInDate,
    checkOutDate: g.checkOutDate,
    months: g.months,
    status: g.status,
    foodPlan: g.foodPlan || 'No Meals',
    tags: parseArr(g.tags),
    stayCount: g.stayCount || 1,
    idType: g.idType,
    idNumber: g.idNumber,
    documents: g._count?.documents ?? (Array.isArray(g.documents) ? g.documents.length : 0),
    amenities: parseArr(g.amenities),
    facilities: parseArr(g.facilities),
    nationality: g.nationality || '',
    address: g.address || '',
    advance: g.deposit || 0,
    billingHistory: (g.invoices || []).map((inv) => ({
      invoiceNo: inv.invoiceNo,
      period: inv.period,
      total: inv.total,
      status: inv.status,
      paidOn: inv.paidAt || null,
      method: inv.method || null,
    })),
    commLog: [],
  }
}

// Only these columns may be sent to PUT /guests/:id — the rest are UI-only.
function editPayload(values) {
  const payload = {
    name: values.name,
    phone: values.phone,
    email: values.email || null,
    stayType: values.stayType,
    foodPlan: values.foodPlan,
    status: values.status,
    tags: values.tags || [],
  }
  if (values.checkInDate) payload.checkInDate = values.checkInDate
  if (values.stayType === 'monthly') payload.months = Number(values.months) || 1
  else if (values.checkOutDate) payload.checkOutDate = values.checkOutDate
  return payload
}

const FOOD_PLANS = ['Breakfast Only', 'All Meals', 'Dinner Only', 'No Meals']
const GUEST_TAGS = ['VIP', 'Corporate', 'Long-term']
const GUEST_STATUSES = ['Active', 'Due', 'Checked Out']
const PROFILE_TABS = [
  { id: 'info',    labelKey: 'profile.tabs.info' },
  { id: 'billing', labelKey: 'profile.tabs.billing' },
  { id: 'comms',   labelKey: 'profile.tabs.comms' },
  { id: 'history', labelKey: 'profile.tabs.history' },
]

// Display labels for stored values (the values themselves stay English).
function useGuestLabels() {
  const { t } = useTranslation('guests')
  return {
    t,
    status: (s) => t(`status.${s}`, { defaultValue: s }),
    food: (p) => t(`foodPlan.${p}`, { defaultValue: p }),
    tag: (tag) => t(`tag.${tag}`, { defaultValue: tag }),
    stay: (type) => t(type === 'monthly' ? 'stayType.monthly' : 'stayType.daily'),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDueDate(guest) {
  if (guest.stayType === 'daily') return guest.checkOutDate
  if (guest.stayType === 'monthly' && guest.checkInDate && guest.months) {
    const d = new Date(guest.checkInDate)
    d.setMonth(d.getMonth() + guest.months)
    return d.toISOString().split('T')[0]
  }
  return null
}

function getTagClass(tag) {
  if (tag === 'VIP') return 'gtag gtag-vip'
  if (tag === 'Corporate') return 'gtag gtag-corp'
  if (tag === 'Long-term') return 'gtag gtag-long'
  return 'gtag gtag-long'
}

function exportGuestCSV(guests) {
  const headers = ['DOC ID', 'Name', 'Phone', 'Email', 'Room', 'Stay Type', 'Check-In', 'Check-Out/Due', 'Food Plan', 'Status', 'Tags', 'Stay Count']
  const rows = guests.map(g => [
    g.docId, g.name, g.phone, g.email || '', g.room,
    g.stayType === 'monthly' ? 'Monthly' : 'Daily',
    g.checkInDate, getDueDate(g) || '',
    g.foodPlan, g.status, g.tags.join('; '), g.stayCount,
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'guests.csv'; a.click()
  URL.revokeObjectURL(url)
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink3 uppercase tracking-[0.07em] mb-[3px]">{label}</div>
      <div className="t-sm break-words">{value || '—'}</div>
    </div>
  )
}

// Invoice history in the profile's Billing tab (cards on phones).
const billingColumns = (t) => [
  { key: 'invoiceNo', header: t('billing.invoice'), render: (b) => <span className="t-xs text-gold font-mono">{b.invoiceNo}</span> },
  { key: 'period', header: t('billing.period'), render: (b) => <span className="text-[12.5px] text-ink2">{b.period}</span> },
  { key: 'total', header: t('common:total'), primary: true, render: (b) => <span className="t-title font-mono">{formatCurrency(b.total)}</span> },
  {
    key: 'status', header: t('common:status'),
    render: (b) => <Badge type={b.status === 'Paid' ? 'green' : b.status === 'Overdue' ? 'red' : 'amber'}>{t(`invoiceStatus.${b.status}`, { defaultValue: b.status })}</Badge>,
  },
  { key: 'paidOn', header: t('billing.paidOn'), render: (b) => <span className="t-xs text-ink3">{b.paidOn ? formatDate(b.paidOn) : '—'}</span> },
  { key: 'method', header: t('billing.method'), render: (b) => <span className="t-xs text-ink2">{b.method || '—'}</span> },
]

// ─── Guest Profile Modal (tabbed) ────────────────────────────────────────────

function GuestProfileModal({ guest, onClose, onCheckout, onEdit }) {
  const L = useGuestLabels()
  const { t } = L
  const addToast = useToast()
  const [tab, setTab] = useState('info')
  const [comms, setComms] = useState([])
  const [commsLoading, setCommsLoading] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [commChannel, setCommChannel] = useState('note')
  const [commText, setCommText] = useState('')
  const [savingComm, setSavingComm] = useState(false)

  const guestId = guest?.id
  const loadComms = useCallback(() => {
    if (!guestId) return
    setCommsLoading(true)
    guestsApi.getCommunications(guestId)
      .then(res => setComms(res.data.communications || []))
      .catch(() => setComms([]))
      .finally(() => setCommsLoading(false))
  }, [guestId])

  // Fetch the communication log when the Communications tab is opened.
  useEffect(() => {
    if (tab === 'comms') loadComms()
  }, [tab, loadComms])

  async function handleLogComm() {
    if (!commText.trim()) return
    setSavingComm(true)
    try {
      await guestsApi.addCommunication(guestId, { channel: commChannel, content: commText.trim(), direction: 'outbound' })
      setCommText(''); setShowComposer(false)
      addToast(t('comms.logged'), 'success')
      loadComms()
    } catch (err) {
      addToast(err.response?.data?.message || t('comms.logFailed'), 'error')
    } finally {
      setSavingComm(false)
    }
  }

  if (!guest) return null
  const dueDate = getDueDate(guest)
  const totalSpend = guest.billingHistory.reduce((s, b) => s + b.total, 0)

  return (
    <Modal
      isOpen={!!guest}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="t-title w-9 h-9 rounded-full bg-gold flex items-center justify-center text-black shrink-0">
            {guest.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="t-h3 truncate">{guest.name}</div>
            <div className="text-xs text-gold font-normal font-mono">{guest.docId}</div>
          </div>
        </div>
      }
      size="lg"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t('common:close')}</button>
          {(guest.status === 'Active' || guest.status === 'Due') && (
            <button className="btn btn-danger btn-sm" onClick={() => onCheckout(guest)}>{t('actions.checkout')}</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => onEdit(guest)}>{t('actions.editGuestBtn')}</button>
        </>
      }
    >
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-4 sm:mb-[18px]">
        {[
          { id: 'room', label: t('common:room'), value: guest.room, mono: true },
          { id: 'stay', label: t('fields.stayType'), value: L.stay(guest.stayType) },
          { id: 'stays', label: t('profile.totalStays'), value: guest.stayCount },
          { id: 'spend', label: t('profile.lifetimeSpend'), value: formatCurrency(totalSpend), mono: true },
        ].map(item => (
          <div key={item.id} className="min-w-0 bg-surface2 rounded-lg px-3 py-2.5 border border-line">
            <div className="t-label mb-1">{item.label}</div>
            <div className={`t-title truncate ${item.mono ? 'font-mono' : ''}`}>{item.value || '—'}</div>
          </div>
        ))}
      </div>

      {/* Status + tags row */}
      <div className="flex items-center gap-2 mb-[18px] flex-wrap">
        <Badge type={statusColor(guest.status).replace('badge-', '')}>{L.status(guest.status)}</Badge>
        {guest.tags.map(tag => <span key={tag} className={getTagClass(tag)}>{L.tag(tag)}</span>)}
      </div>

      <Tabs tabs={PROFILE_TABS.map(pt => ({ id: pt.id, label: t(pt.labelKey) }))} active={tab} onChange={setTab} />

      <div className="mt-4">
        {/* ── Profile Tab ── */}
        {tab === 'info' && (
          <div>
            <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3.5 mb-4">
              <InfoRow label={t('common:phone')} value={guest.phone} />
              <InfoRow label={t('common:email')} value={guest.email} />
              <InfoRow label={t('profile.nationality')} value={guest.nationality} />
              <InfoRow label={t('profile.address')} value={guest.address} />
              <InfoRow label={t('profile.idType')} value={guest.idType} />
              <InfoRow label={t('profile.idNumber')} value={guest.idNumber} />
              <InfoRow label={t('fields.checkIn')} value={formatDate(guest.checkInDate)} />
              <InfoRow label={guest.stayType === 'monthly' ? t('profile.duration') : t('fields.checkOut')} value={guest.stayType === 'monthly' ? t('profile.months', { count: guest.months }) : formatDate(dueDate)} />
              <InfoRow label={t('fields.foodPlan')} value={L.food(guest.foodPlan)} />
              <InfoRow label={t('profile.advancePaid')} value={formatCurrency(guest.advance)} />
            </div>

            {guest.facilities.length > 0 && (
              <div className="mb-3.5">
                <div className="text-xs font-semibold text-ink3 uppercase tracking-[0.07em] mb-[7px]">{t('profile.facilities')}</div>
                <div className="flex gap-1.5 flex-wrap">
                  {guest.facilities.map(f => <span key={f} className="badge badge-grey">{f}</span>)}
                </div>
              </div>
            )}

            {guest.amenities.length > 0 && (
              <div className="mb-3.5">
                <div className="text-xs font-semibold text-ink3 uppercase tracking-[0.07em] mb-[7px]">{t('profile.extraAmenities')}</div>
                <div className="flex gap-1.5 flex-wrap">
                  {guest.amenities.map(a => <span key={a} className="badge badge-blue">{a}</span>)}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-xs font-semibold text-ink3 uppercase tracking-[0.07em]">{t('profile.documents')}</div>
              <Badge type={guest.documents >= 4 ? 'green' : guest.documents >= 2 ? 'amber' : 'red'}>
                {t('profile.docsUploaded', { count: guest.documents, total: 4 })}
              </Badge>
            </div>
          </div>
        )}

        {/* ── Billing Tab ── */}
        {tab === 'billing' && (
          <div>
            {guest.billingHistory.length === 0 ? (
              <div className="t-sm text-center py-8 text-ink3">{t('billing.empty')}</div>
            ) : (
              <div className="border border-line rounded-lg overflow-hidden">
                <DataTable columns={billingColumns(t)} rows={guest.billingHistory} rowKey={(b) => b.invoiceNo} />
              </div>
            )}
            <div className="mt-3.5 px-3.5 py-2.5 bg-[var(--gold-bg)] rounded-lg flex flex-wrap justify-between gap-x-3">
              <span className="t-title text-gold">{t('billing.totalLifetimeSpend')}</span>
              <span className="font-bold text-gold font-mono">{formatCurrency(totalSpend)}</span>
            </div>
          </div>
        )}

        {/* ── Communications Tab ── */}
        {tab === 'comms' && (
          <div>
            <div className="flex flex-col gap-2.5">
              {commsLoading ? (
                <div className="t-sm text-center py-8 text-ink3">{t('common:loading')}</div>
              ) : comms.length === 0 ? (
                <div className="t-sm text-center py-8 text-ink3">{t('comms.empty')}</div>
              ) : comms.map((c) => {
                const ch = (c.channel || 'note').toLowerCase()
                const icon = ch === 'whatsapp' ? '💬' : ch === 'sms' ? '📱' : ch === 'email' ? '✉️' : ch === 'call' ? '📞' : '📄'
                const bg = ch === 'whatsapp' ? 'var(--green-bg)' : ch === 'sms' ? 'var(--blue-bg)' : 'var(--gold-bg)'
                const color = ch === 'whatsapp' ? 'var(--green-text)' : ch === 'sms' ? 'var(--blue-text)' : 'var(--gold)'
                return (
                  <div key={c.id} className="flex items-start gap-3 px-3.5 py-3 bg-surface2 rounded-lg border border-line">
                    <div className="t-body w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: bg, color }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-ink mb-0.5 capitalize">
                        {t(`comms.channel.${ch}`, { defaultValue: c.channel })}{c.direction === 'inbound' ? ` · ${t('comms.received')}` : ''}
                      </div>
                      <div className="t-xs mb-1 break-words">{c.content}</div>
                      <div className="text-xs text-ink3">
                        {formatDate(c.createdAt)}{c.staff ? ` · ${c.staff}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {showComposer ? (
              <div className="mt-3.5 flex flex-col gap-2 p-3 bg-surface2 rounded-lg border border-line">
                <select className="form-input" value={commChannel} onChange={e => setCommChannel(e.target.value)}>
                  {['note', 'call', 'whatsapp', 'sms', 'email'].map(c => (
                    <option key={c} value={c}>{t(`comms.channel.${c}`)}</option>
                  ))}
                </select>
                <textarea
                  className="form-input min-h-[72px]"
                  placeholder={t('comms.placeholder')}
                  value={commText}
                  onChange={e => setCommText(e.target.value)}
                />
                <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                  <button className="btn btn-primary btn-sm" disabled={savingComm || !commText.trim()} onClick={handleLogComm}>
                    {savingComm ? t('common:saving') : t('common:save')}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setShowComposer(false); setCommText('') }}>{t('common:cancel')}</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-outline btn-sm mt-3.5 w-full sm:w-auto justify-center" onClick={() => setShowComposer(true)}>
                + {t('comms.log')}
              </button>
            )}
          </div>
        )}

        {/* ── Stay History Tab ── */}
        {tab === 'history' && (
          <div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: guest.stayCount }, (_, i) => {
                const isLatest = i === 0
                return (
                  <div key={i} className={`px-3.5 py-3 bg-surface2 rounded-lg border flex justify-between items-center gap-3 ${isLatest ? 'border-gold' : 'border-line'}`}>
                    <div>
                      <div className="t-title">
                        {t('history.stayNo', { n: guest.stayCount - i })} {isLatest && <span className="text-xs text-gold ml-1.5">{t('history.current')}</span>}
                      </div>
                      <div className="text-xs text-ink3 mt-[3px]">
                        {isLatest ? t('history.checkIn', { date: formatDate(guest.checkInDate) }) : t('history.monthsAgo', { count: 2 + i * 3 })}
                      </div>
                    </div>
                    <Badge type={isLatest ? (guest.status === 'Checked Out' ? 'grey' : 'green') : 'grey'}>
                      {isLatest ? L.status(guest.status) : L.status('Checked Out')}
                    </Badge>
                  </div>
                )
              })}
            </div>
            <div className="mt-3.5 px-3.5 py-2.5 bg-surface2 rounded-lg flex justify-between">
              <span className="text-[12.5px] text-ink2">
                {t('history.returning')} · {t('history.visits', { count: guest.stayCount })} · {guest.stayCount >= 5 ? `🥇 ${t('history.gold')}` : guest.stayCount >= 3 ? `🥈 ${t('history.silver')}` : `🥉 ${t('history.bronze')}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Edit Guest Modal ──────────────────────────────────────────────────────────

function EditGuestModal({ guest, onClose, onSave }) {
  const L = useGuestLabels()
  const { t } = L
  if (!guest) return null

  const initialValues = {
    ...guest,
    email: guest.email || '',
    tags: guest.tags || [],
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={guestEditSchema}
      enableReinitialize
      onSubmit={(values) => onSave(values)}
    >
      {({ values, setFieldValue, submitForm, isSubmitting }) => {
        const toggleTag = (tag) => {
          const tags = values.tags?.includes(tag)
            ? values.tags.filter(x => x !== tag)
            : [...(values.tags || []), tag]
          setFieldValue('tags', tags)
        }
        return (
          <Modal
            isOpen={!!guest}
            onClose={onClose}
            title={t('edit.title', { name: guest.name })}
            maxWidth="580px"
            footer={
              <>
                <button className="btn btn-outline btn-sm" onClick={onClose}>{t('common:cancel')}</button>
                <button className="btn btn-primary btn-sm" onClick={submitForm} disabled={isSubmitting}>
                  {t('common:saveChanges')}
                </button>
              </>
            }
          >
            <Form className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormikField name="name" label={t('common:name')} required />
              <FormikField name="phone" label={t('common:phone')} required />
              <FormikField name="email" label={t('common:email')} type="email" />
              <FormikField name="room" label={t('common:room')} required />
              <FormikField name="stayType" label={t('fields.stayType')} as="select">
                <option value="daily">{t('stayType.daily')}</option>
                <option value="monthly">{t('stayType.monthly')}</option>
              </FormikField>
              <FormikField name="checkInDate" label={t('fields.checkInDate')} required type="date" />
              {values.stayType === 'monthly'
                ? <FormikField name="months" label={t('fields.months')} required type="number" min="1" />
                : <FormikField name="checkOutDate" label={t('fields.checkOutDate')} required type="date" />}
              <FormikField name="foodPlan" label={t('fields.foodPlan')} as="select">
                {FOOD_PLANS.map(p => <option key={p} value={p}>{L.food(p)}</option>)}
              </FormikField>
              <FormikField name="status" label={t('common:status')} as="select">
                {GUEST_STATUSES.map(s => <option key={s} value={s}>{L.status(s)}</option>)}
              </FormikField>
            </Form>
            <div className="mt-3.5">
              <label className="form-label block mb-[7px]">{t('fields.tags')}</label>
              <div className="flex gap-2 flex-wrap">
                {GUEST_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    aria-pressed={!!values.tags?.includes(tag)}
                    className={`${getTagClass(tag)} cursor-pointer pointer-coarse:min-h-11 pointer-coarse:px-4 ${values.tags?.includes(tag) ? '' : 'opacity-40'}`}
                    style={{ border: values.tags?.includes(tag) ? undefined : '1px dashed var(--border2)' }}>
                    {L.tag(tag)}
                  </button>
                ))}
              </div>
            </div>
          </Modal>
        )
      }}
    </Formik>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function Guests() {
  const L = useGuestLabels()
  const { t } = L
  const addToast = useToast()
  const { navigateTo } = useUiActions()

  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stayFilter, setStayFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  // Full-dataset counts for the summary cards (independent of search/filter/page).
  const [stats, setStats] = useState({ total: 0, active: 0, due: 0, checkedOut: 0 })

  const [profileGuest,  setProfileGuest]  = useState(null)
  const [checkoutGuest, setCheckoutGuest] = useState(null)
  const [checkoutBill,  setCheckoutBill]  = useState(null)
  const [editGuest,     setEditGuest]     = useState(null)
  const [deleteGuest,   setDeleteGuest]   = useState(null)
  const [deleting,      setDeleting]      = useState(false)

  // Query params shared by the list fetch and the "export all" action.
  const listParams = useCallback((extra = {}) => ({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'All' ? statusFilter : undefined,
    stayType: stayFilter !== 'All' ? stayFilter.toLowerCase() : undefined,
    ...extra,
  }), [debouncedSearch, statusFilter, stayFilter])

  // Debounce the search box; a new query resets to the first page.
  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [search])

  // Server-driven list: search, status/stay filters and pagination all run on
  // the backend, so we only ever hold one page in memory.
  const loadList = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await guestsApi.getAll(listParams({ page, pageSize: PAGE_SIZE }))
      setGuests((data.guests || []).map(normalizeGuest))
      setTotal(data.total ?? 0)
    } catch {
      setError(t('errors.load'))
    } finally {
      setLoading(false)
    }
  }, [listParams, page, t])

  const loadStats = useCallback(async () => {
    try {
      const { data } = await guestsApi.getStats()
      setStats({ total: data.total || 0, active: data.active || 0, due: data.due || 0, checkedOut: data.checkedOut || 0 })
    } catch { /* non-critical; the list error banner covers outages */ }
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadStats() }, [loadStats])

  // A mutation can change a guest's status (and which filter/page it lands in),
  // so reload the page and the counts rather than patching in place.
  const reload = useCallback(() => { loadList(); loadStats() }, [loadList, loadStats])

  const handleStayChange   = (v) => { setStayFilter(v); setPage(1) }
  const handleStatusChange = (v) => { setStatusFilter(v); setPage(1) }

  // Export every guest matching the current filters (not just the visible page).
  const handleExportCSV = async () => {
    try {
      const { data } = await guestsApi.getAll(listParams())
      exportGuestCSV((data.guests || []).map(normalizeGuest))
    } catch {
      addToast(t('toast.exportFailed'), 'error')
    }
  }

  const handleCheckoutConfirm = async ({ notes, paymentMethod, paymentReference, finalPayment, extra, proofFile, photoFile }) => {
    const guest = checkoutGuest
    if (!guest) return
    try {
      // Attach the payment screenshot and check-out photo first so a failed
      // upload aborts the check-out (labels stay aligned with the file order).
      const attachments = []
      if (proofFile) attachments.push(['payment_proof', proofFile])
      if (photoFile) attachments.push(['checkout_photo', photoFile])
      if (attachments.length) {
        const form = new FormData()
        attachments.forEach(([, file]) => form.append('documents', file))
        form.append('docTypes', JSON.stringify(attachments.map(([label]) => label)))
        await guestsApi.uploadDocuments(guest.id, form)
      }
      await guestsApi.checkout(guest.id, {
        notes,
        paymentMethod,
        paymentReference,
        finalPayment,
        extraCharges: Number(extra) || 0,
      })
      setCheckoutGuest(null)
      setCheckoutBill(null)
      addToast(t('toast.checkedOut', { name: guest.name }), 'success')
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.checkoutFailed'), 'error')
    }
  }

  const handleRenew = async (guest) => {
    try {
      // Monthly stays extend by one month; daily stays push checkout out a day.
      const payload = guest.stayType === 'monthly'
        ? { months: 1 }
        : { checkOutDate: new Date(Date.now() + 86400000).toISOString() }
      await guestsApi.renew(guest.id, payload)
      addToast(t('toast.renewed', { name: guest.name }), 'success')
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.renewFailed'), 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteGuest) return
    setDeleting(true)
    try {
      await guestsApi.delete(deleteGuest.id)
      addToast(t('toast.deleted', { name: deleteGuest.name }), 'success')
      setDeleteGuest(null)
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.deleteFailed'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditSave = async (updated) => {
    try {
      await guestsApi.update(updated.id, editPayload(updated))
      setEditGuest(null)
      addToast(t('toast.updated'), 'success')
      reload()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.updateFailed'), 'error')
    }
  }

  // Open the profile with list data immediately, then enrich with detail
  // (documents + invoices) from GET /guests/:id.
  const openProfile = async (guest) => {
    setProfileGuest(guest)
    try {
      const { data } = await guestsApi.getOne(guest.id)
      if (data.guest) setProfileGuest(normalizeGuest(data.guest))
    } catch { /* keep list-level data */ }
  }

  // Open the check-out modal and load the real bill from the backend so the
  // figures shown match what the server will actually charge.
  const openCheckout = async (guest) => {
    setProfileGuest(null)
    setCheckoutBill(null)
    setCheckoutGuest(guest)
    try {
      const { data } = await guestsApi.checkoutPreview(guest.id)
      setCheckoutBill(data.bill)
    } catch (err) {
      setCheckoutGuest(null)
      addToast(err.response?.data?.message || t('toast.billFailed'), 'error')
    }
  }
  const closeCheckout = () => { setCheckoutGuest(null); setCheckoutBill(null) }
  const openEdit     = (guest) => { setProfileGuest(null); setEditGuest(guest) }

  const columns = [
    {
      // Wraps in table mode (tags drop under the name) so the row fits at 1280.
      key: 'guest', header: t('common:guest'), primary: true, className: 'whitespace-normal min-w-[180px] max-w-[240px]',
      render: (guest) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
            <span className="font-semibold text-ink truncate">{guest.name}</span>
            {guest.tags.map(tag => <span key={tag} className={`${getTagClass(tag)} shrink-0`}>{L.tag(tag)}</span>)}
          </div>
          <div className="text-xs text-ink3 mt-px whitespace-nowrap">
            <span className="text-gold font-mono">{guest.docId}</span> · {guest.phone}
          </div>
        </div>
      ),
    },
    { key: 'room', header: t('common:room'), render: (guest) => <span className="font-semibold font-mono">{guest.room || '—'}</span> },
    {
      key: 'type', header: t('col.typeStays'), mobileLabel: t('col.typeStays'),
      render: (guest) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Badge type={guest.stayType === 'monthly' ? 'purple' : 'blue'}>{L.stay(guest.stayType)}</Badge>
          <span className="text-xs text-ink3" title={t('profile.totalStays')}><span className="t-title font-mono text-ink">{guest.stayCount}</span> {t('col.staysWord', { count: guest.stayCount })}</span>
        </div>
      ),
    },
    {
      key: 'stay', header: t('col.checkInDue'), className: 'md:min-w-[120px]', mobileLabel: t('col.checkInDue'),
      render: (guest) => (
        <span className="block text-[12.5px] leading-snug">
          {formatDate(guest.checkInDate)}<span className="text-ink3"> → </span><br className="hidden xl:inline" />{formatDate(getDueDate(guest))}
        </span>
      ),
    },
    { key: 'food', header: t('fields.foodPlan'), className: 'whitespace-normal min-w-[90px]', render: (guest) => <span className="t-xs">{L.food(guest.foodPlan)}</span> },
    {
      key: 'status', header: t('common:status'), primary: true,
      render: (guest) => <Badge type={statusColor(guest.status).replace('badge-', '')}>{L.status(guest.status)}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (guest) => {
        const canCheckout = guest.status === 'Active' || guest.status === 'Due'
        return (
          // Rows open the profile; the buttons here must not.
          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
            {canCheckout
              ? <button className="btn btn-danger btn-sm" onClick={() => openCheckout(guest)}>{t('actions.checkout')}</button>
              : <button className="btn btn-outline btn-sm" onClick={() => openProfile(guest)}>{t('common:view')}</button>}
            {guest.status === 'Due' && (
              <button className="btn btn-sm bg-success-bg text-success-text" onClick={() => handleRenew(guest)}>{t('actions.renew')}</button>
            )}
            <ActionMenu
              items={[
                canCheckout && { label: t('actions.viewProfile'), icon: '◉', onClick: () => openProfile(guest) },
                { label: t('actions.editGuest'), icon: '✎', onClick: () => openEdit(guest) },
                { label: t('actions.deleteGuest'), icon: <LuTrash2 size={14} />, danger: true, onClick: () => setDeleteGuest(guest) },
              ]}
            />
          </div>
        )
      },
    },
  ]

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      search={{ value: search, onChange: setSearch, placeholder: t('searchPlaceholder') }}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: reload },
        { id: 'export', label: t('common:exportCsv'), icon: <LuDownload />, onClick: handleExportCSV },
        { id: 'checkin', label: t('actions.checkIn'), icon: <LuUserPlus />, variant: 'primary', onClick: () => navigateTo({ panel: 'bookings', params: { tab: 'Upcoming' } }) },
      ]}
      stats={
        <>
          <StatCard icon={<LuUserCheck />} tone="green" label={t('stats.active')} value={stats.active} />
          <StatCard icon={<LuCircleAlert />} tone="amber" label={t('stats.due')} value={stats.due} />
          <StatCard icon={<LuLogOut />} tone="grey" label={t('stats.checkedOut')} value={stats.checkedOut} />
          <StatCard icon={<LuUsers />} tone="blue" label={t('stats.total')} value={stats.total} />
        </>
      }
    >
      {error && (
        <div className="t-sm mb-4 px-3.5 py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      <Card>
        {/* Filters: the two selects side by side */}
        <div className="grid grid-cols-2 sm:flex gap-2.5 px-4 sm:px-5 py-3 border-b border-line">
          <select aria-label={t('fields.stayType')} className="form-select w-full sm:w-[140px]" value={stayFilter} onChange={e => handleStayChange(e.target.value)}>
            <option value="All">{t('filter.allStays')}</option><option value="Daily">{t('stayType.daily')}</option><option value="Monthly">{t('stayType.monthly')}</option>
          </select>
          <select aria-label={t('common:status')} className="form-select w-full sm:w-[150px]" value={statusFilter} onChange={e => handleStatusChange(e.target.value)}>
            <option value="All">{t('filter.allStatuses')}</option>
            {GUEST_STATUSES.map(s => <option key={s} value={s}>{L.status(s)}</option>)}
          </select>
        </div>

        <DataTable
          columns={columns}
          rows={guests}
          tableFrom="xl"
          onRowClick={openProfile}
          empty={<EmptyState icon="◉" title={loading ? t('empty.loading') : t('empty.title')} />}
        />

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} disabled={loading} onChange={setPage} />
      </Card>

      {/* Modals */}
      <GuestProfileModal guest={profileGuest} onClose={() => setProfileGuest(null)} onCheckout={openCheckout} onEdit={openEdit} />
      {checkoutGuest && checkoutBill && (
        <CheckOutModal
          key={checkoutGuest.id}
          isOpen
          guestName={checkoutGuest.name}
          folio={checkoutGuest.docId}
          room={checkoutGuest.room}
          stayPeriod={`${formatDate(checkoutGuest.checkInDate)} → ${formatDate(getDueDate(checkoutGuest))}`}
          lineItems={[[t('checkout.roomRent'), checkoutBill.rent], [t('fields.foodPlan'), checkoutBill.food], [t('checkout.amenities'), checkoutBill.amenities], [`GST (${checkoutBill.gstRate}%)`, checkoutBill.gst]]}
          advance={checkoutBill.advance}
          balanceDue={checkoutBill.balanceDue}
          allowExtraCharges
          allowPartialPayment
          onClose={closeCheckout}
          onConfirm={handleCheckoutConfirm}
        />
      )}
      <EditGuestModal guest={editGuest} onClose={() => setEditGuest(null)} onSave={handleEditSave} />
      <ConfirmModal
        isOpen={!!deleteGuest}
        onClose={() => setDeleteGuest(null)}
        onConfirm={handleDeleteConfirm}
        title={t('delete.title')}
        message={deleteGuest ? (
          <Trans t={t} i18nKey="delete.message" values={{ name: deleteGuest.name, docId: deleteGuest.docId }} components={{ b: <b /> }} />
        ) : null}
        confirmLabel={t('common:delete')}
        danger
        busy={deleting}
      />
    </PageWrapper>
  )
}
