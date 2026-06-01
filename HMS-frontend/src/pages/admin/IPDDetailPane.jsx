import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
    X,
    BedDouble,
    Stethoscope,
    Clock,
    Calendar,
    LogOut,
    Scissors,
    Activity,
    Package,
    Receipt,
    Phone,
    User,
    Loader2,
    ExternalLink,
    RotateCcw,
    ScanLine,
    Pill,
    FlaskConical,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    ShieldAlert,
    Plus,
    FileText,
} from "lucide-react";
import { fmtDateTime, fmtDateMed } from "@/utils/date";
import {
    roomLogsApi,
    radiologyApi,
    ambulanceApi,
    assetApi,
    invoiceApi,
    hospitalServiceApi,
    patientServicesApi,
    admissionApi,
    recordApi,
} from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import axios from "axios";
import SSOCookieManager from "@/utils/ssoManager";
import WritePrescriptionModal from "@/components/modals/WritePrescriptionModal";
import { useNotification } from "@/context/NotificationContext";
import {
    Alert,
    Badge,
    Button,
    FormGroup,
    Input,
    Tabs,
    Textarea,
} from "@/components/ui";

const otApi = axios.create({
    baseURL: "https://api-ot.zenohosp.com",
    withCredentials: true,
});
otApi.interceptors.request.use((config) => {
    const token = SSOCookieManager.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const pharmacyApi = axios.create({
    baseURL: "https://api-pharmacy.zenohosp.com",
    withCredentials: true,
});
pharmacyApi.interceptors.request.use((config) => {
    const token = SSOCookieManager.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const TABS = [
    { id: "IPD Log", label: "IPD log" },
    { id: "Attendor Details", label: "Attender" },
    { id: "Room Mapped Assets", label: "Assets" },
    { id: "IPD Billing", label: "Billing" },
];

const GST_RATE = 0.18;

/** Timeline event tone — drives the small left-strip + status badge. */
const EVENT_TONE = {
    ADMITTED: { color: "#166534", bg: "var(--hms-success-bg)", border: "var(--hms-success-border)" },
    ALLOCATED: { color: "#0369a1", bg: "var(--hms-info-bg)", border: "var(--hms-info-border)" },
    DEALLOCATED: { color: "#b45309", bg: "var(--hms-warning-bg)", border: "var(--hms-warning-border)" },
    ATTENDER_ASSIGNED: {
        color: "var(--hms-gray-600)",
        bg: "var(--hms-gray-50)",
        border: "var(--hms-gray-200)",
    },
    ATTENDER_UPDATED: {
        color: "var(--hms-gray-600)",
        bg: "var(--hms-gray-50)",
        border: "var(--hms-gray-200)",
    },
    RADIOLOGY: { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
    AMBULANCE: { color: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
    OT: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    DISCHARGED: { color: "var(--hms-gray-600)", bg: "var(--hms-gray-100)", border: "var(--hms-gray-200)" },
    RECORD: { color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
};
const EVENT_LABEL = {
    ADMITTED: "ADMITTED",
    ALLOCATED: "ROOM ASSIGNED",
    DEALLOCATED: "ROOM VACATED",
    ATTENDER_ASSIGNED: "ATTENDER ASSIGNED",
    ATTENDER_UPDATED: "ATTENDER UPDATED",
    RADIOLOGY: "RADIOLOGY",
    AMBULANCE: "AMBULANCE",
    OT: "OT PROCEDURE",
    DISCHARGED: "DISCHARGED",
    RECORD: "MEDICAL RECORD",
};

/** Billing item-type → icon + colour pair. Used by both billing views. */
const BILL_TYPE_META = {
    ROOM_CHARGE: { label: "Room", Icon: BedDouble, color: "#c2410c", bg: "#fff7ed" },
    CONSULTATION: { label: "Consult", Icon: Stethoscope, color: "#0369a1", bg: "var(--hms-info-bg)" },
    RADIOLOGY: { label: "Radiology", Icon: ScanLine, color: "#6d28d9", bg: "#f5f3ff" },
    LAB_TEST: { label: "Lab", Icon: FlaskConical, color: "#0f766e", bg: "#f0fdfa" },
    MEDICINE: { label: "Medicine", Icon: Pill, color: "#166534", bg: "var(--hms-success-bg)" },
    OT: { label: "OT", Icon: Scissors, color: "#7c3aed", bg: "#f5f3ff" },
    CUSTOM: {
        label: "Custom",
        Icon: Wrench,
        color: "var(--hms-gray-600)",
        bg: "var(--hms-gray-100)",
    },
};

const fmt = fmtDateTime;
const fmtDate = fmtDateMed;
function fmtMoney(n) {
    return (
        "₹" +
        Number(n || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
}
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

/**
 * IPDDetailPane — right-edge slide-in drawer for an in-patient
 * admission. Four lazy-loaded tabs (IPD log timeline · Attender ·
 * Room-mapped assets · IPD billing). Phase 8d migration: data layer
 * untouched (every API surface listed in the original file's imports
 * still drives the pane — admissionApi/recordApi/roomLogsApi/
 * radiologyApi/ambulanceApi/assetApi/invoiceApi/hospitalServiceApi/
 * patientServicesApi + the external otApi + pharmacyApi instances).
 *
 * The polled 30s refresh on the IPD Log tab, the Bug-1 OT/pharmacy
 * retry UI, the optimistic record-insert, and the multi-stage
 * discharge guard (no-invoice / unpaid → blocks parent's onDischarge)
 * are all preserved byte-for-byte.
 *
 * Tabs are extracted as inline subcomponents so the parent stays
 * readable — same approach used for DoctorDetails in Phase 7.
 */
export default function IPDDetailPane({
    admission,
    onClose,
    onDischarge,
    onMoveToOT,
    onReturnToWard,
}) {
    const { user } = useAuth();
    const { notify } = useNotification();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("IPD Log");

    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    const [assets, setAssets] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [assetsFetched, setAssetsFetched] = useState(false);

    const [billingItems, setBillingItems] = useState([]);
    const [finalInvoice, setFinalInvoice] = useState(null);
    const [otInvoices, setOtInvoices] = useState([]);
    const [otInvoicesError, setOtInvoicesError] = useState(false);
    const [pharmacyBills, setPharmacyBills] = useState([]);
    const [pharmacyBillsError, setPharmacyBillsError] = useState(false);
    const [loadingBilling, setLoadingBilling] = useState(false);
    const [billingFetched, setBillingFetched] = useState(false);

    const [showAddRecord, setShowAddRecord] = useState(false);
    const [recordForm, setRecordForm] = useState({
        historyType: "CONSULTATION",
        description: "",
        nextVisitDate: "",
    });
    const [savingRecord, setSavingRecord] = useState(false);
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

    const [checkingDischarge, setCheckingDischarge] = useState(false);
    const [dischargeBlock, setDischargeBlock] = useState(null);

    /* Billing totals (estimation view) */
    const subtotal = useMemo(
        () => billingItems.reduce((s, i) => s + (i.totalPrice || 0), 0),
        [billingItems]
    );
    const gst = useMemo(
        () =>
            billingItems
                .filter((i) => i.itemType === "MEDICINE")
                .reduce((s, i) => s + (i.totalPrice || 0), 0) * GST_RATE,
        [billingItems]
    );
    const grandTotal = subtotal + gst;
    const hasZeroPrice = billingItems.some(
        (i) => Number(i.unitPrice) === 0 && i.itemType !== "CUSTOM"
    );

    const handleDischargeClick = useCallback(async () => {
        setCheckingDischarge(true);
        setDischargeBlock(null);
        try {
            const invoices = await invoiceApi.getPatientInvoices(admission.patientId);
            const admissionInvoices = (invoices || []).filter(
                (inv) => String(inv.admissionId) === String(admission.id)
            );
            if (admissionInvoices.length === 0) {
                setDischargeBlock({ reason: "no_invoice", amount: null });
                return;
            }
            const unpaid = admissionInvoices.find(
                (inv) => inv.status !== "PAID" && inv.status !== "SETTLED"
            );
            if (unpaid) {
                setDischargeBlock({ reason: "unpaid", amount: Number(unpaid.total || 0) });
                return;
            }
            onDischarge();
        } catch {
            onDischarge();
        } finally {
            setCheckingDischarge(false);
        }
    }, [admission?.id, admission?.patientId, onDischarge]);

    const retryOtInvoices = useCallback(async () => {
        setOtInvoicesError(false);
        try {
            const res = await otApi.get("/api/ot/invoices", {
                params: { admissionId: admission.id },
            });
            setOtInvoices(Array.isArray(res.data) ? res.data : res.data?.content ?? []);
        } catch {
            setOtInvoicesError(true);
        }
    }, [admission?.id]);

    const retryPharmacyBills = useCallback(async () => {
        setPharmacyBillsError(false);
        try {
            const res = await pharmacyApi.get("/api/pharmacy/bills", {
                params: { admissionId: admission.id, unbilled: true },
            });
            setPharmacyBills(
                Array.isArray(res.data) ? res.data : res.data?.content ?? []
            );
        } catch {
            setPharmacyBillsError(true);
        }
    }, [admission?.id]);

    const fetchLogs = useCallback(
        async (silent = false) => {
            if (!admission) return;
            if (!silent) setLoadingLogs(true);
            const events = [];
            const admitStart = new Date(admission.admissionDate).getTime();
            const admitEnd = admission.actualDischargeDate
                ? new Date(admission.actualDischargeDate).getTime()
                : Date.now();

            events.push({
                id: "admitted",
                type: "ADMITTED",
                title: "Patient admitted",
                subtitle: admission.admittingDoctorName
                    ? `Under the care of Dr. ${admission.admittingDoctorName}`
                    : admission.chiefComplaint || "",
                timestamp: new Date(admission.admissionDate),
            });

            if (admission.actualDischargeDate) {
                events.push({
                    id: "discharged",
                    type: "DISCHARGED",
                    title: "Patient discharged",
                    subtitle: [
                        admission.dischargeDiagnosis
                            ? `Diagnosis: ${admission.dischargeDiagnosis}`
                            : null,
                        admission.dischargeNote || null,
                    ]
                        .filter(Boolean)
                        .join(" · "),
                    timestamp: new Date(admission.actualDischargeDate),
                });
            }

            await Promise.allSettled([
                admission.roomId
                    ? roomLogsApi.getRoomLogs(admission.roomId, user.hospitalId).then((data) =>
                        data
                            .filter((l) => {
                                if (
                                    l.patientUhid &&
                                    l.patientUhid !== admission.patientUhid
                                )
                                    return false;
                                const t = new Date(l.createdAt).getTime();
                                return t >= admitStart && t <= admitEnd;
                            })
                            .forEach((l) => {
                                let title, subtitle;
                                if (l.event === "ALLOCATED") {
                                    title = `Admitted to Room ${l.roomNumber}`;
                                    subtitle = l.performedBy ? `Allocated by ${l.performedBy}` : "";
                                } else if (l.event === "DEALLOCATED") {
                                    title = `Released from Room ${l.roomNumber}`;
                                    subtitle = l.performedBy ? `Processed by ${l.performedBy}` : "";
                                } else if (l.event === "ATTENDER_ASSIGNED") {
                                    title = l.attenderName
                                        ? `Attendor "${l.attenderName}" Registered`
                                        : "Attendor Added to Record";
                                    subtitle = l.performedBy ? `Added by ${l.performedBy}` : "";
                                } else if (l.event === "ATTENDER_UPDATED") {
                                    title = l.attenderName
                                        ? `Attendor Details Updated — ${l.attenderName}`
                                        : "Attendor Information Updated";
                                    subtitle = l.performedBy ? `Updated by ${l.performedBy}` : "";
                                } else {
                                    title = l.event.replace(/_/g, " ");
                                    subtitle = [
                                        `Room ${l.roomNumber}`,
                                        l.performedBy ? `by ${l.performedBy}` : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ");
                                }
                                events.push({
                                    id: `room-${l.id}`,
                                    type: l.event,
                                    title,
                                    subtitle,
                                    timestamp: new Date(l.createdAt),
                                });
                            })
                    )
                    : Promise.resolve(),

                radiologyApi.getByAdmission(admission.id).then((data) =>
                    data.forEach((r) => {
                        const statusLabel =
                            r.status === "REPORT_GENERATED"
                                ? "Report Ready"
                                : r.status === "SCANNED"
                                    ? "Scan Completed"
                                    : r.status === "PENDING"
                                        ? "Awaiting Scan"
                                        : (r.status || "").replace(/_/g, " ");
                        events.push({
                            id: `rad-${r.id}`,
                            type: "RADIOLOGY",
                            title: `${r.serviceName || "Radiology"} — ${statusLabel}`,
                            subtitle: [
                                r.technicianName ? `Performed by ${r.technicianName}` : null,
                                r.referredByName ? `Referred by Dr. ${r.referredByName}` : null,
                            ]
                                .filter(Boolean)
                                .join(" · "),
                            timestamp: new Date(r.reportedAt || r.scannedAt || r.createdAt),
                            badge: statusLabel,
                        });
                    })
                ),

                ambulanceApi.getBookings(user.hospitalId).then((data) =>
                    data
                        .filter((b) => {
                            if (String(b.patient?.id) !== String(admission.patientId))
                                return false;
                            const t = new Date(b.createdAt).getTime();
                            return t >= admitStart && t <= admitEnd;
                        })
                        .forEach((b) =>
                            events.push({
                                id: `amb-${b.id}`,
                                type: "AMBULANCE",
                                title: b.ambulanceType?.name
                                    ? `${b.ambulanceType.name} Ambulance Dispatched`
                                    : "Ambulance Dispatched",
                                subtitle: [
                                    b.pickupAddress ? `From: ${b.pickupAddress}` : null,
                                    b.driverName ? `Driver: ${b.driverName}` : null,
                                    b.vehicleNumber ? `Vehicle: ${b.vehicleNumber}` : null,
                                ]
                                    .filter(Boolean)
                                    .join(" · "),
                                timestamp: new Date(b.createdAt),
                                badge: b.status,
                            })
                        )
                ),

                recordApi
                    .list(admission.patientId, user.hospitalId)
                    .then((records) => {
                        records
                            .filter(
                                (r) =>
                                    r.admissionId &&
                                    String(r.admissionId) === String(admission.id)
                            )
                            .forEach((r) => {
                                const creator = r.createdBy
                                    ? `${r.createdBy.firstName} ${r.createdBy.lastName}`
                                    : "";
                                events.push({
                                    id: `rec-${r.id}`,
                                    type: "RECORD",
                                    title: (r.historyType || "OTHER").replace("_", " "),
                                    subtitle: [r.mrn, creator].filter(Boolean).join(" · "),
                                    description: r.description || "",
                                    timestamp: new Date(r.createdAt),
                                });
                            });
                    })
                    .catch(() => { }),

                otApi
                    .get("/api/ot/bookings")
                    .then((res) => {
                        const bookings = Array.isArray(res.data)
                            ? res.data
                            : res.data?.content ?? [];
                        bookings
                            .filter((ob) => {
                                if (ob.admissionId)
                                    return String(ob.admissionId) === String(admission.id);
                                if (
                                    admission.otBookingId &&
                                    String(ob.id) === String(admission.otBookingId)
                                )
                                    return true;
                                if (String(ob.patientId) === String(admission.patientId)) {
                                    const t = new Date(
                                        ob.scheduledDate || ob.bookingDate || ob.createdAt
                                    ).getTime();
                                    return t >= admitStart && t <= admitEnd;
                                }
                                return false;
                            })
                            .forEach((ob) => {
                                const procedure =
                                    ob.procedureName ||
                                    ob.surgeryType ||
                                    ob.procedure ||
                                    "Surgical Procedure";
                                const surgeon = ob.surgeonName || ob.surgeon;
                                events.push({
                                    id: `ot-${ob.id}`,
                                    type: "OT",
                                    title: `${procedure} — Scheduled in OT`,
                                    subtitle: [
                                        surgeon ? `Surgeon: Dr. ${surgeon}` : null,
                                        ob.status
                                            ? `Status: ${ob.status.replace(/_/g, " ")}`
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" · "),
                                    timestamp: new Date(
                                        ob.scheduledDate || ob.bookingDate || ob.createdAt
                                    ),
                                    badge: ob.status?.replace(/_/g, " "),
                                });
                            });
                    })
                    .catch(() => { }),
            ]);

            events.sort((a, b) => b.timestamp - a.timestamp);
            setLogs(events);
            if (!silent) setLoadingLogs(false);
        },
        [admission?.id, user?.hospitalId]
    );

    const fetchBilling = useCallback(async () => {
        setLoadingBilling(true);
        const isDischarged = !!admission.actualDischargeDate;
        const admitMs = new Date(admission.admissionDate).getTime();
        const endMs = isDischarged
            ? new Date(admission.actualDischargeDate).getTime()
            : Date.now();
        const roomDays = Math.floor((endMs - admitMs) / (1000 * 60 * 60 * 24));

        if (isDischarged) {
            try {
                const allInvoices = await invoiceApi.getPatientInvoices(admission.patientId);
                const match = (allInvoices || []).find(
                    (inv) => String(inv.admissionId) === String(admission.id)
                );
                if (match) {
                    setFinalInvoice(match);
                    try {
                        const res = await otApi.get("/api/ot/invoices", {
                            params: { admissionId: admission.id },
                        });
                        setOtInvoices(
                            Array.isArray(res.data) ? res.data : res.data?.content ?? []
                        );
                        setOtInvoicesError(false);
                    } catch {
                        setOtInvoicesError(true);
                    }
                    try {
                        const res = await pharmacyApi.get("/api/pharmacy/bills", {
                            params: { admissionId: admission.id, unbilled: true },
                        });
                        setPharmacyBills(
                            Array.isArray(res.data) ? res.data : res.data?.content ?? []
                        );
                        setPharmacyBillsError(false);
                    } catch {
                        setPharmacyBillsError(true);
                    }
                    setBillingFetched(true);
                    setLoadingBilling(false);
                    return;
                }
            } catch { /* fall through to estimation */ }
        }

        let key = 0;
        const items = [];
        try {
            const [suggestions, services, fullAdmission, radiologyOrders, patientServices, allPatientInvoices] =
                await Promise.all([
                    invoiceApi
                        .getSmartSuggestions(admission.patientId, admission.id)
                        .catch(() => ({})),
                    hospitalServiceApi.list(user.hospitalId).catch(() => []),
                    admissionApi.get(admission.id).catch(() => null),
                    radiologyApi.getByAdmission(admission.id).catch(() => []),
                    patientServicesApi.list(user.hospitalId).catch(() => []),
                    invoiceApi.getPatientInvoices(admission.patientId).catch(() => []),
                ]);

            const isFirstAdmission =
                (allPatientInvoices || []).filter(
                    (inv) =>
                        inv.admissionId &&
                        String(inv.admissionId) !== String(admission.id)
                ).length === 0;

            const roomNumber = admission.roomNumber || fullAdmission?.roomNumber;
            if (roomNumber && roomDays > 0) {
                const pricePerDay =
                    suggestions.roomCharge?.pricePerDay ||
                    fullAdmission?.roomPricePerDay ||
                    0;
                items.push({
                    key: key++,
                    itemType: "ROOM_CHARGE",
                    description: `Room ${roomNumber} (${roomDays} day${roomDays !== 1 ? "s" : ""})`,
                    quantity: roomDays,
                    unitPrice: pricePerDay,
                    totalPrice: roomDays * pricePerDay,
                });
            }

            const consults = Array.isArray(suggestions.appointments)
                ? suggestions.appointments
                : [];
            consults.forEach((a) => {
                const price = a.consultationFee || 0;
                items.push({
                    key: key++,
                    itemType: "CONSULTATION",
                    description: a.doctorName
                        ? `Consultation - Dr. ${a.doctorName}`
                        : "Consultation",
                    quantity: 1,
                    unitPrice: price,
                    totalPrice: price,
                });
            });

            const EXCLUDED = ["CANCELLED", "BILLED"];
            (Array.isArray(radiologyOrders) ? radiologyOrders : [])
                .filter((r) => !EXCLUDED.includes(r.status))
                .forEach((r) => {
                    const name = r.serviceName || r.investigationName || "Radiology";
                    const match = (Array.isArray(services) ? services : []).find(
                        (s) => s.name?.toLowerCase() === name.toLowerCase()
                    );
                    const price = match?.price ?? 0;
                    items.push({
                        key: key++,
                        itemType: "RADIOLOGY",
                        description: name,
                        quantity: 1,
                        unitPrice: price,
                        totalPrice: price,
                    });
                });

            const meds = Array.isArray(suggestions.medicines) ? suggestions.medicines : [];
            meds.forEach((m) => {
                const price = m.totalPrice || m.price || 0;
                items.push({
                    key: key++,
                    itemType: "MEDICINE",
                    description: m.name || "Medicine",
                    quantity: m.quantity || 1,
                    unitPrice: m.unitPrice || price,
                    totalPrice: price,
                });
            });

            const enabledServices = (Array.isArray(patientServices) ? patientServices : [])
                .filter((s) => s.isActive);
            const svcEndDate = isDischarged
                ? admission.actualDischargeDate
                : new Date().toISOString();
            enabledServices.forEach((s) => {
                if (s.type === "FOOD") {
                    const qty = s.chargeTime
                        ? countMealSlots(admission.admissionDate, svcEndDate, s.chargeTime)
                        : roomDays * 3;
                    items.push({
                        key: key++,
                        itemType: "CUSTOM",
                        description: `${s.name} (${qty} meal${qty !== 1 ? "s" : ""})`,
                        quantity: qty,
                        unitPrice: s.pricePerMeal || 0,
                        totalPrice: qty * (s.pricePerMeal || 0),
                    });
                } else if (s.type === "REGISTRATION" && s.oneTimeCharge) {
                    if (isFirstAdmission) {
                        items.push({
                            key: key++,
                            itemType: "CUSTOM",
                            description: s.name,
                            quantity: 1,
                            unitPrice: s.pricePerDay || 0,
                            totalPrice: s.pricePerDay || 0,
                        });
                    }
                } else if (s.oneTimeCharge) {
                    items.push({
                        key: key++,
                        itemType: "CUSTOM",
                        description: s.name,
                        quantity: 1,
                        unitPrice: s.pricePerDay || 0,
                        totalPrice: s.pricePerDay || 0,
                    });
                } else {
                    const qty = s.chargeTime
                        ? countMealSlots(admission.admissionDate, svcEndDate, s.chargeTime)
                        : roomDays;
                    items.push({
                        key: key++,
                        itemType: "CUSTOM",
                        description: `${s.name} (${qty}d)`,
                        quantity: qty,
                        unitPrice: s.pricePerDay || 0,
                        totalPrice: qty * (s.pricePerDay || 0),
                    });
                }
            });
        } catch { /* swallow — estimation continues with partial data */ }

        try {
            const res = await otApi.get("/api/ot/invoices", {
                params: { admissionId: admission.id },
            });
            const otInvs = Array.isArray(res.data) ? res.data : res.data?.content ?? [];
            setOtInvoices(otInvs);
            setOtInvoicesError(false);
            otInvs.forEach((inv) => {
                (Array.isArray(inv.items) ? inv.items : []).forEach((item) => {
                    items.push({
                        key: key++,
                        itemType: "OT",
                        description: item.description || item.name || "OT Procedure",
                        quantity: item.quantity ?? 1,
                        unitPrice: item.unitPrice ?? 0,
                        totalPrice: item.totalPrice ?? item.amount ?? 0,
                    });
                });
            });
        } catch {
            setOtInvoicesError(true);
        }

        try {
            const res = await pharmacyApi.get("/api/pharmacy/bills", {
                params: { admissionId: admission.id, unbilled: true },
            });
            const pharma = Array.isArray(res.data) ? res.data : res.data?.content ?? [];
            setPharmacyBills(pharma);
            setPharmacyBillsError(false);
            pharma.forEach((bill) => {
                const lines = Array.isArray(bill.items) ? bill.items : [];
                const preGstSum = lines.reduce((s, l) => {
                    const q = Number(l.quantity ?? 1) || 1;
                    const u = Number(l.unitPrice ?? 0) || 0;
                    return s + (Number(l.totalPrice ?? u * q) || 0);
                }, 0);
                const billTotal = Number(bill.totalAmount ?? 0) || 0;
                const factor = preGstSum > 0 ? billTotal / preGstSum : 1;
                const billNo = bill.billNumber ? ` · ${bill.billNumber}` : "";
                lines.forEach((line) => {
                    const qty = Number(line.quantity ?? 1) || 1;
                    const unit = Number(line.unitPrice ?? 0) || 0;
                    const preGst = Number(line.totalPrice ?? unit * qty) || 0;
                    const inclusive = preGst * factor;
                    items.push({
                        key: key++,
                        itemType: "MEDICINE",
                        description: `${line.drugName || "Medicine"}${billNo}`,
                        quantity: qty,
                        unitPrice: qty > 0 ? inclusive / qty : 0,
                        totalPrice: inclusive,
                    });
                });
            });
        } catch {
            setPharmacyBillsError(true);
        }

        setBillingItems(
            items.filter(
                (i) => Number(i.quantity) > 0 || Number(i.totalPrice) > 0
            )
        );

        const estimatedTotal = items.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
        if (estimatedTotal > 0) {
            invoiceApi
                .getAdmissionInvoice(admission.id)
                .then((inv) => {
                    if (
                        inv?.id &&
                        inv.status !== "PAID" &&
                        inv.status !== "SETTLED"
                    )
                        invoiceApi.updateEstimate(inv.id, estimatedTotal);
                })
                .catch(() => { });
        }

        setBillingFetched(true);
        setLoadingBilling(false);
    }, [admission?.id, user?.hospitalId]);

    const refreshBilling = useCallback(() => {
        setFinalInvoice(null);
        setBillingItems([]);
        setOtInvoices([]);
        setOtInvoicesError(false);
        setBillingFetched(false);
        fetchBilling();
    }, [fetchBilling]);

    const handleSaveRecord = async (e) => {
        e.preventDefault();
        if (!recordForm.description.trim()) return;
        setSavingRecord(true);
        try {
            const saved = await recordApi.create({
                patientId: admission.patientId,
                hospitalId: user.hospitalId,
                historyType: recordForm.historyType,
                description: recordForm.description,
                nextVisitDate: recordForm.nextVisitDate || undefined,
                admissionId: admission.id,
                admissionNumber: admission.admissionNumber || admission.ipdId,
            });

            const creatorName =
                user?.name ||
                [user?.firstName, user?.lastName].filter(Boolean).join(" ");
            const optimisticEvent = {
                id: `rec-${saved?.id ?? Date.now()}`,
                type: "RECORD",
                title: recordForm.historyType.replace("_", " "),
                subtitle: [saved?.mrn, creatorName].filter(Boolean).join(" · "),
                description: recordForm.description,
                timestamp: new Date(),
            };
            setLogs((prev) => [optimisticEvent, ...prev]);

            notify("Record added", "success");
            setShowAddRecord(false);
            setRecordForm({
                historyType: "CONSULTATION",
                description: "",
                nextVisitDate: "",
            });

            fetchLogs(true);
        } catch {
            notify("Failed to add record", "error");
        } finally {
            setSavingRecord(false);
        }
    };

    const fetchLogsRef = useRef(fetchLogs);
    useEffect(() => {
        fetchLogsRef.current = fetchLogs;
    }, [fetchLogs]);

    useEffect(() => {
        if (activeTab !== "IPD Log") return;
        const id = setInterval(() => fetchLogsRef.current(true), 30_000);
        return () => clearInterval(id);
    }, [activeTab]);

    useEffect(() => {
        setActiveTab("IPD Log");
        setLogs([]);
        setAssets([]);
        setBillingItems([]);
        setFinalInvoice(null);
        setOtInvoices([]);
        setOtInvoicesError(false);
        setAssetsFetched(false);
        setBillingFetched(false);
        setDischargeBlock(null);
        setShowAddRecord(false);
        setRecordForm({
            historyType: "CONSULTATION",
            description: "",
            nextVisitDate: "",
        });
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admission?.id]);

    useEffect(() => {
        if (
            activeTab === "Room Mapped Assets" &&
            !assetsFetched &&
            admission?.roomId
        ) {
            setLoadingAssets(true);
            assetApi
                .getByRoom(user.hospitalId, admission.roomId)
                .then((data) => {
                    setAssets(data);
                    setAssetsFetched(true);
                })
                .catch(() => setAssetsFetched(true))
                .finally(() => setLoadingAssets(false));
        }
        if (activeTab === "IPD Billing" && !billingFetched) {
            fetchBilling();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    if (!admission) return null;

    const isAdmitted = admission.status === "ADMITTED";
    const canMoveOT = isAdmitted && !admission.inOt && admission.roomType !== "POST_OT";
    const canReturnWard = isAdmitted && !!admission.previousRoomId;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: "var(--hms-z-drawer)",
                display: "flex",
                justifyContent: "flex-end",
                pointerEvents: "none",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0, 0, 0, 0.25)",
                    pointerEvents: "auto",
                }}
                onClick={onClose}
            />

            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 520,
                    height: "100%",
                    background: "var(--hms-white)",
                    boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.12)",
                    display: "flex",
                    flexDirection: "column",
                    pointerEvents: "auto",
                    borderLeft: "1px solid var(--hms-gray-200)",
                    fontFamily: "var(--hms-font-family)",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        flexShrink: 0,
                        padding: "20px 20px 16px",
                        borderBottom: "1px solid var(--hms-gray-100)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <Badge tone={admission.status === "ADMITTED" ? "success" : "neutral"} soft>
                                    {admission.status}
                                </Badge>
                                {admission.inOt && (
                                    <Badge tone="violet" soft>
                                        <Scissors size={10} /> In OT
                                    </Badge>
                                )}
                            </div>
                            <h2
                                style={{
                                    margin: 0,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: "var(--hms-gray-900)",
                                    lineHeight: 1.2,
                                }}
                            >
                                {admission.patientName}
                            </h2>
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--hms-gray-400)" }}>
                                UHID: {fmtId(admission.patientUhid)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="hms-modal-close"
                            style={{ flexShrink: 0 }}
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 20,
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <BedDouble size={12} style={{ color: "var(--hms-gray-300)" }} />
                                {admission.roomNumber
                                    ? `Room ${admission.roomNumber} · ${admission.roomType}`
                                    : "No room assigned"}
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Clock size={12} style={{ color: "var(--hms-gray-300)" }} />
                                {fmtDate(admission.admissionDate)}
                            </span>
                        </div>
                        {(admission.admittingDoctorName || admission.approxDischargeDate) && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 20,
                                    fontSize: 11,
                                    color: "var(--hms-gray-500)",
                                }}
                            >
                                {admission.admittingDoctorName && (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                        <Stethoscope size={12} style={{ color: "var(--hms-gray-300)" }} />
                                        Dr. {admission.admittingDoctorName}
                                    </span>
                                )}
                                {admission.approxDischargeDate && (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                        <Calendar size={12} style={{ color: "var(--hms-gray-300)" }} />
                                        Est. {fmtDate(admission.approxDischargeDate)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ID + action row */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: 14,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {admission.ipdId && (
                                <span
                                    style={{
                                        padding: "2px 8px",
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                        fontWeight: 700,
                                        background: "var(--hms-brand-primary)",
                                        color: "var(--hms-white)",
                                    }}
                                >
                                    {fmtId(admission.ipdId)}
                                </span>
                            )}
                            <span
                                style={{
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    color: "var(--hms-gray-400)",
                                    border: "1px solid var(--hms-gray-200)",
                                }}
                            >
                                {fmtId(admission.admissionNumber)}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <ChipButton
                                onClick={() => navigate(`/patients/${admission.patientId}`)}
                                tone={{ bg: "var(--hms-gray-50)", color: "var(--hms-gray-600)", border: "var(--hms-gray-200)" }}
                            >
                                <User size={11} /> Patient
                                <ExternalLink size={9} style={{ opacity: 0.4 }} />
                            </ChipButton>
                            {isAdmitted && (
                                <ChipButton
                                    onClick={handleDischargeClick}
                                    disabled={checkingDischarge}
                                    tone={{ bg: "var(--hms-danger-bg)", color: "var(--hms-danger)", border: "var(--hms-danger-border)" }}
                                >
                                    {checkingDischarge ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                        <LogOut size={11} />
                                    )}
                                    Discharge
                                </ChipButton>
                            )}
                            {canMoveOT && (
                                <ChipButton
                                    onClick={onMoveToOT}
                                    tone={{ bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" }}
                                >
                                    <Scissors size={11} /> OT
                                </ChipButton>
                            )}
                            {canReturnWard && (
                                <ChipButton
                                    onClick={onReturnToWard}
                                    tone={{ bg: "var(--hms-success-bg)", color: "var(--hms-success)", border: "var(--hms-success-border)" }}
                                >
                                    <RotateCcw size={11} /> Ward
                                </ChipButton>
                            )}
                        </div>
                    </div>

                    {dischargeBlock && (
                        <div
                            style={{
                                marginTop: 12,
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                                padding: "10px 12px",
                                borderRadius: 8,
                                border: "1px solid var(--hms-danger-border)",
                                background: "var(--hms-danger-bg)",
                            }}
                        >
                            <ShieldAlert size={14} style={{ color: "var(--hms-danger)", flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#dc2626" }}>
                                    {dischargeBlock.reason === "no_invoice"
                                        ? "No invoice generated for this admission"
                                        : `Pending payment of ${fmtMoney(dischargeBlock.amount)}`}
                                </p>
                                <p style={{ margin: "2px 0 0", fontSize: 10, color: "#dc2626" }}>
                                    {dischargeBlock.reason === "no_invoice"
                                        ? "Generate and clear the invoice in IPD Billing before discharging."
                                        : "Clear the outstanding invoice in IPD Billing before discharging."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDischargeBlock(null)}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--hms-danger)",
                                    flexShrink: 0,
                                }}
                                aria-label="Dismiss"
                            >
                                <X size={11} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div
                    style={{
                        flexShrink: 0,
                        padding: "0 20px",
                        borderBottom: "1px solid var(--hms-gray-100)",
                        overflowX: "auto",
                    }}
                >
                    <Tabs
                        type="underline"
                        active={activeTab}
                        onChange={setActiveTab}
                        tabs={TABS}
                    />
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {activeTab === "IPD Log" && (
                        <LogTab
                            loadingLogs={loadingLogs}
                            logs={logs}
                            showAddRecord={showAddRecord}
                            setShowAddRecord={setShowAddRecord}
                            recordForm={recordForm}
                            setRecordForm={setRecordForm}
                            savingRecord={savingRecord}
                            handleSaveRecord={handleSaveRecord}
                            setShowPrescriptionModal={setShowPrescriptionModal}
                        />
                    )}
                    {activeTab === "Attendor Details" && <AttenderTab admission={admission} />}
                    {activeTab === "Room Mapped Assets" && (
                        <AssetsTab
                            loadingAssets={loadingAssets}
                            assets={assets}
                            hasRoom={!!admission.roomId}
                        />
                    )}
                    {activeTab === "IPD Billing" && (
                        <BillingTab
                            loadingBilling={loadingBilling}
                            finalInvoice={finalInvoice}
                            billingItems={billingItems}
                            otInvoices={otInvoices}
                            pharmacyBills={pharmacyBills}
                            otInvoicesError={otInvoicesError}
                            pharmacyBillsError={pharmacyBillsError}
                            retryOtInvoices={retryOtInvoices}
                            retryPharmacyBills={retryPharmacyBills}
                            subtotal={subtotal}
                            gst={gst}
                            grandTotal={grandTotal}
                            hasZeroPrice={hasZeroPrice}
                            isDischarged={!!admission.actualDischargeDate}
                            refreshBilling={refreshBilling}
                        />
                    )}
                </div>
            </div>

            {showPrescriptionModal && (() => {
                const parts = (admission.patientName || "").trim().split(/\s+/);
                const firstName = parts[0] || "";
                const lastName = parts.slice(1).join(" ");
                return (
                    <WritePrescriptionModal
                        patient={{
                            id: admission.patientId,
                            firstName,
                            lastName,
                            uhid: admission.patientUhid,
                        }}
                        admissionId={admission.id}
                        admissionNumber={admission.admissionNumber || admission.ipdId}
                        onClose={() => setShowPrescriptionModal(false)}
                        onSaved={() => {
                            setShowPrescriptionModal(false);
                            fetchLogs(true);
                        }}
                    />
                );
            })()}
        </div>
    );
}

/* ───────────────── Header chip button ───────────────── */
function ChipButton({ children, tone, ...props }) {
    return (
        <button
            type="button"
            {...props}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                background: tone.bg,
                color: tone.color,
                border: `1px solid ${tone.border}`,
                cursor: props.disabled ? "wait" : "pointer",
                opacity: props.disabled ? 0.6 : 1,
                transition: "all 0.15s",
                fontFamily: "var(--hms-font-family)",
            }}
        >
            {children}
        </button>
    );
}

/* ───────────────── IPD Log tab ───────────────── */
function LogTab({
    loadingLogs,
    logs,
    showAddRecord,
    setShowAddRecord,
    recordForm,
    setRecordForm,
    savingRecord,
    handleSaveRecord,
    setShowPrescriptionModal,
}) {
    return (
        <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 12,
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--hms-gray-500)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                        }}
                    >
                        Timeline
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setShowPrescriptionModal(true)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 10px",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 600,
                                background: "var(--hms-success)",
                                color: "var(--hms-white)",
                                border: "none",
                                cursor: "pointer",
                                fontFamily: "var(--hms-font-family)",
                            }}
                        >
                            <Pill size={11} /> Write prescription
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddRecord((v) => !v)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 10px",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 600,
                                background: "var(--hms-gray-50)",
                                color: "var(--hms-gray-600)",
                                border: "1px solid var(--hms-gray-200)",
                                cursor: "pointer",
                                fontFamily: "var(--hms-font-family)",
                            }}
                        >
                            {showAddRecord ? <X size={11} /> : <Plus size={11} />}
                            {showAddRecord ? "Cancel" : "Add record"}
                        </button>
                    </div>
                </div>
                {showAddRecord && (
                    <form
                        onSubmit={handleSaveRecord}
                        style={{
                            borderRadius: 8,
                            border: "1px solid var(--hms-gray-200)",
                            background: "var(--hms-white)",
                            padding: 14,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FileText size={14} style={{ color: "var(--hms-gray-400)" }} />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--hms-gray-700)",
                                }}
                            >
                                New medical record
                            </p>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <FormGroup label="Type">
                                <SearchableSelect
                                    value={recordForm.historyType}
                                    onChange={(v) => {
                                        if (v === "PRESCRIPTION") {
                                            setShowAddRecord(false);
                                            setShowPrescriptionModal(true);
                                            return;
                                        }
                                        setRecordForm((p) => ({ ...p, historyType: v }));
                                    }}
                                    options={[
                                        "CONSULTATION",
                                        "PRESCRIPTION",
                                        "LAB_RESULT",
                                        "SURGERY",
                                        "DIAGNOSIS",
                                        "OTHER",
                                    ].map((t) => ({ value: t, label: t.replace("_", " ") }))}
                                />
                            </FormGroup>
                            <FormGroup label="Next visit date">
                                <Input
                                    type="datetime-local"
                                    value={recordForm.nextVisitDate}
                                    onChange={(e) =>
                                        setRecordForm((p) => ({ ...p, nextVisitDate: e.target.value }))
                                    }
                                />
                            </FormGroup>
                        </div>
                        <FormGroup
                            label={
                                <span>
                                    Notes / description{" "}
                                    <span style={{ color: "var(--hms-danger)" }}>*</span>
                                </span>
                            }
                        >
                            <Textarea
                                rows={3}
                                placeholder="Enter notes or description…"
                                value={recordForm.description}
                                onChange={(e) =>
                                    setRecordForm((p) => ({ ...p, description: e.target.value }))
                                }
                                required
                            />
                        </FormGroup>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <Button
                                variant="secondary"
                                size="sm"
                                type="button"
                                onClick={() => setShowAddRecord(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                type="submit"
                                loading={savingRecord}
                            >
                                Save record
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            {loadingLogs ? (
                <CenterLoader text="Loading timeline…" />
            ) : logs.length === 0 ? (
                <CenterEmpty icon={<Activity size={32} />} text="No log entries" />
            ) : (
                <div>
                    {logs.map((ev, idx) => {
                        const tone = EVENT_TONE[ev.type] || {
                            color: "var(--hms-gray-600)",
                            bg: "var(--hms-gray-50)",
                            border: "var(--hms-gray-200)",
                        };
                        const isLast = idx === logs.length - 1;
                        return (
                            <div key={ev.id} style={{ display: "flex", gap: 12 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        flexShrink: 0,
                                        paddingTop: 4,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 999,
                                            background: "var(--hms-brand-primary)",
                                        }}
                                    />
                                    {!isLast && (
                                        <div
                                            style={{
                                                width: 1,
                                                flex: 1,
                                                background: "var(--hms-gray-100)",
                                                marginTop: 4,
                                            }}
                                        />
                                    )}
                                </div>
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        borderRadius: 8,
                                        border: "1px solid var(--hms-gray-100)",
                                        background: "var(--hms-white)",
                                        padding: "10px 14px",
                                        marginBottom: isLast ? 0 : 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 8,
                                            marginBottom: 8,
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                fontSize: 9,
                                                fontWeight: 700,
                                                letterSpacing: "0.06em",
                                                background: tone.bg,
                                                color: tone.color,
                                                border: `1px solid ${tone.border}`,
                                            }}
                                        >
                                            {EVENT_LABEL[ev.type] || ev.type}
                                        </span>
                                        <div
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 4,
                                                fontSize: 10,
                                                color: "var(--hms-gray-400)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Clock size={11} />
                                            {fmt(ev.timestamp)}
                                        </div>
                                    </div>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: "var(--hms-gray-800)",
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {ev.title}
                                    </p>
                                    {ev.subtitle && (
                                        <p
                                            style={{
                                                margin: "4px 0 0",
                                                fontSize: 11,
                                                color: "var(--hms-gray-500)",
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            {ev.subtitle}
                                        </p>
                                    )}
                                    {ev.description && (
                                        <p
                                            style={{
                                                margin: "6px 0 0",
                                                fontSize: 11,
                                                color: "var(--hms-gray-600)",
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            {ev.description}
                                        </p>
                                    )}
                                    {ev.badge && ev.badge !== ev.subtitle && (
                                        <p
                                            style={{
                                                margin: "4px 0 0",
                                                fontSize: 10,
                                                color: "var(--hms-gray-400)",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                            }}
                                        >
                                            {ev.badge}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ───────────────── Attender tab ───────────────── */
function AttenderTab({ admission }) {
    if (!admission.attenderName) {
        return (
            <CenterEmpty
                icon={<User size={32} />}
                text="No attendor on record"
                sub="Update via Room Allocation"
            />
        );
    }
    const rows = [
        { icon: User, label: "Name", value: admission.attenderName },
        admission.attenderPhone && {
            icon: Phone,
            label: "Phone",
            value: (
                <a
                    href={`tel:${admission.attenderPhone}`}
                    style={{
                        color: "var(--hms-gray-800)",
                        textDecoration: "none",
                    }}
                >
                    {admission.attenderPhone}
                </a>
            ),
        },
        admission.attenderRelationship && {
            icon: User,
            label: "Relationship",
            value: (
                <span style={{ textTransform: "capitalize" }}>
                    {admission.attenderRelationship}
                </span>
            ),
        },
    ].filter(Boolean);

    return (
        <div style={{ padding: 20 }}>
            <div
                style={{
                    borderRadius: 8,
                    border: "1px solid var(--hms-gray-100)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        padding: "10px 16px",
                        background: "var(--hms-gray-50)",
                        borderBottom: "1px solid var(--hms-gray-100)",
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--hms-gray-400)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                        }}
                    >
                        Attendor on record
                    </p>
                </div>
                {rows.map((r, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "14px 16px",
                            borderTop: idx === 0 ? "none" : "1px solid var(--hms-gray-50)",
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: "var(--hms-gray-50)",
                                border: "1px solid var(--hms-gray-100)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--hms-gray-400)",
                                flexShrink: 0,
                            }}
                        >
                            <r.icon size={14} />
                        </div>
                        <div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 10,
                                    color: "var(--hms-gray-400)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                }}
                            >
                                {r.label}
                            </p>
                            <p
                                style={{
                                    margin: "2px 0 0",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "var(--hms-gray-800)",
                                }}
                            >
                                {r.value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ───────────────── Room mapped assets tab ───────────────── */
function AssetsTab({ loadingAssets, assets, hasRoom }) {
    if (loadingAssets) return <CenterLoader text="Loading assets…" />;
    if (!hasRoom) return <CenterEmpty icon={<Package size={32} />} text="No room assigned" />;
    if (assets.length === 0)
        return <CenterEmpty icon={<Package size={32} />} text="No assets mapped to this room" />;

    return (
        <div style={{ padding: 20 }}>
            <div
                style={{
                    borderRadius: 8,
                    border: "1px solid var(--hms-gray-100)",
                    overflow: "hidden",
                }}
            >
                {assets.map((asset, idx) => {
                    const active =
                        asset.status === "AVAILABLE" || asset.status === "IN_USE";
                    return (
                        <div
                            key={asset.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 16px",
                                background: "var(--hms-white)",
                                borderTop: idx === 0 ? "none" : "1px solid var(--hms-gray-50)",
                            }}
                        >
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: "var(--hms-gray-50)",
                                    border: "1px solid var(--hms-gray-100)",
                                    color: "var(--hms-gray-400)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <Package size={14} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "var(--hms-gray-800)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {asset.name || asset.assetName}
                                </p>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 11,
                                        color: "var(--hms-gray-400)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {asset.category || asset.assetCategory || "—"}
                                </p>
                            </div>
                            <Badge tone={active ? "success" : "warning"} soft>
                                {(asset.status || "—").replace(/_/g, " ")}
                            </Badge>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ───────────────── Billing tab ───────────────── */
function BillingTab({
    loadingBilling,
    finalInvoice,
    billingItems,
    otInvoices,
    pharmacyBills,
    otInvoicesError,
    pharmacyBillsError,
    retryOtInvoices,
    retryPharmacyBills,
    subtotal,
    gst,
    grandTotal,
    hasZeroPrice,
    isDischarged,
    refreshBilling,
}) {
    return (
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {!loadingBilling && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        onClick={refreshBilling}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--hms-gray-400)",
                            background: "transparent",
                            border: "1px solid transparent",
                            cursor: "pointer",
                            fontFamily: "var(--hms-font-family)",
                        }}
                    >
                        <RotateCcw size={11} /> Refresh
                    </button>
                </div>
            )}

            {loadingBilling ? (
                <CenterLoader text="Loading billing…" />
            ) : finalInvoice ? (
                <FinalInvoiceView
                    finalInvoice={finalInvoice}
                    otInvoices={otInvoices}
                    pharmacyBills={pharmacyBills}
                />
            ) : billingItems.length === 0 ? (
                <CenterEmpty
                    icon={<Receipt size={32} />}
                    text="No charges detected"
                    sub="Charges appear once services are recorded"
                />
            ) : (
                <EstimatedBillView
                    billingItems={billingItems}
                    subtotal={subtotal}
                    gst={gst}
                    grandTotal={grandTotal}
                    hasZeroPrice={hasZeroPrice}
                    isDischarged={isDischarged}
                />
            )}

            {otInvoicesError && (
                <RetryRow
                    text="Could not load OT charges"
                    onRetry={retryOtInvoices}
                    color="#7c3aed"
                />
            )}
            {pharmacyBillsError && (
                <RetryRow
                    text="Could not load pharmacy bills"
                    onRetry={retryPharmacyBills}
                    color="var(--hms-success)"
                />
            )}
        </div>
    );
}

function RetryRow({ text, onRetry, color }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--hms-gray-100)",
                background: "var(--hms-white)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={14} style={{ color: "var(--hms-warning)" }} />
                <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>{text}</p>
            </div>
            <button
                type="button"
                onClick={onRetry}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--hms-font-family)",
                }}
            >
                <RotateCcw size={11} /> Retry
            </button>
        </div>
    );
}

function BillingItemRow({ meta, description, quantity, total }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "3fr 5fr 1fr 3fr",
                gap: 8,
                alignItems: "center",
                padding: "10px 16px",
                background: "var(--hms-white)",
                borderTop: "1px solid var(--hms-gray-50)",
            }}
        >
            <div>
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        background: meta.bg,
                        color: meta.color,
                    }}
                >
                    <meta.Icon size={11} /> {meta.label}
                </span>
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: "var(--hms-gray-600)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
                title={description}
            >
                {description}
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: "var(--hms-gray-400)",
                    textAlign: "center",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {quantity}
            </div>
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--hms-gray-800)",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {fmtMoney(total)}
            </div>
        </div>
    );
}

function BillingHeaderRow() {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "3fr 5fr 1fr 3fr",
                gap: 8,
                padding: "8px 16px",
                background: "var(--hms-gray-50)",
                borderBottom: "1px solid var(--hms-gray-100)",
            }}
        >
            {[
                { h: "Type", align: "left" },
                { h: "Description", align: "left" },
                { h: "Qty", align: "center" },
                { h: "Total", align: "right" },
            ].map(({ h, align }) => (
                <div
                    key={h}
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--hms-gray-400)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        textAlign: align,
                    }}
                >
                    {h}
                </div>
            ))}
        </div>
    );
}

function FinalInvoiceView({ finalInvoice, otInvoices, pharmacyBills }) {
    const settled =
        finalInvoice.status === "PAID" || finalInvoice.status === "SETTLED";
    return (
        <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
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
                        Final invoice
                    </p>
                    <p
                        style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "var(--hms-gray-400)",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        }}
                    >
                        {fmtId(finalInvoice.invoiceNumber)} · {fmtDate(finalInvoice.createdAt)}
                    </p>
                </div>
                <Badge tone={settled ? "success" : "warning"} soft>
                    {settled ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{" "}
                    {settled ? "SETTLED" : "UNSETTLED"}
                </Badge>
            </div>

            <div
                style={{
                    borderRadius: 8,
                    border: "1px solid var(--hms-gray-100)",
                    overflow: "hidden",
                }}
            >
                <BillingHeaderRow />

                {(finalInvoice.items || []).map((item, i) => {
                    const meta = BILL_TYPE_META[item.itemType] ?? BILL_TYPE_META.CUSTOM;
                    return (
                        <BillingItemRow
                            key={i}
                            meta={meta}
                            description={item.description}
                            quantity={item.quantity}
                            total={item.totalPrice}
                        />
                    );
                })}

                {otInvoices.length > 0 &&
                    otInvoices.flatMap((inv) =>
                        (Array.isArray(inv.items) ? inv.items : []).map((item, i) => (
                            <BillingItemRow
                                key={`ot-${inv.id}-${i}`}
                                meta={BILL_TYPE_META.OT}
                                description={item.description || item.name || "—"}
                                quantity={item.quantity ?? 1}
                                total={item.totalPrice ?? item.amount ?? 0}
                            />
                        ))
                    )}

                {pharmacyBills.length > 0 &&
                    pharmacyBills.flatMap((bill) => {
                        const lines = Array.isArray(bill.items) ? bill.items : [];
                        const preGstSum = lines.reduce((s, l) => {
                            const q = Number(l.quantity ?? 1) || 1;
                            const u = Number(l.unitPrice ?? 0) || 0;
                            return s + (Number(l.totalPrice ?? u * q) || 0);
                        }, 0);
                        const billTotal = Number(bill.totalAmount ?? 0) || 0;
                        const factor = preGstSum > 0 ? billTotal / preGstSum : 1;
                        return lines.map((line, i) => {
                            const q = Number(line.quantity ?? 1) || 1;
                            const u = Number(line.unitPrice ?? 0) || 0;
                            const preGst = Number(line.totalPrice ?? u * q) || 0;
                            const inclusive = preGst * factor;
                            return (
                                <BillingItemRow
                                    key={`rx-${bill.id}-${i}`}
                                    meta={BILL_TYPE_META.MEDICINE}
                                    description={`${line.drugName || "Medicine"}${bill.billNumber ? ` · ${bill.billNumber}` : ""
                                        }`}
                                    quantity={q}
                                    total={inclusive}
                                />
                            );
                        });
                    })}

                <FinalInvoiceTotals
                    finalInvoice={finalInvoice}
                    otInvoices={otInvoices}
                    pharmacyBills={pharmacyBills}
                />
            </div>
        </>
    );
}

function FinalInvoiceTotals({ finalInvoice, otInvoices, pharmacyBills }) {
    const otSum = otInvoices.reduce(
        (s, inv) => s + Number(inv.totalAmount ?? inv.total ?? 0),
        0
    );
    const rxSum = pharmacyBills.reduce(
        (s, b) => s + Number(b.totalAmount ?? 0),
        0
    );
    return (
        <div
            style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--hms-gray-100)",
                background: "var(--hms-gray-50)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
            }}
        >
            <TotalRow label="Admission subtotal" value={fmtMoney(finalInvoice.subtotal)} />
            {Number(finalInvoice.tax) > 0 && (
                <TotalRow label="Tax" value={fmtMoney(finalInvoice.tax)} />
            )}
            {Number(finalInvoice.discount) > 0 && (
                <TotalRow
                    label="Discount"
                    value={`−${fmtMoney(finalInvoice.discount)}`}
                    color="var(--hms-success)"
                />
            )}
            {otInvoices.length > 0 && (
                <TotalRow label="OT charges" value={fmtMoney(otSum)} />
            )}
            {pharmacyBills.length > 0 && (
                <TotalRow label="Pharmacy charges" value={fmtMoney(rxSum)} />
            )}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--hms-gray-900)",
                    borderTop: "1px solid var(--hms-gray-100)",
                    paddingTop: 8,
                    marginTop: 4,
                }}
            >
                <span>Grand total</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmtMoney(Number(finalInvoice.total || 0) + otSum + rxSum)}
                </span>
            </div>
        </div>
    );
}

function TotalRow({ label, value, color }) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: color || "var(--hms-gray-500)",
            }}
        >
            <span>{label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
        </div>
    );
}

function EstimatedBillView({
    billingItems,
    subtotal,
    gst,
    grandTotal,
    hasZeroPrice,
    isDischarged,
}) {
    return (
        <>
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
                    {isDischarged ? "Admission summary" : "Pending charges"}
                </p>
                <p
                    style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        color: "var(--hms-gray-400)",
                    }}
                >
                    {isDischarged
                        ? "Estimated charges for this admission — no invoice generated yet"
                        : "Auto-detected from services used during this admission"}
                </p>
            </div>

            <div
                style={{
                    borderRadius: 8,
                    border: "1px solid var(--hms-gray-100)",
                    overflow: "hidden",
                }}
            >
                <BillingHeaderRow />
                {billingItems.map((item) => {
                    const meta = BILL_TYPE_META[item.itemType] ?? BILL_TYPE_META.CUSTOM;
                    return (
                        <BillingItemRow
                            key={item.key}
                            meta={meta}
                            description={item.description}
                            quantity={item.quantity}
                            total={item.totalPrice}
                        />
                    );
                })}
                <div
                    style={{
                        padding: "12px 16px",
                        borderTop: "1px solid var(--hms-gray-100)",
                        background: "var(--hms-gray-50)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                    }}
                >
                    <TotalRow label="Subtotal" value={fmtMoney(subtotal)} />
                    {gst > 0 && (
                        <TotalRow label="GST on medicines (18%)" value={fmtMoney(gst)} />
                    )}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--hms-gray-900)",
                            borderTop: "1px solid var(--hms-gray-100)",
                            paddingTop: 8,
                            marginTop: 4,
                        }}
                    >
                        <span>Estimated total</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            {fmtMoney(grandTotal)}
                        </span>
                    </div>
                </div>
            </div>

            {hasZeroPrice && (
                <Alert tone="warning" icon={<AlertTriangle size={14} />}>
                    Some items show ₹0 — add them in Settings → Packages.
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
                Estimated bill based on services used so far. Final amount may vary.
            </p>
        </>
    );
}

/* ───────────────── Shared empty / loader ───────────────── */
function CenterLoader({ text }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "64px 0",
                gap: 8,
                color: "var(--hms-gray-400)",
            }}
        >
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>{text}</span>
        </div>
    );
}

function CenterEmpty({ icon, text, sub }) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "64px 0",
                color: "var(--hms-gray-400)",
                gap: 8,
            }}
        >
            <div style={{ opacity: 0.5 }}>{icon}</div>
            <p style={{ margin: 0, fontSize: 13 }}>{text}</p>
            {sub && (
                <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>{sub}</p>
            )}
        </div>
    );
}
