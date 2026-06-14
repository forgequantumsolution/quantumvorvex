import { useRef, useState } from 'react'

// Props: label, accept, onFile, preview (url), maxSizeMB (default 5)
export default function FileUpload({
  label = 'Upload File',
  accept = 'image/*,.pdf',
  onFile,
  preview,
  maxSizeMB = 5,
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [localPreview, setLocalPreview] = useState(preview ?? null)
  const [fileName, setFileName] = useState(null)
  const [error, setError] = useState(null)

  const isImage = (file) => file.type.startsWith('image/')

  const processFile = (file) => {
    setError(null)

    // Validate type
    const acceptedTypes = accept
      .split(',')
      .map((t) => t.trim())
    const matchesType = acceptedTypes.some((t) => {
      if (t === '*') return true
      if (t.endsWith('/*')) return file.type.startsWith(t.replace('/*', '/'))
      if (t.startsWith('.'))
        return file.name.toLowerCase().endsWith(t.toLowerCase())
      return file.type === t
    })

    if (!matchesType) {
      setError(`Invalid file type. Accepted: ${accept}`)
      return
    }

    // Validate size
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`)
      return
    }

    setFileName(file.name)

    if (isImage(file)) {
      const reader = new FileReader()
      reader.onload = (e) => setLocalPreview(e.target.result)
      reader.readAsDataURL(file)
    } else {
      setLocalPreview(null)
    }

    onFile?.(file)
  }

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleClick = () => inputRef.current?.click()

  const handleClear = (e) => {
    e.stopPropagation()
    setLocalPreview(null)
    setFileName(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
    onFile?.(null)
  }

  return (
    <div>
      <div
        className={`upload-zone${dragOver ? ' dragover' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label={label}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />

        {localPreview ? (
          /* Image preview */
          <div className="flex flex-col items-center gap-2.5">
            <img
              src={localPreview}
              alt="Preview"
              className="max-h-[100px] max-w-full rounded-md object-cover border border-line"
            />
            {fileName && (
              <span className="text-[12px] text-ink2">{fileName}</span>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-danger btn-xs"
            >
              Remove
            </button>
          </div>
        ) : fileName ? (
          /* Doc icon for non-image files */
          <div className="flex flex-col items-center gap-2">
            <span className="text-[32px]">📄</span>
            <span className="text-[12px] text-ink2 break-all">
              {fileName}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-danger btn-xs"
            >
              Remove
            </button>
          </div>
        ) : (
          /* Default upload prompt */
          <div className="flex flex-col items-center gap-2">
            <span className="text-[28px] opacity-50">📁</span>
            <span className="text-[13px] font-medium text-ink2">
              {label}
            </span>
            <span className="text-[11.5px] text-ink3">
              {accept
                .split(',')
                .map((t) => t.trim().replace('.', '').toUpperCase())
                .join(' / ')}{' '}
              · max {maxSizeMB}MB
            </span>
          </div>
        )}
      </div>

      {error && (
        <span className="block mt-[5px] text-[11.5px] text-danger-text font-medium">
          {error}
        </span>
      )}
    </div>
  )
}
