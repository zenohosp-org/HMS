import { useState, useEffect, useMemo } from "react";
import { useNotification } from "@/context/NotificationContext";
import { labOrderApi, radiologyApi } from "@/utils/api";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { X } from "lucide-react";

/**
 * Shared form for placing one OR MORE pathology/radiology investigation
 * orders in a single action.
 *
 * Used in three places (IPD Labs tab, Consultation View, Consultation modal).
 * The doctor adds tests to a queue (each carries its own `kind`), sets a
 * shared priority (+ optional sample for pathology), and submits once — the
 * form fires one create per queued test, routed by that test's kind, so a
 * mixed pathology + radiology batch lands in the correct pipelines. A single
 * failure never drops the orders that did go through (allSettled); failures
 * stay queued for retry.
 *
 * `kind` is read from the picked catalog row, NEVER from a free-text input —
 * the contract that avoids the "MRI ordered into pathology queue" bug.
 *
 * Props:
 *   hospitalId   string  — required
 *   patientId    number  — required
 *   admissionId? string  — optional; OMIT entirely for OPD walk-ins
 *   catalog      Service[] — pre-fetched by parent; each row carries `kind`
 *                            ("LAB" | "RADIOLOGY"), name, price, gstRate, and
 *                            (labs-sourced rows) labServiceId
 *   defaultKind? "LAB" | "RADIOLOGY" | "ALL" — initial typeahead filter
 *   onCreated    (savedOrders[]) => void — fires once with the created orders
 *   onCancel?    () => void — optional close hook (modal/panel parent)
 */

const fmtMoney = (n) => `₹${Math.round((Number(n) || 0) * 100) / 100}`;

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

    const [selected, setSelected]   = useState([]);          // catalog rows queued for ordering
    const [pendingId, setPendingId] = useState("");          // transient picker value (resets after add)
    const [sampleType, setSampleType] = useState("");        // shared, optional (pathology only)
    const [priority, setPriority]   = useState("ROUTINE");   // shared across the batch
    const [kindFilter, setKindFilter] = useState(defaultKind);
    const [saving, setSaving]       = useState(false);

    // Reset when the patient context changes (doctor queue-walks to the next
    // OPD patient without the parent unmounting).
    useEffect(() => {
        setSelected([]);
        setPendingId("");
        setSampleType("");
        setPriority("ROUTINE");
        setKindFilter(defaultKind);
    }, [patientId, defaultKind]);

    const selectedIds = useMemo(
        () => new Set(selected.map((s) => String(s.id))),
        [selected]
    );

    // Picker options — filtered by the kind pill, excluding already-queued
    // tests, grouped by discipline in the dropdown.
    const pickerOptions = useMemo(() => {
        const pool = kindFilter === "ALL" ? catalog : catalog.filter((s) => s.kind === kindFilter);
        return pool
            .filter((s) => !selectedIds.has(String(s.id)))
            .map((s) => ({
                value: s.id,
                group: s.kind === "LAB" ? "Pathology" : "Radiology",
                label: `${s.name} · ${fmtMoney(s.price)}${s.gstRate ? ` +${s.gstRate}% GST` : ""}`,
            }));
    }, [catalog, kindFilter, selectedIds]);

    const hasLab = useMemo(() => selected.some((s) => s.kind === "LAB"), [selected]);

    // Running totals across the queued tests.
    const totals = useMemo(() => {
        let subtotal = 0, gst = 0;
        selected.forEach((s) => {
            const price = Number(s.price) || 0;
            const rate = Number(s.gstRate) || 0;
            subtotal += price;
            gst += (price * rate) / 100;
        });
        subtotal = Math.round(subtotal * 100) / 100;
        gst = Math.round(gst * 100) / 100;
        return { subtotal, gst, total: Math.round((subtotal + gst) * 100) / 100 };
    }, [selected]);

    const addTest = (id) => {
        const row = catalog.find((s) => String(s.id) === String(id));
        if (row && !selectedIds.has(String(row.id))) {
            setSelected((prev) => [...prev, row]);
        }
        setPendingId(""); // clear the picker for the next pick
    };

    const removeTest = (id) =>
        setSelected((prev) => prev.filter((s) => String(s.id) !== String(id)));

    const buildPayload = (row) => ({
        hospitalId,
        patientId,
        ...(admissionId ? { admissionId } : {}),
        // Catalog link (labs V15) — set for labs-sourced rows, null on legacy /
        // free-text rows. When present labs snapshots name/sample/price/gst from
        // the catalogue; the request values below still win when sent.
        labServiceId: row.labServiceId ?? null,
        serviceName: row.name,
        specializationName: row.department?.name ?? null,
        sampleType: row.kind === "LAB" ? (sampleType.trim() || null) : null,
        priority,
        price: row.price ?? null,
        gstRate: row.gstRate ?? null,
    });

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        if (selected.length === 0) {
            notify("Add at least one test", "warning");
            return;
        }
        if (!hospitalId || !patientId) {
            notify("Patient context missing", "error");
            return;
        }

        setSaving(true);
        // One create per queued test, each routed by its own kind. allSettled so
        // a single rejection doesn't drop the orders that succeeded.
        const results = await Promise.allSettled(
            selected.map((row) =>
                (row.kind === "LAB" ? labOrderApi.create : radiologyApi.create)(buildPayload(row))
            )
        );
        setSaving(false);

        const savedData = [];
        const failedRows = [];
        results.forEach((r, i) => {
            if (r.status === "fulfilled") savedData.push(r.value);
            else failedRows.push(selected[i]);
        });

        // Keep only the failures queued so the doctor retries just those.
        setSelected(failedRows);
        setPendingId("");

        if (savedData.length) {
            notify(
                `${savedData.length} order${savedData.length === 1 ? "" : "s"} placed`
                + (failedRows.length
                    ? ` · ${failedRows.length} failed: ${failedRows.map((f) => f.name).join(", ")}`
                    : ""),
                failedRows.length ? "warning" : "success"
            );
            onCreated?.(savedData);
        } else {
            notify(
                `Failed to place order${failedRows.length === 1 ? "" : "s"}`,
                "error"
            );
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
            {/* Typeahead kind filter — only when defaultKind allows cross-kind
                selection (consult view); IPD owns this state via its own toggle. */}
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
                    <label className="lab-form__label">Add tests *</label>
                    {pickerOptions.length > 0 ? (
                        <SearchableSelect
                            value={pendingId}
                            onChange={addTest}
                            options={pickerOptions}
                            placeholder={`Add a ${
                                kindFilter === "ALL" ? "test" :
                                kindFilter === "LAB" ? "pathology test" :
                                "radiology test"
                            }…`}
                        />
                    ) : (
                        <p className="lab-form__hint">
                            {selected.length > 0
                                ? "All available tests added."
                                : <>No services tagged under{" "}
                                    {kindFilter === "RADIOLOGY" ? "Radiology" : "Labs"}{" "}
                                    yet. Add them in Settings → Services.</>}
                        </p>
                    )}
                </div>

                {/* Sample only meaningful for pathology; one shared, optional
                    value applied to all pathology tests in the batch (labs uses
                    the catalogue's specimen default when left blank). */}
                {hasLab && (
                    <div className="lab-form__field">
                        <label className="lab-form__label">Sample</label>
                        <input
                            className="lab-form__input"
                            placeholder="Blood / Urine"
                            value={sampleType}
                            onChange={(e) => setSampleType(e.target.value)}
                        />
                    </div>
                )}

                <div className="lab-form__field">
                    <label className="lab-form__label">Priority</label>
                    <select
                        className="lab-form__select"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                    >
                        <option value="ROUTINE">Routine</option>
                        <option value="URGENT">Urgent</option>
                        <option value="STAT">STAT</option>
                    </select>
                </div>
            </div>

            {/* Queued tests — compact list, one per row: kind badge · name ·
                price · remove. Scrolls past ~8 rows so the panel stays compact;
                total pinned in the footer. Built for at-a-glance reading by
                nurses + doctors placing a multi-test order. */}
            {selected.length > 0 && (
                <div className="mt-2.5 rounded-lg border border-gray-200 overflow-hidden">
                    <div className="max-h-56 overflow-y-auto">
                        {selected.map((s, i) => (
                            <div
                                key={s.id}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${i % 2 ? "bg-gray-50" : "bg-white"}`}
                            >
                                <span
                                    className={`shrink-0 inline-flex items-center justify-center w-10 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                        s.kind === "LAB"
                                            ? "bg-violet-100 text-violet-700"
                                            : "bg-blue-100 text-blue-700"
                                    }`}
                                >
                                    {s.kind === "LAB" ? "Path" : "Rad"}
                                </span>
                                <span className="flex-1 min-w-0 truncate font-semibold text-gray-900">
                                    {s.name}
                                </span>
                                <span className="shrink-0 tabular-nums text-gray-600">
                                    {fmtMoney(s.price)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeTest(s.id)}
                                    aria-label={`Remove ${s.name}`}
                                    className="shrink-0 inline-flex items-center justify-center text-gray-400 hover:text-red-500"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {totals.subtotal > 0 && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs bg-gray-50 border-t border-gray-200">
                            <span className="font-medium text-gray-500">
                                {selected.length} test{selected.length === 1 ? "" : "s"}
                            </span>
                            <span className="text-gray-600">
                                Subtotal {fmtMoney(totals.subtotal)}
                                {totals.gst > 0 && <> · GST {fmtMoney(totals.gst)}</>}
                                {" · "}
                                <strong className="text-gray-900">Total {fmtMoney(totals.total)}</strong>
                            </span>
                        </div>
                    )}
                </div>
            )}

            <div className="lab-form__actions">
                <button
                    type="submit"
                    className="lab-form__save-btn"
                    disabled={saving || selected.length === 0}
                >
                    {saving
                        ? "Placing…"
                        : selected.length > 1
                            ? `Place ${selected.length} orders`
                            : "Place order"}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        className="lab-form__cancel-btn"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}
