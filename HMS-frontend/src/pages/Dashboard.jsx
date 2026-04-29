import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import { patientApi, appointmentsApi, doctorsApi } from "@/utils/api";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Users, Calendar, ReceiptText, ChevronRight, Phone,
  Droplets, Activity, Clock, UserPlus, Loader2,
  CheckCircle2, XCircle, AlertCircle, TrendingUp, ArrowRight
} from "lucide-react";
import { format, subDays, parseISO, isToday as fnsIsToday, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

// ── Helpers ────────────────────────────────────────────────────────────────

function calcAge(dob) {
  if (!dob) return "—";
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1e3))}y`;
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

function buildLast14Days(items, dateField) {
  const counts = {};
  for (let i = 13; i >= 0; i--) {
    counts[format(subDays(new Date(), i), "MMM d")] = 0;
  }
  items.forEach((item) => {
    const key = format(parseISO(item[dateField]), "MMM d");
    if (key in counts) counts[key]++;
  });
  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

function buildWeekAppts(appts) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = {};
  days.forEach((d) => (counts[d] = { day: d, count: 0 }));
  const start = startOfWeek(new Date());
  const end = endOfWeek(new Date());
  appts.forEach((a) => {
    const d = parseISO(a.scheduledAt ?? a.appointmentDate ?? a.createdAt);
    if (isWithinInterval(d, { start, end })) {
      const key = days[d.getDay()];
      if (counts[key]) counts[key].count++;
    }
  });
  return Object.values(counts);
}

const BLOOD_COLORS = {
  "A+": "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  "A-": "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  "B+": "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
  "B-": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  "O+": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  "O-": "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  "AB+": "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
  "AB-": "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
};

const STATUS_META = {
  SCHEDULED: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10", label: "Scheduled" },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", label: "Completed" },
  CANCELLED: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10", label: "Cancelled" },
  NO_SHOW: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", label: "No Show" },
};

const PIE_COLORS = { SCHEDULED: "#6366f1", COMPLETED: "#10b981", CANCELLED: "#f43f5e", NO_SHOW: "#f59e0b" };

const TOOLTIP_CLS = "bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl px-4 py-3 text-xs";

// ── Sub-components ─────────────────────────────────────────────────────────

function StatPill({ label, value, icon, accent }) {
  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
        <p className="text-xs font-semibold text-slate-500 dark:text-[#666] uppercase tracking-wide mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, action, actionLabel, actionFn }) {
  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-sm">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 dark:text-[#555] mt-0.5">{subtitle}</p>}
        </div>
        {actionFn && (
          <button
            onClick={actionFn}
            className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-white dark:text-slate-300 hover:underline"
          >
            {actionLabel} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function AppointmentStatusRow({ status, count, total }) {
  const meta = STATUS_META[status] ?? { icon: Clock, color: "text-slate-400", bg: "bg-slate-100 dark:bg-[#1e1e1e]", label: status };
  const Icon = meta.icon;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-700 dark:text-[#ccc]">{meta.label}</span>
          <span className="text-xs font-bold text-slate-800 dark:text-[#ddd]">{count}</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-[#222] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: PIE_COLORS[status] ?? "#94a3b8" }}
          />
        </div>
      </div>
      <span className="text-[10px] text-slate-400 dark:text-[#555] w-7 text-right">{pct}%</span>
    </div>
  );
}

function PatientRowCard({ p }) {
  const navigate = useNavigate();
  const blood = p.bloodGroup ?? "N/A";
  const bloodCls = BLOOD_COLORS[blood] ?? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#1e1e1e] dark:text-[#888] dark:border-[#2a2a2a]";
  return (
    <tr
      className="hover:bg-slate-50 dark:hover:bg-[#161616] cursor-pointer transition-colors border-b border-slate-100 dark:border-[#1a1a1a] last:border-0"
      onClick={() => navigate(`/patients/${p.id}`)}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#222] dark:to-[#2a2a2a] border border-slate-200 dark:border-[#333] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-[#aaa] shrink-0">
            {p.firstName[0]}{p.lastName?.[0] ?? ""}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-[#e5e5e5]">{p.firstName} {p.lastName}</p>
            <p className="text-xs text-slate-400 dark:text-[#555]">{p.mrn}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-[#777]">{calcAge(p.dob)} · {p.gender ?? "—"}</td>
      <td className="px-5 py-3.5">
        {p.phone ? (
          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-[#666]">
            <Phone className="w-3 h-3" />{p.phone}
          </span>
        ) : (
          <span className="text-xs text-slate-300 dark:text-[#444]">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full ${bloodCls}`}>
          <Droplets className="inline w-2.5 h-2.5 mr-0.5" />{blood}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-[#555] justify-end">
          <Clock className="w-3 h-3" />{timeAgo(p.createdAt)}
        </span>
      </td>
    </tr>
  );
}

// ── Doctor / Staff Dashboard ────────────────────────────────────────────────

function DoctorStaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const isDoctor = user?.role === "doctor";
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    if (!user?.hospitalId) return;
    const fetches = [patientApi.list(user.hospitalId)];
    if (isDoctor) {
      fetches.push(
        doctorsApi.getByUserId(user.id).then((doc) =>
          appointmentsApi.getByDoctor(doc.id)
        ).catch(() => [])
      );
    } else {
      fetches.push(appointmentsApi.getByHospital(user.hospitalId).catch(() => []));
    }
    Promise.all(fetches)
      .then(([p, a]) => {
        setPatients(p);
        setAppointments(Array.isArray(a) ? a : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.hospitalId, user?.id, isDoctor]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const todayPatients = useMemo(
    () => patients.filter((p) => fnsIsToday(parseISO(p.createdAt)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [patients]
  );

  const patientTrend = useMemo(() => buildLast14Days(patients, "createdAt"), [patients]);
  const weekAppts = useMemo(() => buildWeekAppts(appointments), [appointments]);

  const apptStatusCounts = useMemo(() => {
    const counts = {};
    appointments.forEach((a) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return counts;
  }, [appointments]);

  const todayAppts = useMemo(
    () => appointments.filter((a) => {
      const d = a.scheduledAt ?? a.appointmentDate ?? a.createdAt;
      return d && fnsIsToday(parseISO(d));
    }),
    [appointments]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
      </div>
    );
  }

  const totalAppts = appointments.length;

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}, {isDoctor ? "Dr." : ""} {user?.firstName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#666] mt-1">
            {user?.hospitalName} · {dateStr}
          </p>
        </div>
        <button onClick={() => navigate("/patients")} className="btn-primary hidden sm:flex">
          <UserPlus className="w-4 h-4" /> Register Patient
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatPill
          label="Total Patients"
          value={patients.length}
          icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          accent="bg-blue-50 dark:bg-blue-500/10"
        />
        <StatPill
          label="New Today"
          value={todayPatients.length}
          icon={<UserPlus className="w-5 h-5 text-slate-900 dark:text-white dark:text-slate-300" />}
          accent="bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10"
        />
        <StatPill
          label={isDoctor ? "My Appointments" : "Appointments"}
          value={totalAppts}
          icon={<Calendar className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
          accent="bg-violet-50 dark:bg-violet-500/10"
        />
        <StatPill
          label="Today's Schedule"
          value={todayAppts.length}
          icon={<Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          accent="bg-amber-50 dark:bg-amber-500/10"
        />
      </div>

      {/* ── Row 2: Patient trend sparkline + weekly appointment bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 14-day patient sparkline */}
        <SectionCard
          title="Patient Activity"
          subtitle="New registrations — last 14 days"
          actionLabel="All patients"
          actionFn={() => navigate("/patients")}
        >
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={patientTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className={TOOLTIP_CLS}>
                      <p className="font-bold text-slate-700 dark:text-[#ccc] mb-1">{label}</p>
                      <p className="text-indigo-500">{payload[0].value} patients</p>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#actGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* This week's appointments */}
        <SectionCard
          title={isDoctor ? "My Appointments This Week" : "Hospital Appointments This Week"}
          subtitle="Daily count — current week"
          actionLabel="View all"
          actionFn={() => navigate("/appointments")}
        >
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekAppts} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className={TOOLTIP_CLS}>
                      <p className="font-bold text-slate-700 dark:text-[#ccc] mb-1">{label}</p>
                      <p className="text-slate-900 dark:text-white">{payload[0].value} appointments</p>
                    </div>
                  ) : null
                }
                cursor={{ fill: "rgba(148,163,184,0.05)" }}
              />
              <Bar
                dataKey="count"
                radius={[5, 5, 0, 0]}
                maxBarSize={32}
                fill="#0f172a"
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* ── Row 3: Appointment status + today's patients table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Appointment status breakdown */}
        <SectionCard
          title="Appointment Status"
          subtitle="All-time breakdown"
          actionLabel="Appointments"
          actionFn={() => navigate("/appointments")}
        >
          {totalAppts > 0 ? (
            <div className="space-y-3">
              {Object.entries(apptStatusCounts).map(([status, count]) => (
                <AppointmentStatusRow key={status} status={status} count={count} total={totalAppts} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-300 dark:text-[#333]">
              <Calendar className="w-8 h-8" />
              <p className="text-xs text-slate-400 dark:text-[#555]">No appointments yet</p>
            </div>
          )}
          {totalAppts > 0 && (
            <div className="mt-1 pt-4 border-t border-slate-100 dark:border-[#1a1a1a]">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#555]">
                <span>Total appointments</span>
                <span className="font-bold text-slate-800 dark:text-[#ddd]">{totalAppts}</span>
              </div>
              {apptStatusCounts.COMPLETED > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#555] mt-1">
                  <span>Completion rate</span>
                  <span className="font-bold text-slate-900 dark:text-white dark:text-slate-300">
                    {((apptStatusCounts.COMPLETED / totalAppts) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Today's patients */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" />
              <p className="font-bold text-slate-900 dark:text-white text-sm">New Patients Today</p>
              {todayPatients.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full border border-blue-100 dark:border-blue-500/20">
                  {todayPatients.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate("/patients")}
              className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-white dark:text-slate-300 hover:underline"
            >
              All patients <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {todayPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3">
              <div className="w-14 h-14 rounded-lg bg-slate-50 dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#222] flex items-center justify-center">
                <UserPlus className="w-7 h-7 text-slate-200 dark:text-[#333]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-500 dark:text-[#555]">No new patients today</p>
                <p className="text-xs text-slate-400 dark:text-[#444] mt-0.5">New registrations will appear here</p>
              </div>
              <button onClick={() => navigate("/patients")} className="btn-primary text-xs mt-1">
                Register Patient
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0f0f0f] border-b border-slate-100 dark:border-[#1a1a1a]">
                    {["Patient", "Age / Gender", "Phone", "Blood", "Registered"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-[#555] uppercase tracking-widest last:text-right">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayPatients.slice(0, 8).map((p) => (
                    <PatientRowCard key={p.id} p={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Patients", sub: "Register or find a patient", to: "/patients", icon: <Users className="w-5 h-5" />, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10" },
          ...(isDoctor ? [{ label: "My Appointments", sub: "View your schedule", to: "/appointments", icon: <Calendar className="w-5 h-5" />, color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10" }] : []),
          { label: "Create Invoice", sub: "Generate a patient bill", to: "/billing", icon: <ReceiptText className="w-5 h-5" />, color: "text-slate-900 dark:text-white dark:text-slate-300 bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10" },
        ].map((item) => (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className="group flex items-center gap-4 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-5 text-left hover:border-slate-300 dark:hover:border-[#2a2a2a] hover:shadow-md transition-all"
          >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-[#e5e5e5] text-sm">{item.label}</p>
              <p className="text-xs text-slate-400 dark:text-[#555] mt-0.5">{item.sub}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-[#333] group-hover:text-slate-500 dark:group-hover:text-[#666] group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>

    </div>
  );
}

// ── Router ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "hospital_admin" || user?.role === "super_admin") return <AdminDashboard />;
  return <DoctorStaffDashboard />;
}
