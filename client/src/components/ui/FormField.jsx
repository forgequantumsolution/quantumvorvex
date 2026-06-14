// Props: label, error, children, required, className
export default function FormField({
  label,
  error,
  children,
  required = false,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-[5px] ${className}`}>
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
        <span className="text-[11.5px] text-danger-text font-medium">
          {error}
        </span>
      )}
    </div>
  )
}
