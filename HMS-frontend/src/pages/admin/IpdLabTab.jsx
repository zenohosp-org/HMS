import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
    labOrderApi, radiologyApi, investigationsApi,
} from "@/utils/api";
import { useInvestigationCatalog } from "@/hooks/useInvestigationCatalog";
import RequestInvestigationForm from "@/components/investigations/RequestInvestigationForm";
import { CenterLoader } from "@/components/ui/Loader";
import {
    FlaskConical, ScanLine, Plus, CheckCircle2, Clock, AlertCircle,
    ChevronDown, ChevronUp, X, Beaker, IndianRupee,
} from "lucide-react";
import { fmtDateTime } from "@/utils/date";
import "@/styles/modules/ipd-lab.css";

// Unified status semantics across lab + radiology orders (per the labs
// contract). LAB starts at PENDING_COLLECTION, RADIOLOGY at PENDING_SCAN;
// both converge at AWAITING_REPORT → REPORT_GENERATED → BILLED.
const STATUS_META = {
    PENDING_COLLECTION: { label: "Pending",   cls: "is-pending"   },
    PENDING_SCAN:       { label: "Pending",   cls: "is-pending"   },
    AWAITING_REPORT:    { label: "Collected", cls: "is-collected" },
    REPORT_GENERATED:   { label: "Reported",  cls: "is-resulted"  },
    BILLED:             { label: "Billed",    cls: "is-resulted"  },
};

const PRIORITY_META = {
    ROUTINE: { label: "Routine", cls: "is-routine" },
    URGENT:  { label: "Urgent",  cls: "is-urgent"  },
    STAT:    { label: "STAT",    cls: "is-stat"    },
};

const STATUS_ORDER = {
    PENDING_COLLECTION: 0,
    PENDING_SCAN:       0,
    AWAITING_REPORT:    1,
    REPORT_GENERATED:   2,
    BILLED:             3,
};

const BLANK_REPORT_FORM = { findings: "", observation: "" };

export default function IpdLabTab({ admissionId, patientId, isDischarged }) {
    const { user } = useAuth();
    const { notify } = useNotification();

    const [orders, setOrders]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showForm, setShowForm]     = useState(false);

    // Top-level filter pill — All / Pathology / Radiology.
    const [kindFilter, setKindFilter] = useState("ALL");

    // Orderable investigation catalogue (labs lab_services for gated tenants,
    // legacy hospital_services otherwise) — shared hook, one fetch per
    // hospital-context, passed down to RequestInvestigationForm.
    const catalog = useInvestigationCatalog(user?.hospitalId);

    // Per-order report form state: { [orderId]: { open, saving, form } }
    const [reportPanels, setReportPanels] = useState({});

    // Unified read — labs service merges lab + radiology by patient/admission.
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await investigationsApi.byAdmission(admissionId);
            const sorted = (Array.isArray(data) ? data : []).sort(
                (a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)
            );
            setOrders(sorted);
        } catch {
            notify("Failed to load investigations", "error");
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    // Visible orders honor the kind filter pill.
    const visibleOrders = useMemo(() => {
        if (kindFilter === "ALL") return orders;
        return orders.filter((o) => o.kind === kindFilter);
    }, [orders, kindFilter]);

    const handleAdvance = async (order) => {
        // LAB collect / RADIOLOGY scan — first transition from pending.
        try {
            if (order.kind === "LAB") {
                await labOrderApi.collect(order.id);
            } else {
                await radiologyApi.markScanned(order.id);
            }
            await fetchOrders();
            notify(order.kind === "LAB" ? "Sample marked as collected" : "Scan marked done", "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to update status", "error");
        }
    };

    const handleCancel = async (order) => {
        // Only labs side currently exposes DELETE; radiology cancels go via
        // the labs UI for now.
        if (order.kind !== "LAB") {
            notify("Cancel radiology orders from the labs app", "warning");
            return;
        }
        try {
            await labOrderApi.cancel(order.id);
            await fetchOrders();
            notify("Order cancelled", "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to cancel order", "error");
        }
    };

    const openReportPanel = (orderId) => {
        setReportPanels((prev) => ({
            ...prev,
            [orderId]: { open: true, saving: false, form: { ...BLANK_REPORT_FORM } },
        }));
    };

    const closeReportPanel = (orderId) => {
        setReportPanels((prev) => ({ ...prev, [orderId]: { ...prev[orderId], open: false } }));
    };

    const setReportField = (orderId, field, value) => {
        setReportPanels((prev) => ({
            ...prev,
            [orderId]: { ...prev[orderId], form: { ...prev[orderId].form, [field]: value } },
        }));
    };

    const handleEnterReport = async (order) => {
        const panel = reportPanels[order.id];
        if (!panel) return;
        if (!panel.form.findings.trim()) {
            notify("Findings is required", "warning");
            return;
        }
        setReportPanels((prev) => ({ ...prev, [order.id]: { ...prev[order.id], saving: true } }));
        try {
            if (order.kind === "LAB") {
                await labOrderApi.report(order.id, panel.form);
            } else {
                await radiologyApi.generateReport(order.id, panel.form.findings, panel.form.observation);
            }
            await fetchOrders();
            setReportPanels((prev) => ({ ...prev, [order.id]: { open: false, saving: false, form: { ...BLANK_REPORT_FORM } } }));
            notify("Report saved · billed to active invoice if priced", "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to save report", "error");
            setReportPanels((prev) => ({ ...prev, [order.id]: { ...prev[order.id], saving: false } }));
        }
    };

    const pendingCount   = visibleOrders.filter((o) => o.status === "PENDING_COLLECTION" || o.status === "PENDING_SCAN").length;
    const collectedCount = visibleOrders.filter((o) => o.status === "AWAITING_REPORT").length;
    const reportedCount  = visibleOrders.filter((o) => o.status === "REPORT_GENERATED" || o.status === "BILLED").length;

    return (
        <div className="hms-ipd-tab-body lab-tab">

            {/* Kind filter — All / Pathology / Radiology */}
            <div className="lab-kind-pills">
                {[
                    { key: "ALL",       label: "All" },
                    { key: "LAB",       label: "Pathology" },
                    { key: "RADIOLOGY", label: "Radiology" },
                ].map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        className={`lab-kind-pill ${kindFilter === p.key ? "is-active" : ""}`}
                        onClick={() => setKindFilter(p.key)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Summary strip */}
            {visibleOrders.length > 0 && (
                <div className="lab-summary">
                    <div className="lab-summary__pill is-pending">
                        <Clock size={11} /> {pendingCount} Pending
                    </div>
                    <div className="lab-summary__pill is-collected">
                        <Beaker size={11} /> {collectedCount} Collected
                    </div>
                    <div className="lab-summary__pill is-resulted">
                        <CheckCircle2 size={11} /> {reportedCount} Reported
                    </div>
                </div>
            )}

            {/* Order button */}
            {!isDischarged && (
                <div className="lab-actions">
                    <button
                        type="button"
                        className="lab-add-btn"
                        onClick={() => setShowForm((v) => !v)}
                    >
                        <Plus size={12} /> Order test
                    </button>
                </div>
            )}

            {/* Shared order form. Kind filter flows into defaultKind so the
                Radiology pill scopes the picker to radiology services; ALL
                shows both with an in-form sub-toggle. */}
            {showForm && (
                <RequestInvestigationForm
                    hospitalId={user?.hospitalId}
                    patientId={patientId}
                    admissionId={admissionId}
                    catalog={catalog}
                    defaultKind={kindFilter}
                    onCreated={() => {
                        setShowForm(false);
                        fetchOrders();
                    }}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {/* Discharge notice */}
            {isDischarged && (
                <div className="mar-discharge-notice">
                    <AlertCircle size={14} />
                    <span>Patient discharged — investigations are read-only</span>
                </div>
            )}

            {/* Order list */}
            {loading ? (
                <CenterLoader text="Loading investigations…" />
            ) : visibleOrders.length === 0 ? (
                <div className="hms-ipd-center-empty">
                    <div className="hms-ipd-center-empty__icon"><FlaskConical size={32} /></div>
                    <p className="hms-ipd-center-empty__text">
                        No {kindFilter === "ALL" ? "investigations" : kindFilter === "LAB" ? "pathology orders" : "radiology orders"} for this admission
                    </p>
                    <p className="hms-ipd-center-empty__sub">
                        Use "Order test" above to place an investigation
                    </p>
                </div>
            ) : (
                <div className="lab-list">
                    {visibleOrders.map((order) => {
                        const panel = reportPanels[order.id] || { open: false, saving: false, form: BLANK_REPORT_FORM };
                        return (
                            <InvestigationCard
                                key={`${order.kind}-${order.id}`}
                                order={order}
                                panel={panel}
                                isDischarged={isDischarged}
                                onAdvance={() => handleAdvance(order)}
                                onCancel={() => handleCancel(order)}
                                onOpenReport={() => openReportPanel(order.id)}
                                onCloseReport={() => closeReportPanel(order.id)}
                                onReportFieldChange={(field, value) => setReportField(order.id, field, value)}
                                onEnterReport={() => handleEnterReport(order)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Order card ─────────────────────────────────────────────────────────────────

function InvestigationCard({
    order, panel, isDischarged,
    onAdvance, onCancel, onOpenReport, onCloseReport,
    onReportFieldChange, onEnterReport,
}) {
    const statusMeta   = STATUS_META[order.status]   || STATUS_META.PENDING_COLLECTION;
    const priorityMeta = PRIORITY_META[order.priority] || PRIORITY_META.ROUTINE;
    const isPending    = order.status === "PENDING_COLLECTION" || order.status === "PENDING_SCAN";
    const isCollected  = order.status === "AWAITING_REPORT";
    const isReported   = order.status === "REPORT_GENERATED" || order.status === "BILLED";
    const isLab        = order.kind === "LAB";
    const Icon         = isLab ? FlaskConical : ScanLine;

    return (
        <div className={`lab-card${isReported ? " is-resulted" : ""}`}>
            {/* Card header */}
            <div className="lab-card__head">
                <div className="lab-card__title-row">
                    <Icon size={14} className="lab-card__icon" />
                    <span className="lab-card__name">{order.serviceName}</span>
                    <span className={`lab-kind-chip ${isLab ? "is-lab" : "is-radiology"}`}>
                        {isLab ? "Pathology" : "Radiology"}
                    </span>
                </div>
                <div className="lab-card__badges">
                    <span className={`lab-status-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
                    <span className={`lab-priority-badge ${priorityMeta.cls}`}>{priorityMeta.label}</span>
                </div>
            </div>

            {/* Meta */}
            <div className="lab-card__meta">
                {order.referredByName && (
                    <span>Ordered by {order.referredByName}</span>
                )}
                {isLab && order.sampleType && (
                    <span>Sample: {order.sampleType}</span>
                )}
                <span>{fmtDateTime(order.createdAt)}</span>
            </div>

            {/* Collected / scanned info */}
            {isCollected && (isLab ? order.collectedAt : order.scannedAt) && (
                <p className="lab-card__collected-info">
                    <Beaker size={11} />
                    {isLab
                        ? `Sample collected ${fmtDateTime(order.collectedAt)}`
                        : `Scan performed ${fmtDateTime(order.scannedAt)}`}
                </p>
            )}

            {/* Report block */}
            {isReported && (
                <div className="lab-result-block">
                    {order.findings && (
                        <div className="lab-result-block__value-row">
                            <span className="lab-result-block__value">{order.findings}</span>
                        </div>
                    )}
                    {order.observation && (
                        <p className="lab-result-block__notes">{order.observation}</p>
                    )}
                    {order.reportedAt && (
                        <p className="lab-result-block__meta">
                            <CheckCircle2 size={10} />
                            Reported {fmtDateTime(order.reportedAt)}
                            {order.status === "BILLED" && (
                                <span className="lab-result-block__billed">
                                    <IndianRupee size={9} /> Billed
                                </span>
                            )}
                        </p>
                    )}
                </div>
            )}

            {/* Action buttons */}
            {!isDischarged && !isReported && (
                <div className="lab-card__actions">
                    {isPending && (
                        <>
                            <button type="button" className="lab-card__action-btn is-collect" onClick={onAdvance}>
                                <Beaker size={11} /> {isLab ? "Mark sample collected" : "Mark scan done"}
                            </button>
                            {isLab && (
                                <button type="button" className="lab-card__action-btn is-cancel" onClick={onCancel}>
                                    <X size={11} /> Cancel
                                </button>
                            )}
                        </>
                    )}
                    {isCollected && (
                        <button
                            type="button"
                            className="lab-card__action-btn is-result"
                            onClick={panel.open ? onCloseReport : onOpenReport}
                        >
                            <CheckCircle2 size={11} />
                            {panel.open ? "Hide form" : "Enter report"}
                            {panel.open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                    )}
                </div>
            )}

            {/* Report entry form */}
            {panel.open && (
                <div className="lab-result-form">
                    <div className="lab-result-form__fields">
                        <div className="lab-result-form__field lab-result-form__field--full">
                            <label className="lab-form__label">Findings *</label>
                            <input
                                className="lab-form__input"
                                placeholder={isLab
                                    ? "e.g. Hb 12.5 g/dL, WBC 8,200 /µL"
                                    : "e.g. No acute findings. Normal study."}
                                value={panel.form.findings}
                                onChange={(e) => onReportFieldChange("findings", e.target.value)}
                            />
                        </div>
                        <div className="lab-result-form__field lab-result-form__field--full">
                            <label className="lab-form__label">Observation / interpretation</label>
                            <input
                                className="lab-form__input"
                                placeholder="Normal range. Recommend repeat in 30 days."
                                value={panel.form.observation}
                                onChange={(e) => onReportFieldChange("observation", e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="lab-form__actions">
                        <button
                            type="button"
                            className="lab-form__save-btn"
                            onClick={onEnterReport}
                            disabled={panel.saving}
                        >
                            {panel.saving ? "Saving…" : "Save report"}
                        </button>
                        <button type="button" className="lab-form__cancel-btn" onClick={onCloseReport}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
