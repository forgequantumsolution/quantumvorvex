import { useAppSelector, useUiActions } from '../store/hooks'

export function useDarkMode() {
  const darkMode = useAppSelector((s) => s.ui.darkMode)
  const { toggleDarkMode } = useUiActions()
  return { darkMode, toggleDarkMode }
}
