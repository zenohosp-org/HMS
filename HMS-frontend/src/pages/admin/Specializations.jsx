import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Loader2, Stethoscope } from "lucide-react";
import { specializationApi } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import AddSpecializationModal from "@/components/modals/AddSpecializationModal";
import SpecializationFilters from "@/components/specializations/SpecializationFilters";
import { format, parseISO, isSameDay } from "date-fns";
function Specializations() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [specializations, setSpecializations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [activeFilters, setActiveFilters] = useState({
    date: null,
    statuses: []
  });
  const loadData = async () => {
    if (!user?.hospitalId) return;
    setIsLoading(true);
    try {
      const data = await specializationApi.list(user.hospitalId);
      setSpecializations(data);
    } catch (err) {
      notify("Failed to load specializations", "error");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, [user]);
  const filteredSpecs = useMemo(() => {
    return specializations.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !activeFilters.date || isSameDay(parseISO(s.createdAt), parseISO(activeFilters.date));
      const matchesStatus = activeFilters.statuses.length === 0 || s.isActive && activeFilters.statuses.includes("Active") || !s.isActive && activeFilters.statuses.includes("Inactive");
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [specializations, searchQuery, activeFilters]);
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this specialization?")) return;
    try {
      await specializationApi.delete(id);
      notify("Specialization deleted", "success");
      loadData();
    } catch (err) {
      notify("Failed to delete specialization", "error");
    }
  };
  const toggleStatus = async (spec) => {
    try {
      await specializationApi.update(spec.id, {
        ...spec,
        isActive: !spec.isActive,
        hospitalId: user?.hospitalId
      });
      notify(`Specialization marked as ${!spec.isActive ? "Active" : "Inactive"}`, "success");
      loadData();
    } catch (err) {
      notify("Failed to update status", "error");
    }
  };
  return <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] gap-6">{
    /* Header Section */
  }<div className="flex flex-col gap-1"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Specializations</h1><span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1e1e1e] dark:bg-emerald-900/20 text-slate-900 dark:text-white dark:text-slate-500 text-xs font-bold border border-emerald-100 dark:border-emerald-800/30">
    Total Specializations : {specializations.length}</span></div><button
      onClick={() => {
        setEditingSpec(null);
        setIsModalOpen(true);
      }}
      className="btn-primary"
    ><Plus className="w-4 h-4" /> Add New Specialization
    </button></div></div>{
      /* Filters Bar */
    }<div className="flex items-center justify-between gap-4"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" /><input
      type="text"
      placeholder="Search by name or department..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/20 focus:border-slate-900 dark:border-white transition-all shadow-sm"
    /></div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`btn-secondary ${isFilterOpen || activeFilters.date || activeFilters.statuses.length > 0 ? "bg-slate-100 dark:bg-[#1e1e1e] dark:bg-emerald-900/10 text-slate-900 dark:text-white border-emerald-100 dark:border-emerald-800/30" : ""}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(activeFilters.date || activeFilters.statuses.length > 0) && <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white" />}
          </button><SpecializationFilters
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            initialFilters={activeFilters}
            onApply={setActiveFilters}
          />
        </div>
      </div>
    </div>{
      /* Main Content Table */
    }<div className="flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col"><div className="overflow-x-auto flex-1"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]"><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Specialization</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Created Date</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">No of Doctor</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th><th className="px-6 py-4" /></tr></thead><tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">{isLoading ? <tr><td colSpan={5} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" /><p className="text-sm font-medium text-slate-600">Loading specializations...</p></div></td></tr> : filteredSpecs.length === 0 ? <tr><td colSpan={5} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center"><Stethoscope className="w-8 h-8 text-slate-200 dark:text-slate-800" /></div><p className="text-sm font-medium text-slate-600">No specializations found.</p></div></td></tr> : filteredSpecs.map((spec) => <tr key={spec.id} className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all"><td className="px-6 py-4"><div className="flex items-center gap-4"><div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-[#222222] flex items-center justify-center shrink-0"><Stethoscope className="w-5 h-5 text-slate-500 dark:text-slate-400" /></div><div><p className="font-bold text-slate-900 dark:text-white text-[15px]">{spec.name}</p>{spec.description && <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-1 max-w-[200px]">{spec.description}</p>}</div></div></td><td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{format(parseISO(spec.createdAt), "dd MMM yyyy")}</td><td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-500">{spec.noOfDoctor}</td><td className="px-6 py-4"><button
      onClick={() => toggleStatus(spec)}
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${spec.isActive ? "bg-slate-100 dark:bg-[#1e1e1e] dark:bg-emerald-900/10 text-slate-900 dark:text-white dark:text-slate-500 border-emerald-100 dark:border-emerald-800/30" : "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/30"}`}
    >{spec.isActive ? "Active" : "Inactive"}</button></td><td className="px-6 py-4 text-right relative"><button
      onClick={() => setActiveMenuId(activeMenuId === spec.id ? null : spec.id)}
      className="p-2 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
    ><MoreHorizontal className="w-5 h-5" /></button>{activeMenuId === spec.id && <><div
      className="fixed inset-0 z-10"
      onClick={() => setActiveMenuId(null)}
    /><div className="absolute right-6 top-14 w-44 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl border border-slate-100 dark:border-[#252525] z-20 py-1.5 animate-in slide-in-from-top-2 duration-150"><button
      onClick={() => {
        setEditingSpec(spec);
        setIsModalOpen(true);
        setActiveMenuId(null);
      }}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#222222] transition-all"
    ><Edit className="w-4 h-4" />
      Edit details
    </button><div className="h-px bg-slate-50 dark:bg-[#252525] my-1" /><button
      onClick={() => {
        handleDelete(spec.id);
        setActiveMenuId(null);
      }}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
    ><Trash2 className="w-4 h-4" />
          Delete
        </button></div></>}</td></tr>)}</tbody></table></div></div><AddSpecializationModal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        setEditingSpec(null);
      }}
      onSuccess={loadData}
      initialData={editingSpec}
    /></div>;
}
export {
  Specializations as default
};
