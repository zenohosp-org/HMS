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
    <div className="hms-mini-cal">
      <div className="hms-mini-cal__head">
        <span className="hms-mini-cal__title">{MONTHS[view.month]} {view.year}</span>
        <div className="hms-mini-cal__nav">
          <button type="button" onClick={prevMonth} className="hms-mini-cal__nav-btn"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={nextMonth} className="hms-mini-cal__nav-btn"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="hms-mini-cal__dow">{DAYS.map(d => <div key={d} className="hms-mini-cal__dow-cell">{d}</div>)}</div>
      <div className="hms-mini-cal__grid">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const ds = `${view.year}-${String(view.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isPast = ds < todayStr;
          const isSelected = ds === value;
          const isToday = ds === todayStr;
          const cls = isSelected ? " is-selected" : isToday ? " is-today" : "";
          return (
            <button type="button" key={ds} onClick={() => pick(day)} disabled={isPast}
              className={`hms-mini-cal__day${cls}`}
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
    <div className="hms-book-section-label">
      <div className="hms-book-section-num">
        <span>{step}</span>
      </div>
      <div className="hms-book-section-title">
        {icon && <span className="hms-book-section-title__icon">{icon}</span>}
        <span>{label}</span>
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
    <div className="zu-modal-overlay">
      <div className="zu-modal is-xl">

        {/* Header */}
        <div className="zu-modal-header">
          <div className="zu-modal-header-row">
            <div>
              <h2 className="hms-cmodal__title flex items-center gap-2">
                {isEmergency && <AlertTriangle className="w-5 h-5 text-rose" />}
                {isEmergency ? "Emergency Appointment" : "Add Appointment"}
              </h2>
              <p className="hms-cmodal__subtitle">
                {isEmergency ? "Quick entry — complete details can be updated after." : "Schedule a new appointment for a patient."}
              </p>
            </div>
            <button onClick={() => { resetForm(); onClose(); }} className="zu-modal-close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="zu-modal-body">
          <form id="book-form" onSubmit={handleSubmit} className="hms-form-stack">

            {/* ── Step 1: Patient ── */}
            <div className="hms-book-section">
              <SectionLabel step="1" label="Patient" />
              {isEmergency ? (
                <div className="hms-form-rows">
                  <div>
                    <input
                      type="text" value={emergencyName}
                      onChange={e => { setEmergencyName(e.target.value); setErrors(er => ({...er, patient:""})); }}
                      placeholder="Patient full name *"
                      className={`hms-book-emergency-input${errors.patient ? " is-error" : ""}`}
                    />
                    {errors.patient && <p className="hms-field-error">{errors.patient}</p>}
                  </div>
                  <input
                    type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)}
                    placeholder="Mobile number (optional)"
                    className="hms-book-emergency-input"
                  />
                </div>
              ) : (
                <div>
                  <div className="hms-book-search" ref={patientRef}>
                    <Search className="hms-book-search__icon w-4 h-4" />
                    <input type="text" value={patientSearch}
                      onChange={e => { setPatientSearch(e.target.value); setPatientOpen(true); }}
                      onFocus={() => setPatientOpen(true)}
                      placeholder="Search by name or UHID…"
                      className={`hms-book-search__input${errors.patient ? " is-error" : ""}`}
                    />
                    {patientOpen && filteredPatients.length > 0 && (
                      <div className="hms-book-suggest">
                        {(patientSearch ? filteredPatients : filteredPatients.slice(0, 5)).map(p => (
                          <button key={p.id} type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setPatientId(String(p.id)); setPatientSearch(""); setPatientOpen(false); setErrors(e => ({...e, patient:""})); }}
                            className="hms-book-suggest__item">
                            <div className="hms-book-suggest__avatar">{p.firstName[0]}</div>
                            <div className="hms-book-suggest__body">
                              <p className="hms-book-suggest__name">{p.firstName} {p.lastName}</p>
                              <p className="hms-book-suggest__sub">{fmtId(p.uhid)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedPatient ? (
                    <div className="hms-book-picked">
                      <div className="hms-book-picked__avatar">{selectedPatient.firstName[0]}</div>
                      <div className="hms-book-picked__body">
                        <p className="hms-book-picked__name">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p className="hms-book-picked__sub">{fmtId(selectedPatient.uhid)}</p>
                      </div>
                      <button type="button" onClick={() => { setPatientId(""); setPastDoctors([]); }} className="hms-book-picked__clear"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    errors.patient && <p className="hms-field-error">{errors.patient}</p>
                  )}

                  <button type="button"
                    onClick={() => { onClose(); navigate("/patients", { state: { openRegistration: true } }); }}
                    className="hms-book-register-btn">
                    <UserPlus className="w-3.5 h-3.5" /> Register new patient
                  </button>
                </div>
              )}
            </div>

            <hr className="hms-book-divider" />

            {/* ── Step 2: Appointment Type ── */}
            <div className="hms-book-section">
              <SectionLabel step="2" label="Appointment Type" />
              <div className="hms-book-type-grid">
                {TYPE_OPTIONS.map(opt => {
                  const on = type === opt.value;
                  const isEmer = opt.value === "EMERGENCY";
                  const cls = `hms-book-type-card${on ? " is-on" : ""}${on && isEmer ? " is-emergency" : ""}`;
                  return (
                    <button key={opt.value} type="button" onClick={() => setType(opt.value)} className={cls}>
                      <p className="hms-book-type-card__title">
                        {on && <CheckCircle className="w-3.5 h-3.5" />}{opt.label}
                      </p>
                      <p className="hms-book-type-card__sub">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Health Checkup package picker */}
              {isHealthCheckup && packages.length > 0 && (
                <div className="hms-form-group">
                  <label className="hms-label">
                    Package <span className="text-rose">*</span>
                  </label>
                  <SearchableSelect
                    value={packageId}
                    onChange={(v) => setPackageId(v)}
                    options={packages.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Select a checkup package"
                    className="hms-input"
                  />
                  {selectedPkg && (
                    <div className="hms-book-pkg-info">
                      <p className="hms-book-pkg-info__title">{selectedPkg.tests?.length || 0} tests included</p>
                      <p className="hms-book-pkg-info__sub">{selectedPkg.tests?.map(t => t.testName).join(", ")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <hr className="hms-book-divider" />

            {/* ── Step 3: Doctor ── */}
            <div className="hms-book-section">
              <div className="hms-book-section__head">
                <SectionLabel step="3" label={isEmergency ? "Assign Doctor (optional)" : "Doctor"} />
                {isFollowUp && pastDoctors.length > 0 && (
                  <button type="button" onClick={() => setShowAllDoctors(s => !s)} className="hms-book-section-link">
                    {showAllDoctors ? "Show past doctors" : "Show all doctors"}
                  </button>
                )}
              </div>

              {isFollowUp && patientId && pastDoctors.length > 0 && !showAllDoctors && (
                <p className="hms-book-hint">
                  {pastDoctors.length} doctor{pastDoctors.length > 1 ? "s have" : " has"} previously seen this patient.
                </p>
              )}

              <div className="hms-book-search" ref={doctorRef}>
                <Search className="hms-book-search__icon w-4 h-4" />
                <input type="text" value={doctorSearch}
                  onChange={e => { setDoctorSearch(e.target.value); setDoctorOpen(true); }}
                  onFocus={() => { if (!selectedDoctor && user?.role !== "doctor") setDoctorOpen(true); }}
                  disabled={user?.role === "doctor"}
                  placeholder="Search by name or specialization…"
                  className={`hms-book-search__input${errors.doctor ? " is-error" : ""}`}
                />
                {doctorOpen && filteredDoctors.length > 0 && (
                  <div className="hms-book-suggest">
                    {(doctorSearch ? filteredDoctors : filteredDoctors.slice(0, 5)).map(d => (
                      <button key={d.id} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setDoctorId(d.id); setDoctorSearch(""); setDoctorOpen(false); setApptTime(""); setErrors(p => ({...p, doctor:""})); }}
                        className="hms-book-suggest__item">
                        <div className="hms-book-suggest__avatar">{d.firstName[0]}</div>
                        <div className="hms-book-suggest__body">
                          <p className="hms-book-suggest__name">Dr. {d.firstName} {d.lastName}</p>
                          <p className="hms-book-suggest__sub">{d.specialization}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.doctor && <p className="hms-field-error">{errors.doctor}</p>}

              {selectedDoctor && (
                <div className="hms-book-picked is-neutral">
                  <div className="hms-book-picked__avatar">{selectedDoctor.firstName[0]}</div>
                  <div className="hms-book-picked__body">
                    <p className="hms-book-picked__name">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                    <p className="hms-book-picked__sub">{selectedDoctor.specialization}</p>
                  </div>
                  {(() => {
                    const fee = isFollowUp && selectedDoctor.followUpFee != null ? selectedDoctor.followUpFee : selectedDoctor.consultationFee;
                    return fee != null ? (
                      <div className="hms-book-fee">
                        <p className="hms-book-fee__label">{isFollowUp ? "Follow-up" : "Consult"}</p>
                        <p className="hms-book-fee__value">₹{fee}</p>
                      </div>
                    ) : null;
                  })()}
                  <button type="button" onClick={() => { setDoctorId(""); setApptTime(""); }} className="hms-book-picked__clear">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <hr className="hms-book-divider" />

            {/* ── Step 4: Date & Time ── */}
            <div className="hms-book-section">
              <SectionLabel step="4" label="Date & Time" icon={<Calendar className="w-4 h-4" />} />

              <div className="hms-book-date-grid">
                {/* Calendar */}
                <div className="hms-book-cal">
                  {apptDate && (
                    <div className="hms-book-cal__selected">
                      <p className="hms-book-cal__selected-text">{formatDisplayDate(apptDate)}</p>
                    </div>
                  )}
                  <MiniCalendar value={apptDate} onChange={v => { setApptDate(v); setApptTime(""); }} />
                </div>

                {/* Time slots */}
                <div className="hms-book-time-col">
                  <p className="hms-book-time-col__label">
                    Time {isEmergency && <span className="hms-book-time-col__label-hint">(optional)</span>}
                  </p>

                  {isEmergency ? (
                    <div className="hms-book-time-stack">
                      <input type="time" value={apptTime ? apptTime.substring(0,5) : ""}
                        onChange={e => setApptTime(e.target.value ? e.target.value + ":00" : "")}
                        className="hms-input"
                      />
                      <button type="button" onClick={() => { const n = new Date(); setApptTime(`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:00`); }}
                        className="hms-book-emergency-now">
                        Set to Now
                      </button>
                    </div>
                  ) : !doctorId ? (
                    <div className="hms-book-time-empty">
                      <p className="m-0">Select a doctor first to see available time slots.</p>
                    </div>
                  ) : (
                    <div className="hms-book-time-list">
                      <div className="hms-book-time-list__inner">
                        {timeSlots.map(slot => {
                          const on = apptTime === slot.timeStr;
                          return (
                            <button key={slot.timeStr} type="button" disabled={slot.isBooked}
                              onClick={() => { setApptTime(slot.timeStr); setErrors(e => ({...e, time:""})); }}
                              className={`hms-book-slot${on ? " is-on" : ""}`}>
                              <Clock className="hms-book-slot__icon w-3.5 h-3.5" />
                              <span>{slot.displayTime}</span>
                              {slot.isBooked && <span className="hms-book-slot__booked">Booked</span>}
                              {on && <CheckCircle className="hms-book-slot__ok w-3.5 h-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                      {errors.time && <p className="hms-book-time-list__err">{errors.time}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <hr className="hms-book-divider" />

            {/* ── Step 5: Reason for Visit ── */}
            <div className="hms-book-section">
              <SectionLabel step="5" label="Reason for Visit" icon={<FileText className="w-4 h-4" />} />
              <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} rows={3}
                className="hms-book-textarea"
                placeholder={isEmergency ? "Brief description of emergency (optional)" : "Enter the reason for the appointment (optional)"} />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="zu-modal-footer">
          <button type="button" onClick={() => { resetForm(); onClose(); }} className="zu-btn-cancel">Cancel</button>
          <button type="submit" form="book-form" disabled={isLoading}
            className={isEmergency ? "hms-book-emergency-btn" : "zu-btn-primary"}>
            {isLoading ? "Saving…" : isEmergency ? "Create Emergency Appointment" : "Schedule Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
