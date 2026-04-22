import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { payrollApi, type StaffPayroll } from '@/utils/api'
import { Loader2, Search, Check, Clock, Edit2 } from 'lucide-react'
import ProcessSalaryModal from './ProcessSalaryModal'

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

function fmt(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function lastPaidLabel(staff: StaffPayroll): { text: string; paid: boolean } {
    if (!staff.lastPaidMonth || !staff.lastPaidYear) return { text: 'Not paid yet', paid: false }
    return {
        text: `Paid · ${MONTHS[staff.lastPaidMonth - 1]} ${staff.lastPaidYear}`,
        paid: true,
    }
}

export default function Payroll() {
    const { user } = useAuth()
    const { notify } = useNotification()

    const [staffList, setStaffList] = useState<StaffPayroll[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [savingId, setSavingId] = useState<string | null>(null)

    const [processTarget, setProcessTarget] = useState<StaffPayroll | null>(null)

    const load = useCallback(async () => {
        if (!user?.hospitalId) return
        setLoading(true)
        try {
            const data = await payrollApi.listStaff(user.hospitalId)
            setStaffList(data)
        } catch {
            notify('Failed to load payroll data', 'error')
        } finally {
            setLoading(false)
        }
    }, [user?.hospitalId])

    useEffect(() => { load() }, [load])

    const filtered = staffList.filter(s =>
        s.staffName.toLowerCase().includes(search.toLowerCase()) ||
        s.role.toLowerCase().includes(search.toLowerCase()) ||
        (s.department ?? '').toLowerCase().includes(search.toLowerCase())
    )

    const totalPayroll = staffList.reduce((sum, s) => sum + (s.basicSalary ?? 0), 0)
    const totalStaff = staffList.length
    const paidThisMonth = staffList.filter(s => {
        const now = new Date()
        return s.lastPaidMonth === now.getMonth() + 1 && s.lastPaidYear === now.getFullYear()
    }).length

    const startEdit = (s: StaffPayroll) => {
        setEditingId(s.staffId)
        setEditValue(String(s.basicSalary ?? 0))
    }

    const saveSalary = async (s: StaffPayroll) => {
        if (!user?.hospitalId) return
        const val = parseFloat(editValue)
        if (isNaN(val) || val < 0) { notify('Invalid salary amount', 'error'); return }
        setSavingId(s.staffId)
        try {
            await payrollApi.updateSalary(s.staffId, user.hospitalId, val)
            setStaffList(prev => prev.map(x => x.staffId === s.staffId ? { ...x, basicSalary: val } : x))
            setEditingId(null)
        } catch {
            notify('Failed to update salary', 'error')
        } finally {
            setSavingId(null)
        }
    }

    const roleColor: Record<string, string> = {
        DOCTOR: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
        HOSPITAL_ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
        TECHNICIAN: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
        STAFF: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
    }

    return (
        <div className="space-y-4">

            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Payroll</h1>
                <p className="text-sm text-slate-400 dark:text-[#666666] mt-0.5">Manage staff salaries and process payments</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider">Total Base Payroll</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fmt(totalPayroll)}</p>
                    <p className="text-[11px] text-slate-400 dark:text-[#555555] mt-0.5">per month</p>
                </div>
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider">Total Staff</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalStaff}</p>
                    <p className="text-[11px] text-slate-400 dark:text-[#555555] mt-0.5">on payroll</p>
                </div>
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider">Paid This Month</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{paidThisMonth}</p>
                    <p className="text-[11px] text-slate-400 dark:text-[#555555] mt-0.5">of {totalStaff} staff</p>
                </div>
            </div>

            {/* Table card */}
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl overflow-hidden">

                {/* Toolbar */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
                    <p className="text-sm font-bold text-slate-800 dark:text-[#dddddd] shrink-0">Payroll Table</p>
                    <div className="flex-1" />
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#dddddd] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                            placeholder="Search by name or role…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center text-sm text-slate-400 dark:text-[#555555]">No staff found</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555555] w-10">#</th>
                                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555555]">Name</th>
                                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555555]">Role</th>
                                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555555]">Department</th>
                                <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555555]">Basic Salary</th>
                                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555555]">Last Paid Status</th>
                                <th className="text-right px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555555]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                            {filtered.map((s, i) => {
                                const { text: paidText, paid } = lastPaidLabel(s)
                                const roleBadge = roleColor[s.role.toUpperCase()] ?? roleColor.STAFF
                                const isEditing = editingId === s.staffId
                                const isSaving = savingId === s.staffId

                                return (
                                    <tr key={s.staffId} className="hover:bg-slate-50/50 dark:hover:bg-[#0f0f0f] transition-colors">
                                        <td className="px-5 py-3.5 text-sm text-slate-400 dark:text-[#555555]">{i + 1}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{s.staffName}</p>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${roleBadge}`}>
                                                {s.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-[#888888]">
                                            {s.department ?? '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <input
                                                        autoFocus
                                                        type="number"
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') saveSalary(s)
                                                            if (e.key === 'Escape') setEditingId(null)
                                                        }}
                                                        className="w-32 text-right px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-500/40 bg-white dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    />
                                                    <button
                                                        onClick={() => saveSalary(s)}
                                                        disabled={isSaving}
                                                        className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                                                    >
                                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors text-xs"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">
                                                        {fmt(s.basicSalary ?? 0)}
                                                    </span>
                                                    <button
                                                        onClick={() => startEdit(s)}
                                                        className="p-1 rounded text-slate-300 dark:text-[#444444] hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                                        title="Edit salary"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                {paid
                                                    ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                    : <Clock className="w-3.5 h-3.5 text-slate-300 dark:text-[#444444] shrink-0" />
                                                }
                                                <span className={`text-xs font-medium ${paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-[#555555]'}`}>
                                                    {paidText}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                onClick={() => setProcessTarget(s)}
                                                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors"
                                            >
                                                Process Salary
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {processTarget && (
                <ProcessSalaryModal
                    staff={processTarget}
                    onClose={() => setProcessTarget(null)}
                    onProcessed={() => { setProcessTarget(null); load() }}
                />
            )}
        </div>
    )
}
