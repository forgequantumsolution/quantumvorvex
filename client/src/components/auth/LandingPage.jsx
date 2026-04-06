import { useState } from 'react'
import { useStore } from '../../store/useStore'

/* ── Design tokens matching the reference screenshot ─────────────────────── */
const GOLD    = '#9a7820'
const GOLD_LT = '#b8962e'
const CREAM   = '#faf8f3'
const WHITE   = '#ffffff'
const INK     = '#0f0f0f'
const MUTED   = '#5a5a5a'
const FAINT   = '#9a9a9a'
const BORDER  = 'rgba(0,0,0,0.09)'

const NAV_LINKS = ['PRODUCT', 'FEATURES', 'HOW IT WORKS', 'ROLES']

const MODULES = [
  { tag: 'DASHBOARD',    title: 'Analytics Dashboard',    desc: 'Live occupancy, revenue, check-ins and billing status across your property.' },
  { tag: 'ROOMS',        title: 'Room Management',        desc: 'Real-time room status, floor-plan view and drag-drop assignment.' },
  { tag: 'CHECK-IN',     title: 'Smart Guest Check-In',   desc: 'KYC capture, ID verification and digital registration in under 2 minutes.' },
  { tag: 'BILLING',      title: 'GST-Ready Billing',      desc: 'Auto-generate invoices with CGST/SGST, HSN codes and one-click PDF export.' },
  { tag: 'HOUSEKEEPING', title: 'Housekeeping & Linen',   desc: 'Daily task lists, inspection checklists and room turnaround tracking.' },
  { tag: 'MAINTENANCE',  title: 'Maintenance Requests',   desc: 'Issue reporting, priority queues, staff assignment and resolution logs.' },
  { tag: 'REPORTS',      title: 'Reports & Analytics',    desc: 'Revenue charts, occupancy trends, GST summaries and custom date exports.' },
  { tag: 'CHANNELS',     title: 'Channel Manager',        desc: 'Manage OTA bookings from Booking.com, MakeMyTrip and Airbnb in one place.' },
]

const STATS = [
  { num: '15+',   label: 'Integrated Modules'   },
  { num: '100%',  label: 'GST Compliant'        },
  { num: '3',     label: 'Role-based Levels'    },
  { num: '₹ INR', label: 'Indian Billing Ready' },
]

/* Small floating preview cards (right side of hero) */
function StatCard({ tag, value, sub, bar, trend }) {
  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: '16px 20px',
      minWidth: 220,
      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: '#faf3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
          {tag === 'OCCUPANCY' ? '🏨' : tag === 'REVENUE' ? '₹' : '✅'}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: FAINT }}>{tag}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: INK, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1 }}>{value}</div>
      {bar && (
        <div style={{ marginTop: 10, height: 4, background: '#f0ede6', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: bar, height: '100%', background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LT} 100%)`, borderRadius: 4 }} />
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 11.5, color: FAINT }}>{sub}</div>
      {trend && <div style={{ marginTop: 2, fontSize: 11.5, color: '#3a8c3a', fontWeight: 600 }}>{trend}</div>}
    </div>
  )
}

/* Module card in the grid */
function ModuleCard({ tag, title, desc, hovered, onHover }) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={() => onHover(null)}
      style={{
        background: hovered ? '#fff' : WHITE,
        border: `1px solid ${hovered ? GOLD + '55' : BORDER}`,
        borderRadius: 10, padding: '20px 22px',
        transition: 'all 0.18s', cursor: 'default',
        boxShadow: hovered ? '0 8px 28px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: GOLD, marginBottom: 8 }}>{tag}</div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 700, color: INK, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{desc}</div>
    </div>
  )
}

export default function LandingPage({ onLogin }) {
  const [hoveredModule, setHoveredModule] = useState(null)
  const [hoveredRole, setHoveredRole]     = useState(null)

  return (
    <div style={{ background: CREAM, color: INK, fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,248,243,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '0 6vw',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 58,
      }}>
        {/* Logo */}
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
          Forge <em style={{ color: GOLD, fontStyle: 'italic' }}>Quantum</em> Vorvex
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {NAV_LINKS.map(l => (
            <span key={l} style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: MUTED, cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = INK}
              onMouseLeave={e => e.currentTarget.style.color = MUTED}
            >{l}</span>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onLogin} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: MUTED,
            transition: 'color 0.15s', padding: '6px 4px',
          }}
            onMouseEnter={e => e.currentTarget.style.color = INK}
            onMouseLeave={e => e.currentTarget.style.color = MUTED}
          >SIGN IN</button>
          <button onClick={onLogin} style={{
            background: GOLD, color: WHITE,
            border: 'none', borderRadius: 6,
            padding: '9px 20px', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.08em', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#7d6115'}
            onMouseLeave={e => e.currentTarget.style.background = GOLD}
          >GET STARTED</button>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 40, alignItems: 'center',
        padding: '80px 6vw 80px',
        minHeight: '88vh',
      }}>
        {/* Left */}
        <div>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            marginBottom: 32,
          }}>
            <div style={{ width: 28, height: 1, background: GOLD }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', color: GOLD }}>
              HOTEL MANAGEMENT INTELLIGENCE
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(42px, 5.5vw, 76px)',
            fontWeight: 900,
            lineHeight: 1.06,
            letterSpacing: '-0.02em',
            margin: '0 0 6px',
            color: INK,
          }}>
            Seamless Operations.
          </h1>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(42px, 5.5vw, 76px)',
            fontWeight: 700,
            fontStyle: 'italic',
            lineHeight: 1.06,
            letterSpacing: '-0.02em',
            margin: '0 0 32px',
            color: GOLD,
          }}>
            Intelligent Management.
          </h1>

          {/* Body */}
          <p style={{
            fontSize: 16, color: MUTED, lineHeight: 1.75,
            maxWidth: 520, margin: '0 0 40px',
          }}>
            Quantum Vorvex is a complete hotel management platform — unifying room tracking,
            guest check-in, GST billing, housekeeping and channel management into one
            intelligent command centre built for India.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button onClick={onLogin} style={{
              background: GOLD, color: WHITE,
              border: 'none', borderRadius: 6,
              padding: '14px 28px', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#7d6115'}
              onMouseLeave={e => e.currentTarget.style.background = GOLD}
            >SIGN IN TO PLATFORM</button>
            <a href="#modules" style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'none',
              border: `1px solid ${BORDER}`,
              borderRadius: 6, padding: '14px 28px',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
              color: INK, textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = GOLD}
              onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
            >EXPLORE PRODUCT</a>
          </div>
        </div>

        {/* Right — floating cards */}
        <div style={{ position: 'relative', height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Background grid texture */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `radial-gradient(circle, rgba(154,120,32,0.06) 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
            borderRadius: 16,
          }} />
          {/* Card 1 — top right */}
          <div style={{ position: 'absolute', top: 20, right: 0 }}>
            <StatCard tag="OCCUPANCY" value="87%" sub="72% rooms filled this week" bar="72%" />
          </div>
          {/* Card 2 — middle left */}
          <div style={{ position: 'absolute', top: '38%', left: 0, transform: 'translateY(-50%)' }}>
            <StatCard tag="REVENUE" value="₹2.4L" sub="+4.2% vs last month" trend="↗ +4.2% vs last month" />
          </div>
          {/* Card 3 — bottom right */}
          <div style={{ position: 'absolute', bottom: 10, right: 20 }}>
            <StatCard tag="CHECK-INS" value="6" sub="3 pending today" />
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────────────── */}
      <section style={{
        borderTop: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
        background: 'rgba(154,120,32,0.03)',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '40px 6vw',
      }}>
        {STATS.map(({ num, label }, i) => (
          <div key={label} style={{
            textAlign: 'center',
            borderRight: i < 3 ? `1px solid ${BORDER}` : 'none',
            padding: '0 20px',
          }}>
            <div style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 900, color: GOLD,
              lineHeight: 1,
            }}>{num}</div>
            <div style={{ fontSize: 12, color: FAINT, marginTop: 6, letterSpacing: '0.04em' }}>{label}</div>
          </div>
        ))}
      </section>

      {/* ── MODULES SECTION ───────────────────────────────────────────────── */}
      <section id="modules" style={{ padding: '80px 6vw' }}>
        <div style={{
          background: WHITE, border: `1px solid ${BORDER}`,
          borderRadius: 16, overflow: 'hidden',
          display: 'grid', gridTemplateColumns: '320px 1fr',
        }}>
          {/* Left panel */}
          <div style={{
            padding: '48px 36px',
            borderRight: `1px solid ${BORDER}`,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: GOLD, marginBottom: 20 }}>
                BY FORGE QUANTUM SOLUTIONS
              </div>
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 36, fontWeight: 900, color: INK,
                margin: '0 0 4px', lineHeight: 1.1,
              }}>One platform.</h2>
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 36, fontWeight: 700,
                fontStyle: 'italic', color: GOLD,
                margin: '0 0 24px', lineHeight: 1.1,
              }}>Every module.</h2>
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.75, margin: 0 }}>
                From check-in to checkout, billing to housekeeping — Quantum Vorvex gives
                your team a single, intelligent command centre with real-time visibility
                across your entire property.
              </p>
            </div>

            {/* Mini stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 32 }}>
              {[{ n: '15+', l: 'Integrated Modules' }, { n: '100%', l: 'GST Compliant' }].map(({ n, l }) => (
                <div key={l} style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 800, color: GOLD }}>{n}</div>
                  <div style={{ fontSize: 11, color: FAINT, marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
          }}>
            {MODULES.map((m, i) => (
              <div
                key={m.title}
                onMouseEnter={() => setHoveredModule(i)}
                onMouseLeave={() => setHoveredModule(null)}
                style={{
                  padding: '28px 28px',
                  borderRight: i % 2 === 0 ? `1px solid ${BORDER}` : 'none',
                  borderBottom: i < MODULES.length - 2 ? `1px solid ${BORDER}` : 'none',
                  background: hoveredModule === i ? '#fffef9' : 'transparent',
                  transition: 'background 0.15s',
                  cursor: 'default',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: GOLD, marginBottom: 10 }}>{m.tag}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 17, fontWeight: 700, color: INK, marginBottom: 8 }}>{m.title}</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES SECTION ─────────────────────────────────────────────────── */}
      <section id="roles" style={{
        padding: '80px 6vw',
        background: 'rgba(154,120,32,0.03)',
        borderTop: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 20, height: 1, background: GOLD }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', color: GOLD }}>ROLE-BASED ACCESS CONTROL</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36, fontWeight: 900, margin: '0 0 8px', color: INK }}>
            Right access.
          </h2>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36, fontWeight: 700, fontStyle: 'italic', margin: '0 0 48px', color: GOLD }}>
            Right people.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { icon: '👑', role: 'Owner',   color: GOLD,      perms: ['All 15 modules', 'User management', 'Financial exports', 'System settings'] },
              { icon: '🏢', role: 'Manager', color: '#4a7fc1', perms: ['Guest operations', 'Billing & food', 'Reports & analytics', 'Housekeeping'] },
              { icon: '👤', role: 'Staff',   color: '#3a8c3a', perms: ['Guest check-in', 'Room status', 'Housekeeping tasks', 'Maintenance'] },
            ].map(({ icon, role, color, perms }) => (
              <div
                key={role}
                onMouseEnter={() => setHoveredRole(role)}
                onMouseLeave={() => setHoveredRole(null)}
                style={{
                  background: WHITE,
                  border: `1px solid ${hoveredRole === role ? color + '44' : BORDER}`,
                  borderTop: `3px solid ${color}`,
                  borderRadius: 10, padding: '28px 24px',
                  transition: 'all 0.2s',
                  boxShadow: hoveredRole === role ? '0 8px 28px rgba(0,0,0,0.08)' : 'none',
                  transform: hoveredRole === role ? 'translateY(-3px)' : 'none',
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: INK, marginBottom: 16 }}>{role}</div>
                {perms.map(p => (
                  <div key={p} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: MUTED }}>
                    <span style={{ color, marginTop: 1, flexShrink: 0 }}>✓</span>{p}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 6vw', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 32, height: 1, background: GOLD }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', color: GOLD }}>GET STARTED</span>
          <div style={{ width: 32, height: 1, background: GOLD }} />
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 900, margin: '0 0 8px', color: INK }}>
          Ready to transform
        </h2>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 700, fontStyle: 'italic', margin: '0 0 28px', color: GOLD }}>
          your property?
        </h2>
        <p style={{ fontSize: 16, color: MUTED, maxWidth: 460, margin: '0 auto 40px', lineHeight: 1.7 }}>
          Sign in and manage your hotel from a single, powerful dashboard.
          GST-compliant, secure and built for India.
        </p>
        <button onClick={onLogin} style={{
          background: GOLD, color: WHITE,
          border: 'none', borderRadius: 8,
          padding: '16px 40px', fontSize: 13, fontWeight: 700,
          letterSpacing: '0.1em', cursor: 'pointer',
          transition: 'background 0.15s',
          boxShadow: `0 4px 24px rgba(154,120,32,0.3)`,
        }}
          onMouseEnter={e => e.currentTarget.style.background = '#7d6115'}
          onMouseLeave={e => e.currentTarget.style.background = GOLD}
        >SIGN IN TO PLATFORM →</button>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid ${BORDER}`,
        padding: '24px 6vw',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, background: WHITE,
      }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 700 }}>
          Forge <em style={{ color: GOLD, fontStyle: 'italic' }}>Quantum</em> Vorvex
        </div>
        <div style={{ fontSize: 12, color: FAINT }}>© 2026 Forge Quantum Solutions · Built for Indian Hospitality</div>
        <button onClick={onLogin} style={{
          background: 'none', border: `1px solid ${BORDER}`, borderRadius: 5,
          padding: '7px 18px', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.08em', color: MUTED, cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = GOLD}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >SIGN IN</button>
      </footer>

      <style>{`* { box-sizing: border-box; } @media (max-width: 768px) { section[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
