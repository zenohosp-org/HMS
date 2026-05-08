import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  X, BedDouble, Stethoscope, Clock, Calendar, LogOut, Scissors,
  Activity, Package, Receipt, Phone, User, Loader2, ExternalLink,
  RotateCcw, Wallet
} from 'lucide-react'
import { format } from 'date-fns'
import { roomLogsApi, radiologyApi, ambulanceApi, assetApi, invoiceApi } from '@/utils/api'
import axios from 'axios'

const otApi = axios.create({ baseURL: 'https://api-ot.zenohosp.com', withCredentials: true })

const TABS = ['IPD Log', 'Attendor Details', 'Room Mapped Assets', 'IPD Billing']

const EVENT_META = {
  ADMITTED:         { color: 'emerald', label: 'Patient Admitted' },
  ALLOCATED:        { color: 'blue',    label: 'Room Assigned' },
  DEALLOCATED:      { color: 'amber',   label: 'Room Vacated' },
  ATTENDER_ASSIGNED:{ color: 'slate',   label: 'Attender Assigned' },
  ATTENDER_UPDATED: { color: 'slate',   label: 'Attender Updated' },
  RADIOLOGY:        { color: 'violet',  label: 'Radiology' },
  AMBULANCE:        { color: 'rose',    label: 'Ambulance' },
  OT:               { color: 'purple',  label: 'OT Procedure' },
  DISCHARGED:       { color: 'slate',   label: 'Discharged' },
}

const DOT_COLORS = {
  emerald: 'bg-emerald-500',
  blue:    'bg-blue-500',
  amber:   'bg-amber-400',
  slate:   'bg-slate-400',
  violet:  'bg-violet-500',
  rose:    'bg-rose-500',
  purple:  'bg-purple-500',
}

const TEXT_COLORS = {
  emerald: 'text-emerald-700 dark:text-emerald-400',
  blue:    'text-blue-700 dark:text-blue-400',
  amber:   'text-amber-700 dark:text-amber-400',
  slate:   'text-slate-600 dark:text-slate-400',
  violet:  'text-violet-700 dark:text-violet-400',
  rose:    'text-rose-700 dark:text-rose-400',
  purple:  'text-purple-700 dark:text-purple-400',
}

const BG_COLORS = {
  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
  blue:    'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
  amber:   'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20',
  slate:   'bg-slate-50 dark:bg-slate-500/10 border-slate-100 dark:border-slate-500/20',
  violet:  'bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20',
  rose:    'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20',
  purple:  'bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20',
}

function fmt(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy, h:mm a') } catch { return d }
}
function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy') } catch { return d }
}

export default function IPDDetailPane({ admission, onClose, onDischarge, onMoveToOT, onReturnToWard }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('IPD Log')
  const [logs, setLogs] = useState([])
  const [assets, setAssets] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [assetsFetched, setAssetsFetched] = useState(false)
  const [invoicesFetched, setInvoicesFetched] = useState(false)

  const fetchLogs = useCallback(async () => {
    if (!admission) return
    setLoadingLogs(true)
    const events = []

    // Admission event
    events.push({
      id: 'admitted',
      type: 'ADMITTED',
      title: 'Patient Admitted',
      subtitle: [admission.departmentName, admission.admittingDoctorName ? `Dr. ${admission.admittingDoctorName}` : null].filter(Boolean).join(' · '),
      timestamp: new Date(admission.admissionDate),
    })

    // Discharge event
    if (admission.actualDischargeDate) {
      events.push({
        id: 'discharged',
        type: 'DISCHARGED',
        title: 'Patient Discharged',
        subtitle: admission.dischargeDiagnosis || admission.dischargeNote || '',
        timestamp: new Date(admission.actualDischargeDate),
      })
    }

    await Promise.allSettled([
      // Room logs
      admission.roomId
        ? roomLogsApi.getRoomLogs(admission.roomId, user.hospitalId).then(data =>
            data.forEach(l => events.push({
              id: `room-${l.id}`,
              type: l.event,
              title: (EVENT_META[l.event] || {}).label || l.event.replace(/_/g, ' '),
              subtitle: [`Room ${l.roomNumber}`, l.performedBy ? `by ${l.performedBy}` : null].filter(Boolean).join(' · '),
              timestamp: new Date(l.createdAt),
            })))
        : Promise.resolve(),

      // Radiology
      radiologyApi.getByAdmission(admission.id).then(data =>
        data.forEach(r => events.push({
          id: `rad-${r.id}`,
          type: 'RADIOLOGY',
          title: r.serviceName || 'Radiology Order',
          subtitle: [r.status?.replace(/_/g, ' '), r.technicianName ? `by ${r.technicianName}` : null].filter(Boolean).join(' · '),
          timestamp: new Date(r.reportedAt || r.scannedAt || r.createdAt),
          badge: r.status,
        }))),

      // Ambulance bookings – filter by patientId client-side
      ambulanceApi.getBookings(user.hospitalId).then(data =>
        data
          .filter(b => b.patient?.id === admission.patientId || String(b.patient?.id) === String(admission.patientId))
          .forEach(b => events.push({
            id: `amb-${b.id}`,
            type: 'AMBULANCE',
            title: `Ambulance — ${b.ambulanceType?.name || b.ambulanceType || ''}`,
            subtitle: [b.pickupAddress, b.status].filter(Boolean).join(' · '),
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
          .forEach(ob => events.push({
            id: `ot-${ob.id}`,
            type: 'OT',
            title: ob.procedureName || ob.surgeryType || ob.procedure || 'OT Procedure',
            subtitle: [ob.status, ob.surgeonName || ob.surgeon].filter(Boolean).join(' · '),
            timestamp: new Date(ob.scheduledDate || ob.bookingDate || ob.createdAt),
            badge: ob.status,
          }))
      }).catch(() => {}),
    ])

    events.sort((a, b) => b.timestamp - a.timestamp)
    setLogs(events)
    setLoadingLogs(false)
  }, [admission?.id, user?.hospitalId])

  useEffect(() => {
    setActiveTab('IPD Log')
    setLogs([])
    setAssets([])
    setInvoices([])
    setAssetsFetched(false)
    setInvoicesFetched(false)
    fetchLogs()
  }, [admission?.id])

  useEffect(() => {
    if (activeTab === 'Room Mapped Assets' && !assetsFetched && admission?.roomId) {
      setLoadingAssets(true)
      assetApi.getByRoom(user.hospitalId, admission.roomId)
        .then(data => { setAssets(data); setAssetsFetched(true) })
        .catch(() => setAssetsFetched(true))
        .finally(() => setLoadingAssets(false))
    }
    if (activeTab === 'IPD Billing' && !invoicesFetched) {
      setLoadingInvoices(true)
      invoiceApi.getByPatient(admission.patientId)
        .then(data => {
          const admissionInvoices = data.filter(inv =>
            !inv.admissionId || String(inv.admissionId) === String(admission.id)
          )
          setInvoices(admissionInvoices.length ? admissionInvoices : data)
          setInvoicesFetched(true)
        })
        .catch(() => setInvoicesFetched(true))
        .finally(() => setLoadingInvoices(false))
    }
  }, [activeTab])

  if (!admission) return null

  const isAdmitted = admission.status === 'ADMITTED'
  const canMoveOT = isAdmitted && !admission.inOt && admission.roomType !== 'POST_OT'
  const canReturnWard = isAdmitted && !!admission.previousRoomId

  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg h-full bg-white dark:bg-[#0f0f0f] shadow-2xl flex flex-col pointer-events-auto border-l border-slate-200 dark:border-[#1e1e1e]">

        {/* ── Header ── */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-[#1a1a1a]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  admission.status === 'ADMITTED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20'
                }`}>{admission.status}</span>
                {admission.inOt && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20 flex items-center gap-1">
                    <Scissors className="w-2.5 h-2.5" /> In OT
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">{admission.patientName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">MRN: {admission.patientMrn}</p>
            </div>
            <button onClick={onClose} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e1e] text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Key info strip */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <BedDouble className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{admission.roomNumber ? `Room ${admission.roomNumber} · ${admission.roomType}` : 'No room assigned'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Stethoscope className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{admission.admittingDoctorName ? `Dr. ${admission.admittingDoctorName}` : '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{fmtDate(admission.admissionDate)}</span>
            </div>
            {admission.approxDischargeDate && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">Est. {fmtDate(admission.approxDischargeDate)}</span>
              </div>
            )}
          </div>

          {/* ID chips */}
          <div className="flex items-center gap-2 mt-3">
            {admission.ipdId && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                {admission.ipdId}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-500 border border-slate-200 dark:border-[#2a2a2a]">
              {admission.admissionNumber}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <button
              onClick={() => navigate(`/patients/${admission.patientId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#1e1e1e] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2a2a2a] border border-slate-200 dark:border-[#2a2a2a] transition-colors">
              <User className="w-3.5 h-3.5" /> Patient Details
              <ExternalLink className="w-3 h-3 opacity-50" />
            </button>
            {isAdmitted && (
              <button
                onClick={onDischarge}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Discharge
              </button>
            )}
            {canMoveOT && (
              <button
                onClick={onMoveToOT}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 border border-violet-200 dark:border-violet-500/20 transition-colors">
                <Scissors className="w-3.5 h-3.5" /> Move to OT
              </button>
            )}
            {canReturnWard && (
              <button
                onClick={onReturnToWard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Return to Ward
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="shrink-0 flex border-b border-slate-100 dark:border-[#1a1a1a] px-5 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 text-xs font-semibold pb-2.5 pt-3 px-0.5 mr-5 border-b-2 transition-colors ${
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
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-3 bottom-3 w-px bg-slate-100 dark:bg-[#1e1e1e]" />
                  <div className="space-y-0">
                    {logs.map((ev, idx) => {
                      const meta = EVENT_META[ev.type] || { color: 'slate', label: ev.type }
                      const color = meta.color
                      return (
                        <div key={ev.id} className="relative flex gap-4 pb-5">
                          {/* Dot */}
                          <div className={`relative z-10 shrink-0 w-3.5 h-3.5 rounded-full mt-1 ring-2 ring-white dark:ring-[#0f0f0f] ${DOT_COLORS[color]}`} />
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className={`rounded-lg border px-3.5 py-3 ${BG_COLORS[color]}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-bold ${TEXT_COLORS[color]}`}>{ev.title}</p>
                                  {ev.subtitle && (
                                    <p className="text-[11px] text-slate-500 dark:text-[#777] mt-0.5 leading-snug">{ev.subtitle}</p>
                                  )}
                                </div>
                                {ev.badge && (
                                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${TEXT_COLORS[color]} border border-current opacity-60`}>
                                    {ev.badge.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-[#555] mt-1.5">{fmt(ev.timestamp)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attendor Details */}
          {activeTab === 'Attendor Details' && (
            <div className="p-5">
              {admission.attenderName ? (
                <div className="rounded-lg border border-slate-200 dark:border-[#1e1e1e] bg-white dark:bg-[#111] overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-100 dark:border-[#1e1e1e]">
                    <p className="text-xs font-bold text-slate-500 dark:text-[#666] uppercase tracking-wider">Attendor on Record</p>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-[#ddd] mt-0.5">{admission.attenderName}</p>
                      </div>
                    </div>
                    {admission.attenderPhone && (
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                          <a href={`tel:${admission.attenderPhone}`} className="text-sm font-semibold text-slate-800 dark:text-[#ddd] mt-0.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors block">
                            {admission.attenderPhone}
                          </a>
                        </div>
                      </div>
                    )}
                    {admission.attenderRelationship && (
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Relationship</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-[#ddd] mt-0.5 capitalize">{admission.attenderRelationship}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <User className="w-8 h-8 mb-2 opacity-30" />
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
                  <Package className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No room assigned</p>
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Package className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No assets mapped to this room</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assets.map(asset => (
                    <div key={asset.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 dark:border-[#1e1e1e] bg-white dark:bg-[#111]">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1e1e1e] flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-[#ddd] truncate">{asset.name || asset.assetName}</p>
                        <p className="text-xs text-slate-400 truncate">{asset.category || asset.assetCategory || '—'}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        asset.status === 'AVAILABLE' || asset.status === 'IN_USE'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                      }`}>
                        {(asset.status || '—').replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* IPD Billing */}
          {activeTab === 'IPD Billing' && (
            <div className="p-5">
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading billing…</span>
                </div>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Receipt className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No invoices found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map(inv => (
                    <div key={inv.id} className="rounded-lg border border-slate-200 dark:border-[#1e1e1e] bg-white dark:bg-[#111] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-[#1a1a1a]">
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-[#ccc]">{inv.invoiceNumber || inv.id?.slice(0, 8)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{fmt(inv.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                          }`}>
                            {(inv.status || '—').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      {inv.items?.length > 0 && (
                        <div className="px-4 py-2 space-y-1">
                          {inv.items.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-slate-500">
                              <span className="truncate flex-1">{item.description}</span>
                              <span className="shrink-0 ml-3 font-medium text-slate-700 dark:text-[#bbb]">₹{Number(item.totalPrice || 0).toLocaleString()}</span>
                            </div>
                          ))}
                          {inv.items.length > 3 && (
                            <p className="text-[10px] text-slate-400">+{inv.items.length - 3} more items</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border-t border-slate-100 dark:border-[#1a1a1a]">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Wallet className="w-3.5 h-3.5" />
                          <span>{inv.paymentMethod || 'Not paid'}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">₹{Number(inv.total || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
