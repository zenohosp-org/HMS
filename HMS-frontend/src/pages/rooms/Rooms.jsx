import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api, { infrastructureApi } from "@/utils/api";
import { Bed, Search, CalendarClock, MoreHorizontal, ScrollText, Building2, Layers, LayoutGrid } from "lucide-react";
import { formatDateTime } from "@/utils/validators";
import AllocatePatientModal from "./AllocatePatientModal";
import AssignAttenderModal from "./AssignAttenderModal";
import RoomDetailPanel from "./RoomDetailPanel";

function RoomActionMenu({ room, onAllocate, onAssignAttender, onDeallocate, onDelete, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isMultiBed = room.bedCount != null && room.bedCount > 1;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all ${compact ? "p-1.5" : "p-2"}`}
      >
        <MoreHorizontal className={compact ? "w-4 h-4" : "w-5 h-5"} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-slate-100 dark:border-[#252525] py-1.5 overflow-hidden">
          {room.status === "AVAILABLE" && (
            <button
              onClick={() => { setOpen(false); onAllocate(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222] transition-all"
            >
              {isMultiBed ? "Assign to Bed" : "Allocate Patient"}
            </button>
          )}
          {room.status === "OCCUPIED" && !isMultiBed && (
            <button
              onClick={() => { setOpen(false); onAssignAttender(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222] transition-all"
            >
              {room.attenderName ? "Edit Attender" : "Assign Attender"}
            </button>
          )}
          {room.status === "OCCUPIED" && !isMultiBed && (
            <>
              <div className="h-px bg-slate-50 dark:bg-[#252525] my-1" />
              <button
                onClick={() => { setOpen(false); onDeallocate(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
              >
                Deallocate
              </button>
            </>
          )}
          {room.status === "AVAILABLE" && (
            <>
              <div className="h-px bg-slate-50 dark:bg-[#252525] my-1" />
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
              >
                Delete Room
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
const TYPE_BADGE = {
  ICU: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  OT:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
};

function InfrastructureRoomCard({ roomInfo, roomData, isSelected, onSelect, onAllocate, onAssignAttender, onDeallocate, onDelete }) {
  const isMultiBed = roomData?.bedCount != null && roomData.bedCount > 1;
  const status = roomData?.status;
  const roomType = roomData?.roomType ?? roomInfo.roomType ?? "GENERAL";

  return (
    <div
      onClick={() => roomData && onSelect(roomData)}
      className={`relative bg-white dark:bg-[#111111] border rounded-xl p-3 transition-all group ${
        !roomData ? "opacity-60 cursor-default" : "cursor-pointer"
      } ${
        isSelected
          ? "border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/10"
          : "border-slate-200 dark:border-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#2a2a2a]"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
          ICON_CLASS[status] ?? "bg-slate-50 border-slate-100 text-slate-400 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-slate-600"
        }`}>
          <Bed className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap leading-none">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{roomInfo.name}</p>
            {roomData?.roomCode && (
              <span className="text-[9px] font-mono text-slate-400 dark:text-[#888888]">{roomData.roomCode}</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${
              TYPE_BADGE[roomType] ?? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-[#1e1e1e] dark:text-[#888888] dark:border-[#2a2a2a]"
            }`}>
              {roomType}
            </span>
            {isMultiBed && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">
                {roomData.bedCount} beds
              </span>
            )}
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] ?? "bg-slate-300 dark:bg-slate-600"}`} />
              <span className={`text-[9px] font-semibold uppercase tracking-wide ${STATUS_TEXT[status] ?? "text-slate-400"}`}>
                {status ?? "Not Set"}
              </span>
            </div>
          </div>
        </div>

        {roomData && (
          <div onClick={(e) => e.stopPropagation()}>
            <RoomActionMenu compact
              room={roomData}
              onAllocate={() => onAllocate(roomData)}
              onAssignAttender={() => onAssignAttender(roomData)}
              onDeallocate={() => onDeallocate(roomData.id)}
              onDelete={() => onDelete(roomData.id)}
            />
          </div>
        )}
      </div>

      {/* Patient info */}
      {roomData && status === "OCCUPIED" && roomData.currentPatient && !isMultiBed && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1a1a1a] space-y-1">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-600 shrink-0 w-11">Patient</span>
            <span className="text-[11px] font-semibold text-slate-800 dark:text-[#dddddd] truncate">
              {roomData.currentPatient.firstName} {roomData.currentPatient.lastName}
            </span>
            <span className="text-[9px] text-slate-400 dark:text-[#888888] shrink-0 font-mono">{roomData.currentPatient.uhid}</span>
          </div>
          {roomData.attenderName ? (
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-600 shrink-0 w-11">Attender</span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-[#aaaaaa] truncate">
                {roomData.attenderName}
                {roomData.attenderRelationship && <span className="text-[9px] text-slate-400 ml-1">({roomData.attenderRelationship})</span>}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="w-11 shrink-0" />
              <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium">No attender</span>
            </div>
          )}
        </div>
      )}
      {roomData && isMultiBed && (
        <p className="mt-2 text-[10px] text-slate-400 dark:text-[#666666]">Open panel to view beds</p>
      )}
      {!roomData && (
        <p className="mt-2 text-[10px] text-slate-400 dark:text-[#666666]">Not created in room allocation</p>
      )}
    </div>
  );
}

function SectionLabel({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-slate-400 dark:text-slate-600" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">{label}</span>
      {count != null && (
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600">· {count}</span>
      )}
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
  const [showAllocateModal, setShowAllocateModal] = useState({ open: false, room: null });
  const [showAttenderModal, setShowAttenderModal] = useState({ open: false, room: null });
  const [infrastructure, setInfrastructure] = useState([]);

  const normalizeKey = (value) => value?.toString()?.trim()?.toLowerCase() || "";

  const fetchRooms = async () => {
    try {
      const { data } = await api.get(`/rooms?hospitalId=${user?.hospitalId}`);
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch rooms", error);
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
  }, [user?.hospitalId]);

  useEffect(() => {
    if (selectedRoom) {
      const updated = rooms.find((r) => r.id === selectedRoom.id);
      if (updated) setSelectedRoom(updated);
    }
  }, [rooms]);

  const handleDeallocate = async (roomId) => {
    if (!confirm("Deallocate this room?")) return;
    try {
      await api.post(`/rooms/${roomId}/deallocate?hospitalId=${user?.hospitalId}`);
      if (selectedRoom?.id === roomId) setSelectedRoom(null);
      fetchRooms();
    } catch {
      alert("Failed to deallocate room");
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm("Permanently delete this room?")) return;
    try {
      await api.delete(`/rooms/${roomId}?hospitalId=${user?.hospitalId}`);
      if (selectedRoom?.id === roomId) setSelectedRoom(null);
      fetchRooms();
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to delete room");
    }
  };

  const roomMap = useMemo(() => new Map(rooms.map((r) => [normalizeKey(r.roomNumber), r])), [rooms]);

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

  const matchesSearch = (room, query) => {
    if (!query) return true;
    if (room?.roomNumber?.toLowerCase().includes(query)) return true;
    if (room?.currentPatient) {
      return [room.currentPatient.firstName, room.currentPatient.lastName, room.currentPatient.uhid]
        .some((v) => v?.toLowerCase().includes(query));
    }
    return false;
  };

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rooms
      .filter((r) => {
        if (filter === "AVAILABLE" && r.status !== "AVAILABLE") return false;
        if (filter === "OCCUPIED" && r.status !== "OCCUPIED") return false;
        return matchesSearch(r, query);
      })
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms, filter, search]);

  const filteredInfrastructure = useMemo(() => {
    const query = search.trim().toLowerCase();
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
                  .map((room) => ({ ...room, roomData: roomMap.get(normalizeKey(room.name)) }))
                  .filter((room) => {
                    if (filter === "AVAILABLE" && room.roomData?.status !== "AVAILABLE") return false;
                    if (filter === "OCCUPIED" && room.roomData?.status !== "OCCUPIED") return false;
                    if (!query) return true;
                    return room.name?.toLowerCase().includes(query) || matchesSearch(room.roomData, query);
                  }),
              }))
              .filter((ward) => ward.rooms.length > 0),
          }))
          .filter((floor) => floor.wards.length > 0),
      }))
      .filter((building) => building.floors.length > 0);
  }, [infrastructure, roomMap, filter, search]);

  const unmappedRooms = useMemo(() =>
    filteredRooms.filter((r) => !infrastructureRoomKeys.has(normalizeKey(r.roomNumber))),
    [filteredRooms, infrastructureRoomKeys]
  );

  const showInfrastructureView = infrastructure.length > 0;
  const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
  const occupiedCount  = rooms.filter((r) => r.status === "OCCUPIED").length;

  const roomCardProps = (room, roomData) => ({
    isSelected: selectedRoom?.id === (roomData ?? room).id,
    onSelect: (r) => setSelectedRoom((prev) => prev?.id === r.id ? null : r),
    onAllocate: (r) => setShowAllocateModal({ open: true, room: r }),
    onAssignAttender: (r) => setShowAttenderModal({ open: true, room: r }),
    onDeallocate: handleDeallocate,
    onDelete: handleDeleteRoom,
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Room Allocation</h1>
          <p className="text-sm text-slate-500 dark:text-[#666666]">
            {rooms.length} total rooms
            {showInfrastructureView
              ? ` · ${infrastructure.length} buildings · ${infrastructure.reduce((s, b) => s + (b.floors?.length || 0), 0)} floors`
              : ""}
          </p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={() => navigate("/rooms/logs")}>
          <ScrollText className="w-4 h-4" /> Logs
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Rooms", value: rooms.length, cls: "bg-white dark:bg-[#111111] border-slate-200 dark:border-[#1e1e1e]", text: "text-slate-800 dark:text-[#e0e0e0]", sub: "text-slate-500 dark:text-[#666666]", dot: "bg-slate-400" },
          { label: "Available",   value: availableCount, cls: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", text: "text-emerald-800 dark:text-emerald-300", sub: "text-emerald-600 dark:text-emerald-500", dot: "bg-emerald-500" },
          { label: "Occupied",    value: occupiedCount,  cls: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20", text: "text-blue-800 dark:text-blue-300", sub: "text-blue-600 dark:text-blue-500", dot: "bg-blue-500" },
        ].map(({ label, value, cls, text, sub, dot }) => (
          <div key={label} className={`border rounded-xl p-4 flex items-center justify-between ${cls}`}>
            <div>
              <p className={`text-xs font-semibold ${sub}`}>{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${text}`}>{value}</p>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2">
          {["ALL", "AVAILABLE", "OCCUPIED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filter === f
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-md"
                  : "bg-white text-slate-500 border border-slate-200 dark:bg-[#111111] dark:border-[#222222] hover:bg-slate-50 dark:hover:bg-[#1a1a1a]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/50"
            placeholder="Search rooms or patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 space-y-3">
          {loading ? (
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center text-slate-500 dark:text-[#666666]">
              Loading rooms…
            </div>
          ) : showInfrastructureView ? (
            <div className="space-y-3">
              {filteredInfrastructure.map((building, bIdx) => (
                <div key={building.id ?? bIdx} className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111]">
                  {/* Building header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#0d0d0d] border-b border-slate-200 dark:border-[#1e1e1e] rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {building.name || `Building ${bIdx + 1}`}
                      </span>
                    </div>
                    <SectionLabel icon={Layers} label="floors" count={building.floors.length} />
                  </div>

                  <div className="p-3 space-y-3">
                    {building.floors.map((floor, fIdx) => (
                      <div key={floor.id ?? fIdx} className="rounded-lg border border-slate-100 dark:border-[#1e1e1e]">
                        {/* Floor header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 dark:bg-[#0f0f0f] border-b border-slate-100 dark:border-[#1e1e1e] rounded-t-lg">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3 h-3 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {floor.name || `Floor ${fIdx + 1}`}
                            </span>
                          </div>
                          <SectionLabel icon={LayoutGrid} label="wards" count={floor.wards.length} />
                        </div>

                        <div className="p-3 space-y-3">
                          {floor.wards.map((ward, wIdx) => (
                            <div key={ward.id ?? wIdx}>
                              {/* Ward label */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <LayoutGrid className="w-3 h-3 text-slate-400" />
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    {ward.name || `Ward ${wIdx + 1}`}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-600">{ward.rooms.length} rooms</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                                {ward.rooms.map((room) => (
                                  <InfrastructureRoomCard
                                    key={room.name}
                                    roomInfo={room}
                                    roomData={room.roomData}
                                    {...roomCardProps(room, room.roomData)}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {unmappedRooms.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111]">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#0d0d0d] border-b border-slate-200 dark:border-[#1e1e1e] rounded-t-xl">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Unmapped Rooms</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-600">{unmappedRooms.length} rooms</span>
                  </div>
                  <div className="p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                    {unmappedRooms.map((room) => (
                      <InfrastructureRoomCard
                        key={room.id}
                        roomInfo={{ name: room.roomNumber, roomType: room.roomType }}
                        roomData={room}
                        {...roomCardProps(room, room)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredInfrastructure.length === 0 && unmappedRooms.length === 0 && (
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center text-slate-500 dark:text-[#666666]">
                  No rooms found matching criteria.
                </div>
              )}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-xl p-8 text-center text-slate-500 dark:text-[#666666]">
              No rooms found matching criteria.
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isMultiBed = room.bedCount != null && room.bedCount > 1;
              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom((prev) => prev?.id === room.id ? null : room)}
                  className={`bg-white dark:bg-[#111111] border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all ${
                    selectedRoom?.id === room.id
                      ? "border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/10"
                      : room.status === "AVAILABLE"
                      ? "border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300"
                      : "border-slate-200 dark:border-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#2a2a2a]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                      ICON_CLASS[room.status] ?? "bg-slate-50 border-slate-100 text-slate-400 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-slate-600"
                    }`}>
                      <Bed className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{room.roomNumber}</p>
                        {room.roomCode && <span className="text-[10px] font-mono text-slate-400">{room.roomCode}</span>}
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${
                          TYPE_BADGE[room.roomType] ?? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-[#1e1e1e] dark:text-[#888888] dark:border-[#2a2a2a]"
                        }`}>{room.roomType}</span>
                        {isMultiBed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#1e1e1e] dark:text-slate-400 dark:border-[#2a2a2a]">
                            {room.bedCount} beds
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[room.status] ?? "bg-slate-300"}`} />
                        <p className={`text-xs font-semibold ${STATUS_TEXT[room.status] ?? "text-slate-400"}`}>{room.status}</p>
                      </div>
                    </div>
                  </div>

                  {isMultiBed ? (
                    <div className="flex-1 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-3 sm:pt-0 flex items-center">
                      <p className="text-sm text-slate-500 dark:text-[#999999]">Open panel to view beds</p>
                    </div>
                  ) : room.status === "OCCUPIED" && room.currentPatient ? (
                    <div className="flex-1 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-3 sm:pt-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div>
                            <p className="text-[10px] text-slate-400 dark:text-[#666666] uppercase tracking-wide">Patient</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">
                              {room.currentPatient.firstName} {room.currentPatient.lastName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-[#999999] font-mono">{room.currentPatient.uhid}</p>
                          </div>
                          {room.attenderName ? (
                            <div>
                              <p className="text-[10px] text-slate-400 dark:text-[#666666] uppercase tracking-wide">Attender</p>
                              <p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">
                                {room.attenderName}
                                {room.attenderRelationship && <span className="text-xs text-slate-400 ml-1">({room.attenderRelationship})</span>}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-500 dark:text-amber-400">No attender assigned</p>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-2">
                          {room.allocationToken && (
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Token</p>
                              <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333333] text-sm font-bold font-mono text-slate-900 dark:text-white">
                                {room.allocationToken}
                              </span>
                            </div>
                          )}
                          {room.approxDischargeTime && (
                            <div className="hidden md:block">
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 justify-end">
                                <CalendarClock className="w-3 h-3" /> Est. Discharge
                              </div>
                              <p className="text-xs font-medium text-slate-600 dark:text-[#aaaaaa]">{formatDateTime(room.approxDischargeTime)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-3 sm:pt-0 flex items-center">
                      <p className="text-sm text-slate-500 dark:text-[#999999]">Ready for allocation</p>
                    </div>
                  )}

                  <RoomActionMenu
                    room={room}
                    onAllocate={() => setShowAllocateModal({ open: true, room })}
                    onAssignAttender={() => setShowAttenderModal({ open: true, room })}
                    onDeallocate={() => handleDeallocate(room.id)}
                    onDelete={() => handleDeleteRoom(room.id)}
                  />
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

      {showAllocateModal.open && showAllocateModal.room && (
        <AllocatePatientModal
          roomId={showAllocateModal.room.id}
          roomNumber={showAllocateModal.room.roomNumber}
          bedCount={showAllocateModal.room.bedCount}
          hospitalId={user?.hospitalId}
          onClose={() => setShowAllocateModal({ open: false, room: null })}
          onSuccess={() => { setShowAllocateModal({ open: false, room: null }); fetchRooms(); }}
        />
      )}
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
