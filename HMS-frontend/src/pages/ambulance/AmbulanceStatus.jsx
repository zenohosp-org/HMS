import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ambulanceApi } from "@/utils/api";
import {
  Ambulance, Search, CheckCircle2, Clock3, XCircle,
  Truck, Activity, Filter, MapPin, Car, Phone, User
} from "lucide-react";

const STATUS_CONFIG = {
  PENDING: { label: "Pending", bg: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Clock3 },
  DISPATCHED: { label: "Dispatched", bg: "bg-blue-500", light: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400", icon: Truck },
  EN_ROUTE: { label: "En Route", bg: "bg-violet-500", light: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400", icon: Activity },
  COMPLETED: { label: "Completed", bg: "bg-emerald-500", light: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", bg: "bg-rose-500", light: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400", icon: XCircle },
};

const NEXT_STATUS = { PENDING: "DISPATCHED", DISPATCHED: "EN_ROUTE", EN_ROUTE: "COMPLETED" };
const NEXT_LABEL = { PENDING: "Dispatch", DISPATCHED: "En Route", EN_ROUTE: "Complete" };

const ALL_STATUSES = ["ALL", "PENDING", "DISPATCHED", "EN_ROUTE", "COMPLETED", "CANCELLED"];

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.light}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function StatusSelect({ current, bookingId, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const advance = async () => {
    const next = NEXT_STATUS[current];
    if (!next) return;
    setLoading(true);
    try { await ambulanceApi.updateStatus(bookingId, { status: next }); onUpdate(); }
    finally { setLoading(false); }
  };

  const cancel = async () => {
    setLoading(true);
    try { await ambulanceApi.updateStatus(bookingId, { status: "CANCELLED" }); onUpdate(); }
    finally { setLoading(false); }
  };

  if (!NEXT_STATUS[current] && current !== "CANCELLED") return <StatusPill status={current} />;
  if (current === "CANCELLED" || current === "COMPLETED") return <StatusPill status={current} />;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StatusPill status={current} />
      <button
        onClick={advance}
        disabled={loading}
        className={`px-3 py-1 rounded-full text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50
          ${current === "PENDING" ? "bg-blue-500 hover:bg-blue-600" : current === "DISPATCHED" ? "bg-violet-500 hover:bg-violet-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
        → {NEXT_LABEL[current]}
      </button>
      <button
        onClick={cancel}
        disabled={loading}
        className="px-3 py-1 rounded-full text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 transition-colors disabled:opacity-50">
        Cancel
      </button>
    </div>
  );
}

export default function AmbulanceStatus() {
  const { user } = useAuth();
  const hospitalId = user?.hospitalId;

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await ambulanceApi.getBookings(hospitalId);
      setBookings(data);
    } finally { setLoading(false); }
  };

  const filtered = bookings.filter(b => {
    if (filterStatus !== "ALL" && b.status !== filterStatus) return false;
    if (filterDate && b.bookingDate !== filterDate) return false;
    if (search) {
      const q = search.toLowerCase();
      const patientName = b.patient ? `${b.patient.firstName} ${b.patient.lastName}`.toLowerCase() : "";
      const mrn = b.patient?.mrn?.toLowerCase() || "";
      if (!patientName.includes(q) && !mrn.includes(q) && !(b.vehicleNumber || "").toLowerCase().includes(q) && !(b.driverName || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = bookings.filter(b => b.status === s).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ambulance Status</h1>
            <p className="text-sm text-slate-500 dark:text-[#666]">Live dispatch tracking and status updates</p>
          </div>
        </div>
      </div>

      {/* Status summary pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "ALL" : s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all
              ${filterStatus === s
                ? `${cfg.bg} text-white border-transparent shadow-lg`
                : "bg-white dark:bg-[#111] border-slate-200 dark:border-[#333] text-slate-600 dark:text-[#888] hover:border-slate-300"}`}>
            {counts[s] > 0 && (
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${filterStatus === s ? "bg-white/20 text-white" : `${cfg.light}`}`}>
                {counts[s]}
              </span>
            )}
            {cfg.label}
          </button>
        ))}
        {filterStatus !== "ALL" && (
          <button onClick={() => setFilterStatus("ALL")}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, driver, vehicle…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 placeholder:text-slate-400"
          />
        </div>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] text-slate-700 dark:text-[#ccc] text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400"
        />
        {filterDate && (
          <button onClick={() => setFilterDate("")}
            className="px-3 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] transition-colors">
            Clear date
          </button>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-slate-100 dark:bg-[#222] rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-100 dark:bg-[#222] rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 dark:bg-[#222] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg text-slate-400">
          <Ambulance className="w-12 h-12 mb-3 opacity-25" />
          <p className="font-semibold text-sm">No bookings match the filter</p>
          <p className="text-xs mt-1">Try adjusting your search or status filter</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(b => {
            const cfg = STATUS_CONFIG[b.status];
            return (
              <div key={b.id} className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow">
                {/* Colored top bar */}
                <div className={`h-1 w-full ${cfg.bg}`} />

                <div className="p-5 space-y-4">
                  {/* Top row: date + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{b.bookingDate}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{b.bookingTime}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-400">#{b.id}</span>
                  </div>

                  {/* Patient */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#222] flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-slate-500 dark:text-[#666]" />
                    </div>
                    {b.patient ? (
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{b.patient.firstName} {b.patient.lastName}</p>
                        <p className="text-xs text-slate-400">{b.patient.mrn}</p>
                      </div>
                    ) : <p className="text-sm text-slate-400 italic">Walk-in / No patient</p>}
                  </div>

                  {/* Pickup / Destination */}
                  {(b.pickupAddress || b.destinationAddress) && (
                    <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-[#1a1a1a]">
                      {b.pickupAddress && (
                        <div className="flex gap-2 text-xs text-slate-600 dark:text-[#aaa]">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{b.pickupAddress}</span>
                        </div>
                      )}
                      {b.destinationAddress && (
                        <div className="flex gap-2 text-xs text-slate-500 dark:text-[#777]">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{b.destinationAddress}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Type + Charge */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-[#666]">{b.ambulanceType?.name || "Standard"}</span>
                    {b.charge && (
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₹{b.charge}</span>
                    )}
                  </div>

                  {/* Driver / Vehicle */}
                  {(b.driverName || b.vehicleNumber) && (
                    <div className="flex gap-4 text-xs text-slate-500 dark:text-[#666]">
                      {b.driverName && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.driverName}{b.driverPhone && ` · ${b.driverPhone}`}</span>}
                      {b.vehicleNumber && <span className="flex items-center gap-1"><Car className="w-3 h-3" />{b.vehicleNumber}</span>}
                    </div>
                  )}

                  {/* Status control */}
                  <div className="pt-1 border-t border-slate-100 dark:border-[#1e1e1e]">
                    <StatusSelect current={b.status} bookingId={b.id} onUpdate={load} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
