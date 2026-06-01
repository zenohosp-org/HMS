import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { assetApi, bedApi } from "@/utils/api";
import {
    X,
    User,
    Phone,
    Users,
    Package,
    CalendarClock,
    ScrollText,
    Search,
    Plus,
    Loader2,
    ArrowUpRight,
    Tag,
    BedDouble,
    Pencil,
} from "lucide-react";
import { formatDateTime } from "@/utils/validators";
import { fmtId } from "@/utils/idFormat";
import AssignAttenderModal from "./AssignAttenderModal";
import { Badge, Button } from "@/components/ui";

/** Asset status → Badge tone. */
const ASSET_TONE = {
    ACTIVE: "success",
    IN_USE: "info",
    MAINTENANCE: "warning",
    DISPOSED: "danger",
};
function AssetStatusBadge({ status }) {
    return (
        <Badge tone={ASSET_TONE[status] || "neutral"} soft>
            {status ?? "—"}
        </Badge>
    );
}

/**
 * Inline searchable asset picker. Lists available assets at the hospital
 * level (assetApi.getAvailable) and assigns one to the room on click.
 * Closes on outside click and on successful assign.
 */
function AssignAssetDropdown({ hospitalId, roomId, onAssigned }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState(null);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const fetchAvailable = useCallback(
        async (q) => {
            setLoading(true);
            try {
                const data = await assetApi.getAvailable(hospitalId, q || undefined);
                setResults(data);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        },
        [hospitalId]
    );

    const onFocus = () => {
        setOpen(true);
        fetchAvailable(query);
    };

    const onChange = (val) => {
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchAvailable(val), 300);
    };

    const assign = async (asset) => {
        setAssigning(asset.assetId);
        try {
            await assetApi.assignToRoom(asset.assetId, roomId, hospitalId);
            onAssigned();
            setQuery("");
            setOpen(false);
        } finally {
            setAssigning(null);
        }
    };

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <div style={{ position: "relative" }}>
                <Search
                    size={14}
                    style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--hms-gray-400)",
                        pointerEvents: "none",
                    }}
                />
                <input
                    value={query}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={onFocus}
                    placeholder="Search available assets…"
                    style={{
                        width: "100%",
                        padding: "8px 12px 8px 32px",
                        borderRadius: 8,
                        border: "1px solid var(--hms-gray-200)",
                        background: "var(--hms-gray-50)",
                        color: "var(--hms-gray-800)",
                        fontSize: 12,
                        outline: "none",
                        fontFamily: "var(--hms-font-family)",
                    }}
                />
            </div>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        zIndex: 30,
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: "var(--hms-white)",
                        border: "1px solid var(--hms-gray-200)",
                        borderRadius: 8,
                        boxShadow: "var(--hms-shadow-lg)",
                        overflow: "hidden",
                        maxHeight: 208,
                        overflowY: "auto",
                    }}
                >
                    {loading ? (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "12px",
                                fontSize: 11,
                                color: "var(--hms-gray-400)",
                            }}
                        >
                            <Loader2 size={14} className="animate-spin" /> Searching…
                        </div>
                    ) : results.length === 0 ? (
                        <div
                            style={{
                                padding: 12,
                                fontSize: 11,
                                color: "var(--hms-gray-400)",
                            }}
                        >
                            No available assets found
                        </div>
                    ) : (
                        results.map((a) => (
                            <button
                                key={a.assetId}
                                disabled={!!assigning}
                                onClick={() => assign(a)}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "10px 12px",
                                    borderBottom: "1px solid var(--hms-gray-100)",
                                    background: "transparent",
                                    border: "none",
                                    cursor: assigning ? "wait" : "pointer",
                                    opacity: assigning ? 0.5 : 1,
                                    fontFamily: "var(--hms-font-family)",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = "var(--hms-gray-50)")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = "transparent")
                                }
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: "var(--hms-gray-800)",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {a.assetName}
                                        </p>
                                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--hms-gray-400)" }}>
                                            {a.assetCode}
                                            {a.make ? ` · ${a.make}` : ""}
                                            {a.model ? ` ${a.model}` : ""}
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                        <AssetStatusBadge status={a.status} />
                                        {assigning === a.assetId ? (
                                            <Loader2
                                                size={12}
                                                style={{ color: "var(--hms-gray-700)" }}
                                                className="animate-spin"
                                            />
                                        ) : (
                                            <Plus size={12} style={{ color: "var(--hms-success)" }} />
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/** Multi-bed rooms get an inline beds list with per-bed attender control. */
function BedsSection({ room, hospitalId }) {
    const [beds, setBeds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingAttender, setEditingAttender] = useState(null);

    const loadBeds = useCallback(async () => {
        if (!room?.id || !hospitalId) return;
        setLoading(true);
        try {
            const data = await bedApi.getByRoom(room.id, hospitalId);
            setBeds(data);
        } catch {
            setBeds([]);
        } finally {
            setLoading(false);
        }
    }, [room?.id, hospitalId]);

    useEffect(() => {
        loadBeds();
    }, [loadBeds]);

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px 0",
                    color: "var(--hms-gray-400)",
                }}
            >
                <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} />
                <span style={{ fontSize: 11 }}>Loading beds…</span>
            </div>
        );
    }

    if (beds.length === 0) return null;

    const occupiedCount = beds.filter((b) => b.status === "OCCUPIED").length;
    const occupancyTone =
        occupiedCount === beds.length ? "danger" : occupiedCount > 0 ? "warning" : "success";

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <BedDouble size={14} style={{ color: "var(--hms-gray-400)" }} />
                    <p
                        style={{
                            margin: 0,
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--hms-gray-500)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                        }}
                    >
                        Beds
                    </p>
                    <Badge tone={occupancyTone} soft>
                        {occupiedCount}/{beds.length} occupied
                    </Badge>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {beds.map((bed) => {
                    const occupied = bed.status === "OCCUPIED";
                    return (
                        <div
                            key={bed.id}
                            style={{
                                borderRadius: 8,
                                background: occupied
                                    ? "var(--hms-info-bg)"
                                    : "var(--hms-success-bg)",
                                border: `1px solid ${occupied
                                    ? "var(--hms-info-border)"
                                    : "var(--hms-success-border)"
                                    }`,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: 12,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                    <div
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 999,
                                            background: occupied
                                                ? "var(--hms-info)"
                                                : "var(--hms-success)",
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--hms-gray-800)" }}>
                                            {bed.bedNumber}
                                        </p>
                                        {bed.patientName ? (
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 11,
                                                    color: "var(--hms-gray-500)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {bed.patientName}
                                            </p>
                                        ) : (
                                            <p style={{ margin: 0, fontSize: 11, color: "var(--hms-success)" }}>
                                                Available
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {occupied && bed.admissionId && (
                                    <button
                                        type="button"
                                        onClick={() => setEditingAttender(bed)}
                                        style={{
                                            flexShrink: 0,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                            padding: "4px 8px",
                                            borderRadius: 6,
                                            fontSize: 10,
                                            fontWeight: 600,
                                            color: "var(--hms-gray-600)",
                                            background: "rgba(255, 255, 255, 0.6)",
                                            border: "1px solid var(--hms-gray-200)",
                                            cursor: "pointer",
                                            fontFamily: "var(--hms-font-family)",
                                        }}
                                        title={bed.attenderName ? "Edit attender" : "Assign attender"}
                                    >
                                        <Pencil size={12} />
                                        {bed.attenderName ? "Edit attender" : "Add attender"}
                                    </button>
                                )}
                            </div>
                            {occupied && bed.attenderName && (
                                <div
                                    style={{
                                        padding: "0 12px 12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        flexWrap: "wrap",
                                        fontSize: 11,
                                    }}
                                >
                                    <Users size={12} style={{ color: "var(--hms-gray-400)" }} />
                                    <span style={{ fontWeight: 600, color: "var(--hms-gray-700)" }}>
                                        {bed.attenderName}
                                    </span>
                                    {bed.attenderRelationship && (
                                        <Badge tone="neutral" soft>
                                            {bed.attenderRelationship}
                                        </Badge>
                                    )}
                                    {bed.attenderPhone && (
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 4,
                                                color: "var(--hms-gray-500)",
                                            }}
                                        >
                                            <Phone size={12} />
                                            {bed.attenderPhone}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {editingAttender && (
                <AssignAttenderModal
                    admissionId={editingAttender.admissionId}
                    label={`Bed ${editingAttender.bedNumber} · Room ${room.roomNumber}`}
                    existing={{
                        name: editingAttender.attenderName,
                        phone: editingAttender.attenderPhone,
                        relationship: editingAttender.attenderRelationship,
                    }}
                    onClose={() => setEditingAttender(null)}
                    onSuccess={() => {
                        setEditingAttender(null);
                        loadBeds();
                    }}
                />
            )}
        </div>
    );
}

/**
 * Right-edge detail panel for a single room. Used by /rooms/allocation —
 * the parent owns the open state and passes the selected room object.
 * Phase 9 migration: data layer untouched (assetApi.getByRoom/getAvailable/
 * assignToRoom/unassignFromRoom, bedApi.getByRoom). Sticky positioning and
 * scroll behaviour preserved.
 */
function RoomDetailPanel({ room, onClose, onViewLogs }) {
    const { user } = useAuth();
    const hospitalId = user?.hospitalId;

    const [assets, setAssets] = useState([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [removingId, setRemovingId] = useState(null);
    const [showAssign, setShowAssign] = useState(false);

    const loadAssets = useCallback(async () => {
        if (!room?.id || !hospitalId) return;
        setAssetsLoading(true);
        try {
            const data = await assetApi.getByRoom(hospitalId, room.id);
            setAssets(data);
        } catch {
            setAssets([]);
        } finally {
            setAssetsLoading(false);
        }
    }, [room?.id, hospitalId]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const handleUnassign = async (assetId) => {
        setRemovingId(assetId);
        try {
            await assetApi.unassignFromRoom(assetId);
            await loadAssets();
        } finally {
            setRemovingId(null);
        }
    };

    const isMultiBed = room.bedCount != null && room.bedCount > 1;

    const sectionLabel = (Icon, label, suffix) => (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
            }}
        >
            <Icon size={14} style={{ color: "var(--hms-gray-400)" }} />
            <p
                style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--hms-gray-500)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
                {suffix}
            </p>
        </div>
    );

    return (
        <div
            style={{
                width: 560,
                flexShrink: 0,
                background: "var(--hms-white)",
                border: "1px solid var(--hms-gray-200)",
                borderRadius: "var(--hms-radius)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                alignSelf: "flex-start",
                position: "sticky",
                top: 0,
                fontFamily: "var(--hms-font-family)",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: 20,
                    borderBottom: "1px solid var(--hms-gray-100)",
                }}
            >
                <div>
                    <p
                        style={{
                            margin: "0 0 6px",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--hms-gray-400)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                        }}
                    >
                        {room.roomNumber}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Badge tone={room.roomType === "ICU" ? "danger" : "neutral"} soft>
                            {room.roomType}
                        </Badge>
                        <Badge tone={room.status === "AVAILABLE" ? "success" : "info"} soft>
                            {room.status}
                        </Badge>
                        {isMultiBed && (
                            <Badge tone="neutral" soft>
                                {room.bedCount} beds
                            </Badge>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="hms-modal-close"
                    aria-label="Close"
                >
                    <X size={16} />
                </button>
            </div>

            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                }}
            >
                {!isMultiBed && room.allocationToken && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: "var(--hms-gray-100)",
                            border: "1px solid var(--hms-gray-200)",
                        }}
                    >
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--hms-gray-700)" }}>
                            Allocation token
                        </p>
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                color: "var(--hms-gray-900)",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}
                        >
                            {room.allocationToken}
                        </span>
                    </div>
                )}

                {!isMultiBed && room.approxDischargeTime && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: "var(--hms-warning-bg)",
                            border: "1px solid var(--hms-warning-border)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#b45309",
                            }}
                        >
                            <CalendarClock size={14} /> Est. discharge
                        </div>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: "#b45309" }}>
                            {formatDateTime(room.approxDischargeTime)}
                        </p>
                    </div>
                )}

                {isMultiBed && <BedsSection room={room} hospitalId={hospitalId} />}

                {!isMultiBed && (
                    <div>
                        {sectionLabel(User, "Patient", "")}
                        {room.currentPatient ? (
                            <div style={{ paddingLeft: 4 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--hms-gray-800)" }}>
                                    {room.currentPatient.firstName} {room.currentPatient.lastName}
                                </p>
                                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--hms-gray-500)" }}>
                                    {fmtId(room.currentPatient.uhid)}
                                </p>
                            </div>
                        ) : (
                            <p style={{ margin: "0 0 0 4px", fontSize: 13, color: "var(--hms-gray-500)" }}>
                                No patient assigned
                            </p>
                        )}
                    </div>
                )}

                {(!isMultiBed || isMultiBed) && (
                    <div style={{ borderTop: "1px solid var(--hms-gray-100)" }} />
                )}

                {!isMultiBed && (
                    <div>
                        {sectionLabel(Users, "Attender", "")}
                        {room.attenderName ? (
                            <div style={{ paddingLeft: 4, display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--hms-gray-800)" }}>
                                        {room.attenderName}
                                    </p>
                                    {room.attenderRelationship && (
                                        <Badge tone="neutral" soft>
                                            {room.attenderRelationship}
                                        </Badge>
                                    )}
                                </div>
                                {room.attenderPhone && (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            fontSize: 11,
                                            color: "var(--hms-gray-500)",
                                        }}
                                    >
                                        <Phone size={12} />
                                        {room.attenderPhone}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p style={{ margin: "0 0 0 4px", fontSize: 13, color: "var(--hms-warning)" }}>
                                No attender assigned
                            </p>
                        )}
                    </div>
                )}

                <div style={{ borderTop: "1px solid var(--hms-gray-100)" }} />

                {/* Assets */}
                <div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 12,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Package size={14} style={{ color: "var(--hms-gray-400)" }} />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "var(--hms-gray-500)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                }}
                            >
                                Assets in room
                            </p>
                            {assets.length > 0 && (
                                <Badge tone="success" soft>
                                    {assets.length}
                                </Badge>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAssign((v) => !v)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 10px",
                                borderRadius: 8,
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--hms-success)",
                                background: "var(--hms-success-bg)",
                                border: "1px solid var(--hms-success-border)",
                                cursor: "pointer",
                                fontFamily: "var(--hms-font-family)",
                            }}
                        >
                            <Plus size={12} /> Assign
                        </button>
                    </div>

                    {showAssign && (
                        <div style={{ marginBottom: 12 }}>
                            <AssignAssetDropdown
                                hospitalId={hospitalId}
                                roomId={room.id}
                                onAssigned={() => {
                                    loadAssets();
                                    setShowAssign(false);
                                }}
                            />
                        </div>
                    )}

                    {assetsLoading ? (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "24px 0",
                                color: "var(--hms-gray-400)",
                            }}
                        >
                            <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} />
                            <span style={{ fontSize: 11 }}>Loading assets…</span>
                        </div>
                    ) : assets.length === 0 ? (
                        <div
                            style={{
                                padding: "20px 16px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 8,
                                border: "1px dashed var(--hms-gray-200)",
                            }}
                        >
                            <Package size={24} style={{ color: "var(--hms-gray-300)", marginBottom: 6 }} />
                            <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>
                                No assets assigned yet
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {assets.map((a) => (
                                <div
                                    key={a.assetId}
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 10,
                                        padding: 10,
                                        borderRadius: 8,
                                        border: "1px solid var(--hms-gray-100)",
                                        background: "var(--hms-gray-50)",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 8,
                                            background: "var(--hms-white)",
                                            border: "1px solid var(--hms-gray-200)",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            marginTop: 2,
                                            color: "var(--hms-gray-400)",
                                        }}
                                    >
                                        <Package size={14} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                justifyContent: "space-between",
                                                gap: 4,
                                            }}
                                        >
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: "var(--hms-gray-800)",
                                                    lineHeight: 1.3,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {a.assetName}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => handleUnassign(a.assetId)}
                                                disabled={removingId === a.assetId}
                                                style={{
                                                    flexShrink: 0,
                                                    padding: 2,
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "var(--hms-gray-300)",
                                                    cursor: "pointer",
                                                    opacity: removingId === a.assetId ? 0.5 : 1,
                                                }}
                                                title="Remove from room"
                                            >
                                                {removingId === a.assetId ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <X size={12} />
                                                )}
                                            </button>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                marginTop: 4,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            {a.assetCode && (
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: 2,
                                                        fontSize: 10,
                                                        color: "var(--hms-gray-400)",
                                                    }}
                                                >
                                                    <Tag size={10} />
                                                    {a.assetCode}
                                                </span>
                                            )}
                                            {(a.make || a.model) && (
                                                <span style={{ fontSize: 10, color: "var(--hms-gray-400)" }}>
                                                    {[a.make, a.model].filter(Boolean).join(" ")}
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                marginTop: 6,
                                            }}
                                        >
                                            <AssetStatusBadge status={a.status} />
                                            <a
                                                href={`https://asset.zenohosp.com/assets/${a.assetId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 2,
                                                    fontSize: 10,
                                                    color: "var(--hms-gray-400)",
                                                    textDecoration: "none",
                                                }}
                                                title="View in Assets app"
                                            >
                                                Details <ArrowUpRight size={10} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div
                style={{
                    padding: 16,
                    borderTop: "1px solid var(--hms-gray-100)",
                    flexShrink: 0,
                }}
            >
                <Button variant="secondary" full onClick={onViewLogs}>
                    <ScrollText size={14} /> View room logs
                </Button>
            </div>
        </div>
    );
}

export default RoomDetailPanel;
