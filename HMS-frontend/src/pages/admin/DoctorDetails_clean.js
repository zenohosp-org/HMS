import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { appointmentsApi, doctorsApi, type DoctorUser, type Appointment } from '@/utils/api'
import { useNotification } from '@/context/NotificationContext'
import { useAuth } from '@/context/AuthContext'
import DoctorFormModal from '@/components/modals/DoctorFormModal'
import { Plus, Search, Edit2, Trash2, Shield, AlertCircle, Loader2, Hospital, Banknote, CalendarIcon, ChevronLeft, MapPin, Building2, Clock, Mail, Phone, BookOpen, Stethoscope, User, CheckCircle } from 'lucide-react'

export default function DoctorDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { notify } = useNotification()
    const { user } = useAuth()

    const [doctor, setDoctor] = useState<DoctorUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [tab, setTab] = useState<'overview' | 'appointments' | 'patients'>('overview')
    
    // States for tab data
    const [doctorAppointments, setDoctorAppointments] = useState<Appointment[]>([])
    const [loadingAppointments, setLoadingAppointments] = useState(false)

    // Derived unique patients list
    const doctorPatients = React.useMemo(() => {
        const pMap = new Map<number, { id: number, name: string, visits: number, lastVisit: string }>()
        doctorAppointments.forEach(appt => {
            if (!pMap.has(appt.patientId)) {
                pMap.set(appt.patientId, { id: appt.patientId, name: appt.patientName, visits: 1, lastVisit: appt.apptDate.substring(0, 10) })
            } else {
                const existing = pMap.get(appt.patientId)!
                existing.visits += 1
                if (appt.apptDate > existing.lastVisit) {
                    existing.lastVisit = appt.apptDate.substring(0, 10)
                }
                pMap.set(appt.patientId, existing)
            }
        })
        return Array.from(pMap.values()).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
    }, [doctorAppointments])

    const loadData = async () => {
        if (!id) return
        try {
            setLoading(true)
            const docData = await doctorsApi.get(id)
            setDoctor(docData)
            
            // Fetch appointments associated with this doctor
            setLoadingAppointments(true)
            try {
                // To get all appointments past and future, we could skip passing 'date' if the API allows returning all,
                // but since the endpoint returns all if date isn't provided (as seen in utils/api.ts for getByHospital), 
                // we'll use a hospital fetch filtered by doctorId.
                const hospitalId = docData.hospitalId
                const appts = await appointmentsApi.getByHospital(hospitalId)
                const docAppts = appts.filter((a) => a.doctorId === docData.id)
                // Sort by date/time desc (newest first)
                docAppts.sort((a, b) => new Date(`${b.apptDate}T${b.apptTime}`).getTime() - new Date(`${a.apptDate}T${a.apptTime}`).getTime())
                setDoctorAppointments(docAppts)
            } catch (err) {
                console.error("Failed to load appointments", err)
            } finally {
                setLoadingAppointments(false)
            }

        } catch (error) {
            notify('Failed to load doctor details', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [id])

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0f0f0f]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
    )

    if (!doctor) return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 bg-white dark:bg-[#0f0f0f]">
            <p className="text-slate-500">Doctor not found.</p>
            <button onClick={() => navigate(-1)} className="btn-secondary">Go Back</button>
        </div>
    )

    const canEdit = user?.role === 'HOSPITAL_ADMIN' || user?.userId === doctor.userId
    const initials = `${doctor.firstName[0]}${doctor.lastName?.[0] ?? ''}`.toUpperCase()

    return (
        <div className="flex gap-0 h-[calc(100vh-3.5rem)] w-[calc(100%+3rem)] -mx-6 -mt-6 overflow-hidden bg-white dark:bg-[#0f0f0f]">
            {/* ━━━━━━━━━━━━━━━  LEFT PANE — Doctor Profile  ━━━━━━━━━━━━━━━ */}
            <aside className="w-72 shrink-0 flex flex-col bg-white dark:bg-[#111111] border-r border-slate-200 dark:border-[#1e1e1e] overflow-y-auto">
                {/* Back & Actions */}
                <div className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-[#1e1e1e] flex justify-between items-center relative">
                    <button
                        onClick={() => navigate('/doctors')}
                        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666666] hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" /> Back to Doctors
                    </button>
                {canEdit && (
                    <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg text-sm font-bold text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Edit2 className="w-4 h-4" /> Edit Profile
                    </button>
                )}
            </div>

                {/* Avatar + Name block */}
                <div className="px-5 py-6 text-center border-b border-slate-200 dark:border-[#1e1e1e]">
                    <div className="w-16 h-16 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-slate-200 dark:border-[#2a2a2a] mx-auto mb-3
                        flex items-center justify-center text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {initials}
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                        Dr. {doctor.firstName} {doctor.lastName}
                    </h2>
                    <p className="text-sm font-semibold text-slate-500 dark:text-[#666666] mt-1 uppercase tracking-wider">
                        {doctor.specialization || 'General Practitioner'}
                    </p>

                    <div className="flex items-center justify-center gap-2 mt-3">
                        {doctor.userIsActive ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10 text-slate-900 dark:text-white dark:text-slate-300 rounded-full border border-emerald-100 dark:border-slate-900 dark:border-white/20 text-[10px] font-bold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white animate-pulse" /> Active
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full border border-red-100 dark:border-red-500/20 text-[10px] font-bold uppercase tracking-wider">
                                Inactive
                            </div>
                        )}
                    </div>
                </div>

                {/* Sections */}
                <div className="px-5 py-5 space-y-6 flex-1">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <User className="w-4 h-4 text-[#666666]" />
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-[#cccccc] uppercase tracking-wide">Contact Info</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <Mail className="w-4 h-4 mt-0.5 shrink-0 text-[#555] dark:text-[#555555]" />
                                <div>
                                    <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-[#555555] font-semibold">Email</p>
                                    <p className="text-sm text-slate-700 dark:text-[#cccccc] mt-0.5 break-all">{doctor.email}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="w-4 h-4 mt-0.5 shrink-0 text-[#555] dark:text-[#555555]" />
                                <div>
                                    <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-[#555555] font-semibold">Phone</p>
                                    <p className="text-sm text-slate-700 dark:text-[#cccccc] mt-0.5">{doctor.phone || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <BookOpen className="w-4 h-4 mt-0.5 shrink-0 text-[#555] dark:text-[#555555]" />
                                <div>
                                    <p className="text-[11px] uppercase tracking-wider text-                                    <p className="text-sm text-slate-700 dark:text-[#cccccc] mt-0.5 leading-relaxed">
                                        {doctor.qualification || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ━━━━━━━━━━━━━━━  RIGHT PANE — Details  ━━━━━━━━━━━━━━━ */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0f0f0f] relative w-full">��━  RIGHT PANE — Details  ━━━━━━━━━━━━━━━ */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0f0f0f] relative w-full">
                
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-6 pt-5 pb-0 border-b border-slate-200 dark:border-[#1e1e1e] shrink-0">
                    {(['overview', 'appointments', 'patients'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 -mb-px transition-colors ${tab === t
                                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white dark:text-slate-300'
                                : 'border-transparent text-slate-500 dark:text-[#666666] hover:text-slate-700 dark:hover:text-[#aaaaaa]'
                            }`}
                        >
                            {t === 'appointments' ? `Appointments ${!loadingAppointments ? `(${doctorAppointments.length})` : ''}`
                             : t === 'patients' ? `Patients ${!loadingAppointments ? `(${doctorPatients.length})` : ''}`
                             : 'Overview'}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-6">
                        {tab === 'overview' && (
                            <div className="animate-in fade-in duration-500 space-y-5 w-full max-w-5xl">
                                {/* Medical Registration */}
                                <section className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-5">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                            <Stethoscope className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-[#e5e5e5] uppercase tracking-wide">Medical Registration</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registration Number</p>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-[#cccccc]">
                                                {doctor.medicalRegistrationNumber || 'Not specified'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registration Council</p>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-[#cccccc]">
                                                {doctor.registrationCouncil || 'Not specified'}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                {/* Appointments & Billing */}
                                <section className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-5">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10 flex items-center justify-center">
                                            <Banknote className="w-4 h-4 text-slate-900 dark:text-white dark:text-slate-300" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-[#e5e5e5] uppercase tracking-wide">Billing & Schedule Setup</h3>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="p-4 bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10 rounded-lg border border-emerald-100 dark:border-slate-900 dark:border-white/20">
                                            <p className="text-[10px] font-bold text-slate-900 dark:text-white dark:text-slate-300 uppercase tracking-widest mb-1">Consultation Fee</p>
                                            <p className="text-xl font-bold text-slate-900 dark:text-white">${doctor.consultationFee?.toFixed(2) || '0.00'}</p>
                                        </div>
                                        <div className="p-4 bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10 rounded-lg border border-emerald-100 dark:border-slate-900 dark:border-white/20">
                                            <p className="text-[10px] font-bold text-slate-900 dark:text-white dark:text-slate-300 uppercase tracking-widest mb-1">Follow-up Fee</p>
                                            <p className="text-xl font-bold text-slate-900 dark:text-white">${doctor.followUpFee?.toFixed(2) || '0.00'}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-[#161616] rounded-lg border border-slate-100 dark:border-[#222222]">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Slot Duration</p>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                <p className="text-base font-bold text-slate-900 dark:text-white">{doctor.slotDurationMin} <span className="text-xs font-medium text-slate-500">mins</span></p>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-[#161616] rounded-lg border border-slate-100 dark:border-[#222222]">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Max Daily Slots</p>
                                            <p className="text-base font-bold text-slate-900 dark:text-white">{doctor.maxDailySlots}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Available Days</p>
                                        <div className="flex flex-wrap gap-2">
                                            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => {
                                                const isAvailable = doctor.availableDays?.includes(day)
                                                return (
                                                    <div key={day} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2
                                                        ${isAvailable
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30'
                                                            : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-[#161616] dark:text-[#555555] dark:border-[#222222]'}`}
                                                    >
                                                        {isAvailable && <CheckCircle className="w-3.5 h-3.5" />}
                                                        {day}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {tab === 'appointments' && (
                            <div className="animate-in fade-in duration-500 w-full max-w-5xl">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5]">Recent Appointments</h3>
                                        <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">
                                            {doctorAppointments.length} appointment{doctorAppointments.length !== 1 ? 's' : ''} for Dr. {doctor.firstName}
                                        </p>
                                    </div>
                                </div>
                                {loadingAppointments ? (
                                    <div className="flex justify-center py-16">
                                        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                                    </div>
                                ) : doctorAppointments.length === 0 ? (
                                    <div className="py-16 text-center">
                                        <CalendarIcon className="w-10 h-10 text-slate-200 dark:text-[#282828] mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No Appointments</p>
                                        <p className="text-xs text-slate-400 dark:text-[#444444] mt-1">This doctor has no recorded appointments yet.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-[#0f0f0f]">
                                                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Patient</th>
                                                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Date & Time</th>
                                                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Status</th>
                                                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Type</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">
                                                {doctorAppointments.slice(0, 50).map((appt) => (
                                                    <tr key={appt.id} className="hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-colors group">
                                                        <td className="py-3 px-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200 dark:border-[#333333]">
                                                                    {appt.patientName.charAt(0)}
                                                                </div>
                                                                <p className="font-semibold text-sm text-slate-900 dark:text-[#cccccc] truncate">
                                                                    {appt.patientName}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-5">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-[#cccccc]">{appt.apptDate.substring(0, 10)}</p>
                                                            <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">{appt.apptTime.substring(0, 5)}</p>
                                                        </td>
                                                        <td className="py-3 px-5">
                                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                                                                ['COMPLETED'].includes(appt.status) ? 'bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white dark:bg-slate-500/10 dark:text-slate-300' :
                                                                ['CANCELLED', 'NO_SHOW'].includes(appt.status) ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                                                ['IN_PROGRESS'].includes(appt.status) ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                                                                'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                                            }`}>
                                                                {appt.status.replace(/_/g, ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-5 text-sm font-semibold text-slate-600 dark:text-[#cccccc]">
                                                            {appt.type}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'patients' && (
                            <div className="animate-in fade-in duration-500 w-full max-w-5xl">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5]">Associated Patients</h3>
                                        <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">
                                            {doctorPatients.length} patient{doctorPatients.length !== 1 ? 's' : ''} have visited
                                        </p>
                                    </div>
                                </div>
                                {loadingAppointments ? (
                                    <div className="flex justify-center py-16">
                                        <Loader2 className="w-7 h-7 animate-spin text-slate-900 dark:text-white" />
                                    </div>
                                ) : doctorPatients.length === 0 ? (
                                    <div className="py-16 text-center">
                                        <Building2 className="w-10 h-10 text-slate-200 dark:text-[#282828] mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No Patients Found</p>
                                        <p className="text-xs text-slate-400 dark:text-[#444444] mt-1">There are no patients associated with this doctor yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {doctorPatients.slice(0, 50).map((patient, idx) => (
                                            <div key={idx} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4 flex items-center gap-4 hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors cursor-pointer" onClick={() => navigate(`/patients/${patient.id}`)}>
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2a2a2a] flex items-center justify-center text-sm font-bold text-slate-700 dark:text-[#cccccc] shrink-0">
                                                    {patient.name.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-900 dark:text-[#cccccc] truncate">{patient.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">Visits: {patient.visits} • Last: {patient.lastVisit}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit modal */}
            {editing && (
                <DoctorFormModal
                    editDoctor={doctor}
                    onClose={() => setEditing(false)}
                    onSaved={() => {
                        setEditing(false)
                        loadData()
                    }}
                />
            )}
        </div>
    )
}
