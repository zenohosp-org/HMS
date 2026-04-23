import { useState } from "react";
import { useNotification } from "@/context/NotificationContext";
import { radiologyApi } from "@/utils/api";
import { X, FileText } from "lucide-react";
function WriteReportModal({ order, onClose, onSaved }) {
  const { notify } = useNotification();
  const [findings, setFindings] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!findings.trim()) {
      notify("Findings are required", "error");
      return;
    }
    setSaving(true);
    try {
      await radiologyApi.generateReport(order.id, findings, observation);
      notify("Report generated", "success");
      onSaved();
    } catch {
      notify("Failed to generate report", "error");
    } finally {
      setSaving(false);
    }
  };
  const labelCls = "block text-xs font-semibold text-slate-500 dark:text-[#888888] mb-1.5";
  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#cccccc] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none";
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-[#2a2a2a]"><div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#1e1e1e]"><div><h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-violet-500" /> Write Report
                        </h2><p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{order.patientName} · {order.serviceName}</p></div><button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"><X className="w-4 h-4" /></button></div><form onSubmit={handleSubmit} className="p-6 space-y-4"><div><label className={labelCls}>Findings *</label><textarea
    rows={5}
    className={inputCls}
    placeholder="Enter radiology findings…"
    value={findings}
    onChange={(e) => setFindings(e.target.value)}
    autoFocus
  /></div><div><label className={labelCls}>Observation / Impression</label><textarea
    rows={3}
    className={inputCls}
    placeholder="e.g. Study appears within normal limits…"
    value={observation}
    onChange={(e) => setObservation(e.target.value)}
  /></div><div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? "Generating\u2026" : "Generate Report"}</button></div></form></div></div>;
}
export {
  WriteReportModal as default
};
