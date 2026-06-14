/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#C9A84C',
          light: '#D4AF5A',
          bg: 'rgba(201,168,76,0.10)',
          border: 'rgba(201,168,76,0.35)',
        },
        // Semantic tokens mapped to the CSS variables in index.css so the gold
        // theme + dark mode keep working with clean utilities (bg-surface, text-ink…)
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        canvas: 'var(--main-bg)',
        line: 'var(--border)',
        line2: 'var(--border2)',
        ink: 'var(--text)',
        ink2: 'var(--text2)',
        ink3: 'var(--text3)',
        success: { DEFAULT: 'var(--green)', bg: 'var(--green-bg)', text: 'var(--green-text)' },
        danger: { DEFAULT: 'var(--red)', bg: 'var(--red-bg)', text: 'var(--red-text)' },
        warning: { DEFAULT: 'var(--amber)', bg: 'var(--amber-bg)', text: 'var(--amber-text)' },
        info: { DEFAULT: 'var(--blue)', bg: 'var(--blue-bg)', text: 'var(--blue-text)' },
        violet: { DEFAULT: 'var(--purple)', bg: 'var(--purple-bg)', text: 'var(--purple-text)' },
      },
      fontFamily: {
        // All families resolve to the CSS variables defined in index.css :root,
        // which are the single source of truth. Swap the font there (one place).
        // display/serif collapse to the sans var; mono stays fixed-width.
        display: ['var(--font-sans)'],
        serif:   ['var(--font-sans)'],
        sans:    ['var(--font-sans)'],
        mono:    ['var(--font-mono)'],
        // Back-compat aliases so any stray utility keeps resolving correctly
        syne:    ['var(--font-sans)'],
        inter:   ['var(--font-sans)'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.07), 0 4px 14px rgba(0,0,0,0.05)',
        lift: '0 4px 24px rgba(0,0,0,0.13)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
