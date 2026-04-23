import { useState } from 'react'
import { admissionApi } from '@/utils/api'
import { X, LogOut, CheckCircle2, Calendar } from 'lucide-react'

export default function DischargeModal({ admission, onClose, onDischarged }) {
  const [form, setForm] = useState({
    actualDischargeDate: new Date().toISOString().slice(0, 16),
    dischargeDiagnosis: admission.primaryDiagnosis || '',
    dischargeNote: '',
    createFollowUp: false,
    followUpDate: '',
    followUpDoctorId: admission.admittingDoctorId || '',
  })
  const [submitting, setSubmitting] = useState(false)

  const inputCls = 'w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all'
  const labelCls = 'block text-xs font-bold text-slate-600 dark:text-[#aaa] uppercase tracking-wider mb-1.5'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await admissionApi.discharge(admission.id, {
        actualDischargeDate: form.actualDischargeDate,
        dischargeDiagnosis: form.dischargeDiagnosis,
        dischargeNote: form.dischargeNote,
        createFollowUp: form.createFollowUp,
        followUpDate: form.followUpDate || null,
        followUpDoctorId: form.followUpDoctorId || null,
      })
      onDischarged()
    } catch (err) {
      alert(err.response?.data?.message || 'Discharge failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-[#2a2a2a]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1e1e1e]">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LogOut className="w-5 h-5 text-rose-500" /> Discharge Patient
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{admission.patientName} · {admission.admissionNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Discharge Date & Time *</label>
              <input required type="datetime-local" value={form.actualDischargeDate}
                onChange={e => setForm({ ...form, actualDischargeDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Discharge Diagnosis</label>
              <input value={form.dischargeDiagnosis} onChange={e => setForm({ ...form, dischargeDiagnosis: e.target.value })}
                className={inputCls} placeholder="Final diagnosis on discharge" />
            </div>
            <div>
              <label className={labelCls}>Discharge Notes / Summary</label>
              <textarea value={form.dischargeNote} onChange={e => setForm({ ...form, dischargeNote: e.target.value })}
                className={inputCls} rows={3} placeholder="Treatment summary, instructions, follow-up advice…" />
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.createFollowUp}
                  onChange={e => setForm({ ...form, createFollowUp: e.target.checked })}
                  className="w-4 h-4 accent-violet-600" />
                <span className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-violet-500" /> Schedule OPD Follow-up Appointment
                </span>
              </label>
              {form.createFollowUp && (
                <div className="pl-7">
                  <label className={labelCls}>Follow-up Date *</label>
                  <input required type="date" value={form.followUpDate}
                    onChange={e => setForm({ ...form, followUpDate: e.target.value })} className={inputCls} />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 p-5 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#222] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-2 transition-colors disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> {submitting ? 'Processing…' : 'Confirm Discharge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
