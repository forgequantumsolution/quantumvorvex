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
          <span className="t-xs" style={{ color: 'var(--green)' }}>
            ↑ {trend}%
          </span>
        )
      }
      if (isNegative) {
        return (
          <span className="t-xs" style={{ color: 'var(--red)' }}>
            ↓ {Math.abs(trend)}%
          </span>
        )
      }
      return (
        <span className="t-xs" style={{ color: 'var(--text3)' }}>
          → {trend}%
        </span>
      )
    }
    if (sub) {
      return (
        <span className="t-xs" style={{ color: 'var(--text3)' }}>{sub}</span>
      )
    }
    return null
  }

  return (
    <div className={`stat-card stat-bar-${color}`}>
      <div
        className="t-label"
        style={{
          color: 'var(--text3)',
          marginBottom: '8px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}
      >
        {value}
      </div>
      {renderFooter()}
      {children && (
        <div style={{ marginTop: '10px' }}>{children}</div>
      )}
    </div>
  )
}
