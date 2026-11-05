/**
 * App translations: English, Hindi, Marathi and Telugu.
 *
 * Strings live in src/locales/<lang>/<namespace>.json — one namespace per area
 * (common, nav, bookings, billing, settings…). Components read them with
 *   const { t } = useTranslation('bookings')
 *   t('newBooking')                 → "New booking" / "नई बुकिंग" / "नवीन बुकिंग"
 *   t('common:save')                → a shared word from common.json
 *   t('nights', { count: 3 })       → plurals via `nights_one` / `nights_other`
 * English is the fallback for any key missing in Hindi or Marathi.
 *
 * The chosen language is remembered per browser (LANG_KEY) and mirrored to
 * <html lang>, so the browser and screen readers know it too.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', locale: 'hi-IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', locale: 'mr-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', locale: 'te-IN' },
]
export const LANG_KEY = 'qv-lang'

// Every src/locales/<lang>/<ns>.json, bundled at build time.
const files = import.meta.glob('../locales/*/*.json', { eager: true })
const resources = {}
for (const [path, mod] of Object.entries(files)) {
  const [, lang, ns] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)
  ;(resources[lang] ??= {})[ns] = mod.default ?? mod
}

const saved = (() => { try { return localStorage.getItem(LANG_KEY) } catch { return null } })()
const initial = LANGUAGES.some((l) => l.code === saved) ? saved : 'en'

i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: 'en',
  ns: Object.keys(resources.en || { common: {} }),
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
})

const applyLang = (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}
applyLang(initial)
i18n.on('languageChanged', (lng) => {
  applyLang(lng)
  try { localStorage.setItem(LANG_KEY, lng) } catch { /* private mode */ }
})

// Intl locale for the current language (dates, months, number grouping).
export const currentLocale = () => LANGUAGES.find((l) => l.code === i18n.language)?.locale || 'en-IN'

// The locale to pass to Intl / toLocale*String everywhere: month and day names in
// the user's language, but always 0–9 digits (Marathi would otherwise default to
// Devanagari digits, which bills and room numbers shouldn't switch to).
export const appLocale = () => `${currentLocale()}-u-nu-latn`

export default i18n
