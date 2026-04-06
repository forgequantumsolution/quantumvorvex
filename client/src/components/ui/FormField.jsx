// Props: label, error, children, required, className
export default function FormField({
  label,
  error,
  children,
  required = false,
  className = '',
}) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}
    >
      {label && (
        <label className="form-label">
          {label}
          {required && (
            <span style={{ color: 'var(--red)', marginLeft: '3px' }}>*</span>
          )}
        </label>
      )}
      {children}
      {error && (
        <span
          style={{
            fontSize: '11.5px',
            color: 'var(--red-text)',
            fontWeight: 500,
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}
