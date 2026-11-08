import { useTranslation } from 'react-i18next'
import { Field } from '../../ui-tw'
import { MAX_PHONES, phoneFieldName } from '../../../utils/booking'

/**
 * The guest's phone number(s). A guest often leaves more than one (their own
 * plus a relative's), so this is a list: the first entry carries the label and
 * extras stack beneath it, each removable, up to MAX_PHONES.
 *
 * Only the first number is ever required — the extras are always optional.
 *
 * `phones` is an array of digit strings; `onChange` receives the next array.
 * `errors` is keyed by phoneFieldName(i) — see phoneErrors() in utils/booking.
 */
export default function PhoneFields({ phones, errors = {}, onChange, required = false, hint, className = '' }) {
  const { t } = useTranslation('bookings')
  const setAt = (i) => (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    onChange(phones.map((p, idx) => (idx === i ? digits : p)))
  }
  const add = () => phones.length < MAX_PHONES && onChange([...phones, ''])
  const remove = (i) => {
    const next = phones.filter((_, idx) => idx !== i)
    onChange(next.length ? next : [''])
  }

  return (
    <div className={className}>
      {phones.map((p, i) => (
        <div key={i} className={i ? 'flex items-start gap-2 mt-2' : ''}>
          <Field
            className={i ? 'flex-1 min-w-0' : ''}
            label={i === 0 ? t('common:phone') : undefined}
            name={phoneFieldName(i)}
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={p}
            onChange={setAt(i)}
            placeholder={i === 0 ? t('form.phonePlaceholder') : t('form.anotherNumber', { n: i + 1 })}
            error={errors[phoneFieldName(i)]}
            hint={i === 0 ? hint : undefined}
            required={i === 0 && required}
          />
          {i > 0 && (
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t('form.removeNumber')}
              className="shrink-0 h-11 w-11 sm:h-[38px] sm:w-9 rounded-lg border border-line2 text-ink3 text-lg leading-none
                         hover:border-danger/40 hover:text-danger transition-colors"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {phones.length < MAX_PHONES && (
        <button
          type="button"
          onClick={add}
          className="mt-1.5 text-xs font-medium text-ink3 hover:text-gold transition-colors pointer-coarse:min-h-10"
        >
          + {t('form.addNumber')}
        </button>
      )}
    </div>
  )
}
