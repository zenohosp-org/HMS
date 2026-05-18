import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { invoiceApi, bankApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";
import {
  Search, ChevronLeft, Printer, Eye, FileText,
  CheckCircle2, Clock, XCircle, CreditCard, X, Landmark, Loader2,
  Scissors, Plus,
} from "lucide-react";

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance']

const TYPE_COLORS = {
  CONSULTATION: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  ROOM_CHARGE:  'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
  FOOD:         'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  RADIOLOGY:    'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  LAB_TEST:     'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400',
  MEDICINE:     'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
  OT:           'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
  CUSTOM:       'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400',
}

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Waiver Modal ────────────────────────────────────────────────────────────
function WaiverModal({ item, invoiceId, onClose, onWaived }) {
  const { notify } = useNotification()
  const [amount, setAmount] = useState(
    item.waiverAmount != null ? String(item.waiverAmount) : ''
  )
  const [reason, setReason] = useState(item.waiverReason || '')
  const [submitting, setSubmitting] = useState(false)

  const max = Number(item.totalPrice || 0)
  const pct = (p) => setAmount(String(((max * p) / 100).toFixed(2)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed < 0) { notify('Enter a valid waiver amount', 'error'); return }
    if (!reason.trim()) { notify('Waiver reason is required', 'error'); return }
    setSubmitting(true)
    try {
      const updated = await invoiceApi.waiveItem(invoiceId, item.id, parsed, reason.trim())
      notify('Waiver applied successfully', 'success')
      onWaived(updated)
    } catch {
      notify('Failed to apply waiver', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-[#2a2a2a]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-rose-500" /> Apply Waiver
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5 truncate max-w-[220px]">{item.description}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-[#aaa]">
                Waiver Amount <span className="font-normal text-slate-400">(max {fmt(max)})</span>
              </label>
            </div>
            <div className="flex gap-1.5 mb-2">
              {[25, 50, 75, 100].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => pct(p)}
                  className="flex-1 py-1 text-xs font-bold rounded-md border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#aaa] hover:border-rose-400 hover:text-rose-500 transition-all"
                >
                  {p}%
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#666] text-sm font-bold">₹</span>
              <input
                type="number"
                min="0"
                max={max}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333] rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-700 dark:text-[#ccc]"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-[#aaa] block mb-1.5">
              Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Financial hardship, Doctor's discretion, Insurance adjustment…"
              rows={2}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333] rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-700 dark:text-[#ccc] resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-rose-500 hover:bg-rose-600 text-white transition-colors disabled:opacity-60"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
                : <><Scissors className="w-4 h-4" /> Apply Waiver</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Invoice Detail Modal ────────────────────────────────────────────────────
export function InvoiceDetailModal({ invoiceId, onClose, onInvoiceUpdated }) {
  const { notify } = useNotification()
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [waiverItem, setWaiverItem] = useState(null)
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paying, setPaying] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [d, accounts] = await Promise.all([
        invoiceApi.getDetail(invoiceId),
        user?.hospitalId ? bankApi.list(user.hospitalId).catch(() => []) : Promise.resolve([]),
      ])
      setDetail(d)
      setBankAccounts(accounts)
      const def = accounts.find(a => a.isDefault) ?? accounts[0]
      if (def) setBankAccountId(def.id)
      const balance = Math.max(0, Number(d.total || 0) - Number(d.paidAmount || 0))
      if (balance > 0) setPayAmount(balance.toFixed(2))
    } catch {
      notify('Failed to load invoice details', 'error')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [invoiceId])

  const handleWaived = (updated) => {
    setDetail(updated)
    setWaiverItem(null)
    onInvoiceUpdated?.()
  }

  const handleCollect = async () => {
    const amt = parseFloat(payAmount)
    if (isNaN(amt) || amt <= 0) { notify('Enter a valid payment amount', 'error'); return }
    setPaying(true)
    try {
      const updated = await invoiceApi.collectPayment(invoiceId, {
        amount: amt,
        paymentMethod: payMethod,
        bankAccountId: bankAccountId || undefined,
        referenceNumber: referenceNumber || undefined,
        collectedBy: user?.name || user?.email,
      })
      setDetail(updated)
      const newBalance = Math.max(0, Number(updated.total || 0) - Number(updated.paidAmount || 0))
      setPayAmount(newBalance > 0 ? newBalance.toFixed(2) : '')
      setReferenceNumber('')
      setShowRecordPayment(false)
      notify('Payment collected successfully', 'success')
      onInvoiceUpdated?.()
      if (updated.status === 'PAID') onClose()
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to collect payment', 'error')
    } finally {
      setPaying(false)
    }
  }

  const printInvoice = () => {
    if (!detail) return
    const items = detail.items ?? []
    const total = Number(detail.total)
    const discount = Number(detail.discount || 0)
    const subtotalAmt = total + discount
    const statusStyle = {
      PAID: 'background:#d1fae5;color:#065f46', UNPAID: 'background:#fef3c7;color:#92400e',
      PARTIAL: 'background:#ffedd5;color:#9a3412', CANCELLED: 'background:#fee2e2;color:#991b1b',
    }
    const rows = items.map(item => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${item.itemType?.replace('_', ' ') ?? ''}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${item.description ?? ''}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;text-align:center">×${item.quantity}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;text-align:right">₹${Number(item.unitPrice).toLocaleString('en-IN')}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600;color:#111;text-align:right">₹${Number(item.totalPrice).toLocaleString('en-IN')}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice ${detail.invoiceNumber}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:36px}table{width:100%;border-collapse:collapse}@media print{body{padding:24px}}</style>
      </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #10b981">
        <div><div style="font-size:22px;font-weight:800;color:#10b981">ZenoHosp HMS</div><div style="font-size:11px;color:#6b7280;margin-top:2px">${user?.hospitalName ?? ''}</div></div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700">${detail.invoiceNumber}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">${detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' }) : ''}</div>
          <div style="margin-top:8px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;${statusStyle[detail.status] ?? statusStyle.UNPAID}">${detail.status}</span></div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px">Billed To</div>
        <div style="font-size:15px;font-weight:700">${detail.patientName ?? '—'}</div>
        ${detail.patientUhid ? `<div style="font-size:12px;color:#6b7280">UHID: ${detail.patientUhid}</div>` : ''}
      </div>
      <table><thead><tr style="background:#f3f4f6">
        <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Type</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Description</th>
        <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Qty</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Unit</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Total</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="min-width:220px">
        ${discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#4b5563"><span>Subtotal</span><span>₹${subtotalAmt.toLocaleString('en-IN')}</span></div><div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#ef4444"><span>Waivers</span><span>−₹${discount.toLocaleString('en-IN')}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:8px 0 4px;font-size:15px;font-weight:800;color:#111;border-top:2px solid #1a1a1a;margin-top:4px"><span>Total</span><span>₹${total.toLocaleString('en-IN')}</span></div>
      </div></div>
      <div style="margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center">
        Generated by ZenoHosp HMS · ${window.location.hostname} · Thank you for your payment
      </div></body></html>`
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

  const canWaive = detail?.status === 'UNPAID' || detail?.status === 'PARTIAL'
  const canPay   = detail?.status === 'UNPAID' || detail?.status === 'PARTIAL'
  const balanceDue = detail ? Math.max(0, Number(detail.total || 0) - Number(detail.paidAmount || 0)) : 0
  const invoiceDate = detail?.createdAt
    ? new Date(detail.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
  const tax  = Number(detail?.tax || 0)
  const sgst = tax / 2
  const cgst = tax / 2

  const STATUS_CFG = {
    PAID:      { cls: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', Icon: CheckCircle2 },
    SETTLED:   { cls: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', Icon: CheckCircle2 },
    PARTIAL:   { cls: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',   Icon: Clock        },
    UNPAID:    { cls: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',           Icon: Clock        },
    UNSETTLED: { cls: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',           Icon: Clock        },
    CANCELLED: { cls: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',                 Icon: XCircle      },
  }
  const sc = STATUS_CFG[detail?.status] ?? STATUS_CFG.UNPAID
  const StatusIcon = sc?.Icon ?? Clock

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-8xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-[#2a2a2a]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-base">
              {loading ? 'Loading…' : detail?.invoiceNumber}
            </h2>
            {!loading && detail && (
              <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
                {detail.patientName}{detail.patientUhid ? ` · ${detail.patientUhid}` : ''} · {invoiceDate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!loading && detail && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sc.cls}`}>
                <StatusIcon className="w-3 h-3" />{detail.status}
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* ════ Left Panel: Services & Bills ════ */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-slate-100 dark:border-[#1e1e1e]">
              <div className="px-6 py-3.5 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
                <p className="font-bold text-slate-900 dark:text-white">Services and Bills</p>
              </div>

              {canWaive && (
                <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 font-medium shrink-0">
                  <Scissors className="w-3.5 h-3.5 shrink-0" />
                  Hover a row to apply a waiver on that line item.
                </div>
              )}

              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-[#111] z-10">
                    <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-10">No</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-24">Date</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Services Name</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-24">Amount</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-16">Gst %</th>
                      <th className={`px-6 py-3 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ${canWaive ? 'w-24' : 'w-28'}`}>Total</th>
                      {canWaive && <th className="px-4 py-3 w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                    {(detail.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={canWaive ? 7 : 6} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-[#666]">
                          No line items on this invoice.
                        </td>
                      </tr>
                    ) : (
                      (detail.items || []).map((item, idx) => {
                        const waived   = Number(item.waiverAmount || 0)
                        const effective = Number(item.totalPrice || 0) - waived
                        const typeColor = TYPE_COLORS[item.itemType] ?? TYPE_COLORS.CUSTOM
                        return (
                          <tr key={item.id} className="group hover:bg-slate-50/60 dark:hover:bg-[#0d0d0d] transition-colors">
                            <td className="px-6 py-4 text-slate-400 dark:text-[#555] text-xs">{idx + 1}</td>
                            <td className="px-4 py-4 text-slate-500 dark:text-[#888] text-xs whitespace-nowrap">{invoiceDate}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className={`self-start inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${typeColor}`}>
                                  {item.itemType?.replace('_', ' ')}
                                </span>
                                <span className="text-sm text-slate-800 dark:text-[#ddd]">{item.description}</span>
                                {item.quantity > 1 && (
                                  <span className="text-[11px] text-slate-400 dark:text-[#666]">×{item.quantity} units</span>
                                )}
                                {item.waiverReason && (
                                  <span className="text-[11px] text-rose-500 dark:text-rose-400 flex items-center gap-0.5 mt-0.5">
                                    <Scissors className="w-2.5 h-2.5 shrink-0" />{item.waiverReason}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right text-slate-600 dark:text-[#aaa] tabular-nums">
                              {fmt(item.unitPrice)}
                            </td>
                            <td className="px-4 py-4 text-center text-slate-400 dark:text-[#555] text-xs">—</td>
                            <td className="px-6 py-4 text-right tabular-nums">
                              {waived > 0 ? (
                                <span className="flex flex-col items-end gap-0.5">
                                  <span className="line-through text-slate-300 dark:text-[#444] text-xs">{fmt(item.totalPrice)}</span>
                                  <span className="font-semibold text-slate-900 dark:text-white">{fmt(effective)}</span>
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-900 dark:text-white">{fmt(item.totalPrice)}</span>
                              )}
                            </td>
                            {canWaive && (
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => setWaiverItem(item)}
                                  title={waived > 0 ? 'Edit waiver' : 'Apply waiver'}
                                  className={`p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${
                                    waived > 0
                                      ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white'
                                      : 'bg-slate-100 dark:bg-[#1e1e1e] text-slate-400 dark:text-[#666] hover:bg-rose-500 hover:text-white'
                                  }`}
                                >
                                  <Scissors className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Totals footer ── */}
              <div className="shrink-0 border-t border-slate-100 dark:border-[#1e1e1e] px-6 py-4 space-y-2 bg-slate-50/60 dark:bg-[#0a0a0a]">
                <div className="flex justify-between text-sm text-slate-600 dark:text-[#aaa]">
                  <span className="font-medium">Subtotal:</span>
                  <span className="tabular-nums">{fmt(detail.subtotal ?? detail.total)}</span>
                </div>
                {tax > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-slate-600 dark:text-[#aaa]">
                      <span className="font-medium">SGST:</span>
                      <span className="tabular-nums">{fmt(sgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-600 dark:text-[#aaa]">
                      <span className="font-medium">CGST:</span>
                      <span className="tabular-nums">{fmt(cgst)}</span>
                    </div>
                  </>
                )}
                {Number(detail.discount || 0) > 0 && (
                  <div className="flex justify-between text-sm text-rose-500 dark:text-rose-400">
                    <span className="font-medium flex items-center gap-1.5"><Scissors className="w-3 h-3" />Total Waivers:</span>
                    <span className="tabular-nums font-semibold">−{fmt(detail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-[#222]">
                  <span className="font-bold text-base text-slate-900 dark:text-white">Total:</span>
                  <span className="tabular-nums font-bold text-base text-slate-900 dark:text-white">{fmt(detail.total)}</span>
                </div>
              </div>
            </div>

            {/* ════ Right Panel: Payment Details ════ */}
            <div className="w-96 shrink-0 flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
                <p className="font-bold text-slate-900 dark:text-white">Payment details</p>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* IPD note */}
                {detail.admissionId && (
                  <div className="border border-slate-200 dark:border-[#2a2a2a] rounded-lg px-4 py-2.5">
                    <p className="text-xs text-center text-slate-500 dark:text-[#888]">
                      Patient billing is mapped as cash during admission
                    </p>
                  </div>
                )}

                {/* Payment History header + Record Payment toggle */}
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900 dark:text-white">Payment History</p>
                  {canPay && (
                    <button
                      onClick={() => setShowRecordPayment(p => !p)}
                      className="flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Payment
                    </button>
                  )}
                </div>

                {/* Collapsible record payment form */}
                {showRecordPayment && canPay && (
                  <div className="space-y-3 p-4 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#0a0a0a]">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Amount</label>
                        <input
                          type="number"
                          className="input"
                          value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                          placeholder="0.00"
                          min="0.01"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="label">Payment Type</label>
                        <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                          {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label">Reference Number</label>
                      <input
                        type="text"
                        className="input"
                        value={referenceNumber}
                        onChange={e => setReferenceNumber(e.target.value)}
                        placeholder="UTR / Cheque no. / Transaction ID"
                      />
                    </div>
                    {bankAccounts.length > 0 && (
                      <div>
                        <label className="label flex items-center gap-1.5"><Landmark className="w-3 h-3" />Credit to</label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {bankAccounts.map(a => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setBankAccountId(a.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                                bankAccountId === a.id
                                  ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                  : 'border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] text-slate-500 dark:text-[#888] hover:border-slate-400'
                              }`}
                            >
                              {bankAccountId === a.id && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                              {a.accountName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleCollect}
                        disabled={paying}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        {paying
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</>
                          : 'Payment Received'
                        }
                      </button>
                      <button onClick={printInvoice} className="btn-secondary flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5" /> Print Invoice
                      </button>
                    </div>
                    {balanceDue > 0 && (
                      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200 dark:border-[#222]">
                        <span className="text-slate-500 dark:text-[#888] font-medium">Balance due</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">{fmt(balanceDue)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment history entries */}
                {detail.payments?.length > 0 ? (
                  <div className="space-y-4">
                    {detail.payments.map(p => (
                      <div key={p.id} className="flex items-start gap-4">
                        <p className="text-sm text-slate-600 dark:text-[#aaa] whitespace-nowrap shrink-0 tabular-nums">
                          {new Date(p.paidAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-500 dark:text-[#888] truncate">{p.referenceNumber || p.notes || 'Notes'}</p>
                          <p className="text-xs text-slate-400 dark:text-[#666] mt-0.5">{p.paymentMethod}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums shrink-0">{fmt(p.amount)}</p>
                      </div>
                    ))}
                    {balanceDue > 0 && !showRecordPayment && (
                      <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-100 dark:border-[#1e1e1e]">
                        <span className="text-slate-500 dark:text-[#888] font-medium">Balance Due</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">{fmt(balanceDue)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  !showRecordPayment && (
                    <p className="text-sm text-slate-400 dark:text-[#666]">No payments recorded yet.</p>
                  )
                )}

                {/* PAID invoices: just show print */}
                {!canPay && (
                  <button onClick={printInvoice} className="btn-secondary w-full flex items-center justify-center gap-2">
                    <Printer className="w-4 h-4" /> Print Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {waiverItem && (
        <WaiverModal
          item={waiverItem}
          invoiceId={invoiceId}
          onClose={() => setWaiverItem(null)}
          onWaived={handleWaived}
        />
      )}
    </div>
  )
}

// ─── Mark as Paid Modal ──────────────────────────────────────────────────────
function MarkAsPaidModal({ invoice, onClose, onPaid }) {
  const { user } = useAuth()
  const { notify } = useNotification()
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user?.hospitalId) return
    bankApi.list(user.hospitalId).then(accounts => {
      setBankAccounts(accounts)
      const def = accounts.find(a => a.isDefault) ?? accounts[0]
      if (def) setBankAccountId(def.id)
    }).catch(() => {})
  }, [user?.hospitalId])

  const handlePay = async () => {
    setSubmitting(true)
    try {
      await invoiceApi.markAsPaid(invoice.id, bankAccountId || undefined)
      notify('Invoice marked as paid — bank account credited', 'success')
      onPaid()
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to mark as paid', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-[#2a2a2a]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" /> Mark as Paid
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">{invoice.invoiceNumber} · {fmt(invoice.total)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {bankAccounts.length > 0 && (
            <div>
              <label className="label flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Credit Payment To
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {bankAccounts.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setBankAccountId(a.id)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${bankAccountId === a.id ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-[#1a1a1a]' : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-[#3a3a3a] bg-white dark:bg-[#111]'}`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{a.accountName}</p>
                      {bankAccountId === a.id && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-[#666]">
                      {a.accountNumber ? `···${a.accountNumber.slice(-4)}` : a.bankName || 'Cash'}
                    </p>
                    <p className="text-xs font-semibold text-slate-600 dark:text-[#aaa] mt-1 tabular-nums">{fmt(a.currentBalance)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] rounded-b-xl">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handlePay}
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              : <><CheckCircle2 className="w-4 h-4" /> Confirm Payment</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invoice List ────────────────────────────────────────────────────────────
function InvoiceList() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [detailInvoiceId, setDetailInvoiceId] = useState(null);

  const load = () => {
    if (!user?.hospitalId) return
    setIsLoading(true)
    invoiceApi.getByHospital(user.hospitalId).then((data) => {
      setInvoices(Array.isArray(data) ? data : []);
    }).catch(() => {
      notify("Failed to fetch invoices", "error");
    }).finally(() => setIsLoading(false));
  }

  useEffect(() => { load() }, [user?.hospitalId]);

  const filteredInvoices = invoices.filter(
    (inv) => inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      || inv.patientName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusStyle = (status) => {
    switch (status) {
      case "PAID":      return "bg-emerald-500/10 text-emerald-500";
      case "UNPAID":    return "bg-amber-500/10 text-amber-500";
      case "CANCELLED": return "bg-rose-500/10 text-rose-500";
      default:          return "bg-slate-500/10 text-slate-500";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "PAID":      return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "UNPAID":    return <Clock className="w-3.5 h-3.5" />;
      case "CANCELLED": return <XCircle className="w-3.5 h-3.5" />;
      default:          return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate("/billing")}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-500 mb-2 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> Back to Billing
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice History</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Track all hospital billing and payments</p>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            placeholder="Search invoice or patient…"
            className="pl-10 pr-4 py-2 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300/50 w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#222222] bg-slate-50/50 dark:bg-[#1a1a1a]/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Invoice</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Patient</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#222222]">
              {isLoading
                ? Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-4 h-16 bg-slate-50/20 dark:bg-white/5" />
                    </tr>
                  ))
                : filteredInvoices.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        No invoices found
                      </td>
                    </tr>
                  )
                  : filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">
                          {inv.admissionNumber || `ID: ${inv.id?.slice(0, 8)}…`}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-[#ccc]">
                        {inv.patientName || '—'}
                        {inv.patientUhid && <div className="text-[11px] text-slate-400 dark:text-[#666]">{inv.patientUhid}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-[#aaaaaa]">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white tabular-nums">{fmt(inv.total)}</div>
                        {Number(inv.discount || 0) > 0 && (
                          <div className="text-[11px] text-rose-500 flex items-center gap-0.5">
                            <Scissors className="w-2.5 h-2.5" /> -{fmt(inv.discount)} waived
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(inv.status)}`}>
                            {getStatusIcon(inv.status)}{inv.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {inv.status === 'UNPAID' && (
                            <button
                              onClick={() => setPayingInvoice(inv)}
                              className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                              title="Mark as Paid"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            className="p-2 bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#aaaaaa] rounded-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            title="Print Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDetailInvoiceId(inv.id)}
                            className="p-2 bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#aaaaaa] rounded-lg hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {payingInvoice && (
        <MarkAsPaidModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onPaid={() => { setPayingInvoice(null); load() }}
        />
      )}

      {detailInvoiceId && (
        <InvoiceDetailModal
          invoiceId={detailInvoiceId}
          onClose={() => setDetailInvoiceId(null)}
          onInvoiceUpdated={() => load()}
        />
      )}
    </div>
  );
}

export default InvoiceList;
