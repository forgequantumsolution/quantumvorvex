// ─── Appearance / theme preferences ──────────────────────────────────────────
// Persisted UI customisation that drives the gold/white theme via CSS variables.
// Everything in the app reads var(--gold), var(--radius)… so changing these here
// re-skins the entire product instantly — no per-component wiring needed.

const STORAGE_KEY = 'qv-appearance'

// Accent presets — [base gold, deeper gold for hover/contrast]
export const ACCENT_PRESETS = [
  { id: 'classic',   label: 'Classic Gold',  gold: '#c9a84c', gold2: '#b8923a' },
  { id: 'champagne', label: 'Champagne',     gold: '#d4b066', gold2: '#bd9743' },
  { id: 'antique',   label: 'Antique Brass', gold: '#b8923a', gold2: '#9a7a2e' },
  { id: 'rose',      label: 'Rose Gold',     gold: '#c79081', gold2: '#a9705f' },
]

export const RADIUS_PRESETS = [
  { id: 'rounded', label: 'Rounded', value: 12 },
  { id: 'soft',    label: 'Soft',    value: 8  },
  { id: 'sharp',   label: 'Sharp',   value: 3  },
]

export const DEFAULT_APPEARANCE = {
  accent: 'classic',
  density: 'comfortable', // 'comfortable' | 'compact'
  radius: 'soft',
}

export function getAppearance() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) } : { ...DEFAULT_APPEARANCE }
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

export function saveAppearance(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch { /* storage unavailable — ignore */ }
}

// Push the preferences onto the document so every CSS variable consumer updates.
export function applyAppearance(prefs = getAppearance()) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  const accent = ACCENT_PRESETS.find(a => a.id === prefs.accent) || ACCENT_PRESETS[0]
  root.style.setProperty('--gold', accent.gold)
  root.style.setProperty('--gold2', accent.gold2)

  const radius = RADIUS_PRESETS.find(r => r.id === prefs.radius) || RADIUS_PRESETS[1]
  root.style.setProperty('--radius', `${radius.value}px`)

  root.classList.toggle('density-compact', prefs.density === 'compact')
}
