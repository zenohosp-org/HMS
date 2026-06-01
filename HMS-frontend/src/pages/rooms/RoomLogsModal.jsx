import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { roomLogsApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import {
    Search,
    Loader2,
    Bed,
    User,
    Users,
    CalendarClock,
    PlusCircle,
    LogOut,
    UserCheck,
    UserCog,
} from "lucide-react";
import { timeAgo, fmtDateTime } from "@/utils/date";
import { Badge, Button, Modal, SearchBar } from "@/components/ui";

const EVENT_META = {
    ROOM_CREATED: { label: "Room created", tone: "warning", icon: PlusCircle },
    ALLOCATED: { label: "Allocated", tone: "success", icon: Bed },
    DEALLOCATED: { label: "Deallocated", tone: "neutral", icon: LogOut },
    ATTENDER_ASSIGNED: { label: "Attender assigned", tone: "info", icon: UserCheck },
    ATTENDER_UPDATED: { label: "Attender updated", tone: "neutral", icon: UserCog },
};

const formatRelative = timeAgo;
const formatFull = fmtDateTime;

/**
 * Room logs modal — read-only event timeline for a single room (when
 * roomId is provided) or hospital-wide (no roomId). Phase 9 migration:
 * data layer untouched (roomLogsApi.getRoomLogs / getHospitalLogs),
 * debounced search, same scoping rule that filters client-side when a
 * roomId is provided.
 */
function RoomLogsModal({ onClose, roomId, roomNumber }) {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchLogs = useCallback(async () => {
        if (!user?.hospitalId) return;
        setLoading(true);
        try {
            const data = roomId
                ? await roomLogsApi.getRoomLogs(roomId, user.hospitalId)
                : await roomLogsApi.getHospitalLogs(
                    user.hospitalId,
                    debouncedSearch || undefined
                );
            setLogs(data);
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [user?.hospitalId, roomId, debouncedSearch]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const filteredLogs =
        roomId && debouncedSearch
            ? logs.filter((l) => {
                const s = debouncedSearch.toLowerCase();
                return (
                    l.roomNumber?.toLowerCase().includes(s) ||
                    l.patientName?.toLowerCase().includes(s) ||
                    l.patientUhid?.toLowerCase().includes(s) ||
                    l.attenderName?.toLowerCase().includes(s) ||
                    l.performedBy?.toLowerCase().includes(s)
                );
            })
            : logs;

    const title = roomId ? `Logs · Room ${roomNumber}` : "Room logs";

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="xl"
            title={
                <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--hms-gray-900)" }}>
                        {title}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>
                        {loading
                            ? "Loading…"
                            : `${filteredLogs.length} event${filteredLogs.length !== 1 ? "s" : ""}`}
                    </p>
                </div>
            }
            footer={
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by room, patient, UHID, attender or performed by…"
                />

                {loading ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: 192,
                            color: "var(--hms-gray-400)",
                        }}
                    >
                        <Loader2 size={20} className="animate-spin" />
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: 192,
                            gap: 8,
                            color: "var(--hms-gray-500)",
                        }}
                    >
                        <CalendarClock size={32} style={{ opacity: 0.4 }} />
                        <p style={{ margin: 0, fontSize: 13 }}>No logs found</p>
                    </div>
                ) : (
                    <div
                        style={{
                            border: "1px solid var(--hms-gray-100)",
                            borderRadius: 8,
                            overflow: "hidden",
                        }}
                    >
                        {filteredLogs.map((log, idx) => {
                            const meta = EVENT_META[log.event] || {
                                label: log.event,
                                tone: "neutral",
                                icon: Bed,
                            };
                            const Icon = meta.icon;
                            return (
                                <div
                                    key={log.id}
                                    style={{
                                        padding: "14px 20px",
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 16,
                                        borderTop:
                                            idx === 0 ? "none" : "1px solid var(--hms-gray-50)",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: "var(--hms-white)",
                                            border: "1px solid var(--hms-gray-200)",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            marginTop: 2,
                                            color: "var(--hms-gray-500)",
                                        }}
                                    >
                                        <Icon size={14} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <Badge tone={meta.tone} soft>
                                                {meta.label}
                                            </Badge>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: "var(--hms-gray-700)",
                                                    background: "var(--hms-gray-100)",
                                                    padding: "2px 8px",
                                                    borderRadius: 6,
                                                }}
                                            >
                                                {log.roomNumber}
                                            </span>
                                            {log.allocationToken && (
                                                <span
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.06em",
                                                        color: "var(--hms-gray-900)",
                                                        background: "var(--hms-gray-100)",
                                                        border: "1px solid var(--hms-gray-200)",
                                                        padding: "2px 8px",
                                                        borderRadius: 6,
                                                        fontFamily:
                                                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                    }}
                                                >
                                                    {log.allocationToken}
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: "4px 20px",
                                                marginTop: 8,
                                            }}
                                        >
                                            {log.patientName && (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 6,
                                                        fontSize: 11,
                                                        color: "var(--hms-gray-600)",
                                                    }}
                                                >
                                                    <User
                                                        size={12}
                                                        style={{
                                                            color: "var(--hms-gray-500)",
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <span style={{ fontWeight: 500 }}>
                                                        {log.patientName}
                                                    </span>
                                                    {log.patientUhid && (
                                                        <span style={{ color: "var(--hms-gray-500)" }}>
                                                            · {fmtId(log.patientUhid)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {log.attenderName && (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 6,
                                                        fontSize: 11,
                                                        color: "var(--hms-gray-600)",
                                                    }}
                                                >
                                                    <Users
                                                        size={12}
                                                        style={{
                                                            color: "var(--hms-gray-500)",
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <span>{log.attenderName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            textAlign: "right",
                                            flexShrink: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 2,
                                        }}
                                    >
                                        {log.performedBy && (
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 11,
                                                    fontWeight: 500,
                                                    color: "var(--hms-gray-700)",
                                                }}
                                            >
                                                {log.performedBy}
                                            </p>
                                        )}
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: 10,
                                                color: "var(--hms-gray-500)",
                                            }}
                                            title={formatFull(log.createdAt)}
                                        >
                                            {formatRelative(log.createdAt)}
                                        </p>
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: 10,
                                                color: "var(--hms-gray-300)",
                                            }}
                                        >
                                            {formatFull(log.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export { RoomLogsModal as default };
