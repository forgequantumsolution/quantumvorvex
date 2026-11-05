import TwStatCard from '../ui-tw/StatCard'

// Legacy props (label, value, sub, trend, color, children) on top of the shared
// KPI card in ui-tw/StatCard, so every figure tile has one design.
export default function StatCard({ label, value, sub, trend, color = 'gold', children, ...rest }) {
  return <TwStatCard label={label} value={value} hint={sub} trend={trend} tone={color} {...rest}>{children}</TwStatCard>
}
