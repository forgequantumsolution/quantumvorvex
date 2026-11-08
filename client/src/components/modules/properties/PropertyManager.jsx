import { useState, useEffect, useCallback, useImperativeHandle } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Modal, Button, EmptyState } from '../../ui-tw'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector, useAuthActions } from '../../../store/hooks'
import { propertiesApi, authApi } from '../../../api/client'
import PropertyTeam from './PropertyTeam'
import { Section, AddButton, TablePager } from '../settings/settingsUi'
import { usePaged } from '../settings/usePaged'
import { LuUsers, LuChevronDown, LuPencil, LuArchive, LuArchiveRestore, LuBuilding2 } from 'react-icons/lu'

const CODE_RE = /^[A-Z0-9-]{2,10}$/
const EMPTY_FORM = { name: '', code: '', address: '', phone: '', email: '', gstin: '', copyFromPropertyId: '' }

function Field({ label, hint, children, fullWidth }) {
  return (
    <div className={`flex flex-col gap-[5px] ${fullWidth ? 'md:col-span-2' : ''}`}>
      <label className="form-label text-[12px] font-semibold">{label}</label>
      {children}
      {hint && <span className="text-xs text-ink3">{hint}</span>}
    </div>
  )
}

// Add a property (with optional copy of another property's setup) or rename one.
function PropertyModal({ property, properties, defaultCopyFrom, onClose, onSaved }) {
  const { t } = useTranslation('settings')
  const isEdit = !!property
  const addToast = useToast()
  const [form, setForm] = useState(() =>
    isEdit ? { ...EMPTY_FORM, name: property.name, code: property.code } : { ...EMPTY_FORM, copyFromPropertyId: defaultCopyFrom || '' },
  )
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: key === 'code' ? e.target.value.toUpperCase() : e.target.value }))

  const nameError = form.name.trim().length < 2 ? t('propertyManager.nameError') : ''
  const codeError = form.code && !CODE_RE.test(form.code) ? t('propertyManager.codeError') : ''

  async function save() {
    if (nameError || codeError) return
    setSaving(true)
    try {
      if (isEdit) {
        await propertiesApi.update(property.id, { name: form.name.trim(), ...(form.code ? { code: form.code } : {}) })
        addToast(t('propertyManager.updated'), 'success')
      } else {
        const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
        const { data } = await propertiesApi.create(payload)
        addToast(t('propertyManager.created', { name: data.name }), 'success')
        return onSaved(data)
      }
      onSaved()
    } catch (err) {
      addToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || t('propertyManager.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? t('propertyManager.editTitle', { name: property.name }) : t('propertyManager.addTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common:cancel')}</Button>
          <Button onClick={save} disabled={saving || !!nameError || !!codeError}>
            {saving ? t('common:saving') : isEdit ? t('common:saveChanges') : t('propertyManager.create')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('propertyManager.name')} fullWidth>
          <input className="form-input" value={form.name} onChange={set('name')} placeholder={t('propertyManager.namePlaceholder')} autoFocus />
        </Field>
        <Field label={t('propertyManager.code')} hint={isEdit ? t('propertyManager.codeHintEdit') : t('propertyManager.codeHintNew')}>
          <input className="form-input" value={form.code} onChange={set('code')} placeholder={t('propertyManager.codePlaceholder')} maxLength={10} style={{ fontFamily: 'var(--font-mono)' }} />
          {codeError && <span className="text-xs text-danger">{codeError}</span>}
        </Field>

        {!isEdit && (
          <>
            <Field label={t('propertyManager.copyFrom')} hint={t('propertyManager.copyFromHint')}>
              <select className="form-select" value={form.copyFromPropertyId} onChange={set('copyFromPropertyId')}>
                <option value="">{t('propertyManager.startEmpty')}</option>
                {properties.filter((p) => p.status === 'active').map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('fields.phone')}>
              <input className="form-input" value={form.phone} onChange={set('phone')} placeholder={t('propertyManager.phonePlaceholder')} />
            </Field>
            <Field label={t('fields.email')}>
              <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="branch@hotel.com" />
            </Field>
            <Field label={t('fields.gstin')}>
              <input className="form-input" value={form.gstin} onChange={set('gstin')} placeholder={t('propertyManager.gstinPlaceholder')} />
            </Field>
            <Field label={t('fields.address')} fullWidth>
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
 * The "Add property" button lives in the page header (Settings → Properties
 * owns it) and opens the dialog here through `ref.current.add()`.
 */
export default function PropertyManager({ ref }) {
  const { t } = useTranslation('settings')
  const addToast = useToast()
  const activePropertyId = useAppSelector((s) => s.auth.activePropertyId)
  const { setCurrentUser } = useAuthActions()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)      // { property } | { property: null } | null
  const [confirm, setConfirm] = useState(null)  // property to archive / restore
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const pager = usePaged(properties)
  useImperativeHandle(ref, () => ({ add: () => setModal({ property: null }) }), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await propertiesApi.getAll()
      setProperties(data)
    } catch {
      addToast(t('propertyManager.loadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast, t])

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
      addToast(p.status === 'archived' ? t('propertyManager.restored', { name: p.name }) : t('propertyManager.archivedToast', { name: p.name }), 'success')
      setConfirm(null)
      refresh()
    } catch (err) {
      addToast(err.response?.data?.error || t('propertyManager.updateFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const activeCount = properties.filter((p) => p.status === 'active').length
  const archiving = confirm?.status !== 'archived'

  return (
    <Section
      title={t('propertyManager.allTitle')}
      subtitle={
        loading && properties.length === 0
          ? t('common:loading')
          : t('propertyManager.activeCount', { count: activeCount }) +
            (properties.length > activeCount ? t('propertyManager.archivedCount', { count: properties.length - activeCount }) : '')
      }
      bodyClassName="p-0"
    >
      {!loading && properties.length === 0 ? (
        <EmptyState
          icon={<LuBuilding2 />}
          title={t('propertyManager.emptyTitle')}
          message={t('propertyManager.emptyMessage')}
          action={<AddButton onClick={() => setModal({ property: null })}>{t('propertyManager.addTitle')}</AddButton>}
        />
      ) : (
        <ul className="list-none m-0 p-0 divide-y divide-[var(--border)] [&>li:last-child]:rounded-b-xl">
          {pager.rows.map((p) => {
            const archived = p.status === 'archived'
            const isCurrent = p.id === activePropertyId
            const isOpen = expanded === p.id
            const lastActive = !archived && activeCount <= 1
            return (
              <li key={p.id} className={`relative ${archived ? 'bg-surface2' : ''}`}>
                {isCurrent && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" aria-hidden />}
                <div className="flex items-center gap-x-3 sm:gap-x-4 gap-y-3 px-4 sm:px-5 py-4 flex-wrap">
                  <span
                    className={`min-w-14 sm:w-[68px] h-10 px-1.5 whitespace-nowrap rounded-lg border flex items-center justify-center text-xs font-bold tracking-[0.04em] shrink-0 ${
                      isCurrent ? 'bg-gold-bg border-gold-border text-gold' : 'bg-surface2 border-line text-ink2'
                    }`}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {p.code}
                  </span>
                  <div className="flex-1 min-w-0 basis-[160px]">
                    <div className={`text-[14px] font-semibold break-words ${archived ? 'text-ink3' : 'text-ink'}`}>{p.name}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge type={archived ? 'grey' : 'green'}>{archived ? t('propertyManager.archived') : t('propertyManager.active')}</Badge>
                      {isCurrent && <Badge type="blue">{t('propertyManager.current')}</Badge>}
                    </div>
                  </div>
                  {/* Phones: the actions take their own row, Team & access filling it */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant={isOpen ? 'primary' : 'ghost'}
                      icon={<LuUsers />}
                      className="flex-1 sm:flex-none"
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      aria-expanded={isOpen}
                    >
                      {t('propertyManager.team')}
                      <LuChevronDown size={14} aria-hidden className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<LuPencil />}
                      onClick={() => setModal({ property: p })}
                      aria-label={t('propertyManager.editAria', { name: p.name })}
                      title={t('common:edit')}
                    />
                    <Button
                      size="sm"
                      variant={archived ? 'success' : 'ghost'}
                      icon={archived ? <LuArchiveRestore /> : <LuArchive />}
                      onClick={() => setConfirm(p)}
                      disabled={lastActive}
                      aria-label={archived ? t('propertyManager.restoreAria', { name: p.name }) : t('propertyManager.archiveAria', { name: p.name })}
                      title={lastActive ? t('propertyManager.lastActive') : archived ? t('propertyManager.restore') : t('propertyManager.archive')}
                    >
                      {archived ? t('propertyManager.restore') : null}
                    </Button>
                  </div>
                </div>
                {isOpen && <div className="border-t border-line"><PropertyTeam property={p} /></div>}
              </li>
            )
          })}
        </ul>
      )}
      <TablePager pager={pager} />

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
        title={archiving ? t('propertyManager.archiveTitle') : t('propertyManager.restoreTitle')}
        confirmLabel={archiving ? t('propertyManager.archive') : t('propertyManager.restore')}
        message={
          <Trans
            t={t}
            i18nKey={archiving ? 'propertyManager.archiveMessage' : 'propertyManager.restoreMessage'}
            values={{ name: confirm?.name }}
            components={{ b: <strong className="text-ink" /> }}
          />
        }
      />
    </Section>
  )
}
