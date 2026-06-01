import { useState, useEffect } from "react";
import { useNotification } from "@/context/NotificationContext";
import { patientServicesApi } from "@/utils/api";
import {
    Button,
    Drawer,
    FormGroup,
    Input,
    Modal,
} from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";

const MEAL_DEFAULTS = { BREAKFAST: "08:00", LUNCH: "13:00", DINNER: "20:00" };

const EMPTY_FORM = {
    name: "",
    type: "FOOD",
    mealTime: "BREAKFAST",
    chargeTime: "08:00",
    pricePerMeal: "",
    pricePerDay: "",
    isActive: true,
    oneTimeCharge: false,
};

/**
 * Patient service add / edit form. Edit mode opens as a right-edge
 * Drawer; create mode as a centred Modal — same asymmetric UX used
 * across other Add/Edit pairs.
 *
 * The shape of the request payload (FOOD vs non-FOOD nullables,
 * REGISTRATION oneTimeCharge gating) is preserved byte-for-byte.
 */
function PatientServiceFormModal({ isOpen, onClose, service, hospitalId, onSuccess }) {
    const { notify } = useNotification();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    useEffect(() => {
        if (service) {
            setForm({
                name: service.name,
                type: service.type,
                mealTime: service.mealTime || "BREAKFAST",
                chargeTime:
                    service.chargeTime ||
                    MEAL_DEFAULTS[service.mealTime] ||
                    "08:00",
                pricePerMeal: service.pricePerMeal ?? "",
                pricePerDay: service.pricePerDay ?? "",
                isActive: service.isActive,
                oneTimeCharge: service.oneTimeCharge ?? false,
            });
        } else {
            setForm(EMPTY_FORM);
        }
    }, [service, isOpen]);

    const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            hospitalId,
            name: form.name.trim(),
            type: form.type,
            mealTime: form.type === "FOOD" ? form.mealTime : null,
            chargeTime: form.type === "FOOD" ? form.chargeTime : null,
            pricePerMeal:
                form.type === "FOOD" ? parseFloat(form.pricePerMeal) || 0 : null,
            pricePerDay:
                form.type !== "FOOD" ? parseFloat(form.pricePerDay) || 0 : null,
            isActive: form.isActive,
            oneTimeCharge: form.type === "REGISTRATION" ? form.oneTimeCharge : false,
        };
        setLoading(true);
        try {
            if (service) {
                await patientServicesApi.update(service.id, payload);
                notify("Service updated", "success");
            } else {
                await patientServicesApi.create(payload);
                notify("Service added", "success");
            }
            onSuccess();
            onClose();
        } catch {
            notify(
                service ? "Failed to update service" : "Failed to add service",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    const formId = "patient-service-form";
    const required = <span style={{ color: "var(--hms-danger)" }}>*</span>;

    const formBody = (
        <form
            id={formId}
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
            <FormGroup label={<>Service name {required}</>}>
                <Input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. Breakfast meal"
                    required
                />
            </FormGroup>

            <FormGroup label={<>Service type {required}</>}>
                <SearchableSelect
                    value={form.type}
                    onChange={(v) => set("type", v)}
                    options={[
                        { value: "FOOD", label: "Food" },
                        { value: "ROOM_SERVICE", label: "Room Service" },
                        { value: "CONVENIENCE", label: "Convenience" },
                        { value: "CUSTOM", label: "Custom" },
                        { value: "REGISTRATION", label: "Registration" },
                    ]}
                />
            </FormGroup>

            {form.type === "FOOD" && (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <FormGroup label={<>Meal time {required}</>}>
                            <SearchableSelect
                                value={form.mealTime}
                                onChange={(v) => {
                                    set("mealTime", v);
                                    set("chargeTime", MEAL_DEFAULTS[v] || "08:00");
                                }}
                                options={[
                                    { value: "BREAKFAST", label: "Breakfast" },
                                    { value: "LUNCH", label: "Lunch" },
                                    { value: "DINNER", label: "Dinner" },
                                ]}
                            />
                        </FormGroup>
                        <FormGroup label={<>Charge time {required}</>}>
                            <Input
                                type="time"
                                value={form.chargeTime}
                                onChange={(e) => set("chargeTime", e.target.value)}
                                required
                            />
                        </FormGroup>
                    </div>
                    <FormGroup label={<>Price per meal (₹) {required}</>}>
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            value={form.pricePerMeal}
                            onChange={(e) => set("pricePerMeal", e.target.value)}
                            placeholder="0"
                            required
                        />
                    </FormGroup>
                </>
            )}

            {form.type !== "FOOD" && (
                <FormGroup
                    label={
                        <>
                            {form.type === "REGISTRATION"
                                ? "One-time fee (₹)"
                                : "Price per day (₹)"}{" "}
                            {required}
                        </>
                    }
                >
                    <Input
                        type="number"
                        min="0"
                        step="1"
                        value={form.pricePerDay}
                        onChange={(e) => set("pricePerDay", e.target.value)}
                        placeholder="0"
                        required
                    />
                </FormGroup>
            )}

            {form.type === "REGISTRATION" && (
                <label
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: 14,
                        background: "#eef2ff",
                        border: "1px solid #c7d2fe",
                        borderRadius: 8,
                        cursor: "pointer",
                    }}
                >
                    <input
                        type="checkbox"
                        checked={form.oneTimeCharge}
                        onChange={(e) => set("oneTimeCharge", e.target.checked)}
                        style={{
                            marginTop: 2,
                            width: 16,
                            height: 16,
                            accentColor: "#4338ca",
                            cursor: "pointer",
                        }}
                    />
                    <div>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--hms-gray-700)",
                            }}
                        >
                            Charge only once on registration
                        </p>
                        <p
                            style={{
                                margin: "2px 0 0",
                                fontSize: 11,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            When enabled, this fee is billed once per new patient — not per day
                            during admission.
                        </p>
                    </div>
                </label>
            )}

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 14,
                    background: "var(--hms-gray-50)",
                    border: "1px solid var(--hms-gray-200)",
                    borderRadius: 8,
                }}
            >
                <div>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--hms-gray-700)",
                        }}
                    >
                        Active
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--hms-gray-500)" }}>
                        Add to patient invoices automatically
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={form.isActive}
                    onClick={() => set("isActive", !form.isActive)}
                    style={{
                        position: "relative",
                        width: 44,
                        height: 24,
                        borderRadius: 999,
                        border: "2px solid transparent",
                        background: form.isActive
                            ? "var(--hms-success)"
                            : "var(--hms-gray-300)",
                        cursor: "pointer",
                        transition: "background 0.2s",
                        padding: 0,
                        flexShrink: 0,
                    }}
                >
                    <span
                        style={{
                            display: "inline-block",
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            background: "var(--hms-white)",
                            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                            transform: `translateX(${form.isActive ? 20 : 0}px)`,
                            transition: "transform 0.2s",
                        }}
                    />
                </button>
            </div>
        </form>
    );

    const actionRow = (
        <>
            <Button variant="cancel" onClick={onClose} type="button">
                Cancel
            </Button>
            <Button variant="primary" type="submit" form={formId} loading={loading}>
                {service ? "Save changes" : "Add service"}
            </Button>
        </>
    );

    if (service) {
        return (
            <Drawer
                isOpen={isOpen}
                onClose={onClose}
                title="Edit service"
                footer={actionRow}
            >
                {formBody}
            </Drawer>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="New patient service"
            size="md"
            footer={actionRow}
        >
            {formBody}
        </Modal>
    );
}

export default PatientServiceFormModal;
