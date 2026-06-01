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

/** Stat card icon palette — page-local; not part of the design-system
 *  tone set. Each entry sets a background, an icon color, and the value
 *  color through a single .is-* modifier on .hms-admit-stat__icon. */
const STAT_ICON_MOD = {
    admitted: "is-admitted",
    ot:       "is-ot",
    today:    "is-today",
    overdue:  "is-overdue",
};

/** Admission type pill — rendered above the status badge. */
function TypePill({ type }) {
    if (type === "EMERGENCY") {
        return <span className="hms-emergency-pill">EMERGENCY</span>;
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
 * Layout pieces live in admin.css under .hms-admit-*. Status accents
 * (overdue / inOt) flip a .is-overdue / .is-ot modifier on the card.
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
        { label: "Active admissions", value: counts.ADMITTED,         icon: BedDouble,   mod: STAT_ICON_MOD.admitted },
        { label: "In OT now",         value: counts.inOt,              icon: Scissors,    mod: STAT_ICON_MOD.ot },
        { label: "Discharged today",  value: counts.dischargedToday,   icon: CheckCircle2, mod: STAT_ICON_MOD.today },
        { label: "Overdue discharge", value: counts.overdueDischarge,  icon: AlertCircle, mod: STAT_ICON_MOD.overdue },
    ];

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={
                    <span className="inline-flex items-center gap-2.5">
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

            <div className="hms-page-content">
                {/* Stat cards */}
                <div className="hms-admit-stat-grid">
                    {statCards.map(({ label, value, icon: Icon, mod }) => (
                        <Card key={label} className="hms-admit-stat-card">
                            <div className={`hms-admit-stat__icon ${mod}`}>
                                <Icon size={20} />
                            </div>
                            <div>
                                <p className="hms-admit-stat__value">{value}</p>
                                <p className="hms-admit-stat__label">{label}</p>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Filter row */}
                <div className="hms-admit-filter">
                    <div className="hms-admit-filter__search">
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
                    <div className="hms-view-toggle">
                        {[
                            ["grid", LayoutGrid],
                            ["list", List],
                        ].map(([mode, Icon]) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setViewMode(mode)}
                                className={`hms-view-toggle__btn ${viewMode === mode ? "is-active" : ""}`}
                                aria-pressed={viewMode === mode}
                                aria-label={`${mode} view`}
                            >
                                <Icon size={16} />
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="hms-admit-state">Loading admissions…</div>
                ) : admissions.length === 0 ? (
                    <div className="hms-admit-state is-empty">
                        <BedDouble size={48} className="opacity-30" />
                        <p className="m-0 text-13">No admissions found</p>
                        <button
                            type="button"
                            onClick={() => setShowAdmitModal(true)}
                            className="hms-admit-state__cta"
                        >
                            Admit a patient →
                        </button>
                    </div>
                ) : viewMode === "grid" ? (
                    <div className="hms-admit-card-grid">
                        {admissions.map((a) => {
                            const overdue = isOverdue(a);
                            const cardMod = overdue ? "is-overdue" : a.inOt ? "is-ot" : "";
                            return (
                                <Card
                                    key={a.id}
                                    interactive
                                    onClick={() => setSelectedAdmission(a)}
                                    className={`hms-admit-card ${cardMod}`}
                                >
                                    <div className="hms-admit-card__head">
                                        <div className="hms-admit-card__patient">
                                            <span className="hms-admit-card__avatar">
                                                <User size={18} />
                                            </span>
                                            <div>
                                                <p className="hms-admit-card__name">
                                                    {a.patientName}
                                                </p>
                                                <p className="hms-admit-card__uhid">
                                                    UHID: {fmtId(a.patientUhid)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="hms-admit-card__pills">
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
                                    <div className="hms-admit-card__body">
                                        <div className="hms-admit-card__row">
                                            <Building2 size={14} className="shrink-0" />
                                            <span>{a.departmentName || "No department"}</span>
                                        </div>
                                        <div className="hms-admit-card__row">
                                            <BedDouble size={14} className="shrink-0" />
                                            <span>{a.roomNumber ? roomLabel(a) : "Room not assigned"}</span>
                                        </div>
                                        <div className="hms-admit-card__row">
                                            <Stethoscope size={14} className="shrink-0" />
                                            <span>
                                                {a.admittingDoctorName
                                                    ? `Dr. ${a.admittingDoctorName}`
                                                    : "No doctor assigned"}
                                            </span>
                                        </div>
                                        <div className="hms-admit-card__row">
                                            <Clock size={14} className="shrink-0" />
                                            <span>{timeAgo(a.admissionDate)}</span>
                                            {overdue && (
                                                <span className="hms-admit-overdue-text">· Overdue</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="hms-admit-card__footer">
                                        <Badge tone={STATUS_TONE[a.status] || "neutral"} soft>
                                            {a.status}
                                        </Badge>
                                        <div className="hms-admit-card__ids">
                                            {a.ipdId && (
                                                <p className="hms-admit-card__ipd">{fmtId(a.ipdId)}</p>
                                            )}
                                            <p className="hms-admit-card__no">{fmtId(a.admissionNumber)}</p>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <Card className="hms-admit-table-card">
                        <div className="hms-admit-table-wrap">
                            <table className="hms-admit-table">
                                <thead>
                                    <tr>
                                        {[
                                            "Adm. no.",
                                            "Patient",
                                            "Department",
                                            "Room",
                                            "Doctor",
                                            "Admitted",
                                            "Status",
                                        ].map((h) => (
                                            <th key={h}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {admissions.map((a) => {
                                        const overdue = isOverdue(a);
                                        const rowMod = overdue ? "is-overdue" : a.inOt ? "is-ot" : "";
                                        return (
                                            <tr
                                                key={a.id}
                                                onClick={() => setSelectedAdmission(a)}
                                                className={rowMod}
                                            >
                                                <td>
                                                    {a.ipdId && (
                                                        <p className="hms-admit-table__id-primary">
                                                            {fmtId(a.ipdId)}
                                                        </p>
                                                    )}
                                                    <p className="hms-admit-table__id-secondary">
                                                        {fmtId(a.admissionNumber)}
                                                    </p>
                                                </td>
                                                <td>
                                                    <p className="hms-admit-table__name">{a.patientName}</p>
                                                    <p className="hms-admit-table__sub">
                                                        {fmtId(a.patientUhid)}
                                                    </p>
                                                </td>
                                                <td className="hms-admit-table__text">
                                                    {a.departmentName || "—"}
                                                </td>
                                                <td>
                                                    <p className="hms-admit-table__text m-0">
                                                        {a.roomNumber || (
                                                            <span className="hms-admit-no-room">
                                                                Not assigned
                                                            </span>
                                                        )}
                                                    </p>
                                                    {a.inOt && (
                                                        <span className="hms-admit-ot-text">
                                                            <Scissors size={12} /> In OT
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="hms-admit-table__text">
                                                    {a.admittingDoctorName ? `Dr. ${a.admittingDoctorName}` : "—"}
                                                </td>
                                                <td
                                                    className="hms-admit-table__text-sm"
                                                    title={fmtDateTime(a.admissionDate)}
                                                >
                                                    {timeAgo(a.admissionDate)}
                                                </td>
                                                <td>
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
