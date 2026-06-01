import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { fmtId } from "@/utils/idFormat";
import {
  Stethoscope, Pill, Plus, Loader2, CheckCircle2, ClipboardList,
  CalendarClock, FileText, ListChecks, Save, AlertCircle,
  User as UserIcon, IdCard, Activity, HeartPulse, Wind, Scale, Droplet,
} from "lucide-react";
import { PrescriptionDrugRow } from "@/components/prescription/PrescriptionDrugRow";
import { useConsultationDraft } from "@/hooks/useConsultationDraft";

/**
 * Single-flow consultation page launched after an OPD appointment hits
 * IN_PROGRESS (or via "Open Consultation" on a CHECKED_IN+ row). Form
 * state, vitals fetch, draft hydration, autosave, and the save handler
 * all live in useConsultationDraft so this modal and the queue-walked
 * ConsultationViewPage share one implementation.
 */
export default function ConsultationModal({ appointment, onClose, onSaved }) {
  const { user } = useAuth();
  const { notify } = useNotification();

  const {
    chiefComplaint, setChiefComplaint,
    notes, setNotes,
    instructions, setInstructions,
    nextVisitDate, setNextVisitDate,
    items, setItemField, addItem, removeItem,
    drugCount, vitals, vitalsStatus, hydrating, autosaveStatus, saving,
    saveConsultation,
  } = useConsultationDraft({
    appointment,
    hospitalId: user?.hospitalId,
    notify,
    onSaved,
  });

  const apptDate = appointment?.apptDate || "";
  const apptTime = appointment?.apptTime ? appointment.apptTime.substring(0, 5) : "";
  const dateTimeText = [apptDate, apptTime].filter(Boolean).join(" · ");
  const patientFullName =
    appointment?.patientName ||
    [appointment?.patientFirstName, appointment?.patientLastName].filter(Boolean).join(" ");
  const uhidDisplay = fmtId(appointment?.patientUhid) || appointment?.patientUhid || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm pointer-events-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-8xl max-h-[96vh] border border-slate-200 flex flex-col overflow-hidden">

        {/* ── Header: title row + 4-column meta strip + vitals strip ─── */}
        <div className="shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Consultation</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Auto-opened on check-in · saves to the patient record
                </p>
              </div>
            </div>
            {appointment?.tokenNumber != null && (
              <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                Token #{appointment.tokenNumber}
              </span>
            )}
          </div>

          <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-100 bg-slate-50/60">
            <PreField icon={<UserIcon className="w-3.5 h-3.5" />} label="Patient" value={patientFullName || "—"} />
            <PreField icon={<IdCard className="w-3.5 h-3.5" />} label="UHID" value={uhidDisplay} mono />
            <PreField icon={<Stethoscope className="w-3.5 h-3.5" />} label="Doctor" value={appointment?.doctorName || "—"} />
            <PreField icon={<CalendarClock className="w-3.5 h-3.5" />} label="Date & time" value={dateTimeText || "—"} />
          </div>

          <VitalsStrip vitals={vitals} vitalsStatus={vitalsStatus} bloodGroup={appointment?.patientBloodGroup} />
        </div>

        {/* ── Body: clinical (left, wider) + prescription (right) ─────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

            <div className="lg:col-span-3 px-7 py-6 space-y-6">
              <Section icon={<ClipboardList className="w-3.5 h-3.5" />} title="Chief complaint" hint="What brought the patient in today">
                <textarea
                  rows={2}
                  value={chiefComplaint}
                  onChange={e => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Fever for 3 days, dry cough since yesterday"
                  className="consult-textarea"
                />
              </Section>

              <Section icon={<FileText className="w-3.5 h-3.5" />} title="Doctor's notes" hint="Examination findings, diagnosis, plan">
                <textarea
                  rows={7}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Subjective, objective, assessment, plan…"
                  className="consult-textarea"
                />
              </Section>

              <Section icon={<ListChecks className="w-3.5 h-3.5" />} title="Instructions for patient" hint="Diet, rest, when to come back">
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="e.g. Plenty of fluids. Return immediately if breathing worsens."
                  className="consult-textarea"
                />
              </Section>

              <Section icon={<CalendarClock className="w-3.5 h-3.5" />} title="Next visit" hint="Optional follow-up reminder">
                <input
                  type="datetime-local"
                  value={nextVisitDate}
                  onChange={e => setNextVisitDate(e.target.value)}
                  className="consult-input"
                />
              </Section>
            </div>

            <div className="lg:col-span-2 px-6 py-6 bg-slate-50/40">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Pill className="w-3.5 h-3.5 text-emerald-600" />
                    Prescription
                    {drugCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {drugCount} drug{drugCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Leave empty for a notes-only consultation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add drug
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <PrescriptionDrugRow
                    key={item.key}
                    index={idx}
                    item={item}
                    onChange={(field, value) => setItemField(item.key, field, value)}
                    onRemove={() => removeItem(item.key)}
                    isLastRemovable={items.length > 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="shrink-0 px-7 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
          <AutosaveIndicator status={autosaveStatus} hydrating={hydrating} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={saveConsultation} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Consultation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VitalsStrip({ vitals, vitalsStatus, bloodGroup }) {
  // While the API is in flight render an unobtrusive "…" so the strip
  // doesn't flash "—" before populating. Once vitalsStatus settles to
  // "loaded", a missing field is a deliberate "—".
  const placeholder = vitalsStatus === "loading" ? "…" : "—";
  const bp = vitals && (vitals.bpSystolic != null || vitals.bpDiastolic != null)
    ? `${vitals.bpSystolic ?? "—"}/${vitals.bpDiastolic ?? "—"}`
    : null;
  const spo2 = vitals?.spo2 != null ? `${vitals.spo2}%` : null;
  const hr = vitals?.heartRate != null ? `${vitals.heartRate} bpm` : null;
  const wt = vitals?.weightKg != null ? `${Number(vitals.weightKg).toFixed(1)} kg` : null;
  const recordedAt = vitals?.updatedAt || vitals?.recordedAt;

  let trailing;
  if (vitalsStatus === "loading") trailing = "Loading vitals…";
  else if (vitalsStatus === "error") trailing = "Failed to load vitals";
  else if (vitals) trailing = `Recorded by ${vitals.recordedByName || "—"}${recordedAt ? " · " + new Date(recordedAt).toLocaleString() : ""}`;
  else trailing = "Vitals not recorded yet";

  return (
    <div className="px-6 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-white">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
        <Activity className="w-3 h-3" /> Vitals
      </div>
      <VitalChip icon={<Droplet className="w-3 h-3 text-rose-500" />} label="Blood" value={bloodGroup || "—"} />
      <VitalChip icon={<HeartPulse className="w-3 h-3 text-rose-500" />} label="BP" value={bp || placeholder} unit={bp ? "mmHg" : null} />
      <VitalChip icon={<Wind className="w-3 h-3 text-blue-500" />} label="SpO₂" value={spo2 || placeholder} />
      <VitalChip icon={<HeartPulse className="w-3 h-3 text-emerald-500" />} label="Pulse" value={hr || placeholder} />
      <VitalChip icon={<Scale className="w-3 h-3 text-amber-500" />} label="Weight" value={wt || placeholder} />
      <span className="ml-auto text-[10px] text-slate-400">
        {trailing}
      </span>
    </div>
  );
}

function VitalChip({ icon, label, value, unit }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900 tabular-nums">
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-slate-400">{unit}</span>}
      </span>
    </div>
  );
}

function PreField({ icon, label, value, mono }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <p className={`mt-0.5 text-sm font-semibold text-slate-900 truncate ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Section({ icon, title, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
          <span className="text-slate-400">{icon}</span>
          {title}
        </h3>
        {hint && (
          <span className="text-[10px] text-slate-400 normal-case font-normal">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function AutosaveIndicator({ status, hydrating }) {
  if (hydrating) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading draft…
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving draft…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
        <Save className="w-3 h-3" />
        Draft saved — safe to close and resume later
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600">
        <AlertCircle className="w-3 h-3" />
        Autosave failed — your changes are only in this tab
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400">Draft autosaves as you type</span>;
}
