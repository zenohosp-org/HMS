import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
  appointmentsApi, doctorsApi, recordApi, radiologyApi,
} from "@/utils/api";
import { useConsultationDraft } from "@/hooks/useConsultationDraft";
import { fmtId } from "@/utils/idFormat";
import { PrescriptionDrugRow } from "@/components/prescription/PrescriptionDrugRow";
import {
  Stethoscope, Pill, FlaskConical, ChevronLeft, ChevronRight, LogOut,
  CalendarClock, Loader2, CheckCircle2, Save, AlertCircle, ClipboardList,
  FileText, ListChecks, Plus, IdCard, Droplet, HeartPulse, Scale, Wind,
  Activity, FileBarChart, Clock, User as UserIcon, ChevronRight as Arrow,
  PlayCircle,
} from "lucide-react";

/**
 * Full-page, queue-walked consultation workspace. Replaces the modal
 * flow for doctors who want to plow through their entire day in one
 * focused surface: today's appointments are pre-loaded as an ordered
 * queue, the left rail shows patient + vitals + history at a glance,
 * the centre tabs cover Consultation / Prescription / Lab Test, and
 * the bottom bar has Previous / Next / Save & Next / Exit so a doctor
 * can finish a patient and advance with one click.
 *
 * Form state lives in useConsultationDraft — same hook the modal uses —
 * so draft autosave, vitals fetch, and the final save handler are
 * identical across both surfaces. Switching patients via Next/Previous
 * resets state cleanly per appointment.id; nothing leaks between
 * patients.
 */
export default function ConsultationViewPage() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [queue, setQueue] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState("consult");

  const [pastRecords, setPastRecords] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingLabs, setLoadingLabs] = useState(false);

  // ── Queue load ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!user?.hospitalId) return;
    (async () => {
      setLoadingQueue(true);
      try {
        let doctorId = null;
        let doctorLookupFailed = false;
        if (user.role === "doctor") {
          try {
            const d = await doctorsApi.getByUserId(user.userId);
            doctorId = d?.id || null;
          } catch {
            try {
              const docs = await doctorsApi.list(user.hospitalId);
              const me = (docs || []).find(x => x.userId === user.userId);
              doctorId = me?.id || null;
            } catch { /* fall through */ }
          }
          if (!doctorId) doctorLookupFailed = true;
        }
        if (doctorLookupFailed) {
          if (!cancelled) {
            notify("Could not resolve your doctor profile — contact admin", "error");
            setQueue([]);
            setLoadingQueue(false);
          }
          return;
        }

        const params = { page: 0, size: 200, dateFilter: "TODAY", search: "" };
        if (doctorId) params.doctorId = doctorId;
        const res = await appointmentsApi.listPaginated(user.hospitalId, params);
        const items = res?.content || [];

        const SKIP = new Set(["COMPLETED", "BILLED", "CANCELLED", "NO_SHOW"]);
        const actionable = items
          .filter(a => !SKIP.has(a.status))
          .sort((a, b) => {
            const ta = a.tokenNumber ?? Number.MAX_SAFE_INTEGER;
            const tb = b.tokenNumber ?? Number.MAX_SAFE_INTEGER;
            if (ta !== tb) return ta - tb;
            return (a.apptTime || "").localeCompare(b.apptTime || "");
          });

        if (cancelled) return;
        setQueue(actionable);

        const deepLinkId = searchParams.get("appointmentId");
        let startIdx = 0;
        if (deepLinkId) {
          const found = actionable.findIndex(a => String(a.id) === String(deepLinkId));
          if (found >= 0) startIdx = found;
        }
        setIndex(startIdx);
      } catch {
        if (!cancelled) {
          notify("Could not load today's queue", "error");
          setQueue([]);
        }
      } finally {
        if (!cancelled) setLoadingQueue(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.hospitalId, user?.role, user?.userId]);

  const current = queue[index] || null;

  useEffect(() => {
    if (!current?.id) return;
    const sp = new URLSearchParams(searchParams);
    sp.set("appointmentId", String(current.id));
    setSearchParams(sp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!current?.patientId || !user?.hospitalId) {
      setPastRecords([]);
      return () => { cancelled = true; };
    }
    setLoadingPast(true);
    recordApi.list(current.patientId, user.hospitalId)
      .then(rows => { if (!cancelled) setPastRecords(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setPastRecords([]); })
      .finally(() => { if (!cancelled) setLoadingPast(false); });
    return () => { cancelled = true; };
  }, [current?.patientId, user?.hospitalId]);

  useEffect(() => {
    let cancelled = false;
    if (!current?.patientId) { setLabOrders([]); return () => { cancelled = true; }; }
    setLoadingLabs(true);
    radiologyApi.getByPatient(current.patientId)
      .then(rows => { if (!cancelled) setLabOrders(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setLabOrders([]); })
      .finally(() => { if (!cancelled) setLoadingLabs(false); });
    return () => { cancelled = true; };
  }, [current?.patientId]);

  const onSaved = useCallback(() => {
    setQueue(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (index >= next.length && next.length > 0) {
        setIndex(next.length - 1);
      }
      return next;
    });
  }, [index]);

  const draft = useConsultationDraft({
    appointment: current,
    hospitalId: user?.hospitalId,
    notify,
    onSaved,
  });

  const goPrev = useCallback(() => {
    setTab("consult");
    setIndex(i => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setTab("consult");
    setIndex(i => Math.min(queue.length - 1, i + 1));
  }, [queue.length]);

  // Transition the current patient to IN_PROGRESS in-place. Optimistic
  // update lets the hero card flip status immediately; on backend
  // rejection we restore the previous status and surface the message.
  const handleStartConsultation = useCallback(async () => {
    if (!current?.id) return;
    const prevStatus = current.status;
    const id = current.id;
    setQueue(prev => prev.map((a, i) => i === index ? { ...a, status: "IN_PROGRESS" } : a));
    try {
      await appointmentsApi.updateStatus(id, "IN_PROGRESS");
      notify("Consultation started", "success");
    } catch (err) {
      setQueue(prev => prev.map((a) => a.id === id ? { ...a, status: prevStatus } : a));
      notify(err?.response?.data?.message || "Failed to start consultation", "error");
    }
  }, [current?.id, current?.status, index, notify]);

  const handleSaveAndNext = useCallback(async () => {
    const created = await draft.saveConsultation();
    if (!created) return;
    setTab("consult");
  }, [draft]);

  const handleExit = useCallback(() => navigate("/appointments"), [navigate]);

  // ── Render gates ─────────────────────────────────────────────────────
  if (loadingQueue) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-[#888] text-base">
        <Loader2 className="w-5 h-5 animate-spin mr-2.5" /> Loading today's queue…
      </div>
    );
  }
  if (queue.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-[#161616] flex items-center justify-center">
          <CalendarClock className="w-8 h-8 text-slate-400 dark:text-[#666]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">No active appointments today</h2>
          <p className="text-sm text-slate-500 dark:text-[#888] mt-1 max-w-md">
            {user?.role === "doctor"
              ? "There are no checked-in or in-progress patients in your queue right now."
              : "There are no checked-in or in-progress patients in the hospital queue right now."}
          </p>
        </div>
        <button onClick={handleExit} className="btn-secondary mt-2">
          <LogOut className="w-4 h-4" /> Back to Appointments
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-slate-100/60 dark:bg-[#0a0a0a]">
      <LeftPanel
        appointment={current}
        vitals={draft.vitals}
        vitalsStatus={draft.vitalsStatus}
        pastRecords={pastRecords}
        loadingPast={loadingPast}
        onStartConsultation={handleStartConsultation}
      />

      <section className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f0f0f]">
        <TabBar tab={tab} setTab={setTab} drugCount={draft.drugCount} labCount={labOrders.length} />

        <div className="flex-1 overflow-y-auto">
          {tab === "consult" && <ConsultTab draft={draft} />}
          {tab === "rx" && <RxTab draft={draft} />}
          {tab === "lab" && <LabTab orders={labOrders} loading={loadingLabs} />}
        </div>

        <BottomBar
          index={index}
          total={queue.length}
          current={current}
          autosaveStatus={draft.autosaveStatus}
          hydrating={draft.hydrating}
          saving={draft.saving}
          onPrev={goPrev}
          onNext={goNext}
          onSaveAndNext={handleSaveAndNext}
          onExit={handleExit}
        />
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// LEFT RAIL — patient identity, vitals, past records
// ────────────────────────────────────────────────────────────────────────
function LeftPanel({ appointment, vitals, vitalsStatus, pastRecords, loadingPast, onStartConsultation }) {
  const fullName = appointment?.patientName || "—";
  const uhid = fmtId(appointment?.patientUhid) || appointment?.patientUhid || "—";
  const age = computeAge(appointment?.patientDob);
  const sex = appointment?.patientGender || "—";
  const placeholder = vitalsStatus === "loading" ? "…" : "—";
  const bp = vitals && (vitals.bpSystolic != null || vitals.bpDiastolic != null)
    ? `${vitals.bpSystolic ?? "—"}/${vitals.bpDiastolic ?? "—"}`
    : placeholder;
  const spo2 = vitals?.spo2 != null ? `${vitals.spo2}` : placeholder;
  const hr = vitals?.heartRate != null ? `${vitals.heartRate}` : placeholder;
  const wt = vitals?.weightKg != null ? `${Number(vitals.weightKg).toFixed(1)}` : placeholder;

  return (
    <aside className="w-[26rem] shrink-0 border-r border-slate-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0d0d0d] overflow-y-auto">
      <div className="px-6 py-7 space-y-8">

        {/* Patient profile card */}
        <PatientHeroCard
          name={fullName}
          token={appointment?.tokenNumber}
          status={appointment?.status}
          time={appointment?.apptTime}
          onStartConsultation={onStartConsultation}
        />

        {/* Patient details */}
        <SidebarSection title="Patient Details">
          <div className="space-y-1">
            <SidebarRow icon={<UserIcon className="w-4 h-4" />} label="Name" value={fullName} />
            <SidebarRow icon={<IdCard className="w-4 h-4" />} label="UHID" value={uhid} mono />
            <SidebarRow icon={<Clock className="w-4 h-4" />} label="Age" value={age || "—"} />
            <SidebarRow icon={<UserIcon className="w-4 h-4" />} label="Sex" value={sex} />
          </div>
        </SidebarSection>

        {/* Medical information — blood group + a 2x2 grid of vital cards */}
        <SidebarSection
          title="Medical Information"
          trailing={<VitalsStateHint status={vitalsStatus} vitals={vitals}
                                      recordedByName={vitals?.recordedByName}
                                      recordedAt={vitals?.updatedAt || vitals?.recordedAt} />}
        >
          <div className="rounded-xl border border-slate-200 dark:border-[#1c1c1c] bg-gradient-to-br from-rose-50/40 via-white to-white dark:from-rose-500/5 dark:via-[#0d0d0d] dark:to-[#0d0d0d] px-4 py-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                <Droplet className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#888]">
                Blood Group
              </span>
            </div>
            <span className="text-xl font-bold text-rose-700 dark:text-rose-300 tabular-nums">
              {appointment?.patientBloodGroup || "—"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <VitalTile
              icon={<HeartPulse className="w-4 h-4" />}
              label="BP"
              value={bp}
              unit="mmHg"
              tone="rose"
            />
            <VitalTile
              icon={<Wind className="w-4 h-4" />}
              label="SpO₂"
              value={spo2}
              unit="%"
              tone="blue"
            />
            <VitalTile
              icon={<HeartPulse className="w-4 h-4" />}
              label="Pulse"
              value={hr}
              unit="bpm"
              tone="emerald"
            />
            <VitalTile
              icon={<Scale className="w-4 h-4" />}
              label="Weight"
              value={wt}
              unit="kg"
              tone="amber"
            />
          </div>
        </SidebarSection>

        {/* Previous records */}
        <SidebarSection title="Previous Records">
          {loadingPast ? (
            <p className="text-sm text-slate-400 dark:text-[#666] flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </p>
          ) : pastRecords.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-[#666]">No prior records for this patient.</p>
          ) : (
            <div className="space-y-2">
              {pastRecords.slice(0, 5).map(rec => <PastRecordCard key={rec.id} record={rec} />)}
              {pastRecords.length > 5 && (
                <p className="text-[11px] text-slate-400 dark:text-[#666] pl-1">
                  {pastRecords.length - 5} older · view full chart on Patients page
                </p>
              )}
            </div>
          )}
        </SidebarSection>
      </div>
    </aside>
  );
}

function PatientHeroCard({ name, token, status, time, onStartConsultation }) {
  const statusTone = STATUS_TONE[status] || STATUS_TONE.DEFAULT;
  const canStart = status === "CHECKED_IN";
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#1f1f1f] bg-gradient-to-br from-blue-50/60 via-white to-white dark:from-blue-500/5 dark:via-[#101010] dark:to-[#101010] p-5 shadow-sm space-y-4">
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-900 dark:text-white truncate leading-tight">{name}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {token != null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[11px] font-bold tabular-nums">
              #{token}
            </span>
          )}
          {time && (
            <span className="text-xs text-slate-500 dark:text-[#888] tabular-nums">
              {time.substring(0, 5)}
            </span>
          )}
          {status && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusTone}`}>
              {status.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* Status action — surfaced only when the next clinical step is
          obvious (CHECKED_IN → IN_PROGRESS). Once consultation has
          started, the Save & Next bar at the bottom takes over. */}
      {canStart && (
        <button
          type="button"
          onClick={onStartConsultation}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-sm shadow-blue-600/20 dark:shadow-blue-500/20 transition-colors"
        >
          <PlayCircle className="w-4 h-4" />
          Start Consultation
        </button>
      )}
      {status === "IN_PROGRESS" && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
          <Activity className="w-4 h-4" />
          Consultation in progress
        </div>
      )}
    </div>
  );
}

const STATUS_TONE = {
  SCHEDULED:   "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20",
  CONFIRMED:   "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20",
  CHECKED_IN:  "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20",
  IN_PROGRESS: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20",
  DEFAULT:     "text-slate-600 bg-slate-100 border-slate-200 dark:text-[#aaa] dark:bg-[#1a1a1a] dark:border-[#2a2a2a]",
};

function SidebarSection({ title, trailing, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
          {title}
        </h3>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function SidebarRow({ icon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-[#888]">
        <span className="text-slate-400 dark:text-[#666]">{icon}</span>
        {label}
      </span>
      <span className={`text-sm font-semibold text-slate-800 dark:text-[#e5e5e5] text-right truncate ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function VitalTile({ icon, label, value, unit, tone }) {
  const map = {
    rose:    "from-rose-50/60 dark:from-rose-500/5 text-rose-600 dark:text-rose-400 ring-rose-100/60 dark:ring-rose-500/20",
    blue:    "from-blue-50/60 dark:from-blue-500/5 text-blue-600 dark:text-blue-400 ring-blue-100/60 dark:ring-blue-500/20",
    emerald: "from-emerald-50/60 dark:from-emerald-500/5 text-emerald-600 dark:text-emerald-400 ring-emerald-100/60 dark:ring-emerald-500/20",
    amber:   "from-amber-50/60 dark:from-amber-500/5 text-amber-600 dark:text-amber-400 ring-amber-100/60 dark:ring-amber-500/20",
  };
  const t = map[tone] || map.blue;
  return (
    <div className={`rounded-xl border border-slate-200 dark:border-[#1c1c1c] bg-gradient-to-br to-white dark:to-[#0d0d0d] ${t.split(" ").filter(c => c.startsWith("from-")).join(" ")} px-3.5 py-3`}>
      <div className="flex items-center gap-1.5">
        <span className={`${t.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{value}</span>
        <span className="text-[11px] font-medium text-slate-400 dark:text-[#666]">{unit}</span>
      </div>
    </div>
  );
}

function VitalsStateHint({ status, vitals, recordedByName, recordedAt }) {
  if (status === "loaded" && vitals && (
        vitals.bpSystolic != null || vitals.spo2 != null ||
        vitals.heartRate != null  || vitals.weightKg != null)) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium" title={[recordedByName, recordedAt && new Date(recordedAt).toLocaleString()].filter(Boolean).join(" · ")}>
        <Activity className="w-3 h-3" /> Recorded
      </span>
    );
  }
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-[#888] font-medium">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
        <AlertCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-[#666] font-medium">
      <Activity className="w-3 h-3" /> Not recorded
    </span>
  );
}

function PastRecordCard({ record }) {
  const typeLabel = record.historyType || "RECORD";
  const date = record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "";
  const summary = (record.description || "").split("\n")[0] || "—";
  return (
    <div className="rounded-lg border border-slate-200 dark:border-[#1c1c1c] bg-white dark:bg-[#111] px-3 py-2.5 hover:border-slate-300 dark:hover:border-[#2a2a2a] transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
          {typeLabel}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-[#666] tabular-nums">{date}</span>
      </div>
      <p className="text-xs text-slate-600 dark:text-[#bbb] line-clamp-2 leading-snug" title={summary}>
        {summary}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// TABS
// ────────────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, drugCount, labCount }) {
  return (
    <div className="shrink-0 px-8 pt-5 border-b border-slate-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0f0f0f]">
      <div className="flex items-end gap-2">
        <TabButton active={tab === "consult"} onClick={() => setTab("consult")}
                   icon={<Stethoscope className="w-4 h-4" />} label="Consultation" />
        <TabButton active={tab === "rx"} onClick={() => setTab("rx")}
                   icon={<Pill className="w-4 h-4" />} label="Prescription" count={drugCount} />
        <TabButton active={tab === "lab"} onClick={() => setTab("lab")}
                   icon={<FlaskConical className="w-4 h-4" />} label="Lab Tests" count={labCount} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 -mb-px border-b-2 text-sm font-semibold transition-colors ${
        active
          ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-white"
      }`}
    >
      {icon}{label}
      {count > 0 && (
        <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
          active
            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/30 dark:text-blue-200"
            : "bg-slate-100 text-slate-600 dark:bg-[#1a1a1a] dark:text-[#aaa]"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ConsultTab({ draft }) {
  return (
    <div className="px-8 py-8 space-y-7">
      <Section icon={<ClipboardList className="w-4 h-4" />} title="Chief complaint" hint="What brought the patient in today">
        <textarea
          rows={2}
          value={draft.chiefComplaint}
          onChange={e => draft.setChiefComplaint(e.target.value)}
          placeholder="e.g. Fever for 3 days, dry cough since yesterday"
          className="focus-textarea"
        />
      </Section>

      <Section icon={<FileText className="w-4 h-4" />} title="Doctor's notes" hint="Examination findings, diagnosis, plan">
        <textarea
          rows={9}
          value={draft.notes}
          onChange={e => draft.setNotes(e.target.value)}
          placeholder="Subjective, objective, assessment, plan…"
          className="focus-textarea"
        />
      </Section>

      <Section icon={<ListChecks className="w-4 h-4" />} title="Instructions for patient" hint="Diet, rest, when to come back">
        <textarea
          rows={5}
          value={draft.instructions}
          onChange={e => draft.setInstructions(e.target.value)}
          placeholder="e.g. Plenty of fluids. Return immediately if breathing worsens."
          className="focus-textarea"
        />
      </Section>

      <Section icon={<CalendarClock className="w-4 h-4" />} title="Next visit" hint="Optional follow-up reminder">
        <input
          type="datetime-local"
          value={draft.nextVisitDate}
          onChange={e => draft.setNextVisitDate(e.target.value)}
          className="focus-input max-w-md"
        />
      </Section>
    </div>
  );
}

function RxTab({ draft }) {
  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-[#ccc]">
            <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Prescription
            {draft.drugCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                {draft.drugCount} drug{draft.drugCount === 1 ? "" : "s"}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#777] mt-1">
            Leave empty for a notes-only consultation
          </p>
        </div>
        <button
          type="button"
          onClick={draft.addItem}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add drug
        </button>
      </div>

      <div className="space-y-3">
        {draft.items.map((item, idx) => (
          <PrescriptionDrugRow
            key={item.key}
            index={idx}
            item={item}
            onChange={(field, value) => draft.setItemField(item.key, field, value)}
            onRemove={() => draft.removeItem(item.key)}
            isLastRemovable={draft.items.length > 1}
          />
        ))}
      </div>
    </div>
  );
}

function LabTab({ orders, loading }) {
  if (loading) {
    return (
      <div className="px-8 py-8 text-base text-slate-500 dark:text-[#888] flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading lab orders…
      </div>
    );
  }
  if (!orders || orders.length === 0) {
    return (
      <div className="px-8 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-[#161616] flex items-center justify-center mx-auto mb-4">
          <FlaskConical className="w-8 h-8 text-slate-400 dark:text-[#666]" />
        </div>
        <p className="text-base font-semibold text-slate-700 dark:text-[#ccc]">No lab orders for this patient</p>
        <p className="text-sm text-slate-400 dark:text-[#666] mt-1.5 max-w-md mx-auto">
          Imaging and lab orders placed for this patient will appear here once raised.
        </p>
      </div>
    );
  }
  return (
    <div className="px-8 py-8">
      <div className="rounded-xl border border-slate-200 dark:border-[#1c1c1c] overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 dark:bg-[#141414] border-b border-slate-100 dark:border-[#1c1c1c] text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
          <div className="col-span-5">Investigation</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-3">Date</div>
          <div className="col-span-1 text-right">Report</div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-[#1c1c1c]">
          {orders.map(order => (
            <div key={order.id} className="grid grid-cols-12 gap-3 items-center px-5 py-4 bg-white dark:bg-[#0f0f0f] hover:bg-slate-50/60 dark:hover:bg-[#141414] transition-colors">
              <div className="col-span-5">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {order.serviceName || order.investigationName || "—"}
                </p>
                {order.modality && (
                  <p className="text-xs text-slate-400 dark:text-[#666] mt-0.5">{order.modality}</p>
                )}
              </div>
              <div className="col-span-3"><StatusPill status={order.status} /></div>
              <div className="col-span-3 text-sm text-slate-500 dark:text-[#888] tabular-nums">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
              </div>
              <div className="col-span-1 text-right">
                {order.reportUrl || order.reportId ? (
                  <a
                    href={order.reportUrl || `/radiology/reports/${order.reportId}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileBarChart className="w-3.5 h-3.5" /> Open
                  </a>
                ) : (
                  <span className="text-xs text-slate-300 dark:text-[#444]">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    PENDING_SCAN:    "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20",
    AWAITING_REPORT: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20",
    REPORTED:        "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    BILLED:          "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    CANCELLED:       "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20",
  };
  const cls = map[status] || "text-slate-600 bg-slate-100 border-slate-200 dark:text-[#aaa] dark:bg-[#1a1a1a] dark:border-[#2a2a2a]";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${cls}`}>
      {(status || "—").replace(/_/g, " ")}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────
// BOTTOM BAR
// ────────────────────────────────────────────────────────────────────────
function BottomBar({
  index, total, current, autosaveStatus, hydrating, saving,
  onPrev, onNext, onSaveAndNext, onExit,
}) {
  const isFirst = index <= 0;
  const isLast = index >= total - 1;
  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0f0f0f] px-8 py-4 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3 min-w-0">
        <AutosaveIndicator status={autosaveStatus} hydrating={hydrating} />
        {current?.patientName && (
          <span className="text-xs text-slate-400 dark:text-[#666] truncate hidden md:inline">
            · {current.patientName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst || saving}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-[#ccc] bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1a] dark:hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        <span className="px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-[#ccc] bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#1c1c1c] tabular-nums min-w-[80px] text-center">
          {index + 1} <span className="text-slate-400 dark:text-[#666] font-normal">/ {total}</span>
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={isLast || saving}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-[#ccc] bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1a] dark:hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onSaveAndNext}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-blue-600/20 dark:shadow-blue-500/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isLast ? "Save Consultation" : "Save & Next"}
          {!isLast && !saving && <Arrow className="w-3.5 h-3.5 opacity-80" />}
        </button>

        <button
          type="button"
          onClick={onExit}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-[#888] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
        >
          <LogOut className="w-4 h-4" /> Exit
        </button>
      </div>
    </div>
  );
}

function AutosaveIndicator({ status, hydrating }) {
  if (hydrating) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#888]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading draft…
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#888]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving draft…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Save className="w-3.5 h-3.5" /> Draft saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <AlertCircle className="w-3.5 h-3.5" /> Autosave failed
      </span>
    );
  }
  return <span className="text-xs text-slate-400 dark:text-[#666]">Draft autosaves as you type</span>;
}

// ────────────────────────────────────────────────────────────────────────
// SHARED
// ────────────────────────────────────────────────────────────────────────
function Section({ icon, title, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-[#ccc]">
          <span className="text-slate-400 dark:text-[#666]">{icon}</span>
          {title}
        </h3>
        {hint && (
          <span className="text-xs text-slate-400 dark:text-[#666] normal-case font-normal">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function computeAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 150 ? `${age} yr` : null;
}
