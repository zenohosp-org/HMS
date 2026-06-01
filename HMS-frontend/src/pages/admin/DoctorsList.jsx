import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { doctorsApi, staffApi } from "@/utils/api";
import DoctorFormModal from "@/components/modals/DoctorFormModal";
import {
    MoreHorizontal,
    CheckCircle,
    XCircle,
    Trash2,
    Stethoscope,
    Pencil,
    AlertTriangle,
    ExternalLink,
} from "lucide-react";
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

const PAGE_SIZE = 8;

/**
 * Doctors — hospital staff roster scoped to role=DOCTOR. Phase 6a
 * migration: same data layer, same auth gates, same kebab-menu
 * options (Edit / View / Activate-Deactivate / Remove). Inline custom
 * confirm dialog replaced with <Modal> + <Alert>. Avatar / contact
 * cells use inline styles reading --hms-* tokens.
 */
function DoctorsList() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editDoctor, setEditDoctor] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [page, setPage] = useState(1);

    const load = () => {
        if (!user?.hospitalId) return;
        doctorsApi
            .list(user.hospitalId)
            .then(setDoctors)
            .catch(() => notify("Failed to load doctors", "error"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.hospitalId]);

    const handleDelete = async () => {
        if (!confirmRemove) return;
        try {
            await doctorsApi.delete(confirmRemove.id);
            notify("Doctor profile removed", "success");
            load();
        } catch {
            notify("Failed to remove doctor profile", "error");
        } finally {
            setConfirmRemove(null);
        }
    };

    const handleDeactivate = async (userId) => {
        await staffApi.deactivate(userId);
        notify("Account deactivated", "info");
        load();
    };

    const handleActivate = async (userId) => {
        await staffApi.activate(userId);
        notify("Account activated", "success");
        load();
    };

    const filtered = doctors.filter((d) => {
        const q = search.toLowerCase();
        return (
            d.firstName.toLowerCase().includes(q) ||
            (d.lastName ?? "").toLowerCase().includes(q) ||
            (d.email ?? "").toLowerCase().includes(q) ||
            (d.specialization ?? "").toLowerCase().includes(q)
        );
    });

    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

    const renderInitials = (firstName, lastName, size = 40) => {
        const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
        return (
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius: 999,
                    background: "var(--hms-info-bg)",
                    color: "#0369a1",
                    border: "1px solid var(--hms-info-border)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: size <= 40 ? 13 : 16,
                    flexShrink: 0,
                }}
            >
                {initials}
            </div>
        );
    };

    const columns = [
        {
            header: "Doctor",
            width: "28%",
            render: (d) => (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {renderInitials(d.firstName, d.lastName)}
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--hms-gray-900)", fontSize: 14 }}>
                            Dr. {d.firstName} {d.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--hms-gray-500)", marginTop: 2 }}>
                            {d.qualification || "N/A"}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            header: "Specialization",
            width: "16%",
            render: (d) => (
                <span style={{ fontSize: 13, color: "var(--hms-gray-600)" }}>
                    {d.specialization || "General"}
                </span>
            ),
        },
        {
            header: "Contact",
            width: "24%",
            render: (d) => (
                <div>
                    <div style={{ fontSize: 13, color: "var(--hms-gray-600)" }}>{d.email}</div>
                    <div style={{ fontSize: 12, color: "var(--hms-gray-500)", marginTop: 2 }}>
                        {d.phone}
                    </div>
                </div>
            ),
        },
        {
            header: "Status",
            width: "12%",
            render: (d) => (
                <Badge tone={d.userIsActive ? "success" : "danger"} soft>
                    {d.userIsActive ? "Active" : "Inactive"}
                </Badge>
            ),
        },
        {
            header: "",
            width: "8%",
            align: "right",
            render: (d) => (
                <Menu
                    triggerIcon={<MoreHorizontal size={18} />}
                    triggerLabel="Row actions"
                    align="right"
                    items={[
                        {
                            label: "Edit profile",
                            icon: <Pencil size={14} />,
                            onClick: () => setEditDoctor(d),
                        },
                        {
                            label: "View profile",
                            icon: <ExternalLink size={14} />,
                            onClick: () => navigate(`/doctors/${d.id}`),
                        },
                        { divider: true },
                        d.userIsActive
                            ? {
                                label: "Deactivate login",
                                icon: <XCircle size={14} />,
                                onClick: () => handleDeactivate(d.userId),
                            }
                            : {
                                label: "Activate login",
                                icon: <CheckCircle size={14} />,
                                onClick: () => handleActivate(d.userId),
                            },
                        { divider: true },
                        {
                            label: "Remove profile",
                            icon: <Trash2 size={14} />,
                            tone: "danger",
                            onClick: () => setConfirmRemove(d),
                        },
                    ]}
                />
            ),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        Doctors
                        <Badge tone="info">{doctors.length} total</Badge>
                    </span>
                }
                actions={
                    <Button variant="primary" onClick={() => setShowModal(true)}>
                        + Add doctor
                    </Button>
                }
            />

            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ maxWidth: 480 }}>
                    <SearchBar
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            setPage(1);
                        }}
                        placeholder="Search by name, email or specialization…"
                    />
                </div>

                <Table
                    columns={columns}
                    data={paginated}
                    loading={loading}
                    loadingMessage={
                        <span style={{ color: "var(--hms-gray-500)" }}>Loading doctors…</span>
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
                                {search
                                    ? "No doctors match your search."
                                    : "No doctors linked to this hospital."}
                            </div>
                        </div>
                    }
                />

                {!loading && filtered.length > 0 && totalPages > 1 && (
                    <div style={{ paddingTop: 4 }}>
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalItems={filtered.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </div>

            {showModal && (
                <DoctorFormModal
                    onClose={() => setShowModal(false)}
                    onSaved={() => {
                        setShowModal(false);
                        load();
                    }}
                />
            )}

            {editDoctor && (
                <DoctorFormModal
                    editDoctor={editDoctor}
                    onClose={() => setEditDoctor(null)}
                    onSaved={() => {
                        setEditDoctor(null);
                        load();
                    }}
                />
            )}

            <Modal
                isOpen={!!confirmRemove}
                onClose={() => setConfirmRemove(null)}
                size="sm"
                title="Remove doctor profile"
                footer={
                    <>
                        <Button variant="cancel" onClick={() => setConfirmRemove(null)}>
                            Keep profile
                        </Button>
                        <Button variant="danger" onClick={handleDelete}>
                            Remove profile
                        </Button>
                    </>
                }
            >
                <Alert tone="danger" icon={<AlertTriangle size={16} />}>
                    This unlinks the doctor from this hospital. The login account and all
                    clinical records remain intact.
                </Alert>
                {confirmRemove && (
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
                        {renderInitials(confirmRemove.firstName, confirmRemove.lastName)}
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: "var(--hms-gray-900)", fontSize: 14 }}>
                                Dr. {confirmRemove.firstName} {confirmRemove.lastName}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--hms-gray-500)" }}>
                                {confirmRemove.specialization || "General"}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export { DoctorsList as default };
