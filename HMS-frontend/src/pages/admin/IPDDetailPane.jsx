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

/** Timeline event tone — modifier class for .hms-ipd-event-tag */
const EVENT_TONE_CLASS = {
    ADMITTED: "is-admitted",
    ALLOCATED: "is-allocated",
    DEALLOCATED: "is-deallocated",
    ATTENDER_ASSIGNED: "",
    ATTENDER_UPDATED: "",
    RADIOLOGY: "is-radiology",
    AMBULANCE: "is-ambulance",
    OT: "is-ot",
    DISCHARGED: "is-discharged",
    RECORD: "is-record",
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

/** Billing item-type → icon + tone-modifier-class pair. */
const BILL_TYPE_META = {
    ROOM_CHARGE:  { label: "Room",     Icon: BedDouble,    cls: "is-room" },
    CONSULTATION: { label: "Consult",  Icon: Stethoscope,  cls: "is-consultation" },
    RADIOLOGY:    { label: "Radiology", Icon: ScanLine,    cls: "is-radiology" },
    LAB_TEST:     { label: "Lab",      Icon: FlaskConical, cls: "is-lab" },
    MEDICINE:     { label: "Medicine", Icon: Pill,         cls: "is-medicine" },
    OT:           { label: "OT",       Icon: Scissors,     cls: "is-ot" },
    CUSTOM:       { label: "Custom",   Icon: Wrench,       cls: "is-custom" },
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
        <div className="hms-ipd-pane">
            <div className="hms-ipd-pane__scrim" onClick={onClose} />

            <div className="hms-ipd-pane__panel">
                {/* Header */}
                <div className="hms-ipd-header">
                    <div className="hms-ipd-header__top">
                        <div className="hms-ipd-header__identity">
                            <div className="hms-ipd-header__badges">
                                <Badge tone={admission.status === "ADMITTED" ? "success" : "neutral"} soft>
                                    {admission.status}
                                </Badge>
                                {admission.inOt && (
                                    <Badge tone="violet" soft>
                                        <Scissors size={10} /> In OT
                                    </Badge>
                                )}
                            </div>
                            <h2 className="hms-ipd-header__name">
                                {admission.patientName}
                            </h2>
                            <p className="hms-ipd-header__uhid">
                                UHID: {fmtId(admission.patientUhid)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="hms-modal-close shrink-0"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="hms-ipd-header__meta">
                        <div className="hms-ipd-header__meta-row">
                            <span className="hms-ipd-header__meta-item">
                                <BedDouble size={12} />
                                {admission.roomNumber
                                    ? `Room ${admission.roomNumber} · ${admission.roomType}`
                                    : "No room assigned"}
                            </span>
                            <span className="hms-ipd-header__meta-item">
                                <Clock size={12} />
                                {fmtDate(admission.admissionDate)}
                            </span>
                        </div>
                        {(admission.admittingDoctorName || admission.approxDischargeDate) && (
                            <div className="hms-ipd-header__meta-row">
                                {admission.admittingDoctorName && (
                                    <span className="hms-ipd-header__meta-item">
                                        <Stethoscope size={12} />
                                        Dr. {admission.admittingDoctorName}
                                    </span>
                                )}
                                {admission.approxDischargeDate && (
                                    <span className="hms-ipd-header__meta-item">
                                        <Calendar size={12} />
                                        Est. {fmtDate(admission.approxDischargeDate)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ID + action row */}
                    <div className="hms-ipd-header__id-row">
                        <div className="hms-ipd-header__id-group">
                            {admission.ipdId && (
                                <span className="hms-ipd-id-pill">
                                    {fmtId(admission.ipdId)}
                                </span>
                            )}
                            <span className="hms-ipd-id-pill is-outline">
                                {fmtId(admission.admissionNumber)}
                            </span>
                        </div>
                        <div className="hms-ipd-header__actions">
                            <button
                                type="button"
                                className="hms-ipd-chip-btn"
                                onClick={() => navigate(`/patients/${admission.patientId}`)}
                            >
                                <User size={11} /> Patient
                                <ExternalLink size={9} className="opacity-40" />
                            </button>
                            {isAdmitted && (
                                <button
                                    type="button"
                                    className="hms-ipd-chip-btn is-danger"
                                    onClick={handleDischargeClick}
                                    disabled={checkingDischarge}
                                >
                                    {checkingDischarge ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                        <LogOut size={11} />
                                    )}
                                    Discharge
                                </button>
                            )}
                            {canMoveOT && (
                                <button
                                    type="button"
                                    className="hms-ipd-chip-btn is-violet"
                                    onClick={onMoveToOT}
                                >
                                    <Scissors size={11} /> OT
                                </button>
                            )}
                            {canReturnWard && (
                                <button
                                    type="button"
                                    className="hms-ipd-chip-btn is-success"
                                    onClick={onReturnToWard}
                                >
                                    <RotateCcw size={11} /> Ward
                                </button>
                            )}
                        </div>
                    </div>

                    {dischargeBlock && (
                        <div className="hms-ipd-discharge-block">
                            <ShieldAlert size={14} className="hms-ipd-discharge-block__icon" />
                            <div className="hms-ipd-discharge-block__body">
                                <p className="hms-ipd-discharge-block__title">
                                    {dischargeBlock.reason === "no_invoice"
                                        ? "No invoice generated for this admission"
                                        : `Pending payment of ${fmtMoney(dischargeBlock.amount)}`}
                                </p>
                                <p className="hms-ipd-discharge-block__sub">
                                    {dischargeBlock.reason === "no_invoice"
                                        ? "Generate and clear the invoice in IPD Billing before discharging."
                                        : "Clear the outstanding invoice in IPD Billing before discharging."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDischargeBlock(null)}
                                className="hms-ipd-discharge-block__dismiss"
                                aria-label="Dismiss"
                            >
                                <X size={11} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="hms-ipd-tabs-bar">
                    <Tabs
                        type="underline"
                        active={activeTab}
                        onChange={setActiveTab}
                        tabs={TABS}
                    />
                </div>

                {/* Tab content */}
                <div className="hms-ipd-tabs-content">
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
        <div className="hms-ipd-tab-body">
            <div className="hms-ipd-log-head">
                <div className="hms-ipd-log-head__row">
                    <p className="hms-ipd-log-head__label">Timeline</p>
                    <div className="hms-ipd-log-head__actions">
                        <button
                            type="button"
                            onClick={() => setShowPrescriptionModal(true)}
                            className="hms-ipd-chip-btn is-success-solid"
                        >
                            <Pill size={11} /> Write prescription
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddRecord((v) => !v)}
                            className="hms-ipd-chip-btn"
                        >
                            {showAddRecord ? <X size={11} /> : <Plus size={11} />}
                            {showAddRecord ? "Cancel" : "Add record"}
                        </button>
                    </div>
                </div>
                {showAddRecord && (
                    <form
                        onSubmit={handleSaveRecord}
                        className="hms-ipd-record-form"
                    >
                        <div className="hms-ipd-record-form__head">
                            <FileText size={14} className="hms-ipd-record-form__head-icon" />
                            <p className="hms-ipd-record-form__head-text">
                                New medical record
                            </p>
                        </div>
                        <div className="hms-ipd-record-form__grid">
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
                                    <span className="text-danger">*</span>
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
                        <div className="hms-ipd-record-form__footer">
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
                <div className="hms-ipd-timeline">
                    {logs.map((ev, idx) => {
                        const toneClass = EVENT_TONE_CLASS[ev.type] || "";
                        const isLast = idx === logs.length - 1;
                        return (
                            <div key={ev.id} className="hms-ipd-timeline__entry">
                                <div className="hms-ipd-timeline__rail">
                                    <div className="hms-ipd-timeline__dot" />
                                    {!isLast && <div className="hms-ipd-timeline__line" />}
                                </div>
                                <div className="hms-ipd-timeline__card">
                                    <div className="hms-ipd-timeline__head">
                                        <span className={`hms-ipd-event-tag ${toneClass}`}>
                                            {EVENT_LABEL[ev.type] || ev.type}
                                        </span>
                                        <div className="hms-ipd-timeline__stamp">
                                            <Clock size={11} />
                                            {fmt(ev.timestamp)}
                                        </div>
                                    </div>
                                    <p className="hms-ipd-timeline__title">{ev.title}</p>
                                    {ev.subtitle && (
                                        <p className="hms-ipd-timeline__sub">{ev.subtitle}</p>
                                    )}
                                    {ev.description && (
                                        <p className="hms-ipd-timeline__desc">{ev.description}</p>
                                    )}
                                    {ev.badge && ev.badge !== ev.subtitle && (
                                        <p className="hms-ipd-timeline__badge">{ev.badge}</p>
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
                <a href={`tel:${admission.attenderPhone}`}>
                    {admission.attenderPhone}
                </a>
            ),
        },
        admission.attenderRelationship && {
            icon: User,
            label: "Relationship",
            value: admission.attenderRelationship,
            capitalize: true,
        },
    ].filter(Boolean);

    return (
        <div className="hms-ipd-tab-body">
            <div className="hms-ipd-list">
                <div className="hms-ipd-list__head">
                    <p className="hms-ipd-list__head-label">Attendor on record</p>
                </div>
                {rows.map((r, idx) => (
                    <div key={idx} className="hms-ipd-list-row">
                        <div className="hms-ipd-list-row__icon">
                            <r.icon size={14} />
                        </div>
                        <div>
                            <p className="hms-ipd-list-row__label">{r.label}</p>
                            <p
                                className={
                                    "hms-ipd-list-row__value" +
                                    (r.capitalize ? " is-capitalize" : "")
                                }
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
        <div className="hms-ipd-tab-body">
            <div className="hms-ipd-list">
                {assets.map((asset) => {
                    const active =
                        asset.status === "AVAILABLE" || asset.status === "IN_USE";
                    return (
                        <div key={asset.id} className="hms-ipd-list-row is-asset">
                            <div className="hms-ipd-list-row__icon">
                                <Package size={14} />
                            </div>
                            <div className="hms-ipd-list-row__body">
                                <p className="hms-ipd-list-row__title">
                                    {asset.name || asset.assetName}
                                </p>
                                <p className="hms-ipd-list-row__sub">
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
        <div className="hms-ipd-tab-body is-col">
            {!loadingBilling && (
                <div className="hms-ipd-bill-refresh">
                    <button
                        type="button"
                        onClick={refreshBilling}
                        className="hms-ipd-chip-btn is-ghost"
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
                    toneClass="is-violet"
                />
            )}
            {pharmacyBillsError && (
                <RetryRow
                    text="Could not load pharmacy bills"
                    onRetry={retryPharmacyBills}
                    toneClass="is-success"
                />
            )}
        </div>
    );
}

function RetryRow({ text, onRetry, toneClass }) {
    return (
        <div className="hms-ipd-retry-row">
            <div className="hms-ipd-retry-row__body">
                <AlertTriangle size={14} className="hms-ipd-retry-row__icon" />
                <p className="hms-ipd-retry-row__text">{text}</p>
            </div>
            <button
                type="button"
                onClick={onRetry}
                className={`hms-ipd-retry-row__btn ${toneClass}`}
            >
                <RotateCcw size={11} /> Retry
            </button>
        </div>
    );
}

function BillingItemRow({ meta, description, quantity, total }) {
    return (
        <div className="hms-ipd-bill-row">
            <div>
                <span className={`hms-ipd-bill-row__type ${meta.cls}`}>
                    <meta.Icon size={11} /> {meta.label}
                </span>
            </div>
            <div className="hms-ipd-bill-row__desc" title={description}>
                {description}
            </div>
            <div className="hms-ipd-bill-row__qty">{quantity}</div>
            <div className="hms-ipd-bill-row__total">{fmtMoney(total)}</div>
        </div>
    );
}

function BillingHeaderRow() {
    return (
        <div className="hms-ipd-bill-head">
            <div className="hms-ipd-bill-head__cell">Type</div>
            <div className="hms-ipd-bill-head__cell">Description</div>
            <div className="hms-ipd-bill-head__cell is-center">Qty</div>
            <div className="hms-ipd-bill-head__cell is-right">Total</div>
        </div>
    );
}

function FinalInvoiceView({ finalInvoice, otInvoices, pharmacyBills }) {
    const settled =
        finalInvoice.status === "PAID" || finalInvoice.status === "SETTLED";
    return (
        <>
            <div className="hms-ipd-bill-fi-head">
                <div>
                    <p className="hms-ipd-bill-fi-head__label">Final invoice</p>
                    <p className="hms-ipd-bill-fi-head__sub">
                        {fmtId(finalInvoice.invoiceNumber)} · {fmtDate(finalInvoice.createdAt)}
                    </p>
                </div>
                <Badge tone={settled ? "success" : "warning"} soft>
                    {settled ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{" "}
                    {settled ? "SETTLED" : "UNSETTLED"}
                </Badge>
            </div>

            <div className="hms-ipd-bill-section">
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
        <div className="hms-ipd-bill-totals">
            <TotalRow label="Admission subtotal" value={fmtMoney(finalInvoice.subtotal)} />
            {Number(finalInvoice.tax) > 0 && (
                <TotalRow label="Tax" value={fmtMoney(finalInvoice.tax)} />
            )}
            {Number(finalInvoice.discount) > 0 && (
                <TotalRow
                    label="Discount"
                    value={`−${fmtMoney(finalInvoice.discount)}`}
                    isSuccess
                />
            )}
            {otInvoices.length > 0 && (
                <TotalRow label="OT charges" value={fmtMoney(otSum)} />
            )}
            {pharmacyBills.length > 0 && (
                <TotalRow label="Pharmacy charges" value={fmtMoney(rxSum)} />
            )}
            <div className="hms-ipd-bill-totals__grand">
                <span>Grand total</span>
                <span>
                    {fmtMoney(Number(finalInvoice.total || 0) + otSum + rxSum)}
                </span>
            </div>
        </div>
    );
}

function TotalRow({ label, value, isSuccess }) {
    return (
        <div className={"hms-ipd-bill-totals__row" + (isSuccess ? " is-success" : "")}>
            <span>{label}</span>
            <span>{value}</span>
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
                <p className="hms-ipd-bill-est-head__title">
                    {isDischarged ? "Admission summary" : "Pending charges"}
                </p>
                <p className="hms-ipd-bill-est-head__sub">
                    {isDischarged
                        ? "Estimated charges for this admission — no invoice generated yet"
                        : "Auto-detected from services used during this admission"}
                </p>
            </div>

            <div className="hms-ipd-bill-section">
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
                <div className="hms-ipd-bill-totals">
                    <TotalRow label="Subtotal" value={fmtMoney(subtotal)} />
                    {gst > 0 && (
                        <TotalRow label="GST on medicines (18%)" value={fmtMoney(gst)} />
                    )}
                    <div className="hms-ipd-bill-totals__grand">
                        <span>Estimated total</span>
                        <span>{fmtMoney(grandTotal)}</span>
                    </div>
                </div>
            </div>

            {hasZeroPrice && (
                <Alert tone="warning" icon={<AlertTriangle size={14} />}>
                    Some items show ₹0 — add them in Settings → Packages.
                </Alert>
            )}

            <p className="hms-ipd-bill-est-foot">
                Estimated bill based on services used so far. Final amount may vary.
            </p>
        </>
    );
}

/* ───────────────── Shared empty / loader ───────────────── */
function CenterLoader({ text }) {
    return (
        <div className="hms-ipd-center-loader">
            <Loader2 size={16} className="animate-spin" />
            <span className="hms-ipd-center-loader__text">{text}</span>
        </div>
    );
}

function CenterEmpty({ icon, text, sub }) {
    return (
        <div className="hms-ipd-center-empty">
            <div className="hms-ipd-center-empty__icon">{icon}</div>
            <p className="hms-ipd-center-empty__text">{text}</p>
            {sub && <p className="hms-ipd-center-empty__sub">{sub}</p>}
        </div>
    );
}
