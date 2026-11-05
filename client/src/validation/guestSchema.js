import * as Yup from 'yup'
import i18n from '../i18n'

// Messages are functions so Yup reads them in the current language each time it validates.
const g = (key) => () => i18n.t(`guests:validation.${key}`)
const c = (key) => () => i18n.t(`common:validation.${key}`)

export const guestEditSchema = Yup.object({
  name: Yup.string().trim().required(g('nameRequired')),
  phone: Yup.string()
    .trim()
    .matches(/^\d{10}$/, c('phoneInvalid'))
    .required(c('phoneRequired')),
  email: Yup.string().trim().email(c('invalidEmail')).nullable(),
  room: Yup.string().trim().required(g('roomRequired')),
  stayType: Yup.string().oneOf(['daily', 'monthly']).required(),
  checkInDate: Yup.string().required(g('checkInRequired')),
  checkOutDate: Yup.string().when('stayType', {
    is: 'daily',
    then: (s) => s.required(g('checkOutRequired')),
    otherwise: (s) => s.notRequired(),
  }),
  months: Yup.number().when('stayType', {
    is: 'monthly',
    then: (s) => s.typeError(g('enterNumber')).min(1, g('minOneMonth')).required(g('monthsRequired')),
    otherwise: (s) => s.notRequired(),
  }),
})
