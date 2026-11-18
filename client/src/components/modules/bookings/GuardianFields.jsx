import { useTranslation } from 'react-i18next'
import { Field } from '../../ui-tw'
import { digits } from './guardian'
import UploadZone from './UploadZone'

/**
 * Native (permanent) address + parent/guardian name, mobile and Aadhaar.
 * Renders grid children for a 2-col (phone) / 12-col (lg) grid.
 */
export default function GuardianFields({ values, onChange, errors = {}, fieldName = (k) => k, onScan, scanPrefix = 'guardian', scanSuffix = '' }) {
  const { t } = useTranslation('bookings')
  const set = (k, clean = (x) => x) => (e) => onChange(k, clean(e.target.value))
  return (
    <>
      <Field className="col-span-2 lg:col-span-12" label={t('guardian.nativeAddress')} name={fieldName('nativeAddress')}
             value={values.nativeAddress} onChange={set('nativeAddress')} placeholder={t('guardian.nativeAddressPlaceholder')} />
      <Field className="col-span-2 sm:col-span-1 lg:col-span-4" label={t('guardian.name')} name={fieldName('guardianName')}
             value={values.guardianName} onChange={set('guardianName')} placeholder={t('guardian.namePlaceholder')} />
      <Field className="col-span-2 sm:col-span-1 lg:col-span-4" label={t('guardian.phone')} name={fieldName('guardianPhone')}
             value={values.guardianPhone} inputMode="numeric" maxLength={10} placeholder={t('form.phonePlaceholder')}
             onChange={set('guardianPhone', (x) => digits(x).slice(0, 10))} error={errors[fieldName('guardianPhone')]} />
      <Field className="col-span-2 sm:col-span-1 lg:col-span-4" label={t('guardian.aadhaar')} name={fieldName('guardianAadhaar')}
             value={values.guardianAadhaar} inputMode="numeric" maxLength={12} placeholder={t('guardian.aadhaarPlaceholder')}
             onChange={set('guardianAadhaar', (x) => digits(x).slice(0, 12))} error={errors[fieldName('guardianAadhaar')]} />

      {/* Guardian's Aadhaar card — attached to the booking's documents on save. */}
      <div className="col-span-2 lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[['guardianFront', 'front'], ['guardianBack', 'back']].map(([key, side]) => {
          const label = t('guardian.docSide', { side: t(`form.${side}`) })
          return (
            <UploadZone
              key={key}
              label={label}
              file={values[key]}
              onPick={(f) => onChange(key, f)}
              onScan={onScan && (() => onScan({
                title: `${t('form.scanDoc', { doc: label })}${scanSuffix}`,
                namePrefix: `${scanPrefix}-aadhaar-${side}`,
                onPick: (f) => onChange(key, f),
              }))}
            />
          )
        })}
      </div>
    </>
  )
}
