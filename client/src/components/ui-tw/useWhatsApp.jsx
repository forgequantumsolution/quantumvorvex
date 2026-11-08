import { useCallback, useState } from 'react'
import i18n from '../../i18n'
import { waNumber } from '../../utils/whatsapp'
import { WhatsAppComposer, WhatsAppIcon } from './WhatsApp'

// ActionMenu entry with the WhatsApp icon; disabled (with a tooltip) when the
// guest has no usable number.
export function waMenuItem(label, phone, onClick) {
  const ok = !!waNumber(phone)
  return {
    label,
    icon: <WhatsAppIcon size={14} />,
    onClick,
    disabled: !ok,
    title: ok ? undefined : i18n.t('whatsapp:noPhone'),
  }
}

let openSeq = 0

/** Page-level hook: `open(request)` shows the composer; render `composer`. */
export function useWhatsAppComposer() {
  const [request, setRequest] = useState(null)
  const close = useCallback(() => setRequest(null), [])
  const open = useCallback((req) => setRequest({ ...req, seq: ++openSeq }), [])
  const composer = request ? <WhatsAppComposer key={request.seq} request={request} onClose={close} /> : null
  return { open, close, composer }
}
