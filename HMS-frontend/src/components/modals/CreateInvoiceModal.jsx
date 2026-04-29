import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import {
  patientApi, invoiceApi, bankApi, doctorsApi, hospitalServiceApi
} from '@/utils/api'
import { generateInvoiceNumber } from '@/utils/validators'
import {
  X, Info, Search, Plus, Trash2, Printer, BedDouble, ScanLine,
  Stethoscope, FlaskConical, Pill, Wrench, Loader2, Sparkles,
  CheckCircle2, Landmark, User
} from 'lucide-react'

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance', 'Cheque']
const GST_RATE = 0.18

function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TYPE_META = {
  MEDICINE:    { label: 'Medicine',     color: 'text-slate-900 dark:text-white dark:text-slate-300', bg: 'bg-emerald-100 dark:bg-emerald-500/20', icon: <Pill className="w-3 h-3" /> },
  LAB_TEST:    { label: 'Lab Test',     color: 'text-violet-700 dark:text-violet-400',   bg: 'bg-violet-100 dark:bg-violet-500/20',   icon: <FlaskConical className="w-3 h-3" /> },
  CONSULTATION:{ label: 'Consultation', color: 'text-blue-700 dark:text-blue-400',       bg: 'bg-blue-100 dark:bg-blue-500/20',       icon: <Stethoscope className="w-3 h-3" /> },
  ROOM_CHARGE: { label: 'Room',         color: 'text-orange-700 dark:text-orange-400',   bg: 'bg-orange-100 dark:bg-orange-500/20',   icon: <BedDouble className="w-3 h-3" /> },
  RADIOLOGY:   { label: 'Radiology',    color: 'text-purple-700 dark:text-purple-400',   bg: 'bg-purple-100 dark:bg-purple-500/20',   icon: <ScanLine className="w-3 h-3" /> },
  CUSTOM:      { label: 'Custom',       color: 'text-slate-600 dark:text-[#aaaaaa]',     bg: 'bg-slate-100 dark:bg-[#222222]',        icon: <Wrench className="w-3 h-3" /> },
}

function TypeBadge({ type }) {
  if (!type) return null
  const m = TYPE_META[type] ?? TYPE_META.CUSTOM
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.color} ${m.bg}`}>
      {m.icon}
    </span>
  )
}

export default function CreateInvoiceModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const { notify } = useNotification()

  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [patient, setPatient] = useState(null)

  const [suggestions, setSuggestions] = useState(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [addedSuggestions, setAddedSuggestions] = useState(new Set())

  const [doctors, setDoctors] = useState([])
  const [referredById, setReferredById] = useState('')
  const [services, setServices] = useState([])
  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceResults, setServiceResults] = useState([])

  const [items, setItems] = useState([])
  const [nextKey, setNextKey] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [invoiceNo] = useState(generateInvoiceNumber)
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankAccountId, setBankAccountId] = useState('')

  useEffect(() => {
    if (!user?.hospitalId) return
    doctorsApi.list(user.hospitalId).then(setDoctors).catch(() => {})
    hospitalServiceApi.list(user.hospitalId).then(setServices).catch(() => {})
    bankApi.list(user.hospitalId).then(accounts => {
      setBankAccounts(accounts)
      const def = accounts.find(a => a.isDefault) ?? accounts[0]
      if (def) setBankAccountId(def.id)
    }).catch(() => {})
  }, [user?.hospitalId])

  useEffect(() => {
    if (!patientSearch.trim() || patientSearch.length < 2 || !user?.hospitalId) {
      setPatientResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        setPatientResults((await patientApi.search(user.hospitalId, patientSearch)).slice(0, 6))
      } catch {
        setPatientResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [patientSearch, user?.hospitalId])

  useEffect(() => {
    if (!serviceSearch.trim()) { setServiceResults([]); return }
    const q = serviceSearch.toLowerCase()
    setServiceResults(services.filter(s => s.isActive && s.name.toLowerCase().includes(q)).slice(0, 6))
  }, [serviceSearch, services])

  const selectPatient = async (p) => {
    setPatient(p)
    setPatientResults([])
    setPatientSearch('')
    setAddedSuggestions(new Set())
    setSuggestions(null)
    setLoadingSuggestions(true)
    try {
      setSuggestions(await invoiceApi.getSmartSuggestions(p.id))
    } catch {
      setSuggestions(null)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const addItem = (item, suggKey) => {
    const key = nextKey
    setNextKey(k => k + 1)
    setItems(prev => [...prev, { ...item, key }])
    if (suggKey) setAddedSuggestions(prev => new Set([...prev, suggKey]))
  }

  const removeItem = (key) => setItems(prev => prev.filter(i => i.key !== key))

  const updateItem = (key, updates) => {
    setItems(prev => prev.map(item => {
      if (item.key !== key) return item
      const merged = { ...item, ...updates }
      if (updates.quantity !== undefined || updates.unitPrice !== undefined)
        merged.totalPrice = (merged.quantity || 0) * (merged.unitPrice || 0)
      return merged
    }))
  }

  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.totalPrice || 0), 0), [items])
  const discountAmt = subtotal * (discountPct / 100)
  const medicineTotal = items.filter(i => i.itemType === 'MEDICINE').reduce((s, i) => s + (i.totalPrice || 0), 0)
  const gstOnMedicines = (medicineTotal - medicineTotal * (discountPct / 100)) * GST_RATE
  const grandTotal = subtotal - discountAmt + gstOnMedicines

  const hasSuggestions = suggestions && (
    suggestions.roomCharge || suggestions.radiologyOrders?.length > 0 || suggestions.appointments?.length > 0
  )

  const selectedAccount = bankAccounts.find(a => a.id === bankAccountId)

  const handleSubmit = async () => {
    if (!patient || !user?.hospitalId) { notify('Select a patient first', 'warning'); return }
    if (items.length === 0) { notify('Add at least one item', 'warning'); return }
    if (items.some(i => !i.description.trim())) { notify('Fill all item descriptions', 'error'); return }
    setSaving(true)
    try {
      await invoiceApi.create({
        invoiceNumber: invoiceNo,
        hospitalId: user.hospitalId,
        patientId: patient.id,
        subtotal,
        tax: gstOnMedicines,
        discount: discountAmt,
        total: grandTotal,
        paymentMethod,
        notes,
        status: 'UNPAID',
        bankAccountId: bankAccountId || undefined,
        items: items.map(i => ({
          itemType: i.itemType,
          serviceId: i.serviceId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      })
      notify('Invoice created successfully', 'success')
      onCreated?.()
      onClose()
      window.print()
    } catch {
      notify('Failed to create invoice', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm text-slate-900 dark:text-[#dddddd] focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all'
  const cardCls = 'bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-5'
  const sectionNum = (n) => (
    <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-[#222222] text-[10px] font-bold text-slate-600 dark:text-[#aaaaaa] flex items-center justify-center shrink-0">{n}</span>
  )

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-50 dark:bg-[#0d0d0d] rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#2a2a2a]">

          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#1e1e1e] bg-white dark:bg-[#111111] shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Invoice</h2>
              <p className="text-xs text-slate-400 dark:text-[#666] mt-0.5">
                Invoice #{invoiceNo} · Smart billing with auto-detection
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            <div className="flex gap-3 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Selecting a patient auto-detects active room charges, pending radiology orders, and recent consultations.
              </p>
            </div>

            {/* 1 — Select Patient */}
            <div className={cardCls}>
              <p className="text-xs font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider mb-3 flex items-center gap-2">
                {sectionNum(1)} Select Patient
              </p>
              {patient ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-emerald-200 dark:border-slate-900 dark:border-white/30 bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-900 dark:text-white dark:text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{patient.firstName} {patient.lastName}</p>
                      <p className="text-xs text-slate-900 dark:text-white dark:text-slate-900 dark:text-white">{patient.mrn}{patient.phone ? ` · ${patient.phone}` : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setPatient(null); setSuggestions(null) }} className="p-1 text-slate-900 dark:text-white hover:text-slate-900 dark:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input className={`${inputCls} pl-9`} placeholder="Search by name or MRN…"
                    value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />}
                  {patientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg shadow-xl z-30 overflow-hidden">
                      {patientResults.map(p => (
                        <button key={p.id} type="button" onClick={() => selectPatient(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors border-b border-slate-100 dark:border-[#1e1e1e] last:border-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{p.firstName} {p.lastName}</p>
                          <p className="text-xs text-slate-400">{p.mrn}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Smart Suggestions */}
            {patient && (loadingSuggestions || hasSuggestions) && (
              <div className={cardCls}>
                <p className="text-xs font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Detected Pending Items
                  {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                </p>
                {!loadingSuggestions && suggestions && (
                  <div className="space-y-2">
                    {suggestions.roomCharge && (() => {
                      const r = suggestions.roomCharge
                      const key = `room-${r.roomNumber}`
                      const added = addedSuggestions.has(key)
                      return (
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
                              <BedDouble className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">Room {r.roomNumber} — {r.roomType.replace('_', ' ')}</p>
                              <p className="text-xs text-slate-400">{fmt(r.pricePerDay)}/day × {r.daysStayed} day{r.daysStayed !== 1 ? 's' : ''} = <span className="font-semibold">{fmt(r.totalCharge)}</span></p>
                            </div>
                          </div>
                          <button
                            onClick={() => !added && addItem({ itemType: 'ROOM_CHARGE', description: `Room ${r.roomNumber} (${r.roomType}) — ${r.daysStayed} day${r.daysStayed !== 1 ? 's' : ''}`, quantity: Number(r.daysStayed), unitPrice: r.pricePerDay, totalPrice: r.totalCharge }, key)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${added ? 'bg-slate-100 dark:bg-[#222222] text-slate-400 cursor-default' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>
                            {added ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      )
                    })()}
                    {suggestions.radiologyOrders?.map(r => {
                      const key = `radiology-${r.orderId}`
                      const added = addedSuggestions.has(key)
                      return (
                        <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                              <ScanLine className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{r.serviceName}</p>
                              <p className="text-xs text-slate-400">{r.status?.replace('_', ' ')}{r.scheduledDate ? ` · ${r.scheduledDate}` : ''}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => !added && addItem({ itemType: 'RADIOLOGY', description: r.serviceName, quantity: 1, unitPrice: 0, totalPrice: 0 }, key)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${added ? 'bg-slate-100 dark:bg-[#222222] text-slate-400 cursor-default' : 'bg-violet-500 hover:bg-violet-600 text-white'}`}>
                            {added ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      )
                    })}
                    {suggestions.appointments?.map(a => {
                      const key = `appt-${a.appointmentId}`
                      const added = addedSuggestions.has(key)
                      return (
                        <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                              <Stethoscope className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{a.doctorName}{a.specialization ? ` — ${a.specialization}` : ''}</p>
                              <p className="text-xs text-slate-400">Consultation · {a.apptDate} · <span className="font-semibold">{fmt(a.consultationFee)}</span></p>
                            </div>
                          </div>
                          <button
                            onClick={() => !added && addItem({ itemType: 'CONSULTATION', description: `Consultation — ${a.doctorName}${a.specialization ? ` (${a.specialization})` : ''}`, quantity: 1, unitPrice: a.consultationFee, totalPrice: a.consultationFee }, key)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${added ? 'bg-slate-100 dark:bg-[#222222] text-slate-400 cursor-default' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                            {added ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2 — Referred By */}
            <div className={cardCls}>
              <p className="text-xs font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider mb-3 flex items-center gap-2">
                {sectionNum(2)} Referred By <span className="font-normal normal-case text-slate-400">(Optional)</span>
              </p>
              <select className={inputCls} value={referredById} onChange={e => setReferredById(e.target.value)}>
                <option value="">Self / Walk-in (No Referral)</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.firstName} {d.lastName}{d.specialization ? ` — ${d.specialization}` : ''}</option>
                ))}
              </select>
            </div>

            {/* 3 — Add Tests & Services */}
            <div className={cardCls}>
              <p className="text-xs font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider mb-3 flex items-center gap-2">
                {sectionNum(3)} Add Tests &amp; Services
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 dark:text-[#666666] mb-1.5 flex items-center gap-1">
                    <FlaskConical className="w-3 h-3 text-violet-500" /> Search Lab / Services
                  </label>
                  <div className="relative">
                    <input className={inputCls} placeholder="Search by test name…"
                      value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} />
                    {serviceResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg shadow-xl z-20 overflow-hidden">
                        {serviceResults.map(s => (
                          <button key={s.id} type="button" onClick={() => {
                            addItem({ itemType: 'LAB_TEST', serviceId: s.id, description: s.name, quantity: 1, unitPrice: s.price, totalPrice: s.price })
                            setServiceSearch('')
                            setServiceResults([])
                          }} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors border-b border-slate-100 dark:border-[#1e1e1e] last:border-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{s.name}</p>
                            <p className="text-xs text-slate-400">{fmt(s.price)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 dark:text-[#666666] mb-1.5 flex items-center gap-1">
                    <Pill className="w-3 h-3 text-slate-900 dark:text-white" /> Add Medicine
                  </label>
                  <button onClick={() => addItem({ itemType: 'MEDICINE', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-dashed border-emerald-300 dark:border-slate-900 dark:border-white/30 text-sm text-slate-900 dark:text-white dark:text-slate-300 hover:bg-slate-100 dark:bg-[#1e1e1e] dark:hover:bg-slate-500/10 transition-colors text-left">
                    + Add medicine item manually
                  </button>
                </div>
              </div>
            </div>

            {/* 4 — Invoice Items */}
            <div className={cardCls}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider flex items-center gap-2">
                  {sectionNum(4)} Invoice Items
                </p>
                <button onClick={() => addItem({ itemType: 'CUSTOM', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 })}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors">
                  <Plus className="w-3 h-3" /> Add Custom Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400 dark:text-[#555555] border-2 border-dashed border-slate-100 dark:border-[#1e1e1e] rounded-lg">
                  No items yet — detect from patient or add manually
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-100 dark:border-[#1e1e1e] text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555555] px-1">
                    <div className="col-span-1">Type</div>
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Unit ₹</div>
                    <div className="col-span-2 text-right">Total ₹</div>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                    {items.map(item => (
                      <div key={item.key} className="grid grid-cols-12 gap-2 items-center py-2 group px-1">
                        <div className="col-span-1">
                          <select className="w-full text-[10px] rounded border border-slate-100 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-1 py-1 text-slate-700 dark:text-[#cccccc] focus:outline-none"
                            value={item.itemType ?? 'CUSTOM'} onChange={e => updateItem(item.key, { itemType: e.target.value })}>
                            {Object.keys(TYPE_META).map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                          </select>
                        </div>
                        <div className="col-span-5">
                          <input className="w-full px-2 py-1.5 rounded-lg border border-slate-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-sm text-slate-800 dark:text-[#dddddd] focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                            placeholder="Description…" value={item.description} onChange={e => updateItem(item.key, { description: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min={1} className="w-full text-center px-2 py-1.5 rounded-lg border border-slate-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-sm text-slate-800 dark:text-[#dddddd] focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                            value={item.quantity} onChange={e => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min={0} className="w-full text-right px-2 py-1.5 rounded-lg border border-slate-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-sm text-slate-800 dark:text-[#dddddd] focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                            value={item.unitPrice} onChange={e => updateItem(item.key, { unitPrice: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <span className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">{fmt(item.totalPrice || 0)}</span>
                          <button onClick={() => removeItem(item.key)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-500 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1e1e1e] flex justify-end">
                    <div className="w-56 space-y-2">
                      <div className="flex justify-between text-sm text-slate-500 dark:text-[#888888]">
                        <span>Subtotal:</span><span className="font-semibold">{fmt(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-[#888888]">
                        <span>Discount (%):</span>
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} max={100} value={discountPct}
                            onChange={e => setDiscountPct(Math.min(100, parseFloat(e.target.value) || 0))}
                            className="w-14 text-center px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-sm focus:outline-none" />
                          <span className="text-red-500 font-semibold">-{fmt(discountAmt)}</span>
                        </div>
                      </div>
                      {medicineTotal > 0 && (
                        <div className="flex justify-between text-sm text-slate-500 dark:text-[#888888]">
                          <span>GST Medicines (18%):</span><span className="font-semibold">{fmt(gstOnMedicines)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-[#1e1e1e]">
                        <span>Grand Total:</span><span className="text-blue-600 dark:text-blue-400">{fmt(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 5 — Payment Details */}
            <div className={cardCls}>
              <p className="text-xs font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider mb-4 flex items-center gap-2">
                {sectionNum(5)} Payment Details
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 dark:text-[#666666] mb-1.5">Payment Method</label>
                  <select className={inputCls} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 dark:text-[#666666] mb-1.5">Notes (optional)</label>
                  <input className={inputCls} placeholder="Additional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
              {bankAccounts.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-400 dark:text-[#666666] mb-2 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" /> Credit payment to
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {bankAccounts.map(a => {
                      const isSelected = bankAccountId === a.id
                      return (
                        <button key={a.id} type="button" onClick={() => setBankAccountId(a.id)}
                          className={`text-left p-3 rounded-lg border-2 transition-all ${isSelected ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10' : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-[#3a3a3a] bg-white dark:bg-[#1a1a1a]'}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-slate-900 dark:text-white dark:text-slate-300' : 'text-slate-700 dark:text-[#cccccc]'}`}>{a.accountName}</p>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-[#666666] truncate">{a.bankName ?? 'Bank'} · ···{a.accountNumber.slice(-4)}</p>
                          <p className={`text-xs font-bold mt-1.5 ${isSelected ? 'text-slate-900 dark:text-white dark:text-slate-300' : 'text-slate-600 dark:text-[#aaaaaa]'}`}>{fmt(a.currentBalance)}</p>
                        </button>
                      )
                    })}
                  </div>
                  {selectedAccount && (
                    <p className="text-xs text-slate-400 dark:text-[#666666] mt-2">
                      After payment: <span className="font-semibold text-slate-900 dark:text-white dark:text-slate-300">{fmt(selectedAccount.currentBalance + grandTotal)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>

          <div className="px-6 py-4 border-t border-slate-200 dark:border-[#1e1e1e] bg-white dark:bg-[#111111] shrink-0">
            <button onClick={handleSubmit} disabled={saving || !patient || items.length === 0}
              className="w-full py-3 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-900 dark:bg-white disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {saving ? 'Generating…' : 'Generate Invoice & Print'}
            </button>
          </div>
        </div>
      </div>

      {/* Print view — rendered outside modal so window.print() captures it */}
      <div className="hidden print:block bg-white text-black p-8 fixed inset-0 z-[100]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tax Invoice</h1>
            <p className="text-sm text-gray-500 mt-1">{user?.hospitalName}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold text-lg">#{invoiceNo}</p>
            <p className="text-gray-500">{new Date().toLocaleDateString('en-IN')}</p>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-4 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bill To</p>
          <p className="font-bold">{patient?.firstName} {patient?.lastName}</p>
          <p className="text-sm text-gray-500">{patient?.mrn}</p>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2">Description</th>
              <th className="text-center py-2 w-16">Qty</th>
              <th className="text-right py-2 w-24">Unit Price</th>
              <th className="text-right py-2 w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-1.5">{i.description}</td>
                <td className="text-center py-1.5">{i.quantity}</td>
                <td className="text-right py-1.5">{fmt(i.unitPrice)}</td>
                <td className="text-right py-1.5">{fmt(i.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 text-right space-y-1 text-sm">
          <p>Subtotal: {fmt(subtotal)}</p>
          {discountAmt > 0 && <p>Discount ({discountPct}%): -{fmt(discountAmt)}</p>}
          {gstOnMedicines > 0 && <p>GST on Medicines (18%): {fmt(gstOnMedicines)}</p>}
          <p className="text-lg font-bold border-t border-gray-300 pt-2 mt-2">Grand Total: {fmt(grandTotal)}</p>
          <p className="text-sm text-gray-500">Payment: {paymentMethod}</p>
        </div>
      </div>
    </>
  )
}
