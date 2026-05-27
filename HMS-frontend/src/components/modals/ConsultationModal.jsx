import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { recordApi, consultationDraftsApi } from "@/utils/api";
import {
  Stethoscope, Pill, Plus, Loader2, CheckCircle2, ShieldCheck,
  User as UserIcon, CalendarClock, IdCard, Save, AlertCircle,
} from "lucide-react";
import {
  PrescriptionDrugRow,
  newBlankDrugItem,
  drugItemToRequest,
} from "@/components/prescription/PrescriptionDrugRow";

const AUTOSAVE_DELAY_MS = 1500;

/**
 * Auto-launched after an OPD appointment is checked in. The doctor records
 * the consult notes + (optionally) a prescription in one place and authorises
 * the record before save. Persists as a single patient_records row:
 *   - historyType = PRESCRIPTION when the doctor added drugs (pharmacy picks
 *     it up via the by-type query)
 *   - historyType = CONSULTATION  when no drugs were added (notes-only visit)
 *
 * Either way the row is linked to the appointment via appointmentId so the
 * OPD audit trail stays intact.
 *
 * Props:
 *   appointment — AppointmentDto from the dashboard (patientName, doctorName,
 *                 apptDate, apptTime, chiefComplaint, patientId, etc.)
 *   onClose     — close handler (called on Cancel / X / after save)
 *   onSaved     — called with the created RecordDto so the dashboard can
 *                 refresh + show a toast
 */
export default function ConsultationModal({ appointment, onClose, onSaved }) {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [tab, setTab] = useState("consult");
  const [chiefComplaint, setChiefComplaint] = useState(appointment?.chiefComplaint || "");
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [items, setItems] = useState([newBlankDrugItem()]);
  const [authorised, setAuthorised] = useState(false);
  const [saving, setSaving] = useState(false);

  // Autosave bookkeeping. `hydrating` blocks the autosave effect until the
  // initial GET resolves so we never overwrite a fresh draft with the empty
  // first-render state. `autosaveStatus` drives the small footer indicator.
  const [hydrating, setHydrating] = useState(true);
  const [autosaveStatus, setAutosaveStatus] = useState("idle"); // idle | saving | saved | error
  const autosaveTimer = useRef(null);

  const drugCount = useMemo(
    () => items.filter(i => i.drugName.trim().length > 0).length,
    [items],
  );

  // ── Draft hydration ──────────────────────────────────────────────────
  // On mount, fetch the existing draft for this appointment. If one is
  // present, overlay its fields on top of the appointment defaults so the
  // doctor lands where they left off. Falls through silently when no
  // draft exists yet (first open after check-in).
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
            // Re-key restored rows so React doesn't conflict with the
            // factory-generated key of the placeholder row we mounted with.
            setItems(p.items.map((it, idx) => ({
              ...newBlankDrugItem(),
              ...it,
              key: Date.now() + idx + Math.random(),
            })));
          }
        } catch {
          /* corrupted draft — fall back to the appointment defaults */
        }
      })
      .catch(() => { /* no draft / network — silent */ })
      .finally(() => { if (!cancelled) setHydrating(false); });

    return () => { cancelled = true; };
    // appointment.id is the stable key; props don't switch mid-modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment?.id]);

  // ── Debounced autosave ───────────────────────────────────────────────
  // Every form change schedules a single upsert ~1.5s later. The effect
  // re-runs on every form field change, but the timer is reset each time
  // so quick edits collapse into one network call.
  useEffect(() => {
    if (hydrating || !appointment?.id || !user?.hospitalId) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setAutosaveStatus("saving");
      try {
        const payload = JSON.stringify({
          chiefComplaint, notes, instructions, nextVisitDate,
          // Strip the in-memory React key — server doesn't need it and
          // restoring it on reload would clash with fresh keys anyway.
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

  // Combine the chief-complaint header with the doctor's narrative into the
  // single `description` field — the print view re-splits using the leading
  // "Chief complaint:" line.
  const buildDescription = () => {
    const parts = [];
    if (chiefComplaint.trim()) parts.push(`Chief complaint: ${chiefComplaint.trim()}`);
    if (notes.trim()) parts.push(notes.trim());
    return parts.length ? parts.join("\n\n") : undefined;
  };

  const handleSave = async () => {
    if (!authorised) {
      notify("Please authorise the consultation before saving", "warning");
      return;
    }
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
        // doctor actually wrote drugs so dispense lists keep working.
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
      // Cancel any pending autosave so it can't resurrect the row a moment later.
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
  const apptTime = appointment?.apptTime || "";
  const dateTimeText = [apptDate, apptTime].filter(Boolean).join(" · ");
  const patientFullName =
    appointment?.patientName ||
    [appointment?.patientFirstName, appointment?.patientLastName].filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm pointer-events-auto">
      <div className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-8xl max-h-[95vh] border border-slate-200 dark:border-[#2a2a2a] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
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
        <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-100 dark:border-[#1e1e1e] bg-slate-50/60 dark:bg-[#0d0d0d] shrink-0">
          <PreField icon={<UserIcon className="w-3.5 h-3.5" />} label="Patient" value={patientFullName || "—"} />
          <PreField icon={<IdCard className="w-3.5 h-3.5" />} label="UHID" value={appointment?.patientUhid || "—"} />
          <PreField icon={<Stethoscope className="w-3.5 h-3.5" />} label="Doctor" value={appointment?.doctorName || "—"} />
          <PreField icon={<CalendarClock className="w-3.5 h-3.5" />} label="Date & time" value={dateTimeText || "—"} />
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
          <div className="flex gap-1">
            <TabButton active={tab === "consult"} onClick={() => setTab("consult")} icon={<Stethoscope className="w-3.5 h-3.5" />} label="Consultation" />
            <TabButton
              active={tab === "rx"}
              onClick={() => setTab("rx")}
              icon={<Pill className="w-3.5 h-3.5" />}
              label="Prescription"
              count={drugCount}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "consult" ? (
            <ConsultTab
              chiefComplaint={chiefComplaint}
              setChiefComplaint={setChiefComplaint}
              notes={notes}
              setNotes={setNotes}
              instructions={instructions}
              setInstructions={setInstructions}
              nextVisitDate={nextVisitDate}
              setNextVisitDate={setNextVisitDate}
            />
          ) : (
            <RxTab
              items={items}
              addItem={addItem}
              setItemField={setItemField}
              removeItem={removeItem}
            />
          )}
        </div>

        {/* Footer — authorisation + actions */}
        <div className="border-t border-slate-100 dark:border-[#1e1e1e] shrink-0">
          <label
            htmlFor="consult-authorise"
            className="flex items-start gap-3 px-6 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#161616] transition-colors"
          >
            <input
              id="consult-authorise"
              type="checkbox"
              checked={authorised}
              onChange={e => setAuthorised(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-[#333] text-emerald-600 focus:ring-emerald-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Authorised by attending clinician
              </div>
              <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
                I confirm I am a human clinician and these notes / prescription are reviewed and approved for this patient.
              </p>
            </div>
          </label>

          <div className="px-6 py-3 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-[#1e1e1e]">
            <AutosaveIndicator status={autosaveStatus} hydrating={hydrating} />
            <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !authorised}
              className="btn-primary"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Consultation
            </button>
            </div>
          </div>
        </div>
      </div>
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

function PreField({ icon, label, value }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white truncate">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 -mb-px border-b-2 text-xs font-semibold transition-colors ${
        active
          ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-white"
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
          {count}
        </span>
      )}
    </button>
  );
}

function ConsultTab({
  chiefComplaint, setChiefComplaint,
  notes, setNotes,
  instructions, setInstructions,
  nextVisitDate, setNextVisitDate,
}) {
  const baseTextarea =
    "mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] " +
    "bg-white dark:bg-[#0e0e0e] text-sm text-slate-900 dark:text-white " +
    "focus:outline-none focus:ring-2 focus:ring-slate-300/50 resize-none";

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#aaa]">
          Chief complaint
        </label>
        <input
          value={chiefComplaint}
          onChange={e => setChiefComplaint(e.target.value)}
          placeholder="e.g. Fever for 3 days, dry cough"
          className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#0e0e0e] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300/50"
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#aaa]">
          Doctor's notes
          <span className="ml-1 font-normal text-slate-400 dark:text-[#666] normal-case">— examination findings, diagnosis, plan</span>
        </label>
        <textarea
          rows={5}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Subjective, objective, assessment, plan…"
          className={baseTextarea}
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#aaa]">
          Instructions for patient
          <span className="ml-1 font-normal text-slate-400 dark:text-[#666] normal-case">— diet, rest, when to come back</span>
        </label>
        <textarea
          rows={4}
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="e.g. Plenty of fluids. Return immediately if breathing worsens."
          className={baseTextarea}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#aaa]">Next visit</label>
          <input
            type="datetime-local"
            value={nextVisitDate}
            onChange={e => setNextVisitDate(e.target.value)}
            className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#0e0e0e] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300/50"
          />
        </div>
      </div>
    </div>
  );
}

function RxTab({ items, addItem, setItemField, removeItem }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#aaa]">Drugs</label>
          <p className="text-[11px] text-slate-500 dark:text-[#888] mt-0.5">
            Leave empty to save a notes-only consultation.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
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
  );
}
