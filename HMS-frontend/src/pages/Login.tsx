import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { validateEmail, validatePassword } from '@/utils/validators'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [tab, setTab] = useState<'signin' | 'signup'>('signin')
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
    const { login, isLoading } = useAuth()
    const { notify } = useNotification()
    const navigate = useNavigate()

    const validate = (): boolean => {
        const e: { email?: string; password?: string } = {}
        const em = validateEmail(email)
        const pw = validatePassword(password)
        if (em) e.email = em
        if (pw) e.password = pw
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault()
        if (!validate()) return
        try {
            await login(email, password)
            navigate('/dashboard', { replace: true })
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? 'Login failed. Please check your credentials.'
            notify(msg, 'error')
        }
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-[#0f0f0f]">
            {/* Left Side - Form */}
            <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-12">
                <div className="w-full max-w-sm space-y-8">
                    {/* Header/Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <span className="text-white">
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                </svg>
                            </span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none">ZenoHosp</h1>
                            <p className="text-xs text-slate-400 dark:text-[#666666] font-medium mt-1">Hospital Management System</p>
                        </div>
                    </div>

                    {/* Switch Toggle */}
                    <div className="bg-slate-50 dark:bg-[#1a1a1a] p-1 rounded-xl flex">
                        <button
                            onClick={() => setTab('signin')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'signin' ? 'bg-white dark:bg-[#2a2a2a] text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-[#555555]'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setTab('signup')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'signup' ? 'bg-white dark:bg-[#2a2a2a] text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-[#555555]'}`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-[#aaaaaa]">Email or Username</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="email@example.com or username"
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-transparent border border-slate-200 dark:border-[#222222] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 dark:text-white"
                                />
                            </div>
                            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-[#aaaaaa]">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Your password"
                                    className="w-full pl-10 pr-12 py-3 bg-white dark:bg-transparent border border-slate-200 dark:border-[#222222] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 dark:text-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Signing in...' : (
                                <>
                                    Sign In <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center px-4">
                            <div className="w-full border-t border-slate-100 dark:border-[#222222]"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-[#0f0f0f] px-4 text-slate-400 dark:text-[#444444] font-bold tracking-widest">OR CONTINUE WITH</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {/* Directory SSO */}
                        <button
                            type="button"
                            onClick={() => { window.location.href = '/oauth2/authorization/directory' }}
                            className="w-full py-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-400 font-bold text-sm flex items-center justify-center gap-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all active:scale-[0.98]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                            Sign in with ZenoHosp Directory
                        </button>

                        {/* Google OAuth */}
                        <button
                            type="button"
                            onClick={() => { window.location.href = '/oauth2/authorization/google' }}
                            className="w-full py-3.5 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-slate-700 dark:text-[#cccccc] font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-[#222222] transition-all active:scale-[0.98]"
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                            Continue with Google
                        </button>
                    </div>

                    <p className="text-center text-xs text-slate-400 dark:text-[#555555] font-medium pt-4">
                        By continuing, you agree to our <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">Terms of Service</span>
                    </p>
                </div>
            </div>

            {/* Right Side - Visual/Promo */}
            <div className="hidden lg:flex w-[55%] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 relative overflow-hidden items-center justify-center p-16">
                {/* Decorative Elements */}
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-black/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-lg space-y-10">
                    <div className="space-y-4">
                        <h2 className="text-5xl font-extrabold text-white leading-tight">
                            Modern Healthcare Management
                        </h2>
                        <p className="text-lg text-emerald-50/80 font-medium leading-relaxed">
                            Manage your hospital, patients, and team — all from one secure, multi-tenant platform.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {[
                            'Multi-hospital support with data isolation',
                            'Role-based access: Admin, Doctor, Staff',
                            'Secure Google & credential login',
                            'Real-time patient records & audit trail'
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-4 text-white">
                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center border border-white/30 shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                </div>
                                <span className="font-semibold">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
