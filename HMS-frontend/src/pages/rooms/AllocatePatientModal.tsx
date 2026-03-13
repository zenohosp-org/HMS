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

export default function AllocatePatientModal({ roomId, roomNumber, onClose, onSuccess }: AllocatePatientModalProps) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [patients, setPatients] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
    const [approxDischarge, setApproxDischarge] = useState('')

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                setLoading(true)
                // Fetch basic patients list. Assuming we have GET /patients?hospitalId
                const { data } = await api.get(`/patients?hospitalId=${user?.hospitalId}`)
                setPatients(data)
            } catch (error) {
                console.error('Failed to fetch patients', error)
            } finally {
                setLoading(false)
            }
        }
        if (user?.hospitalId) fetchPatients()
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
        if (!selectedPatientId) {
            alert('Please select a patient to allocate.')
            return
        }

        try {
            setSubmitting(true)
            await api.post(`/rooms/allocate?hospitalId=${user?.hospitalId}`, {
                roomId,
                patientId: selectedPatientId,
                approxDischargeTime: approxDischarge ? new Date(approxDischarge).toISOString() : null
            })
            onSuccess()
        } catch (error: any) {
            console.error('Failed to allocate room', error)
            alert(error.response?.data?.message || 'Failed to allocate room')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-[#2a2a2a]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#222222]">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Allocate Patient <span className="text-slate-400">to Room {roomNumber}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#aaaaaa] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col h-[60vh] max-h-[600px]">
                    <div className="space-y-4 flex-1 flex flex-col overflow-hidden">

                        {/* Patient Search */}
                        <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] 
                                    bg-slate-50 dark:bg-[#1a1a1a] text-slate-900 dark:text-[#cccccc] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                placeholder="Search patient by name or MRN..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Patient List */}
                        <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 dark:border-[#222222] rounded-xl p-2 bg-slate-50 dark:bg-[#111111]">
                            {loading ? (
                                <div className="p-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                            ) : filteredPatients.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">No patients found.</div>
                            ) : (
                                filteredPatients.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedPatientId(p.id)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                            ${selectedPatientId === p.id
                                                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30'
                                                : 'bg-white border-slate-200 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] hover:border-emerald-200 dark:hover:border-emerald-500/20'}`}
                                    >
                                        <div>
                                            <p className={`font-bold ${selectedPatientId === p.id ? 'text-emerald-900 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                                                {p.firstName} {p.lastName}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{p.mrn}</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center 
                                            ${selectedPatientId === p.id ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-[#555555]'}`}>
                                            {selectedPatientId === p.id && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Additional Details */}
                        <div className="shrink-0 pt-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-1.5">Estimated Discharge Time (Optional)</label>
                            <input
                                type="datetime-local"
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] 
                                    bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                value={approxDischarge}
                                onChange={e => setApproxDischarge(e.target.value)}
                            />
                        </div>

                    </div>

                    <div className="pt-5 mt-5 border-t border-slate-100 dark:border-[#222222] flex justify-end gap-3 shrink-0">
                        <button type="button" onClick={onClose} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting || !selectedPatientId} className="btn-primary">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Allocate Patient'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
