// Props: variant ('primary'|'outline'|'danger'|'success'), size ('sm'|'xs'|'md'),
//        onClick, children, disabled, type, className
export default function Button({
  variant = 'primary',
  size,
  onClick,
  children,
  disabled = false,
  type = 'button',
  className = '',
}) {
  const sizeClass = size ? ` btn-${size}` : ''
  const cls = `btn btn-${variant}${sizeClass} ${className}`.trim()

  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={disabled}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
    >
      {children}
    </button>
  )
}
