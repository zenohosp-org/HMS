import { useState, useEffect, useMemo } from "react";
import { useNotification } from "@/context/NotificationContext";
import { labOrderApi, radiologyApi } from "@/utils/api";
import SearchableSelect from "@/components/ui/SearchableSelect";

/**
 * Shared form for placing a pathology or radiology investigation order.
 *
 * Used in two places:
 *   - IPD Detail Pane → Investigations tab (admissionId required → bills
 *     against the active IPD invoice on labs-side report generation).
 *   - Consultation View → Lab tab (admissionId omitted → labs creates a
 *     standalone walk-in invoice on report generation).
 *
 * Single source of truth for the labOrderApi.create / radiologyApi.create
 * routing — kind is read from the picked catalog row, NEVER from a free-
 * text input or a separate toggle. That contract avoids the historical
 * "MRI ordered into pathology queue" bug.
 *
 * Props:
 *   hospitalId   string  — required
 *   patientId    number  — required
 *   admissionId? string  — optional; OMIT key entirely for OPD walk-ins
 *   catalog      Service[] — pre-fetched by parent; each row carries `kind`
 *                            ("LAB" | "RADIOLOGY") derived from its
 *                            department.code
 *   defaultKind? "LAB" | "RADIOLOGY" | "ALL" — initial typeahead filter
 *   onCreated    (savedOrder) => void — fires on successful create
 *   onCancel?    () => void — optional close hook (modal/panel parent)
 */

const BLANK_FORM = {
    serviceId: "",
    sampleType: "",
    priority: "ROUTINE",
};

export default function RequestInvestigationForm({
    hospitalId,
    patientId,
    admissionId,
    catalog = [],
    defaultKind = "ALL",
    onCreated,
    onCancel,
}) {
    const { notify } = useNotification();

    const [form, setForm] = useState(BLANK_FORM);
    const [kindFilter, setKindFilter] = useState(defaultKind);
    const [saving, setSaving] = useState(false);

    // Reset state when the patient context changes (e.g. doctor queue-walks
    // from one OPD patient to the next without unmounting the parent).
    useEffect(() => {
        setForm(BLANK_FORM);
        setKindFilter(defaultKind);
    }, [patientId, defaultKind]);

    // Resolve the picked service from the catalog by id — single source of
    // truth for routing.
    const picked = useMemo(
        () => catalog.find((s) => s.id === form.serviceId) || null,
        [catalog, form.serviceId]
    );

    // Typeahead filter — All / Pathology / Radiology.
    const pickerOptions = useMemo(() => {
        const pool = kindFilter === "ALL"
            ? catalog
            : catalog.filter((s) => s.kind === kindFilter);
        return pool.map((s) => ({
            value: s.id,
            label: `${s.name} — ${s.kind === "LAB" ? "Pathology" : "Radiology"} · ₹${s.price}${s.gstRate ? ` + ${s.gstRate}% GST` : ""}`,
        }));
    }, [catalog, kindFilter]);

    // GST preview — only shown once a service is picked so the doctor sees
    // the final billed amount before submitting.
    const gstPreview = useMemo(() => {
        if (!picked || picked.price == null) return null;
        const price = Number(picked.price) || 0;
        const gstRate = Number(picked.gstRate) || 0;
        const gstAmount = Math.round(price * gstRate / 100 * 100) / 100;
        const total = Math.round((price + gstAmount) * 100) / 100;
        return { price, gstRate, gstAmount, total };
    }, [picked]);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const resetForm = () => setForm(BLANK_FORM);

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        if (!picked) {
            notify("Pick a test from the catalog", "warning");
            return;
        }
        if (!hospitalId || !patientId) {
            notify("Patient context missing", "error");
            return;
        }
        setSaving(true);
        // Omit the admissionId key entirely for OPD walk-ins. Labs handles
        // both cases (entity field is nullable), but explicit omission is
        // cleaner and matches a true OPD create from a walk-in clinic.
        const payload = {
            hospitalId,
            patientId,
            ...(admissionId ? { admissionId } : {}),
            serviceName: picked.name,
            specializationName: picked.department?.name ?? null,
            sampleType: picked.kind === "LAB" ? (form.sampleType.trim() || null) : null,
            priority: form.priority,
            price: picked.price ?? null,
            gstRate: picked.gstRate ?? null,
        };
        try {
            const saved = picked.kind === "LAB"
                ? await labOrderApi.create(payload)
                : await radiologyApi.create(payload);
            notify(
                `${picked.kind === "LAB" ? "Lab" : "Radiology"} order placed`,
                "success"
            );
            resetForm();
            onCreated?.(saved);
        } catch (err) {
            // Form stays open with values intact so the user can retry.
            notify(
                err?.response?.data?.message || "Failed to place order",
                "error"
            );
        } finally {
            setSaving(false);
        }
    };

    // Empty-catalog guard — doctor knows where to go fix it.
    if (catalog.length === 0) {
        return (
            <div className="lab-form">
                <p className="lab-form__hint">
                    No labs or radiology services configured. Add them under
                    Settings → Services (set department to <strong>Labs</strong>
                    {" "}or <strong>Radiology</strong>) and reload.
                </p>
                {onCancel && (
                    <div className="lab-form__actions">
                        <button
                            type="button"
                            className="lab-form__cancel-btn"
                            onClick={onCancel}
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <form className="lab-form" onSubmit={handleSubmit}>
            {/* Typeahead kind filter — only shown when defaultKind allows
                cross-kind selection (consult view); IPD already has its own
                top-level kind toggle that owns this state. */}
            {defaultKind === "ALL" && (
                <div className="lab-kind-pills" style={{ marginBottom: 8 }}>
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
            )}

            <div className="lab-form__fields">
                <div className="lab-form__field lab-form__field--grow">
                    <label className="lab-form__label">Test *</label>
                    {pickerOptions.length > 0 ? (
                        <SearchableSelect
                            value={form.serviceId}
                            onChange={(serviceId) => setField("serviceId", serviceId)}
                            options={pickerOptions}
                            placeholder={`Pick a ${
                                kindFilter === "ALL" ? "test" :
                                kindFilter === "LAB" ? "pathology test" :
                                "radiology test"
                            }`}
                        />
                    ) : (
                        <p className="lab-form__hint">
                            No services tagged under{" "}
                            {kindFilter === "RADIOLOGY" ? "Radiology" : "Labs"}{" "}
                            yet. Add them in Settings → Services.
                        </p>
                    )}
                </div>

                {/* Sample only meaningful for pathology — hidden once a
                    radiology test is picked so the doctor isn't asked. */}
                {(picked?.kind !== "RADIOLOGY") && (
                    <div className="lab-form__field">
                        <label className="lab-form__label">Sample</label>
                        <input
                            className="lab-form__input"
                            placeholder="Blood / Urine"
                            value={form.sampleType}
                            onChange={(e) => setField("sampleType", e.target.value)}
                        />
                    </div>
                )}

                <div className="lab-form__field">
                    <label className="lab-form__label">Priority</label>
                    <select
                        className="lab-form__select"
                        value={form.priority}
                        onChange={(e) => setField("priority", e.target.value)}
                    >
                        <option value="ROUTINE">Routine</option>
                        <option value="URGENT">Urgent</option>
                        <option value="STAT">STAT</option>
                    </select>
                </div>
            </div>

            {/* GST preview — visible once a service is picked. */}
            {gstPreview && gstPreview.price > 0 && (
                <p className="lab-form__hint">
                    Subtotal ₹{gstPreview.price}
                    {gstPreview.gstRate > 0 && (
                        <> · GST {gstPreview.gstRate}% ₹{gstPreview.gstAmount}</>
                    )}
                    {" · "}
                    <strong>Total ₹{gstPreview.total}</strong>
                </p>
            )}

            <div className="lab-form__actions">
                <button
                    type="submit"
                    className="lab-form__save-btn"
                    disabled={saving || !picked}
                >
                    {saving ? "Saving…" : "Place order"}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        className="lab-form__cancel-btn"
                        onClick={() => { resetForm(); onCancel(); }}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}
