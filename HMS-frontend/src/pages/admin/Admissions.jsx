import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { admissionApi } from "@/utils/api";
import AdmitPatientModal from "./AdmitPatientModal";
import DischargeModal from "./DischargeModal";
import MoveToOTModal from "./MoveToOTModal";
import ViewBillingModal from "./ViewBillingModal";
import IPDDetailPane from "./IPDDetailPane";
import {
    BedDouble,
    Plus,
    User,
    Building2,
    Stethoscope,
    Clock,
    CheckCircle2,
    List,
    LayoutGrid,
    AlertCircle,
    Scissors,
} from "lucide-react";
import { timeAgo, fmtDateTime } from "@/utils/date";
import { fmtId } from "@/utils/idFormat";
import {
    Badge,
    Button,
    Card,
    PageHeader,
    Pagination,
    SearchBar,
    Tabs,
} from "@/components/ui";

/** Status → Badge tone. ADMITTED green, DISCHARGED neutral,
 *  TRANSFERRED warning, ABSCONDED danger. */
const STATUS_TONE = {
    ADMITTED: "success",
    DISCHARGED: "neutral",
    TRANSFERRED: "warning",
    ABSCONDED: "danger",
};

/** Admission type pill — rendered above the status badge. */
function TypePill({ type }) {
    if (type === "EMERGENCY") {
        return (
            <span
                style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--hms-danger)",
                    color: "var(--hms-white)",
                    fontSize: 10,
                    fontWeight: 700,
                }}
            >
                EMERGENCY
            </span>
        );
    }
    if (type === "OPD_REFERRAL") {
        return <Badge tone="info" soft>OPD referral</Badge>;
    }
    return <Badge tone="neutral" soft>Direct</Badge>;
}

/**
 * IPD Admissions — paginated, filterable list of in-patient admissions
 * with grid/list view toggle, four stat cards, and a modal cascade
 * (admit → discharge / move-to-OT / view-billing / detail pane).
 *
 * Phase 8c migration: data layer untouched (admissionApi.listPaginated/
 * returnToWard), same status filter trio (ADMITTED / DISCHARGED / ALL),
 * debounced search, server-driven counts. Modal opening/closing logic
 * preserved byte-for-byte.
 */
export default function Admissions() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ADMITTED");
    const [viewMode, setViewMode] = useState("grid");
    const [showAdmitModal, setShowAdmitModal] = useState(false);
    const [dischargeTarget, setDischargeTarget] = useState(null);
    const [otTarget, setOtTarget] = useState(null);
    const [billingTarget, setBillingTarget] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [returningToWard, setReturningToWard] = useState(null);
    const [selectedAdmission, setSelectedAdmission] = useState(null);

    // Pagination
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(30);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Stats counts (server-side)
    const [serverCounts, setServerCounts] = useState({
        ADMITTED: 0,
        inOt: 0,
        dischargedToday: 0,
        overdueDischarge: 0,
    });

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const load = async () => {
        if (!user?.hospitalId) return;
        try {
            setLoading(true);
            const res = await admissionApi.listPaginated(
                user.hospitalId,
                statusFilter,
                debouncedSearch,
                page,
                size
            );
            if (res) {
                setAdmissions(res.page?.content || []);
                setTotalPages(res.page?.totalPages || 0);
                setTotalElements(res.page?.totalElements || 0);
                setServerCounts({
                    ADMITTED: res.totalAdmitted || 0,
                    inOt: res.totalInOt || 0,
                    dischargedToday: res.dischargedToday || 0,
                    overdueDischarge: res.overdueDischarge || 0,
                });
            }
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to load admissions", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.hospitalId, statusFilter, debouncedSearch, page, size]);

    const counts = useMemo(
        () => ({
            ADMITTED: serverCounts.ADMITTED,
            inOt: serverCounts.inOt,
            dischargedToday: serverCounts.dischargedToday,
            overdueDischarge: serverCounts.overdueDischarge,
        }),
        [serverCounts]
    );

    const isOverdue = (a) => {
        if (!a.approxDischargeDate || a.status !== "ADMITTED") return false;
        return new Date(a.approxDischargeDate) < new Date();
    };

    const roomLabel = (a) => {
        if (!a.roomNumber) return "Room not assigned";
        return `Room ${a.roomNumber} · ${a.roomType}`;
    };

    const statCards = [
        {
            label: "Active admissions",
            value: counts.ADMITTED,
            icon: BedDouble,
            color: "var(--hms-success)",
            bg: "var(--hms-success-bg)",
        },
        {
            label: "In OT now",
            value: counts.inOt,
            icon: Scissors,
            color: "#7c3aed",
            bg: "#f5f3ff",
        },
        {
            label: "Discharged today",
            value: counts.dischargedToday,
            icon: CheckCircle2,
            color: "var(--hms-info)",
            bg: "var(--hms-info-bg)",
        },
        {
            label: "Overdue discharge",
            value: counts.overdueDischarge,
            icon: AlertCircle,
            color: "#be123c",
            bg: "#fff1f2",
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <BedDouble size={20} /> IPD Admissions
                    </span>
                }
                subtitle="In-patient department — active admissions and discharge management"
                actions={
                    <Button variant="primary" onClick={() => setShowAdmitModal(true)}>
                        <Plus size={14} strokeWidth={2.4} /> Admit patient
                    </Button>
                }
            />

            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Stat cards */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                    }}
                >
                    {statCards.map(({ label, value, icon: Icon, color, bg }) => (
                        <Card
                            key={label}
                            style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
                        >
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 8,
                                    background: bg,
                                    color,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <Icon size={20} />
                            </div>
                            <div>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 22,
                                        fontWeight: 800,
                                        color: "var(--hms-gray-900)",
                                    }}
                                >
                                    {value}
                                </p>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 11,
                                        color: "var(--hms-gray-500)",
                                    }}
                                >
                                    {label}
                                </p>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Filter row */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <SearchBar
                            value={search}
                            onChange={setSearch}
                            placeholder="Search by patient, admission no., department, room…"
                        />
                    </div>
                    <Tabs
                        type="pill"
                        active={statusFilter}
                        onChange={(id) => {
                            setStatusFilter(id);
                            setPage(0);
                        }}
                        tabs={[
                            {
                                id: "ADMITTED",
                                label: "Admitted",
                                count: counts.ADMITTED > 0 ? counts.ADMITTED : undefined,
                            },
                            { id: "DISCHARGED", label: "Discharged" },
                            { id: "ALL", label: "All" },
                        ]}
                    />
                    <div
                        style={{
                            display: "flex",
                            border: "1px solid var(--hms-gray-200)",
                            borderRadius: 8,
                            overflow: "hidden",
                        }}
                    >
                        {[
                            ["grid", LayoutGrid],
                            ["list", List],
                        ].map(([mode, Icon]) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setViewMode(mode)}
                                style={{
                                    padding: 10,
                                    border: "none",
                                    cursor: "pointer",
                                    background:
                                        viewMode === mode
                                            ? "var(--hms-brand-primary)"
                                            : "var(--hms-white)",
                                    color:
                                        viewMode === mode
                                            ? "var(--hms-white)"
                                            : "var(--hms-gray-500)",
                                    transition: "background 0.15s",
                                }}
                                aria-pressed={viewMode === mode}
                                aria-label={`${mode} view`}
                            >
                                <Icon size={16} />
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--hms-gray-400)",
                            padding: "64px 0",
                        }}
                    >
                        Loading admissions…
                    </div>
                ) : admissions.length === 0 ? (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 12,
                            color: "var(--hms-gray-400)",
                            padding: "64px 0",
                        }}
                    >
                        <BedDouble size={48} style={{ opacity: 0.3 }} />
                        <p style={{ margin: 0, fontSize: 13 }}>No admissions found</p>
                        <button
                            type="button"
                            onClick={() => setShowAdmitModal(true)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--hms-gray-900)",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                textDecoration: "underline",
                                fontFamily: "var(--hms-font-family)",
                            }}
                        >
                            Admit a patient →
                        </button>
                    </div>
                ) : viewMode === "grid" ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                            gap: 16,
                        }}
                    >
                        {admissions.map((a) => {
                            const overdue = isOverdue(a);
                            return (
                                <Card
                                    key={a.id}
                                    interactive
                                    onClick={() => setSelectedAdmission(a)}
                                    style={{
                                        padding: 16,
                                        position: "relative",
                                        gap: 12,
                                        borderLeft: overdue
                                            ? "4px solid #fb7185"
                                            : a.inOt
                                                ? "4px solid #7c3aed"
                                                : undefined,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 8,
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 8,
                                                    background: "var(--hms-gray-100)",
                                                    color: "var(--hms-gray-700)",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: "var(--hms-gray-900)",
                                                    }}
                                                >
                                                    {a.patientName}
                                                </p>
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 11,
                                                        color: "var(--hms-gray-500)",
                                                    }}
                                                >
                                                    UHID: {fmtId(a.patientUhid)}
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "flex-end",
                                                gap: 4,
                                            }}
                                        >
                                            <TypePill type={a.admissionType} />
                                            {a.inOt && (
                                                <Badge tone="violet" soft>
                                                    <Scissors size={10} /> In OT
                                                </Badge>
                                            )}
                                            {a.roomType === "POST_OT" && (
                                                <Badge tone="amber" soft>Recovery</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6,
                                            fontSize: 12,
                                            color: "var(--hms-gray-500)",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <Building2 size={14} style={{ flexShrink: 0 }} />
                                            <span>{a.departmentName || "No department"}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <BedDouble size={14} style={{ flexShrink: 0 }} />
                                            <span>{a.roomNumber ? roomLabel(a) : "Room not assigned"}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <Stethoscope size={14} style={{ flexShrink: 0 }} />
                                            <span>
                                                {a.admittingDoctorName
                                                    ? `Dr. ${a.admittingDoctorName}`
                                                    : "No doctor assigned"}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <Clock size={14} style={{ flexShrink: 0 }} />
                                            <span>{timeAgo(a.admissionDate)}</span>
                                            {overdue && (
                                                <span style={{ color: "#e11d48", fontWeight: 600 }}>· Overdue</span>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            paddingTop: 12,
                                            borderTop: "1px solid var(--hms-gray-100)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <Badge tone={STATUS_TONE[a.status] || "neutral"} soft>
                                            {a.status}
                                        </Badge>
                                        <div style={{ textAlign: "right" }}>
                                            {a.ipdId && (
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 11,
                                                        fontFamily:
                                                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                        fontWeight: 700,
                                                        color: "var(--hms-gray-900)",
                                                    }}
                                                >
                                                    {fmtId(a.ipdId)}
                                                </p>
                                            )}
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 10,
                                                    fontFamily:
                                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                    color: "var(--hms-gray-400)",
                                                }}
                                            >
                                                {fmtId(a.admissionNumber)}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <Card style={{ padding: 0, overflow: "hidden" }}>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr
                                        style={{
                                            borderBottom: "1px solid var(--hms-gray-100)",
                                            background: "var(--hms-gray-50)",
                                        }}
                                    >
                                        {[
                                            "Adm. no.",
                                            "Patient",
                                            "Department",
                                            "Room",
                                            "Doctor",
                                            "Admitted",
                                            "Status",
                                        ].map((h) => (
                                            <th
                                                key={h}
                                                style={{
                                                    padding: "10px 16px",
                                                    textAlign: "left",
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: "var(--hms-gray-500)",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.06em",
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {admissions.map((a) => {
                                        const overdue = isOverdue(a);
                                        return (
                                            <tr
                                                key={a.id}
                                                onClick={() => setSelectedAdmission(a)}
                                                style={{
                                                    borderBottom: "1px solid var(--hms-gray-100)",
                                                    cursor: "pointer",
                                                    borderLeft: overdue
                                                        ? "4px solid #fb7185"
                                                        : a.inOt
                                                            ? "4px solid #7c3aed"
                                                            : undefined,
                                                }}
                                            >
                                                <td style={{ padding: "10px 16px" }}>
                                                    {a.ipdId && (
                                                        <p
                                                            style={{
                                                                margin: 0,
                                                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                                color: "var(--hms-gray-900)",
                                                            }}
                                                        >
                                                            {fmtId(a.ipdId)}
                                                        </p>
                                                    )}
                                                    <p
                                                        style={{
                                                            margin: 0,
                                                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                            fontSize: 10,
                                                            color: "var(--hms-gray-400)",
                                                        }}
                                                    >
                                                        {fmtId(a.admissionNumber)}
                                                    </p>
                                                </td>
                                                <td style={{ padding: "10px 16px" }}>
                                                    <p
                                                        style={{
                                                            margin: 0,
                                                            fontSize: 13,
                                                            fontWeight: 500,
                                                            color: "var(--hms-gray-900)",
                                                        }}
                                                    >
                                                        {a.patientName}
                                                    </p>
                                                    <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>
                                                        {fmtId(a.patientUhid)}
                                                    </p>
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "10px 16px",
                                                        fontSize: 13,
                                                        color: "var(--hms-gray-600)",
                                                    }}
                                                >
                                                    {a.departmentName || "—"}
                                                </td>
                                                <td style={{ padding: "10px 16px" }}>
                                                    <p style={{ margin: 0, fontSize: 13, color: "var(--hms-gray-600)" }}>
                                                        {a.roomNumber || (
                                                            <span style={{ color: "var(--hms-warning)", fontSize: 11 }}>
                                                                Not assigned
                                                            </span>
                                                        )}
                                                    </p>
                                                    {a.inOt && (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                fontWeight: 600,
                                                                color: "#7c3aed",
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: 4,
                                                            }}
                                                        >
                                                            <Scissors size={12} /> In OT
                                                        </span>
                                                    )}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "10px 16px",
                                                        fontSize: 13,
                                                        color: "var(--hms-gray-600)",
                                                    }}
                                                >
                                                    {a.admittingDoctorName ? `Dr. ${a.admittingDoctorName}` : "—"}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "10px 16px",
                                                        fontSize: 11,
                                                        color: "var(--hms-gray-500)",
                                                    }}
                                                    title={fmtDateTime(a.admissionDate)}
                                                >
                                                    {timeAgo(a.admissionDate)}
                                                </td>
                                                <td style={{ padding: "10px 16px" }}>
                                                    <Badge tone={STATUS_TONE[a.status] || "neutral"} soft>
                                                        {a.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {!loading && totalElements > 0 && totalPages > 1 && (
                    <Pagination
                        currentPage={page + 1}
                        totalPages={totalPages}
                        totalItems={totalElements}
                        pageSize={size}
                        onPageChange={(p) => setPage(p - 1)}
                    />
                )}
            </div>

            {showAdmitModal && (
                <AdmitPatientModal
                    onClose={() => setShowAdmitModal(false)}
                    onAdmitted={() => {
                        setShowAdmitModal(false);
                        notify("Patient admitted successfully", "success");
                        load();
                    }}
                />
            )}
            {dischargeTarget && (
                <DischargeModal
                    admission={dischargeTarget}
                    onClose={() => setDischargeTarget(null)}
                    onDischarged={() => {
                        setDischargeTarget(null);
                        notify("Patient discharged", "success");
                        load();
                    }}
                />
            )}
            {otTarget && (
                <MoveToOTModal
                    admission={otTarget}
                    onClose={() => setOtTarget(null)}
                    onMoved={() => {
                        setOtTarget(null);
                        notify(`${otTarget.patientName} moved to OT`, "success");
                        load();
                    }}
                />
            )}
            {billingTarget && (
                <ViewBillingModal
                    admission={billingTarget}
                    onClose={() => setBillingTarget(null)}
                />
            )}

            {selectedAdmission && (
                <IPDDetailPane
                    admission={selectedAdmission}
                    onClose={() => setSelectedAdmission(null)}
                    onDischarge={() => {
                        setDischargeTarget(selectedAdmission);
                        setSelectedAdmission(null);
                    }}
                    onMoveToOT={() => {
                        setOtTarget(selectedAdmission);
                        setSelectedAdmission(null);
                    }}
                    onReturnToWard={async () => {
                        const a = selectedAdmission;
                        setSelectedAdmission(null);
                        setReturningToWard(a.id);
                        try {
                            await admissionApi.returnToWard(a.id);
                            notify(`${a.patientName} returned to ward`, "success");
                            load();
                        } catch (err) {
                            notify(
                                err?.response?.data?.message || "Failed to return to ward",
                                "error"
                            );
                        } finally {
                            setReturningToWard(null);
                        }
                    }}
                />
            )}
        </div>
    );
}
