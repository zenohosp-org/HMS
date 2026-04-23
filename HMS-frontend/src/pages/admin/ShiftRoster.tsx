import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { shiftsApi, staffApi, doctorsApi, type StaffShift, type StaffUser, type DoctorUser } from '@/utils/api'
import Pagination from '@/components/ui/Pagination'
import { ChevronLeft, ChevronRight, Loader2, Plus, X, Users } from 'lucide-react'

const GROUP_PAGE_SIZE = 5

type ShiftType = StaffShift['shiftType']

const SHIFTS: { type: ShiftType; label: string; time: string; dot: string; textCls: string; badgeCls: string }[] = [
    { type: 'ON_CALL',   label: 'On Call',   time: '00:00–23:59', dot: 'bg-slate-400',
      textCls:  'text-slate-600 dark:text-[#aaaaaa]',
      badgeCls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#aaaaaa] dark:border-[#333333]' },
    { type: 'MORNING',   label: 'Morning',   time: '06:00–14:00', dot: 'bg-amber-400',
      textCls:  'text-amber-600 dark:text-amber-400',
      badgeCls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
    { type: 'GENERAL',   label: 'General',   time: '09:00–17:00', dot: 'bg-blue-400',
      textCls:  'text-blue-600 dark:text-blue-400',
      badgeCls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' },
    { type: 'AFTERNOON', label: 'Afternoon', time: '14:00–22:00', dot: 'bg-orange-400',
      textCls:  'text-orange-600 dark:text-orange-400',
      badgeCls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20' },
    { type: 'NIGHT',     label: 'Night',     time: '22:00–06:00', dot: 'bg-violet-400',
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

    const [groupPages, setGroupPages] = useState<Record<string, number>>({})
    const [popover, setPopover] = useState<{
        staffId: string; date: string;
        x: number; y: number; flipUp: boolean
    } | null>(null)
    const [assigningKey, setAssigningKey] = useState<string | null>(null)
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

    const openPopover = (staffId: string, date: string, triggerEl: HTMLButtonElement) => {
        const rect = triggerEl.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const flipUp = spaceBelow < 260
        setPopover({
            staffId,
            date,
            x: rect.left,
            y: flipUp ? rect.top : rect.bottom,
            flipUp,
        })
    }

    // Single-click assigns immediately — no confirm step
    const handleAssign = async (shiftType: ShiftType) => {
        if (!popover || !user?.hospitalId) return
        const key = `${popover.staffId}|${popover.date}`
        setAssigningKey(key)
        setPopover(null)
        try {
            await shiftsApi.assign({
                staffId: popover.staffId,
                hospitalId: user.hospitalId,
                shiftType,
                shiftDate: popover.date,
            })
            fetchShifts()
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            notify(msg ?? 'Could not assign shift', 'error')
        } finally {
            setAssigningKey(null)
        }
    }

    const handleRemove = async (shiftId: number) => {
        try {
            await shiftsApi.remove(shiftId)
            fetchShifts()
        } catch {
            notify('Could not remove shift', 'error')
        }
    }

    const weekLabel = `${weekDays[0].getDate()} ${weekDays[0].toLocaleString('en-IN', { month: 'short' })} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleString('en-IN', { month: 'short' })}, ${weekDays[0].getFullYear()}`

    return (
        <>
        <div className="space-y-3">

            {/* ── Top nav card ── */}
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl px-4 py-3 flex items-center gap-3">
                {/* Week nav */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => setWeekStart(w => addDays(w, -7))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setWeekStart(getMondayOf(new Date()))}
                        className="px-3 h-7 text-xs font-semibold rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setWeekStart(w => addDays(w, 7))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Date range */}
                <p className="flex-1 text-center text-sm font-bold text-slate-800 dark:text-[#dddddd]">{weekLabel}</p>

                {/* Compact shift legend */}
                <div className="flex items-center gap-3 shrink-0">
                    {SHIFTS.map(s => (
                        <span key={s.type} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-[#888888]">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                            {s.label}
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
                groups.map(([groupName, members]) => {
                    const gPage = groupPages[groupName] ?? 1
                    const totalGroupPages = Math.ceil(members.length / GROUP_PAGE_SIZE)
                    const visibleMembers = members.slice((gPage - 1) * GROUP_PAGE_SIZE, gPage * GROUP_PAGE_SIZE)
                    const setGPage = (p: number) => setGroupPages(prev => ({ ...prev, [groupName]: p }))

                    return (
                    <div key={groupName} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl overflow-visible">

                        {/* Group header */}
                        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wide">
                                {groupName}
                                <span className="ml-2 font-normal text-slate-400 dark:text-[#666666] normal-case">
                                    {members.length} {members.length === 1 ? 'member' : 'members'}
                                </span>
                            </p>
                            {totalGroupPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setGPage(Math.max(1, gPage - 1))}
                                        disabled={gPage === 1}
                                        className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-[#2a2a2a] text-slate-400 dark:text-[#666666] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-3 h-3" />
                                    </button>
                                    <span className="text-[11px] text-slate-400 dark:text-[#666666] px-1">
                                        {gPage}/{totalGroupPages}
                                    </span>
                                    <button
                                        onClick={() => setGPage(Math.min(totalGroupPages, gPage + 1))}
                                        disabled={gPage === totalGroupPages}
                                        className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-[#2a2a2a] text-slate-400 dark:text-[#666666] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Group table */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px]">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                                        <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555] w-48">
                                            Employee
                                        </th>
                                        {weekDays.map(d => {
                                            const ds = toISODate(d)
                                            const isToday = ds === todayStr
                                            return (
                                                <th
                                                    key={ds}
                                                    className={`text-center px-2 py-2 text-[11px] font-semibold w-24
                                                        ${isToday
                                                            ? 'bg-blue-50 dark:bg-blue-500/10'
                                                            : ''
                                                        }`}
                                                >
                                                    <div className={`text-[10px] uppercase tracking-wide ${isToday ? 'text-blue-500' : 'text-slate-400 dark:text-[#666666]'}`}>
                                                        {DAY_SHORT[d.getDay()]}
                                                    </div>
                                                    <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-[#aaaaaa]'}`}>
                                                        {d.getDate()}
                                                    </div>
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                                    {visibleMembers.map(staff => (
                                        <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-[#0f0f0f] transition-colors">
                                            {/* Staff info */}
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${staff.avatarCls}`}>
                                                        {getInitials(staff.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd] leading-tight truncate">
                                                            {staff.name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 dark:text-[#555555] truncate">
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
                                                const cellKey = `${staff.id}|${dateStr}`
                                                const isAssigning = assigningKey === cellKey
                                                const isOpen = popover?.staffId === staff.id && popover?.date === dateStr
                                                return (
                                                    <td
                                                        key={dateStr}
                                                        className={`px-1.5 py-2 align-top relative ${isToday ? 'bg-blue-50/40 dark:bg-blue-500/5' : ''}`}
                                                    >
                                                        <div className="min-h-[52px] flex flex-col gap-0.5">
                                                        {isAssigning ? (
                                                            <div className="flex-1 flex items-center justify-center rounded-lg border border-slate-100 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#0f0f0f]">
                                                                <Loader2 className="w-3 h-3 animate-spin text-slate-300" />
                                                            </div>
                                                        ) : dayShifts.length > 0 ? (
                                                            <>
                                                                {dayShifts.map(s => {
                                                                    const meta = SHIFTS.find(x => x.type === s.shiftType)!
                                                                    return (
                                                                        <div
                                                                            key={s.id}
                                                                            className={`group flex items-center justify-between gap-1 text-[11px] font-semibold px-2 py-1.5 rounded-lg border ${meta.badgeCls}`}
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
                                                                <button
                                                                    onClick={e => openPopover(staff.id, dateStr, e.currentTarget)}
                                                                    className="w-full py-1 flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-[#2a2a2a] text-slate-300 dark:text-[#3a3a3a] hover:border-blue-300 dark:hover:border-blue-500/40 hover:text-blue-400 transition-colors"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={e => openPopover(staff.id, dateStr, e.currentTarget)}
                                                                className="flex-1 flex items-center justify-center rounded-lg border border-slate-100 dark:border-[#1e1e1e] bg-slate-50/60 dark:bg-[#0d0d0d] text-slate-300 dark:text-[#333333] hover:border-blue-200 dark:hover:border-blue-500/30 hover:bg-blue-50/40 dark:hover:bg-blue-500/5 hover:text-blue-400 transition-colors"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        </div>

                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )
                })
            )}
        </div>

        {/* Shift popover — portal so it floats above overflow-clipped table */}
        {popover && createPortal(
            <div
                ref={popoverRef}
                style={{
                    position: 'fixed',
                    left: popover.x,
                    ...(popover.flipUp
                        ? { bottom: window.innerHeight - popover.y + 4 }
                        : { top: popover.y + 4 }),
                }}
                className="z-[9999] bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#333333] rounded-xl shadow-2xl w-52 overflow-hidden"
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="px-3 py-2.5 border-b border-slate-100 dark:border-[#2a2a2a]">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Assign Shift</p>
                </div>
                <div className="p-1">
                    {SHIFTS.map(s => (
                        <button
                            key={s.type}
                            type="button"
                            onMouseDown={e => { e.stopPropagation(); handleAssign(s.type) }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-[#252525] transition-colors"
                        >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                            <span className="text-sm font-medium text-slate-700 dark:text-[#cccccc] flex-1">{s.label}</span>
                            <span className="text-[10px] text-slate-400 dark:text-[#555555]">{s.time}</span>
                        </button>
                    ))}
                </div>
            </div>,
            document.body
        )}
        </>
    )
}
