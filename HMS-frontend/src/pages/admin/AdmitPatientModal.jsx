import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { admissionApi, departmentApi, doctorsApi, patientApi, bedApi } from '@/utils/api'
import api from '@/utils/api'
import { X, Search, BedDouble, User, Stethoscope, Building2, CheckCircle2, Loader2 } from 'lucide-react'

const ADMISSION_TYPES = ['ELECTIVE', 'EMERGENCY', 'REFERRAL', 'TRANSFER']
const ADMISSION_SOURCES = ['OPD_REFERRAL', 'EMERGENCY_WALK_IN', 'DIRECT', 'TRANSFER_IN']
const RELATIONSHIPS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Guardian', 'Other']

export default function AdmitPatientModal({ onClose, onAdmitted, prefill }) {
  const { user } = useAuth()
  const [patients, setPatients] = useState([])
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [rooms, setRooms] = useState([])
  const [availableBeds, setAvailableBeds] = useState([])
  const [bedsLoading, setBedsLoading] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(prefill?.patient || null)
  const [form, setForm] = useState({
    admissionType: prefill?.admissionType || 'ELECTIVE',
    admissionSource: prefill?.source || 'DIRECT',
    departmentId: '',
    admittingDoctorId: prefill?.doctorId || '',
    roomId: '',
    bedId: '',
    chiefComplaint: prefill?.chiefComplaint || '',
    approxDischargeDate: '',
    attenderName: '',
    attenderPhone: '',
    attenderRelationship: '',
  })
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user?.hospitalId) return
    Promise.all([
      departmentApi.list(user.hospitalId, true),
      doctorsApi.list(user.hospitalId),
    ]).then(([depts, docs]) => {
      setDepartments(depts)
      setDoctors(docs)
    })
  }, [user?.hospitalId])

  useEffect(() => {
    if (!user?.hospitalId) return
    const q = patientSearch.trim()
    if (q.length < 2) { setPatients([]); return }
    patientApi.list(user.hospitalId).then(all =>
      setPatients(all.filter(p =>
        `${p.firstName} ${p.lastName} ${p.mrn}`.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 8))
    )
  }, [patientSearch])

  useEffect(() => {
    if (!user?.hospitalId) return
    api.get('/rooms', { params: { hospitalId: user.hospitalId } }).then(r =>
      setRooms(r.data.filter(rm => rm.status === 'AVAILABLE'))
    ).catch(() => {})
  }, [user?.hospitalId])

  const selectedRoom = rooms.find(r => String(r.id) === String(form.roomId))
  const isMultiBed = selectedRoom && selectedRoom.bedCount != null && selectedRoom.bedCount > 1

  useEffect(() => {
    if (!isMultiBed || !form.roomId || !user?.hospitalId) {
      setAvailableBeds([])
      setForm(f => ({ ...f, bedId: '' }))
      return
    }
    setBedsLoading(true)
    bedApi.getByRoom(form.roomId, user.hospitalId)
      .then(beds => setAvailableBeds(beds.filter(b => b.status === 'AVAILABLE')))
      .catch(() => setAvailableBeds([]))
      .finally(() => setBedsLoading(false))
  }, [form.roomId, isMultiBed, user?.hospitalId])

  const handleSubmit = async () => {
    if (!selectedPatient) return
    if (isMultiBed && !form.bedId) {
      alert('Please select a bed for this room.')
      return
    }
    setSubmitting(true)
    try {
      await admissionApi.admit({
        hospitalId: user.hospitalId,
        patientId: selectedPatient.id,
        roomId: form.roomId ? Number(form.roomId) : null,
        bedId: form.bedId ? Number(form.bedId) : null,
        admittingDoctorId: form.admittingDoctorId || null,
        departmentId: form.departmentId || null,
        sourceAppointmentId: prefill?.appointmentId || null,
        admissionType: form.admissionType,
        admissionSource: form.admissionSource,
        chiefComplaint: form.chiefComplaint,
        approxDischargeDate: form.approxDischargeDate || null,
        attenderName: form.attenderName,
        attenderPhone: form.attenderPhone,
        attenderRelationship: form.attenderRelationship,
      })
      onAdmitted()
    } catch (err) {
      alert(err.response?.data?.message || 'Admission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all'
  const labelCls = 'block text-xs font-bold text-slate-600 dark:text-[#aaa] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-[#2a2a2a] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1e1e1e]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-violet-500" /> Admit Patient to IPD
            </h2>
            <div className="flex items-center gap-3 mt-2">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-[#222] text-slate-500'}`}>{s}</div>
                  <span className={`text-xs ${step === s ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-400'}`}>
                    {s === 1 ? 'Patient' : s === 2 ? 'Clinical' : 'Attender'}
                  </span>
                  {s < 3 && <div className={`w-8 h-px ${step > s ? 'bg-violet-400' : 'bg-slate-200 dark:bg-[#333]'}`} />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className={labelCls}>Search Patient *</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p className="text-xs text-slate-500">MRN: {selectedPatient.mrn} · {selectedPatient.gender}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="text-xs text-violet-600 hover:text-violet-800 font-semibold">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                      className={inputCls + ' pl-10'} placeholder="Search by name or MRN…" />
                    {patients.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333] rounded-xl shadow-xl z-10 overflow-hidden">
                        {patients.map(p => (
                          <button key={p.id} onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch('') }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#222] text-left transition-colors">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{p.firstName} {p.lastName}</p>
                              <p className="text-xs text-slate-500">MRN: {p.mrn}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Admission Type</label>
                  <select value={form.admissionType} onChange={e => setForm({ ...form, admissionType: e.target.value })} className={inputCls}>
                    {ADMISSION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Admission Source</label>
                  <select value={form.admissionSource} onChange={e => setForm({ ...form, admissionSource: e.target.value })} className={inputCls}>
                    {ADMISSION_SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Department</label>
                  <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className={inputCls}>
                    <option value="">Select department…</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Admitting Doctor</label>
                  <select value={form.admittingDoctorId} onChange={e => setForm({ ...form, admittingDoctorId: e.target.value })} className={inputCls}>
                    <option value="">Select doctor…</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Chief Complaint</label>
                <textarea value={form.chiefComplaint} onChange={e => setForm({ ...form, chiefComplaint: e.target.value })}
                  className={inputCls} rows={3} placeholder="Presenting complaint or reason for admission…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Assign Room (optional)</label>
                  <select
                    value={form.roomId}
                    onChange={e => setForm({ ...form, roomId: e.target.value, bedId: '' })}
                    className={inputCls}
                  >
                    <option value="">Assign later…</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.roomNumber} · {r.roomType}{r.bedCount > 1 ? ` · ${r.bedCount} beds` : ''}{r.ward ? ` · ${r.ward}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Approx. Discharge</label>
                  <input type="datetime-local" value={form.approxDischargeDate}
                    onChange={e => setForm({ ...form, approxDischargeDate: e.target.value })} className={inputCls} />
                </div>
              </div>

              {/* Bed picker — shown only for multi-bed rooms */}
              {form.roomId && isMultiBed && (
                <div>
                  <label className={labelCls}>Select Bed *</label>
                  {bedsLoading ? (
                    <div className="flex items-center gap-2 py-3 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading beds…</span>
                    </div>
                  ) : availableBeds.length === 0 ? (
                    <p className="text-sm text-red-500 py-2">No available beds in this room.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableBeds.map(bed => (
                        <button
                          key={bed.id}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, bedId: String(bed.id) }))}
                          className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all text-left ${
                            String(form.bedId) === String(bed.id)
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-400'
                          }`}
                        >
                          {bed.bedNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">Attender / Guardian details (optional)</p>
              <div>
                <label className={labelCls}>Attender Name</label>
                <input value={form.attenderName} onChange={e => setForm({ ...form, attenderName: e.target.value })}
                  className={inputCls} placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={form.attenderPhone} onChange={e => setForm({ ...form, attenderPhone: e.target.value })}
                    className={inputCls} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className={labelCls}>Relationship</label>
                  <select value={form.attenderRelationship} onChange={e => setForm({ ...form, attenderRelationship: e.target.value })} className={inputCls}>
                    <option value="">Select…</option>
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] p-4 space-y-2 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Summary</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Patient:</span><span>{selectedPatient?.firstName} {selectedPatient?.lastName}</span>
                  <span className="font-medium">Type:</span><span>{form.admissionType}</span>
                  <span className="font-medium">Source:</span><span>{form.admissionSource.replace(/_/g, ' ')}</span>
                  <span className="font-medium">Room:</span>
                  <span>
                    {selectedRoom?.roomNumber || 'To be assigned'}
                    {form.bedId && availableBeds.find(b => String(b.id) === String(form.bedId))
                      ? ` · ${availableBeds.find(b => String(b.id) === String(form.bedId)).bedNumber}`
                      : ''}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] rounded-b-2xl">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#222] transition-colors">
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => { if (step === 1 && !selectedPatient) return; setStep(s => s + 1) }}
              disabled={step === 1 && !selectedPatient}
              className="btn-primary disabled:opacity-50"
            >
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {submitting ? 'Admitting…' : 'Confirm Admission'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
