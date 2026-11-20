import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuUpload } from 'react-icons/lu'
import { Modal, Field, Button } from '../../ui-tw'
import DocumentGallery from '../../ui/DocumentGallery'
import UploadZone from './UploadZone'
import { bookingsApi, documentsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'
import { useCan } from '../../../hooks/useCan'

/**
 * Everything uploaded for one booking — ID scans, guardian Aadhaar, guest
 * photo, payment proof, check-out photo — viewable after the booking is saved,
 * with a slot to attach more.
 */
export default function BookingDocumentsModal({ booking, onClose, onChanged }) {
  const { t } = useTranslation('bookings')
  const toast = useToast()
  const canManage = useCan('bookings', 'MANAGE')
  const canDelete = useCan('documents', 'MANAGE')
  const [docs, setDocs] = useState(null)
  const [file, setFile] = useState(null)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    bookingsApi.getOne(booking.id)
      .then(({ data }) => setDocs([...(data.booking?.documents || [])].sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt))))
      .catch(() => setDocs([]))
  }, [booking.id])
  useEffect(() => { load() }, [load])

  const upload = async () => {
    if (!file) return
    setSaving(true)
    try {
      const form = new FormData()
      form.append('documents', file)
      form.append('docTypes', JSON.stringify([label.trim() || file.name]))
      await bookingsApi.uploadDocuments(booking.id, form)
      setFile(null); setLabel('')
      load(); onChanged?.()
      toast(t('docs.uploaded'))
    } catch (err) {
      toast(err.response?.data?.message || t('form.toast.docsFailed'), 'danger')
    } finally { setSaving(false) }
  }

  const remove = async (d) => {
    try {
      await documentsApi.delete(d.id)
      setDocs((cur) => cur.filter((x) => x.id !== d.id)); onChanged?.()
    } catch (err) { toast(err.response?.data?.message || t('docs.removeFailed'), 'danger') }
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" title={t('docs.title')}
      subtitle={`${booking.guestName || ''}${booking.bookingNo ? ` · ${booking.bookingNo}` : ''}`}
      footer={<Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>}>
      <div className="space-y-5">
        {!docs ? <p className="m-0 text-sm text-ink3 py-6 text-center">{t('common:loading')}</p>
          : <DocumentGallery docs={docs} onRemove={canDelete ? remove : undefined}
              empty={<p className="m-0 text-sm text-ink3 rounded-lg border border-dashed border-line2 px-3 py-6 text-center">{t('docs.none')}</p>} />}

        {canManage && (
          <section className="pt-4 border-t border-line space-y-3">
            <h4 className="m-0 text-[13px] font-semibold text-ink">{t('docs.addMore')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <UploadZone label={t('docs.file')} file={file} onPick={setFile} />
              <div className="space-y-3">
                <Field label={t('docs.name')} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60}
                  placeholder={t('docs.namePlaceholder')} />
                <Button icon={<LuUpload />} onClick={upload} disabled={!file || saving}>{saving ? t('common:saving', { defaultValue: '…' }) : t('docs.upload')}</Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}
