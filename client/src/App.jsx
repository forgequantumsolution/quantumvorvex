import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useAppSelector, useAuthActions } from './store/hooks'
import Layout from './components/layout/Layout'
import Toast from './components/ui/Toast'
import GlobalSearch from './components/ui/GlobalSearch'
import AIAssistant from './components/ui/AIAssistant'
import OfflineBanner from './components/ui/OfflineBanner'
import InstallPrompt from './components/ui/InstallPrompt'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import SetupWizard from './components/modules/setup/SetupWizard'
import GuestPortal from './components/modules/portal/GuestPortal'
import LoginPage from './components/auth/LoginPage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
// import LandingPage from './components/auth/LandingPage'
import { canAccess } from './utils/permissions'
import { MOCK_USER, MOCK_TOKEN } from './api/mockData.js'

const IS_MOCK = import.meta.env.VITE_MOCK === 'true'

// Lazy load the five front-desk modules for performance
const Bookings      = lazy(() => import('./components/modules/bookings/Bookings'))
const CheckIn       = lazy(() => import('./components/modules/checkin/CheckIn'))
const CheckOut      = lazy(() => import('./components/modules/checkout/CheckOut'))
const Cancellations = lazy(() => import('./components/modules/cancellations/Cancellations'))
const Maintenance   = lazy(() => import('./components/modules/maintenance/Maintenance'))
const Housekeeping  = lazy(() => import('./components/modules/housekeeping/Housekeeping'))
const Staff         = lazy(() => import('./components/modules/staff/Staff'))
const Guests        = lazy(() => import('./components/modules/guests/Guests'))
const Rooms         = lazy(() => import('./components/modules/rooms/Rooms'))
const Billing       = lazy(() => import('./components/modules/billing/Billing'))
const Documents     = lazy(() => import('./components/modules/documents/Documents'))
const Food          = lazy(() => import('./components/modules/food/Food'))
const Reports       = lazy(() => import('./components/modules/reports/Reports'))
const Settings      = lazy(() => import('./components/modules/settings/Settings'))

function PanelSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{
        height: 28, width: 180, borderRadius: 6,
        background: 'var(--border)', marginBottom: 20,
        animation: 'pulse 1.5s ease-in-out infinite'
      }} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
        gap: 13, marginBottom: 20
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            height: 90, borderRadius: 10,
            background: 'var(--border)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
        {[0, 1].map(i => (
          <div key={i} style={{
            height: 200, borderRadius: 10,
            background: 'var(--border)',
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
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
      <h2 style={{ margin: '0 0 8px', color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
        Access Restricted
      </h2>
      <p style={{ color: 'var(--text3)', fontSize: 14 }}>
        Your role doesn't have permission to access <strong>{panel}</strong>.
      </p>
    </div>
  )
}

const PANEL_MAP = {
  bookings:      Bookings,
  checkin:       CheckIn,
  checkout:      CheckOut,
  cancellations: Cancellations,
  maintenance:   Maintenance,
  housekeeping:  Housekeeping,
  staff:         Staff,
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
  const { login } = useAuthActions()
  const [showSetup, setShowSetup] = useState(false)
  // True when the user arrived via a password-reset email link (/reset-password?token=…)
  const [resetRoute, setResetRoute] = useState(
    () => typeof window !== 'undefined' && window.location.pathname === '/reset-password'
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

  // Keyboard shortcuts
  useKeyboardShortcuts({})

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

  const role = currentUser.role
  const ActivePanel = PANEL_MAP[activePanel] || Bookings

  // Check if current user can access the active panel
  const hasAccess = canAccess(role, activePanel)

  return (
    <>
      <Layout>
        <Suspense fallback={<PanelSkeleton />}>
          {hasAccess
            ? <ActivePanel onRunSetup={() => setShowSetup(true)} />
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
