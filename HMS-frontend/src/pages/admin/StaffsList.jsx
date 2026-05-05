import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { staffApi, doctorsApi } from "@/utils/api";
import StaffFormModal from "@/components/modals/StaffFormModal";
import {
  Search,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Users,
  Stethoscope,
  ShieldCheck,
  User,
  MoreVertical
} from "lucide-react";
const ROLE_TABS = [
  { key: "all", label: "All" },
  { key: "doctor", label: "Doctors" },
  { key: "admin", label: "Admin" },
  { key: "staff", label: "Staff" }
];
const AVATAR_CLS = {
  doctor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  hospital_admin: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  staff: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20"
};
const ROLE_BADGE = {
  doctor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  hospital_admin: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  staff: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20"
};
function getAvatarCls(role) {
  return AVATAR_CLS[role] ?? AVATAR_CLS.staff;
}
function getRoleBadgeCls(role) {
  return ROLE_BADGE[role] ?? ROLE_BADGE.staff;
}
function getRoleIcon(role) {
  if (role === "doctor") return Stethoscope;
  if (role === "hospital_admin") return ShieldCheck;
  return User;
}
function toMemberCard(u) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    roleDisplay: u.roleDisplay,
    email: u.email,
    phone: u.phone,
    employeeCode: u.employeeCode,
    designation: u.designationName || u.designation,
    designationId: u.designationId,
    departmentId: u.departmentId,
    departmentName: u.departmentName,
    departmentType: u.departmentType,
    dateOfJoining: u.dateOfJoining,
    isActive: u.isActive
  };
}
function doctorToMemberCard(d) {
  return {
    id: d.userId,
    firstName: d.firstName,
    lastName: d.lastName,
    role: "doctor",
    roleDisplay: "Doctor",
    email: d.email,
    phone: d.phone,
    isActive: d.userIsActive,
    consultationFee: d.consultationFee,
    specialization: d.specialization
  };
}
function StaffsList() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState(void 0);
  const [openMenu, setOpenMenu] = useState(null);
  const load = async () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      const [allUsers, doctors] = await Promise.all([
        staffApi.list(user.hospitalId),
        doctorsApi.list(user.hospitalId)
      ]);
      const doctorUserIds = new Set(doctors.map((d) => d.userId));
      const nonDoctors = allUsers.filter((u) => !doctorUserIds.has(u.id) && u.role !== "super_admin");
      const doctorCards = doctors.map(doctorToMemberCard);
      const staffCards = nonDoctors.map(toMemberCard);
      setMembers([...doctorCards, ...staffCards]);
    } catch {
      notify("Failed to load directory", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [user?.hospitalId]);
  const filtered = useMemo(() => {
    let list = members;
    if (roleFilter === "doctor") list = list.filter((m) => m.role === "doctor");
    else if (roleFilter === "admin") list = list.filter((m) => m.role === "hospital_admin");
    else if (roleFilter === "staff") list = list.filter((m) => m.role !== "doctor" && m.role !== "hospital_admin");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.employeeCode?.toLowerCase().includes(q) || m.designation?.toLowerCase().includes(q) || m.specialization?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, roleFilter, search]);
  const stats = useMemo(() => ({
    total: members.length,
    active: members.filter((m) => m.isActive).length,
    doctors: members.filter((m) => m.role === "doctor").length,
    admins: members.filter((m) => m.role === "hospital_admin").length
  }), [members]);
  const handleDeactivate = async (id) => {
    if (!confirm("Deactivate this account? They will lose system access.")) return;
    try {
      await staffApi.deactivate(id);
      notify("Account deactivated", "info");
      load();
    } catch {
      notify("Action failed", "error");
    }
    setOpenMenu(null);
  };
  const handleActivate = async (id) => {
    try {
      await staffApi.activate(id);
      notify("Account activated", "success");
      load();
    } catch {
      notify("Action failed", "error");
    }
    setOpenMenu(null);
  };
  return <div className="space-y-6" onClick={() => setOpenMenu(null)}>{
    /* Header */
  }<div className="flex items-start justify-between gap-4"><div><h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Staff Directory</h1><p className="text-sm text-slate-500 dark:text-[#666666] mt-0.5">{stats.total} members · {stats.active} active
  </p></div><button
    className="btn-primary flex items-center gap-2 shrink-0"
    onClick={() => {
      setEditStaff(void 0);
      setShowModal(true);
    }}
  ><UserPlus className="w-4 h-4" /> Add Member
      </button></div>{
      /* Stat cards */
    }<div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[
      { label: "Total Staff", value: stats.total, icon: Users, cls: "text-slate-600 dark:text-[#888888]" },
      { label: "Active", value: stats.active, icon: UserPlus, cls: "text-slate-900 dark:text-white dark:text-slate-500" },
      { label: "Doctors", value: stats.doctors, icon: Stethoscope, cls: "text-blue-600 dark:text-blue-400" },
      { label: "Admin", value: stats.admins, icon: ShieldCheck, cls: "text-rose-600 dark:text-rose-400" }
    ].map(({ label, value, icon: Icon, cls }) => <div key={label} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4"><div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-slate-600 dark:text-[#666666] uppercase tracking-wider">{label}</p><Icon className={`w-4 h-4 ${cls}`} /></div><p className={`text-2xl font-bold ${cls}`}>{value}</p></div>)}</div>{
      /* Search + filter row */
    }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4 flex flex-col sm:flex-row gap-3">
      <div className="flex gap-1.5">
        {ROLE_TABS.map((tab) =>
          <button
            key={tab.key}
            onClick={() => setRoleFilter(tab.key)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                                ${roleFilter === tab.key ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "text-slate-500 dark:text-[#888888] hover:bg-slate-100 dark:hover:bg-[#1a1a1a]"}`}
          >{tab.label}</button>)}
      </div>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#2a2a2a]
                            bg-slate-50 dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#cccccc]
                            focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-[#444444] dark:ring-white/50"
          placeholder="Search by name, email, code, designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
    </div>{
      /* Cards grid */
    }{loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-5 animate-pulse"><div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#222222]" /><div className="flex-1 space-y-2"><div className="h-3 bg-slate-100 dark:bg-[#222222] rounded w-3/4" /><div className="h-2.5 bg-slate-100 dark:bg-[#222222] rounded w-1/2" /></div></div></div>)}</div> : filtered.length === 0 ? <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-12 text-center"><Users className="w-10 h-10 text-slate-500 dark:text-[#777777] mx-auto mb-3" /><p className="text-sm text-slate-500 dark:text-[#666666]">No members found</p>{search && <p className="text-xs text-slate-600 dark:text-[#999999] mt-1">Try clearing your search</p>}</div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{filtered.map((m) => {
      const initials = `${m.firstName[0]}${m.lastName?.[0] ?? ""}`.toUpperCase();
      const RoleIcon = getRoleIcon(m.role);
      return <div
        key={m.id}
        className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-5 hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors relative flex flex-col gap-4"
      >{
          /* Top row: avatar + 3-dot */
        }<div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${getAvatarCls(m.role)}`}>{initials}</div><div className="min-w-0"><p className="text-sm font-bold text-slate-900 dark:text-[#eeeeee] leading-tight truncate">{m.firstName} {m.lastName}</p>{m.employeeCode && <p className="text-[10px] font-mono text-slate-600 dark:text-[#999999] mt-0.5">
          #{m.employeeCode}</p>}</div></div>{
            /* 3-dot menu */
          }<div className="relative" onClick={(e) => e.stopPropagation()}><button
            onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
          ><MoreVertical className="w-4 h-4" /></button>{openMenu === m.id && <div className="absolute right-0 top-7 z-20 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg shadow-lg py-1.5 w-40"><button
            onClick={() => {
              const su = members.find((x) => x.id === m.id);
              if (su) {
                setEditStaff({
                  id: m.id,
                  email: m.email,
                  firstName: m.firstName,
                  lastName: m.lastName,
                  role: m.role,
                  roleDisplay: m.roleDisplay,
                  isActive: m.isActive,
                  phone: m.phone,
                  employeeCode: m.employeeCode,
                  designation: m.designation,
                  dateOfJoining: m.dateOfJoining,
                  specialization: m.specialization ?? void 0,
                  department: null
                });
                setShowModal(true);
              }
              setOpenMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 text-sm text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors"
          >
            Edit
          </button>{m.isActive ? <button
            onClick={() => handleDeactivate(m.id)}
            className="w-full text-left px-3.5 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            Deactivate
          </button> : <button
            onClick={() => handleActivate(m.id)}
            className="w-full text-left px-3.5 py-2 text-sm text-slate-900 dark:text-white dark:text-slate-500 hover:bg-slate-100 dark:bg-[#1e1e1e] dark:hover:bg-slate-500/10 transition-colors"
          >
            Activate
          </button>}</div>}</div></div>{
          /* Badges */
        }<div className="flex flex-wrap gap-1.5"><span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${getRoleBadgeCls(m.role)}`}><RoleIcon className="w-2.5 h-2.5" />{m.roleDisplay}</span>{m.specialization && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-50 dark:bg-[#1a1a1a] text-slate-500 dark:text-[#888888] border-slate-200 dark:border-[#333333]">{m.specialization}</span>}{!m.isActive && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
          Inactive
        </span>}</div>{
          /* Details */
        }<div className="space-y-1.5 text-xs text-slate-500 dark:text-[#666666]">{m.designation && <p className="font-semibold text-slate-700 dark:text-[#aaaaaa] truncate">{m.designation}</p>}{m.departmentName && <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium truncate">{m.departmentName}</p>}<div className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{m.email}</span></div>{m.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" /><span>{m.phone}</span></div>}{m.dateOfJoining && <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3 shrink-0" /><span>Joined {m.dateOfJoining}</span></div>}{m.consultationFee != null && <p className="font-semibold text-slate-900 dark:text-white dark:text-slate-500">
          ₹{m.consultationFee.toLocaleString("en-IN")} / consult
        </p>}</div></div>;
    })}</div>}{showModal && <StaffFormModal
      editStaff={editStaff}
      onClose={() => setShowModal(false)}
      onSaved={() => {
        setShowModal(false);
        load();
      }}
    />}</div>;
}
export {
  StaffsList as default
};
