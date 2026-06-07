import { CenterLoader } from "@/components/ui/Loader";
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
  HeartPulse,
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
  { value: "CATH_LAB", label: "Cath Lab", category: "OT" },
  { value: "STORE", label: "Inventory Store", category: "STORE" },
];

function resizeTo(arr, n, makeDefault) {
  if (n <= 0) return [];
  if (n > arr.length) return [...arr, ...Array(n - arr.length).fill(null).map((_, i) => makeDefault(arr.length + i))];
  return arr.slice(0, n);
}

function Stepper({ value, onChange, min = 0, max = 20, variant = "default" }) {
  const dark = variant === "dark";
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={dark ? "hms-infra-stepper__btn is-dark" : "hms-infra-stepper__btn"}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className={dark ? "hms-infra-stepper__num is-dark" : "hms-infra-stepper__num"}>{value}</span>
      <button
        type="button"
        className={dark ? "hms-infra-stepper__btn is-dark" : "hms-infra-stepper__btn"}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function RoomGrid({ rooms, bIdx, fIdx, wIdx, updateRoom, roomType }) {
  if (!rooms.length) return null;

  let themeClass = "hms-infra-room-card";
  if (roomType === "OT") themeClass = "hms-infra-room-card is-ot";
  else if (roomType === "CATH_LAB") themeClass = "hms-infra-room-card is-ot";
  else if (roomType === "STORE") themeClass = "hms-infra-room-card is-store";

  let CardIcon = Bed;
  if (roomType === "OT") CardIcon = Scissors;
  else if (roomType === "CATH_LAB") CardIcon = HeartPulse;
  else if (roomType === "STORE") CardIcon = Package;

  return (
    <div className="hms-infra-room-grid-wrap">
      <p className="hms-infra-room-grid__label">
        Rooms · {rooms.length}
      </p>
      <div className="hms-infra-room-grid">
        {rooms.map((room, rIdx) => (
          <div key={rIdx} className={themeClass}>
            <div className="hms-infra-room-card__inner">
              <CardIcon className="hms-infra-room-card__icon w-3.5 h-3.5 shrink-0" />
              <input
                className="hms-infra-room-card__input"
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
  let badgeClass = "hms-infra-ward-badge is-general";
  let themeName = "GENERAL";

  if (ward.roomType === "ICU") {
    badgeClass = "hms-infra-ward-badge is-icu";
    themeName = "ICU";
  } else if (ward.roomType === "PRIVATE") {
    badgeClass = "hms-infra-ward-badge is-private";
    themeName = "PRIVATE";
  } else if (ward.roomType === "OT") {
    badgeClass = "hms-infra-ward-badge is-ot";
    themeName = "OT";
  } else if (ward.roomType === "CATH_LAB") {
    badgeClass = "hms-infra-ward-badge is-ot";
    themeName = "CATH LAB";
  } else if (ward.roomType === "STORE") {
    badgeClass = "hms-infra-ward-badge is-store";
    themeName = "STORE";
  }

  return (
    <div className="hms-infra-ward-card">
      <div className="hms-infra-ward-card__row">
        {/* Title / Name */}
        <div className="hms-infra-ward-card__name-col">
          <div className={badgeClass}>{themeName}</div>
          <input
            className="hms-infra-ward-card__name-input"
            value={ward.name}
            onChange={(e) => updateWard(bIdx, fIdx, wIdx, "name", e.target.value)}
            placeholder={`Ward ${wIdx + 1}`}
          />
        </div>

        {/* Type select */}
        <div className="hms-infra-ward-card__type-col">
          <SearchableSelect
            className="hms-infra-ward-card__type-select"
            value={ward.roomType || "GENERAL"}
            onChange={(v) => updateWard(bIdx, fIdx, wIdx, "roomType", v)}
            options={roomTypes.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>

        {/* Daily charge */}
        <div className="hms-infra-ward-card__charge-col">
          <span className="hms-infra-ward-card__charge-label">₹ / day</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={ward.dailyCharge ?? ""}
            onChange={(e) => updateWard(bIdx, fIdx, wIdx, "dailyCharge", e.target.value)}
            placeholder="0"
            className="hms-infra-ward-card__charge-input tabular-nums"
          />
        </div>

        {/* Rooms Stepper */}
        <div className="hms-infra-ward-card__rooms-col">
          <span className="hms-infra-ward-card__rooms-label">Rooms</span>
          <Stepper value={(ward.rooms || []).length} onChange={(n) => setRoomCount(bIdx, fIdx, wIdx, n)} min={0} max={50} />
        </div>

        {/* Remove Ward button */}
        <div className="hms-infra-ward-card__del-col">
          <button
            type="button"
            onClick={removeWard}
            className="hms-infra-ward-card__del-btn"
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
  let badgeClass = "hms-infra-ward-badge is-ot";
  let CardIcon = Scissors;

  if (room.roomType === "STORE") {
    badgeClass = "hms-infra-ward-badge is-store";
    CardIcon = Package;
  } else if (room.roomType === "CATH_LAB") {
    CardIcon = HeartPulse;
  }

  return (
    <div className="hms-infra-special-card">
      <div className="hms-infra-special-card__row">
        <div className="hms-infra-special-card__name-col">
          <div className={`${badgeClass} shrink-0`}>SPECIAL</div>
          <div className="hms-infra-special-card__icon-wrap shrink-0">
            <CardIcon className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <input
            className="hms-infra-ward-card__name-input"
            value={room.name}
            onChange={(e) => onUpdate("name", e.target.value)}
            placeholder="Special Room name (e.g. OT-1 or Main Store)"
          />
        </div>
        <div className="hms-infra-ward-card__type-col">
          <SearchableSelect
            className="hms-infra-ward-card__type-select"
            value={room.roomType}
            onChange={(v) => onUpdate("roomType", v)}
            options={roomTypes.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>
        <div className="hms-infra-special-card__charge-col">
          <span className="hms-infra-special-card__currency">₹</span>
          <input
            type="number"
            min="0"
            className="hms-infra-special-card__charge-input tabular-nums"
            value={room.dailyCharge}
            onChange={(e) => onUpdate("dailyCharge", e.target.value)}
            placeholder="0"
          />
          <span className="hms-infra-special-card__per-day">/day</span>
        </div>
        <button type="button" onClick={onRemove} className="hms-infra-special-card__del-btn">
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
    <div className="hms-infra-floor-section">
      <div
        onClick={() => setExpanded(!expanded)}
        className="hms-infra-floor-section__header"
      >
        <div className="flex items-center gap-2 shrink-0">
          <Layers className="w-3.5 h-3.5 text-gray-400" />
          <span className="hms-infra-floor-section__floor-label">Floor {fIdx + 1}</span>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
          <input
            className="hms-infra-floor-section__name-input"
            value={floor.name}
            onChange={(e) => updateFloor(bIdx, fIdx, "name", e.target.value)}
            placeholder={`Floor ${fIdx + 1}`}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hms-infra-floor-section__wards-label">Wards</span>
          <Stepper value={floor.wards.length} onChange={(n) => setWardCount(bIdx, fIdx, n)} min={0} max={20} />
        </div>
        <div className="hms-infra-floor-section__chevron shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="hms-infra-floor-section__body">
          {floor.wards.length > 0 ? (
            <div className="hms-infra-floor-section__wards">
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
            <div className="hms-infra-floor-section__empty">
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
          if (w.roomType === "CATH_LAB") ots += 1;
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
      <CenterLoader text="Loading master structure…" />
    );
  }

  return (
    <div className="hms-infra-shell">
      {/* Header Banner */}
      <div className="hms-infra-banner">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Network className="w-5 h-5 hms-infra-banner__icon" />
            <h1 className="hms-infra-banner__title">Hospital Infrastructure Master</h1>
          </div>
          <p className="hms-infra-banner__sub">
            Configure core building maps. Updates reflect in OT and Store modules.
          </p>
        </div>

        {/* Stats Panel */}
        <div className="hms-infra-stats-strip">
          {[
            { label: "Bldgs", value: buildings.length, colorClass: "zu-stat-card-val is-default" },
            { label: "Floors", value: stats.floors, colorClass: "zu-stat-card-val is-info" },
            { label: "Rooms", value: stats.rooms, colorClass: "zu-stat-card-val is-violet" },
            { label: "OTs", value: stats.ots, colorClass: "zu-stat-card-val is-success" },
            { label: "Stores", value: stats.stores, colorClass: "zu-stat-card-val is-warning" }
          ].map(({ label, value, colorClass }) => (
            <div key={label} className="hms-infra-stats-strip__item">
              <p className={`${colorClass} tabular-nums`}>{value}</p>
              <p className="hms-infra-stats-strip__label">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="hms-infra-workspace">
        {/* Left Side Tree Navigation Pane */}
        <div className="hms-infra-nav">
          <div className="hms-infra-nav__head">
            {/* Search filter */}
            <div className="relative">
              <Search className="hms-infra-nav__search-icon w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search wards, rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hms-infra-nav__search-input"
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
              className="hms-infra-nav__add-btn"
            >
              <Plus className="w-3.5 h-3.5" /> Add Block
            </button>
          </div>

          {/* Tree list */}
          <div className="hms-infra-nav__tree">
            {filteredTree.length === 0 ? (
              <p className="hms-infra-nav__empty">No matching records</p>
            ) : (
              filteredTree.map((b, bIdx) => {
                const actualBIdx = b.originalIdx !== undefined ? b.originalIdx : bIdx;
                const isBActive = activeBuildingIdx === actualBIdx;

                return (
                  <div key={actualBIdx} className="hms-infra-nav__building-group">
                    {/* Building Header */}
                    <div
                      onClick={() => {
                        setActiveBuildingIdx(actualBIdx);
                        setActiveFloorIdx(0);
                      }}
                      className={`hms-infra-nav__building-row${isBActive ? " is-active" : ""}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 hms-infra-nav__building-icon shrink-0" />
                        <span className="hms-infra-nav__building-name truncate">
                          {b.name || `Building ${actualBIdx + 1}`}
                        </span>
                      </div>
                      <span className="hms-infra-nav__floor-count">
                        {(b.floors || []).length} flr
                      </span>
                    </div>

                    {/* Floor items under building */}
                    {isBActive && (
                      <div className="hms-infra-nav__floor-list">
                        {(b.floors || []).map((f, fIdx) => {
                          const actualFIdx = f.originalIdx !== undefined ? f.originalIdx : fIdx;
                          const isFActive = activeFloorIdx === actualFIdx;

                          return (
                            <div
                              key={actualFIdx}
                              onClick={() => setActiveFloorIdx(actualFIdx)}
                              className={`hms-infra-nav__floor-row${isFActive ? " is-active" : ""}`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Layers className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                  {f.name || `Floor ${actualFIdx + 1}`}
                                </span>
                              </div>
                              <span className="hms-infra-nav__ward-count">
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
                          className="hms-infra-nav__add-floor-btn"
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
        <div className="hms-infra-canvas">
          {activeBuilding ? (
            <div className="hms-infra-canvas__inner">
              {/* Floor Header Controls */}
              <div className="hms-infra-canvas__head">
                <div className="flex items-center gap-3">
                  <div className="hms-infra-canvas__floor-icon-wrap">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="hms-infra-canvas__building-name">{activeBuilding.name}</h2>
                      <span className="hms-infra-canvas__sep">/</span>
                      <input
                        type="text"
                        value={activeFloor?.name || ""}
                        onChange={(e) => updateFloor(activeBuildingIdx, activeFloorIdx, "name", e.target.value)}
                        placeholder={`Floor ${activeFloorIdx + 1}`}
                        className="hms-infra-canvas__floor-input"
                      />
                    </div>
                    <p className="hms-infra-canvas__head-sub">Edit floor layout, manage wards, OTs and stores below</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="hms-infra-canvas__floors-label">Floors</span>
                    <Stepper
                      value={(activeBuilding.floors || []).length}
                      onChange={(n) => handleSetFloorCount(activeBuildingIdx, n)}
                      min={1}
                      max={10}
                    />
                  </div>
                  <div className="hms-infra-canvas__divider"></div>
                  <button
                    type="button"
                    onClick={() => deleteBuilding(activeBuildingIdx)}
                    className="hms-infra-canvas__del-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Block
                  </button>
                </div>
              </div>

              {/* Visual Floor Canvas Area */}
              <div className="hms-infra-canvas__body">
                {/* Active Building Edit Section */}
                <div className="hms-infra-canvas__block-row">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="hms-infra-canvas__block-label">Configure Block Details:</span>
                    <input
                      type="text"
                      value={activeBuilding.name}
                      onChange={(e) => updateBuilding(activeBuildingIdx, "name", e.target.value)}
                      placeholder="Building name"
                      className="hms-infra-canvas__block-input"
                    />
                  </div>
                  <span className="hms-infra-canvas__block-index">Building Index {activeBuildingIdx + 1}</span>
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
                  <div className="hms-infra-canvas__no-floor">
                    <Layers className="w-10 h-10 hms-infra-canvas__no-floor-icon mb-3" />
                    <p className="hms-infra-canvas__no-floor-title">No floor selected</p>
                    <p className="hms-infra-canvas__no-floor-sub mt-1">Select or add a floor from the left pane</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="hms-infra-canvas__no-building">
              <div className="hms-infra-canvas__no-building-icon-wrap">
                <Building2 className="w-8 h-8 hms-infra-canvas__no-building-icon" />
              </div>
              <p className="hms-infra-canvas__no-building-title">No Buildings Configured</p>
              <p className="hms-infra-canvas__no-building-sub">
                Add a hospital block or building from the left panel to begin mapping out zones, wards, and rooms.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Save Bar */}
      {buildings.length > 0 && (
        <div className="hms-infra-save-bar">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 hms-infra-save-bar__icon shrink-0" />
            <div>
              <p className="hms-infra-save-bar__title">Sync core master settings.</p>
              <p className="hms-infra-save-bar__sub mt-0.5">
                Saved changes automatically reflect across surgical OTs and warehouse inventory stores.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="hms-infra-save-bar__btn"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Changes…" : "Save Master Layout"}
          </button>
        </div>
      )}

      {/* Safety Confirmation Modal */}
      {confirmModal.show && (
        <div className="hms-infra-modal-overlay">
          <div className="hms-infra-modal">
            <div className="hms-infra-modal__header">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="hms-infra-modal__title">Confirm Removal</h3>
            </div>
            <p className="hms-infra-modal__body">
              {confirmModal.message}
            </p>
            <div className="hms-infra-modal__footer">
              <button
                type="button"
                onClick={() => setConfirmModal({ show: false, message: "", onConfirm: null })}
                className="hms-infra-modal__cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="hms-infra-modal__confirm-btn"
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
