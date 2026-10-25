import { useState, useEffect, useCallback } from 'react'
import { LuUserPlus, LuUsers, LuX } from 'react-icons/lu'
import Badge from '../../ui/Badge'
import ConfirmModal from '../../ui/ConfirmModal'
import { useToast } from '../../../hooks/useToast'
import { useUiActions } from '../../../store/hooks'
import { propertiesApi, usersApi, rolesApi } from '../../../api/client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Avatar({ name }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="w-8 h-8 rounded-full bg-[#2563eb] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
      {initials}
    </span>
  )
}

/**
 * The team of one property: who can open it and the role each person holds
 * there (Receptionist, Manager, …). Owners see every property automatically.
 * Add an existing person, invite a new one, change a role, or remove access.
 */
export default function PropertyTeam({ property, onChanged }) {
  const addToast = useToast()
  const { setActivePanel } = useUiActions()
  const [team, setTeam] = useState(null)
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [error, setError] = useState('')
  const [mode, setMode] = useState(null)                // null | 'existing' | 'invite'
  const [form, setForm] = useState({ userId: '', name: '', email: '', roleId: '' })
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [m, u, r] = await Promise.all([propertiesApi.getMembers(property.id), usersApi.getAll(), rolesApi.getAll()])
      setTeam(m.data)
      setUsers(Array.isArray(u.data) ? u.data : [])
      setRoles((Array.isArray(r.data) ? r.data : []).filter((role) => !role.isOwner))
    } catch {
      setError('Could not load this property\'s team.')
    }
  }, [property.id])

  useEffect(() => { load() }, [load])

  const archived = property.status === 'archived'
  const memberIds = new Set(team?.members.map((m) => m.id))
  const available = users.filter((u) => !u.isOwner && !memberIds.has(u.id))
  const defaultRoleId = roles.find((r) => r.name === 'Staff')?.id || roles[0]?.id || ''
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const openForm = (next) => {
    setMode(next)
    setForm({ userId: '', name: '', email: '', roleId: defaultRoleId })
  }

  const after = async (message) => {
    addToast(message, 'success')
    setMode(null)
    await load()
    onChanged?.()
  }

  async function addExisting() {
    const person = users.find((u) => u.id === form.userId)
    setBusy(true)
    try {
      await propertiesApi.setMember(property.id, form.userId, form.roleId)
      await after(`${person?.name} can now open ${property.name}.`)
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not add this person.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function invite() {
    setBusy(true)
    try {
      const { data } = await usersApi.createIn(property.id, { name: form.name.trim(), email: form.email.trim(), roleId: form.roleId })
      await after(
        data?.defaultPassword
          ? `${data.name} added. Temporary password: ${data.defaultPassword}`
          : `${data.name} added to ${property.name}.`,
      )
    } catch (err) {
      addToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Could not create the account.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(member, roleId) {
    try {
      await propertiesApi.setMember(property.id, member.id, roleId)
      await after(`${member.name} is now ${roles.find((r) => r.id === roleId)?.name} at ${property.name}.`)
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not change the role.', 'error')
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await propertiesApi.removeMember(property.id, removing.id)
      const name = removing.name
      setRemoving(null)
      await after(`${name} no longer has access to ${property.name}.`)
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not remove access.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="t-xs text-danger px-4 py-3">{error} <button className="btn btn-xs btn-outline ml-2" onClick={load}>Retry</button></div>
  if (!team) return <div className="t-xs text-ink3 px-4 py-3">Loading team…</div>

  const nameError  = mode === 'invite' && form.name.trim().length < 2
  const emailError = mode === 'invite' && !EMAIL_RE.test(form.email.trim())
  const canSubmit  = form.roleId && (mode === 'existing' ? !!form.userId : !nameError && !emailError)

  return (
    <div className="px-4 py-3.5 flex flex-col gap-3">
      {/* Assigned staff */}
      {team.members.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-surface2 px-3.5 py-3">
          <LuUsers size={16} className="text-ink3 shrink-0" aria-hidden />
          <span className="t-sm text-ink2">No staff assigned yet. Add the people who will work here and choose their role.</span>
        </div>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col divide-y divide-[var(--border)] border border-line rounded-lg">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
              <Avatar name={m.name} />
              <div className="flex-1 min-w-[160px]">
                <div className={`text-[13px] font-semibold ${m.status === 'active' ? 'text-ink' : 'text-ink3 line-through'}`}>{m.name}</div>
                <div className="t-xs text-ink3">{m.email}{m.status !== 'active' ? ' · inactive' : ''}</div>
              </div>
              <label className="sr-only" htmlFor={`role-${property.id}-${m.id}`}>Role of {m.name} at {property.name}</label>
              <select
                id={`role-${property.id}-${m.id}`}
                className="form-select t-xs px-2 py-1.5"
                style={{ width: 170 }}
                value={m.roleId}
                disabled={archived}
                onChange={(e) => changeRole(m, e.target.value)}
              >
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button
                className="btn btn-xs btn-outline gap-1"
                onClick={() => setRemoving(m)}
                disabled={archived}
                aria-label={`Remove ${m.name} from ${property.name}`}
              >
                <LuX size={12} aria-hidden /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add / invite */}
      {!archived && (mode ? (
        <div className="rounded-lg border border-[var(--gold-border)] bg-[var(--gold-bg)] p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex bg-surface border border-line rounded-lg p-[3px] gap-[3px]" role="tablist">
              {[['existing', 'Existing person'], ['invite', 'New person']].map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => openForm(key)}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer ${mode === key ? 'bg-gold text-[#000]' : 'bg-transparent text-ink2'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="bg-transparent border-none cursor-pointer text-ink3 p-1" onClick={() => setMode(null)} aria-label="Cancel">
              <LuX size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px] gap-2.5 items-end">
            {mode === 'existing' ? (
              <div className="flex flex-col gap-[5px] md:col-span-2">
                <label className="form-label text-[12px] font-semibold">Person</label>
                <select className="form-select" value={form.userId} onChange={set('userId')}>
                  <option value="">{available.length ? 'Choose a person…' : 'Everyone already has access'}</option>
                  {available.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-[5px]">
                  <label className="form-label text-[12px] font-semibold">Full name</label>
                  <input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. Anita Desai" autoFocus />
                </div>
                <div className="flex flex-col gap-[5px]">
                  <label className="form-label text-[12px] font-semibold">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="anita@hotel.com" />
                </div>
              </>
            )}
            <div className="flex flex-col gap-[5px]">
              <label className="form-label text-[12px] font-semibold">Role here</label>
              <select className="form-select" value={form.roleId} onChange={set('roleId')}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="t-xs text-ink3">
              {mode === 'invite'
                ? 'They sign in with this email and the temporary password Welcome@123.'
                : 'Their other properties are not affected.'}
              {' '}Need a role like Receptionist?{' '}
              <button className="bg-transparent border-none p-0 cursor-pointer text-[var(--gold2)] font-semibold underline" onClick={() => setActivePanel('users')}>
                Create it in Users &amp; Roles
              </button>
            </span>
            <button className="btn btn-primary btn-sm" onClick={mode === 'existing' ? addExisting : invite} disabled={!canSubmit || busy}>
              {busy ? 'Saving…' : mode === 'existing' ? 'Give access' : 'Create & give access'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-outline btn-sm gap-1.5" onClick={() => openForm('existing')}>
            <LuUserPlus size={14} aria-hidden /> Add existing person
          </button>
          <button className="btn btn-outline btn-sm gap-1.5" onClick={() => openForm('invite')}>
            <LuUserPlus size={14} aria-hidden /> Invite new person
          </button>
        </div>
      ))}

      {/* Owners — implicit, read-only */}
      {team.owners.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap t-xs text-ink3">
          <span>Also has access as owner:</span>
          {team.owners.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1.5" title={o.email}>
              <span className="text-ink2 font-medium">{o.name}</span><Badge type="gold">Owner</Badge>
            </span>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        busy={busy}
        danger
        title="Remove access"
        confirmLabel="Remove"
        message={<>Remove <strong className="text-ink">{removing?.name}</strong> from <strong className="text-ink">{property.name}</strong>? Their account and access to other properties are not affected.</>}
      />
    </div>
  )
}
