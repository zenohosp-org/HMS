import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { invoiceApi, admissionApi } from '@/utils/api'
import Pagination from '@/components/ui/Pagination'
import FinalizeIPDBillingModal from '@/components/modals/FinalizeIPDBillingModal'
import { InvoiceDetailModal } from '@/pages/billing/InvoiceList'
import {
  ReceiptText, Search, CheckCircle2, Clock, XCircle,
  Printer, TrendingUp, AlertCircle, Loader2,
  Receipt, Eye, Plus, MoreHorizontal, BedDouble, Pill, FlaskConical, Stethoscope, ScanLine, Wrench
} from 'lucide-react'

const PAGE_SIZE = 10

const STATUS_CFG_IPD = {
  SETTLED: { label: 'Settled', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', Icon: CheckCircle2 },
  NOT_SETTLED: { label: 'Not Settled', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20', Icon: Clock },
}

const TYPE_META = {
  MEDICINE: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', icon: <Pill className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> },
  LAB_TEST: { bg: 'bg-slate-100 dark:bg-slate-700/40', icon: <FlaskConical className="w-3 h-3 text-slate-600 dark:text-slate-300" /> },
  CONSULTATION: { bg: 'bg-blue-100 dark:bg-blue-500/20', icon: <Stethoscope className="w-3 h-3 text-blue-600 dark:text-blue-400" /> },
  ROOM_CHARGE: { bg: 'bg-orange-100 dark:bg-orange-500/20', icon: <BedDouble className="w-3 h-3 text-orange-600 dark:text-orange-400" /> },
  RADIOLOGY: { bg: 'bg-violet-100 dark:bg-violet-500/20', icon: <ScanLine className="w-3 h-3 text-violet-600 dark:text-violet-400" /> },
  CUSTOM: { bg: 'bg-slate-100 dark:bg-[#222]', icon: <Wrench className="w-3 h-3 text-slate-500" /> },
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
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400',
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

export default function IPDBilling() {
  const { user } = useAuth()
  const { notify } = useNotification()

  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [activeAdmissions, setActiveAdmissions] = useState([])
  const [finalizeAdmission, setFinalizeAdmission] = useState(null)
  const [detailInvoiceId, setDetailInvoiceId] = useState(null)
  const [menuState, setMenuState] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const loadData = () => {
    if (!user?.hospitalId) return
    setLoading(true)

    Promise.all([
      invoiceApi.listIpdPaginated(
        user.hospitalId,
        page - 1,
        PAGE_SIZE,
        statusFilter,
        debouncedSearch
      ),
      admissionApi.list(user.hospitalId, false).catch(() => [])
    ])
      .then(([data, admData]) => {
        setInvoices(data.invoices || [])
        setTotalPages(data.totalPages || 1)
        setTotalElements(data.totalElements || 0)
        setActiveAdmissions(Array.isArray(admData) ? admData : [])
      })
      .catch(() => notify('Failed to load IPD invoices', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [user?.hospitalId, page, statusFilter, debouncedSearch])

  useEffect(() => {
    const close = () => { setMenuState(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const openRowMenu = (inv, btnEl) => {
    const r = btnEl.getBoundingClientRect()
    const flipUp = window.innerHeight - r.bottom < 210
    setMenuState({
      inv,
      right: window.innerWidth - r.right,
      ...(flipUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }

  const activeAdmissionIds = useMemo(
    () => new Set(activeAdmissions.map(a => String(a.id))),
    [activeAdmissions]
  )

  const printInvoice = (inv) => {
    const items = inv.items ?? []
    const total = Number(inv.total)
    const discount = Number(inv.discount || 0)
    const subtotal = total + discount
    const statusCls = { PAID: 'background:#d1fae5;color:#065f46', SETTLED: 'background:#d1fae5;color:#065f46', UNPAID: 'background:#fef3c7;color:#92400e', UNSETTLED: 'background:#fef3c7;color:#92400e', PARTIAL: 'background:#ffedd5;color:#9a3412', CANCELLED: 'background:#fee2e2;color:#991b1b' }
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

  const handleFilterChange = (newFilter) => {
    setStatusFilter(newFilter)
    setPage(1)
  }

  const stats = {
    total: totalElements,
    settled: invoices.filter(i => i.status === 'PAID' || i.status === 'SETTLED').reduce((s, i) => s + Number(i.total), 0),
    unsettled: invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIAL' || i.status === 'UNSETTLED').reduce((s, i) => s + Number(i.total), 0),
    todayCount: invoices.filter(i => new Date(i.createdAt).toDateString() === new Date().toDateString()).length,
  }

  const thCls = 'px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left'

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">IPD Billing</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-800/30">
            {totalElements} active/past records
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total IPD Cases" value={stats.total} sub="matching filters" Icon={ReceiptText} accent="blue" />
        <StatCard label="Total Settled" value={fmt(stats.settled)} sub="fully cleared bills" Icon={TrendingUp} accent="emerald" />
        <StatCard label="Outstanding Due" value={fmt(stats.unsettled)} sub="balance outstanding" Icon={AlertCircle} accent="amber" />
        <StatCard label="Admissions Today" value={stats.todayCount} sub="loaded cases" Icon={Clock} accent="rose" />
      </div>

      {/* Table Container */}
      <div className="flex flex-col flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden min-h-0">

        {/* Controls bar */}
        <div className="flex items-center justify-end px-5 py-3 border-b border-slate-100 dark:border-[#1a1a1a] gap-3 flex-wrap">

          {/* Status filters + search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-0.5">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'UNSETTLED', label: 'Not Settled' },
                { key: 'SETTLED', label: 'Settled' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${statusFilter === key
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
                placeholder="Search invoice, patient…"
                value={search}
                onChange={e => setSearch(e.target.value)}
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
                      <p className="text-sm font-medium text-slate-400">Loading IPD invoices…</p>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#1a1a1a] flex items-center justify-center">
                        <ReceiptText className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">
                        {search ? 'No invoices match your search.' : 'No IPD invoices yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map(inv => {
                  const isActiveAdmission = !!inv.admissionId && activeAdmissionIds.has(String(inv.admissionId))
                  const isIPDPending = isActiveAdmission && (inv.status === 'UNPAID' || inv.status === 'PARTIAL' || inv.status === 'UNSETTLED')
                  const isSettled = inv.status === 'PAID' || inv.status === 'SETTLED'
                  const ipdCfg = isSettled ? STATUS_CFG_IPD.SETTLED : STATUS_CFG_IPD.NOT_SETTLED
                  const StatusIcon = ipdCfg.Icon

                  return (
                    <tr
                      key={inv.id}
                      className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all"
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
                        {isIPDPending && !inv.items?.length ? (
                          <span className="text-xs text-slate-400 italic">Pending charges</span>
                        ) : (
                          <ItemTypePips items={inv.items} />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {isIPDPending && Number(inv.total) > 0 ? '~' : ''}{fmt(inv.total)}
                        </p>
                        {isIPDPending && Number(inv.total) > 0 && (
                          <p className="text-[11px] text-slate-400 mt-0.5">estimated</p>
                        )}
                        {(inv.status === 'PARTIAL' || inv.status === 'UNSETTLED') && Number(inv.paidAmount) > 0 && (
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
                          {isIPDPending ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
                              <BedDouble className="w-3 h-3" /> Admitted
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${ipdCfg.cls}`}>
                              <StatusIcon className="w-3 h-3" /> {ipdCfg.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openRowMenu(inv, e.currentTarget) }}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalElements > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-[#1a1a1a]">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Row context Action Menu */}
      {menuState && (() => {
        const { inv, right, top, bottom } = menuState
        const isActiveAdm = !!inv.admissionId && activeAdmissionIds.has(String(inv.admissionId))
        const isPending = isActiveAdm && (inv.status === 'UNPAID' || inv.status === 'PARTIAL' || inv.status === 'UNSETTLED')
        const isPaidAdmit = isActiveAdm && (inv.status === 'PAID' || inv.status === 'SETTLED')
        const admission = isActiveAdm ? activeAdmissions.find(a => String(a.id) === String(inv.admissionId)) : null
        const itemClass = "w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222] transition-colors text-left disabled:opacity-40"
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuState(null)} />
            <div
              style={{ position: 'fixed', right, ...(top !== undefined ? { top } : { bottom }), zIndex: 50 }}
              className="w-52 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-slate-100 dark:border-[#252525] py-1.5"
            >
              {isPending && (
                <button onClick={() => { setMenuState(null); admission && setFinalizeAdmission(admission) }} disabled={!admission} className={itemClass}>
                  <Receipt className="w-4 h-4 shrink-0" />
                  {(inv.status === 'PARTIAL' || inv.status === 'UNSETTLED') ? 'Continue Bill' : 'Generate Bill'}
                </button>
              )}
              {isPaidAdmit && (
                <button onClick={() => { setMenuState(null); admission && setFinalizeAdmission(admission) }} disabled={!admission} className={itemClass}>
                  <Plus className="w-4 h-4 shrink-0" /> Add Charges
                </button>
              )}
              {!isPending && (
                <button onClick={() => { setMenuState(null); setDetailInvoiceId(inv.id) }} className={itemClass}>
                  <Eye className="w-4 h-4 shrink-0" /> View Details
                </button>
              )}
              <div className="h-px bg-slate-100 dark:bg-[#252525] mx-3 my-1" />
              <button onClick={() => { setMenuState(null); printInvoice(inv) }} className={itemClass}>
                <Printer className="w-4 h-4 shrink-0" /> Print Invoice
              </button>
            </div>
          </>
        )
      })()}

      {/* Modals */}
      {finalizeAdmission && (
        <FinalizeIPDBillingModal
          admission={finalizeAdmission}
          onClose={() => { setFinalizeAdmission(null); loadData() }}
          onFinalized={() => { setFinalizeAdmission(null); loadData() }}
        />
      )}

      {detailInvoiceId && (
        <InvoiceDetailModal
          invoiceId={detailInvoiceId}
          onClose={() => setDetailInvoiceId(null)}
          onInvoiceUpdated={loadData}
        />
      )}
    </div>
  )
}
