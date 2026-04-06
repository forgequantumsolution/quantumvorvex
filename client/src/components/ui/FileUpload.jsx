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
          style={{ display: 'none' }}
          onChange={handleChange}
        />

        {localPreview ? (
          /* Image preview */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <img
              src={localPreview}
              alt="Preview"
              style={{
                maxHeight: '100px',
                maxWidth: '100%',
                borderRadius: '6px',
                objectFit: 'cover',
                border: '1px solid var(--border)',
              }}
            />
            {fileName && (
              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{fileName}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '32px' }}>📄</span>
            <span style={{ fontSize: '12px', color: 'var(--text2)', wordBreak: 'break-all' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '28px', opacity: 0.5 }}>📁</span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text2)',
              }}
            >
              {label}
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text3)' }}>
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
        <span
          style={{
            display: 'block',
            marginTop: '5px',
            fontSize: '11.5px',
            color: 'var(--red-text)',
            fontWeight: 500,
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}
