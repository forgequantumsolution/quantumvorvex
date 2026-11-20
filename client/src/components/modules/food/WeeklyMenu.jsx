import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuSave, LuCopy } from 'react-icons/lu'
import { Card, Button } from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { foodApi } from '../../../api/client'
import { appLocale } from '../../../i18n'
import { MEALS, MEAL_ICONS, WEEKDAYS } from './foodUtils'

const key = (weekday, meal) => `${weekday}:${meal}`
// A Sunday in a known week, to get localized weekday names.
const weekdayName = (wd, style = 'long') => new Date(2026, 10, 15 + wd).toLocaleDateString(appLocale(), { weekday: style })

/**
 * The weekly menu: what is served at each meal on each weekday. Shown on the
 * meal sheet and the dashboard. Staff with MANAGE edit it in place.
 */
export default function WeeklyMenu({ canManage }) {
  const { t } = useTranslation('food')
  const toast = useToast()
  const [saved, setSaved] = useState(null)   // { "wd:meal": text } as on the server
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const todayWd = new Date().getDay()

  useEffect(() => {
    foodApi.menu().then(({ data }) => {
      const m = Object.fromEntries(data.items.map((i) => [key(i.weekday, i.meal), i.items]))
      setSaved(m); setDraft(m)
    }).catch(() => { setSaved({}); setDraft({}) })
  }, [])

  // Snacks only shows as a row when it is used, to keep the grid short.
  const meals = useMemo(() => MEALS.filter((m) => m !== 'snacks' || Object.keys(draft).some((k) => k.endsWith(':snacks') && draft[k])), [draft])
  const [showSnacks, setShowSnacks] = useState(false)
  const rows = showSnacks && !meals.includes('snacks') ? MEALS : meals

  const changed = useMemo(() => {
    const keys = new Set([...Object.keys(saved || {}), ...Object.keys(draft)])
    return [...keys].filter((k) => (saved?.[k] || '').trim() !== (draft[k] || '').trim())
  }, [saved, draft])

  const save = async () => {
    setSaving(true)
    try {
      const items = changed.map((k) => { const [wd, meal] = k.split(':'); return { weekday: Number(wd), meal, items: draft[k] || '' } })
      const { data } = await foodApi.saveMenu(items)
      const m = Object.fromEntries(data.items.map((i) => [key(i.weekday, i.meal), i.items]))
      setSaved(m); setDraft(m)
      toast(t('menu.saved'))
    } catch (err) {
      toast(err.response?.data?.message || t('toast.failed'), 'error')
    } finally { setSaving(false) }
  }

  // Copy Monday's menu to every other day that is still empty.
  const fillFromMonday = () => setDraft((d) => {
    const next = { ...d }
    for (const wd of WEEKDAYS.slice(1)) for (const m of MEALS) if (!next[key(wd, m)] && d[key(1, m)]) next[key(wd, m)] = d[key(1, m)]
    return next
  })

  if (!saved) return <div className="h-80 rounded-xl bg-surface2 animate-pulse" />

  return (
    <Card title={t('menu.title')} subtitle={t('menu.subtitle')}
      actions={canManage && (
        <span className="flex flex-wrap gap-2">
          {!rows.includes('snacks') && <Button size="sm" variant="ghost" onClick={() => setShowSnacks(true)}>{t('menu.addSnacks')}</Button>}
          <Button size="sm" variant="ghost" icon={<LuCopy />} onClick={fillFromMonday}>{t('menu.copyMonday')}</Button>
          <Button size="sm" icon={<LuSave />} onClick={save} disabled={saving || !changed.length}>
            {changed.length ? t('menu.save', { count: changed.length }) : t('menu.allSaved')}
          </Button>
        </span>
      )}>
      {/* Wide screens: a weekday × meal grid. Small screens: one card per day. */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-28 px-3 py-2 text-left text-xs font-semibold text-ink3" />
              {WEEKDAYS.map((wd) => (
                <th key={wd} className={`px-2 py-2 text-left text-xs font-semibold ${wd === todayWd ? 'text-gold' : 'text-ink2'}`}>
                  {weekdayName(wd, 'short')}{wd === todayWd ? ` · ${t('sheet.today')}` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m} className="border-t border-line align-top">
                <th scope="row" className="px-3 py-2 text-left text-[13px] font-semibold text-ink whitespace-nowrap">
                  <span aria-hidden>{MEAL_ICONS[m]}</span> {t(`meals.${m}`)}
                </th>
                {WEEKDAYS.map((wd) => (
                  <td key={wd} className={`px-1.5 py-1.5 ${wd === todayWd ? 'bg-gold-bg/40' : ''}`}>
                    <MenuCell value={draft[key(wd, m)] || ''} disabled={!canManage}
                      label={`${weekdayName(wd)} ${t(`meals.${m}`)}`} placeholder={t('menu.placeholder')}
                      onChange={(v) => setDraft((d) => ({ ...d, [key(wd, m)]: v }))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lg:hidden px-4 py-3 space-y-3">
        {WEEKDAYS.map((wd) => (
          <section key={wd} className={`rounded-lg border px-3 py-2.5 ${wd === todayWd ? 'border-gold' : 'border-line'}`}>
            <h4 className="m-0 mb-2 text-[13px] font-semibold text-ink">{weekdayName(wd)}{wd === todayWd ? ` · ${t('sheet.today')}` : ''}</h4>
            <div className="space-y-2">
              {rows.map((m) => (
                <label key={m} className="block">
                  <span className="block text-xs text-ink3 mb-0.5"><span aria-hidden>{MEAL_ICONS[m]}</span> {t(`meals.${m}`)}</span>
                  <MenuCell value={draft[key(wd, m)] || ''} disabled={!canManage} placeholder={t('menu.placeholder')}
                    onChange={(v) => setDraft((d) => ({ ...d, [key(wd, m)]: v }))} />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  )
}

function MenuCell({ value, onChange, disabled, label, placeholder }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label}
      rows={2} maxLength={300} placeholder={disabled ? '' : placeholder}
      className="form-textarea w-full min-h-[56px] resize-y text-[13px] leading-snug disabled:bg-transparent disabled:border-transparent disabled:resize-none" />
  )
}
