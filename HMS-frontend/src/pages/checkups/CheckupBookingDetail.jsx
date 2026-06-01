import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { checkupApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  ArrowLeft, Printer, Loader2, AlertCircle, ClipboardList,
  User, Package, Calendar, Clock, Stethoscope, Banknote,
  CheckCircle2, Circle, ChevronRight, Save, FileText,
  Activity, XCircle, AlertTriangle, Receipt, ExternalLink,
} from "lucide-react";

// Payment status badge — keeps the UI in sync with the lifecycle the backend
// drives (PENDING → BILLED after auto-bill on COMPLETED → PAID after the
// invoice is fully collected). Unknown strings fall through to a neutral chip.
const PAYMENT_CONFIG = {
  PENDING: { label: "Pending",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  BILLED:  { label: "Billed",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID:    { label: "Paid",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const STATUS_CONFIG = {
  SCHEDULED:   { label: "Scheduled",   color: "bg-blue-50 text-blue-700",        dot: "bg-blue-500",    border: "border-blue-200" },
  CHECKED_IN:  { label: "Checked In",  color: "bg-amber-50 text-amber-700",    dot: "bg-amber-500",   border: "border-amber-200" },
  IN_PROGRESS: { label: "In Progress", color: "bg-slate-100 text-slate-900", dot: "bg-slate-900",  border: "border-slate-200" },
  COMPLETED:   { label: "Completed",   color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" },
  CANCELLED:   { label: "Cancelled",   color: "bg-slate-100 text-slate-500",             dot: "bg-slate-400",   border: "border-slate-200" },
  NO_SHOW:     { label: "No Show",     color: "bg-rose-50 text-rose-700",         dot: "bg-rose-500",    border: "border-rose-200" },
};

const RESULT_STATUS_OPTIONS = ["PENDING", "NORMAL", "ABNORMAL", "CRITICAL", "NOT_APPLICABLE"];
const RESULT_STATUS_CONFIG = {
  PENDING:        { label: "Pending",        color: "text-slate-600" },
  NORMAL:         { label: "Normal",         color: "text-emerald-600" },
  ABNORMAL:       { label: "Abnormal",       color: "text-amber-600" },
  CRITICAL:       { label: "Critical",       color: "text-rose-600" },
  NOT_APPLICABLE: { label: "N/A",            color: "text-slate-600" },
};

const FLOW = {
  SCHEDULED:   { next: "CHECKED_IN",  label: "Check In",   icon: CheckCircle2, cls: "bg-amber-500 hover:bg-amber-600" },
  CHECKED_IN:  { next: "IN_PROGRESS", label: "Start Tests", icon: Activity,     cls: "bg-slate-900 hover:bg-slate-900" },
  IN_PROGRESS: { next: "COMPLETED",   label: "Mark Complete", icon: CheckCircle2, cls: "bg-emerald-500 hover:bg-emerald-600" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.SCHEDULED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function ResultRow({ result, onSave, disabled }) {
  const [value, setValue] = useState(result.resultValue || "");
  const [status, setStatus] = useState(result.resultStatus || "PENDING");
  const [notes, setNotes] = useState(result.resultNotes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty =
    value !== (result.resultValue || "") ||
    status !== (result.resultStatus || "PENDING") ||
    notes !== (result.resultNotes || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(result.id, { resultValue: value, resultStatus: status, resultNotes: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const resCfg = RESULT_STATUS_CONFIG[status] || RESULT_STATUS_CONFIG.PENDING;

  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400";

  return (
    <tr className="border-b border-slate-50 group">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          {result.resultStatus === "NORMAL" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : result.resultStatus === "CRITICAL" ? (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : result.resultStatus === "ABNORMAL" ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800">{result.testName}</p>
            {result.testCategory && (
              <p className="text-[10px] text-slate-600 mt-0.5 font-medium uppercase tracking-wide">{result.testCategory}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top w-32">
        <p className="text-xs text-slate-500">{result.normalRange || "—"}</p>
      </td>
      <td className="px-4 py-3 align-top w-36">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter result…"
          disabled={disabled}
          className={inputCls}
        />
      </td>
      <td className="px-4 py-3 align-top w-36">
        <SearchableSelect
          value={status}
          onChange={value => setStatus(value)}
          options={RESULT_STATUS_OPTIONS.map(s => ({ value: s, label: RESULT_STATUS_CONFIG[s].label }))}
          disabled={disabled}
          className={`${inputCls} ${resCfg.color}`}
        />
      </td>
      <td className="px-4 py-3 align-top">
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes…"
          disabled={disabled}
          className={inputCls}
        />
      </td>
      <td className="px-4 py-3 align-top w-20">
        {!disabled && (
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
              ${saved ? "bg-emerald-100 text-emerald-700" : isDirty ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 cursor-not-allowed"}`}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {saved ? "Saved" : "Save"}
          </button>
        )}
      </td>
    </tr>
  );
}

function DoctorNotesPanel({ booking, onSaved, readonly }) {
  const [doctorNotes, setDoctorNotes] = useState(booking.doctorNotes || "");
  const [recommendation, setRecommendation] = useState(booking.recommendation || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty =
    doctorNotes !== (booking.doctorNotes || "") ||
    recommendation !== (booking.recommendation || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await checkupApi.saveDoctorNotes(booking.id, { doctorNotes, recommendation });
      onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const textCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 resize-none placeholder:text-slate-400";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 print:border-slate-300">
      <div className="flex items-center gap-2 mb-2">
        <Stethoscope className="w-4 h-4 text-emerald-500" />
        <h3 className="font-bold text-slate-800">Doctor's Assessment</h3>
      </div>

      <div>
        <label className={labelCls}>Clinical Observations &amp; Findings</label>
        {readonly ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap min-h-[60px]">{doctorNotes || <span className="text-slate-500">—</span>}</p>
        ) : (
          <textarea rows={4} value={doctorNotes} onChange={e => setDoctorNotes(e.target.value)} placeholder="Enter clinical observations, findings, and summary…" className={textCls} />
        )}
      </div>

      <div>
        <label className={labelCls}>Recommendations &amp; Follow-up</label>
        {readonly ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap min-h-[40px]">{recommendation || <span className="text-slate-500">—</span>}</p>
        ) : (
          <textarea rows={3} value={recommendation} onChange={e => setRecommendation(e.target.value)} placeholder="Enter recommendations, lifestyle advice, or follow-up instructions…" className={textCls} />
        )}
      </div>

      {!readonly && (
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all
            ${saved ? "bg-emerald-100 text-emerald-700" : isDirty ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-100 text-slate-500 cursor-not-allowed"}`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : "Save Assessment"}
        </button>
      )}
    </div>
  );
}

export default function CheckupBookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = () =>
    checkupApi.getBooking(id).then(setBooking).catch(() => setBooking(null)).finally(() => setLoading(false));

  useEffect(() => { if (id) load(); }, [id]);

  const isAdmin = user?.role === "hospital_admin" || user?.role === "super_admin";
  const isDoctor = user?.role === "doctor";
  const canEdit = booking && booking.status !== "COMPLETED" && booking.status !== "CANCELLED" && booking.status !== "NO_SHOW";
  const canEditNotes = isDoctor || isAdmin;

  const handleAdvance = async () => {
    const flow = FLOW[booking.status];
    if (!flow) return;
    // Completing the booking will trigger the backend auto-bill — be explicit
    // about it so staff can sanity-check the amount before money is committed.
    if (flow.next === "COMPLETED" && !booking.invoiceId) {
      const price = Number(booking.healthPackage?.price || 0);
      const inrPrice = price.toLocaleString("en-IN");
      const ok = window.confirm(
        `Mark this booking complete?\n\nAn invoice for ₹${inrPrice} (${booking.healthPackage?.name}) will be created automatically — added to the patient's IPD bill if they're admitted, otherwise as a standalone bill.`
      );
      if (!ok) return;
    }
    setAdvancing(true);
    try {
      await checkupApi.updateStatus(booking.id, flow.next);
      await load();
    } finally {
      setAdvancing(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel this booking? This cannot be undone.")) return;
    setCancelling(true);
    try {
      await checkupApi.updateStatus(booking.id, "CANCELLED");
      await load();
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveResult = async (resultId, payload) => {
    const updated = await checkupApi.updateResult(booking.id, resultId, payload);
    setBooking(updated);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  );

  if (!booking) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertCircle className="w-10 h-10 text-slate-300" />
      <p className="text-slate-500 text-sm font-semibold">Booking not found.</p>
      <button onClick={() => navigate("/checkups/bookings")} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
        ← Back to Bookings
      </button>
    </div>
  );

  const flow = FLOW[booking.status];
  const FlowIcon = flow?.icon;
  const completedCount = booking.results?.filter(r => r.resultStatus !== "PENDING").length || 0;
  const totalCount = booking.results?.length || 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto print:p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <button
          onClick={() => navigate("/checkups/bookings")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Bookings
        </button>

        <div className="flex items-center gap-2">
          {canEdit && booking.status !== "CANCELLED" && booking.status !== "NO_SHOW" && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50 transition-colors"
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancel Booking
            </button>
          )}

          {flow && (
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-bold shadow-lg transition-all active:scale-[0.98] ${flow.cls}`}
            >
              {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : FlowIcon && <FlowIcon className="w-4 h-4" />}
              {flow.label}
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold transition-colors"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-emerald-500">
        <h1 className="text-xl font-bold text-slate-900">{user?.hospitalName}</h1>
        <p className="text-sm text-slate-500">Health Checkup Report · {fmtId(booking.bookingNumber)}</p>
      </div>

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 print:border-slate-300">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900 font-mono">{fmtId(booking.bookingNumber)}</h1>
                <StatusBadge status={booking.status} />
              </div>
              <p className="text-sm text-slate-500 mt-1">{booking.healthPackage?.name}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Booked by {booking.createdBy} · {booking.scheduledDate}{booking.scheduledTime ? ` at ${booking.scheduledTime}` : ""}
              </p>
            </div>
          </div>

          {/* Progress ring for results */}
          {totalCount > 0 && (
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Results Progress</p>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-600">{completedCount}/{totalCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-slate-100">
          <InfoRow icon={User} label="Patient" value={`${booking.patient?.firstName} ${booking.patient?.lastName}`} />
          <InfoRow icon={FileText} label="UHID" value={fmtId(booking.patient?.uhid)} />
          <InfoRow icon={Package} label="Package" value={booking.healthPackage?.name} />
          <InfoRow icon={Banknote} label="Package Price" value={`₹${Number(booking.healthPackage?.price || 0).toLocaleString("en-IN")}`} />
          <InfoRow icon={Calendar} label="Scheduled" value={booking.scheduledDate} />
          <InfoRow icon={Clock} label="Time" value={booking.scheduledTime || "—"} />
          <InfoRow icon={Stethoscope} label="Doctor" value={booking.assignedDoctor ? `Dr. ${booking.assignedDoctor.user?.firstName ?? booking.assignedDoctor.firstName ?? ""} ${booking.assignedDoctor.user?.lastName ?? booking.assignedDoctor.lastName ?? ""}`.trim() : "—"} />
          <div className="flex items-start gap-2 min-w-0">
            <Banknote className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {(() => {
                  const cfg = PAYMENT_CONFIG[booking.paymentStatus] || { label: booking.paymentStatus || "—", cls: "bg-slate-100 text-slate-600 border-slate-200" };
                  return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  );
                })()}
                <span className="text-xs text-slate-600 tabular-nums">
                  ₹{Number(booking.amountPaid || 0).toLocaleString("en-IN")} paid
                </span>
              </div>
              {booking.invoiceId && (
                <button
                  onClick={() => navigate(`/billing?invoiceId=${booking.invoiceId}`)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline print:hidden"
                >
                  <Receipt className="w-3 h-3" /> View invoice
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {booking.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-slate-600">{booking.notes}</p>
          </div>
        )}
      </div>

      {/* Test Results */}
      {totalCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden print:border-slate-300">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h2 className="font-bold text-slate-800">Test Results</h2>
            <span className="ml-auto text-xs text-slate-600">
              {completedCount} of {totalCount} entered
            </span>
          </div>
          {!canEdit && (
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 print:hidden">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-500">
                Results are read-only — booking is {STATUS_CONFIG[booking.status]?.label || booking.status}.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Test Name", "Normal Range", "Result Value", "Status", "Notes", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(booking.results || [])
                  .slice()
                  .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                  .map(result => (
                    <ResultRow
                      key={result.id}
                      result={result}
                      onSave={handleSaveResult}
                      disabled={!canEdit}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Doctor Notes */}
      {canEditNotes ? (
        <DoctorNotesPanel booking={booking} onSaved={load} readonly={!canEdit} />
      ) : (booking.doctorNotes || booking.recommendation) ? (
        <DoctorNotesPanel booking={booking} onSaved={load} readonly />
      ) : null}

      {/* Print footer */}
      <div className="hidden print:block mt-8 pt-4 border-t border-slate-300 text-center text-xs text-slate-400">
        <p>This report was generated by {user?.hospitalName} · {new Date().toLocaleDateString("en-IN", { timeZone: 'Asia/Kolkata', day: "2-digit", month: "long", year: "numeric" })}</p>
        <p className="mt-1">Booking: {fmtId(booking.bookingNumber)} · Patient: {booking.patient?.firstName} {booking.patient?.lastName} ({fmtId(booking.patient?.uhid)})</p>
      </div>
    </div>
  );
}
