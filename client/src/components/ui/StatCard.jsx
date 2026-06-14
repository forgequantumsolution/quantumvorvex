// Props: label, value, sub, trend (number), color ('gold'|'green'|'red'|'amber'|'blue'|'purple'), children
export default function StatCard({
  label,
  value,
  sub,
  trend,
  color = 'gold',
  children,
}) {
  const renderFooter = () => {
    if (trend !== undefined) {
      const isPositive = trend > 0
      const isNegative = trend < 0
      if (isPositive) {
        return (
          <span className="t-xs text-success">
            ↑ {trend}%
          </span>
        )
      }
      if (isNegative) {
        return (
          <span className="t-xs text-danger">
            ↓ {Math.abs(trend)}%
          </span>
        )
      }
      return (
        <span className="t-xs text-ink3">
          → {trend}%
        </span>
      )
    }
    if (sub) {
      return (
        <span className="t-xs text-ink3">{sub}</span>
      )
    }
    return null
  }

  return (
    <div className={`stat-card stat-bar-${color}`}>
      <div className="t-label text-ink3 mb-2">
        {label}
      </div>
      <div
        className="text-[26px] font-bold text-ink mb-1.5"
        style={{
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {renderFooter()}
      {children && (
        <div className="mt-2.5">{children}</div>
      )}
    </div>
  )
}
