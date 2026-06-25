/**
 * Labelled form control. Renders an <input>, <select> (when `options` given),
 * or <textarea> (when `textarea`). Shows an optional `error` line, or a muted
 * `hint` line when there's no error.
 */
const baseControl =
  'w-full bg-surface border border-line2 rounded-lg px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink3 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 ' +
  'disabled:opacity-60'

export default function Field({
  label,
  name,
  value,
  onChange,
  options,
  textarea,
  error,
  hint,
  required,
  className = '',
  ...props
}) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="block text-xs font-medium text-ink2 mb-1.5">
          {label} {required && <span className="text-danger">*</span>}
        </span>
      )}

      {options ? (
        <select name={name} value={value} onChange={onChange} className={baseControl} {...props}>
          {options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt
            const lbl = typeof opt === 'object' ? opt.label : opt
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            )
          })}
        </select>
      ) : textarea ? (
        <textarea name={name} value={value} onChange={onChange} rows={3} className={baseControl} {...props} />
      ) : (
        <input name={name} value={value} onChange={onChange} className={baseControl} {...props} />
      )}

      {error
        ? <span className="block text-[11.5px] text-danger mt-1">{error}</span>
        : hint && <span className="block text-[11.5px] text-ink3 mt-1">{hint}</span>}
    </label>
  )
}
