import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { authApi } from '@/utils/api'

// ── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'STAFF'

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
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (email: string, password: string) => Promise<void>
    ssoLogin: (token: string) => Promise<void>
    logout: () => void
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(() => {
        const stored = localStorage.getItem('hms_user')
        return stored ? JSON.parse(stored) : null
    })
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem('hms_token')
    )
    const [isLoading, setIsLoading] = useState(false)

    const login = useCallback(async (email: string, password: string) => {
        setIsLoading(true)
        try {
            const response = await authApi.login(email, password)
            const { token: newToken, ...userData } = response

            const mappedRole = (userData.role as string).toUpperCase()
            const authUser: AuthUser = {
                userId: userData.userId,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName ?? null,
                role: (mappedRole === 'SUPER_ADMIN' ? 'ADMIN' : mappedRole) as UserRole,
                roleDisplay: userData.roleDisplay,
                hospitalId: userData.hospitalId ?? null,
                hospitalName: userData.hospitalName ?? null,
                isActive: userData.isActive,
            }

            setUser(authUser)
            setToken(newToken)
            localStorage.setItem('hms_token', newToken)
            localStorage.setItem('hms_user', JSON.stringify(authUser))
        } finally {
            setIsLoading(false)
        }
    }, [])

    const logout = useCallback(() => {
        setUser(null)
        setToken(null)
        localStorage.removeItem('hms_token')
        localStorage.removeItem('hms_user')
    }, [])

    /**
     * Called after Directory SSO redirects to /sso/callback?token=<jwt>.
     * Decodes the JWT payload (base64) to extract user info without an extra API call.
     */
    const ssoLogin = useCallback(async (rawToken: string) => {
        setIsLoading(true)
        try {
            // Decode JWT payload (middle segment) — no verification needed client-side
            const payload = JSON.parse(atob(rawToken.split('.')[1]))
            const email: string = payload.email || payload.sub
            const rawRole = (payload.role as string || '').toUpperCase()
            const role: UserRole = (rawRole === 'SUPER_ADMIN' ? 'ADMIN' : rawRole) as UserRole
            const hospitalId: string | null = payload.hospitalId ?? null

            // Fetch full profile from /api/auth/me to get names + hospitalName
            const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${rawToken}` },
            })
            if (!res.ok) throw new Error('Profile fetch failed')
            const profile = await res.json()

            const authUser: AuthUser = {
                userId: profile.userId ?? '',
                email,
                firstName: profile.firstName ?? email,
                lastName: profile.lastName ?? null,
                role,
                roleDisplay: profile.roleDisplay ?? role,
                hospitalId,
                hospitalName: profile.hospitalName ?? null,
                isActive: profile.isActive ?? true,
            }

            setUser(authUser)
            setToken(rawToken)
            localStorage.setItem('hms_token', rawToken)
            localStorage.setItem('hms_user', JSON.stringify(authUser))
        } finally {
            setIsLoading(false)
        }
    }, [])

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated: !!user && !!token,
            isLoading,
            login,
            ssoLogin,
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
