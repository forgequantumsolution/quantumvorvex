import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuPlus, LuPencil, LuEyeOff, LuEye } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import { Card, Button, Field, ActionMenu } from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { expensesApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import { GROUPS } from './expenseUtils'

function CategoryModal({ category, defaultGroup, onClose, onSaved }) {
  const { t } = useTranslation('expenses')
  const toast = useToast()
  const [name, setName] = useState(category?.name || '')
  const [group, setGroup] = useState(category?.group || defaultGroup || GROUPS[0])
  const [budget, setBudget] = useState(category?.monthlyBudget != null ? String(category.monthlyBudget) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) { setError(t('categories.errors.name')); return }
    setSaving(true)
    const body = { name: name.trim(), group, monthlyBudget: budget === '' ? null : Math.max(0, Number(budget) || 0) }
    try {
      if (category) await expensesApi.updateCategory(category.id, body)
      else await expensesApi.createCategory(body)
      toast(t('categories.saved', { name: body.name }))
      onSaved()
    } catch (err) {
      toast(err.response?.data?.message || t('toast.failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} maxWidth="460px" title={category ? t('categories.editTitle') : t('categories.addTitle')}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button onClick={save} disabled={saving}>{saving ? t('common:saving') : t('common:save')}</Button>
      </>}>
      <form className="space-y-3.5" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        <Field label={t('categories.name')} required value={name} error={error} autoFocus
          onChange={(e) => { setName(e.target.value); setError('') }} />
        <Field label={t('categories.group')} value={group} onChange={(e) => setGroup(e.target.value)}
          options={GROUPS.map((g) => ({ value: g, label: t(`groups.${g}`) }))} />
        <Field label={t('categories.budget')} type="number" inputMode="decimal" min="0" value={budget} placeholder="—"
          hint={t('categories.budgetHint')} onChange={(e) => setBudget(e.target.value)} />
      </form>
    </Modal>
  )
}

/** Categories tab: the property's expense heads by group, with monthly budgets. */
// The category form's state lives in the page, so the header's "Add category" can open it.
export default function ExpenseCategories({ categories, canManage, onChanged, editing, onEdit: setEditing }) {
  const { t } = useTranslation('expenses')
  const toast = useToast()

  const toggle = async (c) => {
    try {
      await expensesApi.updateCategory(c.id, { active: c.active === false })
      toast(c.active === false ? t('categories.activated', { name: c.name }) : t('categories.deactivated', { name: c.name }))
      onChanged()
    } catch (err) {
      toast(err.response?.data?.message || t('toast.failed'), 'error')
    }
  }

  const groups = GROUPS.map((g) => ({
    group: g,
    items: categories.filter((c) => c.group === g).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink3 max-w-xl">{t('categories.intro')}</p>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {groups.map(({ group, items }) => (
          <Card key={group} title={t(`groups.${group}`)} subtitle={t(`groupHelp.${group}`)}
            actions={canManage ? (
              <button type="button" onClick={() => setEditing({ group })} aria-label={t('categories.addTo', { group: t(`groups.${group}`) })}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg border border-line2 text-ink2 flex items-center justify-center hover:border-gold hover:text-gold">
                <LuPlus size={15} />
              </button>
            ) : null}>
            {items.length ? (
              <ul className="divide-y divide-line">
                {items.map((c) => (
                  <li key={c.id} className={`flex items-center gap-3 px-4 sm:px-5 py-2.5 text-sm ${c.active === false ? 'opacity-55' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-ink truncate">{c.name}</div>
                      <div className="text-xs text-ink3">
                        {c.active === false ? t('categories.inactive')
                          : c.monthlyBudget != null ? t('categories.budgetValue', { amount: formatCurrency(c.monthlyBudget) }) : t('categories.noBudget')}
                      </div>
                    </div>
                    {canManage && (
                      <ActionMenu items={[
                        { label: t('categories.edit'), icon: <LuPencil size={14} />, onClick: () => setEditing(c) },
                        c.active === false
                          ? { label: t('categories.activate'), icon: <LuEye size={14} />, onClick: () => toggle(c) }
                          : { label: t('categories.deactivate'), icon: <LuEyeOff size={14} />, onClick: () => toggle(c), danger: true },
                      ]} />
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 sm:px-5 py-3 text-sm text-ink3">{t('categories.empty')}</p>}
          </Card>
        ))}
      </div>

      {editing && (
        <CategoryModal
          category={editing.id ? editing : null}
          defaultGroup={editing.group}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged() }}
        />
      )}
    </div>
  )
}
