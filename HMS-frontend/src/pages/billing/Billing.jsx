import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { invoiceApi, bankApi } from '@/utils/api'
import Pagination from '@/components/ui/Pagination'
import CreateInvoiceModal from '@/components/modals/CreateInvoiceModal'
import {
  ReceiptText, Search, CheckCircle2, Clock, XCircle,
  Printer, TrendingUp, AlertCircle, Loader2,
  BedDouble, ScanLine, Stethoscope, FlaskConical, Pill, Wrench
} from 'lucide-react'

const PAGE_SIZE = 8

const STATUS_CFG = {
  PAID:      { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', Icon: CheckCircle2 },
  UNPAID:    { label: 'Unpaid',    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',       Icon: Clock },
  CANCELLED: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',             Icon: XCircle },
}

const TYPE_META = {
  MEDICINE:     { bg: 'bg-emerald-100 dark:bg-emerald-500/20', icon: <Pill className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> },
  LAB_TEST:     { bg: 'bg-violet-100 dark:bg-violet-500/20',   icon: <FlaskConical className="w-3 h-3 text-violet-600 dark:text-violet-400" /> },
  CONSULTATION: { bg: 'bg-blue-100 dark:bg-blue-500/20',       icon: <Stethoscope className="w-3 h-3 text-blue-600 dark:text-blue-400" /> },
  ROOM_CHARGE:  { bg: 'bg-orange-100 dark:bg-orange-500/20',   icon: <BedDouble className="w-3 h-3 text-orange-600 dark:text-orange-400" /> },
  RADIOLOGY:    { bg: 'bg-purple-100 dark:bg-purple-500/20',   icon: <ScanLine className="w-3 h-3 text-purple-600 dark:text-purple-400" /> },
  CUSTOM:       { bg: 'bg-slate-100 dark:bg-[#222]',           icon: <Wrench className="w-3 h-3 text-slate-500" /> },
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
    <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-[#222222] p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${accents[accent]}`}>
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [markingId, setMarkingId] = useState(null)
  const [bankAccounts, setBankAccounts] = useState([])

  const load = async () => {
    if (!user?.hospitalId) return
    try {
      setLoading(true)
      setInvoices(await invoiceApi.getByHospital(user.hospitalId))
    } catch {
      notify('Failed to load invoices', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.hospitalId])

  useEffect(() => {
    if (!user?.hospitalId) return
    bankApi.list(user.hospitalId).then(setBankAccounts).catch(() => {})
  }, [user?.hospitalId])

  const today = new Date().toDateString()

  const stats = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'PAID')
    const unpaid = invoices.filter(i => i.status === 'UNPAID')
    const paidToday = paid.filter(i => new Date(i.createdAt).toDateString() === today)
    return {
      total: invoices.length,
      collected: paid.reduce((s, i) => s + Number(i.total), 0),
      outstanding: unpaid.reduce((s, i) => s + Number(i.total), 0),
      todayCount: invoices.filter(i => new Date(i.createdAt).toDateString() === today).length,
    }
  }, [invoices])

  const filtered = useMemo(() => {
    let list = statusFilter === 'ALL' ? invoices : invoices.filter(i => i.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.patientName?.toLowerCase().includes(q) ||
        i.patientMrn?.toLowerCase().includes(q) ||
        i.paymentMethod?.toLowerCase().includes(q)
      )
    }
    return list
  }, [invoices, statusFilter, search])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleMarkPaid = async (invoiceId) => {
    setMarkingId(invoiceId)
    const defaultAccount = bankAccounts.find(a => a.isDefault) ?? bankAccounts[0]
    try {
      await invoiceApi.markAsPaid(invoiceId, defaultAccount?.id)
      notify('Invoice marked as paid', 'success')
      load()
    } catch (e) {
      notify(e?.response?.data?.message || 'Failed to mark as paid', 'error')
    } finally {
      setMarkingId(null)
    }
  }

  const thCls = 'px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left'

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] p-6 gap-6">

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
        <StatCard label="Total Invoices"   value={stats.total}          sub="all time"            Icon={ReceiptText}  accent="blue"    />
        <StatCard label="Revenue Collected" value={fmt(stats.collected)} sub="from paid invoices"  Icon={TrendingUp}   accent="emerald" />
        <StatCard label="Outstanding"       value={fmt(stats.outstanding)} sub="unpaid invoices"  Icon={AlertCircle}  accent="amber"   />
        <StatCard label="Billed Today"      value={stats.todayCount}     sub="invoices created today" Icon={Clock}    accent="rose"    />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice #, patient name, MRN…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-xl p-1 shadow-sm">
          {['ALL', 'UNPAID', 'PAID', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 dark:text-[#888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a]'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]">
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
                        {search ? 'No invoices match your search.' : 'No invoices yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(inv => {
                  const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.UNPAID
                  const StatusIcon = cfg.Icon
                  const isExpanded = expandedId === inv.id

                  return (
                    <>
                      <tr key={inv.id}
                        className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : inv.id)}>

                        <td className="px-5 py-4">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{inv.invoiceNumber}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{inv.patientName ?? '—'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{inv.patientMrn ?? ''}</p>
                        </td>

                        <td className="px-5 py-4">
                          <ItemTypePips items={inv.items} />
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{fmt(inv.total)}</p>
                          {Number(inv.discount) > 0 && (
                            <p className="text-xs text-red-500 mt-0.5">-{fmt(inv.discount)} disc.</p>
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
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
                              <StatusIcon className="w-3 h-3" /> {cfg.label}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            {inv.status === 'UNPAID' && (
                              <button
                                onClick={() => handleMarkPaid(inv.id)}
                                disabled={markingId === inv.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold transition-colors">
                                {markingId === inv.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <CheckCircle2 className="w-3 h-3" />}
                                Paid
                              </button>
                            )}
                            <button
                              onClick={() => window.print()}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
                              title="Print">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded items row */}
                      {isExpanded && inv.items?.length > 0 && (
                        <tr key={`${inv.id}-exp`} className="bg-slate-50/70 dark:bg-[#0d0d0d]">
                          <td colSpan={7} className="px-5 pb-4 pt-2">
                            <div className="rounded-xl border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
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
                    </>
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

      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
