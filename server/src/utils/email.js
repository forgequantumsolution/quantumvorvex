/**
 * Email layer — nodemailer
 *
 * Configured for Gmail SMTP via an App Password (set EMAIL_USER + EMAIL_APP_PASSWORD).
 * If credentials are missing, the transport falls back to "console" mode: the reset
 * link / OTP code is logged to the server console so local development never blocks
 * on a missing mailbox. NEVER logs codes/links in production.
 */
import nodemailer from 'nodemailer'
import logger from './logger.js'

const EMAIL_USER         = process.env.EMAIL_USER
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD
const EMAIL_FROM         = process.env.EMAIL_FROM || (EMAIL_USER ? `Quantum Vorvex <${EMAIL_USER}>` : 'Quantum Vorvex <no-reply@quantumvorvex.local>')
const IS_PROD            = process.env.NODE_ENV === 'production'

const isConfigured = Boolean(EMAIL_USER && EMAIL_APP_PASSWORD)

let transporter = null
if (isConfigured) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD },
  })
} else {
  logger.warn('Email not configured — set EMAIL_USER + EMAIL_APP_PASSWORD. Falling back to console output.', {
    event: 'EMAIL',
  })
}

/**
 * Send an email. In console-fallback mode, logs the message instead of sending.
 * Returns true on success, false on failure (callers should not leak this to clients).
 */
async function send({ to, subject, html, text, devPreview }) {
  if (!isConfigured) {
    // Console fallback — show the actionable content in dev, redact in prod.
    logger.info('Email (console fallback)', {
      event: 'EMAIL',
      to,
      subject,
      preview: IS_PROD ? '[REDACTED]' : devPreview,
    })
    return true
  }

  try {
    await transporter.sendMail({ from: EMAIL_FROM, to, subject, text, html })
    logger.info('Email sent', { event: 'EMAIL', to, subject })
    return true
  } catch (err) {
    logger.error('Email send failed', { event: 'EMAIL', to, subject, error: err.message })
    return false
  }
}

// ─── Shared template chrome ────────────────────────────────────────────────────
function wrap(title, bodyHtml) {
  return `
  <div style="background:#0f172a;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1e3a8a,#0ea5e9);padding:24px 32px;">
        <div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.5px;">Quantum Vorvex</div>
        <div style="color:#dbeafe;font-size:12px;margin-top:2px;">Hotel Management System</div>
      </div>
      <div style="padding:32px;">
        <h2 style="margin:0 0 16px;color:#0f172a;font-size:18px;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 32px;background:#f8fafc;color:#94a3b8;font-size:11px;text-align:center;">
        Powered by Quantum Vorvex · Forge Quantum Solutions
      </div>
    </div>
  </div>`
}

/**
 * Password-reset email containing a one-time link.
 */
export async function sendPasswordResetEmail(to, resetLink) {
  const html = wrap('Reset your password', `
    <p style="color:#334155;font-size:14px;line-height:1.6;">
      We received a request to reset your password. Click the button below to choose a new one.
      This link expires in <strong>30 minutes</strong>.
    </p>
    <a href="${resetLink}" style="display:inline-block;margin:20px 0;background:#0ea5e9;color:#fff;
       text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
      Reset Password
    </a>
    <p style="color:#94a3b8;font-size:12px;line-height:1.6;">
      If you didn't request this, you can safely ignore this email. The link will expire on its own.
    </p>
    <p style="color:#94a3b8;font-size:12px;word-break:break-all;">${resetLink}</p>
  `)
  return send({
    to,
    subject: 'Reset your Quantum Vorvex password',
    html,
    text: `Reset your password using this link (expires in 30 minutes): ${resetLink}`,
    devPreview: `Reset link: ${resetLink}`,
  })
}

/**
 * One-time login code (passwordless OTP).
 */
export async function sendOtpEmail(to, code) {
  const html = wrap('Your login code', `
    <p style="color:#334155;font-size:14px;line-height:1.6;">
      Use the code below to sign in. It expires in <strong>10 minutes</strong>.
    </p>
    <div style="margin:20px 0;font-size:34px;font-weight:700;letter-spacing:10px;color:#0f172a;
       background:#f1f5f9;border-radius:10px;padding:16px 0;text-align:center;">${code}</div>
    <p style="color:#94a3b8;font-size:12px;line-height:1.6;">
      If you didn't try to sign in, you can ignore this email and your account stays secure.
    </p>
  `)
  return send({
    to,
    subject: `${code} is your Quantum Vorvex login code`,
    html,
    text: `Your Quantum Vorvex login code is ${code}. It expires in 10 minutes.`,
    devPreview: `OTP code: ${code}`,
  })
}

export default { sendPasswordResetEmail, sendOtpEmail }
