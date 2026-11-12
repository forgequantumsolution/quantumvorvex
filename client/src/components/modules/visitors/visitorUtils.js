import { appLocale } from '../../../i18n'

export const PURPOSES = ['guest_visit', 'meeting', 'delivery', 'vendor', 'maintenance', 'interview', 'other']
export const ID_TYPES = ['aadhaar', 'pan', 'driving_licence', 'passport', 'voter_id', 'other']

// Status → pill colours (same tokens as the rest of the app).
export const STATUS_TONE = {
  expected:    'bg-info-bg text-info-text',
  pending:     'bg-warning-bg text-warning-text',
  checked_in:  'bg-success-bg text-success-text',
  checked_out: 'bg-surface2 text-ink2',
  rejected:    'bg-danger-bg text-danger-text',
}

export const PHONE_RE = /^\+?\d{7,15}$/
export const cleanPhone = (v) => String(v || '').replace(/[\s-]/g, '')
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const formatTime = (d) =>
  d ? new Date(d).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }) : '—'

const sameDay = (a, b) => a.toDateString() === b.toDateString()
// "10:42" today, "12 Nov, 10:42" on other days.
export const formatWhen = (d) => {
  if (!d) return '—'
  const date = new Date(d)
  if (sameDay(date, new Date())) return formatTime(date)
  return date.toLocaleString(appLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// 1h 25m · 40m · <1m
export const formatDuration = (from, to = new Date()) => {
  if (!from) return ''
  const mins = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000))
  if (mins < 1) return '<1m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

// The public form / pass address for a token. Visitors open it on their phones,
// so it is the app's own origin.
export const visitUrl = (token) => `${window.location.origin}/visit?t=${token}`

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Print a small page in an isolated window (badge, poster).
function printHtml(title, body, { width = 420, height = 600 } = {}) {
  const win = window.open('', '_blank', `width=${width},height=${height}`)
  if (!win) return false
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      *{box-sizing:border-box} body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111}
      @page{margin:10mm}
    </style></head><body>${body}</body></html>`)
  win.document.close()
  win.focus()
  // Let the SVG / logo lay out before the print dialog opens.
  setTimeout(() => win.print(), 250)
  return true
}

/** Visitor badge, sized to print on a label or A6 card. `t` is the visitors namespace. */
export function printBadge(v, { t, hotelName }) {
  const purpose = t(`purposes.${v.purpose}`, { defaultValue: v.purpose })
  const body = `
    <div style="width:86mm;margin:8mm auto;border:2px solid #111;border-radius:10px;overflow:hidden">
      <div style="background:#111;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:13px;letter-spacing:.02em">${esc(hotelName)}</strong>
        <span style="font-size:12px;font-weight:800;letter-spacing:.2em">${esc(t('badge.visitor'))}</span>
      </div>
      <div style="padding:14px">
        <div style="font-size:24px;font-weight:800;line-height:1.15">${esc(v.name)}</div>
        ${v.company ? `<div style="font-size:13px;color:#555;margin-top:2px">${esc(v.company)}</div>` : ''}
        <div style="margin-top:12px;font-size:13px;line-height:1.6">
          <div><b>${esc(t('detail.purpose'))}:</b> ${esc(purpose)}</div>
          ${v.hostName ? `<div><b>${esc(t('badge.host'))}:</b> ${esc(v.hostName)}${v.roomNumber ? ` · ${esc(t('detail.room'))} ${esc(v.roomNumber)}` : ''}</div>` : ''}
          ${v.companions ? `<div><b>${esc(t('detail.companions'))}:</b> ${v.companions}</div>` : ''}
          <div><b>${esc(t('table.in'))}:</b> ${esc(formatWhen(v.checkInAt || v.createdAt))}</div>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px dashed #999;padding-top:10px">
          <div style="font-size:11px;color:#555">${esc(t('badge.valid', { date: new Date().toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' }) }))}</div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:16px;font-weight:800">${esc(v.passNo)}</div>
        </div>
      </div>
      <div style="background:#f3f3f3;padding:6px 14px;font-size:10.5px;color:#555;text-align:center">${esc(t('badge.returnBadge'))}</div>
    </div>`
  return printHtml(`${v.passNo} — ${v.name}`, body)
}

/** A4 poster for the gate / reception with the property's visitor QR. */
export function printPoster({ t, hotelName, qrSvg }) {
  const body = `
    <div style="max-width:170mm;margin:12mm auto;text-align:center;border:3px solid #111;border-radius:18px;padding:16mm 12mm">
      <div style="font-size:15px;font-weight:700;color:#555;letter-spacing:.04em;text-transform:uppercase">${esc(hotelName)}</div>
      <h1 style="font-size:38px;margin:6px 0 4px">${esc(t('qr.posterTitle'))}</h1>
      <p style="font-size:20px;margin:0 0 10mm;color:#333">${esc(t('qr.posterScan'))}</p>
      <div style="display:inline-block;padding:6mm;border:1px solid #ddd;border-radius:12px">${qrSvg.replace(/width="\d+"/, 'width="300"').replace(/height="\d+"/, 'height="300"')}</div>
      <p style="font-size:15px;margin:10mm 0 2mm;color:#333">${esc(t('qr.posterSteps'))}</p>
      <p style="font-size:13px;margin:0;color:#777">${esc(t('qr.posterNoApp'))}</p>
    </div>`
  return printHtml(t('qr.posterTitle'), body, { width: 800, height: 1000 })
}
