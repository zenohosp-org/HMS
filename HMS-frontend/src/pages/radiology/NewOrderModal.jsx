import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { patientApi, staffApi, hospitalServiceApi, radiologyApi } from "@/utils/api";
import { X, Search, Loader2, UserPlus, ChevronLeft, CheckCircle2 } from "lucide-react";

const PRIORITIES = ["ROUTINE", "URGENT", "STAT"];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export default function NewOrderModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { notify } = useNotification();

  // Patient search state
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Quick register state
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [quickForm, setQuickForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    gender: "MALE",
    bloodGroup: "",
    dob: "",
  });

  // Order form state
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [form, setForm] = useState({
    serviceName: "",
    specializationName: "",
    technicianId: "",
    technicianName: "",
    priority: "ROUTINE",
    scheduledDate: "",
    billNo: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.hospitalId) return;
    hospitalServiceApi.list(user.hospitalId).then(setServices).catch(() => {});
    staffApi.list(user.hospitalId).then((users) =>
      setTechnicians(users.filter((u) => u.role?.toLowerCase() === "technician"))
    ).catch(() => {});
  }, [user?.hospitalId]);

  useEffect(() => {
    if (!patientSearch.trim() || patientSearch.length < 2 || !user?.hospitalId) {
      setPatients([]);
      return;
    }
    const t = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const res = await patientApi.search(user.hospitalId, patientSearch);
        setPatients(res.slice(0, 6));
      } catch {
        setPatients([]);
      } finally {
        setPatientSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch, user?.hospitalId]);

  const setQ = (field, value) => setQuickForm((f) => ({ ...f, [field]: value }));

  const handleQuickRegister = async (e) => {
    e.preventDefault();
    if (!quickForm.firstName.trim()) {
      notify("First name is required", "error");
      return;
    }
    setRegistering(true);
    try {
      const created = await patientApi.create({
        hospitalId: user.hospitalId,
        firstName: quickForm.firstName.trim(),
        lastName: quickForm.lastName.trim() || null,
        phone: quickForm.phone.trim() || null,
        gender: quickForm.gender || null,
        bloodGroup: quickForm.bloodGroup || null,
        dob: quickForm.dob || null,
      });
      notify(`${created.firstName} registered successfully`, "success");
      setSelectedPatient(created);
      setShowRegister(false);
      setPatientSearch("");
      setPatients([]);
    } catch {
      notify("Failed to register patient", "error");
    } finally {
      setRegistering(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatient || !user?.hospitalId) return;
    if (!form.serviceName.trim()) {
      notify("Investigation is required", "error");
      return;
    }
    setSaving(true);
    try {
      await radiologyApi.create({
        hospitalId: user.hospitalId,
        patientId: selectedPatient.id,
        serviceName: form.serviceName,
        specializationName: form.specializationName || undefined,
        technicianId: form.technicianId || undefined,
        technicianName: form.technicianName || undefined,
        priority: form.priority,
        scheduledDate: form.scheduledDate || undefined,
        billNo: form.billNo || undefined,
      });
      notify("Radiology order created", "success");
      onCreated();
    } catch {
      notify("Failed to create order", "error");
    } finally {
      setSaving(false);
    }
  };

  const labelCls = "block text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider mb-1.5";
  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#ccc] focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-[#444444] dark:ring-white/50 transition-all";
  const noResults = patientSearch.length >= 2 && !patientSearching && patients.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111111] rounded-lg shadow-xl w-full max-w-lg border border-slate-200 dark:border-[#2a2a2a] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-3">
            {showRegister && (
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {showRegister ? "Register New Patient" : "New Radiology Order"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#666] mt-0.5">
                {showRegister
                  ? "Quick registration — patient will be added to the system"
                  : "Create an imaging request for a patient"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Quick Register Form ── */}
        {showRegister ? (
          <form onSubmit={handleQuickRegister} className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <UserPlus className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Walk-in patient — minimum info needed. Full profile can be completed later from the Patients section.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name *</label>
                <input
                  required
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Ravi"
                  value={quickForm.firstName}
                  onChange={(e) => setQ("firstName", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Last Name</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Kumar"
                  value={quickForm.lastName}
                  onChange={(e) => setQ("lastName", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="+91 98765 43210"
                  value={quickForm.phone}
                  onChange={(e) => setQ("phone", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select
                  className={inputCls}
                  value={quickForm.gender}
                  onChange={(e) => setQ("gender", e.target.value)}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input
                  type="date"
                  className={inputCls}
                  value={quickForm.dob}
                  onChange={(e) => setQ("dob", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Blood Group</label>
                <select
                  className={inputCls}
                  value={quickForm.bloodGroup}
                  onChange={(e) => setQ("bloodGroup", e.target.value)}
                >
                  <option value="">Unknown</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                className="btn-secondary"
              >
                Back
              </button>
              <button type="submit" disabled={registering} className="btn-primary">
                {registering ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Register &amp; Continue</>
                )}
              </button>
            </div>
          </form>

        ) : (
          /* ── Order Form ── */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Patient */}
            <div>
              <label className={labelCls}>Patient *</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-emerald-200 dark:border-slate-900 dark:border-white/30 bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-slate-900 dark:text-white dark:text-slate-500">
                      {selectedPatient.firstName[0]}{selectedPatient.lastName?.[0] ?? ""}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </p>
                      <p className="text-xs text-slate-900 dark:text-white dark:text-slate-900 dark:text-white">
                        {selectedPatient.mrn ?? "New patient"}
                        {selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedPatient(null); setPatientSearch(""); }}
                    className="text-slate-900 dark:text-white hover:text-slate-900 dark:text-white dark:hover:text-emerald-300 p-1 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    className={`${inputCls} pl-9`}
                    placeholder="Search by name or MRN…"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    autoFocus
                  />
                  {patientSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-600" />
                  )}

                  {/* Results dropdown */}
                  {patients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl z-10 overflow-hidden">
                      {patients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch(""); }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#222] transition-colors flex items-center gap-3 border-b border-slate-50 dark:border-[#1e1e1e] last:border-0"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#2a2a2a] flex items-center justify-center text-xs font-bold text-slate-500 dark:text-[#888] shrink-0">
                            {p.firstName[0]}{p.lastName?.[0] ?? ""}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-[#ddd]">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-[#999999]">
                              {p.mrn}{p.phone ? ` · ${p.phone}` : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results — offer quick register */}
                  {noResults && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl z-10 overflow-hidden">
                      <div className="px-4 py-3 text-xs text-slate-600 dark:text-[#999999] border-b border-slate-100 dark:border-[#222]">
                        No patient found for "{patientSearch}"
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPatients([]);
                          const parts = patientSearch.trim().split(" ");
                          setQuickForm((f) => ({
                            ...f,
                            firstName: parts[0] ?? "",
                            lastName: parts.slice(1).join(" ") ?? "",
                          }));
                          setShowRegister(true);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#222] transition-colors flex items-center gap-3"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                          <UserPlus className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            Register as new patient
                          </p>
                          <p className="text-xs text-slate-600 dark:text-[#999999]">
                            Walk-in — add to system and continue
                          </p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Investigation */}
            <div>
              <label className={labelCls}>Investigation (Test) *</label>
              {services.length > 0 ? (
                <select
                  className={inputCls}
                  value={form.serviceName}
                  onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
                  required
                >
                  <option value="">Select investigation…</option>
                  {services.filter((s) => s.isActive).map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputCls}
                  placeholder="e.g. X-Ray Chest, CT Scan Abdomen…"
                  value={form.serviceName}
                  onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
                  required
                />
              )}
            </div>

            {/* Technician + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Technician</label>
                <select
                  className={inputCls}
                  value={form.technicianId}
                  onChange={(e) => {
                    const tech = technicians.find((t) => t.id === e.target.value);
                    setForm((f) => ({
                      ...f,
                      technicianId: e.target.value,
                      technicianName: tech ? `${tech.firstName} ${tech.lastName ?? ""}`.trim() : "",
                    }));
                  }}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select
                  className={inputCls}
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scheduled date + Bill No */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Scheduled Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.scheduledDate}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Bill / Req. No</label>
                <input
                  className={inputCls}
                  placeholder="e.g. DIAG-2026-0001"
                  value={form.billNo}
                  onChange={(e) => setForm((f) => ({ ...f, billNo: e.target.value }))}
                />
              </div>
            </div>

          </form>
        )}

        {/* Footer — only shown on order form */}
        {!showRegister && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e] flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !selectedPatient}
              className="btn-primary"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Create Order</>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
