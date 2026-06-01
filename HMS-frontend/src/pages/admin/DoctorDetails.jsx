import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { appointmentsApi, doctorsApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import DoctorFormModal from "@/components/modals/DoctorFormModal";
import {
    Loader2,
    ChevronLeft,
    Mail,
    Phone,
    BookOpen,
    Stethoscope,
    User,
    CheckCircle,
    Edit2,
    Calendar,
    Clock,
    Banknote,
    Building2,
    CalendarIcon,
    AlertCircle,
    Users,
    Save,
    CalendarDays,
} from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Input,
    Tabs,
} from "@/components/ui";

const DAYS = [
    { label: "Monday", short: "MON", bit: 1, idx: 0 },
    { label: "Tuesday", short: "TUE", bit: 2, idx: 1 },
    { label: "Wednesday", short: "WED", bit: 4, idx: 2 },
    { label: "Thursday", short: "THU", bit: 8, idx: 3 },
    { label: "Friday", short: "FRI", bit: 16, idx: 4 },
    { label: "Saturday", short: "SAT", bit: 32, idx: 5 },
    { label: "Sunday", short: "SUN", bit: 64, idx: 6 },
];

/** Status → Badge tone — unified mapping for both appointment cards
 *  and the coloured left-strip on each card. */
const STATUS_TONE = {
    COMPLETED: "success",
    CANCELLED: "danger",
    NO_SHOW: "danger",
    IN_PROGRESS: "warning",
};
const statusTone = (s) => STATUS_TONE[s] || "info";
const STATUS_STRIPE = {
    success: "var(--hms-success)",
    danger: "var(--hms-danger)",
    warning: "var(--hms-warning)",
    info: "var(--hms-info)",
};

/** Small kv row used in the left sidebar. */
function SideInfoRow({ icon: Icon, label, value }) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flexShrink: 0, color: "var(--hms-gray-400)", marginTop: 2 }}>
                <Icon size={14} />
            </div>
            <div>
                <p
                    style={{
                        margin: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--hms-gray-500)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                    }}
                >
                    {label}
                </p>
                <p
                    style={{
                        margin: "2px 0 0",
                        fontSize: 13,
                        color: "var(--hms-gray-700)",
                    }}
                >
                    {value || "—"}
                </p>
            </div>
        </div>
    );
}

function SectionHead({ icon: Icon, title }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Icon size={14} style={{ color: "var(--hms-gray-500)" }} />
            <h3
                style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--hms-gray-700)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {title}
            </h3>
        </div>
    );
}

/**
 * Doctor profile + schedule editor.
 *
 * Phase 7 migration: split-pane page (sidebar + tabbed main area)
 * moved onto the design system. Data layer unchanged — three API
 * surfaces still drive the page (doctorsApi.get, appointmentsApi.
 * getByHospital, doctorsApi.getAvailability/saveAvailability), and the
 * RBAC check (canEdit = hospital_admin OR own user id) is preserved
 * byte-for-byte.
 *
 * Sub-components migrated inline:
 *   * Tab strip → <Tabs type="underline"> (the legacy emerald-coloured
 *     tabs unified to brand black to match the rest of the app).
 *   * Stat cards / data sections → <Card>.
 *   * Status pills → <Badge tone={STATUS_TONE[...]}>.
 *   * Schedule time inputs → <Input type="time"|"number">.
 *   * Day enable indicator + computed-slots preview retained verbatim
 *     so the math on the schedule screen still matches the backend.
 */
function DoctorDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { notify } = useNotification();
    const { user } = useAuth();

    const [doctor, setDoctor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [tab, setTab] = useState("overview");

    const [doctorAppointments, setDoctorAppointments] = useState([]);
    const [loadingAppointments, setLoadingAppointments] = useState(false);

    // Map of dayOfWeek index -> slot object
    const [scheduleSlots, setScheduleSlots] = useState({});
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [scheduleSaving, setScheduleSaving] = useState(false);

    const doctorPatients = useMemo(() => {
        const pMap = new Map();
        doctorAppointments.forEach((appt) => {
            if (!pMap.has(appt.patientId)) {
                pMap.set(appt.patientId, {
                    id: appt.patientId,
                    name: appt.patientName,
                    visits: 1,
                    lastVisit: appt.apptDate.substring(0, 10),
                });
            } else {
                const existing = pMap.get(appt.patientId);
                existing.visits += 1;
                if (appt.apptDate > existing.lastVisit)
                    existing.lastVisit = appt.apptDate.substring(0, 10);
                pMap.set(appt.patientId, existing);
            }
        });
        return Array.from(pMap.values()).sort((a, b) =>
            b.lastVisit.localeCompare(a.lastVisit)
        );
    }, [doctorAppointments]);

    const nextAppointment = useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        return (
            doctorAppointments
                .filter(
                    (a) =>
                        ["SCHEDULED", "CONFIRMED"].includes(a.status) &&
                        a.apptDate >= todayStr
                )
                .sort((a, b) => {
                    const d = a.apptDate.localeCompare(b.apptDate);
                    return d !== 0 ? d : a.apptTime.localeCompare(b.apptTime);
                })[0] ?? null
        );
    }, [doctorAppointments]);

    const completedCount = doctorAppointments.filter(
        (a) => a.status === "COMPLETED"
    ).length;
    const scheduledCount = doctorAppointments.filter((a) =>
        ["SCHEDULED", "CONFIRMED"].includes(a.status)
    ).length;

    const loadData = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const docData = await doctorsApi.get(id);
            setDoctor(docData);
            setLoadingAppointments(true);
            try {
                const appts = await appointmentsApi.getByHospital(docData.hospitalId);
                const docAppts = appts.filter((a) => a.doctorId === docData.id);
                docAppts.sort(
                    (a, b) =>
                        new Date(`${b.apptDate}T${b.apptTime}`).getTime() -
                        new Date(`${a.apptDate}T${a.apptTime}`).getTime()
                );
                setDoctorAppointments(docAppts);
            } catch {
                // appointments optional
            } finally {
                setLoadingAppointments(false);
            }
        } catch {
            notify("Failed to load doctor details", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadAvailability = useCallback(
        async (doc) => {
            if (!doc) return;
            setScheduleLoading(true);
            try {
                const slots = await doctorsApi.getAvailability(doc.id);
                const map = {};
                slots.forEach((s) => {
                    map[s.dayOfWeek] = { ...s };
                });
                DAYS.forEach(({ bit, idx }) => {
                    if ((doc.availableDaysMask ?? 0) & bit) {
                        if (!map[idx]) {
                            map[idx] = {
                                dayOfWeek: idx,
                                startTime: "09:00",
                                endTime: "17:00",
                                slotDurationMins: doc.slotDurationMin || 15,
                                maxDailySlots: doc.maxDailySlots || 40,
                                isActive: true,
                            };
                        }
                    }
                });
                setScheduleSlots(map);
            } catch {
                notify("Failed to load schedule", "error");
            } finally {
                setScheduleLoading(false);
            }
        },
        [notify]
    );

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (tab === "schedule" && doctor) loadAvailability(doctor);
    }, [tab, doctor, loadAvailability]);

    const updateSlot = (dayIdx, field, value) => {
        setScheduleSlots((prev) => ({
            ...prev,
            [dayIdx]: { ...prev[dayIdx], [field]: value },
        }));
    };

    const saveSchedule = async () => {
        setScheduleSaving(true);
        try {
            const activeDays = Object.values(scheduleSlots).filter(
                (s) => s.startTime && s.endTime
            );
            await Promise.all(
                activeDays.map((s) =>
                    doctorsApi.saveAvailability(doctor.id, {
                        dayOfWeek: s.dayOfWeek,
                        startTime: s.startTime,
                        endTime: s.endTime,
                        slotDurationMins: s.slotDurationMins,
                        maxDailySlots: s.maxDailySlots,
                        isActive: s.isActive !== false,
                    })
                )
            );
            notify("Schedule saved successfully", "success");
            await loadAvailability(doctor);
        } catch {
            notify("Failed to save schedule", "error");
        } finally {
            setScheduleSaving(false);
        }
    };

    /* Loading + not-found full-screen states */
    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    background: "var(--hms-white)",
                }}
            >
                <Loader2
                    size={32}
                    style={{ color: "var(--hms-info)" }}
                    className="animate-spin"
                />
            </div>
        );
    }
    if (!doctor) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    gap: 16,
                    background: "var(--hms-white)",
                }}
            >
                <AlertCircle size={40} style={{ color: "var(--hms-gray-300)" }} />
                <p style={{ color: "var(--hms-gray-500)" }}>Doctor not found.</p>
                <Button variant="secondary" onClick={() => navigate(-1)}>
                    Go back
                </Button>
            </div>
        );
    }

    const canEdit =
        user?.role === "hospital_admin" || user?.userId === doctor.userId;
    const initials = `${doctor.firstName[0]}${doctor.lastName?.[0] ?? ""}`.toUpperCase();

    const TAB_DEFS = [
        { id: "overview", label: "Overview" },
        {
            id: "appointments",
            label: "Appointments",
            count: loadingAppointments ? undefined : doctorAppointments.length,
        },
        {
            id: "patients",
            label: "Patients",
            count: loadingAppointments ? undefined : doctorPatients.length,
        },
        { id: "schedule", label: "Schedule" },
    ];

    return (
        <div
            style={{
                display: "flex",
                gap: 0,
                height: "calc(100vh - 3.5rem)",
                width: "calc(100% + 3rem)",
                marginLeft: "-1.5rem",
                marginRight: "-1.5rem",
                marginTop: "-1.5rem",
                overflow: "hidden",
                background: "var(--hms-white)",
            }}
        >
            {/* LEFT PANE */}
            <aside
                style={{
                    width: 288,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--hms-white)",
                    borderRight: "1px solid var(--hms-gray-200)",
                    overflowY: "auto",
                }}
            >
                <div
                    style={{
                        padding: "20px 20px 12px",
                        borderBottom: "1px solid var(--hms-gray-200)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate("/doctors")}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: "var(--hms-gray-500)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            fontFamily: "var(--hms-font-family)",
                        }}
                    >
                        <ChevronLeft size={14} /> Back to doctors
                    </button>
                    {canEdit && (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="hms-btn-icon"
                            aria-label="Edit doctor"
                        >
                            <Edit2 size={14} />
                        </button>
                    )}
                </div>

                <div
                    style={{
                        padding: "24px 20px",
                        textAlign: "center",
                        borderBottom: "1px solid var(--hms-gray-200)",
                    }}
                >
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 999,
                            background: "var(--hms-info-bg)",
                            color: "#0369a1",
                            border: "1px solid var(--hms-info-border)",
                            margin: "0 auto 12px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 22,
                            fontWeight: 800,
                        }}
                    >
                        {initials}
                    </div>
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 700,
                            color: "var(--hms-gray-900)",
                            lineHeight: 1.2,
                        }}
                    >
                        Dr. {doctor.firstName} {doctor.lastName}
                    </h2>
                    <p
                        style={{
                            margin: "4px 0 0",
                            fontSize: 13,
                            color: "var(--hms-gray-500)",
                        }}
                    >
                        {doctor.specialization || "General practitioner"}
                    </p>
                    <div style={{ marginTop: 12 }}>
                        <Badge tone={doctor.userIsActive ? "success" : "danger"} soft>
                            {doctor.userIsActive && (
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: 999,
                                        background: "var(--hms-success)",
                                        marginRight: 4,
                                    }}
                                />
                            )}
                            {doctor.userIsActive ? "Active" : "Inactive"}
                        </Badge>
                    </div>
                    {doctor.medicalRegistrationNumber && (
                        <p
                            style={{
                                margin: "12px 0 0",
                                fontSize: 11,
                                color: "var(--hms-gray-400)",
                            }}
                        >
                            {doctor.medicalRegistrationNumber}
                        </p>
                    )}
                </div>

                <div
                    style={{
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 24,
                        flex: 1,
                    }}
                >
                    <div>
                        <SectionHead icon={User} title="Contact info" />
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <SideInfoRow icon={Mail} label="Email" value={doctor.email} />
                            <SideInfoRow icon={Phone} label="Phone" value={doctor.phone} />
                            <SideInfoRow
                                icon={BookOpen}
                                label="Qualification"
                                value={doctor.qualification}
                            />
                        </div>
                    </div>
                    <div>
                        <SectionHead icon={Stethoscope} title="Practice info" />
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <SideInfoRow
                                icon={Banknote}
                                label="Consultation fee"
                                value={
                                    doctor.consultationFee != null
                                        ? `₹${doctor.consultationFee.toFixed(2)}`
                                        : null
                                }
                            />
                            <SideInfoRow
                                icon={Clock}
                                label="Slot duration"
                                value={
                                    doctor.slotDurationMin
                                        ? `${doctor.slotDurationMin} mins`
                                        : null
                                }
                            />
                            <SideInfoRow
                                icon={Calendar}
                                label="Max daily slots"
                                value={
                                    doctor.maxDailySlots != null
                                        ? String(doctor.maxDailySlots)
                                        : null
                                }
                            />
                        </div>
                    </div>
                </div>
            </aside>

            {/* RIGHT PANE */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    background: "var(--hms-gray-50)",
                }}
            >
                {/* Tab bar */}
                <div
                    style={{
                        padding: "20px 24px 0",
                        background: "var(--hms-white)",
                        borderBottom: "1px solid var(--hms-gray-200)",
                        flexShrink: 0,
                    }}
                >
                    <Tabs
                        type="underline"
                        active={tab}
                        onChange={setTab}
                        tabs={TAB_DEFS}
                    />
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                    {tab === "overview" && (
                        <OverviewTab
                            doctor={doctor}
                            loadingAppointments={loadingAppointments}
                            nextAppointment={nextAppointment}
                            completedCount={completedCount}
                            scheduledCount={scheduledCount}
                            doctorPatients={doctorPatients}
                            setTab={setTab}
                        />
                    )}
                    {tab === "appointments" && (
                        <AppointmentsTab
                            doctor={doctor}
                            loading={loadingAppointments}
                            appointments={doctorAppointments}
                        />
                    )}
                    {tab === "patients" && (
                        <PatientsTab
                            loading={loadingAppointments}
                            patients={doctorPatients}
                            navigate={navigate}
                        />
                    )}
                    {tab === "schedule" && (
                        <ScheduleTab
                            doctor={doctor}
                            canEdit={canEdit}
                            scheduleSlots={scheduleSlots}
                            scheduleLoading={scheduleLoading}
                            scheduleSaving={scheduleSaving}
                            updateSlot={updateSlot}
                            saveSchedule={saveSchedule}
                            openEdit={() => setEditing(true)}
                        />
                    )}
                </div>
            </div>

            {editing && (
                <DoctorFormModal
                    editDoctor={doctor}
                    onClose={() => setEditing(false)}
                    onSaved={() => {
                        setEditing(false);
                        loadData();
                    }}
                />
            )}
        </div>
    );
}

/* ─────────────────────────── OVERVIEW TAB ─────────────────────────── */
function OverviewTab({
    doctor,
    loadingAppointments,
    nextAppointment,
    completedCount,
    scheduledCount,
    doctorPatients,
    setTab,
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1024 }}>
            {/* 3 stat cards */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                }}
            >
                <Card>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: "var(--hms-gray-500)",
                            marginBottom: 8,
                        }}
                    >
                        <Calendar size={14} /> Next appointment
                    </div>
                    {loadingAppointments ? (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--hms-gray-500)" }}>
                            Loading…
                        </p>
                    ) : nextAppointment ? (
                        <>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: "var(--hms-gray-900)",
                                }}
                            >
                                {nextAppointment.apptDate.substring(0, 10)},{" "}
                                {nextAppointment.apptTime.substring(0, 5)}
                            </p>
                            <p
                                style={{
                                    margin: "4px 0 0",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--hms-gray-500)",
                                }}
                            >
                                {nextAppointment.type}
                            </p>
                            <p
                                style={{
                                    margin: "2px 0 0",
                                    fontSize: 12,
                                    color: "var(--hms-gray-500)",
                                }}
                            >
                                {nextAppointment.patientName}
                            </p>
                        </>
                    ) : (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--hms-gray-500)" }}>
                            No upcoming appointment
                        </p>
                    )}
                </Card>
                <Card>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: "var(--hms-gray-500)",
                            marginBottom: 8,
                        }}
                    >
                        <CheckCircle size={14} /> Completed
                    </div>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 700,
                            color: "var(--hms-gray-900)",
                        }}
                    >
                        {loadingAppointments ? "…" : completedCount} appointments
                    </p>
                    {!loadingAppointments && scheduledCount > 0 && (
                        <p
                            style={{
                                margin: "4px 0 0",
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            {scheduledCount} upcoming scheduled
                        </p>
                    )}
                    {!loadingAppointments && completedCount === 0 && (
                        <p
                            style={{
                                margin: "4px 0 0",
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            None yet
                        </p>
                    )}
                </Card>
                <Card>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: "var(--hms-gray-500)",
                            marginBottom: 8,
                        }}
                    >
                        <Users size={14} /> Patients
                    </div>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 700,
                            color: "var(--hms-gray-900)",
                        }}
                    >
                        {loadingAppointments ? "…" : doctorPatients.length} unique patients
                    </p>
                    {!loadingAppointments && doctorPatients.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setTab("patients")}
                            style={{
                                marginTop: 6,
                                fontSize: 11,
                                color: "var(--hms-info)",
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                fontFamily: "var(--hms-font-family)",
                            }}
                        >
                            View all →
                        </button>
                    )}
                    {!loadingAppointments && doctorPatients.length === 0 && (
                        <p
                            style={{
                                margin: "4px 0 0",
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            None yet
                        </p>
                    )}
                </Card>
            </div>

            {/* Billing & Schedule */}
            <Card style={{ padding: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--hms-gray-100)",
                    }}
                >
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            background: "var(--hms-success-bg)",
                            color: "var(--hms-success)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Banknote size={14} />
                    </div>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--hms-gray-800)",
                        }}
                    >
                        Billing & schedule
                    </h3>
                </div>
                <div style={{ padding: 20 }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                            gap: 12,
                            marginBottom: 20,
                        }}
                    >
                        <FeeTile
                            label="Consultation fee"
                            value={`₹${doctor.consultationFee?.toFixed(2) || "0.00"}`}
                            tone="success"
                        />
                        <FeeTile
                            label="Follow-up fee"
                            value={`₹${doctor.followUpFee?.toFixed(2) || "0.00"}`}
                            tone="success"
                        />
                        <FeeTile
                            label="Slot duration"
                            value={`${doctor.slotDurationMin || 0} mins`}
                            icon={<Clock size={14} />}
                        />
                        <FeeTile
                            label="Max daily slots"
                            value={String(doctor.maxDailySlots || 0)}
                        />
                    </div>
                    <div>
                        <p
                            style={{
                                margin: "0 0 10px",
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--hms-gray-400)",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}
                        >
                            Available days
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {DAYS.map(({ short, bit }) => {
                                const isAvailable = !!((doctor.availableDaysMask ?? 0) & bit);
                                return (
                                    <div
                                        key={bit}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                            padding: "6px 12px",
                                            borderRadius: 8,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            background: isAvailable
                                                ? "var(--hms-info-bg)"
                                                : "var(--hms-gray-50)",
                                            color: isAvailable
                                                ? "#0369a1"
                                                : "var(--hms-gray-400)",
                                            border: `1px solid ${isAvailable
                                                ? "var(--hms-info-border)"
                                                : "var(--hms-gray-200)"
                                                }`,
                                        }}
                                    >
                                        {isAvailable && <CheckCircle size={12} />}
                                        {short}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Medical Registration */}
            <Card style={{ padding: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--hms-gray-100)",
                    }}
                >
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            background: "var(--hms-info-bg)",
                            color: "var(--hms-info)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Stethoscope size={14} />
                    </div>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--hms-gray-800)",
                        }}
                    >
                        Medical registration
                    </h3>
                </div>
                <div
                    style={{
                        padding: 20,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 20,
                    }}
                >
                    <KV
                        label="Registration number"
                        value={doctor.medicalRegistrationNumber || "Not specified"}
                    />
                    <KV
                        label="Registration council"
                        value={doctor.registrationCouncil || "Not specified"}
                    />
                </div>
            </Card>
        </div>
    );
}

function FeeTile({ label, value, tone, icon }) {
    const isAccent = tone === "success";
    return (
        <div
            style={{
                padding: 14,
                background: isAccent ? "var(--hms-success-bg)" : "var(--hms-gray-50)",
                borderRadius: 8,
                border: `1px solid ${isAccent ? "var(--hms-success-border)" : "var(--hms-gray-200)"}`,
            }}
        >
            <p
                style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    color: isAccent ? "#166534" : "var(--hms-gray-500)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                }}
            >
                {label}
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {icon && <span style={{ color: "var(--hms-gray-400)" }}>{icon}</span>}
                <p
                    style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--hms-gray-900)",
                    }}
                >
                    {value}
                </p>
            </div>
        </div>
    );
}

function KV({ label, value }) {
    return (
        <div>
            <p
                style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--hms-gray-400)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                }}
            >
                {label}
            </p>
            <p
                style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--hms-gray-800)",
                }}
            >
                {value}
            </p>
        </div>
    );
}

/* ─────────────────────────── APPOINTMENTS TAB ─────────────────────────── */
function AppointmentsTab({ doctor, loading, appointments }) {
    return (
        <div style={{ maxWidth: 1024 }}>
            <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--hms-gray-800)" }}>
                    Appointments
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--hms-gray-500)" }}>
                    {appointments.length} appointment{appointments.length !== 1 ? "s" : ""} for Dr.{" "}
                    {doctor.firstName}
                </p>
            </div>
            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
                    <Loader2 size={28} style={{ color: "var(--hms-info)" }} className="animate-spin" />
                </div>
            ) : appointments.length === 0 ? (
                <CenterEmpty
                    icon={<CalendarIcon size={36} />}
                    title="No appointments"
                    description="This doctor has no recorded appointments yet."
                />
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: 16,
                    }}
                >
                    {appointments.slice(0, 50).map((appt) => {
                        const tone = statusTone(appt.status);
                        return (
                            <Card key={appt.id} style={{ padding: 20, position: "relative", overflow: "hidden", gap: 12 }}>
                                <div
                                    style={{
                                        position: "absolute",
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: 4,
                                        background: STATUS_STRIPE[tone],
                                    }}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--hms-gray-800)" }}>
                                            {appt.apptDate.substring(0, 10)}
                                        </p>
                                        <p
                                            style={{
                                                margin: "4px 0 0",
                                                fontSize: 13,
                                                color: "var(--hms-gray-500)",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            <Clock size={14} /> {appt.apptTime.substring(0, 5)}
                                        </p>
                                    </div>
                                    <Badge tone={tone} soft>
                                        {appt.status.replace(/_/g, " ")}
                                    </Badge>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 999,
                                            background: "var(--hms-gray-100)",
                                            color: "var(--hms-gray-700)",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: 700,
                                            fontSize: 12,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {appt.patientName.charAt(0)}
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--hms-gray-800)" }}>
                                            {appt.patientName}
                                        </p>
                                        <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>{appt.type}</p>
                                    </div>
                                </div>
                                {appt.chiefComplaint && (
                                    <div
                                        style={{
                                            background: "var(--hms-gray-50)",
                                            padding: 12,
                                            borderRadius: 8,
                                            border: "1px solid var(--hms-gray-100)",
                                        }}
                                    >
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: "var(--hms-gray-400)",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                            }}
                                        >
                                            Reason for visit
                                        </p>
                                        <p
                                            style={{
                                                margin: "4px 0 0",
                                                fontSize: 12,
                                                color: "var(--hms-gray-700)",
                                                lineHeight: 1.5,
                                                fontStyle: "italic",
                                            }}
                                        >
                                            "{appt.chiefComplaint}"
                                        </p>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────── PATIENTS TAB ─────────────────────────── */
function PatientsTab({ loading, patients, navigate }) {
    return (
        <div style={{ maxWidth: 1024 }}>
            <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--hms-gray-800)" }}>
                    Associated patients
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--hms-gray-500)" }}>
                    {patients.length} patient{patients.length !== 1 ? "s" : ""} have visited
                </p>
            </div>
            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
                    <Loader2 size={28} className="animate-spin" />
                </div>
            ) : patients.length === 0 ? (
                <CenterEmpty
                    icon={<Building2 size={36} />}
                    title="No patients found"
                    description="There are no patients associated with this doctor yet."
                />
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: 16,
                    }}
                >
                    {patients.slice(0, 50).map((patient, idx) => (
                        <Card
                            key={idx}
                            interactive
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
                        >
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 999,
                                    background: "var(--hms-gray-100)",
                                    border: "1px solid var(--hms-gray-200)",
                                    color: "var(--hms-gray-700)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    fontSize: 14,
                                    flexShrink: 0,
                                }}
                            >
                                {patient.name.charAt(0)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "var(--hms-gray-900)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {patient.name}
                                </p>
                                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--hms-gray-500)" }}>
                                    Visits: {patient.visits} · Last: {patient.lastVisit}
                                </p>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────── SCHEDULE TAB ─────────────────────────── */
function ScheduleTab({
    doctor,
    canEdit,
    scheduleSlots,
    scheduleLoading,
    scheduleSaving,
    updateSlot,
    saveSchedule,
    openEdit,
}) {
    return (
        <div style={{ maxWidth: 760 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                }}
            >
                <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--hms-gray-800)" }}>
                        Availability schedule
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--hms-gray-500)" }}>
                        Configure working hours and slot settings for each day.
                    </p>
                </div>
                {canEdit && (
                    <Button
                        variant="primary"
                        onClick={saveSchedule}
                        disabled={scheduleSaving || scheduleLoading}
                        loading={scheduleSaving}
                    >
                        <Save size={14} /> Save schedule
                    </Button>
                )}
            </div>

            {scheduleLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
                    <Loader2 size={28} style={{ color: "var(--hms-info)" }} className="animate-spin" />
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {DAYS.map(({ label, bit, idx }) => {
                        const isEnabled = !!((doctor.availableDaysMask ?? 0) & bit);
                        const slot = scheduleSlots[idx];
                        return (
                            <div
                                key={idx}
                                style={{
                                    borderRadius: 12,
                                    border: "1px solid var(--hms-gray-200)",
                                    background: isEnabled
                                        ? "var(--hms-white)"
                                        : "var(--hms-gray-50)",
                                    opacity: isEnabled ? 1 : 0.6,
                                    transition: "all 0.15s",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 16,
                                        padding: "16px 20px",
                                    }}
                                >
                                    <div style={{ width: 112, flexShrink: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 999,
                                                    background: isEnabled
                                                        ? "var(--hms-success)"
                                                        : "var(--hms-gray-300)",
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: "var(--hms-gray-700)",
                                                }}
                                            >
                                                {label}
                                            </span>
                                        </div>
                                        {!isEnabled && (
                                            <p
                                                style={{
                                                    margin: "4px 0 0 16px",
                                                    fontSize: 10,
                                                    color: "var(--hms-gray-400)",
                                                }}
                                            >
                                                Not available
                                            </p>
                                        )}
                                    </div>

                                    {isEnabled && slot ? (
                                        <div
                                            style={{
                                                flex: 1,
                                                display: "grid",
                                                gridTemplateColumns: "repeat(4, 1fr)",
                                                gap: 12,
                                            }}
                                        >
                                            <SlotField
                                                label="Start time"
                                                control={
                                                    <Input
                                                        type="time"
                                                        value={slot.startTime || "09:00"}
                                                        onChange={(e) =>
                                                            updateSlot(idx, "startTime", e.target.value)
                                                        }
                                                        disabled={!canEdit}
                                                    />
                                                }
                                            />
                                            <SlotField
                                                label="End time"
                                                control={
                                                    <Input
                                                        type="time"
                                                        value={slot.endTime || "17:00"}
                                                        onChange={(e) =>
                                                            updateSlot(idx, "endTime", e.target.value)
                                                        }
                                                        disabled={!canEdit}
                                                    />
                                                }
                                            />
                                            <SlotField
                                                label="Slot (min)"
                                                control={
                                                    <Input
                                                        type="number"
                                                        min="5"
                                                        step="5"
                                                        value={slot.slotDurationMins || ""}
                                                        onChange={(e) =>
                                                            updateSlot(
                                                                idx,
                                                                "slotDurationMins",
                                                                parseInt(e.target.value) || 0
                                                            )
                                                        }
                                                        disabled={!canEdit}
                                                    />
                                                }
                                            />
                                            <SlotField
                                                label="Max slots"
                                                control={
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={slot.maxDailySlots || ""}
                                                        onChange={(e) =>
                                                            updateSlot(
                                                                idx,
                                                                "maxDailySlots",
                                                                parseInt(e.target.value) || 0
                                                            )
                                                        }
                                                        disabled={!canEdit}
                                                    />
                                                }
                                            />
                                        </div>
                                    ) : isEnabled ? (
                                        <p style={{ margin: 0, fontSize: 12, color: "var(--hms-gray-400)" }}>
                                            Loading…
                                        </p>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: 12, color: "var(--hms-gray-400)" }}>
                                            Enable this day from{" "}
                                            <button
                                                type="button"
                                                onClick={openEdit}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    padding: 0,
                                                    color: "var(--hms-gray-600)",
                                                    textDecoration: "underline",
                                                    cursor: "pointer",
                                                    font: "inherit",
                                                }}
                                            >
                                                Edit doctor
                                            </button>
                                        </p>
                                    )}
                                </div>

                                {isEnabled && slot?.startTime && slot?.endTime && slot?.slotDurationMins > 0 && (
                                    <SchedulePreview slot={slot} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {!scheduleLoading && Object.keys(scheduleSlots).length === 0 && (
                <CenterEmpty
                    icon={<Clock size={36} />}
                    title="No days enabled"
                    description={
                        <>
                            Use{" "}
                            <button
                                type="button"
                                onClick={openEdit}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                    color: "var(--hms-gray-600)",
                                    textDecoration: "underline",
                                    cursor: "pointer",
                                    font: "inherit",
                                }}
                            >
                                Edit doctor
                            </button>{" "}
                            to enable available days first.
                        </>
                    }
                />
            )}
        </div>
    );
}

function SlotField({ label, control }) {
    return (
        <div>
            <p
                style={{
                    margin: "0 0 4px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--hms-gray-400)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </p>
            {control}
        </div>
    );
}

/** Computes the windowed slot count + capped slots for a single day. */
function SchedulePreview({ slot }) {
    const [sh, sm] = slot.startTime.split(":").map(Number);
    const [eh, em] = slot.endTime.split(":").map(Number);
    const totalMins = eh * 60 + em - (sh * 60 + sm);
    let summary;
    if (totalMins <= 0) {
        summary = "Invalid time range";
    } else {
        const possible = Math.floor(totalMins / slot.slotDurationMins);
        const actual = Math.min(possible, slot.maxDailySlots || possible);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        summary = `${hrs > 0 ? `${hrs}h ` : ""}${mins > 0 ? `${mins}m` : ""} window · ${possible} possible slots · ${actual} capped`;
    }
    return (
        <div style={{ padding: "0 20px 12px" }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 12px",
                    background: "var(--hms-gray-50)",
                    borderRadius: 8,
                    border: "1px solid var(--hms-gray-100)",
                    fontSize: 11,
                    color: "var(--hms-gray-500)",
                }}
            >
                <CalendarDays size={14} style={{ flexShrink: 0 }} />
                <span>{summary}</span>
            </div>
        </div>
    );
}

function CenterEmpty({ icon, title, description }) {
    return (
        <div style={{ padding: "64px 0", textAlign: "center" }}>
            <div style={{ color: "var(--hms-gray-300)", marginBottom: 12 }}>{icon}</div>
            <p
                style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--hms-gray-500)",
                }}
            >
                {title}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--hms-gray-400)" }}>
                {description}
            </p>
        </div>
    );
}

export { DoctorDetails as default };
