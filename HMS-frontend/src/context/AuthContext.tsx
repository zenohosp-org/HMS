import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import api, { authApi, directoryLogout } from '@/utils/api'
import SSOCookieManager from '@/utils/ssoManager'

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Role names exactly as stored in Directory and HMS databases.
 * All lowercase with underscores — never uppercase, matching Directory's convention.
 */
export type UserRole = 'super_admin' | 'hospital_admin' | 'doctor' | 'staff'

export interface AuthUser {
    userId: string
    email: string
    firstName: string
    lastName: string | null
    role: UserRole
    roleDisplay: string
    hospitalId: string | null
    hospitalName: string | null
    isActive: boolean
}

interface AuthContextValue {
    user: AuthUser | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const LOGOUT_FLAG_KEY = 'hms_logout_in_progress'
const USER_STORAGE_KEY = 'hms_user'

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(() => {
        try {
            const stored = sessionStorage.getItem(USER_STORAGE_KEY)
            return stored ? JSON.parse(stored) : null
        } catch {
            return null
        }
    })
    const [isLoading, setIsLoading] = useState(!user)

    // Restore session from cookie on mount
    useEffect(() => {
        if (!user && isLoading) {
            const logoutInProgress = localStorage.getItem(LOGOUT_FLAG_KEY)
            if (logoutInProgress) {
                sessionStorage.removeItem(USER_STORAGE_KEY)
                setUser(null)
                setIsLoading(false)
                localStorage.removeItem(LOGOUT_FLAG_KEY)
                return
            }

            authApi.me()
                .then((profile) => {
                    const authUser = mapProfileToUser(profile)
                    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser))
                    setUser(authUser)
                })
                .catch(() => {
                    sessionStorage.removeItem(USER_STORAGE_KEY)
                    setUser(null)
                })
                .finally(() => setIsLoading(false))
        } else {
            setIsLoading(false)
        }
    }, [])

    // Re-validate session when the tab regains focus (detects cross-app logouts)
    useEffect(() => {
        const verifyOnFocus = async () => {
            if (!user) return
            try {
                await authApi.me()
            } catch {
                sessionStorage.removeItem(USER_STORAGE_KEY)
                setUser(null)
                window.location.href = '/login?logged_out=1'
            }
        }

        window.addEventListener('focus', verifyOnFocus)
        return () => window.removeEventListener('focus', verifyOnFocus)
    }, [user])

    // Cross-tab / cross-app logout via localStorage — key 'sso-logout' matches the
    // platform-wide convention used by Inventory and Directory apps
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'sso-logout') {
                sessionStorage.removeItem(USER_STORAGE_KEY)
                SSOCookieManager.clearToken()
                setUser(null)
                window.location.href = '/login?logged_out=1'
            }
        }

        const handleCustomLogout = () => {
            sessionStorage.removeItem(USER_STORAGE_KEY)
            SSOCookieManager.clearToken()
            setUser(null)
            window.location.href = '/login?logged_out=1'
        }

        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('sso-logout', handleCustomLogout)
        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('sso-logout', handleCustomLogout)
        }
    }, [])

    const login = useCallback(async (email: string, password: string) => {
        setIsLoading(true)
        try {
            // Backend sets HttpOnly cookie in the response; user profile comes in the body
            const response = await authApi.login(email, password)
            const authUser = mapProfileToUser(response)
            sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser))
            setUser(authUser)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const logout = useCallback(async () => {
        localStorage.setItem(LOGOUT_FLAG_KEY, '1')
        sessionStorage.removeItem(USER_STORAGE_KEY)
        SSOCookieManager.clearToken()
        setUser(null)

        // Broadcast to all other tabs/apps on zenohosp.com
        try {
            localStorage.setItem('sso-logout', `${Date.now()}`)
            window.dispatchEvent(new Event('sso-logout'))
        } catch (e) {
            console.warn('Failed to broadcast logout:', e)
        }

        // Clear cookie on both HMS backend and Directory backend
        try {
            await Promise.all([
                api.post('/auth/logout'),
                directoryLogout(),
            ])
        } catch (e) {
            console.warn('Logout API failed:', e)
        }

        window.location.href = '/login?logged_out=1'
    }, [])

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
    return ctx
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps the AuthResponse payload from the HMS backend to an AuthUser.
 * Role names are kept as-is (lowercase) — they match Directory's convention exactly:
 *   super_admin | hospital_admin | doctor | staff
 */
function mapProfileToUser(profile: any): AuthUser {
    const role = ((profile.role as string) || '').toLowerCase() as UserRole
    return {
        userId: profile.userId?.toString() ?? '',
        email: profile.email ?? '',
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? null,
        role,
        roleDisplay: profile.roleDisplay ?? role,
        hospitalId: profile.hospitalId?.toString() ?? null,
        hospitalName: profile.hospitalName ?? null,
        isActive: profile.isActive ?? true,
    }
}
