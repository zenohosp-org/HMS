import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import SSOCookieManager from '@/utils/ssoManager'
import { invoiceApi, bankApi, hospitalServiceApi, patientServicesApi, radiologyApi } from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { generateInvoiceNumber } from '@/utils/validators'
import {
  X, Receipt, CheckCircle2, Loader2, AlertCircle, Plus, Trash2,
  BedDouble, ScanLine, Stethoscope, Pill, FlaskConical, Wrench,
  Scissors, Landmark,
} from 'lucide-react'

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance', 'Cheque']
const GST_RATE = 0.18

const TYPE_META = {
  ROOM_CHARGE:  { label: 'Room',         icon: BedDouble   },
  CONSULTATION: { label: 'Consultation', icon: Stethoscope },
  RADIOLOGY:    { label: 'Radiology',    icon: ScanLine    },
  LAB_TEST:     { label: 'Lab Test',     icon: FlaskConical},
  MEDICINE:     { label: 'Medicine',     icon: Pill        },
  OT:           { label: 'OT / Surgery', icon: Scissors    },
  CUSTOM:       { label: 'Custom',       icon: Wrench      },
}

const otApi = axios.create({ baseURL: 'https://api-ot.zenohosp.com', withCredentials: true })
otApi.interceptors.request.use(config => {
  const token = SSOCookieManager.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function countMealSlots(admitDate, dischargeDate, chargeTime) {
  if (!chargeTime) return 0
  const [h, m] = chargeTime.split(':').map(Number)
  const admit = new Date(admitDate)
  const discharge = new Date(dischargeDate)
  let count = 0
  const day = new Date(admit)
  day.setHours(0, 0, 0, 0)
  while (day <= discharge) {
    const slot = new Date(day)
    slot.setHours(h, m, 0, 0)
    if (slot >= admit && slot <= discharge) count++
    day.setDate(day.getDate() + 1)
  }
  return count
}

export default function FinalizeIPDBillingModal({ admission, onClose, onFinalized }) {
  const { user } = useAuth()
  const { notify } = useNotification()

  const [invoiceId, setInvoiceId] = useState(null)
  const [loadingBill, setLoadingBill] = useState(true)
  const [items, setItems] = useState([])
  const [nextKey, setNextKey] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [billNotes, setBillNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fallbackInvoiceNo] = useState(generateInvoiceNumber)

  // Use now as the effective discharge date for charge calculation
  const effectiveDischargeDate = new Date().toISOString()

  useEffect(() => {
    if (!user?.hospitalId || !admission.patientId) return
    setLoadingBill(true)

    const admitMs = new Date(admission.admissionDate).getTime()
    const dischargeMs = new Date(effectiveDischargeDate).getTime()
    const elapsedMs = dischargeMs - admitMs
    const daysStayed = Math.max(1, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)))
    const roomDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))

    Promise.all([
      invoiceApi.getSmartSuggestions(admission.patientId, admission.id).catch(() => ({})),
      hospitalServiceApi.list(user.hospitalId).catch(() => []),
      bankApi.list(user.hospitalId).catch(() => []),
      radiologyApi.getByAdmission(admission.id).catch(() => []),
      patientServicesApi.list(user.hospitalId).catch(() => []),
      otApi.get('/api/ot/invoices', { params: { admissionId: admission.id } }).catch(() => ({ data: [] })),
      invoiceApi.getAdmissionInvoice(admission.id).catch(() => null),
    ]).then(([suggestions, services, accounts, radiologyOrders, patientServices, otRes, existingInvoice]) => {
      const def = accounts.find(a => a.isDefault) ?? accounts[0]
      setBankAccounts(accounts)
      if (def) setBankAccountId(def.id)
      if (existingInvoice?.id) setInvoiceId(existingInvoice.id)

      let key = 0
      const auto = []

      // OPD → IPD: if existing invoice already has items (e.g. consultation from OPD visit),
      // carry them forward so they appear in this IPD bill. The appointment is already marked
      // BILLED so smart suggestions won't re-add it — no duplication risk.
      if (existingInvoice?.items?.length > 0) {
        existingInvoice.items.forEach(item => {
          auto.push({
            key: key++,
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice || 0),
            totalPrice: Number(item.totalPrice || 0),
            appointmentId: item.appointmentId ?? undefined,
            radiologyOrderId: item.radiologyOrderId ?? undefined,
            fromOpd: true,
          })
        })
      }

      // Room charge — only after 24 hrs (roomDays = full 24-hr periods elapsed)
      const roomNumber = admission.roomNumber
      if (roomNumber && roomDays > 0) {
        const pricePerDay = suggestions.roomCharge?.pricePerDay || admission.roomPricePerDay || 0
        const roomType = admission.roomType
        const roomLabel = roomType ? `Room ${roomNumber} (${roomType.replace(/_/g, ' ')})` : `Room ${roomNumber}`
        auto.push({
          key: key++, itemType: 'ROOM_CHARGE',
          description: `${roomLabel} — ${roomDays} day${roomDays !== 1 ? 's' : ''}`,
          quantity: roomDays, unitPrice: pricePerDay, totalPrice: roomDays * pricePerDay,
        })
      }

      // Consultations
      ;(suggestions.appointments || []).forEach(a => {
        auto.push({
          key: key++, itemType: 'CONSULTATION',
          description: `Consultation — Dr. ${a.doctorName}${a.specialization ? ` (${a.specialization})` : ''}`,
          quantity: 1, unitPrice: a.consultationFee, totalPrice: a.consultationFee,
          appointmentId: a.appointmentId,
        })
      })

      // Radiology
      const EXCLUDED = ['CANCELLED', 'BILLED']
      ;(Array.isArray(radiologyOrders) ? radiologyOrders.filter(r => !EXCLUDED.includes(r.status)) : []).forEach(r => {
        const name = r.serviceName || r.investigationName || r.testName || 'Radiology'
        const match = services.find(s => s.name.toLowerCase() === name.toLowerCase())
        const price = match?.price ?? 0
        auto.push({
          key: key++, itemType: 'RADIOLOGY', description: name,
          quantity: 1, unitPrice: price, totalPrice: price, radiologyOrderId: r.id,
        })
      })

      // Patient services (food + others)
      ;(Array.isArray(patientServices) ? patientServices.filter(s => s.isActive) : []).forEach(s => {
        if (s.type === 'FOOD') {
          const price = s.pricePerMeal || 0
          // If chargeTime is set: count only slots that fall after admission; else use floor-days × 3
          const quantity = s.chargeTime
            ? countMealSlots(admission.admissionDate, effectiveDischargeDate, s.chargeTime)
            : roomDays * 3
          auto.push({
            key: key++, itemType: 'CUSTOM',
            description: `${s.name} (${quantity} meal${quantity !== 1 ? 's' : ''})`,
            quantity, unitPrice: price, totalPrice: quantity * price,
          })
        } else if (s.type === 'REGISTRATION' && s.oneTimeCharge) {
          const price = s.pricePerDay || 0
          auto.push({
            key: key++, itemType: 'CUSTOM',
            description: s.name,
            quantity: 1, unitPrice: price, totalPrice: price,
          })
        } else {
          const price = s.pricePerDay || 0
          // If chargeTime is set: count only days where the service slot fired after admission
          const qty = s.chargeTime
            ? countMealSlots(admission.admissionDate, effectiveDischargeDate, s.chargeTime)
            : roomDays
          auto.push({
            key: key++, itemType: 'CUSTOM',
            description: `${s.name} (${qty} day${qty !== 1 ? 's' : ''})`,
            quantity: qty, unitPrice: price, totalPrice: qty * price,
          })
        }
      })

      // OT charges
      ;(Array.isArray(otRes?.data) ? otRes.data : []).forEach(inv => {
        ;(Array.isArray(inv.items) ? inv.items : []).forEach(item => {
          auto.push({
            key: key++, itemType: 'OT',
            description: item.description || item.name || 'OT Procedure',
            quantity: item.quantity ?? 1,
            unitPrice: item.totalPrice ?? item.amount ?? 0,
            totalPrice: item.totalPrice ?? item.amount ?? 0,
          })
        })
      })

      setItems(auto)
      setNextKey(key)
    }).catch(() => {
      notify('Could not load pending charges — add items manually', 'info')
    }).finally(() => setLoadingBill(false))
  }, [admission.id, user?.hospitalId])

  const addBlankItem = () => {
    setItems(prev => [...prev, { key: nextKey, itemType: 'CUSTOM', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }])
    setNextKey(k => k + 1)
  }
  const removeItem = key => setItems(prev => prev.filter(i => i.key !== key))
  const updateItem = (key, updates) => {
    setItems(prev => prev.map(item => {
      if (item.key !== key) return item
      const merged = { ...item, ...updates, fromOpd: item.fromOpd }
      if ('quantity' in updates || 'unitPrice' in updates)
        merged.totalPrice = (Number(merged.quantity) || 0) * (Number(merged.unitPrice) || 0)
      return merged
    }))
  }

  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.totalPrice || 0), 0), [items])
  const discountAmt = subtotal * (discountPct / 100)
  const medicineSubtotal = useMemo(
    () => items.filter(i => i.itemType === 'MEDICINE').reduce((s, i) => s + (i.totalPrice || 0), 0),
    [items]
  )
  const gst = (medicineSubtotal - medicineSubtotal * (discountPct / 100)) * GST_RATE
  const grandTotal = subtotal - discountAmt + gst

  const hasZeroPrice = items.some(i => Number(i.unitPrice) === 0 && i.itemType !== 'CUSTOM')
  const hasOpdCarryOver = useMemo(() => items.some(i => i.fromOpd), [items])

  const handleFinalizeAndPay = async () => {
    if (items.length === 0) { notify('Add at least one billing item', 'warning'); return }
    if (items.some(i => !i.description.trim())) { notify('All items need a description', 'error'); return }
    setSubmitting(true)
    try {
      const payload = {
        invoiceNumber: fallbackInvoiceNo,
        hospitalId: user.hospitalId,
        patientId: admission.patientId,
        admissionId: admission.id,
        subtotal,
        tax: gst,
        discount: discountAmt,
        total: grandTotal,
        notes: billNotes || `Discharge bill — Admission ${admission.admissionNumber}`,
        items: items.map(i => ({
          itemType: i.itemType,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          radiologyOrderId: i.radiologyOrderId ?? undefined,
          appointmentId: i.appointmentId ?? undefined,
        })),
      }

      let finalInvoiceId = invoiceId
      if (finalInvoiceId) {
        await invoiceApi.finalizeIPD(finalInvoiceId, payload)
      } else {
        const created = await invoiceApi.create({ ...payload, status: 'UNPAID' })
        finalInvoiceId = created.id
      }

      await invoiceApi.markAsPaid(finalInvoiceId, bankAccountId || undefined)
      notify('Bill finalized and payment recorded — patient can now be discharged', 'success')
      onFinalized()
    } catch (err) {
      notify(err?.response?.data?.message || 'Billing failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-[#2a2a2a] mb-8">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-500" /> Finalize IPD Bill
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
              {admission.patientName} · {admission.admissionNumber}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loadingBill ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium text-slate-600 dark:text-[#888]">Detecting all pending charges…</p>
            </div>
          ) : (
            <>
              {/* Items table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">Bill Items</p>
                    <p className="text-[11px] text-slate-400 dark:text-[#666] mt-0.5">
                      All pending charges auto-detected — review and adjust
                    </p>
                  </div>
                  <button onClick={addBlankItem} className="btn-secondary text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                {hasOpdCarryOver && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 mb-3">
                    <Stethoscope className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-400">OPD → IPD Conversion</p>
                      <p className="text-[11px] text-blue-600/80 dark:text-blue-300/70 mt-0.5">
                        This admission originated from an OPD consultation. The consultation charge has been carried over and is highlighted below.
                      </p>
                    </div>
                  </div>
                )}

                {items.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-[#2a2a2a] rounded-lg">
                    <p className="text-sm font-medium text-slate-500 dark:text-[#777]">No charges detected</p>
                    <p className="text-xs text-slate-400 dark:text-[#555] mt-1">Add items manually above</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 dark:bg-[#0f0f0f] border-b border-slate-100 dark:border-[#1a1a1a]">
                      {['Type', 'Description', 'Qty', 'Unit ₹', 'Total'].map((h, i) => (
                        <div key={h} className={`text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#666] ${i === 0 ? 'col-span-2' : i === 1 ? 'col-span-4' : i === 2 ? 'col-span-2 text-center' : i === 3 ? 'col-span-2 text-right' : 'col-span-2 text-right'}`}>{h}</div>
                      ))}
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                      {items.map(item => (
                        <div key={item.key} className={`grid grid-cols-12 gap-2 items-center px-4 py-2.5 group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-colors ${item.fromOpd ? 'border-l-2 border-blue-400 dark:border-blue-500/70 bg-blue-50/30 dark:bg-blue-500/5' : ''}`}>
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
                            <input className="input py-1.5 text-sm" placeholder="Description…" value={item.description}
                              onChange={e => updateItem(item.key, { description: e.target.value })} />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min={1} className="input py-1.5 text-sm text-center" value={item.quantity}
                              onChange={e => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })} />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min={0} step="0.01" className="input py-1.5 text-sm text-right" value={item.unitPrice}
                              onChange={e => updateItem(item.key, { unitPrice: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-1.5">
                            {item.fromOpd && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">OPD</span>
                            )}
                            <span className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">{fmt(item.totalPrice || 0)}</span>
                            <button onClick={() => removeItem(item.key)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 transition-all">
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
                          <span>Subtotal</span><span className="font-semibold tabular-nums">{fmt(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 dark:text-[#888]">
                          <span>Discount (%)</span>
                          <input type="number" min={0} max={100} className="input w-16 py-1 text-sm text-center"
                            value={discountPct} onChange={e => setDiscountPct(Math.min(100, parseFloat(e.target.value) || 0))} />
                        </div>
                        {discountAmt > 0 && (
                          <div className="flex justify-between text-rose-500 dark:text-rose-400">
                            <span>Discount</span><span className="tabular-nums">-{fmt(discountAmt)}</span>
                          </div>
                        )}
                        {medicineSubtotal > 0 && (
                          <div className="flex justify-between text-slate-500 dark:text-[#888]">
                            <span>GST on medicines (18%)</span><span className="tabular-nums">{fmt(gst)}</span>
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

              {hasZeroPrice && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Some items have ₹0 — check radiology charges. Add services in Settings → Packages if missing.
                  </p>
                </div>
              )}

              {/* Payment */}
              <div>
                <label className="label">Payment Method</label>
                <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {bankAccounts.length > 0 && (
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" /> Credit Payment To
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {bankAccounts.map(a => (
                      <button key={a.id} type="button" onClick={() => setBankAccountId(a.id)}
                        className={`text-left p-3 rounded-lg border-2 transition-all ${bankAccountId === a.id ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-[#1a1a1a]' : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-[#3a3a3a] bg-white dark:bg-[#111]'}`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{a.accountName}</p>
                          {bankAccountId === a.id && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-[#666]">
                          {a.accountNumber ? `···${a.accountNumber.slice(-4)}` : a.bankName || 'Cash'}
                        </p>
                        <p className="text-xs font-semibold text-slate-600 dark:text-[#aaa] mt-1 tabular-nums">{fmt(a.currentBalance)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Billing Notes (optional)</label>
                <input className="input" placeholder={`Discharge bill — Admission ${admission.admissionNumber}`}
                  value={billNotes} onChange={e => setBillNotes(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] rounded-b-xl">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleFinalizeAndPay}
            disabled={submitting || loadingBill || items.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              : <><CheckCircle2 className="w-4 h-4" /> Finalize & Mark as Paid</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
