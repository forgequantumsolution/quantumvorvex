/**
 * WhatsApp messages to gym members, opened in the shared composer
 * (useWhatsAppComposer): staff see the text, can edit it or switch language,
 * and press Send in WhatsApp. Templates live in whatsapp:msg.gym.*.
 *
 *   welcome   new member / new plan
 *   receipt   a payment (needs `payment`)
 *   renewal   plan ending or ended (picks expiring / expired)
 *   due       dues pending
 *   chat      blank message
 */
export const GYM_WA_TEMPLATES = ['receipt', 'renewal', 'due', 'welcome', 'chat']

/** Which templates make sense for this member right now. */
export function gymWaOptions(member) {
  const has = !!member.current
  return GYM_WA_TEMPLATES.filter((k) => ({
    receipt: false,                                   // offered per payment, not per member
    renewal: has && ['expiring', 'expired', 'active'].includes(member.status),
    due: member.due > 0,
    welcome: has,
    chat: true,
  })[k])
}

/** A composer request for `member`. `membership` / `payment` default to the current plan. */
export function gymWaRequest(t, member, kind, { membership, payment } = {}) {
  const ms = membership || member.current || {}
  const template = kind === 'chat' ? 'chat'
    : kind === 'renewal' ? (member.status === 'expired' ? 'gym.expired' : 'gym.expiring')
    : `gym.${kind}`
  return {
    phone: member.phone,
    guestId: member.guestId || undefined,
    name: member.name,
    title: t(`wa.${kind}`),
    template,
    vars: {
      name: member.name,
      memberNo: member.memberNo,
      plan: ms.planName,
      startDate: ms.startDate,
      endDate: ms.endDate,
      // "Paid · balance due" line under welcome / receipt; the due reminder uses all dues.
      paid: ms.amountPaid,
      due: kind === 'due' ? member.due : ms.due,
      ...(payment && { paidAmount: payment.amount, paidAt: payment.paidAt, mode: t(`payModes.${payment.mode}`) }),
    },
  }
}
