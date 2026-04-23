import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import { patientApi } from "@/utils/api";
import {
  Users,
  ReceiptText,
  UserPlus,
  ChevronRight,
  Calendar,
  Phone,
  Droplets,
  Activity,
  TrendingUp,
  Clock
} from "lucide-react";
function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = /* @__PURE__ */ new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function calcAge(dob) {
  if (!dob) return "\u2014";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1e3));
  return `${years}y`;
}
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 6e4);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}
const BLOOD_COLORS = {
  "A+": "bg-red-500/10 text-red-400 border-red-500/30",
  "A-": "bg-rose-500/10 text-rose-400 border-rose-500/30",
  "B+": "bg-orange-500/10 text-orange-400 border-orange-500/30",
  "B-": "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "O+": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "O-": "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  "AB+": "bg-violet-500/10 text-violet-400 border-violet-500/30",
  "AB-": "bg-purple-500/10 text-purple-400 border-purple-500/30"
};
const BLOOD_COLORS_LIGHT = {
  "A+": "bg-red-100 text-red-700 border-red-300",
  "A-": "bg-rose-100 text-rose-700 border-rose-300",
  "B+": "bg-orange-100 text-orange-700 border-orange-300",
  "B-": "bg-amber-100 text-amber-700 border-amber-300",
  "O+": "bg-blue-100 text-blue-700 border-blue-300",
  "O-": "bg-indigo-100 text-indigo-700 border-indigo-300",
  "AB+": "bg-violet-100 text-violet-700 border-violet-300",
  "AB-": "bg-purple-100 text-purple-700 border-purple-300"
};
function QuickLink({ icon, label, sub, href, color }) {
  return <a
    href={href}
    className="group flex items-center gap-4
                bg-white dark:bg-[#1a1a1a]
                border border-slate-200 dark:border-[#2a2a2a]
                shadow-sm hover:shadow-md
                hover:-translate-y-0.5 transition-all p-4 cursor-pointer rounded-lg"
  ><div className={`w-10 h-10 flex items-center justify-center rounded-lg ${color}`}>{icon}</div><div className="flex-1 min-w-0"><p className="font-semibold text-slate-800 dark:text-[#e5e5e5] text-sm">{label}</p><p className="text-xs text-slate-500 dark:text-[#666666] truncate mt-0.5">{sub}</p></div><ChevronRight className="w-4 h-4 text-slate-400 dark:text-[#444444] group-hover:translate-x-1 transition-transform" /></a>;
}
function StatBadge({ label, value, icon, lightColor, darkBg }) {
  return <div className={`flex items-center gap-3 p-4 rounded-lg border
            bg-white dark:${darkBg}
            border-slate-200 dark:border-[#2a2a2a]`}><div className={`w-10 h-10 flex items-center justify-center rounded-lg ${lightColor}`}>{icon}</div><div><p className="text-xs uppercase tracking-wider text-slate-500 dark:text-[#666666] font-semibold">{label}</p><p className="text-2xl font-bold text-slate-800 dark:text-[#e5e5e5]">{value}</p></div></div>;
}
function PatientRow({ p }) {
  const navigate = useNavigate();
  const blood = p.bloodGroup ?? "N/A";
  return <tr
    className="hover:bg-slate-50 dark:hover:bg-[#1e1e1e] cursor-pointer transition-colors border-b border-slate-100 dark:border-[#1e1e1e]"
    onClick={() => navigate(`/patients/${p.id}`)}
  ><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#333333] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-[#aaaaaa] shrink-0">{p.firstName[0]}{p.lastName?.[0] ?? ""}</div><div><p className="font-semibold text-slate-800 dark:text-[#e5e5e5] text-sm">{p.firstName} {p.lastName}</p><p className="text-xs text-slate-400 dark:text-[#555555]">{p.mrn}</p></div></div></td><td className="px-4 py-3 text-sm text-slate-600 dark:text-[#888888]">{calcAge(p.dob)} · {p.gender ?? "\u2014"}</td><td className="px-4 py-3">{p.phone ? <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-[#777777]"><Phone className="w-3 h-3" />{p.phone}</span> : <span className="text-xs text-slate-300 dark:text-[#444444]">—</span>}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 border text-xs font-semibold rounded
                    dark:${BLOOD_COLORS[blood] ?? "bg-[#2a2a2a] text-[#888888] border-[#333333]"}
                    ${BLOOD_COLORS_LIGHT[blood] ?? "bg-slate-100 text-slate-600 border-slate-300"}`}><Droplets className="inline w-3 h-3 mr-0.5" />{blood}</span></td><td className="px-4 py-3 text-xs text-slate-400 dark:text-[#555555] text-right"><span className="flex items-center gap-1 justify-end"><Clock className="w-3 h-3" />{timeAgo(p.createdAt)}</span></td></tr>;
}
function DoctorStaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = /* @__PURE__ */ new Date();
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  useEffect(() => {
    if (!user?.hospitalId) return;
    patientApi.list(user.hospitalId).then(setPatients).catch(console.error).finally(() => setLoading(false));
  }, [user?.hospitalId]);
  const todayPatients = useMemo(() => patients.filter((p) => isToday(p.createdAt)).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ), [patients]);
  const maleCount = todayPatients.filter((p) => p.gender?.toUpperCase() === "MALE").length;
  const femaleCount = todayPatients.filter((p) => p.gender?.toUpperCase() === "FEMALE").length;
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;
  const isDoctor = user?.role === "doctor";
  return <div className="space-y-6 w-full">{
    /* ── Header ── */
  }<div className="flex items-start justify-between"><div><h1 className="text-2xl font-bold text-slate-900 dark:text-[#f0f0f0]">
                        Dashboard
                    </h1><p className="text-sm text-slate-500 dark:text-[#666666] mt-0.5">
                        Welcome back, {isDoctor ? "Dr. " : ""}{user?.firstName}! Here's what's happening today.
                    </p></div><div className="text-right hidden sm:block"><p className="text-xs text-slate-400 dark:text-[#555555] uppercase tracking-wide font-semibold">Today</p><p className="text-sm text-slate-600 dark:text-[#888888] font-medium">{dateStr}</p></div></div>{
    /* ── Stats row ── */
  }<div className="grid grid-cols-2 sm:grid-cols-4 gap-4"><StatBadge
    label="New Today"
    value={loading ? "\u2026" : todayPatients.length}
    icon={<UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
    lightColor="bg-blue-50"
    darkBg="bg-[#1a1a1a]"
  /><StatBadge
    label="Total Patients"
    value={loading ? "\u2026" : patients.length}
    icon={<Users className="w-5 h-5 text-slate-500 dark:text-[#888888]" />}
    lightColor="bg-slate-100"
    darkBg="bg-[#1a1a1a]"
  /><StatBadge
    label="Male"
    value={loading ? "\u2026" : maleCount}
    icon={<Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
    lightColor="bg-indigo-50"
    darkBg="bg-[#1a1a1a]"
  /><StatBadge
    label="Female"
    value={loading ? "\u2026" : femaleCount}
    icon={<TrendingUp className="w-5 h-5 text-rose-500 dark:text-rose-400" />}
    lightColor="bg-rose-50"
    darkBg="bg-[#1a1a1a]"
  /></div>{
    /* ── Today's New Patients table ── */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg overflow-hidden"><div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#1e1e1e]"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-slate-800 dark:text-[#e5e5e5] text-sm">
                            New Patients Today
                        </h2>{!loading && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 text-xs font-semibold rounded-full border border-blue-500/20">{todayPatients.length}</span>}</div><a href="/patients" className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-semibold flex items-center gap-1">
                        All Patients <ChevronRight className="w-3 h-3" /></a></div>{loading ? <div className="py-10 text-center"><div className="inline-block w-6 h-6 border-2 border-[#2a2a2a] border-t-blue-500 rounded-full animate-spin" /><p className="text-xs text-slate-400 dark:text-[#555555] mt-2">Loading…</p></div> : todayPatients.length === 0 ? <div className="py-12 text-center"><UserPlus className="w-10 h-10 text-slate-200 dark:text-[#333333] mx-auto mb-3" /><p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No new patients registered today</p><p className="text-xs text-slate-400 dark:text-[#444444] mt-1">New registrations will appear here</p><a href="/patients" className="inline-block mt-4 btn-primary text-xs">Register Patient</a></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 dark:bg-[#161616] text-left"><th className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Patient</th><th className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Age / Gender</th><th className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Phone</th><th className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Blood</th><th className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-[#666666] uppercase tracking-wider text-right">Registered</th></tr></thead><tbody>{todayPatients.map((p) => <PatientRow key={p.id} p={p} />)}</tbody></table></div>}</div>{
    /* ── Quick actions ── */
  }<div><h2 className="text-xs font-semibold text-slate-500 dark:text-[#555555] uppercase tracking-wider mb-3">Quick Actions</h2><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><QuickLink
    href="/patients"
    icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
    label="Patients"
    sub="Register or search patients"
    color="bg-blue-50 dark:bg-blue-500/10"
  />{isDoctor && <button
    onClick={() => navigate("/appointments", { state: { filterMine: true } })}
    className="group flex items-center gap-4 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 cursor-pointer rounded-lg text-left"
  ><div className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10"><Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div><div className="flex-1 min-w-0"><p className="font-semibold text-slate-800 dark:text-[#e5e5e5] text-sm">My Appointments</p><p className="text-xs text-slate-500 dark:text-[#666666] truncate mt-0.5">View your scheduled patients</p></div><ChevronRight className="w-4 h-4 text-slate-400 dark:text-[#444444] group-hover:translate-x-1 transition-transform" /></button>}<QuickLink
    href="/billing"
    icon={<ReceiptText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
    label="Generate Invoice"
    sub="Create a printable patient bill"
    color="bg-emerald-50 dark:bg-emerald-500/10"
  /></div></div></div>;
}
function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "hospital_admin") return <AdminDashboard />;
  return <DoctorStaffDashboard />;
}
export {
  Dashboard as default
};
