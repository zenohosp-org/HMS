import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { admissionApi, roomApi, doctorsApi } from '@/utils/api'
import { X, Scissors, BedDouble, Stethoscope, Loader2 } from 'lucide-react'

export default function MoveToOTModal({ admission, onClose, onMoved }) {
  const { user } = useAuth()
  const { notify } = useNotification()

  const [otRooms, setOtRooms] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState(admission.admittingDoctorId || '')

  useEffect(() => {
    if (!user?.hospitalId) return
    Promise.all([
      roomApi.list(user.hospitalId),
      doctorsApi.list(user.hospitalId),
    ]).then(([rooms, docs]) => {
      setOtRooms(rooms.filter(r => r.roomType === 'OT' && r.status === 'AVAILABLE'))
      setDoctors(docs)
    }).catch(() => {
      notify('Failed to load OT rooms or doctors', 'error')
    }).finally(() => setLoading(false))
  }, [user?.hospitalId])

  const handleSubmit = async () => {
    if (!selectedRoomId) { notify('Please select an OT room', 'warning'); return }
    setSubmitting(true)
    try {
      await admissionApi.moveToOT(admission.id, Number(selectedRoomId), selectedDoctorId || null)
      notify(`${admission.patientName} moved to OT successfully`, 'success')
      onMoved()
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to move patient to OT', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#111111] rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-[#222222]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Move to OT</p>
              <p className="text-xs text-slate-500">{admission.patientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading OT rooms…</span>
            </div>
          ) : (
            <>
              {/* OT Room selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-[#aaaaaa] uppercase tracking-wider mb-2">
                  <BedDouble className="w-3.5 h-3.5 inline mr-1.5" />
                  Select OT Room
                </label>
                {otRooms.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                    No OT rooms available. Add OT rooms in Settings → Infrastructure.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {otRooms.map(room => (
                      <label key={room.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${selectedRoomId === String(room.id) ? 'border-violet-400 bg-violet-50 dark:bg-violet-500/10 dark:border-violet-500/40' : 'border-slate-200 dark:border-[#2a2a2a] hover:border-violet-300 dark:hover:border-violet-500/30'}`}>
                        <input type="radio" name="otRoom" value={room.id}
                          checked={selectedRoomId === String(room.id)}
                          onChange={e => setSelectedRoomId(e.target.value)}
                          className="accent-violet-600" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{room.roomNumber}</p>
                          <p className="text-xs text-slate-500">OT · Available</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Doctor selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-[#aaaaaa] uppercase tracking-wider mb-2">
                  <Stethoscope className="w-3.5 h-3.5 inline mr-1.5" />
                  Performing Doctor
                </label>
                <select
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#0d0d0d] text-sm text-slate-800 dark:text-[#cccccc] focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  value={selectedDoctorId}
                  onChange={e => setSelectedDoctorId(e.target.value)}>
                  <option value="">— Keep current doctor —</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.firstName} {d.lastName}{d.specialization ? ` · ${d.specialization}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-[#1e1e1e]">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit}
            disabled={submitting || loading || !selectedRoomId}
            className="btn-primary flex items-center gap-2">
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Moving…' : 'Move to OT'}
          </button>
        </div>
      </div>
    </div>
  )
}
