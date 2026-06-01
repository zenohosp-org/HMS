import { useState, useEffect, useMemo } from "react";
import {
    Plus,
    Filter,
    MoreHorizontal,
    Edit2,
    Trash2,
    Power,
    AlertTriangle,
    Settings2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { hospitalServiceApi, specializationApi } from "@/utils/api";
import {
    Alert,
    Badge,
    Button,
    Menu,
    Modal,
    PageHeader,
    Pagination,
    SearchBar,
    Table,
} from "@/components/ui";
import AddServiceModal from "@/components/modals/AddServiceModal";
import ServiceFilters from "@/components/specializations/ServiceFilters";

const PAGE_SIZE = 10;

/**
 * Services — admin metadata list (catalogue + per-hospital pricing).
 *
 * Migrated to hms-* primitives in Phase 4. The data layer, RBAC gate,
 * filter behaviour, pagination math, status-toggle, and delete pipeline
 * are byte-for-byte the same as the pre-migration page; only the
 * presentation has changed.
 *
 * Components still on the legacy stack (out of scope for this phase):
 *   * <ServiceFilters>    — filter popover panel
 *   * <SearchableSelect>  — used inside <AddServiceModal>
 *   * <Pagination>        — page selector
 * These render fine alongside hms-* because Tailwind is still loaded
 * and their classes are namespace-distinct.
 */
function Services() {
    const { user } = useAuth();
    const { notify } = useNotification();

    const [services, setServices] = useState([]);
    const [specializations, setSpecializations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [modal, setModal] = useState({ open: false, service: null });
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        departments: [],
        amountRange: "",
        statuses: [],
    });

    const loadData = async () => {
        if (!user?.hospitalId) return;
        setLoading(true);
        try {
            const [svcData, specData] = await Promise.all([
                hospitalServiceApi.list(user.hospitalId),
                specializationApi.list(user.hospitalId),
            ]);
            setServices(svcData);
            setSpecializations(specData);
        } catch {
            notify("Failed to load services", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.hospitalId]);

    const getSpecName = (id) => specializations.find((s) => s.id === id)?.name || "—";

    const filteredServices = useMemo(() => {
        return services.filter((s) => {
            const specName = getSpecName(s.specializationId);
            const q = search.toLowerCase();
            const matchesSearch =
                s.name.toLowerCase().includes(q) || specName.toLowerCase().includes(q);
            const matchesDept =
                activeFilters.departments.length === 0 ||
                activeFilters.departments.includes(specName);
            const matchesStatus =
                activeFilters.statuses.length === 0 ||
                (activeFilters.statuses.includes("Active") && s.isActive) ||
                (activeFilters.statuses.includes("Inactive") && !s.isActive);
            let matchesPrice = true;
            if (activeFilters.amountRange) {
                const price = s.price;
                if (activeFilters.amountRange === "0-100") matchesPrice = price <= 100;
                else if (activeFilters.amountRange === "101-200")
                    matchesPrice = price > 100 && price <= 200;
                else if (activeFilters.amountRange === "201-500")
                    matchesPrice = price > 200 && price <= 500;
                else if (activeFilters.amountRange === "501+") matchesPrice = price > 500;
            }
            return matchesSearch && matchesDept && matchesStatus && matchesPrice;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [services, search, activeFilters, specializations]);

    const paginated = filteredServices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(filteredServices.length / PAGE_SIZE);

    const handleToggleStatus = async (id) => {
        try {
            await hospitalServiceApi.toggleStatus(id);
            setServices((prev) =>
                prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
            );
            notify("Status updated", "success");
        } catch {
            notify("Failed to toggle status", "error");
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await hospitalServiceApi.delete(confirmDelete.id);
            setServices((prev) => prev.filter((s) => s.id !== confirmDelete.id));
            notify("Service deleted", "success");
        } catch {
            notify("Failed to delete service", "error");
        } finally {
            setConfirmDelete(null);
        }
    };

    const hasActiveFilters =
        activeFilters.departments.length > 0 ||
        !!activeFilters.amountRange ||
        activeFilters.statuses.length > 0;

    const columns = [
        {
            header: "Service name",
            width: "28%",
            render: (s) => (
                <span style={{ fontWeight: 700, color: "var(--hms-gray-900)", fontSize: 14 }}>
                    {s.name}
                </span>
            ),
        },
        {
            header: "Department",
            width: "22%",
            render: (s) => (
                <Badge tone="neutral" soft>
                    {getSpecName(s.specializationId)}
                </Badge>
            ),
        },
        {
            header: "Price",
            width: "14%",
            render: (s) => (
                <span style={{ fontWeight: 700, color: "var(--hms-gray-900)" }}>
                    ₹{s.price}
                </span>
            ),
        },
        {
            header: "GST %",
            width: "12%",
            render: (s) =>
                Number(s.gstRate || 0) > 0 ? (
                    <Badge tone="info" soft>
                        {Number(s.gstRate)}%
                    </Badge>
                ) : (
                    <span style={{ color: "var(--hms-gray-300)" }}>—</span>
                ),
        },
        {
            header: "Status",
            width: "12%",
            render: (s) => (
                <Badge tone={s.isActive ? "success" : "danger"} soft>
                    {s.isActive ? "Active" : "Inactive"}
                </Badge>
            ),
        },
        {
            header: "",
            width: "12%",
            align: "right",
            render: (s) => (
                <Menu
                    triggerIcon={<MoreHorizontal size={18} />}
                    triggerLabel="Row actions"
                    align="right"
                    items={[
                        {
                            label: "Edit service",
                            icon: <Edit2 size={14} />,
                            onClick: () => setModal({ open: true, service: s }),
                        },
                        {
                            label: s.isActive ? "Deactivate" : "Activate",
                            icon: <Power size={14} />,
                            onClick: () => handleToggleStatus(s.id),
                        },
                        { divider: true },
                        {
                            label: "Delete service",
                            icon: <Trash2 size={14} />,
                            tone: "danger",
                            onClick: () => setConfirmDelete(s),
                        },
                    ]}
                />
            ),
        },
    ];

    const titleNode = (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            Services
            <Badge tone="info">{services.length} total</Badge>
        </span>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title={titleNode}
                actions={
                    <Button
                        variant="primary"
                        onClick={() => setModal({ open: true, service: null })}
                    >
                        <Plus size={14} strokeWidth={2.4} /> New service
                    </Button>
                }
            />

            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <SearchBar
                            value={search}
                            onChange={(v) => {
                                setSearch(v);
                                setPage(1);
                            }}
                            placeholder="Search by service name or department…"
                        />
                    </div>
                    <div style={{ position: "relative" }}>
                        <Button
                            variant="secondary"
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            aria-pressed={hasActiveFilters}
                            className={hasActiveFilters ? "active" : ""}
                        >
                            <Filter size={14} /> Filters
                            {hasActiveFilters && (
                                <span
                                    aria-hidden="true"
                                    style={{
                                        display: "inline-block",
                                        width: 6,
                                        height: 6,
                                        borderRadius: 999,
                                        background: "var(--hms-info)",
                                        marginLeft: 2,
                                    }}
                                />
                            )}
                        </Button>
                        <ServiceFilters
                            isOpen={isFilterOpen}
                            onClose={() => setIsFilterOpen(false)}
                            onFilter={(f) => {
                                setActiveFilters(f);
                                setPage(1);
                            }}
                            specializations={specializations}
                        />
                    </div>
                </div>

                <Table
                    columns={columns}
                    data={paginated}
                    loading={loading}
                    loadingMessage={
                        <span style={{ color: "var(--hms-gray-500)" }}>Loading services…</span>
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
                                <Settings2 size={22} />
                            </div>
                            <div style={{ color: "var(--hms-gray-500)", fontSize: 13 }}>
                                {search || hasActiveFilters
                                    ? "No services match your search."
                                    : "No services added yet."}
                            </div>
                        </div>
                    }
                />

                {!loading && filteredServices.length > 0 && totalPages > 1 && (
                    <div style={{ paddingTop: 4 }}>
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalItems={filteredServices.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </div>

            {modal.open && (
                <AddServiceModal
                    isOpen={modal.open}
                    onClose={() => setModal({ open: false, service: null })}
                    service={modal.service}
                    specializations={specializations}
                    onSuccess={loadData}
                />
            )}

            <Modal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                size="sm"
                title="Delete service"
                footer={
                    <>
                        <Button variant="cancel" onClick={() => setConfirmDelete(null)}>
                            Keep service
                        </Button>
                        <Button variant="danger" onClick={handleDelete}>
                            Delete service
                        </Button>
                    </>
                }
            >
                <Alert tone="danger" icon={<AlertTriangle size={16} />}>
                    This will permanently remove the service. Existing invoices referencing it
                    will not be affected.
                </Alert>
                {confirmDelete && (
                    <div
                        style={{
                            marginTop: 16,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: 12,
                            background: "var(--hms-gray-50)",
                            border: "1px solid var(--hms-gray-200)",
                            borderRadius: "var(--hms-radius)",
                        }}
                    >
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 6,
                                background: "var(--hms-gray-100)",
                                color: "var(--hms-gray-500)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Settings2 size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: "var(--hms-gray-900)", fontSize: 14 }}>
                                {confirmDelete.name}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--hms-gray-500)" }}>
                                ₹{confirmDelete.price}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export { Services as default };
