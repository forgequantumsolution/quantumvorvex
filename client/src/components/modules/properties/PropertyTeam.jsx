import { useState, useEffect, useCallback } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { LuUserPlus, LuUsers, LuX, LuRefreshCw } from 'react-icons/lu'
import { Button } from '../../ui-tw'
import { ActionButton, RowDelete, TablePager } from '../settings/settingsUi'
import { usePaged } from '../settings/usePaged'
import Badge from '../../ui/Badge'
import ConfirmModal from '../../ui/ConfirmModal'
import { useToast } from '../../../hooks/useToast'
import { useUiActions } from '../../../store/hooks'
import { propertiesApi, usersApi, rolesApi } from '../../../api/client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY = []

function Avatar({ name }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="w-8 h-8 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center shrink-0">
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
  const { t } = useTranslation('settings')
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
      setError(t('team.loadFailed'))
    }
  }, [property.id, t])

  useEffect(() => { load() }, [load])

  const pager = usePaged(team?.members ?? EMPTY, 6)

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
      await after(t('team.canOpen', { person: person?.name, property: property.name }))
    } catch (err) {
      addToast(err.response?.data?.error || t('team.addFailed'), 'error')
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
          ? t('team.addedWithPassword', { name: data.name, password: data.defaultPassword })
          : t('team.added', { name: data.name, property: property.name }),
      )
    } catch (err) {
      addToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || t('team.createFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(member, roleId) {
    try {
      await propertiesApi.setMember(property.id, member.id, roleId)
      await after(t('team.roleChanged', { name: member.name, role: roles.find((r) => r.id === roleId)?.name, property: property.name }))
    } catch (err) {
      addToast(err.response?.data?.error || t('team.roleFailed'), 'error')
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await propertiesApi.removeMember(property.id, removing.id)
      const name = removing.name
      setRemoving(null)
      await after(t('team.removed', { name, property: property.name }))
    } catch (err) {
      addToast(err.response?.data?.error || t('team.removeFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 flex-wrap t-xs text-danger px-4 sm:px-5 py-3">
        {error}
        <ActionButton icon={<LuRefreshCw />} onClick={load}>{t('common:retry')}</ActionButton>
      </div>
    )
  }
  if (!team) return <div className="t-xs text-ink3 px-4 py-3">{t('team.loading')}</div>

  const nameError  = mode === 'invite' && form.name.trim().length < 2
  const emailError = mode === 'invite' && !EMAIL_RE.test(form.email.trim())
  const canSubmit  = form.roleId && (mode === 'existing' ? !!form.userId : !nameError && !emailError)

  return (
    <div className="px-4 sm:px-5 py-4 flex flex-col gap-3 bg-surface2/40">
      {/* Assigned staff */}
      {team.members.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-surface2 px-3.5 py-3">
          <LuUsers size={16} className="text-ink3 shrink-0" aria-hidden />
          <span className="t-sm text-ink2">{t('team.noStaff')}</span>
        </div>
      ) : (
        <div className="border border-line rounded-lg bg-surface overflow-hidden">
          <ul className="list-none m-0 p-0 flex flex-col divide-y divide-[var(--border)]">
            {pager.rows.map((m) => (
              <li key={m.id} className="flex items-center gap-x-3 gap-y-2 px-3 py-2.5 flex-wrap">
                <Avatar name={m.name} />
                {/* Phones: name fills the first line; role + Remove share the next */}
                <div className="flex-1 min-w-0 basis-[calc(100%-3.5rem)] sm:basis-[160px]">
                  <div className={`text-[13px] font-semibold truncate ${m.status === 'active' ? 'text-ink' : 'text-ink3 line-through'}`}>{m.name}</div>
                  <div className="t-xs text-ink3 truncate">{m.email}{m.status !== 'active' ? t('team.inactive') : ''}</div>
                </div>
                <label className="sr-only" htmlFor={`role-${property.id}-${m.id}`}>{t('team.roleAria', { name: m.name, property: property.name })}</label>
                <select
                  id={`role-${property.id}-${m.id}`}
                  className="form-select t-xs px-2 py-1.5 flex-1 min-w-0 basis-[140px] sm:flex-none sm:basis-auto sm:w-[170px]"
                  value={m.roleId}
                  disabled={archived}
                  onChange={(e) => changeRole(m, e.target.value)}
                >
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <RowDelete onClick={() => setRemoving(m)} disabled={archived} label={t('team.removeAria', { name: m.name, property: property.name })} />
              </li>
            ))}
          </ul>
          <TablePager pager={pager} />
        </div>
      )}

      {/* Add / invite */}
      {!archived && (mode ? (
        <div className="rounded-lg border border-[var(--gold-border)] bg-[var(--gold-bg)] p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex bg-surface border border-line rounded-lg p-[3px] gap-[3px] min-w-0" role="tablist">
              {[['existing', t('team.existing')], ['invite', t('team.newPerson')]].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => openForm(key)}
                  className={`text-[12px] font-semibold px-3 py-1.5 pointer-coarse:min-h-10 rounded-md border-none cursor-pointer ${mode === key ? 'bg-gold text-[#000]' : 'bg-transparent text-ink2'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="bg-transparent border-none cursor-pointer text-ink3 hover:text-ink p-1 w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 flex items-center justify-center shrink-0" onClick={() => setMode(null)} aria-label={t('common:cancel')}>
              <LuX size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px] gap-2.5 items-end">
            {mode === 'existing' ? (
              <div className="flex flex-col gap-[5px] md:col-span-2">
                <label className="form-label text-[12px] font-semibold">{t('team.person')}</label>
                <select className="form-select" value={form.userId} onChange={set('userId')}>
                  <option value="">{available.length ? t('team.choosePerson') : t('team.everyoneHasAccess')}</option>
                  {available.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-[5px]">
                  <label className="form-label text-[12px] font-semibold">{t('team.fullName')}</label>
                  <input className="form-input" value={form.name} onChange={set('name')} placeholder={t('team.fullNamePlaceholder')} autoFocus />
                </div>
                <div className="flex flex-col gap-[5px]">
                  <label className="form-label text-[12px] font-semibold">{t('common:email')}</label>
                  <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="anita@hotel.com" />
                </div>
              </>
            )}
            <div className="flex flex-col gap-[5px]">
              <label className="form-label text-[12px] font-semibold">{t('team.roleHere')}</label>
              <select className="form-select" value={form.roleId} onChange={set('roleId')}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="t-xs text-ink3">
              {mode === 'invite' ? t('team.inviteHint') : t('team.existingHint')}
              {' '}{t('team.needRole')}{' '}
              <button type="button" className="bg-transparent border-none p-0 cursor-pointer text-[var(--gold2)] font-semibold underline" onClick={() => setActivePanel('users')}>
                {t('team.createRole')}
              </button>
            </span>
            <Button size="sm" icon={<LuUserPlus />} className="w-full sm:w-auto" onClick={mode === 'existing' ? addExisting : invite} disabled={!canSubmit || busy}>
              {busy ? t('common:saving') : mode === 'existing' ? t('team.giveAccess') : t('team.createAndGive')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <ActionButton icon={<LuUserPlus />} onClick={() => openForm('existing')}>{t('team.addExisting')}</ActionButton>
          <ActionButton icon={<LuUserPlus />} onClick={() => openForm('invite')}>{t('team.inviteNew')}</ActionButton>
        </div>
      ))}

      {/* Owners — implicit, read-only */}
      {team.owners.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap t-xs text-ink3">
          <span>{t('team.ownersLabel')}</span>
          {team.owners.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1.5" title={o.email}>
              <span className="text-ink2 font-medium">{o.name}</span><Badge type="gold">{t('team.owner')}</Badge>
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
        title={t('team.removeTitle')}
        confirmLabel={t('common:remove')}
        message={
          <Trans
            t={t}
            i18nKey="team.removeMessage"
            values={{ name: removing?.name, property: property.name }}
            components={{ b: <strong className="text-ink" /> }}
          />
        }
      />
    </div>
  )
}
