import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { doctorsApi, staffApi, type DoctorUser } from '@/utils/api'
import DoctorFormModal from '@/components/modals/DoctorFormModal'
import { MoreVertical, CheckCircle, XCircle, Trash2 } from 'lucide-react'

export default function DoctorsList() {
    const { user } = useAuth()
    const { notify } = useNotification()
    const navigate = useNavigate()
    const [doctors, setDoctors] = useState<DoctorUser[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

    const load = () => {
        if (!user?.hospitalId) return
        doctorsApi.list(user.hospitalId)
            .then(setDoctors)
            .catch(() => notify('Failed to load doctors', 'error'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [user?.hospitalId])

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    const handleDelete = async (id: string) => {

        if (!confirm('Remove this doctor profile? The linked user account will remain intact.')) return
        try {
            await doctorsApi.delete(id)
            notify('Doctor profile removed', 'success')
            load()
        } catch (error) {
            notify('Failed to remove doctor profile', 'error')
        }
    }

    const handleDeactivate = async (id: string) => {
        if (!confirm('Deactivate this doctor account? They will lose system access.')) return
        await staffApi.deactivate(id)
        notify('Account deactivated', 'info')
        load()
    }

    const handleActivate = async (id: string) => {
        if (!confirm('Reactivate this doctor account?')) return
        await staffApi.activate(id)
        notify('Account activated', 'success')
        load()
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Doctors</h1>
                    <p className="text-sm text-slate-500 dark:text-[#666666]">{doctors.length} doctors linked to this hospital</p>
                </div>
                <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Doctor</button>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center">
                        <p className="text-slate-500 dark:text-[#666666]">Loading…</p>
                    </div>
                ) : doctors.length === 0 ? (
                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center">
                        <p className="text-slate-500 dark:text-[#666666]">No doctors found for this hospital.</p>
                    </div>
                ) : (
                    doctors.map(d => {
                        const initials = `${d.firstName[0]}${d.lastName?.[0] ?? ''}`.toUpperCase()
                        return (
                            <div key={d.id}
                                className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4 
                                flex items-center justify-between hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 
                                        flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-400 shrink-0">
                                        {initials}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p
                                                className="text-sm font-bold leading-tight text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer underline-offset-2 hover:underline"
                                                onClick={() => navigate(`/doctors/${d.id}`)}
                                            >
                                                Dr. {d.firstName} {d.lastName}
                                            </p>
                                            {!d.userIsActive && (
                                                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                                                    User Inactive
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{d.email} • {d.phone}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block mr-4">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">{d.specialization || 'General'}</p>
                                        <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{d.qualification || 'N/A'}</p>
                                    </div>

                                    {/* 3-Dot Actions Menu */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setOpenMenuId(openMenuId === d.id ? null : d.id)
                                            }}
                                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-[#ffffff] dark:hover:bg-[#1e1e1e] transition-colors"
                                        >
                                            <MoreVertical className="w-5 h-5" />
                                        </button>

                                        {openMenuId === d.id && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-lg border border-slate-200 dark:border-[#2a2a2a] overflow-hidden z-10 py-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {d.userIsActive ? (
                                                    <button
                                                        onClick={() => { setOpenMenuId(null); handleDeactivate(d.userId) }}
                                                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-500/10 flex items-center gap-2"
                                                    >
                                                        <XCircle className="w-4 h-4" /> Deactivate Login
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => { setOpenMenuId(null); handleActivate(d.userId) }}
                                                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-500/10 flex items-center gap-2"
                                                    >
                                                        <CheckCircle className="w-4 h-4" /> Activate Login
                                                    </button>
                                                )}

                                                <div className="h-px bg-slate-100 dark:bg-[#2a2a2a] my-1" />

                                                <button
                                                    onClick={() => { setOpenMenuId(null); handleDelete(d.id) }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Remove Profile
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {showModal && (
                <DoctorFormModal onClose={() => setShowModal(false)} onSaved={() => {
                    setShowModal(false)
                    load()
                }} />
            )}
        </div>
    )
}
