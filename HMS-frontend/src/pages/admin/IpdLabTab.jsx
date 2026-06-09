import { useState, useEffect, useCallback } from "react";
import { useNotification } from "@/context/NotificationContext";
import { labOrderApi } from "@/utils/api";
import { CenterLoader } from "@/components/ui/Loader";
import {
    FlaskConical, Plus, CheckCircle2, Clock, AlertCircle,
    ChevronDown, ChevronUp, X, Beaker,
} from "lucide-react";
import { fmtDateTime } from "@/utils/date";
import "@/styles/modules/ipd-lab.css";

// ── Status metadata ────────────────────────────────────────────────────────────

const STATUS_META = {
    PENDING:          { label: "Pending",          cls: "is-pending"   },
    SAMPLE_COLLECTED: { label: "Sample collected", cls: "is-collected" },
    RESULTED:         { label: "Resulted",         cls: "is-resulted"  },
};

const PRIORITY_META = {
    ROUTINE: { label: "Routine", cls: "is-routine" },
    URGENT:  { label: "Urgent",  cls: "is-urgent"  },
    STAT:    { label: "STAT",    cls: "is-stat"    },
};

const STATUS_ORDER = { PENDING: 0, SAMPLE_COLLECTED: 1, RESULTED: 2 };

const BLANK_ORDER_FORM = { testName: "", testCode: "", priority: "ROUTINE" };
const BLANK_RESULT_FORM = { resultValue: "", resultUnit: "", referenceRange: "", resultNotes: "" };

export default function IpdLabTab({ admissionId, isDischarged }) {
    const { notify } = useNotification();

    const [orders, setOrders]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showForm, setShowForm]     = useState(false);
    const [saving, setSaving]         = useState(false);
    const [orderForm, setOrderForm]   = useState(BLANK_ORDER_FORM);

    // Per-order result form state: { [orderId]: { open, saving, form } }
    const [resultPanels, setResultPanels] = useState({});

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
        if (!orderForm.testName.trim()) {
            notify("Test name is required", "warning");
            return;
        }
        setSaving(true);
        try {
            const saved = await labOrderApi.create(admissionId, orderForm);
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
            const updated = await labOrderApi.collect(admissionId, orderId);
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
            await labOrderApi.cancel(admissionId, orderId);
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            notify("Order cancelled", "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to cancel order", "error");
        }
    };

    const openResultPanel = (orderId) => {
        setResultPanels((prev) => ({
            ...prev,
            [orderId]: { open: true, saving: false, form: { ...BLANK_RESULT_FORM } },
        }));
    };

    const closeResultPanel = (orderId) => {
        setResultPanels((prev) => ({ ...prev, [orderId]: { ...prev[orderId], open: false } }));
    };

    const setResultField = (orderId, field, value) => {
        setResultPanels((prev) => ({
            ...prev,
            [orderId]: { ...prev[orderId], form: { ...prev[orderId].form, [field]: value } },
        }));
    };

    const handleEnterResult = async (orderId) => {
        const panel = resultPanels[orderId];
        if (!panel) return;
        setResultPanels((prev) => ({ ...prev, [orderId]: { ...prev[orderId], saving: true } }));
        try {
            const updated = await labOrderApi.result(admissionId, orderId, panel.form);
            setOrders((prev) =>
                prev.map((o) => o.id === orderId ? updated : o)
                    .sort((a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0))
            );
            setResultPanels((prev) => ({ ...prev, [orderId]: { open: false, saving: false, form: { ...BLANK_RESULT_FORM } } }));
            notify("Result recorded", "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to save result", "error");
            setResultPanels((prev) => ({ ...prev, [orderId]: { ...prev[orderId], saving: false } }));
        }
    };

    // ── Counts for summary ─────────────────────────────────────────────────────
    const pendingCount   = orders.filter((o) => o.status === "PENDING").length;
    const collectedCount = orders.filter((o) => o.status === "SAMPLE_COLLECTED").length;
    const resultedCount  = orders.filter((o) => o.status === "RESULTED").length;

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
                        <CheckCircle2 size={11} /> {resultedCount} Resulted
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
                                value={orderForm.testName}
                                onChange={(e) => setOrderForm((f) => ({ ...f, testName: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                            />
                        </div>
                        <div className="lab-form__field">
                            <label className="lab-form__label">Code (optional)</label>
                            <input
                                className="lab-form__input"
                                placeholder="LAB001"
                                value={orderForm.testCode}
                                onChange={(e) => setOrderForm((f) => ({ ...f, testCode: e.target.value }))}
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
                        const panel = resultPanels[order.id] || { open: false, saving: false, form: BLANK_RESULT_FORM };
                        return (
                            <LabOrderCard
                                key={order.id}
                                order={order}
                                panel={panel}
                                isDischarged={isDischarged}
                                onCollect={() => handleCollect(order.id)}
                                onCancel={() => handleCancel(order.id)}
                                onOpenResult={() => openResultPanel(order.id)}
                                onCloseResult={() => closeResultPanel(order.id)}
                                onResultFieldChange={(field, value) => setResultField(order.id, field, value)}
                                onEnterResult={() => handleEnterResult(order.id)}
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
    onCollect, onCancel, onOpenResult, onCloseResult,
    onResultFieldChange, onEnterResult,
}) {
    const statusMeta   = STATUS_META[order.status]   || STATUS_META.PENDING;
    const priorityMeta = PRIORITY_META[order.priority] || PRIORITY_META.ROUTINE;
    const isPending    = order.status === "PENDING";
    const isCollected  = order.status === "SAMPLE_COLLECTED";
    const isResulted   = order.status === "RESULTED";

    return (
        <div className={`lab-card${isResulted ? " is-resulted" : ""}`}>
            {/* Card header */}
            <div className="lab-card__head">
                <div className="lab-card__title-row">
                    <FlaskConical size={14} className="lab-card__icon" />
                    <span className="lab-card__name">{order.testName}</span>
                    {order.testCode && (
                        <span className="lab-card__code">{order.testCode}</span>
                    )}
                </div>
                <div className="lab-card__badges">
                    <span className={`lab-status-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
                    <span className={`lab-priority-badge ${priorityMeta.cls}`}>{priorityMeta.label}</span>
                </div>
            </div>

            {/* Meta */}
            <div className="lab-card__meta">
                {order.orderedByName && (
                    <span>Ordered by {order.orderedByName}</span>
                )}
                <span>{fmtDateTime(order.createdAt)}</span>
            </div>

            {/* Collected info */}
            {isCollected && order.sampleCollectedAt && (
                <p className="lab-card__collected-info">
                    <Beaker size={11} />
                    Sample collected {fmtDateTime(order.sampleCollectedAt)}
                    {order.sampleCollectedByName && ` · ${order.sampleCollectedByName}`}
                </p>
            )}

            {/* Result block */}
            {isResulted && (
                <div className="lab-result-block">
                    {(order.resultValue || order.resultNotes) && (
                        <div className="lab-result-block__value-row">
                            {order.resultValue && (
                                <span className="lab-result-block__value">
                                    {order.resultValue}
                                    {order.resultUnit && <span className="lab-result-block__unit"> {order.resultUnit}</span>}
                                </span>
                            )}
                            {order.referenceRange && (
                                <span className="lab-result-block__range">
                                    Ref: {order.referenceRange}
                                </span>
                            )}
                        </div>
                    )}
                    {order.resultNotes && (
                        <p className="lab-result-block__notes">{order.resultNotes}</p>
                    )}
                    {order.resultedAt && (
                        <p className="lab-result-block__meta">
                            <CheckCircle2 size={10} />
                            Resulted {fmtDateTime(order.resultedAt)}
                            {order.resultedByName && ` · ${order.resultedByName}`}
                        </p>
                    )}
                </div>
            )}

            {/* Action buttons */}
            {!isDischarged && !isResulted && (
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
                            onClick={panel.open ? onCloseResult : onOpenResult}
                        >
                            <CheckCircle2 size={11} />
                            {panel.open ? "Hide form" : "Enter result"}
                            {panel.open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                    )}
                </div>
            )}

            {/* Result entry form */}
            {panel.open && (
                <div className="lab-result-form">
                    <div className="lab-result-form__fields">
                        <div className="lab-result-form__field">
                            <label className="lab-form__label">Result value</label>
                            <input
                                className="lab-form__input"
                                placeholder="e.g. 95, Positive, Normal"
                                value={panel.form.resultValue}
                                onChange={(e) => onResultFieldChange("resultValue", e.target.value)}
                            />
                        </div>
                        <div className="lab-result-form__field">
                            <label className="lab-form__label">Unit</label>
                            <input
                                className="lab-form__input"
                                placeholder="mg/dL"
                                value={panel.form.resultUnit}
                                onChange={(e) => onResultFieldChange("resultUnit", e.target.value)}
                            />
                        </div>
                        <div className="lab-result-form__field">
                            <label className="lab-form__label">Reference range</label>
                            <input
                                className="lab-form__input"
                                placeholder="70–110 mg/dL"
                                value={panel.form.referenceRange}
                                onChange={(e) => onResultFieldChange("referenceRange", e.target.value)}
                            />
                        </div>
                        <div className="lab-result-form__field lab-result-form__field--full">
                            <label className="lab-form__label">Interpretation / notes</label>
                            <input
                                className="lab-form__input"
                                placeholder="Borderline elevated, repeat in 48h…"
                                value={panel.form.resultNotes}
                                onChange={(e) => onResultFieldChange("resultNotes", e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="lab-form__actions">
                        <button
                            type="button"
                            className="lab-form__save-btn"
                            onClick={onEnterResult}
                            disabled={panel.saving}
                        >
                            {panel.saving ? "Saving…" : "Save result"}
                        </button>
                        <button type="button" className="lab-form__cancel-btn" onClick={onCloseResult}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
