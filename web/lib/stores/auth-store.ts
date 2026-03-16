import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

export type AuthUser = {
  user_id: string
  email: string
  username: string
  role: string
}

type AuthState = {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  setSession: (payload: { token: string; user: AuthUser }) => void
  clearSession: () => void
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setSession: ({ token, user }) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),
      clearSession: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "mist-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
