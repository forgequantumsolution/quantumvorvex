import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_DOCS = [
  { id: '1', docId: 'DOC-0001', guestName: 'Rahul Sharma', room: '102', idType: 'Aadhaar', idNumber: '1234****9012', photo: null, uploaded: 2, total: 4, verified: false },
  { id: '2', docId: 'DOC-0002', guestName: 'Priya Patel', room: '205', idType: 'PAN', idNumber: 'ABCDE***4F', photo: null, uploaded: 3, total: 4, verified: false },
  { id: '3', docId: 'DOC-0003', guestName: 'Ankit Singh', room: '312', idType: 'Aadhaar', idNumber: '9876****1098', photo: null, uploaded: 4, total: 4, verified: true },
  { id: '4', docId: 'DOC-0004', guestName: 'Sneha Rao', room: '118', idType: 'Passport', idNumber: 'P123****7', photo: null, uploaded: 2, total: 4, verified: false },
]

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
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontWeight: 400, fontSize: '12px' }}>
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
            onClick={() => onSave(doc, newUploadCount)}
            disabled={newUploadCount === 0}
          >
            Save Documents
          </button>
        </>
      }
    >
      {/* Guest info */}
      <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', gap: '16px' }}>
        <div>
          <div className="form-label" style={{ marginBottom: '2px' }}>Guest</div>
          <div style={{ fontWeight: 600, fontSize: '13px' }}>{doc.guestName}</div>
        </div>
        <div>
          <div className="form-label" style={{ marginBottom: '2px' }}>Room</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '13px' }}>{doc.room}</div>
        </div>
        <div>
          <div className="form-label" style={{ marginBottom: '2px' }}>Uploaded</div>
          <Badge type={getUploadBadgeType(doc.uploaded)}>{doc.uploaded} / 4</Badge>
        </div>
      </div>

      {/* Upload zones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {DOC_SLOTS.map(slot => (
          <div key={slot.key}>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              {slot.icon} {slot.label}
            </label>
            <div
              className={`upload-zone${files[slot.key] ? ' dragover' : ''}`}
              onDrop={e => handleDrop(slot.key, e)}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById(`file-${slot.key}`).click()}
              style={{ minHeight: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {files[slot.key] ? (
                <>
                  <div style={{ fontSize: '20px' }}>✓</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--green-text)', fontWeight: 600, wordBreak: 'break-all', textAlign: 'center' }}>
                    {files[slot.key].name}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '22px', color: 'var(--text3)' }}>+</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text3)' }}>Click or drop file</div>
                </>
              )}
              <input
                id={`file-${slot.key}`}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={e => handleFileInput(slot.key, e)}
              />
            </div>
          </div>
        ))}
      </div>

      {newUploadCount > 0 && (
        <div className="notif notif-success" style={{ marginTop: '14px', background: 'var(--green-bg)', fontSize: '12.5px' }}>
          {newUploadCount} new file{newUploadCount > 1 ? 's' : ''} ready to upload
        </div>
      )}
    </Modal>
  )
}

// ─── View Docs Modal ──────────────────────────────────────────────────────────

function ViewDocsModal({ doc, onClose, onVerify }) {
  if (!doc) return null

  const mockDocList = DOC_SLOTS.slice(0, doc.uploaded).map((slot, i) => ({
    ...slot,
    uploadDate: '01 Apr 2026',
    verified: doc.verified || i < doc.uploaded - 1,
  }))

  return (
    <Modal
      isOpen={!!doc}
      onClose={onClose}
      title={
        <span>
          Documents —{' '}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontWeight: 400, fontSize: '12px' }}>
            {doc.docId}
          </span>
        </span>
      }
      maxWidth="480px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          {doc.uploaded === 4 && !doc.verified && (
            <button className="btn btn-primary btn-sm" onClick={() => onVerify(doc)}>
              Verify All
            </button>
          )}
        </>
      }
    >
      {/* Guest summary */}
      <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{doc.guestName}</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
          Room {doc.room} &middot; {doc.idType} &middot; {doc.idNumber}
        </div>
      </div>

      {/* Document list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {mockDocList.length === 0 && (
          <div className="empty-state" style={{ padding: '24px' }}>No documents uploaded yet</div>
        )}
        {mockDocList.map(d => (
          <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: '7px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>{d.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{d.label}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text3)' }}>Uploaded {d.uploadDate}</div>
              </div>
            </div>
            <Badge type={d.verified ? 'green' : 'amber'}>
              {d.verified ? '✓ Verified' : 'Pending'}
            </Badge>
          </div>
        ))}
        {/* Pending slots */}
        {DOC_SLOTS.slice(doc.uploaded).map(slot => (
          <div key={slot.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface2)', borderRadius: '7px', padding: '10px 14px', opacity: 0.45 }}>
            <span style={{ fontSize: '18px' }}>{slot.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text2)' }}>{slot.label}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text3)' }}>Not uploaded</div>
            </div>
            <Badge type="red" className="ml-auto">Missing</Badge>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Documents() {
  const addToast = useToast()
  const [docs, setDocs] = useState(MOCK_DOCS)
  const [search, setSearch] = useState('')
  const [uploadDoc, setUploadDoc] = useState(null)
  const [viewDoc, setViewDoc] = useState(null)

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

  const handleUploadSave = (doc, newCount) => {
    setDocs(ds => ds.map(d => d.id === doc.id
      ? { ...d, uploaded: Math.min(4, d.uploaded + newCount) }
      : d
    ))
    setUploadDoc(null)
    addToast(`Documents uploaded for ${doc.guestName}`, 'success')
  }

  const handleVerify = (doc) => {
    setDocs(ds => ds.map(d => d.id === doc.id ? { ...d, verified: true } : d))
    setViewDoc(null)
    addToast(`${doc.guestName} KYC verified`, 'success')
  }

  const handleQuickVerify = (doc) => {
    setDocs(ds => ds.map(d => d.id === doc.id ? { ...d, verified: true } : d))
    addToast(`${doc.guestName} KYC verified`, 'success')
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
          Documents
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: '13px' }}>KYC verification & ID management</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { label: 'Total Guests', count: totalGuests, bar: 'stat-bar-blue' },
          { label: 'Verified', count: verifiedCount, bar: 'stat-bar-green' },
          { label: 'Incomplete', count: incompleteCount, bar: 'stat-bar-red' },
        ].map(({ label, count, bar }) => (
          <div key={label} className={`stat-card ${bar}`}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '26px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ padding: '12px 16px' }}>
          <div style={{ position: 'relative', maxWidth: '360px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '15px' }}>⌕</span>
            <input
              className="form-input"
              style={{ paddingLeft: '30px' }}
              placeholder="Search guest name or DOC ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
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
                    <div className="empty-state">No documents found</div>
                  </td>
                </tr>
              )}
              {filtered.map(doc => {
                const verStatus = getVerificationStatus(doc)
                return (
                  <tr key={doc.id}>
                    {/* DOC ID */}
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontSize: '12px', fontWeight: 600 }}>
                        {doc.docId}
                      </span>
                    </td>
                    {/* Guest */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{doc.guestName}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text3)', marginTop: '1px' }}>Room {doc.room}</div>
                    </td>
                    {/* ID Type */}
                    <td>
                      <Badge type="blue">{doc.idType}</Badge>
                    </td>
                    {/* ID Number */}
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px', letterSpacing: '0.03em' }}>
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
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="btn btn-outline btn-xs" onClick={() => setViewDoc(doc)}>View Docs</button>
                        <button className="btn btn-outline btn-xs" onClick={() => setUploadDoc(doc)}>Upload</button>
                        {doc.uploaded === 4 && !doc.verified && (
                          <button
                            className="btn btn-xs"
                            style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
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
