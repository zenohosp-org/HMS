import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { patientServicesApi } from "@/utils/api";
import PatientServiceFormModal from "@/components/modals/PatientServiceFormModal";
import Pagination from "@/components/ui/Pagination";
import { MoreHorizontal, Loader2, Trash2, Pencil, ToggleLeft, ToggleRight, ConciergeBell, Search } from "lucide-react";

const PAGE_SIZE = 8;

const TYPE_LABEL = {
  FOOD: "Food",
  ROOM_SERVICE: "Room Service",
  CONVENIENCE: "Convenience",
  CUSTOM: "Custom",
};

const TYPE_BADGE = {
  FOOD: "bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30",
  ROOM_SERVICE: "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30",
  CONVENIENCE: "bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800/30",
  CUSTOM: "bg-slate-50 dark:bg-slate-900/10 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800/30",
};

function priceLabel(service) {
  if (service.type === "FOOD") return `₹${service.pricePerMeal ?? 0}/meal`;
  return `₹${service.pricePerDay ?? 0}/day`;
}

function mealTimeLabel(mealTime) {
  if (!mealTime) return "—";
  return mealTime.charAt(0) + mealTime.slice(1).toLowerCase();
}

export default function PatientServices() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editService, setEditService] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const load = async () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      const data = await patientServicesApi.list(user.hospitalId);
      setServices(data || []);
    } catch {
      notify("Failed to load patient services", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.hospitalId]);

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleDelete = async (service) => {
    if (!confirm(`Remove "${service.name}"? This cannot be undone.`)) return;
    try {
      await patientServicesApi.delete(service.id);
      notify("Service removed", "success");
      load();
    } catch {
      notify("Failed to remove service", "error");
    }
  };

  const handleToggle = async (service) => {
    try {
      await patientServicesApi.toggleStatus(service.id);
      notify(`Service ${service.isActive ? "disabled" : "enabled"}`, "success");
      load();
    } catch {
      notify("Failed to update service status", "error");
    }
  };

  const filtered = services.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      TYPE_LABEL[s.type]?.toLowerCase().includes(q) ||
      (s.mealTime ?? "").toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Patient Services</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-800/30">
            {services.length} total
          </span>
        </div>
        <button className="btn-primary" onClick={() => { setEditService(null); setShowModal(true); }}>
          + Add Service
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or type…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 transition-all shadow-sm"
        />
      </div>

      {/* Table card */}
      <div className="flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]">
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Service</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Meal Time</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Price</th>
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
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading services…</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center">
                        <ConciergeBell className="w-8 h-8 text-slate-200 dark:text-slate-800" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {search ? "No services match your search." : "No patient services configured yet."}
                      </p>
                      {!search && (
                        <button className="btn-primary text-sm" onClick={() => { setEditService(null); setShowModal(true); }}>
                          + Add First Service
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((s) => (
                  <tr
                    key={s.id}
                    className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all cursor-pointer"
                    onClick={() => { setEditService(s); setShowModal(true); }}
                  >
                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center shrink-0">
                          <ConciergeBell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <p className="font-semibold text-[15px] text-slate-900 dark:text-white leading-tight">{s.name}</p>
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${TYPE_BADGE[s.type] ?? TYPE_BADGE.CUSTOM}`}>
                        {TYPE_LABEL[s.type] ?? s.type}
                      </span>
                    </td>

                    {/* Meal time */}
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {mealTimeLabel(s.mealTime)}
                    </td>

                    {/* Price */}
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-[#cccccc]">
                      {priceLabel(s)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${s.isActive
                        ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30"
                        : "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/30"
                        }`}>
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions menu */}
                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === s.id ? null : s.id); }}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {openMenuId === s.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div
                            className="absolute right-6 top-14 w-48 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl border border-slate-100 dark:border-[#252525] z-20 py-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => { setOpenMenuId(null); setEditService(s); setShowModal(true); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#252525] transition-all"
                            >
                              <Pencil className="w-4 h-4" /> Edit Service
                            </button>
                            <button
                              onClick={() => { setOpenMenuId(null); handleToggle(s); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#252525] transition-all"
                            >
                              {s.isActive
                                ? <><ToggleLeft className="w-4 h-4 text-amber-500" /> Disable</>
                                : <><ToggleRight className="w-4 h-4 text-emerald-500" /> Enable</>
                              }
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-[#252525] my-1" />
                            <button
                              onClick={() => { setOpenMenuId(null); handleDelete(s); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                            >
                              <Trash2 className="w-4 h-4" /> Remove
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

        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-[#1a1a1a]">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <PatientServiceFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditService(null); }}
        service={editService}
        hospitalId={user?.hospitalId}
        onSuccess={load}
      />
    </div>
  );
}
