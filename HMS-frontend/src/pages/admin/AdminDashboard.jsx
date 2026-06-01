import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { dashboardApi } from "@/utils/api";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    Users,
    Stethoscope,
    BedDouble,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    Calendar,
    ReceiptText,
    Loader2,
    Plus,
    UserCheck,
} from "lucide-react";
import { Button, Card } from "@/components/ui";

/** Recharts tooltip outer style — shared by all 4 custom tooltips so
 *  every hover popup matches the design system. */
const TOOLTIP_STYLE = {
    background: "var(--hms-white)",
    border: "1px solid var(--hms-gray-200)",
    borderRadius: 8,
    boxShadow: "var(--hms-shadow-lg)",
    padding: "10px 14px",
    fontSize: 11,
    fontFamily: "var(--hms-font-family)",
};

/** KPI tile — icon avatar + bold number + label + optional MoM trend. */
function KpiCard({ label, value, sub, icon, iconBg, iconColor, trend, trendLabel }) {
    const isUp = trend === "up";
    return (
        <Card style={{ padding: 20, gap: 16 }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: iconBg,
                        color: iconColor,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {icon}
                </div>
                {trendLabel && (
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: isUp ? "var(--hms-success-bg)" : "#fff1f2",
                            color: isUp ? "var(--hms-success)" : "#be123c",
                        }}
                    >
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {trendLabel}
                    </span>
                )}
            </div>
            <div>
                <p
                    style={{
                        margin: 0,
                        fontSize: 28,
                        fontWeight: 800,
                        color: "var(--hms-gray-900)",
                        letterSpacing: "-0.02em",
                    }}
                >
                    {value}
                </p>
                <p
                    style={{
                        margin: "2px 0 0",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--hms-gray-500)",
                    }}
                >
                    {label}
                </p>
                {sub && (
                    <p
                        style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "var(--hms-gray-500)",
                        }}
                    >
                        {sub}
                    </p>
                )}
            </div>
        </Card>
    );
}

/** Chart container — bold title + optional subtitle + optional right-aligned
 *  action link → recharts content underneath. */
function ChartCard({ title, subtitle, children, action, actionLabel }) {
    const navigate = useNavigate();
    return (
        <Card style={{ padding: 24, gap: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--hms-gray-900)",
                        }}
                    >
                        {title}
                    </p>
                    {subtitle && (
                        <p
                            style={{
                                margin: "2px 0 0",
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>
                {action && (
                    <button
                        type="button"
                        onClick={() => navigate(action)}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--hms-gray-900)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontFamily: "var(--hms-font-family)",
                        }}
                    >
                        {actionLabel} <ArrowRight size={12} />
                    </button>
                )}
            </div>
            {children}
        </Card>
    );
}

function PatientTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={TOOLTIP_STYLE}>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--hms-gray-700)", marginBottom: 4 }}>
                {label}
            </p>
            <p style={{ margin: 0, color: "var(--hms-success)" }}>
                {payload[0].value} new patients
            </p>
        </div>
    );
}

function RevenueTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={TOOLTIP_STYLE}>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--hms-gray-700)", marginBottom: 8 }}>
                {label}
            </p>
            {payload.map((p) => (
                <p key={p.name} style={{ margin: 0, color: p.color }}>
                    {p.name === "paid" ? "Paid" : "Outstanding"}: ₹
                    {Number(p.value).toLocaleString("en-IN")}
                </p>
            ))}
        </div>
    );
}

const STATUS_COLORS = {
    SCHEDULED: "#6366f1",
    COMPLETED: "#10b981",
    CANCELLED: "#f43f5e",
    NO_SHOW: "#f59e0b",
};
const ROLE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#3b82f6"];

function DonutChart({ data, colors, centerLabel, centerValue }) {
    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
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
                                <div style={TOOLTIP_STYLE}>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontWeight: 600,
                                            color: "var(--hms-gray-700)",
                                        }}
                                    >
                                        {payload[0].name}
                                    </p>
                                    <p
                                        style={{
                                            margin: 0,
                                            color: payload[0].payload.fill ?? colors[0],
                                        }}
                                    >
                                        {payload[0].value} (
                                        {(
                                            (payload[0].value /
                                                data.reduce((s, d) => s + d.value, 0)) *
                                            100
                                        ).toFixed(1)}
                                        %)
                                    </p>
                                </div>
                            ) : null
                        }
                    />
                </PieChart>
            </ResponsiveContainer>
            {centerLabel && (
                <div
                    style={{
                        position: "absolute",
                        textAlign: "center",
                        pointerEvents: "none",
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: 22,
                            fontWeight: 800,
                            color: "var(--hms-gray-900)",
                        }}
                    >
                        {centerValue}
                    </p>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 10,
                            fontWeight: 600,
                            color: "var(--hms-gray-500)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                        }}
                    >
                        {centerLabel}
                    </p>
                </div>
            )}
        </div>
    );
}

function LegendDot({ color, label, value, total }) {
    const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: color,
                        flexShrink: 0,
                    }}
                />
                <span style={{ fontSize: 11, color: "var(--hms-gray-600)" }}>{label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--hms-gray-800)" }}>
                    {value}
                </span>
                <span
                    style={{
                        fontSize: 10,
                        color: "var(--hms-gray-500)",
                        width: 32,
                        textAlign: "right",
                    }}
                >
                    {pct}%
                </span>
            </div>
        </div>
    );
}

/**
 * AdminDashboard — KPIs, trend charts, donuts, and quick-action launcher.
 * Rendered conditionally by pages/Dashboard.jsx when the logged-in user
 * has role hospital_admin or super_admin.
 *
 * Phase 8e migration: data layer untouched (dashboardApi.getSummary).
 * Chart data shapes and recharts configuration kept exactly the same;
 * only the wrappers, tooltips, and KPI / quick-action tiles were moved
 * onto tokens.
 */
export default function AdminDashboard() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const navigate = useNavigate();

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.hospitalId) return;
        setLoading(true);
        dashboardApi
            .getSummary(user.hospitalId)
            .then((data) => setSummary(data))
            .catch(() => notify("Failed to load dashboard statistics", "error"))
            .finally(() => setLoading(false));
    }, [user?.hospitalId, notify]);

    const dateStr = new Date().toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    if (loading || !summary) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 256,
                }}
            >
                <Loader2
                    size={32}
                    style={{ color: "var(--hms-gray-700)" }}
                    className="animate-spin"
                />
            </div>
        );
    }

    const apptTotal = summary.appointmentsBreakdown.reduce((sum, d) => sum + d.value, 0);

    const quickActions = [
        {
            label: "Add doctor",
            sub: "Register a new doctor",
            to: "/doctors",
            icon: <Stethoscope size={16} />,
            color: "var(--hms-success)",
            bg: "var(--hms-success-bg)",
        },
        {
            label: "Add staff",
            sub: "Onboard a team member",
            to: "/staffs/directory",
            icon: <UserCheck size={16} />,
            color: "var(--hms-gray-700)",
            bg: "var(--hms-gray-100)",
        },
        {
            label: "Register patient",
            sub: "New patient registration",
            to: "/patients",
            icon: <Users size={16} />,
            color: "var(--hms-info)",
            bg: "var(--hms-info-bg)",
        },
        {
            label: "Create invoice",
            sub: "Bill a patient visit",
            to: "/billing/opd",
            icon: <ReceiptText size={16} />,
            color: "#b45309",
            bg: "var(--hms-warning-bg)",
        },
        {
            label: "IPD admission",
            sub: "Admit a patient",
            to: "/admissions",
            icon: <BedDouble size={16} />,
            color: "#be123c",
            bg: "#fff1f2",
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                }}
            >
                <div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: 22,
                            fontWeight: 700,
                            color: "var(--hms-gray-900)",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Good {greeting}, {user?.firstName}
                    </h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--hms-gray-500)" }}>
                        {user?.hospitalName} · {dateStr}
                    </p>
                </div>
                <Button variant="primary" onClick={() => navigate("/patients")}>
                    <Plus size={14} strokeWidth={2.4} /> New patient
                </Button>
            </div>

            {/* KPI row */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                }}
            >
                <KpiCard
                    label="Total patients"
                    value={summary.totalPatients.toLocaleString()}
                    sub={`${summary.todaysNewPatients} registered today`}
                    icon={<Users size={20} />}
                    iconBg="var(--hms-info-bg)"
                    iconColor="var(--hms-info)"
                    trend={summary.patientMoMGrowthPercent >= 0 ? "up" : "down"}
                    trendLabel={
                        summary.patientMoMGrowthPercent !== 0.0
                            ? `${Math.abs(summary.patientMoMGrowthPercent)}% MoM`
                            : null
                    }
                />
                <KpiCard
                    label="Doctors"
                    value={summary.totalDoctors}
                    sub={`${summary.totalActiveStaff} active staff`}
                    icon={<Stethoscope size={20} />}
                    iconBg="var(--hms-success-bg)"
                    iconColor="var(--hms-success)"
                />
                <KpiCard
                    label="Revenue collected"
                    value={`₹${(summary.totalRevenueCollected / 1000).toFixed(1)}k`}
                    sub={`₹${(summary.totalOutstandingRevenue / 1000).toFixed(1)}k outstanding`}
                    icon={<ReceiptText size={20} />}
                    iconBg="var(--hms-gray-100)"
                    iconColor="var(--hms-gray-700)"
                    trend={
                        summary.totalOutstandingRevenue > summary.totalRevenueCollected
                            ? "down"
                            : "up"
                    }
                    trendLabel={`${(
                        (summary.totalRevenueCollected /
                            (summary.totalRevenueCollected +
                                summary.totalOutstandingRevenue || 1)) *
                        100
                    ).toFixed(0)}% paid`}
                />
                <KpiCard
                    label="IPD admissions"
                    value={summary.activeAdmissions}
                    sub="Currently admitted in wards"
                    icon={<BedDouble size={20} />}
                    iconBg="var(--hms-warning-bg)"
                    iconColor="#b45309"
                />
            </div>

            {/* Row 2 — patient trend */}
            <ChartCard
                title="Patient registrations"
                subtitle="Daily new registrations — last 30 days"
                action="/patients"
                actionLabel="All patients"
            >
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                        data={summary.patientRegistrationsTrend}
                        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="patGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(148, 163, 184, 0.1)"
                            vertical={false}
                        />
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

            {/* Row 3 — revenue + appointments */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "3fr 2fr",
                    gap: 24,
                }}
            >
                <ChartCard
                    title="Revenue overview"
                    subtitle="Paid vs outstanding — last 6 months"
                    action="/billing/opd"
                    actionLabel="Billing"
                >
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                            data={summary.revenueOverview}
                            margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                            barGap={3}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(148, 163, 184, 0.1)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10, fill: "#94a3b8" }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "#94a3b8" }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                                content={<RevenueTooltip />}
                                cursor={{ fill: "rgba(148, 163, 184, 0.05)" }}
                            />
                            <Bar dataKey="paid" name="paid" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
                            <Bar
                                dataKey="outstanding"
                                name="outstanding"
                                fill="#f43f5e"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                                opacity={0.7}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 2,
                                    background: "#10b981",
                                }}
                            />
                            Paid
                        </span>
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 2,
                                    background: "#f43f5e",
                                    opacity: 0.7,
                                }}
                            />
                            Outstanding
                        </span>
                    </div>
                </ChartCard>

                <ChartCard
                    title="Appointments"
                    subtitle="By status — all time"
                    action="/appointments"
                    actionLabel="View all"
                >
                    {summary.appointmentsBreakdown.length > 0 ? (
                        <>
                            <DonutChart
                                data={summary.appointmentsBreakdown}
                                colors={summary.appointmentsBreakdown.map(
                                    (d) => STATUS_COLORS[d.name] ?? "var(--hms-gray-400)"
                                )}
                                centerLabel="total"
                                centerValue={apptTotal}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                                {summary.appointmentsBreakdown.map((d) => (
                                    <LegendDot
                                        key={d.name}
                                        color={STATUS_COLORS[d.name] ?? "var(--hms-gray-400)"}
                                        label={d.name.charAt(0) + d.name.slice(1).toLowerCase().replace("_", " ")}
                                        value={d.value}
                                        total={apptTotal}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                height: 160,
                                gap: 8,
                                color: "var(--hms-gray-400)",
                            }}
                        >
                            <Calendar size={32} />
                            <p style={{ margin: 0, fontSize: 11 }}>No appointment data yet</p>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* Row 4 — age + roles + quick actions */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 24,
                }}
            >
                <ChartCard title="Patient age groups" subtitle="Distribution across all patients">
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                            data={summary.patientAgeGroups}
                            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(148, 163, 184, 0.1)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: "#94a3b8" }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "#94a3b8" }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                content={({ active, payload }) =>
                                    active && payload?.length ? (
                                        <div style={TOOLTIP_STYLE}>
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontWeight: 600,
                                                    color: "var(--hms-gray-700)",
                                                }}
                                            >
                                                Age {payload[0].payload.name}
                                            </p>
                                            <p style={{ margin: 0, color: "var(--hms-info)" }}>
                                                {payload[0].value} patients
                                            </p>
                                        </div>
                                    ) : null
                                }
                            />
                            <Bar dataKey="value" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={36} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Staff by role" subtitle="Headcount distribution">
                    {summary.staffByRole.length > 0 ? (
                        <>
                            <DonutChart
                                data={summary.staffByRole}
                                colors={ROLE_COLORS}
                                centerLabel="staff"
                                centerValue={summary.totalActiveStaff}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                height: 160,
                                gap: 8,
                                color: "var(--hms-gray-400)",
                            }}
                        >
                            <Users size={32} />
                            <p style={{ margin: 0, fontSize: 11 }}>No staff data yet</p>
                        </div>
                    )}
                </ChartCard>

                <Card style={{ padding: 24, gap: 16 }}>
                    <div>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--hms-gray-900)",
                            }}
                        >
                            Quick actions
                        </p>
                        <p
                            style={{
                                margin: "2px 0 0",
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            Jump to common tasks
                        </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                        {quickActions.map((item) => (
                            <button
                                key={item.to}
                                type="button"
                                onClick={() => navigate(item.to)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: 12,
                                    borderRadius: 8,
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "background 0.15s",
                                    fontFamily: "var(--hms-font-family)",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = "var(--hms-gray-50)")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = "transparent")
                                }
                            >
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        background: item.bg,
                                        color: item.color,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    {item.icon}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: "var(--hms-gray-800)",
                                        }}
                                    >
                                        {item.label}
                                    </p>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 11,
                                            color: "var(--hms-gray-500)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {item.sub}
                                    </p>
                                </div>
                                <ArrowRight
                                    size={14}
                                    style={{ color: "var(--hms-gray-400)", flexShrink: 0 }}
                                />
                            </button>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
