import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { infrastructureApi, roomTypeApi } from "@/utils/api";
import { 
  Building2, 
  Layers, 
  Minus, 
  Plus, 
  Save, 
  AlertTriangle, 
  Network, 
  Bed, 
  Scissors, 
  X, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Package, 
  Search, 
  SlidersHorizontal,
  Home
} from "lucide-react";

// Fallback room types used while API loads
const FALLBACK_ROOM_TYPES = [
  { value: "GENERAL", label: "General Ward", category: "WARD" },
  { value: "ICU", label: "ICU", category: "WARD" },
  { value: "OT", label: "Operating Theatre", category: "OT" },
  { value: "STORE", label: "Inventory Store", category: "STORE" },
];

function resizeTo(arr, n, makeDefault) {
  if (n <= 0) return [];
  if (n > arr.length) return [...arr, ...Array(n - arr.length).fill(null).map((_, i) => makeDefault(arr.length + i))];
  return arr.slice(0, n);
}

function Stepper({ value, onChange, min = 0, max = 20, variant = "default" }) {
  const dark = variant === "dark";
  const btn = dark
    ? "w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
    : "w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
  const num = dark
    ? "w-8 text-center text-sm font-bold text-white tabular-nums"
    : "w-7 text-center text-sm font-semibold text-slate-700 tabular-nums";
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="w-3 h-3" />
      </button>
      <span className={num}>{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function RoomGrid({ rooms, bIdx, fIdx, wIdx, updateRoom, roomType }) {
  if (!rooms.length) return null;

  let CardIcon = Bed;
  let themeClass = "hover:border-emerald-300 focus-within:border-emerald-400";
  let iconClass = "text-slate-300 group-hover:text-emerald-400";

  if (roomType === "OT") {
    CardIcon = Scissors;
    themeClass = "hover:border-rose-300 focus-within:border-rose-400";
    iconClass = "text-rose-300 group-hover:text-rose-500";
  } else if (roomType === "STORE") {
    CardIcon = Package;
    themeClass = "hover:border-amber-300 focus-within:border-amber-400";
    iconClass = "text-amber-300 group-hover:text-amber-500";
  }

  return (
    <div className="border-t border-slate-100 p-3 bg-slate-50/50">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
        Rooms · {rooms.length}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room, rIdx) => (
          <div
            key={rIdx}
            className={`flex items-center bg-white border border-slate-200 rounded-lg group transition-all overflow-hidden ${themeClass}`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 flex-1">
              <CardIcon className={`w-3.5 h-3.5 shrink-0 transition-colors ${iconClass}`} />
              <input
                className="flex-1 text-xs text-slate-700 bg-transparent focus:outline-none placeholder-slate-300 min-w-0 font-medium"
                value={room.name}
                onChange={(e) => updateRoom(bIdx, fIdx, wIdx, rIdx, "name", e.target.value)}
                placeholder={`Room ${rIdx + 1}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WardCard({ ward, bIdx, fIdx, wIdx, updateWard, setRoomCount, updateRoom, removeWard, roomTypes }) {
  // Theme based on type
  let badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
  let themeName = "GENERAL";

  const selectedType = roomTypes.find(t => t.value === ward.roomType);
  const isWard = selectedType ? selectedType.category === "WARD" : true;

  if (ward.roomType === "ICU") {
    badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20";
    themeName = "ICU";
  } else if (ward.roomType === "PRIVATE") {
    badgeColor = "bg-purple-500/10 text-purple-500 border-purple-500/20";
    themeName = "PRIVATE";
  } else if (ward.roomType === "OT") {
    badgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    themeName = "OT";
  } else if (ward.roomType === "STORE") {
    badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
    themeName = "STORE";
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex flex-wrap items-center divide-y divide-slate-100 md:divide-y-0 md:flex-nowrap">
        {/* Title / Name */}
        <div className="flex items-center gap-2.5 px-4 py-3 flex-1 min-w-[200px]">
          <div className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border ${badgeColor}`}>
            {themeName}
          </div>
          <input
            className="flex-1 text-sm font-semibold text-slate-800 bg-transparent focus:outline-none placeholder-slate-300 min-w-0"
            value={ward.name}
            onChange={(e) => updateWard(bIdx, fIdx, wIdx, "name", e.target.value)}
            placeholder={`Ward ${wIdx + 1}`}
          />
        </div>

        {/* Type select */}
        <div className="flex items-center px-3 py-3 w-36 shrink-0">
          <SearchableSelect
            className="w-full text-xs text-slate-600 bg-transparent focus:outline-none cursor-pointer font-medium"
            value={ward.roomType || "GENERAL"}
            onChange={(v) => updateWard(bIdx, fIdx, wIdx, "roomType", v)}
            options={roomTypes.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>

        {/* Daily charge — applies per occupied bed-day. Cascaded server-side
            onto every room in the ward so the IPD billing flow picks it up
            via Room.pricePerDay → AdmissionDTO.roomPricePerDay. */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-l border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">₹ / day</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={ward.dailyCharge ?? ""}
            onChange={(e) => updateWard(bIdx, fIdx, wIdx, "dailyCharge", e.target.value)}
            placeholder="0"
            className="w-24 px-2 py-1 text-sm font-semibold text-right text-slate-800 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-300/50 tabular-nums"
          />
        </div>

        {/* Rooms Stepper */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-l border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rooms</span>
          <Stepper value={(ward.rooms || []).length} onChange={(n) => setRoomCount(bIdx, fIdx, wIdx, n)} min={0} max={50} />
        </div>

        {/* Remove Ward button */}
        <div className="flex items-center justify-center px-3 py-3 shrink-0">
          <button
            type="button"
            onClick={removeWard}
            className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
            title="Delete Ward Section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>



      <RoomGrid rooms={ward.rooms || []} bIdx={bIdx} fIdx={fIdx} wIdx={wIdx} updateRoom={updateRoom} roomType={ward.roomType} />
    </div>
  );
}

function SpecialRoomCard({ room, onUpdate, onRemove, roomTypes }) {
  // Theme based on type
  let badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20";
  let CardIcon = Scissors;

  if (room.roomType === "STORE") {
    badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
    CardIcon = Package;
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-stretch divide-x divide-slate-100">
        <div className="flex items-center gap-2.5 px-4 py-3 flex-1 min-w-0">
          <div className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border shrink-0 ${badgeColor}`}>
            SPECIAL
          </div>
          <div className="w-5 h-5 rounded-md bg-slate-50 flex items-center justify-center shrink-0">
            <CardIcon className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <input
            className="flex-1 text-sm font-semibold text-slate-800 bg-transparent focus:outline-none placeholder-slate-300 min-w-0"
            value={room.name}
            onChange={(e) => onUpdate("name", e.target.value)}
            placeholder="Special Room name (e.g. OT-1 or Main Store)"
          />
        </div>
        <div className="flex items-center px-3 py-3 w-36 shrink-0">
          <SearchableSelect
            className="w-full text-xs text-slate-600 bg-transparent focus:outline-none cursor-pointer font-medium"
            value={room.roomType}
            onChange={(v) => onUpdate("roomType", v)}
            options={roomTypes.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-3 w-36 shrink-0">
          <span className="text-xs font-semibold text-slate-400">₹</span>
          <input
            type="number" min="0"
            className="flex-1 text-sm text-slate-700 bg-transparent focus:outline-none placeholder-slate-300 tabular-nums min-w-0 font-medium"
            value={room.dailyCharge}
            onChange={(e) => onUpdate("dailyCharge", e.target.value)}
            placeholder="0"
          />
          <span className="text-[10px] text-slate-400">/day</span>
        </div>
        <button type="button" onClick={onRemove}
          className="flex items-center justify-center px-4 text-slate-300 hover:text-rose-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FloorSection({ 
  floor, 
  bIdx, 
  fIdx, 
  updateFloor, 
  setWardCount, 
  updateWard, 
  setRoomCount, 
  updateRoom, 
  removeWard,
  roomTypes
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white transition-all">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 shrink-0">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Floor {fIdx + 1}</span>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
          <input
            className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-slate-300 placeholder-slate-300 font-semibold"
            value={floor.name}
            onChange={(e) => updateFloor(bIdx, fIdx, "name", e.target.value)}
            placeholder={`Floor ${fIdx + 1}`}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wards</span>
          <Stepper value={floor.wards.length} onChange={(n) => setWardCount(bIdx, fIdx, n)} min={0} max={20} />
        </div>
        <div className="text-slate-400 shrink-0 ml-1">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Wards Section */}
          {floor.wards.length > 0 ? (
            <div className="space-y-3">
              {floor.wards.map((ward, wIdx) => (
                <WardCard 
                  key={wIdx} 
                  ward={ward} 
                  bIdx={bIdx} 
                  fIdx={fIdx} 
                  wIdx={wIdx}
                  updateWard={updateWard} 
                  setRoomCount={setRoomCount} 
                  updateRoom={updateRoom} 
                  removeWard={() => removeWard(bIdx, fIdx, wIdx)}
                  roomTypes={roomTypes}
                />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
              Set Ward Count to generate Wards on this floor
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InfrastructureMapping() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roomTypes, setRoomTypes] = useState(FALLBACK_ROOM_TYPES);

  // Search & Navigation States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBuildingIdx, setActiveBuildingIdx] = useState(0);
  const [activeFloorIdx, setActiveFloorIdx] = useState(0);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    onConfirm: null,
  });

  useEffect(() => {
    // Load dynamic room types
    roomTypeApi.getAll(user.hospitalId)
      .then((data) => {
        if (data?.length) {
          setRoomTypes(Array.from(new Map(data.map(t => [t.code, t])).values()).map(t => ({ value: t.code, label: t.label, category: t.category, color: t.color, icon: t.icon, isSystem: t.isSystem })));
        }
      })
      .catch(() => {});

    infrastructureApi.get(user.hospitalId)
      .then((data) => {
        if (data?.length) {
          setBuildings(data.map((b) => ({
            name: b.name,
            floors: (b.floors ?? []).map((f) => {
              const allWards = f.wards ?? [];
              return {
                name: f.name,
                wards: allWards.map(w => ({
                  name: w.name,
                  roomType: w.roomType ?? "GENERAL",
                  dailyCharge: w.dailyCharge ?? "",
                  rooms: (w.rooms ?? []).map((r) => ({
                    id: r.id,
                    name: r.name,
                    bedNames: r.bedNames ?? [],
                  })),
                })),
              };
            }),
          })));
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [user.hospitalId]);

  // Calculations
  const stats = useMemo(() => {
    let rooms = 0;
    let floors = 0;
    let wards = 0;
    let ots = 0;
    let stores = 0;

    buildings.forEach(b => {
      floors += (b.floors || []).length;
      (b.floors || []).forEach(f => {
        wards += (f.wards || []).length;
        (f.wards || []).forEach(w => {
          rooms += (w.rooms?.length || 0);
          if (w.roomType === "OT") ots += 1;
          if (w.roomType === "STORE") stores += 1;
        });
      });
    });

    return { rooms, floors, wards, ots, stores };
  }, [buildings]);

  // Filtered Tree representation based on query
  const filteredTree = useMemo(() => {
    if (!searchQuery) return buildings;
    const query = searchQuery.toLowerCase();

    return buildings.map((b, bIdx) => {
      const floors = (b.floors || []).map((f, fIdx) => {
        const wards = (f.wards || []).filter(w => 
          w.name.toLowerCase().includes(query) || 
          w.roomType.toLowerCase().includes(query) ||
          w.rooms.some(r => r.name.toLowerCase().includes(query) || (r.bedNamesInput || "").toLowerCase().includes(query))
        );
        return { ...f, wards, originalIdx: fIdx };
      }).filter(f => f.wards.length > 0 || f.name.toLowerCase().includes(query));

      return { ...b, floors, originalIdx: bIdx };
    }).filter(b => b.floors.length > 0 || b.name.toLowerCase().includes(query));
  }, [buildings, searchQuery]);

  const confirmReduction = (message, onConfirm) => {
    setConfirmModal({
      show: true,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal({ show: false, message: "", onConfirm: null });
      }
    });
  };

  const handleSetBuildingCount = (n) => {
    if (n < buildings.length) {
      const willDelete = buildings.slice(n);
      const hasData = willDelete.some(b => (b.name !== "" && !b.name.startsWith("Building ")) || b.floors.length > 0);
      if (hasData) {
        confirmReduction(
          "Reducing the building count will discard the trailing buildings and all their floors, wards, and rooms. Are you sure?",
          () => {
            setBuildings((p) => resizeTo(p, n, (i) => ({ name: `Building ${i + 1}`, floors: [] })));
            if (activeBuildingIdx >= n) {
              setActiveBuildingIdx(Math.max(0, n - 1));
              setActiveFloorIdx(0);
            }
          }
        );
        return;
      }
    }
    setBuildings((p) => resizeTo(p, n, (i) => ({ name: `Building ${i + 1}`, floors: [] })));
  };

  const handleSetFloorCount = (bIdx, n) => {
    const currentFloors = buildings[bIdx].floors;
    if (n < currentFloors.length) {
      const willDelete = currentFloors.slice(n);
      const hasData = willDelete.some(f => (f.name !== "" && !f.name.startsWith("Floor ")) || f.wards.length > 0 || f.specialRooms?.length > 0);
      if (hasData) {
        confirmReduction(
          "Reducing the floor count will delete the trailing floors and all configured wards and rooms on them. Are you sure?",
          () => {
            setBuildings((p) => p.map((b, i) => i !== bIdx ? b : { ...b, floors: resizeTo(b.floors, n, (j) => ({ name: `Floor ${j + 1}`, wards: [], specialRooms: [] })) }));
            if (activeFloorIdx >= n) {
              setActiveFloorIdx(Math.max(0, n - 1));
            }
          }
        );
        return;
      }
    }
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : { ...b, floors: resizeTo(b.floors, n, (j) => ({ name: `Floor ${j + 1}`, wards: [], specialRooms: [] })) }));
  };

  const handleSetWardCount = (bIdx, fIdx, n) => {
    const currentWards = buildings[bIdx].floors[fIdx].wards;
    if (n < currentWards.length) {
      const willDelete = currentWards.slice(n);
      const hasData = willDelete.some(w => w.name !== "" || w.rooms.length > 0);
      if (hasData) {
        confirmReduction(
          "Reducing the ward count will delete the trailing wards and all their rooms. Are you sure?",
          () => setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
            ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
              ...f, wards: resizeTo(f.wards, n, () => ({ name: "", dailyCharge: "", roomType: "GENERAL", rooms: [] }))
            })
          }))
        );
        return;
      }
    }
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f, wards: resizeTo(f.wards, n, () => ({ name: "", dailyCharge: "", roomType: "GENERAL", rooms: [] }))
      })
    }));
  };

  const removeWard = (bIdx, fIdx, wIdx) => {
    const ward = buildings[bIdx].floors[fIdx].wards[wIdx];
    const executeDelete = () => {
      setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
        ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
          ...f, wards: f.wards.filter((_, k) => k !== wIdx)
        })
      }));
    };

    if (ward.name !== "" || ward.rooms.length > 0) {
      confirmReduction(
        `Are you sure you want to delete ${ward.name || `Ward ${wIdx + 1}`}? This will permanently discard all configured rooms/beds in it.`,
        executeDelete
      );
    } else {
      executeDelete();
    }
  };

  const handleSetRoomCount = (bIdx, fIdx, wIdx, n) => {
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f, wards: f.wards.map((w, k) => k !== wIdx ? w : {
          ...w, rooms: resizeTo(w.rooms, n, (rIdx) => ({ id: null, name: `Room ${rIdx + 1}`, bedNames: [] }))
        })
      })
    }));
  };

  const deleteBuilding = (bIdx) => {
    const b = buildings[bIdx];
    const hasData = (b.name !== "" && !b.name.startsWith("Building ")) || b.floors.length > 0;
    const executeDelete = () => {
      setBuildings((p) => p.filter((_, i) => i !== bIdx));
      setActiveBuildingIdx((prev) => Math.max(0, prev - 1));
      setActiveFloorIdx(0);
    };

    if (hasData) {
      confirmReduction(
        `Are you sure you want to delete ${b.name || `Building ${bIdx + 1}`}? This will permanently discard all configured floors, wards, and rooms under it.`,
        executeDelete
      );
    } else {
      executeDelete();
    }
  };

  const updateBuilding = (bIdx, field, value) =>
    setBuildings((p) => p.map((b, i) => i === bIdx ? { ...b, [field]: value } : b));

  const updateFloor = (bIdx, fIdx, field, value) =>
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j === fIdx ? { ...f, [field]: value } : f)
    }));

  const updateWard = (bIdx, fIdx, wIdx, field, value) =>
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f, wards: f.wards.map((w, k) => k === wIdx ? { ...w, [field]: value } : w)
      })
    }));

  const addSpecialRoom = (bIdx, fIdx, type) =>
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f, specialRooms: [...(f.specialRooms || []), { id: null, name: "", roomType: type || "OT", dailyCharge: "0" }]
      })
    }));

  const updateRoom = (bIdx, fIdx, wIdx, rIdx, field, value) =>
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f, wards: f.wards.map((w, k) => k !== wIdx ? w : {
          ...w, rooms: w.rooms.map((r, l) => l === rIdx ? { ...r, [field]: value } : r)
        })
      })
    }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildings.map((b) => ({
        name: b.name || "Building",
        floors: (b.floors || []).map((f) => ({
          name: f.name || "Floor",
          wards: [
            ...(f.wards || []).map((w) => ({
              name: w.name || "Ward",
              roomType: w.roomType || "GENERAL",
              dailyCharge: w.dailyCharge === "" || w.dailyCharge == null
                ? null
                : Number(w.dailyCharge),
              rooms: (w.rooms || []).map((r) => ({
                id: r.id || null,
                name: r.name || "",
                bedNames: r.bedNames || [],
              })),
            })),
          ],
        })),
      }));
      await infrastructureApi.save(user.hospitalId, payload);
      notify("Hospital infrastructure updated and synced successfully!", "success");
    } catch {
      notify("Failed to save infrastructure configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  const activeBuilding = buildings[activeBuildingIdx];
  const activeFloor = activeBuilding?.floors?.[activeFloorIdx];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#fafbfe]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-semibold text-slate-500">Loading master structure…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-slate-900 overflow-hidden">
      {/* Header Banner */}
      <div className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-6 flex-wrap z-10">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Network className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-bold tracking-tight">Hospital Infrastructure Master</h1>
          </div>
          <p className="text-xs text-slate-500">
            Configure core building maps. Updates reflect in OT and Store modules.
          </p>
        </div>

        {/* Stats Panel */}
        <div className="flex items-center gap-1.5 shrink-0 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
          {[
            { label: "Bldgs", value: buildings.length, color: "text-slate-600" },
            { label: "Floors", value: stats.floors, color: "text-blue-500" },
            { label: "Rooms", value: stats.rooms, color: "text-purple-500" },
            { label: "OTs", value: stats.ots, color: "text-emerald-500" },
            { label: "Stores", value: stats.stores, color: "text-amber-500" }
          ].map(({ label, value, color }) => (
            <div key={label} className="px-3 py-1.5 text-center bg-white rounded-lg shadow-sm border border-slate-200/10 min-w-[64px]">
              <p className={`text-sm font-extrabold tabular-nums ${color}`}>{value}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Tree Navigation Pane */}
        <div className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100 space-y-2 shrink-0">
            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search wards, rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-300 placeholder-slate-400"
              />
            </div>

            {/* Quick add Block button */}
            <button
              type="button"
              onClick={() => {
                const nextIdx = buildings.length;
                handleSetBuildingCount(nextIdx + 1);
                setActiveBuildingIdx(nextIdx);
                setActiveFloorIdx(0);
              }}
              className="w-full py-1.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-slate-200/10"
            >
              <Plus className="w-3.5 h-3.5" /> Add Block
            </button>
          </div>

          {/* Tree list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredTree.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No matching records</p>
            ) : (
              filteredTree.map((b, bIdx) => {
                const actualBIdx = b.originalIdx !== undefined ? b.originalIdx : bIdx;
                const isBActive = activeBuildingIdx === actualBIdx;

                return (
                  <div key={actualBIdx} className="space-y-1">
                    {/* Building Header */}
                    <div
                      onClick={() => {
                        setActiveBuildingIdx(actualBIdx);
                        setActiveFloorIdx(0);
                      }}
                      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                        isBActive
                          ? "bg-slate-100 border-l-2 border-emerald-500"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-xs font-bold truncate text-slate-800">
                          {b.name || `Building ${actualBIdx + 1}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {(b.floors || []).length} flr
                      </span>
                    </div>

                    {/* Floor items under building */}
                    {isBActive && (
                      <div className="pl-3.5 space-y-0.5 border-l border-slate-100 ml-4">
                        {(b.floors || []).map((f, fIdx) => {
                          const actualFIdx = f.originalIdx !== undefined ? f.originalIdx : fIdx;
                          const isFActive = activeFloorIdx === actualFIdx;

                          return (
                            <div
                              key={actualFIdx}
                              onClick={() => setActiveFloorIdx(actualFIdx)}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                                isFActive
                                  ? "bg-emerald-50 text-emerald-600 font-semibold"
                                  : "text-slate-500 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Layers className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-xs truncate">
                                  {f.name || `Floor ${actualFIdx + 1}`}
                                </span>
                              </div>
                              <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-400">
                                {(f.wards || []).length + (f.specialRooms || []).length}
                              </span>
                            </div>
                          );
                        })}
                        {/* Quick add floor under active building */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextFlr = (b.floors || []).length;
                            handleSetFloorCount(actualBIdx, nextFlr + 1);
                            setActiveFloorIdx(nextFlr);
                          }}
                          className="flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-600 font-bold py-1 px-2.5 mt-1"
                        >
                          <Plus className="w-3 h-3" /> Add Floor
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side Visual Canvas / Detail Editor Pane */}
        <div className="flex-1 flex flex-col bg-[#fbfcfd] overflow-hidden">
          {activeBuilding ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Floor Header Controls */}
              <div className="shrink-0 bg-white border-b border-slate-200/60 p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold">{activeBuilding.name}</h2>
                      <span className="text-slate-300">/</span>
                      <input
                        type="text"
                        value={activeFloor?.name || ""}
                        onChange={(e) => updateFloor(activeBuildingIdx, activeFloorIdx, "name", e.target.value)}
                        placeholder={`Floor ${activeFloorIdx + 1}`}
                        className="text-sm font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-none pb-0.5 w-32"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Edit floor layout, manage wards, OTs and stores below</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Floors</span>
                    <Stepper 
                      value={(activeBuilding.floors || []).length} 
                      onChange={(n) => handleSetFloorCount(activeBuildingIdx, n)} 
                      min={1} 
                      max={10} 
                    />
                  </div>
                  <div className="h-6 w-px bg-slate-200"></div>
                  <button
                    type="button"
                    onClick={() => deleteBuilding(activeBuildingIdx)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-rose-500 hover:text-rose-500 text-xs font-bold rounded-lg transition-colors text-slate-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Block
                  </button>
                </div>
              </div>

              {/* Visual Floor Canvas Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Active Building Edit Section */}
                <div className="bg-slate-50 rounded-xl border border-slate-200/50 p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configure Block Details:</span>
                    <input
                      type="text"
                      value={activeBuilding.name}
                      onChange={(e) => updateBuilding(activeBuildingIdx, "name", e.target.value)}
                      placeholder="Building name"
                      className="text-sm font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-slate-300 w-64"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Building Index {activeBuildingIdx + 1}</span>
                </div>

                {activeFloor ? (
                  <FloorSection
                    floor={activeFloor}
                    bIdx={activeBuildingIdx}
                    fIdx={activeFloorIdx}
                    updateFloor={updateFloor}
                    setWardCount={handleSetWardCount}
                    updateWard={updateWard}
                    setRoomCount={handleSetRoomCount}
                    updateRoom={updateRoom}
                    removeWard={removeWard}
                    roomTypes={roomTypes}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
                    <Layers className="w-10 h-10 text-slate-300 mb-3" />
                    <p className="text-xs font-semibold text-slate-500">No floor selected</p>
                    <p className="text-[10px] text-slate-400 mt-1">Select or add a floor from the left pane</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
              <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                <Building2 className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-700">No Buildings Configured</p>
              <p className="text-xs text-slate-400 max-w-xs text-center mt-1">
                Add a hospital block or building from the left panel to begin mapping out zones, wards, and rooms.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Save Bar */}
      {buildings.length > 0 && (
        <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-4 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700">Sync core master settings.</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Saved changes automatically reflect across surgical OTs and warehouse inventory stores.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={saving} 
            className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5 border border-emerald-500/10"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Changes…" : "Save Master Layout"}
          </button>
        </div>
      )}

      {/* Safety Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Confirm Removal</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmModal({ show: false, message: "", onConfirm: null })}
                className="px-4 py-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
