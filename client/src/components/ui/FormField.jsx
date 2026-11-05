// Props: label, error, children, required, className
// Full width of its grid cell; the control inside should be .form-input /
// .form-select / .form-textarea (16px text on phones, see index.css).
export default function FormField({
  label,
  error,
  children,
  required = false,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-[5px] min-w-0 ${className}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && (
            <span className="text-danger ml-[3px]">*</span>
          )}
        </label>
      )}
      {children}
      {error && (
        <span className="text-[12px] text-danger-text font-medium">
          {error}
        </span>
      )}
    </div>
  )
}
