import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { infrastructureApi } from "@/utils/api";
import { Building2, Layers, Minus, Plus, Save, AlertTriangle, Network, Bed } from "lucide-react";

const ROOM_TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "WARD", label: "Ward" },
  { value: "PRIVATE", label: "Private" },
  { value: "ICU", label: "ICU" },
];

function resizeTo(arr, n, makeDefault) {
  if (n <= 0) return [];
  if (n > arr.length) return [...arr, ...Array(n - arr.length).fill(null).map((_, i) => makeDefault(arr.length + i))];
  return arr.slice(0, n);
}

function Stepper({ value, onChange, min = 0, max = 20, variant = "default" }) {
  const dark = variant === "dark";
  const btn = dark
    ? "w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
    : "w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
  const num = dark
    ? "w-8 text-center text-sm font-bold text-white tabular-nums"
    : "w-7 text-center text-sm font-semibold text-slate-700 dark:text-[#cccccc] tabular-nums";
  return (
    <div className="flex items-center gap-0.5">
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

function RoomGrid({ rooms, bIdx, fIdx, wIdx, updateRoom }) {
  if (!rooms.length) return null;
  return (
    <div className="border-t border-slate-100 dark:border-[#1e1e1e] p-3 bg-slate-50/50 dark:bg-[#0a0a0a]">
      <p className="text-[10px] font-bold text-slate-600 dark:text-[#999999] uppercase tracking-widest mb-2.5">
        Rooms · {rooms.length}
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {rooms.map((room, rIdx) => (
          <div
            key={rIdx}
            className="flex items-center gap-2 bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#252525] rounded-lg px-2.5 py-2 group hover:border-emerald-300 dark:hover:border-emerald-500/40 focus-within:border-emerald-400 dark:focus-within:border-emerald-500/60 transition-colors"
          >
            <Bed className="w-3 h-3 text-slate-300 dark:text-[#444444] shrink-0 group-hover:text-emerald-400 dark:group-hover:text-emerald-500 transition-colors" />
            <input
              className="flex-1 text-xs text-slate-700 dark:text-[#cccccc] bg-transparent focus:outline-none placeholder-slate-300 dark:placeholder-[#3a3a3a] min-w-0 font-medium"
              value={room.name}
              onChange={(e) => updateRoom(bIdx, fIdx, wIdx, rIdx, e.target.value)}
              placeholder={`Room ${rIdx + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function WardCard({ ward, bIdx, fIdx, wIdx, updateWard, setRoomCount, updateRoom }) {
  const wardRooms = parseInt(ward.rooms?.length) || 0;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-[#252525] overflow-hidden bg-white dark:bg-[#111111]">
      <div className="flex items-stretch divide-x divide-slate-100 dark:divide-[#1e1e1e]">
        {/* Ward name */}
        <div className="flex items-center gap-2 px-4 py-2.5 flex-1 min-w-0">
          <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <input
            className="flex-1 text-sm font-medium text-slate-800 dark:text-[#cccccc] bg-transparent focus:outline-none placeholder-slate-300 dark:placeholder-[#3a3a3a] min-w-0"
            value={ward.name}
            onChange={(e) => updateWard(bIdx, fIdx, wIdx, "name", e.target.value)}
            placeholder={`Ward ${wIdx + 1}`}
          />
        </div>
        {/* Room type */}
        <div className="flex items-center px-3 py-2.5 w-32 shrink-0">
          <select
            className="w-full text-xs text-slate-600 dark:text-[#aaaaaa] bg-transparent focus:outline-none cursor-pointer"
            value={ward.roomType || "GENERAL"}
            onChange={(e) => updateWard(bIdx, fIdx, wIdx, "roomType", e.target.value)}
          >
            {ROOM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {/* Daily charge */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 w-36 shrink-0">
          <span className="text-xs font-semibold text-slate-400">₹</span>
          <input
            type="number"
            min="0"
            className="flex-1 text-sm text-slate-700 dark:text-[#cccccc] bg-transparent focus:outline-none placeholder-slate-300 dark:placeholder-[#3a3a3a] tabular-nums min-w-0"
            value={ward.dailyCharge}
            onChange={(e) => updateWard(bIdx, fIdx, wIdx, "dailyCharge", e.target.value)}
            placeholder="0"
          />
          <span className="text-[10px] text-slate-400">/day</span>
        </div>
        {/* Beds per room stepper */}
        <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
          <span className="text-xs font-semibold text-slate-400 hidden sm:block">Beds/Room</span>
          <Stepper value={parseInt(ward.bedCount) || 1} onChange={(n) => updateWard(bIdx, fIdx, wIdx, "bedCount", n)} min={1} max={20} />
        </div>
        {/* Room stepper */}
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
          <Bed className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 hidden sm:block">Rooms</span>
          <Stepper value={wardRooms} onChange={(n) => setRoomCount(bIdx, fIdx, wIdx, n)} min={0} max={50} />
        </div>
      </div>

      <RoomGrid rooms={ward.rooms || []} bIdx={bIdx} fIdx={fIdx} wIdx={wIdx} updateRoom={updateRoom} />
    </div>
  );
}

function FloorSection({ floor, bIdx, fIdx, updateFloor, setWardCount, updateWard, setRoomCount, updateRoom }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50/60 dark:bg-indigo-500/5 border-b border-indigo-100 dark:border-indigo-500/10">
        <div className="flex items-center gap-2 shrink-0">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Floor {fIdx + 1}</span>
        </div>
        <input
          className="flex-1 min-w-0 text-sm text-slate-700 dark:text-[#cccccc] bg-white dark:bg-[#111111] border border-indigo-100 dark:border-indigo-500/20 rounded-md px-2.5 py-1 focus:outline-none focus:border-indigo-400 placeholder-slate-300 dark:placeholder-[#3a3a3a]"
          value={floor.name}
          onChange={(e) => updateFloor(bIdx, fIdx, "name", e.target.value)}
          placeholder={`Floor ${fIdx}`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Wards</span>
          <Stepper value={floor.wards.length} onChange={(n) => setWardCount(bIdx, fIdx, n)} min={0} max={20} />
        </div>
      </div>

      {floor.wards.length > 0 ? (
        <div className="p-3 space-y-2 bg-white dark:bg-[#0d0d0d]">
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
            />
          ))}
        </div>
      ) : (
        <div className="py-5 text-center text-xs text-slate-600 dark:text-[#999999] bg-white dark:bg-[#0d0d0d]">
          Set ward count above to add wards
        </div>
      )}
    </div>
  );
}

function BuildingCard({ building, bIdx, updateBuilding, setFloorCount, updateFloor, setWardCount, updateWard, setRoomCount, updateRoom }) {
  const roomsInBuilding = (building.floors || []).reduce(
    (s, f) => s + (f.wards || []).reduce((ws, w) => ws + (w.rooms?.length || 0), 0), 0
  );

  return (
    <div className="rounded-lg border border-slate-200 dark:border-[#222222] overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-2 shrink-0">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Building {bIdx + 1}</span>
        </div>
        <input
          className="flex-1 min-w-0 text-sm font-semibold text-white bg-transparent border-b border-white/10 pb-0.5 focus:outline-none focus:border-white/30 placeholder-white/20"
          value={building.name}
          onChange={(e) => updateBuilding(bIdx, "name", e.target.value)}
          placeholder={`Building ${bIdx + 1}`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Floors</span>
          <Stepper value={(building.floors || []).length} onChange={(n) => setFloorCount(bIdx, n)} min={0} max={10} variant="dark" />
        </div>
        {roomsInBuilding > 0 && (
          <div className="shrink-0 ml-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
            <span className="text-xs font-bold text-emerald-400">{roomsInBuilding} rooms</span>
          </div>
        )}
      </div>

      {(building.floors || []).length > 0 ? (
        <div className="p-4 space-y-3 bg-white dark:bg-[#111111]">
          {building.floors.map((floor, fIdx) => (
            <FloorSection
              key={fIdx}
              floor={floor}
              bIdx={bIdx}
              fIdx={fIdx}
              updateFloor={updateFloor}
              setWardCount={setWardCount}
              updateWard={updateWard}
              setRoomCount={setRoomCount}
              updateRoom={updateRoom}
            />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-slate-600 dark:text-[#999999] bg-white dark:bg-[#111111]">
          Set floor count above to configure this building
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

  useEffect(() => {
    infrastructureApi.get(user.hospitalId)
      .then((data) => {
        if (data?.length) {
          setBuildings(data.map((b) => ({
            name: b.name,
            floors: (b.floors ?? []).map((f) => ({
              name: f.name,
              wards: (f.wards ?? []).map((w) => ({
                name: w.name,
                dailyCharge: String(w.dailyCharge ?? "500"),
                roomType: w.roomType ?? "GENERAL",
                bedCount: w.bedCount ?? 1,
                rooms: (w.rooms ?? []).map((r) => ({ id: r.id, name: r.name })),
              })),
            })),
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.hospitalId]);

  const totalRooms = useMemo(() =>
    buildings.reduce((s, b) => s + (b.floors || []).reduce((fs, f) => fs + (f.wards || []).reduce((ws, w) => ws + (w.rooms?.length || 0), 0), 0), 0),
    [buildings]
  );
  const totalFloors = useMemo(() =>
    buildings.reduce((s, b) => s + (b.floors || []).length, 0),
    [buildings]
  );
  const totalWards = useMemo(() =>
    buildings.reduce((s, b) => s + (b.floors || []).reduce((fs, f) => fs + (f.wards || []).length, 0), 0),
    [buildings]
  );

  const setBuildingCount = (n) =>
    setBuildings((p) => resizeTo(p, n, (i) => ({ name: `Building ${i + 1}`, floors: [] })));

  const setFloorCount = (bIdx, n) =>
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : { ...b, floors: resizeTo(b.floors, n, (j) => ({ name: `Floor ${j}`, wards: [] })) }));

  const setWardCount = (bIdx, fIdx, n) =>
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f, wards: resizeTo(f.wards, n, () => ({ name: "", dailyCharge: "500", roomType: "GENERAL", bedCount: 1, rooms: [] }))
      })
    }));

  const setRoomCount = (bIdx, fIdx, wIdx, n) =>
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f, wards: f.wards.map((w, k) => k !== wIdx ? w : {
          ...w, rooms: resizeTo(w.rooms, n, () => ({ id: null, name: "" }))
        })
      })
    }));

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

  const updateRoom = (bIdx, fIdx, wIdx, rIdx, name) =>
    setBuildings((p) => p.map((b, i) => i !== bIdx ? b : {
      ...b, floors: b.floors.map((f, j) => j !== fIdx ? f : {
        ...f, wards: f.wards.map((w, k) => k !== wIdx ? w : {
          ...w, rooms: w.rooms.map((r, l) => l === rIdx ? { ...r, name } : r)
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
          wards: (f.wards || []).map((w) => ({
            name: w.name || "Ward",
            dailyCharge: parseFloat(w.dailyCharge) || 0,
            roomType: w.roomType || "GENERAL",
            bedCount: parseInt(w.bedCount) || 1,
            rooms: (w.rooms || []).map((r) => ({ id: r.id || null, name: r.name || "" })),
          })),
        })),
      }));
      await infrastructureApi.save(user.hospitalId, payload);
      notify("Infrastructure saved — rooms created in Room Allocation", "success");
    } catch {
      notify("Failed to save infrastructure", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400 dark:text-[#666666]">Loading infrastructure…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222] px-6 py-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Network className="w-5 h-5 text-slate-400" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Hospital Infrastructure</h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-[#888888]">
              Define your hospital layout · Buildings → Floors → Wards → Rooms
            </p>
          </div>
          <div className="shrink-0 grid grid-cols-4 gap-px rounded-lg overflow-hidden border border-emerald-100 dark:border-emerald-500/20 bg-emerald-100 dark:bg-emerald-500/10">
            {[
              { label: "Buildings", value: buildings.length },
              { label: "Floors", value: totalFloors },
              { label: "Wards", value: totalWards },
              { label: "Rooms", value: totalRooms },
            ].map(({ label, value }) => (
              <div key={label} className="bg-emerald-50 dark:bg-emerald-500/5 px-5 py-3 text-center">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{value}</p>
                <p className="text-[10px] font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {/* Building counter */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-[#1a1a1a] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-[#cccccc]">Number of Buildings / Blocks</p>
              <p className="text-xs text-slate-400 dark:text-[#666666]">Each building maps to a physical block in your hospital</p>
            </div>
          </div>
          <Stepper value={buildings.length} onChange={setBuildingCount} min={0} max={10} />
        </div>

        {/* Buildings */}
        {buildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-lg border-2 border-dashed border-slate-200 dark:border-[#2a2a2a]">
            <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-300 dark:text-[#333333]" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-[#999999]">No buildings configured</p>
            <p className="text-xs text-slate-300 dark:text-[#3a3a3a] mt-1">Increase the building count above to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {buildings.map((building, bIdx) => (
              <BuildingCard
                key={bIdx}
                building={building}
                bIdx={bIdx}
                updateBuilding={updateBuilding}
                setFloorCount={setFloorCount}
                updateFloor={updateFloor}
                setWardCount={setWardCount}
                updateWard={updateWard}
                setRoomCount={setRoomCount}
                updateRoom={updateRoom}
              />
            ))}
          </div>
        )}

        {/* Save bar */}
        {buildings.length > 0 && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222]">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">Saving will overwrite your existing IPD structure.</p>
                <p className="text-xs text-slate-400 dark:text-[#666666] mt-0.5">
                  Occupied rooms will be preserved. {totalRooms > 0 && `${totalRooms} rooms will be active in Room Allocation.`}
                </p>
              </div>
            </div>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary shrink-0">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save & Update Structure"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
