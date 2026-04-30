import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { roomLogsApi } from "@/utils/api";
import {
  ArrowLeft,
  Search,
  Loader2,
  Bed,
  User,
  Users,
  PlusCircle,
  LogOut,
  UserCheck,
  UserCog,
  CalendarClock
} from "lucide-react";
const EVENT_META = {
  ROOM_CREATED: { label: "Room Created", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", icon: PlusCircle },
  ALLOCATED: { label: "Allocated", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20", icon: Bed },
  DEALLOCATED: { label: "Deallocated", cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]", icon: LogOut },
  ATTENDER_ASSIGNED: { label: "Attender Assigned", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20", icon: UserCheck },
  ATTENDER_UPDATED: { label: "Attender Updated", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20", icon: UserCog }
};
function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
function RoomLogsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const roomId = searchParams.get("roomId") ? Number(searchParams.get("roomId")) : void 0;
  const roomNumber = searchParams.get("roomNumber") ?? void 0;
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
  return <div className="space-y-5">{
    /* Page header */
  }<div className="flex items-center gap-4"><button
    onClick={() => navigate("/rooms")}
    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-[#888888] dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
  ><ArrowLeft className="w-5 h-5" /></button><div><h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">{roomNumber ? `Room ${roomNumber} \u2014 Activity Log` : "Room Activity Log"}</h1><p className="text-sm text-slate-500 dark:text-[#666666] mt-0.5">{loading ? "Loading\u2026" : `${filteredLogs.length} event${filteredLogs.length !== 1 ? "s" : ""}`}</p></div></div>{
      /* Search + filter bar */
    }<div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
      <input
        className="bg-white w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#2a2a2a]
                            bg-slate-50 dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#cccccc]
                            focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-[#444444] dark:ring-white/50"
        placeholder="Search by room, patient, MRN, attender or performed by…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      /></div>{
      /* Log table */
    }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden">{
      /* Column headers */
    }<div className="hidden md:grid grid-cols-[2fr_2fr_2fr_1.5fr_1fr] gap-4 px-6 py-3 border-b border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0d0d0d]"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-[#999999]">Event</p><p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-[#999999]">Patient</p><p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-[#999999]">Attender</p><p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-[#999999]">Performed By</p><p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-[#999999] text-right">Time</p></div>{loading ? <div className="flex items-center justify-center py-20 text-slate-600"><Loader2 className="w-5 h-5 animate-spin" /></div> : filteredLogs.length === 0 ? <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600 dark:text-[#999999]"><CalendarClock className="w-10 h-10 opacity-30" /><p className="text-sm">No log entries found</p>{search && <p className="text-xs">Try clearing the search filter</p>}</div> : <div className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">{filteredLogs.map((log) => {
      const meta = EVENT_META[log.event];
      const Icon = meta.icon;
      return <div
        key={log.id}
        className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-[#151515] transition-colors md:grid md:grid-cols-[2fr_2fr_2fr_1.5fr_1fr] md:gap-4 md:items-center space-y-2 md:space-y-0"
      >{
          /* Event + room */
        }<div className="flex items-center gap-2 flex-wrap"><div className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] flex items-center justify-center shrink-0"><Icon className="w-3.5 h-3.5 text-slate-500 dark:text-[#888888]" /></div><div><span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span><p className="text-xs font-bold text-slate-700 dark:text-[#cccccc] mt-1">{log.roomNumber}{log.allocationToken && <span className="ml-2 font-mono text-slate-600 dark:text-slate-400 font-semibold">
          #{log.allocationToken}</span>}</p></div></div>{
          /* Patient */
        }<div>{log.patientName ? <div className="flex items-start gap-1.5"><User className="w-3.5 h-3.5 text-slate-600 dark:text-[#999999] shrink-0 mt-0.5" /><div><p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd] leading-tight">{log.patientName}</p>{log.patientMrn && <p className="text-xs text-slate-600 dark:text-[#999999]">{log.patientMrn}</p>}</div></div> : <p className="text-xs text-slate-500 dark:text-[#888888]">—</p>}</div>{
          /* Attender */
        }<div>{log.attenderName ? <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-600 dark:text-[#999999] shrink-0" /><p className="text-sm text-slate-700 dark:text-[#cccccc]">{log.attenderName}</p></div> : <p className="text-xs text-slate-500 dark:text-[#888888]">—</p>}</div>{
          /* Performed by */
        }<div>{log.performedBy ? <p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">{log.performedBy}</p> : <p className="text-xs text-slate-500 dark:text-[#888888]">—</p>}</div>{
          /* Time */
        }<div className="md:text-right"><p className="text-xs font-medium text-slate-500 dark:text-[#888888]" title={formatFull(log.createdAt)}>{formatRelative(log.createdAt)}</p><p className="text-[10px] text-slate-600 dark:text-[#999999] mt-0.5">{formatFull(log.createdAt)}</p></div></div>;
    })}</div>}</div></div>;
}
export {
  RoomLogsPage as default
};
