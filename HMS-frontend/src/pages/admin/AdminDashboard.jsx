import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { staffApi, patientApi, doctorsApi, appointmentsApi, invoiceApi, admissionApi } from "@/utils/api";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Users, Stethoscope, Building2, BedDouble, TrendingUp,
  TrendingDown, ArrowRight, Calendar, ReceiptText, Activity,
  Loader2, Plus, UserCheck
} from "lucide-react";
import { format, subDays, parseISO, startOfMonth, isSameMonth } from "date-fns";

// ── Helpers ────────────────────────────────────────────────────────────────

function buildLast30Days(items, dateField) {
  const counts = {};
  for (let i = 29; i >= 0; i--) {
    const key = format(subDays(new Date(), i), "MMM d");
    counts[key] = 0;
  }
  items.forEach((item) => {
    const key = format(parseISO(item[dateField]), "MMM d");
    if (key in counts) counts[key]++;
  });
  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

function buildLast6Months(invoices) {
  const months = {};
  for (let i = 5; i >= 0; i--) {
    const d = subDays(new Date(), i * 30);
    const key = format(d, "MMM yy");
    months[key] = { month: key, paid: 0, unpaid: 0 };
  }
  invoices.forEach((inv) => {
    const key = format(parseISO(inv.createdAt), "MMM yy");
    if (key in months) {
      if (inv.status === "PAID") months[key].paid += Number(inv.total ?? 0);
      else months[key].unpaid += Number(inv.total ?? 0);
    }
  });
  return Object.values(months);
}

function buildAgeGroups(patients) {
  const groups = { "0–17": 0, "18–34": 0, "35–54": 0, "55–74": 0, "75+": 0 };
  patients.forEach((p) => {
    if (!p.dob) return;
    const age = Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1e3));
    if (age < 18) groups["0–17"]++;
    else if (age < 35) groups["18–34"]++;
    else if (age < 55) groups["35–54"]++;
    else if (age < 75) groups["55–74"]++;
    else groups["75+"]++;
  });
  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent, trend, trendLabel }) {
  const isUp = trend === "up";
  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-start">
          {icon}
        </div>
        {trendLabel && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full
            ${isUp
              ? "bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10 text-slate-900 dark:text-white dark:text-slate-300"
              : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendLabel}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-[#666]">{label}</p>
        <p className="text-4xl font-semibold text-slate-900 dark:text-white mt-1 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-600 dark:text-[#555] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, action, actionLabel }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-6 flex flex-col gap-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-sm">{title}</p>
          {subtitle && <p className="text-xs text-slate-600 dark:text-[#555] mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <button
            onClick={() => navigate(action)}
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

const CUSTOM_TOOLTIP_CLS = "bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-md px-4 py-3 text-xs";

function PatientTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={CUSTOM_TOOLTIP_CLS}>
      <p className="font-bold text-slate-700 dark:text-[#ccc] mb-1">{label}</p>
      <p className="text-slate-900 dark:text-white dark:text-slate-300">{payload[0].value} new patients</p>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={CUSTOM_TOOLTIP_CLS}>
      <p className="font-bold text-slate-700 dark:text-[#ccc] mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "paid" ? "Paid" : "Unpaid"}: ₹{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

const STATUS_COLORS = { SCHEDULED: "#6366f1", COMPLETED: "#10b981", CANCELLED: "#f43f5e", NO_SHOW: "#f59e0b" };
const ROLE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#3b82f6"];

function DonutChart({ data, colors, centerLabel, centerValue }) {
  return (
    <div className="relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className={CUSTOM_TOOLTIP_CLS}>
                  <p className="font-semibold text-slate-700 dark:text-[#ccc]">{payload[0].name}</p>
                  <p style={{ color: payload[0].payload.fill ?? colors[0] }}>
                    {payload[0].value} ({((payload[0].value / data.reduce((s, d) => s + d.value, 0)) * 100).toFixed(1)}%)
                  </p>
                </div>
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute text-center pointer-events-none">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{centerValue}</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:text-[#555]">{centerLabel}</p>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label, value, total }) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-xs text-slate-600 dark:text-[#888]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-800 dark:text-[#ddd]">{value}</span>
        <span className="text-[10px] text-slate-600 dark:text-[#555] w-8 text-right">{pct}%</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [staff, setStaff] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.hospitalId) return;
    Promise.all([
      staffApi.list(user.hospitalId),
      doctorsApi.list(user.hospitalId),
      patientApi.list(user.hospitalId),
      appointmentsApi.getByHospital(user.hospitalId),
      invoiceApi.getByHospital(user.hospitalId).catch(() => []),
      admissionApi.list(user.hospitalId, true).catch(() => []),
    ]).then(([s, d, p, a, inv, adm]) => {
      setStaff(s.filter((u) => u.role !== "SUPER_ADMIN"));
      setDoctors(d);
      setPatients(p);
      setAppointments(Array.isArray(a) ? a : []);
      setInvoices(Array.isArray(inv) ? inv : []);
      setAdmissions(Array.isArray(adm) ? adm : []);
    }).catch(() => notify("Failed to load dashboard", "error")).finally(() => setLoading(false));
  }, [user?.hospitalId]);

  // ── Derived data ───────────────────────────────────────────────────────

  const patientTrend = useMemo(() => buildLast30Days(patients, "createdAt"), [patients]);
  const revenueTrend = useMemo(() => buildLast6Months(invoices), [invoices]);
  const ageGroups = useMemo(() => buildAgeGroups(patients), [patients]);

  const todayPatients = useMemo(
    () => patients.filter((p) => {
      const d = new Date(p.createdAt);
      const n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    }),
    [patients]
  );

  const appointmentStatus = useMemo(() => {
    const counts = {};
    appointments.forEach((a) => {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [appointments]);

  const roleData = useMemo(() => {
    const counts = {};
    staff.forEach((s) => {
      const r = s.roleDisplay ?? s.role ?? "Unknown";
      counts[r] = (counts[r] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [staff]);

  const totalRevenue = useMemo(
    () => invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total ?? 0), 0),
    [invoices]
  );
  const outstanding = useMemo(
    () => invoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED").reduce((s, i) => s + Number(i.total ?? 0), 0),
    [invoices]
  );
  const activeAdmissions = admissions.filter((a) => !a.dischargeDate).length;
  const thisMonthPatients = patients.filter((p) => isSameMonth(parseISO(p.createdAt), new Date())).length;
  const lastMonthPatients = patients.filter((p) => isSameMonth(parseISO(p.createdAt), subDays(new Date(), 30))).length;
  const patientGrowth = lastMonthPatients > 0
    ? (((thisMonthPatients - lastMonthPatients) / lastMonthPatients) * 100).toFixed(1)
    : null;

  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
            {user?.firstName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#666] mt-1">
            {user?.hospitalName} · {dateStr}
          </p>
        </div>
        <button
          onClick={() => navigate("/patients")}
          className="btn-primary hidden sm:flex"
        >
          <Plus className="w-4 h-4" /> New Patient
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Patients"
          value={patients.length.toLocaleString()}
          sub={`${todayPatients.length} registered today`}
          icon={<div className="bg-blue-50 dark:bg-blue-500/10 w-10 h-10 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>}
          accent=""
          trend={patientGrowth >= 0 ? "up" : "down"}
          trendLabel={patientGrowth != null ? `${Math.abs(patientGrowth)}% MoM` : null}
        />
        <KpiCard
          label="Doctors"
          value={doctors.length}
          sub={`${staff.filter((s) => s.isActive).length} active staff`}
          icon={<div className="bg-slate-100 dark:bg-[#1e1e1e] w-10 h-10 rounded-lg flex items-center justify-center"><Stethoscope className="w-5 h-5 text-slate-700 dark:text-slate-300" /></div>}
          accent=""
        />
        <KpiCard
          label="Revenue Collected"
          value={`₹${(totalRevenue / 1000).toFixed(1)}k`}
          sub={`₹${(outstanding / 1000).toFixed(1)}k outstanding`}
          icon={<div className="bg-violet-50 dark:bg-violet-500/10 w-10 h-10 rounded-lg flex items-center justify-center"><ReceiptText className="w-5 h-5 text-violet-600 dark:text-violet-400" /></div>}
          accent=""
          trend={outstanding > totalRevenue ? "down" : "up"}
          trendLabel={invoices.length > 0 ? `${invoices.filter((i) => i.status === "PAID").length}/${invoices.length} paid` : null}
        />
        <KpiCard
          label="IPD Admissions"
          value={activeAdmissions}
          sub={`${admissions.length} total this period`}
          icon={<div className="bg-amber-50 dark:bg-amber-500/10 w-10 h-10 rounded-lg flex items-center justify-center"><BedDouble className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>}
          accent=""
        />
      </div>

      {/* ── Row 2: Patient trend — full width ── */}
      <ChartCard
        title="Patient Registrations"
        subtitle="Daily new registrations — last 30 days"
        action="/patients"
        actionLabel="All patients"
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={patientTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="patGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<PatientTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#patGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Row 3: Revenue bars + Appointment status + Staff roles ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Revenue — grouped bar */}
        <div className="lg:col-span-3">
          <ChartCard
            title="Revenue Overview"
            subtitle="Paid vs outstanding — last 6 months"
            action="/billing"
            actionLabel="Billing"
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueTrend} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(148,163,184,0.05)" }} />
                <Bar dataKey="paid" name="paid" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="unpaid" name="unpaid" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={20} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666]">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-900 dark:bg-white" /> Paid
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666]">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 opacity-70" /> Outstanding
              </span>
            </div>
          </ChartCard>
        </div>

        {/* Appointment status donut */}
        <div className="lg:col-span-2">
          <ChartCard title="Appointments" subtitle="By status — all time" action="/appointments" actionLabel="View all">
            {appointmentStatus.length > 0 ? (
              <>
                <DonutChart
                  data={appointmentStatus}
                  colors={appointmentStatus.map((d) => STATUS_COLORS[d.name] ?? "#94a3b8")}
                  centerLabel="total"
                  centerValue={appointments.length}
                />
                <div className="space-y-2 mt-1">
                  {appointmentStatus.map((d, i) => (
                    <LegendDot
                      key={d.name}
                      color={STATUS_COLORS[d.name] ?? "#94a3b8"}
                      label={d.name.charAt(0) + d.name.slice(1).toLowerCase().replace("_", " ")}
                      value={d.value}
                      total={appointments.length}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-600 dark:text-[#444]">
                <Calendar className="w-8 h-8" />
                <p className="text-xs">No appointment data yet</p>
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* ── Row 4: Age distribution + Staff role + Quick actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Patient age distribution */}
        <ChartCard title="Patient Age Groups" subtitle="Distribution across all patients">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ageGroups} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className={CUSTOM_TOOLTIP_CLS}>
                      <p className="font-semibold text-slate-700 dark:text-[#ccc]">Age {payload[0].payload.name}</p>
                      <p className="text-blue-500">{payload[0].value} patients</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Staff role breakdown */}
        <ChartCard title="Staff by Role" subtitle="Headcount distribution">
          {roleData.length > 0 ? (
            <>
              <DonutChart
                data={roleData}
                colors={ROLE_COLORS}
                centerLabel="staff"
                centerValue={staff.length}
              />
              <div className="space-y-2">
                {roleData.map((d, i) => (
                  <LegendDot
                    key={d.name}
                    color={ROLE_COLORS[i % ROLE_COLORS.length]}
                    label={d.name}
                    value={d.value}
                    total={staff.length}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-600 dark:text-[#444]">
              <Users className="w-8 h-8" />
              <p className="text-xs">No staff data yet</p>
            </div>
          )}
        </ChartCard>

        {/* Quick actions */}
        <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-6 flex flex-col gap-4 shadow-sm">
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">Quick Actions</p>
            <p className="text-xs text-slate-600 dark:text-[#555] mt-0.5">Jump to common tasks</p>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            {[
              { label: "Add Doctor", sub: "Register a new doctor", to: "/doctors", icon: <Stethoscope className="w-4 h-4" />, color: "text-slate-900 dark:text-white dark:text-slate-300 bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10" },
              { label: "Add Staff", sub: "Onboard a team member", to: "/staffs", icon: <UserCheck className="w-4 h-4" />, color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10" },
              { label: "Register Patient", sub: "New patient registration", to: "/patients", icon: <Users className="w-4 h-4" />, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10" },
              { label: "Create Invoice", sub: "Bill a patient visit", to: "/billing", icon: <ReceiptText className="w-4 h-4" />, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" },
              { label: "IPD Admission", sub: "Admit a patient", to: "/admissions", icon: <BedDouble className="w-4 h-4" />, color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10" },
            ].map((item) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors text-left group"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-[#e5e5e5]">{item.label}</p>
                  <p className="text-xs text-slate-600 dark:text-[#555] truncate">{item.sub}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-[#333] group-hover:text-slate-500 dark:group-hover:text-[#666] transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
