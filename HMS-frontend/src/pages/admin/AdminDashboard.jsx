import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { staffApi, patientApi, doctorsApi } from "@/utils/api";
import { Building2, Stethoscope, Users, CheckCircle, Loader2, ChevronRight, Plus } from "lucide-react";
function StatCard({ label, value, icon, iconBg }) {
  return <div className="bg-white dark:bg-[#1a1a1a] p-5 flex items-center gap-4
            border border-slate-200 dark:border-[#2a2a2a] rounded-lg"><div className={`w-12 h-12 flex items-center justify-center rounded-lg ${iconBg}`}>{icon}</div><div><p className="text-2xl font-bold text-slate-800 dark:text-[#f0f0f0]">{value}</p><p className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-[#666666]">{label}</p></div></div>;
}
function AdminDashboard() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.hospitalId) return;
    Promise.all([
      staffApi.list(user.hospitalId),
      doctorsApi.list(user.hospitalId),
      patientApi.list(user.hospitalId)
    ]).then(([s, d, p]) => {
      setStaff(s.filter((u) => u.role !== "DOCTOR" && u.role !== "SUPER_ADMIN"));
      setDoctors(d);
      setPatients(p);
    }).catch(() => notify("Failed to load dashboard data", "error")).finally(() => setLoading(false));
  }, [user?.hospitalId]);
  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin w-8 h-8 text-[#444444]" /></div>;
  return <div className="space-y-6">{
    /* Page title */
  }<div><h1 className="text-2xl font-bold text-slate-900 dark:text-[#f0f0f0]">Admin Dashboard</h1><p className="text-sm text-slate-500 dark:text-[#666666] mt-0.5">{user?.hospitalName}</p></div>{
    /* Stats */
  }<div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><StatCard
    label="Total Patients"
    value={patients.length}
    icon={<Building2 className="w-5 h-5 text-blue-500" />}
    iconBg="bg-blue-50 dark:bg-blue-500/10"
  /><StatCard
    label="Doctors"
    value={doctors.length}
    icon={<Stethoscope className="w-5 h-5 text-emerald-500" />}
    iconBg="bg-emerald-50 dark:bg-emerald-500/10"
  /><StatCard
    label="Staff Members"
    value={staff.length}
    icon={<Users className="w-5 h-5 text-violet-500" />}
    iconBg="bg-violet-50 dark:bg-violet-500/10"
  /><StatCard
    label="Active Users"
    value={staff.filter((s) => s.isActive).length}
    icon={<CheckCircle className="w-5 h-5 text-amber-500" />}
    iconBg="bg-amber-50 dark:bg-amber-500/10"
  /></div>{
    /* Quick actions */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg p-5"><h2 className="font-semibold text-slate-700 dark:text-[#cccccc] text-sm mb-4">Quick Actions</h2><div className="flex flex-wrap gap-3"><button className="btn-primary" onClick={() => navigate("/doctors")}><Plus className="w-4 h-4" /> Add Doctor
                    </button><button className="btn-secondary" onClick={() => navigate("/staffs")}>
                        Manage Staff
                    </button><button className="btn-secondary" onClick={() => navigate("/patients")}>
                        View All Patients
                    </button></div></div>{
    /* Recent staff */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg overflow-hidden"><div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center justify-between"><h2 className="font-semibold text-slate-700 dark:text-[#cccccc] text-sm">Staff Members</h2><button
    className="text-xs text-slate-900 hover:text-black dark:text-[#aaaaaa] dark:hover:text-white font-semibold flex items-center gap-1"
    onClick={() => navigate("/staffs")}
  >
                        Manage <ChevronRight className="w-3 h-3" /></button></div><div className="divide-y divide-slate-100 dark:divide-[#1e1e1e]">{staff.slice(0, 5).map((s) => <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#161616] transition-colors"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#333333] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-[#aaaaaa]">{s.firstName?.[0]}{s.lastName?.[0]}</div><div><p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">{s.firstName} {s.lastName}</p><p className="text-xs text-slate-400 dark:text-[#555555]">{s.email}</p></div></div><span className={`text-xs px-2.5 py-1 rounded-full font-medium
                                ${s.role === "DOCTOR" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "bg-slate-100 text-slate-600 dark:bg-[#2a2a2a] dark:text-[#888888]"}`}>{s.roleDisplay}</span></div>)}{staff.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 dark:text-[#555555] text-center">
                            No staff yet — <button className="text-slate-900 dark:text-white font-semibold hover:underline" onClick={() => navigate("/staffs")}>add someone</button></p>}</div></div></div>;
}
export {
  AdminDashboard as default
};
