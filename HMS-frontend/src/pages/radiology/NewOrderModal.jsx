import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { patientApi, staffApi, hospitalServiceApi, radiologyApi } from "@/utils/api";
import { X, Search, Loader2 } from "lucide-react";
const PRIORITIES = ["ROUTINE", "URGENT", "STAT"];
function NewOrderModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [form, setForm] = useState({
    serviceName: "",
    specializationName: "",
    technicianId: "",
    technicianName: "",
    priority: "ROUTINE",
    scheduledDate: "",
    billNo: ""
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!user?.hospitalId) return;
    hospitalServiceApi.list(user.hospitalId).then(setServices).catch(() => {
    });
    staffApi.list(user.hospitalId).then((users) => setTechnicians(users.filter((u) => u.role?.toLowerCase() === "technician"))).catch(() => {
    });
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
        specializationName: form.specializationName || void 0,
        technicianId: form.technicianId || void 0,
        technicianName: form.technicianName || void 0,
        priority: form.priority,
        scheduledDate: form.scheduledDate || void 0,
        billNo: form.billNo || void 0
      });
      notify("Radiology order created", "success");
      onCreated();
    } catch {
      notify("Failed to create order", "error");
    } finally {
      setSaving(false);
    }
  };
  const labelCls = "block text-xs font-semibold text-slate-500 dark:text-[#888888] mb-1.5";
  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-sm text-slate-900 dark:text-[#cccccc] focus:outline-none focus:ring-2 focus:ring-emerald-500/50";
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-[#2a2a2a] flex flex-col max-h-[90vh]">{
    /* Header */
  }<div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0"><div><h2 className="text-base font-bold text-slate-900 dark:text-white">New Radiology Order</h2><p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">Create an imaging request for a patient</p></div><button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"><X className="w-4 h-4" /></button></div><form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">{
    /* Patient search */
  }<div><label className={labelCls}>Patient *</label>{selectedPatient ? <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10"><div><p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{selectedPatient.firstName} {selectedPatient.lastName}</p><p className="text-xs text-emerald-600 dark:text-emerald-500">{selectedPatient.mrn}</p></div><button type="button" onClick={() => {
    setSelectedPatient(null);
    setPatientSearch("");
  }} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"><X className="w-4 h-4" /></button></div> : <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input
    className={`${inputCls} pl-9`}
    placeholder="Search patient by name or MRN…"
    value={patientSearch}
    onChange={(e) => setPatientSearch(e.target.value)}
  />{patientSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}{patients.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl shadow-lg z-10 overflow-hidden">{patients.map((p) => <button
    key={p.id}
    type="button"
    onClick={() => {
      setSelectedPatient(p);
      setPatients([]);
      setPatientSearch("");
    }}
    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors"
  ><p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{p.firstName} {p.lastName}</p><p className="text-xs text-slate-400 dark:text-[#555555]">{p.mrn}</p></button>)}</div>}</div>}</div>{
    /* Investigation */
  }<div><label className={labelCls}>Investigation (Test) *</label>{services.length > 0 ? <select
    className={inputCls}
    value={form.serviceName}
    onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
    required
  ><option value="">Select investigation…</option>{services.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select> : <input
    className={inputCls}
    placeholder="e.g. X-Ray Chest, CT Scan Abdomen…"
    value={form.serviceName}
    onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
    required
  />}</div>{
    /* Technician + Priority */
  }<div className="grid grid-cols-2 gap-4"><div><label className={labelCls}>Technician</label><select
    className={inputCls}
    value={form.technicianId}
    onChange={(e) => {
      const tech = technicians.find((t) => t.id === e.target.value);
      setForm((f) => ({
        ...f,
        technicianId: e.target.value,
        technicianName: tech ? `${tech.firstName} ${tech.lastName ?? ""}`.trim() : ""
      }));
    }}
  ><option value="">Unassigned</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</select></div><div><label className={labelCls}>Priority</label><select
    className={inputCls}
    value={form.priority}
    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
  >{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div></div>{
    /* Scheduled date + Bill No */
  }<div className="grid grid-cols-2 gap-4"><div><label className={labelCls}>Scheduled Date</label><input
    type="date"
    className={inputCls}
    value={form.scheduledDate}
    onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
  /></div><div><label className={labelCls}>Bill / Req. No</label><input
    className={inputCls}
    placeholder="e.g. DIAG-2026-0001"
    value={form.billNo}
    onChange={(e) => setForm((f) => ({ ...f, billNo: e.target.value }))}
  /></div></div></form>{
    /* Footer */
  }<div className="px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e] flex justify-end gap-3 shrink-0"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button
    onClick={handleSubmit}
    disabled={saving || !selectedPatient}
    className="btn-primary"
  >{saving ? "Creating\u2026" : "Create Order"}</button></div></div></div>;
}
export {
  NewOrderModal as default
};
