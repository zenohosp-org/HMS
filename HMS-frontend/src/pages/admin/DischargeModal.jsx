import { useState } from 'react'
import { admissionApi } from '@/utils/api'
import { useNotification } from '@/context/NotificationContext'
import { X, LogOut, CheckCircle2, Calendar, Loader2, AlertCircle } from 'lucide-react'

export default function DischargeModal({ admission, onClose, onDischarged }) {
  const { notify } = useNotification()

  const [clinical, setClinical] = useState({
    actualDischargeDate: new Date().toISOString().slice(0, 16),
    dischargeDiagnosis: admission.primaryDiagnosis || '',
    dischargeNote: '',
    createFollowUp: false,
    followUpDate: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [billError, setBillError] = useState(false)

  const handleDischarge = async () => {
    if (!clinical.actualDischargeDate) { notify('Discharge date is required', 'error'); return }
    setSubmitting(true)
    setBillError(false)
    try {
      await admissionApi.discharge(admission.id, {
        actualDischargeDate: clinical.actualDischargeDate,
        dischargeDiagnosis: clinical.dischargeDiagnosis,
        dischargeNote: clinical.dischargeNote,
        createFollowUp: clinical.createFollowUp,
        followUpDate: clinical.followUpDate || null,
        followUpDoctorId: admission.admittingDoctorId || null,
      })
      notify('Patient discharged successfully', 'success')
      onDischarged()
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || ''
      if (msg.includes('INVOICE_UNPAID')) {
        setBillError(true)
      } else {
        notify(msg || 'Discharge failed', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-white dark:bg-[#111] overflow-hidden">

      {/* ── Left panel — clinical form ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full border-r border-slate-200 dark:border-[#2a2a2a]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LogOut className="w-4 h-4 text-rose-500" /> Discharge Patient
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
              {admission.patientName} · {admission.admissionNumber}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clinical fields */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Unpaid invoice gate warning */}
          {billError && (
            <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Bill not paid</p>
                <p className="text-xs text-rose-600 dark:text-rose-300 mt-0.5">
                  Please finalize and pay the patient's bill in the <strong>Billing</strong> tab before discharging.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="label">Discharge Date & Time *</label>
            <input
              type="datetime-local"
              required
              className="input"
              value={clinical.actualDischargeDate}
              onChange={e => setClinical(c => ({ ...c, actualDischargeDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Discharge Diagnosis</label>
            <input
              className="input"
              placeholder="Final diagnosis on discharge"
              value={clinical.dischargeDiagnosis}
              onChange={e => setClinical(c => ({ ...c, dischargeDiagnosis: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Discharge Summary / Notes</label>
            <textarea
              rows={3}
              className="input resize-none"
              placeholder="Treatment summary, post-discharge instructions…"
              value={clinical.dischargeNote}
              onChange={e => setClinical(c => ({ ...c, dischargeNote: e.target.value }))}
            />
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={clinical.createFollowUp}
                onChange={e => setClinical(c => ({ ...c, createFollowUp: e.target.checked }))}
                className="w-4 h-4 accent-slate-900 dark:accent-white"
              />
              <span className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" /> Schedule OPD Follow-up
              </span>
            </label>
            {clinical.createFollowUp && (
              <div className="pl-7">
                <label className="label">Follow-up Date *</label>
                <input
                  type="date"
                  className="input"
                  value={clinical.followUpDate}
                  onChange={e => setClinical(c => ({ ...c, followUpDate: e.target.value }))}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a]">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleDischarge}
            disabled={submitting || !clinical.actualDischargeDate}
            className="btn-primary flex items-center gap-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              : <><CheckCircle2 className="w-4 h-4" /> Confirm Discharge</>
            }
          </button>
        </div>
      </div>

      {/* ── Right panel — patient summary ──────────────────────────────────── */}
      <div className="w-[340px] shrink-0 bg-slate-50 dark:bg-[#0a0a0a] overflow-y-auto p-6 space-y-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#666] mb-2">Patient</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{admission.patientName}</p>
          {(admission.patientMrn || admission.mrn) && (
            <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">MRN: {admission.patientMrn || admission.mrn}</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] divide-y divide-slate-100 dark:divide-[#1a1a1a] text-sm overflow-hidden">
          {[
            ['Admission No.', admission.admissionNumber],
            ['IPD No.', admission.ipdNumber || admission.ipd_number || null],
            ['Room / Ward', [admission.roomNumber, admission.wardName].filter(Boolean).join(' · ') || '—'],
            ['Admitting Doctor', admission.admittingDoctorName || admission.doctorName || '—'],
            ['Admitted', admission.admissionDate
              ? new Date(admission.admissionDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
              : '—'],
            ['Discharge', clinical.actualDischargeDate
              ? new Date(clinical.actualDischargeDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
              : '—'],
            ['Diagnosis', clinical.dischargeDiagnosis || admission.primaryDiagnosis || '—'],
          ].filter(([, v]) => v !== null).map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3 px-4 py-3">
              <span className="text-xs text-slate-500 dark:text-[#888] shrink-0 pt-0.5">{label}</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-[#ddd] text-right">{value}</span>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Billing is separate</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-0.5">
            Finalize and pay the patient bill in the <strong>Billing</strong> tab before discharging.
          </p>
        </div>
      </div>
    </div>
  )
}
