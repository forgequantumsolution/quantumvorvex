import { useState } from 'react'

const GOLD   = '#c9a84c'
const CREAM  = '#faf8f3'
const INK    = '#0f0e0a'

const NAV_LINKS = ['Features', 'Modules', 'Pricing', 'Contact']

const MODULES = [
  { icon: '▦',  label: 'Dashboard',    desc: 'Real-time KPIs & occupancy charts' },
  { icon: '⊟',  label: 'Rooms',        desc: 'Inventory, floor plan & status board' },
  { icon: '↗',  label: 'Check-In',     desc: '5-step digital check-in with docs' },
  { icon: '◎',  label: 'Guests',       desc: 'Profiles, tags, history & WhatsApp' },
  { icon: '◷',  label: 'Bookings',     desc: 'OTA sync, advance & confirmations' },
  { icon: '◑',  label: 'Billing',      desc: 'GST invoices, ledger & cash register' },
  { icon: '🔧', label: 'Maintenance',  desc: 'Tickets, priority & staff assignments' },
  { icon: '🧹', label: 'Housekeeping', desc: 'Task board, dirty/clean tracking' },
  { icon: '⊕',  label: 'Food',         desc: 'Meal plans, orders & kitchen view' },
  { icon: '◈',  label: 'Reports',      desc: 'Revenue, GST & occupancy exports' },
  { icon: '👤', label: 'Staff',        desc: 'Roles, permissions & user management' },
  { icon: '◌',  label: 'Settings',     desc: 'Hotel config, logo & system prefs' },
]

const ROLES = [
  { role: 'Owner',   color: '#c9a84c', icon: '👑', desc: 'Full access to all modules, reports, and user management. Complete system control.' },
  { role: 'Manager', color: '#6fa3d8', icon: '🔑', desc: 'Guests, billing, housekeeping, maintenance and reports. Operational authority.' },
  { role: 'Staff',   color: '#5cb85c', icon: '🪪',  desc: 'Check-in, check-out, room updates and daily task management.' },
]

const STATS = [
  { value: '15+',  label: 'Hotel Modules' },
  { value: '100%', label: 'GST Compliant' },
  { value: '3',    label: 'Role Tiers' },
  { value: '₹ INR',label: 'Native Currency' },
]

export default function LandingPage({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      background: CREAM,
      color: INK,
      width: '100%',
      height: '100dvh',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,248,243,0.94)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 clamp(16px,5vw,40px)',
          height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(15px,2vw,18px)', fontWeight: 700, fontStyle: 'italic',
            color: INK, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          }}>
            Quantum <span style={{ color: GOLD }}>Vorvex</span>
          </div>

          {/* Desktop nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="desktop-only">
            {NAV_LINKS.map(l => (
              <span key={l} style={{
                fontSize: 12.5, fontWeight: 500, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#5a5550', cursor: 'pointer',
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = GOLD}
                onMouseLeave={e => e.currentTarget.style.color = '#5a5550'}
              >{l}</span>
            ))}
          </div>

          {/* Desktop CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="desktop-only">
            <button onClick={onLogin} style={{
              padding: '8px 18px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.15)',
              background: 'transparent', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, letterSpacing: '0.06em', color: INK,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.color = INK }}
            >SIGN IN</button>
            <button onClick={onLogin} style={{
              padding: '8px 18px', borderRadius: 6, border: 'none',
              background: INK, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, letterSpacing: '0.06em', color: '#fff',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2a28'}
              onMouseLeave={e => e.currentTarget.style.background = INK}
            >GET STARTED</button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="mobile-only"
            onClick={() => setMenuOpen(o => !o)}
            style={{
              background: 'none', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 6, width: 36, height: 36,
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 18, color: INK,
            }}
          >{menuOpen ? '✕' : '☰'}</button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div style={{
            background: CREAM, borderTop: '1px solid rgba(0,0,0,0.07)',
            padding: '16px clamp(16px,5vw,40px) 20px',
          }}>
            {NAV_LINKS.map(l => (
              <div key={l} onClick={() => setMenuOpen(false)} style={{
                padding: '13px 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
                fontSize: 14, fontWeight: 500, color: '#3a3530', cursor: 'pointer',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{l}</div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => { setMenuOpen(false); onLogin() }} style={{
                flex: 1, padding: '11px', borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.15)', background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, color: INK,
              }}>SIGN IN</button>
              <button onClick={() => { setMenuOpen(false); onLogin() }} style={{
                flex: 1, padding: '11px', borderRadius: 6,
                border: 'none', background: INK,
                cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
              }}>GET STARTED</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(40px,7vh,88px) clamp(16px,5vw,40px) clamp(36px,6vh,72px)',
      }}>
        <div className="lp-hero-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'clamp(32px,5vw,72px)',
          alignItems: 'center',
        }}>
          {/* Left */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(201,168,76,0.1)',
              border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 100, padding: '5px 14px', marginBottom: 26,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, display: 'block' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: GOLD }}>
                HOTEL MANAGEMENT PLATFORM
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(34px, 5.5vw, 72px)',
              fontWeight: 900, color: INK,
              margin: '0 0 2px', lineHeight: 1.04, letterSpacing: '-0.02em',
            }}>Seamless</h1>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(34px, 5.5vw, 72px)',
              fontWeight: 900, color: INK,
              margin: '0 0 4px', lineHeight: 1.04, letterSpacing: '-0.02em',
            }}>Operations.</h1>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(24px, 4vw, 52px)',
              fontWeight: 700, fontStyle: 'italic', color: GOLD,
              margin: '0 0 22px', lineHeight: 1.1,
            }}>Intelligent Management.</h2>

            <p style={{
              fontSize: 'clamp(14px, 1.6vw, 16px)',
              color: '#6b6055', lineHeight: 1.8,
              maxWidth: 480, margin: '0 0 32px',
            }}>
              One unified platform for Indian hospitality. GST-compliant billing, smart
              check-in, real-time room tracking, and intelligent analytics — built for
              property owners who mean business.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button onClick={onLogin} style={{
                padding: 'clamp(11px,1.5vw,13px) clamp(22px,2.5vw,30px)',
                borderRadius: 8, border: 'none',
                background: INK, color: '#fff',
                fontSize: 'clamp(12px,1.3vw,13px)', fontWeight: 700,
                letterSpacing: '0.06em', cursor: 'pointer', transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#2a2a28'}
                onMouseLeave={e => e.currentTarget.style.background = INK}
              >START FREE DEMO →</button>
              <button style={{
                padding: 'clamp(11px,1.5vw,13px) clamp(22px,2.5vw,30px)',
                borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.15)',
                background: 'transparent', color: INK,
                fontSize: 'clamp(12px,1.3vw,13px)', fontWeight: 600,
                letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.color = INK }}
              >WATCH DEMO</button>
            </div>
          </div>

          {/* Right — stat cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 14,
          }}>
            {[
              { label: 'Occupancy', value: '87%',  icon: '◉', color: '#16a34a', bg: '#dcfce7' },
              { label: 'Revenue',   value: '₹2.4L', icon: '◑', color: '#c9a84c', bg: 'rgba(201,168,76,0.1)' },
              { label: 'Check-Ins', value: '6',     icon: '↗', color: '#2563eb', bg: '#dbeafe' },
              { label: 'Pending',   value: '3',     icon: '◷', color: '#d97706', bg: '#fef3c7' },
            ].map(card => (
              <div key={card.label} style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: 14, padding: 'clamp(16px,2vw,22px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: card.bg, color: card.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, marginBottom: 12,
                }}>{card.icon}</div>
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 'clamp(22px,3vw,30px)', fontWeight: 900, color: INK, lineHeight: 1,
                }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 5, fontWeight: 500 }}>{card.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section style={{
        background: INK,
        padding: 'clamp(28px,5vh,44px) clamp(16px,5vw,40px)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 'clamp(16px,3vw,40px)',
        }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(28px,4vw,44px)',
                fontWeight: 900, color: GOLD, lineHeight: 1,
              }}>{s.value}</div>
              <div style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
                marginTop: 6,
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modules ──────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div className="lp-modules-grid" style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 'clamp(24px,4vw,60px)',
          alignItems: 'start',
        }}>
          {/* Heading */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GOLD, marginBottom: 14,
            }}>PLATFORM MODULES</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(26px,3.5vw,42px)',
              fontWeight: 900, color: INK, lineHeight: 1.1,
              margin: '0 0 16px', letterSpacing: '-0.01em',
            }}>One platform.<br />Every module.</h2>
            <p style={{ fontSize: 14, color: '#6b6055', lineHeight: 1.75, margin: 0, maxWidth: 320 }}>
              From front desk to back office — Quantum Vorvex covers every workflow your hotel needs.
            </p>
            <button onClick={onLogin} style={{
              marginTop: 26,
              padding: '11px 24px', borderRadius: 7,
              border: 'none', background: GOLD, color: '#000',
              fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em',
              cursor: 'pointer', transition: 'background 0.15s', display: 'inline-block',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#d4b55a'}
              onMouseLeave={e => e.currentTarget.style.background = GOLD}
            >SIGN IN TO PLATFORM</button>
          </div>

          {/* Module grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
          }}>
            {MODULES.map(mod => (
              <div key={mod.label} style={{
                background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: 10, padding: '15px',
                transition: 'all 0.15s', cursor: 'default',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.07)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                <span style={{ fontSize: 18, display: 'block', marginBottom: 8 }}>{mod.icon}</span>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 3 }}>{mod.label}</div>
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>{mod.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────────────────────── */}
      <section style={{
        background: '#f0ede6',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(28px,4vh,48px)' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GOLD, marginBottom: 12,
            }}>ROLE-BASED ACCESS</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(26px,3.5vw,40px)',
              fontWeight: 900, color: INK, margin: 0, lineHeight: 1.1,
            }}>Right access.<br />Right people.</h2>
          </div>
          <div className="lp-roles-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 16,
          }}>
            {ROLES.map(r => (
              <div key={r.role} style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.07)',
                borderTop: `3px solid ${r.color}`,
                borderRadius: 10, padding: 'clamp(20px,3vw,26px)',
              }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{r.icon}</div>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 16, fontWeight: 700, color: INK, marginBottom: 10,
                }}>{r.role}</div>
                <div style={{ fontSize: 13, color: '#6b6055', lineHeight: 1.7 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{
        background: INK,
        padding: 'clamp(48px,8vh,80px) clamp(16px,5vw,40px)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(26px,4vw,46px)',
            fontWeight: 900, color: '#fff', lineHeight: 1.1, margin: '0 0 14px',
          }}>Ready to modernise<br />your hotel?</h2>
          <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: 15, lineHeight: 1.75, marginBottom: 32 }}>
            No installation. No backend required for demo. Sign in and explore the full
            system with real-looking mock data — instantly.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <button onClick={onLogin} style={{
              padding: '13px clamp(24px,4vw,36px)', borderRadius: 8, border: 'none',
              background: GOLD, color: '#000',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#d4b55a'}
              onMouseLeave={e => e.currentTarget.style.background = GOLD}
            >SIGN IN TO PLATFORM →</button>
            <button onClick={onLogin} style={{
              padding: '13px clamp(24px,4vw,36px)', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent', color: '#fff',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.08em',
              cursor: 'pointer', transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
            >SIGN IN</button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        background: '#060604',
        padding: 'clamp(18px,3vh,26px) clamp(16px,5vw,40px)',
        display: 'flex', flexWrap: 'wrap', gap: 12,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 15, fontStyle: 'italic', color: GOLD,
        }}>Quantum Vorvex</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Forge Quantum Solutions · GST-ready · Made for India
        </div>
      </footer>

      <style>{`
        /* Hero: 2 cols on ≥860px, 1 col below */
        .lp-hero-grid { grid-template-columns: 1fr 1fr !important; }
        @media (max-width: 860px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; }
        }
        /* Modules outer: sidebar + grid on ≥800px */
        .lp-modules-grid { grid-template-columns: 280px 1fr !important; }
        @media (max-width: 800px) {
          .lp-modules-grid { grid-template-columns: 1fr !important; }
        }
        /* Roles: 3 cols on ≥640px, 1 col below */
        .lp-roles-grid { grid-template-columns: repeat(3,1fr) !important; }
        @media (max-width: 640px) {
          .lp-roles-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 860px) and (min-width: 641px) {
          .lp-roles-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  )
}
