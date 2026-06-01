import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, Calendar, Clock, FileText, Search, ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { patientApi, doctorsApi, appointmentsApi, checkupApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import SearchableSelect from "@/components/ui/SearchableSelect";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function MiniCalendar({ value, onChange }) {
  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : null;
  const [view, setView] = useState({ year: selected?.getFullYear() ?? today.getFullYear(), month: selected?.getMonth() ?? today.getMonth() });
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const prevMonth = () => setView(v => { const m = v.month===0?11:v.month-1; const y = v.month===0?v.year-1:v.year; return {year:y,month:m}; });
  const nextMonth = () => setView(v => { const m = v.month===11?0:v.month+1; const y = v.month===11?v.year+1:v.year; return {year:y,month:m}; });
  const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  const pick = (day) => {
    const ds = `${view.year}-${String(view.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if (ds < todayStr) return;
    onChange(ds);
  };
  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-800">{MONTHS[view.month]} {view.year}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">{DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-600 uppercase py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const ds = `${view.year}-${String(view.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isPast = ds < todayStr;
          const isSelected = ds === value;
          const isToday = ds === todayStr;
          return (
            <button type="button" key={ds} onClick={() => pick(day)} disabled={isPast}
              className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${isSelected ? "bg-emerald-500 text-white font-bold" : isToday ? "bg-emerald-50 text-emerald-600 font-bold" : isPast ? "text-slate-300 cursor-not-allowed" : "text-slate-700 hover:bg-slate-100"}`}
            >{day}</button>
          );
        })}
      </div>
    </div>
  );
}

const TYPE_OPTIONS = [
  { value: "OPD",           label: "Fresh Walk-in",   desc: "First-time or walk-in patient" },
  { value: "FOLLOWUP",      label: "Follow-up",       desc: "Returning patient" },
  { value: "EMERGENCY",     label: "Emergency",       desc: "Urgent — minimal data" },
  { value: "HEALTH_CHECKUP",label: "Health Checkup",  desc: "Link a checkup package" },
];

function SectionLabel({ step, label, icon }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-white">{step}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}

export default function BookAppointmentModal({ isOpen, onClose, onSuccess, selectedDate }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [patients, setPatients]                   = useState([]);
  const [doctors, setDoctors]                     = useState([]);
  const [pastDoctors, setPastDoctors]             = useState([]);
  const [showAllDoctors, setShowAllDoctors]        = useState(false);
  const [doctorAppointments, setDoctorAppointments] = useState([]);

  const [patientId, setPatientId]           = useState("");
  const [doctorId, setDoctorId]             = useState("");
  const [apptDate, setApptDate]             = useState(selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
  const [apptTime, setApptTime]             = useState("");
  const [type, setType]                     = useState("OPD");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [packages, setPackages]             = useState([]);
  const [packageId, setPackageId]           = useState("");
  const [patientSearch, setPatientSearch]   = useState("");
  const [doctorSearch, setDoctorSearch]     = useState("");
  const [patientOpen, setPatientOpen]       = useState(false);
  const [doctorOpen, setDoctorOpen]         = useState(false);
  const patientRef = useRef(null);
  const doctorRef  = useRef(null);
  const [isLoading, setIsLoading]           = useState(false);
  const [errors, setErrors]                 = useState({});

  const [emergencyName, setEmergencyName]   = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const isEmergency     = type === "EMERGENCY";
  const isFollowUp      = type === "FOLLOWUP";
  const isHealthCheckup = type === "HEALTH_CHECKUP";

  const selectedPatient = patients.find(p => String(p.id) === patientId);
  const selectedDoctor  = doctors.find(d => d.id === doctorId);
  const selectedPkg     = packages.find(p => p.id === packageId);

  const filteredPatients = patients.filter(p => {
    const q = patientSearch.toLowerCase();
    return p.firstName.toLowerCase().includes(q) || p.lastName?.toLowerCase().includes(q) || p.uhid?.toLowerCase().includes(q);
  });

  const doctorPool = isFollowUp && pastDoctors.length > 0 && !showAllDoctors ? pastDoctors : doctors;
  const filteredDoctors = doctorPool.filter(d => {
    if (!doctorSearch) return true;
    const q = doctorSearch.toLowerCase();
    return d.firstName?.toLowerCase().includes(q) || d.lastName?.toLowerCase().includes(q) || d.specialization?.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!isOpen || !user?.hospitalId) return;
    Promise.all([
      patientApi.list(user.hospitalId),
      doctorsApi.list(user.hospitalId),
      checkupApi.getPackages(user.hospitalId, true),
    ]).then(([p, d, pk]) => {
      setPatients(p); setDoctors(d.filter(x => x.userIsActive)); setPackages(pk);
      if (user.role === "doctor") {
        const doc = d.find(x => x.userId === user.userId);
        if (doc) setDoctorId(doc.id);
      }
    }).catch(() => notify("Failed to load data", "error"));
  }, [isOpen, user]);

  useEffect(() => {
    if (!isFollowUp || !patientId || !user?.hospitalId || doctors.length === 0) { setPastDoctors([]); setShowAllDoctors(false); return; }
    appointmentsApi.getPastDoctors(Number(patientId), user.hospitalId)
      .then(dtos => {
        const pastIds = new Set(dtos.map(d => d.doctorId));
        setPastDoctors(doctors.filter(d => pastIds.has(d.id)));
      })
      .catch(() => setPastDoctors([]));
  }, [isFollowUp, patientId, user?.hospitalId, doctors]);

  useEffect(() => { setPastDoctors([]); setShowAllDoctors(false); setDoctorSearch(""); setDoctorOpen(false); }, [type]);

  useEffect(() => {
    const handler = (e) => {
      if (patientRef.current && !patientRef.current.contains(e.target)) setPatientOpen(false);
      if (doctorRef.current  && !doctorRef.current.contains(e.target))  setDoctorOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isOpen || !doctorId || !apptDate) { setDoctorAppointments([]); return; }
    appointmentsApi.getByDoctor(doctorId, apptDate)
      .then(appts => setDoctorAppointments(appts.filter(a => ["SCHEDULED","CONFIRMED","CHECKED_IN","IN_PROGRESS"].includes(a.status))))
      .catch(console.error);
  }, [doctorId, apptDate, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.hospitalId) return;
    const errs = {};
    if (isEmergency) {
      if (!emergencyName.trim()) errs.patient = "Patient name is required";
    } else {
      if (!patientId) errs.patient = "Please select a patient";
      if (!doctorId)  errs.doctor  = "Please select a doctor";
      if (!apptTime)  errs.time    = "Please select a time slot";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setIsLoading(true);
    try {
      const payload = {
        hospitalId: user.hospitalId,
        apptDate,
        type,
        chiefComplaint,
        ...(packageId ? { packageId } : {}),
        ...(isEmergency
          ? { emergencyPatientName: emergencyName.trim(), emergencyPhone: emergencyPhone.trim() || undefined, doctorId: doctorId || undefined, apptTime: apptTime || undefined }
          : { patientId: Number(patientId), doctorId, apptTime }),
      };
      const appointment = await appointmentsApi.create(payload);
      notify(isEmergency ? "Emergency appointment created!" : "Appointment scheduled successfully!", "success");
      onSuccess(appointment);
      resetForm();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to book appointment", "error");
    } finally { setIsLoading(false); }
  };

  const resetForm = () => {
    setPatientId(""); setPatientSearch(""); setDoctorSearch("");
    if (user?.role !== "doctor") setDoctorId("");
    setApptTime(""); setType("OPD"); setPackageId(""); setChiefComplaint("");
    setEmergencyName(""); setEmergencyPhone("");
    setPastDoctors([]); setShowAllDoctors(false);
    setErrors({});
  };

  const generateTimeSlots = () => {
    const slotDuration = selectedDoctor?.slotDurationMin || 30;
    const toMin = t => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm; };
    const slots = [];
    let totalMin = 9 * 60;
    while (totalMin < 18 * 60) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const timeStr = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "PM" : "AM";
      const displayTime = `${String(hour12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${ampm}`;
      const slotStart = totalMin;
      const slotEnd = totalMin + slotDuration;
      const isBooked = doctorAppointments.some(a => {
        if (!a.apptTime) return false;
        const aStart = toMin(a.apptTime);
        const aEnd = a.apptEndTime ? toMin(a.apptEndTime) : aStart + slotDuration;
        return slotStart < aEnd && slotEnd > aStart;
      });
      slots.push({ timeStr, displayTime, isBooked });
      totalMin += slotDuration;
    }
    return slots;
  };

  const formatDisplayDate = (d) => {
    if (!d) return "";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  if (!isOpen) return null;
  const timeSlots = generateTimeSlots();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {isEmergency && <AlertTriangle className="w-5 h-5 text-rose-500" />}
              {isEmergency ? "Emergency Appointment" : "Add Appointment"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEmergency ? "Quick entry — complete details can be updated after." : "Schedule a new appointment for a patient."}
            </p>
          </div>
          <button onClick={() => { resetForm(); onClose(); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          <form id="book-form" onSubmit={handleSubmit} className="space-y-7">

            {/* ── Step 1: Patient ── */}
            <div>
              <SectionLabel step="1" label="Patient" />
              {isEmergency ? (
                <div className="space-y-3">
                  <div>
                    <input
                      type="text" value={emergencyName}
                      onChange={e => { setEmergencyName(e.target.value); setErrors(er => ({...er, patient:""})); }}
                      placeholder="Patient full name *"
                      className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.patient ? "border-red-400" : "border-slate-200"} bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none`}
                    />
                    {errors.patient && <p className="text-xs text-red-500 mt-1">{errors.patient}</p>}
                  </div>
                  <input
                    type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)}
                    placeholder="Mobile number (optional)"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                  />
                </div>
              ) : (
                <div>
                  <div className="relative" ref={patientRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={patientSearch}
                      onChange={e => { setPatientSearch(e.target.value); setPatientOpen(true); }}
                      onFocus={() => setPatientOpen(true)}
                      placeholder="Search by name or UHID…"
                      className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border ${errors.patient ? "border-red-400" : "border-slate-200"} bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 outline-none transition-all`}
                    />
                    {patientOpen && filteredPatients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-lg max-h-44 overflow-y-auto">
                        {(patientSearch ? filteredPatients : filteredPatients.slice(0, 5)).map(p => (
                          <button key={p.id} type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setPatientId(String(p.id)); setPatientSearch(""); setPatientOpen(false); setErrors(e => ({...e, patient:""})); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-b last:border-b-0 border-slate-100">
                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">{p.firstName[0]}</div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{p.firstName} {p.lastName}</p>
                              <p className="text-[11px] text-slate-400">{fmtId(p.uhid)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedPatient ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 mt-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">{selectedPatient.firstName[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-800 truncate">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p className="text-[11px] text-emerald-600">{fmtId(selectedPatient.uhid)}</p>
                      </div>
                      <button type="button" onClick={() => { setPatientId(""); setPastDoctors([]); }} className="text-emerald-500 hover:text-emerald-700"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    errors.patient && <p className="text-xs text-red-500 mt-1">{errors.patient}</p>
                  )}

                  <button type="button"
                    onClick={() => { onClose(); navigate("/patients", { state: { openRegistration: true } }); }}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                    <UserPlus className="w-3.5 h-3.5" /> Register new patient
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Step 2: Appointment Type ── */}
            <div>
              <SectionLabel step="2" label="Appointment Type" />
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setType(opt.value)}
                    className={`text-left px-4 py-3 rounded-lg border transition-all ${type === opt.value ? (opt.value === "EMERGENCY" ? "border-rose-500 bg-rose-50" : "border-emerald-500 bg-emerald-50") : "border-slate-200 hover:border-slate-300"}`}>
                    <p className={`text-sm font-semibold ${type === opt.value ? (opt.value === "EMERGENCY" ? "text-rose-700" : "text-emerald-700") : "text-slate-700"}`}>
                      {type === opt.value && <CheckCircle className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />}{opt.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Health Checkup package picker */}
              {isHealthCheckup && packages.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Package <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    value={packageId}
                    onChange={(v) => setPackageId(v)}
                    options={packages.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Select a checkup package"
                    className="w-full px-4 py-3 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {selectedPkg && (
                    <div className="mt-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-700">{selectedPkg.tests?.length || 0} tests included</p>
                      <p className="text-xs text-emerald-600 mt-0.5 line-clamp-2">{selectedPkg.tests?.map(t => t.testName).join(", ")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Step 3: Doctor ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel step="3" label={isEmergency ? "Assign Doctor (optional)" : "Doctor"} />
                {isFollowUp && pastDoctors.length > 0 && (
                  <button type="button" onClick={() => setShowAllDoctors(s => !s)} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                    {showAllDoctors ? "Show past doctors" : "Show all doctors"}
                  </button>
                )}
              </div>

              {isFollowUp && patientId && pastDoctors.length > 0 && !showAllDoctors && (
                <p className="text-xs text-slate-500 mb-2">
                  {pastDoctors.length} doctor{pastDoctors.length > 1 ? "s have" : " has"} previously seen this patient.
                </p>
              )}

              <div className="relative" ref={doctorRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={doctorSearch}
                  onChange={e => { setDoctorSearch(e.target.value); setDoctorOpen(true); }}
                  onFocus={() => { if (!selectedDoctor && user?.role !== "doctor") setDoctorOpen(true); }}
                  disabled={user?.role === "doctor"}
                  placeholder="Search by name or specialization…"
                  className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border ${errors.doctor ? "border-red-400" : "border-slate-200"} bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all`}
                />
                {doctorOpen && filteredDoctors.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-lg max-h-44 overflow-y-auto">
                    {(doctorSearch ? filteredDoctors : filteredDoctors.slice(0, 5)).map(d => (
                      <button key={d.id} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setDoctorId(d.id); setDoctorSearch(""); setDoctorOpen(false); setApptTime(""); setErrors(p => ({...p, doctor:""})); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-b last:border-b-0 border-slate-100">
                        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">{d.firstName[0]}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">Dr. {d.firstName} {d.lastName}</p>
                          <p className="text-[11px] text-slate-400">{d.specialization}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.doctor && <p className="text-xs text-red-500 mt-1">{errors.doctor}</p>}

              {selectedDoctor && (
                <div className="mt-2 flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">{selectedDoctor.firstName[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                    <p className="text-xs text-slate-500">{selectedDoctor.specialization}</p>
                  </div>
                  {(() => {
                    const fee = isFollowUp && selectedDoctor.followUpFee != null ? selectedDoctor.followUpFee : selectedDoctor.consultationFee;
                    return fee != null ? (
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{isFollowUp ? "Follow-up" : "Consult"}</p>
                        <p className="text-sm font-bold text-slate-800">₹{fee}</p>
                      </div>
                    ) : null;
                  })()}
                  <button type="button" onClick={() => { setDoctorId(""); setApptTime(""); }} className="text-slate-400 hover:text-slate-600 shrink-0 ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Step 4: Date & Time ── */}
            <div>
              <SectionLabel step="4" label="Date & Time" icon={<Calendar className="w-4 h-4" />} />

              <div className="grid grid-cols-2 gap-4">
                {/* Calendar */}
                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  {apptDate && (
                    <div className="mb-3 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                      <p className="text-xs font-semibold text-emerald-700">{formatDisplayDate(apptDate)}</p>
                    </div>
                  )}
                  <MiniCalendar value={apptDate} onChange={v => { setApptDate(v); setApptTime(""); }} />
                </div>

                {/* Time slots */}
                <div className="flex flex-col">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Time {isEmergency && <span className="font-normal normal-case text-slate-400">(optional)</span>}
                  </p>

                  {isEmergency ? (
                    <div className="flex flex-col gap-2">
                      <input type="time" value={apptTime ? apptTime.substring(0,5) : ""}
                        onChange={e => setApptTime(e.target.value ? e.target.value + ":00" : "")}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                      <button type="button" onClick={() => { const n = new Date(); setApptTime(`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:00`); }}
                        className="w-full px-4 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100 transition-colors">
                        Set to Now
                      </button>
                    </div>
                  ) : !doctorId ? (
                    <div className="flex-1 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-center p-4">
                      <p className="text-sm text-slate-400">Select a doctor first to see available time slots.</p>
                    </div>
                  ) : (
                    <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="h-full max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {timeSlots.map(slot => (
                          <button key={slot.timeStr} type="button" disabled={slot.isBooked}
                            onClick={() => { setApptTime(slot.timeStr); setErrors(e => ({...e, time:""})); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${slot.isBooked ? "text-slate-300 cursor-not-allowed bg-slate-50/50" : apptTime === slot.timeStr ? "bg-emerald-50 text-emerald-700 font-semibold" : "hover:bg-slate-50 text-slate-700"}`}>
                            <Clock className={`w-3.5 h-3.5 shrink-0 ${slot.isBooked ? "text-slate-300" : apptTime === slot.timeStr ? "text-emerald-500" : "text-slate-400"}`} />
                            <span>{slot.displayTime}</span>
                            {slot.isBooked && <span className="ml-auto text-[10px] font-semibold uppercase text-slate-400">Booked</span>}
                            {apptTime === slot.timeStr && <CheckCircle className="ml-auto w-3.5 h-3.5 text-emerald-500" />}
                          </button>
                        ))}
                      </div>
                      {errors.time && <p className="text-xs text-red-500 px-4 py-2 border-t border-slate-100">{errors.time}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Step 5: Reason for Visit ── */}
            <div>
              <SectionLabel step="5" label="Reason for Visit" icon={<FileText className="w-4 h-4" />} />
              <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} rows={3}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder-slate-400 focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 outline-none transition-all resize-none"
                placeholder={isEmergency ? "Brief description of emergency (optional)" : "Enter the reason for the appointment (optional)"} />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-slate-200 bg-white shrink-0">
          <button type="button" onClick={() => { resetForm(); onClose(); }} className="btn-secondary">Cancel</button>
          <button type="submit" form="book-form" disabled={isLoading}
            className={isEmergency ? "px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 transition-colors" : "btn-primary"}>
            {isLoading ? "Saving…" : isEmergency ? "Create Emergency Appointment" : "Schedule Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
