import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { doctorsApi, staffApi } from "@/utils/api";
import DoctorFormModal from "@/components/modals/DoctorFormModal";
import Pagination from "@/components/ui/Pagination";
import {
  MoreHorizontal, CheckCircle, XCircle, Trash2, Loader2,
  Stethoscope, Search, Pencil, AlertTriangle, X,
} from "lucide-react";

const PAGE_SIZE = 8;

function ConfirmRemoveDialog({ doctor, onConfirm, onCancel }) {
  if (!doctor) return null;
  const initials = `${doctor.firstName?.[0] ?? ""}${doctor.lastName?.[0] ?? ""}`.toUpperCase();
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Remove Doctor Profile</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                This unlinks the doctor from this hospital. The login account and all records remain intact.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0f0f0f] border border-slate-100 dark:border-[#1e1e1e]">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-400 shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                Dr. {doctor.firstName} {doctor.lastName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{doctor.specialization || "General"}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-[#2a2a2a] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-all"
            >
              Keep Profile
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-sm"
            >
              Remove Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoctorsList() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editDoctor, setEditDoctor] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [page, setPage] = useState(1);

  const load = () => {
    if (!user?.hospitalId) return;
    doctorsApi
      .list(user.hospitalId)
      .then(setDoctors)
      .catch(() => notify("Failed to load doctors", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user?.hospitalId]);

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleDelete = async () => {
    if (!confirmRemove) return;
    try {
      await doctorsApi.delete(confirmRemove.id);
      notify("Doctor profile removed", "success");
      load();
    } catch {
      notify("Failed to remove doctor profile", "error");
    } finally {
      setConfirmRemove(null);
    }
  };

  const handleDeactivate = async (userId) => {
    await staffApi.deactivate(userId);
    notify("Account deactivated", "info");
    load();
  };

  const handleActivate = async (userId) => {
    await staffApi.activate(userId);
    notify("Account activated", "success");
    load();
  };

  const filtered = doctors.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.firstName.toLowerCase().includes(q) ||
      (d.lastName ?? "").toLowerCase().includes(q) ||
      (d.email ?? "").toLowerCase().includes(q) ||
      (d.specialization ?? "").toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Doctors</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-800/30">
            {doctors.length} total
          </span>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Doctor
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email or specialization…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 focus:border-slate-400 dark:focus:border-[#444444] transition-all shadow-sm"
        />
      </div>

      {/* Table card */}
      <div className="flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]">
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Doctor</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Specialization</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
                      <p className="text-sm font-medium text-slate-600">Loading doctors…</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center">
                        <Stethoscope className="w-8 h-8 text-slate-200 dark:text-slate-800" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">
                        {search ? "No doctors match your search." : "No doctors linked to this hospital."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((d) => {
                  const initials = `${d.firstName[0]}${d.lastName?.[0] ?? ""}`.toUpperCase();
                  return (
                    <tr
                      key={d.id}
                      onClick={() => navigate(`/doctors/${d.id}`)}
                      className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-400 shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-[15px] text-slate-900 dark:text-white leading-tight">
                              Dr. {d.firstName} {d.lastName}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{d.qualification || "N/A"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {d.specialization || "General"}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">{d.email}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{d.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            d.userIsActive
                              ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30"
                              : "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/30"
                          }`}
                        >
                          {d.userIsActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === d.id ? null : d.id);
                          }}
                          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {openMenuId === d.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="absolute right-6 top-14 w-52 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-slate-100 dark:border-[#252525] z-20 py-1.5 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setEditDoctor(d);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222] transition-all"
                              >
                                <Pencil className="w-4 h-4" /> Edit Profile
                              </button>
                              <div className="h-px bg-slate-50 dark:bg-[#252525] my-1" />
                              {d.userIsActive ? (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleDeactivate(d.userId);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all"
                                >
                                  <XCircle className="w-4 h-4" /> Deactivate Login
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleActivate(d.userId);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all"
                                >
                                  <CheckCircle className="w-4 h-4" /> Activate Login
                                </button>
                              )}
                              <div className="h-px bg-slate-50 dark:bg-[#252525] my-1" />
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setConfirmRemove(d);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                              >
                                <Trash2 className="w-4 h-4" /> Remove Profile
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
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

      {showModal && (
        <DoctorFormModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            load();
          }}
        />
      )}

      {editDoctor && (
        <DoctorFormModal
          editDoctor={editDoctor}
          onClose={() => setEditDoctor(null)}
          onSaved={() => {
            setEditDoctor(null);
            load();
          }}
        />
      )}

      <ConfirmRemoveDialog
        doctor={confirmRemove}
        onConfirm={handleDelete}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}

export { DoctorsList as default };
