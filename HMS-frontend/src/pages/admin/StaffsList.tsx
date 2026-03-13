import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { staffApi, type StaffUser } from '@/utils/api'
import StaffFormModal from '@/components/modals/StaffFormModal'
import { ClipboardList, Mail, Phone, Building2 } from 'lucide-react'

export default function StaffsList() {
    const { user } = useAuth()
    const { notify } = useNotification()
    const navigate = useNavigate()
    const [staffs, setStaffs] = useState<StaffUser[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editStaff, setEditStaff] = useState<StaffUser | undefined>(undefined)

    const load = () => {
        if (!user?.hospitalId) return
        staffApi.list(user.hospitalId)
            .then(users => {
                // Filter out DOCTORS from this view to maintain separation of concerns
                setStaffs(users.filter(u => u.role !== 'DOCTOR' && u.role !== 'SUPER_ADMIN'))
            })
            .catch(() => notify('Failed to load staff list', 'error'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [user?.hospitalId])

    const handleDeactivate = async (id: string) => {
        if (!confirm('Deactivate this staff account? They will lose system access.')) return
        await staffApi.deactivate(id)
        notify('Account deactivated', 'info')
        load()
    }

    const handleActivate = async (id: string) => {
        if (!confirm('Reactivate this staff account?')) return
        await staffApi.activate(id)
        notify('Account activated', 'success')
        load()
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0] flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-violet-500" /> Staff Management
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-[#666666]">{staffs.length} non-clinical staff accounts</p>
                </div>
                <button className="btn-primary" onClick={() => {
                    setEditStaff(undefined)
                    setShowModal(true)
                }}>+ Add Staff</button>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center">
                        <p className="text-slate-500 dark:text-[#666666]">Loading staff records…</p>
                    </div>
                ) : staffs.length === 0 ? (
                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center">
                        <p className="text-slate-500 dark:text-[#666666]">No staff accounts found.</p>
                    </div>
                ) : (
                    staffs.map(s => {
                        const initials = `${s.firstName[0]}${s.lastName?.[0] ?? ''}`.toUpperCase()
                        return (
                            <div key={s.id}
                                className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4 
                                flex items-center justify-between hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 
                                        flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-400 shrink-0">
                                        {initials}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p
                                                className="text-sm font-bold leading-tight text-slate-900 dark:text-white cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                                                onClick={() => {
                                                    setEditStaff(s)
                                                    setShowModal(true)
                                                }}
                                            >
                                                {s.firstName} {s.lastName}
                                            </p>
                                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200 dark:bg-[#1a1a1a] dark:text-[#888888] dark:border-[#333333]">
                                                {s.roleDisplay}
                                            </span>
                                            {!s.isActive && (
                                                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-[#666666] mt-1.5">
                                            <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {s.email}</div>
                                            {s.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {s.phone}</div>}
                                            {s.employeeCode && <div className="flex items-center gap-1 font-mono bg-slate-100 dark:bg-[#222222] px-1 rounded">#{s.employeeCode}</div>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden md:block">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">{s.designation || 'Staff'}</p>
                                        <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">Joined: {s.dateOfJoining || 'Unknown'}</p>
                                    </div>

                                    {s.isActive ? (
                                        <button
                                            onClick={() => handleDeactivate(s.id)}
                                            className="btn-secondary text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
                                        >
                                            Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleActivate(s.id)}
                                            className="btn-secondary text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                                        >
                                            Activate
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {showModal && (
                <StaffFormModal
                    editStaff={editStaff}
                    onClose={() => setShowModal(false)}
                    onSaved={() => {
                        setShowModal(false)
                        load()
                    }}
                />
            )}
        </div>
    )
}
