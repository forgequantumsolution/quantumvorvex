/** Meal plan picked on the booking form (Food module). */
export const EMPTY_MEAL = { planId: '', diet: '' }

/** Body for the booking API: `meal`, or undefined when no plan is picked. */
export const mealPayload = (meal) => (meal?.planId ? { planId: meal.planId, diet: meal.diet || null } : undefined)
