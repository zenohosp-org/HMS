import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { invoiceApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";
import {
  Search,
  ChevronLeft,
  Printer,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
function InvoiceList() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    if (user?.hospitalId) {
      invoiceApi.getByHospital(user.hospitalId).then((data) => {
        console.log("Raw invoice data received:", data);
        if (Array.isArray(data)) {
          setInvoices(data);
        } else {
          console.warn("Invoice data is unexpected structure:", typeof data, data);
          setInvoices([]);
        }
      }).catch((err) => {
        console.error("Failed to fetch invoices:", err);
        notify("Failed to fetch invoices", "error");
      }).finally(() => setIsLoading(false));
    }
  }, [user?.hospitalId, notify]);
  const filteredInvoices = invoices.filter(
    (inv) => inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const getStatusStyle = (status) => {
    switch (status) {
      case "PAID":
        return "bg-slate-500/10 text-slate-900 dark:text-white";
      case "UNPAID":
        return "bg-amber-500/10 text-amber-500";
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-500";
      default:
        return "bg-slate-500/10 text-slate-500";
    }
  };
  const getStatusIcon = (status) => {
    switch (status) {
      case "PAID":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "UNPAID":
        return <Clock className="w-3.5 h-3.5" />;
      case "CANCELLED":
        return <XCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };
  return <div className="space-y-6"><div className="flex items-center justify-between"><div><button
    onClick={() => navigate("/billing")}
    className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-white mb-2 transition-colors"
  ><ChevronLeft className="w-3 h-3" /> Back to Billing
                    </button><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice History</h1><p className="text-sm text-slate-500 font-medium tracking-tight">Track all hospital billing and payments</p></div><div className="flex gap-3"><div className="relative group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-slate-900 dark:text-white transition-colors" /><input
    type="text"
    placeholder="Search invoice number..."
    className="pl-10 pr-4 py-2 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-[#444444] dark:focus:ring-[#444444] w-64"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
  /></div></div></div><div className="bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-100 dark:border-[#222222] bg-slate-50/50 dark:bg-[#1a1a1a]/50"><th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Invoice</th><th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th><th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Total</th><th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Status</th><th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-[#222222]">{isLoading ? Array(5).fill(0).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={5} className="px-6 py-4 h-16 bg-slate-50/20 dark:bg-white/5" /></tr>) : filteredInvoices.length === 0 ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm"><FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        No invoices found
                                    </td></tr> : filteredInvoices.map((inv) => <tr key={inv.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"><td className="px-6 py-4"><div className="font-bold text-slate-900 dark:text-white">{inv.invoiceNumber}</div><div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">ID: {inv.id?.slice(0, 8)}...</div></td><td className="px-6 py-4 text-sm text-slate-600 dark:text-[#aaaaaa]">{new Date(inv.createdAt).toLocaleDateString()}</td><td className="px-6 py-4"><div className="font-bold text-slate-900 dark:text-white">₹{inv.total.toLocaleString()}</div><div className="text-[10px] text-slate-900 dark:text-white font-bold uppercase tracking-wider">Incl. Tax</div></td><td className="px-6 py-4"><div className="flex justify-center"><span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(inv.status)}`}>{getStatusIcon(inv.status)}{inv.status}</span></div></td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button
    className="p-2 bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#aaaaaa] rounded-lg hover:bg-slate-900 dark:bg-white hover:text-white transition-all shadow-sm"
    title="Print Invoice"
  ><Printer className="w-3.5 h-3.5" /></button><button
    className="p-2 bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#aaaaaa] rounded-lg hover:bg-slate-900 dark:bg-white hover:text-white transition-all shadow-sm"
    title="View Details"
  ><Eye className="w-3.5 h-3.5" /></button></div></td></tr>)}</tbody></table></div></div></div>;
}
export {
  InvoiceList as default
};
