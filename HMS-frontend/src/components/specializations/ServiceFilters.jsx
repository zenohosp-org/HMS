import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
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
  return <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200"><div className="p-5 space-y-6">{
    /* Department Section */
  }<div className="space-y-3"><div className="flex justify-between items-center"><h3 className="text-sm font-bold text-slate-700">Department</h3><button
    onClick={resetDepartments}
    className="text-xs font-semibold text-slate-900 hover:text-slate-700 transition-colors"
  >
                            Reset
                        </button></div><div className="flex flex-wrap gap-2">{specializations.map((spec) => <button
    key={spec.id}
    onClick={() => toggleDepartment(spec.name)}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${tempFilters.departments.includes(spec.name) ? "bg-slate-100 text-slate-900 border-slate-200" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"}`}
  >{tempFilters.departments.includes(spec.name) && <X className="w-3 h-3" />}{spec.name}</button>)}</div></div>{
    /* Amount Section */
  }<div className="space-y-3"><h3 className="text-sm font-bold text-slate-700">Amount</h3><div className="relative"><SearchableSelect
    value={tempFilters.amountRange}
    onChange={(v) => setTempFilters((prev) => ({ ...prev, amountRange: v }))}
    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 appearance-none cursor-pointer focus:ring-2 focus:ring-slate-300/10 outline-none transition-all"
    options={[
      { value: "", label: "Select Range" },
      { value: "0-100", label: "$0 - $100" },
      { value: "101-200", label: "$101 - $200" },
      { value: "201-500", label: "$201 - $500" },
      { value: "501+", label: "$500+" },
    ]}
  /></div></div>{
    /* Status Section */
  }<div className="space-y-3"><div className="flex justify-between items-center"><h3 className="text-sm font-bold text-slate-700">Status</h3><button
    onClick={resetStatuses}
    className="text-xs font-semibold text-slate-900 hover:text-slate-700 transition-colors"
  >
                            Reset
                        </button></div><div className="flex flex-wrap gap-2">{["Active", "Inactive"].map((status) => <button
    key={status}
    onClick={() => toggleStatus(status)}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${tempFilters.statuses.includes(status) ? "bg-slate-100 text-slate-900 border-slate-200" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"}`}
  >{tempFilters.statuses.includes(status) && <X className="w-3 h-3" />}{status}</button>)}</div></div></div><div className="flex gap-2 px-5 py-4 bg-slate-50/50 border-t border-slate-100"><button
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
