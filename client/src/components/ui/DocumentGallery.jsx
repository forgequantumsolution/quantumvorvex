import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuFileText, LuExternalLink, LuTrash2 } from 'react-icons/lu'
import { prettyDocType, isImageUrl } from '../../utils/docTypes'
import { appLocale } from '../../i18n'

/**
 * Thumbnails of uploaded documents (ID scans, guardian Aadhaar, guest photo,
 * payment proof…) stored under the public /uploads folder. Images preview
 * inline and open full size on tap; PDFs open in a new tab. Pass `onRemove`
 * (async, receives the doc) to show a remove link under each one.
 */
export default function DocumentGallery({ docs = [], onRemove, empty }) {
  const { t } = useTranslation('documents')
  const [removing, setRemoving] = useState(null)
  const [preview, setPreview] = useState(null)

  if (!docs.length) return empty ?? <p className="m-0 text-sm text-ink3">{t('gallery.none')}</p>

  const remove = async (d) => {
    if (!window.confirm(t('gallery.removeConfirm'))) return
    setRemoving(d.id)
    try { await onRemove(d) } finally { setRemoving(null) }
  }

  return (
    <>
      <ul className="m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-3 gap-3">
        {docs.map((d) => {
          const label = prettyDocType(d.docType, t)
          const img = isImageUrl(d.url)
          return (
            <li key={d.id} className="min-w-0">
              <button type="button" onClick={() => (img ? setPreview(d) : window.open(d.url, '_blank', 'noopener'))}
                className="group relative block w-full h-28 rounded-lg border border-line bg-surface2 overflow-hidden cursor-pointer hover:border-gold p-0"
                aria-label={t('gallery.open', { name: label })}>
                {img
                  ? <img src={d.url} alt={label} loading="lazy" className="w-full h-full object-cover" />
                  : <span className="flex h-full flex-col items-center justify-center gap-1 text-xs text-ink3"><LuFileText size={22} aria-hidden />PDF</span>}
              </button>
              <div className="mt-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-ink truncate" title={label}>{label}</div>
                  {d.uploadedAt && (
                    <div className="text-[11px] text-ink3">{new Date(d.uploadedAt).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  )}
                </div>
                {onRemove && (
                  <button type="button" onClick={() => remove(d)} disabled={removing === d.id} aria-label={t('gallery.remove', { name: label })}
                    className="shrink-0 bg-transparent border-0 p-0.5 text-ink3 hover:text-danger cursor-pointer disabled:opacity-50">
                    <LuTrash2 size={13} aria-hidden />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Full-size image preview; tap anywhere to close. */}
      {preview && (
        <div role="dialog" aria-modal="true" aria-label={prettyDocType(preview.docType, t)} onClick={() => setPreview(null)}
          className="fixed inset-0 z-[1000] bg-black/80 flex flex-col items-center justify-center p-4 cursor-zoom-out">
          <img src={preview.url} alt={prettyDocType(preview.docType, t)} className="max-w-full max-h-[85vh] rounded-lg object-contain" />
          <div className="mt-3 flex items-center gap-3 text-sm text-white">
            <span>{prettyDocType(preview.docType, t)}</span>
            <a href={preview.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-white underline">
              <LuExternalLink size={14} aria-hidden /> {t('gallery.newTab')}
            </a>
          </div>
        </div>
      )}
    </>
  )
}
