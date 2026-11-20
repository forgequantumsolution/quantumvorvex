import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuChevronLeft, LuChevronRight, LuCheck, LuCheckCheck, LuSearch } from 'react-icons/lu'
import { Card, Button, EmptyState } from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { foodApi } from '../../../api/client'
import { appLocale } from '../../../i18n'
import { MEAL_ICONS, dateInput, todayInput, shortDate } from './foodUtils'
import { DietTag } from './CustomerDetailModal'

const shift = (ymd, n) => { const d = new Date(`${ymd}T00:00`); d.setDate(d.getDate() + n); return dateInput(d) }

/**
 * The kitchen's daily sheet: for a day, each meal's headcount (who is on a plan
 * that includes it), today's menu, and a tick per person as they are served.
 * Future days are read-only — a headcount for planning.
 */
export default function MealSheet({ canManage, onOpen, onChanged }) {
  const { t } = useTranslation('food')
  const toast = useToast()
  const [date, setDate] = useState(todayInput())
  const [data, setData] = useState(null)
  const [meal, setMeal] = useState(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const reqId = useRef(0)

  const today = todayInput()
  const future = date > today
  const editable = canManage && !future

  const load = useCallback(async () => {
    const id = ++reqId.current
    try {
      const { data: d } = await foodApi.meals(date)
      if (id !== reqId.current) return
      setData(d.meals)
      // Keep the chosen meal if it is still on the sheet; else the next one due by the clock.
      setMeal((cur) => {
        if (cur && d.meals.some((m) => m.meal === cur)) return cur
        const h = new Date().getHours()
        const byClock = h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snacks' : 'dinner'
        return (d.meals.find((m) => m.meal === byClock) || d.meals[0])?.meal || null
      })
    } catch { if (id === reqId.current) setData([]) }
  }, [date])
  useEffect(() => { setData(null); load() }, [load])

  const row = data?.find((m) => m.meal === meal)
  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = row?.people || []
    return q ? list.filter((p) => [p.name, p.roomNumber, p.customerNo, p.phone].some((v) => v && String(v).toLowerCase().includes(q))) : list
  }, [row, query])

  // Optimistic tick; rolled back if the server says no.
  const setServed = async (p, served) => {
    const patch = (on) => setData((ms) => ms.map((m) => (m.meal !== meal ? m : {
      ...m, served: m.served + (on ? 1 : -1), people: m.people.map((x) => (x.id === p.id ? { ...x, served: on } : x)),
    })))
    patch(served)
    try { await foodApi.markMeal({ customerId: p.id, date, meal, served }); onChanged?.() } catch (err) {
      patch(!served)
      toast(err.response?.data?.message || t('toast.failed'), 'error')
    }
  }

  const markAll = async (served) => {
    setBusy(true)
    try { await foodApi.markMealAll({ date, meal, served }); await load(); onChanged?.() } catch (err) {
      toast(err.response?.data?.message || t('toast.failed'), 'error')
    } finally { setBusy(false) }
  }

  const dayLabel = date === today ? t('sheet.today') : date === shift(today, -1) ? t('sheet.yesterday') : date === shift(today, 1) ? t('sheet.tomorrow') : shortDate(`${date}T00:00`)

  return (
    <div className="space-y-4">
      {/* Day picker */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon={<LuChevronLeft />} onClick={() => setDate((d) => shift(d, -1))} aria-label={t('sheet.prevDay')} />
        <div className="min-w-[8.5rem] text-center">
          <div className="text-sm font-semibold text-ink">{dayLabel}</div>
          <div className="text-xs text-ink3">{new Date(`${date}T00:00`).toLocaleDateString(appLocale(), { weekday: 'long' })}</div>
        </div>
        <Button size="sm" variant="ghost" icon={<LuChevronRight />} onClick={() => setDate((d) => shift(d, 1))} aria-label={t('sheet.nextDay')} />
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t('sheet.pickDay')}
          className="form-input h-9 w-auto" />
        {date !== today && <Button size="sm" variant="ghost" onClick={() => setDate(today)}>{t('sheet.today')}</Button>}
      </div>

      {!data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-surface2 animate-pulse" />)}</div>
      ) : !data.length ? (
        <Card><EmptyState icon="🍽" title={t('sheet.emptyTitle')} message={t('sheet.empty')} /></Card>
      ) : (
        <>
          {/* One card per meal: served / expected, tap to open its list. */}
          <div role="tablist" aria-label={t('sheet.meals')} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {data.map((m) => {
              const on = m.meal === meal
              const pct = m.expected ? Math.round((m.served / m.expected) * 100) : 0
              return (
                <button key={m.meal} type="button" role="tab" aria-selected={on} onClick={() => setMeal(m.meal)}
                  className={`text-left rounded-xl border px-4 py-3 cursor-pointer transition-colors min-w-0 ${on ? 'border-gold bg-gold-bg' : 'border-line bg-surface hover:border-gold'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink"><span aria-hidden>{MEAL_ICONS[m.meal]}</span> {t(`meals.${m.meal}`)}</span>
                    <span className="text-xs text-ink3 tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-1 text-[22px] font-bold text-ink tabular-nums leading-none">
                    {future ? m.expected : <>{m.served}<span className="text-ink3 text-sm font-medium"> / {m.expected}</span></>}
                  </div>
                  <div className="text-xs text-ink3 mt-0.5">{future ? t('sheet.expected') : t('sheet.servedOf')}</div>
                  {!future && (
                    <div className="mt-2 h-1.5 rounded-full bg-surface2 overflow-hidden" aria-hidden>
                      <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {row && (
            <Card
              title={`${MEAL_ICONS[row.meal]} ${t(`meals.${row.meal}`)}`}
              subtitle={row.menu ? t('sheet.menu', { items: row.menu }) : t('sheet.noMenu')}
              actions={editable && row.expected > 0 && (
                row.served < row.expected
                  ? <Button size="sm" icon={<LuCheckCheck />} disabled={busy} onClick={() => markAll(true)}>{t('sheet.markAll')}</Button>
                  : <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm(t('sheet.clearConfirm')) && markAll(false)}>{t('sheet.clearAll')}</Button>
              )}
              bodyClassName="py-1"
            >
              {row.people.length > 6 && (
                <div className="px-4 sm:px-5 pt-3 pb-1">
                  <label className="relative block">
                    <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" size={14} aria-hidden />
                    <input className="form-input w-full pl-8" value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('sheet.search')} aria-label={t('sheet.search')} />
                  </label>
                </div>
              )}
              {!row.people.length ? <EmptyState icon="🍽" title={t('sheet.nobody')} /> : (
                <ul className="m-0 p-0 list-none divide-y divide-line">
                  {people.map((p) => (
                    <li key={p.id} className={`flex items-center gap-3 px-4 sm:px-5 py-2.5 min-w-0 ${p.served ? 'bg-success-bg/30' : ''}`}>
                      <button type="button" onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-medium text-ink truncate">{p.name}</span>
                          <DietTag diet={p.diet} />
                        </span>
                        <span className="block text-xs text-ink3 truncate">
                          {[p.roomNumber ? t('room', { room: p.roomNumber }) + (p.bedNo ? ` · ${t('bed', { bed: p.bedNo })}` : '') : t('source.outside'), p.planName].join(' · ')}
                        </span>
                      </button>
                      {editable ? (
                        <button type="button" role="checkbox" aria-checked={p.served} onClick={() => setServed(p, !p.served)}
                          aria-label={t(p.served ? 'sheet.unmark' : 'sheet.mark', { name: p.name })}
                          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 pointer-coarse:min-h-11 text-xs font-semibold cursor-pointer border ${
                            p.served ? 'border-success bg-success-bg text-success-text' : 'border-line2 bg-surface text-ink2 hover:border-gold hover:text-gold'}`}>
                          <LuCheck size={13} aria-hidden /> {p.served ? t('sheet.served') : t('sheet.serve')}
                        </button>
                      ) : p.served ? <span className="shrink-0 text-xs font-semibold text-success-text">{t('sheet.served')}</span> : null}
                    </li>
                  ))}
                  {!people.length && <li className="px-5 py-4 text-sm text-ink3">{t('sheet.noMatch')}</li>}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
