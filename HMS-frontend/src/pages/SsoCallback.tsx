import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function SsoCallback() {
    const [searchParams] = useSearchParams()
    const { ssoLogin } = useAuth()
    const navigate = useNavigate()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const token = searchParams.get('token')
        const errorParam = searchParams.get('error')

        if (errorParam) {
            const messages: Record<string, string> = {
                sso_failed: 'SSO login failed. Please try again.',
                user_not_found: 'Your account is not registered in HMS. Contact your admin.',
                account_inactive: 'Your HMS account is inactive. Contact your admin.',
                no_hms_access: 'HMS access is not enabled for your account. Please contact your directory admin.',
            }
            setError(messages[errorParam] ?? 'Login failed. Please try again.')
            setTimeout(() => navigate('/login', { replace: true }), 3000)
            return
        }

        if (!token) {
            setError('No token received. Redirecting to login...')
            setTimeout(() => navigate('/login', { replace: true }), 2000)
            return
        }

        ssoLogin(token)
            .then(() => navigate('/dashboard', { replace: true }))
            .catch((err) => {
                console.error('SSO login error:', err)
                setError('Failed to complete login. Redirecting...')
                setTimeout(() => navigate('/login', { replace: true }), 2000)
            })
    }, [])

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0f0f]">
            <div className="text-center space-y-4">
                {error ? (
                    <>
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <p className="text-red-500 font-semibold">{error}</p>
                        <p className="text-slate-400 text-sm">Redirecting to login...</p>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-slate-700 dark:text-slate-300 font-semibold">Completing sign-in...</p>
                        <p className="text-slate-400 text-sm">Please wait while we set up your session.</p>
                    </>
                )}
            </div>
        </div>
    )
}
