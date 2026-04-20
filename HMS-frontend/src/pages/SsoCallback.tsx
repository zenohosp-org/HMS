import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { authApi } from '@/utils/api'

/**
 * /sso/callback
 *
 * Called after the OAuth2 backend (Directory or Google) redirects here.
 * The backend has already:
 *  1. Validated the user against the HMS DB
 *  2. Set the ZENOHMS_TOKEN HttpOnly cookie
 *
 * This component validates the cookie via /api/auth/me and redirects to dashboard.
 */
export default function SsoCallback() {
    const { user, isLoading } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const errorParam = searchParams.get('error')

        if (errorParam) {
            const messages: Record<string, string> = {
                sso_failed: 'SSO login failed. Please try again.',
                user_not_found: 'Your account is not registered in HMS. Contact your admin.',
                account_inactive: 'Your HMS account is inactive. Contact your admin.',
                no_hms_access: 'HMS access is not enabled for your account. Please contact your directory admin.',
                role_missing: 'Your account has no role assigned. Contact your admin.',
                internal_server_error: 'An internal error occurred. Please try again.',
            }
            setError(messages[errorParam] ?? 'Login failed. Please try again.')
            setTimeout(() => navigate('/login', { replace: true }), 3000)
            return
        }

        // If AuthContext already restored the user from cookie, redirect immediately
        if (!isLoading && user) {
            navigate('/dashboard', { replace: true })
            return
        }

        // Cookie was just set by backend — verify session and redirect
        if (!isLoading && !user) {
            authApi.me()
                .then(() => {
                    // Cookie is valid; AuthContext will pick it up on next render
                    setTimeout(() => navigate('/dashboard', { replace: true }), 300)
                })
                .catch((err) => {
                    console.error('SSO callback validation error:', err)
                    setError('Failed to validate your session. Please try signing in again.')
                    setTimeout(() => navigate('/login?error=session_validation_failed', { replace: true }), 3000)
                })
        }
    }, [searchParams, isLoading, user, navigate])

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0f0f]">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <p className="text-red-500 font-semibold">{error}</p>
                    <p className="text-slate-400 text-sm">Redirecting to login...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0f0f]">
            <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-700 dark:text-slate-300 font-semibold">Completing sign-in...</p>
                <p className="text-slate-400 text-sm">Please wait while we set up your session.</p>
            </div>
        </div>
    )
}
