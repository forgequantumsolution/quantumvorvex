import { StatStripContext } from './statStripContext'

/**
 * The KPI strip: StatCards drawn as segments of one slim bar. Shown from xl and
 * hidden below (phones and tablets start with the list instead), unless
 * `always` is set for pages whose figures are the content itself.
 */
export default function StatStrip({ children, always = false, className = '' }) {
  return (
    <StatStripContext.Provider value={true}>
      <div className={`${always ? 'flex flex-wrap md:flex-nowrap' : 'hidden xl:flex'} bg-surface border border-line rounded-xl shadow-soft overflow-hidden divide-x divide-line ${className}`}>
        {children}
      </div>
    </StatStripContext.Provider>
  )
}
