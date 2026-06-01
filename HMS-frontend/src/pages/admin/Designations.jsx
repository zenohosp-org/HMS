import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { departmentApi, designationApi } from "@/utils/api";
import { Award, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import {
    Badge,
    Button,
    FormGroup,
    Input,
    Modal,
    PageHeader,
    Table,
    Tabs,
} from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";

const CATEGORIES = ["MEDICAL", "NURSING", "TECHNICAL", "ADMINISTRATIVE", "SUPPORT"];

/** Category → Badge tone. Rose / amber are extra tones added to hms-badge
 *  in this phase so the original colour mapping reads identically. */
const CAT_TONE = {
    MEDICAL: "info",
    NURSING: "rose",
    TECHNICAL: "amber",
    ADMINISTRATIVE: "neutral",
    SUPPORT: "neutral",
};

const PRESETS = {
    MEDICAL: [
        "Senior Consultant",
        "Consultant",
        "Associate Consultant",
        "Senior Resident",
        "Junior Resident",
        "House Surgeon",
        "Registrar",
    ],
    NURSING: [
        "Chief Nursing Officer",
        "Nursing Superintendent",
        "Deputy Nursing Superintendent",
        "Ward Sister",
        "Staff Nurse",
        "Junior Staff Nurse",
        "ANM",
    ],
    TECHNICAL: [
        "Senior Radiographer",
        "Radiographer",
        "Senior Lab Technician",
        "Lab Technician",
        "Lab Assistant",
        "Pharmacist",
        "Senior Pharmacist",
        "Physiotherapist",
        "Dietitian",
    ],
    ADMINISTRATIVE: [
        "Hospital Administrator",
        "Department Manager",
        "Executive",
        "Officer",
        "Coordinator",
        "Receptionist",
        "Medical Records Officer",
        "Billing Executive",
    ],
    SUPPORT: [
        "Senior Attender",
        "Attender",
        "Helper",
        "Security Officer",
        "Housekeeping Supervisor",
        "Housekeeping Staff",
    ],
};

const emptyForm = { name: "", category: "MEDICAL", departmentId: "" };

const titleCase = (s) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * Designations — hospital job-titles taxonomy by category, optionally
 * scoped to a department. Toggle-only row actions (no edit). Phase 5
 * migration preserves the data layer, the department filter dropdown
 * and the preset quick-add behaviour byte-for-byte.
 */
export default function Designations() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [designations, setDesignations] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("MEDICAL");
    const [deptFilter, setDeptFilter] = useState("");

    const load = async () => {
        if (!user?.hospitalId) return;
        try {
            setLoading(true);
            const [desigs, depts] = await Promise.all([
                designationApi.list(user.hospitalId),
                departmentApi.list(user.hospitalId, true),
            ]);
            setDesignations(desigs);
            setDepartments(depts);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.hospitalId]);

    const openCreate = (preset = null) => {
        setForm(
            preset
                ? { name: preset, category: activeTab, departmentId: "" }
                : { ...emptyForm, category: activeTab }
        );
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await designationApi.create({
                hospitalId: user.hospitalId,
                name: form.name,
                category: form.category,
                departmentId: form.departmentId || null,
            });
            notify("Designation created", "success");
            setShowModal(false);
            load();
        } catch (err) {
            notify(err.response?.data?.message || "Failed", "error");
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (d) => {
        try {
            await designationApi.toggle(d.id);
            load();
        } catch {
            notify("Failed", "error");
        }
    };

    const grouped = CATEGORIES.reduce((acc, c) => {
        acc[c] = designations.filter(
            (d) =>
                d.category === c &&
                (!deptFilter || d.departmentId === deptFilter || !d.departmentId)
        );
        return acc;
    }, {});

    const existing = new Set(designations.map((d) => d.name));
    const rows = grouped[activeTab] || [];
    const presetsForTab = (PRESETS[activeTab] || []).filter((p) => !existing.has(p));
    const allPresetsAdded =
        (PRESETS[activeTab] || []).every((p) => existing.has(p));

    const columns = [
        {
            header: "Title",
            width: "36%",
            render: (d) => (
                <span style={{ fontWeight: 600, color: "var(--hms-gray-900)", fontSize: 14 }}>
                    {d.name}
                </span>
            ),
        },
        {
            header: "Category",
            width: "18%",
            render: (d) => (
                <Badge tone={CAT_TONE[d.category] || "neutral"} soft>
                    {titleCase(d.category)}
                </Badge>
            ),
        },
        {
            header: "Department",
            width: "22%",
            render: (d) =>
                d.departmentName ? (
                    <span style={{ fontSize: 13, color: "var(--hms-gray-500)" }}>
                        {d.departmentName}
                    </span>
                ) : (
                    <span style={{ fontSize: 13, color: "var(--hms-gray-300)" }}>
                        Cross-department
                    </span>
                ),
        },
        {
            header: "Status",
            width: "12%",
            render: (d) => (
                <Badge tone={d.isActive ? "success" : "neutral"} soft>
                    {d.isActive ? "Active" : "Inactive"}
                </Badge>
            ),
        },
        {
            header: "",
            width: "12%",
            align: "right",
            render: (d) => (
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
            ),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <Award size={20} /> Designations
                    </span>
                }
                subtitle="Job titles and roles across departments"
                actions={
                    <Button variant="primary" onClick={() => openCreate()}>
                        <Plus size={14} strokeWidth={2.4} /> Add designation
                    </Button>
                }
            />

            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <Tabs
                        type="pill"
                        active={activeTab}
                        onChange={setActiveTab}
                        tabs={CATEGORIES.map((c) => ({
                            id: c,
                            label: titleCase(c),
                            count: grouped[c]?.length ?? 0,
                        }))}
                    />
                    <div style={{ marginLeft: "auto", minWidth: 220 }}>
                        <SearchableSelect
                            value={deptFilter}
                            onChange={(v) => setDeptFilter(v)}
                            options={[
                                { value: "", label: "All departments" },
                                ...departments.map((d) => ({ value: d.id, label: d.name })),
                            ]}
                            placeholder="Filter by department"
                        />
                    </div>
                </div>

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
                            {titleCase(activeTab)} designations
                        </span>
                        <span style={{ fontSize: 12, color: "var(--hms-gray-400)" }}>
                            {rows.length} {rows.length === 1 ? "title" : "titles"}
                        </span>
                    </div>

                    <Table
                        columns={columns}
                        data={rows}
                        loading={loading}
                        loadingMessage="Loading…"
                        emptyMessage="No designations yet. Add from presets below."
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
                            Quick add presets
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {presetsForTab.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => openCreate(p)}
                                    style={presetChipStyle}
                                >
                                    <Plus size={12} /> {p}
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
                title="New designation"
                footer={
                    <>
                        <Button variant="cancel" onClick={() => setShowModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            form="designation-form"
                            loading={saving}
                        >
                            Create
                        </Button>
                    </>
                }
            >
                <form
                    id="designation-form"
                    onSubmit={handleSubmit}
                    style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                    <FormGroup label="Title / designation *">
                        <Input
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Staff Nurse"
                        />
                    </FormGroup>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <FormGroup label="Category *">
                            <SearchableSelect
                                required
                                value={form.category}
                                onChange={(v) => setForm({ ...form, category: v })}
                                options={CATEGORIES.map((c) => ({
                                    value: c,
                                    label: titleCase(c),
                                }))}
                            />
                        </FormGroup>
                        <FormGroup label="Department">
                            <SearchableSelect
                                value={form.departmentId}
                                onChange={(v) => setForm({ ...form, departmentId: v })}
                                options={[
                                    { value: "", label: "Cross-department" },
                                    ...departments.map((d) => ({
                                        value: d.id,
                                        label: d.name,
                                    })),
                                ]}
                            />
                        </FormGroup>
                    </div>
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
