import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { doctorsApi, staffApi, specializationApi } from "@/utils/api";
import StateSelect from "@/components/StateSelect";
import { Home, X } from "lucide-react";
import {
    Button,
    Drawer,
    FormGroup,
    Input,
    Modal,
    Textarea,
} from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";

// MON=bit0=1 … SUN=bit6=64
const DAYS = [
    { label: "MON", bit: 1 },
    { label: "TUE", bit: 2 },
    { label: "WED", bit: 4 },
    { label: "THU", bit: 8 },
    { label: "FRI", bit: 16 },
    { label: "SAT", bit: 32 },
    { label: "SUN", bit: 64 },
];
const MAX_SPECS = 6;

/** Small section heading — 11px uppercase tracking, matches the
 *  pre-migration FieldLabel pattern. Used for section heads and as
 *  the label on sub-fields in the dense schedule grid. */
function SectionLabel({ children }) {
    return (
        <p
            style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                color: "var(--hms-gray-500)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 12,
            }}
        >
            {children}
        </p>
    );
}

/** Specialisation chip picker.
 *  Renders selected specs as removable Info-tone chips, then a
 *  SearchableSelect that adds new ones until MAX_SPECS is reached. */
function SpecPicker({ specializations, value, onChange, loading }) {
    const remaining = specializations.filter((s) => !value.includes(s.id));

    const add = (id) => {
        if (!id || value.length >= MAX_SPECS || value.includes(id)) return;
        onChange([...value, id]);
    };
    const remove = (id) => onChange(value.filter((v) => v !== id));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {value.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {value.map((id) => {
                        const spec = specializations.find((s) => s.id === id);
                        return (
                            <span
                                key={id}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                    background: "var(--hms-info-bg)",
                                    color: "#0369a1",
                                    border: "1px solid var(--hms-info-border)",
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                            >
                                {spec?.name || "Unknown"}
                                <button
                                    type="button"
                                    onClick={() => remove(id)}
                                    aria-label={`Remove ${spec?.name || "specialisation"}`}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#0369a1",
                                        cursor: "pointer",
                                        lineHeight: 0,
                                        padding: 0,
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}
            {value.length < MAX_SPECS ? (
                <SearchableSelect
                    options={remaining.map((s) => ({ value: s.id, label: s.name }))}
                    value=""
                    onChange={(v) => add(v)}
                    placeholder={
                        loading
                            ? "Loading…"
                            : remaining.length === 0
                                ? "All specialisations added"
                                : "Add specialisation…"
                    }
                    disabled={loading || remaining.length === 0}
                />
            ) : (
                <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-400)" }}>
                    Maximum {MAX_SPECS} specialisations reached.
                </p>
            )}
        </div>
    );
}

function fmtDuration(mins) {
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h} hrs`;
    return `${m} min`;
}

/** Day-of-week pill button styling (matches hms-btn-primary / -secondary). */
const dayBtnStyle = (active) => ({
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s",
    border: active ? "1px solid var(--hms-brand-primary)" : "1px solid var(--hms-gray-200)",
    background: active ? "var(--hms-brand-primary)" : "var(--hms-white)",
    color: active ? "var(--hms-white)" : "var(--hms-gray-500)",
    fontFamily: "var(--hms-font-family)",
});

/**
 * Add / Edit doctor profile.
 *
 * Asymmetric UX preserved exactly:
 *   * editDoctor truthy → right-edge Drawer with the professional-only
 *     subset (no account credentials — those exist already).
 *   * editDoctor falsey → centred extra-wide Modal with a full account-
 *     setup + professional + schedule form.
 *
 * Data layer, validators, and API surfaces are unchanged byte-for-byte.
 * SearchableSelect and StateSelect remain on the legacy stack.
 */
function DoctorFormModal({ onClose, onSaved, editDoctor }) {
    const { user } = useAuth();
    const { notify } = useNotification();

    const [submitting, setSubmitting] = useState(false);
    const [specializations, setSpecializations] = useState([]);
    const [specsLoading, setSpecsLoading] = useState(false);

    const [userForm, setUserForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        state: "",
    });

    const [doctorForm, setDoctorForm] = useState({
        specializationIds: editDoctor?.specializationIds || [],
        qualification: editDoctor?.qualification || "",
        medicalRegistrationNumber: editDoctor?.medicalRegistrationNumber || "",
        registrationCouncil: editDoctor?.registrationCouncil || "",
        personalPhone: editDoctor?.personalPhone || "",
        personalEmail: editDoctor?.personalEmail || "",
        residentialAddress: editDoctor?.residentialAddress || "",
        consultationFee: editDoctor?.consultationFee || 500,
        followUpFee: editDoctor?.followUpFee || 300,
        availableDaysMask: editDoctor?.availableDaysMask ?? 31,
        slotDurationMin: editDoctor?.slotDurationMin || 15,
        maxDailySlots: editDoctor?.maxDailySlots || 40,
    });

    useEffect(() => {
        if (!user?.hospitalId) return;
        setSpecsLoading(true);
        specializationApi
            .list(user.hospitalId)
            .then((data) => setSpecializations(data))
            .catch(() => setSpecializations([]))
            .finally(() => setSpecsLoading(false));
    }, [user?.hospitalId]);

    const setDoc = (patch) => setDoctorForm((p) => ({ ...p, ...patch }));
    const setUser = (patch) => setUserForm((p) => ({ ...p, ...patch }));

    const mask = doctorForm.availableDaysMask || 0;
    const activeDayCount = DAYS.filter((d) => mask & d.bit).length;
    const slotMin = doctorForm.slotDurationMin || 0;
    const slotsPerDay = doctorForm.maxDailySlots || 0;
    const totalMinPerDay = slotMin * slotsPerDay;
    const totalMinPerWeek = totalMinPerDay * activeDayCount;

    const toggleDay = (bit) => setDoc({ availableDaysMask: mask ^ bit });

    const validateCreate = () => {
        if (
            !userForm.firstName.trim() ||
            !userForm.email.trim() ||
            !userForm.phone.trim() ||
            !userForm.password.trim()
        ) {
            notify("Please fill in all required account fields", "error");
            return false;
        }
        const pwdRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;
        if (!pwdRegex.test(userForm.password)) {
            notify(
                "Password must be at least 6 characters with 1 uppercase, 1 number and 1 special character",
                "error"
            );
            return false;
        }
        if (doctorForm.specializationIds.length === 0) {
            notify("Please select at least one specialization", "error");
            return false;
        }
        if (
            !doctorForm.qualification.trim() ||
            !doctorForm.medicalRegistrationNumber.trim() ||
            !doctorForm.registrationCouncil.trim()
        ) {
            notify("Please fill in all professional details", "error");
            return false;
        }
        if (
            !doctorForm.consultationFee ||
            !doctorForm.slotDurationMin ||
            !doctorForm.maxDailySlots ||
            activeDayCount === 0
        ) {
            notify("Please complete scheduling & fee details", "error");
            return false;
        }
        return true;
    };

    const handleCreate = async () => {
        if (!validateCreate() || !user?.hospitalId) return;
        setSubmitting(true);
        try {
            const newUser = await staffApi.create({
                ...userForm,
                role: "DOCTOR",
                hospitalId: user.hospitalId,
            });
            const {
                specializationIds,
                qualification,
                medicalRegistrationNumber,
                registrationCouncil,
                personalPhone,
                personalEmail,
                residentialAddress,
                consultationFee,
                followUpFee,
                availableDaysMask,
                slotDurationMin,
                maxDailySlots,
            } = doctorForm;
            await doctorsApi.create({
                specializationIds,
                qualification,
                medicalRegistrationNumber,
                registrationCouncil,
                personalPhone,
                personalEmail,
                residentialAddress,
                consultationFee,
                followUpFee,
                availableDaysMask,
                slotDurationMin,
                maxDailySlots,
                userId: newUser.id,
                hospitalId: user.hospitalId,
            });
            notify("Doctor profile created", "success");
            onSaved();
            onClose();
        } catch (error) {
            notify(error.response?.data?.error || "Operation failed", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async (e) => {
        e?.preventDefault();
        if (!user?.hospitalId) return;
        setSubmitting(true);
        try {
            await doctorsApi.update(editDoctor.id, doctorForm);
            notify("Doctor profile updated", "success");
            onSaved();
            onClose();
        } catch (error) {
            notify(error.response?.data?.error || "Operation failed", "error");
        } finally {
            setSubmitting(false);
        }
    };

    /* ───────────────────────── Edit mode (Drawer) ──────────────────────── */
    if (editDoctor) {
        const initials = `${editDoctor.firstName?.[0] ?? ""}${editDoctor.lastName?.[0] ?? ""}`.toUpperCase();
        return (
            <Drawer
                isOpen
                onClose={onClose}
                title="Edit doctor profile"
                footer={
                    <>
                        <Button variant="cancel" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            form="doctor-edit-form"
                            loading={submitting}
                        >
                            Save changes
                        </Button>
                    </>
                }
            >
                <form
                    id="doctor-edit-form"
                    onSubmit={handleUpdate}
                    style={{ display: "flex", flexDirection: "column", gap: 24 }}
                >
                    {/* Doctor identity card */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            padding: 16,
                            background: "var(--hms-gray-50)",
                            border: "1px solid var(--hms-gray-200)",
                            borderRadius: "var(--hms-radius)",
                        }}
                    >
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 999,
                                background: "var(--hms-info-bg)",
                                color: "#0369a1",
                                border: "2px solid var(--hms-info-border)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 16,
                                flexShrink: 0,
                            }}
                        >
                            {initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontWeight: 700,
                                    color: "var(--hms-gray-900)",
                                    fontSize: 15,
                                }}
                            >
                                Dr. {editDoctor.firstName} {editDoctor.lastName}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--hms-gray-500)", marginTop: 2 }}>
                                {editDoctor.email}
                            </div>
                        </div>
                    </div>

                    {/* Professional */}
                    <div>
                        <SectionLabel>Professional</SectionLabel>
                        <FormGroup label="Specialisations *">
                            <SpecPicker
                                specializations={specializations}
                                value={doctorForm.specializationIds}
                                onChange={(ids) => setDoc({ specializationIds: ids })}
                                loading={specsLoading}
                            />
                        </FormGroup>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 12,
                                marginTop: 12,
                            }}
                        >
                            <FormGroup label="Qualification *">
                                <Input
                                    value={doctorForm.qualification}
                                    onChange={(e) => setDoc({ qualification: e.target.value })}
                                    placeholder="e.g. MBBS, MD"
                                />
                            </FormGroup>
                            <FormGroup label="Registration no. *">
                                <Input
                                    value={doctorForm.medicalRegistrationNumber}
                                    onChange={(e) =>
                                        setDoc({ medicalRegistrationNumber: e.target.value })
                                    }
                                    placeholder="MRC-XXXXXX"
                                />
                            </FormGroup>
                            <FormGroup label="Council *">
                                <Input
                                    value={doctorForm.registrationCouncil}
                                    onChange={(e) =>
                                        setDoc({ registrationCouncil: e.target.value })
                                    }
                                    placeholder="Tamil Nadu MC"
                                />
                            </FormGroup>
                        </div>
                    </div>

                    {/* Contact */}
                    <div>
                        <SectionLabel>Personal contact</SectionLabel>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 12,
                            }}
                        >
                            <FormGroup label="Phone">
                                <Input
                                    type="tel"
                                    value={doctorForm.personalPhone}
                                    onChange={(e) =>
                                        setDoc({ personalPhone: e.target.value })
                                    }
                                    placeholder="+91 99999 00000"
                                />
                            </FormGroup>
                            <FormGroup label="Email">
                                <Input
                                    type="email"
                                    value={doctorForm.personalEmail}
                                    onChange={(e) =>
                                        setDoc({ personalEmail: e.target.value })
                                    }
                                    placeholder="name@personal.com"
                                />
                            </FormGroup>
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <SectionLabel>Address</SectionLabel>
                        <FormGroup
                            label={
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                    }}
                                >
                                    <Home size={14} style={{ color: "var(--hms-accent-external)" }} />
                                    Residential
                                </span>
                            }
                        >
                            <Textarea
                                rows={3}
                                value={doctorForm.residentialAddress}
                                onChange={(e) =>
                                    setDoc({ residentialAddress: e.target.value })
                                }
                                placeholder="Home, street, city, pincode"
                            />
                        </FormGroup>
                    </div>

                    {/* Schedule & Fees */}
                    <div>
                        <SectionLabel>Schedule & fees</SectionLabel>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 12,
                            }}
                        >
                            <FormGroup label="Consultation (₹) *">
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    value={doctorForm.consultationFee || ""}
                                    onChange={(e) =>
                                        setDoc({
                                            consultationFee: parseFloat(e.target.value) || 0,
                                        })
                                    }
                                />
                            </FormGroup>
                            <FormGroup label="Follow-up (₹) *">
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    value={doctorForm.followUpFee || ""}
                                    onChange={(e) =>
                                        setDoc({
                                            followUpFee: parseFloat(e.target.value) || 0,
                                        })
                                    }
                                />
                            </FormGroup>
                            <FormGroup label="Slot duration (min) *">
                                <Input
                                    type="number"
                                    step="5"
                                    min="1"
                                    value={doctorForm.slotDurationMin || ""}
                                    onChange={(e) =>
                                        setDoc({
                                            slotDurationMin: parseInt(e.target.value) || 0,
                                        })
                                    }
                                />
                            </FormGroup>
                            <FormGroup label="Max daily slots *">
                                <Input
                                    type="number"
                                    min="1"
                                    value={doctorForm.maxDailySlots || ""}
                                    onChange={(e) =>
                                        setDoc({
                                            maxDailySlots: parseInt(e.target.value) || 0,
                                        })
                                    }
                                />
                            </FormGroup>
                        </div>
                        <div style={{ marginTop: 12 }}>
                            <FormGroup label="Available days *">
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {DAYS.map(({ label, bit }) => {
                                        const active = !!(mask & bit);
                                        return (
                                            <button
                                                key={bit}
                                                type="button"
                                                onClick={() => toggleDay(bit)}
                                                style={dayBtnStyle(active)}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </FormGroup>
                        </div>
                    </div>
                </form>
            </Drawer>
        );
    }

    /* ───────────────────────── Create mode (Modal) ─────────────────────── */
    return (
        <Modal
            isOpen
            onClose={onClose}
            size="xl"
            title="Add new doctor"
            footer={
                <>
                    <Button variant="cancel" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleCreate} loading={submitting}>
                        Create profile
                    </Button>
                </>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Account setup */}
                <div>
                    <SectionLabel>Account setup</SectionLabel>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                        }}
                    >
                        <FormGroup label="First name *">
                            <Input
                                autoFocus
                                value={userForm.firstName}
                                onChange={(e) => setUser({ firstName: e.target.value })}
                                placeholder="Arjun"
                            />
                        </FormGroup>
                        <FormGroup label="Last name">
                            <Input
                                value={userForm.lastName}
                                onChange={(e) => setUser({ lastName: e.target.value })}
                                placeholder="Sharma"
                            />
                        </FormGroup>
                        <FormGroup label="Email address *">
                            <Input
                                type="email"
                                value={userForm.email}
                                onChange={(e) => setUser({ email: e.target.value })}
                                placeholder="doctor@hospital.com"
                            />
                        </FormGroup>
                        <FormGroup label="Phone number *">
                            <Input
                                type="tel"
                                value={userForm.phone}
                                onChange={(e) => setUser({ phone: e.target.value })}
                                placeholder="+91 98765 43210"
                            />
                        </FormGroup>
                        <FormGroup
                            label="Temporary password *"
                            hint="Min. 6 chars, 1 uppercase, 1 number, 1 special"
                            className="grid-col-full"
                        >
                            <Input
                                type="password"
                                value={userForm.password}
                                onChange={(e) => setUser({ password: e.target.value })}
                                placeholder="Minimum 6 characters"
                            />
                        </FormGroup>
                    </div>
                </div>

                {/* Professional identity */}
                <div>
                    <SectionLabel>Professional identity</SectionLabel>
                    <FormGroup
                        label={
                            <span>
                                Specialisations *{" "}
                                <span style={{ fontWeight: 400, color: "var(--hms-gray-400)" }}>
                                    (up to {MAX_SPECS})
                                </span>
                            </span>
                        }
                    >
                        <SpecPicker
                            specializations={specializations}
                            value={doctorForm.specializationIds}
                            onChange={(ids) => setDoc({ specializationIds: ids })}
                            loading={specsLoading}
                        />
                    </FormGroup>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                            marginTop: 12,
                        }}
                    >
                        <FormGroup label="Qualification *">
                            <Input
                                value={doctorForm.qualification}
                                onChange={(e) => setDoc({ qualification: e.target.value })}
                                placeholder="e.g. MBBS, MD"
                            />
                        </FormGroup>
                        <FormGroup label="Registration number *">
                            <Input
                                value={doctorForm.medicalRegistrationNumber}
                                onChange={(e) =>
                                    setDoc({ medicalRegistrationNumber: e.target.value })
                                }
                                placeholder="MRC-XXXXXX"
                            />
                        </FormGroup>
                        <FormGroup
                            label="Registration council *"
                            className="grid-col-full"
                        >
                            <Input
                                value={doctorForm.registrationCouncil}
                                onChange={(e) =>
                                    setDoc({ registrationCouncil: e.target.value })
                                }
                                placeholder="e.g. Tamil Nadu Medical Council"
                            />
                        </FormGroup>
                    </div>
                </div>

                {/* Personal contact */}
                <div>
                    <SectionLabel>Personal contact</SectionLabel>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                        }}
                    >
                        <FormGroup label="Phone">
                            <Input
                                type="tel"
                                value={doctorForm.personalPhone}
                                onChange={(e) => setDoc({ personalPhone: e.target.value })}
                                placeholder="+91 99999 00000"
                            />
                        </FormGroup>
                        <FormGroup label="Email">
                            <Input
                                type="email"
                                value={doctorForm.personalEmail}
                                onChange={(e) => setDoc({ personalEmail: e.target.value })}
                                placeholder="name@personal.com"
                            />
                        </FormGroup>
                    </div>
                </div>

                {/* Address */}
                <div>
                    <SectionLabel>Address</SectionLabel>
                    <FormGroup label="Residential address">
                        <Textarea
                            rows={2}
                            value={doctorForm.residentialAddress}
                            onChange={(e) =>
                                setDoc({ residentialAddress: e.target.value })
                            }
                            placeholder="Home address, street, area, city, pincode"
                        />
                    </FormGroup>
                    <div style={{ marginTop: 12 }}>
                        <StateSelect
                            value={userForm.state}
                            onChange={(val) => setUser({ state: val })}
                            inputClassName="hms-input"
                            labelClassName="hms-label"
                        />
                    </div>
                </div>

                {/* Schedule & fees */}
                <div>
                    <SectionLabel>Schedule & fees</SectionLabel>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                        }}
                    >
                        <FormGroup label="Consultation fee (₹) *">
                            <Input
                                type="number"
                                step="0.01"
                                min="1"
                                value={doctorForm.consultationFee || ""}
                                onChange={(e) =>
                                    setDoc({
                                        consultationFee: parseFloat(e.target.value) || 0,
                                    })
                                }
                                placeholder="500"
                            />
                        </FormGroup>
                        <FormGroup label="Follow-up fee (₹) *">
                            <Input
                                type="number"
                                step="0.01"
                                min="1"
                                value={doctorForm.followUpFee || ""}
                                onChange={(e) =>
                                    setDoc({
                                        followUpFee: parseFloat(e.target.value) || 0,
                                    })
                                }
                                placeholder="300"
                            />
                        </FormGroup>
                        <FormGroup label="Slot duration (min) *">
                            <Input
                                type="number"
                                step="5"
                                min="5"
                                value={doctorForm.slotDurationMin || ""}
                                onChange={(e) =>
                                    setDoc({
                                        slotDurationMin: parseInt(e.target.value) || 0,
                                    })
                                }
                                placeholder="15"
                            />
                        </FormGroup>
                        <FormGroup label="Max daily slots *">
                            <Input
                                type="number"
                                min="1"
                                value={doctorForm.maxDailySlots || ""}
                                onChange={(e) =>
                                    setDoc({
                                        maxDailySlots: parseInt(e.target.value) || 0,
                                    })
                                }
                                placeholder="40"
                            />
                        </FormGroup>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <FormGroup label="Available days *">
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {DAYS.map(({ label, bit }) => {
                                    const active = !!(mask & bit);
                                    return (
                                        <button
                                            key={bit}
                                            type="button"
                                            onClick={() => toggleDay(bit)}
                                            style={dayBtnStyle(active)}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </FormGroup>
                    </div>
                    <div
                        style={{
                            marginTop: 12,
                            padding: 16,
                            background: "var(--hms-gray-50)",
                            border: "1px solid var(--hms-gray-200)",
                            borderRadius: "var(--hms-radius)",
                        }}
                    >
                        <SectionLabel>Weekly schedule preview</SectionLabel>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: 12,
                            }}
                        >
                            {[
                                { label: "Slot", value: slotMin > 0 ? `${slotMin} min` : "—" },
                                {
                                    label: "Per day",
                                    value: slotsPerDay > 0 ? slotsPerDay : "—",
                                },
                                {
                                    label: "Hrs / day",
                                    value: fmtDuration(totalMinPerDay),
                                },
                                {
                                    label: "Days / wk",
                                    value: activeDayCount > 0 ? activeDayCount : "—",
                                },
                            ].map(({ label, value }) => (
                                <div
                                    key={label}
                                    style={{
                                        background: "var(--hms-white)",
                                        border: "1px solid var(--hms-gray-200)",
                                        borderRadius: 8,
                                        padding: 12,
                                        textAlign: "center",
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 10,
                                            color: "var(--hms-gray-400)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                        }}
                                    >
                                        {label}
                                    </p>
                                    <p
                                        style={{
                                            margin: "4px 0 0",
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: "var(--hms-gray-900)",
                                        }}
                                    >
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div
                            style={{
                                marginTop: 12,
                                paddingTop: 12,
                                borderTop: "1px solid var(--hms-gray-200)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "var(--hms-gray-500)",
                                }}
                            >
                                Total clinical hours / week
                            </span>
                            <span
                                style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: "var(--hms-gray-900)",
                                }}
                            >
                                {fmtDuration(totalMinPerWeek)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export { DoctorFormModal as default };
