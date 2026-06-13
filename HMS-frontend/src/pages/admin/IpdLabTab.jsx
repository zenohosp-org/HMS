import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
    labOrderApi, radiologyApi, investigationsApi,
    hospitalServiceApi, departmentApi,
} from "@/utils/api";
import SearchableSelect from "@/components/ui/SearchableSelect";
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

const BLANK_ORDER_FORM = {
    serviceId: "",
    serviceName: "",
    sampleType: "",
    priority: "ROUTINE",
    price: "",
    gstRate: "",
};

const BLANK_REPORT_FORM = { findings: "", observation: "" };

// Map a service's department code to the kind labs uses.
const kindFromCode = (code) => {
    const c = (code || "").toUpperCase();
    if (c === "LABS") return "LAB";
    if (c === "RADIOLOGY") return "RADIOLOGY";
    return null;
};

export default function IpdLabTab({ admissionId, patientId, isDischarged }) {
    const { user } = useAuth();
    const { notify } = useNotification();

    const [orders, setOrders]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showForm, setShowForm]     = useState(false);
    const [saving, setSaving]         = useState(false);
    const [orderForm, setOrderForm]   = useState(BLANK_ORDER_FORM);

    // Top-level filter pill — All / Pathology / Radiology.
    const [kindFilter, setKindFilter] = useState("ALL");

    // Catalog: services tagged to LABS or RADIOLOGY departments, annotated
    // with a `kind` field so the picker can show + route correctly.
    const [catalog, setCatalog] = useState([]);

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

    // Load services catalogued under LABS or RADIOLOGY departments, annotated
    // with `kind` so the picker can label them and the submit can route.
    useEffect(() => {
        if (!user?.hospitalId) return;
        let cancelled = false;
        Promise.all([
            departmentApi.list(user.hospitalId),
            hospitalServiceApi.list(user.hospitalId),
        ])
            .then(([depts, services]) => {
                if (cancelled) return;
                const kindByDeptId = {};
                (depts || []).forEach((d) => {
                    const k = kindFromCode(d.code);
                    if (k) kindByDeptId[d.id] = k;
                });
                setCatalog(
                    (services || [])
                        .filter((s) => s.isActive !== false && kindByDeptId[s.departmentId])
                        .map((s) => ({ ...s, kind: kindByDeptId[s.departmentId] }))
                );
            })
            .catch(() => { if (!cancelled) setCatalog([]); });
        return () => { cancelled = true; };
    }, [user?.hospitalId]);

    const previewTotal = useMemo(() => {
        const price = Number(orderForm.price) || 0;
        const gst = Number(orderForm.gstRate) || 0;
        if (price <= 0) return null;
        return Math.round((price * (1 + gst / 100)) * 100) / 100;
    }, [orderForm.price, orderForm.gstRate]);

    // Visible orders honor the kind filter pill.
    const visibleOrders = useMemo(() => {
        if (kindFilter === "ALL") return orders;
        return orders.filter((o) => o.kind === kindFilter);
    }, [orders, kindFilter]);

    // The picker only shows services matching the active kind filter so
    // operators on the Radiology pill can't accidentally pick a pathology
    // test. When filter is ALL, both kinds appear with a kind chip.
    const pickerOptions = useMemo(() => {
        const pool = kindFilter === "ALL"
            ? catalog
            : catalog.filter((s) => s.kind === kindFilter);
        return pool.map((s) => ({
            value: s.id,
            label: `${s.name} — ${s.kind === "LAB" ? "Pathology" : "Radiology"} · ₹${s.price}${s.gstRate ? ` + ${s.gstRate}% GST` : ""}`,
        }));
    }, [catalog, kindFilter]);

    const handleCreate = async () => {
        const picked = catalog.find((s) => s.id === orderForm.serviceId);
        if (!picked) {
            notify("Pick a service tagged as Labs or Radiology", "warning");
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
                serviceName: picked.name,
                sampleType: orderForm.sampleType.trim() || null,    // ignored for radiology
                priority: orderForm.priority,
                price: orderForm.price ? Number(orderForm.price) : null,
                gstRate: orderForm.gstRate ? Number(orderForm.gstRate) : null,
            };
            await (picked.kind === "LAB"
                ? labOrderApi.create(payload)
                : radiologyApi.create(payload));
            await fetchOrders();
            setOrderForm(BLANK_ORDER_FORM);
            setShowForm(false);
            notify(`${picked.kind === "LAB" ? "Lab" : "Radiology"} order placed`, "success");
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to place order", "error");
        } finally {
            setSaving(false);
        }
    };

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

            {/* New order form */}
            {showForm && (
                <div className="lab-form">
                    <div className="lab-form__fields">
                        <div className="lab-form__field lab-form__field--grow">
                            <label className="lab-form__label">Test *</label>
                            {pickerOptions.length > 0 ? (
                                <SearchableSelect
                                    value={orderForm.serviceId}
                                    onChange={(serviceId) => {
                                        const svc = catalog.find((s) => s.id === serviceId);
                                        setOrderForm((f) => ({
                                            ...f,
                                            serviceId,
                                            serviceName: svc?.name || "",
                                            price: svc?.price != null ? String(svc.price) : "",
                                            gstRate: svc?.gstRate != null ? String(svc.gstRate) : "",
                                        }));
                                    }}
                                    options={pickerOptions}
                                    placeholder={`Pick a ${kindFilter === "ALL" ? "test" : kindFilter === "LAB" ? "pathology test" : "radiology test"}`}
                                />
                            ) : (
                                <p className="lab-form__hint">
                                    No services tagged under {kindFilter === "RADIOLOGY" ? "Radiology" : "Labs"} yet.
                                    Add them in Settings → Services and set the department to Labs or Radiology.
                                </p>
                            )}
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
                                onChange={(e) => setOrderForm((f) => ({ ...f, price: e.target.value, serviceId: "" }))}
                            />
                            {previewTotal != null && orderForm.gstRate && Number(orderForm.gstRate) > 0 && (
                                <p className="lab-form__hint">
                                    + {orderForm.gstRate}% GST = <strong>₹{previewTotal}</strong> total
                                </p>
                            )}
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
