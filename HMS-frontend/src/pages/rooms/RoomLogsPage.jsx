import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { roomLogsApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import {
    Loader2,
    Bed,
    User,
    Users,
    PlusCircle,
    LogOut,
    UserCheck,
    UserCog,
    CalendarClock,
} from "lucide-react";
import { timeAgo, fmtDateTime } from "@/utils/date";
import {
    Badge,
    Card,
    PageHeader,
    Pagination,
    SearchBar,
} from "@/components/ui";

const PAGE_SIZE = 30;

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
 * Room activity log — paginated event timeline, optionally scoped to
 * a single room via ?roomId=&roomNumber= query params. Phase 9
 * migration: data layer untouched (roomLogsApi.getRoomLogs/
 * getHospitalLogs), debounced search, 30-row pagination.
 */
function RoomLogsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const roomId = searchParams.get("roomId")
        ? Number(searchParams.get("roomId"))
        : undefined;
    const roomNumber = searchParams.get("roomNumber") ?? undefined;

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
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

    const paginatedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title={
                    roomNumber
                        ? `Room ${roomNumber} — activity log`
                        : "Room activity log"
                }
                subtitle={
                    loading
                        ? "Loading…"
                        : `${filteredLogs.length} event${filteredLogs.length !== 1 ? "s" : ""}`
                }
                onBack={() => navigate("/rooms/allocation")}
            />

            <div
                style={{
                    padding: "0 24px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                }}
            >
                <div style={{ maxWidth: 560 }}>
                    <SearchBar
                        value={search}
                        onChange={setSearch}
                        placeholder="Search by room, patient, UHID, attender or performed by…"
                    />
                </div>

                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 2fr 2fr 1.5fr 1fr",
                            gap: 16,
                            padding: "12px 24px",
                            background: "var(--hms-gray-50)",
                            borderBottom: "1px solid var(--hms-gray-100)",
                        }}
                    >
                        {["Event", "Patient", "Attender", "Performed by", "Time"].map((h, i) => (
                            <p
                                key={h}
                                style={{
                                    margin: 0,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    color: "var(--hms-gray-500)",
                                    textAlign: i === 4 ? "right" : "left",
                                }}
                            >
                                {h}
                            </p>
                        ))}
                    </div>

                    {loading ? (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "80px 0",
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
                                padding: "80px 0",
                                gap: 12,
                                color: "var(--hms-gray-500)",
                            }}
                        >
                            <CalendarClock size={40} style={{ opacity: 0.3 }} />
                            <p style={{ margin: 0, fontSize: 13 }}>No log entries found</p>
                            {search && (
                                <p style={{ margin: 0, fontSize: 11 }}>
                                    Try clearing the search filter
                                </p>
                            )}
                        </div>
                    ) : (
                        <div>
                            {paginatedLogs.map((log, idx) => {
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
                                            padding: "16px 24px",
                                            display: "grid",
                                            gridTemplateColumns: "2fr 2fr 2fr 1.5fr 1fr",
                                            gap: 16,
                                            alignItems: "center",
                                            borderTop:
                                                idx === 0 ? "none" : "1px solid var(--hms-gray-100)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                flexWrap: "wrap",
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
                                                    color: "var(--hms-gray-500)",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon size={14} />
                                            </div>
                                            <div>
                                                <Badge tone={meta.tone} soft>
                                                    {meta.label}
                                                </Badge>
                                                <p
                                                    style={{
                                                        margin: "4px 0 0",
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: "var(--hms-gray-700)",
                                                    }}
                                                >
                                                    {log.roomNumber}
                                                    {log.allocationToken && (
                                                        <span
                                                            style={{
                                                                marginLeft: 8,
                                                                fontFamily:
                                                                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                                color: "var(--hms-gray-900)",
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            #{log.allocationToken}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            {log.patientName ? (
                                                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                                                    <User
                                                        size={14}
                                                        style={{
                                                            color: "var(--hms-gray-500)",
                                                            flexShrink: 0,
                                                            marginTop: 2,
                                                        }}
                                                    />
                                                    <div>
                                                        <p
                                                            style={{
                                                                margin: 0,
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                color: "var(--hms-gray-800)",
                                                                lineHeight: 1.3,
                                                            }}
                                                        >
                                                            {log.patientName}
                                                        </p>
                                                        {log.patientUhid && (
                                                            <p
                                                                style={{
                                                                    margin: 0,
                                                                    fontSize: 11,
                                                                    color: "var(--hms-gray-500)",
                                                                }}
                                                            >
                                                                {fmtId(log.patientUhid)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-300)" }}>—</p>
                                            )}
                                        </div>

                                        <div>
                                            {log.attenderName ? (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <Users
                                                        size={14}
                                                        style={{
                                                            color: "var(--hms-gray-500)",
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <p style={{ margin: 0, fontSize: 13, color: "var(--hms-gray-700)" }}>
                                                        {log.attenderName}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-300)" }}>—</p>
                                            )}
                                        </div>

                                        <div>
                                            {log.performedBy ? (
                                                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--hms-gray-700)" }}>
                                                    {log.performedBy}
                                                </p>
                                            ) : (
                                                <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-300)" }}>—</p>
                                            )}
                                        </div>

                                        <div style={{ textAlign: "right" }}>
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 11,
                                                    fontWeight: 500,
                                                    color: "var(--hms-gray-500)",
                                                }}
                                                title={formatFull(log.createdAt)}
                                            >
                                                {formatRelative(log.createdAt)}
                                            </p>
                                            <p
                                                style={{
                                                    margin: "2px 0 0",
                                                    fontSize: 10,
                                                    color: "var(--hms-gray-500)",
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

                    {!loading && filteredLogs.length > 0 && totalPages > 1 && (
                        <div
                            style={{
                                padding: "12px 24px",
                                borderTop: "1px solid var(--hms-gray-100)",
                            }}
                        >
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                totalItems={filteredLogs.length}
                                pageSize={PAGE_SIZE}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

export { RoomLogsPage as default };
