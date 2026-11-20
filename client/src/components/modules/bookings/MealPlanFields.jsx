import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '../../ui-tw'
import { foodApi } from '../../../api/client'
import { useCan } from '../../../hooks/useCan'

const DIETS = ['veg', 'non_veg', 'eggetarian', 'jain', 'vegan']
const MEAL_ICONS = { breakfast: '🌅', lunch: '🍛', snacks: '☕', dinner: '🌙' }

/** What the meal plan costs for this stay: per day × nights, or per month × months. */
function mealEstimate(plan, stayType, units) {
  if (!plan) return null
  const rate = stayType === 'daily' ? plan.oneTimeRate : plan.monthlyRate
  return rate > 0 ? rate * Math.max(1, units || 1) : null
}

/**
 * Optional meal plan for the guest(s) of a new booking. The Food module signs
 * them up for the length of the stay (dues are collected there). Hidden when
 * the user can't see Food or no meal plans exist; `wrap` puts the fields in
 * the form's section panel only when there is something to show.
 */
export default function MealPlanFields({ value, onChange, stayType, units, people = 1, wrap = (x) => x }) {
  const { t } = useTranslation('bookings')
  const canSee = useCan('food', 'VIEW')
  const [plans, setPlans] = useState(null)

  useEffect(() => {
    if (!canSee) return
    foodApi.getPlans()
      .then(({ data }) => setPlans(data.foodPlans.filter((p) => p.active)))
      .catch(() => setPlans([]))
  }, [canSee])

  const rateKey = stayType === 'daily' ? 'oneTimeRate' : 'monthlyRate'
  const usable = (plans || []).filter((p) => p[rateKey] > 0)
  // The stay type changed and the picked plan has no rate for it any more.
  useEffect(() => {
    if (value.planId && plans && !usable.some((p) => p.id === value.planId)) onChange({ ...value, planId: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stayType, plans])

  if (!canSee || !plans || !plans.length) return null
  const plan = usable.find((p) => p.id === value.planId)
  const est = mealEstimate(plan, stayType, units)
  const perUnit = stayType === 'daily' ? t('meal.perDay') : t('meal.perMonth')
  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return wrap(
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label={t('meal.plan')} value={value.planId} onChange={(e) => onChange({ ...value, planId: e.target.value })}
          options={[
            { value: '', label: usable.length ? t('meal.none') : t('meal.noneForStay') },
            ...usable.map((p) => ({ value: p.id, label: `${p.name} · ${inr(p[rateKey])}${perUnit}` })),
          ]} />
        <Field label={t('meal.diet')} value={value.diet} onChange={(e) => onChange({ ...value, diet: e.target.value })} disabled={!plan}
          options={[{ value: '', label: '—' }, ...DIETS.map((d) => ({ value: d, label: t(`meal.diets.${d}`) }))]} />
      </div>
      {plan && (
        <p className="m-0 text-xs text-ink2">
          {plan.meals.map((m) => MEAL_ICONS[m]).join(' ')}{' '}
          {est != null && (people > 1
            ? t('meal.estimateEach', { amount: inr(est), count: people })
            : t('meal.estimate', { amount: inr(est) }))}
          {' '}<span className="text-ink3">{stayType === 'daily' ? t('meal.dailyNote') : t('meal.monthlyNote')}</span>
        </p>
      )}
    </div>
  )
}
