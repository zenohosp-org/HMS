import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { assetApi } from "@/utils/api";
import {
  X, User, Phone, Users, Package, CalendarClock, ScrollText,
  Search, Plus, Loader2, ArrowUpRight, Tag, AlertCircle,
} from "lucide-react";
import { formatDateTime } from "@/utils/validators";

function AssetStatusBadge({ status }) {
  const map = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    IN_USE: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    MAINTENANCE: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    DISPOSED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${map[status] ?? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222] dark:text-[#888] dark:border-[#333]"}`}>
      {status ?? "—"}
    </span>
  );
}

function AssignAssetDropdown({ hospitalId, roomId, onAssigned }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchAvailable = useCallback(async (q) => {
    setLoading(true);
    try {
      const data = await assetApi.getAvailable(hospitalId, q || undefined);
      setResults(data);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [hospitalId]);

  const onFocus = () => { setOpen(true); fetchAvailable(query); };

  const onChange = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAvailable(val), 300);
  };

  const assign = async (asset) => {
    setAssigning(asset.assetId);
    try {
      await assetApi.assignToRoom(asset.assetId, roomId, hospitalId);
      onAssigned();
      setQuery("");
      setOpen(false);
    } finally { setAssigning(null); }
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={query}
          onChange={e => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder="Search available assets…"
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] text-slate-800 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400"
        />
      </div>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400">No available assets found</div>
          ) : results.map(a => (
            <button
              key={a.assetId}
              disabled={!!assigning}
              onClick={() => assign(a)}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-[#222] border-b border-slate-100 dark:border-[#2a2a2a] last:border-0 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{a.assetName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{a.assetCode}{a.make ? ` · ${a.make}` : ""}{a.model ? ` ${a.model}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <AssetStatusBadge status={a.status} />
                  {assigning === a.assetId
                    ? <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                    : <Plus className="w-3 h-3 text-emerald-500" />}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RoomDetailPanel({ room, onClose, onViewLogs }) {
  const { user } = useAuth();
  const hospitalId = user?.hospitalId;

  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [showAssign, setShowAssign] = useState(false);

  const loadAssets = useCallback(async () => {
    if (!room?.id || !hospitalId) return;
    setAssetsLoading(true);
    try {
      const data = await assetApi.getByRoom(hospitalId, room.id);
      setAssets(data);
    } catch { setAssets([]); }
    finally { setAssetsLoading(false); }
  }, [room?.id, hospitalId]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const handleUnassign = async (assetId) => {
    setRemovingId(assetId);
    try {
      await assetApi.unassignFromRoom(assetId);
      await loadAssets();
    } finally { setRemovingId(null); }
  };

  return (
    <div className="w-1/3 shrink-0 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-2xl flex flex-col overflow-hidden self-start sticky top-0">

      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-[#1e1e1e]">
        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-[#666666] uppercase tracking-wider mb-1">{room.roomNumber}</p>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border
              ${room.roomType === "ICU"
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#222222] dark:text-[#888888] dark:border-[#333333]"}`}>
              {room.roomType}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border
              ${room.status === "AVAILABLE"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"}`}>
              {room.status}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Allocation token */}
        {room.allocationToken && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">Allocation Token</p>
            <span className="text-sm font-bold tracking-widest text-violet-700 dark:text-violet-300 font-mono">{room.allocationToken}</span>
          </div>
        )}

        {/* Est. discharge */}
        {room.approxDischargeTime && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <CalendarClock className="w-3.5 h-3.5" />Est. Discharge
            </div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{formatDateTime(room.approxDischargeTime)}</p>
          </div>
        )}

        {/* Patient */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <User className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666]" />
            <p className="text-xs font-bold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Patient</p>
          </div>
          {room.currentPatient ? (
            <div className="space-y-1 pl-1">
              <p className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">{room.currentPatient.firstName} {room.currentPatient.lastName}</p>
              <p className="text-xs text-slate-400 dark:text-[#999999]">{room.currentPatient.mrn}</p>
            </div>
          ) : <p className="text-sm text-slate-400 dark:text-[#999999] pl-1">No patient assigned</p>}
        </div>

        <div className="border-t border-slate-100 dark:border-[#1e1e1e]" />

        {/* Attender */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666]" />
            <p className="text-xs font-bold text-slate-500 dark:text-[#666666] uppercase tracking-wider">Attender</p>
          </div>
          {room.attenderName ? (
            <div className="space-y-1.5 pl-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{room.attenderName}</p>
                {room.attenderRelationship && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-500 dark:text-[#888888] border border-slate-200 dark:border-[#333333]">
                    {room.attenderRelationship}
                  </span>
                )}
              </div>
              {room.attenderPhone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666666]">
                  <Phone className="w-3 h-3" />{room.attenderPhone}
                </div>
              )}
            </div>
          ) : <p className="text-sm text-amber-500 dark:text-amber-400 pl-1">No attender assigned</p>}
        </div>

        <div className="border-t border-slate-100 dark:border-[#1e1e1e]" />

        {/* Assets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666]" />
              <p className="text-xs font-bold text-slate-500 dark:text-[#666666] uppercase tracking-wider">
                Assets in Room
                {assets.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    {assets.length}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowAssign(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 transition-colors"
            >
              <Plus className="w-3 h-3" /> Assign
            </button>
          </div>

          {/* Assign search */}
          {showAssign && (
            <div className="mb-3">
              <AssignAssetDropdown
                hospitalId={hospitalId}
                roomId={room.id}
                onAssigned={() => { loadAssets(); setShowAssign(false); }}
              />
            </div>
          )}

          {/* Assets list */}
          {assetsLoading ? (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-xs">Loading assets…</span>
            </div>
          ) : assets.length === 0 ? (
            <div className="py-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-[#2a2a2a]">
              <Package className="w-6 h-6 text-slate-500 dark:text-[#777777] mb-1.5" />
              <p className="text-xs text-slate-400 dark:text-[#999999]">No assets assigned yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assets.map(a => (
                <div key={a.assetId} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-100 dark:border-[#222] bg-slate-50 dark:bg-[#1a1a1a] group">
                  <div className="w-7 h-7 rounded-lg bg-white dark:bg-[#252525] border border-slate-200 dark:border-[#333] flex items-center justify-center shrink-0 mt-0.5">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white leading-tight truncate">{a.assetName}</p>
                      <button
                        onClick={() => handleUnassign(a.assetId)}
                        disabled={removingId === a.assetId}
                        className="shrink-0 p-0.5 rounded text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        title="Remove from room"
                      >
                        {removingId === a.assetId
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <X className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {a.assetCode && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Tag className="w-2.5 h-2.5" />{a.assetCode}
                        </span>
                      )}
                      {(a.make || a.model) && (
                        <span className="text-[10px] text-slate-400">{[a.make, a.model].filter(Boolean).join(" ")}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <AssetStatusBadge status={a.status} />
                      <a
                        href={`https://asset.zenohosp.com/assets/${a.assetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-emerald-500 transition-colors"
                        title="View in Assets app"
                      >
                        Details <ArrowUpRight className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-[#1e1e1e] shrink-0">
        <button
          onClick={onViewLogs}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] text-sm font-semibold text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ScrollText className="w-4 h-4" />View Room Logs
        </button>
      </div>
    </div>
  );
}

export default RoomDetailPanel;
