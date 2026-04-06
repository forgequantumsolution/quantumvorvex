import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { formatDateTime, timeAgo } from '../../../utils/format'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_STAFF = [
  { id: '1', name: 'Ramesh Gupta',  phone: '9876543210', email: 'ramesh@hotel.com', role: 'super_admin',  status: 'active',   lastLogin: '2026-04-06T08:30:00Z', sessions: 1 },
  { id: '2', name: 'Priya Sharma',  phone: '9123456789', email: 'priya@hotel.com',  role: 'manager',      status: 'active',   lastLogin: '2026-04-06T07:15:00Z', sessions: 1 },
  { id: '3', name: 'Ankit Verma',   phone: '9988776655', email: 'ankit@hotel.com',  role: 'front_desk',   status: 'active',   lastLogin: '2026-04-05T20:00:00Z', sessions: 0 },
  { id: '4', name: 'Sunita Rao',    phone: '9654321098', email: 'sunita@hotel.com', role: 'housekeeping', status: 'active',   lastLogin: '2026-04-06T06:00:00Z', sessions: 1 },
  { id: '5', name: 'Deepak CA',     phone: '9543210987', email: 'deepak@hotel.com', role: 'accountant',   status: 'inactive', lastLogin: '2026-03-20T10:00:00Z', sessions: 0 },
]

const ACTIVITY_LOGS = [
  { id: '1', staffId: '1', staff: 'Ramesh Gupta',  action: 'Guest Checked In',    module: 'Check-In', record: 'DOC-0001',      ip: '192.168.1.1', createdAt: '2026-04-06T08:45:00Z' },
  { id: '2', staffId: '2', staff: 'Priya Sharma',  action: 'Invoice Generated',   module: 'Billing',  record: 'INV-006',       ip: '192.168.1.2', createdAt: '2026-04-06T08:30:00Z' },
  { id: '3', staffId: '3', staff: 'Ankit Verma',   action: 'Room Status Updated', module: 'Rooms',    record: 'Room 104',      ip: '192.168.1.3', createdAt: '2026-04-05T22:00:00Z' },
  { id: '4', staffId: '1', staff: 'Ramesh Gupta',  action: 'Settings Updated',    module: 'Settings', record: 'Tax & Pricing', ip: '192.168.1.1', createdAt: '2026-04-05T15:00:00Z' },
  { id: '5', staffId: '2', staff: 'Priya Sharma',  action: 'Guest Checked Out',   module: 'Guests',   record: 'DOC-0005',      ip: '192.168.1.2', createdAt: '2026-04-05T12:30:00Z' },
]

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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Syne', sans-serif", fontWeight: 700,
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
  const [form, setForm] = useState(staff ? {
    name: staff.name, phone: staff.phone, email: staff.email, role: staff.role,
  } : { name: '', phone: '', email: '', role: 'front_desk' })
  const [generatedPwd, setGeneratedPwd] = useState(() => isEdit ? '' : generatePassword())
  const [copied, setCopied] = useState(false)
  const addToast = useToast()

  function handleChange(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  function handleResetPassword() {
    const pwd = generatePassword()
    setGeneratedPwd(pwd)
  }

  function handleCopy(pwd) {
    navigator.clipboard.writeText(pwd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) {
      addToast({ type: 'error', message: 'Name and email are required.' })
      return
    }
    onSave({ ...form })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Staff — ${staff.name}` : '+ Add Staff Member'}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Create Staff'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="form-label">Full Name</label>
          <input
            className="form-input"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="e.g. Ramesh Gupta"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Phone</label>
            <input
              className="form-input"
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="10-digit mobile"
            />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="staff@hotel.com"
            />
          </div>
        </div>
        <div>
          <label className="form-label">Role</label>
          <select
            className="form-select"
            value={form.role}
            onChange={e => handleChange('role', e.target.value)}
          >
            {Object.entries(ROLE_META).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Password section */}
        <div>
          <label className="form-label">{isEdit ? 'Reset Password' : 'Auto-Generated Password'}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="form-input"
              readOnly
              value={generatedPwd || '••••••••••'}
              style={{ fontFamily: 'monospace', flex: 1 }}
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
      </div>
    </Modal>
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
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
                        {member.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                        {member.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{member.phone}</td>
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
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {timeAgo(member.lastLogin)}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}>
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
                  <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{log.staff}</td>
                  <td style={{ fontSize: 13 }}>{log.action}</td>
                  <td>
                    <Badge type={MODULE_BADGE_COLORS[log.module] || 'grey'}>
                      {log.module}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 12 }}>{log.record}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text3)' }}>
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
  const addToast = useToast()
  const roles = Object.keys(ROLE_META)

  function handleChange(role, mod, val) {
    setPerms(p => ({ ...p, [role]: { ...p[role], [mod]: val } }))
  }

  function handleSave() {
    addToast({ type: 'success', message: 'Permissions saved successfully.' })
  }

  return (
    <div>
      <p style={{ margin: '0 0 16px', color: 'var(--text2)', fontSize: 13 }}>
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
                <td style={{ fontWeight: 600, fontSize: 13 }}>{mod}</td>
                {roles.map(role => (
                  <td key={role} style={{ textAlign: 'center', padding: '6px 8px' }}>
                    <select
                      className="form-select"
                      style={{ fontSize: 12, padding: '4px 6px', minWidth: 80, textAlign: 'center' }}
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
        <button className="btn btn-primary" onClick={handleSave}>
          Save Permissions
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Staff() {
  const [activeTab, setActiveTab] = useState('staff')
  const [staffList, setStaffList] = useState(MOCK_STAFF)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [forceLogoutTarget, setForceLogoutTarget] = useState(null)
  const addToast = useToast()

  function handleAddSave(form) {
    const newMember = {
      id: String(Date.now()),
      ...form,
      status: 'active',
      lastLogin: null,
      sessions: 0,
    }
    setStaffList(s => [...s, newMember])
    setShowAddModal(false)
    addToast({ type: 'success', message: `${form.name} added to staff.` })
  }

  function handleEditSave(form) {
    setStaffList(s => s.map(m => m.id === editingStaff.id ? { ...m, ...form } : m))
    setEditingStaff(null)
    addToast({ type: 'success', message: 'Staff details updated.' })
  }

  function handleForceLogout() {
    setStaffList(s => s.map(m => m.id === forceLogoutTarget.id ? { ...m, sessions: 0 } : m))
    addToast({ type: 'success', message: `Session terminated for ${forceLogoutTarget.name}.` })
    setForceLogoutTarget(null)
  }

  function handleToggleStatus(member) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    setStaffList(s => s.map(m => m.id === member.id ? { ...m, status: newStatus } : m))
    addToast({
      type: 'success',
      message: `${member.name} has been ${newStatus === 'active' ? 'reactivated' : 'deactivated'}.`,
    })
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
          <h1 style={{
            margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 22,
            fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em',
          }}>
            👤 Staff Management
          </h1>
          <p style={{ margin: '3px 0 0', color: 'var(--text3)', fontSize: 13 }}>
            Team accounts &amp; permissions
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Staff
        </button>
      </div>

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
          <ActivityLogTab logs={ACTIVITY_LOGS} staffList={staffList} />
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
