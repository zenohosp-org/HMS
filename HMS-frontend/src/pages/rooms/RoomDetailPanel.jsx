import { X, User, Phone, Users, Package, CalendarClock, ScrollText } from "lucide-react";
import { formatDateTime } from "@/utils/validators";
function RoomDetailPanel({ room, onClose, onViewLogs }) {
  return <div className="w-80 shrink-0 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-2xl flex flex-col overflow-hidden self-start sticky top-0">{
    /* Header */
  }<div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-[#1e1e1e]"><div><p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider mb-1">{room.roomNumber}</p><div className="flex items-center gap-2"><span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border
                            ${room.roomType === "ICU" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]"}`}>{room.roomType}</span><span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border
                            ${room.status === "AVAILABLE" ? "bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white border-emerald-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-900 dark:border-white/20" : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"}`}>{room.status}</span></div></div><button
    onClick={onClose}
    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
  ><X className="w-4 h-4" /></button></div><div className="flex-1 overflow-y-auto p-5 space-y-5">{
    /* Token */
  }{room.allocationToken && <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20"><p className="text-xs font-semibold text-violet-600 dark:text-violet-400">Allocation Token</p><span className="text-sm font-bold tracking-widest text-violet-700 dark:text-violet-300 font-mono">{room.allocationToken}</span></div>}{
    /* Est. Discharge */
  }{room.approxDischargeTime && <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"><div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400"><CalendarClock className="w-3.5 h-3.5" />
                            Est. Discharge
                        </div><p className="text-xs font-medium text-amber-700 dark:text-amber-300">{formatDateTime(room.approxDischargeTime)}</p></div>}{
    /* Patient */
  }<div><div className="flex items-center gap-2 mb-3"><User className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666]" /><p className="text-xs font-bold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Patient</p></div>{room.currentPatient ? <div className="space-y-1 pl-1"><p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">{room.currentPatient.firstName} {room.currentPatient.lastName}</p><p className="text-xs text-slate-400 dark:text-[#555555]">{room.currentPatient.mrn}</p></div> : <p className="text-sm text-slate-400 dark:text-[#555555] pl-1">No patient assigned</p>}</div><div className="border-t border-slate-100 dark:border-[#1e1e1e]" />{
    /* Attender */
  }<div><div className="flex items-center gap-2 mb-3"><Users className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666]" /><p className="text-xs font-bold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Attender</p></div>{room.attenderName ? <div className="space-y-1.5 pl-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{room.attenderName}</p>{room.attenderRelationship && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-500 dark:text-[#888888] border border-slate-200 dark:border-[#333333]">{room.attenderRelationship}</span>}</div>{room.attenderPhone && <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666666]"><Phone className="w-3 h-3" />{room.attenderPhone}</div>}</div> : <p className="text-sm text-amber-500 dark:text-amber-400 pl-1">No attender assigned</p>}</div><div className="border-t border-slate-100 dark:border-[#1e1e1e]" />{
    /* Assets */
  }<div><div className="flex items-center gap-2 mb-3"><Package className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666]" /><p className="text-xs font-bold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Assets in Room</p></div><div className="pl-1 py-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-[#2a2a2a]"><Package className="w-6 h-6 text-slate-300 dark:text-[#333333] mb-1.5" /><p className="text-xs text-slate-400 dark:text-[#555555]">No assets assigned yet</p></div></div></div>{
    /* Footer: View Logs */
  }<div className="p-4 border-t border-slate-100 dark:border-[#1e1e1e] shrink-0"><button
    onClick={onViewLogs}
    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] text-sm font-semibold text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white transition-colors"
  ><ScrollText className="w-4 h-4" />
                    View Room Logs
                </button></div></div>;
}
export {
  RoomDetailPanel as default
};
