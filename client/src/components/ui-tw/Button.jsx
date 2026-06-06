/**
 * Tailwind button. Variants: primary (gold) · ghost · danger · success.
 * Sizes: sm · md. Pass `icon` for a leading glyph.
 */
const VARIANTS = {
  primary: 'bg-gold text-black hover:bg-gold-light shadow-soft',
  ghost: 'bg-surface text-ink2 border border-line2 hover:border-gold hover:text-gold',
  danger: 'bg-danger-bg text-danger-text hover:bg-danger hover:text-white',
  success: 'bg-success-bg text-success-text hover:bg-success hover:text-white',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium font-sans',
        'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        'tracking-tight whitespace-nowrap',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      ].join(' ')}
      {...props}
    >
      {icon && <span className="text-[1.05em] leading-none">{icon}</span>}
      {children}
    </button>
  )
}
