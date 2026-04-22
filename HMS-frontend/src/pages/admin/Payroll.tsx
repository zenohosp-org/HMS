import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { shiftsApi, type StaffShift } from '@/utils/api'
import { ChevronLeft, ChevronRight, Loader2, Users, Download } from 'lucide-react'

type ShiftType = StaffShift['shiftType']

const SHIFT_RATE: Record<ShiftType, number> = {
    ON_CALL:   500,
    MORNING:   800,
    GENERAL:   700,
    AFTERNOON: 850,
    NIGHT:    1000,
}

const SHIFT_LABEL: Record<ShiftType, string> = {
    ON_CALL:   'On Call',
    MORNING:   'Morning',
    GENERAL:   'General',
    AFTERNOON: 'Afternoon',
    NIGHT:     'Night',
}

const SHIFT_CLS: Record<ShiftType, string> = {
    ON_CALL:   'bg-slate-100 text-slate-600 dark:bg-[#222222] dark:text-[#888888]',
    MORNING:   'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    GENERAL:   'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    AFTERNOON: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
    NIGHT:     'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
}

interface StaffPayrow {
    staffId: string
    staffName: string
    role: string
    counts: Record<ShiftType, number>
    total: number
    gross: number
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const ALL_SHIFT_TYPES: ShiftType[] = ['ON_CALL','MORNING','GENERAL','AFTERNOON','NIGHT']

export default function Payroll() {
    const { user } = useAuth()
    const today = new Date()
    const [year, setYear]   = useState(today.getFullYear())
    const [month, setMonth] = useState(today.getMonth() + 1)
    const [shifts, setShifts] = useState<StaffShift[]>([])
    const [loading, setLoading] = useState(true)

    const fetchShifts = useCallback(async () => {
        if (!user?.hospitalId) return
        setLoading(true)
        try {
            const data = await shiftsApi.getMonth(user.hospitalId, year, month)
            setShifts(data)
        } catch {
            setShifts([])
        } finally {
            setLoading(false)
        }
    }, [user?.hospitalId, year, month])

    useEffect(() => { fetchShifts() }, [fetchShifts])

    const rows = useMemo<StaffPayrow[]>(() => {
        const map = new Map<string, StaffPayrow>()
        shifts.forEach(s => {
            if (!map.has(s.staffId)) {
                map.set(s.staffId, {
                    staffId: s.staffId,
                    staffName: s.staffName,
                    role: s.role,
                    counts: { ON_CALL: 0, MORNING: 0, GENERAL: 0, AFTERNOON: 0, NIGHT: 0 },
                    total: 0,
                    gross: 0,
                })
            }
            const row = map.get(s.staffId)!
            row.counts[s.shiftType]++
            row.total++
            row.gross += SHIFT_RATE[s.shiftType]
        })
        return Array.from(map.values()).sort((a, b) => b.gross - a.gross)
    }, [shifts])

    const totalGross = rows.reduce((acc, r) => acc + r.gross, 0)
    const totalShifts = rows.reduce((acc, r) => acc + r.total, 0)

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Payroll Summary</h1>
                    <p className="text-sm text-slate-500 dark:text-[#666666] mt-0.5">
                        {MONTH_NAMES[month - 1]} {year} · {totalShifts} shifts recorded
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-[#888888] dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold text-slate-700 dark:text-[#cccccc] min-w-[100px] text-center">
                        {MONTH_NAMES[month - 1]} {year}
                    </span>
                    <button onClick={nextMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-[#888888] dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-xs font-semibold text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors">
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider mb-1">Total Payroll</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-[#f0f0f0]">₹{totalGross.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider mb-1">Total Shifts</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalShifts}</p>
                </div>
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider mb-1">Staff Active</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{rows.length}</p>
                </div>
            </div>

            {/* Payroll table */}
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl overflow-hidden">

                {/* Column headers */}
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 px-6 py-3 border-b border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0d0d0d]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555]">Staff</p>
                    {ALL_SHIFT_TYPES.map(t => (
                        <p key={t} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555] text-center">{SHIFT_LABEL[t]}</p>
                    ))}
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555] text-right">Gross Pay</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 dark:text-[#555555]">
                        <Users className="w-10 h-10 opacity-30" />
                        <p className="text-sm">No shift data for this month</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">
                        {rows.map(row => (
                            <div
                                key={row.staffId}
                                className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-[#151515] transition-colors md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1.2fr] md:gap-3 md:items-center space-y-2 md:space-y-0"
                            >
                                {/* Staff info */}
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-[#dddddd] leading-tight">{row.staffName}</p>
                                    <p className="text-xs text-slate-400 dark:text-[#555555] mt-0.5">{row.role}</p>
                                </div>

                                {/* Shift counts per type */}
                                {ALL_SHIFT_TYPES.map(t => (
                                    <div key={t} className="flex items-center justify-center">
                                        {row.counts[t] > 0 ? (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${SHIFT_CLS[t]}`}>
                                                {row.counts[t]}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 dark:text-[#444444] text-xs">—</span>
                                        )}
                                    </div>
                                ))}

                                {/* Gross pay */}
                                <div className="md:text-right">
                                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        ₹{row.gross.toLocaleString('en-IN')}
                                    </p>
                                    <p className="text-[10px] text-slate-400 dark:text-[#555555] mt-0.5">
                                        {row.total} shift{row.total !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer totals */}
                {!loading && rows.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-200 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0d0d0d] md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1.2fr] md:gap-3 md:items-center">
                        <p className="text-xs font-bold text-slate-500 dark:text-[#666666] uppercase tracking-wide">Total</p>
                        {ALL_SHIFT_TYPES.map(t => (
                            <div key={t} className="flex items-center justify-center">
                                <span className="text-xs font-bold text-slate-600 dark:text-[#aaaaaa]">
                                    {rows.reduce((acc, r) => acc + r.counts[t], 0) || '—'}
                                </span>
                            </div>
                        ))}
                        <div className="md:text-right">
                            <p className="text-sm font-bold text-slate-900 dark:text-[#f0f0f0]">
                                ₹{totalGross.toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Rate reference */}
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 dark:text-[#555555] uppercase tracking-wider mb-3">Shift Rates (per shift)</p>
                <div className="flex flex-wrap gap-3">
                    {ALL_SHIFT_TYPES.map(t => (
                        <div key={t} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${SHIFT_CLS[t]}`}>
                            <span className="font-semibold">{SHIFT_LABEL[t]}</span>
                            <span className="font-bold">₹{SHIFT_RATE[t]}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
