import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api, { infrastructureApi } from "@/utils/api";
import {
    Bed,
    CalendarClock,
    MoreHorizontal,
    ScrollText,
    Building2,
    Layers,
    LayoutGrid,
    ChevronDown,
    ChevronRight,
    Stethoscope,
    AlertCircle,
    User,
    X,
    ChevronsUpDown,
    Link2Off,
} from "lucide-react";
import { formatDateTime } from "@/utils/validators";
import { fmtId } from "@/utils/idFormat";
import AssignAttenderModal from "./AssignAttenderModal";
import RoomDetailPanel from "./RoomDetailPanel";
import {
    Badge,
    Button,
    Card,
    Menu,
    SearchBar,
} from "@/components/ui";

/** Room status visual tone — dot colour + accent strip + icon tint. */
const STATUS_ACCENT = {
    AVAILABLE: "var(--hms-success)",
    OCCUPIED: "var(--hms-info)",
};
const STATUS_ICON_BG = {
    AVAILABLE: "var(--hms-success-bg)",
    OCCUPIED: "var(--hms-info-bg)",
};
const STATUS_ICON_COLOR = {
    AVAILABLE: "var(--hms-success)",
    OCCUPIED: "#0369a1",
};
const STATUS_TEXT_COLOR = {
    AVAILABLE: "var(--hms-success)",
    OCCUPIED: "var(--hms-info)",
};

const TYPE_TONE = {
    ICU: "rose",
    OT: "amber",
};

const normalizeKey = (v) => v?.toString()?.trim()?.toLowerCase() || "";

/** Compact dot+label status chip used in card headers. */
function StatusChip({ status }) {
    const color = STATUS_ACCENT[status] || "var(--hms-gray-300)";
    const textColor = STATUS_TEXT_COLOR[status] || "var(--hms-gray-400)";
    return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <div
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: color,
                }}
            />
            <span
                style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: textColor,
                }}
            >
                {status ?? "Not Set"}
            </span>
        </div>
    );
}

/** Occupancy fill bar — green / amber / red by percentage. */
function OccupancyBar({ occupied, total, size = "md" }) {
    const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
    const fill =
        pct >= 85
            ? "var(--hms-danger)"
            : pct >= 60
                ? "var(--hms-warning)"
                : pct > 0
                    ? "var(--hms-success)"
                    : "var(--hms-gray-300)";
    const h = size === "sm" ? 4 : size === "lg" ? 10 : 6;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div
                style={{
                    flex: 1,
                    background: "var(--hms-gray-100)",
                    borderRadius: 999,
                    height: h,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        background: fill,
                        width: `${pct}%`,
                        transition: "width 0.2s",
                    }}
                />
            </div>
            <span
                style={{
                    fontSize: 10,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--hms-gray-500)",
                    flexShrink: 0,
                    fontWeight: 600,
                }}
            >
                {occupied}/{total}
            </span>
        </div>
    );
}

function RoomMenu({ room, onView, onAttender, alwaysVisible = false }) {
    const isMultiBed = room.bedCount != null && room.bedCount > 1;
    const items = [
        {
            label: isMultiBed ? "View beds" : "View details",
            icon: <ChevronsUpDown size={14} />,
            onClick: () => onView(room),
        },
    ];
    if (room.status === "OCCUPIED" && !isMultiBed) {
        items.push({
            label: room.attenderName ? "Edit attender" : "Assign attender",
            icon: <User size={14} />,
            onClick: () => onAttender(room),
        });
    }
    return (
        <div style={{ opacity: alwaysVisible ? 1 : undefined }}>
            <Menu
                triggerIcon={<MoreHorizontal size={16} />}
                triggerLabel="Room actions"
                align="right"
                items={items}
            />
        </div>
    );
}

/** Room card used inside the infrastructure tree. */
function InfrastructureRoomCard({ roomInfo, roomData, isSelected, onSelect, onView, onAttender }) {
    const isMultiBed = roomData?.bedCount != null && roomData.bedCount > 1;
    const status = roomData?.status;
    const roomType = roomData?.roomType ?? roomInfo.roomType ?? "GENERAL";
    const accent = !roomData
        ? "var(--hms-gray-300)"
        : STATUS_ACCENT[status] || "var(--hms-gray-300)";

    return (
        <div
            onClick={() => roomData && onSelect(roomData)}
            style={{
                position: "relative",
                overflow: "hidden",
                background: "var(--hms-white)",
                border: `1px solid ${isSelected ? "#60a5fa" : "var(--hms-gray-200)"}`,
                borderRadius: 8,
                padding: "12px 12px 12px 14px",
                cursor: roomData ? "pointer" : "default",
                opacity: roomData ? 1 : 0.6,
                boxShadow: isSelected ? "0 0 0 2px rgba(59, 130, 246, 0.1)" : "none",
                transition: "all 0.15s",
                fontFamily: "var(--hms-font-family)",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: accent,
                }}
            />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: STATUS_ICON_BG[status] || "var(--hms-gray-50)",
                        color: STATUS_ICON_COLOR[status] || "var(--hms-gray-400)",
                        border: `1px solid ${status ? "transparent" : "var(--hms-gray-100)"}`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <Bed size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1 }}>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--hms-gray-900)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {roomInfo.name}
                        </p>
                        {roomData?.roomCode && (
                            <span
                                style={{
                                    fontSize: 10,
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    color: "var(--hms-gray-400)",
                                }}
                            >
                                {fmtId(roomData.roomCode)}
                            </span>
                        )}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 6,
                            flexWrap: "wrap",
                        }}
                    >
                        <Badge tone={TYPE_TONE[roomType] || "neutral"} soft>
                            {roomType}
                        </Badge>
                        {isMultiBed && (
                            <Badge tone="violet" soft>
                                {roomData.bedCount} beds
                            </Badge>
                        )}
                        <StatusChip status={status} />
                    </div>
                </div>
                {roomData && (
                    <div onClick={(e) => e.stopPropagation()}>
                        <RoomMenu room={roomData} onView={onView} onAttender={onAttender} />
                    </div>
                )}
            </div>

            {roomData && status === "OCCUPIED" && roomData.currentPatient && !isMultiBed && (
                <div
                    style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: "1px dashed var(--hms-gray-200)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <User size={12} style={{ color: "var(--hms-gray-400)", flexShrink: 0 }} />
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--hms-gray-800)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {roomData.currentPatient.firstName} {roomData.currentPatient.lastName}
                        </span>
                        <span
                            style={{
                                fontSize: 10,
                                color: "var(--hms-gray-400)",
                                flexShrink: 0,
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}
                        >
                            {fmtId(roomData.currentPatient.uhid)}
                        </span>
                    </div>
                    {roomData.attenderName ? (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 6,
                                paddingLeft: 16,
                                minWidth: 0,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 9,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    color: "var(--hms-gray-400)",
                                    flexShrink: 0,
                                }}
                            >
                                Attender
                            </span>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: "var(--hms-gray-600)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {roomData.attenderName}
                                {roomData.attenderRelationship && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: "var(--hms-gray-400)",
                                            marginLeft: 4,
                                        }}
                                    >
                                        ({roomData.attenderRelationship})
                                    </span>
                                )}
                            </span>
                        </div>
                    ) : (
                        <div style={{ paddingLeft: 16 }}>
                            <span
                                style={{
                                    fontSize: 9,
                                    color: "var(--hms-warning)",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                }}
                            >
                                No attender
                            </span>
                        </div>
                    )}
                </div>
            )}
            {roomData && isMultiBed && (
                <p
                    style={{
                        margin: "8px 0 0",
                        fontSize: 10,
                        color: "var(--hms-gray-400)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                    }}
                >
                    Open panel to view beds →
                </p>
            )}
            {!roomData && (
                <p
                    style={{
                        margin: "8px 0 0",
                        fontSize: 10,
                        color: "var(--hms-gray-400)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                    }}
                >
                    Not provisioned
                </p>
            )}
        </div>
    );
}

function SectionLabel({ icon: Icon, label, count, onDark }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: onDark ? "rgba(255, 255, 255, 0.55)" : "var(--hms-gray-400)",
            }}
        >
            <Icon size={12} />
            <span
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                }}
            >
                {label}
            </span>
            {count != null && (
                <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    · {count}
                </span>
            )}
        </div>
    );
}

function StatCell({ label, value, dotColor, sub }) {
    return (
        <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {dotColor && (
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: dotColor,
                        }}
                    />
                )}
                <p
                    style={{
                        margin: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "var(--hms-gray-500)",
                    }}
                >
                    {label}
                </p>
            </div>
            <p
                style={{
                    margin: "8px 0 0",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--hms-gray-900)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                }}
            >
                {value}
            </p>
            {sub && (
                <p
                    style={{
                        margin: "8px 0 0",
                        fontSize: 11,
                        color: "var(--hms-gray-500)",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {sub}
                </p>
            )}
        </div>
    );
}

/**
 * Rooms allocation — building → floor → ward → room infrastructure tree
 * with selection-driven RoomDetailPanel sidebar. Phase 9 migration:
 * data layer untouched (api.get('/rooms'), infrastructureApi.get),
 * collapsed-floor / collapsed-ward state preserved, action menu now
 * uses the design-system Menu primitive.
 */
function Rooms() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showAttenderModal, setShowAttenderModal] = useState({ open: false, room: null });
    const [infrastructure, setInfrastructure] = useState([]);
    const [collapsedFloors, setCollapsedFloors] = useState(new Set());
    const [collapsedWards, setCollapsedWards] = useState(new Set());

    const toggleFloor = (key) =>
        setCollapsedFloors((prev) => {
            const n = new Set(prev);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });
    const toggleWard = (key) =>
        setCollapsedWards((prev) => {
            const n = new Set(prev);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });

    const fetchRooms = async () => {
        try {
            const { data } = await api.get(`/rooms?hospitalId=${user?.hospitalId}`);
            setRooms(data);
        } catch (e) {
            console.error("Failed to fetch rooms", e);
        }
    };

    const fetchInfrastructure = async () => {
        try {
            const data = await infrastructureApi.get(user.hospitalId);
            setInfrastructure(data || []);
        } catch {
            setInfrastructure([]);
        }
    };

    useEffect(() => {
        if (!user?.hospitalId) return;
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchRooms(), fetchInfrastructure()]);
            setLoading(false);
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.hospitalId]);

    useEffect(() => {
        if (selectedRoom) {
            const updated = rooms.find((r) => r.id === selectedRoom.id);
            if (updated) setSelectedRoom(updated);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && search) setSearch("");
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [search]);

    const roomMap = useMemo(
        () => new Map(rooms.map((r) => [normalizeKey(r.roomNumber), r])),
        [rooms]
    );

    const infrastructureRoomKeys = useMemo(() => {
        const keys = new Set();
        infrastructure.forEach((b) =>
            (b.floors || []).forEach((f) =>
                (f.wards || []).forEach((w) =>
                    (w.rooms || []).forEach((r) => keys.add(normalizeKey(r.name)))
                )
            )
        );
        return keys;
    }, [infrastructure]);

    const matchesSearch = (room, q) => {
        if (!q) return true;
        if (room?.roomNumber?.toLowerCase().includes(q)) return true;
        if (room?.currentPatient)
            return [
                room.currentPatient.firstName,
                room.currentPatient.lastName,
                room.currentPatient.uhid,
            ].some((v) => v?.toLowerCase().includes(q));
        return false;
    };

    const filteredRooms = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rooms
            .filter((r) => {
                if (filter === "AVAILABLE" && r.status !== "AVAILABLE") return false;
                if (filter === "OCCUPIED" && r.status !== "OCCUPIED") return false;
                return matchesSearch(r, q);
            })
            .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
    }, [rooms, filter, search]);

    const filteredInfrastructure = useMemo(() => {
        const q = search.trim().toLowerCase();
        return infrastructure
            .map((building) => ({
                ...building,
                floors: (building.floors || [])
                    .map((floor) => ({
                        ...floor,
                        wards: (floor.wards || [])
                            .map((ward) => ({
                                ...ward,
                                rooms: (ward.rooms || [])
                                    .map((room) => ({
                                        ...room,
                                        roomData: roomMap.get(normalizeKey(room.name)),
                                    }))
                                    .filter((room) => {
                                        if (
                                            filter === "AVAILABLE" &&
                                            room.roomData?.status !== "AVAILABLE"
                                        )
                                            return false;
                                        if (
                                            filter === "OCCUPIED" &&
                                            room.roomData?.status !== "OCCUPIED"
                                        )
                                            return false;
                                        return (
                                            !q ||
                                            room.name?.toLowerCase().includes(q) ||
                                            matchesSearch(room.roomData, q)
                                        );
                                    }),
                            }))
                            .filter((w) => w.rooms.length > 0),
                    }))
                    .filter((f) => f.wards.length > 0),
            }))
            .filter((b) => b.floors.length > 0);
    }, [infrastructure, roomMap, filter, search]);

    const unmappedRooms = useMemo(
        () =>
            filteredRooms.filter(
                (r) => !infrastructureRoomKeys.has(normalizeKey(r.roomNumber))
            ),
        [filteredRooms, infrastructureRoomKeys]
    );

    const showInfrastructureView = infrastructure.length > 0;
    const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
    const occupiedCount = rooms.filter((r) => r.status === "OCCUPIED").length;
    const icuAvailable = rooms.filter((r) => r.roomType === "ICU" && r.status === "AVAILABLE").length;
    const icuOccupied = rooms.filter((r) => r.roomType === "ICU" && r.status === "OCCUPIED").length;
    const otAvailable = rooms.filter((r) => r.roomType === "OT" && r.status === "AVAILABLE").length;
    const otOccupied = rooms.filter((r) => r.roomType === "OT" && r.status === "OCCUPIED").length;

    const totalBuildings = infrastructure.length;
    const totalFloors = infrastructure.reduce((s, b) => s + (b.floors?.length || 0), 0);

    const cardProps = (roomData) => ({
        isSelected: selectedRoom?.id === roomData?.id,
        onSelect: (r) => setSelectedRoom((prev) => (prev?.id === r.id ? null : r)),
        onView: (r) => setSelectedRoom(r),
        onAttender: (r) => setShowAttenderModal({ open: true, room: r }),
    });

    const roomGridStyle = {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header — dark gradient banner */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        padding: 20,
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                background: "var(--hms-brand-primary)",
                                color: "var(--hms-white)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Stethoscope size={20} />
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                                <h1
                                    style={{
                                        margin: 0,
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: "var(--hms-gray-900)",
                                        letterSpacing: "-0.02em",
                                    }}
                                >
                                    Room allocation
                                </h1>
                                <span
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: "var(--hms-gray-400)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.1em",
                                    }}
                                >
                                    Infrastructure
                                </span>
                            </div>
                            <p
                                style={{
                                    margin: "4px 0 0",
                                    fontSize: 12,
                                    color: "var(--hms-gray-500)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    flexWrap: "wrap",
                                }}
                            >
                                <span
                                    style={{
                                        fontVariantNumeric: "tabular-nums",
                                        fontWeight: 600,
                                        color: "var(--hms-gray-700)",
                                    }}
                                >
                                    {rooms.length}
                                </span>
                                <span>rooms</span>
                                {showInfrastructureView && (
                                    <>
                                        <span style={{ color: "var(--hms-gray-300)" }}>·</span>
                                        <span
                                            style={{
                                                fontVariantNumeric: "tabular-nums",
                                                fontWeight: 600,
                                                color: "var(--hms-gray-700)",
                                            }}
                                        >
                                            {totalBuildings}
                                        </span>
                                        <span>
                                            {totalBuildings === 1 ? "building" : "buildings"}
                                        </span>
                                        <span style={{ color: "var(--hms-gray-300)" }}>·</span>
                                        <span
                                            style={{
                                                fontVariantNumeric: "tabular-nums",
                                                fontWeight: 600,
                                                color: "var(--hms-gray-700)",
                                            }}
                                        >
                                            {totalFloors}
                                        </span>
                                        <span>{totalFloors === 1 ? "floor" : "floors"}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <Button variant="secondary" onClick={() => navigate("/rooms/logs")}>
                        <ScrollText size={14} /> Logs
                    </Button>
                </div>
            </Card>

            {/* Stats strip */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    }}
                >
                    {[
                        { label: "Total rooms", value: rooms.length },
                        { label: "Available", value: availableCount, dotColor: "var(--hms-success)" },
                        { label: "Occupied", value: occupiedCount, dotColor: "var(--hms-info)" },
                        {
                            label: "ICU",
                            value: icuOccupied + icuAvailable,
                            sub: `${icuOccupied} in use · ${icuAvailable} free`,
                        },
                        {
                            label: "OT",
                            value: otOccupied + otAvailable,
                            sub: `${otOccupied} in use · ${otAvailable} free`,
                        },
                    ].map((s, i) => (
                        <div
                            key={s.label}
                            style={{ borderLeft: i === 0 ? "none" : "1px solid var(--hms-gray-200)" }}
                        >
                            <StatCell {...s} />
                        </div>
                    ))}
                </div>
            </Card>

            {/* Controls */}
            <Card style={{ padding: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <div
                    style={{
                        background: "var(--hms-gray-100)",
                        borderRadius: 8,
                        padding: 4,
                        display: "flex",
                        gap: 4,
                        flexShrink: 0,
                    }}
                >
                    {["ALL", "AVAILABLE", "OCCUPIED"].map((f) => {
                        const active = filter === f;
                        return (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    background: active ? "var(--hms-white)" : "transparent",
                                    color: active
                                        ? "var(--hms-gray-900)"
                                        : "var(--hms-gray-500)",
                                    boxShadow: active ? "var(--hms-shadow-xs)" : "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontFamily: "var(--hms-font-family)",
                                    transition: "all 0.15s",
                                }}
                            >
                                {f}
                            </button>
                        );
                    })}
                </div>

                <div style={{ flex: 1 }}>
                    <SearchBar
                        value={search}
                        onChange={setSearch}
                        placeholder="Search rooms, patients, UHID…"
                    />
                </div>
            </Card>

            {/* Content */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {loading ? (
                        <Card style={{ padding: 64, alignItems: "center", gap: 12 }}>
                            <span
                                style={{
                                    position: "relative",
                                    display: "inline-flex",
                                    width: 8,
                                    height: 8,
                                }}
                            >
                                <span
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        borderRadius: 999,
                                        background: "var(--hms-info)",
                                        opacity: 0.75,
                                        animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
                                    }}
                                />
                                <span
                                    style={{
                                        position: "relative",
                                        width: 8,
                                        height: 8,
                                        borderRadius: 999,
                                        background: "var(--hms-info)",
                                    }}
                                />
                            </span>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    color: "var(--hms-gray-500)",
                                }}
                            >
                                Loading infrastructure
                            </span>
                        </Card>
                    ) : showInfrastructureView ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {filteredInfrastructure.map((building, bIdx) => {
                                const bRooms = building.floors.flatMap((f) =>
                                    f.wards.flatMap((w) =>
                                        w.rooms.map((r) => r.roomData).filter(Boolean)
                                    )
                                );
                                const bOcc = bRooms.filter((r) => r.status === "OCCUPIED").length;
                                const bldgCode = `BLDG-${String(bIdx + 1).padStart(2, "0")}`;
                                return (
                                    <div
                                        key={building.id ?? bIdx}
                                        style={{
                                            borderRadius: 12,
                                            border: "1px solid var(--hms-gray-200)",
                                            background: "var(--hms-white)",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {/* Building header */}
                                        <div
                                            style={{
                                                padding: "12px 16px",
                                                background:
                                                    "linear-gradient(90deg, var(--hms-gray-900), var(--hms-gray-800))",
                                                borderBottom: "1px solid var(--hms-gray-700)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 16,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 12,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 6,
                                                            background: "rgba(255, 255, 255, 0.1)",
                                                            backdropFilter: "blur(4px)",
                                                            color: "var(--hms-white)",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <Building2 size={16} />
                                                    </div>
                                                    <div>
                                                        <p
                                                            style={{
                                                                margin: 0,
                                                                fontSize: 13,
                                                                fontWeight: 700,
                                                                color: "var(--hms-white)",
                                                                letterSpacing: "-0.02em",
                                                            }}
                                                        >
                                                            {building.name || `Building ${bIdx + 1}`}
                                                        </p>
                                                        <p
                                                            style={{
                                                                margin: "2px 0 0",
                                                                fontSize: 10,
                                                                fontFamily:
                                                                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                                textTransform: "uppercase",
                                                                letterSpacing: "0.1em",
                                                                color: "rgba(255, 255, 255, 0.4)",
                                                            }}
                                                        >
                                                            {bldgCode}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 16,
                                                    }}
                                                >
                                                    <SectionLabel
                                                        icon={Layers}
                                                        label="floors"
                                                        count={building.floors.length}
                                                        onDark
                                                    />
                                                    <div style={{ width: 176 }}>
                                                        <OccupancyBar
                                                            occupied={bOcc}
                                                            total={bRooms.length}
                                                            size="md"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                padding: 12,
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 8,
                                            }}
                                        >
                                            {building.floors.map((floor, fIdx) => {
                                                const floorKey = floor.id ?? `${bIdx}-${fIdx}`;
                                                const floorCollapsed = collapsedFloors.has(floorKey);
                                                const fRooms = floor.wards.flatMap((w) =>
                                                    w.rooms.map((r) => r.roomData).filter(Boolean)
                                                );
                                                const fOcc = fRooms.filter(
                                                    (r) => r.status === "OCCUPIED"
                                                ).length;
                                                return (
                                                    <div
                                                        key={floorKey}
                                                        style={{
                                                            borderRadius: 8,
                                                            border: "1px solid var(--hms-gray-100)",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        <div
                                                            onClick={() => toggleFloor(floorKey)}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "space-between",
                                                                padding: "8px 12px",
                                                                background: "var(--hms-gray-50)",
                                                                borderBottom:
                                                                    "1px solid var(--hms-gray-100)",
                                                                cursor: "pointer",
                                                                userSelect: "none",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                }}
                                                            >
                                                                {floorCollapsed ? (
                                                                    <ChevronRight
                                                                        size={14}
                                                                        style={{
                                                                            color: "var(--hms-gray-400)",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <ChevronDown
                                                                        size={14}
                                                                        style={{
                                                                            color: "var(--hms-gray-400)",
                                                                        }}
                                                                    />
                                                                )}
                                                                <Layers
                                                                    size={12}
                                                                    style={{ color: "var(--hms-gray-400)" }}
                                                                />
                                                                <span
                                                                    style={{
                                                                        fontSize: 12,
                                                                        fontWeight: 600,
                                                                        color: "var(--hms-gray-700)",
                                                                    }}
                                                                >
                                                                    {floor.name || `Floor ${fIdx + 1}`}
                                                                </span>
                                                                <SectionLabel
                                                                    icon={LayoutGrid}
                                                                    label="wards"
                                                                    count={floor.wards.length}
                                                                />
                                                            </div>
                                                            <div style={{ width: 144 }}>
                                                                <OccupancyBar
                                                                    occupied={fOcc}
                                                                    total={fRooms.length}
                                                                    size="sm"
                                                                />
                                                            </div>
                                                        </div>

                                                        {!floorCollapsed && (
                                                            <div
                                                                style={{
                                                                    padding: 12,
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    gap: 12,
                                                                }}
                                                            >
                                                                {floor.wards.map((ward, wIdx) => {
                                                                    const wardKey =
                                                                        ward.id ??
                                                                        `${bIdx}-${fIdx}-${wIdx}`;
                                                                    const wardCollapsed =
                                                                        collapsedWards.has(wardKey);
                                                                    const wRooms = ward.rooms
                                                                        .map((r) => r.roomData)
                                                                        .filter(Boolean);
                                                                    const wOcc = wRooms.filter(
                                                                        (r) => r.status === "OCCUPIED"
                                                                    ).length;
                                                                    return (
                                                                        <div key={wardKey}>
                                                                            <div
                                                                                onClick={() =>
                                                                                    toggleWard(wardKey)
                                                                                }
                                                                                style={{
                                                                                    display: "flex",
                                                                                    alignItems: "center",
                                                                                    justifyContent:
                                                                                        "space-between",
                                                                                    marginBottom: 8,
                                                                                    padding: "4px 6px",
                                                                                    borderRadius: 6,
                                                                                    cursor: "pointer",
                                                                                    userSelect: "none",
                                                                                }}
                                                                            >
                                                                                <div
                                                                                    style={{
                                                                                        display: "flex",
                                                                                        alignItems: "center",
                                                                                        gap: 6,
                                                                                    }}
                                                                                >
                                                                                    {wardCollapsed ? (
                                                                                        <ChevronRight
                                                                                            size={12}
                                                                                            style={{
                                                                                                color: "var(--hms-gray-400)",
                                                                                            }}
                                                                                        />
                                                                                    ) : (
                                                                                        <ChevronDown
                                                                                            size={12}
                                                                                            style={{
                                                                                                color: "var(--hms-gray-400)",
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                    <LayoutGrid
                                                                                        size={12}
                                                                                        style={{
                                                                                            color: "var(--hms-gray-400)",
                                                                                        }}
                                                                                    />
                                                                                    <span
                                                                                        style={{
                                                                                            fontSize: 12,
                                                                                            fontWeight: 600,
                                                                                            color: "var(--hms-gray-600)",
                                                                                        }}
                                                                                    >
                                                                                        {ward.name ||
                                                                                            `Ward ${wIdx + 1}`}
                                                                                    </span>
                                                                                    <span
                                                                                        style={{
                                                                                            fontSize: 10,
                                                                                            fontVariantNumeric:
                                                                                                "tabular-nums",
                                                                                            color: "var(--hms-gray-400)",
                                                                                        }}
                                                                                    >
                                                                                        ·{" "}
                                                                                        {ward.rooms.length}
                                                                                    </span>
                                                                                </div>
                                                                                <div
                                                                                    style={{
                                                                                        width: 112,
                                                                                    }}
                                                                                >
                                                                                    <OccupancyBar
                                                                                        occupied={wOcc}
                                                                                        total={wRooms.length}
                                                                                        size="sm"
                                                                                    />
                                                                                </div>
                                                                            </div>

                                                                            {!wardCollapsed && (
                                                                                <div
                                                                                    style={roomGridStyle}
                                                                                >
                                                                                    {ward.rooms.map(
                                                                                        (room) => (
                                                                                            <InfrastructureRoomCard
                                                                                                key={room.name}
                                                                                                roomInfo={room}
                                                                                                roomData={
                                                                                                    room.roomData
                                                                                                }
                                                                                                {...cardProps(
                                                                                                    room.roomData
                                                                                                )}
                                                                                            />
                                                                                        )
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {unmappedRooms.length > 0 && (
                                <div
                                    style={{
                                        position: "relative",
                                        borderRadius: 12,
                                        border: "1px solid var(--hms-gray-200)",
                                        background: "var(--hms-white)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: 4,
                                            background: "var(--hms-warning)",
                                        }}
                                    />
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 16,
                                            padding: "14px 20px 14px 24px",
                                            borderBottom: "1px solid var(--hms-gray-100)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 6,
                                                    background: "var(--hms-warning-bg)",
                                                    border: "1px solid var(--hms-warning-border)",
                                                    color: "var(--hms-warning)",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Link2Off size={16} />
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <p
                                                        style={{
                                                            margin: 0,
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            color: "var(--hms-gray-900)",
                                                        }}
                                                    >
                                                        Unmapped rooms
                                                    </p>
                                                    <Badge tone="warning" soft>
                                                        {unmappedRooms.length}
                                                    </Badge>
                                                </div>
                                                <p
                                                    style={{
                                                        margin: "2px 0 0",
                                                        fontSize: 11,
                                                        color: "var(--hms-gray-500)",
                                                    }}
                                                >
                                                    Exist in room allocation but not linked to the
                                                    infrastructure tree
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                fontSize: 10,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.1em",
                                                color: "var(--hms-gray-400)",
                                                fontWeight: 600,
                                            }}
                                        >
                                            <AlertCircle size={12} />
                                            <span>Data quality</span>
                                        </div>
                                    </div>
                                    <div style={{ ...roomGridStyle, padding: "12px 12px 12px 16px" }}>
                                        {unmappedRooms.map((room) => (
                                            <InfrastructureRoomCard
                                                key={room.id}
                                                roomInfo={{
                                                    name: room.roomNumber,
                                                    roomType: room.roomType,
                                                }}
                                                roomData={room}
                                                {...cardProps(room)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {filteredInfrastructure.length === 0 && unmappedRooms.length === 0 && (
                                <Card
                                    style={{
                                        padding: 64,
                                        textAlign: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 999,
                                            background: "var(--hms-gray-100)",
                                            color: "var(--hms-gray-300)",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            margin: "0 auto 12px",
                                        }}
                                    >
                                        <Bed size={28} />
                                    </div>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: "var(--hms-gray-700)",
                                        }}
                                    >
                                        No rooms match the current filter
                                    </p>
                                    <p
                                        style={{
                                            margin: "4px 0 0",
                                            fontSize: 11,
                                            color: "var(--hms-gray-400)",
                                        }}
                                    >
                                        Try clearing the search or switching filters above.
                                    </p>
                                </Card>
                            )}
                        </div>
                    ) : filteredRooms.length === 0 ? (
                        <Card style={{ padding: 64, textAlign: "center", alignItems: "center" }}>
                            <div
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 999,
                                    background: "var(--hms-gray-100)",
                                    color: "var(--hms-gray-300)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 12px",
                                }}
                            >
                                <Bed size={28} />
                            </div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "var(--hms-gray-700)",
                                }}
                            >
                                No rooms found matching criteria
                            </p>
                            <p
                                style={{
                                    margin: "4px 0 0",
                                    fontSize: 11,
                                    color: "var(--hms-gray-400)",
                                }}
                            >
                                Adjust the filter or search above.
                            </p>
                        </Card>
                    ) : (
                        <FlatRoomList
                            rooms={filteredRooms}
                            selectedRoom={selectedRoom}
                            onSelect={(r) =>
                                setSelectedRoom((prev) => (prev?.id === r.id ? null : r))
                            }
                            onView={(r) => setSelectedRoom(r)}
                            onAttender={(r) =>
                                setShowAttenderModal({ open: true, room: r })
                            }
                        />
                    )}
                </div>

                {selectedRoom && (
                    <RoomDetailPanel
                        room={selectedRoom}
                        onClose={() => setSelectedRoom(null)}
                        onViewLogs={() =>
                            navigate(
                                `/rooms/logs?roomId=${selectedRoom.id}&roomNumber=${selectedRoom.roomNumber}`
                            )
                        }
                    />
                )}
            </div>

            {showAttenderModal.open && showAttenderModal.room && (
                <AssignAttenderModal
                    admissionId={showAttenderModal.room.admissionId}
                    label={`Room ${showAttenderModal.room.roomNumber}`}
                    existing={{
                        name: showAttenderModal.room.attenderName,
                        phone: showAttenderModal.room.attenderPhone,
                        relationship: showAttenderModal.room.attenderRelationship,
                    }}
                    onClose={() => setShowAttenderModal({ open: false, room: null })}
                    onSuccess={() => {
                        setShowAttenderModal({ open: false, room: null });
                        fetchRooms();
                    }}
                />
            )}
        </div>
    );
}

function FlatRoomList({ rooms, selectedRoom, onSelect, onView, onAttender }) {
    return (
        <>
            {rooms.map((room) => {
                const isMultiBed = room.bedCount != null && room.bedCount > 1;
                const accent = STATUS_ACCENT[room.status] || "var(--hms-gray-300)";
                const isSelected = selectedRoom?.id === room.id;
                return (
                    <div
                        key={room.id}
                        onClick={() => onSelect(room)}
                        style={{
                            position: "relative",
                            overflow: "hidden",
                            background: "var(--hms-white)",
                            border: `1px solid ${isSelected ? "#60a5fa" : "var(--hms-gray-200)"
                                }`,
                            borderRadius: 12,
                            padding: "16px 16px 16px 20px",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                            cursor: "pointer",
                            boxShadow: isSelected ? "0 0 0 2px rgba(59, 130, 246, 0.1)" : "none",
                            transition: "all 0.15s",
                            fontFamily: "var(--hms-font-family)",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 3,
                                background: accent,
                            }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 8,
                                    background: STATUS_ICON_BG[room.status] || "var(--hms-gray-50)",
                                    color: STATUS_ICON_COLOR[room.status] || "var(--hms-gray-400)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <Bed size={20} />
                            </div>
                            <div>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "var(--hms-gray-900)",
                                        }}
                                    >
                                        {room.roomNumber}
                                    </p>
                                    {room.roomCode && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                fontFamily:
                                                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                color: "var(--hms-gray-400)",
                                            }}
                                        >
                                            {fmtId(room.roomCode)}
                                        </span>
                                    )}
                                    <Badge tone={TYPE_TONE[room.roomType] || "neutral"} soft>
                                        {room.roomType}
                                    </Badge>
                                    {isMultiBed && (
                                        <Badge tone="neutral" soft>
                                            {room.bedCount} beds
                                        </Badge>
                                    )}
                                </div>
                                <div style={{ marginTop: 4 }}>
                                    <StatusChip status={room.status} />
                                </div>
                            </div>
                        </div>

                        {isMultiBed ? (
                            <div
                                style={{
                                    flex: 1,
                                    paddingLeft: 24,
                                    borderLeft: "1px solid var(--hms-gray-100)",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 12,
                                        color: "var(--hms-gray-500)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                        fontWeight: 500,
                                    }}
                                >
                                    Open panel to view beds →
                                </p>
                            </div>
                        ) : room.status === "OCCUPIED" && room.currentPatient ? (
                            <div
                                style={{
                                    flex: 1,
                                    paddingLeft: 24,
                                    borderLeft: "1px solid var(--hms-gray-100)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        justifyContent: "space-between",
                                        gap: 16,
                                    }}
                                >
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <div>
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 10,
                                                    color: "var(--hms-gray-400)",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.1em",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Patient
                                            </p>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    marginTop: 2,
                                                }}
                                            >
                                                <User
                                                    size={14}
                                                    style={{ color: "var(--hms-gray-400)" }}
                                                />
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        color: "var(--hms-gray-800)",
                                                    }}
                                                >
                                                    {room.currentPatient.firstName}{" "}
                                                    {room.currentPatient.lastName}
                                                </p>
                                            </div>
                                            <p
                                                style={{
                                                    margin: "2px 0 0",
                                                    fontSize: 11,
                                                    color: "var(--hms-gray-500)",
                                                    fontFamily:
                                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                }}
                                            >
                                                {fmtId(room.currentPatient.uhid)}
                                            </p>
                                        </div>
                                        {room.attenderName ? (
                                            <div>
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 10,
                                                        color: "var(--hms-gray-400)",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.1em",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    Attender
                                                </p>
                                                <p
                                                    style={{
                                                        margin: "2px 0 0",
                                                        fontSize: 13,
                                                        fontWeight: 500,
                                                        color: "var(--hms-gray-700)",
                                                    }}
                                                >
                                                    {room.attenderName}
                                                    {room.attenderRelationship && (
                                                        <span
                                                            style={{
                                                                fontSize: 12,
                                                                color: "var(--hms-gray-400)",
                                                                marginLeft: 4,
                                                            }}
                                                        >
                                                            ({room.attenderRelationship})
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        ) : (
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 10,
                                                    color: "var(--hms-warning)",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.06em",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                No attender assigned
                                            </p>
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            textAlign: "right",
                                            flexShrink: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                        }}
                                    >
                                        {room.allocationToken && (
                                            <div>
                                                <p
                                                    style={{
                                                        margin: "0 0 2px",
                                                        fontSize: 10,
                                                        color: "var(--hms-gray-400)",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.1em",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    Token
                                                </p>
                                                <span
                                                    style={{
                                                        padding: "4px 8px",
                                                        borderRadius: 6,
                                                        background: "var(--hms-gray-100)",
                                                        border: "1px solid var(--hms-gray-200)",
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        fontFamily:
                                                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                        color: "var(--hms-gray-900)",
                                                    }}
                                                >
                                                    {room.allocationToken}
                                                </span>
                                            </div>
                                        )}
                                        {room.approxDischargeTime && (
                                            <div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 4,
                                                        fontSize: 10,
                                                        color: "var(--hms-gray-400)",
                                                        marginBottom: 2,
                                                        justifyContent: "flex-end",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.1em",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    <CalendarClock size={12} /> Est. discharge
                                                </div>
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 12,
                                                        fontWeight: 500,
                                                        color: "var(--hms-gray-600)",
                                                    }}
                                                >
                                                    {formatDateTime(room.approxDischargeTime)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                style={{
                                    flex: 1,
                                    paddingLeft: 24,
                                    borderLeft: "1px solid var(--hms-gray-100)",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 12,
                                        color: "var(--hms-success)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                        fontWeight: 600,
                                    }}
                                >
                                    Ready for allocation
                                </p>
                            </div>
                        )}

                        <div onClick={(e) => e.stopPropagation()}>
                            <RoomMenu
                                room={room}
                                onView={onView}
                                onAttender={onAttender}
                                alwaysVisible
                            />
                        </div>
                    </div>
                );
            })}
        </>
    );
}

export default Rooms;
