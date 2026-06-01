import { useState } from "react";
function SpecializationFilters({ isOpen, onClose, onApply, initialFilters }) {
  const [date, setDate] = useState(initialFilters.date || "");
  if (!isOpen) return null;
  const handleFilter = () => {
    onApply({ date: date || null });
    onClose();
  };
  return <div className="absolute top-14 right-0 z-50 w-72 bg-white rounded-lg shadow-2xl border border-slate-200 p-5 animate-in fade-in slide-in-from-top-2 duration-200"><div className="space-y-6">{
    /* Date Filter */
  }<div className="space-y-2"><label className="text-sm font-semibold text-slate-500">Date</label><div className="relative"><input
    type="date"
    value={date}
    onChange={(e) => setDate(e.target.value)}
    className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 transition-all text-sm"
  /></div></div>{
    /* Actions */
  }<div className="flex items-center justify-end gap-3 pt-2"><button
    onClick={onClose}
    className="btn-secondary px-4 py-2"
  >
                        Close
                    </button><button
    onClick={handleFilter}
    className="btn-primary"
  >
                        Filter
                    </button></div></div></div>;
}
export {
  SpecializationFilters as default
};
