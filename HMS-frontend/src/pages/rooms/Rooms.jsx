import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api, { infrastructureApi } from "@/utils/api";
import {
  Bed, Search, CalendarClock, MoreHorizontal, ScrollText,
  Building2, Layers, LayoutGrid, ChevronDown, ChevronRight,
  Stethoscope, AlertCircle, User, X, Maximize2, Minimize2, ChevronsUpDown,
  Link2Off,
} from "lucide-react";
import { formatDateTime } from "@/utils/validators";
import { fmtId } from "@/utils/idFormat";
import AssignAttenderModal from "./AssignAttenderModal";
import RoomDetailPanel from "./RoomDetailPanel";

// ─── design tokens ─────────────────────────────────────────────────────────
// Font policy: the app is Inter throughout. `font-mono` is reserved for
// IDENTIFIERS (room codes, UHIDs, allocation tokens, asset labels like
// BLDG-01). Prose, labels, counts, and section headers stay in Inter with
// `tabular-nums` where numeric alignment matters.

const STATUS_DOT = {
  AVAILABLE: "bg-emerald-500",
  OCCUPIED:  "bg-blue-500",
};
const STATUS_TEXT = {
  AVAILABLE: "text-emerald-600 dark:text-emerald-400",
  OCCUPIED:  "text-blue-600 dark:text-blue-400",
};
const ICON_CLASS = {
  AVAILABLE: "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400",
  OCCUPIED:  "bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400",
};
const ACCENT_STRIP = {
  AVAILABLE: "bg-emerald-500",
  OCCUPIED:  "bg-blue-500",
};
const TYPE_BADGE = {
  ICU: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  OT:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
};

// Subtle 24px grid — barely-there backdrop, more presence than texture.
const GRID_BG_STYLE = {
  backgroundImage:
    "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), " +
    "linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

// ─── reusable bits ─────────────────────────────────────────────────────────

function StatusChip({ status }) {
  const dot = STATUS_DOT[status] ?? "bg-slate-300 dark:bg-slate-600";
  const text = STATUS_TEXT[status] ?? "text-slate-400";
  return (
    <div className="inline-flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className={`text-[9px] font-semibold uppercase tracking-wider ${text}`}>{status ?? "Not Set"}</span>
    </div>
  );
}

function OccupancyBar({ occupied, total, size = "md" }) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const fill =
    pct >= 85 ? "bg-rose-500" :
    pct >= 60 ? "bg-amber-500" :
    pct > 0   ? "bg-emerald-500" :
                "bg-slate-300 dark:bg-slate-700";
  const h = size === "sm" ? "h-1" : size === "lg" ? "h-2.5" : "h-1.5";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={`flex-1 bg-slate-100 dark:bg-[#1a1a1a] rounded-full ${h} overflow-hidden`}>
        <div className={`h-full ${fill} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-slate-500 dark:text-[#888] shrink-0 font-semibold">{occupied}/{total}</span>
    </div>
  );
}

function MenuButton({ room, onOpen, alwaysVisible = false }) {
  const btnRef = useRef(null);
  return (
    <button
      ref={btnRef}
      onClick={(e) => { e.stopPropagation(); onOpen(room, btnRef.current); }}
      className={`p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all ${
        alwaysVisible ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
      }`}
    >
      <MoreHorizontal className="w-4 h-4" />
    </button>
  );
}

function InfrastructureRoomCard({ roomInfo, roomData, isSelected, onSelect, onMenuOpen }) {
  const isMultiBed = roomData?.bedCount != null && roomData.bedCount > 1;
  const status = roomData?.status;
  const roomType = roomData?.roomType ?? roomInfo.roomType ?? "GENERAL";
  const accent =
    !roomData ? "bg-slate-300 dark:bg-[#2a2a2a]" :
    ACCENT_STRIP[status] ?? "bg-slate-300 dark:bg-[#2a2a2a]";

  return (
    <div
      onClick={() => roomData && onSelect(roomData)}
      className={`group relative overflow-hidden bg-white dark:bg-[#111] border rounded-lg p-3 pl-3.5 transition-all duration-150 ${
        !roomData ? "opacity-60 cursor-default" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm"
      } ${
        isSelected
          ? "border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/10"
          : "border-slate-200 dark:border-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#2a2a2a]"
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accent}`} />

      <div className="flex items-start gap-2">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${
          ICON_CLASS[status] ?? "bg-slate-50 border-slate-100 text-slate-400 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-slate-600"
        }`}>
          <Bed className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{roomInfo.name}</p>
            {roomData?.roomCode && (
              <span className="text-[10px] font-mono text-slate-400 dark:text-[#777]">{fmtId(roomData.roomCode)}</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
              TYPE_BADGE[roomType] ?? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-[#1e1e1e] dark:text-[#888] dark:border-[#2a2a2a]"
            }`}>
              {roomType}
            </span>
            {isMultiBed && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">
                {roomData.bedCount} beds
              </span>
            )}
            <StatusChip status={status} />
          </div>
        </div>

        {roomData && (
          <div onClick={(e) => e.stopPropagation()}>
            <MenuButton room={roomData} onOpen={onMenuOpen} />
          </div>
        )}
      </div>

      {roomData && status === "OCCUPIED" && roomData.currentPatient && !isMultiBed && (
        <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-200 dark:border-[#1e1e1e] space-y-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="w-3 h-3 text-slate-400 dark:text-[#666] shrink-0" />
            <span className="text-[11px] font-semibold text-slate-800 dark:text-[#dddddd] truncate">
              {roomData.currentPatient.firstName} {roomData.currentPatient.lastName}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-[#777] shrink-0 font-mono">{fmtId(roomData.currentPatient.uhid)}</span>
          </div>
          {roomData.attenderName ? (
            <div className="flex items-baseline gap-1.5 min-w-0 pl-4">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-600 shrink-0">Attender</span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-[#aaa] truncate">
                {roomData.attenderName}
                {roomData.attenderRelationship && <span className="text-[9px] text-slate-400 ml-1">({roomData.attenderRelationship})</span>}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-4">
              <span className="text-[9px] text-amber-500 dark:text-amber-400 font-semibold uppercase tracking-wider">No attender</span>
            </div>
          )}
        </div>
      )}
      {roomData && isMultiBed && (
        <p className="mt-2 text-[10px] text-slate-400 dark:text-[#666] uppercase tracking-wider">Open panel to view beds →</p>
      )}
      {!roomData && (
        <p className="mt-2 text-[10px] text-slate-400 dark:text-[#666] uppercase tracking-wider">Not provisioned</p>
      )}
    </div>
  );
}

function SectionLabel({ icon: Icon, label, count, tone = "default" }) {
  const colors = tone === "onDark"
    ? "text-white/55"
    : "text-slate-400 dark:text-slate-600";
  return (
    <div className={`flex items-center gap-1.5 ${colors}`}>
      <Icon className="w-3 h-3" />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {count != null && <span className="text-[10px] font-bold tabular-nums">· {count}</span>}
    </div>
  );
}

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
  const [menuState, setMenuState] = useState(null); // { room, top?, bottom?, right }

  // Density toggle for room grid — comfortable (4 col) vs compact (6 col).
  const [density, setDensity] = useState("comfortable");

  const normalizeKey = (v) => v?.toString()?.trim()?.toLowerCase() || "";

  const openMenu = (room, btnEl) => {
    const r = btnEl.getBoundingClientRect();
    const flipUp = window.innerHeight - r.bottom < 160;
    setMenuState({
      room,
      right: window.innerWidth - r.right,
      ...(flipUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  };
  const closeMenu = () => setMenuState(null);

  const toggleFloor = (key) => setCollapsedFloors((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleWard  = (key) => setCollapsedWards((prev)  => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

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
    const load = async () => { setLoading(true); await Promise.all([fetchRooms(), fetchInfrastructure()]); setLoading(false); };
    load();
  }, [user?.hospitalId]);

  useEffect(() => {
    if (selectedRoom) {
      const updated = rooms.find((r) => r.id === selectedRoom.id);
      if (updated) setSelectedRoom(updated);
    }
  }, [rooms]);

  // ESC clears search when typed; Cmd/Ctrl+K focuses search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && search) setSearch("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [search]);

  const handleDeleteRoom = async (roomId) => {
    if (!confirm("Permanently delete this room?")) return;
    closeMenu();
    try {
      await api.delete(`/rooms/${roomId}?hospitalId=${user?.hospitalId}`);
      if (selectedRoom?.id === roomId) setSelectedRoom(null);
      fetchRooms();
    } catch (error) { alert(error?.response?.data?.message || "Failed to delete room"); }
  };

  const roomMap = useMemo(() => new Map(rooms.map((r) => [normalizeKey(r.roomNumber), r])), [rooms]);

  const infrastructureRoomKeys = useMemo(() => {
    const keys = new Set();
    infrastructure.forEach((b) => (b.floors || []).forEach((f) => (f.wards || []).forEach((w) => (w.rooms || []).forEach((r) => keys.add(normalizeKey(r.name))))));
    return keys;
  }, [infrastructure]);

  const matchesSearch = (room, q) => {
    if (!q) return true;
    if (room?.roomNumber?.toLowerCase().includes(q)) return true;
    if (room?.currentPatient) return [room.currentPatient.firstName, room.currentPatient.lastName, room.currentPatient.uhid].some((v) => v?.toLowerCase().includes(q));
    return false;
  };

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filter === "AVAILABLE" && r.status !== "AVAILABLE") return false;
      if (filter === "OCCUPIED"  && r.status !== "OCCUPIED")  return false;
      return matchesSearch(r, q);
    }).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms, filter, search]);

  const filteredInfrastructure = useMemo(() => {
    const q = search.trim().toLowerCase();
    return infrastructure.map((building) => ({
      ...building,
      floors: (building.floors || []).map((floor) => ({
        ...floor,
        wards: (floor.wards || []).map((ward) => ({
          ...ward,
          rooms: (ward.rooms || [])
            .map((room) => ({ ...room, roomData: roomMap.get(normalizeKey(room.name)) }))
            .filter((room) => {
              if (filter === "AVAILABLE" && room.roomData?.status !== "AVAILABLE") return false;
              if (filter === "OCCUPIED"  && room.roomData?.status !== "OCCUPIED")  return false;
              return !q || room.name?.toLowerCase().includes(q) || matchesSearch(room.roomData, q);
            }),
        })).filter((w) => w.rooms.length > 0),
      })).filter((f) => f.wards.length > 0),
    })).filter((b) => b.floors.length > 0);
  }, [infrastructure, roomMap, filter, search]);

  const unmappedRooms = useMemo(() => filteredRooms.filter((r) => !infrastructureRoomKeys.has(normalizeKey(r.roomNumber))), [filteredRooms, infrastructureRoomKeys]);

  const showInfrastructureView = infrastructure.length > 0;
  const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
  const occupiedCount  = rooms.filter((r) => r.status === "OCCUPIED").length;
  const occupancyPct = rooms.length > 0 ? Math.round((occupiedCount / rooms.length) * 100) : 0;
  const occupancyTone =
    occupancyPct >= 85 ? { fill: "bg-rose-500",    pill: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20",       label: "At capacity" } :
    occupancyPct >= 60 ? { fill: "bg-amber-500",   pill: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20", label: "High" } :
                         { fill: "bg-emerald-500", pill: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", label: "Healthy" };

  // ICU + OT breakdowns for the metric card footers
  const icuAvailable = rooms.filter((r) => r.roomType === "ICU" && r.status === "AVAILABLE").length;
  const icuOccupied  = rooms.filter((r) => r.roomType === "ICU" && r.status === "OCCUPIED").length;
  const otAvailable  = rooms.filter((r) => r.roomType === "OT"  && r.status === "AVAILABLE").length;
  const otOccupied   = rooms.filter((r) => r.roomType === "OT"  && r.status === "OCCUPIED").length;

  const totalBuildings = infrastructure.length;
  const totalFloors = infrastructure.reduce((s, b) => s + (b.floors?.length || 0), 0);

  const cardProps = (roomData) => ({
    isSelected: selectedRoom?.id === roomData?.id,
    onSelect: (r) => setSelectedRoom((prev) => prev?.id === r.id ? null : r),
    onMenuOpen: openMenu,
  });

  const expandAll = () => { setCollapsedFloors(new Set()); setCollapsedWards(new Set()); };
  const collapseAll = () => {
    const floorKeys = new Set();
    const wardKeys = new Set();
    infrastructure.forEach((b, bIdx) => (b.floors || []).forEach((f, fIdx) => {
      floorKeys.add(f.id ?? `${bIdx}-${fIdx}`);
      (f.wards || []).forEach((w, wIdx) => wardKeys.add(w.id ?? `${bIdx}-${fIdx}-${wIdx}`));
    }));
    setCollapsedFloors(floorKeys);
    setCollapsedWards(wardKeys);
  };

  const roomGridCls = density === "compact"
    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2"
    : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5";

  return (
    <div className="space-y-4">

      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-[#1e1e1e] bg-white dark:bg-[#0a0a0a]"
        style={GRID_BG_STYLE}
      >
        <div className="relative flex items-center justify-between flex-wrap gap-4 p-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-sm">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0] tracking-tight">Room Allocation</h1>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-[#666] uppercase tracking-widest hidden sm:inline">Infrastructure</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#888] mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="tabular-nums font-semibold text-slate-700 dark:text-[#bbb]">{rooms.length}</span>
                <span>rooms</span>
                {showInfrastructureView && (
                  <>
                    <span className="text-slate-300 dark:text-[#444]">·</span>
                    <span className="tabular-nums font-semibold text-slate-700 dark:text-[#bbb]">{totalBuildings}</span>
                    <span>{totalBuildings === 1 ? "building" : "buildings"}</span>
                    <span className="text-slate-300 dark:text-[#444]">·</span>
                    <span className="tabular-nums font-semibold text-slate-700 dark:text-[#bbb]">{totalFloors}</span>
                    <span>{totalFloors === 1 ? "floor" : "floors"}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button className="btn-secondary flex items-center gap-2" onClick={() => navigate("/rooms/logs")}>
            <ScrollText className="w-4 h-4" /> Logs
          </button>
        </div>
      </div>

      {/* ─── Hero metrics ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

        {/* Live Occupancy — spans 2 cols on xl */}
        <div className="xl:col-span-2 bg-white dark:bg-[#111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#888]">Live Occupancy</p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <p className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                  {occupancyPct}<span className="text-2xl text-slate-400 dark:text-[#666] ml-0.5">%</span>
                </p>
                <p className="text-xs tabular-nums text-slate-500 dark:text-[#888]">
                  <span className="font-semibold text-slate-700 dark:text-[#bbb]">{occupiedCount}</span>
                  <span className="text-slate-400 dark:text-[#666]"> / </span>
                  <span className="font-semibold text-slate-700 dark:text-[#bbb]">{rooms.length}</span>
                  <span className="ml-1">occupied</span>
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${occupancyTone.pill}`}>
              {occupancyTone.label}
            </span>
          </div>
          <div className="relative">
            <div className="h-2 bg-slate-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className={`h-full ${occupancyTone.fill} transition-all`} style={{ width: `${occupancyPct}%` }} />
            </div>
            {/* 85% threshold marker */}
            <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-slate-400/60 dark:bg-slate-600/60 rounded-full" style={{ left: "85%" }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-slate-400 dark:text-[#666] uppercase tracking-wider font-medium">Capacity threshold</p>
            <p className="text-[10px] tabular-nums font-semibold text-slate-500 dark:text-[#888]">85%</p>
          </div>
        </div>

        {/* Available */}
        <div className="bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 rounded-xl p-5 flex flex-col">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-500">Available</p>
              <p className="text-3xl font-bold mt-1.5 text-emerald-800 dark:text-emerald-300 tabular-nums leading-none">{availableCount}</p>
            </div>
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-500/20 flex items-center gap-4 text-[10px] tabular-nums">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="font-bold uppercase tracking-wider">ICU</span>
              <span className="font-semibold">{icuAvailable}</span>
            </span>
            <span className="w-px h-3 bg-emerald-300/60 dark:bg-emerald-500/30" />
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="font-bold uppercase tracking-wider">OT</span>
              <span className="font-semibold">{otAvailable}</span>
            </span>
          </div>
        </div>

        {/* Occupied */}
        <div className="bg-blue-50/60 dark:bg-blue-500/10 border border-blue-200/80 dark:border-blue-500/20 rounded-xl p-5 flex flex-col">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-500">Occupied</p>
              <p className="text-3xl font-bold mt-1.5 text-blue-800 dark:text-blue-300 tabular-nums leading-none">{occupiedCount}</p>
            </div>
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-blue-500" />
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-200/60 dark:border-blue-500/20 flex items-center gap-4 text-[10px] tabular-nums">
            <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
              <span className="font-bold uppercase tracking-wider">ICU</span>
              <span className="font-semibold">{icuOccupied}</span>
            </span>
            <span className="w-px h-3 bg-blue-300/60 dark:bg-blue-500/30" />
            <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
              <span className="font-bold uppercase tracking-wider">OT</span>
              <span className="font-semibold">{otOccupied}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── Controls ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-2.5 flex flex-col lg:flex-row lg:items-center gap-2.5">

        {/* Segmented filter */}
        <div className="bg-slate-100 dark:bg-[#0d0d0d] rounded-lg p-1 flex gap-1 shrink-0">
          {["ALL", "AVAILABLE", "OCCUPIED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${
                filter === f
                  ? "bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-[#888] hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >{f}</button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-16 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-[#cccccc] text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#333]/50 placeholder:text-slate-400"
            placeholder="Search rooms, patients, UHID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-[#1a1a1a] hover:bg-slate-200 dark:hover:bg-[#222]"
              title="Clear search (Esc)"
            >
              <X className="w-2.5 h-2.5" /> ESC
            </button>
          )}
        </div>

        {/* Density + expand/collapse */}
        {showInfrastructureView && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="bg-slate-100 dark:bg-[#0d0d0d] rounded-lg p-1 flex gap-1">
              <button
                onClick={() => setDensity("comfortable")}
                className={`p-1.5 rounded-md transition-all ${density === "comfortable"
                  ? "bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-[#888] hover:text-slate-700"}`}
                title="Comfortable (4 cols)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDensity("compact")}
                className={`p-1.5 rounded-md transition-all ${density === "compact"
                  ? "bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-[#888] hover:text-slate-700"}`}
                title="Compact (6 cols)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center bg-slate-100 dark:bg-[#0d0d0d] rounded-lg p-1 gap-1">
              <button
                onClick={expandAll}
                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-[#aaa] hover:bg-white dark:hover:bg-[#222] hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Expand all"
              >Expand</button>
              <button
                onClick={collapseAll}
                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-[#aaa] hover:bg-white dark:hover:bg-[#222] hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Collapse all"
              >Collapse</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Content ─────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-3">
          {loading ? (
            <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-16 flex flex-col items-center justify-center gap-3">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-blue-500" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-[#888]">
                Loading infrastructure
              </span>
            </div>
          ) : showInfrastructureView ? (
            <div className="space-y-3">
              {filteredInfrastructure.map((building, bIdx) => {
                const bRooms = building.floors.flatMap((f) => f.wards.flatMap((w) => w.rooms.map((r) => r.roomData).filter(Boolean)));
                const bOcc = bRooms.filter((r) => r.status === "OCCUPIED").length;
                const bldgCode = `BLDG-${String(bIdx + 1).padStart(2, "0")}`;
                return (
                  <div key={building.id ?? bIdx} className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] overflow-hidden">

                    {/* Building header — dark gradient */}
                    <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-[#1a1a1a] dark:to-[#0f0f0f] border-b border-slate-700 dark:border-[#1e1e1e]">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-white/10 backdrop-blur flex items-center justify-center text-white shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white tracking-tight">{building.name || `Building ${bIdx + 1}`}</p>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mt-0.5">{bldgCode}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <SectionLabel icon={Layers} label="floors" count={building.floors.length} tone="onDark" />
                          <div className="hidden sm:flex items-center gap-2 w-44">
                            <OccupancyBar occupied={bOcc} total={bRooms.length} size="md" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      {building.floors.map((floor, fIdx) => {
                        const floorKey = floor.id ?? `${bIdx}-${fIdx}`;
                        const floorCollapsed = collapsedFloors.has(floorKey);
                        const fRooms = floor.wards.flatMap((w) => w.rooms.map((r) => r.roomData).filter(Boolean));
                        const fOcc = fRooms.filter((r) => r.status === "OCCUPIED").length;
                        return (
                          <div key={floorKey} className="rounded-lg border border-slate-100 dark:border-[#1e1e1e] overflow-hidden">
                            <div
                              onClick={() => toggleFloor(floorKey)}
                              className="flex items-center justify-between px-3 py-2 bg-slate-50/80 dark:bg-[#0f0f0f] border-b border-slate-100 dark:border-[#1e1e1e] hover:bg-slate-100 dark:hover:bg-[#141414] transition-colors cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-2">
                                {floorCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                <Layers className="w-3 h-3 text-slate-400" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{floor.name || `Floor ${fIdx + 1}`}</span>
                                <SectionLabel icon={LayoutGrid} label="wards" count={floor.wards.length} />
                              </div>
                              <div className="hidden sm:flex items-center gap-2 w-36">
                                <OccupancyBar occupied={fOcc} total={fRooms.length} size="sm" />
                              </div>
                            </div>

                            {!floorCollapsed && (
                              <div className="p-3 space-y-3">
                                {floor.wards.map((ward, wIdx) => {
                                  const wardKey = ward.id ?? `${bIdx}-${fIdx}-${wIdx}`;
                                  const wardCollapsed = collapsedWards.has(wardKey);
                                  const wRooms = ward.rooms.map((r) => r.roomData).filter(Boolean);
                                  const wOcc = wRooms.filter((r) => r.status === "OCCUPIED").length;
                                  return (
                                    <div key={wardKey}>
                                      <div
                                        onClick={() => toggleWard(wardKey)}
                                        className="flex items-center justify-between mb-2 px-1.5 py-1 rounded-md hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors cursor-pointer select-none"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          {wardCollapsed ? <ChevronRight className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                                          <LayoutGrid className="w-3 h-3 text-slate-400" />
                                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{ward.name || `Ward ${wIdx + 1}`}</span>
                                          <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-600">· {ward.rooms.length}</span>
                                        </div>
                                        <div className="hidden md:flex items-center gap-2 w-28">
                                          <OccupancyBar occupied={wOcc} total={wRooms.length} size="sm" />
                                        </div>
                                      </div>

                                      {!wardCollapsed && (
                                        <div className={roomGridCls}>
                                          {ward.rooms.map((room) => (
                                            <InfrastructureRoomCard
                                              key={room.name}
                                              roomInfo={room}
                                              roomData={room.roomData}
                                              {...cardProps(room.roomData)}
                                            />
                                          ))}
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

              {/* ─── Unmapped Rooms — clean data-quality callout ─────── */}
              {unmappedRooms.length > 0 && (
                <div className="relative rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] overflow-hidden">
                  {/* Thin amber accent strip on the left */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 dark:bg-amber-500" />
                  <div className="flex items-center justify-between gap-4 px-5 py-3.5 pl-6 border-b border-slate-100 dark:border-[#1e1e1e]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <Link2Off className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Unmapped Rooms</p>
                          <span className="text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
                            {unmappedRooms.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#888] mt-0.5">
                          Exist in room allocation but not linked to the infrastructure tree
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-400 dark:text-[#666] font-semibold">
                      <AlertCircle className="w-3 h-3" />
                      <span>Data quality</span>
                    </div>
                  </div>
                  <div className={`p-3 pl-4 ${roomGridCls}`}>
                    {unmappedRooms.map((room) => (
                      <InfrastructureRoomCard
                        key={room.id}
                        roomInfo={{ name: room.roomNumber, roomType: room.roomType }}
                        roomData={room}
                        {...cardProps(room)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredInfrastructure.length === 0 && unmappedRooms.length === 0 && (
                <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center text-slate-300 dark:text-[#444] mx-auto mb-3">
                    <Bed className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-[#ccc]">No rooms match the current filter</p>
                  <p className="text-xs text-slate-400 dark:text-[#666] mt-1">Try clearing the search or switching filters above.</p>
                </div>
              )}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-16 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center text-slate-300 dark:text-[#444] mx-auto mb-3">
                <Bed className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-[#ccc]">No rooms found matching criteria</p>
              <p className="text-xs text-slate-400 dark:text-[#666] mt-1">Adjust the filter or search above.</p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isMultiBed = room.bedCount != null && room.bedCount > 1;
              const accent = ACCENT_STRIP[room.status] ?? "bg-slate-300 dark:bg-[#2a2a2a]";
              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom((prev) => prev?.id === room.id ? null : room)}
                  className={`group relative overflow-hidden bg-white dark:bg-[#111] border rounded-xl p-4 pl-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-150 hover:shadow-sm ${
                    selectedRoom?.id === room.id
                      ? "border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/10"
                      : "border-slate-200 dark:border-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#2a2a2a]"
                  }`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accent}`} />
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                      ICON_CLASS[room.status] ?? "bg-slate-50 border-slate-100 text-slate-400 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-slate-600"
                    }`}>
                      <Bed className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{room.roomNumber}</p>
                        {room.roomCode && <span className="text-[10px] font-mono text-slate-400">{fmtId(room.roomCode)}</span>}
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                          TYPE_BADGE[room.roomType] ?? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-[#1e1e1e] dark:text-[#888] dark:border-[#2a2a2a]"
                        }`}>{room.roomType}</span>
                        {isMultiBed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#1e1e1e] dark:text-slate-400 dark:border-[#2a2a2a]">
                            {room.bedCount} beds
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <StatusChip status={room.status} />
                      </div>
                    </div>
                  </div>

                  {isMultiBed ? (
                    <div className="flex-1 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222] pt-3 sm:pt-0 flex items-center">
                      <p className="text-xs text-slate-500 dark:text-[#999] uppercase tracking-wider font-medium">Open panel to view beds →</p>
                    </div>
                  ) : room.status === "OCCUPIED" && room.currentPatient ? (
                    <div className="flex-1 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222] pt-3 sm:pt-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div>
                            <p className="text-[10px] text-slate-400 dark:text-[#666] uppercase tracking-widest font-semibold">Patient</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <p className="text-sm font-bold text-slate-800 dark:text-[#ddd]">{room.currentPatient.firstName} {room.currentPatient.lastName}</p>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-[#999] font-mono mt-0.5">{fmtId(room.currentPatient.uhid)}</p>
                          </div>
                          {room.attenderName ? (
                            <div>
                              <p className="text-[10px] text-slate-400 dark:text-[#666] uppercase tracking-widest font-semibold">Attender</p>
                              <p className="text-sm font-medium text-slate-700 dark:text-[#ccc] mt-0.5">
                                {room.attenderName}
                                {room.attenderRelationship && <span className="text-xs text-slate-400 ml-1">({room.attenderRelationship})</span>}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[10px] text-amber-500 dark:text-amber-400 uppercase tracking-wider font-bold">No attender assigned</p>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-2">
                          {room.allocationToken && (
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-semibold">Token</p>
                              <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333] text-sm font-bold font-mono text-slate-900 dark:text-white">
                                {room.allocationToken}
                              </span>
                            </div>
                          )}
                          {room.approxDischargeTime && (
                            <div className="hidden md:block">
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 justify-end uppercase tracking-widest font-semibold">
                                <CalendarClock className="w-3 h-3" /> Est. Discharge
                              </div>
                              <p className="text-xs font-medium text-slate-600 dark:text-[#aaa]">{formatDateTime(room.approxDischargeTime)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222] pt-3 sm:pt-0 flex items-center">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold">Ready for allocation</p>
                    </div>
                  )}

                  <div onClick={(e) => e.stopPropagation()}>
                    <MenuButton room={room} onOpen={openMenu} alwaysVisible />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedRoom && (
          <RoomDetailPanel
            room={selectedRoom}
            onClose={() => setSelectedRoom(null)}
            onRoomUpdated={fetchRooms}
            onViewLogs={() => navigate(`/rooms/logs?roomId=${selectedRoom.id}&roomNumber=${selectedRoom.roomNumber}`)}
          />
        )}
      </div>

      {/* ─── Action menu — portal ─────────────────────────────────────── */}
      {menuState && (() => {
        const room = menuState.room;
        const isMultiBed = room.bedCount != null && room.bedCount > 1;
        const { right, top, bottom } = menuState;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={closeMenu} />
            <div
              style={{ position: "fixed", right, ...(top !== undefined ? { top } : { bottom }), zIndex: 50 }}
              className="w-56 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-slate-100 dark:border-[#252525] overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-slate-100 dark:border-[#252525] bg-slate-50/50 dark:bg-[#141414]">
                <p className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-[#666] font-semibold">Room</p>
                <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{room.roomNumber}</p>
              </div>
              <div className="py-1.5">
                <button
                  onClick={() => { closeMenu(); setSelectedRoom(room); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222] transition-all"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                  {isMultiBed ? "View Beds" : "View Details"}
                </button>
                {room.status === "OCCUPIED" && !isMultiBed && (
                  <button
                    onClick={() => { closeMenu(); setShowAttenderModal({ open: true, room }); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222] transition-all"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {room.attenderName ? "Edit Attender" : "Assign Attender"}
                  </button>
                )}
                {room.status === "AVAILABLE" && (
                  <>
                    <div className="h-px bg-slate-100 dark:bg-[#252525] my-1" />
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Delete Room
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {showAttenderModal.open && showAttenderModal.room && (
        <AssignAttenderModal
          roomId={showAttenderModal.room.id}
          roomNumber={showAttenderModal.room.roomNumber}
          existing={{
            name: showAttenderModal.room.attenderName,
            phone: showAttenderModal.room.attenderPhone,
            relationship: showAttenderModal.room.attenderRelationship,
          }}
          onClose={() => setShowAttenderModal({ open: false, room: null })}
          onSuccess={() => { setShowAttenderModal({ open: false, room: null }); fetchRooms(); }}
        />
      )}
    </div>
  );
}

export default Rooms;
