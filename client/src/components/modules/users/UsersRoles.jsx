import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Formik, Form } from 'formik'
import { LuPlus, LuUserPlus } from 'react-icons/lu'
import * as Yup from 'yup'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import FormikField from '../../ui/FormikField'
import { PageWrapper, DataTable, TableCard } from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector, useAppDispatch } from '../../../store/hooks'
import { setCredentials, selectActiveProperty, selectProperties } from '../../../store/slices/authSlice'
import { useCan } from '../../../hooks/useCan'
import { usersApi, rolesApi, authApi } from '../../../api/client'
import { userSchema } from '../../../validation/userSchema'
import { timeAgo } from '../../../utils/format'

// Friendly labels for backend module keys (server/src/config/modules.js) live in
// users.json under modules.<key>; an unknown key shows as-is.
const moduleLabel = (t, m) => t(`modules.${m}`, { defaultValue: m })
// Permission levels (values sent to the server); labels from users.json levels.<value>.
const LEVELS = ['NONE', 'VIEW', 'MANAGE']
const LEVEL_BADGE = { MANAGE: 'green', VIEW: 'blue', NONE: 'grey' }

function getInitials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ name, color = '#6b7280', size = 34 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0 tracking-[0.02em]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}
    >
      {getInitials(name)}
    </div>
  )
}

// ─── Add / Edit User Modal ──────────────────────────────────────────────────────
function UserModal({ isOpen, onClose, user, roles, propertyName, onSave }) {
  const { t } = useTranslation('users')
  // Same rules as userSchema, with the messages in the current language.
  const schema = useMemo(() => userSchema.shape({
    name:  Yup.string().trim().min(2, t('validation.nameShort')).max(100).required(t('validation.nameRequired')),
    email: Yup.string().trim().email(t('validation.emailInvalid')).required(t('validation.emailRequired')),
    roleId: Yup.string().required(t('validation.roleRequired')),
  }), [t])
  const isEdit = !!user
  const isSuper = !!user?.isSuperAdmin
  const defaultRoleId = roles.find((r) => r.name === 'Staff')?.id || roles[0]?.id || ''

  const initialValues = user
    ? { name: user.name, email: user.email, phone: user.phone || '', roleId: user.roleId || defaultRoleId, status: user.status || 'active', password: '' }
    : { name: '', email: '', phone: '', roleId: defaultRoleId, status: 'active', password: '' }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={schema}
      enableReinitialize
      onSubmit={(values) => {
        const payload = { ...values }
        if (!payload.password) delete payload.password // let the server apply the default
        onSave(payload)
      }}
    >
      {({ submitForm, isSubmitting }) => (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title={isEdit ? t('userModal.editTitle', { name: user.name }) : t('userModal.addTitle')}
          footer={
            <>
              <button className="btn btn-outline" onClick={onClose}>{t('common:cancel')}</button>
              <button className="btn btn-primary" onClick={submitForm} disabled={isSubmitting}>
                {isEdit ? t('userModal.save') : t('userModal.create')}
              </button>
            </>
          }
        >
          <Form className="flex flex-col gap-3.5" autoComplete="off">
            <FormikField name="name" label={t('userModal.fullName')} required placeholder={t('userModal.namePlaceholder')} autoComplete="off" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormikField name="email" label={t('userModal.email')} type="email" required placeholder="user@hotel.com" autoComplete="off" />
              <FormikField name="phone" label={t('userModal.phone')} placeholder={t('userModal.phonePlaceholder')} autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormikField name="roleId" label={t('userModal.role')} required as="select" disabled={isSuper}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </FormikField>
              <FormikField name="status" label={t('userModal.status')} as="select" disabled={isSuper}>
                <option value="active">{t('common:active')}</option>
                <option value="inactive">{t('common:inactive')}</option>
              </FormikField>
            </div>
            {isSuper && (
              <p className="mt-[-6px] mb-0 text-xs text-ink3">
                {t('userModal.superAdminNote')}
              </p>
            )}
            {!isSuper && propertyName && (
              <p className="mt-[-6px] mb-0 text-xs text-ink3">
                <Trans
                  t={t}
                  i18nKey={isEdit ? 'userModal.roleAppliesAt' : 'userModal.accessTo'}
                  values={{ property: propertyName }}
                  components={{ b: <strong className="text-ink2" /> }}
                />
              </p>
            )}
            {isEdit ? (
              <FormikField
                name="password"
                label={t('userModal.resetPassword')}
                type="password"
                autoComplete="new-password"
                placeholder={t('userModal.resetPlaceholder')}
              />
            ) : (
              <div className="text-[12px] text-ink3 bg-surface2 rounded-lg px-3 py-2.5 leading-[1.5]">
                <Trans
                  t={t}
                  i18nKey="userModal.defaultPassword"
                  components={{
                    code: <strong className="text-ink2" style={{ fontFamily: 'var(--font-mono)' }} />,
                    b: <strong className="text-ink2" />,
                  }}
                />
              </div>
            )}
          </Form>
        </Modal>
      )}
    </Formik>
  )
}

// ─── Users Tab ──────────────────────────────────────────────────────────────────
// Where a user works: owners everywhere, everyone else per property with a role.
function AccessChips({ user }) {
  const { t } = useTranslation('users')
  if (user.isOwner) return <Badge type="gold">{t('table.allProperties')}</Badge>
  if (!user.access?.length) return <span className="t-xs text-ink3">{t('table.none')}</span>
  return (
    <div className="flex flex-wrap gap-1">
      {user.access.map((a) => (
        <span
          key={a.propertyId}
          title={`${a.propertyName} — ${a.roleName}`}
          className="inline-flex items-center gap-1 text-xs px-1.5 py-[2px] rounded-[4px] bg-surface2 border border-line text-ink2 whitespace-nowrap"
        >
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{a.propertyCode}</strong> {a.roleName}
        </span>
      ))}
    </div>
  )
}

function UsersTab({ users, canManage, isOwner, multiProperty, onEdit, onAccess, onToggleStatus, onDelete }) {
  const { t } = useTranslation('users')
  const columns = [
    {
      key: 'user', header: t('table.user'), primary: true,
      render: (u) => (
        <div className="flex items-center gap-2.5 min-w-0 md:max-w-[280px]">
          <Avatar name={u.name} color={u.roleRef?.isOwner ? '#c9a84c' : '#2563eb'} />
          <div className="min-w-0">
            <div className="t-title truncate">
              {u.name}
              {u.isSuperAdmin && (
                <span className="ml-1.5 text-[9px] font-bold tracking-[0.06em] uppercase text-[#c9a84c] align-middle">{t('table.superAdmin')}</span>
              )}
            </div>
            <div className="text-xs text-ink3 mt-px truncate">{u.email}</div>
            {/* Phone + created move under the email until the table has room for their columns */}
            <div className="hidden lg:block 2xl:hidden text-xs text-ink3 truncate">
              {u.phone && <span style={{ fontFamily: 'var(--font-mono)' }}>{u.phone} · </span>}
              {t('table.added', { when: timeAgo(u.createdAt) })}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'status', header: t('table.status'), primary: true,
      render: (u) => (
        <Badge type={u.status === 'active' ? 'green' : 'grey'}>
          {u.status === 'active' ? t('common:active') : t('common:inactive')}
        </Badge>
      ),
    },
    {
      key: 'role', header: multiProperty ? t('table.roleHere') : t('table.role'),
      render: (u) => (u.roleRef
        ? <Badge type={u.roleRef.isOwner ? 'gold' : 'purple'}>{u.roleRef.name}</Badge>
        : <span className="t-xs text-ink3">{multiProperty ? t('table.noAccessHere') : '—'}</span>),
    },
    {
      key: 'phone', header: t('table.phone'), hideBelow: '2xl', className: 'text-[12px]',
      render: (u) => <span style={{ fontFamily: 'var(--font-mono)' }}>{u.phone || '—'}</span>,
    },
    ...(multiProperty ? [{
      key: 'access', header: t('table.properties'), className: 'whitespace-normal min-w-[180px] max-w-[260px]',
      render: (u) => <AccessChips user={u} />,
    }] : []),
    { key: 'created', header: t('table.created'), hideBelow: '2xl', render: (u) => <span className="t-xs">{timeAgo(u.createdAt)}</span> },
    ...(canManage ? [{
      // Buttons wrap into two rows until the table is wide enough (2xl) for one.
      key: 'actions', header: '', align: 'right', className: 'whitespace-normal min-w-[170px] 2xl:min-w-0',
      render: (u) => (
        <div className="flex gap-[5px] flex-wrap justify-end 2xl:flex-nowrap">
          <button className="btn btn-xs btn-outline" onClick={() => onEdit(u)}>{t('table.edit')}</button>
          {isOwner && !u.isOwner && (
            <button className="btn btn-xs btn-outline" onClick={() => onAccess(u)}>{t('table.access')}</button>
          )}
          {!u.isSuperAdmin && (
            <>
              <button
                className={`btn btn-xs ${u.status === 'active' ? 'btn-outline' : 'btn-success'}`}
                onClick={() => onToggleStatus(u)}
              >
                {u.status === 'active' ? t('table.deactivate') : t('table.reactivate')}
              </button>
              <button className="btn btn-xs btn-danger" onClick={() => onDelete(u)}>{isOwner ? t('table.delete') : t('table.remove')}</button>
            </>
          )}
        </div>
      ),
    }] : []),
  ]

  return (
    <div>
      <div className="t-sm text-ink3 mb-3">{t('usersCount', { count: users.length })}</div>
      <TableCard>
        <DataTable
          columns={columns}
          rows={users}
          tableFrom="lg"
          empty={<div className="empty-state">{t('table.empty')}</div>}
        />
      </TableCard>
    </div>
  )
}

// ─── Property Access Modal (owner) ──────────────────────────────────────────────
// Pick every property a non-owner can open and the role they hold at each one.
function AccessModal({ user, properties, roles, onClose, onSave }) {
  const { t } = useTranslation('users')
  const assignable = roles.filter((r) => !r.isOwner)
  const fallbackRole = assignable.find((r) => r.name === 'Staff')?.id || assignable[0]?.id || ''
  const [access, setAccess] = useState(() =>
    Object.fromEntries((user.access || []).map((a) => [a.propertyId, a.roleId])),
  )
  const [saving, setSaving] = useState(false)

  const toggle = (id) => setAccess((a) => {
    const next = { ...a }
    if (next[id]) delete next[id]
    else next[id] = user.roleRef && !user.roleRef.isOwner ? user.roleRef.id : fallbackRole
    return next
  })
  const setRole = (id, roleId) => setAccess((a) => ({ ...a, [id]: roleId }))

  async function save() {
    setSaving(true)
    await onSave(Object.entries(access).map(([propertyId, roleId]) => ({ propertyId, roleId })))
    setSaving(false)
  }

  const count = Object.keys(access).length
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('accessModal.title', { name: user.name })}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common:cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? t('common:saving') : t('accessModal.save')}
          </button>
        </>
      }
    >
      <p className="t-sm text-ink3 mt-0 mb-3.5">
        {t('accessModal.intro', { name: user.name })}
      </p>
      <ul className="list-none m-0 p-0 border border-line rounded-lg divide-y divide-[var(--border)]">
        {properties.map((p) => {
          const on = !!access[p.id]
          return (
            <li key={p.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <label className={`flex items-center gap-3 flex-1 min-w-0 cursor-pointer pointer-coarse:min-h-11 ${on ? '' : 'opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(p.id)}
                  aria-label={t('accessModal.accessAria', { name: p.name })}
                  className="w-4 h-4 pointer-coarse:w-5 pointer-coarse:h-5 shrink-0 cursor-pointer rounded text-gold focus:ring-gold/30 accent-[var(--gold)]"
                />
                <span className="min-w-0">
                  <span className="t-title block truncate">{p.name}</span>
                  <span className="t-xs text-ink3 block" style={{ fontFamily: 'var(--font-mono)' }}>
                    {p.code}{p.status === 'archived' ? t('accessModal.archived') : ''}
                  </span>
                </span>
              </label>
              <select
                className={`form-select t-xs px-2 py-1.5 w-full sm:w-[160px] shrink-0 ${on ? '' : 'opacity-60'}`}
                value={access[p.id] || ''}
                disabled={!on}
                onChange={(e) => setRole(p.id, e.target.value)}
                aria-label={t('accessModal.roleAria', { name: p.name })}
              >
                {!on && <option value="">—</option>}
                {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </li>
          )
        })}
      </ul>
      {count === 0 && (
        <p className="t-xs text-danger mt-3 mb-0">{t('accessModal.noneWarning', { name: user.name })}</p>
      )}
    </Modal>
  )
}

// ─── Role Editor Modal ────────────────────────────────────────────────────────
function RoleModal({ isOpen, onClose, role, modules, onSave }) {
  const { t } = useTranslation('users')
  const isEdit = !!role
  const [name, setName] = useState(role?.name || '')
  const [description, setDescription] = useState(role?.description || '')
  const [perms, setPerms] = useState(() => {
    const base = {}
    modules.forEach((m) => { base[m] = role?.permissions?.[m] || 'NONE' })
    return base
  })

// Mounted fresh (keyed by role) each time it opens, so the initial state is enough.
  const setLevel = (mod, level) => setPerms((p) => ({ ...p, [mod]: level }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('roleModal.editTitle', { name: role.name }) : t('roleModal.createTitle')}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common:cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({
              name: name.trim(),
              description: description.trim() || null,
              permissions: modules.map((m) => ({ module: m, level: perms[m] })),
            })}
          >
            {isEdit ? t('roleModal.save') : t('roleModal.create')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="form-label">{t('roleModal.name')}</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('roleModal.namePlaceholder')} />
        </div>
        <div>
          <label className="form-label">{t('roleModal.description')}</label>
          <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('roleModal.descriptionPlaceholder')} />
        </div>

        <div>
          <label className="form-label">{t('roleModal.moduleAccess')}</label>
          <ul className="list-none m-0 p-0 border border-line rounded-lg divide-y divide-[var(--border)]">
            {modules.map((m) => (
              <li key={m} className="flex items-center justify-between gap-3 px-3 py-2">
                <label htmlFor={`perm-${m}`} className="t-title min-w-0 truncate">{moduleLabel(t, m)}</label>
                <select
                  id={`perm-${m}`}
                  className="form-select t-xs px-2 py-1.5 w-[120px] sm:w-[140px] shrink-0"
                  value={perms[m]}
                  onChange={(e) => setLevel(m, e.target.value)}
                >
                  {LEVELS.map((l) => <option key={l} value={l}>{t(`levels.${l}`)}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

// ─── Roles Tab ──────────────────────────────────────────────────────────────────
function RolesTab({ roles, modules, canManage, onEdit, onDelete }) {
  const { t } = useTranslation('users')
  return (
    <div>
      <div className="t-sm text-ink3 mb-3">{t('rolesCount', { count: roles.length })}</div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {roles.map((r) => (
          <div key={r.id} className="rounded-[10px] border border-line p-4 bg-surface min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                  <span className="t-title text-[14px]">{r.name}</span>
                  {r.isOwner && <Badge type="gold">{t('roles.owner')}</Badge>}
                  {r.isSystem && !r.isOwner && <Badge type="grey">{t('roles.system')}</Badge>}
                  <span className="t-xs text-ink3">{t('roleUsers', { count: r.userCount ?? 0 })}</span>
                </div>
                {r.description && <div className="t-xs text-ink3 mt-1">{r.description}</div>}
              </div>
              {canManage && (
                <div className="flex gap-[5px] shrink-0">
                  {!r.isOwner && <button className="btn btn-xs btn-outline" onClick={() => onEdit(r)}>{t('table.edit')}</button>}
                  {!r.isSystem && <button className="btn btn-xs btn-danger" onClick={() => onDelete(r)}>{t('table.delete')}</button>}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {modules.map((m) => {
                const lvl = r.isOwner ? 'MANAGE' : (r.permissions?.[m] || 'NONE')
                if (lvl === 'NONE') return null
                return (
                  <Badge key={m} type={LEVEL_BADGE[lvl]}>
                    {moduleLabel(t, m)}: {t(`levels.${lvl}`)}
                  </Badge>
                )
              })}
              {!r.isOwner && modules.every((m) => (r.permissions?.[m] || 'NONE') === 'NONE') && (
                <span className="t-xs text-ink3">{t('roles.noModuleAccess')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// ─── Security tab: self-service password change ───────────────────────────────
const passwordSchema = (t) => Yup.object({
  currentPassword: Yup.string().required(t('validation.currentRequired')),
  newPassword: Yup.string().max(128).required(t('validation.newRequired')),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], t('validation.mismatch'))
    .required(t('validation.confirmRequired')),
})

function SecurityTab() {
  const { t } = useTranslation('users')
  const schema = useMemo(() => passwordSchema(t), [t])
  const addToast = useToast()
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.currentUser)

  return (
    <div className="card w-full max-w-[460px]">
      <div className="card-header"><span className="card-title">{t('security.title')}</span></div>
      <div className="card-body">
        <Formik
          initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
          validationSchema={schema}
          onSubmit={async (values, { setSubmitting, resetForm }) => {
            try {
              const { data } = await authApi.changePassword({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
              })
              // The server reissues a token (other sessions are revoked). Keep this
              // session signed in by swapping the stored token.
              if (data?.token) {
                localStorage.setItem('qv_token', data.token)
                dispatch(setCredentials({ token: data.token, user: currentUser }))
              }
              addToast(t('security.updated'), 'success')
              resetForm()
            } catch (err) {
              addToast(err.response?.data?.error || t('security.failed'), 'error')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-3.5">
              <FormikField name="currentPassword" label={t('security.current')} type="password" required placeholder={t('security.currentPlaceholder')} />
              <FormikField name="newPassword" label={t('security.new')} type="password" required placeholder={t('security.newPlaceholder')} />
              <FormikField name="confirmPassword" label={t('security.confirm')} type="password" required placeholder={t('security.confirmPlaceholder')} />
              <div className="pt-2">
                <button type="submit" className="btn btn-primary w-full sm:w-auto justify-center" disabled={isSubmitting}>
                  {isSubmitting ? t('security.updating') : t('security.update')}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  )
}

export default function UsersRoles() {
  const { t } = useTranslation('users')
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const canManageUsers = useCan('users', 'MANAGE')                 // user CRUD needs users:manage
  const canManageRoles = !!currentUser?.isOwner // role management is owner-only
  const isOwner = !!currentUser?.isOwner
  const activeProperty = useAppSelector(selectActiveProperty)
  const properties = useAppSelector(selectProperties)
  const multiProperty = isOwner || properties.length > 1
  const addToast = useToast()

  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [userModal, setUserModal] = useState(null)     // { user } | { user: null } | null
  const [roleModal, setRoleModal] = useState(null)     // { role } | { role: null } | null
  const [accessModal, setAccessModal] = useState(null) // user | null
  const [confirm, setConfirm]     = useState(null)     // { kind: 'user'|'role', item } | null
  const [deleting, setDeleting]   = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [u, r, m] = await Promise.all([usersApi.getAll(), rolesApi.getAll(), rolesApi.getModules()])
      setUsers(Array.isArray(u.data) ? u.data : (u.data.users || []))
      setRoles(Array.isArray(r.data) ? r.data : (r.data.roles || []))
      setModules(m.data.modules || [])
    } catch {
      setError(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { loadAll() }, [loadAll])

  // ── User actions ──
  async function saveUser(form) {
    try {
      if (userModal?.user) {
        await usersApi.update(userModal.user.id, form)
        addToast(t('toast.userUpdated'), 'success')
      } else {
        const { data } = await usersApi.create(form)
        addToast(
          data?.defaultPassword
            ? t('toast.userCreatedWithPassword', { password: data.defaultPassword })
            : t('toast.userCreated'),
          'success',
        )
      }
      setUserModal(null)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || t('toast.userSaveFailed'), 'error')
    }
  }

  async function saveAccess(access) {
    try {
      await usersApi.setAccess(accessModal.id, access)
      addToast(t('toast.accessUpdated', { name: accessModal.name }), 'success')
      setAccessModal(null)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || t('toast.accessFailed'), 'error')
    }
  }

  async function toggleUserStatus(u) {
    const status = u.status === 'active' ? 'inactive' : 'active'
    try {
      await usersApi.update(u.id, { status })
      addToast(status === 'active' ? t('toast.reactivated', { name: u.name }) : t('toast.deactivated', { name: u.name }), 'success')
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || t('toast.statusFailed'), 'error')
    }
  }

  // Delete is confirmed via <ConfirmModal> (no native window.confirm).
  async function runDelete() {
    if (!confirm) return
    const { kind, item } = confirm
    setDeleting(true)
    try {
      let message = t('toast.roleDeleted')
      if (kind === 'user') {
        const { data } = await usersApi.remove(item.id)
        message = data?.removedFromProperty ? t('toast.removedFrom', { name: item.name, property: activeProperty?.name || t('thisProperty') }) : t('toast.userDeleted')
      } else {
        await rolesApi.remove(item.id)
      }
      addToast(message, 'success')
      setConfirm(null)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || (kind === 'user' ? t('toast.deleteUserFailed') : t('toast.deleteRoleFailed')), 'error')
    } finally {
      setDeleting(false)
    }
  }

  // ── Role actions ──
  async function saveRole(form) {
    try {
      if (roleModal?.role) {
        await rolesApi.update(roleModal.role.id, form)
        addToast(t('toast.roleUpdated'), 'success')
      } else {
        await rolesApi.create(form)
        addToast(t('toast.roleCreated'), 'success')
      }
      setRoleModal(null)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || t('toast.roleSaveFailed'), 'error')
    }
  }


  const tabs = [
    { id: 'users', label: t('tabs.users') },
    { id: 'roles', label: t('tabs.roles') },
    { id: 'security', label: t('tabs.security') },
  ]

  return (
    <PageWrapper
      title={t('title')}
      subtitle={!multiProperty
        ? t('subtitleSingle')
        : isOwner
          ? t('subtitleOwner', { property: activeProperty?.name || t('thisProperty') })
          : t('subtitleTeam', { property: activeProperty?.name || t('thisProperty') })}
      // The add button follows the open tab, as it did when it sat inside each tab.
      headerActions={[
        activeTab === 'users' && canManageUsers && {
          id: 'add-user', label: t('addUser'), icon: <LuUserPlus />, variant: 'primary', onClick: () => setUserModal({ user: null }),
        },
        activeTab === 'roles' && canManageRoles && {
          id: 'add-role', label: t('createRole'), icon: <LuPlus />, variant: 'primary', onClick: () => setRoleModal({ role: null }),
        },
      ]}
    >

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">{error}</div>
      )}
      {loading && <p className="t-sm text-ink3 mb-3">{t('common:loading')}</p>}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="users">
          <UsersTab
            users={users}
            canManage={canManageUsers}
            isOwner={isOwner}
            multiProperty={multiProperty}
            onEdit={(u) => setUserModal({ user: u })}
            onAccess={(u) => setAccessModal(u)}
            onToggleStatus={toggleUserStatus}
            onDelete={(u) => setConfirm({ kind: 'user', item: u })}
          />
        </div>
        <div data-tab-id="roles">
          <RolesTab
            roles={roles}
            modules={modules}
            canManage={canManageRoles}
            onEdit={(r) => setRoleModal({ role: r })}
            onDelete={(r) => setConfirm({ kind: 'role', item: r })}
          />
        </div>
        <div data-tab-id="security">
          <SecurityTab />
        </div>
      </Tabs>

      {userModal && (
        <UserModal
          isOpen
          onClose={() => setUserModal(null)}
          user={userModal.user}
          // Only an owner may hand out the org-wide Owner role.
          roles={isOwner ? roles : roles.filter((r) => !r.isOwner)}
          propertyName={multiProperty ? activeProperty?.name : null}
          onSave={saveUser}
        />
      )}
      {accessModal && (
        <AccessModal
          user={accessModal}
          properties={properties}
          roles={roles}
          onClose={() => setAccessModal(null)}
          onSave={saveAccess}
        />
      )}
      {roleModal && (
        <RoleModal
          key={roleModal.role?.id || 'new'}
          isOpen
          onClose={() => setRoleModal(null)}
          role={roleModal.role}
          modules={modules}
          onSave={saveRole}
        />
      )}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runDelete}
        busy={deleting}
        danger
        title={confirm?.kind === 'role' ? t('confirm.deleteRole') : isOwner ? t('confirm.deleteUser') : t('confirm.removeFromProperty')}
        confirmLabel={confirm?.kind === 'user' && !isOwner ? t('common:remove') : t('common:delete')}
        message={
          <Trans
            t={t}
            i18nKey={confirm?.kind === 'role' ? 'confirm.deleteRoleMessage' : isOwner ? 'confirm.deleteUserMessage' : 'confirm.removeUserMessage'}
            values={{ name: confirm?.item?.name, property: activeProperty?.name }}
            components={{ b: <strong className="text-ink" /> }}
          />
        }
      />
    </PageWrapper>
  )
}
