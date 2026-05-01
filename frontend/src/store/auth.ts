import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
  needs_setup: boolean
  own_profile_id?: string
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  updateUser: (patch: Partial<User>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('vs_user') || 'null') } catch { return null }
  })(),
  token: localStorage.getItem('vs_token'),

  setAuth: (user, token) => {
    localStorage.setItem('vs_token', token)
    localStorage.setItem('vs_user', JSON.stringify(user))
    set({ user, token })
  },

  updateUser: (patch) => set((state) => {
    const updated = { ...state.user!, ...patch }
    localStorage.setItem('vs_user', JSON.stringify(updated))
    return { user: updated }
  }),

  logout: () => {
    localStorage.removeItem('vs_token')
    localStorage.removeItem('vs_user')
    set({ user: null, token: null })
  },
}))
