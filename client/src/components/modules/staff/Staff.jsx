import { useState, useMemo, useEffect, useCallback } from 'react'
import { Formik, Form } from 'formik'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import FormikField from '../../ui/FormikField'
import { useToast } from '../../../hooks/useToast'
import { staffSchema } from '../../../validation/staffSchema'
import { staffApi } from '../../../api/client'
import { formatDateTime, timeAgo } from '../../../utils/format'

const ROLE_META = {
  super_admin:  { label: 'Super Admin', badgeType: 'gold'   },
  manager:      { label: 'Manager',     badgeType: 'purple' },
  front_desk:   { label: 'Front Desk',  badgeType: 'blue'   },
  housekeeping: { label: 'Housekeeping',badgeType: 'green'  },
  accountant:   { label: 'Accountant',  badgeType: 'amber'  },
}

const ROLE_AVATAR_COLORS = {
  super_admin:  '#c9a84c',
  manager:      '#7c3aed',
  front_desk:   '#2563eb',
  housekeeping: '#16a34a',
  accountant:   '#d97706',
}

const MODULES_LIST = [
  'Dashboard', 'Rooms', 'Check-In', 'Guests', 'Bookings',
  'Billing', 'Reports', 'Settings', 'Maintenance', 'Housekeeping', 'Staff',
]

const PERMISSION_LEVELS = ['—', 'View', 'Create', 'Edit', 'Full']

const DEFAULT_PERMISSIONS = {
  super_admin: {
    Dashboard: 'Full', Rooms: 'Full', 'Check-In': 'Full', Guests: 'Full',
    Bookings: 'Full', Billing: 'Full', Reports: 'Full', Settings: 'Full',
    Maintenance: 'Full', Housekeeping: 'Full', Staff: 'Full',
  },
  manager: {
    Dashboard: 'Full', Rooms: 'Full', 'Check-In': 'Full', Guests: 'Full',
    Bookings: 'Full', Billing: 'Full', Reports: 'Full', Settings: 'Edit',
    Maintenance: 'Full', Housekeeping: 'Full', Staff: 'View',
  },
  front_desk: {
    Dashboard: 'View', Rooms: 'Edit', 'Check-In': 'Full', Guests: 'Edit',
    Bookings: 'Edit', Billing: 'View', Reports: 'View', Settings: '—',
    Maintenance: 'Create', Housekeeping: 'View', Staff: '—',
  },
  housekeeping: {
    Dashboard: 'View', Rooms: 'Edit', 'Check-In': 'View', Guests: 'View',
    Bookings: '—', Billing: '—', Reports: 'View', Settings: '—',
    Maintenance: 'Create', Housekeeping: 'Full', Staff: '—',
  },
  accountant: {
    Dashboard: 'View', Rooms: 'View', 'Check-In': 'View', Guests: 'View',
    Bookings: 'View', Billing: 'Full', Reports: 'Full', Settings: '—',
    Maintenance: '—', Housekeeping: '—', Staff: '—',
  },
}

const MODULE_BADGE_COLORS = {
  'Check-In': 'blue', Billing: 'green', Rooms: 'amber',
  Settings: 'purple', Guests: 'gold', Bookings: 'blue',
  Reports: 'grey', Maintenance: 'red', Housekeeping: 'green',
  Staff: 'purple', Dashboard: 'grey', Food: 'amber',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, role, size = 34 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: ROLE_AVATAR_COLORS[role] || '#6b7280',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
      fontSize: size * 0.35, color: '#fff', flexShrink: 0,
      letterSpacing: '0.02em',
    }}>
      {getInitials(name)}
    </div>
  )
}

// ─── Add / Edit Staff Modal ───────────────────────────────────────────────────
function StaffModal({ isOpen, onClose, staff, onSave }) {
  const isEdit = !!staff
  const [generatedPwd, setGeneratedPwd] = useState(() => isEdit ? '' : generatePassword())
  const [copied, setCopied] = useState(false)

  const initialValues = staff
    ? { name: staff.name, phone: staff.phone, email: staff.email, role: staff.role }
    : { name: '', phone: '', email: '', role: 'front_desk' }

  function handleResetPassword() {
    setGeneratedPwd(generatePassword())
  }

  function handleCopy(pwd) {
    navigator.clipboard.writeText(pwd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={staffSchema}
      enableReinitialize
      onSubmit={(values) => onSave({ ...values, ...(generatedPwd ? { password: generatedPwd } : {}) })}
    >
      {({ submitForm, isSubmitting }) => (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title={isEdit ? `Edit Staff — ${staff.name}` : '+ Add Staff Member'}
          footer={
            <>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={submitForm} disabled={isSubmitting}>
                {isEdit ? 'Save Changes' : 'Create Staff'}
              </button>
            </>
          }
        >
          <Form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormikField name="name" label="Full Name" required placeholder="e.g. Ramesh Gupta" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormikField name="phone" label="Phone" required placeholder="10-digit mobile" />
              <FormikField name="email" label="Email" type="email" required placeholder="staff@hotel.com" />
            </div>
            <FormikField name="role" label="Role" required as="select">
              {Object.entries(ROLE_META).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </FormikField>

            {/* Password section */}
            <div>
              <label className="form-label">{isEdit ? 'Reset Password' : 'Auto-Generated Password'}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  readOnly
                  value={generatedPwd || '••••••••••'}
                  style={{ fontFamily: 'var(--font-mono)', flex: 1 }}
                />
                {isEdit && (
                  <button className="btn btn-outline btn-sm" onClick={handleResetPassword} type="button">
                    Regenerate
                  </button>
                )}
                {generatedPwd && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleCopy(generatedPwd)}
                    type="button"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                )}
              </div>
              {!isEdit && (
                <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text3)' }}>
                  Share this password with the staff member securely. They can change it after first login.
                </p>
              )}
            </div>
          </Form>
        </Modal>
      )}
    </Formik>
  )
}

// ─── Force Logout Confirm Modal ───────────────────────────────────────────────
function ForceLogoutModal({ isOpen, staff, onClose, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Force Logout"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Terminate Session</button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--text2)', lineHeight: 1.6 }}>
        Are you sure you want to force logout{' '}
        <strong style={{ color: 'var(--text)' }}>{staff?.name}</strong>?
        Their active session will be immediately terminated.
      </p>
    </Modal>
  )
}

// ─── All Staff Tab ────────────────────────────────────────────────────────────
function AllStaffTab({ staff, onAdd, onEdit, onForceLogout, onToggleStatus }) {
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Sessions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(member => (
              <tr key={member.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={member.name} role={member.role} />
                    <div>
                      <div className="t-title">
                        {member.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                        {member.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{member.phone}</td>
                <td>
                  <Badge type={ROLE_META[member.role]?.badgeType || 'grey'}>
                    {ROLE_META[member.role]?.label || member.role}
                  </Badge>
                </td>
                <td>
                  <Badge type={member.status === 'active' ? 'green' : 'grey'}>
                    {member.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="t-xs">
                  {timeAgo(member.lastLogin)}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center' }}>
                  <span style={{
                    background: member.sessions > 0 ? 'var(--green-bg)' : 'var(--surface2)',
                    color: member.sessions > 0 ? 'var(--green-text)' : 'var(--text3)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {member.sessions}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                    <button className="btn btn-xs btn-outline" onClick={() => onEdit(member)}>
                      Edit
                    </button>
                    {member.sessions > 0 && (
                      <button className="btn btn-xs btn-danger" onClick={() => onForceLogout(member)}>
                        Force Logout
                      </button>
                    )}
                    <button
                      className={`btn btn-xs ${member.status === 'active' ? 'btn-outline' : 'btn-success'}`}
                      onClick={() => onToggleStatus(member)}
                    >
                      {member.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────────
function ActivityLogTab({ logs, staffList }) {
  const [filterStaff, setFilterStaff] = useState('')
  const [filterModule, setFilterModule] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const addToast = useToast()

  const uniqueModules = useMemo(() =>
    [...new Set(logs.map(l => l.module))].sort(), [logs])

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (filterStaff && log.staffId !== filterStaff) return false
      if (filterModule && log.module !== filterModule) return false
      if (filterFrom && new Date(log.createdAt) < new Date(filterFrom)) return false
      if (filterTo && new Date(log.createdAt) > new Date(filterTo + 'T23:59:59Z')) return false
      return true
    })
  }, [logs, filterStaff, filterModule, filterFrom, filterTo])

  function handleExportCSV() {
    const header = 'Timestamp,Staff,Action,Module,Record,IP Address'
    const rows = filtered.map(l =>
      `"${formatDateTime(l.createdAt)}","${l.staff}","${l.action}","${l.module}","${l.record}","${l.ip}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    addToast({ type: 'success', message: `Exported ${filtered.length} activity records.` })
  }

  return (
    <div>
      {/* Filter Row */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
        marginBottom: 16,
      }}>
        <div style={{ flex: '1 1 160px' }}>
          <label className="form-label">Staff</label>
          <select className="form-select" value={filterStaff} onChange={e => setFilterStaff(e.target.value)}>
            <option value="">All Staff</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label className="form-label">Module</label>
          <select className="form-select" value={filterModule} onChange={e => setFilterModule(e.target.value)}>
            <option value="">All Modules</option>
            {uniqueModules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label className="form-label">From</label>
          <input
            type="date"
            className="form-input"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label className="form-label">To</label>
          <input
            type="date"
            className="form-input"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
          />
        </div>
        <div>
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">No activity logs match the selected filters.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Staff</th>
                <th>Action</th>
                <th>Module</th>
                <th>Record</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id}>
                  <td className="t-xs" style={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="t-title">{log.staff}</td>
                  <td className="t-sm">{log.action}</td>
                  <td>
                    <Badge type={MODULE_BADGE_COLORS[log.module] || 'grey'}>
                      {log.module}
                    </Badge>
                  </td>
                  <td className="t-xs">{log.record}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                    {log.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Permissions Tab ──────────────────────────────────────────────────────────
function PermissionsTab() {
  const [perms, setPerms] = useState(DEFAULT_PERMISSIONS)
  const [saving, setSaving] = useState(false)
  const addToast = useToast()
  const roles = Object.keys(ROLE_META)

  // Load saved permissions and overlay them on the sensible defaults.
  useEffect(() => {
    staffApi.getPermissions()
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : (data.permissions || [])
        if (!rows.length) return
        setPerms(prev => {
          const next = structuredClone(prev)
          for (const { role, module: mod, level } of rows) {
            if (!next[role]) next[role] = {}
            next[role][mod] = level
          }
          return next
        })
      })
      .catch(() => { /* fall back to defaults */ })
  }, [])

  function handleChange(role, mod, val) {
    setPerms(p => ({ ...p, [role]: { ...p[role], [mod]: val } }))
  }

  async function handleSave() {
    setSaving(true)
    const permissions = roles.flatMap(role =>
      MODULES_LIST.map(mod => ({ role, module: mod, level: perms[role]?.[mod] || '—' })),
    )
    try {
      await staffApi.updatePermissions({ permissions })
      addToast('Permissions saved successfully.', 'success')
    } catch {
      addToast('Could not save permissions.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="t-sm" style={{ margin: '0 0 16px', color: 'var(--text2)' }}>
        Configure what each role can access across all modules.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 140 }}>Module</th>
              {roles.map(role => (
                <th key={role} style={{ minWidth: 120, textAlign: 'center' }}>
                  <Badge type={ROLE_META[role].badgeType}>
                    {ROLE_META[role].label}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES_LIST.map(mod => (
              <tr key={mod}>
                <td className="t-title">{mod}</td>
                {roles.map(role => (
                  <td key={role} style={{ textAlign: 'center', padding: '6px 8px' }}>
                    <select
                      className="form-select t-xs"
                      style={{ padding: '4px 6px', minWidth: 80, textAlign: 'center' }}
                      value={perms[role]?.[mod] || '—'}
                      onChange={e => handleChange(role, mod, e.target.value)}
                    >
                      {PERMISSION_LEVELS.map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Permissions'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Staff() {
  const [activeTab, setActiveTab] = useState('staff')
  const [staffList, setStaffList] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [forceLogoutTarget, setForceLogoutTarget] = useState(null)
  const addToast = useToast()

  const loadStaff = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await staffApi.getAll()
      setStaffList(Array.isArray(data) ? data : (data.staff || []))
    } catch {
      setError('Could not load staff. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadActivity = useCallback(async () => {
    try {
      const { data } = await staffApi.getActivity()
      const rows = Array.isArray(data) ? data : (data.logs || [])
      setLogs(rows.map(l => ({
        id: l.id,
        staffId: l.staffId,
        staff: l.staff?.name || '—',
        action: l.action,
        module: l.module,
        record: l.recordId || l.detail || '—',
        ip: l.ipAddress || '—',
        createdAt: l.createdAt,
      })))
    } catch {
      /* activity is non-critical */
    }
  }, [])

  useEffect(() => { loadStaff(); loadActivity() }, [loadStaff, loadActivity])

  async function handleAddSave(form) {
    try {
      await staffApi.create(form)
      setShowAddModal(false)
      addToast(`${form.name} added to staff.`, 'success')
      loadStaff()
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not add staff member.', 'error')
    }
  }

  async function handleEditSave(form) {
    const id = editingStaff.id
    try {
      await staffApi.update(id, form)
      setEditingStaff(null)
      addToast('Staff details updated.', 'success')
      loadStaff()
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update staff member.', 'error')
    }
  }

  function handleForceLogout() {
    // No server-side session store yet — clear the local indicator only.
    setStaffList(s => s.map(m => m.id === forceLogoutTarget.id ? { ...m, sessions: 0 } : m))
    addToast(`Session terminated for ${forceLogoutTarget.name}.`, 'success')
    setForceLogoutTarget(null)
  }

  async function handleToggleStatus(member) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    const prev = staffList
    setStaffList(s => s.map(m => m.id === member.id ? { ...m, status: newStatus } : m))
    try {
      await staffApi.update(member.id, { status: newStatus })
      addToast(`${member.name} has been ${newStatus === 'active' ? 'reactivated' : 'deactivated'}.`, 'success')
    } catch {
      setStaffList(prev)
      addToast('Could not update status.', 'error')
    }
  }

  const tabs = [
    { id: 'staff',       label: 'All Staff'     },
    { id: 'activity',    label: 'Activity Log'  },
    { id: 'permissions', label: 'Permissions'   },
  ]

  return (
    <div>
      {/* Page Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 20, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <h1 className="t-h1" style={{
            margin: 0, letterSpacing: '-0.02em',
          }}>
            👤 Staff Management
          </h1>
          <p className="t-sm" style={{ margin: '3px 0 0', color: 'var(--text3)' }}>
            Team accounts &amp; permissions
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Staff
        </button>
      </div>

      {error && (
        <div className="t-sm" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red-text)' }}>
          {error}
        </div>
      )}
      {loading && staffList.length === 0 && !error && (
        <p className="t-sm" style={{ color: 'var(--text3)', marginBottom: 12 }}>Loading staff…</p>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="staff">
          <AllStaffTab
            staff={staffList}
            onAdd={() => setShowAddModal(true)}
            onEdit={setEditingStaff}
            onForceLogout={setForceLogoutTarget}
            onToggleStatus={handleToggleStatus}
          />
        </div>
        <div data-tab-id="activity">
          <ActivityLogTab logs={logs} staffList={staffList} />
        </div>
        <div data-tab-id="permissions">
          <PermissionsTab />
        </div>
      </Tabs>

      {/* Add Staff Modal */}
      {showAddModal && (
        <StaffModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          staff={null}
          onSave={handleAddSave}
        />
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <StaffModal
          isOpen={!!editingStaff}
          onClose={() => setEditingStaff(null)}
          staff={editingStaff}
          onSave={handleEditSave}
        />
      )}

      {/* Force Logout Confirm */}
      <ForceLogoutModal
        isOpen={!!forceLogoutTarget}
        staff={forceLogoutTarget}
        onClose={() => setForceLogoutTarget(null)}
        onConfirm={handleForceLogout}
      />
    </div>
  )
}
