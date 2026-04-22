import React, { useState, useEffect } from 'react'
import api from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { X, Loader2, Search } from 'lucide-react'

interface AllocatePatientModalProps {
    roomId: number
    roomNumber: string
    onClose: () => void
    onSuccess: () => void
}

const inputCls = `w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a]
    bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc]
    focus:outline-none focus:ring-2 focus:ring-emerald-500/50`
const labelCls = "block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-1.5"

export default function AllocatePatientModal({ roomId, roomNumber, onClose, onSuccess }: AllocatePatientModalProps) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [patients, setPatients] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
    const [approxDischarge, setApproxDischarge] = useState('')
    const [attender, setAttender] = useState({
        name: '',
        phone: '',
        relationship: '',
    })

    useEffect(() => {
        if (!user?.hospitalId) return
        setLoading(true)
        api.get(`/patients?hospitalId=${user.hospitalId}`)
            .then(r => setPatients(r.data))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [user?.hospitalId])

    const filteredPatients = patients.filter(p => {
        if (!search) return true
        const s = search.toLowerCase()
        return p.firstName.toLowerCase().includes(s) ||
            p.lastName.toLowerCase().includes(s) ||
            p.mrn.toLowerCase().includes(s)
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPatientId) return

        try {
            setSubmitting(true)
            await api.post(`/rooms/allocate?hospitalId=${user?.hospitalId}`, {
                roomId,
                patientId: selectedPatientId,
                approxDischargeTime: approxDischarge ? new Date(approxDischarge).toISOString() : null,
                attenderName: attender.name || null,
                attenderPhone: attender.phone || null,
                attenderRelationship: attender.relationship || null,
            })
            onSuccess()
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to allocate room')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#2a2a2a]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#222222] shrink-0">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Allocate Patient <span className="text-slate-400">to Room {roomNumber}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#aaaaaa] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">

                    {/* Patient Search */}
                    <div className="space-y-2">
                        <label className={labelCls}>Select Patient *</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a]
                                    bg-slate-50 dark:bg-[#1a1a1a] text-slate-900 dark:text-[#cccccc] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                placeholder="Search by name or MRN..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="h-44 overflow-y-auto space-y-2 border border-slate-100 dark:border-[#222222] rounded-xl p-2 bg-slate-50 dark:bg-[#0d0d0d]">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-slate-400">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                </div>
                            ) : filteredPatients.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-slate-400">No patients found.</div>
                            ) : filteredPatients.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedPatientId(p.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                        ${selectedPatientId === p.id
                                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30'
                                            : 'bg-white border-slate-200 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] hover:border-emerald-200 dark:hover:border-emerald-500/20'}`}
                                >
                                    <div>
                                        <p className={`text-sm font-bold ${selectedPatientId === p.id ? 'text-emerald-900 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                                            {p.firstName} {p.lastName}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{p.mrn}</p>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0
                                        ${selectedPatientId === p.id ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-[#555555]'}`}>
                                        {selectedPatientId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Attender Details */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
                            Patient Attender
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className={labelCls}>Attender Name</label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    placeholder="Full name of attender"
                                    value={attender.name}
                                    onChange={e => setAttender({ ...attender, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Phone</label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    placeholder="Attender phone number"
                                    value={attender.phone}
                                    onChange={e => setAttender({ ...attender, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Relationship</label>
                                <select
                                    className={inputCls}
                                    value={attender.relationship}
                                    onChange={e => setAttender({ ...attender, relationship: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    <option value="Spouse">Spouse</option>
                                    <option value="Parent">Parent</option>
                                    <option value="Child">Child</option>
                                    <option value="Sibling">Sibling</option>
                                    <option value="Friend">Friend</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Discharge Time */}
                    <div>
                        <label className={labelCls}>Estimated Discharge Time (Optional)</label>
                        <input
                            type="datetime-local"
                            className={inputCls}
                            value={approxDischarge}
                            onChange={e => setApproxDischarge(e.target.value)}
                        />
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-[#222222] flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={submitting || !selectedPatientId} className="btn-primary">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Allocate Patient'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
