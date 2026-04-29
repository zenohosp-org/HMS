import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { roomLogsApi } from "@/utils/api";
import { X, Search, Loader2, Bed, User, Users, CalendarClock, PlusCircle, LogOut, UserCheck, UserCog } from "lucide-react";
const EVENT_META = {
  ROOM_CREATED: { label: "Room Created", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", icon: PlusCircle },
  ALLOCATED: { label: "Allocated", cls: "bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white border-emerald-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-900 dark:border-white/20", icon: Bed },
  DEALLOCATED: { label: "Deallocated", cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]", icon: LogOut },
  ATTENDER_ASSIGNED: { label: "Attender Assigned", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20", icon: UserCheck },
  ATTENDER_UPDATED: { label: "Attender Updated", cls: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20", icon: UserCog }
};
function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function formatFull(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
function RoomLogsModal({ onClose, roomId, roomNumber }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const fetchLogs = useCallback(async () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      const data = roomId ? await roomLogsApi.getRoomLogs(roomId, user.hospitalId) : await roomLogsApi.getHospitalLogs(user.hospitalId, debouncedSearch || void 0);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [user?.hospitalId, roomId, debouncedSearch]);
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);
  const filteredLogs = roomId && debouncedSearch ? logs.filter((l) => {
    const s = debouncedSearch.toLowerCase();
    return l.roomNumber?.toLowerCase().includes(s) || l.patientName?.toLowerCase().includes(s) || l.patientMrn?.toLowerCase().includes(s) || l.attenderName?.toLowerCase().includes(s) || l.performedBy?.toLowerCase().includes(s);
  }) : logs;
  const title = roomId ? `Logs \xB7 Room ${roomNumber}` : "Room Logs";
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white dark:bg-[#111111] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#2a2a2a]">{
    /* Header */
  }<div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2><p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{loading ? "Loading\u2026" : `${filteredLogs.length} event${filteredLogs.length !== 1 ? "s" : ""}`}</p></div><button
    onClick={onClose}
    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
  ><X className="w-5 h-5" /></button></div>{
    /* Search */
  }<div className="px-6 py-3 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input
    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a]
                                bg-slate-50 dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#cccccc]
                                focus:outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/50"
    placeholder="Search by room, patient, MRN, attender or performed by…"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    autoFocus
  /></div></div>{
    /* Log list */
  }<div className="flex-1 overflow-y-auto">{loading ? <div className="flex items-center justify-center h-48 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div> : filteredLogs.length === 0 ? <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-[#555555] gap-2"><CalendarClock className="w-8 h-8 opacity-40" /><p className="text-sm">No logs found</p></div> : <div className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">{filteredLogs.map((log) => {
    const meta = EVENT_META[log.event];
    const Icon = meta.icon;
    return <div key={log.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-[#151515] transition-colors"><div className="flex items-start gap-4">{
      /* Event icon */
    }<div className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-[#2a2a2a]"><Icon className="w-4 h-4 text-slate-500 dark:text-[#888888]" /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap">{
      /* Event badge */
    }<span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>{
      /* Room number */
    }<span className="text-xs font-bold text-slate-700 dark:text-[#cccccc] bg-slate-100 dark:bg-[#222222] px-2 py-0.5 rounded-md">{log.roomNumber}</span>{
      /* Token */
    }{log.allocationToken && <span className="text-[10px] font-bold tracking-widest text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 px-2 py-0.5 rounded-md font-mono">{log.allocationToken}</span>}</div><div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">{log.patientName && <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#aaaaaa]"><User className="w-3 h-3 text-slate-400 dark:text-[#555555] shrink-0" /><span className="font-medium">{log.patientName}</span>{log.patientMrn && <span className="text-slate-400 dark:text-[#555555]">· {log.patientMrn}</span>}</div>}{log.attenderName && <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#aaaaaa]"><Users className="w-3 h-3 text-slate-400 dark:text-[#555555] shrink-0" /><span>{log.attenderName}</span></div>}</div></div>{
      /* Right: performed by + time */
    }<div className="text-right shrink-0 space-y-1">{log.performedBy && <p className="text-xs font-medium text-slate-700 dark:text-[#cccccc]">{log.performedBy}</p>}<p className="text-[11px] text-slate-400 dark:text-[#555555]" title={formatFull(log.createdAt)}>{formatRelative(log.createdAt)}</p><p className="text-[10px] text-slate-300 dark:text-[#444444]">{formatFull(log.createdAt)}</p></div></div></div>;
  })}</div>}</div></div></div>;
}
export {
  RoomLogsModal as default
};
