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

/** Shift type palette — visual mapping lives in admin.css under
 *  .hms-shift-dot--* and .hms-shift-chip--*. Domain-specific (ON_CALL
 *  gray / MORNING amber / GENERAL blue / AFTERNOON orange / NIGHT
 *  dark); not part of the global Badge tone set. */
const SHIFTS = [
    { type: "ON_CALL",   label: "On call",   time: "00:00–23:59", mod: "oncall" },
    { type: "MORNING",   label: "Morning",   time: "06:00–14:00", mod: "morning" },
    { type: "GENERAL",   label: "General",   time: "09:00–17:00", mod: "general" },
    { type: "AFTERNOON", label: "Afternoon", time: "14:00–22:00", mod: "afternoon" },
    { type: "NIGHT",     label: "Night",     time: "22:00–06:00", mod: "night" },
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
function getAvatarMod(role) {
    if (role === "doctor") return "is-doctor";
    if (role === "hospital_admin") return "is-admin";
    if (role === "technician") return "is-technician";
    return "";
}
function getInitials(name) {
    const parts = name.trim().split(" ");
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

/**
 * ShiftRoster — weekly grid editor for staff shift assignments.
 * Layout pieces live in admin.css under .hms-shift-*. The day-cell
 * popover uses the .hms-menu primitive from hms-system.css plus
 * .hms-shift-menu* tweaks; it stays a hand-rolled portal because the
 * trigger is one of 7 day-cells per row rather than a single button.
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

    useEffect(() => {
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setPopover(null);
            }
        };
        if (popover) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [popover]);

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
                avatarMod: getAvatarMod(role),
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

    /* The popover position is per-instance (x/y from a getBoundingClientRect)
       so it stays as an inline style. Everything else moved to CSS. */
    const popoverPositionStyle = popover && {
        left: popover.x,
        top: popover.flipUp ? undefined : popover.y + 4,
        bottom: popover.flipUp ? window.innerHeight - popover.y + 4 : undefined,
    };

    return (
        <>
            <div className="flex flex-col gap-3">
                {/* Top nav card */}
                <Card className="hms-shift-nav">
                    <div className="hms-shift-nav__controls">
                        <button
                            type="button"
                            className="hms-shift-nav-btn"
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
                            className="hms-shift-nav-btn"
                            onClick={() => setWeekStart((w) => addDays(w, 7))}
                            aria-label="Next week"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <p className="hms-shift-nav__week-label">{weekLabel}</p>
                    <div className="hms-shift-legend">
                        {SHIFTS.map((s) => (
                            <span key={s.type} className="hms-shift-legend__item">
                                <span className={`hms-shift-legend__dot hms-shift-dot--${s.mod}`} />
                                {s.label}
                            </span>
                        ))}
                    </div>
                </Card>

                {/* Groups */}
                {loading ? (
                    <div className="hms-shift-state">
                        <Loader2 size={20} className="text-gray-400 animate-spin" />
                    </div>
                ) : staffOptions.length === 0 ? (
                    <div className="hms-shift-state is-empty">
                        <Users size={40} className="hms-shift-state__icon-dim" />
                        <p className="m-0 text-13">No staff members found</p>
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
                            <Card key={groupName} className="hms-shift-group">
                                <div className="hms-shift-group__head">
                                    <p className="hms-shift-group__title">
                                        {groupName}
                                        <span className="hms-shift-group__count">
                                            {members.length}{" "}
                                            {members.length === 1 ? "member" : "members"}
                                        </span>
                                    </p>
                                    {totalGroupPages > 1 && (
                                        <div className="hms-shift-group__paging">
                                            <button
                                                type="button"
                                                onClick={() => setGPage(Math.max(1, gPage - 1))}
                                                disabled={gPage === 1}
                                                className="hms-shift-nav-btn"
                                                aria-label="Previous page"
                                            >
                                                <ChevronLeft size={12} />
                                            </button>
                                            <span className="hms-shift-group__paging-label">
                                                {gPage}/{totalGroupPages}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setGPage(Math.min(totalGroupPages, gPage + 1))
                                                }
                                                disabled={gPage === totalGroupPages}
                                                className="hms-shift-nav-btn"
                                                aria-label="Next page"
                                            >
                                                <ChevronRight size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="hms-shift-table-wrap">
                                    <table className="hms-shift-table">
                                        <thead>
                                            <tr>
                                                <th className="hms-shift-table__col-employee">
                                                    Employee
                                                </th>
                                                {weekDays.map((d) => {
                                                    const ds = toISODate(d);
                                                    const isToday = ds === todayStr;
                                                    return (
                                                        <th
                                                            key={ds}
                                                            className={`hms-shift-table__col-day ${isToday ? "is-today" : ""}`}
                                                        >
                                                            <div className="hms-shift-table__day-name">
                                                                {DAY_SHORT[d.getDay()]}
                                                            </div>
                                                            <div className="hms-shift-table__day-num">
                                                                {d.getDate()}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleMembers.map((staff) => (
                                                <tr key={staff.id}>
                                                    <td className="hms-shift-table__employee">
                                                        <div className="hms-shift-table__employee-row">
                                                            <span className={`hms-shift-avatar ${staff.avatarMod}`}>
                                                                {getInitials(staff.name)}
                                                            </span>
                                                            <div className="hms-shift-table__employee-body">
                                                                <p className="hms-shift-table__employee-name">
                                                                    {staff.name}
                                                                </p>
                                                                <p className="hms-shift-table__employee-role">
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
                                                                className={`hms-shift-table__cell ${isToday ? "is-today" : ""}`}
                                                            >
                                                                <div className="hms-shift-table__cell-body">
                                                                    {isAssigning ? (
                                                                        <div className="hms-shift-table__loading">
                                                                            <Loader2
                                                                                size={12}
                                                                                className="hms-shift-state__icon-mid animate-spin"
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
                                                                                        className={`hms-shift-chip hms-shift-chip--${meta.mod}`}
                                                                                    >
                                                                                        <span>{meta.label}</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleRemove(s.id)}
                                                                                            className="hms-shift-chip__remove"
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
                                                                                className="hms-shift-add-btn"
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
                                                                            className="hms-shift-add-btn is-large"
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
                        className="hms-menu hms-shift-menu"
                        style={popoverPositionStyle}
                        onMouseDown={(e) => e.stopPropagation()}
                        role="menu"
                    >
                        <div className="hms-shift-menu__header">
                            <p className="hms-shift-menu__header-label">Assign shift</p>
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
                                <span className={`hms-shift-menu__dot hms-shift-dot--${s.mod}`} />
                                <span className="flex-1">{s.label}</span>
                                <span className="hms-shift-menu__time">{s.time}</span>
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    );
}

export { ShiftRoster as default };
