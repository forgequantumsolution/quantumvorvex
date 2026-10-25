import { useState, useEffect, useCallback } from 'react'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector, useAuthActions } from '../../../store/hooks'
import { propertiesApi, authApi } from '../../../api/client'
import PropertyTeam from './PropertyTeam'
import { LuPlus, LuUsers, LuChevronDown, LuPencil, LuArchive, LuArchiveRestore } from 'react-icons/lu'

const CODE_RE = /^[A-Z0-9-]{2,10}$/
const EMPTY_FORM = { name: '', code: '', address: '', phone: '', email: '', gstin: '', copyFromPropertyId: '' }

function Field({ label, hint, children, fullWidth }) {
  return (
    <div className={`flex flex-col gap-[5px] ${fullWidth ? 'md:col-span-2' : ''}`}>
      <label className="form-label text-[12px] font-semibold">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-ink3">{hint}</span>}
    </div>
  )
}

// Add a property (with optional copy of another property's setup) or rename one.
function PropertyModal({ property, properties, defaultCopyFrom, onClose, onSaved }) {
  const isEdit = !!property
  const addToast = useToast()
  const [form, setForm] = useState(() =>
    isEdit ? { ...EMPTY_FORM, name: property.name, code: property.code } : { ...EMPTY_FORM, copyFromPropertyId: defaultCopyFrom || '' },
  )
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: key === 'code' ? e.target.value.toUpperCase() : e.target.value }))

  const nameError = form.name.trim().length < 2 ? 'Enter a name (at least 2 characters).' : ''
  const codeError = form.code && !CODE_RE.test(form.code) ? '2–10 letters, digits or dashes.' : ''

  async function save() {
    if (nameError || codeError) return
    setSaving(true)
    try {
      if (isEdit) {
        await propertiesApi.update(property.id, { name: form.name.trim(), ...(form.code ? { code: form.code } : {}) })
        addToast('Property updated.', 'success')
      } else {
        const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
        const { data } = await propertiesApi.create(payload)
        addToast(`${data.name} created — now add the people who will work there.`, 'success')
        return onSaved(data)
      }
      onSaved()
    } catch (err) {
      addToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Could not save the property.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? `Edit Property — ${property.name}` : '+ Add Property'}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !!nameError || !!codeError}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Property'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <Field label="Property Name" fullWidth>
          <input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. Sea View Residency" autoFocus />
        </Field>
        <Field label="Short Code" hint={isEdit ? 'Shown in the property switcher.' : 'Optional — generated from the name if left blank.'}>
          <input className="form-input" value={form.code} onChange={set('code')} placeholder="e.g. SEAV" maxLength={10} style={{ fontFamily: 'var(--font-mono)' }} />
          {codeError && <span className="text-[11px] text-danger">{codeError}</span>}
        </Field>

        {!isEdit && (
          <>
            <Field label="Copy setup from" hint="Room types, food plans, amenities, tax and invoice settings.">
              <select className="form-select" value={form.copyFromPropertyId} onChange={set('copyFromPropertyId')}>
                <option value="">Start empty</option>
                {properties.filter((p) => p.status === 'active').map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input className="form-input" value={form.phone} onChange={set('phone')} placeholder="Front desk number" />
            </Field>
            <Field label="Email">
              <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="branch@hotel.com" />
            </Field>
            <Field label="GSTIN">
              <input className="form-input" value={form.gstin} onChange={set('gstin')} placeholder="Each branch has its own GSTIN" />
            </Field>
            <Field label="Address" fullWidth>
              <textarea className="form-textarea resize-y" rows={2} value={form.address} onChange={set('address')} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  )
}

/**
 * Settings → Properties (owner only): add properties, rename them, archive /
 * restore, and manage each property's team (who can open it, with what role).
 */
export default function PropertyManager() {
  const addToast = useToast()
  const activePropertyId = useAppSelector((s) => s.auth.activePropertyId)
  const { setCurrentUser } = useAuthActions()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)      // { property } | { property: null } | null
  const [confirm, setConfirm] = useState(null)  // property to archive / restore
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await propertiesApi.getAll()
      setProperties(data)
    } catch {
      addToast('Could not load properties.', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  // Refresh both this list and the session's property list (switcher, permissions).
  const refresh = useCallback(async () => {
    await load()
    try {
      const { data } = await authApi.me()
      if (data?.user) setCurrentUser(data.user)
    } catch { /* handled by the axios interceptor */ }
  }, [load, setCurrentUser])

  async function toggleArchive() {
    const p = confirm
    setBusy(true)
    try {
      await propertiesApi.update(p.id, { status: p.status === 'archived' ? 'active' : 'archived' })
      addToast(p.status === 'archived' ? `${p.name} restored.` : `${p.name} archived.`, 'success')
      setConfirm(null)
      refresh()
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update the property.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const activeCount = properties.filter((p) => p.status === 'active').length
  const archiving = confirm?.status !== 'archived'

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 sm:px-6 py-4 border-b border-line">
        <div>
          <h3 className="t-h3 m-0">All properties</h3>
          <div className="t-xs text-ink3 mt-0.5">
            {activeCount} active{properties.length > activeCount ? ` · ${properties.length - activeCount} archived` : ''}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ property: null })}>
          <LuPlus size={14} aria-hidden /> Add property
        </button>
      </div>

      {loading && properties.length === 0 && <p className="t-sm text-ink3 m-0 px-5 sm:px-6 py-5">Loading…</p>}
      <ul className="list-none m-0 p-0 divide-y divide-[var(--border)]">
        {properties.map((p) => {
          const archived = p.status === 'archived'
          const isCurrent = p.id === activePropertyId
          const isOpen = expanded === p.id
          return (
            <li key={p.id} className={`relative ${archived ? 'bg-surface2' : ''}`}>
              {isCurrent && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" aria-hidden />}
              <div className="flex items-center gap-4 px-5 sm:px-6 py-4 flex-wrap">
                <span
                  className={`w-[68px] h-10 px-1.5 rounded-lg border flex items-center justify-center text-[11px] font-bold tracking-[0.04em] shrink-0 ${
                    isCurrent ? 'bg-[var(--gold-bg)] border-[var(--gold-border)] text-gold' : 'bg-surface2 border-line text-ink2'
                  }`}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {p.code}
                </span>
                <div className="flex-1 min-w-[160px]">
                  <div className={`text-[14px] font-semibold ${archived ? 'text-ink3' : 'text-ink'}`}>{p.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge type={archived ? 'grey' : 'green'}>{archived ? 'Archived' : 'Active'}</Badge>
                    {isCurrent && <Badge type="blue">Current</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    className={`btn btn-sm ${isOpen ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                    aria-expanded={isOpen}
                  >
                    <LuUsers size={14} aria-hidden /> Team & access
                    <LuChevronDown size={14} aria-hidden className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => setModal({ property: p })} aria-label={`Edit ${p.name}`} title="Edit">
                    <LuPencil size={14} aria-hidden />
                  </button>
                  <button
                    className={`btn btn-sm ${archived ? 'btn-success' : 'btn-outline'}`}
                    onClick={() => setConfirm(p)}
                    disabled={!archived && activeCount <= 1}
                    aria-label={`${archived ? 'Restore' : 'Archive'} ${p.name}`}
                    title={!archived && activeCount <= 1 ? 'The only active property cannot be archived' : archived ? 'Restore' : 'Archive'}
                  >
                    {archived ? <><LuArchiveRestore size={14} aria-hidden /> Restore</> : <LuArchive size={14} aria-hidden />}
                  </button>
                </div>
              </div>
              {isOpen && <div className="border-t border-line"><PropertyTeam property={p} /></div>}
            </li>
          )
        })}
      </ul>

      {modal && (
        <PropertyModal
          property={modal.property}
          properties={properties}
          defaultCopyFrom={activePropertyId}
          onClose={() => setModal(null)}
          // A new property opens straight onto its team so staff can be assigned.
          onSaved={(created) => { setModal(null); refresh(); if (created?.id) setExpanded(created.id) }}
        />
      )}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={toggleArchive}
        busy={busy}
        danger={archiving}
        title={archiving ? 'Archive property' : 'Restore property'}
        confirmLabel={archiving ? 'Archive' : 'Restore'}
        message={
          archiving
            ? <>Archive <strong className="text-ink">{confirm?.name}</strong>? Its records are kept and stay viewable by owners, but no one can make changes and staff lose access until it is restored.</>
            : <>Restore <strong className="text-ink">{confirm?.name}</strong>? Assigned staff will be able to open it again.</>
        }
      />
    </div>
  )
}
