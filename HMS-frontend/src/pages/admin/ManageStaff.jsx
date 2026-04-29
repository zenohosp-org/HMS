import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { staffApi } from "@/utils/api";
import StaffModal from "@/components/modals/StaffModal";
function ManageStaff() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const load = () => {
    if (!user?.hospitalId) return;
    staffApi.list(user.hospitalId).then(setStaff).catch(() => notify("Failed to load staff", "error")).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [user?.hospitalId]);
  const handleCreate = async (data) => {
    await staffApi.create({ ...data, hospitalId: user.hospitalId });
    notify("Account created successfully", "success");
    setShowModal(false);
    load();
  };
  const handleDeactivate = async (id) => {
    if (!confirm("Deactivate this account?")) return;
    await staffApi.deactivate(id);
    notify("Account deactivated", "info");
    load();
  };
  const handleActivate = async (id) => {
    if (!confirm("Activate this account?")) return;
    await staffApi.activate(id);
    notify("Account activated", "success");
    load();
  };
  const visible = staff.filter((s) => filter === "ALL" || s.role === filter);
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Manage Staff</h1><p className="text-sm text-slate-500 dark:text-[#666666]">{staff.length} total accounts</p></div><button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Doctor / Staff</button></div>{
    /* Filter tabs */
  }<div className="flex gap-2 mb-4">{["ALL", "DOCTOR", "STAFF"].map((f) => <button
    key={f}
    onClick={() => setFilter(f)}
    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all 
              ${filter === f ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-md" : "bg-white text-slate-500 border border-slate-200 dark:bg-[#111111] dark:border-[#222222] hover:bg-slate-50 dark:hover:bg-[#1a1a1a]"}`}
  >{f === "ALL" ? "All" : f === "DOCTOR" ? "Doctors" : "Staff"}</button>)}</div>{
    /* Table layout converted to separated rows */
  }<div className="space-y-3">{loading ? <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center"><p className="text-slate-500 dark:text-[#666666]">Loading…</p></div> : visible.length === 0 ? <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center"><p className="text-slate-500 dark:text-[#666666]">No accounts found.</p></div> : visible.map((s) => {
    const initials = `${s.firstName[0]}${s.lastName?.[0] ?? ""}`.toUpperCase();
    return <div
      key={s.id}
      className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-4 
                                flex items-center justify-between hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors"
    ><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2a2a2a] 
                                        flex items-center justify-center text-sm font-bold text-slate-700 dark:text-[#cccccc] shrink-0">{initials}</div><div><div className="flex items-center gap-2"><p
      className={`text-sm font-bold leading-tight ${s.role === "DOCTOR" ? "text-blue-600 hover:text-blue-800 cursor-pointer underline-offset-2 hover:underline" : "text-slate-900 dark:text-white"}`}
      onClick={() => s.role === "DOCTOR" && navigate(`/staff/${s.id}`)}
    >{s.firstName} {s.lastName}</p>{!s.isActive && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                                                    Inactive
                                                </span>}</div><p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{s.email}</p></div></div><div className="flex items-center gap-4"><div className="text-right hidden sm:block mr-4"><p className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">{s.roleDisplay}</p>{s.specialization && <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{s.specialization}</p>}</div>{s.isActive ? <button
      onClick={() => handleDeactivate(s.id)}
      className="btn-secondary text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
    >
                                            Deactivate
                                        </button> : <button
      onClick={() => handleActivate(s.id)}
      className="btn-secondary text-slate-900 dark:text-white hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-[#1e1e1e] dark:text-slate-300 dark:hover:bg-slate-500/10 border-emerald-200 dark:border-slate-900 dark:border-white/20"
    >
                                            Activate
                                        </button>}</div></div>;
  })}</div>{showModal && <StaffModal onClose={() => setShowModal(false)} onSave={handleCreate} />}</div>;
}
export {
  ManageStaff as default
};
