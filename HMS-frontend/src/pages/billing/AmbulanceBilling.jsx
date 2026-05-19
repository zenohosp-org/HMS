import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { ambulanceApi } from '@/utils/api'
import Pagination from '@/components/ui/Pagination'
import {
  Ambulance, Search, CheckCircle2, Clock, XCircle,
  Printer, TrendingUp, AlertCircle, Loader2,
  ReceiptText, MoreHorizontal, MapPin, User, Navigation,
  IndianRupee
} from 'lucide-react'

const PAGE_SIZE = 10

const BOOKING_STATUS_CFG = {
  PENDING:    { label: 'Pending',    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',     Icon: Clock         },
  DISPATCHED: { label: 'Dispatched', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',           Icon: Navigation    },
  EN_ROUTE:   { label: 'En Route',   cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20', Icon: Ambulance    },
  COMPLETED:  { label: 'Completed',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', Icon: CheckCircle2 },
  CANCELLED:  { label: 'Cancelled',  cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',             Icon: XCircle      },
}

const PAY_STATUS_CFG = {
  PAID:   { label: 'Paid',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', Icon: CheckCircle2 },
  UNPAID: { label: 'Unpaid', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',             Icon: Clock        },
}

function fmt(n) {
  if (!n) return '₹0'
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(dateStr, timeStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + (timeStr ? 'T' + timeStr : ''))
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
}

function StatCard({ label, value, sub, Icon, accent }) {
  const accents = {
    blue:    'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber:   'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400',
    rose:    'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400',
  }
  return (
    <div className="bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 ${accents[accent]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function AmbulanceBilling() {
  const { user } = useAuth()
  const { notify } = useNotification()

  const [bookings, setBookings]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [payFilter, setPayFilter]     = useState('ALL')
  const [page, setPage]               = useState(1)
  const [menuState, setMenuState]     = useState(null)
  const [markingId, setMarkingId]     = useState(null)

  const loadData = () => {
    if (!user?.hospitalId) return
    setLoading(true)
    ambulanceApi.getBookings(user.hospitalId)
      .then(data => setBookings(Array.isArray(data) ? data : []))
      .catch(() => notify('Failed to load ambulance bookings', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [user?.hospitalId])

  useEffect(() => {
    const close = () => setMenuState(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const filtered = useMemo(() => {
    let list = bookings.filter(b => !b.mergedToIpd)
    if (payFilter === 'PAID')   list = list.filter(b => b.paymentStatus === 'PAID')
    if (payFilter === 'UNPAID') list = list.filter(b => b.paymentStatus !== 'PAID')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(b => {
        const patName = b.patient
          ? `${b.patient.firstName ?? ''} ${b.patient.lastName ?? ''}`.toLowerCase()
          : ''
        const uhid = (b.patient?.uhid ?? '').toLowerCase()
        const vNum = (b.vehicleNumber ?? b.vehicle?.vehicleNumber ?? '').toLowerCase()
        const pickup = (b.pickupAddress ?? '').toLowerCase()
        const ref = `amb-${b.id}`
        return patName.includes(q) || uhid.includes(q) || vNum.includes(q) || pickup.includes(q) || ref.includes(q)
      })
    }
    return list
  }, [bookings, payFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    return {
      total:       bookings.length,
      collected:   bookings.filter(b => b.paymentStatus === 'PAID').reduce((s, b) => s + Number(b.charge || 0), 0),
      outstanding: bookings.filter(b => b.paymentStatus !== 'PAID' && b.status === 'COMPLETED').reduce((s, b) => s + Number(b.charge || 0), 0),
      today:       bookings.filter(b => (b.bookingDate ?? '').slice(0, 10) === todayStr).length,
    }
  }, [bookings])

  const handlePayFilter = (f) => { setPayFilter(f); setPage(1) }

  const openMenu = (booking, btnEl) => {
    const r = btnEl.getBoundingClientRect()
    const flipUp = window.innerHeight - r.bottom < 160
    setMenuState({
      booking,
      right: window.innerWidth - r.right,
      ...(flipUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }

  const markPaid = async (booking) => {
    setMarkingId(booking.id)
    try {
      await ambulanceApi.updateStatus(booking.id, { paymentStatus: 'PAID' })
      notify('Booking marked as paid', 'success')
      loadData()
    } catch {
      notify('Failed to update payment status', 'error')
    } finally {
      setMarkingId(null)
    }
  }

  const printReceipt = (booking) => {
    const ref       = `AMB-${String(booking.id).padStart(6, '0')}`
    const typeName  = booking.ambulanceType?.name ?? ''
    const vehNum    = booking.vehicleNumber ?? booking.vehicle?.vehicleNumber ?? ''
    const driver    = booking.driverName ?? ''
    const charge    = Number(booking.charge || 0)
    const patientName = booking.patient
      ? `${booking.patient.firstName ?? ''} ${booking.patient.lastName ?? ''}`.trim()
      : null
    const uhid  = booking.patient?.uhid ?? ''
    const pickup = booking.pickupAddress ?? ''
    const dest  = booking.destinationAddress ?? ''
    const dateStr = fmtDate(booking.bookingDate, booking.bookingTime)
    const paidCls = booking.paymentStatus === 'PAID'
      ? 'background:#d1fae5;color:#065f46'
      : 'background:#fef3c7;color:#92400e'

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>Ambulance Receipt ${ref}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:36px}@media print{body{padding:24px}}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:13px}.label{color:#6b7280;font-weight:500}.val{font-weight:600;color:#111}</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #f97316">
        <div>
          <div style="font-size:22px;font-weight:800;color:#f97316">ZenoHosp HMS</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${user?.hospitalName ?? 'Hospital Management System'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700">${ref}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">${dateStr}</div>
          <div style="margin-top:8px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;${paidCls}">${booking.paymentStatus}</span></div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px">Patient</div>
        ${patientName
          ? `<div style="font-size:15px;font-weight:700">${patientName}</div>${uhid ? `<div style="font-size:12px;color:#6b7280">UHID: ${uhid}</div>` : ''}`
          : `<div style="font-size:14px;font-weight:600;color:#d97706">Walk-in / Emergency</div>`}
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px">
        <div class="row"><span class="label">Ambulance Type</span><span class="val">${typeName || '—'}</span></div>
        <div class="row"><span class="label">Vehicle Number</span><span class="val">${vehNum || '—'}</span></div>
        ${driver ? `<div class="row"><span class="label">Driver</span><span class="val">${driver}</span></div>` : ''}
        ${pickup ? `<div class="row"><span class="label">Pickup</span><span class="val" style="max-width:200px;text-align:right">${pickup}</span></div>` : ''}
        ${dest ? `<div class="row"><span class="label">Destination</span><span class="val" style="max-width:200px;text-align:right">${dest}</span></div>` : ''}
        ${booking.notes ? `<div class="row"><span class="label">Notes</span><span class="val">${booking.notes}</span></div>` : ''}
      </div>
      <div style="display:flex;justify-content:flex-end">
        <div style="min-width:200px;border-top:2px solid #1a1a1a;padding-top:8px">
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#111"><span>Total Charge</span><span>₹${charge.toLocaleString('en-IN')}</span></div>
        </div>
      </div>
      <div style="margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center">
        Generated by ZenoHosp HMS · ${window.location.hostname}
      </div>
    </body></html>`

    const iframe = document.createElement('iframe')
    iframe.className = 'print-frame'
    document.body.appendChild(iframe)
    iframe.contentDocument.open()
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      iframe.contentWindow.onafterprint = () => document.body.removeChild(iframe)
    }, 250)
  }

  const thCls = 'px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left'

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] gap-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Ambulance Billing</h1>
        <span className="px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-bold border border-orange-100 dark:border-orange-800/30">
          {bookings.length} bookings
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Bookings"  value={stats.total}              sub="all time"                Icon={Ambulance}   accent="blue"    />
        <StatCard label="Collected"       value={fmt(stats.collected)}     sub="from paid bookings"      Icon={TrendingUp}  accent="emerald" />
        <StatCard label="Outstanding"     value={fmt(stats.outstanding)}   sub="completed but unpaid"    Icon={AlertCircle} accent="amber"   />
        <StatCard label="Today"           value={stats.today}              sub="booked today"            Icon={Clock}       accent="rose"    />
      </div>

      {/* Table Container */}
      <div className="flex flex-col flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden min-h-0">

        {/* Controls */}
        <div className="flex items-center justify-end px-5 py-3 border-b border-slate-100 dark:border-[#1a1a1a] gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-0.5">
              {[
                { key: 'ALL',    label: 'All'    },
                { key: 'UNPAID', label: 'Unpaid' },
                { key: 'PAID',   label: 'Paid'   },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handlePayFilter(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    payFilter === key
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-500 dark:text-[#888] hover:text-slate-700 dark:hover:text-[#aaa]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, vehicle, address…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 pr-3 py-2 w-60 rounded-lg border border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-white/95 dark:bg-[#111]/95 backdrop-blur-sm">
                <th className={thCls}>Ref & Date</th>
                <th className={thCls}>Patient</th>
                <th className={thCls}>Vehicle</th>
                <th className={thCls}>Route</th>
                <th className={thCls}>Charge</th>
                <th className={thCls + ' text-center'}>Status</th>
                <th className={thCls + ' text-center'}>Payment</th>
                <th className={thCls + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                      <p className="text-sm font-medium text-slate-400">Loading bookings…</p>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#1a1a1a] flex items-center justify-center">
                        <Ambulance className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">
                        {search || payFilter !== 'ALL' ? 'No bookings match your filters.' : 'No ambulance bookings yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(b => {
                  const bCfg  = BOOKING_STATUS_CFG[b.status]  ?? BOOKING_STATUS_CFG.PENDING
                  const pCfg  = PAY_STATUS_CFG[b.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID']
                  const BIcon = bCfg.Icon
                  const PIcon = pCfg.Icon
                  const typeName  = b.ambulanceType?.name ?? ''
                  const vehNum    = b.vehicleNumber ?? b.vehicle?.vehicleNumber ?? ''
                  const patName   = b.patient
                    ? `${b.patient.firstName ?? ''} ${b.patient.lastName ?? ''}`.trim()
                    : null
                  const canMarkPaid = b.status === 'COMPLETED' && b.paymentStatus !== 'PAID'

                  return (
                    <tr key={b.id} className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all">

                      {/* Ref & Date */}
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                          AMB-{String(b.id).padStart(6, '0')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDate(b.bookingDate, b.bookingTime)}</p>
                      </td>

                      {/* Patient */}
                      <td className="px-5 py-4">
                        {patName ? (
                          <>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">{patName}</p>
                            {b.patient?.uhid && (
                              <p className="text-xs text-slate-400 mt-0.5">{b.patient.uhid}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <p className="font-semibold text-sm text-amber-700 dark:text-amber-400">Walk-in / Emergency</p>
                            </div>
                            {b.pickupAddress && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]" title={b.pickupAddress}>
                                {b.pickupAddress}
                              </p>
                            )}
                          </>
                        )}
                      </td>

                      {/* Vehicle */}
                      <td className="px-5 py-4">
                        {typeName && (
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{typeName}</p>
                        )}
                        {vehNum && (
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">{vehNum}</p>
                        )}
                        {!typeName && !vehNum && (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Route */}
                      <td className="px-5 py-4 max-w-[180px]">
                        {b.pickupAddress && (
                          <div className="flex items-start gap-1">
                            <MapPin className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-slate-600 dark:text-[#aaa] truncate" title={b.pickupAddress}>{b.pickupAddress}</p>
                          </div>
                        )}
                        {b.destinationAddress && (
                          <div className="flex items-start gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-rose-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-slate-600 dark:text-[#aaa] truncate" title={b.destinationAddress}>{b.destinationAddress}</p>
                          </div>
                        )}
                        {!b.pickupAddress && !b.destinationAddress && (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Charge */}
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {b.charge != null ? fmt(b.charge) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                        </p>
                      </td>

                      {/* Booking Status */}
                      <td className="px-5 py-4">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${bCfg.cls}`}>
                            <BIcon className="w-3 h-3" /> {bCfg.label}
                          </span>
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="px-5 py-4">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${pCfg.cls}`}>
                            <PIcon className="w-3 h-3" /> {pCfg.label}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => { e.stopPropagation(); openMenu(b, e.currentTarget) }}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
                        >
                          {markingId === b.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <MoreHorizontal className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-[#1a1a1a]">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Context Action Menu */}
      {menuState && (() => {
        const { booking, right, top, bottom } = menuState
        const canMarkPaid = booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID'
        const itemClass = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222] transition-colors text-left disabled:opacity-40'
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuState(null)} />
            <div
              style={{ position: 'fixed', right, ...(top !== undefined ? { top } : { bottom }), zIndex: 50 }}
              className="w-52 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-slate-100 dark:border-[#252525] py-1.5"
            >
              {canMarkPaid && (
                <button
                  onClick={() => { setMenuState(null); markPaid(booking) }}
                  className={itemClass}
                >
                  <IndianRupee className="w-4 h-4 shrink-0 text-emerald-500" /> Mark as Paid
                </button>
              )}
              <button
                onClick={() => { setMenuState(null); printReceipt(booking) }}
                className={itemClass}
              >
                <Printer className="w-4 h-4 shrink-0" /> Print Receipt
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}
