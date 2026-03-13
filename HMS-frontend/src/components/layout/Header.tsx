import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Menu, Sun, Moon, Bell, LogOut } from 'lucide-react'

interface Props {
    onMenuClick: () => void
}

export default function Header({ onMenuClick }: Props) {
    const { user, logout } = useAuth()
    const { theme, toggleTheme } = useTheme()

    const initials = `${user?.firstName?.[0]?.toUpperCase() ?? ''}${user?.lastName?.[0]?.toUpperCase() ?? ''}`

    return (
        <header className="h-14 bg-white dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222]
                       flex items-center px-4 gap-3 shrink-0">
            {/* Menu toggle */}
            <button
                onClick={onMenuClick}
                className="text-slate-500 hover:text-slate-800 dark:text-[#666666] dark:hover:text-[#cccccc]
                   p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
                aria-label="Toggle sidebar"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Title */}
            <span className="text-sm font-semibold text-slate-700 dark:text-[#cccccc] flex-1">
                Hospital Management System
            </span>

            {/* Right actions */}
            <div className="flex items-center gap-1">
                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg text-slate-500 dark:text-[#666666] hover:bg-slate-100 dark:hover:bg-[#1a1a1a]
                       hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors"
                    aria-label="Toggle theme"
                >
                    {theme === 'dark'
                        ? <Sun className="w-4 h-4" />
                        : <Moon className="w-4 h-4" />
                    }
                </button>

                {/* Notifications */}
                <button
                    className="p-2 rounded-lg text-slate-500 dark:text-[#666666] hover:bg-slate-100 dark:hover:bg-[#1a1a1a]
                       hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors relative"
                    aria-label="Notifications"
                >
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-slate-200 dark:bg-[#222222] mx-1" />

                {/* User avatar */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 dark:bg-[#2a2a2a] dark:border-[#3a3a3a]
                            flex items-center justify-center text-xs font-bold
                            text-slate-700 dark:text-[#cccccc]">
                        {initials}
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-xs font-semibold text-slate-700 dark:text-[#cccccc] leading-tight">
                            {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-[#555555]">{user?.roleDisplay}</p>
                    </div>
                </div>

                {/* Logout */}
                <button
                    onClick={logout}
                    className="ml-1 p-2 rounded-lg text-slate-400 dark:text-[#555555] hover:text-red-500 dark:hover:text-red-400
                     hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
                    aria-label="Logout"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </header>
    )
}
