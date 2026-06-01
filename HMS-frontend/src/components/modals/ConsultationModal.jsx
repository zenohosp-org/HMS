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
    <div className="hms-cmodal-overlay">
      <div className="hms-cmodal is-full">

        {/* ── Header: title row + 4-column meta strip + vitals strip ─── */}
        <div className="hms-cmodal__header">
          <div className="hms-cmodal__header-row">
            <div className="hms-cmodal__title-block">
              <div className="hms-icon-tile is-info">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="hms-cmodal__title">Consultation</h2>
                <p className="hms-cmodal__subtitle">
                  Auto-opened on check-in · saves to the patient record
                </p>
              </div>
            </div>
            {appointment?.tokenNumber != null && (
              <span className="hms-badge is-neutral is-soft">
                Token #{appointment.tokenNumber}
              </span>
            )}
          </div>

          <div className="hms-cmodal__meta is-4col">
            <PreField icon={<UserIcon className="w-3.5 h-3.5" />} label="Patient" value={patientFullName || "—"} />
            <PreField icon={<IdCard className="w-3.5 h-3.5" />} label="UHID" value={uhidDisplay} mono />
            <PreField icon={<Stethoscope className="w-3.5 h-3.5" />} label="Doctor" value={appointment?.doctorName || "—"} />
            <PreField icon={<CalendarClock className="w-3.5 h-3.5" />} label="Date & time" value={dateTimeText || "—"} />
          </div>

          <VitalsStrip vitals={vitals} vitalsStatus={vitalsStatus} bloodGroup={appointment?.patientBloodGroup} />
        </div>

        {/* ── Body: clinical (left, wider) + prescription (right) ─────── */}
        <div className="hms-cmodal__body is-flush">
          <div className="hms-consult-body">

            <div className="hms-consult-body__main">
              <Section icon={<ClipboardList className="w-3.5 h-3.5" />} title="Chief complaint" hint="What brought the patient in today">
                <textarea
                  rows={2}
                  value={chiefComplaint}
                  onChange={e => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Fever for 3 days, dry cough since yesterday"
                  className="hms-clinical-textarea"
                />
              </Section>

              <Section icon={<FileText className="w-3.5 h-3.5" />} title="Doctor's notes" hint="Examination findings, diagnosis, plan">
                <textarea
                  rows={7}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Subjective, objective, assessment, plan…"
                  className="hms-clinical-textarea"
                />
              </Section>

              <Section icon={<ListChecks className="w-3.5 h-3.5" />} title="Instructions for patient" hint="Diet, rest, when to come back">
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="e.g. Plenty of fluids. Return immediately if breathing worsens."
                  className="hms-clinical-textarea"
                />
              </Section>

              <Section icon={<CalendarClock className="w-3.5 h-3.5" />} title="Next visit" hint="Optional follow-up reminder">
                <input
                  type="datetime-local"
                  value={nextVisitDate}
                  onChange={e => setNextVisitDate(e.target.value)}
                  className="hms-clinical-input"
                />
              </Section>
            </div>

            <div className="hms-consult-body__aside">
              <div className="hms-rx-head">
                <div>
                  <h3 className="hms-rx-head__title">
                    <span className="hms-rx-head__icon"><Pill className="w-3.5 h-3.5" /></span>
                    Prescription
                    {drugCount > 0 && (
                      <span className="hms-rx-head__count">
                        {drugCount} drug{drugCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </h3>
                  <p className="hms-rx-head__hint">
                    Leave empty for a notes-only consultation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="hms-rx-add-btn"
                >
                  <Plus className="w-3.5 h-3.5" /> Add drug
                </button>
              </div>

              <div className="hms-rx-list">
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
        <div className="hms-consult-footer">
          <AutosaveIndicator status={autosaveStatus} hydrating={hydrating} />
          <div className="hms-consult-footer__actions">
            <button type="button" onClick={onClose} disabled={saving} className="hms-btn-cancel">
              Cancel
            </button>
            <button type="button" onClick={saveConsultation} disabled={saving} className="hms-btn-primary">
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
    <div className="hms-vitals-strip">
      <div className="hms-vitals-strip__label">
        <Activity className="w-3 h-3" /> Vitals
      </div>
      <VitalChip icon={<Droplet className="w-3 h-3" />} iconTone="rose" label="Blood" value={bloodGroup || "—"} />
      <VitalChip icon={<HeartPulse className="w-3 h-3" />} iconTone="rose" label="BP" value={bp || placeholder} unit={bp ? "mmHg" : null} />
      <VitalChip icon={<Wind className="w-3 h-3" />} iconTone="blue" label="SpO₂" value={spo2 || placeholder} />
      <VitalChip icon={<HeartPulse className="w-3 h-3" />} iconTone="emerald" label="Pulse" value={hr || placeholder} />
      <VitalChip icon={<Scale className="w-3 h-3" />} iconTone="amber" label="Weight" value={wt || placeholder} />
      <span className="hms-vitals-strip__trailing">
        {trailing}
      </span>
    </div>
  );
}

function VitalChip({ icon, iconTone, label, value, unit }) {
  return (
    <div className="hms-vital-chip">
      <span className={`hms-vital-chip__icon is-${iconTone}`}>{icon}</span>
      <span className="hms-vital-chip__label">
        {label}
      </span>
      <span className="hms-vital-chip__value">
        {value}
        {unit && <span className="hms-vital-chip__unit">{unit}</span>}
      </span>
    </div>
  );
}

function PreField({ icon, label, value, mono }) {
  return (
    <div className="hms-meta-field">
      <div className="hms-meta-field__label">
        {icon}
        {label}
      </div>
      <p className={`hms-meta-field__value${mono ? " is-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Section({ icon, title, hint, children }) {
  return (
    <div className="hms-clinical-section">
      <div className="hms-clinical-section__head">
        <h3 className="hms-clinical-section__title">
          <span className="hms-clinical-section__title-icon">{icon}</span>
          {title}
        </h3>
        {hint && (
          <span className="hms-clinical-section__hint">
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
      <span className="hms-autosave is-hydrating">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading draft…
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="hms-autosave is-saving">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving draft…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="hms-autosave is-saved">
        <Save className="w-3 h-3" />
        Draft saved — safe to close and resume later
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="hms-autosave is-error">
        <AlertCircle className="w-3 h-3" />
        Autosave failed — your changes are only in this tab
      </span>
    );
  }
  return <span className="hms-autosave">Draft autosaves as you type</span>;
}
