import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { doctorsApi, staffApi, type StaffUser, type DoctorUser } from '@/utils/api'
import { X, UserPlus, Search } from 'lucide-react'

interface DoctorFormModalProps {
    onClose: () => void
    onSaved: () => void
    editDoctor?: DoctorUser
}

export default function DoctorFormModal({ onClose, onSaved, editDoctor }: DoctorFormModalProps) {
    const { user } = useAuth()
    const { notify } = useNotification()

    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Basic User Details Form (for 'new' mode)
    const [userForm, setUserForm] = useState({
        firstName: '', lastName: '', email: '', phone: '', password: ''
    })

    // Doctor Profile Form
    const [doctorForm, setDoctorForm] = useState({
        specialization: editDoctor?.specialization || '',
        qualification: editDoctor?.qualification || '',
        medicalRegistrationNumber: editDoctor?.medicalRegistrationNumber || '',
        registrationCouncil: editDoctor?.registrationCouncil || '',
        consultationFee: editDoctor?.consultationFee || 500,
        followUpFee: editDoctor?.followUpFee || 300,
        availableDays: editDoctor?.availableDays || 'MON,TUE,WED,THU,FRI',
        slotDurationMin: editDoctor?.slotDurationMin || 15,
        maxDailySlots: editDoctor?.maxDailySlots || 40,
    })


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user?.hospitalId) return

        setSubmitting(true)
        try {
            if (editDoctor) {
                // UPDATE MODE
                await doctorsApi.update(editDoctor.id, doctorForm)
                notify('Doctor profile updated', 'success')
            } else {
                // CREATE MODE
                // 1. Create User first
                const newUser = await staffApi.create({
                    ...userForm,
                    role: 'DOCTOR',
                    hospitalId: user.hospitalId
                })
                const finalUserId = newUser.id

                // 2. Create Doctor Profile
                await doctorsApi.create({
                    ...doctorForm,
                    userId: finalUserId,
                    hospitalId: user.hospitalId
                })
                notify('Doctor profile created', 'success')
            }
            onSaved()
        } catch (error: any) {
            notify(error.response?.data?.error || 'Operation failed', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const inputClasses = "w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
    const labelClasses = "block text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider mb-2"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#000000]/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#2a2a2a]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1e1e1e]">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {editDoctor ? 'Edit Doctor Profile' : 'Add Doctor Profile'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#ffffff] rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {!editDoctor && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
                                Step 1: User Account Setup
                            </h3>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-[#151515] p-5 rounded-xl border border-slate-100 dark:border-[#222222]">
                                <div>
                                    <label className={labelClasses}>First Name *</label>
                                    <input required type="text" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} className={inputClasses} placeholder="John" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Last Name *</label>
                                    <input required type="text" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} className={inputClasses} placeholder="Doe" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Email Address *</label>
                                    <input required type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className={inputClasses} placeholder="doctor@hospital.com" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Phone Number</label>
                                    <input type="text" value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} className={inputClasses} placeholder="+1 234 567 8900" />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClasses}>Temporary Password *</label>
                                    <input required type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className={inputClasses} placeholder="Minimum 6 characters" />
                                </div>
                            </div>

                        </div>
                    )}

                    <form id="doctorForm" onSubmit={handleSubmit} className="space-y-8">
                        {/* Step 2: Professional Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
                                {editDoctor ? 'Professional Details' : 'Step 2: Professional Details'}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Specialization *</label>
                                    <input required type="text" value={doctorForm.specialization} onChange={e => setDoctorForm({ ...doctorForm, specialization: e.target.value })} className={inputClasses} placeholder="e.g., Cardiologist" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Qualification *</label>
                                    <input required type="text" value={doctorForm.qualification} onChange={e => setDoctorForm({ ...doctorForm, qualification: e.target.value })} className={inputClasses} placeholder="e.g., MBBS, MD" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Medical Registration Number *</label>
                                    <input required type="text" value={doctorForm.medicalRegistrationNumber} onChange={e => setDoctorForm({ ...doctorForm, medicalRegistrationNumber: e.target.value })} className={inputClasses} placeholder="Reg Num" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Registration Council *</label>
                                    <input required type="text" value={doctorForm.registrationCouncil} onChange={e => setDoctorForm({ ...doctorForm, registrationCouncil: e.target.value })} className={inputClasses} placeholder="e.g., State Medical Council" />
                                </div>
                            </div>
                        </div>

                        {/* Step 3: Billing & Availability */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
                                {editDoctor ? 'Billing & Availability' : 'Step 3: Billing & Availability'}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Consultation Fee ($) *</label>
                                    <input required type="number" min="0" step="0.01" value={doctorForm.consultationFee} onChange={e => setDoctorForm({ ...doctorForm, consultationFee: parseFloat(e.target.value) })} className={inputClasses} placeholder="50.00" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Follow-up Fee ($) *</label>
                                    <input required type="number" min="0" step="0.01" value={doctorForm.followUpFee} onChange={e => setDoctorForm({ ...doctorForm, followUpFee: parseFloat(e.target.value) })} className={inputClasses} placeholder="30.00" />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClasses}>Available Days *</label>
                                    <input required type="text" value={doctorForm.availableDays} onChange={e => setDoctorForm({ ...doctorForm, availableDays: e.target.value })} className={inputClasses} placeholder="MON,TUE,WED,THU,FRI" />
                                    <p className="text-xs text-slate-500 mt-2">Comma separated days (e.g., MON,TUE,WED).</p>
                                </div>
                                <div>
                                    <label className={labelClasses}>Slot Duration (Mins) *</label>
                                    <input required type="number" min="5" step="5" value={doctorForm.slotDurationMin} onChange={e => setDoctorForm({ ...doctorForm, slotDurationMin: parseInt(e.target.value) })} className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Max Daily Slots *</label>
                                    <input required type="number" min="1" value={doctorForm.maxDailySlots} onChange={e => setDoctorForm({ ...doctorForm, maxDailySlots: parseInt(e.target.value) })} className={inputClasses} />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-[#1e1e1e] flex justify-end gap-3 bg-slate-50 dark:bg-[#0a0a0a]">
                    <button type="button" onClick={onClose} className="btn-secondary">
                        Cancel
                    </button>
                    <button type="submit" form="doctorForm" disabled={submitting} className="btn-primary">
                        {submitting ? 'Saving...' : editDoctor ? 'Save Changes' : 'Create Profile'}
                    </button>
                </div>

            </div>
        </div>
    )
}
