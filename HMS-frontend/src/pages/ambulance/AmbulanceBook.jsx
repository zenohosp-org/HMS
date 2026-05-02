import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { ambulanceApi, patientApi } from "@/utils/api";
import Pagination from "@/components/ui/Pagination";
import {
  Ambulance, Plus, X, Search, Calendar, Clock, MapPin,
  User, Phone, Car, CreditCard, FileText,
  CheckCircle2, AlertCircle, Clock3, XCircle, Truck,
  Banknote, TrendingUp, Activity, MoreHorizontal,
  Wrench, Trash2, Loader2, Edit2, ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 8;

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

const EMPTY_FORM = {
  patient: null,
  bookingDate: new Date().toISOString().split("T")[0],
  bookingTime: new Date().toTimeString().slice(0, 5),
  pickupAddress: "",
  destinationAddress: "",
  vehicleId: "",
  driverName: "",
  driverPhone: "",
  paymentStatus: "UNPAID",
  notes: "",
};

// ── Shared sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5 font-medium">{label}</p>
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
          className="input pl-9 pr-9"
        />
        {query && <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-[#333] rounded-lg shadow-xl overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-600">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-600">No patients found</div>
          ) : results.slice(0, 6).map(p => (
            <button key={p.id} onClick={() => select(p)} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#222] last:border-0 transition-colors">
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.firstName} {p.lastName}</p>
              <p className="text-xs text-slate-600 mt-0.5">{p.mrn} · {p.phone}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Booking Modal ────────────────────────────────────────────────────────────

function BookingModal({ hospitalId, availableVehicles, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

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
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to book ambulance");
    } finally { setSaving(false); }
  };

  const labelCls = "label";
  const inputCls = "input";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500 flex items-center justify-center">
              <Ambulance className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">New Booking</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="bookingForm" onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Patient & Schedule */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Patient & Schedule</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Patient (optional)</label>
                <PatientSearch hospitalId={hospitalId} value={form.patient} onChange={p => set("patient", p)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" required className={inputCls} value={form.bookingDate} onChange={e => set("bookingDate", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Time *</label>
                  <input type="time" required className={inputCls} value={form.bookingTime} onChange={e => set("bookingTime", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Locations */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Locations</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Pickup Address</label>
                <textarea rows={2} className="input resize-none" value={form.pickupAddress} onChange={e => set("pickupAddress", e.target.value)} placeholder="Enter pickup location…" />
              </div>
              <div>
                <label className={labelCls}>Destination Address</label>
                <textarea rows={2} className="input resize-none" value={form.destinationAddress} onChange={e => set("destinationAddress", e.target.value)} placeholder="Enter destination…" />
              </div>
            </div>
          </div>

          {/* Vehicle & Driver */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Vehicle & Driver</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Vehicle</label>
                <select className={inputCls} value={form.vehicleId} onChange={e => set("vehicleId", e.target.value)}>
                  <option value="">— Select available vehicle —</option>
                  {availableVehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber}{v.vehicleName ? ` · ${v.vehicleName}` : ""}{v.ambulanceType ? ` · ${v.ambulanceType.name}` : ""}
                    </option>
                  ))}
                </select>
                {selectedVehicle?.defaultCharge != null && (
                  <p className="text-xs text-slate-600 dark:text-[#999999] mt-1.5 font-medium">
                    Default charge: ₹{Number(selectedVehicle.defaultCharge).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Driver Name</label>
                  <input className={inputCls} value={form.driverName} onChange={e => set("driverName", e.target.value)} placeholder="Driver's full name" />
                </div>
                <div>
                  <label className={labelCls}>Driver Phone</label>
                  <input className={inputCls} value={form.driverPhone} onChange={e => set("driverPhone", e.target.value)} placeholder="+91 XXXXX XXXXX" />
                </div>
              </div>
            </div>
          </div>

          {/* Payment & Notes */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Payment & Notes</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Payment Status</label>
                <select className={inputCls} value={form.paymentStatus} onChange={e => set("paymentStatus", e.target.value)}>
                  {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input className={inputCls} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional instructions…" />
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="bookingForm" className="btn-primary" disabled={saving}>
            <Ambulance className="w-4 h-4" />
            {saving ? "Booking…" : "Book Ambulance"}
          </button>
        </div>
      </div>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">{isEdit ? "Edit Vehicle" : "Add Vehicle"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="vehicleForm" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Vehicle Number *</label>
            <input autoFocus required value={form.vehicleNumber} onChange={e => set("vehicleNumber", e.target.value.toUpperCase())} placeholder="TN 01 AB 1234" className="input" />
          </div>
          <div>
            <label className="label">Vehicle Name / Model</label>
            <input value={form.vehicleName} onChange={e => set("vehicleName", e.target.value)} placeholder="e.g. Toyota Hiace ALS" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ambulance Type</label>
              <select value={form.ambulanceTypeId} onChange={e => set("ambulanceTypeId", e.target.value)} className="input">
                <option value="">— Select —</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Default Charge (₹)</label>
              <input type="number" step="0.01" min="0" value={form.defaultCharge} onChange={e => set("defaultCharge", e.target.value)} placeholder="0.00" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional info…" className="input resize-none" />
          </div>
        </form>
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="vehicleForm" className="btn-primary" disabled={saving || !form.vehicleNumber.trim()}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Vehicle"}
          </button>
        </div>
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
      <div className="card w-full max-w-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Add Ambulance Type</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <form id="typeForm" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Type Name *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Basic Life Support" className="input" />
          </div>
          <div>
            <label className="label">Default Charge (₹)</label>
            <input type="number" value={charge} onChange={e => setCharge(e.target.value)} placeholder="0.00" className="input" />
          </div>
        </form>
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="typeForm" className="btn-primary" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Add Type"}
          </button>
        </div>
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
          <button onClick={() => setShowTypeModal(true)} className="btn-secondary text-sm">+ Add Type</button>
          <button onClick={() => { setEditVehicle(null); setShowModal(true); }} className="btn-primary text-sm">+ Add Vehicle</button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
        <input
          type="text"
          placeholder="Search by number, model, or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 focus:border-slate-400 dark:focus:border-[#444444] transition-all shadow-sm"
        />
      </div>

      <div className="bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden">
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
                <tr><td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
                    <p className="text-sm font-medium text-slate-600">Loading vehicles…</p>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center">
                      <Ambulance className="w-8 h-8 text-slate-200 dark:text-slate-800" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">
                      {search ? "No vehicles match your search." : "No vehicles registered yet."}
                    </p>
                  </div>
                </td></tr>
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
                          {v.vehicleName && <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{v.vehicleName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{v.ambulanceType?.name || "—"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {v.defaultCharge != null ? `₹${Number(v.defaultCharge).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${vsCfg.cls}`}>{vsCfg.label}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-500 max-w-[160px] truncate">{v.notes || "—"}</td>
                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === v.id ? null : v.id); }}
                        className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      {openMenuId === v.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-6 top-14 w-52 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl border border-slate-100 dark:border-[#252525] z-20 py-1.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setOpenMenuId(null); setEditVehicle(v); setShowModal(true); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222] transition-all">
                              <Edit2 className="w-4 h-4" /> Edit Details
                            </button>
                            {v.status !== "IN_USE" && (
                              <button onClick={() => { setOpenMenuId(null); handleStatusToggle(v); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all">
                                <Wrench className="w-4 h-4" />
                                {v.status === "MAINTENANCE" ? "Mark Available" : "Mark Maintenance"}
                              </button>
                            )}
                            <div className="h-px bg-slate-50 dark:bg-[#252525] my-1" />
                            <button onClick={() => { setOpenMenuId(null); handleDelete(v); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all">
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
        <VehicleModal hospitalId={hospitalId} types={types} vehicle={editVehicle} onClose={() => { setShowModal(false); setEditVehicle(null); }} onSaved={load} />
      )}
      {showTypeModal && (
        <AddTypeModal hospitalId={hospitalId} onClose={() => setShowTypeModal(false)} onCreated={() => { onRefreshTypes(); setShowTypeModal(false); }} />
      )}
    </div>
  );
}

// ── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab({ hospitalId }) {
  const { notify } = useNotification();
  const [bookings, setBookings] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, today: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [b, s, av] = await Promise.all([
        ambulanceApi.getBookings(hospitalId).catch(() => []),
        ambulanceApi.getStats(hospitalId).catch(() => ({ total: 0, pending: 0, today: 0, completed: 0 })),
        ambulanceApi.getAvailableVehicles(hospitalId).catch(() => []),
      ]);
      setBookings(b);
      setStats(s);
      setAvailableVehicles(av);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleStatusChange = async (id, status) => {
    await ambulanceApi.updateStatus(id, { status });
    notify(`Booking marked as ${STATUS_CONFIG[status]?.label || status}`, "success");
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Cancel this booking?")) return;
    await ambulanceApi.deleteBooking(id);
    notify("Booking cancelled", "success");
    load();
  };

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase();
    const patientName = b.patient ? `${b.patient.firstName} ${b.patient.lastName}`.toLowerCase() : "walk-in";
    return (
      patientName.includes(q) ||
      (b.vehicle?.vehicleNumber || "").toLowerCase().includes(q) ||
      (b.driverName || "").toLowerCase().includes(q) ||
      (b.pickupAddress || "").toLowerCase().includes(q) ||
      (b.destinationAddress || "").toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const NEXT_STATUS = { PENDING: "DISPATCHED", DISPATCHED: "EN_ROUTE", EN_ROUTE: "COMPLETED" };
  const NEXT_LABEL  = { PENDING: "Dispatch", DISPATCHED: "En Route", EN_ROUTE: "Complete" };
  const NEXT_COLOR  = {
    PENDING:    "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20",
    DISPATCHED: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20",
    EN_ROUTE:   "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bookings" value={stats.total}     icon={Ambulance}    color="bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-[#888]" />
        <StatCard label="Pending"        value={stats.pending}   icon={Clock3}       color="bg-amber-50 dark:bg-amber-500/10 text-amber-500" />
        <StatCard label="Today's Runs"   value={stats.today}     icon={TrendingUp}   color="bg-blue-50 dark:bg-blue-500/10 text-blue-500" />
        <StatCard label="Completed"      value={stats.completed} icon={CheckCircle2} color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Bookings</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-500/20">
            {bookings.length} total
          </span>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
        <input
          type="text"
          placeholder="Search patient, vehicle, driver…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 focus:border-slate-400 dark:focus:border-[#444444] transition-all shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="flex-1 bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1a1a1a] bg-slate-50/30 dark:bg-[#0f0f0f]">
                {["Booking", "Route", "Vehicle", "Driver", "Status", "Actions"].map(h => (
                  <th key={h} className="px-6 py-4 text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
              {loading ? (
                <tr><td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
                    <p className="text-sm font-medium text-slate-600">Loading bookings…</p>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#0f0f0f] flex items-center justify-center">
                      <Ambulance className="w-8 h-8 text-slate-200 dark:text-slate-800" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">
                      {search ? "No bookings match your search." : "No ambulance bookings yet."}
                    </p>
                    {!search && (
                      <button className="btn-primary text-xs mt-1" onClick={() => setShowModal(true)}>
                        <Plus className="w-3.5 h-3.5" /> Create First Booking
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : paginated.map(b => {
                const initials = b.patient
                  ? `${b.patient.firstName?.[0] ?? ""}${b.patient.lastName?.[0] ?? ""}`.toUpperCase()
                  : "WI";
                return (
                  <tr key={b.id} className="group hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-all">
                    {/* Booking col — patient + date/time */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${b.patient ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-400" : "bg-slate-100 dark:bg-[#222] border border-slate-200 dark:border-[#333] text-slate-500 dark:text-[#888]"}`}>
                          {initials}
                        </div>
                        <div>
                          <p className="font-bold text-[15px] text-slate-900 dark:text-white leading-tight">
                            {b.patient ? `${b.patient.firstName} ${b.patient.lastName}` : "Walk-in"}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {b.bookingDate}&nbsp;·&nbsp;<Clock className="w-3 h-3" />{b.bookingTime?.slice(0, 5)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Route */}
                    <td className="px-6 py-4 max-w-[200px]">
                      {b.pickupAddress || b.destinationAddress ? (
                        <div>
                          <p className="text-xs text-slate-700 dark:text-[#ccc] truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0 text-slate-400" />{b.pickupAddress || "—"}
                          </p>
                          {b.destinationAddress && (
                            <p className="text-xs text-slate-600 dark:text-[#999999] truncate flex items-center gap-1 mt-0.5">
                              <ChevronRight className="w-3 h-3 shrink-0 text-slate-400" />{b.destinationAddress}
                            </p>
                          )}
                        </div>
                      ) : <span className="text-xs text-slate-500">—</span>}
                    </td>

                    {/* Vehicle */}
                    <td className="px-6 py-4">
                      {b.vehicle ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />{b.vehicle.vehicleNumber}
                          </p>
                          {b.vehicle.ambulanceType && (
                            <p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">{b.vehicle.ambulanceType.name}</p>
                          )}
                        </div>
                      ) : <span className="text-xs text-slate-500">—</span>}
                    </td>

                    {/* Driver */}
                    <td className="px-6 py-4">
                      {b.driverName ? (
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-[#ccc]">{b.driverName}</p>
                          {b.driverPhone && <p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">{b.driverPhone}</p>}
                        </div>
                      ) : <span className="text-xs text-slate-500">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={b.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {NEXT_STATUS[b.status] && (
                          <button
                            onClick={() => handleStatusChange(b.id, NEXT_STATUS[b.status])}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${NEXT_COLOR[b.status]}`}
                          >
                            {NEXT_LABEL[b.status]}
                          </button>
                        )}
                        {!["COMPLETED", "CANCELLED"].includes(b.status) && (
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                            title="Cancel booking"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-[#1a1a1a]">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {showModal && (
        <BookingModal
          hospitalId={hospitalId}
          availableVehicles={availableVehicles}
          onClose={() => setShowModal(false)}
          onSaved={() => { load(); notify("Ambulance booked successfully", "success"); }}
        />
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
        <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shadow-lg">
          <Ambulance className="w-5 h-5 text-white dark:text-slate-900" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Ambulance</h1>
          <p className="text-sm text-slate-600 dark:text-[#999999]">Manage fleet and dispatch bookings</p>
        </div>
      </div>

      {/* Tabs */}
      {TABS.length > 1 && (
        <div className="flex gap-1 bg-slate-100 dark:bg-[#1a1a1a] rounded-lg p-1 w-fit">
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
        <BookingsTab hospitalId={hospitalId} />
      )}
    </div>
  );
}
