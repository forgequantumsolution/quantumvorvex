import { Field } from '../../ui-tw'
import { MAX_NAMES, nameFieldName } from '../../../utils/booking'

/**
 * The guest name(s) on a booking. A room is often taken by more than one person
 * — a couple, a family, colleagues sharing — so this mirrors <PhoneFields>: the
 * first entry is the guest the booking is billed to and carries the label, and
 * additional occupants stack beneath it, each removable, up to MAX_NAMES.
 *
 * `names` is an array of strings; `onChange` receives the next array.
 * `errors` is keyed by nameFieldName(i) — see nameErrors() in utils/booking.
 */
export default function NameFields({ names, errors = {}, onChange, className = '' }) {
  const setAt = (i) => (e) =>
    onChange(names.map((n, idx) => (idx === i ? e.target.value : n)))

  const add = () => names.length < MAX_NAMES && onChange([...names, ''])

  const remove = (i) => {
    const next = names.filter((_, idx) => idx !== i)
    onChange(next.length ? next : [''])
  }

  return (
    <div className={className}>
      {names.map((n, i) => (
        <div key={i} className={i ? 'flex items-start gap-2 mt-2' : ''}>
          <Field
            className={i ? 'flex-1 min-w-0' : ''}
            label={i === 0 ? 'Guest name' : undefined}
            name={nameFieldName(i)}
            value={n}
            onChange={setAt(i)}
            placeholder={i === 0 ? 'Full name' : `Additional guest (${i + 1})`}
            error={errors[nameFieldName(i)]}
            required={i === 0}
          />
          {i > 0 && (
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove this guest"
              className="shrink-0 h-[38px] w-9 rounded-lg border border-line2 text-ink3 text-lg leading-none
                         hover:border-danger/40 hover:text-danger transition-colors"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {names.length < MAX_NAMES && (
        <button
          type="button"
          onClick={add}
          className="mt-1.5 text-[11.5px] font-medium text-ink3 hover:text-gold transition-colors"
        >
          + Add another guest
        </button>
      )}
    </div>
  )
}
