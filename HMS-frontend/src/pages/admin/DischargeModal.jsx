import { useState, useEffect, useMemo } from 'react'
import { admissionApi, invoiceApi, bankApi, hospitalServiceApi, radiologyApi } from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { generateInvoiceNumber } from '@/utils/validators'
import {
  X, LogOut, CheckCircle2, Calendar, Receipt, Trash2, Plus,
  Loader2, AlertCircle, BedDouble, ScanLine, Stethoscope,
  Pill, FlaskConical, Wrench, Landmark,
} from 'lucide-react'

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance', 'Cheque']
const GST_RATE = 0.18

const TYPE_META = {
  ROOM_CHARGE:  { label: 'Room',         icon: BedDouble,    color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-500/10' },
  CONSULTATION: { label: 'Consultation', icon: Stethoscope,  color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-500/10'     },
  RADIOLOGY:    { label: 'Radiology',    icon: ScanLine,     color: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-50 dark:bg-violet-500/10' },
  LAB_TEST:     { label: 'Lab Test',     icon: FlaskConical, color: 'text-teal-600 dark:text-teal-400',      bg: 'bg-teal-50 dark:bg-teal-500/10'     },
  MEDICINE:     { label: 'Medicine',     icon: Pill,         color: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-50 dark:bg-emerald-500/10'},
  CUSTOM:       { label: 'Custom',       icon: Wrench,       color: 'text-slate-600 dark:text-[#aaa]',       bg: 'bg-slate-100 dark:bg-[#222]'         },
}

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}


export default function DischargeModal({ admission, onClose, onDischarged }) {
  const { user } = useAuth()
  const { notify } = useNotification()

  const [step, setStep] = useState(1)

  // ── Step 1 — Clinical ──────────────────────────────────────────────────────
  const [clinical, setClinical] = useState({
    actualDischargeDate: new Date().toISOString().slice(0, 16),
    dischargeDiagnosis: admission.primaryDiagnosis || '',
    dischargeNote: '',
    createFollowUp: false,
    followUpDate: '',
  })

  // ── Step 2 — Billing ───────────────────────────────────────────────────────
  const [loadingBill, setLoadingBill] = useState(false)
  const [items, setItems] = useState([])
  const [nextKey, setNextKey] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [billNotes, setBillNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [invoiceNo] = useState(generateInvoiceNumber)

  useEffect(() => {
    if (step !== 2 || !user?.hospitalId || !admission.patientId) return
    setLoadingBill(true)

    // Calculate actual days stayed from admission → discharge dates
    const admitMs = new Date(admission.admissionDate).getTime()
    const dischargeMs = new Date(clinical.actualDischargeDate).getTime()
    const daysStayed = Math.max(1, Math.ceil((dischargeMs - admitMs) / (1000 * 60 * 60 * 24)))

    Promise.all([
      invoiceApi.getSmartSuggestions(admission.patientId).catch(() => ({})),
      hospitalServiceApi.list(user.hospitalId).catch(() => []),
      bankApi.list(user.hospitalId).catch(() => []),
      admissionApi.get(admission.id).catch(() => null),
      radiologyApi.getByAdmission(admission.id).catch(() => []),
    ])
      .then(([suggestions, services, accounts, fullAdmission, radiologyOrders]) => {
        const def = accounts.find(a => a.isDefault) ?? accounts[0]
        setBankAccounts(accounts)
        if (def) setBankAccountId(def.id)

        let key = 0
        const auto = []

        // ── Room charge ─────────────────────────────────────────────────────
        // Use fullAdmission room data as primary source — admission list object
        // may not carry roomNumber if room was assigned after initial fetch.
        const roomNumber = admission.roomNumber || fullAdmission?.roomNumber
        if (roomNumber) {
          const pricePerDay =
            suggestions.roomCharge?.pricePerDay ||
            fullAdmission?.roomPricePerDay ||
            fullAdmission?.room?.pricePerDay ||
            fullAdmission?.room?.dailyCharge ||
            fullAdmission?.ward?.dailyCharge ||
            0

          const roomType = admission.roomType || fullAdmission?.roomType
          const roomLabel = roomType
            ? `Room ${roomNumber} (${roomType.replace(/_/g, ' ')})`
            : `Room ${roomNumber}`

          auto.push({
            key: key++,
            itemType: 'ROOM_CHARGE',
            description: `${roomLabel} — ${daysStayed} day${daysStayed !== 1 ? 's' : ''}`,
            quantity: daysStayed,
            unitPrice: pricePerDay,
            totalPrice: daysStayed * pricePerDay,
          })
        }

        // ── Consultations ────────────────────────────────────────────────────
        suggestions.appointments?.forEach(a => {
          auto.push({
            key: key++,
            itemType: 'CONSULTATION',
            description: `Consultation — Dr. ${a.doctorName}${a.specialization ? ` (${a.specialization})` : ''}`,
            quantity: 1,
            unitPrice: a.consultationFee,
            totalPrice: a.consultationFee,
          })
        })

        // ── Radiology — scoped exactly to this admission, no cross-admission pollution ──
        const EXCLUDED_STATUSES = ['CANCELLED']
        const pending = Array.isArray(radiologyOrders)
          ? radiologyOrders.filter(r => !EXCLUDED_STATUSES.includes(r.status))
          : []
        pending.forEach(r => {
          const name = r.serviceName || r.investigationName || r.testName || 'Radiology'
          const match = services.find(s => s.name.toLowerCase() === name.toLowerCase())
          const price = match?.price ?? 0
          auto.push({
            key: key++,
            itemType: 'RADIOLOGY',
            description: name,
            quantity: 1,
            unitPrice: price,
            totalPrice: price,
          })
        })

        setItems(auto)
        setNextKey(key)
      })
      .catch(() => {
        notify('Could not load pending charges — add items manually', 'info')
      })
      .finally(() => setLoadingBill(false))
  }, [step, admission.patientId, user?.hospitalId])

  // ── Item helpers ───────────────────────────────────────────────────────────
  const addBlankItem = () => {
    setItems(prev => [...prev, { key: nextKey, itemType: 'CUSTOM', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }])
    setNextKey(k => k + 1)
  }

  const removeItem = key => setItems(prev => prev.filter(i => i.key !== key))

  const updateItem = (key, updates) => {
    setItems(prev => prev.map(item => {
      if (item.key !== key) return item
      const merged = { ...item, ...updates }
      if ('quantity' in updates || 'unitPrice' in updates)
        merged.totalPrice = (Number(merged.quantity) || 0) * (Number(merged.unitPrice) || 0)
      return merged
    }))
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.totalPrice || 0), 0), [items])
  const discountAmt = subtotal * (discountPct / 100)
  const medicineSubtotal = useMemo(
    () => items.filter(i => i.itemType === 'MEDICINE').reduce((s, i) => s + (i.totalPrice || 0), 0),
    [items]
  )
  const gst = (medicineSubtotal - medicineSubtotal * (discountPct / 100)) * GST_RATE
  const grandTotal = subtotal - discountAmt + gst

  const hasZeroPrice = items.some(i => Number(i.unitPrice) === 0 && i.itemType !== 'CUSTOM')

  // ── Actions ────────────────────────────────────────────────────────────────
  const doDischarge = () =>
    admissionApi.discharge(admission.id, {
      actualDischargeDate: clinical.actualDischargeDate,
      dischargeDiagnosis: clinical.dischargeDiagnosis,
      dischargeNote: clinical.dischargeNote,
      createFollowUp: clinical.createFollowUp,
      followUpDate: clinical.followUpDate || null,
      followUpDoctorId: admission.admittingDoctorId || null,
    })

  const handleSkipBilling = async () => {
    setSubmitting(true)
    try {
      await doDischarge()
      notify('Patient discharged — bill pending', 'info')
      onDischarged()
    } catch (err) {
      notify(err?.response?.data?.message || 'Discharge failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDischargeAndBill = async () => {
    if (items.length === 0) { notify('Add at least one billing item, or skip billing', 'warning'); return }
    if (items.some(i => !i.description.trim())) { notify('All items need a description', 'error'); return }
    setSubmitting(true)
    try {
      await doDischarge()
      await invoiceApi.create({
        invoiceNumber: invoiceNo,
        hospitalId: user.hospitalId,
        patientId: admission.patientId,
        admissionId: admission.id,
        subtotal,
        tax: gst,
        discount: discountAmt,
        total: grandTotal,
        paymentMethod,
        notes: billNotes || `Discharge bill — Admission ${admission.admissionNumber}`,
        status: 'UNPAID',
        bankAccountId: bankAccountId || undefined,
        items: items.map(i => ({
          itemType: i.itemType,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
        })),
      })
      notify('Patient discharged and discharge bill generated', 'success')
      onDischarged()
      window.print()
    } catch (err) {
      notify(
        err?.response?.data?.message ||
        'Discharge completed but billing failed — create the invoice manually',
        'error'
      )
      onDischarged()
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-[#111] rounded-lg shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-[#2a2a2a] flex flex-col max-h-[92vh]">

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

            <div className="flex items-center gap-5">
              {/* Step pills */}
              <div className="flex items-center gap-2 text-xs font-semibold select-none">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${step > 1 ? 'bg-emerald-500 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'}`}>
                  {step > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
                </span>
                <span className={step === 1 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#555]'}>Clinical</span>
                <span className="text-slate-300 dark:text-[#444]">›</span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${step === 2 ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-200 dark:bg-[#2a2a2a] text-slate-400 dark:text-[#666]'}`}>
                  2
                </span>
                <span className={step === 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#555]'}>Billing</span>
              </div>

              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Step 1 — Clinical ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
          )}

          {/* ── Step 2 — Billing ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {loadingBill ? (
                <div className="flex flex-col items-center gap-3 py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
                  <p className="text-sm font-medium text-slate-600 dark:text-[#888]">Detecting all pending charges…</p>
                </div>
              ) : (
                <>
                  {/* Items table */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">
                          Bill Items
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-[#666] mt-0.5">
                          All pending charges auto-detected — review and adjust before confirming
                        </p>
                      </div>
                      <button onClick={addBlankItem} className="btn-secondary text-xs flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Add Item
                      </button>
                    </div>

                    {items.length === 0 ? (
                      <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-[#2a2a2a] rounded-lg">
                        <p className="text-sm font-medium text-slate-500 dark:text-[#777]">No charges detected</p>
                        <p className="text-xs text-slate-400 dark:text-[#555] mt-1">Add items manually or skip billing</p>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg overflow-hidden">
                        {/* Column headers */}
                        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 dark:bg-[#0f0f0f] border-b border-slate-100 dark:border-[#1a1a1a]">
                          {['Type', 'Description', 'Qty', 'Unit ₹', 'Total'].map((h, i) => (
                            <div key={h} className={`text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#666] ${i === 0 ? 'col-span-2' : i === 1 ? 'col-span-4' : i === 2 ? 'col-span-2 text-center' : i === 3 ? 'col-span-2 text-right' : 'col-span-2 text-right'}`}>
                              {h}
                            </div>
                          ))}
                        </div>

                        <div className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                          {items.map(item => (
                            <div key={item.key} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-colors">
                              <div className="col-span-2">
                                <select
                                  value={item.itemType ?? 'CUSTOM'}
                                  onChange={e => updateItem(item.key, { itemType: e.target.value })}
                                  className="w-full text-[10px] rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-1.5 py-1 text-slate-700 dark:text-[#ccc] focus:outline-none"
                                >
                                  {Object.entries(TYPE_META).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-4">
                                <input
                                  className="input py-1.5 text-sm"
                                  placeholder="Description…"
                                  value={item.description}
                                  onChange={e => updateItem(item.key, { description: e.target.value })}
                                />
                              </div>
                              <div className="col-span-2">
                                <input
                                  type="number"
                                  min={1}
                                  className="input py-1.5 text-sm text-center"
                                  value={item.quantity}
                                  onChange={e => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })}
                                />
                              </div>
                              <div className="col-span-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="input py-1.5 text-sm text-right"
                                  value={item.unitPrice}
                                  onChange={e => updateItem(item.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div className="col-span-2 flex items-center justify-end gap-1.5">
                                <span className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">
                                  {fmt(item.totalPrice || 0)}
                                </span>
                                <button
                                  onClick={() => removeItem(item.key)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Totals */}
                        <div className="px-4 py-4 border-t border-slate-100 dark:border-[#1a1a1a] flex justify-end bg-slate-50/50 dark:bg-[#0a0a0a]">
                          <div className="w-56 space-y-2 text-sm">
                            <div className="flex justify-between text-slate-500 dark:text-[#888]">
                              <span>Subtotal</span>
                              <span className="font-semibold tabular-nums">{fmt(subtotal)}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500 dark:text-[#888]">
                              <span>Discount (%)</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className="input w-16 py-1 text-sm text-center"
                                value={discountPct}
                                onChange={e => setDiscountPct(Math.min(100, parseFloat(e.target.value) || 0))}
                              />
                            </div>
                            {discountAmt > 0 && (
                              <div className="flex justify-between text-rose-500 dark:text-rose-400">
                                <span>Discount</span>
                                <span className="tabular-nums">-{fmt(discountAmt)}</span>
                              </div>
                            )}
                            {medicineSubtotal > 0 && (
                              <div className="flex justify-between text-slate-500 dark:text-[#888]">
                                <span>GST on medicines (18%)</span>
                                <span className="tabular-nums">{fmt(gst)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-slate-900 dark:text-white text-base border-t border-slate-100 dark:border-[#1a1a1a] pt-2.5 mt-1">
                              <span>Grand Total</span>
                              <span className="text-blue-600 dark:text-blue-400 tabular-nums">{fmt(grandTotal)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Zero-price warning */}
                  {hasZeroPrice && (
                    <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                        Some items have ₹0 — verify radiology charges before generating the bill.
                        Prices are auto-looked up from the service catalog; add the service in Settings → Packages if missing.
                      </p>
                    </div>
                  )}

                  {/* Payment method */}
                  <div>
                    <label className="label">Payment Method</label>
                    <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* Bank account */}
                  {bankAccounts.length > 0 && (
                    <div>
                      <label className="label flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5" /> Credit Payment To
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {bankAccounts.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setBankAccountId(a.id)}
                            className={`text-left p-3 rounded-lg border-2 transition-all ${bankAccountId === a.id ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-[#1a1a1a]' : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-[#3a3a3a] bg-white dark:bg-[#111]'}`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-0.5">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{a.accountName}</p>
                              {bankAccountId === a.id && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />}
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-[#666]">···{a.accountNumber?.slice(-4)}</p>
                            <p className="text-xs font-semibold text-slate-600 dark:text-[#aaa] mt-1 tabular-nums">{fmt(a.currentBalance)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="label">Billing Notes (optional)</label>
                    <input
                      className="input"
                      placeholder={`Discharge bill — Admission ${admission.admissionNumber}`}
                      value={billNotes}
                      onChange={e => setBillNotes(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] rounded-b-lg">
            {step === 1 ? (
              <>
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => clinical.actualDischargeDate && setStep(2)}
                  disabled={!clinical.actualDischargeDate}
                  className="btn-primary flex items-center gap-2"
                >
                  Next: Review Bill <Receipt className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipBilling}
                    disabled={submitting}
                    className="btn-secondary text-amber-600 dark:text-amber-400"
                  >
                    Skip Billing
                  </button>
                </div>
                <button
                  onClick={handleDischargeAndBill}
                  disabled={submitting || loadingBill}
                  className="btn-primary flex items-center gap-2"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                    : <><Receipt className="w-4 h-4" /> Discharge & Generate Bill</>
                  }
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Print template — captured by window.print() */}
      <div className="hidden print:block fixed inset-0 z-[200] bg-white text-black p-10">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold">Discharge Summary & Bill</h1>
            <p className="text-sm text-gray-500 mt-1">{user?.hospitalName}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold text-lg">#{invoiceNo}</p>
            <p className="text-gray-500">{new Date().toLocaleDateString('en-IN')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm border-t border-gray-200 pt-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Patient</p>
            <p className="font-bold text-base">{admission.patientName}</p>
            <p className="text-gray-500">Admission: {admission.admissionNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Discharge</p>
            <p className="font-bold">{clinical.dischargeDiagnosis || '—'}</p>
            <p className="text-gray-500">{clinical.actualDischargeDate?.replace('T', ' ')}</p>
          </div>
        </div>

        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 w-28">Type</th>
              <th className="text-left py-2">Description</th>
              <th className="text-center py-2 w-14">Qty</th>
              <th className="text-right py-2 w-24">Unit ₹</th>
              <th className="text-right py-2 w-24">Total ₹</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-1.5 text-gray-500">{TYPE_META[i.itemType]?.label ?? i.itemType}</td>
                <td className="py-1.5">{i.description}</td>
                <td className="text-center py-1.5">{i.quantity}</td>
                <td className="text-right py-1.5">{fmt(i.unitPrice)}</td>
                <td className="text-right py-1.5 font-medium">{fmt(i.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount ({discountPct}%)</span><span>-{fmt(discountAmt)}</span>
              </div>
            )}
            {gst > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>GST (18% medicines)</span><span>{fmt(gst)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t-2 border-black pt-2 mt-2">
              <span>Grand Total</span><span>{fmt(grandTotal)}</span>
            </div>
            <p className="text-gray-400 text-xs mt-2">Payment: {paymentMethod}</p>
          </div>
        </div>

        {clinical.dischargeNote && (
          <div className="mt-8 border-t border-gray-200 pt-4 text-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Discharge Notes</p>
            <p>{clinical.dischargeNote}</p>
          </div>
        )}
      </div>
    </>
  )
}
