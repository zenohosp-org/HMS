import { CenterLoader } from "@/components/ui/Loader";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { infrastructureApi, roomTypeApi } from "@/utils/api";
import { Modal, Button, FormGroup, Input } from "@/components/ui";
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
  Trash2,
  Package,
  Search,
  Edit2
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

function Stepper({ value, onChange, min = 0, max = 50, variant = "default" }) {
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
  const [activeWardIdx, setActiveWardIdx] = useState(0);
  const [activeRoomIdx, setActiveRoomIdx] = useState(0);

  // Modals state
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    onConfirm: null,
  });

  const [editModal, setEditModal] = useState({
    show: false,
    type: null, // "building" | "floor" | "ward" | "room" | "ward-room" | "bed"
    bIdx: null,
    fIdx: null,
    wIdx: null,
    rIdx: null,
    bItemIdx: null,
    formState: {} // Temp state for editing
  });

  useEffect(() => {
    // Load dynamic room types
    roomTypeApi.getAll(user.hospitalId)
      .then((data) => {
        if (data?.length) {
          setRoomTypes(
            Array.from(new Map(data.map(t => [t.code, t])).values()).map(t => ({
              value: t.code,
              label: t.label,
              category: t.category,
              color: t.color,
              icon: t.icon,
              isSystem: t.isSystem
            }))
          );
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
                wards: allWards.map(w => {
                  const isStandaloneRoom = w.rooms?.length === 1 && w.rooms[0].name === w.name;
                  return {
                    name: w.name,
                    nodeType: isStandaloneRoom ? "room" : "ward",
                    roomType: w.roomType ?? "GENERAL",
                    dailyCharge: w.dailyCharge ?? "",
                    rooms: (w.rooms ?? []).map((r) => ({
                      id: r.id,
                      name: r.name,
                      bedNames: r.bedNames ?? [],
                    })),
                  };
                }),
              };
            }),
          })));
        }
      })
      .catch(() => {})
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
    const formatted = buildings.map((b, bIdx) => ({
      ...b,
      originalIdx: bIdx,
      floors: (b.floors || []).map((f, fIdx) => ({
        ...f,
        originalIdx: fIdx
      }))
    }));

    if (!searchQuery) return formatted;
    const query = searchQuery.toLowerCase();

    return formatted.map((b) => {
      const floors = b.floors.map((f) => {
        const wards = (f.wards || []).filter(w =>
          w.name.toLowerCase().includes(query) ||
          w.roomType.toLowerCase().includes(query) ||
          w.rooms.some(r => r.name.toLowerCase().includes(query))
        );
        return { ...f, wards };
      }).filter(f => f.wards.length > 0 || f.name.toLowerCase().includes(query));

      return { ...b, floors };
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

  const handleAddBuilding = () => {
    const nextIdx = buildings.length;
    const newB = { name: `Building ${nextIdx + 1}`, floors: [] };
    setBuildings([...buildings, newB]);
    setActiveBuildingIdx(nextIdx);
    setActiveFloorIdx(0);
  };

  const handleAddFloor = (bIdx) => {
    const currentFloors = buildings[bIdx].floors;
    const nextFlr = currentFloors.length;
    setBuildings(p => p.map((b, i) => i !== bIdx ? b : {
      ...b,
      floors: [...b.floors, { name: `Floor ${nextFlr + 1}`, wards: [] }]
    }));
    setActiveFloorIdx(nextFlr);
  };

  const handleAddWardOrRoom = (bIdx, fIdx, type) => {
    const currentWards = buildings[bIdx].floors[fIdx].wards || [];
    const newIdx = currentWards.length;
    setBuildings(p => p.map((b, i) => i !== bIdx ? b : {
      ...b,
      floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f,
        wards: [...f.wards, { 
          name: type === 'ward' ? `Ward ${newIdx + 1}` : `Room ${newIdx + 1}`, 
          nodeType: type,
          roomType: type === 'ward' ? "GENERAL" : "OT", 
          dailyCharge: "", 
          rooms: type === 'room' ? [{ name: `Room ${newIdx + 1}`, bedNames: [] }] : [] 
        }]
      })
    }));
    setActiveWardIdx(newIdx);
  };

  const handleAddRoomToWard = (bIdx, fIdx, wIdx) => {
    const ward = buildings[bIdx].floors[fIdx].wards[wIdx];
    const currentRooms = ward.rooms || [];
    setBuildings(p => p.map((b, i) => i !== bIdx ? b : {
      ...b,
      floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f,
        wards: f.wards.map((w, k) => k !== wIdx ? w : {
          ...w,
          rooms: [...w.rooms, { name: `Room ${currentRooms.length + 1}`, bedNames: [] }]
        })
      })
    }));
  };

  const handleAddBedToRoom = (bIdx, fIdx, wIdx, rIdx) => {
    const room = buildings[bIdx].floors[fIdx].wards[wIdx].rooms[rIdx];
    const currentBeds = room.bedNames || [];
    setBuildings(p => p.map((b, i) => i !== bIdx ? b : {
      ...b,
      floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f,
        wards: f.wards.map((w, k) => k !== wIdx ? w : {
          ...w,
          rooms: w.rooms.map((r, l) => l !== rIdx ? r : {
            ...r,
            bedNames: [...(r.bedNames || []), `Bed ${currentBeds.length + 1}`]
          })
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

  const deleteFloor = (bIdx, fIdx) => {
    const f = buildings[bIdx].floors[fIdx];
    const hasData = (f.name !== "" && !f.name.startsWith("Floor ")) || f.wards.length > 0;
    const executeDelete = () => {
      setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
        ...b,
        floors: b.floors.filter((_, j) => j !== fIdx)
      }));
      setActiveFloorIdx((prev) => Math.max(0, prev - 1));
    };

    if (hasData) {
      confirmReduction(
        `Are you sure you want to delete ${f.name || `Floor ${fIdx + 1}`}? This will permanently discard all configured wards and rooms on it.`,
        executeDelete
      );
    } else {
      executeDelete();
    }
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
        `Are you sure you want to delete ${ward.name || `Ward ${wIdx + 1}`}? This will permanently discard all configured rooms in it.`,
        executeDelete
      );
    } else {
      executeDelete();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildings.map((b) => ({
        name: b.name || "Building",
        floors: (b.floors || []).map((f) => ({
          name: f.name || "Floor",
          wards: [
            ...(f.wards || []).map((w) => ({
              name: w.name || (w.nodeType === "room" ? "Room" : "Ward"),
              roomType: w.roomType || "GENERAL",
              dailyCharge: w.dailyCharge === "" || w.dailyCharge == null
                ? null
                : Number(w.dailyCharge),
              rooms: w.nodeType === "room"
                ? [{ id: w.rooms?.[0]?.id || null, name: w.name || "Room", bedNames: w.rooms?.[0]?.bedNames || [] }]
                : (w.rooms || []).map((r) => ({
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

  // Node editing handlers
  const openEditModal = (type, bIdx, fIdx = null, wIdx = null, rIdx = null, bItemIdx = null) => {
    let formState = {};
    if (type === "building") {
      formState = { name: buildings[bIdx].name };
    } else if (type === "floor") {
      formState = { name: buildings[bIdx].floors[fIdx].name };
    } else if (type === "ward") {
      const ward = buildings[bIdx].floors[fIdx].wards[wIdx];
      formState = {
        name: ward.name,
        roomType: ward.roomType || "GENERAL",
        dailyCharge: ward.dailyCharge ?? "",
        roomsCount: (ward.rooms || []).length,
        rooms: (ward.rooms || []).map(r => ({ ...r }))
      };
    } else if (type === "room") {
      // Standalone room in Col 3
      const roomNode = buildings[bIdx].floors[fIdx].wards[wIdx];
      const actualRoom = (roomNode.rooms || [])[0] || { name: roomNode.name, bedNames: [] };
      formState = {
        name: roomNode.name,
        roomType: roomNode.roomType || "OT",
        dailyCharge: roomNode.dailyCharge ?? ""
      };
    } else if (type === "ward-room") {
      // Room inside a Ward in Col 4
      const ward = buildings[bIdx].floors[fIdx].wards[wIdx];
      const room = ward.rooms[rIdx];
      formState = {
        name: room.name
      };
    } else if (type === "bed") {
      const ward = buildings[bIdx].floors[fIdx].wards[wIdx];
      const room = ward.rooms[rIdx];
      formState = {
        name: room.bedNames[bItemIdx] || ""
      };
    }

    setEditModal({
      show: true,
      type,
      bIdx,
      fIdx,
      wIdx,
      rIdx,
      bItemIdx,
      formState
    });
  };

  const handleSaveEdit = () => {
    const { type, bIdx, fIdx, wIdx, rIdx, bItemIdx, formState } = editModal;

    setBuildings(p => {
      return p.map((b, i) => {
        if (i !== bIdx) return b;

        if (type === "building") {
          return { ...b, name: formState.name };
        }

        return {
          ...b,
          floors: b.floors.map((f, j) => {
            if (j !== fIdx) return f;

            if (type === "floor") {
              return { ...f, name: formState.name };
            }

            return {
              ...f,
              wards: f.wards.map((w, k) => {
                if (k !== wIdx) return w;

                if (type === "room") {
                  return {
                    ...w,
                    name: formState.name,
                    roomType: formState.roomType,
                    dailyCharge: formState.dailyCharge === "" || formState.dailyCharge == null ? null : Number(formState.dailyCharge),
                    rooms: [{ name: formState.name, bedNames: w.rooms?.[0]?.bedNames || [] }]
                  };
                }

                if (type === "ward-room") {
                  const updatedRooms = [...w.rooms];
                  updatedRooms[rIdx] = { ...updatedRooms[rIdx], name: formState.name };
                  return { ...w, rooms: updatedRooms };
                }

                if (type === "bed") {
                  const updatedRooms = [...w.rooms];
                  const newBedNames = [...(updatedRooms[rIdx].bedNames || [])];
                  newBedNames[bItemIdx] = formState.name;
                  updatedRooms[rIdx] = { ...updatedRooms[rIdx], bedNames: newBedNames };
                  return { ...w, rooms: updatedRooms };
                }

                const targetCount = Number(formState.roomsCount) || 0;
                let updatedRooms = formState.rooms || [];
                if (updatedRooms.length !== targetCount) {
                  updatedRooms = resizeTo(updatedRooms, targetCount, (idx) => ({
                    id: null,
                    name: `Room ${idx + 1}`,
                    bedNames: ["Bed 1"]
                  }));
                }

                return {
                  ...w,
                  name: formState.name,
                  roomType: formState.roomType,
                  dailyCharge: formState.dailyCharge === "" || formState.dailyCharge == null
                    ? null
                    : Number(formState.dailyCharge),
                  rooms: updatedRooms
                };
              })
            };
          })
        };
      });
    });

    setEditModal({ show: false, type: null, bIdx: null, fIdx: null, wIdx: null, rIdx: null, bItemIdx: null, formState: {} });
  };

  const handleFormRoomsCountChange = (n) => {
    setEditModal(p => {
      const currentRooms = p.formState.rooms || [];
      const updatedRooms = resizeTo(currentRooms, n, (rIdx) => ({
        id: null,
        name: `Room ${rIdx + 1}`,
        bedNames: ["Bed 1"]
      }));

      return {
        ...p,
        formState: {
          ...p.formState,
          roomsCount: n,
          rooms: updatedRooms
        }
      };
    });
  };

  const handleRoomNameChange = (rIdx, value) => {
    setEditModal(p => {
      const updatedRooms = (p.formState.rooms || []).map((r, i) =>
        i === rIdx ? { ...r, name: value } : r
      );
      return {
        ...p,
        formState: {
          ...p.formState,
          rooms: updatedRooms
        }
      };
    });
  };

  const handleRoomBedsCountChange = (rIdx, n) => {
    setEditModal(p => {
      const updatedRooms = [...(p.formState.rooms || [])];
      const room = updatedRooms[rIdx];
      const currentBeds = room.bedNames || [];
      const newBeds = resizeTo(currentBeds, n, (bIdx) => `Bed ${bIdx + 1}`);
      updatedRooms[rIdx] = { ...room, bedNames: newBeds };
      return {
        ...p,
        formState: {
          ...p.formState,
          rooms: updatedRooms
        }
      };
    });
  };

  // Find active selections matching query
  const activeBuilding = useMemo(() => {
    return filteredTree.find(b => b.originalIdx === activeBuildingIdx) || filteredTree[0];
  }, [filteredTree, activeBuildingIdx]);

  const activeFloor = useMemo(() => {
    if (!activeBuilding) return null;
    return activeBuilding.floors.find(f => f.originalIdx === activeFloorIdx) || activeBuilding.floors[0];
  }, [activeBuilding, activeFloorIdx]);

  const getWardIcon = (type) => {
    if (type === "OT") return Scissors;
    if (type === "CATH_LAB") return HeartPulse;
    if (type === "STORE") return Package;
    return Bed;
  };

  if (loading) {
    return (
      <CenterLoader text="Loading master structure…" />
    );
  }

  // Helper to dynamically stretch the vertical backbone to perfectly meet the incoming horizontal line
  const getMinContentHeight = (prevIdx) => ({
    minHeight: `${80 + (prevIdx * 88)}px`,
    boxSizing: 'border-box'
  });

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

      {/* Control Bar */}
      <div className="bg-white px-8 py-2 border-bottom flex items-center justify-between gap-4">
        {/* Search filter */}
        <div className="zu-filter-bar__search max-w-sm flex-1">
          <Search className="zu-filter-bar__search-icon" />
          <input
            type="text"
            placeholder="Search wards, rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="zu-filter-bar__search-input"
          />
        </div>
        
        {/* Helper Instructions */}
        <p className="text-12 text-gray-500 m-0 hidden md:block">
          💡 Click a Block or Floor card to navigate the visual hierarchy tree.
        </p>
      </div>

      {/* Main Visual Tree Workspace */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-gray-50 min-h-0 infra-tree-hide-scrollbar">
        <div className="infra-tree-workspace h-full min-h-full">
          
          {/* COLUMN 1: BUILDINGS */}
          <div className="infra-tree-col">
            <div className="infra-tree-col-header">
              <span className="infra-tree-col-title">
                <Building2 className="w-4 h-4 text-gray-500" /> Blocks
              </span>
              <span className="infra-tree-col-count">{filteredTree.length}</span>
            </div>
            <div className="infra-tree-col-content">
              {filteredTree.map((b) => {
                const isBActive = activeBuildingIdx === b.originalIdx;
                const hasFloors = (b.floors || []).length > 0;
                return (
                  <div
                    key={b.originalIdx}
                    onClick={() => {
                      setActiveBuildingIdx(b.originalIdx);
                      setActiveFloorIdx(0);
                    }}
                    className={`infra-tree-card${isBActive ? " is-active" : ""}${hasFloors ? " has-children" : ""}`}
                  >
                    <div className="infra-tree-card__icon-wrap">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="infra-tree-card__info">
                      <h4 className="infra-tree-card__name truncate">{b.name || `Building ${b.originalIdx + 1}`}</h4>
                      <p className="infra-tree-card__meta">{(b.floors || []).length} Floors</p>
                    </div>
                    <div className="infra-tree-card__actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditModal("building", b.originalIdx)}
                        className="infra-tree-card__btn"
                        title="Edit Name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBuilding(b.originalIdx)}
                        className="infra-tree-card__btn is-danger"
                        title="Delete Building"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {(hasFloors || isBActive) && (
                      <div className={`infra-tree-connection-badge ${isBActive ? "is-active" : "is-inactive"}`}>
                        {(b.floors || []).length}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleAddBuilding}
                className="infra-tree-add-card-btn"
              >
                <Plus className="w-4 h-4" /> Add Block
              </button>
            </div>
          </div>

          {/* COLUMN 2: FLOORS */}
          <div className="infra-tree-col">
            <div className="infra-tree-col-header">
              <span className="infra-tree-col-title">
                <Layers className="w-4 h-4 text-gray-500" /> Floors
              </span>
              <span className="infra-tree-col-count">
                {activeBuilding ? (activeBuilding.floors || []).length : 0}
              </span>
            </div>
            <div 
              className={`infra-tree-col-content${activeBuilding ? " is-connected" : ""}${activeBuilding && (activeBuilding.floors || []).length === 0 ? " is-empty" : ""}`} 
              style={activeBuilding ? getMinContentHeight(activeBuildingIdx) : undefined}
            >
              {!activeBuilding ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400">
                  <Building2 className="w-8 h-8 mb-2 opacity-55" />
                  <p className="text-12 font-medium">Select a building block to view floors</p>
                </div>
              ) : (
                <>
                  {(activeBuilding.floors || []).map((f) => {
                    const isFActive = activeFloorIdx === f.originalIdx;
                    const hasWards = (f.wards || []).length > 0;
                    return (
                      <div
                        key={f.originalIdx}
                        onClick={() => setActiveFloorIdx(f.originalIdx)}
                        className={`infra-tree-card${isFActive ? " is-active" : ""}${hasWards ? " has-children" : ""}`}
                      >
                        <div className="infra-tree-card__icon-wrap">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div className="infra-tree-card__info">
                          <h4 className="infra-tree-card__name truncate">{f.name || `Floor ${f.originalIdx + 1}`}</h4>
                          <p className="infra-tree-card__meta">{(f.wards || []).length} Wards & zones</p>
                        </div>
                        <div className="infra-tree-card__actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openEditModal("floor", activeBuildingIdx, f.originalIdx)}
                            className="infra-tree-card__btn"
                            title="Edit Name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFloor(activeBuildingIdx, f.originalIdx)}
                            className="infra-tree-card__btn is-danger"
                            title="Delete Floor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {(hasWards || isFActive) && (
                          <div className={`infra-tree-connection-badge ${isFActive ? "is-active" : "is-inactive"}`}>
                            {(f.wards || []).length}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleAddFloor(activeBuildingIdx)}
                    className="infra-tree-add-card-btn"
                  >
                    <Plus className="w-4 h-4" /> Add Floor
                  </button>
                </>
              )}
            </div>
          </div>

          {/* COLUMN 3: WARD / ROOM */}
          <div className="infra-tree-col">
            <div className="infra-tree-col-header">
              <span className="infra-tree-col-title">
                <Bed className="w-4 h-4 text-gray-500" /> Ward / Room
              </span>
              <span className="infra-tree-col-count">
                {activeFloor ? (activeFloor.wards || []).length : 0}
              </span>
            </div>
            <div 
              className={`infra-tree-col-content${activeFloor ? " is-connected" : ""}${activeFloor && (activeFloor.wards || []).length === 0 ? " is-empty" : ""}`} 
              style={activeFloor ? getMinContentHeight(activeFloorIdx) : undefined}
            >
              {!activeFloor ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400">
                  <Layers className="w-8 h-8 mb-2 opacity-55" />
                  <p className="text-12 font-medium">Select a floor to view wards & rooms</p>
                </div>
              ) : (
                <>
                  {(activeFloor.wards || []).map((w, wIdx) => {
                    const WardIcon = getWardIcon(w.roomType);
                    let tagClass = "infra-tree-badge-tag is-general";
                    if (w.roomType === "ICU") tagClass = "infra-tree-badge-tag is-icu";
                    else if (w.roomType === "PRIVATE") tagClass = "infra-tree-badge-tag is-private";
                    else if (w.roomType === "OT" || w.roomType === "CATH_LAB") tagClass = "infra-tree-badge-tag is-ot";
                    else if (w.roomType === "STORE") tagClass = "infra-tree-badge-tag is-store";

                    const isWActive = activeWardIdx === wIdx;
                    const isWardNode = w.nodeType !== 'room';

                    return (
                      <div
                        key={wIdx}
                        onClick={() => {
                          setActiveWardIdx(wIdx);
                          if (isWardNode) setActiveRoomIdx(0);
                        }}
                        className={`infra-tree-card${isWActive ? " is-active" : ""}${isWardNode ? " has-children" : ""}`}
                      >
                        <div className="infra-tree-card__icon-wrap">
                          <WardIcon className="w-5 h-5" />
                        </div>
                        <div className="infra-tree-card__info">
                          <h4 className="infra-tree-card__name truncate">{w.name || `Node ${wIdx + 1}`}</h4>
                          <div className="infra-tree-card__meta truncate">
                            <span className={tagClass}>{w.roomType}</span>
                            {w.dailyCharge != null && w.dailyCharge !== "" && `₹${w.dailyCharge}/d • `}
                            {isWardNode ? (
                              <>{(w.rooms || []).length} Rooms • {w.rooms?.reduce((acc, r) => acc + (r.bedNames?.length || 0), 0) || 0} Beds</>
                            ) : (
                              <>{w.rooms?.[0]?.bedNames?.length || 0} Beds</>
                            )}
                          </div>
                        </div>
                        <div className="infra-tree-card__actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openEditModal(isWardNode ? "ward" : "room", activeBuildingIdx, activeFloorIdx, wIdx)}
                            className="infra-tree-card__btn"
                            title="Edit Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeWard(activeBuildingIdx, activeFloorIdx, wIdx)}
                            className="infra-tree-card__btn is-danger"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {(isWardNode || isWActive) && (
                          <div className={`infra-tree-connection-badge ${isWActive ? "is-active" : "is-inactive"}`}>
                            {isWardNode ? (w.rooms || []).length : 0}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="infra-tree-add-btn-group">
                    <button
                      type="button"
                      onClick={() => handleAddWardOrRoom(activeBuildingIdx, activeFloorIdx, 'ward')}
                      className="infra-tree-add-card-btn flex-1"
                    >
                      <Plus className="w-4 h-4" /> Add Ward
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddWardOrRoom(activeBuildingIdx, activeFloorIdx, 'room')}
                      className="infra-tree-add-card-btn flex-1"
                    >
                      <Plus className="w-4 h-4" /> Add Room
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* COLUMN 4: ROOMS (Only visible if active item in Col 3 is a Ward) */}
          {activeFloor && activeFloor.wards?.[activeWardIdx] && activeFloor.wards[activeWardIdx].nodeType !== 'room' && (
            <div className="infra-tree-col">
              <div className="infra-tree-col-header">
                <span className="infra-tree-col-title">
                  <Bed className="w-4 h-4 text-gray-500" /> Rooms
                </span>
                <span className="infra-tree-col-count">
                  {(activeFloor.wards[activeWardIdx].rooms || []).length}
                </span>
              </div>
              <div 
                className={`infra-tree-col-content is-connected${(activeFloor.wards[activeWardIdx].rooms || []).length === 0 ? " is-empty" : ""}`} 
                style={getMinContentHeight(activeWardIdx)}
              >
                {(activeFloor.wards[activeWardIdx].rooms || []).map((r, rIdx) => {
                  const isRActive = activeRoomIdx === rIdx;
                  return (
                    <div
                      key={rIdx}
                      onClick={() => setActiveRoomIdx(rIdx)}
                      className={`infra-tree-card${isRActive ? " is-active" : ""} has-children`}
                    >
                      <div className="infra-tree-card__icon-wrap">
                        <Bed className="w-5 h-5" />
                      </div>
                      <div className="infra-tree-card__info">
                        <h4 className="infra-tree-card__name truncate">{r.name || `Room ${rIdx + 1}`}</h4>
                        <div className="infra-tree-card__meta truncate">
                          <span className="infra-tree-badge-tag is-general">ROOM</span>
                          {(r.bedNames || []).length} Beds
                        </div>
                      </div>
                      <div className="infra-tree-card__actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditModal("ward-room", activeBuildingIdx, activeFloorIdx, activeWardIdx, rIdx)}
                          className="infra-tree-card__btn"
                          title="Edit Name"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBuildings(p => p.map((b, i) => i !== activeBuildingIdx ? b : {
                              ...b, floors: b.floors.map((f, j) => j !== activeFloorIdx ? f : {
                                ...f, wards: f.wards.map((w, k) => k !== activeWardIdx ? w : {
                                  ...w, rooms: w.rooms.filter((_, idx) => idx !== rIdx)
                                })
                              })
                            }));
                          }}
                          className="infra-tree-card__btn is-danger"
                          title="Delete Room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className={`infra-tree-connection-badge ${isRActive ? "is-active" : "is-inactive"}`}>
                        {(r.bedNames || []).length}
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleAddRoomToWard(activeBuildingIdx, activeFloorIdx, activeWardIdx)}
                  className="infra-tree-add-card-btn"
                >
                  <Plus className="w-4 h-4" /> Add Room
                </button>
              </div>
            </div>
          )}

          {/* COLUMN 5: BEDS */}
          {activeFloor && activeFloor.wards?.[activeWardIdx] && (
            (() => {
              const ward = activeFloor.wards[activeWardIdx];
              // If it's a standalone room, we edit its beds directly. Otherwise, we edit the activeRoomIdx.
              const rIdx = ward.nodeType === 'room' ? 0 : activeRoomIdx;
              const room = (ward.rooms || [])[rIdx];

              if (!room) return null;

              return (
                <div className="infra-tree-col">
                  <div className="infra-tree-col-header">
                    <span className="infra-tree-col-title">
                      <Bed className="w-4 h-4 text-gray-500" /> Beds
                    </span>
                    <span className="infra-tree-col-count">
                      {(room.bedNames || []).length}
                    </span>
                  </div>
                  <div 
                    className={`infra-tree-col-content is-connected${(room.bedNames || []).length === 0 ? " is-empty" : ""}`} 
                    style={getMinContentHeight(ward.nodeType === 'room' ? activeWardIdx : activeRoomIdx)}
                  >
                    {(room.bedNames || []).map((bedName, bItemIdx) => {
                      return (
                        <div
                          key={bItemIdx}
                          className="infra-tree-card"
                        >
                          <div className="infra-tree-card__icon-wrap">
                            <Bed className="w-5 h-5" />
                          </div>
                          <div className="infra-tree-card__info">
                            <h4 className="infra-tree-card__name truncate">{bedName || `Bed ${bItemIdx + 1}`}</h4>
                          </div>
                          <div className="infra-tree-card__actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openEditModal("bed", activeBuildingIdx, activeFloorIdx, activeWardIdx, rIdx, bItemIdx)}
                              className="infra-tree-card__btn"
                              title="Edit Name"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBuildings(p => p.map((b, i) => i !== activeBuildingIdx ? b : {
                                  ...b, floors: b.floors.map((f, j) => j !== activeFloorIdx ? f : {
                                    ...f, wards: f.wards.map((w, k) => k !== activeWardIdx ? w : {
                                      ...w, rooms: w.rooms.map((r, l) => l !== rIdx ? r : {
                                        ...r, bedNames: r.bedNames.filter((_, idx) => idx !== bItemIdx)
                                      })
                                    })
                                  })
                                }));
                              }}
                              className="infra-tree-card__btn is-danger"
                              title="Delete Bed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => handleAddBedToRoom(activeBuildingIdx, activeFloorIdx, activeWardIdx, rIdx)}
                      className="infra-tree-add-card-btn"
                    >
                      <Plus className="w-4 h-4" /> Add Bed
                    </button>
                  </div>
                </div>
              );
            })()
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

      {/* safety Confirmation Modal */}
      {confirmModal.show && (
        <div className="hms-infra-modal-overlay">
          <div className="hms-infra-modal">
            <div className="hms-infra-modal__header">
              <AlertTriangle className="w-6 h-6 text-red-500" />
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

      {/* Edit Form Modal */}
      {editModal.show && (
        <Modal
          isOpen={editModal.show}
          onClose={() => setEditModal({ show: false, type: null, bIdx: null, fIdx: null, wIdx: null, formState: {} })}
          title={`Edit ${editModal.type.charAt(0).toUpperCase() + editModal.type.slice(1)}`}
          footer={
            <>
              <Button
                variant="cancel"
                onClick={() => setEditModal({ show: false, type: null, bIdx: null, fIdx: null, wIdx: null, formState: {} })}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                disabled={!editModal.formState.name?.trim()}
              >
                Apply Changes
              </Button>
            </>
          }
        >
          <div className="infra-modal-form-grid">
            <FormGroup
              label={
                editModal.type === "bed" ? "Bed Name" :
                editModal.type === "ward-room" ? "Room Name" : 
                `${editModal.type.charAt(0).toUpperCase() + editModal.type.slice(1)} Name`
              }
              hint="Required name/identifier"
            >
              <Input
                value={editModal.formState.name || ""}
                onChange={(e) => setEditModal(p => ({ ...p, formState: { ...p.formState, name: e.target.value } }))}
                placeholder={`e.g. Block A or Floor 1`}
              />
            </FormGroup>

            {(editModal.type === "ward" || editModal.type === "room") && (
              <div className="grid grid-cols-2 gap-4">
                <FormGroup label="Type">
                  <SearchableSelect
                    value={editModal.formState.roomType}
                    onChange={(v) => setEditModal(p => ({ ...p, formState: { ...p.formState, roomType: v } }))}
                    options={roomTypes.map((t) => ({ value: t.value, label: t.label }))}
                  />
                </FormGroup>

                <FormGroup label="Daily Charge (₹)">
                  <Input
                    type="number"
                    min="0"
                    value={editModal.formState.dailyCharge ?? ""}
                    onChange={(e) => setEditModal(p => ({ ...p, formState: { ...p.formState, dailyCharge: e.target.value } }))}
                    placeholder="0"
                  />
                </FormGroup>
              </div>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
}
