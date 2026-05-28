import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { recordApi, consultationDraftsApi, vitalsApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import {
  Stethoscope, Pill, Plus, Loader2, CheckCircle2, ClipboardList,
  CalendarClock, FileText, ListChecks, Save, AlertCircle,
  User as UserIcon, IdCard, Activity, HeartPulse, Wind, Scale, Droplet,
} from "lucide-react";
import {
  PrescriptionDrugRow,
  newBlankDrugItem,
  drugItemToRequest,
} from "@/components/prescription/PrescriptionDrugRow";

const AUTOSAVE_DELAY_MS = 1500;

/**
 * Single-flow consultation page launched after an OPD appointment is checked
 * in (or via "Open Consultation" on a CHECKED_IN+ row). Everything the doctor
 * needs to record a visit lives on one scrollable page: chief complaint,
 * notes, instructions, prescription, next visit. Persists as one
 * patient_records row:
 *   - historyType = PRESCRIPTION when the doctor added drugs (pharmacy picks
 *     it up via the by-type query)
 *   - historyType = CONSULTATION  when no drugs were added (notes-only visit)
 *
 * Linked to the appointment via appointmentId so the OPD audit trail stays
 * intact. Drafts persist via consultationDraftsApi so a closed tab doesn't
 * lose work.
 */
export default function ConsultationModal({ appointment, onClose, onSaved }) {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [chiefComplaint, setChiefComplaint] = useState(appointment?.chiefComplaint || "");
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [items, setItems] = useState([newBlankDrugItem()]);
  const [saving, setSaving] = useState(false);

  // Autosave bookkeeping. `hydrating` blocks the autosave effect until the
  // initial GET resolves so we never overwrite a fresh draft with the empty
  // first-render state. `autosaveStatus` drives the small footer indicator.
  const [hydrating, setHydrating] = useState(true);
  const [autosaveStatus, setAutosaveStatus] = useState("idle"); // idle | saving | saved | error
  const autosaveTimer = useRef(null);

  // Vitals recorded by the nurse before the doctor opened this page.
  // Read-only here — surface them in the header strip so the doctor doesn't
  // have to leave the modal to check BP / SpO2 / HR / weight.
  const [vitals, setVitals] = useState(null);

  const drugCount = useMemo(
    () => items.filter(i => i.drugName.trim().length > 0).length,
    [items],
  );

  // ── Draft hydration ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!appointment?.id) { setHydrating(false); return; }

    consultationDraftsApi.get(appointment.id)
      .then((draft) => {
        if (cancelled || !draft?.payload) return;
        try {
          const p = JSON.parse(draft.payload);
          if (typeof p.chiefComplaint === "string") setChiefComplaint(p.chiefComplaint);
          if (typeof p.notes === "string")           setNotes(p.notes);
          if (typeof p.instructions === "string")    setInstructions(p.instructions);
          if (typeof p.nextVisitDate === "string")   setNextVisitDate(p.nextVisitDate);
          if (Array.isArray(p.items) && p.items.length > 0) {
            setItems(p.items.map((it, idx) => ({
              ...newBlankDrugItem(),
              ...it,
              key: Date.now() + idx + Math.random(),
            })));
          }
        } catch { /* corrupted draft — fall back to appointment defaults */ }
      })
      .catch(() => { /* no draft / network — silent */ })
      .finally(() => { if (!cancelled) setHydrating(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment?.id]);

  // ── Vitals read ──────────────────────────────────────────────────────
  // Fire-and-forget. 204 → no vitals yet (the strip renders a "not
  // recorded" hint). Independent from draft hydration so a slow vitals
  // fetch doesn't delay the form becoming editable.
  useEffect(() => {
    let cancelled = false;
    if (!appointment?.id) return;
    vitalsApi.get(appointment.id)
      .then((v) => { if (!cancelled) setVitals(v); })
      .catch(() => { /* silent — header just shows "not recorded" */ });
    return () => { cancelled = true; };
  }, [appointment?.id]);

  // ── Debounced autosave ───────────────────────────────────────────────
  useEffect(() => {
    if (hydrating || !appointment?.id || !user?.hospitalId) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setAutosaveStatus("saving");
      try {
        const payload = JSON.stringify({
          chiefComplaint, notes, instructions, nextVisitDate,
          items: items.map(({ key, ...rest }) => rest),
        });
        await consultationDraftsApi.upsert(appointment.id, {
          hospitalId: user.hospitalId,
          patientId: appointment.patientId,
          payload,
        });
        setAutosaveStatus("saved");
      } catch {
        setAutosaveStatus("error");
      }
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(autosaveTimer.current);
  }, [
    chiefComplaint, notes, instructions, nextVisitDate, items,
    hydrating, appointment?.id, appointment?.patientId, user?.hospitalId,
  ]);

  const setItemField = (key, field, value) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };
  const removeItem = (key) => {
    setItems(prev => prev.length === 1
      ? [newBlankDrugItem()]
      : prev.filter(i => i.key !== key));
  };
  const addItem = () => setItems(prev => [...prev, newBlankDrugItem()]);

  // Build a description that the print view can split on the leading
  // "Chief complaint:" line — keeps the record self-describing without
  // adding a separate column.
  const buildDescription = () => {
    const parts = [];
    if (chiefComplaint.trim()) parts.push(`Chief complaint: ${chiefComplaint.trim()}`);
    if (notes.trim()) parts.push(notes.trim());
    return parts.length ? parts.join("\n\n") : undefined;
  };

  const handleSave = async () => {
    if (!appointment?.patientId) {
      notify("Missing patient on appointment — cannot save", "error");
      return;
    }

    const filledDrugs = items.filter(i => i.drugName.trim().length > 0);
    for (const it of filledDrugs) {
      const qty = Number(it.quantity);
      if (!qty || qty <= 0) {
        notify(`Set a positive quantity for ${it.drugName}`, "warning");
        return;
      }
    }

    const hasAnyContent =
      chiefComplaint.trim() || notes.trim() || instructions.trim() ||
      filledDrugs.length > 0 || nextVisitDate;
    if (!hasAnyContent) {
      notify("Add notes, instructions, or a prescription before saving", "warning");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        hospitalId: user.hospitalId,
        patientId: appointment.patientId,
        // Pharmacy queries by PRESCRIPTION type — flip to that whenever the
        // doctor added drugs so dispense lists keep working.
        historyType: filledDrugs.length > 0 ? "PRESCRIPTION" : "CONSULTATION",
        description: buildDescription(),
        instructions: instructions.trim() || undefined,
        nextVisitDate: nextVisitDate || undefined,
        appointmentId: appointment.id,
        prescriptionItems: filledDrugs.length > 0
          ? filledDrugs.map((it, idx) => drugItemToRequest(it, idx))
          : undefined,
      };
      const created = await recordApi.create(payload);
      // Clean up the draft now that the consultation lives as a real record.
      clearTimeout(autosaveTimer.current);
      try { await consultationDraftsApi.remove(appointment.id); } catch { /* not fatal */ }
      notify(
        filledDrugs.length > 0
          ? `Consultation saved with ${filledDrugs.length} drug${filledDrugs.length === 1 ? "" : "s"}`
          : "Consultation saved",
        "success",
      );
      onSaved?.(created);
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to save consultation", "error");
    } finally {
      setSaving(false);
    }
  };

  const apptDate = appointment?.apptDate || "";
  const apptTime = appointment?.apptTime ? appointment.apptTime.substring(0, 5) : "";
  const dateTimeText = [apptDate, apptTime].filter(Boolean).join(" · ");
  const patientFullName =
    appointment?.patientName ||
    [appointment?.patientFirstName, appointment?.patientLastName].filter(Boolean).join(" ");
  const uhidDisplay = fmtId(appointment?.patientUhid) || appointment?.patientUhid || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm pointer-events-auto">
      <div className="bg-white dark:bg-[#0f0f0f] rounded-2xl shadow-2xl w-full max-w-8xl max-h-[96vh] border border-slate-200 dark:border-[#262626] flex flex-col overflow-hidden">

        {/* ── Header: title row + 4-column meta strip ──────────────────── */}
        <div className="shrink-0 border-b border-slate-100 dark:border-[#1c1c1c]">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Consultation</h2>
                <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5 truncate">
                  Auto-opened on check-in · saves to the patient record
                </p>
              </div>
            </div>
            {appointment?.tokenNumber != null && (
              <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-[#2a2a2a]">
                Token #{appointment.tokenNumber}
              </span>
            )}
          </div>

          {/* Pre-filled summary strip */}
          <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-100 dark:border-[#1c1c1c] bg-slate-50/60 dark:bg-[#0d0d0d]">
            <PreField icon={<UserIcon className="w-3.5 h-3.5" />} label="Patient" value={patientFullName || "—"} />
            <PreField icon={<IdCard className="w-3.5 h-3.5" />} label="UHID" value={uhidDisplay} mono />
            <PreField icon={<Stethoscope className="w-3.5 h-3.5" />} label="Doctor" value={appointment?.doctorName || "—"} />
            <PreField icon={<CalendarClock className="w-3.5 h-3.5" />} label="Date & time" value={dateTimeText || "—"} />
          </div>

          {/* Vitals strip — surfaces the nurse's triage readings + blood
              group so the doctor doesn't have to leave the page. */}
          <VitalsStrip vitals={vitals} bloodGroup={appointment?.patientBloodGroup} />
        </div>

        {/* ── Body: clinical (left, wider) + prescription (right) ─────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-[#1c1c1c]">

            {/* Clinical column — 3/5 of the body */}
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

            {/* Prescription column — 2/5 of the body */}
            <div className="lg:col-span-2 px-6 py-6 bg-slate-50/40 dark:bg-[#0c0c0c]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#ccc]">
                    <Pill className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Prescription
                    {drugCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        {drugCount} drug{drugCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#777] mt-0.5">
                    Leave empty for a notes-only consultation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-sm transition-colors"
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

        {/* ── Footer: autosave + actions ──────────────────────────────── */}
        <div className="shrink-0 px-7 py-4 border-t border-slate-100 dark:border-[#1c1c1c] bg-white dark:bg-[#0f0f0f] flex items-center justify-between gap-4">
          <AutosaveIndicator status={autosaveStatus} hydrating={hydrating} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Consultation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VitalsStrip({ vitals, bloodGroup }) {
  const bp = vitals && (vitals.bpSystolic != null || vitals.bpDiastolic != null)
    ? `${vitals.bpSystolic ?? "—"}/${vitals.bpDiastolic ?? "—"}`
    : null;
  const spo2 = vitals?.spo2 != null ? `${vitals.spo2}%` : null;
  const hr = vitals?.heartRate != null ? `${vitals.heartRate} bpm` : null;
  const wt = vitals?.weightKg != null ? `${Number(vitals.weightKg).toFixed(1)} kg` : null;
  const recordedAt = vitals?.updatedAt || vitals?.recordedAt;

  return (
    <div className="px-6 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 dark:border-[#1c1c1c] bg-white dark:bg-[#0f0f0f]">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
        <Activity className="w-3 h-3" /> Vitals
      </div>

      <VitalChip icon={<Droplet className="w-3 h-3 text-rose-500" />}
                 label="Blood" value={bloodGroup || "—"} />
      <VitalChip icon={<HeartPulse className="w-3 h-3 text-rose-500" />}
                 label="BP" value={bp || "—"} unit={bp ? "mmHg" : null} />
      <VitalChip icon={<Wind className="w-3 h-3 text-blue-500" />}
                 label="SpO₂" value={spo2 || "—"} />
      <VitalChip icon={<HeartPulse className="w-3 h-3 text-emerald-500" />}
                 label="Pulse" value={hr || "—"} />
      <VitalChip icon={<Scale className="w-3 h-3 text-amber-500" />}
                 label="Weight" value={wt || "—"} />

      <span className="ml-auto text-[10px] text-slate-400 dark:text-[#666]">
        {vitals
          ? `Recorded by ${vitals.recordedByName || "—"}${recordedAt ? " · " + new Date(recordedAt).toLocaleString() : ""}`
          : "Vitals not recorded yet"}
      </span>
    </div>
  );
}

function VitalChip({ icon, label, value, unit }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-slate-400 dark:text-[#666]">{unit}</span>}
      </span>
    </div>
  );
}

function PreField({ icon, label, value, mono }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
        {icon}
        {label}
      </div>
      <p className={`mt-0.5 text-sm font-semibold text-slate-900 dark:text-white truncate ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

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

function AutosaveIndicator({ status, hydrating }) {
  if (hydrating) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#888]">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading draft…
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#888]">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving draft…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <Save className="w-3 h-3" />
        Draft saved — safe to close and resume later
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <AlertCircle className="w-3 h-3" />
        Autosave failed — your changes are only in this tab
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400 dark:text-[#666]">Draft autosaves as you type</span>;
}
