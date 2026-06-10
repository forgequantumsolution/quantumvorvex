// Canvas helpers for cropping an uploaded image (used by the Settings logo cropper).

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = url
  })
}

/**
 * Crop `imageSrc` to the given pixel rectangle and return a normalized square Blob.
 * @param {string} imageSrc      data URL / object URL of the source image
 * @param {{x:number,y:number,width:number,height:number}} pixelCrop  from react-easy-crop's onCropComplete
 * @param {{size?:number, mime?:string}} [opts]  output edge length (px) and mime type
 * @returns {Promise<Blob>}
 */
export async function getCroppedBlob(imageSrc, pixelCrop, { size = 512, mime = 'image/png' } = {}) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, size, size,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas is empty'))),
      mime,
      0.92,
    )
  })
}

/** Read a Blob into a base64 data URL (used for localStorage-stored logos). */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
