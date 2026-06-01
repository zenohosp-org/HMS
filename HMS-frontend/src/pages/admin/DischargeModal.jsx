import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { admissionApi, invoiceApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import { useNotification } from "@/context/NotificationContext";
import {
    X,
    LogOut,
    CheckCircle2,
    Calendar,
    Loader2,
    AlertCircle,
    IndianRupee,
} from "lucide-react";
import {
    Alert,
    Button,
    FormGroup,
    Input,
    Textarea,
} from "@/components/ui";

function fmt(n) {
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/**
 * Discharge workflow modal. Fullscreen split-pane (clinical form on
 * the left, patient summary + bill status on the right) — the
 * pre-migration UX took the entire viewport because the discharge
 * checklist is read top-to-bottom and the summary needs to stay
 * pinned. Preserved as-is, only the styling is moved to hms-* tokens.
 *
 * Phase 8c migration: data layer untouched (admissionApi.discharge,
 * invoiceApi.getAdmissionInvoice), same bill-gate rejection handling
 * (INVOICE_UNPAID error), same submit-disabled rule when bill is not
 * cleared.
 */
export default function DischargeModal({ admission, onClose, onDischarged }) {
    const { notify } = useNotification();

    const [clinical, setClinical] = useState({
        actualDischargeDate: new Date().toISOString().slice(0, 16),
        dischargeDiagnosis: admission.primaryDiagnosis || "",
        dischargeNote: "",
        createFollowUp: false,
        followUpDate: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const [billError, setBillError] = useState(false);

    // null = unknown / loading, then: 'UNPAID' | 'PARTIAL' | 'PAID' | 'SETTLED' | 'UNSETTLED'
    const [billStatus, setBillStatus] = useState(null);
    const [billTotal, setBillTotal] = useState(0);
    const [billPaid, setBillPaid] = useState(0);

    useEffect(() => {
        invoiceApi
            .getAdmissionInvoice(admission.id)
            .then((inv) => {
                if (!inv) return;
                setBillStatus(inv.status);
                setBillTotal(Number(inv.total || 0));
                setBillPaid(Number(inv.paidAmount || 0));
            })
            .catch(() => { });
    }, [admission.id]);

    const billClear = billStatus === "PAID" || billStatus === "SETTLED";
    const balanceDue = Math.max(0, billTotal - billPaid);

    const handleDischarge = async () => {
        if (!clinical.actualDischargeDate) {
            notify("Discharge date is required", "error");
            return;
        }
        setSubmitting(true);
        setBillError(false);
        try {
            await admissionApi.discharge(admission.id, {
                actualDischargeDate: clinical.actualDischargeDate,
                dischargeDiagnosis: clinical.dischargeDiagnosis,
                dischargeNote: clinical.dischargeNote,
                createFollowUp: clinical.createFollowUp,
                followUpDate: clinical.followUpDate || null,
                followUpDoctorId: admission.admittingDoctorId || null,
            });
            notify("Patient discharged successfully", "success");
            onDischarged();
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || "";
            if (msg.includes("INVOICE_UNPAID")) {
                setBillError(true);
                setBillStatus((prev) =>
                    prev === "PAID" || prev === "SETTLED" ? prev : "UNSETTLED"
                );
            } else {
                notify(msg || "Discharge failed", "error");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const host =
        typeof document !== "undefined"
            ? document.getElementById("modal-root") || document.body
            : null;

    if (!host) return null;

    return createPortal(
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "var(--hms-white)",
                zIndex: "var(--hms-z-modal-overlay)",
                display: "flex",
                overflow: "hidden",
            }}
            role="dialog"
            aria-modal="true"
        >
            {/* Left panel — clinical form */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    borderRight: "1px solid var(--hms-gray-200)",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 24px",
                        borderBottom: "1px solid var(--hms-gray-100)",
                        flexShrink: 0,
                    }}
                >
                    <div>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: 15,
                                fontWeight: 700,
                                color: "var(--hms-gray-900)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <LogOut size={16} style={{ color: "var(--hms-danger)" }} /> Discharge patient
                        </h2>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--hms-gray-500)" }}>
                            {admission.patientName} · {fmtId(admission.admissionNumber)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="hms-modal-close"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Clinical fields */}
                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: 24,
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                    }}
                >
                    {billStatus && !billClear && (
                        <Alert
                            tone="danger"
                            icon={<AlertCircle size={16} />}
                            title={
                                billStatus === "PARTIAL"
                                    ? "Partial payment — balance outstanding"
                                    : "Bill not settled"
                            }
                        >
                            {billStatus === "PARTIAL" ? (
                                <>
                                    <strong>{fmt(balanceDue)}</strong> still due. Collect the remaining
                                    balance in the <strong>Billing</strong> tab before discharging.
                                </>
                            ) : (
                                <>
                                    Finalize and settle the patient's bill in the{" "}
                                    <strong>Billing</strong> tab before discharging.
                                </>
                            )}
                        </Alert>
                    )}

                    {billError && billClear && (
                        <Alert
                            tone="danger"
                            icon={<AlertCircle size={16} />}
                            title="Bill not paid"
                        >
                            Please finalize and pay the patient's bill in the{" "}
                            <strong>Billing</strong> tab before discharging.
                        </Alert>
                    )}

                    <FormGroup label="Discharge date & time *">
                        <Input
                            type="datetime-local"
                            required
                            value={clinical.actualDischargeDate}
                            onChange={(e) =>
                                setClinical((c) => ({ ...c, actualDischargeDate: e.target.value }))
                            }
                        />
                    </FormGroup>
                    <FormGroup label="Discharge diagnosis">
                        <Input
                            placeholder="Final diagnosis on discharge"
                            value={clinical.dischargeDiagnosis}
                            onChange={(e) =>
                                setClinical((c) => ({ ...c, dischargeDiagnosis: e.target.value }))
                            }
                        />
                    </FormGroup>
                    <FormGroup label="Discharge summary / notes">
                        <Textarea
                            rows={3}
                            placeholder="Treatment summary, post-discharge instructions…"
                            value={clinical.dischargeNote}
                            onChange={(e) =>
                                setClinical((c) => ({ ...c, dischargeNote: e.target.value }))
                            }
                        />
                    </FormGroup>

                    <div
                        style={{
                            borderRadius: 8,
                            border: "1px solid var(--hms-gray-200)",
                            padding: 16,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={clinical.createFollowUp}
                                onChange={(e) =>
                                    setClinical((c) => ({ ...c, createFollowUp: e.target.checked }))
                                }
                                style={{
                                    width: 16,
                                    height: 16,
                                    accentColor: "var(--hms-brand-primary)",
                                    cursor: "pointer",
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "var(--hms-gray-800)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Calendar size={14} style={{ color: "var(--hms-gray-400)" }} />
                                Schedule OPD follow-up
                            </span>
                        </label>
                        {clinical.createFollowUp && (
                            <div style={{ paddingLeft: 28 }}>
                                <FormGroup label="Follow-up date *">
                                    <Input
                                        type="date"
                                        value={clinical.followUpDate}
                                        onChange={(e) =>
                                            setClinical((c) => ({ ...c, followUpDate: e.target.value }))
                                        }
                                    />
                                </FormGroup>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 12,
                        padding: "16px 24px",
                        borderTop: "1px solid var(--hms-gray-100)",
                        background: "var(--hms-gray-50)",
                    }}
                >
                    <Button variant="cancel" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleDischarge}
                        disabled={
                            submitting ||
                            !clinical.actualDischargeDate ||
                            (billStatus !== null && !billClear)
                        }
                        loading={submitting}
                        title={
                            !billClear && billStatus
                                ? "Settle the outstanding bill before discharging"
                                : undefined
                        }
                    >
                        <CheckCircle2 size={14} /> Confirm discharge
                    </Button>
                </div>
            </div>

            {/* Right panel — patient summary */}
            <div
                style={{
                    width: 340,
                    flexShrink: 0,
                    background: "var(--hms-gray-50)",
                    overflowY: "auto",
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                }}
            >
                <div>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--hms-gray-400)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: 8,
                        }}
                    >
                        Patient
                    </p>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 20,
                            fontWeight: 700,
                            color: "var(--hms-gray-900)",
                            lineHeight: 1.2,
                        }}
                    >
                        {admission.patientName}
                    </p>
                    {(admission.patientUhid || admission.uhid) && (
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--hms-gray-500)" }}>
                            UHID: {fmtId(admission.patientUhid || admission.uhid)}
                        </p>
                    )}
                </div>

                <div
                    style={{
                        borderRadius: 12,
                        border: "1px solid var(--hms-gray-200)",
                        background: "var(--hms-white)",
                        overflow: "hidden",
                    }}
                >
                    {[
                        ["Admission no.", fmtId(admission.admissionNumber)],
                        ["IPD no.", admission.ipdNumber || admission.ipd_number || null],
                        [
                            "Room / ward",
                            [admission.roomNumber, admission.wardName].filter(Boolean).join(" · ") ||
                            "—",
                        ],
                        [
                            "Admitting doctor",
                            admission.admittingDoctorName || admission.doctorName || "—",
                        ],
                        [
                            "Admitted",
                            admission.admissionDate
                                ? new Date(admission.admissionDate).toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                })
                                : "—",
                        ],
                        [
                            "Discharge",
                            clinical.actualDischargeDate
                                ? new Date(clinical.actualDischargeDate).toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                })
                                : "—",
                        ],
                        [
                            "Diagnosis",
                            clinical.dischargeDiagnosis || admission.primaryDiagnosis || "—",
                        ],
                    ]
                        .filter(([, v]) => v !== null)
                        .map(([label, value], idx) => (
                            <div
                                key={label}
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: "12px 16px",
                                    borderTop: idx === 0 ? "none" : "1px solid var(--hms-gray-100)",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: "var(--hms-gray-500)",
                                        flexShrink: 0,
                                        paddingTop: 2,
                                    }}
                                >
                                    {label}
                                </span>
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "var(--hms-gray-800)",
                                        textAlign: "right",
                                    }}
                                >
                                    {value}
                                </span>
                            </div>
                        ))}
                </div>

                {/* Billing status card */}
                <BillingStatusCard
                    billStatus={billStatus}
                    billClear={billClear}
                    billTotal={billTotal}
                    billPaid={billPaid}
                    balanceDue={balanceDue}
                />
            </div>
        </div>,
        host
    );
}

function BillingStatusCard({ billStatus, billClear, billTotal, billPaid, balanceDue }) {
    const fmtLocal = (n) =>
        "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

    const tone =
        billStatus === null
            ? { bg: "var(--hms-gray-50)", border: "var(--hms-gray-200)", iconColor: "var(--hms-gray-400)" }
            : billClear
                ? {
                    bg: "var(--hms-success-bg)",
                    border: "var(--hms-success-border)",
                    iconColor: "var(--hms-success)",
                }
                : billStatus === "PARTIAL"
                    ? { bg: "#fff7ed", border: "#fed7aa", iconColor: "#c2410c" }
                    : {
                        bg: "var(--hms-danger-bg)",
                        border: "var(--hms-danger-border)",
                        iconColor: "var(--hms-danger)",
                    };

    return (
        <div
            style={{
                padding: 14,
                borderRadius: 8,
                border: `1px solid ${tone.border}`,
                background: tone.bg,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
            }}
        >
            <IndianRupee size={16} style={{ color: tone.iconColor, flexShrink: 0, marginTop: 2 }} />
            <div>
                {billStatus === null && (
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--hms-gray-500)" }}>
                        Checking bill…
                    </p>
                )}
                {billClear && (
                    <>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#166534" }}>
                            Bill fully settled
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#166534" }}>
                            {fmtLocal(billTotal)} settled — patient can be discharged.
                        </p>
                    </>
                )}
                {billStatus === "PARTIAL" && (
                    <>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#c2410c" }}>
                            Partial payment received
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#c2410c" }}>
                            {fmtLocal(billPaid)} paid · <strong>{fmtLocal(balanceDue)} still due</strong>.
                            Collect balance in Billing tab.
                        </p>
                    </>
                )}
                {(billStatus === "UNPAID" || billStatus === "UNSETTLED") && (
                    <>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
                            Bill not settled
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#dc2626" }}>
                            Finalize and settle{" "}
                            {billTotal > 0 ? fmtLocal(billTotal) : "the bill"} in the Billing tab before
                            discharging.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
