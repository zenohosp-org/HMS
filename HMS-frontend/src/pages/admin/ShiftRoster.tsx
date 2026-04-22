import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { shiftsApi, staffApi, doctorsApi, type StaffShift, type StaffUser, type DoctorUser } from '@/utils/api'
import { ChevronLeft, ChevronRight, Loader2, Plus, X, Users } from 'lucide-react'

type ShiftType = StaffShift['shiftType']

const SHIFTS: { type: ShiftType; label: string; time: string; textCls: string; badgeCls: string }[] = [
    { type: 'ON_CALL',   label: 'On Call',   time: '00:00–23:59',
      textCls:  'text-slate-600 dark:text-[#aaaaaa]',
      badgeCls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#aaaaaa] dark:border-[#333333]' },
    { type: 'MORNING',   label: 'Morning',   time: '06:00–14:00',
      textCls:  'text-amber-600 dark:text-amber-400',
      badgeCls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
    { type: 'GENERAL',   label: 'General',   time: '09:00–17:00',
      textCls:  'text-blue-600 dark:text-blue-400',
      badgeCls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' },
    { type: 'AFTERNOON', label: 'Afternoon', time: '14:00–22:00',
      textCls:  'text-orange-600 dark:text-orange-400',
      badgeCls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20' },
    { type: 'NIGHT',     label: 'Night',     time: '22:00–06:00',
      textCls:  'text-violet-600 dark:text-violet-400',
      badgeCls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20' },
]

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getMondayOf(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
    d.setHours(0, 0, 0, 0)
    return d
}

function addDays(date: Date, n: number): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    return d
}

function toISODate(d: Date): string {
    return d.toISOString().split('T')[0]
}

interface StaffOption {
    id: string
    name: string
    roleDisplay: string
    designation?: string
    specialization?: string
    group: string
    avatarCls: string
}

function getAvatarCls(role: string): string {
    if (role === 'doctor') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
    if (role === 'hospital_admin') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
    if (role === 'technician') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
    return 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
}

function getInitials(name: string): string {
    const parts = name.trim().split(' ')
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

export default function ShiftRoster() {
    const { user } = useAuth()
    const { notify } = useNotification()

    const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
    const [shifts, setShifts] = useState<StaffShift[]>([])
    const [loading, setLoading] = useState(true)
    const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])

    const [popover, setPopover] = useState<{ staffId: string; date: string } | null>(null)
    const [selectedShift, setSelectedShift] = useState<ShiftType>('GENERAL')
    const [assigning, setAssigning] = useState(false)
    const popoverRef = useRef<HTMLDivElement>(null)

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const todayStr = toISODate(new Date())

    // Close popover on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setPopover(null)
            }
        }
        if (popover) document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [popover])

    const loadStaff = useCallback(async () => {
        if (!user?.hospitalId) return
        const [allUsers, doctors] = await Promise.all([
            staffApi.list(user.hospitalId),
            doctorsApi.list(user.hospitalId),
        ])
        const doctorMap = new Map(doctors.map((d: DoctorUser) => [d.userId, d]))
        const options: StaffOption[] = []
        allUsers.forEach((u: StaffUser) => {
            if (u.role === 'super_admin') return
            const doc = doctorMap.get(u.id)
            const role = u.role?.toLowerCase() ?? 'staff'
            let group: string
            if (doc) {
                group = doc.specialization ?? 'General Physician'
            } else if (role === 'hospital_admin') {
                group = 'Administration'
            } else if (role === 'technician') {
                group = 'Technicians'
            } else {
                group = u.designation ?? 'Staff'
            }
            options.push({
                id: u.id,
                name: `${u.firstName} ${u.lastName ?? ''}`.trim(),
                roleDisplay: doc ? 'Doctor' : (u.roleDisplay ?? u.role),
                designation: doc ? (doc.qualification ?? undefined) : (u.designation ?? undefined),
                specialization: doc?.specialization ?? undefined,
                group,
                avatarCls: getAvatarCls(role),
            })
        })
        setStaffOptions(options)
    }, [user?.hospitalId])

    const fetchShifts = useCallback(async () => {
        if (!user?.hospitalId) return
        setLoading(true)
        try {
            const data = await shiftsApi.getWeek(user.hospitalId, toISODate(weekStart))
            setShifts(data)
        } catch {
            setShifts([])
        } finally {
            setLoading(false)
        }
    }, [user?.hospitalId, weekStart])

    useEffect(() => { loadStaff() }, [loadStaff])
    useEffect(() => { fetchShifts() }, [fetchShifts])

    // Group staff by group label, preserving insertion order
    const groups = Array.from(
        staffOptions.reduce((map, s) => {
            const list = map.get(s.group) ?? []
            list.push(s)
            map.set(s.group, list)
            return map
        }, new Map<string, StaffOption[]>())
    )

    const getShiftsFor = (staffId: string, date: string) =>
        shifts.filter(s => s.staffId === staffId && s.shiftDate === date)

    const openPopover = (staffId: string, date: string) => {
        setSelectedShift('GENERAL')
        setPopover({ staffId, date })
    }

    const handleAssign = async () => {
        if (!popover || !user?.hospitalId) return
        setAssigning(true)
        try {
            await shiftsApi.assign({
                staffId: popover.staffId,
                hospitalId: user.hospitalId,
                shiftType: selectedShift,
                shiftDate: popover.date,
            })
            notify('Shift assigned', 'success')
            setPopover(null)
            fetchShifts()
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            notify(msg ?? 'Could not assign shift', 'error')
        } finally {
            setAssigning(false)
        }
    }

    const handleRemove = async (shiftId: number) => {
        try {
            await shiftsApi.remove(shiftId)
            notify('Shift removed', 'info')
            fetchShifts()
        } catch {
            notify('Could not remove shift', 'error')
        }
    }

    const weekLabel = `${weekDays[0].getDate()} ${weekDays[0].toLocaleString('en-IN', { month: 'short' })} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleString('en-IN', { month: 'short' })}, ${weekDays[0].getFullYear()}`

    return (
        <div className="space-y-4">

            {/* ── Top nav card ── */}
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl px-5 py-3 flex items-center gap-4">
                {/* Week nav */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={() => setWeekStart(w => addDays(w, -7))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setWeekStart(getMondayOf(new Date()))}
                        className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setWeekStart(w => addDays(w, 7))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Date range */}
                <div className="flex-1 text-center">
                    <p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">{weekLabel}</p>
                </div>

                {/* Shift legend pills */}
                <div className="flex items-center gap-2 shrink-0">
                    {SHIFTS.map(s => (
                        <span key={s.type} className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.badgeCls}`}>
                            {s.label}
                            <span className="text-[10px] font-normal opacity-70">{s.time}</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Groups ── */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
            ) : staffOptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400 dark:text-[#555555]">
                    <Users className="w-10 h-10 opacity-30" />
                    <p className="text-sm">No staff members found</p>
                </div>
            ) : (
                groups.map(([groupName, members]) => (
                    <div key={groupName} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl overflow-hidden">

                        {/* Group header */}
                        <div className="px-5 py-3 border-b border-slate-100 dark:border-[#1e1e1e]">
                            <p className="text-sm font-bold text-slate-700 dark:text-[#cccccc]">
                                {groupName}
                                <span className="ml-2 text-xs font-normal text-slate-400 dark:text-[#666666]">
                                    ({members.length} staff)
                                </span>
                            </p>
                        </div>

                        {/* Group table */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px]">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                                        <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555] w-52">
                                            Employee
                                        </th>
                                        {weekDays.map(d => {
                                            const ds = toISODate(d)
                                            const isToday = ds === todayStr
                                            return (
                                                <th
                                                    key={ds}
                                                    className={`text-center px-3 py-2.5 text-[11px] font-semibold w-24
                                                        ${isToday
                                                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                            : 'text-slate-500 dark:text-[#888888]'
                                                        }`}
                                                >
                                                    <div className="uppercase tracking-wide text-[10px]">{DAY_SHORT[d.getDay()]}</div>
                                                    <div className={`text-base font-bold mt-0.5 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-[#aaaaaa]'}`}>
                                                        {d.getDate()}
                                                    </div>
                                                    <div className="text-[10px] font-normal opacity-70 mt-0.5">
                                                        {d.toLocaleString('en-IN', { month: 'short' })}
                                                    </div>
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">
                                    {members.map(staff => (
                                        <tr key={staff.id}>
                                            {/* Staff info */}
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${staff.avatarCls}`}>
                                                        {getInitials(staff.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd] leading-tight truncate">
                                                            {staff.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 dark:text-[#555555] mt-0.5 truncate">
                                                            {staff.designation ?? staff.roleDisplay}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Day cells */}
                                            {weekDays.map(d => {
                                                const dateStr = toISODate(d)
                                                const isToday = dateStr === todayStr
                                                const dayShifts = getShiftsFor(staff.id, dateStr)
                                                const isOpen = popover?.staffId === staff.id && popover?.date === dateStr
                                                return (
                                                    <td
                                                        key={dateStr}
                                                        className={`px-2 py-2.5 align-middle relative ${isToday ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}
                                                    >
                                                        {dayShifts.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {dayShifts.map(s => {
                                                                    const meta = SHIFTS.find(x => x.type === s.shiftType)!
                                                                    return (
                                                                        <div
                                                                            key={s.id}
                                                                            className={`group flex items-center justify-between gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border ${meta.badgeCls}`}
                                                                        >
                                                                            <span>{meta.label}</span>
                                                                            <button
                                                                                onClick={() => handleRemove(s.id)}
                                                                                className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity shrink-0"
                                                                                title="Remove"
                                                                            >
                                                                                <X className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => openPopover(staff.id, dateStr)}
                                                                className="w-full h-9 flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-[#2a2a2a] text-slate-300 dark:text-[#444444] hover:border-blue-300 dark:hover:border-blue-500/40 hover:text-blue-400 dark:hover:text-blue-400 transition-colors"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}

                                                        {/* Popover — rendered inside the cell, stopPropagation on the popover itself */}
                                                        {isOpen && (
                                                            <div
                                                                ref={popoverRef}
                                                                className="absolute left-0 top-full z-40 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl shadow-xl w-56 overflow-hidden"
                                                                onMouseDown={e => e.stopPropagation()}
                                                            >
                                                                <div className="px-4 py-3 border-b border-slate-100 dark:border-[#2a2a2a]">
                                                                    <p className="text-xs font-bold text-slate-700 dark:text-[#cccccc]">Assign Shift</p>
                                                                </div>
                                                                <div className="p-1.5 space-y-0.5">
                                                                    {SHIFTS.map(s => {
                                                                        const isSelected = selectedShift === s.type
                                                                        return (
                                                                            <button
                                                                                key={s.type}
                                                                                type="button"
                                                                                onMouseDown={e => {
                                                                                    e.stopPropagation()
                                                                                    setSelectedShift(s.type)
                                                                                }}
                                                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                                                                                    ${isSelected
                                                                                        ? `${s.badgeCls} border`
                                                                                        : 'text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#222222] border border-transparent'
                                                                                    }`}
                                                                            >
                                                                                <span className="font-semibold">{s.label}</span>
                                                                                <span className={`text-xs font-normal ${isSelected ? '' : 'opacity-50'}`}>{s.time}</span>
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>
                                                                <div className="px-3 pb-3">
                                                                    <button
                                                                        type="button"
                                                                        onMouseDown={e => e.stopPropagation()}
                                                                        onClick={handleAssign}
                                                                        disabled={assigning}
                                                                        className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                                                                    >
                                                                        {assigning ? 'Assigning…' : 'Confirm'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}
