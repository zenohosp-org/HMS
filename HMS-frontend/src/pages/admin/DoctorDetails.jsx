import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { appointmentsApi, doctorsApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import DoctorFormModal from "@/components/modals/DoctorFormModal";
import {
  Loader2,
  ChevronLeft,
  Mail,
  Phone,
  BookOpen,
  Stethoscope,
  User,
  CheckCircle,
  Edit2,
  Calendar,
  Clock,
  Banknote,
  Building2,
  CalendarIcon,
  AlertCircle,
  Users,
  Save,
  CalendarDays,
} from "lucide-react";

const DAYS = [
  { label: "Monday",    short: "MON", bit: 1,  idx: 0 },
  { label: "Tuesday",   short: "TUE", bit: 2,  idx: 1 },
  { label: "Wednesday", short: "WED", bit: 4,  idx: 2 },
  { label: "Thursday",  short: "THU", bit: 8,  idx: 3 },
  { label: "Friday",    short: "FRI", bit: 16, idx: 4 },
  { label: "Saturday",  short: "SAT", bit: 32, idx: 5 },
  { label: "Sunday",    short: "SUN", bit: 64, idx: 6 },
];

const inputBase =
  "w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 dark:focus:border-blue-500 transition-all";

function SideInfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-4 h-4 mt-0.5 shrink-0 text-[#555] dark:text-[#555555]">{icon}</div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-[#999999] font-semibold">{label}</p>
        <p className="text-sm text-slate-700 dark:text-[#cccccc] mt-0.5">{value || "-"}</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="text-[#666666]">{icon}</div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-[#cccccc] uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function DoctorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("overview");

  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Schedule state: map of dayOfWeek index -> slot object
  const [scheduleSlots, setScheduleSlots] = useState({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const doctorPatients = React.useMemo(() => {
    const pMap = new Map();
    doctorAppointments.forEach((appt) => {
      if (!pMap.has(appt.patientId)) {
        pMap.set(appt.patientId, {
          id: appt.patientId,
          name: appt.patientName,
          visits: 1,
          lastVisit: appt.apptDate.substring(0, 10),
        });
      } else {
        const existing = pMap.get(appt.patientId);
        existing.visits += 1;
        if (appt.apptDate > existing.lastVisit) existing.lastVisit = appt.apptDate.substring(0, 10);
        pMap.set(appt.patientId, existing);
      }
    });
    return Array.from(pMap.values()).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
  }, [doctorAppointments]);

  const nextAppointment = React.useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return doctorAppointments
      .filter((a) => ["SCHEDULED", "CONFIRMED"].includes(a.status) && a.apptDate >= todayStr)
      .sort((a, b) => {
        const d = a.apptDate.localeCompare(b.apptDate);
        return d !== 0 ? d : a.apptTime.localeCompare(b.apptTime);
      })[0] ?? null;
  }, [doctorAppointments]);

  const completedCount = doctorAppointments.filter((a) => a.status === "COMPLETED").length;
  const scheduledCount = doctorAppointments.filter((a) => ["SCHEDULED", "CONFIRMED"].includes(a.status)).length;

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const docData = await doctorsApi.get(id);
      setDoctor(docData);
      setLoadingAppointments(true);
      try {
        const appts = await appointmentsApi.getByHospital(docData.hospitalId);
        const docAppts = appts.filter((a) => a.doctorId === docData.id);
        docAppts.sort(
          (a, b) =>
            new Date(`${b.apptDate}T${b.apptTime}`).getTime() -
            new Date(`${a.apptDate}T${a.apptTime}`).getTime()
        );
        setDoctorAppointments(docAppts);
      } catch {
        // appointments optional
      } finally {
        setLoadingAppointments(false);
      }
    } catch {
      notify("Failed to load doctor details", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = useCallback(async (doc) => {
    if (!doc) return;
    setScheduleLoading(true);
    try {
      const slots = await doctorsApi.getAvailability(doc.id);
      const map = {};
      slots.forEach((s) => { map[s.dayOfWeek] = { ...s }; });
      // Pre-fill active days that have no DB record yet
      DAYS.forEach(({ bit, idx }) => {
        if ((doc.availableDaysMask ?? 0) & bit) {
          if (!map[idx]) {
            map[idx] = {
              dayOfWeek: idx,
              startTime: "09:00",
              endTime: "17:00",
              slotDurationMins: doc.slotDurationMin || 15,
              maxDailySlots: doc.maxDailySlots || 40,
              isActive: true,
            };
          }
        }
      });
      setScheduleSlots(map);
    } catch {
      notify("Failed to load schedule", "error");
    } finally {
      setScheduleLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (tab === "schedule" && doctor) loadAvailability(doctor);
  }, [tab, doctor]);

  const updateSlot = (dayIdx, field, value) => {
    setScheduleSlots((prev) => ({
      ...prev,
      [dayIdx]: { ...prev[dayIdx], [field]: value },
    }));
  };

  const saveSchedule = async () => {
    setScheduleSaving(true);
    try {
      const activeDays = Object.values(scheduleSlots).filter((s) => s.startTime && s.endTime);
      await Promise.all(
        activeDays.map((s) =>
          doctorsApi.saveAvailability(doctor.id, {
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            slotDurationMins: s.slotDurationMins,
            maxDailySlots: s.maxDailySlots,
            isActive: s.isActive !== false,
          })
        )
      );
      notify("Schedule saved successfully", "success");
      await loadAvailability(doctor);
    } catch {
      notify("Failed to save schedule", "error");
    } finally {
      setScheduleSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0f0f0f]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );

  if (!doctor)
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-white dark:bg-[#0f0f0f]">
        <AlertCircle className="w-10 h-10 text-slate-300 dark:text-[#333333]" />
        <p className="text-slate-500">Doctor not found.</p>
        <button onClick={() => navigate(-1)} className="btn-secondary">Go Back</button>
      </div>
    );

  const canEdit = user?.role === "hospital_admin" || user?.userId === doctor.userId;
  const initials = `${doctor.firstName[0]}${doctor.lastName?.[0] ?? ""}`.toUpperCase();

  const TABS = ["overview", "appointments", "patients", "schedule"];

  const tabLabel = (t) => {
    if (t === "appointments") return `Appointments ${!loadingAppointments ? `(${doctorAppointments.length})` : ""}`;
    if (t === "patients") return `Patients ${!loadingAppointments ? `(${doctorPatients.length})` : ""}`;
    if (t === "schedule") return "Schedule";
    return "Overview";
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-3.5rem)] w-[calc(100%+3rem)] -mx-6 -mt-6 overflow-hidden bg-white dark:bg-[#0f0f0f]">
      {/* LEFT PANE */}
      <aside className="w-72 shrink-0 flex flex-col bg-white dark:bg-[#111111] border-r border-slate-200 dark:border-[#1e1e1e] overflow-y-auto">
        <div className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-[#1e1e1e] flex justify-between items-center">
          <button
            onClick={() => navigate("/doctors")}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666666] hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Doctors
          </button>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-slate-500 dark:text-[#666666] hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors p-1"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-5 py-6 text-center border-b border-slate-200 dark:border-[#1e1e1e]">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-slate-200 dark:border-[#2a2a2a] mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-blue-600 dark:text-blue-400">
            {initials}
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
            Dr. {doctor.firstName} {doctor.lastName}
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#888888] mt-0.5">{doctor.specialization || "General Practitioner"}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            {doctor.userIsActive ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Active
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">Inactive</span>
            )}
          </div>
          {doctor.medicalRegistrationNumber && (
            <p className="text-xs text-slate-400 dark:text-[#444444] mt-3">{doctor.medicalRegistrationNumber}</p>
          )}
        </div>

        <div className="px-5 py-5 space-y-6 flex-1">
          <div>
            <SectionHeader icon={<User className="w-4 h-4" />} title="Contact Info" />
            <div className="space-y-3">
              <SideInfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={doctor.email} />
              <SideInfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={doctor.phone} />
              <SideInfoRow icon={<BookOpen className="w-4 h-4" />} label="Qualification" value={doctor.qualification} />
            </div>
          </div>
          <div>
            <SectionHeader icon={<Stethoscope className="w-4 h-4" />} title="Practice Info" />
            <div className="space-y-3">
              <SideInfoRow icon={<Banknote className="w-4 h-4" />} label="Consultation Fee" value={doctor.consultationFee != null ? `₹${doctor.consultationFee.toFixed(2)}` : null} />
              <SideInfoRow icon={<Clock className="w-4 h-4" />} label="Slot Duration" value={doctor.slotDurationMin ? `${doctor.slotDurationMin} mins` : null} />
              <SideInfoRow icon={<Calendar className="w-4 h-4" />} label="Max Daily Slots" value={doctor.maxDailySlots != null ? String(doctor.maxDailySlots) : null} />
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT PANE */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0f0f0f] relative w-full">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-6 pt-5 pb-0 border-b border-slate-200 dark:border-[#1e1e1e] shrink-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 dark:text-[#666666] hover:text-slate-700 dark:hover:text-[#aaaaaa]"
              }`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="animate-in fade-in duration-500 space-y-5 w-full max-w-5xl">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#999999] mb-3">
                    <Calendar className="w-3.5 h-3.5" /> Next Appointment
                  </div>
                  {loadingAppointments ? (
                    <p className="text-sm text-slate-600 dark:text-[#999999]">Loading...</p>
                  ) : nextAppointment ? (
                    <>
                      <p className="text-base font-bold text-slate-800 dark:text-[#f0f0f0]">
                        {nextAppointment.apptDate.substring(0, 10)}, {nextAppointment.apptTime.substring(0, 5)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#666666] mt-1 font-semibold">{nextAppointment.type}</p>
                      <p className="text-xs text-slate-600 dark:text-[#999999] mt-0.5">{nextAppointment.patientName}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-[#999999]">No upcoming appointment</p>
                  )}
                </div>
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#999999] mb-3">
                    <CheckCircle className="w-3.5 h-3.5" /> Completed
                  </div>
                  <p className="text-base font-bold text-slate-800 dark:text-[#f0f0f0]">
                    {loadingAppointments ? "..." : completedCount} Appointments
                  </p>
                  {!loadingAppointments && scheduledCount > 0 && (
                    <p className="text-xs text-slate-500 dark:text-[#666666] mt-1">{scheduledCount} upcoming scheduled</p>
                  )}
                  {!loadingAppointments && completedCount === 0 && (
                    <p className="text-xs text-slate-600 dark:text-[#999999] mt-1">None yet</p>
                  )}
                </div>
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#999999] mb-3">
                    <Users className="w-3.5 h-3.5" /> Patients
                  </div>
                  <p className="text-base font-bold text-slate-800 dark:text-[#f0f0f0]">
                    {loadingAppointments ? "..." : doctorPatients.length} Unique Patients
                  </p>
                  {!loadingAppointments && doctorPatients.length > 0 && (
                    <button onClick={() => setTab("patients")} className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-0.5">
                      View all &rarr;
                    </button>
                  )}
                  {!loadingAppointments && doctorPatients.length === 0 && (
                    <p className="text-xs text-slate-600 dark:text-[#999999] mt-1">None yet</p>
                  )}
                </div>
              </div>

              {/* Billing & Schedule */}
              <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                    <Banknote className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-[#e5e5e5]">Billing &amp; Schedule</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Consultation Fee</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">₹{doctor.consultationFee?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Follow-up Fee</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">₹{doctor.followUpFee?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-[#161616] rounded-lg border border-slate-100 dark:border-[#222222]">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Slot Duration</p>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <p className="text-base font-bold text-slate-900 dark:text-white">{doctor.slotDurationMin} <span className="text-xs font-medium text-slate-500">mins</span></p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-[#161616] rounded-lg border border-slate-100 dark:border-[#222222]">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Max Daily Slots</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">{doctor.maxDailySlots}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Available Days</p>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map(({ short, bit }) => {
                        const isAvailable = !!((doctor.availableDaysMask ?? 0) & bit);
                        return (
                          <div
                            key={bit}
                            className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2 ${
                              isAvailable
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30"
                                : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-[#161616] dark:text-[#555555] dark:border-[#222222]"
                            }`}
                          >
                            {isAvailable && <CheckCircle className="w-3.5 h-3.5" />}
                            {short}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Medical Registration */}
              <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
                  <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <Stethoscope className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-[#e5e5e5]">Medical Registration</h3>
                </div>
                <div className="p-5 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registration Number</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-[#cccccc]">{doctor.medicalRegistrationNumber || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registration Council</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-[#cccccc]">{doctor.registrationCouncil || "Not specified"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* APPOINTMENTS */}
          {tab === "appointments" && (
            <div className="animate-in fade-in duration-500 w-full max-w-5xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5]">Appointments</h3>
                  <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">
                    {doctorAppointments.length} appointment{doctorAppointments.length !== 1 ? "s" : ""} for Dr. {doctor.firstName}
                  </p>
                </div>
              </div>
              {loadingAppointments ? (
                <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>
              ) : doctorAppointments.length === 0 ? (
                <div className="py-16 text-center">
                  <CalendarIcon className="w-10 h-10 text-slate-200 dark:text-[#282828] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No Appointments</p>
                  <p className="text-xs text-slate-400 dark:text-[#444444] mt-1">This doctor has no recorded appointments yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {doctorAppointments.slice(0, 50).map((appt) => (
                    <div key={appt.id} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg p-5 hover:border-slate-300 dark:hover:border-[#333333] transition-colors relative overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        ["COMPLETED"].includes(appt.status) ? "bg-emerald-500"
                        : ["CANCELLED", "NO_SHOW"].includes(appt.status) ? "bg-red-500"
                        : ["IN_PROGRESS"].includes(appt.status) ? "bg-amber-500"
                        : "bg-blue-500"
                      }`} />
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-lg font-bold text-slate-800 dark:text-white">{appt.apptDate.substring(0, 10)}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5" />{appt.apptTime.substring(0, 5)}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                          ["COMPLETED"].includes(appt.status) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : ["CANCELLED", "NO_SHOW"].includes(appt.status) ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                          : ["IN_PROGRESS"].includes(appt.status) ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                        }`}>
                          {appt.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center shrink-0 font-bold text-xs text-slate-600 dark:text-slate-300">
                            {appt.patientName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{appt.patientName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{appt.type}</p>
                          </div>
                        </div>
                        {appt.chiefComplaint && (
                          <div className="bg-slate-50 dark:bg-[#161616] p-3 rounded-lg mt-2 border border-slate-100 dark:border-[#222222]">
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#666666] mb-1">Reason for visit</p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">"{appt.chiefComplaint}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PATIENTS */}
          {tab === "patients" && (
            <div className="animate-in fade-in duration-500 w-full max-w-5xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5]">Associated Patients</h3>
                  <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">
                    {doctorPatients.length} patient{doctorPatients.length !== 1 ? "s" : ""} have visited
                  </p>
                </div>
              </div>
              {loadingAppointments ? (
                <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-900 dark:text-white" /></div>
              ) : doctorPatients.length === 0 ? (
                <div className="py-16 text-center">
                  <Building2 className="w-10 h-10 text-slate-200 dark:text-[#282828] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No Patients Found</p>
                  <p className="text-xs text-slate-400 dark:text-[#444444] mt-1">There are no patients associated with this doctor yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {doctorPatients.slice(0, 50).map((patient, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg p-4 flex items-center gap-4 hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors cursor-pointer"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2a2a2a] flex items-center justify-center text-sm font-bold text-slate-700 dark:text-[#cccccc] shrink-0">
                        {patient.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-[#cccccc] truncate">{patient.name}</p>
                        <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">Visits: {patient.visits} &middot; Last: {patient.lastVisit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SCHEDULE */}
          {tab === "schedule" && (
            <div className="animate-in fade-in duration-500 w-full max-w-3xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-[#e5e5e5]">Availability Schedule</h3>
                  <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">
                    Configure working hours and slot settings for each day
                  </p>
                </div>
                {canEdit && (
                  <button
                    onClick={saveSchedule}
                    disabled={scheduleSaving || scheduleLoading}
                    className="btn-primary flex items-center gap-2 min-w-[120px] justify-center"
                  >
                    {scheduleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {scheduleSaving ? "Saving…" : "Save Schedule"}
                  </button>
                )}
              </div>

              {scheduleLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>
              ) : (
                <div className="space-y-3">
                  {DAYS.map(({ label, short, bit, idx }) => {
                    const isEnabled = !!((doctor.availableDaysMask ?? 0) & bit);
                    const slot = scheduleSlots[idx];

                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border transition-all ${
                          isEnabled
                            ? "bg-white dark:bg-[#111111] border-slate-200 dark:border-[#1e1e1e]"
                            : "bg-slate-50 dark:bg-[#0d0d0d] border-slate-100 dark:border-[#181818] opacity-50"
                        }`}
                      >
                        <div className="flex items-center gap-4 px-5 py-4">
                          {/* Day label */}
                          <div className="w-28 shrink-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                              <span className="text-sm font-bold text-slate-700 dark:text-[#cccccc]">{label}</span>
                            </div>
                            {!isEnabled && (
                              <p className="text-[10px] text-slate-400 dark:text-[#555] mt-1 ml-4">Not available</p>
                            )}
                          </div>

                          {isEnabled && slot ? (
                            <div className="flex-1 grid grid-cols-4 gap-3">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Time</p>
                                <input
                                  type="time"
                                  value={slot.startTime || "09:00"}
                                  onChange={(e) => updateSlot(idx, "startTime", e.target.value)}
                                  className={inputBase}
                                  disabled={!canEdit}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Time</p>
                                <input
                                  type="time"
                                  value={slot.endTime || "17:00"}
                                  onChange={(e) => updateSlot(idx, "endTime", e.target.value)}
                                  className={inputBase}
                                  disabled={!canEdit}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Slot (min)</p>
                                <input
                                  type="number"
                                  min="5"
                                  step="5"
                                  value={slot.slotDurationMins || ""}
                                  onChange={(e) => updateSlot(idx, "slotDurationMins", parseInt(e.target.value) || 0)}
                                  className={inputBase}
                                  disabled={!canEdit}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max Slots</p>
                                <input
                                  type="number"
                                  min="1"
                                  value={slot.maxDailySlots || ""}
                                  onChange={(e) => updateSlot(idx, "maxDailySlots", parseInt(e.target.value) || 0)}
                                  className={inputBase}
                                  disabled={!canEdit}
                                />
                              </div>
                            </div>
                          ) : isEnabled ? (
                            <p className="text-xs text-slate-400">Loading…</p>
                          ) : (
                            <p className="text-xs text-slate-400 dark:text-[#444]">
                              Enable this day from <button className="underline hover:text-slate-600" onClick={() => setEditing(true)}>Edit Doctor</button>
                            </p>
                          )}
                        </div>

                        {/* Computed preview row */}
                        {isEnabled && slot?.startTime && slot?.endTime && slot?.slotDurationMins > 0 && (
                          <div className="px-5 pb-3">
                            <div className="flex items-center gap-4 px-3 py-2 bg-slate-50 dark:bg-[#161616] rounded-lg border border-slate-100 dark:border-[#222] text-[11px] text-slate-500 dark:text-[#666]">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {(() => {
                                  const [sh, sm] = slot.startTime.split(":").map(Number);
                                  const [eh, em] = slot.endTime.split(":").map(Number);
                                  const totalMins = (eh * 60 + em) - (sh * 60 + sm);
                                  if (totalMins <= 0) return "Invalid time range";
                                  const possible = Math.floor(totalMins / slot.slotDurationMins);
                                  const actual = Math.min(possible, slot.maxDailySlots || possible);
                                  const hrs = Math.floor(totalMins / 60);
                                  const mins = totalMins % 60;
                                  return `${hrs > 0 ? `${hrs}h ` : ""}${mins > 0 ? `${mins}m` : ""} window · ${possible} possible slots · ${actual} capped`;
                                })()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!scheduleLoading && Object.keys(scheduleSlots).length === 0 && (
                <div className="py-16 text-center">
                  <Clock className="w-10 h-10 text-slate-200 dark:text-[#282828] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">No Days Enabled</p>
                  <p className="text-xs text-slate-400 dark:text-[#444444] mt-1">
                    Use <button className="underline hover:text-slate-600" onClick={() => setEditing(true)}>Edit Doctor</button> to enable available days first.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {editing && (
        <DoctorFormModal
          editDoctor={doctor}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

export { DoctorDetails as default };
