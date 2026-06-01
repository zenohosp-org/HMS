import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { shiftsApi, staffApi, doctorsApi } from "@/utils/api";
import { ChevronLeft, ChevronRight, Loader2, Plus, X, Users } from "lucide-react";
import { Button, Card } from "@/components/ui";

/** Members visible per group card. Not a table page-size; raising it
 *  would let one group's roster monopolise the screen — keep at 5. */
const GROUP_PAGE_SIZE = 5;

/** Shift type palette — kept inline (page-specific, not a candidate
 *  for the design-system tone set). Each entry drives the legend dot,
 *  the day-cell badge, and the popover row. */
const SHIFTS = [
    {
        type: "ON_CALL",
        label: "On call",
        time: "00:00–23:59",
        dot: "var(--hms-gray-400)",
        badge: { bg: "var(--hms-gray-100)", color: "var(--hms-gray-600)", border: "var(--hms-gray-200)" },
    },
    {
        type: "MORNING",
        label: "Morning",
        time: "06:00–14:00",
        dot: "#f59e0b",
        badge: { bg: "var(--hms-warning-bg)", color: "#b45309", border: "var(--hms-warning-border)" },
    },
    {
        type: "GENERAL",
        label: "General",
        time: "09:00–17:00",
        dot: "var(--hms-info)",
        badge: { bg: "var(--hms-info-bg)", color: "#0369a1", border: "var(--hms-info-border)" },
    },
    {
        type: "AFTERNOON",
        label: "Afternoon",
        time: "14:00–22:00",
        dot: "#fb923c",
        badge: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
    },
    {
        type: "NIGHT",
        label: "Night",
        time: "22:00–06:00",
        dot: "#475569",
        badge: { bg: "var(--hms-gray-100)", color: "var(--hms-gray-800)", border: "var(--hms-gray-300)" },
    },
];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMondayOf(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}
function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}
function toISODate(d) {
    return d.toISOString().split("T")[0];
}
function getAvatarTone(role) {
    if (role === "doctor") return { bg: "var(--hms-info-bg)", color: "#0369a1" };
    if (role === "hospital_admin") return { bg: "#fff1f2", color: "#be123c" };
    if (role === "technician") return { bg: "var(--hms-warning-bg)", color: "#b45309" };
    return { bg: "var(--hms-gray-100)", color: "var(--hms-gray-700)" };
}
function getInitials(name) {
    const parts = name.trim().split(" ");
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

/**
 * ShiftRoster — weekly grid editor for staff shift assignments.
 *
 * Phase 8b migration: same data layer (shiftsApi.getWeek/assign/remove,
 * staffApi.list, doctorsApi.list), same week-pagination math, same
 * per-group secondary pagination (5 members visible at a time). Each
 * day-cell still triggers a portalled popover; the popover now uses
 * the .hms-menu / .hms-menu-item classes added in Phase 6 so it shares
 * the design-system look used by every other kebab menu in the app.
 *
 * Shift colours stay inline — they're domain-specific (ON_CALL gray /
 * MORNING amber / GENERAL blue / AFTERNOON orange / NIGHT dark) and
 * don't belong in the global Badge tone set.
 */
function ShiftRoster() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [staffOptions, setStaffOptions] = useState([]);
    const [groupPages, setGroupPages] = useState({});
    const [popover, setPopover] = useState(null); // { staffId, date, x, y, flipUp }
    const [assigningKey, setAssigningKey] = useState(null);
    const popoverRef = useRef(null);

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const todayStr = toISODate(new Date());

    // Close popover on outside click
    useEffect(() => {
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setPopover(null);
            }
        };
        if (popover) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [popover]);

    // Close popover on any-ancestor scroll (matches Menu primitive UX)
    useEffect(() => {
        if (!popover) return;
        const close = () => setPopover(null);
        const onKey = (e) => { if (e.key === "Escape") setPopover(null); };
        window.addEventListener("scroll", close, true);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("keydown", onKey);
        };
    }, [popover]);

    const loadStaff = useCallback(async () => {
        if (!user?.hospitalId) return;
        const [allUsers, doctors] = await Promise.all([
            staffApi.list(user.hospitalId),
            doctorsApi.list(user.hospitalId),
        ]);
        const doctorMap = new Map(doctors.map((d) => [d.userId, d]));
        const options = [];
        allUsers.forEach((u) => {
            if (u.role === "super_admin") return;
            const doc = doctorMap.get(u.id);
            const role = u.role?.toLowerCase() ?? "staff";
            let group;
            if (doc) group = doc.specialization ?? "General Physician";
            else if (role === "hospital_admin") group = "Administration";
            else if (role === "technician") group = "Technicians";
            else group = u.designation ?? "Staff";
            options.push({
                id: u.id,
                name: `${u.firstName} ${u.lastName ?? ""}`.trim(),
                roleDisplay: doc ? "Doctor" : u.roleDisplay ?? u.role,
                designation: doc ? doc.qualification ?? undefined : u.designation ?? undefined,
                group,
                avatarTone: getAvatarTone(role),
            });
        });
        setStaffOptions(options);
    }, [user?.hospitalId]);

    const fetchShifts = useCallback(async () => {
        if (!user?.hospitalId) return;
        setLoading(true);
        try {
            const data = await shiftsApi.getWeek(user.hospitalId, toISODate(weekStart));
            setShifts(data);
        } catch {
            setShifts([]);
        } finally {
            setLoading(false);
        }
    }, [user?.hospitalId, weekStart]);

    useEffect(() => { loadStaff(); }, [loadStaff]);
    useEffect(() => { fetchShifts(); }, [fetchShifts]);

    const groups = Array.from(
        staffOptions.reduce((map, s) => {
            const list = map.get(s.group) ?? [];
            list.push(s);
            map.set(s.group, list);
            return map;
        }, new Map())
    );

    const getShiftsFor = (staffId, date) =>
        shifts.filter((s) => s.staffId === staffId && s.shiftDate === date);

    const openPopover = (staffId, date, triggerEl) => {
        const rect = triggerEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const flipUp = spaceBelow < 260;
        setPopover({
            staffId,
            date,
            x: rect.left,
            y: flipUp ? rect.top : rect.bottom,
            flipUp,
        });
    };

    const handleAssign = async (shiftType) => {
        if (!popover || !user?.hospitalId) return;
        const key = `${popover.staffId}|${popover.date}`;
        setAssigningKey(key);
        setPopover(null);
        try {
            await shiftsApi.assign({
                staffId: popover.staffId,
                hospitalId: user.hospitalId,
                shiftType,
                shiftDate: popover.date,
            });
            fetchShifts();
        } catch (e) {
            notify(e?.response?.data?.message ?? "Could not assign shift", "error");
        } finally {
            setAssigningKey(null);
        }
    };

    const handleRemove = async (shiftId) => {
        try {
            await shiftsApi.remove(shiftId);
            fetchShifts();
        } catch {
            notify("Could not remove shift", "error");
        }
    };

    const weekLabel = `${weekDays[0].getDate()} ${weekDays[0].toLocaleString("en-IN", { month: "short" })} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleString("en-IN", { month: "short" })}, ${weekDays[0].getFullYear()}`;

    return (
        <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Top nav card */}
                <Card style={{ padding: "12px 16px", flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <button
                            type="button"
                            className="hms-btn-icon"
                            onClick={() => setWeekStart((w) => addDays(w, -7))}
                            aria-label="Previous week"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setWeekStart(getMondayOf(new Date()))}
                        >
                            Today
                        </Button>
                        <button
                            type="button"
                            className="hms-btn-icon"
                            onClick={() => setWeekStart((w) => addDays(w, 7))}
                            aria-label="Next week"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <p
                        style={{
                            flex: 1,
                            margin: 0,
                            textAlign: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--hms-gray-800)",
                        }}
                    >
                        {weekLabel}
                    </p>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            flexShrink: 0,
                        }}
                    >
                        {SHIFTS.map((s) => (
                            <span
                                key={s.type}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 11,
                                    color: "var(--hms-gray-500)",
                                }}
                            >
                                <span
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 999,
                                        background: s.dot,
                                        flexShrink: 0,
                                    }}
                                />
                                {s.label}
                            </span>
                        ))}
                    </div>
                </Card>

                {/* Groups */}
                {loading ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "96px 0",
                        }}
                    >
                        <Loader2
                            size={20}
                            style={{ color: "var(--hms-gray-400)" }}
                            className="animate-spin"
                        />
                    </div>
                ) : staffOptions.length === 0 ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "96px 0",
                            gap: 12,
                            color: "var(--hms-gray-500)",
                        }}
                    >
                        <Users size={40} style={{ opacity: 0.3 }} />
                        <p style={{ margin: 0, fontSize: 13 }}>No staff members found</p>
                    </div>
                ) : (
                    groups.map(([groupName, members]) => {
                        const gPage = groupPages[groupName] ?? 1;
                        const totalGroupPages = Math.ceil(members.length / GROUP_PAGE_SIZE);
                        const visibleMembers = members.slice(
                            (gPage - 1) * GROUP_PAGE_SIZE,
                            gPage * GROUP_PAGE_SIZE
                        );
                        const setGPage = (p) =>
                            setGroupPages((prev) => ({ ...prev, [groupName]: p }));
                        return (
                            <Card key={groupName} style={{ padding: 0, overflow: "visible" }}>
                                <div
                                    style={{
                                        padding: "10px 16px",
                                        borderBottom: "1px solid var(--hms-gray-100)",
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
                                            color: "var(--hms-gray-700)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                        }}
                                    >
                                        {groupName}
                                        <span
                                            style={{
                                                marginLeft: 8,
                                                fontWeight: 400,
                                                color: "var(--hms-gray-400)",
                                                textTransform: "none",
                                            }}
                                        >
                                            {members.length}{" "}
                                            {members.length === 1 ? "member" : "members"}
                                        </span>
                                    </p>
                                    {totalGroupPages > 1 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                            <button
                                                type="button"
                                                onClick={() => setGPage(Math.max(1, gPage - 1))}
                                                disabled={gPage === 1}
                                                style={miniNavBtn(gPage === 1)}
                                                aria-label="Previous page"
                                            >
                                                <ChevronLeft size={12} />
                                            </button>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--hms-gray-400)",
                                                    padding: "0 4px",
                                                }}
                                            >
                                                {gPage}/{totalGroupPages}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setGPage(Math.min(totalGroupPages, gPage + 1))
                                                }
                                                disabled={gPage === totalGroupPages}
                                                style={miniNavBtn(gPage === totalGroupPages)}
                                                aria-label="Next page"
                                            >
                                                <ChevronRight size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr style={{ borderBottom: "1px solid var(--hms-gray-100)" }}>
                                                <th
                                                    style={{
                                                        textAlign: "left",
                                                        padding: "8px 16px",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.06em",
                                                        color: "var(--hms-gray-500)",
                                                        width: 192,
                                                    }}
                                                >
                                                    Employee
                                                </th>
                                                {weekDays.map((d) => {
                                                    const ds = toISODate(d);
                                                    const isToday = ds === todayStr;
                                                    return (
                                                        <th
                                                            key={ds}
                                                            style={{
                                                                textAlign: "center",
                                                                padding: "8px",
                                                                width: 96,
                                                                background: isToday ? "var(--hms-info-bg)" : "transparent",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    fontSize: 10,
                                                                    textTransform: "uppercase",
                                                                    letterSpacing: "0.05em",
                                                                    color: isToday ? "var(--hms-info)" : "var(--hms-gray-400)",
                                                                }}
                                                            >
                                                                {DAY_SHORT[d.getDay()]}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: 13,
                                                                    fontWeight: 700,
                                                                    marginTop: 2,
                                                                    color: isToday ? "#0369a1" : "var(--hms-gray-700)",
                                                                }}
                                                            >
                                                                {d.getDate()}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleMembers.map((staff) => (
                                                <tr
                                                    key={staff.id}
                                                    style={{
                                                        borderBottom: "1px solid var(--hms-gray-50)",
                                                    }}
                                                >
                                                    <td style={{ padding: "10px 16px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <div
                                                                style={{
                                                                    width: 28,
                                                                    height: 28,
                                                                    borderRadius: 999,
                                                                    background: staff.avatarTone.bg,
                                                                    color: staff.avatarTone.color,
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    fontSize: 11,
                                                                    fontWeight: 700,
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                {getInitials(staff.name)}
                                                            </div>
                                                            <div style={{ minWidth: 0 }}>
                                                                <p
                                                                    style={{
                                                                        margin: 0,
                                                                        fontSize: 13,
                                                                        fontWeight: 600,
                                                                        color: "var(--hms-gray-800)",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    {staff.name}
                                                                </p>
                                                                <p
                                                                    style={{
                                                                        margin: 0,
                                                                        fontSize: 10,
                                                                        color: "var(--hms-gray-500)",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    {staff.designation ?? staff.roleDisplay}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {weekDays.map((d) => {
                                                        const dateStr = toISODate(d);
                                                        const isToday = dateStr === todayStr;
                                                        const dayShifts = getShiftsFor(staff.id, dateStr);
                                                        const cellKey = `${staff.id}|${dateStr}`;
                                                        const isAssigning = assigningKey === cellKey;
                                                        return (
                                                            <td
                                                                key={dateStr}
                                                                style={{
                                                                    padding: "8px 6px",
                                                                    verticalAlign: "top",
                                                                    background: isToday ? "rgba(239, 246, 255, 0.4)" : "transparent",
                                                                    position: "relative",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        minHeight: 52,
                                                                        display: "flex",
                                                                        flexDirection: "column",
                                                                        gap: 2,
                                                                    }}
                                                                >
                                                                    {isAssigning ? (
                                                                        <div
                                                                            style={{
                                                                                flex: 1,
                                                                                display: "flex",
                                                                                alignItems: "center",
                                                                                justifyContent: "center",
                                                                                borderRadius: 8,
                                                                                border: "1px solid var(--hms-gray-100)",
                                                                                background: "var(--hms-gray-50)",
                                                                            }}
                                                                        >
                                                                            <Loader2
                                                                                size={12}
                                                                                style={{ color: "var(--hms-gray-300)" }}
                                                                                className="animate-spin"
                                                                            />
                                                                        </div>
                                                                    ) : dayShifts.length > 0 ? (
                                                                        <>
                                                                            {dayShifts.map((s) => {
                                                                                const meta = SHIFTS.find((x) => x.type === s.shiftType);
                                                                                if (!meta) return null;
                                                                                return (
                                                                                    <div
                                                                                        key={s.id}
                                                                                        style={{
                                                                                            display: "flex",
                                                                                            alignItems: "center",
                                                                                            justifyContent: "space-between",
                                                                                            gap: 4,
                                                                                            padding: "6px 8px",
                                                                                            borderRadius: 8,
                                                                                            border: `1px solid ${meta.badge.border}`,
                                                                                            background: meta.badge.bg,
                                                                                            color: meta.badge.color,
                                                                                            fontSize: 11,
                                                                                            fontWeight: 600,
                                                                                        }}
                                                                                        className="hms-roster-chip"
                                                                                    >
                                                                                        <span>{meta.label}</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleRemove(s.id)}
                                                                                            className="hms-roster-chip__x"
                                                                                            aria-label="Remove shift"
                                                                                        >
                                                                                            <X size={10} />
                                                                                        </button>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) =>
                                                                                    openPopover(staff.id, dateStr, e.currentTarget)
                                                                                }
                                                                                style={addBtnStyle(false)}
                                                                            >
                                                                                <Plus size={12} />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) =>
                                                                                openPopover(staff.id, dateStr, e.currentTarget)
                                                                            }
                                                                            style={addBtnStyle(true)}
                                                                        >
                                                                            <Plus size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Portalled shift-assign popover. Uses .hms-menu styling from
                hms-system.css so it shares the look of every other kebab
                menu in the app, but keeps a custom open mechanism since
                the trigger is one of 7 day-cells per row. */}
            {popover &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className="hms-menu"
                        style={{
                            left: popover.x,
                            top: popover.flipUp ? undefined : popover.y + 4,
                            bottom: popover.flipUp ? window.innerHeight - popover.y + 4 : undefined,
                            minWidth: 220,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        role="menu"
                    >
                        <div
                            style={{
                                padding: "6px 10px 4px",
                                borderBottom: "1px solid var(--hms-gray-100)",
                                marginBottom: 4,
                            }}
                        >
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "var(--hms-gray-500)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                }}
                            >
                                Assign shift
                            </p>
                        </div>
                        {SHIFTS.map((s) => (
                            <button
                                key={s.type}
                                type="button"
                                role="menuitem"
                                className="hms-menu-item"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleAssign(s.type);
                                }}
                            >
                                <span
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 999,
                                        background: s.dot,
                                        flexShrink: 0,
                                    }}
                                />
                                <span style={{ flex: 1 }}>{s.label}</span>
                                <span style={{ fontSize: 10, color: "var(--hms-gray-500)" }}>
                                    {s.time}
                                </span>
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    );
}

const miniNavBtn = (disabled) => ({
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    border: "1px solid var(--hms-gray-200)",
    background: "transparent",
    color: "var(--hms-gray-400)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.3 : 1,
    transition: "background 0.15s",
});

const addBtnStyle = (large) => ({
    width: "100%",
    flex: large ? 1 : undefined,
    padding: large ? 0 : "4px 0",
    minHeight: large ? 52 : undefined,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    border: `1px ${large ? "solid" : "dashed"} var(--hms-gray-200)`,
    background: large ? "var(--hms-gray-50)" : "transparent",
    color: "var(--hms-gray-300)",
    cursor: "pointer",
    transition: "all 0.15s",
});

export { ShiftRoster as default };
