import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { ambulanceApi, patientApi } from "@/utils/api";
import {
  Ambulance, Plus, X, Search, Calendar, Clock, MapPin,
  User, Phone, Car, CreditCard, FileText,
  CheckCircle2, AlertCircle, Clock3, XCircle, Truck,
  Banknote, TrendingUp, Activity, MoreHorizontal,
  Wrench, Trash2, Loader2, Edit2
} from "lucide-react";

const STATUS_CONFIG = {
  PENDING:    { label: "Pending",    color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400",     icon: Clock3 },
  DISPATCHED: { label: "Dispatched", color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400",         icon: Truck },
  EN_ROUTE:   { label: "En Route",   color: "text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400", icon: Activity },
  COMPLETED:  { label: "Completed",  color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400", icon: CheckCircle2 },
  CANCELLED:  { label: "Cancelled",  color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400",         icon: XCircle },
};

const VEHICLE_STATUS_CONFIG = {
  AVAILABLE:   { label: "Available",   cls: "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30" },
  IN_USE:      { label: "In Use",      cls: "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30" },
  MAINTENANCE: { label: "Maintenance", cls: "bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30" },
};

const PAYMENT_OPTIONS = ["UNPAID", "PAID", "PARTIAL"];

// ── Shared sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-[#666] mt-0.5 font-medium">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function PatientSearch({ hospitalId, value, onChange }) {
  const [query, setQuery] = useState(value ? `${value.firstName} ${value.lastName}` : "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = async (q) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await patientApi.search(hospitalId, q);
      setResults(data || []);
      setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const select = (p) => { onChange(p); setQuery(`${p.firstName} ${p.lastName} (${p.mrn})`); setOpen(false); };
  const clear = () => { onChange(null); setQuery(""); setResults([]); };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by name, MRN, or phone…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#1a1a1a] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        />
        {query && <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-[#333] rounded-xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">No patients found</div>
          ) : results.slice(0, 6).map(p => (
            <button key={p.id} onClick={() => select(p)} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#222] last:border-0 transition-colors">
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.firstName} {p.lastName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.mrn} · {p.phone}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add / Edit Vehicle Modal ─────────────────────────────────────────────────

function VehicleModal({ hospitalId, types, vehicle, onClose, onSaved }) {
  const isEdit = !!vehicle;
  const [form, setForm] = useState({
    vehicleNumber: vehicle?.vehicleNumber || "",
    vehicleName: vehicle?.vehicleName || "",
    ambulanceTypeId: vehicle?.ambulanceType?.id ? String(vehicle.ambulanceType.id) : "",
    defaultCharge: vehicle?.defaultCharge != null ? String(vehicle.defaultCharge) : "",
    notes: vehicle?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicleNumber.trim()) return;
    setSaving(true);
    try {
      const payload = {
        vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
        vehicleName: form.vehicleName.trim() || null,
        ambulanceTypeId: form.ambulanceTypeId ? Number(form.ambulanceTypeId) : null,
        defaultCharge: form.defaultCharge ? parseFloat(form.defaultCharge) : null,
        notes: form.notes.trim() || null,
      };
      if (isEdit) {
        await ambulanceApi.updateVehicle(vehicle.id, payload);
      } else {
        await ambulanceApi.createVehicle(hospitalId, payload);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-600";
  const labelCls = "block text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-[#222222]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1e1e1e]">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">{isEdit ? "Edit Vehicle" : "Add Vehicle"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Vehicle Number *</label>
            <input
              autoFocus
              required
              value={form.vehicleNumber}
              onChange={e => set("vehicleNumber", e.target.value.toUpperCase())}
              placeholder="TN 01 AB 1234"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Vehicle Name / Model</label>
            <input
              value={form.vehicleName}
              onChange={e => set("vehicleName", e.target.value)}
              placeholder="e.g. Toyota Hiace ALS"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ambulance Type</label>
              <select value={form.ambulanceTypeId} onChange={e => set("ambulanceTypeId", e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Default Charge (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.defaultCharge}
                onChange={e => set("defaultCharge", e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Any additional info…"
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#333] text-sm font-semibold text-slate-600 dark:text-[#888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.vehicleNumber.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Type Modal ───────────────────────────────────────────────────────────

function AddTypeModal({ hospitalId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [charge, setCharge] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const t = await ambulanceApi.createType(hospitalId, { name: name.trim(), defaultCharge: charge ? parseFloat(charge) : null });
      onCreated(t);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900 dark:text-white">Add Ambulance Type</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Type Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Basic Life Support"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Default Charge (₹)</label>
            <input type="number" value={charge} onChange={e => setCharge(e.target.value)} placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#333] text-sm font-semibold text-slate-600 dark:text-[#888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {saving ? "Saving…" : "Add Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Vehicles Tab ─────────────────────────────────────────────────────────────

function VehiclesTab({ hospitalId, types, onRefreshTypes }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setVehicles(await ambulanceApi.getVehicles(hospitalId)); }
    catch { setVehicles([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleStatusToggle = async (v) => {
    const next = v.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE";
    if (!confirm(`Set ${v.vehicleNumber} to ${next}?`)) return;
    await ambulanceApi.updateVehicleStatus(v.id, next);
    load();
  };

  const handleDelete = async (v) => {
    if (!confirm(`Delete vehicle ${v.vehicleNumber}? This cannot be undone.`)) return;
    await ambulanceApi.deleteVehicle(v.id);
    load();
  };

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    return (
      v.vehicleNumber.toLowerCase().includes(q) ||
      (v.vehicleName || "").toLowerCase().includes(q) ||
      (v.ambulanceType?.name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Fleet</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-100 dark:border-rose-800/30">
            {vehicles.length} vehicles
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTypeModal(true)} className="btn-secondary text-sm">
            + Add Type
          </button>
          <button onClick={() => { setEditVehicle(null); setShowModal(true); }} className="btn-primary text-sm">
            + Add Vehicle
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by number, model, or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
        />
      </div>

      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]">
                {["Vehicle", "Type", "Default Charge", "Status", "Notes", ""].map(h => (
                  <th key={h} className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      <p className="text-sm font-medium text-slate-400">Loading vehicles…</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center">
                        <Ambulance className="w-8 h-8 text-slate-200 dark:text-slate-800" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">
                        {search ? "No vehicles match your search." : "No vehicles registered yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(v => {
                const vsCfg = VEHICLE_STATUS_CONFIG[v.status] || VEHICLE_STATUS_CONFIG.AVAILABLE;
                return (
                  <tr key={v.id} className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 flex items-center justify-center shrink-0">
                          <Car className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div>
                          <p className="font-bold text-[15px] text-slate-900 dark:text-white leading-tight">{v.vehicleNumber}</p>
                          {v.vehicleName && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{v.vehicleName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {v.ambulanceType?.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {v.defaultCharge != null ? `₹${Number(v.defaultCharge).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${vsCfg.cls}`}>
                        {vsCfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 dark:text-slate-500 max-w-[160px] truncate">
                      {v.notes || "—"}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === v.id ? null : v.id); }}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      {openMenuId === v.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-6 top-14 w-52 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-slate-100 dark:border-[#252525] z-20 py-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => { setOpenMenuId(null); setEditVehicle(v); setShowModal(true); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222] transition-all"
                            >
                              <Edit2 className="w-4 h-4" /> Edit Details
                            </button>
                            {v.status !== "IN_USE" && (
                              <button
                                onClick={() => { setOpenMenuId(null); handleStatusToggle(v); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all"
                              >
                                <Wrench className="w-4 h-4" />
                                {v.status === "MAINTENANCE" ? "Mark Available" : "Mark Maintenance"}
                              </button>
                            )}
                            <div className="h-px bg-slate-50 dark:bg-[#252525] my-1" />
                            <button
                              onClick={() => { setOpenMenuId(null); handleDelete(v); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                            >
                              <Trash2 className="w-4 h-4" /> Delete Vehicle
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <VehicleModal
          hospitalId={hospitalId}
          types={types}
          vehicle={editVehicle}
          onClose={() => { setShowModal(false); setEditVehicle(null); }}
          onSaved={load}
        />
      )}
      {showTypeModal && (
        <AddTypeModal
          hospitalId={hospitalId}
          onClose={() => setShowTypeModal(false)}
          onCreated={() => { onRefreshTypes(); setShowTypeModal(false); }}
        />
      )}
    </div>
  );
}

// ── Bookings Tab ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  patient: null,
  bookingDate: new Date().toISOString().split("T")[0],
  bookingTime: new Date().toTimeString().slice(0, 5),
  pickupAddress: "",
  destinationAddress: "",
  vehicleId: "",
  driverName: "",
  driverPhone: "",
  chiefComplaint: "",
  paymentStatus: "UNPAID",
  notes: "",
};

function BookingsTab({ hospitalId, types }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, today: 0, completed: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const load = async () => {
    const [b, s, av] = await Promise.all([
      ambulanceApi.getBookings(hospitalId).catch(() => []),
      ambulanceApi.getStats(hospitalId).catch(() => ({ total: 0, pending: 0, today: 0, completed: 0 })),
      ambulanceApi.getAvailableVehicles(hospitalId).catch(() => []),
    ]);
    setBookings(b);
    setStats(s);
    setAvailableVehicles(av);
  };

  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const onVehicleChange = (id) => {
    set("vehicleId", id);
  };

  const selectedVehicle = availableVehicles.find(v => String(v.id) === String(form.vehicleId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.bookingDate || !form.bookingTime) return;
    setSaving(true);
    setError(null);
    try {
      await ambulanceApi.createBooking(hospitalId, {
        patientId: form.patient?.id ?? null,
        bookingDate: form.bookingDate,
        bookingTime: form.bookingTime,
        pickupAddress: form.pickupAddress,
        destinationAddress: form.destinationAddress,
        vehicleId: form.vehicleId ? Number(form.vehicleId) : null,
        driverName: form.driverName,
        driverPhone: form.driverPhone,
        paymentStatus: form.paymentStatus,
        notes: form.notes,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to book ambulance");
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id, status) => {
    await ambulanceApi.updateStatus(id, { status });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Cancel this booking?")) return;
    await ambulanceApi.deleteBooking(id);
    load();
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-600";
  const labelCls = "block text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bookings" value={stats.total}     icon={Ambulance}     color="bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#888]" />
        <StatCard label="Pending"        value={stats.pending}   icon={Clock3}        color="bg-amber-50 dark:bg-amber-500/10 text-amber-500" />
        <StatCard label="Today's Runs"   value={stats.today}     icon={TrendingUp}    color="bg-blue-50 dark:bg-blue-500/10 text-blue-500" />
        <StatCard label="Completed"      value={stats.completed} icon={CheckCircle2}  color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500" />
      </div>

      {/* Booking Form */}
      <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-500" />
          <h2 className="font-bold text-slate-900 dark:text-white text-sm">New Booking</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Ambulance booked successfully
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-sm font-medium">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Patient + Date + Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}><User className="inline w-3 h-3 mr-1" />Patient (optional)</label>
              <PatientSearch hospitalId={hospitalId} value={form.patient} onChange={p => set("patient", p)} />
            </div>
            <div>
              <label className={labelCls}><Calendar className="inline w-3 h-3 mr-1" />Date *</label>
              <input type="date" required value={form.bookingDate} onChange={e => set("bookingDate", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}><Clock className="inline w-3 h-3 mr-1" />Time *</label>
              <input type="time" required value={form.bookingTime} onChange={e => set("bookingTime", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><MapPin className="inline w-3 h-3 mr-1" />Pickup Address</label>
              <textarea rows={2} value={form.pickupAddress} onChange={e => set("pickupAddress", e.target.value)} placeholder="Enter pickup location…" className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}><MapPin className="inline w-3 h-3 mr-1" />Destination Address</label>
              <textarea rows={2} value={form.destinationAddress} onChange={e => set("destinationAddress", e.target.value)} placeholder="Enter destination…" className={`${inputCls} resize-none`} />
            </div>
          </div>

          {/* Vehicle + Driver */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}><Car className="inline w-3 h-3 mr-1" />Vehicle</label>
              <select value={form.vehicleId} onChange={e => onVehicleChange(e.target.value)} className={inputCls}>
                <option value="">— Select vehicle —</option>
                {availableVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleNumber}{v.vehicleName ? ` · ${v.vehicleName}` : ""}{v.ambulanceType ? ` · ${v.ambulanceType.name}` : ""}
                  </option>
                ))}
              </select>
              {selectedVehicle?.defaultCharge != null && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">
                  Default charge: ₹{Number(selectedVehicle.defaultCharge).toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}><User className="inline w-3 h-3 mr-1" />Driver Name</label>
              <input value={form.driverName} onChange={e => set("driverName", e.target.value)} placeholder="Driver's full name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}><Phone className="inline w-3 h-3 mr-1" />Driver Phone</label>
              <input value={form.driverPhone} onChange={e => set("driverPhone", e.target.value)} placeholder="+91 XXXXX XXXXX" className={inputCls} />
            </div>
          </div>

          {/* Payment + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}><CreditCard className="inline w-3 h-3 mr-1" />Payment Status</label>
              <select value={form.paymentStatus} onChange={e => set("paymentStatus", e.target.value)} className={inputCls}>
                {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}><FileText className="inline w-3 h-3 mr-1" />Notes</label>
              <textarea rows={1} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional instructions…" className={`${inputCls} resize-none`} />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm shadow-lg shadow-rose-500/20 transition-all active:scale-[0.98] disabled:opacity-50">
              <Ambulance className="w-4 h-4" />
              {saving ? "Booking…" : "Book Ambulance"}
            </button>
          </div>
        </form>
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white text-sm">All Bookings</h2>
          <span className="text-xs text-slate-400">{bookings.length} total</span>
        </div>
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Ambulance className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No ambulance bookings yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#1e1e1e] bg-slate-50/30 dark:bg-[#0f0f0f]">
                  {["Date & Time", "Patient", "Pickup → Destination", "Vehicle", "Driver", "Status", "Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} className="border-b border-slate-50 dark:border-[#1a1a1a] hover:bg-slate-50/50 dark:hover:bg-[#1a1a1a]/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{b.bookingDate}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{b.bookingTime}</p>
                    </td>
                    <td className="px-4 py-3">
                      {b.patient ? (
                        <>
                          <p className="text-sm font-medium text-slate-800 dark:text-white">{b.patient.firstName} {b.patient.lastName}</p>
                          <p className="text-xs text-slate-400">{b.patient.mrn}</p>
                        </>
                      ) : <span className="text-xs text-slate-400 italic">Walk-in</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-xs text-slate-600 dark:text-[#aaa] truncate">{b.pickupAddress || "—"}</p>
                      {b.destinationAddress && <p className="text-xs text-slate-400 truncate mt-0.5">→ {b.destinationAddress}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-700 dark:text-[#ccc]">{b.vehicle?.vehicleNumber || b.vehicleNumber || "—"}</p>
                      {b.vehicle?.ambulanceType && <p className="text-xs text-slate-400 mt-0.5">{b.vehicle.ambulanceType.name}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700 dark:text-[#ccc]">{b.driverName || "—"}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{b.driverPhone || ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {b.status === "PENDING" && (
                          <button onClick={() => handleStatusChange(b.id, "DISPATCHED")}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 transition-colors">
                            Dispatch
                          </button>
                        )}
                        {b.status === "DISPATCHED" && (
                          <button onClick={() => handleStatusChange(b.id, "EN_ROUTE")}
                            className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-semibold hover:bg-violet-100 transition-colors">
                            En Route
                          </button>
                        )}
                        {b.status === "EN_ROUTE" && (
                          <button onClick={() => handleStatusChange(b.id, "COMPLETED")}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                            Complete
                          </button>
                        )}
                        {!["COMPLETED", "CANCELLED"].includes(b.status) && (
                          <button onClick={() => handleDelete(b.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTypeModal && (
        <AddTypeModal hospitalId={hospitalId} onClose={() => setShowTypeModal(false)} onCreated={() => setShowTypeModal(false)} />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AmbulanceBook() {
  const { user } = useAuth();
  const hospitalId = user?.hospitalId;
  const isAdmin = user?.role === "hospital_admin" || user?.role === "super_admin";

  const [tab, setTab] = useState(isAdmin ? "vehicles" : "bookings");
  const [types, setTypes] = useState([]);

  const loadTypes = async () => {
    if (!hospitalId) return;
    try { setTypes(await ambulanceApi.getTypes(hospitalId)); } catch { setTypes([]); }
  };

  useEffect(() => { loadTypes(); }, [hospitalId]);

  const TABS = [
    ...(isAdmin ? [{ key: "vehicles", label: "Fleet" }] : []),
    { key: "bookings", label: "Bookings" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
          <Ambulance className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Ambulance</h1>
          <p className="text-sm text-slate-500 dark:text-[#666]">Manage fleet and dispatch bookings</p>
        </div>
      </div>

      {/* Tabs */}
      {TABS.length > 1 && (
        <div className="flex gap-1 bg-slate-100 dark:bg-[#1a1a1a] rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key
                  ? "bg-white dark:bg-[#111] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "vehicles" && isAdmin && (
        <VehiclesTab hospitalId={hospitalId} types={types} onRefreshTypes={loadTypes} />
      )}
      {tab === "bookings" && (
        <BookingsTab hospitalId={hospitalId} types={types} />
      )}
    </div>
  );
}
