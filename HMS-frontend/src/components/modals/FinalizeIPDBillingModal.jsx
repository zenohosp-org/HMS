import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import SSOCookieManager from '@/utils/ssoManager'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { invoiceApi, bankApi, hospitalServiceApi, patientServicesApi, radiologyApi, ambulanceApi, patientAdvanceApi } from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { generateInvoiceNumber } from '@/utils/validators'
import {
  X, Receipt, CheckCircle2, Loader2, AlertCircle, Plus, Trash2,
  BedDouble, ScanLine, Stethoscope, Pill, FlaskConical, Wrench,
  Scissors, Landmark, Wallet, IndianRupee, Clock, UserCheck,
  Ambulance,
} from 'lucide-react'

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance']
const GST_RATE = 0.18

// Cash → CASH-type drawer; UPI/Card/Bank Transfer → SAVINGS or CURRENT.
// Insurance is settled separately; no on-the-spot account credit.
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

const TYPE_META = {
  ROOM_CHARGE:  { label: 'Room',         icon: BedDouble   },
  CONSULTATION: { label: 'Consultation', icon: Stethoscope },
  RADIOLOGY:    { label: 'Radiology',    icon: ScanLine    },
  LAB_TEST:     { label: 'Lab Test',     icon: FlaskConical},
  MEDICINE:     { label: 'Medicine',     icon: Pill        },
  OT:           { label: 'OT / Surgery', icon: Scissors    },
  CUSTOM:       { label: 'Custom',       icon: Wrench      },
  REGISTRATION: { label: 'Registration', icon: UserCheck   },
  AMBULANCE:    { label: 'Ambulance',    icon: Ambulance   },
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

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
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
  const [invoiceStatus, setInvoiceStatus] = useState('UNSETTLED')
  const [loadingBill, setLoadingBill] = useState(true)
  const [items, setItems] = useState([])
  const [nextKey, setNextKey] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)
  const [bankAccounts, setBankAccounts] = useState([])
  const [billNotes, setBillNotes] = useState('')
  const [advances, setAdvances] = useState([])
  const [existingPayments, setExistingPayments] = useState([])

  // Collect payment section
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Cash')
  const [payBankAccountId, setPayBankAccountId] = useState('')

  const [savingBill, setSavingBill] = useState(false)
  const [collectingPayment, setCollectingPayment] = useState(false)
  const [fallbackInvoiceNo] = useState(generateInvoiceNumber)

  // Credit patient early payment override
  const [showEarlyCollect, setShowEarlyCollect] = useState(false)

  const effectiveDischargeDate = new Date().toISOString()

  useEffect(() => {
    if (!user?.hospitalId || !admission.patientId) return
    setLoadingBill(true)

    const admitMs = new Date(admission.admissionDate).getTime()
    const dischargeMs = new Date(effectiveDischargeDate).getTime()
    const elapsedMs = dischargeMs - admitMs
    const roomDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))

    Promise.all([
      invoiceApi.getSmartSuggestions(admission.patientId, admission.id).catch(() => ({})),
      hospitalServiceApi.list(user.hospitalId).catch(() => []),
      bankApi.list(user.hospitalId).catch(() => []),
      radiologyApi.getByAdmission(admission.id).catch(() => []),
      patientServicesApi.list(user.hospitalId).catch(() => []),
      otApi.get('/api/ot/invoices', { params: { admissionId: admission.id } }).catch(() => ({ data: [] })),
      invoiceApi.getAdmissionInvoice(admission.id).catch(() => null),
      ambulanceApi.getBookings(user.hospitalId).catch(() => []),
      patientAdvanceApi.listForAdmission(admission.id).catch(() => []),
      invoiceApi.getPatientInvoices(admission.patientId).catch(() => []),
    ]).then(([suggestions, services, accounts, radiologyOrders, patientServices, otRes, existingInvoice, ambulanceBookings, advanceList, allPatientInvoices]) => {
      const isFirstAdmission = (allPatientInvoices || []).filter(inv =>
        inv.admissionId && String(inv.admissionId) !== String(admission.id)
      ).length === 0
      setBankAccounts(accounts)
      // Pre-select an account matching the initial payment method (Cash by default)
      const eligible = accountsForMethod(accounts, 'Cash')
      const def = eligible.find(a => a.isDefault) ?? eligible[0]
      if (def) setPayBankAccountId(def.id)

      if (existingInvoice?.id) {
        setInvoiceId(existingInvoice.id)
        setInvoiceStatus(existingInvoice.status || 'UNSETTLED')
        setExistingPayments(existingInvoice.payments || [])
        if (existingInvoice.notes) setBillNotes(existingInvoice.notes)
        // Recalculate discount % from saved values
        if (existingInvoice.subtotal > 0 && existingInvoice.discount > 0) {
          setDiscountPct(Math.round((existingInvoice.discount / existingInvoice.subtotal) * 100))
        }
      }
      setAdvances(Array.isArray(advanceList) ? advanceList : [])

      // ── Build item list ───────────────────────────────────────────────────────
      let key = 0
      const savedItems = []

      // Identifiers already committed to the bill
      const savedAppointmentIds = new Set()
      const savedRadiologyIds = new Set()
      const savedOTDescriptions = new Set()
      const savedAmbulanceIds = new Set()
      const hasRoomCharge = { value: false }
      const hasCustomDesc = new Set()

      if (existingInvoice?.items?.length > 0) {
        existingInvoice.items.forEach(item => {
          const entry = {
            key: key++,
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice || 0),
            totalPrice: Number(item.totalPrice || 0),
            appointmentId: item.appointmentId ?? undefined,
            radiologyOrderId: item.radiologyOrderId ?? undefined,
            fromOpd: false,
          }

          if (item.itemType === 'ROOM_CHARGE') {
            // Room/food: always replaced with fresh calculation — skip saving
            hasRoomCharge.value = true
            return
          }
          if (item.itemType === 'CUSTOM') {
            // Custom/food: replaced with fresh calculation — skip saving
            hasCustomDesc.add(item.description)
            return
          }
          if (item.itemType === 'CONSULTATION' && item.appointmentId) {
            savedAppointmentIds.add(String(item.appointmentId))
            const isOpd = existingInvoice.admissionNumber &&
              item.description?.toLowerCase().includes('consultation')
            entry.fromOpd = isOpd && savedAppointmentIds.size === 1
          }
          if (item.itemType === 'RADIOLOGY' && item.radiologyOrderId) {
            savedRadiologyIds.add(String(item.radiologyOrderId))
          }
          if (item.itemType === 'OT') {
            savedOTDescriptions.add(item.description)
          }
          if (item.ambulanceBookingId) {
            savedAmbulanceIds.add(String(item.ambulanceBookingId))
          }
          savedItems.push(entry)
        })
      }

      const auto = [...savedItems]

      // Room charge — recalculate current total days
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

      // Consultations — skip already saved by appointmentId
      const carriedAppointmentIds = new Set(auto.filter(i => i.appointmentId).map(i => String(i.appointmentId)))
      ;(suggestions.appointments || []).forEach(a => {
        if (carriedAppointmentIds.has(String(a.appointmentId))) return
        if (savedAppointmentIds.has(String(a.appointmentId))) return
        auto.push({
          key: key++, itemType: 'CONSULTATION',
          description: `Consultation — Dr. ${a.doctorName}${a.specialization ? ` (${a.specialization})` : ''}`,
          quantity: 1, unitPrice: a.consultationFee, totalPrice: a.consultationFee,
          appointmentId: a.appointmentId,
        })
      })

      // Radiology — skip already saved
      const EXCLUDED = ['CANCELLED', 'BILLED']
      ;(Array.isArray(radiologyOrders) ? radiologyOrders.filter(r => !EXCLUDED.includes(r.status)) : []).forEach(r => {
        if (savedRadiologyIds.has(String(r.id))) return
        const name = r.serviceName || r.investigationName || r.testName || 'Radiology'
        const match = services.find(s => s.name.toLowerCase() === name.toLowerCase())
        const price = match?.price ?? 0
        auto.push({
          key: key++, itemType: 'RADIOLOGY', description: name,
          quantity: 1, unitPrice: price, totalPrice: price, radiologyOrderId: r.id,
        })
      })

      // Patient services (food + others) — recalculate fresh quantities
      ;(Array.isArray(patientServices) ? patientServices.filter(s => s.isActive) : []).forEach(s => {
        if (s.type === 'FOOD') {
          const price = s.pricePerMeal || 0
          const quantity = s.chargeTime
            ? countMealSlots(admission.admissionDate, effectiveDischargeDate, s.chargeTime)
            : roomDays * 3
          auto.push({
            key: key++, itemType: 'CUSTOM',
            description: `${s.name} (${quantity} meal${quantity !== 1 ? 's' : ''})`,
            quantity, unitPrice: price, totalPrice: quantity * price,
          })
        } else if (s.type === 'REGISTRATION' && s.oneTimeCharge) {
          // Skip if backend already added a REGISTRATION item to the invoice
          const backendAlreadyCharged = savedItems.some(i => i.itemType === 'REGISTRATION')
          if (isFirstAdmission && !backendAlreadyCharged) {
            const price = s.pricePerDay || 0
            auto.push({ key: key++, itemType: 'CUSTOM', description: s.name, quantity: 1, unitPrice: price, totalPrice: price })
          }
        } else if (s.oneTimeCharge) {
          const price = s.pricePerDay || 0
          auto.push({ key: key++, itemType: 'CUSTOM', description: s.name, quantity: 1, unitPrice: price, totalPrice: price })
        } else {
          const price = s.pricePerDay || 0
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

      // Ambulance — skip already saved
      const admitDay = new Date(admission.admissionDate)
      admitDay.setHours(0, 0, 0, 0)
      const dayBefore = new Date(admitDay)
      dayBefore.setDate(dayBefore.getDate() - 1)
      ;(Array.isArray(ambulanceBookings) ? ambulanceBookings : [])
        .filter(b => {
          const pid = b.patient?.id ?? b.patientId
          if (String(pid) !== String(admission.patientId)) return false
          if (b.status !== 'COMPLETED') return false
          if (b.paymentStatus === 'PAID') return false
          if (savedAmbulanceIds.has(String(b.id))) return false
          const bDate = new Date(b.bookingDate)
          return bDate >= dayBefore
        })
        .forEach(b => {
          const typeName = b.ambulanceType?.name || ''
          const vehicleNo = b.vehicle?.vehicleNumber || b.vehicleNumber || ''
          const desc = ['Ambulance', typeName, vehicleNo].filter(Boolean).join(' — ')
          const charge = Number(b.charge || 0)
          auto.push({
            key: key++, itemType: 'CUSTOM', description: desc,
            quantity: 1, unitPrice: charge, totalPrice: charge,
            ambulanceBookingId: b.id,
          })
        })

      // OT charges — skip already saved descriptions
      ;(Array.isArray(otRes?.data) ? otRes.data : []).forEach(inv => {
        ;(Array.isArray(inv.items) ? inv.items : []).forEach(item => {
          const desc = item.description || item.name || 'OT Procedure'
          if (savedOTDescriptions.has(desc)) return
          auto.push({
            key: key++, itemType: 'OT', description: desc,
            quantity: item.quantity ?? 1,
            unitPrice: item.totalPrice ?? item.amount ?? 0,
            totalPrice: item.totalPrice ?? item.amount ?? 0,
          })
        })
      })

      setItems(auto.filter(i => Number(i.quantity) > 0 || Number(i.totalPrice) > 0))
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
      const merged = { ...item, ...updates }
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

  // Silently keep billing list estimate in sync as items load/change
  useEffect(() => {
    if (!invoiceId || loadingBill || grandTotal <= 0) return
    invoiceApi.updateEstimate(invoiceId, grandTotal).catch(() => {})
  }, [grandTotal, invoiceId, loadingBill])

  // Remaining advance = total collected minus already applied portions
  const totalAdvance = useMemo(
    () => advances.reduce((s, a) => s + Math.max(0, Number(a.amount || 0) - Number(a.appliedAmount || 0)), 0),
    [advances]
  )
  const advanceAdjusted = Math.min(totalAdvance, grandTotal)

  // Total cash collected so far (from payment history)
  const totalCashPaid = useMemo(
    () => existingPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [existingPayments]
  )
  const balanceDue = Math.max(0, grandTotal - advanceAdjusted - totalCashPaid)

  const hasZeroPrice = items.some(i => Number(i.unitPrice) === 0 && i.itemType !== 'CUSTOM')
  const hasOpdCarryOver = useMemo(() => items.some(i => i.fromOpd), [items])
  // Bill is only locked after discharge. While patient is admitted, PAID bills can be
  // reopened to add new charges — the discharge gate prevents leaving with a balance.
  const isPaid = false

  const buildPayload = () => ({
    invoiceNumber: fallbackInvoiceNo,
    hospitalId: user.hospitalId,
    patientId: admission.patientId,
    admissionId: admission.id,
    subtotal,
    tax: gst,
    discount: discountAmt,
    total: grandTotal,
    advanceAdjusted: advanceAdjusted > 0 ? advanceAdjusted : undefined,
    notes: billNotes || `IPD Bill — Admission ${admission.admissionNumber}`,
    items: items
      .filter(i => Number(i.quantity) > 0 || Number(i.totalPrice) > 0)
      .map(i => ({
        itemType: i.itemType,
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
        radiologyOrderId: i.radiologyOrderId ?? undefined,
        appointmentId: i.appointmentId ?? undefined,
      })),
  })

  const handleSaveBill = async () => {
    if (items.length === 0) { notify('Add at least one billing item', 'warning'); return }
    if (items.some(i => !i.description?.trim())) { notify('All items need a description', 'error'); return }
    setSavingBill(true)
    try {
      const payload = buildPayload()
      let finalId = invoiceId
      let savedInvoice
      if (finalId) {
        savedInvoice = await invoiceApi.finalizeIPD(finalId, payload)
      } else {
        savedInvoice = await invoiceApi.create({ ...payload, status: 'UNSETTLED' })
        finalId = savedInvoice.id
        setInvoiceId(finalId)
      }

      // Sync status from server (PAID bill reopened → backend resets to UNPAID)
      if (savedInvoice?.status) setInvoiceStatus(savedInvoice.status)

      // Mark ambulance bookings as paid
      const ambulanceItems = items.filter(i => i.ambulanceBookingId)
      if (ambulanceItems.length > 0) {
        await Promise.allSettled(
          ambulanceItems.map(i => ambulanceApi.updateStatus(i.ambulanceBookingId, { paymentStatus: 'PAID' }))
        )
      }

      const wasReopened = invoiceStatus === 'PAID' || invoiceStatus === 'SETTLED'
      notify(
        wasReopened
          ? 'Bill reopened with new charges — collect outstanding balance'
          : 'Bill saved — collect payment when ready',
        'success'
      )
      setPayAmount(String(Math.round(balanceDue)))
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to save bill', 'error')
    } finally {
      setSavingBill(false)
    }
  }

  const handleCollectPayment = async () => {
    const amt = Number(payAmount)
    if (!amt || amt <= 0) { notify('Enter a valid amount', 'warning'); return }
    if (!invoiceId) { notify('Save the bill first before collecting payment', 'warning'); return }
    if (items.length === 0) { notify('Add at least one billing item', 'warning'); return }
    if (items.some(i => !i.description?.trim())) { notify('All items need a description', 'error'); return }
    setCollectingPayment(true)
    try {
      // Atomic: send current bill items + payment in one request.
      // Backend updates items, resets PAID→UNPAID if needed, records payment, sets status.
      const result = await invoiceApi.collectAndSave(invoiceId, {
        ...buildPayload(),
        amount: amt,
        paymentMethod: payMethod,
        // Send whatever was selected — backend already handles null gracefully.
        bankAccountId: payBankAccountId || null,
        collectedBy: user?.name || null,
      })

      const newPayment = { id: Date.now(), amount: amt, paymentMethod: payMethod, paidAt: new Date().toISOString() }
      setExistingPayments(prev => [...prev, newPayment])
      if (result?.status) setInvoiceStatus(result.status)

      const newTotalPaid = totalCashPaid + amt
      const newBalance = Math.max(0, grandTotal - advanceAdjusted - newTotalPaid)

      if (newBalance <= 0) {
        notify('Bill fully paid — patient can now be discharged', 'success')
        onFinalized()
      } else {
        notify(`₹${amt.toLocaleString('en-IN')} recorded. Balance remaining: ₹${newBalance.toLocaleString('en-IN')}`, 'success')
        setPayAmount(String(Math.round(newBalance)))
      }
    } catch (err) {
      notify(err?.response?.data?.message || 'Payment failed — please try again', 'error')
    } finally {
      setCollectingPayment(false)
    }
  }

  const eligibleAccounts = accountsForMethod(bankAccounts, payMethod)
  const needsBankAccount = (PAYMENT_METHOD_TO_ACCOUNT_TYPES[payMethod] || []).length > 0
  const isCash = (admission.paymentCategory || 'CASH') === 'CASH'

  // ── Collect Payment form (shared between Cash and Credit early-collect) ──────
  const collectFormJSX = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (₹)</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input"
            value={payAmount}
            onChange={e => setPayAmount(e.target.value)}
            placeholder={String(Math.round(balanceDue))}
          />
        </div>
        <div>
          <label className="label">Payment Method</label>
          <SearchableSelect
            className="input"
            value={payMethod}
            onChange={val => {
              setPayMethod(val)
              const eligible = accountsForMethod(bankAccounts, val)
              const def = eligible.find(a => a.isDefault) ?? eligible[0]
              setPayBankAccountId(def ? def.id : '')
            }}
            options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
          />
        </div>
      </div>
      {needsBankAccount && eligibleAccounts.length === 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            No {payMethod === 'Cash' ? 'CASH' : 'SAVINGS / CURRENT'} account found. Configure banks in the Finance app to track this payment.
          </p>
        </div>
      )}
      {needsBankAccount && eligibleAccounts.length > 0 && (
        <div>
          <label className="label flex items-center gap-1.5">
            <Landmark className="w-3 h-3" /> Credit to
            <span className="ml-1.5 text-[10px] font-medium text-slate-400 dark:text-[#666]">
              ({payMethod === 'Cash' ? 'CASH only' : 'SAVINGS / CURRENT only'})
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {eligibleAccounts.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setPayBankAccountId(a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                  payBankAccountId === a.id
                    ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] text-slate-500 dark:text-[#888] hover:border-slate-400'
                }`}
              >
                {payBankAccountId === a.id && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                {a.accountName}
              </button>
            ))}
          </div>
        </div>
      )}
      {balanceDue > 0 && (
        <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 dark:border-[#1e1e1e]">
          <span className="text-slate-500 dark:text-[#888] font-medium">Balance due</span>
          <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">{fmt(balanceDue)}</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-8xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-[#2a2a2a]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-500" /> IPD Bill
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
              {admission.patientName} · {admission.admissionNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(invoiceStatus === 'PAID' || invoiceStatus === 'SETTLED') && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/25">
                Settled
              </span>
            )}
            {(invoiceStatus === 'PARTIAL' || invoiceStatus === 'UNSETTLED') && (
              <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-200 dark:border-amber-500/25">
                Not Settled
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {loadingBill ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-[#888]">Loading bill and pending charges…</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="flex">

            {/* ════ LEFT PANEL ════ */}
            <div className="flex flex-col flex-1 min-w-0 border-r border-slate-100 dark:border-[#1e1e1e]">

              {/* Left sub-header */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
                <p className="font-bold text-slate-900 dark:text-white">Bill Items</p>
                <button onClick={addBlankItem} className="btn-secondary text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {/* Alerts (shrink-0) */}
              <div className="shrink-0">
                {hasOpdCarryOver && (
                  <div className="flex items-start gap-2.5 mx-5 mt-3 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25">
                    <Stethoscope className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                      OPD → IPD: consultation charge carried over from the originating OPD visit.
                    </p>
                  </div>
                )}
                {hasZeroPrice && !isPaid && (
                  <div className="flex items-start gap-2.5 mx-5 mt-3 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      Some items have ₹0 — check radiology charges or add unit price manually.
                    </p>
                  </div>
                )}
              </div>

              {/* Items table */}
              <div>
                {items.length === 0 ? (
                  <div className="py-16 mx-6 mt-4 text-center border-2 border-dashed border-slate-100 dark:border-[#2a2a2a] rounded-lg">
                    <p className="text-sm font-medium text-slate-500">No charges detected</p>
                    <p className="text-xs text-slate-400 mt-1">Add items manually above</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-[#111] z-10">
                      <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-8">No</th>
                        <th className="px-2 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-28">Type</th>
                        <th className="px-2 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="px-2 py-3 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-20">Qty</th>
                        <th className="px-2 py-3 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-24">Unit ₹</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-24">Total</th>
                        <th className="px-2 py-3 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                      {items.map((item, idx) => (
                        <tr
                          key={item.key}
                          className={`group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-colors ${item.fromOpd ? 'border-l-2 border-blue-400 bg-blue-50/30 dark:bg-blue-500/5' : ''}`}
                        >
                          <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-[#555]">{idx + 1}</td>
                          <td className="px-2 py-2.5">
                            <SearchableSelect
                              value={item.itemType ?? 'CUSTOM'}
                              onChange={val => updateItem(item.key, { itemType: val })}
                              disabled={isPaid}
                              className="w-full text-[10px] rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-1.5 py-1 text-slate-700 dark:text-[#ccc] focus:outline-none disabled:opacity-60"
                              options={Object.keys(TYPE_META).map(k => ({ value: k, label: TYPE_META[k]?.label || k }))}
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {item.fromOpd && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-600 shrink-0">OPD</span>
                              )}
                              <input
                                className="input py-1.5 text-sm"
                                placeholder="Description…"
                                value={item.description}
                                disabled={isPaid}
                                onChange={e => updateItem(item.key, { description: e.target.value })}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              min={1}
                              className="input py-1.5 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={item.quantity}
                              disabled={isPaid}
                              onChange={e => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })}
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="input py-1.5 text-sm text-right"
                              value={item.unitPrice}
                              disabled={isPaid}
                              onChange={e => updateItem(item.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">{fmt(item.totalPrice || 0)}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            {!isPaid && (
                              <button
                                onClick={() => removeItem(item.key)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-rose-500 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Totals footer */}
              <div className="shrink-0 border-t border-slate-100 dark:border-[#1e1e1e] px-6 py-4 space-y-2 bg-slate-50/60 dark:bg-[#0a0a0a]">
                <div className="flex justify-between text-sm text-slate-500 dark:text-[#888]">
                  <span>Subtotal</span>
                  <span className="font-semibold tabular-nums">{fmt(subtotal)}</span>
                </div>
                {!isPaid && (
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-[#888]">
                    <span>Discount (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="input !w-16 shrink-0 py-1 text-sm text-center"
                      value={discountPct}
                      onChange={e => setDiscountPct(Math.min(100, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                )}
                {discountAmt > 0 && (
                  <div className="flex justify-between text-sm text-rose-500 dark:text-rose-400">
                    <span>Discount</span>
                    <span className="tabular-nums">-{fmt(discountAmt)}</span>
                  </div>
                )}
                {medicineSubtotal > 0 && (
                  <div className="flex justify-between text-sm text-slate-500 dark:text-[#888]">
                    <span>GST on medicines (18%)</span>
                    <span className="tabular-nums">{fmt(gst)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center font-bold text-base text-slate-900 dark:text-white border-t border-slate-100 dark:border-[#1a1a1a] pt-2.5 mt-1">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{fmt(grandTotal)}</span>
                </div>
                {advanceAdjusted > 0 && (
                  <div className="flex justify-between text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Advance Credit</span>
                    <span className="tabular-nums">-{fmt(advanceAdjusted)}</span>
                  </div>
                )}
                {totalCashPaid > 0 && (
                  <div className="flex justify-between text-sm text-slate-500 dark:text-[#888]">
                    <span>Paid so far</span>
                    <span className="tabular-nums">-{fmt(totalCashPaid)}</span>
                  </div>
                )}
                <div className={`flex justify-between font-bold text-base border-t border-slate-100 dark:border-[#1a1a1a] pt-2.5 mt-1 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  <span>{isPaid ? 'Fully Settled' : 'Balance Due'}</span>
                  <span className="tabular-nums">{fmt(balanceDue)}</span>
                </div>
              </div>
            </div>

            {/* ════ RIGHT PANEL ════ */}
            <div className="w-96 shrink-0 flex flex-col">

              {/* Right sub-header */}
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
                <p className="font-bold text-slate-900 dark:text-white">Payment details</p>
              </div>

              <div className="p-5 space-y-5">

                {/* 1. Payment category badge */}
                {isCash ? (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-900 dark:bg-white">
                    <Wallet className="w-3.5 h-3.5 text-white dark:text-slate-900 shrink-0" />
                    <span className="text-xs font-semibold text-white dark:text-slate-900">
                      Cash · Pay during stay
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30">
                    <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Credit · Payment due at discharge
                    </span>
                  </div>
                )}

                {/* 2. Advance Credits */}
                {advances.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-100 dark:border-emerald-500/15">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Advance Credits — {fmt(totalAdvance)} available
                      </p>
                    </div>
                    <div className="divide-y divide-emerald-100 dark:divide-emerald-500/10">
                      {advances.map(a => {
                        const remaining = Math.max(0, Number(a.amount) - Number(a.appliedAmount || 0))
                        return (
                          <div key={a.id} className="flex items-center justify-between px-4 py-2 text-xs">
                            <div>
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{a.receiptNumber}</span>
                              <span className="text-emerald-600/70 dark:text-emerald-400/60 ml-2">
                                {a.source} · {a.paymentMethod}
                              </span>
                            </div>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                              {fmt(remaining)} available
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Payment History */}
                {existingPayments.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white mb-3">Payment History</p>
                    <div className="space-y-3">
                      {existingPayments.map((p, i) => (
                        <div key={p.id ?? i} className="flex items-start gap-4">
                          <p className="text-sm text-slate-600 dark:text-[#aaa] whitespace-nowrap shrink-0 tabular-nums">
                            {fmtTime(p.paidAt)}
                          </p>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 dark:text-[#666] mt-0.5">{p.paymentMethod}</p>
                            {p.collectedBy && (
                              <p className="text-xs text-slate-400 dark:text-[#666]">· {p.collectedBy}</p>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums shrink-0">{fmt(p.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4a. CASH patients — Collect Payment */}
                {isCash && !isPaid && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" /> Amount Paid
                    </p>
                    {collectFormJSX}
                  </div>
                )}

                {/* 4b. CREDIT patients — Deferred notice + optional early collect */}
                {!isCash && !isPaid && (
                  <div className="space-y-3">
                    <div className="px-4 py-3.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        Payment deferred to discharge. The full balance will be collected when the patient is discharged.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEarlyCollect(v => !v)}
                      className="text-xs text-slate-500 dark:text-[#888] hover:text-slate-700 dark:hover:text-[#ccc] transition-colors"
                    >
                      {showEarlyCollect ? '− Hide early payment' : '+ Collect early payment'}
                    </button>
                    {showEarlyCollect && (
                      <div className="pt-1">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <IndianRupee className="w-3.5 h-3.5" /> Amount Paid
                        </p>
                        {collectFormJSX}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Bill Notes */}
                <div>
                  <label className="label">Bill Notes (optional)</label>
                  <input
                    className="input"
                    placeholder={`IPD Bill — Admission ${admission.admissionNumber}`}
                    value={billNotes}
                    onChange={e => setBillNotes(e.target.value)}
                    disabled={isPaid}
                  />
                </div>

              </div>
            </div>

            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {!loadingBill && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] rounded-b-xl shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Close</button>
            {!isPaid && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveBill}
                  disabled={savingBill || items.length === 0}
                  className="btn-secondary flex items-center gap-2"
                >
                  {savingBill ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                  {savingBill ? 'Saving…' : 'Save Bill'}
                </button>
                {(isCash || showEarlyCollect) && (
                  <button
                    onClick={handleCollectPayment}
                    disabled={collectingPayment || !Number(payAmount)}
                    className="btn-primary flex items-center gap-2"
                  >
                    {collectingPayment
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
                      : <><IndianRupee className="w-4 h-4" /> Amount Paid</>

                    }
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
