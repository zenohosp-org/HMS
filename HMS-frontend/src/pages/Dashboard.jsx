import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import { patientApi, appointmentsApi, doctorsApi } from "@/utils/api";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Users, Calendar, ReceiptText, ChevronRight, Phone,
  Droplets, Activity, Clock, UserPlus, Loader2,
  CheckCircle2, XCircle, AlertCircle, ArrowRight
} from "lucide-react";
import { format, subDays, parseISO, isToday as fnsIsToday, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

// ── Helpers ────────────────────────────────────────────────────────────────

function calcAge(dob) {
  if (!dob) return "—";
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1e3))}y`;
}

import { timeAgo } from "@/utils/date";
import { fmtId } from "@/utils/idFormat";

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
  "A+":  "is-aplus",
  "A-":  "is-aminus",
  "B+":  "is-bplus",
  "B-":  "is-bminus",
  "O+":  "is-oplus",
  "O-":  "is-ominus",
  "AB+": "is-abplus",
  "AB-": "is-abminus",
};

const STATUS_META = {
  SCHEDULED: { icon: Clock, mod: "is-info", label: "Scheduled" },
  COMPLETED: { icon: CheckCircle2, mod: "is-emerald", label: "Completed" },
  CANCELLED: { icon: XCircle, mod: "is-rose", label: "Cancelled" },
  NO_SHOW:   { icon: AlertCircle, mod: "is-amber", label: "No Show" },
};

const STATUS_BAR_CLS = {
  SCHEDULED: "is-scheduled",
  COMPLETED: "is-completed",
  CANCELLED: "is-cancelled",
  NO_SHOW:   "is-no-show",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function StatPill({ label, value, icon, accent }) {
  return (
    <div className="zu-stat-card">
      <div className={`zu-stat-card-icon ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="zu-stat-card-value">{value}</p>
        <p className="zu-stat-card-label">{label}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, actionLabel, actionFn }) {
  return (
    <div className="hms-dash-section-card">
      <div className="hms-dash-section-card__head">
        <div>
          <p className="hms-dash-section-card__title">{title}</p>
          {subtitle && <p className="hms-dash-section-card__sub">{subtitle}</p>}
        </div>
        {actionFn && (
          <button
            onClick={actionFn}
            className="hms-dash-section-card__action"
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
  const meta = STATUS_META[status] ?? { icon: Clock, mod: "is-slate", label: status };
  const Icon = meta.icon;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const fillMod = STATUS_BAR_CLS[status] ?? "is-default";
  return (
    <div className="hms-dash-status-row">
      <div className={`hms-dash-status-row__icon ${meta.mod}`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="hms-dash-status-row__body">
        <div className="hms-dash-status-row__head">
          <span className="hms-dash-status-row__label">{meta.label}</span>
          <span className="hms-dash-status-row__count">{count}</span>
        </div>
        <div className="hms-dash-status-row__bar">
          <div
            className={`hms-dash-status-row__fill ${fillMod}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="hms-dash-status-row__pct">{pct}%</span>
    </div>
  );
}

function PatientRowCard({ p }) {
  const navigate = useNavigate();
  const blood = p.bloodGroup ?? "N/A";
  const bloodMod = BLOOD_COLORS[blood] ?? "is-default";
  return (
    <tr onClick={() => navigate(`/patients/${p.id}`)}>
      <td>
        <div className="hms-dash-pat-cell">
          <div className="hms-dash-pat-cell__avatar">
            {p.firstName[0]}{p.lastName?.[0] ?? ""}
          </div>
          <div>
            <p className="hms-dash-pat-cell__name">{p.firstName} {p.lastName}</p>
            <p className="hms-dash-pat-cell__uhid">{fmtId(p.uhid)}</p>
          </div>
        </div>
      </td>
      <td>{calcAge(p.dob)} · {p.gender ?? "—"}</td>
      <td>
        {p.phone ? (
          <span className="hms-dash-phone">
            <Phone className="w-3 h-3" />{p.phone}
          </span>
        ) : (
          <span>—</span>
        )}
      </td>
      <td>
        <span className={`hms-dash-blood-chip ${bloodMod}`}>
          <Droplets className="inline w-2 h-2" />{blood}
        </span>
      </td>
      <td>
        <span className="hms-dash-time">
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
  const dateStr = new Date().toLocaleDateString("en-IN", { timeZone: 'Asia/Kolkata', weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
      <div className="hms-dash-loading">
        <Loader2 className="w-5 h-5 animate-spin text-gray-900" />
      </div>
    );
  }

  const totalAppts = appointments.length;

  return (
    <div className="hms-dash-doctor">

      {/* ── Header ── */}
      <div className="hms-dash-doctor__header">
        <div>
          <h1 className="hms-dash-doctor__greeting">
            {greeting}, {isDoctor ? "Dr." : ""} {user?.firstName}
          </h1>
          <p className="hms-dash-doctor__subtitle">
            {user?.hospitalName} · {dateStr}
          </p>
        </div>
        <button onClick={() => navigate("/patients")} className="zu-btn-primary">
          <UserPlus className="w-4 h-4" /> Register Patient
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="hms-dash-doctor__kpis">
        <StatPill
          label="Total Patients"
          value={patients.length}
          icon={<Users className="w-4 h-4" />}
          accent="is-info"
        />
        <StatPill
          label="New Today"
          value={todayPatients.length}
          icon={<UserPlus className="w-4 h-4" />}
          accent="is-neutral"
        />
        <StatPill
          label={isDoctor ? "My Appointments" : "Appointments"}
          value={totalAppts}
          icon={<Calendar className="w-4 h-4" />}
          accent="is-neutral"
        />
        <StatPill
          label="Today's Schedule"
          value={todayAppts.length}
          icon={<Activity className="w-4 h-4" />}
          accent="is-warning"
        />
      </div>

      {/* ── Row 2: Patient trend sparkline + weekly appointment bar ── */}
      <div className="hms-dash-doctor__row-2col">

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
                    <div className="hms-dash-tooltip">
                      <p className="hms-dash-tooltip__title">{label}</p>
                      <p className="hms-dash-tooltip__line">{payload[0].value} patients</p>
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
                    <div className="hms-dash-tooltip">
                      <p className="hms-dash-tooltip__title">{label}</p>
                      <p className="hms-dash-tooltip__line is-strong">{payload[0].value} appointments</p>
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
      <div className="hms-dash-doctor__row-3col">

        {/* Appointment status breakdown */}
        <SectionCard
          title="Appointment Status"
          subtitle="All-time breakdown"
          actionLabel="Appointments"
          actionFn={() => navigate("/appointments")}
        >
          {totalAppts > 0 ? (
            <div className="hms-dash-status-list">
              {Object.entries(apptStatusCounts).map(([status, count]) => (
                <AppointmentStatusRow key={status} status={status} count={count} total={totalAppts} />
              ))}
            </div>
          ) : (
            <div className="hms-dash-empty-chart">
              <Calendar className="w-5 h-5" />
              <p className="hms-dash-empty-chart__text">No appointments yet</p>
            </div>
          )}
          {totalAppts > 0 && (
            <div className="hms-dash-status-foot">
              <div className="hms-dash-status-foot__row">
                <span>Total appointments</span>
                <span className="hms-dash-status-foot__row-strong">{totalAppts}</span>
              </div>
              {apptStatusCounts.COMPLETED > 0 && (
                <div className="hms-dash-status-foot__row">
                  <span>Completion rate</span>
                  <span className="hms-dash-status-foot__row-strong is-dark">
                    {((apptStatusCounts.COMPLETED / totalAppts) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Today's patients */}
        <div className="hms-dash-today hms-dash-doctor__col-span-2">
          <div className="hms-dash-today__head">
            <div className="hms-dash-today__head-left">
              <UserPlus className="w-4 h-4 hms-dash-today__head-icon" />
              <p className="hms-dash-today__head-title">New Patients Today</p>
              {todayPatients.length > 0 && (
                <span className="hms-dash-today__head-count">
                  {todayPatients.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate("/patients")}
              className="hms-dash-today__head-link"
            >
              All patients <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {todayPatients.length === 0 ? (
            <div className="hms-dash-today__empty">
              <div className="hms-dash-today__empty-icon">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <p className="hms-dash-today__empty-title">No new patients today</p>
                <p className="hms-dash-today__empty-sub">New registrations will appear here</p>
              </div>
              <button onClick={() => navigate("/patients")} className="zu-btn-primary is-sm">
                Register Patient
              </button>
            </div>
          ) : (
            <div className="hms-dash-today__table-wrap">
              <table className="hms-dash-today__table">
                <thead>
                  <tr>
                    {["Patient", "Age / Gender", "Phone", "Blood", "Registered"].map((h) => (
                      <th key={h}>
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
      <div className="hms-dash-doctor__quick-row">
        {[
          { label: "Patients", sub: "Register or find a patient", to: "/patients", icon: <Users className="w-5 h-5" />, color: "is-info" },
          ...(isDoctor ? [{ label: "My Appointments", sub: "View your schedule", to: "/appointments", icon: <Calendar className="w-5 h-5" />, color: "is-neutral" }] : []),
          { label: "Create Invoice", sub: "Generate a patient bill", to: "/billing/opd", icon: <ReceiptText className="w-5 h-5" />, color: "is-neutral" },
        ].map((item) => (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className="hms-dash-quick"
          >
            <div className={`hms-dash-quick__icon ${item.color}`}>
              {item.icon}
            </div>
            <div className="hms-dash-quick__body">
              <p className="hms-dash-quick__label">{item.label}</p>
              <p className="hms-dash-quick__sub">{item.sub}</p>
            </div>
            <ChevronRight className="w-4 h-4 hms-dash-quick__chev" />
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
