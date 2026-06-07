import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { invoiceApi } from '@/utils/api'
import { fmtId } from '@/utils/idFormat'
import Pagination from '@/components/ui/Pagination'
import PageHeader from '@/components/ui/PageHeader'
import CreateInvoiceModal from '@/components/modals/CreateInvoiceModal'
import { InvoiceDetailModal } from '@/pages/billing/InvoiceList'
import {
  ReceiptText, Search, CheckCircle2, Clock, XCircle,
  Printer, TrendingUp, AlertCircle, Loader2,
  Receipt, Eye, Plus, MoreHorizontal, Pill, FlaskConical, Stethoscope, BedDouble, ScanLine, Wrench
} from 'lucide-react'

const PAGE_SIZE = 10

const STATUS_CFG = {
  PAID:      { label: 'Paid',      cls: 'is-paid',      Icon: CheckCircle2 },
  UNPAID:    { label: 'Unpaid',    cls: 'is-unpaid',    Icon: Clock        },
  PARTIAL:   { label: 'Partial',   cls: 'is-partial',   Icon: AlertCircle  },
  CANCELLED: { label: 'Cancelled', cls: 'is-cancelled', Icon: XCircle      },
}

const TYPE_META = {
  MEDICINE:     { cls: 'is-medicine',     icon: <Pill className="w-3 h-3" /> },
  LAB_TEST:     { cls: 'is-lab',          icon: <FlaskConical className="w-3 h-3" /> },
  CONSULTATION: { cls: 'is-consultation', icon: <Stethoscope className="w-3 h-3" /> },
  ROOM_CHARGE:  { cls: 'is-room',         icon: <BedDouble className="w-3 h-3" /> },
  RADIOLOGY:    { cls: 'is-radiology',    icon: <ScanLine className="w-3 h-3" /> },
  CUSTOM:       { cls: 'is-custom',       icon: <Wrench className="w-3 h-3" /> },
}

function fmt(n) {
  if (!n) return '₹0'
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function ItemTypePips({ items }) {
  if (!items?.length) return <span className="text-11 text-gray-400">—</span>
  const unique = [...new Set(items.map(i => i.itemType))]
  return (
    <div className="hms-billing-pips">
      {unique.map(type => {
        const m = TYPE_META[type] ?? TYPE_META.CUSTOM
        return (
          <span key={type} className={`hms-billing-pip ${m.cls}`}>
            {m.icon}
          </span>
        )
      })}
      <span className="hms-billing-pips__count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
    </div>
  )
}

function StatCard({ label, value, sub, Icon, accent }) {
  return (
    <div className="zu-card is-stat">
      <div className={`zu-stat-card-icon is-${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="zu-stat-card-body">
        <p className="zu-stat-card-label">{label}</p>
        <p className="zu-stat-card-value">{value}</p>
        {sub && <p className="zu-stat-card-sub">{sub}</p>}
      </div>
    </div>
  )
}

export default function OPDBilling() {
  const { user } = useAuth()
  const { notify } = useNotification()

  const [invoices, setInvoices]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter]   = useState('ALL')
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [showCreate, setShowCreate]       = useState(false)
  const [detailInvoiceId, setDetailInvoiceId] = useState(null)
  const [menuState, setMenuState]         = useState(null)

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

    invoiceApi.listOpdPaginated(
      user.hospitalId,
      page - 1,
      PAGE_SIZE,
      statusFilter,
      debouncedSearch
    )
      .then((data) => {
        setInvoices(data.invoices || [])
        setTotalPages(data.totalPages || 1)
        setTotalElements(data.totalElements || 0)
      })
      .catch(() => notify('Failed to load OPD invoices', 'error'))
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
      <title>Invoice ${fmtId(inv.invoiceNumber)}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Lexend', sans-serif;font-size:13px;color:#1a1a1a;padding:36px}table{width:100%;border-collapse:collapse}@media print{body{padding:24px}}</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #10b981">
        <div>
          <div style="font-size:22px;font-weight:800;color:#10b981">ZenoHosp HMS</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${user?.hospitalName ?? 'Hospital Management System'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700">${fmtId(inv.invoiceNumber)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">${inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</div>
          <div style="margin-top:8px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;${statusCls[inv.status] ?? statusCls.UNPAID}">${inv.status}</span></div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px">Billed To</div>
        <div style="font-size:15px;font-weight:700">${inv.patientName ?? '—'}</div>
        ${inv.patientUhid ? `<div style="font-size:12px;color:#6b7280">UHID: ${fmtId(inv.patientUhid)}</div>` : ''}
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
    collected: invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total), 0),
    outstanding: invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIAL').reduce((s, i) => s + Number(i.total), 0),
    todayCount: invoices.filter(i => new Date(i.createdAt).toDateString() === new Date().toDateString()).length,
  }

  return (
    <div className="zu-page">

      <PageHeader
        title="OPD Billing"
        subtitle={`${totalElements} invoices`}
        actions={
          <button onClick={() => setShowCreate(true)} className="zu-btn-primary">
            <ReceiptText className="w-4 h-4" /> New Invoice
          </button>
        }
      />

      {/* Stats */}
      <div className="zu-page-content">
      <div className="zu-stat-card-grid">
        <StatCard label="Total OPD Invoices" value={stats.total}             sub="matching filters"       Icon={ReceiptText} accent="blue"    />
        <StatCard label="Revenue Collected"  value={fmt(stats.collected)}    sub="from loaded paid"       Icon={TrendingUp}  accent="emerald" />
        <StatCard label="Outstanding Due"    value={fmt(stats.outstanding)}  sub="from loaded unpaid"     Icon={AlertCircle} accent="amber"   />
        <StatCard label="Billed Today"       value={stats.todayCount}        sub="loaded today"           Icon={Clock}       accent="rose"    />
      </div>

      {/* Table Container */}
      <div className="hms-billing-tablecard">

        {/* Controls bar */}
        <div className="hms-billing-controls">
          <div className="hms-billing-controls__group">
            <div className="hms-billing-segment">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'UNPAID', label: 'Unpaid' },
                { key: 'PAID', label: 'Paid' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={`hms-billing-segment__btn ${statusFilter === key ? 'is-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="hms-billing-search">
              <Search className="hms-billing-search__icon w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search invoice, patient…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="hms-billing-search__input"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="hms-billing-tablescroll">
          <table className="hms-billing-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Patient</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Method</th>
                <th className="is-center">Status</th>
                <th className="is-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="hms-billing-cell-state">
                    <div className="hms-billing-cell-state__stack">
                      <Loader2 className="w-8 h-8 hms-billing-spin is-blue" />
                      <p className="hms-billing-cell-state__text">Loading invoices…</p>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="hms-billing-cell-state">
                    <div className="hms-billing-cell-state__stack">
                      <div className="hms-billing-cell-state__icon-bg">
                        <ReceiptText className="w-8 h-8" />
                      </div>
                      <p className="hms-billing-cell-state__text">
                        {search ? 'No invoices match your search.' : 'No OPD invoices yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map(inv => {
                  const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.UNPAID
                  const StatusIcon = cfg.Icon
                  return (
                    <tr key={inv.id}>
                      <td>
                        <p className="hms-billing-cell__primary">{fmtId(inv.invoiceNumber)}</p>
                        <p className="hms-billing-cell__secondary">
                          {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                      </td>
                      <td>
                        <p className="hms-billing-cell__strong">{inv.patientName ?? '—'}</p>
                        <p className="hms-billing-cell__secondary">{fmtId(inv.patientUhid) ?? ''}</p>
                      </td>
                      <td>
                        <ItemTypePips items={inv.items} />
                      </td>
                      <td>
                        <p className="hms-billing-cell__primary">{fmt(inv.total)}</p>
                        {inv.status === 'PARTIAL' && Number(inv.paidAmount) > 0 && (
                          <p className="hms-billing-cell__paid">{fmt(inv.paidAmount)} paid</p>
                        )}
                        {Number(inv.discount) > 0 && (
                          <p className="hms-billing-cell__discount">−{fmt(inv.discount)} disc.</p>
                        )}
                      </td>
                      <td>
                        {inv.paymentMethod ? (
                          <span className="hms-billing-method">{inv.paymentMethod}</span>
                        ) : (
                          <span className="hms-billing-cell__muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="hms-billing-status-center">
                          <span className={`hms-billing-status ${cfg.cls}`}>
                            <StatusIcon className="w-3 h-3" /> {cfg.label}
                          </span>
                        </div>
                      </td>
                      <td className="hms-billing-actions-cell" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openRowMenu(inv, e.currentTarget) }}
                          className="hms-billing-rowbtn"
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
          <div className="hms-billing-pagination">
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

      {/* Context Action Menu */}
      {menuState && (() => {
        const { inv, right, top, bottom } = menuState
        return (
          <>
            <div className="hms-billing-menu-overlay" onClick={() => setMenuState(null)} />
            <div
              style={{ right, ...(top !== undefined ? { top } : { bottom }) }}
              className="hms-billing-menu"
            >
              {(inv.status === 'UNPAID' || inv.status === 'PARTIAL') && (
                <button onClick={() => { setMenuState(null); setDetailInvoiceId(inv.id) }} className="hms-billing-menu__item">
                  <Receipt className="hms-billing-menu__item-icon w-4 h-4" /> Collect Payment
                </button>
              )}
              {inv.status !== 'UNPAID' && inv.status !== 'PARTIAL' && (
                <button onClick={() => { setMenuState(null); setDetailInvoiceId(inv.id) }} className="hms-billing-menu__item">
                  <Eye className="hms-billing-menu__item-icon w-4 h-4" /> View Details
                </button>
              )}
              <div className="hms-billing-menu__divider" />
              <button onClick={() => { setMenuState(null); printInvoice(inv) }} className="hms-billing-menu__item">
                <Printer className="hms-billing-menu__item-icon w-4 h-4" /> Print Invoice
              </button>
            </div>
          </>
        )
      })()}

      {/* Modals */}
      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreated={loadData} />}

      {detailInvoiceId && (
        <InvoiceDetailModal
          invoiceId={detailInvoiceId}
          onClose={() => setDetailInvoiceId(null)}
          onInvoiceUpdated={loadData}
        />
      )}
      </div>
    </div>
  )
}
