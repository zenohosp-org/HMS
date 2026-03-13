import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/utils/api'
import { Bed, Plus, Search, CalendarClock } from 'lucide-react'
import { formatDateTime } from '@/utils/validators'
import GenerateRoomsModal from './GenerateRoomsModal'
import AllocatePatientModal from './AllocatePatientModal'

interface PatientSummary {
    id: number
    mrn: string
    firstName: string
    lastName: string
}

interface Room {
    id: number
    roomNumber: string
    roomType: 'GENERAL' | 'ICU' | 'PRIVATE' | 'WARD'
    status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
    currentPatient?: PatientSummary
    approxDischargeTime?: string
}

export default function Rooms() {
    const { user } = useAuth()
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL')
    const [search, setSearch] = useState('')

    const [showGenerateModal, setShowGenerateModal] = useState(false)
    const [showAllocateModal, setShowAllocateModal] = useState<{ open: boolean, room: Room | null }>({ open: false, room: null })

    const fetchRooms = async () => {
        try {
            setLoading(true)
            const { data } = await api.get(`/rooms?hospitalId=${user?.hospitalId}`)
            setRooms(data)
        } catch (error) {
            console.error('Failed to fetch rooms', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user?.hospitalId) fetchRooms()
    }, [user?.hospitalId])

    const handleDeallocate = async (roomId: number) => {
        if (!confirm('Are you sure you want to deallocate this room?')) return
        try {
            await api.post(`/rooms/${roomId}/deallocate?hospitalId=${user?.hospitalId}`)
            fetchRooms()
        } catch (error) {
            console.error('Failed to deallocate', error)
            alert('Failed to deallocate room')
        }
    }

    const filteredRooms = useMemo(() => {
        return rooms.filter(r => {
            if (filter === 'AVAILABLE' && r.status !== 'AVAILABLE') return false
            if (filter === 'OCCUPIED' && r.status !== 'OCCUPIED') return false

            if (search) {
                const s = search.toLowerCase()
                const matchRoom = r.roomNumber.toLowerCase().includes(s)
                const matchPatient = r.currentPatient && (
                    r.currentPatient.firstName.toLowerCase().includes(s) ||
                    r.currentPatient.lastName.toLowerCase().includes(s) ||
                    r.currentPatient.mrn.toLowerCase().includes(s)
                )
                return matchRoom || matchPatient
            }
            return true
        }).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
    }, [rooms, filter, search])

    const availableCount = rooms.filter(r => r.status === 'AVAILABLE').length
    const occupiedCount = rooms.filter(r => r.status === 'OCCUPIED').length

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Room Allocation</h1>
                    <p className="text-sm text-slate-500 dark:text-[#666666]">{rooms.length} total rooms in hospital</p>
                </div>
                {user?.role === 'HOSPITAL_ADMIN' && (
                    <button className="btn-primary flex items-center gap-2" onClick={() => setShowGenerateModal(true)}>
                        <Plus className="w-4 h-4" /> Generate Rooms
                    </button>
                )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">Total Rooms</p>
                        <p className="text-2xl font-bold text-slate-800 dark:text-[#e0e0e0] mt-1">{rooms.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-[#1a1a1a] flex items-center justify-center">
                        <Bed className="w-5 h-5 text-slate-500" />
                    </div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Available</p>
                        <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">{availableCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                        <Bed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Occupied</p>
                        <p className="text-2xl font-bold text-blue-800 dark:text-blue-300 mt-1">{occupiedCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                        <Bed className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-2">
                    {(['ALL', 'AVAILABLE', 'OCCUPIED'] as const).map(f => (
                        <button key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all 
                                ${filter === f
                                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-md'
                                    : 'bg-white text-slate-500 border border-slate-200 dark:bg-[#111111] dark:border-[#222222] hover:bg-slate-50 dark:hover:bg-[#1a1a1a]'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] 
                            bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        placeholder="Search rooms or patients..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* List View */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center">
                        <p className="text-slate-500 dark:text-[#666666]">Loading rooms…</p>
                    </div>
                ) : filteredRooms.length === 0 ? (
                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center">
                        <p className="text-slate-500 dark:text-[#666666]">No rooms found matching criteria.</p>
                    </div>
                ) : (
                    filteredRooms.map(room => (
                        <div key={room.id}
                            className={`bg-white dark:bg-[#111111] border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors
                                ${room.status === 'AVAILABLE' ? 'border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-800/50'
                                    : 'border-slate-200 dark:border-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#2a2a2a]'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border
                                    ${room.status === 'AVAILABLE'
                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'
                                        : 'bg-slate-50 border-slate-100 text-slate-500 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-[#888888]'}`}>
                                    <Bed className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                            {room.roomNumber}
                                        </p>
                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border
                                            ${room.roomType === 'ICU' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]'}`}>
                                            {room.roomType}
                                        </span>
                                    </div>
                                    <p className={`text-xs mt-1 font-medium ${room.status === 'AVAILABLE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                        {room.status}
                                    </p>
                                </div>
                            </div>

                            {room.status === 'OCCUPIED' && room.currentPatient ? (
                                <div className="flex-1 sm:pl-8 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-4 sm:pt-0">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-[#666666] mb-0.5">Assigned Patient</p>
                                            <p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">
                                                {room.currentPatient.firstName} {room.currentPatient.lastName}
                                            </p>
                                            <p className="text-[11px] text-slate-400 dark:text-[#555555] mt-0.5">{room.currentPatient.mrn}</p>
                                        </div>
                                        {room.approxDischargeTime && (
                                            <div className="text-right hidden md:block">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666666] mb-0.5 justify-end">
                                                    <CalendarClock className="w-3.5 h-3.5" /> Est. Discharge
                                                </div>
                                                <p className="text-xs font-medium text-slate-700 dark:text-[#aaaaaa]">
                                                    {formatDateTime(room.approxDischargeTime)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 sm:pl-8 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-4 sm:pt-0 flex items-center">
                                    <p className="text-sm text-slate-400 dark:text-[#555555]">Ready for allocation</p>
                                </div>
                            )}

                            <div className="shrink-0 flex justify-end">
                                {room.status === 'AVAILABLE' ? (
                                    <button
                                        onClick={() => setShowAllocateModal({ open: true, room })}
                                        className="btn-secondary text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-500/20"
                                    >
                                        Allocate
                                    </button>
                                ) : room.status === 'OCCUPIED' ? (
                                    <button
                                        onClick={() => handleDeallocate(room.id)}
                                        className="btn-secondary text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                                    >
                                        Deallocate
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {showGenerateModal && (
                <GenerateRoomsModal
                    onClose={() => setShowGenerateModal(false)}
                    onSuccess={() => {
                        setShowGenerateModal(false)
                        fetchRooms()
                    }}
                />
            )}

            {showAllocateModal.open && showAllocateModal.room && (
                <AllocatePatientModal
                    roomId={showAllocateModal.room.id}
                    roomNumber={showAllocateModal.room.roomNumber}
                    onClose={() => setShowAllocateModal({ open: false, room: null })}
                    onSuccess={() => {
                        setShowAllocateModal({ open: false, room: null })
                        fetchRooms()
                    }}
                />
            )}
        </div>
    )
}
