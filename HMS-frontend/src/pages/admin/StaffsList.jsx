import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { staffApi, doctorsApi } from "@/utils/api";
import StaffFormModal from "@/components/modals/StaffFormModal";
import {
    UserPlus,
    Mail,
    Phone,
    Calendar,
    Users,
    Stethoscope,
    ShieldCheck,
    User,
    MoreVertical,
    Pencil,
    XCircle,
    CheckCircle,
} from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Menu,
    PageHeader,
    SearchBar,
    Tabs,
} from "@/components/ui";

const ROLE_TABS = [
    { id: "all", label: "All" },
    { id: "doctor", label: "Doctors" },
    { id: "admin", label: "Admin" },
    { id: "staff", label: "Staff" },
];

/** Per-role visual mapping for avatar + role badge. */
const ROLE_TONE = {
    doctor: { tone: "info", icon: Stethoscope },
    hospital_admin: { tone: "rose", icon: ShieldCheck },
    staff: { tone: "neutral", icon: User },
};

const getRoleTone = (role) => ROLE_TONE[role] || ROLE_TONE.staff;

function toMemberCard(u) {
    return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        roleDisplay: u.roleDisplay,
        email: u.email,
        phone: u.phone,
        employeeCode: u.employeeCode,
        designation: u.designationName || u.designation,
        designationId: u.designationId,
        departmentId: u.departmentId,
        departmentName: u.departmentName,
        departmentType: u.departmentType,
        dateOfJoining: u.dateOfJoining,
        isActive: u.isActive,
    };
}

function doctorToMemberCard(d) {
    return {
        id: d.userId,
        firstName: d.firstName,
        lastName: d.lastName,
        role: "doctor",
        roleDisplay: "Doctor",
        email: d.email,
        phone: d.phone,
        isActive: d.userIsActive,
        consultationFee: d.consultationFee,
        specialization: d.specialization,
    };
}

/**
 * Staff directory — multi-role roster shown as a responsive card grid.
 * Phase 6b migration: preserves the card layout (not a table) and the
 * derived stats / role-filter / search behaviour. Avatar palette and
 * role badges now use Badge tones (info=doctor, rose=admin, neutral=
 * everyone else).
 */
function StaffsList() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [showModal, setShowModal] = useState(false);
    const [editStaff, setEditStaff] = useState(undefined);

    const load = async () => {
        if (!user?.hospitalId) return;
        setLoading(true);
        try {
            const [allUsers, doctors] = await Promise.all([
                staffApi.list(user.hospitalId),
                doctorsApi.list(user.hospitalId),
            ]);
            const doctorUserIds = new Set(doctors.map((d) => d.userId));
            const nonDoctors = allUsers.filter(
                (u) => !doctorUserIds.has(u.id) && u.role !== "super_admin"
            );
            const doctorCards = doctors.map(doctorToMemberCard);
            const staffCards = nonDoctors.map(toMemberCard);
            setMembers([...doctorCards, ...staffCards]);
        } catch {
            notify("Failed to load directory", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.hospitalId]);

    const filtered = useMemo(() => {
        let list = members;
        if (roleFilter === "doctor") list = list.filter((m) => m.role === "doctor");
        else if (roleFilter === "admin")
            list = list.filter((m) => m.role === "hospital_admin");
        else if (roleFilter === "staff")
            list = list.filter(
                (m) => m.role !== "doctor" && m.role !== "hospital_admin"
            );
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (m) =>
                    `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
                    m.email.toLowerCase().includes(q) ||
                    m.employeeCode?.toLowerCase().includes(q) ||
                    m.designation?.toLowerCase().includes(q) ||
                    m.specialization?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [members, roleFilter, search]);

    const stats = useMemo(
        () => ({
            total: members.length,
            active: members.filter((m) => m.isActive).length,
            doctors: members.filter((m) => m.role === "doctor").length,
            admins: members.filter((m) => m.role === "hospital_admin").length,
        }),
        [members]
    );

    const handleDeactivate = async (id) => {
        if (!confirm("Deactivate this account? They will lose system access.")) return;
        try {
            await staffApi.deactivate(id);
            notify("Account deactivated", "info");
            load();
        } catch {
            notify("Action failed", "error");
        }
    };

    const handleActivate = async (id) => {
        try {
            await staffApi.activate(id);
            notify("Account activated", "success");
            load();
        } catch {
            notify("Action failed", "error");
        }
    };

    const openEdit = (m) => {
        setEditStaff({
            id: m.id,
            email: m.email,
            firstName: m.firstName,
            lastName: m.lastName,
            role: m.role,
            roleDisplay: m.roleDisplay,
            isActive: m.isActive,
            phone: m.phone,
            employeeCode: m.employeeCode,
            designation: m.designation,
            dateOfJoining: m.dateOfJoining,
            specialization: m.specialization ?? undefined,
            department: null,
        });
        setShowModal(true);
    };

    const statCards = [
        { label: "Total staff", value: stats.total, icon: Users, color: "var(--hms-gray-600)" },
        { label: "Active", value: stats.active, icon: UserPlus, color: "var(--hms-success)" },
        { label: "Doctors", value: stats.doctors, icon: Stethoscope, color: "var(--hms-info)" },
        { label: "Admin", value: stats.admins, icon: ShieldCheck, color: "#be123c" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title="Staff directory"
                subtitle={`${stats.total} members · ${stats.active} active`}
                actions={
                    <Button
                        variant="primary"
                        onClick={() => {
                            setEditStaff(undefined);
                            setShowModal(true);
                        }}
                    >
                        <UserPlus size={14} strokeWidth={2.4} /> Add member
                    </Button>
                }
            />

            <div
                style={{
                    padding: "0 24px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                }}
            >
                {/* Stat cards */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 12,
                    }}
                >
                    {statCards.map(({ label, value, icon: Icon, color }) => (
                        <Card key={label}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--hms-gray-400)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                    }}
                                >
                                    {label}
                                </p>
                                <Icon size={16} style={{ color }} />
                            </div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 24,
                                    fontWeight: 800,
                                    color,
                                }}
                            >
                                {value}
                            </p>
                        </Card>
                    ))}
                </div>

                {/* Filter + search row */}
                <Card>
                    <div
                        style={{
                            display: "flex",
                            gap: 12,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        <Tabs
                            type="pill"
                            active={roleFilter}
                            onChange={setRoleFilter}
                            tabs={ROLE_TABS}
                        />
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <SearchBar
                                value={search}
                                onChange={setSearch}
                                placeholder="Search by name, email, code, designation…"
                            />
                        </div>
                    </div>
                </Card>

                {/* Cards grid */}
                {loading ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: 16,
                        }}
                    >
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        opacity: 0.5,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 999,
                                            background: "var(--hms-gray-100)",
                                        }}
                                    />
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                                        <div
                                            style={{
                                                height: 12,
                                                background: "var(--hms-gray-100)",
                                                borderRadius: 4,
                                                width: "75%",
                                            }}
                                        />
                                        <div
                                            style={{
                                                height: 10,
                                                background: "var(--hms-gray-100)",
                                                borderRadius: 4,
                                                width: "50%",
                                            }}
                                        />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <Card>
                        <div
                            style={{
                                padding: 32,
                                textAlign: "center",
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            <Users size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
                            <p style={{ margin: 0, fontSize: 13 }}>No members found</p>
                            {search && (
                                <p
                                    style={{
                                        margin: "4px 0 0",
                                        fontSize: 11,
                                        color: "var(--hms-gray-400)",
                                    }}
                                >
                                    Try clearing your search
                                </p>
                            )}
                        </div>
                    </Card>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: 16,
                        }}
                    >
                        {filtered.map((m) => {
                            const initials = `${m.firstName[0]}${m.lastName?.[0] ?? ""}`.toUpperCase();
                            const { tone, icon: RoleIcon } = getRoleTone(m.role);
                            const avatarBg =
                                tone === "info"
                                    ? "var(--hms-info-bg)"
                                    : tone === "rose"
                                        ? "#fff1f2"
                                        : "var(--hms-gray-100)";
                            const avatarColor =
                                tone === "info"
                                    ? "#0369a1"
                                    : tone === "rose"
                                        ? "#be123c"
                                        : "var(--hms-gray-700)";
                            const avatarBorder =
                                tone === "info"
                                    ? "var(--hms-info-border)"
                                    : tone === "rose"
                                        ? "#fecdd3"
                                        : "var(--hms-gray-200)";
                            return (
                                <Card
                                    key={m.id}
                                    style={{ gap: 14 }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                        }}
                                    >
                                        <div style={{ display: "flex", gap: 12, minWidth: 0, flex: 1 }}>
                                            <div
                                                style={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: 999,
                                                    background: avatarBg,
                                                    color: avatarColor,
                                                    border: `2px solid ${avatarBorder}`,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontWeight: 700,
                                                    fontSize: 14,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {initials}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        color: "var(--hms-gray-900)",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {m.firstName} {m.lastName}
                                                </p>
                                                {m.employeeCode && (
                                                    <p
                                                        style={{
                                                            margin: "2px 0 0",
                                                            fontSize: 10,
                                                            fontFamily:
                                                                "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                            color: "var(--hms-gray-500)",
                                                        }}
                                                    >
                                                        #{m.employeeCode}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Menu
                                            triggerIcon={<MoreVertical size={16} />}
                                            triggerLabel="Member actions"
                                            align="right"
                                            items={[
                                                {
                                                    label: "Edit",
                                                    icon: <Pencil size={14} />,
                                                    onClick: () => openEdit(m),
                                                },
                                                m.isActive
                                                    ? {
                                                        label: "Deactivate",
                                                        icon: <XCircle size={14} />,
                                                        tone: "danger",
                                                        onClick: () => handleDeactivate(m.id),
                                                    }
                                                    : {
                                                        label: "Activate",
                                                        icon: <CheckCircle size={14} />,
                                                        onClick: () => handleActivate(m.id),
                                                    },
                                            ]}
                                        />
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 6,
                                        }}
                                    >
                                        <Badge tone={tone} soft>
                                            <RoleIcon size={10} /> {m.roleDisplay}
                                        </Badge>
                                        {m.specialization && (
                                            <Badge tone="neutral" soft>
                                                {m.specialization}
                                            </Badge>
                                        )}
                                        {!m.isActive && (
                                            <Badge tone="danger" soft>
                                                Inactive
                                            </Badge>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6,
                                            fontSize: 12,
                                            color: "var(--hms-gray-500)",
                                        }}
                                    >
                                        {m.designation && (
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontWeight: 600,
                                                    color: "var(--hms-gray-700)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {m.designation}
                                            </p>
                                        )}
                                        {m.departmentName && (
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 10,
                                                    fontWeight: 500,
                                                    color: "var(--hms-gray-700)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {m.departmentName}
                                            </p>
                                        )}
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                overflow: "hidden",
                                            }}
                                        >
                                            <Mail size={12} style={{ flexShrink: 0 }} />
                                            <span
                                                style={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {m.email}
                                            </span>
                                        </div>
                                        {m.phone && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                }}
                                            >
                                                <Phone size={12} style={{ flexShrink: 0 }} />
                                                <span>{m.phone}</span>
                                            </div>
                                        )}
                                        {m.dateOfJoining && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                }}
                                            >
                                                <Calendar size={12} style={{ flexShrink: 0 }} />
                                                <span>Joined {m.dateOfJoining}</span>
                                            </div>
                                        )}
                                        {m.consultationFee != null && (
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontWeight: 700,
                                                    color: "var(--hms-success)",
                                                }}
                                            >
                                                ₹{m.consultationFee.toLocaleString("en-IN")} / consult
                                            </p>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {showModal && (
                <StaffFormModal
                    editStaff={editStaff}
                    onClose={() => setShowModal(false)}
                    onSaved={() => {
                        setShowModal(false);
                        load();
                    }}
                />
            )}
        </div>
    );
}

export { StaffsList as default };
