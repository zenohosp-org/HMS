import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { shiftsApi, staffApi, doctorsApi, type StaffShift, type StaffUser, type DoctorUser } from '@/utils/api'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Users } from 'lucide-react'

type ShiftType = StaffShift['shiftType']

const SHIFTS: { type: ShiftType; label: string; time: string; cls: string }[] = [
    { type: 'ON_CALL',   label: 'On Call',   time: '00:00–23:59', cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-[#222222] dark:text-[#aaaaaa] dark:border-[#333333]'       },
    { type: 'MORNING',   label: 'Morning',   time: '06:00–14:00', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
    { type: 'GENERAL',   label: 'General',   time: '09:00–17:00', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'       },
    { type: 'AFTERNOON', label: 'Afternoon', time: '14:00–22:00', cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20' },
    { type: 'NIGHT',     label: 'Night',     time: '22:00–06:00', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20' },
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getMondayOf(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
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

function formatDateLabel(d: Date): string {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface StaffOption { id: string; name: string; role: string }

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

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

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
            options.push({
                id: u.id,
                name: `${u.firstName} ${u.lastName ?? ''}`.trim(),
                role: doc ? 'Doctor' : u.roleDisplay,
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

    const getShiftsFor = (staffId: string, date: string) =>
        shifts.filter(s => s.staffId === staffId && s.shiftDate === date)

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
            fetchShifts()
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            notify(msg ?? 'Could not assign shift', 'error')
        } finally {
            setAssigning(false)
            setPopover(null)
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

    const weekLabel = `${formatDateLabel(weekDays[0])} – ${formatDateLabel(weekDays[6])}, ${weekDays[0].getFullYear()}`

    return (
        <div className="space-y-5" onClick={() => setPopover(null)}>

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Shift Roster</h1>
                    <p className="text-sm text-slate-500 dark:text-[#666666] mt-0.5">{weekLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setWeekStart(w => addDays(w, -7))}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-[#888888] dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setWeekStart(getMondayOf(new Date()))}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        This Week
                    </button>
                    <button
                        onClick={() => setWeekStart(w => addDays(w, 7))}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-[#888888] dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Shift legend */}
            <div className="flex flex-wrap gap-2">
                {SHIFTS.map(s => (
                    <div key={s.type} className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${s.cls}`}>
                        <span>{s.label}</span>
                        <span className="opacity-60 normal-case font-normal">{s.time}</span>
                    </div>
                ))}
            </div>

            {/* Calendar table */}
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                ) : staffOptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 dark:text-[#555555]">
                        <Users className="w-10 h-10 opacity-30" />
                        <p className="text-sm">No staff members found</p>
                    </div>
                ) : (
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-[#0d0d0d] border-b border-slate-100 dark:border-[#1e1e1e]">
                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555] w-44">
                                    Staff Member
                                </th>
                                {weekDays.map(d => {
                                    const today = toISODate(new Date()) === toISODate(d)
                                    return (
                                        <th key={toISODate(d)} className={`text-center px-2 py-3 text-[10px] font-bold uppercase tracking-widest ${today ? 'text-emerald-500' : 'text-slate-400 dark:text-[#555555]'}`}>
                                            <div>{DAY_NAMES[d.getDay()]}</div>
                                            <div className={`text-sm font-bold mt-0.5 ${today ? 'text-emerald-500' : 'text-slate-600 dark:text-[#aaaaaa]'}`}>
                                                {d.getDate()}
                                            </div>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">
                            {staffOptions.map(staff => (
                                <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-[#151515] transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd] leading-tight truncate max-w-[160px]">
                                            {staff.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400 dark:text-[#555555] mt-0.5">{staff.role}</p>
                                    </td>
                                    {weekDays.map(d => {
                                        const dateStr = toISODate(d)
                                        const dayShifts = getShiftsFor(staff.id, dateStr)
                                        return (
                                            <td key={dateStr} className="px-1.5 py-2 align-top">
                                                <div className="space-y-1 min-h-[40px]" onClick={e => e.stopPropagation()}>
                                                    {dayShifts.map(s => {
                                                        const meta = SHIFTS.find(x => x.type === s.shiftType)!
                                                        return (
                                                            <div
                                                                key={s.id}
                                                                className={`group flex items-center justify-between gap-1 text-[10px] font-bold px-2 py-1 rounded-md border ${meta.cls}`}
                                                            >
                                                                <span>{meta.label}</span>
                                                                <button
                                                                    onClick={() => handleRemove(s.id)}
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Remove shift"
                                                                >
                                                                    <Trash2 className="w-2.5 h-2.5" />
                                                                </button>
                                                            </div>
                                                        )
                                                    })}
                                                    <button
                                                        onClick={() => {
                                                            setPopover({ staffId: staff.id, date: dateStr })
                                                            setSelectedShift('GENERAL')
                                                        }}
                                                        className="w-full flex items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-[#2a2a2a] h-7 text-slate-300 dark:text-[#444444] hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>

                                                {/* Assign popover */}
                                                {popover?.staffId === staff.id && popover?.date === dateStr && (
                                                    <div className="absolute z-30 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl shadow-xl p-3 w-52">
                                                        <p className="text-xs font-bold text-slate-700 dark:text-[#cccccc] mb-2">Assign Shift</p>
                                                        <div className="space-y-1 mb-3">
                                                            {SHIFTS.map(s => (
                                                                <button
                                                                    key={s.type}
                                                                    onClick={() => setSelectedShift(s.type)}
                                                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                                                                        ${selectedShift === s.type ? s.cls : 'border-transparent text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#222222]'}`}
                                                                >
                                                                    <span>{s.label}</span>
                                                                    <span className="text-[10px] opacity-60 font-normal">{s.time}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <button
                                                            onClick={handleAssign}
                                                            disabled={assigning}
                                                            className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                                                        >
                                                            {assigning ? 'Assigning…' : 'Confirm'}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
