import { useToastStore } from '../store/useStore'

export function useToast() {
  return useToastStore((s) => s.addToast)
}
