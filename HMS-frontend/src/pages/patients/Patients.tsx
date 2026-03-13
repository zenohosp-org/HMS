import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { patientApi, type Patient } from '@/utils/api'
import PatientModal from '@/components/modals/PatientModal'
import { calcAge, formatDate } from '@/utils/validators'

export default function Patients() {
    const { user } = useAuth()
    const { notify } = useNotification()
    const navigate = useNavigate()
    const location = useLocation()
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modal, setModal] = useState<{ open: boolean; patient: Patient | null }>
        ({ open: false, patient: null })

    const load = () => {
        if (!user?.hospitalId) return
        patientApi.list(user.hospitalId)
            .then(setPatients)
            .catch(() => notify('Failed to load patients', 'error'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [user?.hospitalId])

    useEffect(() => {
        if (location.state?.openRegistration) {
            setModal({ open: true, patient: null })
            // Clear the state so it doesn't re-open on refresh or navigation
            navigate(location.pathname, { replace: true, state: {} })
        }
    }, [location.state])

    const handleSave = async (data: Partial<Patient>) => {
        if (modal.patient) {
            await patientApi.update(modal.patient.id, data)
            notify('Patient updated', 'success')
        } else {
            await patientApi.create({ ...data, hospitalId: user!.hospitalId! })
            notify('Patient registered', 'success')
        }
        setModal({ open: false, patient: null })
        load()
    }

    const filtered = patients.filter(p => {
        const q = search.toLowerCase()
        return (
            p.firstName.toLowerCase().includes(q) ||
            p.lastName.toLowerCase().includes(q) ||
            p.mrn.toLowerCase().includes(q) ||
            (p.phone ?? '').includes(q)
        )
    })

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Patients</h1>
                    <p className="text-sm text-slate-500 dark:text-[#666666]">{patients.length} registered patients</p>
                </div>
                <button className="btn-primary" onClick={() => setModal({ open: true, patient: null })}>
                    + Register Patient
                </button>
            </div>

            {/* Search */}
            <input
                className="w-full sm:max-w-sm px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] 
                    bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] placeholder:text-slate-400 dark:placeholder:text-[#555555]
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Search by name, MRN or phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />

            {/* Separated Rows Layout */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center">
                        <p className="text-slate-500 dark:text-[#666666]">Loading…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center">
                        <p className="text-slate-500 dark:text-[#666666]">
                            {search ? 'No patients match your search.' : 'No patients registered yet.'}
                        </p>
                    </div>
                ) : (
                    filtered.map(p => {
                        const initials = `${p.firstName[0]}${p.lastName?.[0] ?? ''}`.toUpperCase()
                        return (
                            <div key={p.id}
                                onClick={() => navigate(`/patients/${p.id}`)}
                                className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4 
                                flex items-center justify-between hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2a2a2a] 
                                        flex items-center justify-center text-sm font-bold text-slate-700 dark:text-[#cccccc] shrink-0">
                                        {initials}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                                {p.firstName} {p.lastName}
                                            </p>
                                            <span className="text-xs text-slate-400 dark:text-[#555555] px-1.5 py-0.5 rounded bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a]">
                                                {p.mrn}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs text-slate-500 dark:text-[#666666]">{calcAge(p.dob)}y / {p.gender}</p>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#333333]"></span>
                                            <p className="text-xs text-slate-500 dark:text-[#666666]">{p.phone ?? 'No Phone'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-slate-500 dark:text-[#666666]">Registered</p>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-[#cccccc] mt-0.5">{formatDate(p.createdAt)}</p>
                                    </div>

                                    <div className="shrink-0 w-12 flex justify-end">
                                        {p.bloodGroup ? (
                                            <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 text-xs font-bold leading-none">
                                                {p.bloodGroup}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 dark:text-[#444444]">—</span>
                                        )}
                                    </div>

                                    <button
                                        className="p-2 -mr-2 text-slate-400 hover:text-emerald-600 dark:text-[#555555] dark:hover:text-emerald-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-[#1a1a1a]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setModal({ open: true, patient: p })
                                        }}
                                        title="Edit Patient"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {modal.open && (
                <PatientModal
                    patient={modal.patient}
                    onClose={() => setModal({ open: false, patient: null })}
                    onSave={handleSave}
                />
            )}
        </div>
    )
}
