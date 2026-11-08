import { useSyncExternalStore } from 'react'
import { claimsApi } from '../api/client'

// UPI payments guests reported ("I've paid" + UTR), pending staff review. One
// shared list for the app: PaymentClaimsWatcher polls it, the Sidebar badge and
// the Billing banner read it.
let state = { claims: [], pending: 0, loaded: false }
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const snapshot = () => state

export async function refreshClaims() {
  try {
    const { data } = await claimsApi.list({ status: 'pending' })
    const claims = Array.isArray(data?.claims) ? data.claims : []
    state = { claims, pending: data?.counts?.pending ?? claims.length, loaded: true }
    emit()
  } catch { /* offline / no permission: keep the last list */ }
  return state
}

export function resetClaims() {
  state = { claims: [], pending: 0, loaded: false }
  emit()
}

export function usePendingClaims() {
  return useSyncExternalStore(subscribe, snapshot)
}
