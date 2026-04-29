import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { radiologyApi } from "@/utils/api";
import {
  ScanLine,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Loader2,
  User,
  Stethoscope,
  AlertTriangle,
  Zap
} from "lucide-react";
import NewOrderModal from "./NewOrderModal";
import WriteReportModal from "./WriteReportModal";
const PRIORITY_META = {
  ROUTINE: { cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]", icon: Clock },
  URGENT: { cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", icon: AlertTriangle },
  STAT: { cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20", icon: Zap }
};
function RadiologyQueue() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [stats, setStats] = useState({ pendingScan: 0, awaitingReport: 0, reportGenerated: 0 });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [showNewModal, setShowNewModal] = useState(false);
  const [writeReport, setWriteReport] = useState(null);
  const [actionMenu, setActionMenu] = useState(null);
  const [markingScanned, setMarkingScanned] = useState(null);
  const load = useCallback(async () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        radiologyApi.list(user.hospitalId),
        radiologyApi.getStats(user.hospitalId)
      ]);
      setOrders(ordersData);
      setStats(statsData);
    } catch {
      notify("Failed to load radiology queue", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.hospitalId]);
  useEffect(() => {
    load();
  }, [load]);
  const handleMarkScanned = async (order) => {
    setMarkingScanned(order.id);
    setActionMenu(null);
    try {
      await radiologyApi.markScanned(order.id);
      notify("Marked as scanned \u2014 moved to Awaiting Report", "success");
      load();
    } catch {
      notify("Failed to update status", "error");
    } finally {
      setMarkingScanned(null);
    }
  };
  const pending = orders.filter((o) => o.status === "PENDING_SCAN");
  const awaiting = orders.filter((o) => o.status === "AWAITING_REPORT");
  const applyFilters = (list) => {
    let result = list;
    if (priorityFilter !== "ALL") result = result.filter((o) => o.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) => o.patientName.toLowerCase().includes(q) || o.patientMrn.toLowerCase().includes(q) || o.serviceName.toLowerCase().includes(q) || o.technicianName?.toLowerCase().includes(q)
      );
    }
    return result;
  };
  const filteredPending = applyFilters(pending);
  const filteredAwaiting = applyFilters(awaiting);
  return <div className="space-y-5" onClick={() => setActionMenu(null)}>{
    /* Page header */
  }<div className="flex items-start justify-between gap-4 flex-wrap"><div><h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0] flex items-center gap-2"><ScanLine className="w-5 h-5 text-violet-500" /> Radiology Queue
                    </h1><p className="text-sm text-slate-500 dark:text-[#666666] mt-0.5">
                        X-Ray, CT Scan, MRI, Ultrasound, and other imaging investigations
                    </p></div><div className="flex items-center gap-3"><div className="flex items-center gap-2 text-xs font-semibold"><span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"><ScanLine className="w-3 h-3" /> {stats.pendingScan} awaiting scan
                        </span><span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400"><Clock className="w-3 h-3" /> {stats.awaitingReport} awaiting report
                        </span><span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-slate-900 dark:border-white/20 bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10 text-slate-900 dark:text-white dark:text-slate-300"><CheckCircle2 className="w-3 h-3" /> {stats.reportGenerated} done
                        </span></div><button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Order
                    </button></div></div>{
    /* Stat cards */
  }<div className="grid grid-cols-3 gap-4"><div className="bg-white dark:bg-[#111111] border-l-4 border-amber-400 border-t border-r border-b border-slate-200 dark:border-[#1e1e1e] rounded-xl p-5 flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider">Pending Scans</p><p className="text-3xl font-bold text-amber-500 mt-1">{stats.pendingScan}</p></div><ScanLine className="w-8 h-8 text-amber-200 dark:text-amber-500/30" /></div><div className="bg-white dark:bg-[#111111] border-l-4 border-violet-400 border-t border-r border-b border-slate-200 dark:border-[#1e1e1e] rounded-xl p-5 flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider">Awaiting Reports</p><p className="text-3xl font-bold text-violet-500 mt-1">{stats.awaitingReport}</p></div><Clock className="w-8 h-8 text-violet-200 dark:text-violet-500/30" /></div><div className="bg-white dark:bg-[#111111] border-l-4 border-emerald-400 border-t border-r border-b border-slate-200 dark:border-[#1e1e1e] rounded-xl p-5 flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider">Completed Today</p><p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.reportGenerated}</p></div><CheckCircle2 className="w-8 h-8 text-emerald-200 dark:text-slate-900 dark:text-white/30" /></div></div>{
    /* Search + filters */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4 flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input
    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#cccccc] focus:outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/50"
    placeholder="Search patient, test, MRN, technician…"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  /></div><div className="flex gap-1.5">{["ALL", "ROUTINE", "URGENT", "STAT"].map((p) => <button
    key={p}
    onClick={() => setPriorityFilter(p)}
    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors
                                ${priorityFilter === p ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "text-slate-500 dark:text-[#888888] hover:bg-slate-100 dark:hover:bg-[#1a1a1a]"}`}
  >{p}</button>)}</div></div>{loading ? <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : <>{
    /* Pending Scans section */
  }<QueueSection
    title="Imaging Queue (Ready for Scan)"
    subtitle="Orders waiting for the imaging procedure to be performed"
    color="border-amber-400"
    orders={filteredPending}
    emptyText="No pending scans"
    emptySubtext="New orders will appear here"
    actionLabel="Mark Scanned"
    actionCls="bg-amber-500 hover:bg-amber-600 text-white"
    onAction={handleMarkScanned}
    loadingId={markingScanned}
    actionMenu={actionMenu}
    setActionMenu={setActionMenu}
    onWriteReport={() => {
    }}
    showScanAction
  />{
    /* Awaiting Report section */
  }<QueueSection
    title="Awaiting Reports"
    subtitle="Scans completed — radiologist findings pending"
    color="border-violet-400"
    orders={filteredAwaiting}
    emptyText="No scans awaiting reports"
    emptySubtext="Completed scans will appear here"
    actionLabel="Write Report"
    actionCls="bg-violet-500 hover:bg-violet-600 text-white"
    onAction={(o) => setWriteReport(o)}
    loadingId={null}
    actionMenu={actionMenu}
    setActionMenu={setActionMenu}
    onWriteReport={(o) => setWriteReport(o)}
  /></>}{showNewModal && <NewOrderModal onClose={() => setShowNewModal(false)} onCreated={() => {
    setShowNewModal(false);
    load();
  }} />}{writeReport && <WriteReportModal order={writeReport} onClose={() => setWriteReport(null)} onSaved={() => {
    setWriteReport(null);
    load();
  }} />}</div>;
}
function QueueSection({ title, subtitle, color, orders, emptyText, emptySubtext, actionLabel, actionCls, onAction, loadingId, actionMenu, setActionMenu, showScanAction }) {
  return <div className={`bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl overflow-hidden border-t-4 ${color}`}><div className="px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e]"><p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">{title}</p><p className="text-xs text-slate-400 dark:text-[#555555] mt-0.5">{subtitle}</p></div>{orders.length === 0 ? <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-400 dark:text-[#555555]"><ScanLine className="w-8 h-8 opacity-30" /><p className="text-sm font-medium">{emptyText}</p><p className="text-xs">{emptySubtext}</p></div> : <div className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">{
    /* Column headers */
  }<div className="hidden md:grid grid-cols-[2.5fr_2fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-2.5 bg-slate-50 dark:bg-[#0d0d0d] border-b border-slate-100 dark:border-[#1e1e1e]">{["Patient", "Investigation", "Technician", "Priority", "Scheduled", ""].map((h) => <p key={h} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#555555]">{h}</p>)}</div>{orders.map((order) => {
    const pmeta = PRIORITY_META[order.priority];
    const PIcon = pmeta.icon;
    return <div key={order.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-[#151515] transition-colors md:grid md:grid-cols-[2.5fr_2fr_1.5fr_1fr_1fr_auto] md:gap-4 md:items-center space-y-2 md:space-y-0" onClick={(e) => e.stopPropagation()}>{
      /* Patient */
    }<div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#222222] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-[#888888] shrink-0">{order.patientName[0]}</div><div><p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd] leading-tight">{order.patientName}</p><p className="text-xs text-slate-400 dark:text-[#555555]">{order.patientMrn}</p></div></div>{
      /* Investigation */
    }<div><p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">{order.serviceName}</p>{order.referredByName && <div className="flex items-center gap-1 mt-0.5"><Stethoscope className="w-3 h-3 text-slate-400 dark:text-[#555555]" /><p className="text-xs text-slate-400 dark:text-[#555555]">{order.referredByName}</p></div>}</div>{
      /* Technician */
    }<div>{order.technicianName ? <div className="flex items-center gap-1.5"><User className="w-3 h-3 text-slate-400 dark:text-[#555555] shrink-0" /><p className="text-xs text-slate-600 dark:text-[#aaaaaa]">{order.technicianName}</p></div> : <p className="text-xs text-slate-300 dark:text-[#444444]">Unassigned</p>}</div>{
      /* Priority */
    }<div><span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${pmeta.cls}`}><PIcon className="w-2.5 h-2.5" />{order.priority}</span></div>{
      /* Scheduled */
    }<div><p className="text-xs text-slate-500 dark:text-[#888888]">{order.scheduledDate ?? "\u2014"}</p></div>{
      /* Action */
    }<div className="flex items-center justify-end">{showScanAction ? <button
      onClick={() => onAction(order)}
      disabled={loadingId === order.id}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${actionCls}`}
    >{loadingId === order.id ? "Updating\u2026" : actionLabel}</button> : <button
      onClick={() => onAction(order)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${actionCls}`}
    >{actionLabel}</button>}</div></div>;
  })}</div>}</div>;
}
export {
  RadiologyQueue as default
};
