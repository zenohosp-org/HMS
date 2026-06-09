import { useState, useEffect, useCallback } from "react";
import { useNotification } from "@/context/NotificationContext";
import { marApi } from "@/utils/api";
import { CenterLoader } from "@/components/ui/Loader";
import {
    Pill, Clock, User as UserIcon, CheckCircle2, XCircle,
    PauseCircle, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { fmtDateTime } from "@/utils/date";
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function localNow() {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
}

function emptyForm() {
    return { administeredAt: localNow(), status: "GIVEN", doseGiven: "", reason: "", notes: "" };
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function IpdMarTab({ admissionId, isDischarged }) {
    const { notify } = useNotification();

    const [orders, setOrders]     = useState([]);
    const [loading, setLoading]   = useState(true);
    const [forms, setForms]       = useState({});
    const [expanded, setExpanded] = useState({});
    const [savingId, setSavingId] = useState(null);

    const fetchOrders = useCallback(async () => {
        try {
            const data = await marApi.list(admissionId);
            setOrders(data ?? []);
        } catch {
            // Non-fatal — empty state shown; user can switch tabs to retry
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const getForm     = (id) => forms[id] ?? emptyForm();
    const setField    = (id, field) => (e) =>
        setForms((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyForm()), [field]: e.target.value } }));
    const resetForm   = (id) => setForms((prev) => ({ ...prev, [id]: emptyForm() }));
    const toggleLog   = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

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

    return (
        <div className="hms-ipd-tab-body mar-tab">

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
                    {orders.map((order) => (
                        <OrderCard
                            key={order.orderId}
                            order={order}
                            form={getForm(order.orderId)}
                            setField={setField}
                            onSubmit={handleSubmit}
                            saving={savingId === order.orderId}
                            logExpanded={!!expanded[order.orderId]}
                            onToggleLog={() => toggleLog(order.orderId)}
                            isDischarged={isDischarged}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Order card ──────────────────────────────────────────────────────────────────

function OrderCard({ order, form, setField, onSubmit, saving, logExpanded, onToggleLog, isDischarged }) {
    const adminCount  = order.administrations?.length ?? 0;
    const needsReason = form.status === "HELD" || form.status === "REFUSED";

    const drugTitle = [order.drugName, order.drugStrength, order.drugForm].filter(Boolean).join(" ");

    return (
        <div className="mar-card">

            {/* ── Drug info ── */}
            <div className="mar-card__info">
                <div className="mar-card__icon">
                    <Pill size={15} />
                </div>
                <div className="mar-card__text">
                    <p className="mar-card__drug-name">{drugTitle}</p>

                    {/* Frequency + route pills + per-dose amount */}
                    <div className="mar-card__signa">
                        {order.frequency && (
                            <span className="mar-signa-pill is-freq">{order.frequency}</span>
                        )}
                        {order.route && (
                            <span className="mar-signa-pill is-route">{order.route}</span>
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

            {/* ── Entry form — hidden after discharge ── */}
            {!isDischarged && (
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
                    </div>
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
