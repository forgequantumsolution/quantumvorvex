import { createContext } from 'react'

// True for StatCards rendered inside PageWrapper's KPI strip, which draws them as
// compact segments of one bar instead of separate cards.
export const StatStripContext = createContext(false)
