import { useState, useEffect, useMemo } from "react";
import { Plus, MoreHorizontal, Edit, Trash2, Stethoscope } from "lucide-react";
import { format, parseISO } from "date-fns";
import { specializationApi } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
    Badge,
    Button,
    Menu,
    PageHeader,
    SearchBar,
    Table,
} from "@/components/ui";
import AddSpecializationModal from "@/components/modals/AddSpecializationModal";

/**
 * Specializations — admin metadata list.
 *
 * Phase 3 migration: first page swapped end-to-end to the hms-* design
 * system. The data layer, RBAC contract, API surface and modal hand-off
 * are byte-for-byte identical to the pre-migration page; only the
 * presentation (markup + class names) has changed.
 */
function Specializations() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [specializations, setSpecializations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSpec, setEditingSpec] = useState(null);
    const loadData = async () => {
        if (!user?.hospitalId) return;
        setIsLoading(true);
        try {
            const data = await specializationApi.list(user.hospitalId);
            setSpecializations(data);
        } catch {
            notify("Failed to load specializations", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const filteredSpecs = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return specializations.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.description?.toLowerCase().includes(q)
        );
    }, [specializations, searchQuery]);

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this specialization?")) return;
        try {
            await specializationApi.delete(id);
            notify("Specialization deleted", "success");
            loadData();
        } catch {
            notify("Failed to delete specialization", "error");
        }
    };

    const openAdd = () => {
        setEditingSpec(null);
        setIsModalOpen(true);
    };

    const openEdit = (spec) => {
        setEditingSpec(spec);
        setIsModalOpen(true);
    };

    const columns = [
        {
            header: "Specialization",
            width: "40%",
            render: (spec) => (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 999,
                            background: "var(--hms-gray-100)",
                            color: "var(--hms-gray-500)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Stethoscope size={18} strokeWidth={2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--hms-gray-900)", fontSize: 14 }}>
                            {spec.name}
                        </div>
                        {spec.description && (
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--hms-gray-500)",
                                    marginTop: 2,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 280,
                                }}
                                title={spec.description}
                            >
                                {spec.description}
                            </div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            header: "Created date",
            width: "22%",
            render: (spec) => format(parseISO(spec.createdAt), "dd MMM yyyy"),
        },
        {
            header: "No. of doctors",
            width: "20%",
            align: "right",
            render: (spec) => (
                <span style={{ fontWeight: 700, color: "var(--hms-gray-700)" }}>
                    {spec.noOfDoctor}
                </span>
            ),
        },
        {
            header: "",
            width: "18%",
            align: "right",
            render: (spec) => (
                <Menu
                    triggerIcon={<MoreHorizontal size={18} />}
                    triggerLabel="Row actions"
                    align="right"
                    items={[
                        {
                            label: "Edit details",
                            icon: <Edit size={14} />,
                            onClick: () => openEdit(spec),
                        },
                        { divider: true },
                        {
                            label: "Delete",
                            icon: <Trash2 size={14} />,
                            tone: "danger",
                            onClick: () => handleDelete(spec.id),
                        },
                    ]}
                />
            ),
        },
    ];

    const titleNode = (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            Specializations
            <Badge tone="success">Total: {specializations.length}</Badge>
        </span>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title={titleNode}
                actions={
                    <Button variant="primary" onClick={openAdd}>
                        <Plus size={14} strokeWidth={2.4} />
                        Add new specialization
                    </Button>
                }
            />

            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ maxWidth: 480 }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search by name or description…"
                    />
                </div>

                <Table
                    columns={columns}
                    data={filteredSpecs}
                    loading={isLoading}
                    loadingMessage={
                        <span style={{ color: "var(--hms-gray-500)" }}>Loading specializations…</span>
                    }
                    emptyMessage={
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 10,
                                padding: "16px 0",
                            }}
                        >
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 999,
                                    background: "var(--hms-gray-100)",
                                    color: "var(--hms-gray-400)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Stethoscope size={22} />
                            </div>
                            <div style={{ color: "var(--hms-gray-500)", fontSize: 13 }}>
                                {searchQuery
                                    ? "No specializations match your search."
                                    : "No specializations yet. Add the first one to get started."}
                            </div>
                        </div>
                    }
                />
            </div>

            <AddSpecializationModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingSpec(null);
                }}
                onSuccess={loadData}
                initialData={editingSpec}
            />
        </div>
    );
}

export { Specializations as default };
