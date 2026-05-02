import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { radiologyApi } from "@/utils/api";
import Pagination from "@/components/ui/Pagination";
import { FileText, Search, Loader2, CheckCircle2, User, Clock, ExternalLink } from "lucide-react";
const PAGE_SIZE = 8;
const PRIORITY_CLS = {
  ROUTINE: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]",
  URGENT: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  STAT: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
};
function formatDateTime(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
function RadiologyReports() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pendingScan: 0, awaitingReport: 0, reportGenerated: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const load = useCallback(async () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      const [reports, statsData] = await Promise.all([
        radiologyApi.list(user.hospitalId, "REPORT_GENERATED"),
        radiologyApi.getStats(user.hospitalId)
      ]);
      setOrders(reports);
      setStats(statsData);
    } catch {
      notify("Failed to load reports", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.hospitalId]);
  useEffect(() => {
    load();
  }, [load]);
  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.patientName.toLowerCase().includes(q) || o.patientMrn.toLowerCase().includes(q) || o.serviceName.toLowerCase().includes(q) || o.reportId?.toLowerCase().includes(q);
  });
  return <div className="space-y-5"><div className="flex items-start justify-between gap-4 flex-wrap"><div><h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0] flex items-center gap-2"><FileText className="w-5 h-5 text-violet-500" /> Radiology Reports
                    </h1><p className="text-sm text-slate-500 dark:text-[#666666] mt-0.5">
                        View and manage completed radiology reports
                    </p></div><div className="flex items-center gap-2 text-xs font-semibold"><span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" /> {stats.reportGenerated} total reports
                    </span></div></div>{
    /* Search */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input
    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#cccccc] focus:outline-none focus:ring-2 focus:ring-slate-300/50"
    placeholder="Search by patient, investigation, MRN, report ID…"
    value={search}
    onChange={(e) => {
      setSearch(e.target.value);
      setPage(1);
    }}
  /></div></div>{
    /* Reports table */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden border-t-4 border-violet-400"><div className="px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e]"><p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">Completed Reports</p><p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">Radiology reports with findings</p></div>{loading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-600 dark:text-[#999999]"><FileText className="w-8 h-8 opacity-30" /><p className="text-sm">{search ? "No reports match your search" : "No completed reports yet"}</p></div> : <>{
    /* Column headers */
  }<div className="hidden md:grid grid-cols-[2.5fr_2fr_2fr_1.5fr_1fr_auto] gap-4 px-6 py-2.5 bg-slate-50 dark:bg-[#0d0d0d] border-b border-slate-100 dark:border-[#1e1e1e]">{["Patient", "Investigation", "Referred By", "Completed", "Priority", "Action"].map((h) => <p key={h} className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-[#999999]">{h}</p>)}</div><div className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">{filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((order) => <div key={order.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-[#151515] transition-colors md:grid md:grid-cols-[2.5fr_2fr_2fr_1.5fr_1fr_auto] md:gap-4 md:items-center space-y-2 md:space-y-0">{
    /* Patient */
  }<div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-violet-400" /></div><div><p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd] leading-tight">{order.patientName}</p><p className="text-xs text-slate-600 dark:text-[#999999]">{order.patientMrn}</p></div></div>{
    /* Investigation */
  }<div><p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">{order.serviceName}</p>{order.billNo && <p className="text-xs font-mono text-slate-600 dark:text-[#999999] mt-0.5">{order.billNo}</p>}</div>{
    /* Referred by */
  }<div className="flex items-center gap-1.5"><p className="text-sm text-slate-600 dark:text-[#aaaaaa]">{order.referredByName ?? "\u2014"}</p></div>{
    /* Completed */
  }<div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#888888]"><Clock className="w-3.5 h-3.5 shrink-0" /><span>{formatDateTime(order.reportedAt)}</span></div>{
    /* Priority */
  }<div><span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${PRIORITY_CLS[order.priority]}`}>{order.priority}</span></div>{
    /* Action */
  }<div><button
    onClick={() => navigate(`/radiology/reports/${order.id}`)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-500/30 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
  ><ExternalLink className="w-3 h-3" /> View Report
                                        </button></div></div>)}</div><div className="px-6 pb-4"><Pagination
    currentPage={page}
    totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
    totalItems={filtered.length}
    pageSize={PAGE_SIZE}
    onPageChange={setPage}
  /></div></>}</div></div>;
}
export {
  RadiologyReports as default
};
