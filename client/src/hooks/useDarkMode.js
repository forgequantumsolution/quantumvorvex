import { useStore } from '../store/useStore'

export function useDarkMode() {
  const { darkMode, toggleDarkMode } = useStore()
  return { darkMode, toggleDarkMode }
}
