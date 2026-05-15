import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  X, BedDouble, Stethoscope, Clock, Calendar, LogOut, Scissors,
  Activity, Package, Receipt, Phone, User, Loader2, ExternalLink,
  RotateCcw, Wallet, ScanLine, Pill, FlaskConical, Wrench, AlertTriangle,
  CheckCircle2, ShieldAlert
} from 'lucide-react'
import { fmtDateTime, fmtDateMed } from '@/utils/date'
import {
  roomLogsApi, radiologyApi, ambulanceApi, assetApi, invoiceApi,
  hospitalServiceApi, patientServicesApi, admissionApi
} from '@/utils/api'
import axios from 'axios'
import SSOCookieManager from '@/utils/ssoManager'

const otApi = axios.create({ baseURL: 'https://api-ot.zenohosp.com', withCredentials: true })
otApi.interceptors.request.use(config => {
  const token = SSOCookieManager.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const TABS = ['IPD Log', 'Attendor Details', 'Room Mapped Assets', 'IPD Billing']

const GST_RATE = 0.18

const EVENT_META = {
  ADMITTED:          { label: 'ADMITTED',          badge: 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5' },
  ALLOCATED:         { label: 'ROOM ASSIGNED',      badge: 'text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/5' },
  DEALLOCATED:       { label: 'ROOM VACATED',       badge: 'text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5' },
  ATTENDER_ASSIGNED: { label: 'ATTENDER ASSIGNED',  badge: 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a]' },
  ATTENDER_UPDATED:  { label: 'ATTENDER UPDATED',   badge: 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a]' },
  RADIOLOGY:         { label: 'RADIOLOGY',          badge: 'text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/5' },
  AMBULANCE:         { label: 'AMBULANCE',          badge: 'text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5' },
  OT:                { label: 'OT PROCEDURE',       badge: 'text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/5' },
  DISCHARGED:        { label: 'DISCHARGED',         badge: 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2a2a2a] bg-slate-100 dark:bg-[#1a1a1a]' },
}

const BILL_TYPE_META = {
  ROOM_CHARGE:  { label: 'Room',      Icon: BedDouble,    cls: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10' },
  CONSULTATION: { label: 'Consult',   Icon: Stethoscope,  cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' },
  RADIOLOGY:    { label: 'Radiology', Icon: ScanLine,     cls: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10' },
  LAB_TEST:     { label: 'Lab',       Icon: FlaskConical, cls: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10' },
  MEDICINE:     { label: 'Medicine',  Icon: Pill,         cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' },
  OT:           { label: 'OT',        Icon: Scissors,     cls: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10' },
  CUSTOM:       { label: 'Custom',    Icon: Wrench,       cls: 'text-slate-600 dark:text-[#aaa] bg-slate-100 dark:bg-[#222]' },
}

const fmt = fmtDateTime
const fmtDate = fmtDateMed
function fmtMoney(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function IPDDetailPane({ admission, onClose, onDischarge, onMoveToOT, onReturnToWard }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('IPD Log')

  // Timeline
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  // Assets
  const [assets, setAssets] = useState([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [assetsFetched, setAssetsFetched] = useState(false)

  // Billing
  const [billingItems, setBillingItems] = useState([])
  const [finalInvoice, setFinalInvoice] = useState(null)
  const [otInvoices, setOtInvoices] = useState([])
  const [otInvoicesError, setOtInvoicesError] = useState(false)
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [billingFetched, setBillingFetched] = useState(false)

  // Discharge guard
  const [checkingDischarge, setCheckingDischarge] = useState(false)
  const [dischargeBlock, setDischargeBlock] = useState(null) // null | { reason: 'no_invoice'|'unpaid', amount }

  /* ── Billing totals (for estimation view) ── */
  const subtotal = useMemo(() => billingItems.reduce((s, i) => s + (i.totalPrice || 0), 0), [billingItems])
  const gst = useMemo(
    () => billingItems.filter(i => i.itemType === 'MEDICINE').reduce((s, i) => s + (i.totalPrice || 0), 0) * GST_RATE,
    [billingItems]
  )
  const grandTotal = subtotal + gst
  const hasZeroPrice = billingItems.some(i => Number(i.unitPrice) === 0 && i.itemType !== 'CUSTOM')

  /* ── Discharge guard handler ── */
  const handleDischargeClick = useCallback(async () => {
    setCheckingDischarge(true)
    setDischargeBlock(null)
    try {
      const invoices = await invoiceApi.getPatientInvoices(admission.patientId)
      const admissionInvoices = (invoices || []).filter(inv =>
        String(inv.admissionId) === String(admission.id)
      )
      if (admissionInvoices.length === 0) {
        setDischargeBlock({ reason: 'no_invoice', amount: null })
        return
      }
      const unpaid = admissionInvoices.find(inv => inv.status !== 'PAID')
      if (unpaid) {
        setDischargeBlock({ reason: 'unpaid', amount: Number(unpaid.total || 0) })
        return
      }
      onDischarge()
    } catch {
      // On API failure don't block — let the backend enforce
      onDischarge()
    } finally {
      setCheckingDischarge(false)
    }
  }, [admission?.id, admission?.patientId, onDischarge])

  /* ── OT invoice retry (Bug 1 — shows error UI instead of silent empty) ── */
  const retryOtInvoices = useCallback(async () => {
    setOtInvoicesError(false)
    try {
      const res = await otApi.get('/api/ot/invoices', { params: { admissionId: admission.id } })
      setOtInvoices(Array.isArray(res.data) ? res.data : (res.data?.content ?? []))
    } catch {
      setOtInvoicesError(true)
    }
  }, [admission?.id])

  /* ── Fetch IPD log (patient-specific, scoped to this admission window) ── */
  const fetchLogs = useCallback(async () => {
    if (!admission) return
    setLoadingLogs(true)
    const events = []

    const admitStart = new Date(admission.admissionDate).getTime()
    const admitEnd = admission.actualDischargeDate
      ? new Date(admission.actualDischargeDate).getTime()
      : Date.now()

    events.push({
      id: 'admitted',
      type: 'ADMITTED',
      title: 'Patient Admitted',
      subtitle: admission.admittingDoctorName ? `Under the care of Dr. ${admission.admittingDoctorName}` : (admission.chiefComplaint || ''),
      timestamp: new Date(admission.admissionDate),
    })

    if (admission.actualDischargeDate) {
      events.push({
        id: 'discharged',
        type: 'DISCHARGED',
        title: 'Patient Discharged',
        subtitle: [
          admission.dischargeDiagnosis ? `Diagnosis: ${admission.dischargeDiagnosis}` : null,
          admission.dischargeNote || null,
        ].filter(Boolean).join(' · '),
        timestamp: new Date(admission.actualDischargeDate),
      })
    }

    await Promise.allSettled([
      // Room logs — scoped to this patient AND this admission's time window
      admission.roomId
        ? roomLogsApi.getRoomLogs(admission.roomId, user.hospitalId).then(data =>
            data
              .filter(l => {
                if (l.patientUhid && l.patientUhid !== admission.patientUhid) return false
                const t = new Date(l.createdAt).getTime()
                return t >= admitStart && t <= admitEnd
              })
              .forEach(l => {
                let title, subtitle
                if (l.event === 'ALLOCATED') {
                  title = `Admitted to Room ${l.roomNumber}`
                  subtitle = l.performedBy ? `Allocated by ${l.performedBy}` : ''
                } else if (l.event === 'DEALLOCATED') {
                  title = `Released from Room ${l.roomNumber}`
                  subtitle = l.performedBy ? `Processed by ${l.performedBy}` : ''
                } else if (l.event === 'ATTENDER_ASSIGNED') {
                  title = l.attenderName ? `Attendor "${l.attenderName}" Registered` : 'Attendor Added to Record'
                  subtitle = l.performedBy ? `Added by ${l.performedBy}` : ''
                } else if (l.event === 'ATTENDER_UPDATED') {
                  title = l.attenderName ? `Attendor Details Updated — ${l.attenderName}` : 'Attendor Information Updated'
                  subtitle = l.performedBy ? `Updated by ${l.performedBy}` : ''
                } else {
                  title = l.event.replace(/_/g, ' ')
                  subtitle = [`Room ${l.roomNumber}`, l.performedBy ? `by ${l.performedBy}` : null].filter(Boolean).join(' · ')
                }
                events.push({ id: `room-${l.id}`, type: l.event, title, subtitle, timestamp: new Date(l.createdAt) })
              }))
        : Promise.resolve(),

      // Radiology
      radiologyApi.getByAdmission(admission.id).then(data =>
        data.forEach(r => {
          const statusLabel =
            r.status === 'REPORT_GENERATED' ? 'Report Ready' :
            r.status === 'SCANNED' ? 'Scan Completed' :
            r.status === 'PENDING' ? 'Awaiting Scan' :
            (r.status || '').replace(/_/g, ' ')
          events.push({
            id: `rad-${r.id}`,
            type: 'RADIOLOGY',
            title: `${r.serviceName || 'Radiology'} — ${statusLabel}`,
            subtitle: [
              r.technicianName ? `Performed by ${r.technicianName}` : null,
              r.referredByName ? `Referred by Dr. ${r.referredByName}` : null,
            ].filter(Boolean).join(' · '),
            timestamp: new Date(r.reportedAt || r.scannedAt || r.createdAt),
            badge: statusLabel,
          })
        })),

      // Ambulance — filter by patient within this admission's time window
      ambulanceApi.getBookings(user.hospitalId).then(data =>
        data
          .filter(b => {
            if (String(b.patient?.id) !== String(admission.patientId)) return false
            const t = new Date(b.createdAt).getTime()
            return t >= admitStart && t <= admitEnd
          })
          .forEach(b => events.push({
            id: `amb-${b.id}`,
            type: 'AMBULANCE',
            title: b.ambulanceType?.name ? `${b.ambulanceType.name} Ambulance Dispatched` : 'Ambulance Dispatched',
            subtitle: [
              b.pickupAddress ? `From: ${b.pickupAddress}` : null,
              b.driverName ? `Driver: ${b.driverName}` : null,
              b.vehicleNumber ? `Vehicle: ${b.vehicleNumber}` : null,
            ].filter(Boolean).join(' · '),
            timestamp: new Date(b.createdAt),
            badge: b.status,
          }))),

      // OT bookings — scoped to this admission to prevent cross-admission bleed
      otApi.get('/api/ot/bookings').then(res => {
        const bookings = Array.isArray(res.data) ? res.data : (res.data?.content ?? [])
        bookings
          .filter(ob => {
            // Explicit admission link — most reliable, no time check needed
            if (ob.admissionId) return String(ob.admissionId) === String(admission.id)
            // Explicit OT booking ID stored on the admission record
            if (admission.otBookingId && String(ob.id) === String(admission.otBookingId)) return true
            // Unlinked booking — match patient + fall within this admission's time window
            if (String(ob.patientId) === String(admission.patientId)) {
              const t = new Date(ob.scheduledDate || ob.bookingDate || ob.createdAt).getTime()
              return t >= admitStart && t <= admitEnd
            }
            return false
          })
          .forEach(ob => {
            const procedure = ob.procedureName || ob.surgeryType || ob.procedure || 'Surgical Procedure'
            const surgeon = ob.surgeonName || ob.surgeon
            events.push({
              id: `ot-${ob.id}`,
              type: 'OT',
              title: `${procedure} — Scheduled in OT`,
              subtitle: [
                surgeon ? `Surgeon: Dr. ${surgeon}` : null,
                ob.status ? `Status: ${ob.status.replace(/_/g, ' ')}` : null,
              ].filter(Boolean).join(' · '),
              timestamp: new Date(ob.scheduledDate || ob.bookingDate || ob.createdAt),
              badge: ob.status?.replace(/_/g, ' '),
            })
          })
      }).catch(() => {}),
    ])

    events.sort((a, b) => b.timestamp - a.timestamp)
    setLogs(events)
    setLoadingLogs(false)
  }, [admission?.id, user?.hospitalId])

  const countMealSlots = (admitDate, dischargeDate, chargeTime) => {
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

  /* ── Fetch billing ── */
  const fetchBilling = useCallback(async () => {
    setLoadingBilling(true)

    const isDischarged = !!admission.actualDischargeDate
    const admitMs = new Date(admission.admissionDate).getTime()
    const endMs = isDischarged ? new Date(admission.actualDischargeDate).getTime() : Date.now()
    const elapsedMs = endMs - admitMs
    const daysStayed = Math.max(1, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)))
    const roomDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))

    // For discharged patients — look for a finalized HMS invoice first
    if (isDischarged) {
      try {
        const allInvoices = await invoiceApi.getPatientInvoices(admission.patientId)
        const match = (allInvoices || []).find(inv =>
          String(inv.admissionId) === String(admission.id)
        )
        if (match) {
          setFinalInvoice(match)
          try {
            const res = await otApi.get('/api/ot/invoices', { params: { admissionId: admission.id } })
            setOtInvoices(Array.isArray(res.data) ? res.data : (res.data?.content ?? []))
            setOtInvoicesError(false)
          } catch {
            setOtInvoicesError(true)
          }
          setBillingFetched(true)
          setLoadingBilling(false)
          return
        }
      } catch {}
    }

    // Active admission or no finalized invoice — run estimation
    let key = 0
    const items = []
    try {
      const [suggestions, services, fullAdmission, radiologyOrders, patientServices, allPatientInvoices] = await Promise.all([
        invoiceApi.getSmartSuggestions(admission.patientId, admission.id).catch(() => ({})),
        hospitalServiceApi.list(user.hospitalId).catch(() => []),
        admissionApi.get(admission.id).catch(() => null),
        radiologyApi.getByAdmission(admission.id).catch(() => []),
        patientServicesApi.list(user.hospitalId).catch(() => []),
        invoiceApi.getPatientInvoices(admission.patientId).catch(() => []),
      ])
      // Registration fee is one-time: only charge if this patient has no invoices from other admissions
      const isFirstAdmission = (allPatientInvoices || []).filter(inv =>
        inv.admissionId && String(inv.admissionId) !== String(admission.id)
      ).length === 0

      const roomNumber = admission.roomNumber || fullAdmission?.roomNumber
      if (roomNumber && roomDays > 0) {
        const pricePerDay = suggestions.roomCharge?.pricePerDay || fullAdmission?.roomPricePerDay || 0
        items.push({ key: key++, itemType: 'ROOM_CHARGE', description: `Room ${roomNumber} (${roomDays} day${roomDays !== 1 ? 's' : ''})`, quantity: roomDays, unitPrice: pricePerDay, totalPrice: roomDays * pricePerDay })
      }

      const consults = Array.isArray(suggestions.appointments) ? suggestions.appointments : []
      consults.forEach(a => {
        const price = a.consultationFee || 0
        items.push({ key: key++, itemType: 'CONSULTATION', description: a.doctorName ? `Consultation - Dr. ${a.doctorName}` : 'Consultation', quantity: 1, unitPrice: price, totalPrice: price })
      })

      const EXCLUDED = ['CANCELLED', 'BILLED'];
      (Array.isArray(radiologyOrders) ? radiologyOrders : [])
        .filter(r => !EXCLUDED.includes(r.status))
        .forEach(r => {
          const name = r.serviceName || r.investigationName || 'Radiology'
          const match = (Array.isArray(services) ? services : []).find(s => s.name?.toLowerCase() === name.toLowerCase())
          const price = match?.price ?? 0
          items.push({ key: key++, itemType: 'RADIOLOGY', description: name, quantity: 1, unitPrice: price, totalPrice: price })
        })

      const meds = Array.isArray(suggestions.medicines) ? suggestions.medicines : []
      meds.forEach(m => {
        const price = m.totalPrice || m.price || 0
        items.push({ key: key++, itemType: 'MEDICINE', description: m.name || 'Medicine', quantity: m.quantity || 1, unitPrice: m.unitPrice || price, totalPrice: price })
      })

      const enabledServices = (Array.isArray(patientServices) ? patientServices : []).filter(s => s.isActive)
      const svcEndDate = isDischarged ? admission.actualDischargeDate : new Date().toISOString()
      enabledServices.forEach(s => {
        if (s.type === 'FOOD') {
          // Only count meal slots that fall after admission time
          const qty = s.chargeTime
            ? countMealSlots(admission.admissionDate, svcEndDate, s.chargeTime)
            : roomDays * 3
          items.push({ key: key++, itemType: 'CUSTOM', description: `${s.name} (${qty} meal${qty !== 1 ? 's' : ''})`, quantity: qty, unitPrice: s.pricePerMeal || 0, totalPrice: qty * (s.pricePerMeal || 0) })
        } else if (s.type === 'REGISTRATION' && s.oneTimeCharge) {
          if (isFirstAdmission) {
            items.push({ key: key++, itemType: 'CUSTOM', description: s.name, quantity: 1, unitPrice: s.pricePerDay || 0, totalPrice: s.pricePerDay || 0 })
          }
        } else if (s.oneTimeCharge) {
          items.push({ key: key++, itemType: 'CUSTOM', description: s.name, quantity: 1, unitPrice: s.pricePerDay || 0, totalPrice: s.pricePerDay || 0 })
        } else {
          const qty = s.chargeTime
            ? countMealSlots(admission.admissionDate, svcEndDate, s.chargeTime)
            : roomDays
          items.push({ key: key++, itemType: 'CUSTOM', description: `${s.name} (${qty}d)`, quantity: qty, unitPrice: s.pricePerDay || 0, totalPrice: qty * (s.pricePerDay || 0) })
        }
      })
    } catch {}

    try {
      const res = await otApi.get('/api/ot/invoices', { params: { admissionId: admission.id } })
      const otInvs = Array.isArray(res.data) ? res.data : (res.data?.content ?? [])
      setOtInvoices(otInvs)
      setOtInvoicesError(false)
      // Merge OT line items directly into the billing estimate
      otInvs.forEach(inv => {
        ;(Array.isArray(inv.items) ? inv.items : []).forEach(item => {
          items.push({
            key: key++,
            itemType: 'OT',
            description: item.description || item.name || 'OT Procedure',
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            totalPrice: item.totalPrice ?? item.amount ?? 0,
          })
        })
      })
    } catch {
      setOtInvoicesError(true)
    }

    setBillingItems(items.filter(i => Number(i.quantity) > 0 || Number(i.totalPrice) > 0))

    // Silently sync estimated total back to the placeholder invoice so Billing list shows correct amount
    const estimatedTotal = items.reduce((s, i) => s + Number(i.totalPrice || 0), 0)
    if (estimatedTotal > 0) {
      invoiceApi.getAdmissionInvoice(admission.id)
        .then(inv => { if (inv?.id && inv.status !== 'PAID') invoiceApi.updateEstimate(inv.id, estimatedTotal) })
        .catch(() => {})
    }

    setBillingFetched(true)
    setLoadingBilling(false)
  }, [admission?.id, user?.hospitalId])

  /* ── Full billing refresh — declared after fetchBilling to avoid TDZ ── */
  const refreshBilling = useCallback(() => {
    setFinalInvoice(null)
    setBillingItems([])
    setOtInvoices([])
    setOtInvoicesError(false)
    setBillingFetched(false)
    fetchBilling()
  }, [fetchBilling])

  /* ── Reset on admission change ── */
  useEffect(() => {
    setActiveTab('IPD Log')
    setLogs([])
    setAssets([])
    setBillingItems([])
    setFinalInvoice(null)
    setOtInvoices([])
    setOtInvoicesError(false)
    setAssetsFetched(false)
    setBillingFetched(false)
    setDischargeBlock(null)
    fetchLogs()
  }, [admission?.id])

  /* ── Lazy-load tabs ── */
  useEffect(() => {
    if (activeTab === 'Room Mapped Assets' && !assetsFetched && admission?.roomId) {
      setLoadingAssets(true)
      assetApi.getByRoom(user.hospitalId, admission.roomId)
        .then(data => { setAssets(data); setAssetsFetched(true) })
        .catch(() => setAssetsFetched(true))
        .finally(() => setLoadingAssets(false))
    }
    if (activeTab === 'IPD Billing' && !billingFetched) {
      fetchBilling()
    }
  }, [activeTab])

  if (!admission) return null

  const isAdmitted = admission.status === 'ADMITTED'
  const canMoveOT = isAdmitted && !admission.inOt && admission.roomType !== 'POST_OT'
  const canReturnWard = isAdmitted && !!admission.previousRoomId

  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
      <div className="absolute inset-0 bg-black/25 pointer-events-auto" onClick={onClose} />

      <div className="relative w-full max-w-lg h-full bg-white dark:bg-[#0f0f0f] shadow-2xl flex flex-col pointer-events-auto border-l border-slate-200 dark:border-[#1e1e1e]">

        {/* ── Header ── */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-[#1a1a1a]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  admission.status === 'ADMITTED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#1e1e1e] dark:text-slate-400 dark:border-[#2a2a2a]'
                }`}>{admission.status}</span>
                {admission.inOt && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20 flex items-center gap-1">
                    <Scissors className="w-2.5 h-2.5" /> In OT
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{admission.patientName}</h2>
              <p className="text-xs text-slate-400 mt-0.5">UHID: {admission.patientUhid}</p>
            </div>
            <button onClick={onClose} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e1e] text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <BedDouble className="w-3.5 h-3.5 text-slate-300 dark:text-[#444]" />
                {admission.roomNumber ? `Room ${admission.roomNumber} · ${admission.roomType}` : 'No room assigned'}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-300 dark:text-[#444]" />
                {fmtDate(admission.admissionDate)}
              </span>
            </div>
            {(admission.admittingDoctorName || admission.approxDischargeDate) && (
              <div className="flex items-center gap-5 text-xs text-slate-500">
                {admission.admittingDoctorName && (
                  <span className="flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-slate-300 dark:text-[#444]" />
                    Dr. {admission.admittingDoctorName}
                  </span>
                )}
                {admission.approxDischargeDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-300 dark:text-[#444]" />
                    Est. {fmtDate(admission.approxDischargeDate)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ID + action row */}
          <div className="flex items-center justify-between mt-3.5">
            <div className="flex items-center gap-2">
              {admission.ipdId && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">{admission.ipdId}</span>
              )}
              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-[#2a2a2a]">{admission.admissionNumber}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => navigate(`/patients/${admission.patientId}`)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] hover:bg-slate-100 dark:hover:bg-[#222] transition-colors">
                <User className="w-3 h-3" /> Patient
                <ExternalLink className="w-2.5 h-2.5 opacity-40" />
              </button>
              {isAdmitted && (
                <button
                  onClick={handleDischargeClick}
                  disabled={checkingDischarge}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-60 disabled:cursor-wait">
                  {checkingDischarge
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <LogOut className="w-3 h-3" />}
                  Discharge
                </button>
              )}
              {canMoveOT && (
                <button onClick={onMoveToOT}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors">
                  <Scissors className="w-3 h-3" /> OT
                </button>
              )}
              {canReturnWard && (
                <button onClick={onReturnToWard}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                  <RotateCcw className="w-3 h-3" /> Ward
                </button>
              )}
            </div>
          </div>

          {/* Discharge block banner */}
          {dischargeBlock && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-rose-200 dark:border-rose-500/25 bg-rose-50 dark:bg-rose-500/5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                  {dischargeBlock.reason === 'no_invoice'
                    ? 'No invoice generated for this admission'
                    : `Pending payment of ${fmtMoney(dischargeBlock.amount)}`}
                </p>
                <p className="text-[10px] text-rose-500 dark:text-rose-400/70 mt-0.5">
                  {dischargeBlock.reason === 'no_invoice'
                    ? 'Generate and clear the invoice in IPD Billing before discharging.'
                    : 'Clear the outstanding invoice in IPD Billing before discharging.'}
                </p>
              </div>
              <button onClick={() => setDischargeBlock(null)} className="shrink-0 text-rose-300 hover:text-rose-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="shrink-0 flex border-b border-slate-100 dark:border-[#1a1a1a] px-5 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`shrink-0 text-xs font-semibold pb-2.5 pt-3 px-0.5 mr-5 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-400 dark:text-[#555] hover:text-slate-600 dark:hover:text-[#888]'
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* IPD Log */}
          {activeTab === 'IPD Log' && (
            <div className="p-5">
              {loadingLogs ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading timeline…</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Activity className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No log entries</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {logs.map((ev, idx) => {
                    const meta = EVENT_META[ev.type] || { label: ev.type, badge: 'text-slate-600 border-slate-200 bg-slate-50 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-slate-400' }
                    const isLast = idx === logs.length - 1
                    return (
                      <div key={ev.id} className="flex gap-3">
                        <div className="flex flex-col items-center shrink-0 pt-1">
                          <div className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white shrink-0" />
                          {!isLast && <div className="w-px flex-1 bg-slate-100 dark:bg-[#1e1e1e] mt-1 mb-0" />}
                        </div>
                        <div className={`flex-1 min-w-0 rounded-lg border border-slate-100 dark:border-[#1e1e1e] bg-white dark:bg-[#111] px-4 py-3 ${isLast ? 'mb-0' : 'mb-3'}`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider border ${meta.badge}`}>
                              {meta.label}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                              <Clock className="w-3 h-3" />
                              {fmt(ev.timestamp)}
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-[#ddd] leading-snug">{ev.title}</p>
                          {ev.subtitle && (
                            <p className="text-xs text-slate-400 dark:text-[#666] mt-1 leading-snug">{ev.subtitle}</p>
                          )}
                          {ev.badge && ev.badge !== ev.subtitle && (
                            <p className="text-[10px] text-slate-300 dark:text-[#555] mt-1 uppercase tracking-wider">{ev.badge}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Attendor Details */}
          {activeTab === 'Attendor Details' && (
            <div className="p-5">
              {admission.attenderName ? (
                <div className="rounded-lg border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-100 dark:border-[#1e1e1e]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attendor on Record</p>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#222] flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Name</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-[#ddd]">{admission.attenderName}</p>
                      </div>
                    </div>
                    {admission.attenderPhone && (
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#222] flex items-center justify-center shrink-0">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Phone</p>
                          <a href={`tel:${admission.attenderPhone}`} className="text-sm font-semibold text-slate-800 dark:text-[#ddd] hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {admission.attenderPhone}
                          </a>
                        </div>
                      </div>
                    )}
                    {admission.attenderRelationship && (
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#222] flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Relationship</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-[#ddd] capitalize">{admission.attenderRelationship}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <User className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No attendor on record</p>
                  <p className="text-xs mt-1 opacity-60">Update via Room Allocation</p>
                </div>
              )}
            </div>
          )}

          {/* Room Mapped Assets */}
          {activeTab === 'Room Mapped Assets' && (
            <div className="p-5">
              {loadingAssets ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading assets…</span>
                </div>
              ) : !admission.roomId ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Package className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No room assigned</p>
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Package className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No assets mapped to this room</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
                  <div className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                    {assets.map(asset => (
                      <div key={asset.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#111]">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#222] flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-[#ddd] truncate">{asset.name || asset.assetName}</p>
                          <p className="text-xs text-slate-400 truncate">{asset.category || asset.assetCategory || '—'}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          (asset.status === 'AVAILABLE' || asset.status === 'IN_USE')
                            ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                            : 'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-500/20 dark:bg-amber-500/5'
                        }`}>
                          {(asset.status || '—').replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* IPD Billing */}
          {activeTab === 'IPD Billing' && (
            <div className="p-5 space-y-4">
              {/* Refresh button — Bug 3 fix */}
              {!loadingBilling && (
                <div className="flex justify-end">
                  <button
                    onClick={refreshBilling}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 dark:text-[#666] hover:text-slate-600 dark:hover:text-[#aaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] border border-transparent hover:border-slate-200 dark:hover:border-[#2a2a2a] transition-all">
                    <RotateCcw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
              )}
              {loadingBilling ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading billing…</span>
                </div>
              ) : finalInvoice ? (
                /* ── Final invoice (discharged patients) ── */
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">Final Invoice</p>
                      <p className="text-[11px] text-slate-400 dark:text-[#555] mt-0.5 font-mono">{finalInvoice.invoiceNumber} · {fmtDate(finalInvoice.createdAt)}</p>
                    </div>
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      finalInvoice.status === 'PAID'
                        ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                        : 'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-500/20 dark:bg-amber-500/5'
                    }`}>
                      {finalInvoice.status === 'PAID'
                        ? <><CheckCircle2 className="w-3 h-3" /> PAID</>
                        : <><AlertTriangle className="w-3 h-3" /> UNPAID</>}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-100 dark:border-[#1e1e1e]">
                      {[['Type','col-span-3'],['Description','col-span-5'],['Qty','col-span-1 text-center'],['Total','col-span-3 text-right']].map(([h,cls]) => (
                        <div key={h} className={`text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555] ${cls}`}>{h}</div>
                      ))}
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-[#141414]">
                      {(finalInvoice.items || []).map((item, i) => {
                        const meta = BILL_TYPE_META[item.itemType] ?? BILL_TYPE_META.CUSTOM
                        return (
                          <div key={i} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 bg-white dark:bg-[#111]">
                            <div className="col-span-3">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${meta.cls}`}>
                                <meta.Icon className="w-2.5 h-2.5 shrink-0" />
                                {meta.label}
                              </span>
                            </div>
                            <div className="col-span-5 text-xs text-slate-600 dark:text-[#bbb] truncate" title={item.description}>{item.description}</div>
                            <div className="col-span-1 text-xs text-slate-400 text-center tabular-nums">{item.quantity}</div>
                            <div className="col-span-3 text-xs font-bold text-slate-800 dark:text-white text-right tabular-nums">{fmtMoney(item.totalPrice)}</div>
                          </div>
                        )
                      })}
                    </div>

                    {/* OT items appended inline when present */}
                    {otInvoices.length > 0 && otInvoices.flatMap(inv =>
                      (Array.isArray(inv.items) ? inv.items : []).map((item, i) => (
                        <div key={`ot-${inv.id}-${i}`} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 bg-white dark:bg-[#111] border-t border-slate-50 dark:border-[#141414]">
                          <div className="col-span-3">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10">
                              <Scissors className="w-2.5 h-2.5 shrink-0" /> OT
                            </span>
                          </div>
                          <div className="col-span-5 text-xs text-slate-600 dark:text-[#bbb] truncate" title={item.description || item.name}>{item.description || item.name || '—'}</div>
                          <div className="col-span-1 text-xs text-slate-400 text-center tabular-nums">{item.quantity ?? 1}</div>
                          <div className="col-span-3 text-xs font-bold text-slate-800 dark:text-white text-right tabular-nums">{fmtMoney(item.totalPrice ?? item.amount ?? 0)}</div>
                        </div>
                      ))
                    )}

                    <div className="px-4 py-3 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500 dark:text-[#888]">
                        <span>Admission Subtotal</span>
                        <span className="tabular-nums">{fmtMoney(finalInvoice.subtotal)}</span>
                      </div>
                      {Number(finalInvoice.tax) > 0 && (
                        <div className="flex justify-between text-xs text-slate-500 dark:text-[#888]">
                          <span>Tax</span>
                          <span className="tabular-nums">{fmtMoney(finalInvoice.tax)}</span>
                        </div>
                      )}
                      {Number(finalInvoice.discount) > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                          <span>Discount</span>
                          <span className="tabular-nums">−{fmtMoney(finalInvoice.discount)}</span>
                        </div>
                      )}
                      {otInvoices.length > 0 && (
                        <div className="flex justify-between text-xs text-slate-500 dark:text-[#888]">
                          <span>OT Charges</span>
                          <span className="tabular-nums">{fmtMoney(otInvoices.reduce((s, inv) => s + Number(inv.totalAmount ?? inv.total ?? 0), 0))}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white border-t border-slate-100 dark:border-[#1e1e1e] pt-2 mt-1">
                        <span>Grand Total</span>
                        <span className="tabular-nums">{fmtMoney(
                          Number(finalInvoice.total || 0) +
                          otInvoices.reduce((s, inv) => s + Number(inv.totalAmount ?? inv.total ?? 0), 0)
                        )}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : billingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Receipt className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No charges detected</p>
                  <p className="text-xs mt-1 opacity-60">Charges appear once services are recorded</p>
                </div>
              ) : (
                /* ── Pending / estimated charges (active admissions) ── */
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">
                      {admission.actualDischargeDate ? 'Admission Summary' : 'Pending Charges'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-[#555] mt-0.5">
                      {admission.actualDischargeDate
                        ? 'Estimated charges for this admission — no invoice generated yet'
                        : 'Auto-detected from services used during this admission'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-100 dark:border-[#1e1e1e]">
                      {[['Type','col-span-3'],['Description','col-span-5'],['Qty','col-span-1 text-center'],['Total','col-span-3 text-right']].map(([h,cls]) => (
                        <div key={h} className={`text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555] ${cls}`}>{h}</div>
                      ))}
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-[#141414]">
                      {billingItems.map(item => {
                        const meta = BILL_TYPE_META[item.itemType] ?? BILL_TYPE_META.CUSTOM
                        return (
                          <div key={item.key} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 bg-white dark:bg-[#111]">
                            <div className="col-span-3">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${meta.cls}`}>
                                <meta.Icon className="w-2.5 h-2.5 shrink-0" />
                                {meta.label}
                              </span>
                            </div>
                            <div className="col-span-5 text-xs text-slate-600 dark:text-[#bbb] truncate" title={item.description}>{item.description}</div>
                            <div className="col-span-1 text-xs text-slate-400 text-center tabular-nums">{item.quantity}</div>
                            <div className="col-span-3 text-xs font-bold text-slate-800 dark:text-white text-right tabular-nums">{fmtMoney(item.totalPrice)}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500 dark:text-[#888]">
                        <span>Subtotal</span>
                        <span className="font-semibold tabular-nums">{fmtMoney(subtotal)}</span>
                      </div>
                      {gst > 0 && (
                        <div className="flex justify-between text-xs text-slate-500 dark:text-[#888]">
                          <span>GST on medicines (18%)</span>
                          <span className="tabular-nums">{fmtMoney(gst)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white border-t border-slate-100 dark:border-[#1e1e1e] pt-2 mt-1">
                        <span>Estimated Total</span>
                        <span className="tabular-nums">{fmtMoney(grandTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {hasZeroPrice && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Some items show ₹0 — add them in Settings → Packages.
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 dark:text-[#555] text-center">
                    Estimated bill based on services used so far. Final amount may vary.
                  </p>
                </>
              )}

              {/* OT fetch error — show inline with retry */}
              {otInvoicesError && (
                <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-100 dark:border-[#1e1e1e] bg-white dark:bg-[#111]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-slate-500 dark:text-[#888]">Could not load OT charges</p>
                  </div>
                  <button
                    onClick={retryOtInvoices}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors">
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
