import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { checkupApi, patientApi, doctorsApi } from "@/utils/api";
import {
  ClipboardList, Plus, Search, X, Calendar, Clock, User,
  AlertCircle, CheckCircle2, Loader2, ChevronRight,
  Clock3, Activity, UserCheck, Banknote, UserPlus, Check,
} from "lucide-react";

const STATUS_CONFIG = {
  SCHEDULED:   { label: "Scheduled",   color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",       dot: "bg-blue-500" },
  CHECKED_IN:  { label: "Checked In",  color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",   dot: "bg-amber-500" },
  IN_PROGRESS: { label: "In Progress", color: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400", dot: "bg-violet-500" },
  COMPLETED:   { label: "Completed",   color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400", dot: "bg-emerald-500" },
  CANCELLED:   { label: "Cancelled",   color: "bg-slate-100 text-slate-500 dark:bg-[#222] dark:text-[#666]",            dot: "bg-slate-400" },
  NO_SHOW:     { label: "No Show",     color: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",        dot: "bg-rose-500" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.SCHEDULED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function BookingModal({ hospitalId, onClose, onBooked }) {
  const [step, setStep] = useState(1);
  const [packages, setPackages] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [patientOpen, setPatientOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const patientRef = useRef(null);

  const [form, setForm] = useState({
    patient: null, packageId: "", doctorId: "",
    scheduledDate: new Date().toISOString().split("T")[0],
    scheduledTime: "09:00", paymentStatus: "PENDING",
    amountPaid: "", notes: "",
  });

  useEffect(() => {
    Promise.all([
      checkupApi.getPackages(hospitalId, true),
      doctorsApi.list(hospitalId),
    ]).then(([pkgs, docs]) => { setPackages(pkgs); setDoctors(docs); });
  }, [hospitalId]);

  useEffect(() => {
    const handler = e => { if (patientRef.current && !patientRef.current.contains(e.target)) setPatientOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchPatient = async (q) => {
    setPatientQuery(q);
    if (!q.trim()) { setPatientResults([]); return; }
    const data = await patientApi.search(hospitalId, q).catch(() => []);
    setPatientResults(data); setPatientOpen(true);
  };

  const selectPatient = p => { setForm(f => ({ ...f, patient: p })); setPatientQuery(`${p.firstName} ${p.lastName} (${p.mrn})`); setPatientOpen(false); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedPkg = packages.find(p => p.id === form.packageId);

  const canProceed = form.patient && form.packageId && form.scheduledDate;

  const handleBook = async () => {
    setSaving(true); setError(null);
    try {
      await checkupApi.createBooking(hospitalId, {
        patientId: form.patient.id,
        packageId: form.packageId,
        doctorId: form.doctorId || null,
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime || null,
        paymentStatus: form.paymentStatus,
        amountPaid: form.amountPaid ? parseFloat(form.amountPaid) : 0,
        notes: form.notes,
      });
      onBooked(); onClose();
    } catch { setError("Failed to create booking. Please try again."); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#1a1a1a] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 placeholder:text-slate-400";
  const labelCls = "block text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Book Health Checkup</h2>
            <p className="text-xs text-slate-400 mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {step === 1 && (
            <>
              <div ref={patientRef} className="relative">
                <label className={labelCls}><User className="inline w-3 h-3 mr-1" />Patient *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={patientQuery} onChange={e => searchPatient(e.target.value)} onFocus={() => patientResults.length && setPatientOpen(true)} placeholder="Search by name, MRN or phone…" className={`${inputCls} pl-9`} />
                </div>
                {patientOpen && patientResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333] rounded-xl shadow-xl overflow-hidden">
                    {patientResults.slice(0, 5).map(p => (
                      <button key={p.id} onClick={() => selectPatient(p)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#222] border-b border-slate-100 dark:border-[#2a2a2a] last:border-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-slate-400">{p.mrn} · {p.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Package *</label>
                <select value={form.packageId} onChange={e => set("packageId", e.target.value)} className={inputCls}>
                  <option value="">— Select a package —</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toLocaleString("en-IN")}</option>
                  ))}
                </select>
              </div>

              {selectedPkg && (
                <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">{selectedPkg.tests?.length || 0} tests included</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 line-clamp-2">{selectedPkg.tests?.map(t => t.testName).join(" · ")}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}><Calendar className="inline w-3 h-3 mr-1" />Date *</label>
                  <input type="date" value={form.scheduledDate} onChange={e => set("scheduledDate", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}><Clock className="inline w-3 h-3 mr-1" />Time</label>
                  <input type="time" value={form.scheduledTime} onChange={e => set("scheduledTime", e.target.value)} className={inputCls} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className={labelCls}><UserCheck className="inline w-3 h-3 mr-1" />Assigned Doctor</label>
                <select value={form.doctorId} onChange={e => set("doctorId", e.target.value)} className={inputCls}>
                  <option value="">— Assign later —</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.firstName} {d.lastName} · {d.specialization}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}><Banknote className="inline w-3 h-3 mr-1" />Payment Status</label>
                  <select value={form.paymentStatus} onChange={e => set("paymentStatus", e.target.value)} className={inputCls}>
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="PARTIAL">Partial</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount Paid (₹)</label>
                  <input type="number" step="0.01" value={form.amountPaid} onChange={e => set("amountPaid", e.target.value)} placeholder={selectedPkg ? String(selectedPkg.price) : "0.00"} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any special instructions or notes…" className={`${inputCls} resize-none`} />
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#222] space-y-1.5 text-sm">
                <p className="font-bold text-slate-700 dark:text-[#ccc] text-xs uppercase tracking-wide mb-2">Booking Summary</p>
                <p className="text-slate-600 dark:text-[#aaa]"><span className="font-semibold">Patient:</span> {form.patient?.firstName} {form.patient?.lastName}</p>
                <p className="text-slate-600 dark:text-[#aaa]"><span className="font-semibold">Package:</span> {selectedPkg?.name}</p>
                <p className="text-slate-600 dark:text-[#aaa]"><span className="font-semibold">Date:</span> {form.scheduledDate} at {form.scheduledTime}</p>
                <p className="text-emerald-600 dark:text-emerald-400 font-bold">Total: ₹{selectedPkg ? Number(selectedPkg.price).toLocaleString("en-IN") : "—"}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e]">
          {step === 2 ? (
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-[#888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors">← Back</button>
          ) : <div />}
          {step === 1 ? (
            <button disabled={!canProceed} onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 transition-colors">
              Next →
            </button>
          ) : (
            <button disabled={saving} onClick={handleBook} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</> : <><CheckCircle2 className="w-4 h-4" /> Confirm Booking</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function doctorName(d) {
  if (!d) return null;
  const first = d.user?.firstName ?? d.firstName ?? "";
  const last  = d.user?.lastName  ?? d.lastName  ?? "";
  return `Dr. ${first} ${last}`.trim();
}

function AssignDoctorCell({ booking, doctors, onAssigned }) {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const assign = async (doctorId) => {
    setSaving(true);
    try {
      await checkupApi.assignDoctor(booking.id, doctorId || null);
      onAssigned();
    } finally { setSaving(false); setOpen(false); }
  };

  const name = doctorName(booking.assignedDoctor);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-sm transition-colors ${name ? "text-slate-700 dark:text-[#ccc] hover:text-emerald-600 dark:hover:text-emerald-400" : "text-slate-400 dark:text-[#555] hover:text-emerald-600 dark:hover:text-emerald-400"}`}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3 shrink-0" />}
        <span>{name ?? "Assign doctor"}</span>
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-full mt-1 w-56 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333] rounded-xl shadow-xl overflow-hidden">
          <button onClick={() => assign(null)} className="w-full text-left px-3 py-2 text-xs text-slate-400 dark:text-[#666] hover:bg-slate-50 dark:hover:bg-[#222] border-b border-slate-100 dark:border-[#2a2a2a]">
            — Unassign doctor
          </button>
          {doctors.map(d => {
            const dn = doctorName(d);
            const isCurrent = booking.assignedDoctor?.id === d.id;
            return (
              <button key={d.id} onClick={() => assign(d.id)} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-[#222] flex items-center justify-between gap-2 border-b border-slate-100 dark:border-[#2a2a2a] last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{dn}</p>
                  <p className="text-xs text-slate-400">{d.specialization}</p>
                </div>
                {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CheckupBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hospitalId = user?.hospitalId;

  const [bookings, setBookings] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({ today: 0, scheduled: 0, inProgress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  const load = async () => {
    setLoading(true);
    const [b, s, docs] = await Promise.all([
      checkupApi.getBookings(hospitalId).catch(() => []),
      checkupApi.getStats(hospitalId).catch(() => ({ today: 0, scheduled: 0, inProgress: 0, completed: 0 })),
      doctorsApi.list(hospitalId).catch(() => []),
    ]);
    setBookings(b); setStats(s); setDoctors(docs); setLoading(false);
  };

  const filtered = bookings.filter(b => {
    if (filterStatus !== "ALL" && b.status !== filterStatus) return false;
    if (filterDate && b.scheduledDate !== filterDate) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${b.patient?.firstName} ${b.patient?.lastName}`.toLowerCase();
      return name.includes(q) || b.patient?.mrn?.toLowerCase().includes(q) || b.bookingNumber?.toLowerCase().includes(q) || b.healthPackage?.name?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Checkup Bookings</h1>
          <p className="text-sm text-slate-500 dark:text-[#666] mt-0.5">Schedule and track health checkup appointments</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Checkups", value: stats.today,     icon: Calendar,      color: "bg-blue-50 dark:bg-blue-500/10 text-blue-500" },
          { label: "Scheduled",        value: stats.scheduled,  icon: Clock3,        color: "bg-amber-50 dark:bg-amber-500/10 text-amber-500" },
          { label: "In Progress",      value: stats.inProgress, icon: Activity,      color: "bg-violet-50 dark:bg-violet-500/10 text-violet-500" },
          { label: "Completed",        value: stats.completed,  icon: CheckCircle2,  color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-slate-500 dark:text-[#666] mt-0.5 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, MRN, booking number…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 placeholder:text-slate-400" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] text-sm text-slate-700 dark:text-[#ccc] focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option value="ALL">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] text-sm text-slate-700 dark:text-[#ccc] focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
      </div>

      {/* Bookings table */}
      <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <ClipboardList className="w-10 h-10 mb-3 opacity-25" />
            <p className="text-sm font-semibold">No bookings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                  {["Booking #", "Patient", "Package", "Scheduled", "Doctor", "Payment", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b border-slate-50 dark:border-[#1a1a1a] hover:bg-slate-50/50 dark:hover:bg-[#1a1a1a]/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono font-bold text-slate-700 dark:text-[#ccc]">{b.bookingNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{b.patient?.firstName} {b.patient?.lastName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{b.patient?.mrn}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-sm text-slate-700 dark:text-[#ccc] truncate">{b.healthPackage?.name}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">₹{Number(b.healthPackage?.price || 0).toLocaleString("en-IN")}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-slate-700 dark:text-[#ccc]">{b.scheduledDate}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{b.scheduledTime || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <AssignDoctorCell booking={b} doctors={doctors} onAssigned={load} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : b.paymentStatus === "PARTIAL" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-slate-100 text-slate-500 dark:bg-[#222] dark:text-[#666]"}`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/checkups/bookings/${b.id}`)} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                        Open <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <BookingModal hospitalId={hospitalId} onClose={() => setShowModal(false)} onBooked={load} />}
    </div>
  );
}
