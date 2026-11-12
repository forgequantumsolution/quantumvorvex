import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { LuPrinter, LuDownload, LuCopy, LuExternalLink, LuRefreshCw } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import { Button } from '../../ui-tw'
import { visitorsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'
import { visitUrl, printPoster } from './visitorUtils'

const SVG_ID = 'visitor-qr-svg'

/**
 * The property's one visitor QR: print it as a gate poster, download it, copy
 * or open the link. Owners / admins can turn on auto-approve and replace the
 * QR (which retires every printed copy).
 */
export default function VisitorQrModal({ hotelName, onClose }) {
  const { t } = useTranslation('visitors')
  const toast = useToast()
  const [qr, setQr] = useState(null) // { token, autoApprove, canAdmin }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)

  useEffect(() => {
    visitorsApi.qr().then(({ data }) => setQr(data)).catch(() => setError(t('toast.failed')))
  }, [t])

  const url = qr ? visitUrl(qr.token) : ''
  const svg = () => document.getElementById(SVG_ID)?.outerHTML || ''

  const download = () => {
    const el = document.getElementById(SVG_ID)
    if (!el) return
    const SIZE = 600, PAD = 48, TITLE = 90
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = SIZE + PAD * 2
      c.height = SIZE + PAD * 2 + TITLE
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.fillStyle = '#111'
      ctx.textAlign = 'center'
      ctx.font = 'bold 34px system-ui, sans-serif'
      ctx.fillText(t('qr.posterTitle'), c.width / 2, PAD + 30)
      ctx.font = '22px system-ui, sans-serif'
      ctx.fillText(hotelName || '', c.width / 2, PAD + 66)
      ctx.drawImage(img, PAD, PAD + TITLE, SIZE, SIZE)
      const a = document.createElement('a')
      a.download = 'visitor-qr.png'
      a.href = c.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(el))
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast(t('qr.copied')) } catch { toast(url, 'info') }
  }

  const save = async (call, msg) => {
    setBusy(true)
    try { const { data } = await call(); setQr(data); toast(msg) }
    catch (e) { toast(e.response?.data?.message || t('toast.failed'), 'error') }
    finally { setBusy(false) }
  }

  return (
    <>
      <Modal isOpen onClose={onClose} title={t('qr.title')} maxWidth="520px"
        footer={<Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>}>
        {error && <div className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{error}</div>}
        {!qr && !error && <div className="h-[280px] rounded-xl bg-line animate-pulse" />}
        {qr && (
          <div className="space-y-5">
            <p className="m-0 text-sm text-ink3 text-center">{t('qr.help')}</p>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-xl border border-line">
                <QRCodeSVG id={SVG_ID} value={url} size={220} level="M" includeMargin={false} />
              </div>
            </div>
            <p className="m-0 text-xs text-ink3 text-center break-all">{url}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={<LuPrinter />} onClick={() => printPoster({ t, hotelName, qrSvg: svg() })}>{t('qr.print')}</Button>
              <Button variant="ghost" icon={<LuDownload />} onClick={download}>{t('qr.download')}</Button>
              <Button variant="ghost" icon={<LuCopy />} onClick={copy}>{t('qr.copy')}</Button>
              <Button variant="ghost" icon={<LuExternalLink />} onClick={() => window.open(url, '_blank', 'noopener')}>{t('qr.open')}</Button>
            </div>

            <div className="pt-4 border-t border-line space-y-3">
              <label className={`flex items-start gap-3 ${qr.canAdmin ? 'cursor-pointer' : 'opacity-70'}`}>
                <input type="checkbox" className="mt-1 w-4 h-4 accent-[var(--gold)]" checked={qr.autoApprove}
                  disabled={!qr.canAdmin || busy}
                  onChange={(e) => save(() => visitorsApi.settings({ autoApprove: e.target.checked }), t('toast.settingsSaved'))} />
                <span>
                  <span className="block text-sm font-medium text-ink">{t('qr.autoApprove')}</span>
                  <span className="block text-xs text-ink3 mt-0.5">{t('qr.autoApproveHint')}</span>
                </span>
              </label>
              {qr.canAdmin
                ? <Button size="sm" variant="danger" icon={<LuRefreshCw />} disabled={busy} onClick={() => setConfirmRegen(true)}>{t('qr.regenerate')}</Button>
                : <p className="m-0 text-xs text-ink3">{t('qr.adminOnly')}</p>}
            </div>
          </div>
        )}
      </Modal>
      <ConfirmModal
        isOpen={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title={t('qr.regenerateTitle')}
        message={t('qr.regenerateMessage')}
        confirmLabel={t('qr.regenerate')}
        danger
        busy={busy}
        onConfirm={async () => { await save(visitorsApi.regenerateQr, t('toast.qrRegenerated')); setConfirmRegen(false) }}
      />
    </>
  )
}
