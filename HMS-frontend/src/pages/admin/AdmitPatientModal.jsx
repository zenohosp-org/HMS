import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
    admissionApi,
    departmentApi,
    doctorsApi,
    patientApi,
    bedApi,
    patientAdvanceApi,
    bankApi,
} from "@/utils/api";
import api from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import {
    Search,
    BedDouble,
    User,
    CheckCircle2,
    Loader2,
} from "lucide-react";
import {
    Alert,
    Button,
    FormGroup,
    Input,
    Modal,
    Textarea,
} from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";

const ADMISSION_SOURCES = ["OPD_REFERRAL", "EMERGENCY", "DIRECT"];
const RELATIONSHIPS = ["Spouse", "Parent", "Child", "Sibling", "Friend", "Guardian", "Other"];
const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer"];

/** Cash pays into a CASH-type drawer; everything else lands in a
 *  SAVINGS or CURRENT bank account. */
const PAYMENT_METHOD_TO_ACCOUNT_TYPES = {
    Cash: ["CASH"],
    UPI: ["SAVINGS", "CURRENT"],
    Card: ["SAVINGS", "CURRENT"],
    "Bank Transfer": ["SAVINGS", "CURRENT"],
};

/** Numbered section header — bold number circle + title + optional
 *  subtitle, separated from content by a thin underline. */
function SectionHeader({ number, title, subtitle }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                paddingBottom: 8,
                borderBottom: "1px solid var(--hms-gray-100)",
            }}
        >
            <div
                style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: "var(--hms-brand-primary)",
                    color: "var(--hms-white)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                }}
            >
                {number}
            </div>
            <div>
                <h3
                    style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--hms-gray-900)",
                    }}
                >
                    {title}
                </h3>
                {subtitle && (
                    <p
                        style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "var(--hms-gray-500)",
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * Admit patient wizard. Single-page form with four numbered sections:
 * Patient & source · Clinical & room · Attender · Finance. Phase 8c
 * migration: data layer untouched (admissionApi.admit + admissionApi.
 * list, departmentApi/doctorsApi/patientApi/bedApi/patientAdvanceApi/
 * bankApi), chained-fetch effects unchanged (department → doctors;
 * room → beds; payment method → bank accounts), validation +
 * non-blocking failure cascades (advance + paymentCategory update on
 * patient profile) all preserved byte-for-byte.
 *
 * Wraps in <Modal size="xl"> — the pre-migration UX used max-w-8xl
 * (≈1408px) which xl can't reach, but the form content reads
 * comfortably at 1000px once the dense Tailwind padding is gone.
 */
export default function AdmitPatientModal({ onClose, onAdmitted, prefill }) {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [patients, setPatients] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [availableBeds, setAvailableBeds] = useState([]);
    const [bedsLoading, setBedsLoading] = useState(false);
    const [patientSearch, setPatientSearch] = useState("");
    const [selectedPatient, setSelectedPatient] = useState(prefill?.patient || null);
    const [admittedPatientIds, setAdmittedPatientIds] = useState(new Set());
    const [form, setForm] = useState({
        admissionType: prefill?.admissionType || "OPD_REFERRAL",
        departmentId: "",
        admittingDoctorId: prefill?.doctorId || "",
        roomId: "",
        bedId: "",
        chiefComplaint: prefill?.chiefComplaint || "",
        approxDischargeDate: "",
        attenderName: "",
        attenderPhone: "",
        attenderRelationship: "",
    });

    // Finance
    const [paymentCategory, setPaymentCategory] = useState("CASH");
    const [advanceAmount, setAdvanceAmount] = useState("");
    const [advancePaymentMethod, setAdvancePaymentMethod] = useState("Cash");
    const [advanceNotes, setAdvanceNotes] = useState("");
    const [bankAccounts, setBankAccounts] = useState([]);
    const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState("");

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!user?.hospitalId) return;
        Promise.all([
            departmentApi.list(user.hospitalId, true),
            doctorsApi.list(user.hospitalId),
            admissionApi.list(user.hospitalId, false),
        ]).then(([depts, docs, activeAdmissions]) => {
            setDepartments(depts);
            setDoctors(docs.filter((d) => d.userIsActive));
            setAdmittedPatientIds(new Set(activeAdmissions.map((a) => a.patientId)));
        });
    }, [user?.hospitalId]);

    useEffect(() => {
        if (!user?.hospitalId) return;
        const q = patientSearch.trim();
        if (q.length < 2) {
            setPatients([]);
            return;
        }
        patientApi.list(user.hospitalId).then((all) =>
            setPatients(
                all
                    .filter(
                        (p) =>
                            !admittedPatientIds.has(p.id) &&
                            `${p.firstName} ${p.lastName} ${p.uhid}`
                                .toLowerCase()
                                .includes(q.toLowerCase())
                    )
                    .slice(0, 8)
            )
        );
    }, [patientSearch, admittedPatientIds, user?.hospitalId]);

    useEffect(() => {
        if (!user?.hospitalId) return;
        api
            .get("/rooms", { params: { hospitalId: user.hospitalId } })
            .then((r) => setRooms(r.data.filter((rm) => rm.status === "AVAILABLE")))
            .catch(() => { });
    }, [user?.hospitalId]);

    const selectedDept = departments.find((d) => String(d.id) === String(form.departmentId));
    const filteredDoctors =
        form.departmentId && selectedDept
            ? doctors.filter(
                (d) => d.specialization?.toLowerCase() === selectedDept.name?.toLowerCase()
            )
            : doctors;

    const selectedRoom = rooms.find((r) => String(r.id) === String(form.roomId));
    const isMultiBed = selectedRoom && selectedRoom.bedCount != null && selectedRoom.bedCount > 1;

    useEffect(() => {
        if (!isMultiBed || !form.roomId || !user?.hospitalId) {
            setAvailableBeds([]);
            setForm((f) => ({ ...f, bedId: "" }));
            return;
        }
        setBedsLoading(true);
        bedApi
            .getByRoom(form.roomId, user.hospitalId)
            .then((beds) => setAvailableBeds(beds.filter((b) => b.status === "AVAILABLE")))
            .catch(() => setAvailableBeds([]))
            .finally(() => setBedsLoading(false));
    }, [form.roomId, isMultiBed, user?.hospitalId]);

    useEffect(() => {
        if (selectedPatient) setPaymentCategory(selectedPatient.paymentCategory || "CASH");
    }, [selectedPatient]);

    useEffect(() => {
        if (!user?.hospitalId) return;
        const types = PAYMENT_METHOD_TO_ACCOUNT_TYPES[advancePaymentMethod] || [];
        setBankAccountsLoading(true);
        bankApi
            .list(user.hospitalId, types)
            .then((accounts) => {
                setBankAccounts(accounts || []);
                if (accounts && accounts.length === 1) {
                    setSelectedBankAccountId(accounts[0].id);
                } else if (accounts && accounts.length > 1) {
                    const def = accounts.find((a) => a.isDefault);
                    setSelectedBankAccountId(def ? def.id : "");
                } else {
                    setSelectedBankAccountId("");
                }
            })
            .catch(() => {
                setBankAccounts([]);
                setSelectedBankAccountId("");
            })
            .finally(() => setBankAccountsLoading(false));
    }, [advancePaymentMethod, user?.hospitalId]);

    const handleSubmit = async () => {
        if (!selectedPatient) return;
        if (isMultiBed && !form.bedId) {
            notify("Please select a bed for this room.", "warning");
            return;
        }
        setSubmitting(true);
        try {
            const admission = await admissionApi.admit({
                hospitalId: user.hospitalId,
                patientId: selectedPatient.id,
                roomId: form.roomId ? Number(form.roomId) : null,
                bedId: form.bedId ? Number(form.bedId) : null,
                admittingDoctorId: form.admittingDoctorId || null,
                departmentId: form.departmentId || null,
                sourceAppointmentId: prefill?.appointmentId || null,
                admissionType: form.admissionType,
                chiefComplaint: form.chiefComplaint,
                approxDischargeDate: form.approxDischargeDate || null,
                attenderName: form.attenderName,
                attenderPhone: form.attenderPhone,
                attenderRelationship: form.attenderRelationship,
            });

            const amt = Number(advanceAmount);
            if (amt > 0 && admission?.id) {
                try {
                    await patientAdvanceApi.createForAdmission(admission.id, {
                        amount: amt,
                        paymentMethod: advancePaymentMethod,
                        bankAccountId: selectedBankAccountId || null,
                        notes: advanceNotes || null,
                        collectedBy: user?.name || null,
                    });
                } catch {
                    // Advance failure must not block admission success
                }
            }

            try {
                await patientApi.update(selectedPatient.id, {
                    ...selectedPatient,
                    paymentCategory,
                    hospitalId: user.hospitalId,
                });
            } catch {
                // Non-blocking
            }

            onAdmitted();
        } catch (err) {
            notify(err.response?.data?.message || "Admission failed", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const advanceAmt = Number(advanceAmount) || 0;

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="xl"
            title={
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: "var(--hms-gray-100)",
                            color: "var(--hms-gray-700)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <BedDouble size={20} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--hms-gray-900)" }}>
                            Admit patient to IPD
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>
                            All sections in one place — scroll to fill, submit when ready.
                        </p>
                    </div>
                </div>
            }
            footer={
                <>
                    <Button variant="cancel" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={submitting || !selectedPatient}
                        loading={submitting}
                    >
                        <CheckCircle2 size={14} /> Confirm admission
                    </Button>
                </>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {/* Section 1: Patient & Source */}
                <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <SectionHeader number={1} title="Patient & source" />
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                        }}
                    >
                        <FormGroup label="Search patient *">
                            {selectedPatient ? (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: 12,
                                        borderRadius: 8,
                                        background: "var(--hms-gray-50)",
                                        border: "1px solid var(--hms-gray-200)",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 8,
                                                background: "var(--hms-gray-200)",
                                                color: "var(--hms-gray-600)",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: "var(--hms-gray-900)",
                                                }}
                                            >
                                                {selectedPatient.firstName} {selectedPatient.lastName}
                                            </p>
                                            <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>
                                                UHID: {fmtId(selectedPatient.uhid)} · {selectedPatient.gender}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPatient(null)}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: "var(--hms-gray-600)",
                                            cursor: "pointer",
                                            textDecoration: "underline",
                                            fontFamily: "var(--hms-font-family)",
                                        }}
                                    >
                                        Change
                                    </button>
                                </div>
                            ) : (
                                <div style={{ position: "relative" }}>
                                    <Search
                                        size={16}
                                        style={{
                                            position: "absolute",
                                            left: 12,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            color: "var(--hms-gray-400)",
                                            pointerEvents: "none",
                                        }}
                                    />
                                    <Input
                                        value={patientSearch}
                                        onChange={(e) => setPatientSearch(e.target.value)}
                                        placeholder="Search by name or UHID…"
                                        style={{ paddingLeft: 36 }}
                                    />
                                    {patients.length > 0 && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "100%",
                                                left: 0,
                                                right: 0,
                                                marginTop: 4,
                                                background: "var(--hms-white)",
                                                border: "1px solid var(--hms-gray-200)",
                                                borderRadius: 8,
                                                boxShadow: "var(--hms-shadow-lg)",
                                                zIndex: 10,
                                                overflow: "hidden",
                                            }}
                                        >
                                            {patients.map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedPatient(p);
                                                        setPatients([]);
                                                        setPatientSearch("");
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 12,
                                                        padding: "10px 16px",
                                                        background: "transparent",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        textAlign: "left",
                                                        fontFamily: "var(--hms-font-family)",
                                                    }}
                                                    onMouseEnter={(e) =>
                                                    (e.currentTarget.style.background =
                                                        "var(--hms-gray-50)")
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.background = "transparent")
                                                    }
                                                >
                                                    <User
                                                        size={16}
                                                        style={{ color: "var(--hms-gray-400)", flexShrink: 0 }}
                                                    />
                                                    <div>
                                                        <p
                                                            style={{
                                                                margin: 0,
                                                                fontSize: 13,
                                                                fontWeight: 500,
                                                                color: "var(--hms-gray-900)",
                                                            }}
                                                        >
                                                            {p.firstName} {p.lastName}
                                                        </p>
                                                        <p
                                                            style={{
                                                                margin: 0,
                                                                fontSize: 11,
                                                                color: "var(--hms-gray-500)",
                                                            }}
                                                        >
                                                            UHID: {fmtId(p.uhid)}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </FormGroup>
                        <FormGroup label="Admission source">
                            <SearchableSelect
                                value={form.admissionType}
                                onChange={(v) => setForm({ ...form, admissionType: v })}
                                options={ADMISSION_SOURCES.map((s) => ({
                                    value: s,
                                    label: s.replace(/_/g, " "),
                                }))}
                            />
                        </FormGroup>
                    </div>
                </section>

                {/* Section 2: Clinical & Room */}
                <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <SectionHeader number={2} title="Clinical & room" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <FormGroup label="Department">
                            <SearchableSelect
                                value={form.departmentId}
                                onChange={(v) =>
                                    setForm({ ...form, departmentId: v, admittingDoctorId: "" })
                                }
                                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                                placeholder="Select department…"
                            />
                        </FormGroup>
                        <FormGroup label="Admitting doctor">
                            <SearchableSelect
                                value={form.admittingDoctorId}
                                onChange={(v) => setForm({ ...form, admittingDoctorId: v })}
                                options={filteredDoctors.map((d) => ({
                                    value: d.id,
                                    label: `Dr. ${d.firstName} ${d.lastName}`,
                                }))}
                                placeholder="Select doctor…"
                            />
                        </FormGroup>
                    </div>
                    <FormGroup label="Chief complaint">
                        <Textarea
                            rows={3}
                            value={form.chiefComplaint}
                            onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                            placeholder="Presenting complaint or reason for admission…"
                        />
                    </FormGroup>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <FormGroup label="Assign room (optional)">
                            <SearchableSelect
                                value={form.roomId}
                                onChange={(v) => setForm({ ...form, roomId: v, bedId: "" })}
                                options={rooms.map((r) => ({
                                    value: r.id,
                                    label: `${r.roomNumber} · ${r.roomType}${r.bedCount > 1 ? ` · ${r.bedCount} beds` : ""
                                        }${r.ward ? ` · ${r.ward}` : ""}`,
                                }))}
                                placeholder="Assign later…"
                            />
                        </FormGroup>
                        <FormGroup label="Approx. discharge">
                            <Input
                                type="datetime-local"
                                value={form.approxDischargeDate}
                                onChange={(e) =>
                                    setForm({ ...form, approxDischargeDate: e.target.value })
                                }
                            />
                        </FormGroup>
                    </div>

                    {form.roomId && isMultiBed && (
                        <FormGroup label="Select bed *">
                            {bedsLoading ? (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "12px 0",
                                        color: "var(--hms-gray-400)",
                                    }}
                                >
                                    <Loader2 size={16} className="animate-spin" />
                                    <span style={{ fontSize: 13 }}>Loading beds…</span>
                                </div>
                            ) : availableBeds.length === 0 ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--hms-danger)" }}>
                                    No available beds in this room.
                                </p>
                            ) : (
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                                        gap: 8,
                                    }}
                                >
                                    {availableBeds.map((bed) => {
                                        const selected = String(form.bedId) === String(bed.id);
                                        return (
                                            <button
                                                key={bed.id}
                                                type="button"
                                                onClick={() =>
                                                    setForm((f) => ({ ...f, bedId: String(bed.id) }))
                                                }
                                                style={{
                                                    padding: "10px 12px",
                                                    borderRadius: 8,
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    textAlign: "left",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s",
                                                    border: `1px solid ${selected
                                                        ? "var(--hms-brand-primary)"
                                                        : "var(--hms-success-border)"
                                                        }`,
                                                    background: selected
                                                        ? "var(--hms-brand-primary)"
                                                        : "var(--hms-success-bg)",
                                                    color: selected ? "var(--hms-white)" : "#166534",
                                                    fontFamily: "var(--hms-font-family)",
                                                }}
                                            >
                                                {bed.bedNumber}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </FormGroup>
                    )}
                </section>

                {/* Section 3: Attender */}
                <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <SectionHeader
                        number={3}
                        title="Attender / guardian"
                        subtitle="Optional but recommended — required for discharge handover."
                    />
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 16,
                        }}
                    >
                        <FormGroup label="Attender name">
                            <Input
                                value={form.attenderName}
                                onChange={(e) => setForm({ ...form, attenderName: e.target.value })}
                                placeholder="Full name"
                            />
                        </FormGroup>
                        <FormGroup label="Phone">
                            <Input
                                value={form.attenderPhone}
                                onChange={(e) => setForm({ ...form, attenderPhone: e.target.value })}
                                placeholder="+91 98765 43210"
                            />
                        </FormGroup>
                        <FormGroup label="Relationship">
                            <SearchableSelect
                                value={form.attenderRelationship}
                                onChange={(v) => setForm({ ...form, attenderRelationship: v })}
                                options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))}
                                placeholder="Select…"
                            />
                        </FormGroup>
                    </div>
                </section>

                {/* Section 4: Finance */}
                <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <SectionHeader number={4} title="Finance" />

                    {/* Payment Category */}
                    <div>
                        <p
                            style={{
                                margin: "0 0 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--hms-gray-500)",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}
                        >
                            Payment category
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {[
                                {
                                    value: "CASH",
                                    label: "Cash",
                                    desc: "Periodic payments during stay",
                                },
                                {
                                    value: "CREDIT",
                                    label: "Credit",
                                    desc: "Full bill settled at discharge",
                                },
                            ].map((opt) => {
                                const selected = paymentCategory === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setPaymentCategory(opt.value)}
                                        style={{
                                            textAlign: "left",
                                            padding: 12,
                                            borderRadius: 8,
                                            cursor: "pointer",
                                            transition: "all 0.15s",
                                            border: `2px solid ${selected
                                                ? "var(--hms-brand-primary)"
                                                : "var(--hms-gray-200)"
                                                }`,
                                            background: selected
                                                ? "var(--hms-gray-50)"
                                                : "var(--hms-white)",
                                            fontFamily: "var(--hms-font-family)",
                                        }}
                                    >
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: selected
                                                    ? "var(--hms-gray-900)"
                                                    : "var(--hms-gray-600)",
                                            }}
                                        >
                                            {opt.label}
                                        </p>
                                        <p
                                            style={{
                                                margin: "2px 0 0",
                                                fontSize: 11,
                                                color: "var(--hms-gray-400)",
                                            }}
                                        >
                                            {opt.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Admission advance */}
                    <div
                        style={{
                            paddingTop: 16,
                            borderTop: "1px solid var(--hms-gray-100)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        <div>
                            <p
                                style={{
                                    margin: "0 0 4px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "var(--hms-gray-500)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                }}
                            >
                                Admission advance / room deposit
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-400)" }}>
                                Optional. Collect a room security deposit or initial advance — it will
                                be auto-deducted from the final IPD bill.
                            </p>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <FormGroup label="Amount (₹)">
                                <Input
                                    type="number"
                                    min="0"
                                    step="100"
                                    placeholder="0"
                                    value={advanceAmount}
                                    onChange={(e) => setAdvanceAmount(e.target.value)}
                                />
                            </FormGroup>
                            <FormGroup label="Payment method">
                                <SearchableSelect
                                    value={advancePaymentMethod}
                                    disabled={advanceAmt === 0}
                                    onChange={(v) => setAdvancePaymentMethod(v)}
                                    options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                                />
                            </FormGroup>
                        </div>

                        {advanceAmt > 0 && (
                            <FormGroup
                                label={
                                    <span>
                                        Deposit account
                                        <span
                                            style={{
                                                marginLeft: 6,
                                                fontSize: 10,
                                                fontWeight: 500,
                                                color: "var(--hms-gray-400)",
                                            }}
                                        >
                                            (
                                            {advancePaymentMethod === "Cash"
                                                ? "CASH only"
                                                : "SAVINGS / CURRENT only"}
                                            )
                                        </span>
                                    </span>
                                }
                            >
                                {bankAccountsLoading ? (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            fontSize: 12,
                                            color: "var(--hms-gray-500)",
                                            padding: "8px 0",
                                        }}
                                    >
                                        <Loader2 size={14} className="animate-spin" /> Loading accounts…
                                    </div>
                                ) : bankAccounts.length === 0 ? (
                                    <Alert tone="warning">
                                        No {advancePaymentMethod === "Cash" ? "CASH" : "SAVINGS / CURRENT"}{" "}
                                        account found. Configure banks in the Finance app to enable
                                        deposit tracking.
                                    </Alert>
                                ) : (
                                    <SearchableSelect
                                        value={selectedBankAccountId}
                                        onChange={(v) => setSelectedBankAccountId(v)}
                                        options={bankAccounts.map((a) => ({
                                            value: a.id,
                                            label: `${a.accountName} · ${a.accountType}${a.bankName ? ` · ${a.bankName}` : ""
                                                }`,
                                        }))}
                                        placeholder="Select account…"
                                    />
                                )}
                            </FormGroup>
                        )}

                        {advanceAmt > 0 && (
                            <FormGroup label="Note (optional)">
                                <Input
                                    placeholder="e.g. Room security deposit, initial advance…"
                                    value={advanceNotes}
                                    onChange={(e) => setAdvanceNotes(e.target.value)}
                                />
                            </FormGroup>
                        )}

                        {advanceAmt > 0 && (
                            <Alert tone="success" icon={<CheckCircle2 size={16} />}>
                                <strong>₹{advanceAmt.toLocaleString("en-IN")}</strong> via{" "}
                                {advancePaymentMethod} will be recorded and automatically deducted from
                                the final discharge bill.
                            </Alert>
                        )}
                    </div>
                </section>

                {/* Summary */}
                {selectedPatient && (
                    <div
                        style={{
                            padding: 16,
                            borderRadius: 8,
                            background: "var(--hms-gray-50)",
                            border: "1px solid var(--hms-gray-200)",
                            fontSize: 13,
                        }}
                    >
                        <p
                            style={{
                                margin: "0 0 8px",
                                fontWeight: 600,
                                color: "var(--hms-gray-700)",
                            }}
                        >
                            Admission summary
                        </p>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: "0 16px",
                                color: "var(--hms-gray-600)",
                            }}
                        >
                            <div>
                                <span style={{ fontWeight: 500 }}>Patient: </span>
                                {selectedPatient.firstName} {selectedPatient.lastName}
                            </div>
                            <div>
                                <span style={{ fontWeight: 500 }}>Source: </span>
                                {form.admissionType.replace(/_/g, " ")}
                            </div>
                            <div>
                                <span style={{ fontWeight: 500 }}>Room: </span>
                                {selectedRoom?.roomNumber || "To be assigned"}
                                {form.bedId &&
                                    availableBeds.find((b) => String(b.id) === String(form.bedId))
                                    ? ` · ${availableBeds.find((b) => String(b.id) === String(form.bedId))
                                        .bedNumber
                                    }`
                                    : ""}
                            </div>
                            <div>
                                <span style={{ fontWeight: 500 }}>Payment: </span>
                                {paymentCategory}
                                {advanceAmt > 0
                                    ? ` (₹${advanceAmt.toLocaleString("en-IN")} advance)`
                                    : ""}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
