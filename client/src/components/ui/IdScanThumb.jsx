import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * One private ID scan: fetched with the login token (`fetchFile` resolves to an
 * axios response with a blob), shown as a thumbnail that opens full size in a new
 * tab. Object URLs are released on unmount. Texts come from `<ns>:docs.*`.
 */
export default function IdScanThumb({ ns, doc, label, fetchFile, onRemove }) {
  const { t } = useTranslation(ns)
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let off = false
    let made = null
    fetchFile()
      .then(({ data }) => { if (off) return; made = URL.createObjectURL(data); setUrl(made) })
      .catch(() => { if (!off) setFailed(true) })
    return () => { off = true; if (made) URL.revokeObjectURL(made) }
    // fetchFile is a fresh closure each render; the doc id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])

  const remove = async () => {
    if (!window.confirm(t('docs.removeConfirm'))) return
    setRemoving(true)
    try { await onRemove() } catch { setRemoving(false) }
  }

  const isPdf = doc.mimeType === 'application/pdf'
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink3 mb-1">{label}</div>
      <a href={url || undefined} target="_blank" rel="noreferrer"
        className="block h-28 rounded-lg border border-line bg-surface2 overflow-hidden flex items-center justify-center text-xs text-ink3 hover:border-gold">
        {failed ? t('docs.loadFailed')
          : !url ? t('common:loading')
          : isPdf ? <span className="text-center"><span className="block text-xl">📄</span>{t('docs.openPdf')}</span>
          : <img src={url} alt={label} className="w-full h-full object-cover" />}
      </a>
      {onRemove && (
        <button type="button" onClick={remove} disabled={removing}
          className="mt-1 bg-transparent border-0 p-0 text-xs text-ink3 hover:text-danger cursor-pointer disabled:opacity-50">
          {t('common:remove')}
        </button>
      )}
    </div>
  )
}
