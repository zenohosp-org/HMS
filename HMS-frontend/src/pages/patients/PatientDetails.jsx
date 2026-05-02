import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { patientApi, recordApi, appointmentsApi, radiologyApi, invoiceApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { calcAge, formatDate, formatDateTime } from "@/utils/validators";
import PatientModal from "@/components/modals/PatientModal";
import {
  Loader2,
  ArrowLeft,
  User,
  FileText,
  Phone,
  Mail,
  MapPin,
  Droplets,
  Calendar,
  Clock,
  Edit2,
  ReceiptText,
  ClipboardList,
  ChevronRight,
  Activity,
  AlertCircle,
  Stethoscope,
  Plus,
  X,
  MoreHorizontal,
  Bed,
  CalendarClock,
  ScanLine
} from "lucide-react";
const TYPE_META = {
  CONSULTATION: {
    label: "Consultation",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    darkColor: "dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    dot: "bg-blue-500"
  },
  PRESCRIPTION: {
    label: "Prescription",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    darkColor: "dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
    dot: "bg-violet-500"
  },
  LAB_RESULT: {
    label: "Lab Result",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    darkColor: "dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    dot: "bg-amber-500"
  },
  SURGERY: {
    label: "Surgery",
    color: "bg-red-50 text-red-700 border-red-200",
    darkColor: "dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    dot: "bg-red-500"
  },
  DIAGNOSIS: {
    label: "Diagnosis",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    darkColor: "dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    dot: "bg-emerald-500"
  },
  OTHER: {
    label: "Other",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    darkColor: "dark:bg-[#2a2a2a] dark:text-[#888888] dark:border-[#333333]",
    dot: "bg-slate-400"
  }
};
const HISTORY_TYPES = ["CONSULTATION", "PRESCRIPTION", "LAB_RESULT", "SURGERY", "DIAGNOSIS", "OTHER"];
const BLOOD_DARK = {
  "A+": "dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  "A-": "dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  "B+": "dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
  "AB+": "dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
  "O+": "dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  "O-": "dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20"
};
function SideInfoRow({ icon, label, value }) {
  return <div className="flex items-start gap-3"><div className="w-4 h-4 mt-0.5 shrink-0 text-[#555] dark:text-[#555555]">{icon}</div><div><p className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-[#999999] font-semibold">{label}</p><p className="text-sm text-slate-700 dark:text-[#cccccc] mt-0.5">{value || "\u2014"}</p></div></div>;
}
function SectionHeader({ icon, title }) {
  return <div className="flex items-center gap-2 mb-4"><div className="text-[#666666]">{icon}</div><h3 className="text-sm font-semibold text-slate-700 dark:text-[#cccccc] uppercase tracking-wide">{title}</h3></div>;
}
function RecordCard({ record }) {
  const meta = TYPE_META[record.historyType] ?? TYPE_META.OTHER;
  return <div className="flex gap-4 group">{
    /* Timeline dot */
  }<div className="flex flex-col items-center"><div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${meta.dot}`} /><div className="w-px flex-1 bg-slate-200 dark:bg-[#1e1e1e] mt-1" /></div>{
    /* Card */
  }<div className="flex-1 pb-5"><div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e]
                    rounded-lg p-5 hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors"><div className="flex items-start justify-between gap-3 mb-3"><span className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full border
                            ${meta.color} ${meta.darkColor}`}>{meta.label}</span><span className="text-xs text-slate-600 dark:text-[#999999] shrink-0 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formatDateTime(record.createdAt)}</span></div>{record.description && <p className="text-base font-semibold text-slate-800 dark:text-[#e0e0e0] leading-snug whitespace-pre-wrap mt-2">{record.description}</p>}{record.nextVisitDate && <div className="flex items-center gap-1.5 mt-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><Calendar className="w-4 h-4" /><span>Next visit: {formatDateTime(record.nextVisitDate)}</span></div>}<div className="flex items-center gap-1.5 mt-3 text-xs text-slate-600 dark:text-[#999999]"><Stethoscope className="w-4 h-4 text-slate-500" /><span>{record.createdBy.firstName} {record.createdBy.lastName}<span className="text-slate-300 dark:text-[#444444]"> · {record.createdBy.role}</span></span></div></div></div></div>;
}
function AddRecordForm({ patientId, hospitalId, onSaved, onCancel }) {
  const { notify } = useNotification();
  const [form, setForm] = useState({ historyType: "CONSULTATION", description: "", nextVisitDate: "" });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await recordApi.create({
        patientId,
        hospitalId,
        historyType: form.historyType,
        description: form.description || void 0,
        nextVisitDate: form.nextVisitDate || void 0
      });
      notify("Record added", "success");
      onSaved();
    } catch {
      notify("Failed to add record", "error");
    } finally {
      setSaving(false);
    }
  };
  return <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-5 mb-5"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">Add New Record</h3><button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-[#aaaaaa] transition-colors"><X className="w-4 h-4" /></button></div><form onSubmit={handleSubmit} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="label text-xs">Record Type *</label><select
    className="input text-sm"
    value={form.historyType}
    onChange={(e) => setForm((p) => ({ ...p, historyType: e.target.value }))}
  >{HISTORY_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</select></div><div><label className="label text-xs">Next Visit Date</label><input
    type="datetime-local"
    className="input text-sm"
    value={form.nextVisitDate}
    onChange={(e) => setForm((p) => ({ ...p, nextVisitDate: e.target.value }))}
  /></div></div><div><label className="label text-xs">Notes / Description</label><textarea
    rows={3}
    className="input text-sm resize-none"
    placeholder="Enter description or notes..."
    value={form.description}
    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
  /></div><div className="flex justify-end gap-3"><button type="button" className="btn-secondary text-xs" onClick={onCancel}>Cancel</button><button type="submit" className="btn-primary text-xs" disabled={saving}>{saving ? "Saving\u2026" : "Save Record"}</button></div></form></div>;
}
function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [allocatedRoom, setAllocatedRoom] = useState(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [radiologyOrders, setRadiologyOrders] = useState([]);
  const [radiologyLoading, setRadiologyLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const loadPatient = () => {
    if (!id || !user?.hospitalId) return;
    patientApi.get(Number(id), user.hospitalId).then(setPatient).catch(() => notify("Failed to load patient", "error")).finally(() => setLoading(false));
    api.get(`/rooms?hospitalId=${user.hospitalId}`).then(({ data }) => {
      const room = data.find((r) => r.currentPatient?.id === Number(id));
      setAllocatedRoom(room || null);
    }).catch(console.error);
  };
  const loadRecords = () => {
    if (!id || !user?.hospitalId) return;
    setRecordsLoading(true);
    recordApi.list(Number(id), user.hospitalId).then(setRecords).catch(console.error).finally(() => setRecordsLoading(false));
  };
  const loadAppointments = () => {
    if (!id) return;
    setAppointmentsLoading(true);
    appointmentsApi.getByPatient(Number(id)).then(setAppointments).catch(console.error).finally(() => setAppointmentsLoading(false));
  };
  const loadRadiology = () => {
    if (!id) return;
    setRadiologyLoading(true);
    radiologyApi.getByPatient(Number(id)).then(setRadiologyOrders).catch(console.error).finally(() => setRadiologyLoading(false));
  };
  const loadInvoices = () => {
    if (!id) return;
    setInvoicesLoading(true);
    invoiceApi.getByPatient(Number(id)).then(setInvoices).catch(console.error).finally(() => setInvoicesLoading(false));
  };
  useEffect(() => {
    loadPatient();
  }, [id, user?.hospitalId]);
  useEffect(() => {
    loadRecords();
  }, [id, user?.hospitalId]);
  useEffect(() => {
    loadAppointments();
  }, [id]);
  useEffect(() => {
    loadRadiology();
  }, [id]);
  useEffect(() => {
    loadInvoices();
  }, [id]);
  const handleUpdate = async (data) => {
    await patientApi.update(Number(id), { ...data, hospitalId: user.hospitalId });
    notify("Patient updated", "success");
    setEditing(false);
    loadPatient();
  };
  const nextVisit = useMemo(() => {
    const now = /* @__PURE__ */ new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - offset * 60 * 1e3);
    const todayStr = localNow.toISOString().split("T")[0];
    const future = appointments.filter((a) => {
      if (!["SCHEDULED", "CONFIRMED"].includes(a.status)) return false;
      return a.apptDate >= todayStr;
    }).sort((a, b) => {
      const dateCompare = a.apptDate.localeCompare(b.apptDate);
      if (dateCompare !== 0) return dateCompare;
      return a.apptTime.localeCompare(b.apptTime);
    });
    return future[0] ?? null;
  }, [appointments]);
  const latestRecord = records[0] ?? null;
  const prescriptions = records.filter((r) => r.historyType === "PRESCRIPTION");
  const labResults = records.filter((r) => r.historyType === "LAB_RESULT");
  const blood = patient?.bloodGroup ?? null;
  const bloodDarkClass = blood ? BLOOD_DARK[blood] ?? "dark:bg-[#2a2a2a] dark:text-[#888888] dark:border-[#333333]" : "";
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#444444]" /></div>;
  if (!patient) return <div className="flex flex-col items-center justify-center h-64 gap-3"><AlertCircle className="w-10 h-10 text-slate-300 dark:text-[#333333]" /><p className="text-slate-500 dark:text-[#666666]">Patient not found.</p><button className="btn-secondary text-sm" onClick={() => navigate(-1)}>← Go Back</button></div>;
  const age = patient.dob ? calcAge(patient.dob) : null;
  return <div className="flex gap-0 h-[calc(100vh-3.5rem)] w-[calc(100%+3rem)] -mx-6 -mt-6 overflow-hidden bg-white dark:bg-[#0f0f0f]">{
    /* ━━━━━━━━━━━━━━━  LEFT PANE — Patient Profile  ━━━━━━━━━━━━━━━ */
  }<aside className="w-72 shrink-0 flex flex-col bg-white dark:bg-[#111111] border-r border-slate-200 dark:border-[#1e1e1e] overflow-y-auto">{
    /* Back & Actions */
  }<div className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-[#1e1e1e] flex justify-between items-center relative"><button
    onClick={() => navigate(-1)}
    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666666] hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors"
  ><ArrowLeft className="w-3.5 h-3.5" /> Back to Patients
                    </button><div className="relative"><button
    onClick={() => setMenuOpen(!menuOpen)}
    className="text-slate-500 dark:text-[#666666] hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors p-1"
  ><MoreHorizontal className="w-5 h-5" /></button>{menuOpen && <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded shadow-xl z-20 overflow-hidden"><div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-[#888888] border-b border-slate-100 dark:border-[#2a2a2a] uppercase tracking-wider">
                                    Actions
                                </div><button
    onClick={() => {
      setEditing(true);
      setMenuOpen(false);
    }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm
                                        text-slate-700 dark:text-[#cccccc] hover:text-slate-900 hover:bg-slate-50 dark:hover:text-white dark:hover:bg-[#222222] transition-colors text-left"
  ><Edit2 className="w-4 h-4 text-slate-400 dark:text-[#cccccc]" />
                                    Edit Patient
                                </button><button
    onClick={() => {
      setTab("records");
      setShowAddRecord(true);
      setMenuOpen(false);
    }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm
                                        text-slate-700 dark:text-[#cccccc] hover:text-slate-900 hover:bg-slate-50 dark:hover:text-white dark:hover:bg-[#222222] transition-colors text-left"
  ><ClipboardList className="w-4 h-4 text-slate-400 dark:text-[#cccccc]" />
                                    Add Record
                                </button><button
    onClick={() => {
      navigate(`/billing?patientId=${patient.id}&name=${patient.firstName}+${patient.lastName}&mrn=${patient.mrn}`);
      setMenuOpen(false);
    }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm
                                        text-slate-700 dark:text-[#cccccc] hover:text-slate-900 hover:bg-slate-50 dark:hover:text-white dark:hover:bg-[#222222] transition-colors text-left"
  ><ReceiptText className="w-4 h-4 text-slate-400 dark:text-[#cccccc]" />
                                    Print Invoice
                                </button></div>}{menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />}</div></div>{
    /* Avatar + Name block */
  }<div className="px-5 py-6 text-center border-b border-slate-200 dark:border-[#1e1e1e]"><div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2a2a2a] mx-auto mb-3
                        flex items-center justify-center text-2xl font-bold text-slate-700 dark:text-white">{patient.firstName[0]}{patient.lastName?.[0] ?? ""}</div><h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{patient.firstName} {patient.lastName}</h2>{age !== null && <p className="text-sm text-slate-500 dark:text-[#888888] mt-0.5">{age} years · {patient.gender}</p>}<div className="flex items-center justify-center gap-2 mt-3"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                        </span>{blood && <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border
                                bg-red-50 text-red-700 border-red-200 ${bloodDarkClass}`}><Droplets className="inline w-3 h-3 mr-0.5" />{blood}</span>}</div><p className="text-xs text-slate-400 dark:text-[#444444] mt-3">{patient.mrn}</p></div>{
    /* Sections */
  }<div className="px-5 py-5 space-y-6 flex-1">{
    /* Personal Information */
  }<div><SectionHeader icon={<User className="w-4 h-4" />} title="Personal Information" /><div className="space-y-3"><SideInfoRow icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={patient.dob ? formatDate(patient.dob) : null} /><SideInfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={patient.phone} /><SideInfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={patient.email} /><SideInfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={patient.address} /></div></div>{
    /* Room Allocation */
  }{allocatedRoom && <div><SectionHeader icon={<Bed className="w-4 h-4" />} title="Allocation" /><div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-3"><p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-1">Current Room</p><div className="flex items-center gap-2"><p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">{allocatedRoom.roomNumber}</p><span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white dark:bg-[#111111] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">{allocatedRoom.roomType}</span></div>{allocatedRoom.approxDischargeTime && <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-2 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" />
                                        Est. Discharge: {new Date(allocatedRoom.approxDischargeTime).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}</div></div>}{
    /* Medical Information */
  }<div><SectionHeader icon={<Activity className="w-4 h-4" />} title="Medical Information" /><div className="space-y-3"><SideInfoRow icon={<Droplets className="w-4 h-4" />} label="Blood Type" value={patient.bloodGroup} /><SideInfoRow icon={<FileText className="w-4 h-4" />} label="Total Records" value={recordsLoading ? "\u2026" : String(records.length)} /><SideInfoRow icon={<Calendar className="w-4 h-4" />} label="Registered" value={formatDate(patient.createdAt)} /></div></div></div></aside>{
    /* ━━━━━━━━━━━━━━━  RIGHT PANE — Details  ━━━━━━━━━━━━━━━ */
  }<div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0f0f0f] relative w-full">{
    /* Tab bar */
  }<div className="flex items-center gap-1 px-6 pt-5 pb-0 border-b border-slate-200 dark:border-[#1e1e1e] shrink-0">{["overview", "appointments", "records", "radiology", "billing"].map((t) => <button
    key={t}
    onClick={() => setTab(t)}
    className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-slate-500 dark:text-[#666666] hover:text-slate-700 dark:hover:text-[#aaaaaa]"}`}
  >{t === "records" ? `Records ${!recordsLoading ? `(${records.length})` : ""}` : t === "appointments" ? `Appointments ${!appointmentsLoading ? `(${appointments.length})` : ""}` : t === "radiology" ? `Radiology ${!radiologyLoading ? `(${radiologyOrders.length})` : ""}` : t === "billing" ? `Billing ${!invoicesLoading ? `(${invoices.length})` : ""}` : "Overview"}</button>)}</div>{
    /* Tab content */
  }<div className="flex-1 overflow-y-auto p-6">{
    /* ── OVERVIEW TAB ── */
  }{tab === "overview" && <div className="space-y-5 w-full max-w-6xl">{
    /* Summary cards row */
  }<div className="grid grid-cols-3 gap-4">{
    /* Next Appointment */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4"><div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#999999] mb-3"><Calendar className="w-3.5 h-3.5" /> Next Appointment
                                    </div>{nextVisit ? <><p className="text-base font-bold text-slate-800 dark:text-[#f0f0f0]">{formatDate(nextVisit.apptDate)}, {nextVisit.apptTime.substring(0, 5)}</p><p className="text-xs text-slate-500 dark:text-[#666666] mt-1 font-semibold">{nextVisit.type.replace("_", " ")}</p><p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">
                                                Dr. {nextVisit.doctorName}</p></> : <p className="text-sm text-slate-600 dark:text-[#999999]">No upcoming visit</p>}</div>{
    /* Active Prescriptions */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4"><div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#999999] mb-3"><FileText className="w-3.5 h-3.5" /> Prescriptions
                                    </div><p className="text-base font-bold text-slate-800 dark:text-[#f0f0f0]">{recordsLoading ? "\u2026" : prescriptions.length} Records
                                    </p>{prescriptions.length > 0 && <><p className="text-xs text-slate-500 dark:text-[#666666] mt-1">
                                                Last: {formatDate(prescriptions[0].createdAt)}</p><button
    onClick={() => setTab("records")}
    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-0.5"
  >
                                                View all <ChevronRight className="w-3 h-3" /></button></>}{prescriptions.length === 0 && <p className="text-xs text-slate-600 dark:text-[#999999] mt-1">None recorded</p>}</div>{
    /* Recent Lab Result */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4"><div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#999999] mb-3"><Activity className="w-3.5 h-3.5" /> Recent Lab Result
                                    </div>{labResults[0] ? <><p className="text-sm font-semibold text-slate-800 dark:text-[#e0e0e0] leading-snug">{labResults[0].historyType.replace("_", " ")}</p><p className="text-xs text-slate-500 dark:text-[#666666] mt-1">{formatDate(labResults[0].createdAt)}</p><button
    onClick={() => setTab("records")}
    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-0.5"
  >
                                                View results <ChevronRight className="w-3 h-3" /></button></> : <p className="text-sm text-slate-600 dark:text-[#999999]">No lab results</p>}</div></div>{
    /* Recent Records */
  }<div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden"><div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#1e1e1e]"><h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5] text-sm">Recent Records</h3><button
    onClick={() => setTab("records")}
    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 flex items-center gap-0.5"
  >
                                        View all <ChevronRight className="w-3 h-3" /></button></div>{recordsLoading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#444444]" /></div> : records.length === 0 ? <div className="py-10 text-center"><ClipboardList className="w-8 h-8 text-slate-200 dark:text-[#2a2a2a] mx-auto mb-2" /><p className="text-sm text-slate-600 dark:text-[#999999]">No records yet</p></div> : <div className="divide-y divide-slate-100 dark:divide-transparent space-y-3 px-5 pb-5">{records.slice(0, 4).map((r) => {
    const meta = TYPE_META[r.historyType] ?? TYPE_META.OTHER;
    return <div key={r.id} className="flex gap-4 group"><div className="flex flex-col items-center"><div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${meta.dot}`} /><div className="w-px flex-1 bg-slate-200 dark:bg-[#1e1e1e] my-1" /></div><div className="flex-1 pb-1"><div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg p-4"><div className="flex items-start justify-between gap-3 mb-2"><span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded border ${meta.color} ${meta.darkColor}`}>{meta.label}</span><p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(r.createdAt)}</p></div>{r.description && <p className="text-sm text-slate-600 dark:text-[#cccccc] truncate">{r.description}</p>}<div className="flex items-center gap-1.5 mt-2 text-xs text-slate-600 dark:text-[#999999]"><Stethoscope className="w-3.5 h-3.5" /><span>{r.createdBy.firstName} {r.createdBy.lastName}</span></div>{r.nextVisitDate && <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-2 flex items-center gap-1.5 font-medium"><Calendar className="w-3.5 h-3.5" />
                                                                    Next visit: {formatDate(r.nextVisitDate)}</div>}</div></div></div>;
  })}</div>}</div></div>}{
    /* ── RECORDS TAB ── */
  }{tab === "records" && <div className="w-full max-w-5xl">{
    /* Header + Add button */
  }<div className="flex items-center justify-between mb-5"><div><h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5]">Medical Records</h3><p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{records.length} record{records.length !== 1 ? "s" : ""} for {patient.firstName}</p></div><button
    className="btn-primary text-xs flex items-center gap-1.5"
    onClick={() => setShowAddRecord((v) => !v)}
  ><Plus className="w-3.5 h-3.5" />{showAddRecord ? "Cancel" : "Add Record"}</button></div>{
    /* Inline add form */
  }{showAddRecord && user?.hospitalId && <AddRecordForm
    patientId={patient.id}
    hospitalId={user.hospitalId}
    onSaved={() => {
      setShowAddRecord(false);
      loadRecords();
    }}
    onCancel={() => setShowAddRecord(false)}
  />}{
    /* Timeline */
  }{recordsLoading ? <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#444444]" /></div> : records.length === 0 ? <div className="py-16 text-center"><ClipboardList className="w-10 h-10 text-slate-200 dark:text-[#282828] mx-auto mb-3" /><p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No records yet</p><p className="text-xs text-slate-400 dark:text-[#444444] mt-1">Add the first medical record above.</p></div> : <div>{records.map((r) => <RecordCard key={r.id} record={r} />)}</div>}</div>}{
    /* ── APPOINTMENTS TAB ── */
  }{tab === "appointments" && <div className="w-full max-w-5xl"><div className="flex items-center justify-between mb-5"><div><h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5]">Appointments</h3><p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""} for {patient.firstName}</p></div></div>{appointmentsLoading ? <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#444444]" /></div> : appointments.length === 0 ? <div className="py-16 text-center"><Calendar className="w-10 h-10 text-slate-200 dark:text-[#282828] mx-auto mb-3" /><p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No appointments yet</p><p className="text-xs text-slate-400 dark:text-[#444444] mt-1">Book an appointment from the Appointments Dashboard.</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{appointments.map((appt) => <div key={appt.id} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg p-5 hover:border-slate-300 dark:hover:border-[#333333] transition-colors relative overflow-hidden">{
    /* Status indicator line */
  }<div className={`absolute left-0 top-0 bottom-0 w-1 ${["COMPLETED"].includes(appt.status) ? "bg-emerald-500" : ["CANCELLED", "NO_SHOW"].includes(appt.status) ? "bg-red-500" : ["IN_PROGRESS"].includes(appt.status) ? "bg-amber-500" : "bg-blue-500"}`} /><div className="flex justify-between items-start mb-4"><div><p className="text-lg font-bold text-slate-800 dark:text-white">{formatDate(appt.apptDate)}</p><p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium"><Clock className="w-3.5 h-3.5" />{appt.apptTime.substring(0, 5)} - {appt.apptEndTime ? appt.apptEndTime.substring(0, 5) : "Unknown"}</p></div><span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${["COMPLETED"].includes(appt.status) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : ["CANCELLED", "NO_SHOW"].includes(appt.status) ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : ["IN_PROGRESS"].includes(appt.status) ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"}`}>{appt.status.replace("_", " ")}</span></div><div className="space-y-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center shrink-0"><Stethoscope className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /></div><div><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                            Dr. {appt.doctorName}</p>{appt.doctorSpecialization && <p className="text-xs text-slate-500 dark:text-slate-400">{appt.doctorSpecialization}</p>}</div></div><div className="pt-3 border-t border-slate-100 dark:border-[#222222] grid grid-cols-2 gap-3"><div><p className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#666666]">Type</p><p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{appt.type}</p></div>{appt.tokenNumber && <div><p className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#666666]">Token No</p><p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                                                                #{appt.tokenNumber}</p></div>}</div>{appt.chiefComplaint && <div className="bg-slate-50 dark:bg-[#161616] p-3 rounded-lg mt-2 border border-slate-100 dark:border-[#222222]"><p className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#666666] mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Reason for visit
                                                        </p><p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                                                            "{appt.chiefComplaint}"
                                                        </p></div>}</div></div>)}</div>}</div>}{
    /* ── RADIOLOGY TAB ── */
  }{tab === "radiology" && <div className="w-full max-w-5xl space-y-4"><div className="flex items-center justify-between mb-2"><div><h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5]">Radiology History</h3><p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">
                                        All imaging investigations for {patient.firstName}</p></div></div>{radiologyLoading ? <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#444444]" /></div> : radiologyOrders.length === 0 ? <div className="py-16 text-center"><ScanLine className="w-10 h-10 text-slate-200 dark:text-[#282828] mx-auto mb-3" /><p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No radiology orders</p><p className="text-xs text-slate-400 dark:text-[#444444] mt-1">Orders created from the Radiology Queue will appear here.</p></div> : <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden"><div className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">{radiologyOrders.map((order) => {
    const statusCls = order.status === "REPORT_GENERATED" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" : order.status === "AWAITING_REPORT" ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    const statusLabel = order.status === "REPORT_GENERATED" ? "Report Ready" : order.status === "AWAITING_REPORT" ? "Awaiting Report" : "Pending Scan";
    return <div key={order.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-[#151515] transition-colors"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center shrink-0"><ScanLine className="w-4 h-4 text-violet-500 dark:text-violet-400" /></div><div><p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">{order.serviceName}</p><div className="flex items-center gap-2 mt-0.5">{order.referredByName && <p className="text-xs text-slate-600 dark:text-[#999999]">by {order.referredByName}</p>}<p className="text-xs text-slate-300 dark:text-[#444444]">·</p><p className="text-xs text-slate-600 dark:text-[#999999]">{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p></div></div></div><div className="flex items-center gap-3"><span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusCls}`}>{statusLabel}</span>{order.status === "REPORT_GENERATED" && order.id && <button
      onClick={() => navigate(`/radiology/reports/${order.id}`)}
      className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
    >
                                                                View Report
                                                            </button>}</div></div>;
  })}</div></div>}</div>}{
    /* ── Billing tab ── */
  }{tab === "billing" && <div className="p-6 space-y-4"><div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-700 dark:text-[#cccccc]">Invoice History</p><button
    onClick={() => navigate(`/billing?patientId=${id}`)}
    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
  >
                                    + New Invoice
                                </button></div>{invoicesLoading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div> : invoices.length === 0 ? <div className="py-12 text-center"><p className="text-sm text-slate-600 dark:text-[#999999]">No invoices yet</p><button onClick={() => navigate(`/billing?patientId=${id}`)} className="mt-3 text-sm font-semibold text-slate-900 dark:text-white hover:underline">
                                        Create first invoice
                                    </button></div> : <div className="space-y-2">{invoices.map((inv) => {
    const statusCls = inv.status === "PAID" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" : inv.status === "CANCELLED" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    return <div key={inv.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-100 dark:border-[#1e1e1e] hover:bg-slate-50 dark:hover:bg-[#0f0f0f] transition-colors"><div><p className="text-sm font-semibold text-slate-800 dark:text-[#dddddd]">#{inv.invoiceNumber}</p><p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-IN") : ""}{inv.paymentMethod ? ` \xB7 ${inv.paymentMethod}` : ""}{" \xB7 "}{inv.items?.length ?? 0} item{(inv.items?.length ?? 0) !== 1 ? "s" : ""}</p></div><div className="flex items-center gap-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusCls}`}>{inv.status}</span><span className="text-sm font-bold text-slate-800 dark:text-[#dddddd]">₹{inv.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div></div>;
  })}</div>}</div>}</div></div>{
    /* Edit modal */
  }{editing && <PatientModal
    patient={patient}
    onClose={() => setEditing(false)}
    onSave={handleUpdate}
  />}</div>;
}
export {
  PatientDetails as default
};
