import { useEffect, useMemo } from 'react'

/**
 * A tile for a single image/PDF file, fillable either way: pick a file, or scan
 * it with the camera. onScan is omitted for slots where scanning makes no sense.
 *
 * Once filled, the tile previews the actual scan so the operator can see the ID
 * is legible before submitting — a filename alone hides a blurry capture.
 */
export default function UploadZone({ label, file, onPick, onScan }) {
  const isImage = !!file?.type?.startsWith('image/')
  // Built during render (not in an effect) so the preview paints with the file;
  // the effect below only revokes it once it is no longer in use.
  const previewUrl = useMemo(
    () => (isImage ? URL.createObjectURL(file) : null),
    [file, isImage],
  )
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // Upload is a <label> wrapping a hidden input; scan is a real button. Keeping
  // them siblings stops a scan click from also opening the file picker.
  const actions = (
    <div className="grid grid-cols-2 divide-x divide-line2 border-t border-line2">
      <label className="flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium text-ink2 cursor-pointer hover:bg-gold-bg hover:text-gold transition-colors">
        <span className="text-[13px] leading-none">⬆</span>
        {file ? 'Replace' : 'Upload'}
        <input
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />
      </label>
      <button
        type="button"
        onClick={onScan}
        disabled={!onScan}
        className="flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium text-ink2 hover:bg-gold-bg hover:text-gold transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span className="text-[13px] leading-none">📷</span>
        {file ? 'Rescan' : 'Scan'}
      </button>
    </div>
  )

  return (
    <div>
      {label && <span className="block text-xs font-medium text-ink2 mb-1.5">{label}</span>}
      <div
        className={`rounded-lg border overflow-hidden transition-colors ${
          file ? 'border-gold' : 'border-dashed border-line2 hover:border-gold'
        }`}
      >
        <div className="relative h-24 bg-surface2 flex items-center justify-center">
          {file ? (
            <>
              {previewUrl ? (
                <img src={previewUrl} alt={label || 'Attached document'} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-3">
                  <div className="text-xl leading-none mb-1">📄</div>
                  <div className="text-[10.5px] text-ink3 break-all line-clamp-2">{file.name}</div>
                </div>
              )}
              <button
                type="button"
                onClick={() => onPick(null)}
                title="Remove"
                aria-label="Remove file"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 text-white text-xs leading-none flex items-center justify-center hover:bg-danger-text transition-colors"
              >
                ✕
              </button>
              {previewUrl && (
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-2 py-0.5 truncate">
                  {file.name}
                </span>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="text-lg text-ink3 leading-none mb-0.5">🪪</div>
              <div className="text-[10.5px] text-ink3">JPG, PNG or PDF</div>
            </div>
          )}
        </div>
        {actions}
      </div>
    </div>
  )
}
