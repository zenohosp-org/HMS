import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { labOrderApi } from "@/utils/api";
import { CenterLoader } from "@/components/ui/Loader";
import {
    FlaskConical, Plus, CheckCircle2, Clock, AlertCircle,
    ChevronDown, ChevronUp, X, Beaker, IndianRupee,
} from "lucide-react";
import { fmtDateTime } from "@/utils/date";
import "@/styles/modules/ipd-lab.css";

// Status semantics now match the labs service (api-labs.zenohosp.com).
// PENDING_COLLECTION → AWAITING_REPORT → REPORT_GENERATED → BILLED
// BILLED is downstream of REPORT_GENERATED (set when labs auto-bills to
// the active IPD invoice on report generation).
const STATUS_META = {
    PENDING_COLLECTION: { label: "Pending",        cls: "is-pending"   },
    AWAITING_REPORT:    { label: "Collected",      cls: "is-collected" },
    REPORT_GENERATED:   { label: "Reported",       cls: "is-resulted"  },
    BILLED:             { label: "Billed",         cls: "is-resulted"  },
};

const PRIORITY_META = {
    ROUTINE: { label: "Routine", cls: "is-routine" },
    URGENT:  { label: "Urgent",  cls: "is-urgent"  },
    STAT:    { label: "STAT",    cls: "is-stat"    },
};

const STATUS_ORDER = {
    PENDING_COLLECTION: 0,
    AWAITING_REPORT: 1,
    REPORT_GENERATED: 2,
    BILLED: 3,
};

const BLANK_ORDER_FORM = {
    serviceName: "",
    specializationName: "",
    sampleType: "",
    priority: "ROUTINE",
    price: "",
};

const BLANK_REPORT_FORM = { findings: "", observation: "" };

export default function IpdLabTab({ admissionId, patientId, isDischarged }) {
    const { user } = useAuth();
    const { notify } = useNotification();

    const [orders, setOrders]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showForm, setShowForm]     = useState(false);
    const [saving, setSaving]         = useState(false);
    const [orderForm, setOrderForm]   = useState(BLANK_ORDER_FORM);

    // Per-order report form state: { [orderId]: { open, saving, form } }
    const [reportPanels, setReportPanels] = useState({});

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await labOrderApi.list(admissionId);
            const sorted = (Array.isArray(data) ? data : []).sort(
                (a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)
            );
            setOrders(sorted);
        } catch {
            notify("Failed to load lab orders", "error");
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const handleCreate = async () => {
        if (!orderForm.serviceName.trim()) {
            notify("Test name is required", "warning");
            return;
        }
        if (!user?.hospitalId) {
            notify("Hospital scope missing — please reload", "error");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                hospitalId: user.hospitalId,
                patientId,
                admissionId,
                serviceName: orderForm.serviceName.trim(),
                specializationName: orderForm.specializationName.trim() || null,
                sampleType: orderForm.sampleType.trim() || null,
                priority: orderForm.priority,
                price: orderForm.price ? Number(orderForm.price) : null,
            };
            const saved = await labOrderApi.create(payload);
            setOrders((prev) =>
                [saved, ...prev].sort((a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0))
            );
            setOrderForm(BLANK_ORDER_FORM);
            setShowForm(false);
            notify("Lab order placed", "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to place order", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleCollect = async (orderId) => {
        try {
            const updated = await labOrderApi.collect(orderId);
            setOrders((prev) =>
                prev.map((o) => o.id === orderId ? updated : o)
                    .sort((a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0))
            );
            notify("Sample marked as collected", "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to update status", "error");
        }
    };

    const handleCancel = async (orderId) => {
        try {
            await labOrderApi.cancel(orderId);
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
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

    const handleEnterReport = async (orderId) => {
        const panel = reportPanels[orderId];
        if (!panel) return;
        if (!panel.form.findings.trim()) {
            notify("Findings is required", "warning");
            return;
        }
        setReportPanels((prev) => ({ ...prev, [orderId]: { ...prev[orderId], saving: true } }));
        try {
            const updated = await labOrderApi.report(orderId, panel.form);
            setOrders((prev) =>
                prev.map((o) => o.id === orderId ? updated : o)
                    .sort((a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0))
            );
            setReportPanels((prev) => ({ ...prev, [orderId]: { open: false, saving: false, form: { ...BLANK_REPORT_FORM } } }));
            notify("Report saved · billed to active invoice if priced", "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to save report", "error");
            setReportPanels((prev) => ({ ...prev, [orderId]: { ...prev[orderId], saving: false } }));
        }
    };

    // ── Counts for summary ─────────────────────────────────────────────────────
    const pendingCount   = orders.filter((o) => o.status === "PENDING_COLLECTION").length;
    const collectedCount = orders.filter((o) => o.status === "AWAITING_REPORT").length;
    const reportedCount  = orders.filter((o) => o.status === "REPORT_GENERATED" || o.status === "BILLED").length;

    return (
        <div className="hms-ipd-tab-body lab-tab">

            {/* Summary strip */}
            {orders.length > 0 && (
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

            {/* New order form */}
            {showForm && (
                <div className="lab-form">
                    <div className="lab-form__fields">
                        <div className="lab-form__field lab-form__field--grow">
                            <label className="lab-form__label">Test name *</label>
                            <input
                                className="lab-form__input"
                                placeholder="e.g. CBC, LFT, Serum Creatinine"
                                value={orderForm.serviceName}
                                onChange={(e) => setOrderForm((f) => ({ ...f, serviceName: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                            />
                        </div>
                        <div className="lab-form__field">
                            <label className="lab-form__label">Specialization</label>
                            <input
                                className="lab-form__input"
                                placeholder="Hematology"
                                value={orderForm.specializationName}
                                onChange={(e) => setOrderForm((f) => ({ ...f, specializationName: e.target.value }))}
                            />
                        </div>
                        <div className="lab-form__field">
                            <label className="lab-form__label">Sample</label>
                            <input
                                className="lab-form__input"
                                placeholder="Blood / Urine"
                                value={orderForm.sampleType}
                                onChange={(e) => setOrderForm((f) => ({ ...f, sampleType: e.target.value }))}
                            />
                        </div>
                        <div className="lab-form__field">
                            <label className="lab-form__label">Priority</label>
                            <select
                                className="lab-form__select"
                                value={orderForm.priority}
                                onChange={(e) => setOrderForm((f) => ({ ...f, priority: e.target.value }))}
                            >
                                <option value="ROUTINE">Routine</option>
                                <option value="URGENT">Urgent</option>
                                <option value="STAT">STAT</option>
                            </select>
                        </div>
                        <div className="lab-form__field">
                            <label className="lab-form__label">Price (₹)</label>
                            <input
                                className="lab-form__input"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={orderForm.price}
                                onChange={(e) => setOrderForm((f) => ({ ...f, price: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="lab-form__actions">
                        <button
                            type="button"
                            className="lab-form__save-btn"
                            onClick={handleCreate}
                            disabled={saving}
                        >
                            {saving ? "Saving…" : "Place order"}
                        </button>
                        <button
                            type="button"
                            className="lab-form__cancel-btn"
                            onClick={() => { setShowForm(false); setOrderForm(BLANK_ORDER_FORM); }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Discharge notice */}
            {isDischarged && (
                <div className="mar-discharge-notice">
                    <AlertCircle size={14} />
                    <span>Patient discharged — lab orders are read-only</span>
                </div>
            )}

            {/* Order list */}
            {loading ? (
                <CenterLoader text="Loading lab orders…" />
            ) : orders.length === 0 ? (
                <div className="hms-ipd-center-empty">
                    <div className="hms-ipd-center-empty__icon"><FlaskConical size={32} /></div>
                    <p className="hms-ipd-center-empty__text">No lab orders for this admission</p>
                    <p className="hms-ipd-center-empty__sub">
                        Use "Order test" above to place a lab investigation
                    </p>
                </div>
            ) : (
                <div className="lab-list">
                    {orders.map((order) => {
                        const panel = reportPanels[order.id] || { open: false, saving: false, form: BLANK_REPORT_FORM };
                        return (
                            <LabOrderCard
                                key={order.id}
                                order={order}
                                panel={panel}
                                isDischarged={isDischarged}
                                onCollect={() => handleCollect(order.id)}
                                onCancel={() => handleCancel(order.id)}
                                onOpenReport={() => openReportPanel(order.id)}
                                onCloseReport={() => closeReportPanel(order.id)}
                                onReportFieldChange={(field, value) => setReportField(order.id, field, value)}
                                onEnterReport={() => handleEnterReport(order.id)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Order card ─────────────────────────────────────────────────────────────────

function LabOrderCard({
    order, panel, isDischarged,
    onCollect, onCancel, onOpenReport, onCloseReport,
    onReportFieldChange, onEnterReport,
}) {
    const statusMeta   = STATUS_META[order.status]   || STATUS_META.PENDING_COLLECTION;
    const priorityMeta = PRIORITY_META[order.priority] || PRIORITY_META.ROUTINE;
    const isPending    = order.status === "PENDING_COLLECTION";
    const isCollected  = order.status === "AWAITING_REPORT";
    const isReported   = order.status === "REPORT_GENERATED" || order.status === "BILLED";

    return (
        <div className={`lab-card${isReported ? " is-resulted" : ""}`}>
            {/* Card header */}
            <div className="lab-card__head">
                <div className="lab-card__title-row">
                    <FlaskConical size={14} className="lab-card__icon" />
                    <span className="lab-card__name">{order.serviceName}</span>
                    {order.specializationName && (
                        <span className="lab-card__code">{order.specializationName}</span>
                    )}
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
                {order.sampleType && (
                    <span>Sample: {order.sampleType}</span>
                )}
                <span>{fmtDateTime(order.createdAt)}</span>
            </div>

            {/* Collected info */}
            {isCollected && order.collectedAt && (
                <p className="lab-card__collected-info">
                    <Beaker size={11} />
                    Sample collected {fmtDateTime(order.collectedAt)}
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
                            <button type="button" className="lab-card__action-btn is-collect" onClick={onCollect}>
                                <Beaker size={11} /> Mark sample collected
                            </button>
                            <button type="button" className="lab-card__action-btn is-cancel" onClick={onCancel}>
                                <X size={11} /> Cancel
                            </button>
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
                                placeholder="e.g. Hb 12.5 g/dL, WBC 8,200 /µL"
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
