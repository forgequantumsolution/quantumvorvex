import { useState, useEffect, useCallback } from 'react'
import { Formik, Form } from 'formik'
import * as Yup from 'yup'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import FormikField from '../../ui/FormikField'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector, useAppDispatch } from '../../../store/hooks'
import { setCredentials } from '../../../store/slices/authSlice'
import { useCan } from '../../../hooks/useCan'
import { usersApi, rolesApi, authApi } from '../../../api/client'
import { userSchema } from '../../../validation/userSchema'
import { timeAgo } from '../../../utils/format'

// Friendly labels for backend module keys (server/src/config/modules.js).
const MODULE_LABELS = {
  bookings: 'Bookings', maintenance: 'Maintenance', guests: 'Guests', rooms: 'Rooms',
  documents: 'Documents', food: 'Food', housekeeping: 'Housekeeping', billing: 'Billing',
  reports: 'Reports', settings: 'Settings', users: 'Users & Roles',
}
const LEVELS = [
  { value: 'NONE', label: 'None' },
  { value: 'VIEW', label: 'View' },
  { value: 'MANAGE', label: 'Manage' },
]
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
function UserModal({ isOpen, onClose, user, roles, onSave }) {
  const isEdit = !!user
  const isSuper = !!user?.isSuperAdmin
  const defaultRoleId = roles.find((r) => r.name === 'Staff')?.id || roles[0]?.id || ''

  const initialValues = user
    ? { name: user.name, email: user.email, phone: user.phone || '', roleId: user.roleId || defaultRoleId, status: user.status || 'active', password: '' }
    : { name: '', email: '', phone: '', roleId: defaultRoleId, status: 'active', password: '' }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={userSchema}
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
          title={isEdit ? `Edit User — ${user.name}` : '+ Add User'}
          footer={
            <>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={submitForm} disabled={isSubmitting}>
                {isEdit ? 'Save Changes' : 'Create User'}
              </button>
            </>
          }
        >
          <Form className="flex flex-col gap-3.5" autoComplete="off">
            <FormikField name="name" label="Full Name" required placeholder="e.g. Ramesh Gupta" autoComplete="off" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormikField name="email" label="Email" type="email" required placeholder="user@hotel.com" autoComplete="off" />
              <FormikField name="phone" label="Phone" placeholder="10-digit mobile" autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormikField name="roleId" label="Role" required as="select" disabled={isSuper}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </FormikField>
              <FormikField name="status" label="Status" as="select" disabled={isSuper}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </FormikField>
            </div>
            {isSuper && (
              <p className="mt-[-6px] mb-0 text-[11px] text-ink3">
                This is the protected super-admin — role and status are locked. You can still update the name and password.
              </p>
            )}
            {isEdit ? (
              <FormikField
                name="password"
                label="Reset Password (optional)"
                type="password"
                autoComplete="new-password"
                placeholder="Leave blank to keep current"
              />
            ) : (
              <div className="text-[12px] text-ink3 bg-surface2 rounded-lg px-3 py-2.5 leading-[1.5]">
                The user is created with the default password{' '}
                <strong className="text-ink2" style={{ fontFamily: 'var(--font-mono)' }}>Welcome@123</strong>.
                They can change it from <strong className="text-ink2">Change Password</strong> after signing in.
              </div>
            )}
          </Form>
        </Modal>
      )}
    </Formik>
  )
}

// ─── Users Tab ──────────────────────────────────────────────────────────────────
function UsersTab({ users, roles, canManage, onAdd, onEdit, onToggleStatus, onDelete }) {
  return (
    <div>
      {canManage && (
        <div className="flex justify-end mb-3">
          <button className="btn btn-primary" onClick={onAdd}>+ Add User</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} color={u.roleRef?.isOwner ? '#c9a84c' : '#2563eb'} />
                    <div>
                      <div className="t-title">
                        {u.name}
                        {u.isSuperAdmin && (
                          <span className="ml-1.5 text-[9px] font-bold tracking-[0.06em] uppercase text-[#c9a84c] align-middle">★ Super Admin</span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink3 mt-px">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="text-[12px]" style={{ fontFamily: 'var(--font-mono)' }}>{u.phone || '—'}</td>
                <td><Badge type={u.roleRef?.isOwner ? 'gold' : 'purple'}>{u.roleRef?.name || '—'}</Badge></td>
                <td>
                  <Badge type={u.status === 'active' ? 'green' : 'grey'}>
                    {u.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="t-xs">{timeAgo(u.createdAt)}</td>
                {canManage && (
                  <td>
                    <div className="flex gap-[5px] flex-nowrap">
                      <button className="btn btn-xs btn-outline" onClick={() => onEdit(u)}>Edit</button>
                      {!u.isSuperAdmin && (
                        <>
                          <button
                            className={`btn btn-xs ${u.status === 'active' ? 'btn-outline' : 'btn-success'}`}
                            onClick={() => onToggleStatus(u)}
                          >
                            {u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                          </button>
                          <button className="btn btn-xs btn-danger" onClick={() => onDelete(u)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <div className="empty-state">No users yet.</div>}
    </div>
  )
}

// ─── Role Editor Modal ────────────────────────────────────────────────────────
function RoleModal({ isOpen, onClose, role, modules, onSave }) {
  const isEdit = !!role
  const [name, setName] = useState(role?.name || '')
  const [description, setDescription] = useState(role?.description || '')
  const [perms, setPerms] = useState(() => {
    const base = {}
    modules.forEach((m) => { base[m] = role?.permissions?.[m] || 'NONE' })
    return base
  })

  useEffect(() => {
    setName(role?.name || '')
    setDescription(role?.description || '')
    const base = {}
    modules.forEach((m) => { base[m] = role?.permissions?.[m] || 'NONE' })
    setPerms(base)
  }, [role, modules])

  const setLevel = (mod, level) => setPerms((p) => ({ ...p, [mod]: level }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Role — ${role.name}` : '+ Create Role'}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({
              name: name.trim(),
              description: description.trim() || null,
              permissions: modules.map((m) => ({ module: m, level: perms[m] })),
            })}
          >
            {isEdit ? 'Save Role' : 'Create Role'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="form-label">Role Name</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Accountant" />
        </div>
        <div>
          <label className="form-label">Description</label>
          <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for" />
        </div>

        <div>
          <label className="form-label">Module Access</label>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th className="min-w-[150px]">Module</th><th className="text-center min-w-[150px]">Access Level</th></tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m}>
                    <td className="t-title">{MODULE_LABELS[m] || m}</td>
                    <td className="text-center">
                      <select
                        className="form-select t-xs px-1.5 py-1 min-w-[110px] text-center"
                        value={perms[m]}
                        onChange={(e) => setLevel(m, e.target.value)}
                      >
                        {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Roles Tab ──────────────────────────────────────────────────────────────────
function RolesTab({ roles, modules, canManage, onAdd, onEdit, onDelete }) {
  return (
    <div>
      {canManage && (
        <div className="flex justify-end mb-3">
          <button className="btn btn-primary" onClick={onAdd}>+ Create Role</button>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {roles.map((r) => (
          <div key={r.id} className="rounded-[10px] border border-line p-4 bg-surface">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="t-title text-[14px]">{r.name}</span>
                  {r.isOwner && <Badge type="gold">Owner</Badge>}
                  {r.isSystem && !r.isOwner && <Badge type="grey">System</Badge>}
                  <span className="t-xs text-ink3">{r.userCount ?? 0} user{(r.userCount ?? 0) === 1 ? '' : 's'}</span>
                </div>
                {r.description && <div className="t-xs text-ink3 mt-1">{r.description}</div>}
              </div>
              {canManage && (
                <div className="flex gap-[5px]">
                  {!r.isOwner && <button className="btn btn-xs btn-outline" onClick={() => onEdit(r)}>Edit</button>}
                  {!r.isSystem && <button className="btn btn-xs btn-danger" onClick={() => onDelete(r)}>Delete</button>}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {modules.map((m) => {
                const lvl = r.isOwner ? 'MANAGE' : (r.permissions?.[m] || 'NONE')
                if (lvl === 'NONE') return null
                return (
                  <Badge key={m} type={LEVEL_BADGE[lvl]}>
                    {MODULE_LABELS[m] || m}: {LEVELS.find((l) => l.value === lvl)?.label}
                  </Badge>
                )
              })}
              {!r.isOwner && modules.every((m) => (r.permissions?.[m] || 'NONE') === 'NONE') && (
                <span className="t-xs text-ink3">No module access</span>
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
const passwordSchema = Yup.object({
  currentPassword: Yup.string().required('Enter your current password'),
  newPassword: Yup.string().max(128).required('Enter a new password'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match')
    .required('Confirm your new password'),
})

function SecurityTab() {
  const addToast = useToast()
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.currentUser)

  return (
    <div className="card max-w-[460px]">
      <div className="card-header"><span className="card-title">Change Password</span></div>
      <div className="card-body">
        <Formik
          initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
          validationSchema={passwordSchema}
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
              addToast('Password updated.', 'success')
              resetForm()
            } catch (err) {
              addToast(err.response?.data?.error || 'Could not change password.', 'error')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-3.5">
              <FormikField name="currentPassword" label="Current Password" type="password" required placeholder="Current password" />
              <FormikField name="newPassword" label="New Password" type="password" required placeholder="Enter a new password" />
              <FormikField name="confirmPassword" label="Confirm New Password" type="password" required placeholder="Re-enter new password" />
              <div className="pt-2">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating…' : 'Update Password'}
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
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const canManageUsers = useCan('users', 'MANAGE')                 // user CRUD needs users:manage
  const canManageRoles = !!currentUser?.isOwner // role management is owner-only
  const addToast = useToast()

  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [userModal, setUserModal] = useState(null)     // { user } | { user: null } | null
  const [roleModal, setRoleModal] = useState(null)     // { role } | { role: null } | null
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
      setError('Could not load users & roles. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── User actions ──
  async function saveUser(form) {
    try {
      if (userModal?.user) {
        await usersApi.update(userModal.user.id, form)
        addToast('User updated.', 'success')
      } else {
        const { data } = await usersApi.create(form)
        addToast(
          data?.defaultPassword
            ? `User created. Default password: ${data.defaultPassword}`
            : 'User created.',
          'success',
        )
      }
      setUserModal(null)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not save user.', 'error')
    }
  }

  async function toggleUserStatus(u) {
    const status = u.status === 'active' ? 'inactive' : 'active'
    try {
      await usersApi.update(u.id, { status })
      addToast(`${u.name} ${status === 'active' ? 'reactivated' : 'deactivated'}.`, 'success')
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update status.', 'error')
    }
  }

  // Delete is confirmed via <ConfirmModal> (no native window.confirm).
  async function runDelete() {
    if (!confirm) return
    const { kind, item } = confirm
    setDeleting(true)
    try {
      if (kind === 'user') await usersApi.remove(item.id)
      else await rolesApi.remove(item.id)
      addToast(kind === 'user' ? 'User deleted.' : 'Role deleted.', 'success')
      setConfirm(null)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || `Could not delete ${kind}.`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  // ── Role actions ──
  async function saveRole(form) {
    try {
      if (roleModal?.role) {
        await rolesApi.update(roleModal.role.id, form)
        addToast('Role updated.', 'success')
      } else {
        await rolesApi.create(form)
        addToast('Role created.', 'success')
      }
      setRoleModal(null)
      loadAll()
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not save role.', 'error')
    }
  }


  const tabs = [
    { id: 'users', label: 'Users' },
    { id: 'roles', label: 'Roles' },
    { id: 'security', label: 'Security' },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="t-h1 m-0 tracking-[-0.02em]">Users &amp; Roles</h1>
          <p className="t-sm mt-[3px] mb-0 text-ink3">
            Accounts and what each role can access
          </p>
        </div>
      </div>

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">{error}</div>
      )}
      {loading && <p className="t-sm text-ink3 mb-3">Loading…</p>}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="users">
          <UsersTab
            users={users}
            roles={roles}
            canManage={canManageUsers}
            onAdd={() => setUserModal({ user: null })}
            onEdit={(u) => setUserModal({ user: u })}
            onToggleStatus={toggleUserStatus}
            onDelete={(u) => setConfirm({ kind: 'user', item: u })}
          />
        </div>
        <div data-tab-id="roles">
          <RolesTab
            roles={roles}
            modules={modules}
            canManage={canManageRoles}
            onAdd={() => setRoleModal({ role: null })}
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
          roles={roles}
          onSave={saveUser}
        />
      )}
      {roleModal && (
        <RoleModal
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
        title={confirm?.kind === 'role' ? 'Delete role' : 'Delete user'}
        confirmLabel="Delete"
        message={
          confirm?.kind === 'role'
            ? <>Delete the <strong className="text-ink">{confirm?.item?.name}</strong> role? This cannot be undone.</>
            : <>Delete <strong className="text-ink">{confirm?.item?.name}</strong>? This cannot be undone.</>
        }
      />
    </div>
  )
}
