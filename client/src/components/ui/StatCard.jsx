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
          <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 500 }}>
            ↑ {trend}%
          </span>
        )
      }
      if (isNegative) {
        return (
          <span style={{ color: 'var(--red)', fontSize: '12px', fontWeight: 500 }}>
            ↓ {Math.abs(trend)}%
          </span>
        )
      }
      return (
        <span style={{ color: 'var(--text3)', fontSize: '12px' }}>
          → {trend}%
        </span>
      )
    }
    if (sub) {
      return (
        <span style={{ color: 'var(--text3)', fontSize: '12px' }}>{sub}</span>
      )
    }
    return null
  }

  return (
    <div className={`stat-card stat-bar-${color}`}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text3)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
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
