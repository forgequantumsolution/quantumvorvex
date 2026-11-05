import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { LuTrash2, LuUsers, LuFileCheck, LuFileClock, LuFileX, LuRefreshCw } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import {
  PageWrapper, StatCard, Card, DataTable, Pagination,
  Button, EmptyState,
} from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { documentsApi } from '../../../api/client'
import { appLocale } from '../../../i18n'

// Map an API guest (with documents[] + _count) to the row shape the UI renders.
function normalizeDocGuest(g) {
  const documents = g.documents || []
  const uploaded = g._count?.documents ?? documents.length
  return {
    id: g.id,
    docId: g.docId,
    guestName: g.name,
    // Pre-check-in bookings come back as `booking:<id>` rows; they have no Guest
    // record yet, which is what the Type filter separates on.
    isBooking: String(g.id).startsWith('booking:'),
    // Server sort key (newest of created / last upload) — kept so the client can
    // re-sort without a refetch.
    lastActivityAt: g.lastActivityAt || null,
    room: g.room?.number || '—',
    idType: g.idType || '—',
    idNumber: g.idNumber || '—',
    documents,
    uploaded,
    photo: guestPhotoOf(documents),
    verified: documents.length > 0 && documents.every((d) => d.verified),
  }
}

// `label` is matched against stored docTypes, so it stays English; the screen
// shows t(`docType.${key}`).
const DOC_SLOTS = [
  { key: 'idFront', label: 'ID Front', icon: '🪪' },
  { key: 'idBack', label: 'ID Back', icon: '🪪' },
  { key: 'guestPhoto', label: 'Guest Photo', icon: '📷' },
  { key: 'additional', label: 'Additional Doc', icon: '📄' },
]

const MAX_DOCUMENTS = 4

// Rows per page. Small on purpose: a KYC row is two lines tall, and the desk
// scans this table rather than reading it top to bottom.
const PAGE_SIZE = 8

// docTypes are inconsistent across sources (slot keys like `idFront`, booking
// labels like `ID Front`, seed values like `Photo`). Normalise to alphanumerics
// so an existing doc can be matched back to the slot it fills.
const normDocType = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Machine-written docTypes (camera captures, check-out proof) would otherwise
// show up raw as "guest_photo". Booking-time labels like "Aadhaar — Front" are
// already readable and fall through unchanged.
const DOC_LABELS = {
  idfront: 'idFront',
  idback: 'idBack',
  guestphoto: 'guestPhoto',
  photo: 'guestPhoto',
  checkoutphoto: 'checkoutPhoto',
  paymentproof: 'paymentProof',
  additional: 'additional',
}
const prettyDocType = (s, t) => {
  const key = DOC_LABELS[normDocType(s)]
  return key ? t(`docType.${key}`) : s || t('docType.document')
}

const isImageUrl = (url) => /\.(jpe?g|png|webp|gif|avif)$/i.test(url || '')

// The photo captured after booking; used as the row avatar in the table.
const guestPhotoOf = (documents = []) =>
  documents.find((d) => normDocType(d.docType) === 'guestphoto' && isImageUrl(d.url)) || null

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verification is about sign-off, not completeness — how many of the 4 slots are
 * filled is already its own column. The old rule required exactly 4 files before
 * a row could ever read "Verified", so a guest whose two scans were both signed
 * off still showed as "Incomplete" and the page reported zero verified.
 */
// Display label: t(`verification.${key}`).
function getVerificationStatus(doc) {
  if (!doc.uploaded) return { key: 'incomplete', type: 'red' }
  if (doc.verified) return { key: 'verified', type: 'green' }
  return { key: 'pending', type: 'amber' }
}

function getUploadBadgeType(uploaded) {
  if (uploaded >= 4) return 'green'
  if (uploaded >= 2) return 'amber'
  return 'red'
}

// ─── Upload Documents Modal ───────────────────────────────────────────────────

function UploadModal({ doc, onClose, onSave }) {
  const { t } = useTranslation('documents')
  const [files, setFiles] = useState({ idFront: null, idBack: null, guestPhoto: null, additional: null })
  if (!doc) return null

  // Which slots are already filled by an existing document (matched by docType),
  // and how many more uploads are allowed before hitting the cap.
  const existingTypes = new Set((doc.documents || []).map((d) => normDocType(d.docType)))
  const isSlotFilled = (slot) =>
    existingTypes.has(normDocType(slot.key)) || existingTypes.has(normDocType(slot.label))
  const remaining = Math.max(0, MAX_DOCUMENTS - doc.uploaded)
  const newUploadCount = Object.values(files).filter(Boolean).length
  // An empty slot is locked once we've already queued as many files as remain.
  const slotLocked = (slot) =>
    isSlotFilled(slot) || (!files[slot.key] && newUploadCount >= remaining)

  const handleDrop = (key, slot, e) => {
    e.preventDefault()
    if (slotLocked(slot)) return
    const file = e.dataTransfer.files[0]
    if (file) setFiles(f => ({ ...f, [key]: file }))
  }

  const handleFileInput = (key, e) => {
    const file = e.target.files[0]
    if (file) setFiles(f => ({ ...f, [key]: file }))
  }

  const handleDragOver = (e) => e.preventDefault()

  return (
    <Modal
      isOpen={!!doc}
      onClose={onClose}
      title={
        <span>
          {t('upload.title')} —{' '}
          <span className="text-gold font-normal text-[12px] font-mono">
            {doc.docId}
          </span>
        </span>
      }
      maxWidth="560px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t('common:cancel')}</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onSave(doc, files)}
            disabled={newUploadCount === 0}
          >
            {t('upload.save')}
          </button>
        </>
      }
    >
      {/* Guest info */}
      <div className="bg-surface2 rounded-lg px-3.5 py-2.5 mb-4 flex flex-wrap gap-x-4 gap-y-2">
        <div className="min-w-0 basis-full min-[400px]:basis-auto">
          <div className="form-label mb-0.5">{t('common:guest')}</div>
          <div className="t-title break-words">{doc.guestName}</div>
        </div>
        <div>
          <div className="form-label mb-0.5">{t('common:room')}</div>
          <div className="font-semibold text-[13px] font-mono">{doc.room}</div>
        </div>
        <div>
          <div className="form-label mb-0.5">{t('upload.uploaded')}</div>
          <Badge type={getUploadBadgeType(doc.uploaded)}>{doc.uploaded} / 4</Badge>
        </div>
      </div>

      {/* Upload zones */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {DOC_SLOTS.map(slot => {
          const filled = isSlotFilled(slot)
          const locked = slotLocked(slot)
          return (
            <div key={slot.key} className="min-w-0">
              <label className="form-label block mb-1.5 truncate">
                {slot.icon} {t(`docType.${slot.key}`)}
              </label>
              <div
                className={`upload-zone${files[slot.key] ? ' dragover' : ''} min-h-[88px] px-2 flex flex-col items-center justify-center gap-1.5${locked ? ' opacity-50 cursor-not-allowed' : ''}`}
                onDrop={e => handleDrop(slot.key, slot, e)}
                onDragOver={handleDragOver}
                onClick={() => { if (!locked) document.getElementById(`file-${slot.key}`).click() }}
              >
                {filled ? (
                  <>
                    <div className="text-[20px]">✓</div>
                    <div className="text-xs text-ink3 font-semibold text-center">
                      {t('upload.alreadyUploaded')}
                    </div>
                  </>
                ) : files[slot.key] ? (
                  <>
                    <div className="text-[20px]">✓</div>
                    <div className="text-xs text-success-text font-semibold break-all text-center line-clamp-2">
                      {files[slot.key].name}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[22px] text-ink3">+</div>
                    <div className="text-xs text-ink3 text-center">
                      {locked ? t('upload.limitReached') : <><span className="pointer-coarse:hidden">{t('upload.clickOrDrop')}</span><span className="hidden pointer-coarse:inline">{t('upload.tapToAdd')}</span></>}
                    </div>
                  </>
                )}
                <input
                  id={`file-${slot.key}`}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  disabled={locked}
                  onChange={e => handleFileInput(slot.key, e)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {remaining === 0 ? (
        <div className="notif mt-[14px] bg-surface2 text-ink3 text-[12.5px]">
          {t('upload.allFilled', { max: MAX_DOCUMENTS })}
        </div>
      ) : newUploadCount > 0 && (
        <div className="notif notif-success mt-[14px] bg-success-bg text-[12.5px]">
          {t('upload.ready', { count: newUploadCount })} · {t('upload.slotsLeft', { count: remaining - newUploadCount })}
        </div>
      )}
    </Modal>
  )
}

// ─── View Docs Modal ──────────────────────────────────────────────────────────

/**
 * One document tile: the file preview above its label and actions. Falls back to
 * a placeholder for PDFs and for images whose file is missing on disk (seeded
 * demo rows point at files that were never shipped), so a dead link never
 * renders as a broken image.
 */
function DocCard({ d, guestName, onDelete }) {
  const { t } = useTranslation('documents')
  const [failed, setFailed] = useState(false)
  const showImage = d.image && !failed

  return (
    <div className="rounded-lg border border-line bg-surface2 overflow-hidden flex flex-col">
      <a
        href={d.url}
        target="_blank"
        rel="noreferrer"
        title={t('view.openFull')}
        className="h-[150px] sm:h-[168px] bg-surface flex items-center justify-center overflow-hidden"
      >
        {showImage ? (
          <img
            src={d.url}
            alt={d.label}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center px-3">
            <div className="text-[26px] leading-none mb-1">{d.image ? '🖼' : '📄'}</div>
            <div className="text-xs text-ink3">
              {d.image ? t('view.previewUnavailable') : t('view.openDocument')}
            </div>
          </div>
        )}
      </a>

      <div className="px-3 py-2.5 border-t border-line flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="t-title truncate">{d.label}</div>
          <div className="text-xs text-ink3">{t('view.uploadedOn', { date: d.uploadDate })}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge type={d.verified ? 'green' : 'amber'}>{d.verified ? '✓' : t('verification.pending')}</Badge>
          <button
            className="btn btn-danger btn-xs inline-flex items-center"
            title={t('view.deleteDocument')}
            aria-label={t('view.deleteDocument')}
            onClick={() => onDelete({ id: d.key, label: d.label, guestName })}
          >
            <LuTrash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ViewDocsModal({ doc, onClose, onVerify, onDelete }) {
  const { t } = useTranslation('documents')
  if (!doc) return null

  const docList = (doc.documents || []).map((d) => ({
    key: d.id,
    label: prettyDocType(d.docType, t),
    image: isImageUrl(d.url),
    url: d.url,
    uploadDate: d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString(appLocale()) : '—',
    verified: d.verified,
  }))
  const allVerified = docList.length > 0 && docList.every((d) => d.verified)

  return (
    <Modal
      isOpen={!!doc}
      onClose={onClose}
      title={
        <span>
          {t('view.title')} —{' '}
          <span className="text-gold font-normal text-[12px] font-mono">
            {doc.docId}
          </span>
        </span>
      }
      maxWidth="720px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t('common:close')}</button>
          {docList.length > 0 && !allVerified && (
            <button className="btn btn-primary btn-sm" onClick={() => onVerify(doc)}>
              {t('view.verifyAll')}
            </button>
          )}
        </>
      }
    >
      {/* Guest summary */}
      <div className="bg-surface2 rounded-lg px-3.5 py-2.5 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="t-title mb-0.5">{doc.guestName}</div>
          <div className="t-xs text-ink3 break-words">
            {t('roomNo', { room: doc.room })} &middot; {doc.idType} &middot; {doc.idNumber}
          </div>
        </div>
        <Badge type={getUploadBadgeType(docList.length)}>
          {t('filesCount', { count: docList.length })}
        </Badge>
      </div>

      {/* Every uploaded file — ID front/back, PAN, passport, guest and
          check-out photos — previewed together. */}
      {docList.length === 0 ? (
        <div className="empty-state p-6">{t('view.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {docList.map((d) => (
            <DocCard key={d.key} d={d} guestName={doc.guestName} onDelete={onDelete} />
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Documents() {
  const { t } = useTranslation('documents')
  const addToast = useToast()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')   // all | verified | pending | incomplete
  const [typeFilter, setTypeFilter] = useState('all')       // all | bookings | guests
  const [page, setPage] = useState(1)
  const [uploadDoc, setUploadDoc] = useState(null)
  const [viewDoc, setViewDoc] = useState(null)
  const [deleteDocTarget, setDeleteDocTarget] = useState(null)   // single document { id, label, guestName }
  const [deletingDoc, setDeletingDoc] = useState(false)
  const [deleteRowTarget, setDeleteRowTarget] = useState(null)   // guest row (delete all its documents)
  const [deletingRow, setDeletingRow] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await documentsApi.getAll()
      setDocs((data.guests || []).map(normalizeDocGuest))
    } catch {
      setError(t('errors.load'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return docs
      .filter((d) => {
        if (q && !`${d.guestName} ${d.docId}`.toLowerCase().includes(q)) return false
        if (typeFilter === 'bookings' && !d.isBooking) return false
        if (typeFilter === 'guests' && d.isBooking) return false
        if (statusFilter !== 'all' && getVerificationStatus(d).key !== statusFilter) return false
        return true
      })
      // The API already sorts newest-first; re-sort so a row whose documents were
      // just added or deleted stays in the right place between refetches.
      .sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0))
  }, [docs, search, statusFilter, typeFilter])

  const filtersActive = !!search.trim() || statusFilter !== 'all' || typeFilter !== 'all'

  // Clamp rather than reset: deleting the last row of page 3 should land on
  // page 2, not throw the user back to the top of the list.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // A narrowed filter can leave the current page out of range.
  useEffect(() => { setPage(1) }, [search, statusFilter, typeFilter])

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setTypeFilter('all') }

  // Stats, counted with the same rule the row badge uses — otherwise the header
  // can claim "12 verified" while every row on screen reads "Incomplete".
  const totalGuests = docs.length
  const countBy = (key) => docs.filter((d) => getVerificationStatus(d).key === key).length
  const verifiedCount = countBy('verified')
  const pendingCount = countBy('pending')
  const incompleteCount = countBy('incomplete')

  const handleUploadSave = async (doc, files) => {
    const selected = Object.entries(files).filter(([, file]) => file)
    if (selected.length === 0) return
    try {
      for (const [docType, file] of selected) {
        const form = new FormData()
        form.append('document', file)
        form.append('docType', docType)
        await documentsApi.upload(doc.id, form)
      }
      setUploadDoc(null)
      addToast(t('toast.uploaded', { name: doc.guestName }), 'success')
      load()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.uploadFailed'), 'error')
    }
  }

  const verifyAll = async (doc) => {
    const pending = (doc.documents || []).filter(d => !d.verified)
    if (pending.length === 0) { addToast(t('toast.nothingToVerify'), 'info'); return false }
    await Promise.all(pending.map(d => documentsApi.verify(d.id)))
    addToast(t('toast.verified', { name: doc.guestName }), 'success')
    load()
    return true
  }

  const handleVerify = async (doc) => {
    try { if (await verifyAll(doc)) setViewDoc(null) }
    catch { addToast(t('toast.verifyFailed'), 'error') }
  }

  const handleQuickVerify = async (doc) => {
    try { await verifyAll(doc) }
    catch { addToast(t('toast.verifyFailed'), 'error') }
  }

  const handleDeleteDoc = async () => {
    if (!deleteDocTarget) return
    setDeletingDoc(true)
    try {
      await documentsApi.delete(deleteDocTarget.id)
      addToast(t('toast.docDeleted'), 'success')
      // Drop it from the open View modal immediately, then refresh the table.
      setViewDoc((v) => v ? { ...v, documents: (v.documents || []).filter((d) => d.id !== deleteDocTarget.id) } : v)
      setDeleteDocTarget(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.docDeleteFailed'), 'error')
    } finally {
      setDeletingDoc(false)
    }
  }

  const handleDeleteRow = async () => {
    if (!deleteRowTarget) return
    setDeletingRow(true)
    try {
      await Promise.all((deleteRowTarget.documents || []).map((d) => documentsApi.delete(d.id)))
      addToast(t('toast.allDeleted', { name: deleteRowTarget.guestName }), 'success')
      setDeleteRowTarget(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.allDeleteFailed'), 'error')
    } finally {
      setDeletingRow(false)
    }
  }

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      search={{ value: search, onChange: setSearch, placeholder: t('searchPlaceholder') }}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: load },
      ]}
      stats={
        <>
          <StatCard icon={<LuUsers />} tone="blue"  label={t('stats.total')} value={totalGuests} />
          <StatCard icon={<LuFileCheck />} tone="green" label={t('verification.verified')} value={verifiedCount}   hint={t('stats.verifiedHint')} />
          <StatCard icon={<LuFileClock />} tone="amber" label={t('verification.pending')}  value={pendingCount}    hint={t('stats.pendingHint')} />
          <StatCard icon={<LuFileX />} tone="red"   label={t('verification.incomplete')} value={incompleteCount} hint={t('stats.incompleteHint')} />
        </>
      }
    >
      {error && (
        <div className="text-sm mb-4 px-3.5 py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      <Card
        title={t('card.title')}
        subtitle={filtersActive ? t('card.matching', { count: filtered.length }) : t('card.records', { count: filtered.length })}
        actions={filtersActive && <Button variant="ghost" size="sm" onClick={clearFilters}>{t('clearFilters')}</Button>}
      >
        {/* Filters (the search box lives in the page header): the two selects
            side by side on phones; one row from lg up. */}
        <div className="grid grid-cols-2 lg:flex lg:items-center gap-2 px-4 sm:px-5 py-3 border-b border-line">
          <select
            className="form-select w-full lg:w-auto min-w-0 lg:min-w-[150px] py-2 text-[13px] pointer-coarse:min-h-11 focus:ring-gold/20 focus:border-gold"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label={t('filter.typeLabel')}
          >
            <option value="all">{t('filter.allTypes')}</option>
            <option value="bookings">{t('filter.bookings')}</option>
            <option value="guests">{t('filter.guests')}</option>
          </select>
          <select
            className="form-select w-full lg:w-auto min-w-0 lg:min-w-[150px] py-2 text-[13px] pointer-coarse:min-h-11 focus:ring-gold/20 focus:border-gold"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('filter.statusLabel')}
          >
            <option value="all">{t('filter.allStatuses')}</option>
            <option value="verified">{t('verification.verified')}</option>
            <option value="pending">{t('verification.pending')}</option>
            <option value="incomplete">{t('verification.incomplete')}</option>
          </select>
        </div>

        <DataTable
          rows={pageRows}
          rowKey={(d) => d.id}
          empty={
            <EmptyState
              icon="🗂"
              title={loading ? t('empty.loading') : filtersActive ? t('empty.filteredTitle') : t('empty.title')}
              message={
                loading
                  ? undefined
                  : filtersActive
                    ? t('empty.filteredMessage')
                    : t('empty.message')
              }
            />
          }
          columns={[
            {
              key: 'docId',
              header: t('col.docId'),
              hideBelow: '2xl',
              render: (doc) => (
                <div>
                  <span className="text-gold text-[12px] font-semibold font-mono">{doc.docId}</span>
                  <div className="text-xs text-ink3 mt-0.5">
                    {doc.isBooking ? t('kind.booking') : t('kind.guest')}
                  </div>
                </div>
              ),
            },
            {
              key: 'guest',
              header: t('common:guest'),
              primary: true,
              render: (doc) => (
                <div className="flex items-center gap-3 min-w-0">
                  {doc.photo ? (
                    <button
                      type="button"
                      title={t('col.viewDocuments')}
                      onClick={() => setViewDoc(doc)}
                      className="shrink-0 w-9 h-9 rounded-full overflow-hidden border border-line hover:border-gold"
                    >
                      <img src={doc.photo.url} alt={doc.guestName} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <span
                      className="shrink-0 w-9 h-9 rounded-full bg-surface2 border border-line flex items-center justify-center text-[13px] text-ink3"
                      title={t('col.noPhoto')}
                    >
                      {(doc.guestName || '?').trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 md:max-w-[14rem] 2xl:max-w-[18rem]">
                    <div className="font-medium text-ink truncate">{doc.guestName}</div>
                    <div className="text-xs text-ink3 mt-px">{t('roomNo', { room: doc.room })}</div>
                    {/* Tablet/laptop table: the Doc ID and Identification columns
                        are folded in here until there's room for them (2xl);
                        phone cards list them as separate fields. */}
                    <div className="hidden md:block 2xl:hidden text-xs text-ink3 mt-0.5">
                      <div className="truncate">
                        <span className="text-gold font-semibold font-mono">{doc.docId}</span>
                        {' · '}{doc.isBooking ? t('kind.booking') : t('kind.guest')}
                      </div>
                      <div className="truncate">
                        {doc.idType} <span className="font-mono tracking-[0.03em]">{doc.idNumber}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'id',
              header: t('col.identification'),
              hideBelow: '2xl',
              render: (doc) => (
                <div>
                  <div className="text-ink">{doc.idType}</div>
                  <div className="text-xs text-ink3 font-mono tracking-[0.03em] mt-0.5">{doc.idNumber}</div>
                </div>
              ),
            },
            {
              key: 'uploaded',
              header: t('col.files'),
              align: 'center',
              className: 'hidden lg:table-cell',
              render: (doc) => (
                <Badge type={getUploadBadgeType(doc.uploaded)}>{doc.uploaded} / {MAX_DOCUMENTS}</Badge>
              ),
            },
            {
              key: 'status',
              header: t('col.verification'),
              align: 'center',
              primary: true,
              render: (doc) => {
                const v = getVerificationStatus(doc)
                return (
                  <div className="inline-flex flex-col items-center gap-1">
                    <Badge type={v.type}>{v.key === 'verified' ? '✓ ' : ''}{t(`verification.${v.key}`)}</Badge>
                    {/* Files column is folded in here on tablets */}
                    <span className="hidden md:inline lg:hidden text-xs text-ink3">
                      {t('col.filesOf', { n: doc.uploaded, max: MAX_DOCUMENTS })}
                    </span>
                  </div>
                )
              },
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (doc) => (
                // Phone cards: one wrapping row. Tablet table: a 2×2 block so the
                // column stays narrow. lg+: one row.
                <div className="flex flex-wrap items-center justify-end gap-1.5 md:grid md:grid-cols-2 lg:flex lg:flex-nowrap">
                  <button className="btn btn-outline btn-xs" onClick={() => setViewDoc(doc)}>{t('common:view')}</button>
                  <button className="btn btn-outline btn-xs" onClick={() => setUploadDoc(doc)}>{t('common:upload')}</button>
                  <button
                    className="btn btn-xs bg-success-bg text-success-text disabled:opacity-30"
                    disabled={!doc.uploaded || doc.verified}
                    title={doc.verified ? t('actions.alreadyVerified') : t('actions.verifyTitle')}
                    onClick={() => handleQuickVerify(doc)}
                  >
                    {t('actions.verify')}
                  </button>
                  {/* Kept in the layout when empty so the action column never
                      jitters between rows. */}
                  <button
                    className="btn btn-danger btn-xs inline-flex items-center disabled:opacity-30"
                    disabled={!doc.documents.length}
                    title={t('actions.deleteAll')}
                    aria-label={t('actions.deleteAll')}
                    onClick={() => setDeleteRowTarget(doc)}
                  >
                    <LuTrash2 size={14} />
                  </button>
                </div>
              ),
            },
          ]}
        />

        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>

      {/* Modals */}
      <UploadModal
        doc={uploadDoc}
        onClose={() => setUploadDoc(null)}
        onSave={handleUploadSave}
      />
      <ViewDocsModal
        doc={viewDoc}
        onClose={() => setViewDoc(null)}
        onVerify={handleVerify}
        onDelete={setDeleteDocTarget}
      />
      <ConfirmModal
        isOpen={!!deleteDocTarget}
        onClose={() => setDeleteDocTarget(null)}
        onConfirm={handleDeleteDoc}
        title={t('deleteDoc.title')}
        message={deleteDocTarget ? <Trans t={t} i18nKey="deleteDoc.message" values={{ label: deleteDocTarget.label, name: deleteDocTarget.guestName }} components={{ b: <b /> }} /> : null}
        confirmLabel={t('common:delete')}
        danger
        busy={deletingDoc}
      />
      <ConfirmModal
        isOpen={!!deleteRowTarget}
        onClose={() => setDeleteRowTarget(null)}
        onConfirm={handleDeleteRow}
        title={t('deleteAll.title')}
        message={deleteRowTarget ? <Trans t={t} i18nKey="deleteAll.message" count={deleteRowTarget.documents.length} values={{ count: deleteRowTarget.documents.length, name: deleteRowTarget.guestName }} components={{ b: <b /> }} /> : null}
        confirmLabel={t('common:delete')}
        danger
        busy={deletingRow}
      />
    </PageWrapper>
  )
}
