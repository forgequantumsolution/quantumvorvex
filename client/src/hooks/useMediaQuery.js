import { useCallback, useSyncExternalStore } from 'react'

// Tailwind's default breakpoints (tailwind.config.js doesn't override them).
// Keep JS layout switches on the same edges as the CSS so they never disagree.
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }

/**
 * useMediaQuery('(min-width: 768px)') — live boolean for a CSS media query.
 * Prefer plain Tailwind classes (md:hidden…); reach for this only when the
 * markup itself must differ (e.g. table rows vs stacked cards).
 */
export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** true at ≥ the named Tailwind breakpoint, e.g. useMinWidth('md'). */
export function useMinWidth(bp) {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[bp] ?? bp}px)`)
}

/**
 * The app shell's three tiers:
 *   phone   < 768   drawer + bottom navigation
 *   tablet  768–1279 slim icon rail that can expand over the content
 *   desktop ≥ 1280  full sidebar (collapsible to the rail)
 */
export function useBreakpoint() {
  const md = useMinWidth('md')
  const xl = useMinWidth('xl')
  return { isPhone: !md, isTablet: md && !xl, isDesktop: xl }
}
