// Props: type ('green'|'red'|'amber'|'blue'|'gold'|'grey'|'purple'), children, className
export default function Badge({ type = 'grey', children, className = '' }) {
  return (
    <span className={`badge badge-${type} ${className}`.trim()}>
      {children}
    </span>
  )
}
