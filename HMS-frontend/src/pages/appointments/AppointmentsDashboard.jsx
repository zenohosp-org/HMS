import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar as CalendarIcon, Filter, Plus, ChevronLeft, ChevronRight, MoreHorizontal, CheckCircle2, XCircle, AlertCircle, LogIn, Loader2, PlayCircle, BedDouble, HeartPulse } from "lucide-react";
import BookAppointmentModal from "@/components/modals/BookAppointmentModal";
import AdmitPatientModal from "@/pages/admin/AdmitPatientModal";
import Pagination from "@/components/ui/Pagination";
import { useAuth } from "@/context/AuthContext";
import { appointmentsApi, doctorsApi } from "@/utils/api";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, isSameDay, isSameMonth, parseISO, isToday } from "date-fns";
import { useNotification } from "@/context/NotificationContext";
const APPT_PAGE_SIZE = 10;
const TYPE_LABEL = {
  OPD: "Fresh Walk-in",
  FOLLOWUP: "Follow-up",
  EMERGENCY: "Emergency",
  TELECONSULT: "Teleconsult",
  HEALTH_CHECKUP: "Health Checkup",
};
const STATUS_STYLES = {
  SCHEDULED: "border border-blue-400 text-blue-500 bg-white dark:bg-transparent dark:border-blue-500/50 dark:text-blue-400",
  CONFIRMED: "border border-blue-400 text-blue-500 bg-white dark:bg-transparent dark:border-blue-500/50 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-500 text-white border-transparent",
  CHECKED_IN: "bg-amber-500 text-white border-transparent",
  COMPLETED: "bg-emerald-500 text-white border-transparent",
  CANCELLED: "border border-red-400 text-red-500 bg-white dark:bg-transparent dark:border-red-500/50 dark:text-red-400",
  NO_SHOW: "border border-red-400 text-red-500 bg-white dark:bg-transparent dark:border-red-500/50 dark:text-red-400"
};
const APPT_COLORS = [
  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  "bg-slate-100 text-slate-900 dark:text-white border-slate-200 dark:bg-slate-900/10 dark:text-slate-300 dark:border-slate-200/20",
  "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20"
];
const STATUS_TRANSITIONS = {
  SCHEDULED: [
    { status: "CONFIRMED", label: "Confirm", icon: "confirm", color: "text-slate-600 dark:text-slate-400" },
    { status: "CHECKED_IN", label: "Check In", icon: "checkin", color: "text-slate-600 dark:text-slate-400" },
    { status: "COMPLETED", label: "Mark Completed", icon: "complete", color: "text-slate-600 dark:text-slate-400" },
    { status: "CANCELLED", label: "Cancel", icon: "cancel", color: "text-slate-600 dark:text-slate-400" },
    { status: "NO_SHOW", label: "No Show", icon: "noshow", color: "text-slate-600 dark:text-slate-400" }
  ],
  CONFIRMED: [
    { status: "CHECKED_IN", label: "Check In", icon: "checkin", color: "text-slate-600 dark:text-slate-400" },
    { status: "COMPLETED", label: "Mark Completed", icon: "complete", color: "text-slate-600 dark:text-slate-400" },
    { status: "CANCELLED", label: "Cancel", icon: "cancel", color: "text-slate-600 dark:text-slate-400" },
    { status: "NO_SHOW", label: "No Show", icon: "noshow", color: "text-slate-600 dark:text-slate-400" }
  ],
  CHECKED_IN: [
    { status: "IN_PROGRESS", label: "Start Consultation", icon: "progress", color: "text-slate-600 dark:text-slate-400" },
    { status: "COMPLETED", label: "Mark Completed", icon: "complete", color: "text-slate-600 dark:text-slate-400" },
    { status: "CANCELLED", label: "Cancel", icon: "cancel", color: "text-slate-600 dark:text-slate-400" }
  ],
  IN_PROGRESS: [
    { status: "COMPLETED", label: "Mark Completed", icon: "complete", color: "text-slate-600 dark:text-slate-400" },
    { status: "CANCELLED", label: "Cancel", icon: "cancel", color: "text-slate-600 dark:text-slate-400" }
  ],
  COMPLETED: [],
  CANCELLED: [
    { status: "SCHEDULED", label: "Reschedule", icon: "reschedule", color: "text-slate-600 dark:text-slate-400" }
  ],
  NO_SHOW: [
    { status: "SCHEDULED", label: "Reschedule", icon: "reschedule", color: "text-slate-600 dark:text-slate-400" }
  ]
};
function ActionMenu({ appt, onUpdate, onAdmit, onViewPatientDetails }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const ref = useRef(null);
  const actions = STATUS_TRANSITIONS[appt.status] ?? [];
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setShowCancelReason(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAction = async (status) => {
    if (status === "CANCELLED") {
      setShowCancelReason(true);
      return;
    }
    setLoading(true);
    await onUpdate(String(appt.id), status);
    setLoading(false);
    setOpen(false);
  };
  const submitCancel = async () => {
    setLoading(true);
    await onUpdate(String(appt.id), "CANCELLED", cancelReason || void 0);
    setLoading(false);
    setOpen(false);
    setShowCancelReason(false);
    setCancelReason("");
  };
  const iconFor = (icon) => {
    if (icon === "complete") return <CheckCircle2 className="w-4 h-4 opacity-70" />;
    if (icon === "cancel") return <XCircle className="w-4 h-4 opacity-70" />;
    if (icon === "checkin") return <LogIn className="w-4 h-4 opacity-70" />;
    if (icon === "progress") return <PlayCircle className="w-4 h-4 opacity-70" />;
    if (icon === "noshow") return <AlertCircle className="w-4 h-4 opacity-70" />;
    if (icon === "reschedule") return <CalendarIcon className="w-4 h-4 opacity-70" />;
    return <CheckCircle2 className="w-4 h-4 opacity-70" />;
  };
  return <div className="relative" ref={ref}><button
    onClick={() => {
      setOpen(!open);
      setShowCancelReason(false);
    }}
    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
    disabled={loading}
  >{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}</button>{open && <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-lg z-30 overflow-hidden"><div className="px-4 py-3"><p className="text-sm font-bold text-slate-900 dark:text-white">Actions</p></div>{!showCancelReason ? <div className="py-1">{actions.map((action) => <button
    key={action.status}
    onClick={() => handleAction(action.status)}
    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors text-left ${action.color}`}
  >{iconFor(action.icon)}{action.label}</button>)}{actions.length > 0 && <div className="border-t border-slate-100 dark:border-[#2a2a2a]" />}<button
    onClick={() => { setOpen(false); onViewPatientDetails(); }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors text-left"
  ><HeartPulse className="w-4 h-4 opacity-70" />Patient Details</button>{(appt.status === "COMPLETED" || appt.status === "IN_PROGRESS") && <button
    onClick={() => { setOpen(false); onAdmit(); }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors text-left"
  ><BedDouble className="w-4 h-4 opacity-70" />Admit Patient</button>}</div> : <div className="p-3 space-y-2"><p className="text-xs font-semibold text-slate-700 dark:text-[#cccccc]">Cancellation Reason <span className="text-slate-400">(optional)</span></p><textarea
    value={cancelReason}
    onChange={(e) => setCancelReason(e.target.value)}
    rows={2}
    placeholder="Enter reason..."
    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] placeholder-slate-400 dark:placeholder-[#555555] outline-none resize-none focus:border-red-400 dark:focus:border-red-500/50"
    autoFocus
  /><div className="flex gap-2"><button
    onClick={() => {
      setShowCancelReason(false);
      setCancelReason("");
    }}
    className="btn-secondary flex-1 py-1.5 text-xs"
  >Back</button><button
    onClick={submitCancel}
    className="btn-primary flex-1 py-1.5 text-xs bg-red-500 hover:bg-red-600 border-transparent"
  >Confirm Cancel</button></div></div>}</div>}</div>;
}
function AppointmentsDashboard() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState("list");
  const [calendarView, setCalendarView] = useState("month");
  const [listFilter, setListFilter] = useState("all");
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [admitPrefill, setAdmitPrefill] = useState(null);
  const [apptPage, setApptPage] = useState(1);
  const [currentDate, setCurrentDate] = useState(/* @__PURE__ */ new Date());
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const loadData = async () => {
    if (!user?.hospitalId) return;
    setIsLoading(true);
    try {
      const [appts, docs] = await Promise.all([
        appointmentsApi.getByHospital(user.hospitalId),
        doctorsApi.list(user.hospitalId)
      ]);
      setAppointments(appts);
      setDoctors(docs);
      if (location.state?.filterMine && user.role === "doctor") {
        const doc = docs.find((d) => d.userId === user.userId);
        if (doc) {
          setSelectedDoctorId(doc.id);
        }
        navigate(location.pathname, { replace: true, state: {} });
      }
    } catch (err) {
      console.error(err);
      notify("Failed to load appointments", "error");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, [user]);
  const handleStatusUpdate = async (id, status, cancelledReason) => {
    const snapshot = appointments.find((a) => String(a.id) === id);
    setAppointments((prev) => prev.map((a) => String(a.id) === id ? { ...a, status } : a));
    try {
      await appointmentsApi.updateStatus(id, status, cancelledReason);
      notify(`Appointment marked as ${status.replace(/_/g, " ").toLowerCase()}`, "success");
    } catch (err) {
      if (snapshot) setAppointments((prev) => prev.map((a) => String(a.id) === id ? snapshot : a));
      notify(err?.response?.data?.message || "Failed to update status", "error");
    }
  };
  useEffect(() => {
    setApptPage(1);
  }, [listFilter, selectedDoctorId]);
  const filteredAppointments = useMemo(() => {
    let appts = appointments;
    if (selectedDoctorId !== "all") {
      appts = appts.filter((a) => a.doctorId === selectedDoctorId);
    }
    if (viewMode === "list") {
      const today = /* @__PURE__ */ new Date();
      switch (listFilter) {
        case "today":
          appts = appts.filter((a) => isSameDay(parseISO(a.apptDate), today));
          break;
        case "upcoming":
          appts = appts.filter((a) => parseISO(a.apptDate) > today || isSameDay(parseISO(a.apptDate), today) && a.status === "SCHEDULED");
          break;
        case "completed":
          appts = appts.filter((a) => a.status === "COMPLETED");
          break;
        case "cancelled":
          appts = appts.filter((a) => ["CANCELLED", "NO_SHOW"].includes(a.status));
          break;
      }
      appts = [...appts].sort((a, b) => (/* @__PURE__ */ new Date(`${b.apptDate}T${b.apptTime}`)).getTime() - (/* @__PURE__ */ new Date(`${a.apptDate}T${a.apptTime}`)).getTime());
    }
    return appts;
  }, [appointments, selectedDoctorId, viewMode, listFilter]);
  const nextPeriod = () => {
    if (calendarView === "day") setCurrentDate(addDays(currentDate, 1));
    if (calendarView === "week") setCurrentDate(addWeeks(currentDate, 1));
    if (calendarView === "month") setCurrentDate(addMonths(currentDate, 1));
  };
  const prevPeriod = () => {
    if (calendarView === "day") setCurrentDate(addDays(currentDate, -1));
    if (calendarView === "week") setCurrentDate(addWeeks(currentDate, -1));
    if (calendarView === "month") setCurrentDate(addMonths(currentDate, -1));
  };
  const goToday = () => setCurrentDate(/* @__PURE__ */ new Date());
  const renderHeaderTitle = () => {
    if (calendarView === "day") return format(currentDate, "MMMM d, yyyy");
    if (calendarView === "week") {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      if (isSameMonth(start, end)) return `${format(start, "MMMM d")} - ${format(end, "d, yyyy")}`;
      return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
    }
    if (calendarView === "month") return format(currentDate, "MMMM yyyy");
  };
  const getColorForDoctor = (doctorId) => {
    const index = doctors.findIndex((d) => d.id === doctorId);
    return APPT_COLORS[(index >= 0 ? index : 0) % APPT_COLORS.length];
  };
  const renderListView = () => <div className="bg-white dark:bg-[#111111] rounded-lg shadow-sm overflow-hidden flex flex-col flex-1"><div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#222222]"><h3 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">All Appointments</h3><div className="flex gap-2"><div className="relative"><select
    value={selectedDoctorId}
    onChange={(e) => setSelectedDoctorId(e.target.value)}
    className="appearance-none bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] text-slate-700 dark:text-slate-300 text-sm font-medium py-2 pl-4 pr-10 rounded-lg outline-none focus:ring-2 focus:ring-slate-300/50 transition-all cursor-pointer"
  ><option value="all">All Doctors</option>{doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}</select><Filter className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div></div></div><div className="flex flex-col flex-1 overflow-hidden"><div className="overflow-x-auto flex-1"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-[#0f0f0f]"><th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Patient</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Doctor</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Date &amp; Time</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Status</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Type</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">{filteredAppointments.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-500 dark:text-[#888888]"><CalendarIcon className="w-8 h-8 mx-auto mb-3 opacity-50" />
    No appointments found for the selected filters.
  </td></tr> : filteredAppointments.slice((apptPage - 1) * APPT_PAGE_SIZE, apptPage * APPT_PAGE_SIZE).map((appt) => <tr key={appt.id} className="hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-colors group"><td className="py-3 px-5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-sm shrink-0">{appt.patientName.charAt(0)}</div><div><p className="font-semibold text-sm text-slate-900 dark:text-white">{appt.patientName}</p>{appt.checkupBookingId && <button onClick={() => navigate(`/checkups/bookings/${appt.checkupBookingId}`)} className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"><HeartPulse className="w-3 h-3" />{appt.checkupBookingNumber}</button>}</div></div></td><td className="py-3 px-5 text-sm text-slate-600 dark:text-[#cccccc]">
    Dr. {appt.doctorName}</td><td className="py-3 px-5"><p className="text-sm font-medium text-slate-900 dark:text-white">{format(parseISO(appt.apptDate), "yyyy-MM-dd")}</p><p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">{appt.apptTime.substring(0, 5)} {parseISO(`1970-01-01T${appt.apptTime}`).getHours() >= 12 ? "PM" : "AM"}</p></td><td className="py-3 px-5"><span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${STATUS_STYLES[appt.status] || ""}`}>{appt.status.replace(/_/g, " ")}</span></td><td className="py-3 px-5 text-sm text-slate-600 dark:text-[#cccccc]">{TYPE_LABEL[appt.type] ?? appt.type}</td><td className="py-3 px-5"><div className="flex items-center gap-2"><ActionMenu appt={appt} onUpdate={handleStatusUpdate} onAdmit={() => setAdmitPrefill({ patient: { id: appt.patientId, firstName: appt.patientFirstName || appt.patientName?.split(" ")[0], lastName: appt.patientLastName || appt.patientName?.split(" ").slice(1).join(" "), mrn: appt.patientMrn }, doctorId: appt.doctorId, chiefComplaint: appt.chiefComplaint, source: "OPD_REFERRAL", appointmentId: appt.id })} onViewPatientDetails={() => navigate(`/patients/${appt.patientId}`)} /></div></td></tr>)}</tbody></table></div><div className="px-5 pb-4"><Pagination
      currentPage={apptPage}
      totalPages={Math.ceil(filteredAppointments.length / APPT_PAGE_SIZE)}
      totalItems={filteredAppointments.length}
      pageSize={APPT_PAGE_SIZE}
      onPageChange={setApptPage}
    /></div></div></div>;
  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    return <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#0a0a0a] rounded-lg border border-slate-200 dark:border-[#222222] overflow-hidden"><div className="grid grid-cols-7 border-b border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111]">{days.map((day) => <div key={day.toISOString()} className="py-3 px-4 text-center border-r last:border-0 border-slate-200 dark:border-[#222222]"><p className="text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider">{format(day, "EEE")}</p><p className="text-xl font-bold text-slate-800 dark:text-white mt-1">{format(day, "d")}</p></div>)}</div><div className="grid grid-cols-7 flex-1 divide-x divide-slate-200 dark:divide-[#222222] bg-white dark:bg-[#0f0f0f]">{days.map((day) => {
      const dayAppts = filteredAppointments.filter((a) => isSameDay(parseISO(a.apptDate), day)).sort((a, b) => a.apptTime.localeCompare(b.apptTime));
      return <div key={day.toISOString()} className={`p-2 h-[600px] overflow-y-auto w-full ${isToday(day) ? "bg-emerald-50/30 dark:bg-emerald-900/10" : ""}`}>{dayAppts.length === 0 ? <div className="h-full flex items-center justify-center"><p className="text-xs text-slate-400 dark:text-[#666666] font-medium">No appointments</p></div> : <div className="space-y-2">{dayAppts.map((appt) => {
        const colors = getColorForDoctor(appt.doctorId);
        return <div key={appt.id} className={`p-3 rounded-lg border flex flex-col gap-1 transition-all hover:-translate-y-0.5 hover:shadow-sm ${colors}`}><div className="flex items-start justify-between"><p className="font-bold text-sm tracking-tight truncate flex-1">{appt.patientName}</p><span className="text-xs font-semibold opacity-70 shrink-0 ml-2">{appt.apptTime.substring(0, 5)}</span></div><p className="text-xs font-medium opacity-80">{TYPE_LABEL[appt.type] ?? appt.type}</p><p className="text-xs opacity-75 truncate mt-1">Dr. {appt.doctorName}</p></div>;
      })}</div>}</div>;
    })}</div></div>;
  };
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const rows = [];
    let days = [];
    let day = startDate;
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const dayAppts = filteredAppointments.filter((a) => isSameDay(parseISO(a.apptDate), cloneDay)).sort((a, b) => a.apptTime.localeCompare(b.apptTime));
        days.push(
          <div
            key={day.toISOString()}
            className={`min-h-[120px] p-2 border-r border-b border-slate-200 dark:border-[#222222] ${!isSameMonth(day, monthStart) ? "bg-slate-50/50 dark:bg-[#0a0a0a] text-slate-600 dark:text-[#999999]" : "bg-white dark:bg-[#111111] text-slate-800 dark:text-[#cccccc]"} ${isToday(day) ? "bg-emerald-50/30 dark:bg-emerald-900/10" : ""}`}
          ><div className="flex justify-between items-center mb-1.5 px-1">{isToday(day) ? <span className="bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold leading-none">{format(day, "d")}</span> : <span className={`text-sm font-semibold ${!isSameMonth(day, monthStart) ? "opacity-50" : ""}`}>{format(day, "d")}</span>}</div><div className="space-y-1 mt-2">{dayAppts.slice(0, 3).map((appt) => {
            const colors = getColorForDoctor(appt.doctorId);
            return <div key={appt.id} className={`px-2 py-1.5 rounded-lg text-xs truncate border ${colors}`}><span className="font-semibold opacity-90 mr-1">{appt.apptTime.substring(0, 5)}</span><span className="font-medium tracking-tight truncate">{appt.patientName}</span></div>;
          })}{dayAppts.length > 3 && <div className="text-xs font-semibold text-slate-500 dark:text-[#888888] px-1 pt-1 ml-1 cursor-pointer hover:text-emerald-500 transition-colors">
            + {dayAppts.length - 3} more
          </div>}</div></div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7" key={day.toISOString()}>{days}</div>);
      days = [];
    }
    return <div className="flex-1 flex flex-col bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] overflow-hidden"><div className="grid grid-cols-7 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0a0a0a]">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 dark:text-[#888888] uppercase tracking-wider border-r last:border-0 border-slate-200 dark:border-[#222222]">{d}</div>)}</div><div className="flex-1 overflow-y-auto minimal-scrollbar">{rows}</div></div>;
  };
  return <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505]">{
    /* Header */
  }<header className="flex-none py-5 bg-white dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222]"><div className="flex items-center justify-between mb-0"><div><h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-400 tracking-tight">{viewMode === "calendar" ? "Appointment Calendar" : "Appointments"}</h1><p className="text-sm text-slate-500 dark:text-[#888888] mt-1 font-medium">{viewMode === "calendar" ? "View and manage appointments in calendar view." : "Manage your clinic's appointments and schedules."}</p></div><div className="flex items-center gap-3"><button
    onClick={() => setViewMode(viewMode === "list" ? "calendar" : "list")}
    className="btn-secondary"
  ><CalendarIcon className="w-4 h-4" />{viewMode === "list" ? "Calendar View" : "List View"}</button><button
    onClick={() => setIsBookingModalOpen(true)}
    className="btn-primary"
  ><Plus className="w-4 h-4" />
      New Appointment
    </button></div></div>{viewMode === "list" && <div className="flex gap-2 mt-6 overflow-x-auto minimal-scrollbar pb-1">{["all", "upcoming", "today", "completed", "cancelled"].map((f) => <button
      key={f}
      onClick={() => setListFilter(f)}
      className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-all ${listFilter === f ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-md" : "text-slate-600 dark:text-[#888888] hover:bg-slate-100 dark:hover:bg-[#222222]"}`}
    >{f === "all" ? "All Appointments" : f}</button>)}</div>}</header>{
      /* Content Area */
    }<div className="flex-1 overflow-hidden flex flex-col gap-6">{viewMode === "calendar" && <div className="flex items-center justify-between pb-2"><div className="flex items-center bg-white dark:bg-[#111111] rounded-lg p-1 shadow-sm border border-slate-200 dark:border-[#333333]">{["day", "week", "month"].map((v) => <button
      key={v}
      onClick={() => setCalendarView(v)}
      className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${calendarView === v ? "bg-white dark:bg-white dark:text-slate-950 text-slate-950 shadow-md" : "text-slate-500 dark:text-[#888888] hover:text-slate-700 dark:hover:text-[#cccccc]"}`}
    >{v}</button>)}</div><div className="flex items-center gap-4"><select
      value={selectedDoctorId}
      onChange={(e) => setSelectedDoctorId(e.target.value)}
      className="appearance-none bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] text-slate-700 dark:text-[#cccccc] text-sm font-semibold py-2 pl-4 pr-10 rounded-lg outline-none focus:ring-2 focus:ring-slate-300/50 transition-all cursor-pointer shadow-sm"
    ><option value="all">All Doctors</option>{doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}</select><div className="flex items-center gap-2"><button onClick={goToday} className="btn-secondary py-2">Today</button><div className="flex items-center bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] rounded-lg p-0.5 shadow-sm"><button onClick={prevPeriod} className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button><button onClick={nextPeriod} className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button></div></div><h2 className="text-lg font-bold text-slate-800 dark:text-white min-w-[200px] text-right">{renderHeaderTitle()}</h2></div></div>}{isLoading ? <div className="flex-1 flex items-center justify-center"><div className="animate-pulse flex flex-col items-center gap-4"><div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-[#222222] border-t-slate-900 dark:border-t-white animate-spin" /><p className="text-sm font-semibold text-slate-500 dark:text-[#666666]">Loading appointments...</p></div></div> : viewMode === "list" ? renderListView() : calendarView === "month" ? renderMonthView() : calendarView === "week" ? renderWeekView() : <div className="flex-1 flex flex-col bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] overflow-hidden"><div className="border-b border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-[#0a0a0a] p-4"><h3 className="text-lg font-bold text-slate-800 dark:text-white">{format(currentDate, "EEEE, MMMM do, yyyy")}</h3></div><div className="p-4 space-y-3 overflow-y-auto flex-1">{filteredAppointments.filter((a) => isSameDay(parseISO(a.apptDate), currentDate)).length === 0 ? <div className="py-12 text-center text-slate-500 dark:text-[#888888]">No appointments for today.</div> : filteredAppointments.filter((a) => isSameDay(parseISO(a.apptDate), currentDate)).sort((a, b) => a.apptTime.localeCompare(b.apptTime)).map((appt) => {
      const colors = getColorForDoctor(appt.doctorId);
      return <div key={appt.id} className={`p-4 rounded-lg border flex items-center gap-4 ${colors}`}><div className="w-16 text-center shrink-0"><p className="font-bold text-lg leading-none">{appt.apptTime.substring(0, 5)}</p><p className="text-[10px] uppercase font-bold opacity-70 mt-1">{parseISO(`1970-01-01T${appt.apptTime}`).getHours() >= 12 ? "PM" : "AM"}</p></div><div className="w-px h-10 bg-current opacity-20" /><div className="flex-1"><p className="font-bold text-lg">{appt.patientName}</p><p className="text-sm font-medium opacity-80 mt-0.5">{TYPE_LABEL[appt.type] ?? appt.type} &middot; Dr. {appt.doctorName}</p></div><div className={`px-3 py-1 text-xs font-bold rounded uppercase ${STATUS_STYLES[appt.status] || ""}`}>{appt.status.replace("_", " ")}</div></div>;
    })}</div></div>}</div><BookAppointmentModal
      isOpen={isBookingModalOpen}
      onClose={() => setIsBookingModalOpen(false)}
      onSuccess={() => {
        setIsBookingModalOpen(false);
        loadData();
      }}
    />{admitPrefill && <AdmitPatientModal prefill={admitPrefill} onClose={() => setAdmitPrefill(null)} onAdmitted={() => { setAdmitPrefill(null); }} />}</div>;
}
export {
  AppointmentsDashboard as default
};
