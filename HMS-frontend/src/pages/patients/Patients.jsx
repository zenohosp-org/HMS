import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { patientApi } from "@/utils/api";
import PatientModal from "@/components/modals/PatientModal";
import Pagination from "@/components/ui/Pagination";
import { calcAge, formatDate } from "@/utils/validators";
import { Search, Loader2, Users } from "lucide-react";
const PAGE_SIZE = 8;
function Patients() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, patient: null });
  const load = () => {
    if (!user?.hospitalId) return;
    patientApi.list(user.hospitalId).then(setPatients).catch(() => notify("Failed to load patients", "error")).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [user?.hospitalId]);
  useEffect(() => {
    if (location.state?.openRegistration) {
      setModal({ open: true, patient: null });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);
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
  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return p.firstName.toLowerCase().includes(q) || p.lastName.toLowerCase().includes(q) || p.mrn.toLowerCase().includes(q) || (p.phone ?? "").includes(q);
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <div className="flex flex-col h-full bg-white dark:bg-[#050505] gap-6">{
    /* Header */
  }<div className="flex items-center justify-between"><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Patients</h1><span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-500/20">{patients.length} registered
  </span></div><button className="btn-primary" onClick={() => setModal({ open: true, patient: null })}>
        + Register Patient
      </button></div>{
      /* Search */
    }<div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" /><input
      type="text"
      placeholder="Search by name, MRN or phone…"
      value={search}
      onChange={(e) => {
        setSearch(e.target.value);
        setPage(1);
      }}
      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 focus:border-slate-400 dark:focus:border-[#444444] transition-all shadow-sm"
    /></div>{
      /* Table card */
    }<div className="flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col"><div className="overflow-x-auto flex-1"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]"><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Patient</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Age / Gender</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Phone</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Registered</th><th className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Blood</th><th className="px-6 py-4" /></tr></thead><tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">{loading ? <tr><td colSpan={6} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" /><p className="text-sm font-medium text-slate-600">Loading patients…</p></div></td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center"><Users className="w-8 h-8 text-slate-200 dark:text-slate-800" /></div><p className="text-sm font-medium text-slate-600">{search ? "No patients match your search." : "No patients registered yet."}</p></div></td></tr> : paginated.map((p) => {
      const initials = `${p.firstName[0]}${p.lastName?.[0] ?? ""}`.toUpperCase();
      return <tr
        key={p.id}
        onClick={() => navigate(`/patients/${p.id}`)}
        className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all cursor-pointer"
      ><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-[#2a2a2a] flex items-center justify-center text-sm font-bold text-slate-700 dark:text-[#cccccc] shrink-0">{initials}</div><div><p className="font-bold text-[15px] text-slate-900 dark:text-white leading-tight">{p.firstName} {p.lastName}</p><p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{p.mrn}</p></div></div></td><td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{calcAge(p.dob)}y &nbsp;·&nbsp; {p.gender}</td><td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{p.phone ?? <span className="text-slate-500 dark:text-slate-700">—</span>}</td><td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{formatDate(p.createdAt)}</td><td className="px-6 py-4">{p.bloodGroup ? <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 text-xs font-bold">{p.bloodGroup}</span> : <span className="text-slate-500 dark:text-slate-700">—</span>}</td><td className="px-6 py-4 text-right"><button
        className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          setModal({ open: true, patient: p });
        }}
        title="Edit Patient"
      ><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg></button></td></tr>;
    })}</tbody></table></div>{!loading && filtered.length > 0 && <div className="px-6 py-3 border-t border-slate-100 dark:border-[#1a1a1a]"><Pagination
      currentPage={page}
      totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
      totalItems={filtered.length}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
    /></div>}</div>{modal.open && <PatientModal
      patient={modal.patient}
      onClose={() => setModal({ open: false, patient: null })}
      onSave={handleSave}
    />}</div>;
}
export {
  Patients as default
};
