import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { invoiceApi, bankApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";
import {
  Search, ChevronLeft, Printer, Eye, FileText,
  CheckCircle2, Clock, XCircle, CreditCard, X, Landmark, Loader2,
  Scissors, Tag, ChevronDown, ChevronUp,
} from "lucide-react";

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance', 'Cheque']

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
  const [paying, setPaying] = useState(false)

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

  const handlePay = async () => {
    setPaying(true)
    try {
      await invoiceApi.markAsPaid(invoiceId, bankAccountId || undefined)
      notify('Invoice marked as paid — bank account credited', 'success')
      onInvoiceUpdated?.()
      onClose()
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to mark as paid', 'error')
    } finally {
      setPaying(false)
    }
  }

  const canWaive = detail?.status === 'UNPAID'
  const canPay   = detail?.status === 'UNPAID'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-[#2a2a2a] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              {loading ? 'Loading…' : detail?.invoiceNumber}
            </h2>
            {!loading && detail && (
              <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
                {detail.patientName} {detail.patientMrn ? `· ${detail.patientMrn}` : ''} · {new Date(detail.createdAt).toLocaleDateString('en-IN')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!loading && detail && (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                ${detail.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : detail.status === 'UNPAID' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {detail.status === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {detail.status}
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {canWaive && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 font-medium">
                  <Scissors className="w-3.5 h-3.5 shrink-0" />
                  Hover a line item to apply a waiver. Only admin or receptionist should apply waivers.
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#2a2a2a]">
                    <th className="pb-2 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="pb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider w-12">Qty</th>
                    <th className="pb-2 text-right text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Unit</th>
                    <th className="pb-2 text-right text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Total</th>
                    <th className="pb-2 text-right text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Waived</th>
                    {canWaive && <th className="pb-2 w-16" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-[#1e1e1e]">
                  {(detail.items || []).map((item) => {
                    const waived = Number(item.waiverAmount || 0)
                    const effective = Number(item.totalPrice || 0) - waived
                    return (
                      <tr key={item.id} className="group">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${TYPE_COLORS[item.itemType] || TYPE_COLORS.CUSTOM}`}>
                              {item.itemType?.replace('_', ' ')}
                            </span>
                            <span className="text-slate-700 dark:text-[#ccc]">{item.description}</span>
                          </div>
                          {item.waiverReason && (
                            <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-0.5 flex items-center gap-1">
                              <Scissors className="w-3 h-3 shrink-0" /> {item.waiverReason}
                            </p>
                          )}
                        </td>
                        <td className="py-3 text-center text-slate-600 dark:text-[#aaa]">{item.quantity}</td>
                        <td className="py-3 text-right text-slate-600 dark:text-[#aaa] tabular-nums">{fmt(item.unitPrice)}</td>
                        <td className="py-3 text-right font-semibold text-slate-800 dark:text-white tabular-nums">
                          {waived > 0 ? (
                            <span>
                              <span className="line-through text-slate-400 dark:text-[#555] text-xs mr-1">{fmt(item.totalPrice)}</span>
                              {fmt(effective)}
                            </span>
                          ) : fmt(item.totalPrice)}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          {waived > 0
                            ? <span className="text-rose-500 dark:text-rose-400 font-semibold">-{fmt(waived)}</span>
                            : <span className="text-slate-300 dark:text-[#444]">—</span>
                          }
                        </td>
                        {canWaive && (
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setWaiverItem(item)}
                              title={waived > 0 ? 'Edit waiver' : 'Apply waiver'}
                              className={`p-1.5 rounded-md text-xs font-semibold transition-all opacity-0 group-hover:opacity-100
                                ${waived > 0
                                  ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white'
                                  : 'bg-slate-100 dark:bg-[#1e1e1e] text-slate-500 dark:text-[#666] hover:bg-rose-500 hover:text-white'
                                }`}
                            >
                              <Scissors className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t border-slate-100 dark:border-[#2a2a2a] pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-[#aaa]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmt(detail.subtotal)}</span>
                </div>
                {Number(detail.tax || 0) > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-[#aaa]">
                    <span>Tax</span>
                    <span className="tabular-nums">{fmt(detail.tax)}</span>
                  </div>
                )}
                {Number(detail.discount || 0) > 0 && (
                  <div className="flex justify-between text-rose-500 dark:text-rose-400">
                    <span className="flex items-center gap-1"><Scissors className="w-3.5 h-3.5" /> Total Waivers</span>
                    <span className="tabular-nums font-semibold">-{fmt(detail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-[#2a2a2a]">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(detail.total)}</span>
                </div>
              </div>

              {detail.notes && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222] rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-[#666] font-semibold uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-slate-700 dark:text-[#ccc]">{detail.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment footer — only for UNPAID invoices */}
        {canPay && (
          <div className="shrink-0 border-t border-slate-100 dark:border-[#1e1e1e] px-6 py-4 bg-slate-50 dark:bg-[#0a0a0a] rounded-b-xl space-y-3">
            {bankAccounts.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-[#666] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5" /> Credit payment to
                </p>
                <div className="flex flex-wrap gap-2">
                  {bankAccounts.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setBankAccountId(a.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                        bankAccountId === a.id
                          ? 'border-slate-900 dark:border-white bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white shadow-sm'
                          : 'border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] text-slate-500 dark:text-[#888] hover:border-slate-400'
                      }`}
                    >
                      {bankAccountId === a.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      {a.accountName}
                      {a.currentBalance != null && (
                        <span className="text-slate-400 dark:text-[#555]">{fmt(a.currentBalance)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-[#888]">
                Due: <span className="font-bold text-slate-900 dark:text-white tabular-nums">{fmt(detail.total)}</span>
              </p>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-60 shadow-sm"
              >
                {paying
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  : <><CreditCard className="w-4 h-4" /> Mark as Paid</>
                }
              </button>
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
                        {inv.patientMrn && <div className="text-[11px] text-slate-400 dark:text-[#666]">{inv.patientMrn}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-[#aaaaaa]">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN')}
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
