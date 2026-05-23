import { useState } from "react";
import { admissionApi } from "@/utils/api";
import { X, Loader2 } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
const inputCls = `w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a]
    bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc]
    focus:outline-none focus:ring-2 focus:ring-slate-300/50`;
const labelCls = "block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-1.5";
// Attender is now an admission-level concept (each bed in a ward has its own).
// Callers pass admissionId; `label` is just the title-bar context (e.g. "Room 101"
// for a single-bed room, or "Bed 3 · Room 12" for a per-bed edit).
function AssignAttenderModal({ admissionId, label, existing, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [attender, setAttender] = useState({
    attenderName: existing?.name || "",
    attenderPhone: existing?.phone || "",
    attenderRelationship: existing?.relationship || ""
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!admissionId) {
      alert("No active admission for this bed/room — attender cannot be assigned.");
      return;
    }
    try {
      setSubmitting(true);
      await admissionApi.updateAttender(admissionId, attender);
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update attender");
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white dark:bg-[#111111] rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#2a2a2a]"><div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#222222]"><h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Assign Attender <span className="text-slate-400 font-normal">· {label}</span></h2><button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#aaaaaa] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"><X className="w-5 h-5" /></button></div><form onSubmit={handleSubmit} className="p-5 space-y-4"><div><label className={labelCls}>Attender Name *</label><input
    required
    type="text"
    className={inputCls}
    placeholder="Full name of attender"
    value={attender.attenderName}
    onChange={(e) => setAttender({ ...attender, attenderName: e.target.value })}
  /></div><div className="grid grid-cols-2 gap-3"><div><label className={labelCls}>Phone</label><input
    type="text"
    className={inputCls}
    placeholder="Phone number"
    value={attender.attenderPhone}
    onChange={(e) => setAttender({ ...attender, attenderPhone: e.target.value })}
  /></div><div><label className={labelCls}>Relationship</label><SearchableSelect
    className={inputCls}
    value={attender.attenderRelationship}
    onChange={(v) => setAttender({ ...attender, attenderRelationship: v })}
    options={[
      { value: "Spouse", label: "Spouse" },
      { value: "Parent", label: "Parent" },
      { value: "Child", label: "Child" },
      { value: "Sibling", label: "Sibling" },
      { value: "Friend", label: "Friend" },
    ]}
    placeholder="Select"
  /></div></div><div className="pt-2 border-t border-slate-100 dark:border-[#222222] flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={submitting} className="btn-primary">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Attender"}</button></div></form></div></div>;
}
export {
  AssignAttenderModal as default
};
