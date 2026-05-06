import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api, { infrastructureApi } from "@/utils/api";
import { Bed, Search, CalendarClock, MoreVertical, ScrollText } from "lucide-react";
import { formatDateTime } from "@/utils/validators";
import AllocatePatientModal from "./AllocatePatientModal";
import AssignAttenderModal from "./AssignAttenderModal";
import RoomDetailPanel from "./RoomDetailPanel";

function RoomActionMenu({ room, onAllocate, onAssignAttender, onDeallocate, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isMultiBed = room.bedCount != null && room.bedCount > 1;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-lg overflow-hidden">
          {room.status === "AVAILABLE" && (
            <button
              onClick={() => { setOpen(false); onAllocate(); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
            >
              {isMultiBed ? "Assign to Bed" : "Allocate Patient"}
            </button>
          )}
          {room.status === "OCCUPIED" && !isMultiBed && (
            <>
              <button
                onClick={() => { setOpen(false); onAssignAttender(); }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors"
              >
                {room.attenderName ? "Edit Attender" : "Assign Attender"}
              </button>
              <div className="border-t border-slate-100 dark:border-[#2a2a2a]" />
              <button
                onClick={() => { setOpen(false); onDeallocate(); }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                Deallocate
              </button>
            </>
          )}
          {room.status === "AVAILABLE" && (
            <>
              <div className="border-t border-slate-100 dark:border-[#2a2a2a]" />
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
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

function InfrastructureRoomCard({ roomInfo, roomData, isSelected, onSelect, onAllocate, onAssignAttender, onDeallocate, onDelete }) {
  const isMultiBed = roomData?.bedCount != null && roomData.bedCount > 1;
  const statusLabel = roomData ? roomData.status : "NOT CREATED";
  const badgeClass = roomData?.roomType === "ICU"
    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]";

  return (
    <div
      onClick={() => roomData && onSelect(roomData)}
      className={`bg-white dark:bg-[#111111] border rounded-lg p-4 flex flex-col gap-3 cursor-pointer transition-colors ${
        isSelected ? "border-slate-400 dark:border-[#444444]" : "border-slate-200 dark:border-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#2a2a2a]"
      } ${!roomData ? "opacity-90" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border ${roomData?.status === "AVAILABLE" ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400" : "bg-slate-50 border-slate-100 text-slate-500 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-[#888888]"}`}>
          <Bed className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{roomInfo.name}</p>
            {roomData?.roomCode && (
              <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-[#999999]">{roomData.roomCode}</span>
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${badgeClass}`}>
              {roomData?.roomType ?? roomInfo.roomType ?? "GENERAL"}
            </span>
            {isMultiBed && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">
                {roomData.bedCount} beds
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 font-medium ${
            roomData?.status === "AVAILABLE"
              ? "text-emerald-600 dark:text-emerald-400"
              : roomData?.status === "OCCUPIED"
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-500 dark:text-[#999999]"
          }`}>
            {statusLabel}
          </p>
        </div>
      </div>

      {roomData ? (
        roomData.bedCount > 1 ? (
          <div className="text-sm text-slate-600 dark:text-[#999999]">Open panel to view beds</div>
        ) : roomData.status === "OCCUPIED" && roomData.currentPatient ? (
          <div className="space-y-2 text-sm text-slate-600 dark:text-[#999999]">
            <div>
              <p className="text-xs text-slate-500 dark:text-[#666666]">Patient</p>
              <p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">{roomData.currentPatient.firstName} {roomData.currentPatient.lastName}</p>
              <p className="text-[11px] text-slate-600 dark:text-[#999999]">{roomData.currentPatient.mrn}</p>
            </div>
            {roomData.attenderName ? (
              <div>
                <p className="text-xs text-slate-500 dark:text-[#666666]">Attender</p>
                <p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">
                  {roomData.attenderName}
                  {roomData.attenderRelationship && (
                    <span className="text-xs text-slate-600 dark:text-[#999999] ml-1">({roomData.attenderRelationship})</span>
                  )}
                </p>
                {roomData.attenderPhone && (
                  <p className="text-[11px] text-slate-600 dark:text-[#999999]">{roomData.attenderPhone}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-500 dark:text-amber-400">No attender assigned</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-600 dark:text-[#999999]">Ready for allocation</div>
        )
      ) : (
        <div className="text-sm text-slate-500 dark:text-[#999999]">Infrastructure room is not yet created in Room Allocation.</div>
      )}

      {roomData && (
        <RoomActionMenu
          room={roomData}
          onAllocate={() => onAllocate(roomData)}
          onAssignAttender={() => onAssignAttender(roomData)}
          onDeallocate={() => onDeallocate(roomData.id)}
          onDelete={() => onDelete(roomData.id)}
        />
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
    } catch (error) {
      console.error("Failed to fetch infrastructure", error);
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
    if (!confirm("Are you sure you want to deallocate this room?")) return;
    try {
      await api.post(`/rooms/${roomId}/deallocate?hospitalId=${user?.hospitalId}`);
      if (selectedRoom?.id === roomId) setSelectedRoom(null);
      fetchRooms();
    } catch (error) {
      console.error("Failed to deallocate", error);
      alert("Failed to deallocate room");
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm("Permanently delete this room? This cannot be undone.")) return;
    try {
      await api.delete(`/rooms/${roomId}?hospitalId=${user?.hospitalId}`);
      if (selectedRoom?.id === roomId) setSelectedRoom(null);
      fetchRooms();
    } catch (error) {
      const msg = error?.response?.data?.message || "Failed to delete room";
      alert(msg);
    }
  };

  const roomMap = useMemo(() => {
    return new Map(rooms.map((room) => [normalizeKey(room.roomNumber), room]));
  }, [rooms]);

  const infrastructureRoomKeys = useMemo(() => {
    const keys = new Set();
    infrastructure.forEach((building) => {
      (building.floors || []).forEach((floor) => {
        (floor.wards || []).forEach((ward) => {
          (ward.rooms || []).forEach((room) => keys.add(normalizeKey(room.name)));
        });
      });
    });
    return keys;
  }, [infrastructure]);

  const matchesSearch = (room, query) => {
    if (!query) return true;
    if (room?.roomNumber?.toLowerCase().includes(query)) return true;
    if (room?.currentPatient) {
      return [room.currentPatient.firstName, room.currentPatient.lastName, room.currentPatient.mrn].some((value) =>
        value?.toLowerCase().includes(query)
      );
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
                  .map((room) => ({
                    ...room,
                    roomData: roomMap.get(normalizeKey(room.name)),
                  }))
                  .filter((room) => {
                    if (filter === "AVAILABLE" && room.roomData?.status !== "AVAILABLE") return false;
                    if (filter === "OCCUPIED" && room.roomData?.status !== "OCCUPIED") return false;
                    if (!query) return true;
                    return (
                      room.name?.toLowerCase().includes(query) ||
                      matchesSearch(room.roomData, query)
                    );
                  }),
              }))
              .filter((ward) => ward.rooms.length > 0),
          }))
          .filter((floor) => floor.wards.length > 0),
      }))
      .filter((building) => building.floors.length > 0);
  }, [infrastructure, roomMap, filter, search]);

  const unmappedRooms = useMemo(() => {
    return filteredRooms.filter((room) => !infrastructureRoomKeys.has(normalizeKey(room.roomNumber)));
  }, [filteredRooms, infrastructureRoomKeys]);

  const showInfrastructureView = infrastructure.length > 0;
  const buildingCount = infrastructure.length;
  const floorCount = infrastructure.reduce((sum, building) => sum + (building.floors?.length || 0), 0);

  const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
  const occupiedCount = rooms.filter((r) => r.status === "OCCUPIED").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Room Allocation</h1>
          <p className="text-sm text-slate-500 dark:text-[#666666]">
            {rooms.length} total rooms in hospital
            {showInfrastructureView ? ` · ${buildingCount} buildings · ${floorCount} floors` : ""}
          </p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={() => navigate("/rooms/logs")}>
          <ScrollText className="w-4 h-4" /> Logs
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">Total Rooms</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-[#e0e0e0] mt-1">{rooms.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-[#1a1a1a] flex items-center justify-center">
            <Bed className="w-5 h-5 text-slate-500" />
          </div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Available</p>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">{availableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
            <Bed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Occupied</p>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-300 mt-1">{occupiedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
            <Bed className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/50"
            placeholder="Search rooms or patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content: list + detail panel */}
      <div className="flex gap-5 items-start">
        {/* Room List */}
        <div className="flex-1 min-w-0 space-y-3">
          {loading ? (
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-8 text-center">
              <p className="text-slate-500 dark:text-[#666666]">Loading rooms…</p>
            </div>
          ) : showInfrastructureView ? (
            <div className="space-y-4">
              {filteredInfrastructure.length > 0 && filteredInfrastructure.map((building, bIdx) => (
                <div key={building.id ?? building.name ?? bIdx} className="rounded-2xl border border-slate-200 dark:border-[#2a2a2a] overflow-hidden bg-white dark:bg-[#111111]">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#1e1e1e]">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-[#999999]">Building</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{building.name || `Building ${bIdx + 1}`}</p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-[#999999]">{building.floors.length} floors</span>
                  </div>
                  <div className="space-y-4 p-4">
                    {building.floors.map((floor, fIdx) => (
                      <div key={floor.id ?? floor.name ?? fIdx} className="rounded-2xl border border-slate-200 dark:border-[#2a2a2a] overflow-hidden bg-slate-50 dark:bg-[#0d0d0d]">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-[#1e1e1e]">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-[#999999]">Floor</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{floor.name || `Floor ${fIdx + 1}`}</p>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-[#999999]">{floor.wards.length} ward{floor.wards.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="p-4 space-y-4">
                          {floor.wards.map((ward, wIdx) => (
                            <div key={ward.id ?? ward.name ?? wIdx} className="rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] p-4">
                              <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-[#999999]">Ward</p>
                                  <p className="font-semibold text-slate-900 dark:text-white">{ward.name || `Ward ${wIdx + 1}`}</p>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-[#999999]">{ward.rooms.length} rooms</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {ward.rooms.map((room) => (
                                  <InfrastructureRoomCard
                                    key={room.name}
                                    roomInfo={room}
                                    roomData={room.roomData}
                                    isSelected={selectedRoom?.id === room.roomData?.id}
                                    onSelect={(room) => setSelectedRoom((prev) => prev?.id === room.id ? null : room)}
                                    onAllocate={(room) => setShowAllocateModal({ open: true, room })}
                                    onAssignAttender={(room) => setShowAttenderModal({ open: true, room })}
                                    onDeallocate={handleDeallocate}
                                    onDelete={handleDeleteRoom}
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
                <div className="rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-[#999999]">Unmapped rooms</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">Rooms not present in infrastructure mapping</p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-[#999999]">{unmappedRooms.length} rooms</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {unmappedRooms.map((room) => (
                      <InfrastructureRoomCard
                        key={room.id}
                        roomInfo={{ name: room.roomNumber, roomType: room.roomType }}
                        roomData={room}
                        isSelected={selectedRoom?.id === room.id}
                        onSelect={(room) => setSelectedRoom((prev) => prev?.id === room.id ? null : room)}
                        onAllocate={(room) => setShowAllocateModal({ open: true, room })}
                        onAssignAttender={(room) => setShowAttenderModal({ open: true, room })}
                        onDeallocate={handleDeallocate}
                        onDelete={handleDeleteRoom}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredInfrastructure.length === 0 && unmappedRooms.length === 0 && (
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-8 text-center">
                  <p className="text-slate-500 dark:text-[#666666]">No rooms found matching criteria.</p>
                </div>
              )}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-8 text-center">
              <p className="text-slate-500 dark:text-[#666666]">No rooms found matching criteria.</p>
            </div>
          ) : filteredRooms.map((room) => {
            const isMultiBed = room.bedCount != null && room.bedCount > 1;
            return (
              <div
                key={room.id}
                onClick={() => setSelectedRoom((prev) => prev?.id === room.id ? null : room)}
                className={`bg-white dark:bg-[#111111] border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-colors ${
                  selectedRoom?.id === room.id
                    ? "border-slate-400 dark:border-[#444444]"
                    : room.status === "AVAILABLE"
                    ? "border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-800/50"
                    : "border-slate-200 dark:border-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#2a2a2a]"
                }`}
              >
                {/* Left: room identity */}
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border ${
                    room.status === "AVAILABLE"
                      ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
                      : "bg-slate-50 border-slate-100 text-slate-500 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-[#888888]"
                  }`}>
                    <Bed className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{room.roomNumber}</p>
                      {room.roomCode && (
                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-[#999999]">{room.roomCode}</span>
                      )}
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        room.roomType === "ICU"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]"
                      }`}>{room.roomType}</span>
                      {isMultiBed && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">
                          {room.bedCount} beds
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-1 font-medium ${
                      room.status === "AVAILABLE" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                    }`}>{room.status}</p>
                  </div>
                </div>

                {/* Right: patient details (single-bed only) or multi-bed hint */}
                {isMultiBed ? (
                  <div className="flex-1 sm:pl-8 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-4 sm:pt-0 flex items-center">
                    <p className="text-sm text-slate-600 dark:text-[#999999]">Open panel to view beds</p>
                  </div>
                ) : room.status === "OCCUPIED" && room.currentPatient ? (
                  <div className="flex-1 sm:pl-8 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-4 sm:pt-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-[#666666]">Patient</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">
                            {room.currentPatient.firstName} {room.currentPatient.lastName}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-[#999999]">{room.currentPatient.mrn}</p>
                        </div>
                        {room.attenderName ? (
                          <div>
                            <p className="text-xs text-slate-500 dark:text-[#666666]">Attender</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">
                              {room.attenderName}
                              {room.attenderRelationship && (
                                <span className="text-xs text-slate-600 dark:text-[#999999] ml-1">({room.attenderRelationship})</span>
                              )}
                            </p>
                            {room.attenderPhone && (
                              <p className="text-[11px] text-slate-600 dark:text-[#999999]">{room.attenderPhone}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-500 dark:text-amber-400">No attender assigned</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-2">
                        {room.allocationToken && (
                          <div>
                            <p className="text-xs text-slate-500 dark:text-[#666666] mb-0.5">Token</p>
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-sm font-bold tracking-widest text-violet-700 dark:text-violet-400 font-mono">
                              {room.allocationToken}
                            </span>
                          </div>
                        )}
                        {room.approxDischargeTime && (
                          <div className="hidden md:block">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666666] mb-0.5 justify-end">
                              <CalendarClock className="w-3.5 h-3.5" /> Est. Discharge
                            </div>
                            <p className="text-xs font-medium text-slate-700 dark:text-[#aaaaaa]">{formatDateTime(room.approxDischargeTime)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 sm:pl-8 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-4 sm:pt-0 flex items-center">
                    <p className="text-sm text-slate-600 dark:text-[#999999]">Ready for allocation</p>
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
          })}
        </div>

        {/* Detail Panel */}
        {selectedRoom && (
          <RoomDetailPanel
            room={selectedRoom}
            onClose={() => setSelectedRoom(null)}
            onRoomUpdated={fetchRooms}
            onViewLogs={() => navigate(`/rooms/logs?roomId=${selectedRoom.id}&roomNumber=${selectedRoom.roomNumber}`)}
          />
        )}
      </div>

      {/* Modals */}
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
