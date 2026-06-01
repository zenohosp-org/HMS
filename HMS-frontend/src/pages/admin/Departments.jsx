import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { departmentApi } from "@/utils/api";
import {
    Building2,
    Plus,
    ToggleLeft,
    ToggleRight,
    Pencil,
} from "lucide-react";
import {
    Badge,
    Button,
    FormGroup,
    Input,
    Modal,
    PageHeader,
    Table,
    Tabs,
    Textarea,
} from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";

const DEPT_TYPES = ["CLINICAL", "SUPPORT", "ADMINISTRATIVE"];

/** Type → Badge tone — matches the original blue/green/gray palette. */
const TYPE_TONE = {
    CLINICAL: "info",
    SUPPORT: "success",
    ADMINISTRATIVE: "neutral",
};

const PRESETS = {
    CLINICAL: [
        { name: "Medicine", code: "MED" },
        { name: "Surgery", code: "SUR" },
        { name: "Pediatrics", code: "PED" },
        { name: "OB/Gynecology", code: "OBG" },
        { name: "Orthopedics", code: "ORT" },
        { name: "Cardiology", code: "CAR" },
        { name: "Neurology", code: "NEU" },
        { name: "Oncology", code: "ONC" },
        { name: "Anesthesia", code: "ANE" },
        { name: "ENT", code: "ENT" },
        { name: "Ophthalmology", code: "OPH" },
        { name: "Emergency & Trauma", code: "EMR" },
        { name: "Psychiatry", code: "PSY" },
        { name: "Dermatology", code: "DER" },
        { name: "Nephrology", code: "NEP" },
        { name: "Pulmonology", code: "PUL" },
    ],
    SUPPORT: [
        { name: "Nursing", code: "NUR" },
        { name: "Pharmacy", code: "PHA" },
        { name: "Laboratory", code: "LAB" },
        { name: "Radiology", code: "RAD" },
        { name: "Physiotherapy", code: "PHY" },
        { name: "Dietary & Nutrition", code: "DIT" },
        { name: "CSSD", code: "CSS" },
        { name: "Blood Bank", code: "BBK" },
        { name: "Biomedical Engineering", code: "BME" },
    ],
    ADMINISTRATIVE: [
        { name: "Administration", code: "ADM" },
        { name: "Human Resources", code: "HRD" },
        { name: "Finance", code: "FIN" },
        { name: "Information Technology", code: "ITE" },
        { name: "Medical Records", code: "MRD" },
        { name: "Housekeeping", code: "HKP" },
        { name: "Security", code: "SEC" },
    ],
};

const emptyForm = { name: "", type: "CLINICAL", code: "", description: "" };

const titleCase = (s) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * Departments — hospital taxonomy: types (Clinical / Support /
 * Administrative), pill-tab navigation, preset quick-adds, inline
 * create+edit modal.
 *
 * Phase 5 migration: same data layer, same RBAC, same toggle / create
 * / update API calls. Presentation now driven entirely by hms-*
 * primitives. <SearchableSelect> stays in the modal as a legacy
 * combobox (one place to fix later).
 */
export default function Departments() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("CLINICAL");

    const load = async () => {
        if (!user?.hospitalId) return;
        try {
            setLoading(true);
            setDepartments(await departmentApi.list(user.hospitalId));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.hospitalId]);

    const openCreate = (preset = null) => {
        setEditing(null);
        setForm(
            preset
                ? { name: preset.name, type: activeTab, code: preset.code, description: "" }
                : { ...emptyForm, type: activeTab }
        );
        setShowModal(true);
    };

    const openEdit = (dept) => {
        setEditing(dept);
        setForm({
            name: dept.name,
            type: dept.type,
            code: dept.code || "",
            description: dept.description || "",
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) {
                await departmentApi.update(editing.id, { ...form, hospitalId: user.hospitalId });
                notify("Department updated", "success");
            } else {
                await departmentApi.create({ ...form, hospitalId: user.hospitalId });
                notify("Department created", "success");
            }
            setShowModal(false);
            load();
        } catch (err) {
            notify(err.response?.data?.message || "Failed", "error");
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (dept) => {
        try {
            await departmentApi.toggle(dept.id);
            load();
        } catch {
            notify("Failed to update", "error");
        }
    };

    const grouped = DEPT_TYPES.reduce((acc, t) => {
        acc[t] = departments.filter((d) => d.type === t);
        return acc;
    }, {});

    const existing = new Set(departments.map((d) => d.name));
    const rows = grouped[activeTab] || [];
    const presetsForTab = (PRESETS[activeTab] || []).filter((p) => !existing.has(p.name));
    const allPresetsAdded =
        (PRESETS[activeTab] || []).every((p) => existing.has(p.name));

    const columns = [
        {
            header: "Department",
            width: "30%",
            render: (d) => (
                <span style={{ fontWeight: 600, color: "var(--hms-gray-900)", fontSize: 14 }}>
                    {d.name}
                </span>
            ),
        },
        {
            header: "Code",
            width: "14%",
            render: (d) =>
                d.code ? (
                    <span
                        style={{
                            padding: "2px 8px",
                            background: "var(--hms-gray-100)",
                            color: "var(--hms-gray-600)",
                            borderRadius: 6,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: 12,
                        }}
                    >
                        {d.code}
                    </span>
                ) : (
                    <span style={{ color: "var(--hms-gray-300)" }}>—</span>
                ),
        },
        {
            header: "Type",
            width: "18%",
            render: (d) => (
                <Badge tone={TYPE_TONE[d.type] || "neutral"} soft>
                    {titleCase(d.type)}
                </Badge>
            ),
        },
        {
            header: "Status",
            width: "14%",
            render: (d) => (
                <Badge tone={d.isActive ? "success" : "neutral"} soft>
                    {d.isActive ? "Active" : "Inactive"}
                </Badge>
            ),
        },
        {
            header: "",
            width: "16%",
            align: "right",
            render: (d) => (
                <div style={{ display: "inline-flex", gap: 4 }}>
                    <button
                        type="button"
                        className="hms-btn-icon"
                        aria-label="Edit department"
                        onClick={() => openEdit(d)}
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        type="button"
                        className="hms-btn-icon"
                        aria-label={d.isActive ? "Deactivate" : "Activate"}
                        onClick={() => toggle(d)}
                    >
                        {d.isActive ? (
                            <ToggleRight size={16} style={{ color: "var(--hms-success)" }} />
                        ) : (
                            <ToggleLeft size={16} />
                        )}
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <Building2 size={20} /> Departments
                    </span>
                }
                subtitle="Manage hospital departments and wings"
                actions={
                    <Button variant="primary" onClick={() => openCreate()}>
                        <Plus size={14} strokeWidth={2.4} /> Add department
                    </Button>
                }
            />

            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <Tabs
                    type="pill"
                    active={activeTab}
                    onChange={setActiveTab}
                    tabs={DEPT_TYPES.map((t) => ({
                        id: t,
                        label: titleCase(t),
                        count: grouped[t]?.length ?? 0,
                    }))}
                />

                <div
                    style={{
                        background: "var(--hms-white)",
                        border: "1px solid var(--hms-gray-200)",
                        borderRadius: "var(--hms-radius)",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            padding: "16px 20px",
                            borderBottom: "1px solid var(--hms-gray-100)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span style={{ fontWeight: 600, color: "var(--hms-gray-800)" }}>
                            {titleCase(activeTab)} departments
                        </span>
                        <span style={{ fontSize: 12, color: "var(--hms-gray-400)" }}>
                            {rows.length} {rows.length === 1 ? "department" : "departments"}
                        </span>
                    </div>

                    <Table
                        columns={columns}
                        data={rows}
                        loading={loading}
                        loadingMessage="Loading…"
                        emptyMessage="No departments yet. Add from presets below or create custom."
                        className="hms-table-wrapper--inset"
                    />

                    <div
                        style={{
                            borderTop: "1px solid var(--hms-gray-100)",
                            padding: 20,
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--hms-gray-400)",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginBottom: 12,
                            }}
                        >
                            Quick add from presets
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {presetsForTab.map((p) => (
                                <button
                                    key={p.name}
                                    type="button"
                                    onClick={() => openCreate(p)}
                                    style={presetChipStyle}
                                >
                                    <Plus size={12} /> {p.name}
                                </button>
                            ))}
                            {allPresetsAdded && (
                                <span style={{ fontSize: 12, color: "var(--hms-gray-400)" }}>
                                    All presets added
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                size="md"
                title={editing ? "Edit department" : "New department"}
                footer={
                    <>
                        <Button variant="cancel" onClick={() => setShowModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            form="department-form"
                            loading={saving}
                        >
                            {editing ? "Update" : "Create"}
                        </Button>
                    </>
                }
            >
                <form
                    id="department-form"
                    onSubmit={handleSubmit}
                    style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                    <FormGroup label="Department name *">
                        <Input
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Cardiology"
                        />
                    </FormGroup>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <FormGroup label="Type *">
                            <SearchableSelect
                                required
                                value={form.type}
                                onChange={(v) => setForm({ ...form, type: v })}
                                options={[
                                    { value: "CLINICAL", label: "Clinical" },
                                    { value: "SUPPORT", label: "Support" },
                                    { value: "ADMINISTRATIVE", label: "Administrative" },
                                ]}
                            />
                        </FormGroup>
                        <FormGroup label="Code">
                            <Input
                                value={form.code}
                                onChange={(e) =>
                                    setForm({ ...form, code: e.target.value.toUpperCase() })
                                }
                                placeholder="e.g. CAR"
                                maxLength={10}
                            />
                        </FormGroup>
                    </div>

                    <FormGroup label="Description">
                        <Textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                            placeholder="Optional description"
                        />
                    </FormGroup>
                </form>
            </Modal>
        </div>
    );
}

const presetChipStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px dashed var(--hms-gray-300)",
    background: "transparent",
    color: "var(--hms-gray-500)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--hms-font-family)",
    transition: "border-color 0.15s, color 0.15s",
};
