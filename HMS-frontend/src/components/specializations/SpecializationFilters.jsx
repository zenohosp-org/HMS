import { useState } from "react";
import { X } from "lucide-react";
function SpecializationFilters({ isOpen, onClose, onApply, initialFilters }) {
  const [date, setDate] = useState(initialFilters.date || "");
  const [selectedStatuses, setSelectedStatuses] = useState(initialFilters.statuses);
  if (!isOpen) return null;
  const toggleStatus = (status) => {
    setSelectedStatuses(
      (prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };
  const handleFilter = () => {
    onApply({
      date: date || null,
      statuses: selectedStatuses
    });
    onClose();
  };
  return <div className="absolute top-14 right-0 z-50 w-72 bg-white dark:bg-[#111111] rounded-lg shadow-2xl border border-slate-200 dark:border-[#222222] p-5 animate-in fade-in slide-in-from-top-2 duration-200"><div className="space-y-6">{
    /* Date Filter */
  }<div className="space-y-2"><label className="text-sm font-semibold text-slate-500 dark:text-slate-600">Date</label><div className="relative"><input
    type="date"
    value={date}
    onChange={(e) => setDate(e.target.value)}
    className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/20 focus:border-slate-900 dark:border-white transition-all text-sm"
  /></div></div>{
    /* Status Filter */
  }<div className="space-y-3"><label className="text-sm font-semibold text-slate-500 dark:text-slate-600">Status</label><div className="flex flex-wrap gap-2">{["Active", "Inactive"].map((status) => {
    const isSelected = selectedStatuses.includes(status);
    return <button
      key={status}
      onClick={() => toggleStatus(status)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSelected ? "bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#333333]" : "bg-transparent text-slate-600 dark:text-slate-600 border-slate-100 dark:border-[#1a1a1a] hover:bg-slate-50 dark:hover:bg-[#0f0f0f]"}`}
    >{isSelected && <X className="w-3 h-3" />}{status}</button>;
  })}</div></div>{
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
