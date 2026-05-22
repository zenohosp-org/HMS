import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { admissionApi, departmentApi, doctorsApi, patientApi, bedApi, patientAdvanceApi, bankApi } from '@/utils/api'
import api from '@/utils/api'
import { fmtId } from '@/utils/idFormat'
import { X, Search, BedDouble, User, CheckCircle2, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/ui/SearchableSelect'

const ADMISSION_SOURCES = ['OPD_REFERRAL', 'EMERGENCY', 'DIRECT']
const RELATIONSHIPS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Guardian', 'Other']
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer']

// Cash pays into a CASH-type drawer; everything else lands in a SAVINGS or CURRENT bank account.
const PAYMENT_METHOD_TO_ACCOUNT_TYPES = {
  'Cash':          ['CASH'],
  'UPI':           ['SAVINGS', 'CURRENT'],
  'Card':          ['SAVINGS', 'CURRENT'],
  'Bank Transfer': ['SAVINGS', 'CURRENT'],
}

export default function AdmitPatientModal({ onClose, onAdmitted, prefill }) {
  const { user } = useAuth()
  const { notify } = useNotification()
  const [patients, setPatients] = useState([])
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [rooms, setRooms] = useState([])
  const [availableBeds, setAvailableBeds] = useState([])
  const [bedsLoading, setBedsLoading] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(prefill?.patient || null)
  const [admittedPatientIds, setAdmittedPatientIds] = useState(new Set())
  const [form, setForm] = useState({
    admissionType: prefill?.admissionType || 'OPD_REFERRAL',
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

  // Finance step
  const [paymentCategory, setPaymentCategory] = useState('CASH')
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState('Cash')
  const [advanceNotes, setAdvanceNotes] = useState('')
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false)
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('')


  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user?.hospitalId) return
    Promise.all([
      departmentApi.list(user.hospitalId, true),
      doctorsApi.list(user.hospitalId),
      admissionApi.list(user.hospitalId, false),
    ]).then(([depts, docs, activeAdmissions]) => {
      setDepartments(depts)
      setDoctors(docs.filter(d => d.userIsActive))
      setAdmittedPatientIds(new Set(activeAdmissions.map(a => a.patientId)))
    })
  }, [user?.hospitalId])

  useEffect(() => {
    if (!user?.hospitalId) return
    const q = patientSearch.trim()
    if (q.length < 2) { setPatients([]); return }
    patientApi.list(user.hospitalId).then(all =>
      setPatients(all.filter(p =>
        !admittedPatientIds.has(p.id) &&
        `${p.firstName} ${p.lastName} ${p.uhid}`.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 8))
    )
  }, [patientSearch, admittedPatientIds])

  useEffect(() => {
    if (!user?.hospitalId) return
    api.get('/rooms', { params: { hospitalId: user.hospitalId } }).then(r =>
      setRooms(r.data.filter(rm => rm.status === 'AVAILABLE'))
    ).catch(() => {})
  }, [user?.hospitalId])

  const selectedDept = departments.find(d => String(d.id) === String(form.departmentId))
  const filteredDoctors = form.departmentId && selectedDept
    ? doctors.filter(d => d.specialization?.toLowerCase() === selectedDept.name?.toLowerCase())
    : doctors

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

  useEffect(() => {
    if (selectedPatient) setPaymentCategory(selectedPatient.paymentCategory || 'CASH')
  }, [selectedPatient])


  // Fetch bank accounts filtered by the current payment method's allowed types.
  // Cash → CASH accounts; UPI/Card/Bank Transfer → SAVINGS/CURRENT.
  useEffect(() => {
    if (!user?.hospitalId) return
    const types = PAYMENT_METHOD_TO_ACCOUNT_TYPES[advancePaymentMethod] || []
    setBankAccountsLoading(true)
    bankApi.list(user.hospitalId, types)
      .then(accounts => {
        setBankAccounts(accounts || [])
        // Auto-select if exactly one match, otherwise prefer default account if present.
        if (accounts && accounts.length === 1) {
          setSelectedBankAccountId(accounts[0].id)
        } else if (accounts && accounts.length > 1) {
          const def = accounts.find(a => a.isDefault)
          setSelectedBankAccountId(def ? def.id : '')
        } else {
          setSelectedBankAccountId('')
        }
      })
      .catch(() => { setBankAccounts([]); setSelectedBankAccountId('') })
      .finally(() => setBankAccountsLoading(false))
  }, [advancePaymentMethod, user?.hospitalId])

  const handleSubmit = async () => {
    if (!selectedPatient) return
    if (isMultiBed && !form.bedId) {
      alert('Please select a bed for this room.')
      return
    }
    setSubmitting(true)
    try {
      const admission = await admissionApi.admit({
        hospitalId: user.hospitalId,
        patientId: selectedPatient.id,
        roomId: form.roomId ? Number(form.roomId) : null,
        bedId: form.bedId ? Number(form.bedId) : null,
        admittingDoctorId: form.admittingDoctorId || null,
        departmentId: form.departmentId || null,
        sourceAppointmentId: prefill?.appointmentId || null,
        admissionType: form.admissionType,
        chiefComplaint: form.chiefComplaint,
        approxDischargeDate: form.approxDischargeDate || null,
        attenderName: form.attenderName,
        attenderPhone: form.attenderPhone,
        attenderRelationship: form.attenderRelationship,
      })

      const amt = Number(advanceAmount)
      if (amt > 0 && admission?.id) {
        try {
          await patientAdvanceApi.createForAdmission(admission.id, {
            amount: amt,
            paymentMethod: advancePaymentMethod,
            bankAccountId: selectedBankAccountId || null,
            notes: advanceNotes || null,
            collectedBy: user?.name || null,
          })
        } catch {
          // Advance failure must not block admission success
        }
      }

      try {
        await patientApi.update(selectedPatient.id, {
          ...selectedPatient,
          paymentCategory,
          hospitalId: user.hospitalId,
        })
      } catch {
        // Non-blocking — category can be updated from patient profile
      }

      onAdmitted()
    } catch (err) {
      alert(err.response?.data?.message || 'Admission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const advanceAmt = Number(advanceAmount) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-8xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-[#2a2a2a]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1e1e1e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#1e1e1e] flex items-center justify-center">
              <BedDouble className="w-5 h-5 text-slate-700 dark:text-[#cccccc]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Admit Patient to IPD</h2>
              <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">All sections in one place — scroll to fill, submit when ready.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — single page, 4 sections stacked */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* ─── Section 1: Patient & Source ────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader number={1} title="Patient & Source" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="label">Search Patient *</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-[#2a2a2a] flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">
                          {selectedPatient.firstName} {selectedPatient.lastName}
                        </p>
                        <p className="text-xs text-slate-500">UHID: {fmtId(selectedPatient.uhid)} · {selectedPatient.gender}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      className="input pl-10"
                      placeholder="Search by name or UHID…"
                    />
                    {patients.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333] rounded-lg shadow-xl z-10 overflow-hidden">
                        {patients.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch('') }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#222] text-left transition-colors"
                          >
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{p.firstName} {p.lastName}</p>
                              <p className="text-xs text-slate-500">UHID: {fmtId(p.uhid)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Admission Source</label>
                <SearchableSelect
                  className="input"
                  value={form.admissionType}
                  onChange={(v) => setForm({ ...form, admissionType: v })}
                  options={ADMISSION_SOURCES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
                />
              </div>
            </div>

          </section>

          {/* ─── Section 2: Clinical & Room ─────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader number={2} title="Clinical & Room" />
            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Department</label>
                  <SearchableSelect
                    className="input"
                    value={form.departmentId}
                    onChange={(v) => setForm({ ...form, departmentId: v, admittingDoctorId: '' })}
                    options={departments.map(d => ({ value: d.id, label: d.name }))}
                    placeholder="Select department…"
                  />
                </div>
                <div>
                  <label className="label">Admitting Doctor</label>
                  <SearchableSelect
                    className="input"
                    value={form.admittingDoctorId}
                    onChange={(v) => setForm({ ...form, admittingDoctorId: v })}
                    options={filteredDoctors.map(d => ({ value: d.id, label: `Dr. ${d.firstName} ${d.lastName}` }))}
                    placeholder="Select doctor…"
                  />
                </div>
              </div>
              <div>
                <label className="label">Chief Complaint</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={form.chiefComplaint}
                  onChange={e => setForm({ ...form, chiefComplaint: e.target.value })}
                  placeholder="Presenting complaint or reason for admission…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Assign Room (optional)</label>
                  <SearchableSelect
                    className="input"
                    value={form.roomId}
                    onChange={(v) => setForm({ ...form, roomId: v, bedId: '' })}
                    options={rooms.map(r => ({
                      value: r.id,
                      label: `${r.roomNumber} · ${r.roomType}${r.bedCount > 1 ? ` · ${r.bedCount} beds` : ''}${r.ward ? ` · ${r.ward}` : ''}`
                    }))}
                    placeholder="Assign later…"
                  />
                </div>
                <div>
                  <label className="label">Approx. Discharge</label>
                  <input type="datetime-local" className="input" value={form.approxDischargeDate}
                    onChange={e => setForm({ ...form, approxDischargeDate: e.target.value })} />
                </div>
              </div>

              {form.roomId && isMultiBed && (
                <div>
                  <label className="label">Select Bed *</label>
                  {bedsLoading ? (
                    <div className="flex items-center gap-2 py-3 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading beds…</span>
                    </div>
                  ) : availableBeds.length === 0 ? (
                    <p className="text-sm text-red-500 py-2">No available beds in this room.</p>
                  ) : (
                    <div className="grid grid-cols-6 gap-2">
                      {availableBeds.map(bed => (
                        <button
                          key={bed.id}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, bedId: String(bed.id) }))}
                          className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-all text-left ${
                            String(form.bedId) === String(bed.id)
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
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
          </section>

          {/* ─── Section 3: Attender ────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader number={3} title="Attender / Guardian" subtitle="Optional but recommended — required for discharge handover." />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="label">Attender Name</label>
                <input className="input" value={form.attenderName}
                  onChange={e => setForm({ ...form, attenderName: e.target.value })} placeholder="Full name" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.attenderPhone}
                  onChange={e => setForm({ ...form, attenderPhone: e.target.value })} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="label">Relationship</label>
                <SearchableSelect
                  className="input"
                  value={form.attenderRelationship}
                  onChange={(v) => setForm({ ...form, attenderRelationship: v })}
                  options={RELATIONSHIPS.map(r => ({ value: r, label: r }))}
                  placeholder="Select…"
                />
              </div>
            </div>
          </section>

          {/* ─── Section 4: Finance ─────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader number={4} title="Finance" />
            <div className="space-y-6">

              {/* Payment Category */}
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-[#aaa] uppercase tracking-wider mb-2">
                  Payment Category
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'CASH',   label: 'Cash',   desc: 'Periodic payments during stay' },
                    { value: 'CREDIT', label: 'Credit', desc: 'Full bill settled at discharge' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentCategory(opt.value)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        paymentCategory === opt.value
                          ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-[#1e1e1e]'
                          : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-[#3a3a3a]'
                      }`}
                    >
                      <p className={`text-sm font-bold ${paymentCategory === opt.value ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-[#aaa]'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-[#666] mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Admission advance (optional) */}
              <div className="pt-4 border-t border-slate-100 dark:border-[#2a2a2a]">
                <p className="text-xs font-bold text-slate-500 dark:text-[#aaa] uppercase tracking-wider mb-1">
                  Admission Advance / Room Deposit
                </p>
                <p className="text-xs text-slate-400 dark:text-[#666] mb-4">
                  Optional. Collect a room security deposit or initial advance — it will be auto-deducted from the final IPD bill.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className="input"
                      placeholder="0"
                      value={advanceAmount}
                      onChange={e => setAdvanceAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Payment Method</label>
                    <SearchableSelect
                      className="input"
                      value={advancePaymentMethod}
                      disabled={advanceAmt === 0}
                      onChange={(v) => setAdvancePaymentMethod(v)}
                      options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
                    />
                  </div>
                </div>

                {advanceAmt > 0 && (
                  <div className="mt-3">
                    <label className="label">
                      Deposit Account
                      <span className="ml-1.5 text-[10px] font-medium text-slate-400 dark:text-[#666]">
                        ({advancePaymentMethod === 'Cash' ? 'CASH only' : 'SAVINGS / CURRENT only'})
                      </span>
                    </label>
                    {bankAccountsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#888] py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading accounts…
                      </div>
                    ) : bankAccounts.length === 0 ? (
                      <div className="px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
                        No {advancePaymentMethod === 'Cash' ? 'CASH' : 'SAVINGS / CURRENT'} account found. Configure banks in the Finance app to enable deposit tracking.
                      </div>
                    ) : (
                      <SearchableSelect
                        className="input"
                        value={selectedBankAccountId}
                        onChange={(v) => setSelectedBankAccountId(v)}
                        options={bankAccounts.map(a => ({
                          value: a.id,
                          label: `${a.accountName} · ${a.accountType}${a.bankName ? ` · ${a.bankName}` : ''}`,
                        }))}
                        placeholder="Select account…"
                      />
                    )}
                  </div>
                )}

                {advanceAmt > 0 && (
                  <div className="mt-3">
                    <label className="label">Note (optional)</label>
                    <input
                      className="input"
                      placeholder="e.g. Room security deposit, Initial advance…"
                      value={advanceNotes}
                      onChange={e => setAdvanceNotes(e.target.value)}
                    />
                  </div>
                )}

                {advanceAmt > 0 && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      <span className="font-semibold">₹{advanceAmt.toLocaleString('en-IN')}</span> via {advancePaymentMethod} will be recorded and automatically deducted from the final discharge bill.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Summary preview before submit */}
          {selectedPatient && (
            <div className="rounded-lg bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] p-4 text-sm">
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Admission Summary</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
                <div><span className="font-medium">Patient: </span>{selectedPatient.firstName} {selectedPatient.lastName}</div>
                <div><span className="font-medium">Source: </span>{form.admissionType.replace(/_/g, ' ')}</div>
                <div>
                  <span className="font-medium">Room: </span>
                  {selectedRoom?.roomNumber || 'To be assigned'}
                  {form.bedId && availableBeds.find(b => String(b.id) === String(form.bedId))
                    ? ` · ${availableBeds.find(b => String(b.id) === String(form.bedId)).bedNumber}`
                    : ''}
                </div>
                <div><span className="font-medium">Payment: </span>{paymentCategory}{advanceAmt > 0 ? ` (₹${advanceAmt.toLocaleString('en-IN')} advance)` : ''}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] rounded-b-xl">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !selectedPatient} className="btn-primary">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Admitting…</>
              : <><CheckCircle2 className="w-4 h-4" /> Confirm Admission</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 pb-2 border-b border-slate-100 dark:border-[#1e1e1e]">
      <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
        {number}
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
