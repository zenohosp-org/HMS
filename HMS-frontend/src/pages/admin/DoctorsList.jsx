import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { doctorsApi, staffApi } from "@/utils/api";
import DoctorFormModal from "@/components/modals/DoctorFormModal";
import Pagination from "@/components/ui/Pagination";
import { MoreHorizontal, CheckCircle, XCircle, Trash2, Loader2, Stethoscope, Search } from "lucide-react";
const PAGE_SIZE = 8;
function DoctorsList() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [page, setPage] = useState(1);
  const load = () => {
    if (!user?.hospitalId) return;
    doctorsApi.list(user.hospitalId).then(setDoctors).catch(() => notify("Failed to load doctors", "error")).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [user?.hospitalId]);
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  const handleDelete = async (id) => {
    if (!confirm("Remove this doctor profile? The linked user account will remain intact.")) return;
    try {
      await doctorsApi.delete(id);
      notify("Doctor profile removed", "success");
      load();
    } catch {
      notify("Failed to remove doctor profile", "error");
    }
  };
  const handleDeactivate = async (id) => {
    if (!confirm("Deactivate this doctor account? They will lose system access.")) return;
    await staffApi.deactivate(id);
    notify("Account deactivated", "info");
    load();
  };
  const handleActivate = async (id) => {
    if (!confirm("Reactivate this doctor account?")) return;
    await staffApi.activate(id);
    notify("Account activated", "success");
    load();
  };
  const filtered = doctors.filter((d) => {
    const q = search.toLowerCase();
    return d.firstName.toLowerCase().includes(q) || (d.lastName ?? "").toLowerCase().includes(q) || (d.email ?? "").toLowerCase().includes(q) || (d.specialization ?? "").toLowerCase().includes(q);
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <div className="flex flex-col h-full bg-white dark:bg-[#050505] gap-6">{
    /* Header */
  }<div className="flex items-center justify-between"><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Doctors</h1><span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-800/30">{doctors.length} total
  </span></div><button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Doctor</button></div>{
      /* Search */
    }<div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input
      type="text"
      placeholder="Search by name, email or specialization…"
      value={search}
      onChange={(e) => {
        setSearch(e.target.value);
        setPage(1);
      }}
      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 focus:border-slate-400 dark:focus:border-[#444444] transition-all shadow-sm"
    /></div>{
      /* Table card */
    }<div className="flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col"><div className="overflow-x-auto flex-1"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]"><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Doctor</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Specialization</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contact</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th><th className="px-6 py-4" /></tr></thead><tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">{loading ? <tr><td colSpan={5} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" /><p className="text-sm font-medium text-slate-600">Loading doctors…</p></div></td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center"><Stethoscope className="w-8 h-8 text-slate-200 dark:text-slate-800" /></div><p className="text-sm font-medium text-slate-600">{search ? "No doctors match your search." : "No doctors linked to this hospital."}</p></div></td></tr> : paginated.map((d) => {
      const initials = `${d.firstName[0]}${d.lastName?.[0] ?? ""}`.toUpperCase();
      return <tr key={d.id} onClick={() => navigate(`/doctors/${d.id}`)} className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all cursor-pointer"><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-400 shrink-0">{initials}</div><div><p className="font-bold text-[15px] text-slate-900 dark:text-white leading-tight">Dr. {d.firstName} {d.lastName}</p><p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{d.qualification || "N/A"}</p></div></div></td><td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{d.specialization || "General"}</td><td className="px-6 py-4"><p className="text-sm text-slate-600 dark:text-slate-400">{d.email}</p><p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{d.phone}</p></td><td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${d.userIsActive ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30" : "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/30"}`}>{d.userIsActive ? "Active" : "Inactive"}</span></td><td className="px-6 py-4 text-right relative"><button
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(openMenuId === d.id ? null : d.id);
        }}
        className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
      ><MoreHorizontal className="w-5 h-5" /></button>{openMenuId === d.id && <><div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} /><div
        className="absolute right-6 top-14 w-48 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl border border-slate-100 dark:border-[#252525] z-20 py-1.5"
        onClick={(e) => e.stopPropagation()}
      >{d.userIsActive ? <button
        onClick={() => {
          setOpenMenuId(null);
          handleDeactivate(d.userId);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all"
      ><XCircle className="w-4 h-4" /> Deactivate Login
      </button> : <button
        onClick={() => {
          setOpenMenuId(null);
          handleActivate(d.userId);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all"
      ><CheckCircle className="w-4 h-4" /> Activate Login
      </button>}<div className="h-px bg-slate-50 dark:bg-[#252525] my-1" /><button
        onClick={() => {
          setOpenMenuId(null);
          handleDelete(d.id);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
      ><Trash2 className="w-4 h-4" /> Remove Profile
        </button></div></>}</td></tr>;
    })}</tbody></table></div>{!loading && filtered.length > 0 && <div className="px-6 py-3 border-t border-slate-100 dark:border-[#1a1a1a]"><Pagination
      currentPage={page}
      totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
      totalItems={filtered.length}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
    /></div>}</div>{showModal && <DoctorFormModal onClose={() => setShowModal(false)} onSaved={() => {
      setShowModal(false);
      load();
    }} />}</div>;
}
export {
  DoctorsList as default
};
