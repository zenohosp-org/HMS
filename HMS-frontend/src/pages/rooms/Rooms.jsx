import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "@/utils/api";
import { Bed, Plus, Search, CalendarClock, MoreVertical, ScrollText } from "lucide-react";
import { formatDateTime } from "@/utils/validators";
import GenerateRoomsModal from "./GenerateRoomsModal";
import AllocatePatientModal from "./AllocatePatientModal";
import AssignAttenderModal from "./AssignAttenderModal";
import RoomDetailPanel from "./RoomDetailPanel";
function RoomActionMenu({ room, onAllocate, onAssignAttender, onDeallocate }) {
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
  return <div ref={ref} className="relative shrink-0"><button
    onClick={(e) => {
      e.stopPropagation();
      setOpen((v) => !v);
    }}
    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
  ><MoreVertical className="w-5 h-5" /></button>{open && <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-lg overflow-hidden">{room.status === "AVAILABLE" && <button
    onClick={() => {
      setOpen(false);
      onAllocate();
    }}
    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white dark:text-slate-300 hover:bg-slate-100 dark:bg-[#1e1e1e] dark:hover:bg-slate-500/10 transition-colors"
  >
                            Allocate Patient
                        </button>}{room.status === "OCCUPIED" && <><button
    onClick={() => {
      setOpen(false);
      onAssignAttender();
    }}
    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors"
  >{room.attenderName ? "Edit Attender" : "Assign Attender"}</button><div className="border-t border-slate-100 dark:border-[#2a2a2a]" /><button
    onClick={() => {
      setOpen(false);
      onDeallocate();
    }}
    className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
  >
                                Deallocate
                            </button></>}</div>}</div>;
}
function Rooms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState({ open: false, room: null });
  const [showAttenderModal, setShowAttenderModal] = useState({ open: false, room: null });
  const fetchRooms = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/rooms?hospitalId=${user?.hospitalId}`);
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch rooms", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user?.hospitalId) fetchRooms();
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
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (filter === "AVAILABLE" && r.status !== "AVAILABLE") return false;
      if (filter === "OCCUPIED" && r.status !== "OCCUPIED") return false;
      if (search) {
        const s = search.toLowerCase();
        const matchRoom = r.roomNumber.toLowerCase().includes(s);
        const matchPatient = r.currentPatient && (r.currentPatient.firstName.toLowerCase().includes(s) || r.currentPatient.lastName.toLowerCase().includes(s) || r.currentPatient.mrn.toLowerCase().includes(s));
        return matchRoom || matchPatient;
      }
      return true;
    }).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms, filter, search]);
  const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
  const occupiedCount = rooms.filter((r) => r.status === "OCCUPIED").length;
  return <div className="space-y-5"><div className="flex items-center justify-between flex-wrap gap-4"><div><h1 className="text-xl font-bold text-slate-900 dark:text-[#f0f0f0]">Room Allocation</h1><p className="text-sm text-slate-500 dark:text-[#666666]">{rooms.length} total rooms in hospital</p></div><div className="flex items-center gap-2"><button
    className="btn-secondary flex items-center gap-2"
    onClick={() => navigate("/rooms/logs")}
  ><ScrollText className="w-4 h-4" /> Logs
                    </button>{user?.role === "hospital_admin" && <button className="btn-primary flex items-center gap-2" onClick={() => setShowGenerateModal(true)}><Plus className="w-4 h-4" /> Generate Rooms
                        </button>}</div></div>{
    /* Metrics */
  }<div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">Total Rooms</p><p className="text-2xl font-bold text-slate-800 dark:text-[#e0e0e0] mt-1">{rooms.length}</p></div><div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-[#1a1a1a] flex items-center justify-center"><Bed className="w-5 h-5 text-slate-500" /></div></div><div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Available</p><p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{availableCount}</p></div><div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"><Bed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div></div><div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg p-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Occupied</p><p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{occupiedCount}</p></div><div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center"><Bed className="w-5 h-5 text-rose-600 dark:text-rose-400" /></div></div></div>{
    /* Filters */
  }<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex gap-2">{["ALL", "AVAILABLE", "OCCUPIED"].map((f) => <button
    key={f}
    onClick={() => setFilter(f)}
    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all
                                ${filter === f ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-md" : "bg-white text-slate-500 border border-slate-200 dark:bg-[#111111] dark:border-[#222222] hover:bg-slate-50 dark:hover:bg-[#1a1a1a]"}`}
  >{f}</button>)}</div><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input
    className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a]
                            bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/50"
    placeholder="Search rooms or patients..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  /></div></div>{
    /* Content: list + detail panel */
  }<div className="flex gap-5 items-start">{
    /* Room List */
  }<div className="flex-1 min-w-0 space-y-3">{loading ? <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-8 text-center"><p className="text-slate-500 dark:text-[#666666]">Loading rooms…</p></div> : filteredRooms.length === 0 ? <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-8 text-center"><p className="text-slate-500 dark:text-[#666666]">No rooms found matching criteria.</p></div> : filteredRooms.map((room) => <div
    key={room.id}
    onClick={() => setSelectedRoom((prev) => prev?.id === room.id ? null : room)}
    className={`bg-white dark:bg-[#111111] border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-colors
                                    ${selectedRoom?.id === room.id ? "border-slate-400 dark:border-[#444444]" : room.status === "AVAILABLE" ? "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700" : "border-slate-200 dark:border-[#1e1e1e] hover:border-slate-300 dark:hover:border-[#2a2a2a]"}`}
  ><div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border
                                        ${room.status === "AVAILABLE" ? "bg-slate-100 dark:bg-[#1e1e1e] border-slate-200 dark:border-[#2a2a2a] text-slate-900 dark:text-white" : "bg-slate-50 border-slate-100 text-slate-500 dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:text-[#888888]"}`}><Bed className="w-6 h-6" /></div><div><div className="flex items-center gap-2"><p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{room.roomNumber}</p><span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border
                                                ${room.roomType === "ICU" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]"}`}>{room.roomType}</span></div><p className={`text-xs mt-1 font-medium ${room.status === "AVAILABLE" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{room.status}</p></div></div>{room.status === "OCCUPIED" && room.currentPatient ? <div className="flex-1 sm:pl-8 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-4 sm:pt-0"><div className="flex items-start justify-between gap-4"><div className="space-y-1.5"><div><p className="text-xs text-slate-500 dark:text-[#666666]">Patient</p><p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">{room.currentPatient.firstName} {room.currentPatient.lastName}</p><p className="text-[11px] text-slate-400 dark:text-[#555555]">{room.currentPatient.mrn}</p></div>{room.attenderName ? <div><p className="text-xs text-slate-500 dark:text-[#666666]">Attender</p><p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">{room.attenderName}{room.attenderRelationship && <span className="text-xs text-slate-400 dark:text-[#555555] ml-1">({room.attenderRelationship})</span>}</p>{room.attenderPhone && <p className="text-[11px] text-slate-400 dark:text-[#555555]">{room.attenderPhone}</p>}</div> : <p className="text-xs text-amber-500 dark:text-amber-400">No attender assigned</p>}</div><div className="text-right shrink-0 space-y-2">{room.allocationToken && <div><p className="text-xs text-slate-500 dark:text-[#666666] mb-0.5">Token</p><span className="inline-block px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-sm font-bold tracking-widest text-violet-700 dark:text-violet-400 font-mono">{room.allocationToken}</span></div>}{room.approxDischargeTime && <div className="hidden md:block"><div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666666] mb-0.5 justify-end"><CalendarClock className="w-3.5 h-3.5" /> Est. Discharge
                                                        </div><p className="text-xs font-medium text-slate-700 dark:text-[#aaaaaa]">{formatDateTime(room.approxDischargeTime)}</p></div>}</div></div></div> : <div className="flex-1 sm:pl-8 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-[#222222] pt-4 sm:pt-0 flex items-center"><p className="text-sm text-slate-400 dark:text-[#555555]">Ready for allocation</p></div>}<RoomActionMenu
    room={room}
    onAllocate={() => setShowAllocateModal({ open: true, room })}
    onAssignAttender={() => setShowAttenderModal({ open: true, room })}
    onDeallocate={() => handleDeallocate(room.id)}
  /></div>)}</div>{
    /* Detail Panel */
  }{selectedRoom && <RoomDetailPanel
    room={selectedRoom}
    onClose={() => setSelectedRoom(null)}
    onViewLogs={() => navigate(`/rooms/logs?roomId=${selectedRoom.id}&roomNumber=${selectedRoom.roomNumber}`)}
  />}</div>{
    /* Modals */
  }{showGenerateModal && <GenerateRoomsModal
    onClose={() => setShowGenerateModal(false)}
    onSuccess={() => {
      setShowGenerateModal(false);
      fetchRooms();
    }}
  />}{showAllocateModal.open && showAllocateModal.room && <AllocatePatientModal
    roomId={showAllocateModal.room.id}
    roomNumber={showAllocateModal.room.roomNumber}
    onClose={() => setShowAllocateModal({ open: false, room: null })}
    onSuccess={() => {
      setShowAllocateModal({ open: false, room: null });
      fetchRooms();
    }}
  />}{showAttenderModal.open && showAttenderModal.room && <AssignAttenderModal
    roomId={showAttenderModal.room.id}
    roomNumber={showAttenderModal.room.roomNumber}
    existing={{
      name: showAttenderModal.room.attenderName,
      phone: showAttenderModal.room.attenderPhone,
      relationship: showAttenderModal.room.attenderRelationship
    }}
    onClose={() => setShowAttenderModal({ open: false, room: null })}
    onSuccess={() => {
      setShowAttenderModal({ open: false, room: null });
      fetchRooms();
    }}
  />}</div>;
}
export {
  Rooms as default
};
