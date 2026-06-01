import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar as CalendarIcon, Filter, Plus, ChevronLeft, ChevronRight, MoreHorizontal, CheckCircle2, XCircle, AlertCircle, LogIn, Loader2, PlayCircle, BedDouble, HeartPulse, Search, RefreshCw, Stethoscope, Activity, FlaskConical, Printer } from "lucide-react";
import ConsultationModal from "@/components/modals/ConsultationModal";
import VitalsModal from "@/components/modals/VitalsModal";
import ExternalResultsModal from "@/components/modals/ExternalResultsModal";

// Re-open the consultation modal from these states. COMPLETED is gone —
// once the doctor clicks Mark Complete in the consultation view the
// record is finalised and the row should be a print-only artifact, not
// a place to re-edit. BILLED is gone for the same reason.
const CONSULT_OPEN_ELIGIBLE = new Set(["CHECKED_IN", "IN_PROGRESS"]);
// After Mark Complete, the row exposes a print action so reception can
// hand the patient their consultation + Rx + lab summary.
const PRINT_ELIGIBLE = new Set(["COMPLETED", "BILLED"]);
// Vitals are recorded by the nurse before the doctor takes over, so the
// action surfaces from CHECKED_IN onward. Allow editing through IN_PROGRESS
// (re-takes happen) but drop it for COMPLETED — once the consult is done
// vitals are part of the historical record, not editable from the queue.
const VITALS_ELIGIBLE = new Set(["CHECKED_IN", "IN_PROGRESS"]);
// Outside-clinic lab reports the patient walked in with. Front-desk /
// nursing flow, captured at the same window as vitals so the doctor's
// consultation page lands with everything pre-filled.
const EXTERNAL_RESULTS_ELIGIBLE = new Set(["CHECKED_IN", "IN_PROGRESS"]);
import SearchableSelect from "@/components/ui/SearchableSelect";
import BookAppointmentModal from "@/components/modals/BookAppointmentModal";
import AdmitPatientModal from "@/pages/admin/AdmitPatientModal";
import Pagination from "@/components/ui/Pagination";
import { useAuth } from "@/context/AuthContext";
import { appointmentsApi, doctorsApi, consultationDraftsApi, vitalsApi } from "@/utils/api";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, isSameDay, isSameMonth, parseISO, isToday } from "date-fns";
import { useNotification } from "@/context/NotificationContext";
const APPT_PAGE_SIZE = 30;
const TYPE_LABEL = {
  OPD: "Fresh Walk-in",
  FOLLOWUP: "Follow-up",
  EMERGENCY: "Emergency",
  TELECONSULT: "Teleconsult",
  HEALTH_CHECKUP: "Health Checkup",
};
const STATUS_STYLES = {
  SCHEDULED: "border border-blue-400 text-blue-500 bg-white",
  CONFIRMED: "border border-blue-400 text-blue-500 bg-white",
  IN_PROGRESS: "bg-amber-500 text-white border-transparent",
  CHECKED_IN: "bg-amber-500 text-white border-transparent",
  COMPLETED: "bg-emerald-500 text-white border-transparent",
  CANCELLED: "border border-red-400 text-red-500 bg-white",
  NO_SHOW: "border border-red-400 text-red-500 bg-white"
};
const APPT_COLORS = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-slate-100 text-slate-900 border-slate-200",
  "bg-rose-50 text-rose-700 border-rose-200"
];
const STATUS_TRANSITIONS = {
  SCHEDULED: [
    { status: "CONFIRMED", label: "Confirm", icon: "confirm", color: "text-slate-600" },
    { status: "CHECKED_IN", label: "Check In", icon: "checkin", color: "text-slate-600" },
    { status: "COMPLETED", label: "Mark Completed", icon: "complete", color: "text-slate-600" },
    { status: "CANCELLED", label: "Cancel", icon: "cancel", color: "text-slate-600" },
    { status: "NO_SHOW", label: "No Show", icon: "noshow", color: "text-slate-600" }
  ],
  CONFIRMED: [
    { status: "CHECKED_IN", label: "Check In", icon: "checkin", color: "text-slate-600" },
    { status: "COMPLETED", label: "Mark Completed", icon: "complete", color: "text-slate-600" },
    { status: "CANCELLED", label: "Cancel", icon: "cancel", color: "text-slate-600" },
    { status: "NO_SHOW", label: "No Show", icon: "noshow", color: "text-slate-600" }
  ],
  CHECKED_IN: [
    { status: "IN_PROGRESS", label: "Start Consultation", icon: "progress", color: "text-slate-600" },
    { status: "COMPLETED", label: "Mark Completed", icon: "complete", color: "text-slate-600" },
    { status: "CANCELLED", label: "Cancel", icon: "cancel", color: "text-slate-600" }
  ],
  IN_PROGRESS: [
    { status: "COMPLETED", label: "Mark Completed", icon: "complete", color: "text-slate-600" },
    { status: "CANCELLED", label: "Cancel", icon: "cancel", color: "text-slate-600" }
  ],
  COMPLETED: [],
  CANCELLED: [
    { status: "SCHEDULED", label: "Reschedule", icon: "reschedule", color: "text-slate-600" }
  ],
  NO_SHOW: [
    { status: "SCHEDULED", label: "Reschedule", icon: "reschedule", color: "text-slate-600" }
  ]
};
function ActionMenu({ appt, onUpdate, onAdmit, onViewPatientDetails, onOpenConsultation, onRecordVitals, onAddExternalResults, onPrintConsultation, hasDraft, hasVitals }) {
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
    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
    disabled={loading}
  >{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}</button>{open && <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden"><div className="px-4 py-3"><p className="text-sm font-bold text-slate-900">Actions</p></div>{!showCancelReason ? <div className="py-1">{actions.map((action) => <button
    key={action.status}
    onClick={() => handleAction(action.status)}
    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors text-left ${action.color}`}
  >{iconFor(action.icon)}{action.label}</button>)}{actions.length > 0 && <div className="border-t border-slate-100" />}<button
    onClick={() => { setOpen(false); onViewPatientDetails(); }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
  ><HeartPulse className="w-4 h-4 opacity-70" />Patient Details</button>{VITALS_ELIGIBLE.has(appt.status) && <button
    onClick={() => { setOpen(false); onRecordVitals(); }}
    className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors text-left"
  ><span className="flex items-center gap-2.5"><Activity className="w-4 h-4 opacity-70" />{hasVitals ? "Edit Vitals" : "Record Vitals"}</span>{hasVitals && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">DONE</span>}</button>}{EXTERNAL_RESULTS_ELIGIBLE.has(appt.status) && <button
    onClick={() => { setOpen(false); onAddExternalResults(); }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50 transition-colors text-left"
  ><FlaskConical className="w-4 h-4 opacity-70" />Add Lab Reports</button>}{CONSULT_OPEN_ELIGIBLE.has(appt.status) && <button
    onClick={() => { setOpen(false); onOpenConsultation(); }}
    className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors text-left"
  ><span className="flex items-center gap-2.5"><Stethoscope className="w-4 h-4 opacity-70" />{hasDraft ? "Resume Consultation" : "Open Consultation"}</span>{hasDraft && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">DRAFT</span>}</button>}{PRINT_ELIGIBLE.has(appt.status) && <button
    onClick={() => { setOpen(false); onPrintConsultation(); }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
  ><Printer className="w-4 h-4 opacity-70" />Print Consultation</button>}{(appt.status === "COMPLETED" || appt.status === "IN_PROGRESS") && <button
    onClick={() => { setOpen(false); onAdmit(); }}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50 transition-colors text-left"
  ><BedDouble className="w-4 h-4 opacity-70" />Admit Patient</button>}</div> : <div className="p-3 space-y-2"><p className="text-xs font-semibold text-slate-700">Cancellation Reason <span className="text-slate-400">(optional)</span></p><textarea
    value={cancelReason}
    onChange={(e) => setCancelReason(e.target.value)}
    rows={2}
    placeholder="Enter reason..."
    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 outline-none resize-none focus:border-red-400"
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
  // Holds the full appointment row whose check-in just triggered the
  // consultation modal. Cleared on save / cancel.
  const [consultationAppointment, setConsultationAppointment] = useState(null);
  // Same shape — drives the VitalsModal. Separate state so a nurse can
  // open vitals on one row while another row's consult is open.
  const [vitalsAppointment, setVitalsAppointment] = useState(null);
  // Front-desk capture of outside-clinic lab reports — same trigger
  // window as vitals so reception/nursing can do both at check-in.
  const [externalResultsAppointment, setExternalResultsAppointment] = useState(null);
  // Set<appointmentId> with an in-flight consultation draft on the server.
  // Drives the "DRAFT" badge + "Resume Consultation" label in the row menu.
  const [draftAppointmentIds, setDraftAppointmentIds] = useState(() => new Set());
  // Set<appointmentId> for rows that already have vitals recorded — drives
  // the "DONE" badge so reception sees at a glance who's been triaged.
  const [vitalsAppointmentIds, setVitalsAppointmentIds] = useState(() => new Set());
  const [apptPage, setApptPage] = useState(1);
  const [currentDate, setCurrentDate] = useState(/* @__PURE__ */ new Date());
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setApptPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const refreshDraftSet = async () => {
    if (!user?.hospitalId) return;
    try {
      const drafts = await consultationDraftsApi.listForHospital(user.hospitalId);
      setDraftAppointmentIds(new Set((drafts || []).map(d => d.appointmentId)));
    } catch {
      // Non-fatal — the modal still works without the badge.
    }
  };

  const refreshVitalsSet = async () => {
    if (!user?.hospitalId) return;
    try {
      const rows = await vitalsApi.listForHospital(user.hospitalId);
      setVitalsAppointmentIds(new Set((rows || []).map(v => v.appointmentId)));
    } catch {
      // Non-fatal — the action still works without the badge.
    }
  };

  const loadData = async () => {
    if (!user?.hospitalId) return;
    refreshDraftSet();
    refreshVitalsSet();
    setIsLoading(true);
    try {
      if (viewMode === "list") {
        const params = {
          page: apptPage - 1,
          size: APPT_PAGE_SIZE,
          dateFilter: listFilter.toUpperCase(),
          search: debouncedSearch,
        };
        if (selectedDoctorId !== "all") {
          params.doctorId = selectedDoctorId;
        }
        const [res, docs] = await Promise.all([
          appointmentsApi.listPaginated(user.hospitalId, params),
          doctors.length === 0 ? doctorsApi.list(user.hospitalId) : Promise.resolve(doctors)
        ]);
        setAppointments(res.content || []);
        setTotalItems(res.totalElements || 0);
        setTotalPages(res.totalPages || 0);
        if (doctors.length === 0) {
          setDoctors(docs.filter(d => d.userIsActive));
        }
      } else {
        const [appts, docs] = await Promise.all([
          appointmentsApi.getByHospital(user.hospitalId),
          doctors.length === 0 ? doctorsApi.list(user.hospitalId) : Promise.resolve(doctors)
        ]);
        setAppointments(appts);
        if (doctors.length === 0) {
          setDoctors(docs.filter(d => d.userIsActive));
        }
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
  }, [user?.hospitalId, viewMode, apptPage, listFilter, selectedDoctorId, debouncedSearch]);

  useEffect(() => {
    if (location.state?.filterMine && user?.role === "doctor" && doctors.length > 0) {
      const doc = doctors.find((d) => d.userId === user.userId);
      if (doc) {
        setSelectedDoctorId(doc.id);
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [doctors, user, location]);
  const handleStatusUpdate = async (id, status, cancelledReason) => {
    const snapshot = appointments.find((a) => String(a.id) === id);
    setAppointments((prev) => prev.map((a) => String(a.id) === id ? { ...a, status } : a));

    // Open the consultation modal optimistically — the moment the doctor
    // clicks Start Consultation. We don't wait on the network so a slow
    // update can't silently swallow the auto-open. If the backend rejects
    // the transition we close it again in the catch below.
    //
    // Only IN_PROGRESS now: CHECKED_IN is the nurse's window for recording
    // vitals; popping the doctor's consult page during triage would block
    // the nurse from finishing.
    const shouldOpenConsult = status === "IN_PROGRESS" && !!snapshot;
    if (shouldOpenConsult) {
      setConsultationAppointment({ ...snapshot, status });
    }

    try {
      const updated = await appointmentsApi.updateStatus(id, status, cancelledReason);
      notify(`Appointment marked as ${status.replace(/_/g, " ").toLowerCase()}`, "success");
      // Swap in the server's authoritative DTO so any derived fields are fresh.
      if (shouldOpenConsult && updated) {
        setConsultationAppointment((cur) => cur ? { ...updated } : cur);
      }
      loadData();
    } catch (err) {
      if (snapshot) setAppointments((prev) => prev.map((a) => String(a.id) === id ? snapshot : a));
      if (shouldOpenConsult) setConsultationAppointment(null);
      notify(err?.response?.data?.message || "Failed to update status", "error");
    }
  };

  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const handleRefreshTokens = async () => {
    if (!user?.hospitalId) return;
    const ok = window.confirm(
      "Refresh today's tokens?\n\nThis will renumber all of today's confirmed-and-later appointments starting from 1, in booking-time order. SCHEDULED, CANCELLED and NO_SHOW rows lose their token."
    );
    if (!ok) return;
    setIsRefreshingTokens(true);
    try {
      const res = await appointmentsApi.refreshTokens(user.hospitalId);
      notify(`Renumbered ${res?.assigned ?? 0} appointment${res?.assigned === 1 ? "" : "s"} from 1`, "success");
      loadData();
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to refresh tokens", "error");
    } finally {
      setIsRefreshingTokens(false);
    }
  };
  useEffect(() => {
    setApptPage(1);
  }, [listFilter, selectedDoctorId]);

  const filteredAppointments = useMemo(() => {
    let appts = appointments;
    if (viewMode === "calendar") {
      if (selectedDoctorId !== "all") {
        appts = appts.filter((a) => a.doctorId === selectedDoctorId);
      }
    }
    return appts;
  }, [appointments, selectedDoctorId, viewMode]);
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
  const renderListView = () => <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col flex-1"><div className="flex items-center justify-between p-5 border-b border-slate-200"><h3 className="text-xl font-bold tracking-tight text-slate-800">All Appointments</h3><div className="flex gap-3 items-center w-full max-w-lg justify-end"><div className="relative flex-1 max-w-xs"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" /><input
    type="text"
    placeholder="Search patient, UHID, doctor..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300/50 transition-all"
  /></div><SearchableSelect
    value={selectedDoctorId}
    onChange={(value) => setSelectedDoctorId(value)}
    options={[{ value: "all", label: "All Doctors" }, ...doctors.map((d) => ({ value: d.id, label: `Dr. ${d.firstName} ${d.lastName}` }))]}
    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium py-2 pl-4 pr-10 rounded-lg outline-none focus:ring-2 focus:ring-slate-300/50 transition-all cursor-pointer"
  /></div></div><div className="flex flex-col flex-1 overflow-hidden"><div className="overflow-x-auto flex-1"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-200 bg-slate-50/50"><th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Token</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Doctor</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date &amp; Time</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th><th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredAppointments.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-slate-500"><CalendarIcon className="w-8 h-8 mx-auto mb-3 opacity-50" />
    No appointments found for the selected filters.
  </td></tr> : filteredAppointments.map((appt) => <tr key={appt.id} className="hover:bg-slate-50/50 transition-colors group"><td className="py-3 px-5">{appt.tokenNumber != null ? <span className="inline-flex items-center justify-center min-w-[2.25rem] h-7 px-2 rounded-md bg-slate-900 text-white text-xs font-bold tabular-nums">#{appt.tokenNumber}</span> : <span className="text-xs text-slate-300">—</span>}</td><td className="py-3 px-5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">{appt.patientName.charAt(0)}</div><div><p className="font-semibold text-sm text-slate-900">{appt.patientName}</p>{appt.checkupBookingId && <button onClick={() => navigate(`/checkups/bookings/${appt.checkupBookingId}`)} className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"><HeartPulse className="w-3 h-3" />{appt.checkupBookingNumber}</button>}</div></div></td><td className="py-3 px-5 text-sm text-slate-600">
    Dr. {appt.doctorName}</td><td className="py-3 px-5"><p className="text-sm font-medium text-slate-900">{format(parseISO(appt.apptDate), "yyyy-MM-dd")}</p><p className="text-xs text-slate-500 mt-0.5">{appt.apptTime.substring(0, 5)} {parseISO(`1970-01-01T${appt.apptTime}`).getHours() >= 12 ? "PM" : "AM"}</p></td><td className="py-3 px-5"><span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${STATUS_STYLES[appt.status] || ""}`}>{appt.status.replace(/_/g, " ")}</span></td><td className="py-3 px-5 text-sm text-slate-600">{TYPE_LABEL[appt.type] ?? appt.type}</td><td className="py-3 px-5"><div className="flex items-center gap-2"><ActionMenu
    appt={appt}
    onUpdate={handleStatusUpdate}
    onAdmit={() => setAdmitPrefill({ patient: { id: appt.patientId, firstName: appt.patientFirstName || appt.patientName?.split(" ")[0], lastName: appt.patientLastName || appt.patientName?.split(" ").slice(1).join(" "), uhid: appt.patientUhid }, doctorId: appt.doctorId, chiefComplaint: appt.chiefComplaint, source: "OPD_REFERRAL", appointmentId: appt.id })}
    onViewPatientDetails={() => navigate(`/patients/${appt.patientId}`)}
    onOpenConsultation={() => setConsultationAppointment(appt)}
    onRecordVitals={() => setVitalsAppointment(appt)}
    onAddExternalResults={() => setExternalResultsAppointment(appt)}
    onPrintConsultation={() => window.open(`/print/appointment/${appt.id}`, "_blank", "noopener,noreferrer")}
    hasDraft={draftAppointmentIds.has(String(appt.id))}
    hasVitals={vitalsAppointmentIds.has(String(appt.id))}
  /></div></td></tr>)}</tbody></table></div><div className="px-5 pb-4"><Pagination
      currentPage={apptPage}
      totalPages={totalPages}
      totalItems={totalItems}
      pageSize={APPT_PAGE_SIZE}
      onPageChange={setApptPage}
    /></div></div></div>;
  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    return <div className="flex-1 flex flex-col bg-slate-50 rounded-lg border border-slate-200 overflow-hidden"><div className="grid grid-cols-7 border-b border-slate-200 bg-white">{days.map((day) => <div key={day.toISOString()} className="py-3 px-4 text-center border-r last:border-0 border-slate-200"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{format(day, "EEE")}</p><p className="text-xl font-bold text-slate-800 mt-1">{format(day, "d")}</p></div>)}</div><div className="grid grid-cols-7 flex-1 divide-x divide-slate-200 bg-white">{days.map((day) => {
      const dayAppts = filteredAppointments.filter((a) => isSameDay(parseISO(a.apptDate), day)).sort((a, b) => a.apptTime.localeCompare(b.apptTime));
      return <div key={day.toISOString()} className={`p-2 h-[600px] overflow-y-auto w-full ${isToday(day) ? "bg-emerald-50/30" : ""}`}>{dayAppts.length === 0 ? <div className="h-full flex items-center justify-center"><p className="text-xs text-slate-400 font-medium">No appointments</p></div> : <div className="space-y-2">{dayAppts.map((appt) => {
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
            className={`min-h-[120px] p-2 border-r border-b border-slate-200 ${!isSameMonth(day, monthStart) ? "bg-slate-50/50 text-slate-600" : "bg-white text-slate-800"} ${isToday(day) ? "bg-emerald-50/30" : ""}`}
          ><div className="flex justify-between items-center mb-1.5 px-1">{isToday(day) ? <span className="bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold leading-none">{format(day, "d")}</span> : <span className={`text-sm font-semibold ${!isSameMonth(day, monthStart) ? "opacity-50" : ""}`}>{format(day, "d")}</span>}</div><div className="space-y-1 mt-2">{dayAppts.slice(0, 3).map((appt) => {
            const colors = getColorForDoctor(appt.doctorId);
            return <div key={appt.id} className={`px-2 py-1.5 rounded-lg text-xs truncate border ${colors}`}><span className="font-semibold opacity-90 mr-1">{appt.apptTime.substring(0, 5)}</span><span className="font-medium tracking-tight truncate">{appt.patientName}</span></div>;
          })}{dayAppts.length > 3 && <div className="text-xs font-semibold text-slate-500 px-1 pt-1 ml-1 cursor-pointer hover:text-emerald-500 transition-colors">
            + {dayAppts.length - 3} more
          </div>}</div></div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7" key={day.toISOString()}>{days}</div>);
      days = [];
    }
    return <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden"><div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider border-r last:border-0 border-slate-200">{d}</div>)}</div><div className="flex-1 overflow-y-auto minimal-scrollbar">{rows}</div></div>;
  };
  return <div className="flex flex-col h-full bg-slate-50">{
    /* Header */
  }<header className="flex-none py-5 bg-white border-b border-slate-200"><div className="flex items-center justify-between mb-0"><div><h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">{viewMode === "calendar" ? "Appointment Calendar" : "Appointments"}</h1><p className="text-sm text-slate-500 mt-1 font-medium">{viewMode === "calendar" ? "View and manage appointments in calendar view." : "Manage your clinic's appointments and schedules."}</p></div><div className="flex items-center gap-3"><button
    onClick={() => setViewMode(viewMode === "list" ? "calendar" : "list")}
    className="btn-secondary"
  ><CalendarIcon className="w-4 h-4" />{viewMode === "list" ? "Calendar View" : "List View"}</button><button
    onClick={() => navigate("/consultation-view")}
    className="btn-secondary"
    title="Walk through today's queue patient-by-patient"
  ><Stethoscope className="w-4 h-4" />Consultation View</button><button
    onClick={() => setIsBookingModalOpen(true)}
    className="btn-primary"
  ><Plus className="w-4 h-4" />
      New Appointment
    </button></div></div>{viewMode === "list" && <div className="flex items-center justify-between gap-2 mt-6 pb-1"><div className="flex gap-2 overflow-x-auto minimal-scrollbar">{["all", "upcoming", "today", "completed", "cancelled"].map((f) => <button
      key={f}
      onClick={() => setListFilter(f)}
      className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-all ${listFilter === f ? "bg-slate-950 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"}`}
    >{f === "all" ? "All Appointments" : f}</button>)}</div>{listFilter === "today" && <button
      onClick={handleRefreshTokens}
      disabled={isRefreshingTokens}
      title="Renumber today's tokens starting from 1, in booking order"
      className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >{isRefreshingTokens ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}<span>Refresh Tokens</span></button>}</div>}</header>{
      /* Content Area */
    }<div className="flex-1 overflow-hidden flex flex-col gap-6">{viewMode === "calendar" && <div className="flex items-center justify-between pb-2"><div className="flex items-center bg-white rounded-lg p-1 shadow-sm border border-slate-200">{["day", "week", "month"].map((v) => <button
      key={v}
      onClick={() => setCalendarView(v)}
      className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${calendarView === v ? "bg-white text-slate-950 shadow-md" : "text-slate-500 hover:text-slate-700"}`}
    >{v}</button>)}</div><div className="flex items-center gap-4"><SearchableSelect
      value={selectedDoctorId}
      onChange={(value) => setSelectedDoctorId(value)}
      options={[{ value: "all", label: "All Doctors" }, ...doctors.map((d) => ({ value: d.id, label: `Dr. ${d.firstName} ${d.lastName}` }))]}
      className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-semibold py-2 pl-4 pr-10 rounded-lg outline-none focus:ring-2 focus:ring-slate-300/50 transition-all cursor-pointer shadow-sm"
    /><div className="flex items-center gap-2"><button onClick={goToday} className="btn-secondary py-2">Today</button><div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm"><button onClick={prevPeriod} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button><button onClick={nextPeriod} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button></div></div><h2 className="text-lg font-bold text-slate-800 min-w-[200px] text-right">{renderHeaderTitle()}</h2></div></div>}{isLoading ? <div className="flex-1 flex items-center justify-center"><div className="animate-pulse flex flex-col items-center gap-4"><div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" /><p className="text-sm font-semibold text-slate-500">Loading appointments...</p></div></div> : viewMode === "list" ? renderListView() : calendarView === "month" ? renderMonthView() : calendarView === "week" ? renderWeekView() : <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden"><div className="border-b border-slate-200 bg-slate-50/50 p-4"><h3 className="text-lg font-bold text-slate-800">{format(currentDate, "EEEE, MMMM do, yyyy")}</h3></div><div className="p-4 space-y-3 overflow-y-auto flex-1">{filteredAppointments.filter((a) => isSameDay(parseISO(a.apptDate), currentDate)).length === 0 ? <div className="py-12 text-center text-slate-500">No appointments for today.</div> : filteredAppointments.filter((a) => isSameDay(parseISO(a.apptDate), currentDate)).sort((a, b) => a.apptTime.localeCompare(b.apptTime)).map((appt) => {
      const colors = getColorForDoctor(appt.doctorId);
      return <div key={appt.id} className={`p-4 rounded-lg border flex items-center gap-4 ${colors}`}><div className="w-16 text-center shrink-0"><p className="font-bold text-lg leading-none">{appt.apptTime.substring(0, 5)}</p><p className="text-[10px] uppercase font-bold opacity-70 mt-1">{parseISO(`1970-01-01T${appt.apptTime}`).getHours() >= 12 ? "PM" : "AM"}</p></div><div className="w-px h-10 bg-current opacity-20" /><div className="flex-1"><p className="font-bold text-lg">{appt.patientName}</p><p className="text-sm font-medium opacity-80 mt-0.5">{TYPE_LABEL[appt.type] ?? appt.type} &middot; Dr. {appt.doctorName}</p></div><div className={`px-3 py-1 text-xs font-bold rounded uppercase ${STATUS_STYLES[appt.status] || ""}`}>{appt.status.replace("_", " ")}</div></div>;
    })}</div></div>}</div><BookAppointmentModal
      isOpen={isBookingModalOpen}
      onClose={() => setIsBookingModalOpen(false)}
      onSuccess={() => {
        setIsBookingModalOpen(false);
        loadData();
      }}
    />{admitPrefill && <AdmitPatientModal prefill={admitPrefill} onClose={() => setAdmitPrefill(null)} onAdmitted={() => { setAdmitPrefill(null); }} />}{consultationAppointment && <ConsultationModal
      appointment={consultationAppointment}
      onClose={() => {
        setConsultationAppointment(null);
        // Re-fetch so a freshly-autosaved draft surfaces as a badge
        // immediately when the doctor closes mid-edit.
        refreshDraftSet();
      }}
      onSaved={() => {
        setConsultationAppointment(null);
        loadData();
      }}
    />}{vitalsAppointment && <VitalsModal
      appointment={vitalsAppointment}
      onClose={() => setVitalsAppointment(null)}
      onSaved={() => {
        setVitalsAppointment(null);
        refreshVitalsSet();
      }}
    />}{externalResultsAppointment && <ExternalResultsModal
      appointment={externalResultsAppointment}
      onClose={() => setExternalResultsAppointment(null)}
      onSaved={() => setExternalResultsAppointment(null)}
    />}</div>;
}
export {
  AppointmentsDashboard as default
};
