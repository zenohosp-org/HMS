import { useState, useEffect, useCallback } from "react";
import { useNotification } from "@/context/NotificationContext";
import { marApi } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { CenterLoader } from "@/components/ui/Loader";
import {
    Pill, Clock, User as UserIcon, CheckCircle2, XCircle,
    PauseCircle, AlertCircle, ChevronDown, ChevronUp,
    StopCircle, BanIcon, AlertTriangle, Undo2,
} from "lucide-react";
import { fmtDateTime, fmtTime } from "@/utils/date";
import "@/styles/modules/ipd-mar.css";

// ── Status metadata ────────────────────────────────────────────────────────────

const STATUS_META = {
    GIVEN:   { label: "Given",              Icon: CheckCircle2, cls: "is-given"   },
    HELD:    { label: "Held",               Icon: PauseCircle,  cls: "is-held"    },
    REFUSED: { label: "Refused by patient", Icon: XCircle,      cls: "is-refused" },
};

const STATUS_OPTIONS = [
    { value: "GIVEN",   label: "Given"             },
    { value: "HELD",    label: "Held (withheld)"    },
    { value: "REFUSED", label: "Refused by patient" },
];

// Roles that may stop an order (mirrors @PreAuthorize on the backend endpoint)
const CAN_STOP_ROLES = new Set(["doctor", "hospital_admin", "super_admin"]);

// Roles that may initiate a ward return. Nurses are the primary caller —
// they're the ones physically returning unused units to pharmacy.
const CAN_RETURN_ROLES = new Set(["nurse", "doctor", "hospital_admin", "super_admin"]);

// Categorical reasons the backend accepts. Order is intentional: the most
// common nurse-side scenarios up top. The QUARANTINE-bound reasons (the
// pharmacist won't credit sellable stock) are grouped and visually flagged
// in the select via a "→ quarantine" suffix.
const RETURN_REASONS = [
    { value: "INEFFECTIVE",          label: "Drug ineffective",          quarantine: true  },
    { value: "ADVERSE_REACTION",     label: "Adverse reaction",          quarantine: true  },
    { value: "DOSE_CHANGE",          label: "Doctor changed dose",       quarantine: false },
    { value: "ORDER_STOPPED",        label: "Order stopped",             quarantine: false },
    { value: "WRONG_DRUG_DISPENSED", label: "Wrong drug dispensed",      quarantine: false },
    { value: "EXPIRY_NEAR",          label: "Near expiry",               quarantine: true  },
    { value: "WASTAGE_BROKEN",       label: "Wastage — broken/damaged",  quarantine: true  },
    { value: "WASTAGE_SPILLED",      label: "Wastage — spilled",         quarantine: true  },
    { value: "OTHER",                label: "Other (specify in notes)",  quarantine: false },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function localNow() {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
}

function emptyForm() {
    return { administeredAt: localNow(), status: "GIVEN", doseGiven: "", reason: "", notes: "" };
}

function emptyStopForm() {
    return { reason: "" };
}

function emptyReturnForm(defaultQty = 1, isStopped = false) {
    return {
        returnQty:   String(defaultQty),
        reasonCode:  "INEFFECTIVE",
        reasonNotes: "",
        // Default to "also stop this order" only when the order is still
        // active — otherwise the hidden stop-reason field would block
        // submission with a stale "reason required" check.
        stopOrder:   !isStopped,
        stopReason:  "",
    };
}

/** Effective returnable units = pharmacy-issued minus already returned. */
function returnableQty(order) {
    const d = Number(order?.dispensedQty ?? 0);
    const r = Number(order?.returnedQty  ?? 0);
    return Math.max(0, d - r);
}

// Hours between scheduled doses for fixed-interval frequencies. Frequencies
// tied to events (meals, bedtime) or given as-needed have no fixed schedule
// and are intentionally omitted — they never show a due/overdue badge.
const FREQUENCY_INTERVAL_HOURS = {
    OD: 24, BD: 12, TDS: 8, QID: 6,
    Q4H: 4, Q6H: 6, Q8H: 8,
};

const DUE_SOON_WINDOW_MS = 30 * 60 * 1000;

/** Returns { state: "due"|"overdue", nextDueAt: Date } or null if no badge applies. */
function getDoseSchedule(order, now) {
    if (order.status === "STOPPED") return null;
    const intervalHours = FREQUENCY_INTERVAL_HOURS[order.frequency];
    if (!intervalHours) return null;

    const lastGiven = (order.administrations || [])
        .filter((a) => a.status === "GIVEN" && a.administeredAt)
        .map((a) => new Date(a.administeredAt).getTime())
        .sort((a, b) => b - a)[0];

    const baseline = lastGiven ?? (order.prescribedAt ? new Date(order.prescribedAt).getTime() : null);
    if (baseline == null || Number.isNaN(baseline)) return null;

    const nextDueAt = baseline + intervalHours * 60 * 60 * 1000;
    const diffMs = nextDueAt - now.getTime();

    if (diffMs <= 0) return { state: "overdue", nextDueAt: new Date(nextDueAt) };
    if (diffMs <= DUE_SOON_WINDOW_MS) return { state: "due", nextDueAt: new Date(nextDueAt) };
    return null;
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function IpdMarTab({ admissionId, isDischarged, allergies }) {
    const { notify }    = useNotification();
    const { user }      = useAuth();
    const canStop       = CAN_STOP_ROLES.has(user?.role);
    const canReturn     = CAN_RETURN_ROLES.has(user?.role);

    const [orders, setOrders]             = useState([]);
    const [loading, setLoading]           = useState(true);
    const [forms, setForms]               = useState({});
    const [stopForms, setStopForms]       = useState({});
    const [stopOpen, setStopOpen]         = useState({});
    const [returnForms, setReturnForms]   = useState({});
    const [returnOpen, setReturnOpen]     = useState({});
    const [returningId, setReturningId]   = useState(null);
    const [expanded, setExpanded]         = useState({});
    const [savingId, setSavingId]         = useState(null);
    const [stoppingId, setStoppingId]     = useState(null);
    const [now, setNow]                   = useState(() => new Date());

    // Keep due/overdue badges current without requiring a page refresh.
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const fetchOrders = useCallback(async () => {
        try {
            const data = await marApi.list(admissionId);
            // ACTIVE orders first, STOPPED last; within each group preserve server order
            const sorted = [...(data ?? [])].sort((a, b) => {
                const aS = "STOPPED" === a.status ? 1 : 0;
                const bS = "STOPPED" === b.status ? 1 : 0;
                return aS - bS;
            });
            setOrders(sorted);
        } catch {
            // Non-fatal — empty state shown
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const getForm        = (id) => forms[id] ?? emptyForm();
    const getStopForm    = (id) => stopForms[id] ?? emptyStopForm();
    const getReturnForm  = (id, defaultQty, isStopped = false) =>
        returnForms[id] ?? emptyReturnForm(defaultQty, isStopped);
    const setField       = (id, field) => (e) =>
        setForms((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyForm()), [field]: e.target.value } }));
    const setStopField   = (id, field) => (e) =>
        setStopForms((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyStopForm()), [field]: e.target.value } }));
    const setReturnField = (id, field) => (e) => {
        // Checkboxes use .checked, every other input uses .value.
        const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setReturnForms((prev) => ({
            ...prev,
            [id]: { ...(prev[id] ?? emptyReturnForm()), [field]: val },
        }));
    };
    const resetForm    = (id) => setForms((prev) => ({ ...prev, [id]: emptyForm() }));
    const toggleLog    = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    const toggleStop   = (id) => setStopOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    const toggleReturn = (id, defaultQty, isStopped = false) => {
        setReturnOpen((prev) => ({ ...prev, [id]: !prev[id] }));
        // Seed the form with a sane default qty the first time the panel opens
        // so the nurse doesn't have to type "1" for the common single-strip case.
        // isStopped flips the stopOrder default off — a stopped order can't be
        // re-stopped, and the stopReason input is hidden in that branch.
        setReturnForms((prev) =>
            prev[id] ? prev : { ...prev, [id]: emptyReturnForm(defaultQty, isStopped) },
        );
    };

    const handleSubmit = async (e, orderId) => {
        e.preventDefault();
        const f = getForm(orderId);

        if ((f.status === "HELD" || f.status === "REFUSED") && !f.reason.trim()) {
            notify("Reason is required when status is Held or Refused", "warning");
            return;
        }

        const payload = {
            admissionId,
            orderId,
            administeredAt: f.administeredAt || undefined,
            status:         f.status,
            doseGiven:      f.doseGiven.trim() || undefined,
            reason:         f.reason.trim()    || undefined,
            notes:          f.notes.trim()     || undefined,
        };

        setSavingId(orderId);
        try {
            const saved = await marApi.create(payload);
            setOrders((prev) =>
                prev.map((o) =>
                    o.orderId === orderId
                        ? { ...o, administrations: [...(o.administrations ?? []), saved] }
                        : o
                )
            );
            setExpanded((prev) => ({ ...prev, [orderId]: true }));
            resetForm(orderId);
            notify("Administration recorded", "success");
            fetchOrders();
        } catch (err) {
            const msg = err?.response?.data?.message ?? "Failed to record administration";
            notify(msg, "error");
        } finally {
            setSavingId(null);
        }
    };

    const handleStop = async (e, orderId) => {
        e.preventDefault();
        const f = getStopForm(orderId);
        if (!f.reason.trim()) {
            notify("Reason is required to stop an order", "warning");
            return;
        }

        setStoppingId(orderId);
        try {
            await marApi.stopOrder(orderId, f.reason.trim());
            setOrders((prev) =>
                [...prev].sort((a, b) => {
                    const aId = a.orderId === orderId ? 1 : ("STOPPED" === a.status ? 1 : 0);
                    const bId = b.orderId === orderId ? 1 : ("STOPPED" === b.status ? 1 : 0);
                    return aId - bId;
                })
            );
            setStopOpen((prev) => ({ ...prev, [orderId]: false }));
            notify("Order stopped", "success");
            fetchOrders();
        } catch (err) {
            const msg = err?.response?.data?.message ?? "Failed to stop order";
            notify(msg, "error");
        } finally {
            setStoppingId(null);
        }
    };

    const handleReturn = async (e, order) => {
        e.preventDefault();
        const orderId    = order.orderId;
        const isStopped  = order.status === "STOPPED";
        const f          = getReturnForm(orderId, 1, isStopped);
        const max        = returnableQty(order);
        const qty        = Number(f.returnQty);
        // A stopped order can't be re-stopped, so the stopOrder flag is a no-op.
        // We squash it here so both validation and the outgoing payload behave
        // as if the user had unchecked it.
        const willStop   = !isStopped && !!f.stopOrder;

        if (!Number.isFinite(qty) || qty <= 0) {
            notify("Return quantity must be a positive number", "warning");
            return;
        }
        if (qty > max) {
            notify(`Cannot return more than ${max} unit(s) — that's all pharmacy has issued`, "warning");
            return;
        }
        if (!f.reasonCode) {
            notify("Pick a reason for the return", "warning");
            return;
        }
        if (f.reasonCode === "OTHER" && !f.reasonNotes.trim()) {
            notify("Notes are required when the reason is Other", "warning");
            return;
        }
        if (willStop && !f.stopReason.trim()) {
            notify("Reason is required when stopping the order with the return", "warning");
            return;
        }

        setReturningId(orderId);
        try {
            await marApi.initiateReturn(orderId, {
                stopOrder:   willStop,
                stopReason:  willStop ? f.stopReason.trim() : undefined,
                returnQty:   qty,
                reasonCode:  f.reasonCode,
                reasonNotes: f.reasonNotes.trim() || undefined,
            });
            setReturnOpen((prev)  => ({ ...prev, [orderId]: false }));
            setReturnForms((prev) => ({ ...prev, [orderId]: emptyReturnForm(1, isStopped) }));
            notify(
                willStop
                    ? `Return of ${qty} unit(s) sent to pharmacy and order stopped`
                    : `Return of ${qty} unit(s) sent to pharmacy`,
                "success",
            );
            fetchOrders();
        } catch (err) {
            // Surface the server's BadRequestException message verbatim — it
            // already says things like "returnQty exceeds returnable units …".
            const msg = err?.response?.data?.message ?? "Failed to initiate return";
            notify(msg, "error");
        } finally {
            setReturningId(null);
        }
    };

    const knownAllergies = Array.isArray(allergies) ? allergies : [];

    return (
        <div className="hms-ipd-tab-body mar-tab">

            {knownAllergies.length > 0 && (
                <div className="hms-allergy-banner">
                    <AlertTriangle size={13} className="hms-allergy-banner__icon" />
                    <span className="hms-allergy-banner__label">Known allergies:</span>
                    <div className="hms-allergy-chip-row">
                        {knownAllergies.map((a) => (
                            <span
                                key={a.id}
                                className={`hms-allergy-chip is-${(a.severity || "UNKNOWN").toLowerCase()} is-readonly`}
                                title={a.reaction || undefined}
                            >
                                {a.allergen}
                                {a.reaction && <span className="hms-allergy-chip__reaction">· {a.reaction}</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {isDischarged && (
                <div className="mar-discharge-notice">
                    <AlertCircle size={14} />
                    <span>Patient discharged — MAR is read-only</span>
                </div>
            )}

            {loading ? (
                <CenterLoader text="Loading medication orders…" />
            ) : orders.length === 0 ? (
                <div className="hms-ipd-center-empty">
                    <div className="hms-ipd-center-empty__icon"><Pill size={32} /></div>
                    <p className="hms-ipd-center-empty__text">No prescription orders for this admission</p>
                    <p className="hms-ipd-center-empty__sub">
                        Write a prescription from the IPD log tab to add orders here
                    </p>
                </div>
            ) : (
                <div className="mar-list">
                    {orders.map((order) => {
                        const max         = returnableQty(order);
                        const isStopped   = order.status === "STOPPED";
                        const seedQty     = Math.max(1, max);
                        return (
                            <OrderCard
                                key={order.orderId}
                                order={order}
                                now={now}
                                form={getForm(order.orderId)}
                                stopForm={getStopForm(order.orderId)}
                                returnForm={getReturnForm(order.orderId, seedQty, isStopped)}
                                setField={setField}
                                setStopField={setStopField}
                                setReturnField={setReturnField}
                                onSubmit={handleSubmit}
                                onStop={handleStop}
                                onReturn={handleReturn}
                                saving={savingId === order.orderId}
                                stopping={stoppingId === order.orderId}
                                returning={returningId === order.orderId}
                                stopOpen={!!stopOpen[order.orderId]}
                                onToggleStop={() => toggleStop(order.orderId)}
                                returnOpen={!!returnOpen[order.orderId]}
                                onToggleReturn={() => toggleReturn(order.orderId, seedQty, isStopped)}
                                returnableQty={max}
                                logExpanded={!!expanded[order.orderId]}
                                onToggleLog={() => toggleLog(order.orderId)}
                                isDischarged={isDischarged}
                                canStop={canStop}
                                canReturn={canReturn}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Order card ──────────────────────────────────────────────────────────────────

function OrderCard({
    order, now, form, stopForm, returnForm,
    setField, setStopField, setReturnField,
    onSubmit, onStop, onReturn,
    saving, stopping, returning,
    stopOpen, onToggleStop,
    returnOpen, onToggleReturn, returnableQty,
    logExpanded, onToggleLog,
    isDischarged, canStop, canReturn,
}) {
    const isStopped       = "STOPPED" === order.status;
    const adminCount      = order.administrations?.length ?? 0;
    const needsReason     = form.status === "HELD" || form.status === "REFUSED";
    const drugTitle       = [order.drugName, order.drugStrength, order.drugForm].filter(Boolean).join(" ");
    const doseSchedule    = getDoseSchedule(order, now);
    const reasonMeta      = RETURN_REASONS.find((r) => r.value === returnForm?.reasonCode);
    const reasonNotesReq  = returnForm?.reasonCode === "OTHER";
    // Show the action only when there's something physically returnable. We
    // also allow it on STOPPED orders — the strips are still on the trolley
    // even after the doctor stopped the order.
    const canShowReturn   = canReturn && !isDischarged && returnableQty > 0;

    return (
        <div className={`mar-card${isStopped ? " is-stopped" : ""}`}>

            {/* ── Drug info ── */}
            <div className="mar-card__info">
                <div className="mar-card__icon">
                    <Pill size={15} />
                </div>
                <div className="mar-card__text">
                    <div className="mar-card__name-row">
                        <p className="mar-card__drug-name">{drugTitle}</p>
                        {order.allergyOverrideReason && (
                            <span className="mar-card__allergy-badge" title={`Prescribed despite recorded allergy — ${order.allergyOverrideReason}`}>
                                <AlertTriangle size={10} /> Allergy override
                            </span>
                        )}
                        {isStopped && (
                            <span className="mar-card__stopped-badge">
                                <BanIcon size={10} /> Stopped
                            </span>
                        )}
                    </div>

                    {/* Frequency + route pills + per-dose amount */}
                    <div className="mar-card__signa">
                        {order.frequency && (
                            <span className="mar-signa-pill is-freq">{order.frequency}</span>
                        )}
                        {order.route && (
                            <span className="mar-signa-pill is-route">{order.route}</span>
                        )}
                        {doseSchedule?.state === "overdue" && (
                            <span className="mar-signa-pill is-overdue" title={`Next dose was due at ${fmtTime(doseSchedule.nextDueAt)}`}>
                                <AlertCircle size={10} /> Overdue
                            </span>
                        )}
                        {doseSchedule?.state === "due" && (
                            <span className="mar-signa-pill is-due" title={`Next dose due at ${fmtTime(doseSchedule.nextDueAt)}`}>
                                <Clock size={10} /> Due now
                            </span>
                        )}
                        {/* Dispense tally — gives the nurse instant "how much is on the ward" context. */}
                        {(order.quantity != null || order.dispensedQty != null) && (
                            <span
                                className={`mar-signa-pill is-dispense is-${(order.dispenseStatus || "PENDING").toLowerCase()}`}
                                title={`Returned: ${order.returnedQty ?? 0}`}
                            >
                                <Pill size={10} />
                                {order.dispensedQty ?? 0}/{order.quantity ?? "—"} dispensed
                            </span>
                        )}
                        {order.dose && (
                            <span className="mar-signa-dose">· {order.dose} per dose</span>
                        )}
                    </div>

                    {order.instructions && (
                        <p className="mar-card__instr">{order.instructions}</p>
                    )}

                    {(order.prescribedBy || order.prescribedAt) && (
                        <p className="mar-card__prescriber">
                            <UserIcon size={10} />
                            {order.prescribedBy && <span>Dr. {order.prescribedBy}</span>}
                            {order.prescribedBy && order.prescribedAt && (
                                <span className="mar-card__prescriber-sep">·</span>
                            )}
                            {order.prescribedAt && <span>{fmtDateTime(order.prescribedAt)}</span>}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Stopped banner ── */}
            {isStopped && (
                <div className="mar-stopped-banner">
                    <StopCircle size={13} />
                    <span>
                        Stopped by Dr. {order.stoppedByName ?? "—"}
                        {order.stoppedAt ? ` on ${fmtDateTime(order.stoppedAt)}` : ""}
                        {order.stopReason ? ` — ${order.stopReason}` : ""}
                    </span>
                </div>
            )}

            {/* ── Log toggle ── */}
            <button type="button" className="mar-log-toggle" onClick={onToggleLog}>
                <span>
                    Administration log
                    <span className={`mar-log-count ${adminCount > 0 ? "has-entries" : "no-entries"}`}>
                        {adminCount}
                    </span>
                </span>
                {logExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* ── Log entries ── */}
            {logExpanded && (
                <div className="mar-log-list">
                    {adminCount === 0 ? (
                        <p className="mar-log-empty">No administrations recorded yet</p>
                    ) : (
                        order.administrations.map((a) => <EventRow key={a.id} admin={a} />)
                    )}
                </div>
            )}

            {/* ── Ward actions — return unused units ──
                Lives outside the administration form so it stays available
                even after the doctor stops the order (the strips are still
                on the trolley). Hidden after discharge. */}
            {canShowReturn && (
                <div className="mar-ward-actions">
                    {!returnOpen ? (
                        <button
                            type="button"
                            className="mar-return-btn"
                            onClick={onToggleReturn}
                            title={`Up to ${returnableQty} unit(s) returnable to pharmacy`}
                        >
                            <Undo2 size={13} />
                            Return unused to pharmacy
                            <span className="mar-return-btn__hint">({returnableQty} available)</span>
                        </button>
                    ) : (
                        <form
                            className="mar-return-form"
                            onSubmit={(e) => onReturn(e, order)}
                        >
                            <p className="mar-return-form__heading">
                                <Undo2 size={13} /> Return unused units to pharmacy
                            </p>
                            <p className="mar-return-form__sub">
                                Pharmacy will receive a verify request. Stock is re-credited
                                only after the pharmacist confirms the physical units arrive.
                            </p>

                            {/* Qty + Reason */}
                            <div className="mar-form__row-2">
                                <div className="mar-form__field">
                                    <label className="mar-form__label">
                                        Qty to return <span className="req">*</span>
                                        <span className="hint">max {returnableQty}</span>
                                    </label>
                                    <input
                                        type="number"
                                        className="mar-input"
                                        min="1"
                                        max={returnableQty}
                                        step="1"
                                        value={returnForm.returnQty}
                                        onChange={setReturnField(order.orderId, "returnQty")}
                                        required
                                    />
                                </div>
                                <div className="mar-form__field">
                                    <label className="mar-form__label">
                                        Reason <span className="req">*</span>
                                    </label>
                                    <select
                                        className="mar-input"
                                        value={returnForm.reasonCode}
                                        onChange={setReturnField(order.orderId, "reasonCode")}
                                        required
                                    >
                                        {RETURN_REASONS.map((r) => (
                                            <option key={r.value} value={r.value}>
                                                {r.label}{r.quarantine ? "  →  quarantine" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Reason notes — always shown, required only for OTHER */}
                            <div className="mar-form__field">
                                <label className="mar-form__label">
                                    Notes {reasonNotesReq ? <span className="req">*</span> : <span className="hint">optional</span>}
                                </label>
                                <textarea
                                    className="mar-input is-textarea"
                                    rows={2}
                                    placeholder={
                                        reasonMeta?.value === "INEFFECTIVE"
                                            ? "e.g. No symptom relief after 6h, vitals unchanged"
                                            : "Clinical context for pharmacy / audit"
                                    }
                                    value={returnForm.reasonNotes}
                                    onChange={setReturnField(order.orderId, "reasonNotes")}
                                    required={reasonNotesReq}
                                />
                            </div>

                            {/* Optional: also stop the order in the same call.
                                Only offered when (a) the order is still ACTIVE
                                and (b) the caller's role can stop. */}
                            {!isStopped && canStop && (
                                <div className="mar-return-form__stop">
                                    <label className="mar-return-form__stop-toggle">
                                        <input
                                            type="checkbox"
                                            checked={returnForm.stopOrder}
                                            onChange={setReturnField(order.orderId, "stopOrder")}
                                        />
                                        Also stop this order
                                    </label>
                                    {returnForm.stopOrder && (
                                        <div className="mar-form__field">
                                            <label className="mar-form__label">
                                                Stop reason <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="mar-input"
                                                placeholder="e.g. Switching to ibuprofen"
                                                value={returnForm.stopReason}
                                                onChange={setReturnField(order.orderId, "stopReason")}
                                                required
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mar-return-form__actions">
                                <button
                                    type="submit"
                                    className="mar-return-confirm-btn"
                                    disabled={returning}
                                >
                                    {returning
                                        ? <span className="zu-spinner" style={{ width: 13, height: 13 }} />
                                        : <Undo2 size={13} />}
                                    Send return to pharmacy
                                </button>
                                <button
                                    type="button"
                                    className="mar-return-cancel-btn"
                                    onClick={onToggleReturn}
                                    disabled={returning}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* ── Administration entry form — hidden after discharge or when stopped ── */}
            {!isDischarged && !isStopped && (
                <form className="mar-form" onSubmit={(e) => onSubmit(e, order.orderId)}>
                    <p className="mar-form__heading">Log administration</p>

                    {/* Row 1: Time + Status */}
                    <div className="mar-form__row-2">
                        <div className="mar-form__field">
                            <label className="mar-form__label">
                                Time <span className="req">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                className="mar-input"
                                value={form.administeredAt}
                                onChange={setField(order.orderId, "administeredAt")}
                                required
                            />
                        </div>

                        <div className="mar-form__field">
                            <label className="mar-form__label">
                                Status <span className="req">*</span>
                            </label>
                            <select
                                className="mar-input"
                                value={form.status}
                                onChange={setField(order.orderId, "status")}
                                required
                            >
                                {STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Dose given (optional) */}
                    <div className="mar-form__field">
                        <label className="mar-form__label">
                            Dose given
                            <span className="hint">
                                leave blank if same as ordered ({order.dose || "as prescribed"})
                            </span>
                        </label>
                        <input
                            type="text"
                            className="mar-input"
                            placeholder={order.dose ? `Default: ${order.dose}` : "e.g. 250mg, half tablet"}
                            value={form.doseGiven}
                            onChange={setField(order.orderId, "doseGiven")}
                        />
                    </div>

                    {/* Row 3: Reason — required for Held / Refused */}
                    {needsReason && (
                        <div className="mar-form__field">
                            <label className="mar-form__label">
                                Reason <span className="req">*</span>
                            </label>
                            <textarea
                                className="mar-input is-textarea"
                                rows={2}
                                placeholder={
                                    form.status === "HELD"
                                        ? "e.g. NPO before procedure, HR 130 — held per protocol"
                                        : "e.g. Patient declined, states nausea"
                                }
                                value={form.reason}
                                onChange={setField(order.orderId, "reason")}
                                required
                            />
                        </div>
                    )}

                    {/* Row 4: Notes (optional) */}
                    <div className="mar-form__field">
                        <label className="mar-form__label">Notes <span className="hint">optional</span></label>
                        <input
                            type="text"
                            className="mar-input"
                            placeholder="Any observations or context…"
                            value={form.notes}
                            onChange={setField(order.orderId, "notes")}
                        />
                    </div>

                    <div className="mar-form__actions">
                        <button type="submit" className="mar-record-btn" disabled={saving}>
                            {saving
                                ? <span className="zu-spinner" style={{ width: 14, height: 14 }} />
                                : <CheckCircle2 size={14} />}
                            Record
                        </button>

                        {/* Stop order — doctor / admin only */}
                        {canStop && (
                            <button
                                type="button"
                                className={`mar-stop-btn${stopOpen ? " is-open" : ""}`}
                                onClick={onToggleStop}
                            >
                                <StopCircle size={13} />
                                Stop order
                            </button>
                        )}
                    </div>

                    {/* Inline stop form */}
                    {canStop && stopOpen && (
                        <div className="mar-stop-form">
                            <p className="mar-stop-form__heading">Discontinue this order</p>
                            <div className="mar-form__field">
                                <label className="mar-form__label">
                                    Reason <span className="req">*</span>
                                </label>
                                <textarea
                                    className="mar-input is-textarea"
                                    rows={2}
                                    placeholder="e.g. Course completed, adverse reaction, switching drug"
                                    value={stopForm.reason}
                                    onChange={setStopField(order.orderId, "reason")}
                                    autoFocus
                                />
                            </div>
                            <div className="mar-stop-form__actions">
                                <button
                                    type="button"
                                    className="mar-stop-confirm-btn"
                                    disabled={stopping}
                                    onClick={(e) => onStop(e, order.orderId)}
                                >
                                    {stopping
                                        ? <span className="zu-spinner" style={{ width: 13, height: 13 }} />
                                        : <StopCircle size={13} />}
                                    Confirm stop
                                </button>
                                <button type="button" className="mar-stop-cancel-btn" onClick={onToggleStop}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            )}
        </div>
    );
}

// ── Administration event row ────────────────────────────────────────────────────

function EventRow({ admin }) {
    const meta = STATUS_META[admin.status] ?? STATUS_META.GIVEN;
    const Icon = meta.Icon;

    return (
        <div className={`mar-event ${meta.cls}`}>
            <div className="mar-event__top">
                <div className="mar-event__status">
                    <Icon size={13} />
                    <span>{meta.label}</span>
                </div>
                <div className="mar-event__meta">
                    {admin.administeredAt && (
                        <span className="mar-event__meta-item">
                            <Clock size={10} />
                            {fmtDateTime(admin.administeredAt)}
                        </span>
                    )}
                    {admin.administeredByName && (
                        <span className="mar-event__meta-item">
                            <UserIcon size={10} />
                            {admin.administeredByName}
                        </span>
                    )}
                    {admin.doseGiven && (
                        <span className="mar-event__dose-badge">{admin.doseGiven}</span>
                    )}
                </div>
            </div>
            {admin.reason && <p className="mar-event__reason">"{admin.reason}"</p>}
            {admin.notes  && <p className="mar-event__notes">{admin.notes}</p>}
        </div>
    );
}
