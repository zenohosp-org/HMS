import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
  appointmentsApi, doctorsApi, recordApi, radiologyApi, externalResultsApi,
} from "@/utils/api";
import { useConsultationDraft } from "@/hooks/useConsultationDraft";
import { fmtId } from "@/utils/idFormat";
import { PrescriptionDrugRow } from "@/components/prescription/PrescriptionDrugRow";
import PastRecordDetailModal from "@/components/modals/PastRecordDetailModal";
import {
  Stethoscope, Pill, FlaskConical, ChevronLeft, ChevronRight, LogOut,
  CalendarClock, Loader2, CheckCircle2, Save, AlertCircle, ClipboardList,
  FileText, ListChecks, Plus, IdCard, Droplet, HeartPulse, Scale, Wind,
  Activity, FileBarChart, Clock, User as UserIcon,
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
  const [externalResults, setExternalResults] = useState([]);
  const [loadingExternal, setLoadingExternal] = useState(false);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingLabs, setLoadingLabs] = useState(false);
  // Currently-opened past record card → drives the read-only detail
  // modal. Cleared when the modal closes or the doctor navigates
  // patients (so a stale row from the previous chart can't linger).
  const [openedPastRecord, setOpenedPastRecord] = useState(null);

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
    // Close any past-record modal left over from the previous patient
    // so the doctor never sees an unrelated chart's row hanging around.
    setOpenedPastRecord(null);
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

  // Outside-clinic results captured at triage by front-desk / nursing
  // staff, plus anything the doctor has typed in during the consultation.
  // Scoped to this appointment so prior-visit reports don't clutter the
  // tab — the Patient Details rollup is the place for full history.
  useEffect(() => {
    let cancelled = false;
    if (!current?.id || !user?.hospitalId) {
      setExternalResults([]);
      return () => { cancelled = true; };
    }
    setLoadingExternal(true);
    externalResultsApi.listForAppointment(current.id, user.hospitalId)
      .then(rows => {
        if (cancelled) return;
        setExternalResults(Array.isArray(rows) ? rows : []);
      })
      .catch(() => { if (!cancelled) setExternalResults([]); })
      .finally(() => { if (!cancelled) setLoadingExternal(false); });
    return () => { cancelled = true; };
  }, [current?.id, user?.hospitalId]);

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

  // Mark Complete = save the consultation record + finalise the
  // appointment in one click. onSaved (from the hook) removes the
  // patient from the queue; here we additionally fire the status
  // transition so the dashboard reflects COMPLETED and the print
  // action becomes visible. The status update is best-effort —
  // the consultation record is the source of truth, so a network
  // hiccup on the status PUT only delays the dashboard refresh,
  // never the saved record itself.
  const handleMarkComplete = useCallback(async () => {
    if (!current?.id) return;
    const apptId = current.id;
    const created = await draft.saveConsultation();
    if (!created) return;
    setTab("consult");
    try {
      await appointmentsApi.updateStatus(apptId, "COMPLETED");
    } catch (err) {
      notify(
        err?.response?.data?.message
        || "Consultation saved, but the appointment status didn't update — dashboard will refresh on next load",
        "warning",
      );
    }
  }, [draft, current?.id, notify]);

  const handleExit = useCallback(() => navigate("/appointments"), [navigate]);

  // ── Render gates ─────────────────────────────────────────────────────
  if (loadingQueue) {
    return (
      <div className="hms-cv-loading">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading today's queue…
      </div>
    );
  }
  if (queue.length === 0) {
    return (
      <div className="hms-cv-empty">
        <div className="hms-cv-empty__icon">
          <CalendarClock className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <h2 className="hms-cv-empty__title">No active appointments today</h2>
          <p className="hms-cv-empty__desc">
            {user?.role === "doctor"
              ? "There are no checked-in or in-progress patients in your queue right now."
              : "There are no checked-in or in-progress patients in the hospital queue right now."}
          </p>
        </div>
        <button onClick={handleExit} className="hms-btn-secondary mt-2">
          <LogOut className="w-4 h-4" /> Back to Appointments
        </button>
      </div>
    );
  }

  return (
    <div className="hms-cv">
      <LeftPanel
        appointment={current}
        vitals={draft.vitals}
        vitalsStatus={draft.vitalsStatus}
        pastRecords={pastRecords}
        loadingPast={loadingPast}
        onStartConsultation={handleStartConsultation}
        onOpenPastRecord={setOpenedPastRecord}
      />

      <section className="hms-cv-main">
        <TopActionBar
          autosaveStatus={draft.autosaveStatus}
          hydrating={draft.hydrating}
          saving={draft.saving}
          onMarkComplete={handleMarkComplete}
        />
        <TabBar tab={tab} setTab={setTab} drugCount={draft.drugCount} labCount={labOrders.length + externalResults.length} />

        <div className="hms-cv-tab-body">
          {tab === "consult" && <ConsultTab draft={draft} />}
          {tab === "rx" && <RxTab draft={draft} />}
          {tab === "lab" && <LabTab orders={labOrders} loading={loadingLabs} externalResults={externalResults} loadingExternal={loadingExternal} />}
        </div>

        <BottomBar
          index={index}
          total={queue.length}
          saving={draft.saving}
          onPrev={goPrev}
          onNext={goNext}
          onExit={handleExit}
        />
      </section>

      {openedPastRecord && (
        <PastRecordDetailModal
          record={openedPastRecord}
          onClose={() => setOpenedPastRecord(null)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// LEFT RAIL — patient identity, vitals, past records
// ────────────────────────────────────────────────────────────────────────
function LeftPanel({ appointment, vitals, vitalsStatus, pastRecords, loadingPast, onStartConsultation, onOpenPastRecord }) {
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
    <aside className="hms-cv-aside">
      <div className="hms-cv-aside__inner">

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
          <div>
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
          <div className="hms-cv-blood">
            <div className="hms-cv-blood__left">
              <div className="hms-cv-blood__icon">
                <Droplet className="w-4 h-4" />
              </div>
              <span className="hms-cv-blood__label">
                Blood Group
              </span>
            </div>
            <span className="hms-cv-blood__value">
              {appointment?.patientBloodGroup || "—"}
            </span>
          </div>

          <div className="hms-cv-vital-grid">
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
            <p className="hms-cv-past-loading">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </p>
          ) : pastRecords.length === 0 ? (
            <p className="hms-cv-past-empty">No prior records for this patient.</p>
          ) : (
            <div className="hms-cv-past-list">
              {pastRecords.slice(0, 5).map(rec => (
                <PastRecordCard key={rec.id} record={rec} onOpen={() => onOpenPastRecord?.(rec)} />
              ))}
              {pastRecords.length > 5 && (
                <p className="hms-cv-past-more">
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

const STATUS_TONE_MOD = {
  SCHEDULED:   "is-scheduled",
  CONFIRMED:   "is-confirmed",
  CHECKED_IN:  "is-checked-in",
  IN_PROGRESS: "is-in-progress",
  DEFAULT:     "is-default",
};

function PatientHeroCard({ name, token, status, time, onStartConsultation }) {
  const statusMod = STATUS_TONE_MOD[status] || STATUS_TONE_MOD.DEFAULT;
  const canStart = status === "CHECKED_IN";
  return (
    <div className="hms-cv-hero">
      <div>
        <p className="hms-cv-hero__name">{name}</p>
        <div className="hms-cv-hero__meta">
          {token != null && (
            <span className="hms-cv-hero__token">
              #{token}
            </span>
          )}
          {time && (
            <span className="hms-cv-hero__time">
              {time.substring(0, 5)}
            </span>
          )}
          {status && (
            <span className={`hms-cv-hero__status ${statusMod}`}>
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
          className="hms-cv-hero__start"
        >
          <PlayCircle className="w-4 h-4" />
          Start Consultation
        </button>
      )}
      {status === "IN_PROGRESS" && (
        <div className="hms-cv-hero__in-progress">
          <Activity className="w-4 h-4" />
          Consultation in progress
        </div>
      )}
    </div>
  );
}

function SidebarSection({ title, trailing, children }) {
  return (
    <div className="hms-cv-sec">
      <div className="hms-cv-sec__head">
        <h3 className="hms-cv-sec__title">
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
    <div className="hms-cv-row">
      <span className="hms-cv-row__label">
        <span className="hms-cv-row__label-icon">{icon}</span>
        {label}
      </span>
      <span className={`hms-cv-row__value ${mono ? "is-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function VitalTile({ icon, label, value, unit, tone }) {
  return (
    <div className={`hms-cv-vital-tile is-${tone}`}>
      <div className="hms-cv-vital-tile__head">
        <span className="hms-cv-vital-tile__icon">{icon}</span>
        <span className="hms-cv-vital-tile__label">
          {label}
        </span>
      </div>
      <div className="hms-cv-vital-tile__value-row">
        <span className="hms-cv-vital-tile__value">{value}</span>
        <span className="hms-cv-vital-tile__unit">{unit}</span>
      </div>
    </div>
  );
}

function VitalsStateHint({ status, vitals, recordedByName, recordedAt }) {
  if (status === "loaded" && vitals && (
        vitals.bpSystolic != null || vitals.spo2 != null ||
        vitals.heartRate != null  || vitals.weightKg != null)) {
    return (
      <span className="hms-cv-vital-state is-ok" title={[recordedByName, recordedAt && new Date(recordedAt).toLocaleString()].filter(Boolean).join(" · ")}>
        <Activity className="w-3 h-3" /> Recorded
      </span>
    );
  }
  if (status === "loading") {
    return (
      <span className="hms-cv-vital-state is-loading">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="hms-cv-vital-state is-error">
        <AlertCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return (
    <span className="hms-cv-vital-state is-neutral">
      <Activity className="w-3 h-3" /> Not recorded
    </span>
  );
}

function PastRecordCard({ record, onOpen }) {
  const typeLabel = record.historyType || "RECORD";
  const date = record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "";
  // The consultation modal stores "Chief complaint: …" as the first
  // line of description; surfacing it in the card preview means the
  // doctor sees the most relevant scrap before clicking through.
  const firstLine = (record.description || "").split("\n")[0] || "";
  const ccMatch = /^Chief complaint:\s*(.+)$/i.exec(firstLine);
  const summary = ccMatch ? ccMatch[1] : (firstLine || "—");
  const drugCount = Array.isArray(record.prescriptionItems) ? record.prescriptionItems.length : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hms-cv-past-card"
    >
      <div className="hms-cv-past-card__head">
        <div className="hms-cv-past-card__chips">
          <span className="hms-cv-past-card__type">
            {typeLabel}
          </span>
          {drugCount > 0 && (
            <span className="hms-cv-past-card__rx-count">
              {drugCount} Rx
            </span>
          )}
        </div>
        <span className="hms-cv-past-card__date">{date}</span>
      </div>
      <p className="hms-cv-past-card__summary" title={summary}>
        {summary}
      </p>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// TABS
// ────────────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, drugCount, labCount }) {
  return (
    <div className="hms-cv-tabs">
      <div className="hms-cv-tabs__row">
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
      className={`hms-cv-tab-btn ${active ? "is-active" : ""}`}
    >
      {icon}{label}
      {count > 0 && (
        <span className="hms-cv-tab-count">
          {count}
        </span>
      )}
    </button>
  );
}

function ConsultTab({ draft }) {
  return (
    <div className="hms-cv-pane">
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
    <div className="hms-cv-pane">
      <div className="hms-cv-rx-head">
        <div>
          <h3 className="hms-cv-rx-head__title">
            <Pill className="w-4 h-4 hms-cv-rx-head__title-icon" />
            Prescription
            {draft.drugCount > 0 && (
              <span className="hms-cv-rx-head__count">
                {draft.drugCount} drug{draft.drugCount === 1 ? "" : "s"}
              </span>
            )}
          </h3>
          <p className="hms-cv-rx-head__hint">
            Leave empty for a notes-only consultation
          </p>
        </div>
        <button
          type="button"
          onClick={draft.addItem}
          className="hms-cv-rx-add-btn"
        >
          <Plus className="w-4 h-4" /> Add drug
        </button>
      </div>

      <div className="hms-cv-rx-list">
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

function LabTab({ orders, loading, externalResults, loadingExternal }) {
  const hasInternal = !loading && orders && orders.length > 0;
  const hasExternal = !loadingExternal && externalResults && externalResults.length > 0;

  if (loading && loadingExternal) {
    return (
      <div className="hms-cv-loading-row">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading lab results…
      </div>
    );
  }

  if (!hasInternal && !hasExternal && !loading && !loadingExternal) {
    return (
      <div className="hms-cv-lab-empty">
        <div className="hms-cv-lab-empty__icon">
          <FlaskConical className="w-5 h-5" />
        </div>
        <p className="hms-cv-lab-empty__title">No lab results yet</p>
        <p className="hms-cv-lab-empty__desc">
          Outside-clinic reports go in at check-in from the appointments dashboard.
          Internal radiology orders show up here once raised.
        </p>
      </div>
    );
  }

  return (
    <div className="hms-cv-pane">
      {/* External Results — top because outside-clinic reports usually
          drive immediate clinical decisions and the doctor is reading
          left-to-right from this column first. */}
      <ExternalResultsSection rows={externalResults} loading={loadingExternal} />

      {hasExternal && hasInternal && (
        <div className="hms-cv-lab-divider" />
      )}

      {/* Internal radiology — the existing radiologyApi.getByPatient data. */}
      {(hasInternal || loading) && (
        <InternalRadiologySection orders={orders} loading={loading} />
      )}
    </div>
  );
}

function ExternalResultsSection({ rows, loading }) {
  if (loading) {
    return (
      <div>
        <SectionHeading
          icon={<FlaskConical className="w-4 h-4" />}
          title="External Results"
          hint="Captured from outside labs / clinics"
        />
        <div className="hms-cv-loading-row">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading external results…
        </div>
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div>
        <SectionHeading
          icon={<FlaskConical className="w-4 h-4" />}
          title="External Results"
          hint="Captured from outside labs / clinics"
        />
        <p className="hms-cv-empty-row">
          Nothing recorded yet for this patient.
        </p>
      </div>
    );
  }
  return (
    <div>
      <SectionHeading
        icon={<FlaskConical className="w-4 h-4" />}
        title="External Results"
        count={rows.length}
        hint="Captured from outside labs / clinics"
        tone="violet"
      />
      <div className="hms-cv-ext-grid">
        {rows.map(r => <ExternalResultCard key={r.id} result={r} />)}
      </div>
    </div>
  );
}

function ExternalResultCard({ result }) {
  const categoryMod =
    result.category === "LAB"        ? "is-lab" :
    result.category === "RADIOLOGY"  ? "is-radiology" :
    result.category === "PATHOLOGY"  ? "is-pathology" :
    "is-other";
  const testDate = result.testDate
    ? new Date(result.testDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  return (
    <div className="hms-cv-ext-card">
      <div className="hms-cv-ext-card__head">
        <div className="hms-cv-ext-card__chips">
          <span className={`hms-cv-ext-cat ${categoryMod}`}>
            {result.category}
          </span>
          {result.isAbnormal && (
            <span className="hms-cv-ext-abnormal">
              ⚠ Abnormal
            </span>
          )}
        </div>
        <span className="hms-cv-ext-card__date">{testDate}</span>
      </div>
      <h4 className="hms-cv-ext-card__test">{result.testName}</h4>
      <p className="hms-cv-ext-card__src">
        {result.sourceName}
        {result.sourceDoctorName && <span className="hms-cv-ext-card__src-sep"> · {result.sourceDoctorName}</span>}
      </p>
      {(result.resultValue || result.resultUnit) && (
        <div className="hms-cv-ext-card__values">
          <span className="hms-cv-ext-card__value">{result.resultValue || "—"}</span>
          {result.resultUnit && <span className="hms-cv-ext-card__unit">{result.resultUnit}</span>}
          {result.referenceRange && (
            <span className="hms-cv-ext-card__ref">
              ref: {result.referenceRange}
            </span>
          )}
        </div>
      )}
      {result.notes && (
        <p className="hms-cv-ext-card__notes">
          {result.notes}
        </p>
      )}
    </div>
  );
}

function InternalRadiologySection({ orders, loading }) {
  if (loading) {
    return (
      <div>
        <SectionHeading
          icon={<ScanIcon />}
          title="Internal Radiology"
          hint="Orders raised inside HMS"
        />
        <div className="hms-cv-loading-row">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }
  return (
    <div>
      <SectionHeading
        icon={<ScanIcon />}
        title="Internal Radiology"
        count={orders.length}
        hint="Orders raised inside HMS"
        tone="blue"
      />
      <div className="hms-cv-rad-table">
        <div className="hms-cv-rad-head">
          <div className="hms-cv-rad-head__col-5">Investigation</div>
          <div className="hms-cv-rad-head__col-3">Status</div>
          <div className="hms-cv-rad-head__col-3">Date</div>
          <div className="hms-cv-rad-head__col-1">Report</div>
        </div>
        <div className="hms-cv-rad-body">
          {orders.map(order => (
            <div key={order.id} className="hms-cv-rad-row">
              <div className="hms-cv-rad-head__col-5">
                <p className="hms-cv-rad-row__name">
                  {order.serviceName || order.investigationName || "—"}
                </p>
                {order.modality && (
                  <p className="hms-cv-rad-row__mod">{order.modality}</p>
                )}
              </div>
              <div className="hms-cv-rad-head__col-3"><StatusPill status={order.status} /></div>
              <div className="hms-cv-rad-head__col-3 hms-cv-rad-row__date">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
              </div>
              <div className="hms-cv-rad-head__col-1 hms-cv-rad-row__report-cell">
                {order.reportUrl || order.reportId ? (
                  <a
                    href={order.reportUrl || `/radiology/reports/${order.reportId}`}
                    className="hms-cv-rad-row__report-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileBarChart className="w-3 h-3" /> Open
                  </a>
                ) : (
                  <span className="hms-cv-rad-row__report-empty">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon, title, count, hint, tone }) {
  const toneMod = tone === "violet" ? "is-violet" : tone === "blue" ? "is-blue" : "";
  return (
    <div className="hms-cv-sheading">
      <div className="hms-cv-sheading__left">
        <span className={`hms-cv-sheading__icon ${toneMod}`}>{icon}</span>
        <h3 className="hms-cv-sheading__title">
          {title}
        </h3>
        {count > 0 && (
          <span className={`hms-cv-sheading__count ${toneMod}`}>
            {count}
          </span>
        )}
      </div>
      {hint && (
        <span className="hms-cv-sheading__hint">
          {hint}
        </span>
      )}
    </div>
  );
}

// Tiny inline SVG icon so we don't drag another import in for one place.
function ScanIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function StatusPill({ status }) {
  const map = {
    PENDING_SCAN:    "is-pending",
    AWAITING_REPORT: "is-awaiting",
    REPORTED:        "is-reported",
    BILLED:          "is-billed",
    CANCELLED:       "is-cancelled",
  };
  const mod = map[status] || "is-default";
  return (
    <span className={`hms-cv-rad-status ${mod}`}>
      {(status || "—").replace(/_/g, " ")}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────
// TOP ACTION BAR — Mark Complete (left) + autosave status (right)
// ────────────────────────────────────────────────────────────────────────
// Sits directly under FocusLayout's header so the primary action is
// always at the top-left thumb-zone, and the autosave reassurance is
// always at the top-right where the eye expects status to live.
function TopActionBar({ autosaveStatus, hydrating, saving, onMarkComplete }) {
  return (
    <div className="hms-cv-top">
      <button
        type="button"
        onClick={onMarkComplete}
        disabled={saving}
        className="hms-cv-complete-btn"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Mark Complete
      </button>
      <AutosaveIndicator status={autosaveStatus} hydrating={hydrating} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// BOTTOM BAR — queue navigation only. Finalisation moved to TopActionBar.
// ────────────────────────────────────────────────────────────────────────
function BottomBar({ index, total, saving, onPrev, onNext, onExit }) {
  const isFirst = index <= 0;
  const isLast = index >= total - 1;
  return (
    <div className="hms-cv-bottom">
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst || saving}
        className="hms-cv-nav-btn"
      >
        <ChevronLeft className="w-4 h-4" /> Previous
      </button>

      <span className="hms-cv-pager">
        {index + 1} <span className="hms-cv-pager__sep">/ {total}</span>
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={isLast || saving}
        className="hms-cv-nav-btn"
      >
        Next <ChevronRight className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onExit}
        disabled={saving}
        className="hms-cv-exit-btn"
      >
        <LogOut className="w-4 h-4" /> Exit
      </button>
    </div>
  );
}

function AutosaveIndicator({ status, hydrating }) {
  if (hydrating) {
    return (
      <span className="hms-cv-autosave is-hydrating">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading draft…
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="hms-cv-autosave is-saving">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving draft…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="hms-cv-autosave is-saved">
        <Save className="w-3 h-3" /> Draft saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="hms-cv-autosave is-error">
        <AlertCircle className="w-3 h-3" /> Autosave failed
      </span>
    );
  }
  return <span className="hms-cv-autosave is-idle">Draft autosaves as you type</span>;
}

// ────────────────────────────────────────────────────────────────────────
// SHARED
// ────────────────────────────────────────────────────────────────────────
function Section({ icon, title, hint, children }) {
  return (
    <div className="hms-cv-section">
      <div className="hms-cv-section__head">
        <h3 className="hms-cv-section__title">
          <span className="hms-cv-section__title-icon">{icon}</span>
          {title}
        </h3>
        {hint && (
          <span className="hms-cv-section__hint">
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
