import { useEffect, useState, lazy, Suspense } from 'react'
import { useStore } from './store/useStore'
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
import { canAccess } from './utils/permissions'

// Lazy load modules for performance
const Dashboard    = lazy(() => import('./components/modules/dashboard/Dashboard'))
const Rooms        = lazy(() => import('./components/modules/rooms/Rooms'))
const FloorPlan    = lazy(() => import('./components/modules/floorplan/FloorPlan'))
const Reports      = lazy(() => import('./components/modules/reports/Reports'))
const CheckIn      = lazy(() => import('./components/modules/checkin/CheckIn'))
const Guests       = lazy(() => import('./components/modules/guests/Guests'))
const Bookings     = lazy(() => import('./components/modules/bookings/Bookings'))
const Documents    = lazy(() => import('./components/modules/documents/Documents'))
const Food         = lazy(() => import('./components/modules/food/Food'))
const Billing      = lazy(() => import('./components/modules/billing/Billing'))
const Settings     = lazy(() => import('./components/modules/settings/Settings'))
const Maintenance  = lazy(() => import('./components/modules/maintenance/Maintenance'))
const Housekeeping = lazy(() => import('./components/modules/housekeeping/Housekeeping'))
const Staff        = lazy(() => import('./components/modules/staff/Staff'))
const Channels     = lazy(() => import('./components/modules/channels/Channels'))

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
  dashboard:   Dashboard,
  rooms:       Rooms,
  floorplan:   FloorPlan,
  reports:     Reports,
  checkin:     CheckIn,
  guests:      Guests,
  bookings:    Bookings,
  documents:   Documents,
  food:        Food,
  billing:     Billing,
  settings:    Settings,
  maintenance: Maintenance,
  housekeeping: Housekeeping,
  staff:       Staff,
  channels:    Channels,
}

export default function App() {
  const { activePanel, initDarkMode, currentUser, token } = useStore()
  const [showSetup, setShowSetup] = useState(false)

  // Init dark mode on mount
  useEffect(() => {
    initDarkMode()
  }, [initDarkMode])

  // Keyboard shortcuts
  useKeyboardShortcuts({})

  // ── Not authenticated → show login ──────────────────────────────────────────
  if (!currentUser || !token) {
    return (
      <>
        <LoginPage />
        <Toast />
      </>
    )
  }

  const role = currentUser.role
  const ActivePanel = PANEL_MAP[activePanel] || Dashboard

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
