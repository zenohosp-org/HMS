import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
    Stethoscope,
    ArrowUpRight,
    BookOpen,
    Boxes,
    BarChart2,
    LayoutGrid,
    ChevronDown,
    UserSquare2,
    CalendarDays,
    Banknote,
    ScanLine,
    FileText,
} from 'lucide-react'

interface NavItem {
    label: string
    to: string
    icon: React.ElementType
}

interface ExternalApp {
    label: string
    href: string
    icon: React.ElementType
}

const DASHBOARD_LINK: NavItem = { label: 'Dashboard', to: '/dashboard', icon: Home }

const MANAGEMENT_LINKS: NavItem[] = [
    { label: 'Doctors', to: '/doctors', icon: Users },
    { label: 'Patients', to: '/patients', icon: Building2 },
    { label: 'Appointments', to: '/appointments', icon: Calendar },
    { label: 'Billing', to: '/billing', icon: ReceiptText },
    { label: 'Room Allocation', to: '/rooms', icon: Bed },
    { label: 'Specializations', to: '/specializations', icon: Stethoscope },
    { label: 'Services', to: '/services', icon: ClipboardList },
]

const RADIOLOGY_LINKS: NavItem[] = [
    { label: 'Imaging Queue', to: '/radiology',         icon: ScanLine  },
    { label: 'Reports',       to: '/radiology/reports', icon: FileText  },
]

const HR_LINKS: NavItem[] = [
    { label: 'Staff Directory', to: '/staffs', icon: UserSquare2 },
    { label: 'Shift Roster',   to: '/staffs/roster',  icon: CalendarDays },
    { label: 'Payroll',        to: '/staffs/payroll',  icon: Banknote     },
]

const EXTERNAL_APPS: ExternalApp[] = [
    { label: 'Finance',   href: 'https://finance.zenohosp.com',   icon: BarChart2  },
    { label: 'Inventory', href: 'https://inventory.zenohosp.com', icon: Boxes      },
    { label: 'Directory', href: 'https://directory.zenohosp.com', icon: BookOpen   },
    { label: 'Assets',    href: 'https://asset.zenohosp.com',     icon: LayoutGrid },
]

export default function Sidebar({ isOpen }: { isOpen: boolean }) {
    const { user } = useAuth()
    const location = useLocation()
    const [hrOpen, setHrOpen] = useState(() => location.pathname.startsWith('/staffs'))
    const [radOpen, setRadOpen] = useState(() => location.pathname.startsWith('/radiology'))

    const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`

    const filteredManagementLinks = MANAGEMENT_LINKS.filter(link => {
        if (user?.role === 'hospital_admin' || user?.role === 'super_admin') return true
        const allowedLinks = ['Patients', 'Appointments', 'Billing', 'Room Allocation']
        return allowedLinks.includes(link.label)
    })

    const isHrAdmin = user?.role === 'hospital_admin' || user?.role === 'super_admin'
    const hrActive  = location.pathname.startsWith('/staffs')
    const radActive = location.pathname.startsWith('/radiology')

    const renderLink = (link: NavItem, indent = false) => {
        const Icon = link.icon
        return isOpen ? (
            <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/staffs'}
                className={({ isActive }) =>
                    `flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${indent ? 'px-3 pl-8' : 'px-3'}
                    ${isActive
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
                end={link.to === '/staffs'}
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

    const renderExternalApp = (app: ExternalApp) => {
        const Icon = app.icon
        return isOpen ? (
            <a
                key={app.href}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-slate-600 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-[#cccccc] group"
            >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{app.label}</span>
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </a>
        ) : (
            <a
                key={app.href}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                title={app.label}
                className="flex items-center justify-center w-full py-3 rounded-lg transition-colors duration-150 text-slate-600 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-[#cccccc]"
            >
                <Icon className="w-4 h-4 text-inherit" />
            </a>
        )
    }

    const renderAccordionSection = (
        links: NavItem[],
        label: string,
        AccIcon: React.ElementType,
        open: boolean,
        setOpen: (v: (p: boolean) => boolean) => void,
        active: boolean,
    ) => {
        if (!isOpen) return links.map(link => renderLink(link))
        return (
            <div>
                <button
                    onClick={() => setOpen(o => !o)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                        ${active
                            ? 'text-emerald-700 dark:text-white'
                            : 'text-slate-600 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-[#cccccc]'
                        }`}
                >
                    <AccIcon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                    <span className="flex-1 text-left truncate">{label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''} opacity-50`} />
                </button>
                {open && (
                    <div className="mt-0.5 space-y-0.5">
                        {links.map(link => renderLink(link, true))}
                    </div>
                )}
            </div>
        )
    }

    const renderHrAccordion = () =>
        renderAccordionSection(HR_LINKS, 'HR & Staff', ClipboardList, hrOpen, setHrOpen, hrActive)

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
                {renderAccordionSection(RADIOLOGY_LINKS, 'Radiology', ScanLine, radOpen, setRadOpen, radActive)}
                {isHrAdmin && renderHrAccordion()}

                {/* Divider */}
                <div className={`border-t border-slate-100 dark:border-[#1e1e1e] ${isOpen ? 'mx-3 my-4' : 'my-4'}`} />

                {isOpen && (
                    <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555]">
                        Other Apps
                    </div>
                )}
                {EXTERNAL_APPS.map(app => renderExternalApp(app))}
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
