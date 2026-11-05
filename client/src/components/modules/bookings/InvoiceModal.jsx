import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button } from '../../ui-tw'
import { bookingsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'

// Pull a human message out of an axios error whose body is a blob (our API
// returns blobs for the invoice, so errors arrive as blobs too).
async function errorMessage(err, fallback) {
  const d = err.response?.data
  if (d instanceof Blob) { try { return JSON.parse(await d.text()).message || fallback } catch { return fallback } }
  return d?.message || fallback
}

/**
 * Previews a booking's GST tax invoice in-app (iframe) and lets the user
 * download, print, or change its serial number. The HTML is fetched from the
 * backend through the authenticated API client (not a raw URL), then shown via
 * a blob object URL.
 */
export default function InvoiceModal({ isOpen, booking, onClose }) {
  const { t } = useTranslation('bookings')
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [serial, setSerial] = useState('')        // editable invoice number
  const [savedSerial, setSavedSerial] = useState('') // last persisted value
  const [savingSerial, setSavingSerial] = useState(false)
  const frameRef = useRef(null)
  const objectUrlRef = useRef('')

  // Swap the preview to a new HTML blob, revoking the previous object URL.
  const showPreview = (blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const next = URL.createObjectURL(blob)
    objectUrlRef.current = next
    setUrl(next)
  }

  useEffect(() => {
    if (!isOpen || !booking) return
    let active = true
    setLoading(true); setError(''); setUrl(''); setSerial(''); setSavedSerial('')

    ;(async () => {
      try {
        // Fetch metadata first: this assigns the serial (if unset) and returns
        // it, so the preview that follows reuses the same number.
        const { data: metaBlob } = await bookingsApi.getInvoice(booking.id, { format: 'json' })
        const meta = JSON.parse(await metaBlob.text())
        if (!active) return
        const no = meta?.invoice?.invoiceNo || ''
        setSerial(no); setSavedSerial(no)

        const { data: htmlBlob } = await bookingsApi.getInvoice(booking.id)
        if (!active) return
        showPreview(htmlBlob)
      } catch (err) {
        const msg = await errorMessage(err, t('invoice.generateError'))
        if (active) setError(msg)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
    // t only feeds the fallback error text — a language switch shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, booking])

  // Revoke the live object URL when the modal unmounts.
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }, [])

  // Persist a changed serial, then reload the preview so the new number shows.
  const saveSerial = async () => {
    const next = serial.trim()
    if (!next || next === savedSerial) return
    setSavingSerial(true)
    try {
      const { data } = await bookingsApi.updateInvoiceNo(booking.id, next)
      setSavedSerial(data.invoiceNo); setSerial(data.invoiceNo)
      const { data: htmlBlob } = await bookingsApi.getInvoice(booking.id)
      showPreview(htmlBlob)
      toast(t('invoice.numberUpdated'), 'success')
    } catch (err) {
      toast(await errorMessage(err, t('invoice.numberError')), 'error')
    } finally {
      setSavingSerial(false)
    }
  }

  // Download the server-rendered PDF (not the preview HTML).
  const download = async () => {
    setDownloading(true)
    try {
      const { data } = await bookingsApi.getInvoice(booking.id, { format: 'pdf' })
      const pdfUrl = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = pdfUrl
      a.download = `invoice-${booking.bookingNo}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000)
    } catch (err) {
      toast(await errorMessage(err, t('invoice.downloadError')), 'error')
    } finally {
      setDownloading(false)
    }
  }

  // Print the already-loaded preview directly (same-origin blob, so allowed).
  const print = () => frameRef.current?.contentWindow?.print()

  if (!booking) return null

  const serialDirty = serial.trim() !== '' && serial.trim() !== savedSerial

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('invoice.title')}
      subtitle={`${booking.guestName} · ${booking.bookingNo}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>
          <Button variant="ghost" onClick={print} disabled={!url}>🖨 {t('common:print')}</Button>
          {/* Three buttons share a phone's row, so the label shortens there. */}
          <Button onClick={download} disabled={!url || downloading}>
            {downloading
              ? <><span className="sm:hidden">{t('invoice.preparing')}</span><span className="hidden sm:inline">{t('invoice.preparingPdf')}</span></>
              : <>⬇ <span className="sm:hidden">PDF</span><span className="hidden sm:inline">{t('invoice.downloadPdf')}</span></>}
          </Button>
        </>
      }
    >
      {url && !error && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label htmlFor="invoice-serial" className="w-full sm:w-auto text-xs font-semibold text-ink2 shrink-0">{t('invoice.number')}</label>
          <input
            id="invoice-serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveSerial()}
            placeholder={t('invoice.numberPlaceholder')}
            className="flex-1 min-w-0 sm:flex-none sm:w-[220px] px-2.5 py-1.5 min-h-11 sm:min-h-0 text-base sm:text-[13px] bg-surface2 border border-line rounded-md text-ink
                       focus:ring-gold/20 focus:border-gold"
          />
          <Button variant="ghost" className="shrink-0" onClick={saveSerial} disabled={savingSerial || !serialDirty}>
            {savingSerial ? t('common:saving') : t('invoice.update')}
          </Button>
        </div>
      )}
      {loading && <div className="py-20 text-center text-ink3 text-sm">{t('invoice.generating')}</div>}
      {error && <div className="py-20 text-center text-danger-text text-sm">{error}</div>}
      {url && !error && (
        <iframe
          ref={frameRef}
          title={t('invoice.preview')}
          src={url}
          className="w-full h-[60dvh] sm:h-[70vh] rounded-lg border border-line bg-white"
        />
      )}
    </Modal>
  )
}
