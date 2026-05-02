import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
function ServiceFilters({ isOpen, onClose, onFilter, specializations }) {
  const [tempFilters, setTempFilters] = useState({
    departments: [],
    amountRange: "",
    statuses: []
  });
  const toggleDepartment = (name) => {
    setTempFilters((prev) => ({
      ...prev,
      departments: prev.departments.includes(name) ? prev.departments.filter((d) => d !== name) : [...prev.departments, name]
    }));
  };
  const toggleStatus = (status) => {
    setTempFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status) ? prev.statuses.filter((s) => s !== status) : [...prev.statuses, status]
    }));
  };
  const resetDepartments = () => setTempFilters((prev) => ({ ...prev, departments: [] }));
  const resetStatuses = () => setTempFilters((prev) => ({ ...prev, statuses: [] }));
  const handleApply = () => {
    onFilter(tempFilters);
    onClose();
  };
  if (!isOpen) return null;
  return <div className="absolute right-0 top-12 w-80 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200"><div className="p-5 space-y-6">{
    /* Department Section */
  }<div className="space-y-3"><div className="flex justify-between items-center"><h3 className="text-sm font-bold text-slate-700 dark:text-[#aaaaaa]">Department</h3><button
    onClick={resetDepartments}
    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
  >
                            Reset
                        </button></div><div className="flex flex-wrap gap-2">{specializations.map((spec) => <button
    key={spec.id}
    onClick={() => toggleDepartment(spec.name)}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${tempFilters.departments.includes(spec.name) ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30" : "bg-slate-50 dark:bg-[#1e1e1e] text-slate-500 dark:text-[#666666] border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300"}`}
  >{tempFilters.departments.includes(spec.name) && <X className="w-3 h-3" />}{spec.name}</button>)}</div></div>{
    /* Amount Section */
  }<div className="space-y-3"><h3 className="text-sm font-bold text-slate-700 dark:text-[#aaaaaa]">Amount</h3><div className="relative"><select
    value={tempFilters.amountRange}
    onChange={(e) => setTempFilters((prev) => ({ ...prev, amountRange: e.target.value }))}
    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-lg text-xs font-medium text-slate-600 dark:text-[#888888] appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
  ><option value="">Select Range</option><option value="0-100">$0 - $100</option><option value="101-200">$101 - $200</option><option value="201-500">$201 - $500</option><option value="501+">$500+</option></select><ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" /></div></div>{
    /* Status Section */
  }<div className="space-y-3"><div className="flex justify-between items-center"><h3 className="text-sm font-bold text-slate-700 dark:text-[#aaaaaa]">Status</h3><button
    onClick={resetStatuses}
    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
  >
                            Reset
                        </button></div><div className="flex flex-wrap gap-2">{["Active", "Inactive"].map((status) => <button
    key={status}
    onClick={() => toggleStatus(status)}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${tempFilters.statuses.includes(status) ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30" : "bg-slate-50 dark:bg-[#1e1e1e] text-slate-500 dark:text-[#666666] border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300"}`}
  >{tempFilters.statuses.includes(status) && <X className="w-3 h-3" />}{status}</button>)}</div></div></div><div className="flex gap-2 px-5 py-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50 border-t border-slate-100 dark:border-[#1a1a1a]"><button
    onClick={onClose}
    className="btn-secondary flex-1 px-4 py-2 text-xs"
  >
                    Close
                </button><button
    onClick={handleApply}
    className="btn-primary flex-1 px-4 py-2 text-xs"
  >
                    Filter
                </button></div></div>;
}
export {
  ServiceFilters as default
};
