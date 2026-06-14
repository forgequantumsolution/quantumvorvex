import { useAppSelector } from '../store/hooks'
import { hasModule } from '../utils/permissions'

/**
 * useCan('billing', 'MANAGE') — does the current user meet the required level on a module?
 * Defaults to MANAGE (the level needed for create/edit/delete controls). Owner roles
 * always return true. Backed by the live permission map on currentUser.
 */
export function useCan(module, level = 'MANAGE') {
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  return hasModule(currentUser, module, level)
}
