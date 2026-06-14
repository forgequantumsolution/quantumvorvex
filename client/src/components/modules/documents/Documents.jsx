import { useState, useMemo, useEffect, useCallback } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
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
    room: g.room?.number || '—',
    idType: g.idType || '—',
    idNumber: g.idNumber || '—',
    documents,
    uploaded,
    verified: documents.length > 0 && documents.every((d) => d.verified),
  }
}

const DOC_SLOTS = [
  { key: 'idFront', label: 'ID Front', icon: '🪪' },
  { key: 'idBack', label: 'ID Back', icon: '🪪' },
  { key: 'guestPhoto', label: 'Guest Photo', icon: '📷' },
  { key: 'additional', label: 'Additional Doc', icon: '📄' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVerificationStatus(doc) {
  if (doc.uploaded === 4 && doc.verified) return { label: '✓ Verified', type: 'green' }
  if (doc.uploaded >= 3) return { label: 'Pending', type: 'amber' }
  return { label: 'Incomplete', type: 'red' }
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

  const handleDrop = (key, e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) setFiles(f => ({ ...f, [key]: file }))
  }

  const handleFileInput = (key, e) => {
    const file = e.target.files[0]
    if (file) setFiles(f => ({ ...f, [key]: file }))
  }

  const handleDragOver = (e) => e.preventDefault()

  const newUploadCount = Object.values(files).filter(Boolean).length

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
      <div className="grid grid-cols-2 gap-3">
        {DOC_SLOTS.map(slot => (
          <div key={slot.key}>
            <label className="form-label block mb-1.5">
              {slot.icon} {slot.label}
            </label>
            <div
              className={`upload-zone${files[slot.key] ? ' dragover' : ''} min-h-[80px] flex flex-col items-center justify-center gap-1.5`}
              onDrop={e => handleDrop(slot.key, e)}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById(`file-${slot.key}`).click()}
            >
              {files[slot.key] ? (
                <>
                  <div className="text-[20px]">✓</div>
                  <div className="text-[11.5px] text-success-text font-semibold break-all text-center">
                    {files[slot.key].name}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[22px] text-ink3">+</div>
                  <div className="text-[11.5px] text-ink3">Click or drop file</div>
                </>
              )}
              <input
                id={`file-${slot.key}`}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => handleFileInput(slot.key, e)}
              />
            </div>
          </div>
        ))}
      </div>

      {newUploadCount > 0 && (
        <div className="notif notif-success mt-[14px] bg-success-bg text-[12.5px]">
          {newUploadCount} new file{newUploadCount > 1 ? 's' : ''} ready to upload
        </div>
      )}
    </Modal>
  )
}

// ─── View Docs Modal ──────────────────────────────────────────────────────────

function ViewDocsModal({ doc, onClose, onVerify }) {
  if (!doc) return null

  const docList = (doc.documents || []).map((d) => ({
    key: d.id,
    label: d.docType || 'Document',
    icon: '📄',
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
      maxWidth="480px"
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
      <div className="bg-surface2 rounded-lg px-[14px] py-2.5 mb-4">
        <div className="t-title mb-0.5">{doc.guestName}</div>
        <div className="t-xs text-ink3">
          Room {doc.room} &middot; {doc.idType} &middot; {doc.idNumber}
        </div>
      </div>

      {/* Document list */}
      <div className="flex flex-col gap-2">
        {docList.length === 0 && (
          <div className="empty-state p-6">No documents uploaded yet</div>
        )}
        {docList.map(d => (
          <div key={d.key} className="flex items-center justify-between bg-surface2 rounded-[7px] px-[14px] py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[18px]">{d.icon}</span>
              <div>
                <div className="t-title">
                  {d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="text-gold">{d.label}</a> : d.label}
                </div>
                <div className="text-[11.5px] text-ink3">Uploaded {d.uploadDate}</div>
              </div>
            </div>
            <Badge type={d.verified ? 'green' : 'amber'}>
              {d.verified ? '✓ Verified' : 'Pending'}
            </Badge>
          </div>
        ))}
      </div>
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
  const [uploadDoc, setUploadDoc] = useState(null)
  const [viewDoc, setViewDoc] = useState(null)

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
    const q = search.toLowerCase()
    return docs.filter(d =>
      !q || d.guestName.toLowerCase().includes(q) || d.docId.toLowerCase().includes(q)
    )
  }, [docs, search])

  // Stats
  const totalGuests = docs.length
  const verifiedCount = docs.filter(d => d.verified).length
  const incompleteCount = docs.filter(d => d.uploaded < 3).length

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

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h1 className="t-h1 m-0 tracking-[-0.03em]">
            Documents
          </h1>
          <p className="t-sm mt-1 mb-0 text-ink3">KYC verification & ID management</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-[18px]">
        {[
          { label: 'Total Guests', count: totalGuests, bar: 'stat-bar-blue' },
          { label: 'Verified', count: verifiedCount, bar: 'stat-bar-green' },
          { label: 'Incomplete', count: incompleteCount, bar: 'stat-bar-red' },
        ].map(({ label, count, bar }) => (
          <div key={label} className={`stat-card ${bar}`}>
            <div className="t-label mb-1.5">{label}</div>
            <div className="text-[26px] font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card mb-4">
        <div className="px-4 py-3">
          <div className="relative max-w-[360px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3 text-[15px]">⌕</span>
            <input
              className="form-input pl-[30px]"
              placeholder="Search guest name or DOC ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>DOC ID</th>
                <th>Guest</th>
                <th>ID Type</th>
                <th>ID Number</th>
                <th>Uploaded</th>
                <th>Verification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">{loading ? 'Loading documents…' : 'No documents found'}</div>
                  </td>
                </tr>
              )}
              {filtered.map(doc => {
                const verStatus = getVerificationStatus(doc)
                return (
                  <tr key={doc.id}>
                    {/* DOC ID */}
                    <td>
                      <span className="text-gold text-[12px] font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                        {doc.docId}
                      </span>
                    </td>
                    {/* Guest */}
                    <td>
                      <div className="font-semibold text-ink">{doc.guestName}</div>
                      <div className="text-[11.5px] text-ink3 mt-px">Room {doc.room}</div>
                    </td>
                    {/* ID Type */}
                    <td>
                      <Badge type="blue">{doc.idType}</Badge>
                    </td>
                    {/* ID Number */}
                    <td>
                      <span className="text-[12.5px] tracking-[0.03em]" style={{ fontFamily: 'var(--font-mono)' }}>
                        {doc.idNumber}
                      </span>
                    </td>
                    {/* Uploaded */}
                    <td>
                      <Badge type={getUploadBadgeType(doc.uploaded)}>
                        {doc.uploaded} / 4
                      </Badge>
                    </td>
                    {/* Verification */}
                    <td>
                      <Badge type={verStatus.type}>{verStatus.label}</Badge>
                    </td>
                    {/* Actions */}
                    <td>
                      <div className="flex gap-[5px]">
                        <button className="btn btn-outline btn-xs" onClick={() => setViewDoc(doc)}>View Docs</button>
                        <button className="btn btn-outline btn-xs" onClick={() => setUploadDoc(doc)}>Upload</button>
                        {doc.uploaded > 0 && !doc.verified && (
                          <button
                            className="btn btn-xs bg-success-bg text-success-text"
                            onClick={() => handleQuickVerify(doc)}
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

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
      />
    </div>
  )
}
