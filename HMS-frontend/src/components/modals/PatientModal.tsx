import React, { useState, useEffect } from 'react'
import { validateEmail, validateRequired, validatePhone } from '@/utils/validators'
import type { Patient } from '@/utils/api'

interface Props {
    patient?: Patient | null
    onClose: () => void
    onSave: (data: Partial<Patient>) => Promise<void>
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function PatientModal({ patient, onClose, onSave }: Props) {
    const isEdit = !!patient

    const [form, setForm] = useState({
        firstName: patient?.firstName ?? '',
        lastName: patient?.lastName ?? '',
        dob: patient?.dob ?? '',
        gender: patient?.gender ?? 'Male',
        phone: patient?.phone ?? '',
        email: patient?.email ?? '',
        bloodGroup: patient?.bloodGroup ?? '',
        address: patient?.address ?? '',
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)

    const set = (field: string, value: string) =>
        setForm(p => ({ ...p, [field]: value }))

    const validate = (): boolean => {
        const e: Record<string, string> = {}
        const fn = validateRequired(form.firstName, 'First name')
        const ln = validateRequired(form.lastName, 'Last name')
        const db = validateRequired(form.dob, 'Date of birth')
        const ph = validatePhone(form.phone)
        const em = form.email ? validateEmail(form.email) : undefined
        if (fn) e.firstName = fn
        if (ln) e.lastName = ln
        if (db) e.dob = db
        if (ph) e.phone = ph
        if (em) e.email = em
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate()) return
        setSaving(true)
        try { await onSave(form) }
        finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        {isEdit ? 'Edit Patient' : 'Register New Patient'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">First Name *</label>
                            <input className="input" value={form.firstName}
                                onChange={e => set('firstName', e.target.value)} />
                            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                        </div>
                        <div>
                            <label className="label">Last Name *</label>
                            <input className="input" value={form.lastName}
                                onChange={e => set('lastName', e.target.value)} />
                            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Date of Birth *</label>
                            <input type="date" className="input" value={form.dob}
                                onChange={e => set('dob', e.target.value)} />
                            {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
                        </div>
                        <div>
                            <label className="label">Gender *</label>
                            <select className="input" value={form.gender}
                                onChange={e => set('gender', e.target.value)}>
                                <option>Male</option>
                                <option>Female</option>
                                <option>Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Phone</label>
                            <input className="input" value={form.phone}
                                onChange={e => set('phone', e.target.value)} />
                            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <input type="email" className="input" value={form.email}
                                onChange={e => set('email', e.target.value)} />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Blood Group</label>
                            <select className="input" value={form.bloodGroup}
                                onChange={e => set('bloodGroup', e.target.value)}>
                                <option value="">Select</option>
                                {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="label">Address</label>
                        <textarea rows={2} className="input resize-none" value={form.address}
                            onChange={e => set('address', e.target.value)} />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : isEdit ? 'Update Patient' : 'Register Patient'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
