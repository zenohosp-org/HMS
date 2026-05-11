import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { invoiceApi, bankApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";
import {
  Search, ChevronLeft, Printer, Eye, FileText,
  CheckCircle2, Clock, XCircle, CreditCard, X, Landmark, Loader2,
} from "lucide-react";

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance', 'Cheque']

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

function InvoiceList() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [payingInvoice, setPayingInvoice] = useState(null);

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
  );

  const getStatusStyle = (status) => {
    switch (status) {
      case "PAID":     return "bg-emerald-500/10 text-emerald-500";
      case "UNPAID":   return "bg-amber-500/10 text-amber-500";
      case "CANCELLED":return "bg-rose-500/10 text-rose-500";
      default:         return "bg-slate-500/10 text-slate-500";
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
            placeholder="Search invoice number..."
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
                            className="p-2 bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#aaaaaa] rounded-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
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
    </div>
  );
}

export default InvoiceList;
