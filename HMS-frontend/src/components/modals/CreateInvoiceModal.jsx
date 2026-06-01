import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import SearchableSelect from '@/components/ui/SearchableSelect'
import {
  patientApi, invoiceApi, bankApi, doctorsApi, hospitalServiceApi
} from '@/utils/api'
import { generateInvoiceNumber } from '@/utils/validators'
import { fmtId } from '@/utils/idFormat'
import {
  X, Info, Search, Plus, Trash2, Printer, BedDouble, ScanLine,
  Stethoscope, FlaskConical, Pill, Wrench, Loader2, Sparkles,
  CheckCircle2, Landmark, User
} from 'lucide-react'

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance']

// Cash → CASH-type drawer; UPI/Card/Bank Transfer → SAVINGS or CURRENT.
const PAYMENT_METHOD_TO_ACCOUNT_TYPES = {
  'Cash':          ['CASH'],
  'UPI':           ['SAVINGS', 'CURRENT'],
  'Card':          ['SAVINGS', 'CURRENT'],
  'Bank Transfer': ['SAVINGS', 'CURRENT'],
  'Insurance':     [],
}

function accountsForMethod(accounts, method) {
  const allowed = PAYMENT_METHOD_TO_ACCOUNT_TYPES[method] || []
  if (allowed.length === 0) return []
  return (accounts || []).filter(a => allowed.includes((a.accountType || '').toUpperCase()))
}
const GST_RATE = 0.18

function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TYPE_META = {
  MEDICINE:    { label: 'Medicine',     color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <Pill className="w-3 h-3" /> },
  LAB_TEST:    { label: 'Lab Test',     color: 'text-slate-900',   bg: 'bg-slate-100',   icon: <FlaskConical className="w-3 h-3" /> },
  CONSULTATION:{ label: 'Consultation', color: 'text-blue-700',       bg: 'bg-blue-100',       icon: <Stethoscope className="w-3 h-3" /> },
  ROOM_CHARGE: { label: 'Room',         color: 'text-orange-700',   bg: 'bg-orange-100',   icon: <BedDouble className="w-3 h-3" /> },
  RADIOLOGY:   { label: 'Radiology',    color: 'text-slate-900',   bg: 'bg-slate-100',   icon: <ScanLine className="w-3 h-3" /> },
  CUSTOM:      { label: 'Custom',       color: 'text-slate-600',     bg: 'bg-slate-100',        icon: <Wrench className="w-3 h-3" /> },
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
    doctorsApi.list(user.hospitalId).then(docs => setDoctors(docs.filter(d => d.userIsActive))).catch(() => {})
    hospitalServiceApi.list(user.hospitalId).then(setServices).catch(() => {})
    bankApi.list(user.hospitalId).then(accounts => {
      setBankAccounts(accounts)
      // Pre-select default for initial Cash payment method
      const eligible = accountsForMethod(accounts, 'Cash')
      const def = eligible.find(a => a.isDefault) ?? eligible[0]
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
      const data = await invoiceApi.getSmartSuggestions(p.id)
      setSuggestions(data)
    } catch {
      setSuggestions(null)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const addAllDetected = () => {
    if (!suggestions) return
    const toAdd = []
    const newAdded = new Set(addedSuggestions)
    let key = nextKey

    if (suggestions.roomCharge && !addedSuggestions.has(`room-${suggestions.roomCharge.roomNumber}`)) {
      const r = suggestions.roomCharge
      const k = `room-${r.roomNumber}`
      toAdd.push({ key: key++, itemType: 'ROOM_CHARGE', description: `Room ${r.roomNumber} (${r.roomType}) — ${r.daysStayed} day${r.daysStayed !== 1 ? 's' : ''}`, quantity: Number(r.daysStayed), unitPrice: r.pricePerDay, totalPrice: r.totalCharge })
      newAdded.add(k)
    }
    suggestions.appointments?.forEach(a => {
      const k = `appt-${a.appointmentId}`
      if (!addedSuggestions.has(k)) {
        toAdd.push({ key: key++, itemType: 'CONSULTATION', description: `Consultation — ${a.doctorName}${a.specialization ? ` (${a.specialization})` : ''}`, quantity: 1, unitPrice: a.consultationFee, totalPrice: a.consultationFee, appointmentId: a.appointmentId })
        newAdded.add(k)
      }
    })
    suggestions.radiologyOrders?.forEach(r => {
      const k = `radiology-${r.orderId}`
      if (!addedSuggestions.has(k)) {
        const match = services.find(s => s.name.toLowerCase() === r.serviceName?.toLowerCase())
        const price = match?.price ?? 0
        toAdd.push({ key: key++, itemType: 'RADIOLOGY', description: r.serviceName, quantity: 1, unitPrice: price, totalPrice: price, radiologyOrderId: r.orderId })
        newAdded.add(k)
      }
    })

    if (toAdd.length === 0) return
    setItems(prev => [...prev, ...toAdd])
    setNextKey(key)
    setAddedSuggestions(newAdded)
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
        referredById: referredById || undefined,
        items: items.map(i => ({
          itemType: i.itemType,
          serviceId: i.serviceId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
          radiologyOrderId: i.radiologyOrderId ?? undefined,
          appointmentId: i.appointmentId ?? undefined,
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

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all'
  const cardCls = 'bg-white border border-slate-200 rounded-lg p-5'
  const sectionNum = (n) => (
    <span className="w-4 h-4 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center shrink-0">{n}</span>
  )

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-50 rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">

          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create New Invoice</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Invoice #{invoiceNo} · Smart billing with auto-detection
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            <div className="flex gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Selecting a patient auto-detects active room charges, pending radiology orders, and recent consultations.
              </p>
            </div>

            {/* 1 — Select Patient */}
            <div className={cardCls}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                {sectionNum(1)} Select Patient
              </p>
              {patient ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{patient.firstName} {patient.lastName}</p>
                      <p className="text-xs text-emerald-600">{fmtId(patient.uhid)}{patient.phone ? ` · ${patient.phone}` : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setPatient(null); setSuggestions(null) }} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input className={`${inputCls} pl-9`} placeholder="Search by name or UHID…"
                    value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />}
                  {patientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 overflow-hidden">
                      {patientResults.map(p => (
                        <button key={p.id} type="button" onClick={() => selectPatient(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                          <p className="text-sm font-semibold text-slate-800">{p.firstName} {p.lastName}</p>
                          <p className="text-xs text-slate-400">{fmtId(p.uhid)}</p>
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
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Detected Pending Items
                    {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                  </p>
                  {!loadingSuggestions && hasSuggestions && (
                    <button
                      onClick={addAllDetected}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                    >
                      + Add All
                    </button>
                  )}
                </div>
                {!loadingSuggestions && suggestions && (
                  <div className="space-y-2">
                    {suggestions.roomCharge && (() => {
                      const r = suggestions.roomCharge
                      const key = `room-${r.roomNumber}`
                      const added = addedSuggestions.has(key)
                      return (
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                              <BedDouble className="w-3.5 h-3.5 text-orange-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Room {r.roomNumber} — {r.roomType.replace('_', ' ')}</p>
                              <p className="text-xs text-slate-400">{fmt(r.pricePerDay)}/day × {r.daysStayed} day{r.daysStayed !== 1 ? 's' : ''} = <span className="font-semibold">{fmt(r.totalCharge)}</span></p>
                            </div>
                          </div>
                          <button
                            onClick={() => !added && addItem({ itemType: 'ROOM_CHARGE', description: `Room ${r.roomNumber} (${r.roomType}) — ${r.daysStayed} day${r.daysStayed !== 1 ? 's' : ''}`, quantity: Number(r.daysStayed), unitPrice: r.pricePerDay, totalPrice: r.totalCharge }, key)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${added ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>
                            {added ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      )
                    })()}
                    {suggestions.radiologyOrders?.map(r => {
                      const key = `radiology-${r.orderId}`
                      const added = addedSuggestions.has(key)
                      const catalogMatch = services.find(s => s.name.toLowerCase() === r.serviceName?.toLowerCase())
                      const price = catalogMatch?.price ?? 0
                      return (
                        <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <ScanLine className="w-3.5 h-3.5 text-slate-900" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{r.serviceName}</p>
                              <p className="text-xs text-slate-400">
                                {r.status?.replace('_', ' ')}{r.scheduledDate ? ` · ${r.scheduledDate}` : ''}
                                {price > 0 ? ` · ${fmt(price)}` : ' · ₹0 — add service price in catalog'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => !added && addItem({ itemType: 'RADIOLOGY', description: r.serviceName, quantity: 1, unitPrice: price, totalPrice: price, radiologyOrderId: r.orderId }, key)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${added ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-slate-900 hover:bg-slate-900 text-white'}`}>
                            {added ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      )
                    })}
                    {suggestions.appointments?.map(a => {
                      const key = `appt-${a.appointmentId}`
                      const added = addedSuggestions.has(key)
                      return (
                        <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                              <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{a.doctorName}{a.specialization ? ` — ${a.specialization}` : ''}</p>
                              <p className="text-xs text-slate-400">Consultation · {a.apptDate} · <span className="font-semibold">{fmt(a.consultationFee)}</span></p>
                            </div>
                          </div>
                          <button
                            onClick={() => !added && addItem({ itemType: 'CONSULTATION', description: `Consultation — ${a.doctorName}${a.specialization ? ` (${a.specialization})` : ''}`, quantity: 1, unitPrice: a.consultationFee, totalPrice: a.consultationFee, appointmentId: a.appointmentId }, key)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${added ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
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
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                {sectionNum(2)} Referred By <span className="font-normal normal-case text-slate-400">(Optional)</span>
              </p>
              <SearchableSelect
                className={inputCls}
                value={referredById}
                onChange={val => setReferredById(val)}
                options={[
                  { value: '', label: 'Self / Walk-in (No Referral)' },
                  ...doctors.map(d => ({
                    value: d.id,
                    label: `Dr. ${d.firstName} ${d.lastName}${d.specialization ? ` — ${d.specialization}` : ''}`,
                  })),
                ]}
              />
            </div>

            {/* 3 — Add Tests & Services */}
            <div className={cardCls}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                {sectionNum(3)} Add Tests &amp; Services
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                    <FlaskConical className="w-3 h-3 text-slate-700" /> Search Lab / Services
                  </label>
                  <div className="relative">
                    <input className={inputCls} placeholder="Search by test name…"
                      value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} />
                    {serviceResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                        {serviceResults.map(s => (
                          <button key={s.id} type="button" onClick={() => {
                            addItem({ itemType: 'LAB_TEST', serviceId: s.id, description: s.name, quantity: 1, unitPrice: s.price, totalPrice: s.price })
                            setServiceSearch('')
                            setServiceResults([])
                          }} className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                            <p className="text-xs text-slate-400">{fmt(s.price)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                    <Pill className="w-3 h-3 text-emerald-500" /> Add Medicine
                  </label>
                  <button onClick={() => addItem({ itemType: 'MEDICINE', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-dashed border-emerald-300 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors text-left">
                    + Add medicine item manually
                  </button>
                </div>
              </div>
            </div>

            {/* 4 — Invoice Items */}
            <div className={cardCls}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  {sectionNum(4)} Invoice Items
                </p>
                <button onClick={() => addItem({ itemType: 'CUSTOM', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 })}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  <Plus className="w-3 h-3" /> Add Custom Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-600 border-2 border-dashed border-slate-100 rounded-lg">
                  No items yet — detect from patient or add manually
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 px-1">
                    <div className="col-span-1">Type</div>
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Unit ₹</div>
                    <div className="col-span-2 text-right">Total ₹</div>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {items.map(item => (
                      <div key={item.key} className="grid grid-cols-12 gap-2 items-center py-2 group px-1">
                        <div className="col-span-1">
                          <SearchableSelect
                            className="w-full text-[10px] rounded border border-slate-100 bg-slate-50 px-1 py-1 text-slate-700 focus:outline-none"
                            value={item.itemType ?? 'CUSTOM'}
                            onChange={val => updateItem(item.key, { itemType: val })}
                            options={Object.keys(TYPE_META).map(k => ({ value: k, label: TYPE_META[k].label }))}
                          />
                        </div>
                        <div className="col-span-5">
                          <input className="w-full px-2 py-1.5 rounded-lg border border-slate-100 bg-white text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                            placeholder="Description…" value={item.description} onChange={e => updateItem(item.key, { description: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min={1} className="w-full text-center px-2 py-1.5 rounded-lg border border-slate-100 bg-white text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                            value={item.quantity} onChange={e => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min={0} className="w-full text-right px-2 py-1.5 rounded-lg border border-slate-100 bg-white text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                            value={item.unitPrice} onChange={e => updateItem(item.key, { unitPrice: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <span className="text-sm font-bold text-slate-800">{fmt(item.totalPrice || 0)}</span>
                          <button onClick={() => removeItem(item.key)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-500 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                    <div className="w-56 space-y-2">
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal:</span><span className="font-semibold">{fmt(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <span>Discount (%):</span>
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} max={100} value={discountPct}
                            onChange={e => setDiscountPct(Math.min(100, parseFloat(e.target.value) || 0))}
                            className="w-14 text-center px-2 py-1 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none" />
                          <span className="text-red-500 font-semibold">-{fmt(discountAmt)}</span>
                        </div>
                      </div>
                      {medicineTotal > 0 && (
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>GST Medicines (18%):</span><span className="font-semibold">{fmt(gstOnMedicines)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-100">
                        <span>Grand Total:</span><span className="text-blue-600">{fmt(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 5 — Payment Details */}
            <div className={cardCls}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                {sectionNum(5)} Payment Details
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Payment Method</label>
                  <SearchableSelect
                    className={inputCls}
                    value={paymentMethod}
                    onChange={val => {
                      setPaymentMethod(val)
                      const eligible = accountsForMethod(bankAccounts, val)
                      const def = eligible.find(a => a.isDefault) ?? eligible[0]
                      setBankAccountId(def ? def.id : '')
                    }}
                    options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Notes (optional)</label>
                  <input className={inputCls} placeholder="Additional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
              {(() => {
                const eligibleAccounts = accountsForMethod(bankAccounts, paymentMethod)
                const allowedTypes = PAYMENT_METHOD_TO_ACCOUNT_TYPES[paymentMethod] || []
                if (allowedTypes.length === 0) return null
                if (eligibleAccounts.length === 0) {
                  return (
                    <div className="px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-700">
                      No {paymentMethod === 'Cash' ? 'CASH' : 'SAVINGS / CURRENT'} account found. Configure banks in the Finance app to track this payment.
                    </div>
                  )
                }
                return (
                  <div>
                    <label className="block text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5" /> Credit payment to
                      <span className="ml-1 text-[10px] text-slate-300">
                        ({paymentMethod === 'Cash' ? 'CASH only' : 'SAVINGS / CURRENT only'})
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {eligibleAccounts.map(a => {
                        const isSelected = bankAccountId === a.id
                        return (
                          <button key={a.id} type="button" onClick={() => setBankAccountId(a.id)}
                            className={`text-left p-3 rounded-lg border-2 transition-all ${isSelected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-xs font-bold truncate text-slate-700">{a.accountName}</p>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{a.bankName ?? 'Bank'} · ···{a.accountNumber.slice(-4)}</p>
                            <p className="text-xs font-bold mt-1.5 text-slate-600">{fmt(a.currentBalance)}</p>
                          </button>
                        )
                      })}
                    </div>
                    {selectedAccount && (
                      <p className="text-xs text-slate-400 mt-2">
                        After payment: <span className="font-semibold text-slate-900">{fmt(selectedAccount.currentBalance + grandTotal)}</span>
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>

          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0">
            <button onClick={handleSubmit} disabled={saving || !patient || items.length === 0}
              className="btn-primary w-full justify-center disabled:opacity-50">
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
            <p className="text-gray-500">{new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-4 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bill To</p>
          <p className="font-bold">{patient?.firstName} {patient?.lastName}</p>
          <p className="text-sm text-gray-500">{fmtId(patient?.uhid)}</p>
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
