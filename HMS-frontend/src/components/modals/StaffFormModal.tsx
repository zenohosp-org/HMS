import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { staffApi, type StaffUser } from '@/utils/api'
import { X, UserIcon, ShieldAlert } from 'lucide-react'
import StateSelect from '@/components/StateSelect'

interface StaffFormModalProps {
    onClose: () => void
    onSaved: () => void
    editStaff?: StaffUser
}

export default function StaffFormModal({ onClose, onSaved, editStaff }: StaffFormModalProps) {
    const { user } = useAuth()
    const { notify } = useNotification()
    const [submitting, setSubmitting] = useState(false)

    const [form, setForm] = useState({
        firstName: editStaff?.firstName || '',
        lastName: editStaff?.lastName || '',
        email: editStaff?.email || '',
        password: '',
        phone: editStaff?.phone || '',
        role: editStaff?.role || 'STAFF',
        employeeCode: editStaff?.employeeCode || '',
        designation: editStaff?.designation || '',
        gender: editStaff?.gender || 'OTHER',
        dateOfJoining: editStaff?.dateOfJoining || '',
        state: editStaff?.state || '',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user?.hospitalId) return

        setSubmitting(true)
        try {
            if (editStaff) {
                // UPDATE
                await staffApi.update(editStaff.id, form)
                notify('Staff profile updated', 'success')
            } else {
                // CREATE
                await staffApi.create({
                    ...form,
                    hospitalId: user.hospitalId
                })
                notify('Staff access created successfully', 'success')
            }
            onSaved()
        } catch (error: any) {
            notify(error.response?.data?.error || 'Operation failed', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const inputClasses = "w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
    const labelClasses = "block text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider mb-2"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#000000]/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#2a2a2a]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1e1e1e]">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-violet-500" />
                        {editStaff ? 'Edit Staff Profile' : 'Add New Staff'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#ffffff] rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    <form id="staffForm" onSubmit={handleSubmit} className="space-y-8">

                        {/* Section 1: Authentication */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2 flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-500" /> Account & Access
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Email Address *</label>
                                    <input required type="email" value={form.email} disabled={!!editStaff} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClasses + (editStaff ? ' opacity-50 cursor-not-allowed' : '')} placeholder="staff@hospital.com" />
                                </div>
                                {!editStaff && (
                                    <div>
                                        <label className={labelClasses}>Temporary Password *</label>
                                        <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputClasses} placeholder="Minimum 6 characters" />
                                    </div>
                                )}
                                <div className={editStaff ? 'col-span-2' : 'col-span-2 mt-2'}>
                                    <label className={labelClasses}>System Role *</label>
                                    <select required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputClasses}>
                                        <option value="STAFF">General Staff</option>
                                        <option value="HOSPITAL_ADMIN">Hospital Administrator</option>
                                        <option value="TECHNICIAN">Technician</option>
                                    </select>
                                    <p className="text-[10px] text-slate-500 mt-1">Hospital Administrators have full authority over all modules.</p>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Personal Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
                                Personal Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>First Name *</label>
                                    <input required type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={inputClasses} placeholder="Jane" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Last Name *</label>
                                    <input required type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={inputClasses} placeholder="Smith" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Phone Number</label>
                                    <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClasses} placeholder="+1 234 567 890" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Gender *</label>
                                    <select required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className={inputClasses}>
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <StateSelect
                                        value={form.state}
                                        onChange={val => setForm({ ...form, state: val })}
                                        inputClassName={inputClasses}
                                        labelClassName={labelClasses}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Organizational details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
                                Organizational Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Employee Code</label>
                                    <input type="text" value={form.employeeCode} onChange={e => setForm({ ...form, employeeCode: e.target.value })} className={inputClasses} placeholder="e.g., EMP-1042" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Designation / Title</label>
                                    <input type="text" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className={inputClasses} placeholder="e.g., Head Nurse, Receptionist" />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClasses}>Date of Joining</label>
                                    <input type="date" value={form.dateOfJoining} onChange={e => setForm({ ...form, dateOfJoining: e.target.value })} className={inputClasses} />
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-[#1e1e1e] flex justify-end gap-3 bg-slate-50 dark:bg-[#0a0a0a]">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-200 dark:hover:bg-[#222222] transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="staffForm" disabled={submitting} className="btn-primary">
                        {submitting ? 'Saving...' : editStaff ? 'Save Changes' : 'Create Staff Account'}
                    </button>
                </div>

            </div>
        </div>
    )
}
