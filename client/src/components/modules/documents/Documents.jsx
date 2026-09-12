import { useState, useMemo, useEffect, useCallback } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import {
  PageWrapper, StatCard, Card, DataTable, Pagination,
  SearchInput, Button, EmptyState,
} from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { documentsApi } from '../../../api/client'

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
  idfront: 'ID Front',
  idback: 'ID Back',
  guestphoto: 'Guest Photo',
  photo: 'Guest Photo',
  checkoutphoto: 'Check-out Photo',
  paymentproof: 'Payment Proof',
  additional: 'Additional Doc',
}
const prettyDocType = (s) => DOC_LABELS[normDocType(s)] || s || 'Document'

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
function getVerificationStatus(doc) {
  if (!doc.uploaded) return { key: 'incomplete', label: 'No files', type: 'red' }
  if (doc.verified) return { key: 'verified', label: '✓ Verified', type: 'green' }
  return { key: 'pending', label: 'Pending', type: 'amber' }
}

function getUploadBadgeType(uploaded) {
  if (uploaded >= 4) return 'green'
  if (uploaded >= 2) return 'amber'
  return 'red'
}

// ─── Upload Documents Modal ───────────────────────────────────────────────────

function UploadModal({ doc, onClose, onSave }) {
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
          Upload Documents —{' '}
          <span className="text-gold font-normal text-[12px]" style={{ fontFamily: 'var(--font-mono)' }}>
            {doc.docId}
          </span>
        </span>
      }
      maxWidth="560px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onSave(doc, files)}
            disabled={newUploadCount === 0}
          >
            Save Documents
          </button>
        </>
      }
    >
      {/* Guest info */}
      <div className="bg-surface2 rounded-lg px-[14px] py-2.5 mb-4 flex gap-4">
        <div>
          <div className="form-label mb-0.5">Guest</div>
          <div className="t-title">{doc.guestName}</div>
        </div>
        <div>
          <div className="form-label mb-0.5">Room</div>
          <div className="font-semibold text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>{doc.room}</div>
        </div>
        <div>
          <div className="form-label mb-0.5">Uploaded</div>
          <Badge type={getUploadBadgeType(doc.uploaded)}>{doc.uploaded} / 4</Badge>
        </div>
      </div>

      {/* Upload zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DOC_SLOTS.map(slot => {
          const filled = isSlotFilled(slot)
          const locked = slotLocked(slot)
          return (
            <div key={slot.key}>
              <label className="form-label block mb-1.5">
                {slot.icon} {slot.label}
              </label>
              <div
                className={`upload-zone${files[slot.key] ? ' dragover' : ''} min-h-[80px] flex flex-col items-center justify-center gap-1.5${locked ? ' opacity-50 cursor-not-allowed' : ''}`}
                onDrop={e => handleDrop(slot.key, slot, e)}
                onDragOver={handleDragOver}
                onClick={() => { if (!locked) document.getElementById(`file-${slot.key}`).click() }}
              >
                {filled ? (
                  <>
                    <div className="text-[20px]">✓</div>
                    <div className="text-[11.5px] text-ink3 font-semibold text-center">
                      Already uploaded
                    </div>
                  </>
                ) : files[slot.key] ? (
                  <>
                    <div className="text-[20px]">✓</div>
                    <div className="text-[11.5px] text-success-text font-semibold break-all text-center">
                      {files[slot.key].name}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[22px] text-ink3">+</div>
                    <div className="text-[11.5px] text-ink3">{locked ? 'Limit reached' : 'Click or drop file'}</div>
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
          All {MAX_DOCUMENTS} document slots are filled for this guest.
        </div>
      ) : newUploadCount > 0 && (
        <div className="notif notif-success mt-[14px] bg-success-bg text-[12.5px]">
          {newUploadCount} new file{newUploadCount > 1 ? 's' : ''} ready to upload · {remaining - newUploadCount} slot{remaining - newUploadCount !== 1 ? 's' : ''} left
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
  const [failed, setFailed] = useState(false)
  const showImage = d.image && !failed

  return (
    <div className="rounded-lg border border-line bg-surface2 overflow-hidden flex flex-col">
      <a
        href={d.url}
        target="_blank"
        rel="noreferrer"
        title="Open full size"
        className="h-[168px] bg-surface flex items-center justify-center overflow-hidden"
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
            <div className="text-[11.5px] text-ink3">
              {d.image ? 'Preview unavailable' : 'Open document'}
            </div>
          </div>
        )}
      </a>

      <div className="px-3 py-2.5 border-t border-line flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="t-title truncate">{d.label}</div>
          <div className="text-[11.5px] text-ink3">Uploaded {d.uploadDate}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge type={d.verified ? 'green' : 'amber'}>{d.verified ? '✓' : 'Pending'}</Badge>
          <button
            className="btn btn-danger btn-xs inline-flex items-center"
            title="Delete document"
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
  if (!doc) return null

  const docList = (doc.documents || []).map((d) => ({
    key: d.id,
    label: prettyDocType(d.docType),
    image: isImageUrl(d.url),
    url: d.url,
    uploadDate: d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : '—',
    verified: d.verified,
  }))
  const allVerified = docList.length > 0 && docList.every((d) => d.verified)

  return (
    <Modal
      isOpen={!!doc}
      onClose={onClose}
      title={
        <span>
          Documents —{' '}
          <span className="text-gold font-normal text-[12px]" style={{ fontFamily: 'var(--font-mono)' }}>
            {doc.docId}
          </span>
        </span>
      }
      maxWidth="720px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          {docList.length > 0 && !allVerified && (
            <button className="btn btn-primary btn-sm" onClick={() => onVerify(doc)}>
              Verify All
            </button>
          )}
        </>
      }
    >
      {/* Guest summary */}
      <div className="bg-surface2 rounded-lg px-[14px] py-2.5 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="t-title mb-0.5">{doc.guestName}</div>
          <div className="t-xs text-ink3">
            Room {doc.room} &middot; {doc.idType} &middot; {doc.idNumber}
          </div>
        </div>
        <Badge type={getUploadBadgeType(docList.length)}>
          {docList.length} file{docList.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Every uploaded file — ID front/back, PAN, passport, guest and
          check-out photos — previewed together. */}
      {docList.length === 0 ? (
        <div className="empty-state p-6">No documents uploaded yet</div>
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
      setError('Could not load documents. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

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
      addToast(`Documents uploaded for ${doc.guestName}`, 'success')
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Upload failed', 'error')
    }
  }

  const verifyAll = async (doc) => {
    const pending = (doc.documents || []).filter(d => !d.verified)
    if (pending.length === 0) { addToast('No documents to verify', 'info'); return false }
    await Promise.all(pending.map(d => documentsApi.verify(d.id)))
    addToast(`${doc.guestName} KYC verified`, 'success')
    load()
    return true
  }

  const handleVerify = async (doc) => {
    try { if (await verifyAll(doc)) setViewDoc(null) }
    catch { addToast('Could not verify documents', 'error') }
  }

  const handleQuickVerify = async (doc) => {
    try { await verifyAll(doc) }
    catch { addToast('Could not verify documents', 'error') }
  }

  const handleDeleteDoc = async () => {
    if (!deleteDocTarget) return
    setDeletingDoc(true)
    try {
      await documentsApi.delete(deleteDocTarget.id)
      addToast('Document deleted', 'success')
      // Drop it from the open View modal immediately, then refresh the table.
      setViewDoc((v) => v ? { ...v, documents: (v.documents || []).filter((d) => d.id !== deleteDocTarget.id) } : v)
      setDeleteDocTarget(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not delete document', 'error')
    } finally {
      setDeletingDoc(false)
    }
  }

  const handleDeleteRow = async () => {
    if (!deleteRowTarget) return
    setDeletingRow(true)
    try {
      await Promise.all((deleteRowTarget.documents || []).map((d) => documentsApi.delete(d.id)))
      addToast(`Documents deleted for ${deleteRowTarget.guestName}`, 'success')
      setDeleteRowTarget(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not delete documents', 'error')
    } finally {
      setDeletingRow(false)
    }
  }

  return (
    <PageWrapper
      title="Documents"
      subtitle="KYC verification & ID management"
      icon="🗂"
      actions={<Button variant="ghost" onClick={load} disabled={loading}>↻ Refresh</Button>}
      stats={
        <>
          <StatCard icon="👤" tone="blue"  label="Guests & bookings" value={totalGuests} />
          <StatCard icon="✓"  tone="green" label="Verified" value={verifiedCount}   hint="every file signed off" />
          <StatCard icon="◷"  tone="amber" label="Pending"  value={pendingCount}    hint="awaiting review" />
          <StatCard icon="!"  tone="red"   label="No files" value={incompleteCount} hint="nothing uploaded yet" />
        </>
      }
    >
      {error && (
        <div className="text-sm mb-4 px-3.5 py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      <Card
        bodyClassName="divide-y divide-line"
        title="KYC records"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search guest or DOC ID"
              className="w-52"
            />
            <select
              className="form-select w-auto min-w-[120px] py-1.5 text-[13px]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by record type"
            >
              <option value="all">All types</option>
              <option value="bookings">New bookings</option>
              <option value="guests">Checked-in guests</option>
            </select>
            <select
              className="form-select w-auto min-w-[120px] py-1.5 text-[13px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by verification status"
            >
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="incomplete">No files</option>
            </select>
            {filtersActive && (
              <Button variant="ghost" onClick={clearFilters}>Clear</Button>
            )}
          </div>
        }
      >
        <DataTable
          rows={pageRows}
          rowKey={(d) => d.id}
          empty={
            <EmptyState
              icon="🗂"
              title={loading ? 'Loading documents…' : filtersActive ? 'No matching records' : 'No documents yet'}
              message={
                loading
                  ? undefined
                  : filtersActive
                    ? 'Try a different search or clear the filters.'
                    : 'ID scans captured on a booking show up here automatically.'
              }
            />
          }
          columns={[
            {
              key: 'docId',
              header: 'Doc ID',
              render: (doc) => (
                <div>
                  <span className="text-gold text-[12px] font-semibold font-mono">{doc.docId}</span>
                  <div className="text-[11px] text-ink3 mt-0.5">
                    {doc.isBooking ? 'Booking' : 'Guest'}
                  </div>
                </div>
              ),
            },
            {
              key: 'guest',
              header: 'Guest',
              render: (doc) => (
                <div className="flex items-center gap-3 min-w-0">
                  {doc.photo ? (
                    <button
                      type="button"
                      title="View documents"
                      onClick={() => setViewDoc(doc)}
                      className="shrink-0 w-9 h-9 rounded-full overflow-hidden border border-line hover:border-gold"
                    >
                      <img src={doc.photo.url} alt={doc.guestName} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <span
                      className="shrink-0 w-9 h-9 rounded-full bg-surface2 border border-line flex items-center justify-center text-[13px] text-ink3"
                      title="No guest photo on file"
                    >
                      {(doc.guestName || '?').trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">{doc.guestName}</div>
                    <div className="text-[11.5px] text-ink3 mt-px">Room {doc.room}</div>
                  </div>
                </div>
              ),
            },
            {
              key: 'id',
              header: 'Identification',
              render: (doc) => (
                <div>
                  <div className="text-ink">{doc.idType}</div>
                  <div className="text-[11.5px] text-ink3 font-mono tracking-[0.03em] mt-0.5">{doc.idNumber}</div>
                </div>
              ),
            },
            {
              key: 'uploaded',
              header: 'Files',
              align: 'center',
              render: (doc) => (
                <Badge type={getUploadBadgeType(doc.uploaded)}>{doc.uploaded} / {MAX_DOCUMENTS}</Badge>
              ),
            },
            {
              key: 'status',
              header: 'Verification',
              align: 'center',
              render: (doc) => {
                const v = getVerificationStatus(doc)
                return <Badge type={v.type}>{v.label}</Badge>
              },
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (doc) => (
                <div className="flex items-center justify-end gap-1.5">
                  <button className="btn btn-outline btn-xs" onClick={() => setViewDoc(doc)}>View</button>
                  <button className="btn btn-outline btn-xs" onClick={() => setUploadDoc(doc)}>Upload</button>
                  <button
                    className="btn btn-xs bg-success-bg text-success-text disabled:opacity-30"
                    disabled={!doc.uploaded || doc.verified}
                    title={doc.verified ? 'Already verified' : 'Mark every file verified'}
                    onClick={() => handleQuickVerify(doc)}
                  >
                    Verify
                  </button>
                  {/* Kept in the layout when empty so the action column never
                      jitters between rows. */}
                  <button
                    className="btn btn-danger btn-xs inline-flex items-center disabled:opacity-30"
                    disabled={!doc.documents.length}
                    title="Delete all documents for this guest"
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
        title="Delete Document"
        message={deleteDocTarget ? <>Delete <b>{deleteDocTarget.label}</b> for <b>{deleteDocTarget.guestName}</b>? The file is permanently removed.</> : null}
        confirmLabel="Delete"
        danger
        busy={deletingDoc}
      />
      <ConfirmModal
        isOpen={!!deleteRowTarget}
        onClose={() => setDeleteRowTarget(null)}
        onConfirm={handleDeleteRow}
        title="Delete Documents"
        message={deleteRowTarget ? <>Delete all <b>{deleteRowTarget.documents.length}</b> document{deleteRowTarget.documents.length !== 1 ? 's' : ''} for <b>{deleteRowTarget.guestName}</b>? The files are permanently removed.</> : null}
        confirmLabel="Delete"
        danger
        busy={deletingRow}
      />
    </PageWrapper>
  )
}
