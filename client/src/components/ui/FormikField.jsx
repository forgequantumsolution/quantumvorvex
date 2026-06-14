import { Field, useField } from 'formik'
import FormField from './FormField'

/**
 * Formik-aware field that reuses the generic <FormField> wrapper for the
 * label + error layout. Shows the validation error once the field is touched.
 *
 * Props:
 *   name      (required) — Formik field name
 *   label, required, className — forwarded to <FormField>
 *   as        — 'input' (default) | 'select' | 'textarea'
 *   children  — <option>s when `as="select"`
 *   ...rest   — forwarded to the underlying input (type, placeholder, etc.)
 */
export default function FormikField({
  name,
  label,
  required = false,
  className = '',
  as = 'input',
  children,
  ...rest
}) {
  const [, meta] = useField(name)
  const error = meta.touched && meta.error ? meta.error : undefined

  return (
    <FormField label={label} required={required} error={error} className={className}>
      <Field
        as={as}
        name={name}
        className={as === 'input' ? 'form-input' : as === 'select' ? 'form-select' : 'form-textarea'}
        {...rest}
      >
        {children}
      </Field>
    </FormField>
  )
}
