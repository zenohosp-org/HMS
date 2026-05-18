import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Filter, MoreHorizontal, Edit2, Trash2, Power, AlertTriangle, Loader2, Settings2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { hospitalServiceApi, specializationApi } from "@/utils/api";
import AddServiceModal from "@/components/modals/AddServiceModal";
import ServiceFilters from "@/components/specializations/ServiceFilters";
import Pagination from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

function ConfirmDeleteDialog({ service, onConfirm, onCancel }) {
  if (!service) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-[#111111] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#222222] overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-rose-400 to-rose-600" />
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Service</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                This will permanently remove the service. Existing invoices referencing it will not be affected.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0f0f0f] border border-slate-100 dark:border-[#1e1e1e]">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center shrink-0">
              <Settings2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{service.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">₹{service.price}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-[#2a2a2a] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-all"
            >
              Keep Service
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-sm"
            >
              Delete Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Services() {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [services, setServices] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, service: null });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ departments: [], amountRange: "", statuses: [] });

  const loadData = async () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      const [svcData, specData] = await Promise.all([
        hospitalServiceApi.list(user.hospitalId),
        specializationApi.list(user.hospitalId),
      ]);
      setServices(svcData);
      setSpecializations(specData);
    } catch {
      notify("Failed to load services", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user?.hospitalId]);

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const getSpecName = (id) => specializations.find((s) => s.id === id)?.name || "—";

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const specName = getSpecName(s.specializationId);
      const q = search.toLowerCase();
      const matchesSearch = s.name.toLowerCase().includes(q) || specName.toLowerCase().includes(q);
      const matchesDept = activeFilters.departments.length === 0 || activeFilters.departments.includes(specName);
      const matchesStatus =
        activeFilters.statuses.length === 0 ||
        (activeFilters.statuses.includes("Active") && s.isActive) ||
        (activeFilters.statuses.includes("Inactive") && !s.isActive);
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

  const paginated = filteredServices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleToggleStatus = async (id) => {
    try {
      await hospitalServiceApi.toggleStatus(id);
      setServices((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !s.isActive } : s));
      notify("Status updated", "success");
    } catch {
      notify("Failed to toggle status", "error");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await hospitalServiceApi.delete(confirmDelete.id);
      setServices((prev) => prev.filter((s) => s.id !== confirmDelete.id));
      notify("Service deleted", "success");
    } catch {
      notify("Failed to delete service", "error");
    } finally {
      setConfirmDelete(null);
    }
  };

  const hasActiveFilters = activeFilters.departments.length > 0 || activeFilters.amountRange || activeFilters.statuses.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Services</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-800/30">
            {services.length} total
          </span>
        </div>
        <button className="btn-primary" onClick={() => setModal({ open: true, service: null })}>
          <Plus className="w-4 h-4" /> New Service
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by service name or department…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 focus:border-slate-400 dark:focus:border-[#444444] transition-all shadow-sm"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`btn-secondary flex items-center gap-2 ${hasActiveFilters ? "ring-2 ring-blue-500/30 border-blue-300 dark:border-blue-700" : ""}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            )}
          </button>
          <ServiceFilters
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            onFilter={(f) => { setActiveFilters(f); setPage(1); }}
            specializations={specializations}
          />
        </div>
      </div>

      {/* Table card */}
      <div className="flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]">
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Service Name</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Department</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Price</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">GST %</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
                      <p className="text-sm font-medium text-slate-600">Loading services…</p>
                    </div>
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center">
                        <Settings2 className="w-8 h-8 text-slate-200 dark:text-slate-800" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {search || hasActiveFilters ? "No services match your search." : "No services added yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[15px] text-slate-900 dark:text-white leading-tight">{s.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-[#2a2a2a]">
                        {getSpecName(s.specializationId)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">₹{s.price}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        Number(s.gstRate || 0) > 0
                          ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30"
                          : "bg-slate-50 dark:bg-[#1a1a1a] text-slate-400 dark:text-[#666] border-slate-200 dark:border-[#2a2a2a]"
                      }`}>
                        {Number(s.gstRate || 0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        s.isActive
                          ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30"
                          : "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/30"
                      }`}>
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === s.id ? null : s.id);
                        }}
                        className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      {openMenuId === s.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div
                            className="absolute right-6 top-14 w-52 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-slate-100 dark:border-[#252525] z-20 py-1.5 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => { setModal({ open: true, service: s }); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222] transition-all"
                            >
                              <Edit2 className="w-4 h-4" /> Edit Service
                            </button>
                            <button
                              onClick={() => { handleToggleStatus(s.id); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222] transition-all"
                            >
                              <Power className="w-4 h-4" /> {s.isActive ? "Deactivate" : "Activate"}
                            </button>
                            <div className="h-px bg-slate-50 dark:bg-[#252525] my-1" />
                            <button
                              onClick={() => { setConfirmDelete(s); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                            >
                              <Trash2 className="w-4 h-4" /> Delete Service
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredServices.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-[#1a1a1a]">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filteredServices.length / PAGE_SIZE)}
              totalItems={filteredServices.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {modal.open && (
        <AddServiceModal
          isOpen={modal.open}
          onClose={() => setModal({ open: false, service: null })}
          service={modal.service}
          specializations={specializations}
          onSuccess={loadData}
        />
      )}

      <ConfirmDeleteDialog
        service={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export { Services as default };
