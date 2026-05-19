import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { dashboardApi } from "@/utils/api";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Users, Stethoscope, BedDouble, TrendingUp,
  TrendingDown, ArrowRight, Calendar, ReceiptText,
  Loader2, Plus, UserCheck
} from "lucide-react";

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent, trend, trendLabel }) {
  const isUp = trend === "up";
  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
          {icon}
        </div>
        {trendLabel && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full
            ${isUp
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendLabel}
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
        <p className="text-sm font-medium text-slate-500 dark:text-[#666] mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, action, actionLabel }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-sm">{title}</p>
          {subtitle && <p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <button
            onClick={() => navigate(action)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-white hover:underline"
          >
            {actionLabel} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const CUSTOM_TOOLTIP_CLS = "bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl px-4 py-3 text-xs";

function PatientTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={CUSTOM_TOOLTIP_CLS}>
      <p className="font-bold text-slate-700 dark:text-[#ccc] mb-1">{label}</p>
      <p className="text-emerald-600 dark:text-emerald-400">{payload[0].value} new patients</p>
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
          {p.name === "paid" ? "Paid" : "Outstanding"}: ₹{Number(p.value).toLocaleString("en-IN")}
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:text-[#999999]">{centerLabel}</p>
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
        <span className="text-[10px] text-slate-600 dark:text-[#999999] w-8 text-right">{pct}%</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.hospitalId) return;
    setLoading(true);
    dashboardApi.getSummary(user.hospitalId)
      .then((data) => {
        setSummary(data);
      })
      .catch(() => notify("Failed to load dashboard statistics", "error"))
      .finally(() => setLoading(false));
  }, [user?.hospitalId]);

  const dateStr = new Date().toLocaleDateString("en-IN", { timeZone: 'Asia/Kolkata', weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading || !summary) {
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
          value={summary.totalPatients.toLocaleString()}
          sub={`${summary.todaysNewPatients} registered today`}
          icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          accent="bg-blue-50 dark:bg-blue-500/10"
          trend={summary.patientMoMGrowthPercent >= 0 ? "up" : "down"}
          trendLabel={summary.patientMoMGrowthPercent !== 0.0 ? `${Math.abs(summary.patientMoMGrowthPercent)}% MoM` : null}
        />
        <KpiCard
          label="Doctors"
          value={summary.totalDoctors}
          sub={`${summary.totalActiveStaff} active staff`}
          icon={<Stethoscope className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          accent="bg-emerald-50 dark:bg-emerald-500/10"
        />
        <KpiCard
          label="Revenue Collected"
          value={`₹${(summary.totalRevenueCollected / 1000).toFixed(1)}k`}
          sub={`₹${(summary.totalOutstandingRevenue / 1000).toFixed(1)}k outstanding`}
          icon={<ReceiptText className="w-5 h-5 text-slate-900 dark:text-white dark:text-slate-300" />}
          accent="bg-slate-100 dark:bg-[#1e1e1e]"
          trend={summary.totalOutstandingRevenue > summary.totalRevenueCollected ? "down" : "up"}
          trendLabel={`${(summary.totalRevenueCollected / (summary.totalRevenueCollected + summary.totalOutstandingRevenue || 1) * 100).toFixed(0)}% paid`}
        />
        <KpiCard
          label="IPD Admissions"
          value={summary.activeAdmissions}
          sub="Currently admitted in wards"
          icon={<BedDouble className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          accent="bg-amber-50 dark:bg-amber-500/10"
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
          <AreaChart data={summary.patientRegistrationsTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="patGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#patGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
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
            action="/billing/opd"
            actionLabel="Billing"
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.revenueOverview} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(148,163,184,0.05)" }} />
                <Bar dataKey="paid" name="paid" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="outstanding" name="outstanding" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={20} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666]">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Paid
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
            {summary.appointmentsBreakdown.length > 0 ? (
              <>
                <DonutChart
                  data={summary.appointmentsBreakdown}
                  colors={summary.appointmentsBreakdown.map((d) => STATUS_COLORS[d.name] ?? "#94a3b8")}
                  centerLabel="total"
                  centerValue={summary.appointmentsBreakdown.reduce((sum, d) => sum + d.value, 0)}
                />
                <div className="space-y-2 mt-1">
                  {summary.appointmentsBreakdown.map((d, i) => (
                    <LegendDot
                      key={d.name}
                      color={STATUS_COLORS[d.name] ?? "#94a3b8"}
                      label={d.name.charAt(0) + d.name.slice(1).toLowerCase().replace("_", " ")}
                      value={d.value}
                      total={summary.appointmentsBreakdown.reduce((sum, item) => sum + item.value, 0)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400 dark:text-[#444]">
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
            <BarChart data={summary.patientAgeGroups} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
              <Bar dataKey="value" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Staff role breakdown */}
        <ChartCard title="Staff by Role" subtitle="Headcount distribution">
          {summary.staffByRole.length > 0 ? (
            <>
              <DonutChart
                data={summary.staffByRole}
                colors={ROLE_COLORS}
                centerLabel="staff"
                centerValue={summary.totalActiveStaff}
              />
              <div className="space-y-2">
                {summary.staffByRole.map((d, i) => (
                  <LegendDot
                    key={d.name}
                    color={ROLE_COLORS[i % ROLE_COLORS.length]}
                    label={d.name}
                    value={d.value}
                    total={summary.totalActiveStaff}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400 dark:text-[#444]">
              <Users className="w-8 h-8" />
              <p className="text-xs">No staff data yet</p>
            </div>
          )}
        </ChartCard>

        {/* Quick actions */}
        <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-6 flex flex-col gap-4">
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">Quick Actions</p>
            <p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">Jump to common tasks</p>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            {[
              { label: "Add Doctor", sub: "Register a new doctor", to: "/doctors", icon: <Stethoscope className="w-4 h-4" />, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" },
              { label: "Add Staff", sub: "Onboard a team member", to: "/staffs/directory", icon: <UserCheck className="w-4 h-4" />, color: "text-slate-900 dark:text-white dark:text-slate-300 bg-slate-100 dark:bg-[#1e1e1e]" },
              { label: "Register Patient", sub: "New patient registration", to: "/patients", icon: <Users className="w-4 h-4" />, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10" },
              { label: "Create Invoice", sub: "Bill a patient visit", to: "/billing/opd", icon: <ReceiptText className="w-4 h-4" />, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" },
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
                  <p className="text-xs text-slate-600 dark:text-[#999999] truncate">{item.sub}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 dark:text-[#888888] group-hover:text-slate-500 dark:group-hover:text-[#666] transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
