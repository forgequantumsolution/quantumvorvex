import { useTranslation } from 'react-i18next'
import { Field } from '../../ui-tw'
import UploadZone from './UploadZone'
import { bedLabel } from '../../../utils/beds'
import { newOccupant, occField } from './occupants'
import { formatDate } from '../../../utils/format'

/**
 * PG booking: pick free beds of the room, then fill one card per occupant with
 * their own details, rent, advance and refundable deposit. Each occupant
 * becomes their own booking (own dues, invoice, check-in/out) on save.
 */
export default function PgOccupants({
  beds, loading, occupants, onChange, errors, unit, defaultRate, idTypes, onScan,
}) {
  const { t } = useTranslation('bookings')
  const idTypeOptions = (idTypes || []).map((value) => ({ value, label: t(`idTypes.${value}`, { defaultValue: value }) }))
  const sideLabel = (o, side) => t('form.scanSideLabel', {
    doc: t(`idTypes.${o.idType}`, { defaultValue: o.idType }), side: side === 'front' ? t('form.front') : t('form.back'),
  })
  const update = (key, patch) => onChange(occupants.map((o) => (o.key === key ? { ...o, ...patch } : o)))
  const remove = (key) => onChange(occupants.filter((o) => o.key !== key))
  const toggleBed = (bed) => {
    const held = occupants.find((o) => o.bedNo === bed.bedNo)
    if (held) remove(held.key)
    else if (bed.free) {
      onChange([...occupants, newOccupant(bed.bedNo, defaultRate)].sort((a, b) => a.bedNo - b.bedNo))
    }
  }
  // Take the first card's rent/deposit and apply them to every bed.
  const copyTermsToAll = () => {
    const [first] = occupants
    onChange(occupants.map((o) => ({ ...o, rate: first.rate, rateAuto: first.rateAuto, deposit: first.deposit })))
  }

  const freeCount = beds?.filter((b) => b.free).length ?? 0

  return (
    <div className="space-y-4">
      {/* ── Bed picker ── */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-2">
          <span className="text-xs font-medium text-ink2">{t('pg.selectBeds')}</span>
          <span className="text-xs text-ink3">
            {loading ? t('pg.checking') : beds ? t('pg.freeOf', { free: freeCount, total: beds.length }) : t('pg.setDates')}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {(beds || []).map((bed) => {
            const picked = occupants.some((o) => o.bedNo === bed.bedNo)
            const taken = !bed.free
            return (
              <button
                key={bed.bedNo}
                type="button"
                onClick={() => toggleBed(bed)}
                disabled={taken && !picked}
                aria-pressed={picked}
                className={`text-left rounded-lg border px-3 py-2 min-w-0 transition-colors ${
                  picked
                    ? taken ? 'border-danger bg-danger-bg' : 'border-gold bg-gold-bg'
                    : taken
                      ? 'border-line bg-surface2 opacity-70 cursor-not-allowed'
                      : 'border-line2 bg-surface hover:border-gold cursor-pointer'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{t('bedN', { bed: bed.label })}</span>
                  <span className={`text-xs font-medium shrink-0 ${picked ? 'text-gold' : taken ? 'text-ink3' : 'text-success-text'}`}>
                    {picked ? `✓ ${t('pg.selected')}` : taken ? t('pg.taken') : t('pg.free')}
                  </span>
                </span>
                <span className="block text-xs text-ink3 mt-0.5 truncate">
                  {taken
                    ? `${bed.heldBy.name}${bed.heldBy.until ? ` · ${t('form.till', { date: formatDate(bed.heldBy.until) })}` : ''}`
                    : picked ? t('pg.fillBelow') : t('pg.tapToAdd')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {occupants.length === 0 && (
        <p className="text-xs text-ink3 rounded-lg border border-dashed border-line2 px-3 py-4 text-center">
          {freeCount ? t('pg.pickHint') : t('pg.noFree')}
        </p>
      )}

      {/* ── One card per occupant ── */}
      {occupants.map((o, i) => (
        <div key={o.key} className={`rounded-xl border bg-surface2 ${errors[occField(o, 'bed')] ? 'border-danger' : 'border-line'}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 sm:px-3.5 py-2 border-b border-line">
            <span className="w-7 h-7 rounded-md bg-gold-bg border border-gold-border text-gold text-[12px] font-bold flex items-center justify-center">
              {bedLabel(o.bedNo)}
            </span>
            <span className="text-[12.5px] font-semibold text-ink">{t('bedN', { bed: bedLabel(o.bedNo) })}</span>
            {errors[occField(o, 'bed')] && (
              <span className="text-xs text-danger">{errors[occField(o, 'bed')]}</span>
            )}
            {i === 0 && occupants.length > 1 && (
              <button type="button" onClick={copyTermsToAll}
                      className="ml-auto text-xs font-medium text-ink3 hover:text-gold transition-colors pointer-coarse:min-h-11">
                {t('pg.copyTerms')}
              </button>
            )}
            <button type="button" onClick={() => remove(o.key)} aria-label={t('pg.removeBed', { bed: bedLabel(o.bedNo) })}
                    className={`${i === 0 && occupants.length > 1 ? '' : 'ml-auto'} text-xs text-ink3 hover:text-danger transition-colors pointer-coarse:min-h-11 pointer-coarse:px-1`}>
              {t('common:remove')}
            </button>
          </div>

          {/* Two columns on phones too: contact fields span the row, the money
              fields (rent, advance, deposit, ID type) pair up. */}
          <div className="p-3 sm:p-3.5 grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-3">
            <Field className="col-span-2 sm:col-span-1 lg:col-span-4" label={t('common:name')} name={occField(o, 'name')} value={o.name} required
                   onChange={(e) => update(o.key, { name: e.target.value })} placeholder={t('form.fullName')}
                   error={errors[occField(o, 'name')]} />
            <Field className="col-span-2 sm:col-span-1 lg:col-span-4" label={t('common:phone')} name={occField(o, 'phone')} value={o.phone} required
                   inputMode="numeric" maxLength={10} placeholder={t('form.phonePlaceholder')}
                   onChange={(e) => update(o.key, { phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                   error={errors[occField(o, 'phone')]} />
            <Field className="col-span-2 sm:col-span-1 lg:col-span-4" label={t('common:email')} name={occField(o, 'email')} type="email" value={o.email}
                   onChange={(e) => update(o.key, { email: e.target.value })} placeholder={t('common:optional')}
                   error={errors[occField(o, 'email')]} />

            <Field className="lg:col-span-3" label={t('pg.rentLabel', { unit })} name={occField(o, 'rate')} type="number" min="0"
                   value={o.rate} required error={errors[occField(o, 'rate')]}
                   onChange={(e) => update(o.key, { rate: e.target.value, rateAuto: false })} />
            <Field className="lg:col-span-3" label={t('form.advanceInr')} type="number" min="0" value={o.advance}
                   onChange={(e) => update(o.key, { advance: e.target.value })} placeholder="0" />
            <Field className="lg:col-span-3" label={t('pg.depositInr')} type="number" min="0" value={o.deposit}
                   onChange={(e) => update(o.key, { deposit: e.target.value })} placeholder="0"
                   hint={t('pg.refundable')} />
            <Field className="lg:col-span-3" label={t('pg.idType')} value={o.idType} options={idTypeOptions}
                   onChange={(e) => update(o.key, { idType: e.target.value })} />

            <Field className="col-span-2 lg:col-span-4" label={t('form.idNumber')} value={o.idNumber}
                   onChange={(e) => update(o.key, { idNumber: e.target.value })} placeholder={t('form.idNumberPlaceholder')} />
            <div className="col-span-2 lg:col-span-8 grid grid-cols-2 gap-3">
              {['front', 'back'].map((side) => (
                <UploadZone
                  key={side}
                  label={sideLabel(o, side)}
                  file={o[side]}
                  onPick={(f) => update(o.key, { [side]: f })}
                  onScan={() => onScan({
                    title: `${t('form.scanDoc', { doc: sideLabel(o, side) })} (${t('bedN', { bed: bedLabel(o.bedNo) })})`,
                    namePrefix: `bed-${bedLabel(o.bedNo).toLowerCase()}-${side}`,
                    onPick: (f) => update(o.key, { [side]: f }),
                  })}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
