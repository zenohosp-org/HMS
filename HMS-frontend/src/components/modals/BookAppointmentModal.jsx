import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Calendar, Clock, FileText, Search, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
  patientApi,
  doctorsApi,
  appointmentsApi,
  checkupApi,
} from "@/utils/api";
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function MiniCalendar({ value, onChange }) {
  const today = /* @__PURE__ */ new Date();
  const selected = value ? /* @__PURE__ */ new Date(value + "T00:00:00") : null;
  const [view, setView] = useState({ year: selected?.getFullYear() ?? today.getFullYear(), month: selected?.getMonth() ?? today.getMonth() });
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const prevMonth = () => setView((v) => {
    const m = v.month === 0 ? 11 : v.month - 1;
    const y = v.month === 0 ? v.year - 1 : v.year;
    return { year: y, month: m };
  });
  const nextMonth = () => setView((v) => {
    const m = v.month === 11 ? 0 : v.month + 1;
    const y = v.month === 11 ? v.year + 1 : v.year;
    return { year: y, month: m };
  });
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const pick = (day) => {
    const ds = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (ds < todayStr) return;
    onChange(ds);
  };
  return <div className="select-none"><div className="flex items-center justify-between mb-3"><span className="text-sm font-semibold text-slate-800 dark:text-[#e5e5e5]">{MONTHS[view.month]} {view.year}</span><div className="flex items-center gap-1"><button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-500 dark:text-[#888888] transition-colors"><ChevronLeft className="w-4 h-4" /></button><button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-500 dark:text-[#888888] transition-colors"><ChevronRight className="w-4 h-4" /></button></div></div><div className="grid grid-cols-7 mb-1">{DAYS.map((d) => <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-[#555555] uppercase py-1">{d}</div>)}</div><div className="grid grid-cols-7 gap-y-0.5">{cells.map((day, i) => {
    if (!day) return <div key={`e-${i}`} />;
    const ds = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isPast = ds < todayStr;
    const isSelected = ds === value;
    const isToday = ds === todayStr;
    return <button
      type="button"
      key={ds}
      onClick={() => pick(day)}
      disabled={isPast}
      className={`text-xs py-1.5 rounded-lg font-medium transition-colors
                                ${isSelected ? "bg-emerald-500 text-white font-bold" : isToday ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : isPast ? "text-slate-300 dark:text-[#444444] cursor-not-allowed" : "text-slate-700 dark:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#222222]"}`}
    >{day}</button>;
  })}</div></div>;
}
const TYPE_OPTIONS = [
  { value: "OPD", label: "OPD (Fresh Visit)", desc: "First-time or walk-in" },
  { value: "FOLLOWUP", label: "Follow-up", desc: "Returning patient" },
  { value: "EMERGENCY", label: "Emergency", desc: "Urgent care required" },
  { value: "TELECONSULT", label: "Teleconsultation", desc: "Remote consultation" }
];
function BookAppointmentModal({ isOpen, onClose, onSuccess, selectedDate }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [apptDate, setApptDate] = useState(
    selectedDate ? selectedDate.toISOString().split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  );
  const [apptTime, setApptTime] = useState("");
  const [type, setType] = useState("OPD");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const selectedPatient = patients.find((p) => String(p.id) === patientId);
  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const selectedPkg = packages.find((p) => p.id === packageId);
  const filteredPatients = patients.filter((p) => {
    const q = patientSearch.toLowerCase();
    return p.firstName.toLowerCase().includes(q) || p.lastName?.toLowerCase().includes(q) || p.mrn?.toLowerCase().includes(q);
  });
  useEffect(() => {
    if (!isOpen || !user?.hospitalId) return;
    const loadData = async (hId) => {
      try {
        const [patientsRes, doctorsRes, pkgsRes] = await Promise.all([
          patientApi.list(hId),
          doctorsApi.list(hId),
          checkupApi.getPackages(hId, true),
        ]);
        setPatients(patientsRes);
        setDoctors(doctorsRes);
        setPackages(pkgsRes);
        if (user.role === "doctor") {
          const doc = doctorsRes.find((d) => d.userId === user.userId);
          if (doc) setDoctorId(doc.id);
        }
      } catch (err) {
        notify("Failed to load data", "error");
      }
    };
    loadData(user.hospitalId);
  }, [isOpen, user]);
  useEffect(() => {
    if (!isOpen || !doctorId || !apptDate) {
      setDoctorAppointments([]);
      return;
    }
    appointmentsApi.getByDoctor(doctorId, apptDate).then((appts) => setDoctorAppointments(appts.filter((a) => ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(a.status)))).catch(console.error);
  }, [doctorId, apptDate, isOpen]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.hospitalId) return;
    const errs = {};
    if (!patientId) errs.patient = "Please select a patient";
    if (!doctorId) errs.doctor = "Please select a doctor";
    if (!apptTime) errs.time = "Please select a time slot";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setIsLoading(true);
    try {
      const appointment = await appointmentsApi.create({
        hospitalId: user.hospitalId,
        patientId: Number(patientId),
        doctorId,
        apptDate,
        apptTime,
        type,
        chiefComplaint,
        ...(packageId ? { packageId } : {}),
      });
      notify("Appointment scheduled successfully!", "success");
      onSuccess(appointment);
      resetForm();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to book appointment", "error");
    } finally {
      setIsLoading(false);
    }
  };
  const resetForm = () => {
    setPatientId("");
    setPatientSearch("");
    if (user?.role !== "doctor") setDoctorId("");
    setApptTime("");
    setType("OPD");
    setPackageId("");
    setChiefComplaint("");
    setErrors({});
  };
  const generateTimeSlots = () => {
    const slots = [];
    let h = 9, m = 0;
    while (h < 18) {
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "PM" : "AM";
      const displayTime = `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
      const isBooked = doctorAppointments.some((a) => a.apptTime.substring(0, 8) === timeStr);
      slots.push({ timeStr, displayTime, isBooked });
      m += 30;
      if (m >= 60) {
        m = 0;
        h++;
      }
    }
    return slots;
  };
  if (!isOpen) return null;
  const timeSlots = generateTimeSlots();
  const formatDisplayDate = (d) => {
    if (!d) return "";
    const dt = /* @__PURE__ */ new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"><div className="bg-white dark:bg-[#111111] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#1e1e1e]">{
    /* Header */
  }<div className="flex items-center justify-between px-7 py-5 border-b border-slate-200 dark:border-[#1e1e1e]"><div><h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Appointment</h2><p className="text-sm text-slate-500 dark:text-[#888888] mt-0.5">Schedule a new appointment for a patient.</p></div><button
    onClick={() => {
      resetForm();
      onClose();
    }}
    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors"
  ><X className="w-5 h-5" /></button></div>{
    /* Body */
  }<div className="flex flex-1 overflow-hidden">{
    /* ─── LEFT: Appointment Details ─── */
  }<div className="flex-1 overflow-y-auto px-7 py-6 border-r border-slate-200 dark:border-[#1e1e1e]"><form id="book-form" onSubmit={handleSubmit} className="space-y-6">{
    /* Appointment Type */
  }<div><label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-3">Appointment Type</label><div className="grid grid-cols-2 gap-2">{TYPE_OPTIONS.map((opt) => <button
    key={opt.value}
    type="button"
    onClick={() => setType(opt.value)}
    className={`text-left px-4 py-3 rounded-xl border transition-all ${type === opt.value ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-slate-200 dark:border-[#222222] hover:border-slate-300 dark:hover:border-[#333333]"}`}
  ><p className={`text-sm font-semibold ${type === opt.value ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-[#cccccc]"}`}>{type === opt.value && <CheckCircle className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />}{opt.label}</p><p className="text-xs text-slate-400 dark:text-[#666666] mt-0.5">{opt.desc}</p></button>)}</div></div>{
    /* Date */
  }<div><label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> Date
                                </label><div className="border border-slate-200 dark:border-[#222222] rounded-xl p-4 bg-white dark:bg-[#0f0f0f]">{apptDate && <div className="mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20"><p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatDisplayDate(apptDate)}</p></div>}<MiniCalendar value={apptDate} onChange={(v) => {
    setApptDate(v);
    setApptTime("");
  }} /></div></div>{
    /* Time Slots */
  }<div><label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> Time
                                </label>{!doctorId ? <div className="border border-dashed border-slate-200 dark:border-[#222222] rounded-xl p-5 text-center text-sm text-slate-400 dark:text-[#666666]">
                                        Select a doctor to view available time slots.
                                    </div> : <div className="border border-slate-200 dark:border-[#222222] rounded-xl overflow-hidden bg-white dark:bg-[#0f0f0f]"><div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1a1a1a]">{timeSlots.map((slot) => <button
    key={slot.timeStr}
    type="button"
    disabled={slot.isBooked}
    onClick={() => {
      setApptTime(slot.timeStr);
      setErrors((e) => ({ ...e, time: "" }));
    }}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left
                                                        ${slot.isBooked ? "text-slate-300 dark:text-[#444444] cursor-not-allowed bg-slate-50/50 dark:bg-[#111111]" : apptTime === slot.timeStr ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold" : "hover:bg-slate-50 dark:hover:bg-[#151515] text-slate-700 dark:text-[#cccccc]"}`}
  ><Clock className={`w-4 h-4 shrink-0 ${slot.isBooked ? "text-slate-300 dark:text-[#444444]" : apptTime === slot.timeStr ? "text-emerald-500" : "text-slate-400"}`} /><span>{slot.displayTime}</span>{slot.isBooked && <span className="ml-auto text-[10px] font-semibold uppercase text-slate-400 dark:text-[#444444]">Booked</span>}{apptTime === slot.timeStr && <CheckCircle className="ml-auto w-4 h-4 text-emerald-500" />}</button>)}</div>{errors.time && <p className="text-xs text-red-500 px-4 py-2 border-t border-slate-100 dark:border-[#1a1a1a]">{errors.time}</p>}</div>}</div>{
    /* Reason for Visit */
  }<div><label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Reason for Visit
                                </label><textarea
    value={chiefComplaint}
    onChange={(e) => setChiefComplaint(e.target.value)}
    rows={3}
    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#222222] bg-white dark:bg-[#0f0f0f] text-slate-900 dark:text-[#cccccc] text-sm placeholder-slate-400 dark:placeholder-[#555555] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none"
    placeholder="Enter the reason for the appointment"
  /></div></form></div>{
    /* ─── RIGHT: Patient & Doctor ─── */
  }<div className="w-80 shrink-0 flex flex-col overflow-y-auto px-6 py-6 gap-6 bg-slate-50/50 dark:bg-[#0d0d0d]">{
    /* Select Patient */
  }<div><h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Select Patient</h3><p className="text-xs text-slate-500 dark:text-[#666666] mb-4">Search and select a patient for this appointment.</p>{
    /* Search */
  }<div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input
    type="text"
    value={patientSearch}
    onChange={(e) => setPatientSearch(e.target.value)}
    placeholder="Search patients..."
    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border ${errors.patient ? "border-red-400" : "border-slate-200 dark:border-[#222222]"} bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] placeholder-slate-400 dark:placeholder-[#555555] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all`}
  /></div>{
    /* Patient list */
  }{patientSearch && filteredPatients.length > 0 && <div className="border border-slate-200 dark:border-[#222222] rounded-xl overflow-hidden mb-2 bg-white dark:bg-[#111111] max-h-44 overflow-y-auto">{filteredPatients.slice(0, 8).map((p) => <button
    key={p.id}
    type="button"
    onClick={() => {
      setPatientId(String(p.id));
      setPatientSearch("");
      setErrors((e) => ({ ...e, patient: "" }));
    }}
    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors text-left border-b last:border-b-0 border-slate-100 dark:border-[#1a1a1a]"
  ><div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">{p.firstName[0]}</div><div className="min-w-0"><p className="text-sm font-semibold text-slate-800 dark:text-[#cccccc] truncate">{p.firstName} {p.lastName}</p><p className="text-[11px] text-slate-400 dark:text-[#666666]">{p.mrn}</p></div></button>)}</div>}{
    /* Selected patient display */
  }{selectedPatient && <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl mb-2"><div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">{selectedPatient.firstName[0]}</div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 truncate">{selectedPatient.firstName} {selectedPatient.lastName}</p><p className="text-[11px] text-emerald-600 dark:text-emerald-500">{selectedPatient.mrn}</p></div><button type="button" onClick={() => setPatientId("")} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300"><X className="w-3.5 h-3.5" /></button></div>}{errors.patient && <p className="text-xs text-red-500 mb-2">{errors.patient}</p>}<button
    type="button"
    onClick={() => {
      onClose();
      navigate("/patients", { state: { openRegistration: true } });
    }}
    className="btn-secondary w-full"
  >
                                Register New Patient
                            </button></div>{
    /* Divider */
  }<div className="border-t border-slate-200 dark:border-[#1e1e1e]" />{
    /* Select Doctor */
  }<div><h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Select Doctor</h3><p className="text-xs text-slate-500 dark:text-[#666666] mb-4">Choose a doctor for this appointment.</p><div className={`border ${errors.doctor ? "border-red-400" : "border-slate-200 dark:border-[#222222]"} rounded-xl overflow-hidden bg-white dark:bg-[#111111]`}><select
    value={doctorId}
    onChange={(e) => {
      setDoctorId(e.target.value);
      setApptTime("");
      setErrors((p) => ({ ...p, doctor: "" }));
    }}
    disabled={user?.role === "doctor"}
    className="w-full px-4 py-3 text-sm text-slate-900 dark:text-[#cccccc] bg-transparent outline-none disabled:opacity-60 disabled:cursor-not-allowed"
  ><option value="">Select a doctor</option>{doctors.map((d) => <option key={d.id} value={d.id}>
                                            Dr. {d.firstName} {d.lastName} — {d.specialization}</option>)}</select></div>{errors.doctor && <p className="text-xs text-red-500 mt-1">{errors.doctor}</p>}{
    /* Doctor info card */
  }{selectedDoctor && <div className="mt-3 p-3 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-xl"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0">{selectedDoctor.firstName[0]}</div><div><p className="text-sm font-semibold text-slate-800 dark:text-[#cccccc]">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p><p className="text-xs text-slate-500 dark:text-[#888888]">{selectedDoctor.specialization}</p></div></div>{selectedDoctor.consultationFee != null && <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1e1e1e] grid grid-cols-2 gap-2"><div><p className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#555555]">Fee</p><p className="text-sm font-bold text-slate-700 dark:text-[#cccccc]">{selectedDoctor.consultationFee}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-400 dark:text-[#555555]">Slot</p><p className="text-sm font-bold text-slate-700 dark:text-[#cccccc]">{selectedDoctor.slotDurationMin} min</p></div></div>}</div>}</div>{packages.length > 0 && <><div className="border-t border-slate-200 dark:border-[#1e1e1e]" /><div className="px-0 py-2"><h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Health Checkup <span className="text-xs font-medium text-slate-400 dark:text-[#555]">(optional)</span></h3><p className="text-xs text-slate-500 dark:text-[#666666] mb-3">Link a checkup package to auto-create a booking.</p><select value={packageId} onChange={e => setPackageId(e.target.value)} className="w-full px-3 py-2.5 text-sm text-slate-900 dark:text-[#cccccc] bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"><option value="">No package</option>{packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{selectedPkg && <div className="mt-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{selectedPkg.tests?.length || 0} tests included</p><p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5 line-clamp-2">{selectedPkg.tests?.map(t => t.testName).join(", ")}</p></div>}</div></>}</div></div>{
    /* Footer */
  }<div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-slate-200 dark:border-[#1e1e1e] bg-white dark:bg-[#111111]"><button
    type="button"
    onClick={() => {
      resetForm();
      onClose();
    }}
    className="btn-secondary"
  >
                        Cancel
                    </button><button
    type="submit"
    form="book-form"
    disabled={isLoading}
    className="btn-primary"
  >{isLoading ? "Scheduling..." : "Schedule Appointment"}</button></div></div></div>;
}
export {
  BookAppointmentModal as default
};
