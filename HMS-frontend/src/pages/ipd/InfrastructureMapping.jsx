import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { infrastructureApi } from "@/utils/api";
import {
  Building2, Layers, LayoutList, Minus, Plus, Save, AlertTriangle, Network,
} from "lucide-react";

function resizeTo(arr, n, makeDefault) {
  if (n <= 0) return [];
  if (n > arr.length) return [...arr, ...Array(n - arr.length).fill(null).map((_, i) => makeDefault(arr.length + i))];
  return arr.slice(0, n);
}

function Stepper({ value, onChange, min = 0, max = 20, variant = "default" }) {
  const isDark = variant === "dark";
  const btnCls = isDark
    ? "w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
    : "w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-[#666666] hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
  const numCls = isDark
    ? "w-8 text-center text-sm font-bold text-white tabular-nums"
    : "w-7 text-center text-sm font-semibold text-slate-700 dark:text-[#cccccc] tabular-nums";
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={btnCls} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="w-3 h-3" />
      </button>
      <span className={numCls}>{value}</span>
      <button type="button" className={btnCls} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function WardRow({ ward, bIdx, fIdx, wIdx, updateWard }) {
  return (
    <div className="grid grid-cols-[1fr_148px_116px] items-center border-b border-slate-100 dark:border-[#1e1e1e] last:border-0 hover:bg-slate-50/60 dark:hover:bg-[#161616] transition-colors group">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
          <LayoutList className="w-2.5 h-2.5 text-emerald-500" />
        </div>
        <input
          className="flex-1 text-sm text-slate-700 dark:text-[#cccccc] bg-transparent focus:outline-none placeholder-slate-300 dark:placeholder-[#444444]"
          value={ward.name}
          onChange={(e) => updateWard(bIdx, fIdx, wIdx, "name", e.target.value)}
          placeholder={`Ward ${wIdx + 1}`}
        />
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-l border-slate-100 dark:border-[#1e1e1e]">
        <span className="text-xs text-slate-400 font-medium">₹</span>
        <input
          type="number"
          min="0"
          className="flex-1 text-sm text-slate-700 dark:text-[#cccccc] bg-transparent focus:outline-none placeholder-slate-300 dark:placeholder-[#444444] tabular-nums"
          value={ward.dailyCharge}
          onChange={(e) => updateWard(bIdx, fIdx, wIdx, "dailyCharge", e.target.value)}
          placeholder="500"
        />
      </div>
      <div className="flex items-center justify-center px-3 py-2.5 border-l border-slate-100 dark:border-[#1e1e1e]">
        <Stepper
          value={parseInt(ward.roomCount) || 0}
          onChange={(n) => updateWard(bIdx, fIdx, wIdx, "roomCount", String(n))}
          min={0}
          max={50}
        />
      </div>
    </div>
  );
}

function FloorSection({ floor, bIdx, fIdx, updateFloor, setWardCount, updateWard }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50/60 dark:bg-indigo-500/5 border-b border-indigo-100 dark:border-indigo-500/10">
        <div className="flex items-center gap-2 shrink-0">
          <Layers className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-500" />
          <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
            Floor {fIdx + 1}
          </span>
        </div>
        <input
          className="flex-1 min-w-0 text-sm text-slate-700 dark:text-[#cccccc] bg-white dark:bg-[#111111] border border-indigo-100 dark:border-indigo-500/20 rounded-md px-2.5 py-1 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 placeholder-slate-300 dark:placeholder-[#444444]"
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
        <>
          <div className="grid grid-cols-[1fr_148px_116px] bg-slate-50/80 dark:bg-[#161616] border-b border-slate-100 dark:border-[#1e1e1e]">
            <div className="px-4 py-1.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#555555] uppercase tracking-widest">Ward Name</span>
            </div>
            <div className="px-3 py-1.5 border-l border-slate-100 dark:border-[#1e1e1e]">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#555555] uppercase tracking-widest">Daily Charge</span>
            </div>
            <div className="px-3 py-1.5 border-l border-slate-100 dark:border-[#1e1e1e] text-center">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#555555] uppercase tracking-widest">Rooms</span>
            </div>
          </div>
          {floor.wards.map((ward, wIdx) => (
            <WardRow key={wIdx} ward={ward} bIdx={bIdx} fIdx={fIdx} wIdx={wIdx} updateWard={updateWard} />
          ))}
        </>
      ) : (
        <div className="py-4 text-center text-xs text-slate-400 dark:text-[#555555]">
          Set ward count above to configure rooms
        </div>
      )}
    </div>
  );
}

function BuildingCard({ building, bIdx, updateBuilding, setFloorCount, updateFloor, setWardCount, updateWard }) {
  const roomsInBuilding = building.floors.reduce(
    (s, f) => s + f.wards.reduce((ws, w) => ws + (parseInt(w.roomCount) || 0), 0), 0
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#222222] overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 dark:bg-[#0f0f0f]">
        <div className="flex items-center gap-2 shrink-0">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Building {bIdx + 1}
          </span>
        </div>
        <input
          className="flex-1 min-w-0 text-sm font-semibold text-white bg-white/8 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-white/25 placeholder-white/25"
          value={building.name}
          onChange={(e) => updateBuilding(bIdx, "name", e.target.value)}
          placeholder={`Building ${bIdx + 1}`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Floors</span>
          <Stepper value={building.floors.length} onChange={(n) => setFloorCount(bIdx, n)} min={0} max={10} variant="dark" />
        </div>
        {roomsInBuilding > 0 && (
          <div className="shrink-0 ml-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20">
            <span className="text-xs font-bold text-emerald-400">{roomsInBuilding} rooms</span>
          </div>
        )}
      </div>

      {building.floors.length > 0 ? (
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
            />
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-slate-400 dark:text-[#555555] bg-white dark:bg-[#111111]">
          Set floor count above to begin configuring this building
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
                roomCount: String(w.roomCount ?? "0"),
              })),
            })),
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.hospitalId]);

  const totalRooms = useMemo(
    () => buildings.reduce((s, b) => s + b.floors.reduce((fs, f) => fs + f.wards.reduce((ws, w) => ws + (parseInt(w.roomCount) || 0), 0), 0), 0),
    [buildings]
  );
  const totalFloors = useMemo(
    () => buildings.reduce((s, b) => s + b.floors.length, 0),
    [buildings]
  );
  const totalWards = useMemo(
    () => buildings.reduce((s, b) => s + b.floors.reduce((fs, f) => fs + f.wards.length, 0), 0),
    [buildings]
  );

  const setBuildingCount = (n) =>
    setBuildings((prev) => resizeTo(prev, n, (i) => ({ name: `Building ${i + 1}`, floors: [] })));

  const setFloorCount = (bIdx, n) =>
    setBuildings((prev) =>
      prev.map((b, i) =>
        i === bIdx
          ? { ...b, floors: resizeTo(b.floors, n, (j) => ({ name: `Floor ${j}`, wards: [] })) }
          : b
      )
    );

  const setWardCount = (bIdx, fIdx, n) =>
    setBuildings((prev) =>
      prev.map((b, i) =>
        i === bIdx
          ? {
              ...b,
              floors: b.floors.map((f, j) =>
                j === fIdx
                  ? { ...f, wards: resizeTo(f.wards, n, (k) => ({ name: `Ward ${k + 1}`, dailyCharge: "500", roomCount: "0" })) }
                  : f
              ),
            }
          : b
      )
    );

  const updateBuilding = (bIdx, field, value) =>
    setBuildings((prev) => prev.map((b, i) => (i === bIdx ? { ...b, [field]: value } : b)));

  const updateFloor = (bIdx, fIdx, field, value) =>
    setBuildings((prev) =>
      prev.map((b, i) =>
        i === bIdx ? { ...b, floors: b.floors.map((f, j) => (j === fIdx ? { ...f, [field]: value } : f)) } : b
      )
    );

  const updateWard = (bIdx, fIdx, wIdx, field, value) =>
    setBuildings((prev) =>
      prev.map((b, i) =>
        i === bIdx
          ? {
              ...b,
              floors: b.floors.map((f, j) =>
                j === fIdx
                  ? { ...f, wards: f.wards.map((w, k) => (k === wIdx ? { ...w, [field]: value } : w)) }
                  : f
              ),
            }
          : b
      )
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildings.map((b) => ({
        name: b.name || `Building`,
        floors: b.floors.map((f) => ({
          name: f.name || `Floor`,
          wards: f.wards.map((w) => ({
            name: w.name || `Ward`,
            dailyCharge: parseFloat(w.dailyCharge) || 0,
            roomCount: parseInt(w.roomCount) || 0,
          })),
        })),
      }));
      await infrastructureApi.save(user.hospitalId, payload);
      notify("Infrastructure updated successfully", "success");
    } catch {
      notify("Failed to save infrastructure", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-slate-400 dark:text-[#666666]">Loading infrastructure…</div>
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
              Define your hospital hierarchy · Buildings → Floors → Wards → Rooms
            </p>
          </div>
          <div className="shrink-0 grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-emerald-100 dark:border-emerald-500/20 bg-emerald-100 dark:bg-emerald-500/10">
            {[
              { label: "Buildings", value: buildings.length },
              { label: "Floors", value: totalFloors },
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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {/* Building count selector */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-[#1a1a1a] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-[#cccccc]">Number of Buildings / Blocks</p>
              <p className="text-xs text-slate-400 dark:text-[#666666]">Configure each building independently</p>
            </div>
          </div>
          <Stepper value={buildings.length} onChange={setBuildingCount} min={0} max={10} />
        </div>

        {/* Buildings */}
        {buildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#2a2a2a]">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-slate-300 dark:text-[#444444]" />
            </div>
            <p className="text-sm font-semibold text-slate-400 dark:text-[#666666]">No buildings configured</p>
            <p className="text-xs text-slate-300 dark:text-[#444444] mt-1">Use the counter above to add buildings</p>
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
              />
            ))}
          </div>
        )}

        {/* Stats summary row (only when there's data) */}
        {totalWards > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Buildings", value: buildings.length, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-[#1a1a1a]", border: "border-slate-200 dark:border-[#2a2a2a]" },
              { label: "Total Wards", value: totalWards, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50/50 dark:bg-indigo-500/5", border: "border-indigo-100 dark:border-indigo-500/20" },
              { label: "Total Rooms", value: totalRooms, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/50 dark:bg-emerald-500/5", border: "border-emerald-100 dark:border-emerald-500/20" },
            ].map(({ label, value, color, bg, border }) => (
              <div key={label} className={`rounded-xl border ${border} ${bg} px-4 py-3 text-center`}>
                <p className={`text-3xl font-black tabular-nums ${color}`}>{value}</p>
                <p className="text-xs font-semibold text-slate-500 dark:text-[#666666] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Save bar */}
        {buildings.length > 0 && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-[#cccccc]">This will overwrite your existing IPD hierarchy.</p>
                <p className="text-xs text-slate-400 dark:text-[#666666] mt-0.5">
                  Make sure total beds don&apos;t exceed your plan limit.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary shrink-0"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save & Update Structure"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
