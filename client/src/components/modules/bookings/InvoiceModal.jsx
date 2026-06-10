import { useEffect, useRef, useState } from 'react'
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
 * download or print it. The HTML is fetched from the backend through the
 * authenticated API client (not a raw URL), then shown via a blob object URL.
 */
export default function InvoiceModal({ isOpen, booking, onClose }) {
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !booking) return
    let objectUrl
    let active = true
    setLoading(true); setError(''); setUrl('')

    bookingsApi.getInvoice(booking.id)   // HTML blob, with auth
      .then(({ data }) => {
        if (!active) return
        objectUrl = URL.createObjectURL(data)
        setUrl(objectUrl)
      })
      .catch(async (err) => {
        const msg = await errorMessage(err, 'Could not generate invoice')
        if (active) setError(msg)
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [isOpen, booking])

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
      toast(await errorMessage(err, 'Could not download invoice PDF'), 'error')
    } finally {
      setDownloading(false)
    }
  }

  // Print the already-loaded preview directly (same-origin blob, so allowed).
  const print = () => frameRef.current?.contentWindow?.print()

  if (!booking) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tax Invoice"
      subtitle={`${booking.guestName} · ${booking.bookingNo}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="ghost" onClick={print} disabled={!url}>🖨 Print</Button>
          <Button onClick={download} disabled={!url || downloading}>
            {downloading ? 'Preparing PDF…' : '⬇ Download PDF'}
          </Button>
        </>
      }
    >
      {loading && <div className="py-20 text-center text-ink3 text-sm">Generating invoice…</div>}
      {error && <div className="py-20 text-center text-danger-text text-sm">{error}</div>}
      {url && !error && (
        <iframe
          ref={frameRef}
          title="Invoice preview"
          src={url}
          className="w-full h-[70vh] rounded-lg border border-line bg-white"
        />
      )}
    </Modal>
  )
}
