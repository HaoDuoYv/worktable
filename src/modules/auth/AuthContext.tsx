import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getMe,
  loadSession,
  login as apiLogin,
  logoutApi,
  refreshSession,
  register as apiRegister,
  saveSession,
  type AuthSession,
  type AuthUser,
} from './api'

type AuthContextValue = {
  user: AuthUser | null
  session: AuthSession | null
  isGuest: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, code: string) => Promise<void>
  logout: () => Promise<void>
  setSession: (s: AuthSession | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(() => loadSession())

  // boot: validate / refresh
  useEffect(() => {
    let cancelled = false
    async function boot() {
      const s = loadSession()
      if (!s) return
      try {
        const me = await getMe(s.accessToken)
        if (!cancelled) {
          setSessionState({ ...s, user: me.user })
          saveSession({ ...s, user: me.user })
        }
      } catch {
        try {
          const next = await refreshSession(s.refreshToken)
          if (!cancelled) {
            setSessionState(next)
            saveSession(next)
          }
        } catch {
          if (!cancelled) {
            setSessionState(null)
            saveSession(null)
          }
        }
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const setSession = useCallback((s: AuthSession | null) => {
    setSessionState(s)
    saveSession(s)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const s = await apiLogin(email, password)
    setSession(s)
  }, [setSession])

  const register = useCallback(
    async (email: string, password: string, code: string) => {
      const s = await apiRegister(email, password, code)
      setSession(s)
    },
    [setSession],
  )

  const logout = useCallback(async () => {
    const s = loadSession()
    if (s) {
      try {
        await logoutApi(s.refreshToken)
      } catch {
        /* ignore */
      }
    }
    setSession(null)
  }, [setSession])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      isGuest: !session,
      login,
      register,
      logout,
      setSession,
    }),
    [session, login, register, logout, setSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
