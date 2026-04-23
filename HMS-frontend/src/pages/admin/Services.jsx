import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Filter, ChevronDown, MoreVertical, Edit2, Trash2, Power } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { hospitalServiceApi, specializationApi } from "@/utils/api";
import AddServiceModal from "@/components/modals/AddServiceModal";
import ServiceFilters from "@/components/specializations/ServiceFilters";
function Services() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [services, setServices] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState({ open: false, service: null });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    departments: [],
    amountRange: "",
    statuses: []
  });
  const loadData = async () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      const [svcData, specData] = await Promise.all([
        hospitalServiceApi.list(user.hospitalId),
        specializationApi.list(user.hospitalId)
      ]);
      setServices(svcData);
      setSpecializations(specData);
    } catch (err) {
      notify("Failed to load services", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, [user?.hospitalId]);
  const getSpecName = (id) => {
    return specializations.find((s) => s.id === id)?.name || "Unknown";
  };
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const specName = getSpecName(s.specializationId);
      const matchesDept = activeFilters.departments.length === 0 || activeFilters.departments.includes(specName);
      const matchesStatus = activeFilters.statuses.length === 0 || activeFilters.statuses.includes("Active") && s.isActive || activeFilters.statuses.includes("Inactive") && !s.isActive;
      let matchesPrice = true;
      if (activeFilters.amountRange) {
        const price = s.price;
        if (activeFilters.amountRange === "0-100") matchesPrice = price <= 100;
        else if (activeFilters.amountRange === "101-200") matchesPrice = price > 100 && price <= 200;
        else if (activeFilters.amountRange === "201-500") matchesPrice = price > 200 && price <= 500;
        else if (activeFilters.amountRange === "501+") matchesPrice = price > 500;
      }
      return matchesSearch && matchesDept && matchesStatus && matchesPrice;
    });
  }, [services, search, activeFilters, specializations]);
  const handleToggleStatus = async (id) => {
    try {
      await hospitalServiceApi.toggleStatus(id);
      setServices((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !s.isActive } : s));
      notify("Status updated", "success");
    } catch (err) {
      notify("Failed to toggle status", "error");
    }
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this service?")) return;
    try {
      await hospitalServiceApi.delete(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      notify("Service deleted", "success");
    } catch (err) {
      notify("Failed to delete service", "error");
    }
  };
  return <div className="p-6 space-y-6"><div className="flex justify-between items-center"><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Services</h1><span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-full border border-indigo-100 dark:border-indigo-500/20">
                        Total Services : {services.length}</span></div><div className="flex gap-3"><button className="btn-secondary">
                        Export <ChevronDown className="w-4 h-4" /></button><button
    onClick={() => setModal({ open: true, service: null })}
    className="btn-primary"
  ><Plus className="w-4 h-4" /> New Service
                    </button></div></div><div className="flex justify-between items-center gap-4 bg-white/50 dark:bg-[#0a0a0a]/50 p-2 rounded-2xl border border-slate-100 dark:border-[#1a1a1a]"><div className="relative flex-1 max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input
    type="text"
    placeholder="Search services..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder-slate-400 dark:placeholder-[#444444] text-slate-700 dark:text-[#cccccc]"
  /></div><div className="flex items-center gap-2 relative"><button
    onClick={() => setIsFilterOpen(!isFilterOpen)}
    className={`btn-secondary ${isFilterOpen || activeFilters.departments.length > 0 || activeFilters.amountRange || activeFilters.statuses.length > 0 ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30" : ""}`}
  ><Filter className={`w-4 h-4 transition-colors ${isFilterOpen || activeFilters.departments.length > 0 || activeFilters.amountRange || activeFilters.statuses.length > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-indigo-500"}`} />
                        Filters
                    </button><ServiceFilters
    isOpen={isFilterOpen}
    onClose={() => setIsFilterOpen(false)}
    onFilter={setActiveFilters}
    specializations={specializations}
  /><button className="btn-secondary">
                        Sort By : Recent <ChevronDown className="w-4 h-4 text-slate-400" /></button></div></div><div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/50 dark:bg-[#0a0a0a]/50"><th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-[#555555] uppercase tracking-wider">Service Name</th><th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-[#555555] uppercase tracking-wider">Department</th><th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-[#555555] uppercase tracking-wider">Price</th><th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-[#555555] uppercase tracking-wider">Status</th><th className="px-10 py-4 text-xs font-bold text-slate-500 dark:text-[#555555] uppercase tracking-wider w-10" /></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">{loading ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Loading services...</td></tr> : filteredServices.length === 0 ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No services found.</td></tr> : filteredServices.map((s) => <tr key={s.id} className="group hover:bg-slate-50/50 dark:hover:bg-[#161616]/50 transition-colors"><td className="px-6 py-4"><p className="font-semibold text-slate-700 dark:text-[#cccccc] text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{s.name}</p></td><td className="px-6 py-4"><span className="px-2.5 py-1 bg-slate-100 dark:bg-[#1e1e1e] text-slate-600 dark:text-[#888888] text-xs font-medium rounded-lg border border-slate-200 dark:border-[#2a2a2a]">{getSpecName(s.specializationId)}</span></td><td className="px-6 py-4"><p className="font-bold text-slate-900 dark:text-white text-sm">
                                                ${s.price}</p></td><td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.isActive ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20"}`}>{s.isActive ? "Active" : "Inactive"}</span></td><td className="px-6 py-4 relative"><button
    onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
    className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#222222] rounded-lg text-slate-400 transition-colors"
  ><MoreVertical className="w-4 h-4" /></button>{openMenuId === s.id && <div className="absolute right-6 top-12 w-44 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl shadow-xl z-20 py-1.5 animate-in fade-in zoom-in duration-150"><button
    onClick={() => {
      setModal({ open: true, service: s });
      setOpenMenuId(null);
    }}
    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors"
  ><Edit2 className="w-3.5 h-3.5" /> Edit Service
                                                    </button><button
    onClick={() => {
      handleToggleStatus(s.id);
      setOpenMenuId(null);
    }}
    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors"
  ><Power className="w-3.5 h-3.5" /> {s.isActive ? "Deactivate" : "Activate"}</button><div className="my-1 border-t border-slate-100 dark:border-[#2a2a2a]" /><button
    onClick={() => {
      handleDelete(s.id);
      setOpenMenuId(null);
    }}
    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
  ><Trash2 className="w-3.5 h-3.5" /> Delete Service
                                                    </button></div>}</td></tr>)}</tbody></table></div></div>{modal.open && <AddServiceModal
    isOpen={modal.open}
    onClose={() => setModal({ open: false, service: null })}
    service={modal.service}
    specializations={specializations}
    onSuccess={loadData}
  />}</div>;
}
export {
  Services as default
};
