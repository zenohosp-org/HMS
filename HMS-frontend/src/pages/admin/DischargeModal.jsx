import { useState, useEffect } from 'react'
import { admissionApi, invoiceApi } from '@/utils/api'
import { useNotification } from '@/context/NotificationContext'
import { X, LogOut, CheckCircle2, Calendar, Loader2, AlertCircle, IndianRupee } from 'lucide-react'

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

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

  // Billing status fetched on open
  const [billStatus, setBillStatus] = useState(null)   // null | 'UNPAID' | 'PARTIAL' | 'PAID'
  const [billTotal, setBillTotal] = useState(0)
  const [billPaid, setBillPaid] = useState(0)

  useEffect(() => {
    invoiceApi.getAdmissionInvoice(admission.id)
      .then(inv => {
        if (!inv) return
        setBillStatus(inv.status)
        setBillTotal(Number(inv.total || 0))
        setBillPaid(Number(inv.paidAmount || 0))
      })
      .catch(() => {})
  }, [admission.id])

  const billClear = billStatus === 'PAID'
  const balanceDue = Math.max(0, billTotal - billPaid)

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
        setBillStatus(prev => prev === 'PAID' ? prev : 'UNPAID')
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

          {/* Billing gate banner — shown when bill is not cleared */}
          {billStatus && !billClear && (
            <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                  {billStatus === 'PARTIAL' ? 'Partial payment — balance outstanding' : 'Bill not paid'}
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-300 mt-0.5">
                  {billStatus === 'PARTIAL'
                    ? <><strong>{fmt(balanceDue)}</strong> still due. Collect the remaining balance in the <strong>Billing</strong> tab before discharging.</>
                    : <>Finalize and pay the patient's bill in the <strong>Billing</strong> tab before discharging.</>
                  }
                </p>
              </div>
            </div>
          )}

          {/* Backend-rejected gate (extra safety) */}
          {billError && billClear && (
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
            disabled={submitting || !clinical.actualDischargeDate || (billStatus !== null && !billClear)}
            title={!billClear && billStatus ? 'Settle the outstanding bill before discharging' : undefined}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
              ? new Date(admission.admissionDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
              : '—'],
            ['Discharge', clinical.actualDischargeDate
              ? new Date(clinical.actualDischargeDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
              : '—'],
            ['Diagnosis', clinical.dischargeDiagnosis || admission.primaryDiagnosis || '—'],
          ].filter(([, v]) => v !== null).map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3 px-4 py-3">
              <span className="text-xs text-slate-500 dark:text-[#888] shrink-0 pt-0.5">{label}</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-[#ddd] text-right">{value}</span>
            </div>
          ))}
        </div>

        {/* Billing status card — dynamic */}
        <div className={`px-4 py-3 rounded-lg border flex items-start gap-3 ${
          billStatus === null
            ? 'bg-slate-50 dark:bg-[#111] border-slate-200 dark:border-[#2a2a2a]'
            : billStatus === 'PAID'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
              : billStatus === 'PARTIAL'
                ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20'
                : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
        }`}>
          <IndianRupee className={`w-4 h-4 shrink-0 mt-0.5 ${
            billStatus === 'PAID' ? 'text-emerald-500'
              : billStatus === 'PARTIAL' ? 'text-orange-500'
              : 'text-rose-400'
          }`} />
          <div>
            {billStatus === null && (
              <>
                <p className="text-xs font-semibold text-slate-500">Checking bill…</p>
              </>
            )}
            {billStatus === 'PAID' && (
              <>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Bill fully settled</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-300 mt-0.5">
                  {fmt(billTotal)} paid — patient can be discharged.
                </p>
              </>
            )}
            {billStatus === 'PARTIAL' && (
              <>
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">Partial payment received</p>
                <p className="text-[11px] text-orange-600 dark:text-orange-300 mt-0.5">
                  {fmt(billPaid)} paid · <strong>{fmt(balanceDue)} still due</strong>. Collect balance in Billing tab.
                </p>
              </>
            )}
            {billStatus === 'UNPAID' && (
              <>
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Bill not paid</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-0.5">
                  Finalize and pay {billTotal > 0 ? fmt(billTotal) : 'the bill'} in the Billing tab before discharging.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
