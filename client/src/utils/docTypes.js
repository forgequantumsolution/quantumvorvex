// docTypes are inconsistent across sources (slot keys like `idFront`, booking
// labels like `ID Front`, seed values like `Photo`). Normalise to alphanumerics
// so an existing doc can be matched back to the slot it fills.
export const normDocType = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Machine-written docTypes (camera captures, check-out proof) would otherwise
// show up raw as "guest_photo". Booking-time labels like "Aadhaar — Front" are
// already readable and fall through unchanged. Keys: documents:docType.<key>.
const DOC_LABELS = {
  idfront: 'idFront',
  idback: 'idBack',
  guestphoto: 'guestPhoto',
  photo: 'guestPhoto',
  checkoutphoto: 'checkoutPhoto',
  paymentproof: 'paymentProof',
  additional: 'additional',
}

/** Readable label for a stored docType; `t` must be bound to the documents namespace. */
export const prettyDocType = (s, t) => {
  const key = DOC_LABELS[normDocType(s)]
  return key ? t(`docType.${key}`) : s || t('docType.document')
}

export const isImageUrl = (url) => /\.(jpe?g|png|webp|gif|avif)$/i.test(url || '')
