import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  X, BedDouble, Stethoscope, Clock, Calendar, LogOut, Scissors,
  Activity, Package, Receipt, Phone, User, Loader2, ExternalLink,
  RotateCcw, Wallet, ScanLine, Pill, FlaskConical, Wrench, AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'
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
  ROOM_CHARGE:  { label: 'Room',         Icon: BedDouble,    cls: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10' },
  CONSULTATION: { label: 'Consult',      Icon: Stethoscope,  cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' },
  RADIOLOGY:    { label: 'Radiology',    Icon: ScanLine,     cls: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10' },
  LAB_TEST:     { label: 'Lab',          Icon: FlaskConical, cls: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10' },
  MEDICINE:     { label: 'Medicine',     Icon: Pill,         cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' },
  CUSTOM:       { label: 'Custom',       Icon: Wrench,       cls: 'text-slate-600 dark:text-[#aaa] bg-slate-100 dark:bg-[#222]' },
}

function fmt(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd/MM/yyyy, hh:mm aa') } catch { return d }
}
function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy') } catch { return d }
}
function fmtMoney(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function IPDDetailPane({ admission, onClose, onDischarge, onMoveToOT, onReturnToWard }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('IPD Log')
  const [logs, setLogs] = useState([])
  const [assets, setAssets] = useState([])
  const [billingItems, setBillingItems] = useState([])
  const [otInvoices, setOtInvoices] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [assetsFetched, setAssetsFetched] = useState(false)
  const [billingFetched, setBillingFetched] = useState(false)

  /* ── Billing totals ── */
  const subtotal = useMemo(() => billingItems.reduce((s, i) => s + (i.totalPrice || 0), 0), [billingItems])
  const gst = useMemo(
    () => billingItems.filter(i => i.itemType === 'MEDICINE').reduce((s, i) => s + (i.totalPrice || 0), 0) * GST_RATE,
    [billingItems]
  )
  const grandTotal = subtotal + gst
  const hasZeroPrice = billingItems.some(i => Number(i.unitPrice) === 0 && i.itemType !== 'CUSTOM')

  /* ── Fetch IPD log (patient-specific) ── */
  const fetchLogs = useCallback(async () => {
    if (!admission) return
    setLoadingLogs(true)
    const events = []

    events.push({
      id: 'admitted',
      type: 'ADMITTED',
      title: admission.departmentName ? `Admitted to ${admission.departmentName}` : 'Patient Admitted',
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
      // Room logs — filter to this patient only by MRN
      admission.roomId
        ? roomLogsApi.getRoomLogs(admission.roomId, user.hospitalId).then(data =>
            data
              .filter(l => !l.patientMrn || l.patientMrn === admission.patientMrn)
              .forEach(l => {
                let title, subtitle
                if (l.event === 'ALLOCATED') {
                  title = `Moved into Room ${l.roomNumber}`
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

      // Ambulance — filter by this patient
      ambulanceApi.getBookings(user.hospitalId).then(data =>
        data
          .filter(b => String(b.patient?.id) === String(admission.patientId))
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

      // OT bookings
      otApi.get('/api/ot/bookings').then(res => {
        const bookings = Array.isArray(res.data) ? res.data : (res.data?.content ?? [])
        bookings
          .filter(ob =>
            (admission.otBookingId && String(ob.id) === String(admission.otBookingId)) ||
            String(ob.admissionId) === String(admission.id) ||
            String(ob.patientId) === String(admission.patientId)
          )
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

  /* ── Fetch billing (mirrors ViewBillingModal logic) ── */
  const fetchBilling = useCallback(async () => {
    setLoadingBilling(true)
    const admitMs = new Date(admission.admissionDate).getTime()
    const daysStayed = Math.max(1, Math.ceil((Date.now() - admitMs) / (1000 * 60 * 60 * 24)))
    let key = 0
    const items = []

    try {
      const [suggestions, services, fullAdmission, radiologyOrders, patientServices] = await Promise.all([
        invoiceApi.getSmartSuggestions(admission.patientId, admission.id).catch(() => ({})),
        hospitalServiceApi.list(user.hospitalId).catch(() => []),
        admissionApi.get(admission.id).catch(() => null),
        radiologyApi.getByAdmission(admission.id).catch(() => []),
        patientServicesApi.list(user.hospitalId).catch(() => []),
      ])

      // Room charge
      const roomNumber = admission.roomNumber || fullAdmission?.roomNumber
      if (roomNumber) {
        const pricePerDay =
          suggestions.roomCharge?.pricePerDay ||
          fullAdmission?.roomPricePerDay || 0
        const label = `Room ${roomNumber} (${daysStayed} day${daysStayed !== 1 ? 's' : ''})`
        items.push({ key: key++, itemType: 'ROOM_CHARGE', description: label, quantity: daysStayed, unitPrice: pricePerDay, totalPrice: daysStayed * pricePerDay })
      }

      // Consultations from suggestions
      const consults = Array.isArray(suggestions.consultations) ? suggestions.consultations : []
      consults.forEach(c => {
        const price = c.fee || c.price || 0
        items.push({ key: key++, itemType: 'CONSULTATION', description: c.description || c.name || 'Consultation', quantity: 1, unitPrice: price, totalPrice: price })
      })

      // Radiology
      const EXCLUDED = ['CANCELLED', 'BILLED'];
      (Array.isArray(radiologyOrders) ? radiologyOrders : [])
        .filter(r => !EXCLUDED.includes(r.status))
        .forEach(r => {
          const name = r.serviceName || r.investigationName || 'Radiology'
          const match = (Array.isArray(services) ? services : []).find(s => s.name?.toLowerCase() === name.toLowerCase())
          const price = match?.price ?? 0
          items.push({ key: key++, itemType: 'RADIOLOGY', description: name, quantity: 1, unitPrice: price, totalPrice: price })
        })

      // Medicines from suggestions
      const meds = Array.isArray(suggestions.medicines) ? suggestions.medicines : []
      meds.forEach(m => {
        const price = m.totalPrice || m.price || 0
        items.push({ key: key++, itemType: 'MEDICINE', description: m.name || 'Medicine', quantity: m.quantity || 1, unitPrice: m.unitPrice || price, totalPrice: price })
      })

      // Patient services (food, etc.)
      const enabledServices = (Array.isArray(patientServices) ? patientServices : []).filter(s => s.isActive)
      enabledServices.forEach(s => {
        if (s.type === 'FOOD') {
          const qty = daysStayed * 3
          items.push({ key: key++, itemType: 'CUSTOM', description: `${s.name} (${daysStayed}d × 3 meals)`, quantity: qty, unitPrice: s.pricePerMeal || 0, totalPrice: qty * (s.pricePerMeal || 0) })
        } else {
          items.push({ key: key++, itemType: 'CUSTOM', description: `${s.name} (${daysStayed}d)`, quantity: daysStayed, unitPrice: s.pricePerDay || 0, totalPrice: daysStayed * (s.pricePerDay || 0) })
        }
      })
    } catch {}

    setBillingItems(items)

    // OT invoices — generated at OT completion time, filtered server-side by patientId
    const otInvData = await otApi.get('/api/ot/invoices', { params: { patientId: admission.patientId } })
      .then(res => Array.isArray(res.data) ? res.data : (res.data?.content ?? []))
      .catch(() => [])
    setOtInvoices(otInvData)

    setBillingFetched(true)
    setLoadingBilling(false)
  }, [admission?.id, user?.hospitalId])

  /* ── Reset on admission change ── */
  useEffect(() => {
    setActiveTab('IPD Log')
    setLogs([])
    setAssets([])
    setBillingItems([])
    setOtInvoices([])
    setAssetsFetched(false)
    setBillingFetched(false)
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/25 pointer-events-auto" onClick={onClose} />

      {/* Panel */}
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
              <p className="text-xs text-slate-400 mt-0.5">MRN: {admission.patientMrn}</p>
            </div>
            <button onClick={onClose} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e1e] text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info strip */}
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

          {/* ID + actions row */}
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
                <button onClick={onDischarge}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
                  <LogOut className="w-3 h-3" /> Discharge
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
                        {/* Dot + line */}
                        <div className="flex flex-col items-center shrink-0 pt-1">
                          <div className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white shrink-0" />
                          {!isLast && <div className="w-px flex-1 bg-slate-100 dark:bg-[#1e1e1e] mt-1 mb-0" />}
                        </div>

                        {/* Card */}
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
              {loadingBilling ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Detecting pending charges…</span>
                </div>
              ) : billingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Receipt className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No charges detected</p>
                  <p className="text-xs mt-1 opacity-60">Charges appear once services are recorded</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">Pending Charges</p>
                    <p className="text-[11px] text-slate-400 dark:text-[#555] mt-0.5">Auto-detected from services used during this admission</p>
                  </div>

                  {/* Items table */}
                  <div className="rounded-lg border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-100 dark:border-[#1e1e1e]">
                      {[['Type', 'col-span-3'], ['Description', 'col-span-5'], ['Qty', 'col-span-1 text-center'], ['Total', 'col-span-3 text-right']].map(([h, cls]) => (
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

                    {/* Totals */}
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

                  {/* OT Invoices */}
                  {otInvoices.length > 0 && (
                    <div className="pt-2">
                      <div className="mb-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">OT Invoices</p>
                        <p className="text-[11px] text-slate-400 dark:text-[#555] mt-0.5">Finalized at time of OT procedure completion</p>
                      </div>
                      <div className="space-y-3">
                        {otInvoices.map(inv => {
                          const isPaid = inv.status === 'PAID' || inv.paymentStatus === 'PAID'
                          const invTotal = inv.totalAmount ?? inv.total ?? inv.amount ?? 0
                          const invItems = Array.isArray(inv.items) ? inv.items : (Array.isArray(inv.lineItems) ? inv.lineItems : [])
                          return (
                            <div key={inv.id} className="rounded-lg border border-violet-100 dark:border-violet-500/20 overflow-hidden">
                              {/* Invoice header */}
                              <div className="flex items-center justify-between px-4 py-2.5 bg-violet-50 dark:bg-violet-500/5 border-b border-violet-100 dark:border-violet-500/20">
                                <div>
                                  <p className="text-xs font-bold text-violet-700 dark:text-violet-400 font-mono">{inv.invoiceNumber || inv.invoiceId || inv.id}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(inv.createdAt || inv.invoiceDate || inv.date)}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isPaid
                                    ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                                    : 'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-500/20 dark:bg-amber-500/5'
                                }`}>{isPaid ? 'PAID' : 'UNPAID'}</span>
                              </div>

                              {/* Line items */}
                              {invItems.length > 0 && (
                                <div className="divide-y divide-slate-50 dark:divide-[#141414]">
                                  {invItems.map((item, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 items-center px-4 py-2 bg-white dark:bg-[#111]">
                                      <div className="col-span-6 text-xs text-slate-600 dark:text-[#bbb] truncate" title={item.description || item.name}>
                                        {item.description || item.name || '—'}
                                      </div>
                                      <div className="col-span-2 text-xs text-slate-400 text-center tabular-nums">×{item.quantity ?? 1}</div>
                                      <div className="col-span-4 text-xs font-semibold text-slate-700 dark:text-[#ccc] text-right tabular-nums">
                                        {fmtMoney(item.totalPrice ?? item.amount ?? item.unitPrice ?? 0)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Invoice total */}
                              <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] flex justify-between items-center border-t border-slate-100 dark:border-[#1e1e1e]">
                                <span className="text-xs font-bold text-slate-500 dark:text-[#888]">Invoice Total</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{fmtMoney(invTotal)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 dark:text-[#555] text-center">
                    Estimated bill based on services used so far. Final amount may vary.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
