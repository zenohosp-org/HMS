import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { radiologyApi } from "@/utils/api";
import { ArrowLeft, Printer, Loader2, ScanLine, AlertCircle } from "lucide-react";
const PRIORITY_CLS = {
  ROUTINE: "bg-slate-100 text-slate-600 border-slate-200",
  URGENT: "bg-amber-50 text-amber-700 border-amber-200",
  STAT: "bg-red-50 text-red-700 border-red-200"
};
function fmt(iso) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
function RadiologyReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    radiologyApi.get(Number(id)).then(setOrder).catch(() => setOrder(null)).finally(() => setLoading(false));
  }, [id]);
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!order) return <div className="flex flex-col items-center justify-center h-64 gap-3"><AlertCircle className="w-10 h-10 text-slate-300" /><p className="text-slate-500">Report not found.</p><button onClick={() => navigate("/radiology/reports")} className="btn-secondary text-sm">← Back to Reports</button></div>;
  return <div className="space-y-4 max-w-4xl mx-auto">{
    /* Toolbar */
  }<div className="flex items-center justify-between print:hidden"><button
    onClick={() => navigate("/radiology/reports")}
    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-[#aaaaaa] border border-slate-200 dark:border-[#2a2a2a] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
  ><ArrowLeft className="w-4 h-4" /> Back to Reports
                </button><button
    onClick={() => window.print()}
    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-900 text-white transition-colors"
  ><Printer className="w-4 h-4" /> Print Report
                </button></div>{
    /* Report card */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden print:border-none print:shadow-none">{
    /* Hospital header */
  }<div className="px-8 py-6 border-b-2 border-slate-200 dark:border-slate-400"><div className="flex items-start justify-between"><div className="flex items-center gap-4"><div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-200 flex items-center justify-center shrink-0"><ScanLine className="w-7 h-7 text-slate-900 dark:text-white dark:text-slate-300" /></div><div><h1 className="text-xl font-bold text-slate-900 dark:text-white">{user?.hospitalName ?? "Hospital"}</h1><p className="text-sm text-slate-500 dark:text-[#888888] mt-0.5">Radiology Department</p></div></div><div className="text-right"><span className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-200 text-slate-900 dark:text-white dark:text-slate-300">
                                Department of Radiology
                            </span>{order.reportId && <p className="text-xs text-slate-600 dark:text-[#999999] mt-2 font-mono">
                                    Report ID: <span className="font-bold text-slate-700 dark:text-[#cccccc]">{order.reportId}</span></p>}</div></div></div>{
    /* Patient info grid */
  }<div className="px-8 py-6 border-b border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0d0d0d]"><div className="grid grid-cols-2 gap-x-8 gap-y-4"><InfoRow label="Patient Name" value={order.patientName} /><InfoRow label="Patient ID" value={order.patientMrn} bold /><InfoRow label="Referred By" value={order.referredByName} /><InfoRow label="Technician" value={order.technicianName ?? "N/A"} /><InfoRow label="Scan Date" value={fmt(order.scannedAt)} /><InfoRow label="Report Date" value={fmt(order.reportedAt)} /></div></div>{
    /* Investigation block */
  }<div className="px-8 py-6 space-y-5">{
    /* Investigation tab */
  }<div><div className="inline-flex items-center gap-2 px-4 py-2 rounded-t-lg bg-slate-900 text-white text-sm font-bold">{order.serviceName}</div><div className="border border-slate-200 dark:border-slate-200/30 rounded-b-lg rounded-tr-lg p-4"><div className="flex items-center justify-between">{order.billNo && <p className="text-xs text-slate-500 dark:text-[#888888]">
                                        Bill No: <span className="font-semibold text-slate-700 dark:text-[#cccccc]">{order.billNo}</span></p>}<span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${PRIORITY_CLS[order.priority]}`}>
                                    Priority: {order.priority}</span></div></div></div>{
    /* Findings */
  }{order.findings && <div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white dark:text-slate-300 mb-2 pb-1 border-b border-slate-200 dark:border-[#333333]">
                                Findings
                            </h3><p className="text-sm text-slate-700 dark:text-[#cccccc] whitespace-pre-wrap leading-relaxed">{order.findings}</p></div>}{
    /* Observation */
  }{order.observation && <div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white dark:text-slate-300 mb-2 pb-1 border-b border-slate-200 dark:border-[#333333]">
                                Observation / Impression
                            </h3><p className="text-sm text-slate-700 dark:text-[#cccccc] whitespace-pre-wrap leading-relaxed">{order.observation}</p></div>}{
    /* Signature row */
  }<div className="flex items-end justify-between mt-10 pt-6 border-t border-slate-200 dark:border-[#1e1e1e]"><div className="flex flex-col items-center gap-2"><div className="w-24 h-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-[#2a2a2a] flex items-center justify-center"><p className="text-[10px] text-slate-600 dark:text-[#999999]">QR Code</p></div></div><div className="text-right"><div className="w-40 border-b border-slate-400 dark:border-[#555555] mb-2" /><p className="text-xs font-semibold text-slate-600 dark:text-[#aaaaaa]">Radiologist</p><p className="text-[10px] text-slate-600 dark:text-[#999999] mt-0.5">Signature &amp; Stamp</p></div></div></div></div></div>;
}
function InfoRow({ label, value, bold }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-[#999999] mb-0.5">{label}</p><p className={`text-sm ${bold ? "font-bold text-slate-900 dark:text-white" : "text-slate-700 dark:text-[#cccccc]"}`}>{value ?? "N/A"}</p></div>;
}
export {
  RadiologyReportView as default
};
