import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { patientApi } from "@/utils/api";
import PatientModal from "@/components/modals/PatientModal";
import Pagination from "@/components/ui/Pagination";
import { calcAge, formatDate } from "@/utils/validators";
import { Search, Loader2, Users, MoreHorizontal, Pencil, ExternalLink } from "lucide-react";

const PAGE_SIZE = 30;

function Patients() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);                  // UI is 1-based
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [modal, setModal] = useState({ open: false, patient: null });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [patientTypeFilter, setPatientTypeFilter] = useState(null); // null = All

  const load = () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    patientApi.listPaginated(
      user.hospitalId,
      page - 1,            // backend is 0-based, UI is 1-based
      PAGE_SIZE,
      debouncedSearch,
      patientTypeFilter
    )
      .then((data) => {
        setPatients(data.patients);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);
      })
      .catch(() => notify("Failed to load patients", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);         // reset to first page on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    load();
  }, [user?.hospitalId, page, debouncedSearch, patientTypeFilter]);

  useEffect(() => {
    if (location.state?.openRegistration) {
      setModal({ open: true, patient: null });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleSave = async (data) => {
    if (modal.patient) {
      await patientApi.update(modal.patient.id, { ...data, hospitalId: user.hospitalId });
      notify("Patient updated", "success");
    } else {
      await patientApi.create({ ...data, hospitalId: user.hospitalId });
      notify("Patient registered", "success");
    }
    setModal({ open: false, patient: null });
    load();
  };

  // Client-side filtering and slicing deleted: handled on backend

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Patients</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-500/20">
            {totalElements}
          </span>
        </div>
        <button className="btn-primary" onClick={() => setModal({ open: true, patient: null })}>
          + Register Patient
        </button>
      </div>

      {/* Search + Type filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, UHID or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 focus:border-slate-400 dark:focus:border-[#444444] transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] shadow-sm shrink-0">
          {[
            { label: "All", value: null },
            { label: "Casualty", value: "CASUALTY" },
            { label: "Birth & Newborn", value: "NEWBORN" },
          ].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => { setPatientTypeFilter(value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                patientTypeFilter === value
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]">
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Patient</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Age / Gender</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Phone</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Registered</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Blood</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
                      <p className="text-sm font-medium text-slate-600">Loading patients…</p>
                    </div>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center">
                        <Users className="w-8 h-8 text-slate-200 dark:text-slate-800" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">
                        {search ? "No patients match your search." : "No patients registered yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const initials = `${p.firstName[0]}${p.lastName?.[0] ?? ""}`.toUpperCase();
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-[#2a2a2a] flex items-center justify-center text-sm font-bold text-slate-700 dark:text-[#cccccc] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-[15px] text-slate-900 dark:text-white leading-tight">
                                {p.firstName} {p.lastName}
                              </p>
                              {p.patientType === "CASUALTY" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
                                  Casualty
                                </span>
                              )}
                              {p.patientType === "NEWBORN" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-pink-50 text-pink-600 border border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20">
                                  Newborn
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{p.uhid}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {p.dob ? `${calcAge(p.dob)}y` : "—"} &nbsp;·&nbsp; {p.gender}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {p.phone ?? <span className="text-slate-400 dark:text-slate-700">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        {p.bloodGroup
                          ? <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 text-xs font-bold">{p.bloodGroup}</span>
                          : <span className="text-slate-400 dark:text-slate-700">—</span>
                        }
                      </td>
                      <td className="px-6 py-4 text-right relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === p.id ? null : p.id);
                          }}
                          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {openMenuId === p.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="absolute right-6 top-14 w-52 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-slate-100 dark:border-[#252525] z-20 py-1.5 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => { setOpenMenuId(null); setModal({ open: true, patient: p }); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222] transition-all"
                              >
                                <Pencil className="w-4 h-4" /> Edit Patient
                              </button>
                              <button
                                onClick={() => { setOpenMenuId(null); navigate(`/patients/${p.id}`); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222] transition-all"
                              >
                                <ExternalLink className="w-4 h-4" /> Patient Details
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

        {!loading && totalElements > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-[#1a1a1a]">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {modal.open && (
        <PatientModal
          patient={modal.patient}
          onClose={() => setModal({ open: false, patient: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export { Patients as default };
