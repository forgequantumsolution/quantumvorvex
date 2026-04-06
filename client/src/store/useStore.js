import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Dark mode ──────────────────────────────────────────────────────────
      darkMode: false,
      toggleDarkMode: () => {
        const next = !get().darkMode
        set({ darkMode: next })
        if (next) document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
      },
      initDarkMode: () => {
        if (get().darkMode) document.documentElement.classList.add('dark')
      },

      // ── Sidebar ────────────────────────────────────────────────────────────
      sidebarOpen: false,
      toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),

      // ── Active panel ───────────────────────────────────────────────────────
      activePanel: 'dashboard',
      setActivePanel: (panel) => set({ activePanel: panel }),

      // ── Global search ──────────────────────────────────────────────────────
      searchOpen: false,
      setSearchOpen: (v) => set({ searchOpen: v }),

      // ── Auth ───────────────────────────────────────────────────────────────
      currentUser: null,  // { id, name, email, role, phone? }
      token: null,

      login: (token, user) => {
        localStorage.setItem('qv_token', token)
        set({ token, currentUser: user, activePanel: 'dashboard' })
      },

      logout: async () => {
        try {
          await fetch('/api/v1/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { Authorization: `Bearer ${get().token}` },
          })
        } catch { /* ignore network errors on logout */ }
        localStorage.removeItem('qv_token')
        set({ token: null, currentUser: null, activePanel: 'dashboard' })
      },

      setCurrentUser: (user) => set({ currentUser: user }),

      // ── Hotel info (cached from settings) ──────────────────────────────────
      hotelName: 'Quantum Vorvex',
      ownerName: 'Admin',
      setHotelName: (name) => set({ hotelName: name }),
      setOwnerName: (name) => set({ ownerName: name }),
    }),
    {
      name: 'qv-store',
      partialize: (state) => ({
        darkMode:    state.darkMode,
        hotelName:   state.hotelName,
        ownerName:   state.ownerName,
        token:       state.token,
        currentUser: state.currentUser,
      }),
    }
  )
)

// ── Toast store (not persisted) ────────────────────────────────────────────────
export const useToastStore = create((set, get) => ({
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Date.now() + Math.random()
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, message, type }] }))
    setTimeout(() => get().removeToast(id), 3000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
