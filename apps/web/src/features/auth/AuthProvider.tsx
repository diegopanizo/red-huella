/* eslint-disable react-refresh/only-export-components -- El provider y su hook forman una API de contexto inseparable. */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, type ReactNode } from 'react'
import { api, ApiError } from '../../services/api'
import type { User } from '../../types'

type AuthValue = {
  user: User | null
  loading: boolean
  authenticated: boolean
  login(email: string, password: string): Promise<void>
  register(name: string, email: string, password: string): Promise<void>
  logout(): Promise<void>
}
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const current = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.me,
    retry: false,
  })
  const setUser = (user: User | null) =>
    client.setQueryData(['auth', 'me'], user ? { user } : null)
  return (
    <AuthContext.Provider
      value={{
        user: current.data?.user ?? null,
        loading: current.isLoading,
        authenticated: Boolean(current.data?.user),
        async login(email, password) {
          setUser((await api.login({ email, password })).user)
        },
        async register(name, email, password) {
          setUser((await api.register({ name, email, password })).user)
        },
        async logout() {
          try {
            await api.logout()
          } finally {
            setUser(null)
            await client.invalidateQueries({ queryKey: ['my-publications'] })
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth requiere AuthProvider')
  return value
}
export function isUnauthenticated(error: unknown) {
  return error instanceof ApiError && error.status === 401
}
