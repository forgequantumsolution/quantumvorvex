import { useCallback } from 'react'
import { useAppDispatch } from '../store/hooks'
import { addToast, removeToast } from '../store/slices/toastSlice'

// Returns an `addToast(message, type)` function that auto-dismisses after 3s.
export function useToast() {
  const dispatch = useAppDispatch()
  return useCallback(
    (message, type = 'success') => {
      const id = Date.now() + Math.random()
      dispatch(addToast({ id, message, type }))
      setTimeout(() => dispatch(removeToast(id)), 3000)
    },
    [dispatch],
  )
}
