import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useAppSelector, useAuthActions, useUiActions, useHotelActions } from './store/hooks'
import { panelFromUrl } from './store/slices/uiSlice'
import Layout from './components/layout/Layout'
import Toast from './components/ui/Toast'
import GlobalSearch from './components/ui/GlobalSearch'
import AIAssistant from './components/ui/AIAssistant'
import OfflineBanner from './components/ui/OfflineBanner'
import InstallPrompt from './components/ui/InstallPrompt'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import SetupWizard from './components/modules/setup/SetupWizard'
import GuestPortal from './components/modules/portal/GuestPortal'
import GuestMaintenanceForm from './components/modules/maintenance/GuestMaintenanceForm'
import LoginPage from './components/auth/LoginPage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
// import LandingPage from './components/auth/LandingPage'
import { canAccess } from './utils/permissions'
import { selectActiveProperty } from './store/slices/authSlice'
import { authApi, settingsApi } from './api/client'
import { MOCK_USER, MOCK_TOKEN } from './api/mockData.js'

const IS_MOCK = import.meta.env.VITE_MOCK === 'true'

// Lazy load the front-desk modules for performance
const Today         = lazy(() => import('./components/modules/today/Today'))
const Bookings      = lazy(() => import('./components/modules/bookings/Bookings'))
const Cancellations = lazy(() => import('./components/modules/cancellations/Cancellations'))
const Maintenance   = lazy(() => import('./components/modules/maintenance/Maintenance'))
const Housekeeping  = lazy(() => import('./components/modules/housekeeping/Housekeeping'))
const UsersRoles    = lazy(() => import('./components/modules/users/UsersRoles'))
const Guests        = lazy(() => import('./components/modules/guests/Guests'))
const Rooms         = lazy(() => import('./components/modules/rooms/Rooms'))
const Billing       = lazy(() => import('./components/modules/billing/Billing'))
const Documents     = lazy(() => import('./components/modules/documents/Documents'))
const Food          = lazy(() => import('./components/modules/food/Food'))
const Reports       = lazy(() => import('./components/modules/reports/Reports'))
const Settings      = lazy(() => import('./components/modules/settings/Settings'))
const Portfolio     = lazy(() => import('./components/modules/portfolio/Portfolio'))

function PanelSkeleton() {
  return (
    <div className="p-6">
      <div
        className="h-[28px] w-[180px] rounded-md bg-line mb-5"
        style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-[13px] mb-5">
        {[...Array(6)].map((_, i) => (
          <div key={i}
            className="h-[90px] rounded-[10px] bg-line"
            style={{
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`
            }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-[15px]">
        {[0, 1].map(i => (
          <div key={i}
            className="h-[200px] rounded-[10px] bg-line"
            style={{
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`
            }} />
        ))}
      </div>
    </div>
  )
}

function AccessDenied({ panel }) {
  return (
    <div className="p-12 text-center">
      <div className="t-display mb-4">🔒</div>
      <h2 className="m-0 mb-2 text-ink">
        Access Restricted
      </h2>
      <p className="t-body text-ink3">
        Your role doesn't have permission to access <strong>{panel}</strong>.
      </p>
    </div>
  )
}

// Signed in, but not assigned to any (active) property yet — nothing to show
// until an owner grants access.
function NoPropertyAssigned({ onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-canvas">
      <div className="card max-w-[420px] w-full text-center">
        <div className="card-body py-10 px-7">
          <div className="t-display mb-3">🏨</div>
          <h2 className="m-0 mb-2 text-ink t-h2">No property assigned</h2>
          <p className="t-body text-ink3 m-0 mb-6">
            Your account isn't linked to any property yet. Ask the owner to give you access, then sign in again.
          </p>
          <button className="btn btn-outline" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  )
}

const PANEL_MAP = {
  portfolio:     Portfolio,
  today:         Today,
  bookings:      Bookings,
  cancellations: Cancellations,
  maintenance:   Maintenance,
  housekeeping:  Housekeeping,
  users:         UsersRoles,
  guests:        Guests,
  rooms:         Rooms,
  billing:       Billing,
  documents:     Documents,
  food:          Food,
  reports:       Reports,
  settings:      Settings,
}

export default function App() {
  const activePanel = useAppSelector((s) => s.ui.activePanel)
  const darkMode    = useAppSelector((s) => s.ui.darkMode)
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const token       = useAppSelector((s) => s.auth.token)
  const activePropertyId = useAppSelector((s) => s.auth.activePropertyId)
  const activePropertyName = useAppSelector((s) => selectActiveProperty(s)?.name)
  const { login, logout, setCurrentUser } = useAuthActions()
  const { setActivePanel } = useUiActions()
  const { setHotelName, setOwnerName } = useHotelActions()
  const [showSetup, setShowSetup] = useState(false)
  // True when the user arrived via a password-reset email link (/reset-password?token=…)
  const [resetRoute, setResetRoute] = useState(
    () => typeof window !== 'undefined' && window.location.pathname === '/reset-password'
  )
  // True when a guest scanned a room maintenance QR (/report?t=…) — public, no login.
  const [reportRoute] = useState(
    () => typeof window !== 'undefined' && window.location.pathname === '/report'
  )
  const exitResetRoute = () => {
    window.history.replaceState({}, '', '/')
    setResetRoute(false)
  }
  // Landing page disabled — login is the default unauthenticated view
  // const [page, setPage] = useState('login')
  // Prevent mock auto-login from re-firing after the user deliberately signs out
  const mockDidAutoLogin = useRef(false)

  // Sync dark mode to the document whenever it changes (and on mount)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Auto-login with mock user on first load only — skip if user signed out
  useEffect(() => {
    if (IS_MOCK && !currentUser && !mockDidAutoLogin.current) {
      mockDidAutoLogin.current = true
      login(MOCK_TOKEN, MOCK_USER)
    }
  }, [IS_MOCK, currentUser, login])

  // Refresh the live permission map on boot (and resync after an access change).
  // Persisted currentUser may carry stale permissions if a role changed since last login.
  useEffect(() => {
    if (IS_MOCK || !token) return
    let last = 0
    const resync = async () => {
      const now = Date.now()
      if (now - last < 3000) return   // debounce repeated 403s
      last = now
      try {
        const { data } = await authApi.me()
        if (data?.user) setCurrentUser(data.user)
      } catch { /* 401s are handled by the axios interceptor */ }
    }
    resync()
    window.addEventListener('auth:forbidden', resync)
    return () => window.removeEventListener('auth:forbidden', resync)
  }, [token, setCurrentUser])

  // Hydrate the hotel name/owner into the store on boot (and whenever the active
  // property changes) so the sidebar shows that property's saved name — otherwise it
  // stays on the hardcoded default until the user opens the Settings page.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    settingsApi.get()
      .then(({ data }) => {
        if (cancelled || !data?.hotel) return
        if (data.hotel.name)      setHotelName(data.hotel.name)
        if (data.hotel.ownerName) setOwnerName(data.hotel.ownerName)
      })
      // No settings access (e.g. front-desk staff): show the property's own name
      // rather than whatever name was cached from a previous session / property.
      .catch(() => { if (!cancelled && activePropertyName) setHotelName(activePropertyName) })
    return () => { cancelled = true }
  }, [token, activePropertyId, activePropertyName, setHotelName, setOwnerName])

  // Keyboard shortcuts
  useKeyboardShortcuts({})

  const isAuthed = Boolean(currentUser && token)

  // ── URL ↔ panel sync ─────────────────────────────────────────────────────────
  // State → URL: keep the path at /<panel> so every page is addressable and a
  // refresh restores it (activePanel itself initializes from the URL in uiSlice).
  useEffect(() => {
    if (!isAuthed || resetRoute) return
    const path = `/${activePanel}`
    if (window.location.pathname === path) return
    if (panelFromUrl(null) === null) {
      // Current path isn't a panel (e.g. '/' right after login) — normalize it
      // without adding a history entry.
      window.history.replaceState({ panel: activePanel }, '', path)
    } else {
      window.history.pushState({ panel: activePanel }, '', path)
    }
  }, [activePanel, isAuthed, resetRoute])

  // URL → state: browser back/forward.
  useEffect(() => {
    const onPopState = () => setActivePanel(panelFromUrl('today'))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [setActivePanel])

  // ── Guest maintenance QR deep link — public, shown before any auth gate ──────
  if (reportRoute) {
    return (
      <>
        <GuestMaintenanceForm />
        <Toast />
      </>
    )
  }

  // ── Password-reset deep link — show regardless of any existing session ───────
  if (resetRoute) {
    return (
      <>
        <ResetPasswordPage onDone={exitResetRoute} />
        <Toast />
      </>
    )
  }

  // ── Not authenticated → show login (landing commented out) ──────────────────
  if (!currentUser || !token) {
    // if (page === 'landing') {
    //   return (
    //     <>
    //       <LandingPage onLogin={() => setPage('login')} />
    //       <Toast />
    //     </>
    //   )
    // }
    return (
      <>
        <LoginPage />
        <Toast />
      </>
    )
  }

  // Non-owner with no property access (properties is undefined only for mock /
  // pre-multi-property payloads, which keep the old single-property behaviour).
  if (currentUser.properties && !activePropertyId) {
    return (
      <>
        <NoPropertyAssigned onSignOut={logout} />
        <Toast />
      </>
    )
  }

  const ActivePanel = PANEL_MAP[activePanel] || Today

  // Check if current user can access the active panel (driven by live permissions)
  const hasAccess = canAccess(currentUser, activePanel)

  return (
    <>
      <Layout>
        <Suspense fallback={<PanelSkeleton />}>
          {/* Keyed on the property: switching remounts the panel so it reloads
              the new property's data (every request carries X-Property-Id). */}
          {hasAccess
            ? <ActivePanel key={activePropertyId || 'default'} onRunSetup={() => setShowSetup(true)} />
            : <AccessDenied panel={activePanel} />
          }
        </Suspense>
      </Layout>
      <OfflineBanner />
      <GlobalSearch />
      <AIAssistant />
      <InstallPrompt />
      <Toast />

      {/* Setup Wizard — full-screen overlay */}
      {showSetup && (
        <SetupWizard onComplete={() => setShowSetup(false)} />
      )}

      {/* Guest Portal — full-screen overlay (demo: triggered by activePanel) */}
      {activePanel === 'guestportal' && <GuestPortal />}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  )
}
