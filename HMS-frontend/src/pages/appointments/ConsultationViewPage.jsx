import { useState, useEffect, useMemo, useCallback } from "react";
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
  Activity, FileSearch, Clock, FileBarChart, User as UserIcon,
} from "lucide-react";

/**
 * Full-page, queue-walked consultation workspace. Replaces the modal flow
 * for doctors who want to plow through their entire day in one focused
 * surface: today's appointments are pre-loaded as an ordered queue, the
 * left panel shows patient + vitals + history at a glance, the centre
 * tabs cover Consultation / Prescription / Lab Test, and the bottom bar
 * has Previous / Next / Save & Next / Exit so a doctor can finish a
 * patient and advance with one click.
 *
 * The form state lives in useConsultationDraft (same hook the modal uses),
 * so draft autosave, vitals fetch, and the final save handler are
 * identical across both surfaces. Switching patients via Next/Previous
 * remounts the form with the new appointment.id as the hook's key —
 * state resets cleanly, new draft hydrates, no field-leak between
 * patients.
 *
 * Queue scope: today's appointments for the logged-in user. Doctors see
 * only their own queue (resolved via doctorsApi.getByUserId). Admin /
 * staff see every doctor's queue for the day. CANCELLED and NO_SHOW are
 * filtered out so the index never lands on a row the doctor can't act
 * on. Ordered by tokenNumber asc with apptTime as the tiebreaker.
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

  // Sidecar fetches scoped to the current patient. Re-fired whenever the
  // index moves so the left-panel + Lab Test tab stay in sync with the
  // currently-displayed appointment.
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
          // Resolve the doctor row that owns this user account so we can
          // filter the queue. Fallback path: scan the doctors list — works
          // even when the dedicated by-user endpoint isn't deployed.
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

        // Strict scoping: a doctor must never see another doctor's queue.
        // If we can't resolve their doctor row, surface an explicit empty
        // queue + error rather than silently falling through to the
        // hospital-wide listing the way admin / staff do.
        if (doctorLookupFailed) {
          if (!cancelled) {
            notify("Could not resolve your doctor profile — contact admin", "error");
            setQueue([]);
            setLoadingQueue(false);
          }
          return;
        }

        const params = {
          page: 0,
          size: 200,             // generous; one doctor rarely has > 200 in a day
          dateFilter: "TODAY",
          search: "",
        };
        if (doctorId) params.doctorId = doctorId;
        const res = await appointmentsApi.listPaginated(user.hospitalId, params);
        const items = res?.content || [];

        // Active queue only: anything past the doctor's window (COMPLETED,
        // BILLED) or that the doctor will never see (CANCELLED, NO_SHOW)
        // gets dropped. SCHEDULED / CONFIRMED / CHECKED_IN / IN_PROGRESS
        // are all surfaceable — covers walk-ins still in the waiting room
        // through the patient currently sitting in front of the doctor.
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

        // Honour ?appointmentId=... in the URL so the dashboard can deep-link
        // a specific row straight into the consultation view. Falls back to
        // the first patient in the queue.
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

  // Mirror the current appointment.id into the URL so a refresh resumes
  // on the same patient. Replace, not push, so the back button still exits.
  useEffect(() => {
    if (!current?.id) return;
    const sp = new URLSearchParams(searchParams);
    sp.set("appointmentId", String(current.id));
    setSearchParams(sp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // ── Patient-scoped sidecars ──────────────────────────────────────────
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
    // Pull the just-saved patient out of the queue so the doctor can't
    // accidentally land back on them and re-edit a finalised record. We
    // also clamp the index inside the same setState so React batches
    // both updates into one render — otherwise the page would flash an
    // out-of-bounds frame for last-patient saves.
    setQueue(prev => {
      const next = prev.filter((_, i) => i !== index);
      // If the doctor just saved the last row, slide the pointer back
      // to the new last. Empty queue is handled by the empty-state
      // render branch below.
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

  const handleSaveAndNext = useCallback(async () => {
    const created = await draft.saveConsultation();
    if (!created) return;
    // onSaved already removed the just-saved row from the queue, so the
    // same index value now points at the next patient automatically.
    // No need to increment — and the last-patient clamp lives in
    // onSaved so we don't have to know the new length here.
    setTab("consult");
  }, [draft]);

  const handleExit = useCallback(() => {
    navigate("/appointments");
  }, [navigate]);

  // ── Render ───────────────────────────────────────────────────────────
  if (loadingQueue) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-[#888] text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading today's queue…
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <CalendarClock className="w-10 h-10 text-slate-300 dark:text-[#333]" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">No active appointments today</h2>
        <p className="text-sm text-slate-500 dark:text-[#888] max-w-md">
          {user?.role === "doctor"
            ? "There are no checked-in or in-progress patients in your queue right now."
            : "There are no checked-in or in-progress patients in the hospital queue right now."}
        </p>
        <button onClick={handleExit} className="btn-secondary mt-2">
          <LogOut className="w-4 h-4" /> Back to Appointments
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-slate-50/40 dark:bg-[#0c0c0c]">
      <LeftPanel
        appointment={current}
        vitals={draft.vitals}
        vitalsStatus={draft.vitalsStatus}
        pastRecords={pastRecords}
        loadingPast={loadingPast}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TabBar
          tab={tab}
          setTab={setTab}
          drugCount={draft.drugCount}
          labCount={labOrders.length}
        />

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
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// LEFT PANEL — patient identity, vitals, past records
// ────────────────────────────────────────────────────────────────────────
function LeftPanel({ appointment, vitals, vitalsStatus, pastRecords, loadingPast }) {
  const fullName = appointment?.patientName || "—";
  const uhid = fmtId(appointment?.patientUhid) || appointment?.patientUhid || "—";
  const age = computeAge(appointment?.patientDob);
  const sex = appointment?.patientGender || "—";

  // Resolve each cell's display once. While the API is in flight render a
  // soft "…" so a brief blank doesn't look like missing data. After
  // resolution the cell either shows the value or a deliberate "—" so the
  // doctor can tell at a glance that the nurse hasn't recorded that one.
  const placeholder = vitalsStatus === "loading" ? "…" : "—";
  const bp = vitals && (vitals.bpSystolic != null || vitals.bpDiastolic != null)
    ? `${vitals.bpSystolic ?? "—"}/${vitals.bpDiastolic ?? "—"} mmHg`
    : placeholder;
  const spo2 = vitals?.spo2 != null ? `${vitals.spo2}%` : placeholder;
  const hr = vitals?.heartRate != null ? `${vitals.heartRate} bpm` : placeholder;
  const wt = vitals?.weightKg != null ? `${Number(vitals.weightKg).toFixed(1)} kg` : placeholder;

  return (
    <aside className="w-80 shrink-0 border-r border-slate-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0f0f0f] overflow-y-auto">
      <div className="px-5 py-5 space-y-6">

        <SidebarSection title="Current Patient">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-base shrink-0">
              {(fullName.trim().charAt(0) || "?").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{fullName}</p>
              <p className="text-[11px] text-slate-500 dark:text-[#888] mt-0.5">
                Token #{appointment?.tokenNumber ?? "—"}
                {appointment?.apptTime && ` · ${appointment.apptTime.substring(0, 5)}`}
              </p>
            </div>
          </div>
        </SidebarSection>

        <SidebarSection title="Patient Details">
          <SidebarRow icon={<UserIcon className="w-3.5 h-3.5" />} label="Name" value={fullName} />
          <SidebarRow icon={<IdCard className="w-3.5 h-3.5" />} label="UHID" value={uhid} mono />
          <SidebarRow icon={<Clock className="w-3.5 h-3.5" />} label="Age" value={age || "—"} />
          <SidebarRow icon={<UserIcon className="w-3.5 h-3.5" />} label="Sex" value={sex} />
        </SidebarSection>

        <SidebarSection title="Medical Information">
          <VitalsStateHint status={vitalsStatus} vitals={vitals} recordedByName={vitals?.recordedByName} recordedAt={vitals?.updatedAt || vitals?.recordedAt} />
          <SidebarRow icon={<Droplet className="w-3.5 h-3.5 text-rose-500" />} label="Blood Group" value={appointment?.patientBloodGroup || "—"} />
          <SidebarRow icon={<Scale className="w-3.5 h-3.5 text-amber-500" />} label="Weight" value={wt} />
          <SidebarRow icon={<HeartPulse className="w-3.5 h-3.5 text-rose-500" />} label="Blood Pressure" value={bp} />
          <SidebarRow icon={<Wind className="w-3.5 h-3.5 text-blue-500" />} label="SpO₂" value={spo2} />
          <SidebarRow icon={<HeartPulse className="w-3.5 h-3.5 text-emerald-500" />} label="Heart Rate" value={hr} />
        </SidebarSection>

        <SidebarSection title="Previous Records">
          {loadingPast ? (
            <p className="text-xs text-slate-400 dark:text-[#666] flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </p>
          ) : pastRecords.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-[#666]">No prior records for this patient.</p>
          ) : (
            <div className="space-y-2">
              {pastRecords.slice(0, 5).map(rec => (
                <PastRecordCard key={rec.id} record={rec} />
              ))}
              {pastRecords.length > 5 && (
                <p className="text-[10px] text-slate-400 dark:text-[#666]">
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

function SidebarSection({ title, children }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888] mb-3">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SidebarRow({ icon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#888]">
        {icon} {label}
      </span>
      <span className={`text-[12px] font-semibold text-slate-800 dark:text-[#ddd] text-right truncate ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function VitalsStateHint({ status, vitals, recordedByName, recordedAt }) {
  // Loaded + non-null + has at least one field → success annotation.
  if (status === "loaded" && vitals && (
        vitals.bpSystolic != null || vitals.spo2 != null ||
        vitals.heartRate != null  || vitals.weightKg != null)) {
    return (
      <div className="flex items-center gap-1.5 -mt-1 mb-2 text-[10px] text-emerald-600 dark:text-emerald-400">
        <Activity className="w-3 h-3" />
        Recorded
        {recordedByName && <span className="text-slate-500 dark:text-[#888]">by {recordedByName}</span>}
        {recordedAt && <span className="text-slate-400 dark:text-[#666] tabular-nums">· {new Date(recordedAt).toLocaleString()}</span>}
      </div>
    );
  }
  if (status === "loading") {
    return (
      <div className="flex items-center gap-1.5 -mt-1 mb-2 text-[10px] text-slate-500 dark:text-[#888]">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading vitals…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5 -mt-1 mb-2 text-[10px] text-amber-600 dark:text-amber-400">
        <AlertCircle className="w-3 h-3" /> Failed to load vitals
      </div>
    );
  }
  // status === "loaded" but no row → nurse hasn't triaged this appointment yet.
  return (
    <div className="flex items-center gap-1.5 -mt-1 mb-2 text-[10px] text-slate-400 dark:text-[#666]">
      <Activity className="w-3 h-3" /> Vitals not recorded yet
    </div>
  );
}

function PastRecordCard({ record }) {
  const typeLabel = record.historyType || "RECORD";
  const date = record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "";
  const summary = (record.description || "").split("\n")[0] || "—";
  return (
    <div className="rounded-md border border-slate-100 dark:border-[#1c1c1c] bg-slate-50/60 dark:bg-[#141414] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
          {typeLabel}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-[#666] tabular-nums">{date}</span>
      </div>
      <p className="text-[11px] text-slate-600 dark:text-[#bbb] line-clamp-2" title={summary}>
        {summary}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// TAB BAR
// ────────────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, drugCount, labCount }) {
  return (
    <div className="shrink-0 px-6 pt-4 border-b border-slate-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0f0f0f]">
      <div className="flex items-end gap-1">
        <TabButton active={tab === "consult"} onClick={() => setTab("consult")}
                   icon={<Stethoscope className="w-3.5 h-3.5" />} label="Consultation" />
        <TabButton active={tab === "rx"} onClick={() => setTab("rx")}
                   icon={<Pill className="w-3.5 h-3.5" />} label="Prescription" count={drugCount} />
        <TabButton active={tab === "lab"} onClick={() => setTab("lab")}
                   icon={<FlaskConical className="w-3.5 h-3.5" />} label="Lab Tests" count={labCount} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 -mb-px border-b-2 text-xs font-semibold transition-colors ${
        active
          ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-white"
      }`}
    >
      {icon}{label}
      {count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
          {count}
        </span>
      )}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// TABS
// ────────────────────────────────────────────────────────────────────────
function ConsultTab({ draft }) {
  return (
    <div className="px-7 py-6 space-y-6 max-w-4xl">
      <Section icon={<ClipboardList className="w-3.5 h-3.5" />} title="Chief complaint" hint="What brought the patient in today">
        <textarea
          rows={2}
          value={draft.chiefComplaint}
          onChange={e => draft.setChiefComplaint(e.target.value)}
          placeholder="e.g. Fever for 3 days, dry cough since yesterday"
          className="consult-textarea"
        />
      </Section>

      <Section icon={<FileText className="w-3.5 h-3.5" />} title="Doctor's notes" hint="Examination findings, diagnosis, plan">
        <textarea
          rows={8}
          value={draft.notes}
          onChange={e => draft.setNotes(e.target.value)}
          placeholder="Subjective, objective, assessment, plan…"
          className="consult-textarea"
        />
      </Section>

      <Section icon={<ListChecks className="w-3.5 h-3.5" />} title="Instructions for patient" hint="Diet, rest, when to come back">
        <textarea
          rows={4}
          value={draft.instructions}
          onChange={e => draft.setInstructions(e.target.value)}
          placeholder="e.g. Plenty of fluids. Return immediately if breathing worsens."
          className="consult-textarea"
        />
      </Section>

      <Section icon={<CalendarClock className="w-3.5 h-3.5" />} title="Next visit" hint="Optional follow-up reminder">
        <input
          type="datetime-local"
          value={draft.nextVisitDate}
          onChange={e => draft.setNextVisitDate(e.target.value)}
          className="consult-input max-w-sm"
        />
      </Section>
    </div>
  );
}

function RxTab({ draft }) {
  return (
    <div className="px-7 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#ccc]">
            <Pill className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Prescription
            {draft.drugCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                {draft.drugCount} drug{draft.drugCount === 1 ? "" : "s"}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-[#777] mt-0.5">
            Leave empty for a notes-only consultation
          </p>
        </div>
        <button
          type="button"
          onClick={draft.addItem}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add drug
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
      <div className="px-7 py-6 text-sm text-slate-500 dark:text-[#888] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading lab orders…
      </div>
    );
  }
  if (!orders || orders.length === 0) {
    return (
      <div className="px-7 py-16 text-center">
        <FlaskConical className="w-10 h-10 text-slate-300 dark:text-[#333] mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700 dark:text-[#ccc]">No lab orders for this patient</p>
        <p className="text-xs text-slate-400 dark:text-[#666] mt-1">
          Imaging / lab orders placed for this patient will appear here once raised.
        </p>
      </div>
    );
  }
  return (
    <div className="px-7 py-6 max-w-5xl">
      <div className="rounded-lg border border-slate-200 dark:border-[#1c1c1c] overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-[#141414] border-b border-slate-100 dark:border-[#1c1c1c] text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
          <div className="col-span-5">Investigation</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-3">Date</div>
          <div className="col-span-1 text-right">View</div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-[#1c1c1c]">
          {orders.map(order => (
            <div key={order.id} className="grid grid-cols-12 gap-2 items-center px-4 py-3 bg-white dark:bg-[#0f0f0f]">
              <div className="col-span-5">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {order.serviceName || order.investigationName || "—"}
                </p>
                {order.modality && (
                  <p className="text-[10px] text-slate-400 dark:text-[#666] mt-0.5">{order.modality}</p>
                )}
              </div>
              <div className="col-span-3">
                <StatusPill status={order.status} />
              </div>
              <div className="col-span-3 text-xs text-slate-500 dark:text-[#888] tabular-nums">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
              </div>
              <div className="col-span-1 text-right">
                {order.reportUrl || order.reportId ? (
                  <a
                    href={order.reportUrl || `/radiology/reports/${order.reportId}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileBarChart className="w-3 h-3" /> Report
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-300 dark:text-[#444]">—</span>
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${cls}`}>
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
    <div className="shrink-0 border-t border-slate-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0f0f0f] px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <AutosaveIndicator status={autosaveStatus} hydrating={hydrating} />
        {current?.patientName && (
          <span className="text-[11px] text-slate-400 dark:text-[#666] truncate">
            · {current.patientName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst || saving}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-[#ccc] bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1a] dark:hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>

        <span className="px-3 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-[#aaa] bg-slate-50 dark:bg-[#141414] border border-slate-100 dark:border-[#1c1c1c] tabular-nums min-w-[68px] text-center">
          {index + 1} / {total}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={isLast || saving}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-[#ccc] bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1a] dark:hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onSaveAndNext}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {isLast ? "Save Consultation" : "Save & Next"}
        </button>

        <button
          type="button"
          onClick={onExit}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-[#888] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Exit
        </button>
      </div>
    </div>
  );
}

function AutosaveIndicator({ status, hydrating }) {
  if (hydrating) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#888]">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading draft…
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#888]">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving draft…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <Save className="w-3 h-3" /> Draft saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <AlertCircle className="w-3 h-3" /> Autosave failed
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400 dark:text-[#666]">Draft autosaves as you type</span>;
}

// ────────────────────────────────────────────────────────────────────────
// SHARED
// ────────────────────────────────────────────────────────────────────────
function Section({ icon, title, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#ccc]">
          <span className="text-slate-400 dark:text-[#666]">{icon}</span>
          {title}
        </h3>
        {hint && (
          <span className="text-[10px] text-slate-400 dark:text-[#666] normal-case font-normal">
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
