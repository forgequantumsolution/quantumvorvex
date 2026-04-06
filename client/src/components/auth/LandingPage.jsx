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

const WHY = [
  {
    icon: '🇮🇳',
    title: 'Built for India',
    desc: 'Native ₹ INR support, GST invoice generation, Aadhaar ID capture, and UPI-ready payment tracking — designed for the Indian hospitality market from day one.',
  },
  {
    icon: '⚡',
    title: 'Instant Setup',
    desc: 'No server, no database, no IT team. Launch the demo in seconds — explore every module with realistic hotel data before committing to anything.',
  },
  {
    icon: '🔒',
    title: 'Role-Based Security',
    desc: 'Granular permissions across Owner, Manager, and Staff tiers. Every action is logged. No staff can access what they shouldn\'t.',
  },
  {
    icon: '📊',
    title: 'Real-Time Intelligence',
    desc: 'Live occupancy rates, revenue dashboards, overdue checkouts, and housekeeping status — all updating in real time across every device.',
  },
]

const FEATURES = [
  {
    badge: 'BILLING & GST',
    color: GOLD,
    bg: 'rgba(201,168,76,0.08)',
    title: 'GST-compliant invoicing in seconds',
    desc: 'Generate itemised tax invoices with CGST/SGST/IGST breakdowns, print or share via WhatsApp, and export reports for your CA — all from one screen.',
    points: ['Auto GST calculation per room & service', 'PDF invoice with hotel letterhead', 'Monthly GST summary export', 'Multi-currency record (INR base)'],
    icon: '◑',
  },
  {
    badge: 'CHECK-IN / CHECK-OUT',
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.07)',
    title: 'Digital check-in with ID capture',
    desc: 'Walk guests through a guided 5-step check-in flow — room assignment, ID scan, advance payment, welcome note, and key handover — in under two minutes.',
    points: ['Aadhaar, Passport & Driving Licence support', 'Advance & balance payment tracking', 'Automatic room status update on checkout', 'Guest history & returning guest flags'],
    icon: '↗',
  },
  {
    badge: 'HOUSEKEEPING',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.07)',
    title: 'Live task board for your housekeeping team',
    desc: 'Staff see exactly which rooms need cleaning, inspection, or are blocked for maintenance. Managers see real-time progress. Guests get ready rooms faster.',
    points: ['Dirty / Clean / Inspect / Blocked statuses', 'Staff assignment & priority flags', 'Auto-trigger on checkout', 'Supervisor sign-off workflow'],
    icon: '🧹',
  },
]

const HOW_STEPS = [
  {
    step: '01',
    title: 'Sign In',
    desc: 'Use any demo account — Owner, Manager, or Staff — to enter the platform instantly. No setup required.',
  },
  {
    step: '02',
    title: 'Explore Every Module',
    desc: 'Navigate rooms, guests, billing, housekeeping, and reports with realistic mock data already loaded.',
  },
  {
    step: '03',
    title: 'Go Live',
    desc: 'When ready, connect your backend, import your room list, and onboard your team in a day.',
  },
]

const TESTIMONIALS = [
  {
    quote: 'We switched from paper registers and Excel. Now our front desk handles check-ins in half the time. The GST reports alone save us 4 hours every month.',
    name: 'Arvind Mehta',
    title: 'Owner, Hotel Shivalik, Rishikesh',
    initial: 'A',
    color: GOLD,
  },
  {
    quote: 'The housekeeping board changed everything. Staff know exactly what to do and managers can see progress live. No more WhatsApp chaos between floors.',
    name: 'Priya Nair',
    title: 'General Manager, Sea Pearl Resort, Goa',
    initial: 'P',
    color: '#2563eb',
  },
  {
    quote: 'I manage three properties. Quantum Vorvex gives each property manager the right access, and I get a bird\'s eye view of occupancy and revenue across all three.',
    name: 'Suresh Agarwal',
    title: 'Owner, Agarwal Hotel Group, Jaipur',
    initial: 'S',
    color: '#16a34a',
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: '₹2,999',
    period: '/month',
    desc: 'Perfect for small properties with up to 20 rooms.',
    features: ['Up to 20 rooms', '2 staff accounts', 'GST invoicing', 'Check-in & check-out', 'Basic reports', 'Email support'],
    cta: 'Get Started',
    highlight: false,
    color: INK,
  },
  {
    name: 'Professional',
    price: '₹6,999',
    period: '/month',
    desc: 'For mid-size hotels that need the full platform.',
    features: ['Unlimited rooms', '10 staff accounts', 'All 15+ modules', 'Housekeeping & maintenance', 'Advanced analytics', 'WhatsApp & PDF exports', 'Priority support'],
    cta: 'Start Free Trial',
    highlight: true,
    color: GOLD,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'Multi-property groups, custom integrations, dedicated onboarding.',
    features: ['Multiple properties', 'Unlimited accounts', 'OTA channel sync', 'Custom reports & branding', 'API access', 'Dedicated account manager'],
    cta: 'Contact Us',
    highlight: false,
    color: INK,
  },
]

const FAQS = [
  {
    q: 'Does the demo need a backend or internet connection?',
    a: 'No. The demo runs entirely in your browser with mock data. You can explore every feature — rooms, billing, housekeeping, reports — without any server or internet connection.',
  },
  {
    q: 'Is the billing module really GST compliant?',
    a: 'Yes. Invoices include CGST/SGST/IGST breakdowns based on the service type. You can export a monthly GST summary in Excel format for your CA or for GSTR-1 filing.',
  },
  {
    q: 'Can I control what each staff member sees?',
    a: 'Absolutely. The Owner role has full access. Manager has operational access. Staff can only access check-in, room updates, and task management. You can also create custom role configurations.',
  },
  {
    q: 'Does it work on mobile phones?',
    a: 'Yes — the entire platform is mobile-responsive. Front desk staff can do check-ins on a tablet, housekeeping can update room status from their phone, and owners can track KPIs from anywhere.',
  },
  {
    q: 'How long does it take to go live?',
    a: 'Most hotels are fully operational within one day. Import your room list, add your staff accounts, configure your GST details, and you\'re ready to take the first check-in.',
  },
  {
    q: 'What happens to our data?',
    a: 'Your data is stored securely on Indian servers, encrypted at rest and in transit. We do not share or sell your data. You can export everything at any time.',
  },
]

const FOOTER_LINKS = {
  Product: ['Features', 'Modules', 'Pricing', 'Roadmap', 'Changelog'],
  Company: ['About Us', 'Careers', 'Blog', 'Press Kit'],
  Support: ['Documentation', 'API Reference', 'Help Centre', 'Contact Us'],
  Legal: ['Privacy Policy', 'Terms of Service', 'GST Policy', 'Refund Policy'],
}

export default function LandingPage({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq,  setOpenFaq]  = useState(null)

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
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(15px,2vw,18px)', fontWeight: 700, fontStyle: 'italic',
            color: INK, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          }}>
            Quantum <span style={{ color: GOLD }}>Vorvex</span>
          </div>

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
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

      {/* ── Why Quantum Vorvex ───────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px,5vh,52px)' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: GOLD, marginBottom: 12,
          }}>WHY QUANTUM VORVEX</div>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(26px,3.5vw,42px)',
            fontWeight: 900, color: INK, margin: '0 0 14px', lineHeight: 1.1,
          }}>Designed for the way<br />Indian hotels actually work.</h2>
          <p style={{ fontSize: 14, color: '#6b6055', lineHeight: 1.75, maxWidth: 520, margin: '0 auto' }}>
            Not a generic SaaS from abroad. Every detail — from GST slabs to Aadhaar ID capture — is built for the Indian hospitality context.
          </p>
        </div>

        <div className="lp-why-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 16,
        }}>
          {WHY.map(w => (
            <div key={w.title} style={{
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: 12, padding: 'clamp(20px,2.5vw,28px)',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.09)'
                e.currentTarget.style.transform = 'translateY(-3px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'none'
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 14 }}>{w.icon}</div>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 15, fontWeight: 700, color: INK, marginBottom: 10,
              }}>{w.title}</div>
              <div style={{ fontSize: 13, color: '#6b6055', lineHeight: 1.75 }}>{w.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modules ──────────────────────────────────────────────────────── */}
      <section style={{
        background: '#f0ede6',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="lp-modules-grid" style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: 'clamp(24px,4vw,60px)',
            alignItems: 'start',
          }}>
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
        </div>
      </section>

      {/* ── Feature deep-dive ────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px,5vh,52px)' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: GOLD, marginBottom: 12,
          }}>KEY FEATURES</div>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(26px,3.5vw,42px)',
            fontWeight: 900, color: INK, margin: 0, lineHeight: 1.1,
          }}>Every detail.<br />Thought through.</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={f.badge} className="lp-feature-card" style={{
              display: 'grid',
              gridTemplateColumns: i % 2 === 0 ? '1fr 420px' : '420px 1fr',
              gap: 'clamp(24px,4vw,60px)',
              alignItems: 'center',
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: 16, padding: 'clamp(28px,4vw,44px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
            }}>
              {/* Text */}
              <div style={{ order: i % 2 === 0 ? 0 : 1 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: f.bg, borderRadius: 100, padding: '4px 12px',
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: f.color,
                  marginBottom: 16,
                }}>{f.badge}</div>
                <h3 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 'clamp(20px,2.5vw,28px)',
                  fontWeight: 900, color: INK, margin: '0 0 14px', lineHeight: 1.2,
                }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#6b6055', lineHeight: 1.8, margin: '0 0 20px' }}>{f.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {f.points.map(p => (
                    <li key={p} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 9,
                      fontSize: 13.5, color: '#3a3530', marginBottom: 9, lineHeight: 1.5,
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: f.bg, color: f.color,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 1,
                      }}>✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div style={{
                order: i % 2 === 0 ? 1 : 0,
                background: f.bg,
                borderRadius: 12,
                height: 'clamp(180px,22vw,260px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'clamp(56px,8vw,96px)',
              }}>{f.icon}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section style={{
        background: INK,
        padding: 'clamp(48px,8vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(28px,5vh,52px)' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GOLD, marginBottom: 12,
            }}>HOW IT WORKS</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(26px,3.5vw,42px)',
              fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1,
            }}>Up and running<br />in minutes.</h2>
          </div>

          <div className="lp-steps-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'clamp(16px,3vw,32px)',
          }}>
            {HOW_STEPS.map((s, i) => (
              <div key={s.step} style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: 'clamp(24px,3vw,32px)',
              }}>
                {i < HOW_STEPS.length - 1 && (
                  <div className="desktop-only" style={{
                    position: 'absolute', right: -16, top: '38%',
                    fontSize: 20, color: 'rgba(255,255,255,0.15)', zIndex: 1,
                  }}>→</div>
                )}
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 'clamp(40px,5vw,64px)', fontWeight: 900,
                  color: GOLD, lineHeight: 1, marginBottom: 16, opacity: 0.7,
                }}>{s.step}</div>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10,
                }}>{s.title}</div>
                <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button onClick={onLogin} style={{
              padding: '13px 36px', borderRadius: 8, border: 'none',
              background: GOLD, color: '#000',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#d4b55a'}
              onMouseLeave={e => e.currentTarget.style.background = GOLD}
            >TRY THE DEMO NOW →</button>
          </div>
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
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
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section style={{
        background: '#f0ede6',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(28px,5vh,52px)' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GOLD, marginBottom: 12,
            }}>WHAT HOTELIERS SAY</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(26px,3.5vw,42px)',
              fontWeight: 900, color: INK, margin: 0, lineHeight: 1.1,
            }}>Trusted by hotel owners<br />across India.</h2>
          </div>

          <div className="lp-testimonials-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
          }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: 14, padding: 'clamp(22px,3vw,32px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', gap: 20,
              }}>
                <div style={{
                  fontSize: 36, color: t.color, lineHeight: 1, fontFamily: 'Georgia, serif',
                  opacity: 0.5,
                }}>"</div>
                <p style={{
                  fontSize: 14, color: '#3a3530', lineHeight: 1.8,
                  margin: 0, flex: 1, fontStyle: 'italic',
                }}>{t.quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: t.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>{t.initial}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: '#888', marginTop: 2 }}>{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px,5vh,52px)' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: GOLD, marginBottom: 12,
          }}>PRICING</div>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(26px,3.5vw,42px)',
            fontWeight: 900, color: INK, margin: '0 0 14px', lineHeight: 1.1,
          }}>Simple, transparent pricing.</h2>
          <p style={{ fontSize: 14, color: '#6b6055', lineHeight: 1.75 }}>
            No hidden fees. No per-user charges. Cancel anytime.
          </p>
        </div>

        <div className="lp-pricing-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}>
          {PLANS.map(plan => (
            <div key={plan.name} style={{
              background: plan.highlight ? INK : '#fff',
              border: plan.highlight ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.09)',
              borderRadius: 14,
              padding: 'clamp(24px,3vw,36px)',
              position: 'relative',
              boxShadow: plan.highlight ? '0 12px 48px rgba(0,0,0,0.18)' : '0 4px 20px rgba(0,0,0,0.05)',
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: GOLD, color: '#000',
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em',
                  padding: '4px 14px', borderRadius: 100,
                }}>MOST POPULAR</div>
              )}
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: plan.highlight ? 'rgba(255,255,255,0.45)' : '#888',
                marginBottom: 10,
              }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 'clamp(28px,3.5vw,38px)', fontWeight: 900,
                  color: plan.highlight ? GOLD : INK,
                }}>{plan.price}</span>
                {plan.period && (
                  <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.35)' : '#888' }}>{plan.period}</span>
                )}
              </div>
              <p style={{
                fontSize: 13, lineHeight: 1.65, margin: '0 0 22px',
                color: plan.highlight ? 'rgba(255,255,255,0.5)' : '#6b6055',
              }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {plan.features.map(f => (
                  <li key={f} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.75)' : '#3a3530',
                  }}>
                    <span style={{ color: GOLD, fontWeight: 700, fontSize: 12 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={onLogin} style={{
                width: '100%', padding: '12px',
                borderRadius: 8,
                border: plan.highlight ? 'none' : `1.5px solid ${plan.color === GOLD ? GOLD : 'rgba(0,0,0,0.15)'}`,
                background: plan.highlight ? GOLD : 'transparent',
                color: plan.highlight ? '#000' : plan.color,
                fontSize: 12.5, fontWeight: 700, letterSpacing: '0.07em',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => {
                  if (plan.highlight) { e.currentTarget.style.background = '#d4b55a' }
                  else { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }
                }}
                onMouseLeave={e => {
                  if (plan.highlight) { e.currentTarget.style.background = GOLD }
                  else { e.currentTarget.style.borderColor = plan.color === GOLD ? GOLD : 'rgba(0,0,0,0.15)'; e.currentTarget.style.color = plan.color }
                }}
              >{plan.cta}</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section style={{
        background: '#f0ede6',
        padding: 'clamp(44px,7vh,80px) clamp(16px,5vw,40px)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(28px,5vh,52px)' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: GOLD, marginBottom: 12,
            }}>FAQ</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(26px,3.5vw,42px)',
              fontWeight: 900, color: INK, margin: 0, lineHeight: 1.1,
            }}>Common questions,<br />honest answers.</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: 10, overflow: 'hidden',
                transition: 'box-shadow 0.15s',
                boxShadow: openFaq === i ? '0 4px 20px rgba(0,0,0,0.07)' : 'none',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 'clamp(14px,2vw,20px) clamp(16px,2.5vw,24px)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                  }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: INK, lineHeight: 1.4 }}>{faq.q}</span>
                  <span style={{
                    fontSize: 18, color: GOLD, flexShrink: 0,
                    transition: 'transform 0.2s',
                    transform: openFaq === i ? 'rotate(45deg)' : 'none',
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{
                    padding: '0 clamp(16px,2.5vw,24px) clamp(14px,2vw,20px)',
                    fontSize: 13.5, color: '#6b6055', lineHeight: 1.8,
                  }}>{faq.a}</div>
                )}
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
      <footer style={{ background: '#060604' }}>
        {/* Main footer grid */}
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: 'clamp(40px,6vh,64px) clamp(16px,5vw,40px) clamp(28px,4vh,48px)',
        }}>
          <div className="lp-footer-grid" style={{
            display: 'grid',
            gridTemplateColumns: '240px repeat(4, 1fr)',
            gap: 'clamp(24px,3vw,48px)',
          }}>
            {/* Brand column */}
            <div>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 18, fontStyle: 'italic', fontWeight: 700, color: GOLD, marginBottom: 12,
              }}>Quantum Vorvex</div>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.8, margin: '0 0 20px' }}>
                Hotel management software built for the Indian hospitality industry.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {['𝕏', 'in', 'f', '▶'].map(s => (
                  <div key={s} style={{
                    width: 32, height: 32, borderRadius: 7,
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: 'rgba(255,255,255,0.35)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
                  >{s}</div>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
                  marginBottom: 16,
                }}>{category}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(l => (
                    <span key={l} style={{
                      fontSize: 13, color: 'rgba(255,255,255,0.45)',
                      cursor: 'pointer', transition: 'color 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                    >{l}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer bottom bar */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: 'clamp(14px,2vh,20px) clamp(16px,5vw,40px)',
          display: 'flex', flexWrap: 'wrap', gap: 12,
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.22)' }}>
            © 2026 Forge Quantum Solutions Pvt. Ltd. · GST-ready · Made for India 🇮🇳
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy', 'Terms', 'Cookies'].map(l => (
              <span key={l} style={{
                fontSize: 11.5, color: 'rgba(255,255,255,0.22)',
                cursor: 'pointer', transition: 'color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.22)'}
              >{l}</span>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        /* Hero: 2 cols on ≥860px, 1 col below */
        .lp-hero-grid { grid-template-columns: 1fr 1fr !important; }
        @media (max-width: 860px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; }
        }
        /* Why: 4 cols → 2 → 1 */
        .lp-why-grid { grid-template-columns: repeat(4,1fr) !important; }
        @media (max-width: 860px) {
          .lp-why-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 540px) {
          .lp-why-grid { grid-template-columns: 1fr !important; }
        }
        /* Modules outer: sidebar + grid on ≥800px */
        .lp-modules-grid { grid-template-columns: 280px 1fr !important; }
        @media (max-width: 800px) {
          .lp-modules-grid { grid-template-columns: 1fr !important; }
        }
        /* Feature deep-dive cards: side-by-side on ≥760px, stacked below */
        .lp-feature-card { grid-template-columns: 1fr 420px !important; }
        @media (max-width: 760px) {
          .lp-feature-card { grid-template-columns: 1fr !important; }
          .lp-feature-card > div { order: 0 !important; }
        }
        /* How it works: 3 cols → 1 */
        .lp-steps-grid { grid-template-columns: repeat(3,1fr) !important; }
        @media (max-width: 680px) {
          .lp-steps-grid { grid-template-columns: 1fr !important; }
        }
        /* Roles: 3 cols → 2 → 1 */
        .lp-roles-grid { grid-template-columns: repeat(3,1fr) !important; }
        @media (max-width: 640px) {
          .lp-roles-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 860px) and (min-width: 641px) {
          .lp-roles-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        /* Testimonials: 3 cols → 1 */
        .lp-testimonials-grid { grid-template-columns: repeat(3,1fr) !important; }
        @media (max-width: 860px) {
          .lp-testimonials-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 1100px) and (min-width: 861px) {
          .lp-testimonials-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        /* Pricing: 3 cols → 1 */
        .lp-pricing-grid { grid-template-columns: repeat(3,1fr) !important; }
        @media (max-width: 900px) {
          .lp-pricing-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 1100px) and (min-width: 901px) {
          .lp-pricing-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        /* Footer grid: brand + 4 cols → 2 cols → 1 */
        .lp-footer-grid { grid-template-columns: 240px repeat(4,1fr) !important; }
        @media (max-width: 860px) {
          .lp-footer-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 480px) {
          .lp-footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
