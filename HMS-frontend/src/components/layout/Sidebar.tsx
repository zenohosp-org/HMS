import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
    Home,
    Users,
    Building2,
    ClipboardList,
    ReceiptText,
    Activity,
    Bed,
    Calendar,
    Stethoscope
} from 'lucide-react'

interface NavItem {
    label: string
    to: string
    icon: React.ElementType
}

const DASHBOARD_LINK: NavItem = { label: 'Dashboard', to: '/dashboard', icon: Home }

const MANAGEMENT_LINKS: NavItem[] = [
    { label: 'Doctors', to: '/doctors', icon: Users },
    { label: 'Staffs', to: '/staffs', icon: ClipboardList },
    { label: 'Patients', to: '/patients', icon: Building2 },
    { label: 'Appointments', to: '/appointments', icon: Calendar },
    { label: 'Billing', to: '/billing', icon: ReceiptText },
    { label: 'Room Allocation', to: '/rooms', icon: Bed },
    { label: 'Specializations', to: '/specializations', icon: Stethoscope },
    { label: 'Services', to: '/services', icon: ClipboardList },
]

export default function Sidebar({ isOpen }: { isOpen: boolean }) {
    const { user } = useAuth()

    const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`

    const filteredManagementLinks = MANAGEMENT_LINKS.filter(link => {
        if (user?.role === 'HOSPITAL_ADMIN') return true
        // Doctors and Staff only see a subset (Patients, Appointments, Billing, Room Allocation)
        const allowedLinks = ['Patients', 'Appointments', 'Billing', 'Room Allocation']
        return allowedLinks.includes(link.label)
    })

    const renderLink = (link: NavItem) => {
        const Icon = link.icon
        return isOpen ? (
            <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                        ? 'bg-emerald-50 dark:bg-[#1e1e1e] text-emerald-700 dark:text-white'
                        : 'text-slate-600 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-[#cccccc]'
                    }`
                }
            >
                {({ isActive }) => (
                    <>
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                        <span className="truncate">{link.label}</span>
                        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />}
                    </>
                )}
            </NavLink>
        ) : (
            <NavLink
                key={link.to}
                to={link.to}
                title={link.label}
                className={({ isActive }) =>
                    `flex items-center justify-center w-full py-3 rounded-lg transition-colors duration-150 ${isActive
                        ? 'bg-emerald-50 dark:bg-[#1e1e1e] text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-600 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-[#cccccc]'
                    }`
                }
            >
                <Icon className="w-4 h-4 text-inherit" />
            </NavLink>
        )
    }

    return (
        <aside
            className={`flex flex-col h-full transition-all duration-300 ease-in-out shrink-0
                bg-white dark:bg-[#111111] border-r border-slate-200 dark:border-[#222222]
                ${isOpen ? 'w-60' : 'w-16'}`}
        >
            {/* Logo */}
            <div className={`flex items-center border-b border-slate-200 dark:border-[#222222] py-5 ${isOpen ? 'gap-3 px-4' : 'justify-center'}`}>
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-white" />
                </div>
                {isOpen && (
                    <div className="overflow-hidden">
                        <p className="font-bold text-sm leading-tight tracking-wider text-slate-900 dark:text-white">ZenoHosp</p>
                        <p className="text-xs text-slate-500 dark:text-[#555555] truncate mt-0.5">{user?.hospitalName}</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto px-2">
                {isOpen && (
                    <div className="px-3 mb-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555]">
                        Main Menu
                    </div>
                )}
                {renderLink(DASHBOARD_LINK)}

                {isOpen && (
                    <div className="px-3 mb-2 mt-10 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555]">
                        Hospital
                    </div>
                )}
                {filteredManagementLinks.map(link => renderLink(link))}
            </nav>

            {/* User profile at bottom */}
            <div className={`border-t border-slate-200 dark:border-[#222222] ${isOpen ? 'px-4 py-4' : 'py-4 flex justify-center'}`}>
                {isOpen ? (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#333333] border border-slate-300 dark:border-[#444444] flex items-center justify-center text-xs font-bold text-slate-700 dark:text-[#cccccc] shrink-0">
                            {initials}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-[#666666] truncate">{user?.roleDisplay}</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#333333] border border-slate-300 dark:border-[#444444] flex items-center justify-center text-xs font-bold text-slate-700 dark:text-[#cccccc]">
                        {initials}
                    </div>
                )}
            </div>
        </aside>
    )
}
