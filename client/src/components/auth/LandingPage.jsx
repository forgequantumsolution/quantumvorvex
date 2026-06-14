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
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [openFaq,       setOpenFaq]       = useState(null)
  const [contactForm,   setContactForm]   = useState({ name: '', email: '', property: '', message: '' })
  const [contactSent,   setContactSent]   = useState(false)
  const [contactLoading,setContactLoading]= useState(false)
  const [contactFocus,  setContactFocus]  = useState({})

  const setContact = (k, v) => setContactForm(f => ({ ...f, [k]: v }))
  const handleContactSubmit = (e) => {
    e.preventDefault()
    if (!contactForm.name || !contactForm.email) return
    setContactLoading(true)
    setTimeout(() => { setContactLoading(false); setContactSent(true) }, 1200)
  }

  return (
    <div className="w-full h-[100dvh] overflow-y-auto overflow-x-hidden" style={{
      background: CREAM,
      color: INK,
    }}>

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-[100] bg-[rgba(250,248,243,0.94)] backdrop-blur-[12px] border-b border-b-[rgba(0,0,0,0.07)]">
        <div className="max-w-[1200px] mx-auto px-[clamp(16px,5vw,40px)] h-[60px] flex items-center justify-between">
          <div className="text-[clamp(15px,2vw,18px)] font-bold italic tracking-[-0.01em] whitespace-nowrap" style={{
            color: INK,
          }}>
            Quantum <span style={{ color: GOLD }}>Vorvex</span>
          </div>

          <div className="desktop-only flex items-center gap-7">
            {NAV_LINKS.map(l => (
              <span key={l} className="text-[12.5px] font-medium tracking-[0.06em] uppercase text-[#5a5550] cursor-pointer transition-colors duration-150"
                onMouseEnter={e => e.currentTarget.style.color = GOLD}
                onMouseLeave={e => e.currentTarget.style.color = '#5a5550'}
              >{l}</span>
            ))}
          </div>

          <div className="desktop-only flex items-center gap-2.5">
            <button onClick={onLogin} className="px-[18px] py-2 rounded-md border border-[rgba(0,0,0,0.15)] bg-transparent cursor-pointer text-[12.5px] font-semibold tracking-[0.06em] transition-all duration-150" style={{
              color: INK,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.color = INK }}
            >SIGN IN</button>
            <button onClick={onLogin} className="px-[18px] py-2 rounded-md border-none cursor-pointer text-[12.5px] font-semibold tracking-[0.06em] text-white transition-[background] duration-150" style={{
              background: INK,
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2a28'}
              onMouseLeave={e => e.currentTarget.style.background = INK}
            >GET STARTED</button>
          </div>

          <button
            className="mobile-only bg-none border border-[rgba(0,0,0,0.12)] rounded-md w-9 h-9 items-center justify-center cursor-pointer text-[18px]"
            onClick={() => setMenuOpen(o => !o)}
            style={{
              color: INK,
            }}
          >{menuOpen ? '✕' : '☰'}</button>
        </div>

        {menuOpen && (
          <div className="border-t border-t-[rgba(0,0,0,0.07)] pt-4 px-[clamp(16px,5vw,40px)] pb-5" style={{
            background: CREAM,
          }}>
            {NAV_LINKS.map(l => (
              <div key={l} onClick={() => setMenuOpen(false)} className="t-body py-[13px] border-b border-b-[rgba(0,0,0,0.05)] text-[#3a3530] cursor-pointer tracking-[0.04em] uppercase">{l}</div>
            ))}
            <div className="flex gap-2.5 mt-4">
              <button onClick={() => { setMenuOpen(false); onLogin() }} className="t-title flex-1 p-[11px] rounded-md border border-[rgba(0,0,0,0.15)] bg-transparent cursor-pointer" style={{
                color: INK,
              }}>SIGN IN</button>
              <button onClick={() => { setMenuOpen(false); onLogin() }} className="t-title flex-1 p-[11px] rounded-md border-none cursor-pointer text-white" style={{
                background: INK,
              }}>GET STARTED</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto pt-[clamp(40px,7vh,88px)] px-[clamp(16px,5vw,40px)] pb-[clamp(36px,6vh,72px)]">
        <div className="lp-hero-grid grid grid-cols-2 gap-[clamp(32px,5vw,72px)] items-center">
          <div>
            <div className="inline-flex items-center gap-[7px] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.3)] rounded-[100px] px-[14px] py-[5px] mb-[26px]">
              <span className="w-1.5 h-1.5 rounded-full block" style={{ background: GOLD }} />
              <span className="t-label tracking-[0.16em]" style={{ color: GOLD }}>
                HOTEL MANAGEMENT PLATFORM
              </span>
            </div>

            <h1 className="text-[clamp(34px,5.5vw,72px)] font-black mt-0 mx-0 mb-0.5 leading-[1.04] tracking-[-0.02em]" style={{
              color: INK,
            }}>Seamless</h1>
            <h1 className="text-[clamp(34px,5.5vw,72px)] font-black mt-0 mx-0 mb-1 leading-[1.04] tracking-[-0.02em]" style={{
              color: INK,
            }}>Operations.</h1>
            <h2 className="text-[clamp(24px,4vw,52px)] font-bold italic mt-0 mx-0 mb-[22px] leading-[1.1]" style={{
              color: GOLD,
            }}>Intelligent Management.</h2>

            <p className="text-[clamp(14px,1.6vw,16px)] text-[#6b6055] leading-[1.8] max-w-[480px] mt-0 mx-0 mb-8">
              One unified platform for Indian hospitality. GST-compliant billing, smart
              check-in, real-time room tracking, and intelligent analytics — built for
              property owners who mean business.
            </p>

            <div className="flex flex-wrap gap-3">
              <button onClick={onLogin} className="px-[clamp(22px,2.5vw,30px)] py-[clamp(11px,1.5vw,13px)] rounded-lg border-none text-white text-[clamp(12px,1.3vw,13px)] font-bold tracking-[0.06em] cursor-pointer transition-[background] duration-150" style={{
                background: INK,
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#2a2a28'}
                onMouseLeave={e => e.currentTarget.style.background = INK}
              >START FREE DEMO →</button>
              <button className="px-[clamp(22px,2.5vw,30px)] py-[clamp(11px,1.5vw,13px)] rounded-lg border-[1.5px] border-[rgba(0,0,0,0.15)] bg-transparent text-[clamp(12px,1.3vw,13px)] font-semibold tracking-[0.06em] cursor-pointer transition-all duration-150" style={{
                color: INK,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.color = INK }}
              >WATCH DEMO</button>
            </div>
          </div>

          {/* Right — stat cards */}
          <div className="grid grid-cols-2 gap-[14px]">
            {[
              { label: 'Occupancy', value: '87%',  icon: '◉', color: '#16a34a', bg: '#dcfce7' },
              { label: 'Revenue',   value: '₹2.4L', icon: '◑', color: '#c9a84c', bg: 'rgba(201,168,76,0.1)' },
              { label: 'Check-Ins', value: '6',     icon: '↗', color: '#2563eb', bg: '#dbeafe' },
              { label: 'Pending',   value: '3',     icon: '◷', color: '#d97706', bg: '#fef3c7' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-[14px] p-[clamp(16px,2vw,22px)] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[16px] mb-3" style={{
                  background: card.bg, color: card.color,
                }}>{card.icon}</div>
                <div className="text-[clamp(22px,3vw,30px)] font-black leading-none" style={{
                  color: INK,
                }}>{card.value}</div>
                <div className="t-label text-[#888] mt-[5px]">{card.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section className="py-[clamp(28px,5vh,44px)] px-[clamp(16px,5vw,40px)]" style={{
        background: INK,
      }}>
        <div className="max-w-[1200px] mx-auto grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-[clamp(16px,3vw,40px)]">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-[clamp(28px,4vw,44px)] font-black leading-none" style={{
                color: GOLD,
              }}>{s.value}</div>
              <div className="text-[10.5px] font-semibold tracking-[0.1em] uppercase text-[rgba(255,255,255,0.4)] mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Quantum Vorvex ───────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto py-[clamp(44px,7vh,80px)] px-[clamp(16px,5vw,40px)]">
        <div className="text-center mb-[clamp(28px,5vh,52px)]">
          <div className="t-label tracking-[0.16em] mb-3" style={{
            color: GOLD,
          }}>WHY QUANTUM VORVEX</div>
          <h2 className="text-[clamp(26px,3.5vw,42px)] font-black mt-0 mx-0 mb-[14px] leading-[1.1]" style={{
            color: INK,
          }}>Designed for the way<br />Indian hotels actually work.</h2>
          <p className="t-body text-[#6b6055] leading-[1.75] max-w-[520px] mx-auto">
            Not a generic SaaS from abroad. Every detail — from GST slabs to Aadhaar ID capture — is built for the Indian hospitality context.
          </p>
        </div>

        <div className="lp-why-grid grid grid-cols-4 gap-4">
          {WHY.map(w => (
            <div key={w.title} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl p-[clamp(20px,2.5vw,28px)] transition-all duration-150"
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.09)'
                e.currentTarget.style.transform = 'translateY(-3px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'none'
              }}
            >
              <div className="text-[28px] mb-[14px]">{w.icon}</div>
              <div className="t-h3 mb-2.5" style={{
                color: INK,
              }}>{w.title}</div>
              <div className="t-sm text-[#6b6055] leading-[1.75]">{w.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modules ──────────────────────────────────────────────────────── */}
      <section className="bg-[#f0ede6] py-[clamp(44px,7vh,80px)] px-[clamp(16px,5vw,40px)]">
        <div className="max-w-[1200px] mx-auto">
          <div className="lp-modules-grid grid grid-cols-[280px_1fr] gap-[clamp(24px,4vw,60px)] items-start">
            <div>
              <div className="t-label tracking-[0.16em] mb-[14px]" style={{
                color: GOLD,
              }}>PLATFORM MODULES</div>
              <h2 className="text-[clamp(26px,3.5vw,42px)] font-black leading-[1.1] mt-0 mx-0 mb-4 tracking-[-0.01em]" style={{
                color: INK,
              }}>One platform.<br />Every module.</h2>
              <p className="t-body text-[#6b6055] leading-[1.75] m-0 max-w-[320px]">
                From front desk to back office — Quantum Vorvex covers every workflow your hotel needs.
              </p>
              <button onClick={onLogin} className="mt-[26px] px-6 py-[11px] rounded-[7px] border-none text-black text-[12.5px] font-bold tracking-[0.06em] cursor-pointer transition-[background] duration-150 inline-block" style={{
                background: GOLD,
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#d4b55a'}
                onMouseLeave={e => e.currentTarget.style.background = GOLD}
              >SIGN IN TO PLATFORM</button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
              {MODULES.map(mod => (
                <div key={mod.label} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-[10px] p-[15px] transition-all duration-150 cursor-default"
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
                  <span className="text-[18px] block mb-2">{mod.icon}</span>
                  <div className="text-[12.5px] font-semibold mb-[3px]" style={{ color: INK }}>{mod.label}</div>
                  <div className="t-xs text-[#888] leading-[1.5]">{mod.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature deep-dive ────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto py-[clamp(44px,7vh,80px)] px-[clamp(16px,5vw,40px)]">
        <div className="text-center mb-[clamp(28px,5vh,52px)]">
          <div className="t-label tracking-[0.16em] mb-3" style={{
            color: GOLD,
          }}>KEY FEATURES</div>
          <h2 className="text-[clamp(26px,3.5vw,42px)] font-black m-0 leading-[1.1]" style={{
            color: INK,
          }}>Every detail.<br />Thought through.</h2>
        </div>

        <div className="flex flex-col gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.badge} className="lp-feature-card grid gap-[clamp(24px,4vw,60px)] items-center bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-[clamp(28px,4vw,44px)] shadow-[0_4px_24px_rgba(0,0,0,0.05)]" style={{
              gridTemplateColumns: i % 2 === 0 ? '1fr 420px' : '420px 1fr',
            }}>
              {/* Text */}
              <div style={{ order: i % 2 === 0 ? 0 : 1 }}>
                <div className="inline-flex items-center gap-1.5 rounded-[100px] px-3 py-1 text-[9.5px] font-bold tracking-[0.12em] mb-4" style={{
                  background: f.bg, color: f.color,
                }}>{f.badge}</div>
                <h3 className="text-[clamp(20px,2.5vw,28px)] font-black mt-0 mx-0 mb-[14px] leading-[1.2]" style={{
                  color: INK,
                }}>{f.title}</h3>
                <p className="t-body text-[#6b6055] leading-[1.8] mt-0 mx-0 mb-5">{f.desc}</p>
                <ul className="list-none p-0 m-0">
                  {f.points.map(p => (
                    <li key={p} className="flex items-start gap-[9px] text-[13.5px] text-[#3a3530] mb-[9px] leading-[1.5]">
                      <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-bold shrink-0 mt-px" style={{
                        background: f.bg, color: f.color,
                      }}>✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div className="rounded-xl h-[clamp(180px,22vw,260px)] flex items-center justify-center text-[clamp(56px,8vw,96px)]" style={{
                order: i % 2 === 0 ? 1 : 0,
                background: f.bg,
              }}>{f.icon}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-[clamp(48px,8vh,80px)] px-[clamp(16px,5vw,40px)]" style={{
        background: INK,
      }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-[clamp(28px,5vh,52px)]">
            <div className="t-label tracking-[0.16em] mb-3" style={{
              color: GOLD,
            }}>HOW IT WORKS</div>
            <h2 className="text-[clamp(26px,3.5vw,42px)] font-black text-white m-0 leading-[1.1]">Up and running<br />in minutes.</h2>
          </div>

          <div className="lp-steps-grid grid grid-cols-3 gap-[clamp(16px,3vw,32px)]">
            {HOW_STEPS.map((s, i) => (
              <div key={s.step} className="relative bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-[14px] p-[clamp(24px,3vw,32px)]">
                {i < HOW_STEPS.length - 1 && (
                  <div className="desktop-only absolute -right-4 top-[38%] text-[20px] text-[rgba(255,255,255,0.15)] z-[1]">→</div>
                )}
                <div className="text-[clamp(40px,5vw,64px)] font-black leading-none mb-4 opacity-70" style={{
                  color: GOLD,
                }}>{s.step}</div>
                <div className="t-h2 text-white mb-2.5">{s.title}</div>
                <div className="text-[13.5px] text-[rgba(255,255,255,0.5)] leading-[1.75]">{s.desc}</div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button onClick={onLogin} className="t-title px-9 py-[13px] rounded-lg border-none text-black tracking-[0.08em] cursor-pointer transition-[background] duration-150" style={{
              background: GOLD,
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#d4b55a'}
              onMouseLeave={e => e.currentTarget.style.background = GOLD}
            >TRY THE DEMO NOW →</button>
          </div>
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto py-[clamp(44px,7vh,80px)] px-[clamp(16px,5vw,40px)]">
        <div className="text-center mb-[clamp(28px,4vh,48px)]">
          <div className="t-label tracking-[0.16em] mb-3" style={{
            color: GOLD,
          }}>ROLE-BASED ACCESS</div>
          <h2 className="text-[clamp(26px,3.5vw,40px)] font-black m-0 leading-[1.1]" style={{
            color: INK,
          }}>Right access.<br />Right people.</h2>
        </div>
        <div className="lp-roles-grid grid grid-cols-3 gap-4">
          {ROLES.map(r => (
            <div key={r.role} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-[10px] p-[clamp(20px,3vw,26px)]" style={{
              borderTop: `3px solid ${r.color}`,
            }}>
              <div className="text-[24px] mb-3">{r.icon}</div>
              <div className="t-h3 mb-2.5" style={{
                color: INK,
              }}>{r.role}</div>
              <div className="t-sm text-[#6b6055] leading-[1.7]">{r.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="bg-[#f0ede6] py-[clamp(44px,7vh,80px)] px-[clamp(16px,5vw,40px)]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-[clamp(28px,5vh,52px)]">
            <div className="t-label tracking-[0.16em] mb-3" style={{
              color: GOLD,
            }}>WHAT HOTELIERS SAY</div>
            <h2 className="text-[clamp(26px,3.5vw,42px)] font-black m-0 leading-[1.1]" style={{
              color: INK,
            }}>Trusted by hotel owners<br />across India.</h2>
          </div>

          <div className="lp-testimonials-grid grid grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-[14px] p-[clamp(22px,3vw,32px)] shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-col gap-5">
                <div className="text-[36px] leading-none opacity-50" style={{
                  color: t.color,
                }}>"</div>
                <p className="t-body text-[#3a3530] leading-[1.8] m-0 flex-1 italic">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold text-white shrink-0" style={{
                    background: t.color,
                  }}>{t.initial}</div>
                  <div>
                    <div className="t-title" style={{ color: INK }}>{t.name}</div>
                    <div className="text-[11.5px] text-[#888] mt-0.5">{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto py-[clamp(44px,7vh,80px)] px-[clamp(16px,5vw,40px)]">
        <div className="text-center mb-[clamp(28px,5vh,52px)]">
          <div className="t-label tracking-[0.16em] mb-3" style={{
            color: GOLD,
          }}>PRICING</div>
          <h2 className="text-[clamp(26px,3.5vw,42px)] font-black mt-0 mx-0 mb-[14px] leading-[1.1]" style={{
            color: INK,
          }}>Simple, transparent pricing.</h2>
          <p className="t-body text-[#6b6055] leading-[1.75]">
            No hidden fees. No per-user charges. Cancel anytime.
          </p>
        </div>

        <div className="lp-pricing-grid grid grid-cols-3 gap-5 items-start">
          {PLANS.map(plan => (
            <div key={plan.name} className="rounded-[14px] p-[clamp(24px,3vw,36px)] relative" style={{
              background: plan.highlight ? INK : '#fff',
              border: plan.highlight ? `2px solid ${GOLD}` : '1px solid rgba(0,0,0,0.09)',
              boxShadow: plan.highlight ? '0 12px 48px rgba(0,0,0,0.18)' : '0 4px 20px rgba(0,0,0,0.05)',
            }}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-black text-[9.5px] font-extrabold tracking-[0.12em] px-[14px] py-1 rounded-[100px]" style={{
                  background: GOLD,
                }}>MOST POPULAR</div>
              )}
              <div className="t-label tracking-[0.1em] mb-2.5" style={{
                color: plan.highlight ? 'rgba(255,255,255,0.45)' : '#888',
              }}>{plan.name}</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-[clamp(28px,3.5vw,38px)] font-black" style={{
                  color: plan.highlight ? GOLD : INK,
                }}>{plan.price}</span>
                {plan.period && (
                  <span className="t-sm" style={{ color: plan.highlight ? 'rgba(255,255,255,0.35)' : '#888' }}>{plan.period}</span>
                )}
              </div>
              <p className="t-sm leading-[1.65] mt-0 mx-0 mb-[22px]" style={{
                color: plan.highlight ? 'rgba(255,255,255,0.5)' : '#6b6055',
              }}>{plan.desc}</p>
              <ul className="list-none p-0 mt-0 mx-0 mb-7 flex flex-col gap-[9px]">
                {plan.features.map(f => (
                  <li key={f} className="t-sm flex items-center gap-[9px]" style={{
                    color: plan.highlight ? 'rgba(255,255,255,0.75)' : '#3a3530',
                  }}>
                    <span className="font-bold text-[12px]" style={{ color: GOLD }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={onLogin} className="w-full p-3 rounded-lg text-[12.5px] font-bold tracking-[0.07em] cursor-pointer transition-all duration-150" style={{
                border: plan.highlight ? 'none' : `1.5px solid ${plan.color === GOLD ? GOLD : 'rgba(0,0,0,0.15)'}`,
                background: plan.highlight ? GOLD : 'transparent',
                color: plan.highlight ? '#000' : plan.color,
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
      <section className="bg-[#f0ede6] py-[clamp(44px,7vh,80px)] px-[clamp(16px,5vw,40px)]">
        <div className="max-w-[760px] mx-auto">
          <div className="text-center mb-[clamp(28px,5vh,52px)]">
            <div className="t-label tracking-[0.16em] mb-3" style={{
              color: GOLD,
            }}>FAQ</div>
            <h2 className="text-[clamp(26px,3.5vw,42px)] font-black m-0 leading-[1.1]" style={{
              color: INK,
            }}>Common questions,<br />honest answers.</h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {FAQS.map((faq, i) => (
              <div key={i} className={`bg-white border border-[rgba(0,0,0,0.07)] rounded-[10px] overflow-hidden transition-shadow duration-150 ${openFaq === i ? 'shadow-[0_4px_20px_rgba(0,0,0,0.07)]' : 'shadow-none'}`}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left bg-none border-none cursor-pointer px-[clamp(16px,2.5vw,24px)] py-[clamp(14px,2vw,20px)] flex justify-between items-center gap-4"
                >
                  <span className="text-[14.5px] font-semibold leading-[1.4]" style={{ color: INK }}>{faq.q}</span>
                  <span className={`text-[18px] shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : 'rotate-0'}`} style={{ color: GOLD }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="pt-0 px-[clamp(16px,2.5vw,24px)] pb-[clamp(14px,2vw,20px)] text-[13.5px] text-[#6b6055] leading-[1.8]">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact Us ───────────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto py-[clamp(44px,7vh,80px)] px-[clamp(16px,5vw,40px)]">
        <div className="lp-contact-grid grid grid-cols-2 gap-[clamp(32px,5vw,72px)] items-start">
          {/* Left copy */}
          <div>
            <div className="t-label tracking-[0.16em] mb-[14px]" style={{ color: GOLD }}>CONTACT US</div>
            <h2 className="text-[clamp(26px,3.5vw,42px)] font-black mt-0 mx-0 mb-4 leading-[1.1]" style={{ color: INK }}>
              Let's get your hotel<br />set up today.
            </h2>
            <p className="t-body text-[#6b6055] leading-[1.8] mt-0 mx-0 mb-7">
              Have questions about pricing, onboarding, or a custom integration? Our team responds within one business day.
            </p>
            <div className="flex flex-col gap-[14px]">
              {[
                { icon: '📧', label: 'Email', value: 'contact@quantumvorvex.com' },
                { icon: '📱', label: 'Phone', value: '+91 98765 00000' },
                { icon: '📍', label: 'Office', value: 'MG Road, Bengaluru 560001' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-[38px] h-[38px] rounded-[9px] bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] flex items-center justify-center text-[16px] shrink-0">{item.icon}</div>
                  <div>
                    <div className="text-[10.5px] font-bold text-[#888] tracking-[0.06em] uppercase mb-px">{item.label}</div>
                    <div className="text-[13.5px] font-medium" style={{ color: INK }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right form */}
          <div className="bg-white border border-[rgba(0,0,0,0.09)] rounded-2xl p-[clamp(24px,3vw,36px)] shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
            {contactSent ? (
              <div className="text-center py-5">
                <div className="text-[48px] mb-[14px]">✅</div>
                <h3 className="t-h1 mt-0 mx-0 mb-2.5" style={{ color: INK }}>Message received!</h3>
                <p className="t-body text-[#6b6055] leading-[1.8]">We'll get back to you at <strong>{contactForm.email}</strong> within one business day.</p>
                <button onClick={() => setContactSent(false)} className="mt-5 px-6 py-2.5 rounded-[7px] border border-[rgba(0,0,0,0.15)] bg-transparent cursor-pointer text-[12.5px] font-semibold" style={{ color: INK }}>Send another message</button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit}>
                <div className="mb-4">
                  <h3 className="t-h1 mt-0 mx-0 mb-1" style={{ color: INK }}>Get in touch</h3>
                  <p className="text-[12.5px] text-[#888] m-0">We'll respond within one business day.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { key: 'name',     label: 'Your Name',        placeholder: 'Ramesh Gupta',         type: 'text'  },
                    { key: 'email',    label: 'Email Address',     placeholder: 'you@hotel.com',         type: 'email' },
                    { key: 'property', label: 'Property Name',     placeholder: 'Hotel / Resort name',   type: 'text'  },
                    { key: 'phone',    label: 'Phone (optional)',   placeholder: '+91 98765 00000',       type: 'tel'   },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-[10.5px] font-bold tracking-[0.08em] text-[#888] uppercase mb-1.5">{field.label}</label>
                      <input
                        type={field.type}
                        value={contactForm[field.key] || ''}
                        onChange={e => setContact(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        onFocus={() => setContactFocus(f => ({ ...f, [field.key]: true }))}
                        onBlur={() => setContactFocus(f => ({ ...f, [field.key]: false }))}
                        className="t-sm w-full box-border px-3 py-[9px] rounded-[7px] outline-none transition-all duration-150"
                        style={{
                          background: contactFocus[field.key] ? '#fff' : '#f9f8f5',
                          border: `1px solid ${contactFocus[field.key] ? GOLD : 'rgba(0,0,0,0.12)'}`,
                          color: INK,
                          boxShadow: contactFocus[field.key] ? '0 0 0 3px rgba(201,168,76,0.12)' : 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mb-4">
                  <label className="block text-[10.5px] font-bold tracking-[0.08em] text-[#888] uppercase mb-1.5">Message</label>
                  <textarea
                    value={contactForm.message}
                    onChange={e => setContact('message', e.target.value)}
                    placeholder="Tell us about your property and what you're looking for..."
                    rows={4}
                    className="t-sm w-full box-border px-3 py-[9px] resize-y bg-[#f9f8f5] border border-[rgba(0,0,0,0.12)] rounded-[7px] outline-none transition-all duration-150"
                    style={{
                      color: INK,
                    }}
                    onFocus={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.12)' }}
                    onBlur={e => { e.currentTarget.style.background = '#f9f8f5'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
                <button type="submit" disabled={contactLoading || !contactForm.name || !contactForm.email} className="w-full p-3 text-white border-none rounded-lg text-[12px] font-bold tracking-[0.1em] transition-[background] duration-150" style={{
                  background: contactLoading || !contactForm.name || !contactForm.email ? '#888' : INK,
                  cursor: contactLoading || !contactForm.name || !contactForm.email ? 'not-allowed' : 'pointer',
                }}>
                  {contactLoading ? 'SENDING…' : 'SEND MESSAGE →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-[clamp(48px,8vh,80px)] px-[clamp(16px,5vw,40px)] text-center" style={{
        background: INK,
      }}>
        <div className="max-w-[580px] mx-auto">
          <h2 className="text-[clamp(26px,4vw,46px)] font-black text-white leading-[1.1] mt-0 mx-0 mb-[14px]">Ready to modernise<br />your hotel?</h2>
          <p className="text-[rgba(255,255,255,0.48)] text-[15px] leading-[1.75] mb-8">
            No installation. No backend required for demo. Sign in and explore the full
            system with real-looking mock data — instantly.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={onLogin} className="t-title px-[clamp(24px,4vw,36px)] py-[13px] rounded-lg border-none text-black tracking-[0.08em] cursor-pointer transition-[background] duration-150" style={{
              background: GOLD,
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#d4b55a'}
              onMouseLeave={e => e.currentTarget.style.background = GOLD}
            >SIGN IN TO PLATFORM →</button>
            <button onClick={onLogin} className="t-title px-[clamp(24px,4vw,36px)] py-[13px] rounded-lg border border-[rgba(255,255,255,0.2)] bg-transparent text-white tracking-[0.08em] cursor-pointer transition-[border-color] duration-150"
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
            >SIGN IN</button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#060604]">
        {/* Main footer grid */}
        <div className="max-w-[1200px] mx-auto pt-[clamp(40px,6vh,64px)] px-[clamp(16px,5vw,40px)] pb-[clamp(28px,4vh,48px)]">
          <div className="lp-footer-grid grid grid-cols-[240px_repeat(4,1fr)] gap-[clamp(24px,3vw,48px)]">
            {/* Brand column */}
            <div>
              <div className="t-h2 italic mb-3" style={{
                color: GOLD,
              }}>Quantum Vorvex</div>
              <p className="text-[12.5px] text-[rgba(255,255,255,0.35)] leading-[1.8] mt-0 mx-0 mb-5">
                Hotel management software built for the Indian hospitality industry.
              </p>
              <div className="flex gap-2.5">
                {['𝕏', 'in', 'f', '▶'].map(s => (
                  <div key={s} className="w-8 h-8 rounded-[7px] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[13px] text-[rgba(255,255,255,0.35)] cursor-pointer transition-all duration-150"
                    onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
                  >{s}</div>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category}>
                <div className="t-label tracking-[0.12em] text-[rgba(255,255,255,0.4)] mb-4">{category}</div>
                <div className="flex flex-col gap-2.5">
                  {links.map(l => (
                    <span key={l} className="t-sm text-[rgba(255,255,255,0.45)] cursor-pointer transition-colors duration-150"
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
        <div className="border-t border-t-[rgba(255,255,255,0.06)] py-[clamp(14px,2vh,20px)] px-[clamp(16px,5vw,40px)] flex flex-wrap gap-3 items-center justify-between">
          <div className="text-[11.5px] text-[rgba(255,255,255,0.22)]">
            © 2026 Forge Quantum Solutions Pvt. Ltd. · GST-ready · Made for India 🇮🇳
          </div>
          <div className="flex gap-5">
            {['Privacy', 'Terms', 'Cookies'].map(l => (
              <span key={l} className="text-[11.5px] text-[rgba(255,255,255,0.22)] cursor-pointer transition-colors duration-150"
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
        /* Contact: 2 cols → 1 */
        .lp-contact-grid { grid-template-columns: 1fr 1fr !important; }
        @media (max-width: 800px) {
          .lp-contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
