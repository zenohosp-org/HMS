import { useState, useEffect, useMemo } from "react";
import {
    invoiceApi,
    hospitalServiceApi,
    admissionApi,
    radiologyApi,
    patientServicesApi,
} from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
    Receipt,
    BedDouble,
    ScanLine,
    Stethoscope,
    Pill,
    FlaskConical,
    Wrench,
    Loader2,
    AlertCircle,
} from "lucide-react";
import { Alert, Button, Modal } from "@/components/ui";

/** Item-type → icon + tone palette. */
const TYPE_META = {
    ROOM_CHARGE: { label: "Room", icon: BedDouble, color: "#c2410c", bg: "#fff7ed" },
    CONSULTATION: { label: "Consultation", icon: Stethoscope, color: "#0369a1", bg: "var(--hms-info-bg)" },
    RADIOLOGY: { label: "Radiology", icon: ScanLine, color: "#6d28d9", bg: "#f5f3ff" },
    LAB_TEST: { label: "Lab test", icon: FlaskConical, color: "#0f766e", bg: "#f0fdfa" },
    MEDICINE: { label: "Medicine", icon: Pill, color: "#166534", bg: "var(--hms-success-bg)" },
    CUSTOM: { label: "Custom", icon: Wrench, color: "var(--hms-gray-600)", bg: "var(--hms-gray-100)" },
};

const GST_RATE = 0.18;

function countMealSlots(admitDate, dischargeDate, chargeTime) {
    if (!chargeTime) return 0;
    const [h, m] = chargeTime.split(":").map(Number);
    const admit = new Date(admitDate);
    const discharge = new Date(dischargeDate);
    let count = 0;
    const day = new Date(admit);
    day.setHours(0, 0, 0, 0);
    while (day <= discharge) {
        const slot = new Date(day);
        slot.setHours(h, m, 0, 0);
        if (slot >= admit && slot <= discharge) count++;
        day.setDate(day.getDate() + 1);
    }
    return count;
}

function fmt(n) {
    return (
        "₹" +
        Number(n || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
}

/**
 * Read-only billing preview for an admission. Auto-detects pending
 * charges (room, consultations, radiology, patient-services) by
 * combining the smart-suggestions endpoint with the hospital service
 * catalogue and the patient-services config. Phase 8c migration —
 * same compute pipeline (countMealSlots / GST_RATE / TYPE_META), same
 * "₹0 price detected" warning, same final-amount disclaimer.
 */
export default function ViewBillingModal({ admission, onClose }) {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (!user?.hospitalId || !admission.patientId) return;
        setLoading(true);

        const admitMs = new Date(admission.admissionDate).getTime();
        const elapsedMs = Date.now() - admitMs;
        const roomDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

        Promise.all([
            invoiceApi.getSmartSuggestions(admission.patientId, admission.id).catch(() => ({})),
            hospitalServiceApi.list(user.hospitalId).catch(() => []),
            admissionApi.get(admission.id).catch(() => null),
            radiologyApi.getByAdmission(admission.id).catch(() => []),
            patientServicesApi.list(user.hospitalId).catch(() => []),
        ])
            .then(([suggestions, services, fullAdmission, radiologyOrders, patientServices]) => {
                let key = 0;
                const auto = [];

                // Room charge — only after 24 hrs
                const roomNumber = admission.roomNumber || fullAdmission?.roomNumber;
                if (roomNumber && roomDays > 0) {
                    const pricePerDay =
                        suggestions.roomCharge?.pricePerDay ||
                        fullAdmission?.roomPricePerDay ||
                        fullAdmission?.room?.pricePerDay ||
                        fullAdmission?.room?.dailyCharge ||
                        fullAdmission?.ward?.dailyCharge ||
                        0;
                    const roomType = admission.roomType || fullAdmission?.roomType;
                    const roomLabel = roomType
                        ? `Room ${roomNumber} (${roomType.replace(/_/g, " ")})`
                        : `Room ${roomNumber}`;
                    auto.push({
                        key: key++,
                        itemType: "ROOM_CHARGE",
                        description: `${roomLabel} — ${roomDays} day${roomDays !== 1 ? "s" : ""}`,
                        quantity: roomDays,
                        unitPrice: pricePerDay,
                        totalPrice: roomDays * pricePerDay,
                    });
                }

                // Consultations
                suggestions.appointments?.forEach((a) => {
                    auto.push({
                        key: key++,
                        itemType: "CONSULTATION",
                        description: `Consultation — Dr. ${a.doctorName}${a.specialization ? ` (${a.specialization})` : ""}`,
                        quantity: 1,
                        unitPrice: a.consultationFee,
                        totalPrice: a.consultationFee,
                    });
                });

                // Radiology — scoped to this admission only
                const EXCLUDED_STATUSES = ["CANCELLED", "BILLED"];
                const pending = Array.isArray(radiologyOrders)
                    ? radiologyOrders.filter((r) => !EXCLUDED_STATUSES.includes(r.status))
                    : [];
                pending.forEach((r) => {
                    const name = r.serviceName || r.investigationName || r.testName || "Radiology";
                    const match = services.find((s) => s.name.toLowerCase() === name.toLowerCase());
                    const price = match?.price ?? 0;
                    auto.push({
                        key: key++,
                        itemType: "RADIOLOGY",
                        description: name,
                        quantity: 1,
                        unitPrice: price,
                        totalPrice: price,
                    });
                });

                // Patient services
                const enabledServices = Array.isArray(patientServices)
                    ? patientServices.filter((s) => s.isActive)
                    : [];
                const nowIso = new Date().toISOString();
                enabledServices.forEach((s) => {
                    if (s.type === "FOOD") {
                        const price = s.pricePerMeal || 0;
                        const quantity = s.chargeTime
                            ? countMealSlots(admission.admissionDate, nowIso, s.chargeTime)
                            : roomDays * 3;
                        auto.push({
                            key: key++,
                            itemType: "CUSTOM",
                            description: `${s.name} (${quantity} meal${quantity !== 1 ? "s" : ""})`,
                            quantity,
                            unitPrice: price,
                            totalPrice: quantity * price,
                        });
                    } else if (s.type === "REGISTRATION" && s.oneTimeCharge) {
                        const price = s.pricePerDay || 0;
                        auto.push({
                            key: key++,
                            itemType: "CUSTOM",
                            description: s.name,
                            quantity: 1,
                            unitPrice: price,
                            totalPrice: price,
                        });
                    } else {
                        const price = s.pricePerDay || 0;
                        const qty = s.chargeTime
                            ? countMealSlots(admission.admissionDate, nowIso, s.chargeTime)
                            : roomDays;
                        auto.push({
                            key: key++,
                            itemType: "CUSTOM",
                            description: `${s.name} (${qty} day${qty !== 1 ? "s" : ""})`,
                            quantity: qty,
                            unitPrice: price,
                            totalPrice: qty * price,
                        });
                    }
                });

                setItems(auto);
            })
            .catch(() => notify("Could not load billing details", "error"))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admission.id, user?.hospitalId]);

    const subtotal = useMemo(
        () => items.reduce((s, i) => s + (i.totalPrice || 0), 0),
        [items]
    );
    const medicineSubtotal = useMemo(
        () =>
            items
                .filter((i) => i.itemType === "MEDICINE")
                .reduce((s, i) => s + (i.totalPrice || 0), 0),
        [items]
    );
    const gst = medicineSubtotal * GST_RATE;
    const grandTotal = subtotal + gst;
    const hasZeroPrice = items.some(
        (i) => Number(i.unitPrice) === 0 && i.itemType !== "CUSTOM"
    );

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="lg"
            title={
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Receipt size={16} style={{ color: "var(--hms-info)" }} />
                    <div>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--hms-gray-900)",
                            }}
                        >
                            Billing details
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>
                            {admission.patientName} · {fmtId(admission.admissionNumber)}
                        </p>
                    </div>
                </div>
            }
            footer={
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            }
        >
            {loading ? (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 12,
                        padding: "80px 0",
                    }}
                >
                    <Loader2
                        size={32}
                        style={{ color: "var(--hms-gray-700)" }}
                        className="animate-spin"
                    />
                    <p style={{ margin: 0, fontSize: 13, color: "var(--hms-gray-500)" }}>
                        Detecting pending charges…
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--hms-gray-500)",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}
                        >
                            Pending charges
                        </p>
                        <p style={{ margin: "2px 0 12px", fontSize: 11, color: "var(--hms-gray-400)" }}>
                            All charges auto-detected based on services used during this admission
                        </p>

                        {items.length === 0 ? (
                            <div
                                style={{
                                    padding: "48px 16px",
                                    textAlign: "center",
                                    border: "2px dashed var(--hms-gray-200)",
                                    borderRadius: 8,
                                }}
                            >
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: "var(--hms-gray-500)",
                                    }}
                                >
                                    No charges detected
                                </p>
                                <p
                                    style={{
                                        margin: "4px 0 0",
                                        fontSize: 11,
                                        color: "var(--hms-gray-400)",
                                    }}
                                >
                                    Charges will appear here once services are recorded
                                </p>
                            </div>
                        ) : (
                            <div
                                style={{
                                    background: "var(--hms-white)",
                                    border: "1px solid var(--hms-gray-200)",
                                    borderRadius: 8,
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1.4fr 2.4fr 1fr 1fr 1fr",
                                        gap: 8,
                                        padding: "10px 16px",
                                        background: "var(--hms-gray-50)",
                                        borderBottom: "1px solid var(--hms-gray-100)",
                                    }}
                                >
                                    {[
                                        { h: "Type", align: "left" },
                                        { h: "Description", align: "left" },
                                        { h: "Qty", align: "center" },
                                        { h: "Unit ₹", align: "right" },
                                        { h: "Total", align: "right" },
                                    ].map(({ h, align }) => (
                                        <div
                                            key={h}
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: "var(--hms-gray-500)",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                                textAlign: align,
                                            }}
                                        >
                                            {h}
                                        </div>
                                    ))}
                                </div>

                                {items.map((item) => {
                                    const meta = TYPE_META[item.itemType] ?? TYPE_META.CUSTOM;
                                    const Icon = meta.icon;
                                    return (
                                        <div
                                            key={item.key}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "1.4fr 2.4fr 1fr 1fr 1fr",
                                                gap: 8,
                                                alignItems: "center",
                                                padding: "10px 16px",
                                                borderBottom: "1px solid var(--hms-gray-50)",
                                            }}
                                        >
                                            <div>
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: 4,
                                                        padding: "2px 8px",
                                                        borderRadius: 6,
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                        background: meta.bg,
                                                        color: meta.color,
                                                    }}
                                                >
                                                    <Icon size={11} />
                                                    {meta.label}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: "var(--hms-gray-700)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                                title={item.description}
                                            >
                                                {item.description}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: "var(--hms-gray-600)",
                                                    textAlign: "center",
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {item.quantity}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: "var(--hms-gray-600)",
                                                    textAlign: "right",
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {fmt(item.unitPrice)}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: "var(--hms-gray-800)",
                                                    textAlign: "right",
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {fmt(item.totalPrice)}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Totals */}
                                <div
                                    style={{
                                        padding: 16,
                                        borderTop: "1px solid var(--hms-gray-100)",
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        background: "var(--hms-gray-50)",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 240,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                            fontSize: 13,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                color: "var(--hms-gray-500)",
                                            }}
                                        >
                                            <span>Subtotal</span>
                                            <span
                                                style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
                                            >
                                                {fmt(subtotal)}
                                            </span>
                                        </div>
                                        {medicineSubtotal > 0 && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    color: "var(--hms-gray-500)",
                                                }}
                                            >
                                                <span>GST on medicines (18%)</span>
                                                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                                    {fmt(gst)}
                                                </span>
                                            </div>
                                        )}
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                fontWeight: 700,
                                                color: "var(--hms-gray-900)",
                                                fontSize: 15,
                                                borderTop: "1px solid var(--hms-gray-100)",
                                                paddingTop: 10,
                                                marginTop: 4,
                                            }}
                                        >
                                            <span>Estimated total</span>
                                            <span
                                                style={{
                                                    color: "var(--hms-info)",
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {fmt(grandTotal)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {hasZeroPrice && (
                        <Alert tone="warning" icon={<AlertCircle size={16} />}>
                            Some items have ₹0 — prices are auto-looked up from the service catalog.
                            Add the service in Settings → Packages if missing.
                        </Alert>
                    )}

                    <p
                        style={{
                            margin: 0,
                            fontSize: 11,
                            color: "var(--hms-gray-400)",
                            textAlign: "center",
                        }}
                    >
                        This is an estimated bill based on services used so far. Final amount may
                        vary at discharge.
                    </p>
                </div>
            )}
        </Modal>
    );
}
