import { useState, useEffect, useMemo, Fragment } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { invoiceApi, bankApi, admissionApi, patientServicesApi } from '@/utils/api'
import Pagination from '@/components/ui/Pagination'
import CreateInvoiceModal from '@/components/modals/CreateInvoiceModal'
import FinalizeIPDBillingModal from '@/components/modals/FinalizeIPDBillingModal'
import { InvoiceDetailModal } from '@/pages/billing/InvoiceList'
import {
  ReceiptText, Search, CheckCircle2, Clock, XCircle,
  Printer, TrendingUp, AlertCircle, Loader2,
  BedDouble, ScanLine, Stethoscope, FlaskConical, Pill, Wrench,
  Receipt, Eye, Plus,
} from 'lucide-react'

const PAGE_SIZE = 10

const STATUS_CFG = {
  PAID:      { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', Icon: CheckCircle2 },
  UNPAID:    { label: 'Unpaid',    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',             Icon: Clock        },
  PARTIAL:   { label: 'Partial',   cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',       Icon: AlertCircle  },
  CANCELLED: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',                   Icon: XCircle      },
}

const TYPE_META = {
  MEDICINE:     { bg: 'bg-emerald-100 dark:bg-emerald-500/20', icon: <Pill        className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> },
  LAB_TEST:     { bg: 'bg-slate-100 dark:bg-slate-700/40',     icon: <FlaskConical className="w-3 h-3 text-slate-600 dark:text-slate-300" />    },
  CONSULTATION: { bg: 'bg-blue-100 dark:bg-blue-500/20',       icon: <Stethoscope className="w-3 h-3 text-blue-600 dark:text-blue-400" />       },
  ROOM_CHARGE:  { bg: 'bg-orange-100 dark:bg-orange-500/20',   icon: <BedDouble   className="w-3 h-3 text-orange-600 dark:text-orange-400" />   },
  RADIOLOGY:    { bg: 'bg-violet-100 dark:bg-violet-500/20',   icon: <ScanLine    className="w-3 h-3 text-violet-600 dark:text-violet-400" />   },
  CUSTOM:       { bg: 'bg-slate-100 dark:bg-[#222]',           icon: <Wrench      className="w-3 h-3 text-slate-500" />                          },
}

function fmt(n) {
  if (!n) return '₹0'
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function ItemTypePips({ items }) {
  if (!items?.length) return <span className="text-xs text-slate-400">—</span>
  const unique = [...new Set(items.map(i => i.itemType))]
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {unique.map(type => {
        const m = TYPE_META[type] ?? TYPE_META.CUSTOM
        return (
          <span key={type} className={`w-5 h-5 rounded flex items-center justify-center ${m.bg}`}>
            {m.icon}
          </span>
        )
      })}
      <span className="text-xs text-slate-400 ml-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</span>
    </div>
  )
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

export default function Billing() {
  const { user } = useAuth()
  const { notify } = useNotification()

  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('OPD')
  const [opdFilter, setOpdFilter] = useState('ALL')
  const [ipdFilter, setIpdFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [activeAdmissions, setActiveAdmissions] = useState([])
  const [finalizeAdmission, setFinalizeAdmission] = useState(null)
  const [detailInvoiceId, setDetailInvoiceId] = useState(null)

  const load = async () => {
    if (!user?.hospitalId) return
    try {
      setLoading(true)
      const [data, admData] = await Promise.all([
        invoiceApi.getByHospital(user.hospitalId),
        admissionApi.list(user.hospitalId, false).catch(() => []),
      ])
      const list = Array.isArray(data) ? data : []
      setInvoices(list)
      setActiveAdmissions(Array.isArray(admData) ? admData : [])

      // Fire-and-forget: silently sync estimated totals for ₹0 UNPAID IPD invoices
      const zeroPending = list.filter(i => !!i.admissionId && i.status === 'UNPAID' && Number(i.total || 0) === 0)
      if (zeroPending.length > 0) {
        patientServicesApi.list(user.hospitalId).catch(() => []).then(patientServices => {
          const activeServices = (Array.isArray(patientServices) ? patientServices : []).filter(s => s.isActive)
          zeroPending.forEach(async (inv) => {
            try {
              const [suggestions, admDetails] = await Promise.all([
                invoiceApi.getSmartSuggestions(inv.patientId, inv.admissionId).catch(() => ({})),
                admissionApi.get(inv.admissionId).catch(() => null),
              ])
              const admitDate = admDetails?.admissionDate ? new Date(admDetails.admissionDate) : null
              const elapsedMs = admitDate ? Date.now() - admitDate.getTime() : 0
              const roomDays = Math.floor(elapsedMs / 86400000)
              let total = 0
              if (suggestions.roomCharge?.pricePerDay && roomDays > 0) total += Number(suggestions.roomCharge.pricePerDay) * roomDays
              activeServices.forEach(s => {
                if (s.type === 'FOOD') total += Number(s.pricePerMeal || 0) * roomDays * 3
                else if (s.type === 'REGISTRATION' && s.oneTimeCharge) total += Number(s.pricePerDay || 0)
                else total += Number(s.pricePerDay || 0) * roomDays
              })
              if (total > 0) {
                await invoiceApi.updateEstimate(inv.id, total)
                setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, total, subtotal: total } : i))
              }
            } catch {}
          })
        })
      }
    } catch {
      notify('Failed to load invoices', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.hospitalId])

  const reloadAdmissions = () => load()

  const today = new Date().toDateString()

  const stats = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'PAID')
    const unpaid = invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIAL')
    return {
      total: invoices.length,
      collected: paid.reduce((s, i) => s + Number(i.total), 0),
      outstanding: unpaid.reduce((s, i) => s + Number(i.total), 0),
      todayCount: invoices.filter(i => new Date(i.createdAt).toDateString() === today).length,
    }
  }, [invoices])

  // Set of active admission IDs and patient IDs for quick lookup
  const activeAdmissionIds = useMemo(
    () => new Set(activeAdmissions.map(a => String(a.id))),
    [activeAdmissions]
  )
  const activeAdmissionPatientIds = useMemo(
    () => new Set(activeAdmissions.map(a => String(a.patientId))),
    [activeAdmissions]
  )

  // Split OPD / IPD by whether the invoice is linked to an admission.
  // Hide unpaid/partial OPD invoices for patients who are currently admitted —
  // those consultation charges are absorbed into the IPD bill.
  const opdInvoices = useMemo(() => invoices.filter(i =>
    !i.admissionId &&
    !(
      (i.status === 'UNPAID' || i.status === 'PARTIAL') &&
      activeAdmissionPatientIds.has(String(i.patientId))
    )
  ), [invoices, activeAdmissionPatientIds])
  const ipdInvoices = useMemo(() => invoices.filter(i => !!i.admissionId), [invoices])

  const currentInvoices = tab === 'OPD' ? opdInvoices : ipdInvoices
  const currentFilter = tab === 'OPD' ? opdFilter : ipdFilter
  const setCurrentFilter = (f) => {
    if (tab === 'OPD') setOpdFilter(f); else setIpdFilter(f)
    setPage(1)
  }

  const filtered = useMemo(() => {
    let list = currentFilter === 'ALL' ? currentInvoices : currentInvoices.filter(i => i.status === currentFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.patientName?.toLowerCase().includes(q) ||
        i.patientUhid?.toLowerCase().includes(q)
      )
    }
    return list
  }, [currentInvoices, currentFilter, search])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const printInvoice = (inv) => {
    const items = inv.items ?? []
    const total = Number(inv.total)
    const discount = Number(inv.discount || 0)
    const subtotal = total + discount
    const statusCls = { PAID: 'background:#d1fae5;color:#065f46', UNPAID: 'background:#fef3c7;color:#92400e', PARTIAL: 'background:#ffedd5;color:#9a3412', CANCELLED: 'background:#fee2e2;color:#991b1b' }
    const itemRows = items.map(item => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${item.itemType?.replace('_', ' ') ?? ''}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${item.description ?? ''}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;text-align:center">×${item.quantity}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;text-align:right">₹${Number(item.unitPrice).toLocaleString('en-IN')}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600;color:#111;text-align:right">₹${Number(item.totalPrice).toLocaleString('en-IN')}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>Invoice ${inv.invoiceNumber}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:36px}table{width:100%;border-collapse:collapse}@media print{body{padding:24px}}</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #10b981">
        <div>
          <div style="font-size:22px;font-weight:800;color:#10b981">ZenoHosp HMS</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${user?.hospitalName ?? 'Hospital Management System'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700">${inv.invoiceNumber}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">${inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</div>
          <div style="margin-top:8px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;${statusCls[inv.status] ?? statusCls.UNPAID}">${inv.status}</span></div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px">Billed To</div>
        <div style="font-size:15px;font-weight:700">${inv.patientName ?? '—'}</div>
        ${inv.patientUhid ? `<div style="font-size:12px;color:#6b7280">UHID: ${inv.patientUhid}</div>` : ''}
        ${inv.paymentMethod ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">Payment: ${inv.paymentMethod}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Type</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Description</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Unit</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <div style="min-width:220px">
          ${discount > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#4b5563"><span>Subtotal</span><span>₹${subtotal.toLocaleString('en-IN')}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#4b5563"><span>Discount</span><span style="color:#ef4444">−₹${discount.toLocaleString('en-IN')}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:8px 0 4px;font-size:15px;font-weight:800;color:#111;border-top:2px solid #1a1a1a;margin-top:4px"><span>Total</span><span>₹${total.toLocaleString('en-IN')}</span></div>
        </div>
      </div>
      <div style="margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center">
        Generated by ZenoHosp HMS · ${window.location.hostname} · Thank you for your payment
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Billing</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-800/30">
            {invoices.length} invoices
          </span>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <ReceiptText className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Invoices"    value={stats.total}            sub="all time"               Icon={ReceiptText} accent="blue"    />
        <StatCard label="Revenue Collected" value={fmt(stats.collected)}   sub="from paid invoices"     Icon={TrendingUp}  accent="emerald" />
        <StatCard label="Outstanding"       value={fmt(stats.outstanding)} sub="unpaid invoices"        Icon={AlertCircle} accent="amber"   />
        <StatCard label="Billed Today"      value={stats.todayCount}       sub="invoices created today" Icon={Clock}       accent="rose"    />
      </div>

      {/* ── Invoice Table ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden min-h-0">

        {/* Tab bar + controls */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-[#1a1a1a] gap-3 flex-wrap">

          {/* OPD / IPD tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1a1a1a] rounded-lg p-1">
            {[['OPD', opdInvoices.length], ['IPD', ipdInvoices.length]].map(([t, count]) => (
              <button
                key={t}
                onClick={() => { setTab(t); setPage(1); setSearch(''); setExpandedId(null) }}
                className={`flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-bold transition-all ${
                  tab === t
                    ? 'bg-white dark:bg-[#111] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-[#666] hover:text-slate-700 dark:hover:text-[#aaa]'
                }`}
              >
                {t}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t
                    ? 'bg-slate-100 dark:bg-[#222] text-slate-500 dark:text-[#888]'
                    : 'bg-slate-200 dark:bg-[#2a2a2a] text-slate-400 dark:text-[#666]'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Status filter + search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-0.5">
              {['ALL', 'UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'].map(s => (
                <button
                  key={s}
                  onClick={() => setCurrentFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    currentFilter === s
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-500 dark:text-[#888] hover:text-slate-700 dark:hover:text-[#aaa]'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice, patient…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 pr-3 py-2 w-52 rounded-lg border border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-white/95 dark:bg-[#111]/95 backdrop-blur-sm">
                <th className={thCls}>Invoice</th>
                <th className={thCls}>Patient</th>
                <th className={thCls}>Items</th>
                <th className={thCls}>Amount</th>
                <th className={thCls}>Method</th>
                <th className={thCls + ' text-center'}>Status</th>
                <th className={thCls + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <p className="text-sm font-medium text-slate-400">Loading invoices…</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#1a1a1a] flex items-center justify-center">
                        <ReceiptText className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">
                        {search
                          ? 'No invoices match your search.'
                          : currentFilter === 'ALL'
                            ? `No ${tab} invoices yet.`
                            : `No ${tab} invoices with status ${currentFilter.toLowerCase()}.`
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(inv => {
                  // IPD placeholder: has an admissionId, is unpaid, AND the admission is still active
                  const isActiveAdmission = !!inv.admissionId && activeAdmissionIds.has(String(inv.admissionId))
                  const isIPDPending = isActiveAdmission && (inv.status === 'UNPAID' || inv.status === 'PARTIAL')
                  const isIPDPaidAdmitted = isActiveAdmission && inv.status === 'PAID'
                  const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.UNPAID
                  const StatusIcon = cfg.Icon
                  const isExpanded = expandedId === inv.id
                  const admission = isActiveAdmission
                    ? activeAdmissions.find(a => String(a.id) === String(inv.admissionId))
                    : null
                  return (
                    <Fragment key={inv.id}>
                      <tr
                        className={`group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all ${isIPDPending ? 'cursor-default' : 'cursor-pointer'}`}
                        onClick={() => { if (!isIPDPending) setExpandedId(isExpanded ? null : inv.id) }}
                      >
                        <td className="px-5 py-4">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{inv.invoiceNumber}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{inv.patientName ?? '—'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{inv.patientUhid ?? ''}</p>
                        </td>
                        <td className="px-5 py-4">
                          {isIPDPending && inv.status === 'UNPAID' && !inv.items?.length
                            ? <span className="text-xs text-slate-400 italic">Pending charges</span>
                            : <ItemTypePips items={inv.items} />
                          }
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            {isIPDPending && inv.status === 'UNPAID' && Number(inv.total) > 0 ? '~' : ''}{fmt(inv.total)}
                          </p>
                          {isIPDPending && inv.status === 'UNPAID' && Number(inv.total) > 0 && (
                            <p className="text-[11px] text-slate-400 mt-0.5">estimated</p>
                          )}
                          {inv.status === 'PARTIAL' && Number(inv.paidAmount) > 0 && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">{fmt(inv.paidAmount)} paid</p>
                          )}
                          {Number(inv.discount) > 0 && (
                            <p className="text-xs text-red-500 mt-0.5">−{fmt(inv.discount)} disc.</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {inv.paymentMethod ? (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] text-xs font-semibold text-slate-600 dark:text-[#aaa]">
                              {inv.paymentMethod}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center">
                            {isIPDPending && inv.status === 'UNPAID' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
                                <BedDouble className="w-3 h-3" /> Admitted
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
                                <StatusIcon className="w-3 h-3" /> {cfg.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                            {isIPDPending ? (
                              <button
                                onClick={() => admission && setFinalizeAdmission(admission)}
                                disabled={!admission}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40"
                                title={inv.status === 'PARTIAL' ? 'Continue collecting payment' : 'Generate IPD Bill'}
                              >
                                <Receipt className="w-3.5 h-3.5" /> {inv.status === 'PARTIAL' ? 'Continue Bill' : 'Generate Bill'}
                              </button>
                            ) : isIPDPaidAdmitted ? (
                              <button
                                onClick={() => admission && setFinalizeAdmission(admission)}
                                disabled={!admission}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-[#2a2a2a] transition-colors disabled:opacity-40"
                                title="Add new charges to this bill"
                              >
                                <Plus className="w-3.5 h-3.5" /> Add Charges
                              </button>
                            ) : (
                              <>
                                {(inv.status === 'UNPAID' || inv.status === 'PARTIAL') && !inv.admissionId && (
                                  <button
                                    onClick={() => setDetailInvoiceId(inv.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                    title="Collect Payment"
                                  >
                                    <Receipt className="w-3.5 h-3.5" /> Collect
                                  </button>
                                )}
                                <button
                                  onClick={() => setDetailInvoiceId(inv.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => printInvoice(inv)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
                              title="Print"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && inv.items?.length > 0 && (
                        <tr className="bg-slate-50/70 dark:bg-[#0d0d0d]">
                          <td colSpan={7} className="px-5 pb-4 pt-2">
                            <div className="rounded-lg border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-100/60 dark:bg-[#1a1a1a] text-[11px] text-slate-400 uppercase tracking-widest">
                                    <th className="text-left px-4 py-2 font-bold">Type</th>
                                    <th className="text-left px-4 py-2 font-bold">Description</th>
                                    <th className="text-center px-4 py-2 font-bold">Qty</th>
                                    <th className="text-right px-4 py-2 font-bold">Unit</th>
                                    <th className="text-right px-4 py-2 font-bold">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e1e]">
                                  {inv.items.map((item, idx) => {
                                    const m = TYPE_META[item.itemType] ?? TYPE_META.CUSTOM
                                    return (
                                      <tr key={idx} className="bg-white dark:bg-[#111]">
                                        <td className="px-4 py-2.5">
                                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.bg}`}>
                                            {m.icon}
                                            <span className="text-slate-600 dark:text-[#aaa]">{item.itemType?.replace('_', ' ')}</span>
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-700 dark:text-[#ccc]">{item.description}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-500 dark:text-[#888]">×{item.quantity}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-500 dark:text-[#888]">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-white">₹{Number(item.totalPrice).toLocaleString('en-IN')}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-[#1a1a1a]">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreated={load} />}

      {finalizeAdmission && (
        <FinalizeIPDBillingModal
          admission={finalizeAdmission}
          onClose={() => setFinalizeAdmission(null)}
          onFinalized={() => { setFinalizeAdmission(null); load(); reloadAdmissions() }}
        />
      )}

      {detailInvoiceId && (
        <InvoiceDetailModal
          invoiceId={detailInvoiceId}
          onClose={() => setDetailInvoiceId(null)}
          onInvoiceUpdated={load}
        />
      )}
    </div>
  )
}
