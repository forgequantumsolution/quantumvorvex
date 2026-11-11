import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuPencil, LuTrash2, LuCheck, LuArrowDownLeft, LuArrowUpRight } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import { Button } from '../../ui-tw'
import { expensesApi } from '../../../api/client'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/format'

function Item({ label, children, wide }) {
  if (children == null || children === '') return null
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs text-ink3 mb-0.5">{label}</dt>
      <dd className="m-0 text-sm text-ink break-words whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

/**
 * Read-only view of one cash-book entry, opened by clicking a ledger row.
 * `expense` is the ledger row (shown at once); the full entry — with its
 * property and who recorded it — is fetched from GET /expenses/:id.
 * Actions: mark paid / edit (canManage) and delete (canDelete: owner or admin).
 */
export default function ExpenseDetailModal({ expense: row, propertyId, canManage, canDelete, busy, onClose, onPay, onEdit, onDelete }) {
  const { t } = useTranslation('expenses')
  const [full, setFull] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let off = false
    expensesApi.get(row.id, propertyId)
      .then(({ data }) => { if (!off) setFull(data.expense) })
      .catch(() => { if (!off) setError(t('detail.loadError')) })
    return () => { off = true }
  }, [row.id, propertyId, t])

  const e = { ...row, ...full }
  const income = e.type === 'income'
  const unpaid = e.status === 'unpaid'
  const group = e.category?.group

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('detail.title')}
      maxWidth="560px"
      footer={<>
        {canDelete && (
          <Button variant="danger" icon={<LuTrash2 />} disabled={busy} onClick={() => onDelete(e)}>{t('actions.delete')}</Button>
        )}
        {canManage && unpaid && (
          <Button variant="ghost" icon={<LuCheck />} disabled={busy} onClick={() => onPay(e)}>{t('actions.markPaid')}</Button>
        )}
        {canManage && (
          <Button icon={<LuPencil />} disabled={busy} onClick={() => onEdit(e)}>{t('actions.edit')}</Button>
        )}
        {!canManage && <Button variant="ghost" onClick={onClose}>{t('common:close')}</Button>}
      </>}
    >
      <div className="space-y-5">
        {/* Header: payee, amount, type + status */}
        <div className="flex items-start gap-3">
          <span aria-hidden className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[18px] ${
            income ? 'bg-success-bg text-success-text' : unpaid ? 'bg-warning-bg text-warning-text' : 'bg-danger-bg text-danger-text'}`}>
            {income ? <LuArrowDownLeft /> : <LuArrowUpRight />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[16px] text-ink break-words">{e.payee}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] font-semibold">
              <span className={`rounded-full px-2 py-px ${income ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}`}>
                {income ? t('detail.moneyIn') : t('detail.moneyOut')}
              </span>
              <span className={`rounded-full px-2 py-px ${unpaid ? 'bg-warning-bg text-warning-text' : 'bg-surface2 text-ink2'}`}>
                {t(`status.${e.status}`, { defaultValue: e.status })}
              </span>
            </div>
          </div>
          <div className={`shrink-0 text-right font-bold text-[20px] tabular-nums ${income ? 'text-success-text' : unpaid ? 'text-warning-text' : 'text-ink'}`}>
            {`${income ? '+' : '−'}${formatCurrency(e.amount)}`}
          </div>
        </div>

        {error && <div className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{error}</div>}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5 m-0">
          <Item label={t('detail.date')}>{formatDate(e.date, { weekday: 'short' })}</Item>
          <Item label={t('detail.property')}>{e.property?.name}</Item>
          <Item label={t('detail.category')}>{e.category?.name}</Item>
          <Item label={t('detail.group')}>{group ? t(`groups.${group}`, { defaultValue: group }) : null}</Item>
          <Item label={income ? t('detail.receivedInto') : t('detail.paidFrom')}>
            {t(`paidFrom.${e.paidFrom}`, { defaultValue: e.paidFrom })}
          </Item>
          <Item label={income ? t('detail.receivedBy') : t('detail.paidBy')}>{e.paidByName}</Item>
          <Item label={t('detail.mode')}>{t(`modes.${e.paymentMode}`, { defaultValue: e.paymentMode })}</Item>
          <Item label={t('detail.reference')}>{e.reference}</Item>
          <Item label={t('detail.note')} wide>{e.description}</Item>
        </dl>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-3 m-0 pt-4 border-t border-line">
          <Item label={t('detail.addedBy')}>{full ? (full.createdBy?.name || '—') : '…'}</Item>
          <Item label={t('detail.addedOn')}>{e.createdAt ? formatDateTime(e.createdAt) : null}</Item>
          <Item label={t('detail.updatedOn')}>{e.updatedAt && e.updatedAt !== e.createdAt ? formatDateTime(e.updatedAt) : null}</Item>
        </dl>

        {canManage && !canDelete && (
          <p className="m-0 text-xs text-ink3">{t('detail.noDeleteHint')}</p>
        )}
      </div>
    </Modal>
  )
}
