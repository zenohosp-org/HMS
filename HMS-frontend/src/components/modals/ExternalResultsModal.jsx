import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { externalResultsApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import {
  FlaskConical, Plus, CheckCircle2, Loader2, X, AlertTriangle, Trash2,
  Beaker, ScanLine, Microscope, FileText, Calendar,
  User as UserIcon, IdCard, CalendarClock,
} from "lucide-react";

/**
 * Front-desk / nursing-staff modal for capturing external lab,
 * radiology, and pathology reports the patient brings in from outside
 * clinics. Mirrors the VitalsModal pattern in placement (action menu
 * on CHECKED_IN / IN_PROGRESS rows) and intent (triage before the
 * doctor takes over) so the doctor's consultation page lands with
 * everything pre-filled.
 *
 * UX optimised for speed:
 *   - Quick-pick buttons for the 12 most common Indian OPD tests
 *     auto-fill category + test name in one click.
 *   - Multi-entry: one staging list, "Add to list" → next entry,
 *     "Save All" persists the batch sequentially. Patients walking
 *     in with a stack of 3-5 reports get captured in under 90 sec.
 *   - Pre-filled today's date + the appointment's hospital_id /
 *     patient_id so the form never re-asks what we already know.
 *
 * No file upload here — Phase 2 deliberately keeps it text-only;
 * scan-and-attach lands with the storage PR. The endpoint already
 * accepts a nullable attachment_id so this UX upgrades cleanly.
 */

// Top-of-modal quick picks. Tuned to the most common outside-clinic
// tests in Indian OPD: blood work, basic imaging, urine. Anything not
// here is "+ Custom" (free text). Keeping this list short on purpose
// — speed-of-use beats completeness.
const QUICK_PICKS = [
  { test: "CBC",              category: "LAB",        icon: Beaker },
  { test: "LFT",              category: "LAB",        icon: Beaker },
  { test: "KFT",              category: "LAB",        icon: Beaker },
  { test: "Lipid Profile",    category: "LAB",        icon: Beaker },
  { test: "Blood Sugar",      category: "LAB",        icon: Beaker },
  { test: "HbA1c",            category: "LAB",        icon: Beaker },
  { test: "TSH",              category: "LAB",        icon: Beaker },
  { test: "Urine Routine",    category: "LAB",        icon: Beaker },
  { test: "X-Ray Chest",      category: "RADIOLOGY",  icon: ScanLine },
  { test: "USG Abdomen",      category: "RADIOLOGY",  icon: ScanLine },
  { test: "ECG",              category: "RADIOLOGY",  icon: ScanLine },
  { test: "Biopsy",           category: "PATHOLOGY",  icon: Microscope },
];

const CATEGORIES = [
  { value: "LAB",        label: "Lab"        },
  { value: "RADIOLOGY",  label: "Radiology"  },
  { value: "PATHOLOGY",  label: "Pathology"  },
  { value: "OTHER",      label: "Other"      },
];

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function blankForm() {
  return {
    category: "LAB",
    testName: "",
    sourceName: "",
    testDate: todayIso(),
    notes: "",
    isAbnormal: false,
  };
}

export default function ExternalResultsModal({ appointment, onClose, onSaved }) {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [form, setForm] = useState(blankForm());
  const [staged, setStaged] = useState([]);          // entries waiting to be saved
  const [saving, setSaving] = useState(false);

  // Move focus into Test name after a quick-pick. Small thing but it
  // saves the operator's hand from leaving the keyboard for the next
  // entry.
  const testNameRef = useRef(null);
  useEffect(() => { if (form.testName) testNameRef.current?.focus(); }, [form.testName]);

  const patientFullName =
    appointment?.patientName ||
    [appointment?.patientFirstName, appointment?.patientLastName].filter(Boolean).join(" ");
  const uhidDisplay = fmtId(appointment?.patientUhid) || appointment?.patientUhid || "—";
  const apptTime = appointment?.apptTime ? appointment.apptTime.substring(0, 5) : "";
  const dateTimeText = [appointment?.apptDate, apptTime].filter(Boolean).join(" · ");

  const handleQuickPick = (pick) => {
    setForm((f) => ({
      ...f,
      category: pick.category,
      testName: pick.test,
    }));
  };

  const handleAddToList = () => {
    if (!form.testName.trim()) {
      notify("Test name is required", "warning"); return;
    }
    if (!form.sourceName.trim()) {
      notify("Lab / clinic name is required", "warning"); return;
    }
    if (!form.testDate) {
      notify("Test date is required", "warning"); return;
    }
    setStaged((s) => [...s, { ...form, _key: Date.now() + Math.random() }]);
    setForm(blankForm());
  };

  const handleRemoveStaged = (key) => {
    setStaged((s) => s.filter((it) => it._key !== key));
  };

  const handleSaveAll = async () => {
    // Auto-stage the current form if it has content but the operator
    // hit Save All without clicking Add to list first. Common shortcut.
    const queue = [...staged];
    if (form.testName.trim() && form.sourceName.trim() && form.testDate) {
      queue.push({ ...form, _key: "current" });
    }
    if (queue.length === 0) {
      notify("Add at least one report to save", "warning"); return;
    }

    setSaving(true);
    let savedCount = 0;
    let failure = null;
    for (const entry of queue) {
      try {
        await externalResultsApi.create({
          hospitalId: user.hospitalId,
          patientId: appointment.patientId,
          recordId: undefined,                       // not tied to a specific record at triage time
          appointmentId: appointment.id,             // visit scope — the consult view & print read by this
          category: entry.category,
          testName: entry.testName.trim(),
          testCode: undefined,
          resultValue: undefined,
          resultUnit: undefined,
          referenceRange: undefined,
          isAbnormal: entry.isAbnormal,
          testDate: entry.testDate,
          sourceName: entry.sourceName.trim(),
          sourceDoctorName: undefined,
          attachmentId: undefined,
          notes: entry.notes?.trim() || undefined,
        });
        savedCount += 1;
      } catch (err) {
        failure = err?.response?.data?.message || "Save failed";
        break;
      }
    }

    setSaving(false);
    if (failure) {
      notify(
        savedCount > 0
          ? `Saved ${savedCount} / ${queue.length} — ${failure}. Remaining entries kept in the list.`
          : failure,
        "error",
      );
      // Drop the ones that did succeed; keep what failed so the operator can retry.
      if (savedCount > 0) {
        setStaged(queue.slice(savedCount).filter((it) => it._key !== "current"));
        if (queue[queue.length - 1]._key === "current" && savedCount < queue.length) {
          // Restore the form if its row was the failed one.
          setForm(queue[savedCount]);
        }
      }
      return;
    }
    notify(`Saved ${savedCount} report${savedCount === 1 ? "" : "s"}`, "success");
    onSaved?.(savedCount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm pointer-events-auto">
      <div className="bg-white dark:bg-[#0f0f0f] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] border border-slate-200 dark:border-[#262626] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 dark:border-[#1c1c1c]">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Add Lab Reports</h2>
                <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5 truncate">
                  Outside-lab results the patient walked in with
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors disabled:opacity-40"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Patient strip */}
          <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-slate-100 dark:border-[#1c1c1c] bg-slate-50/60 dark:bg-[#0d0d0d]">
            <PreField icon={<UserIcon className="w-3.5 h-3.5" />} label="Patient" value={patientFullName || "—"} />
            <PreField icon={<IdCard className="w-3.5 h-3.5" />} label="UHID" value={uhidDisplay} mono />
            <PreField icon={<CalendarClock className="w-3.5 h-3.5" />} label="Appointment" value={dateTimeText || "—"} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Quick picks */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#ccc]">
                Quick pick
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#666]">
                Tap to pre-fill — you can still edit
              </p>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {QUICK_PICKS.map((p) => (
                <button
                  key={p.test}
                  type="button"
                  onClick={() => handleQuickPick(p)}
                  className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    form.testName === p.test && form.category === p.category
                      ? "border-violet-400 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10 shadow-sm shadow-violet-500/10"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-[#1c1c1c] dark:bg-[#111] dark:hover:bg-[#161616] dark:hover:border-[#2a2a2a]"
                  }`}
                >
                  <p.icon className={`w-4 h-4 shrink-0 ${
                    p.category === "LAB" ? "text-emerald-600 dark:text-emerald-400" :
                    p.category === "RADIOLOGY" ? "text-blue-600 dark:text-blue-400" :
                    "text-rose-600 dark:text-rose-400"
                  }`} />
                  <span className="text-xs font-semibold text-slate-800 dark:text-[#ddd] truncate">{p.test}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Entry form */}
          <div className="rounded-xl border border-slate-200 dark:border-[#1c1c1c] bg-slate-50/40 dark:bg-[#0c0c0c] p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="external-input"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Test name" required className="md:col-span-2">
                <input
                  ref={testNameRef}
                  value={form.testName}
                  onChange={(e) => setForm((f) => ({ ...f, testName: e.target.value }))}
                  placeholder="e.g. CBC, X-Ray Chest, Biopsy"
                  className="external-input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Lab / clinic name" required>
                <input
                  value={form.sourceName}
                  onChange={(e) => setForm((f) => ({ ...f, sourceName: e.target.value }))}
                  placeholder="e.g. Apollo Lab, Coimbatore"
                  className="external-input"
                />
              </Field>

              <Field label="Test date" required icon={<Calendar className="w-3.5 h-3.5" />}>
                <input
                  type="date"
                  value={form.testDate}
                  onChange={(e) => setForm((f) => ({ ...f, testDate: e.target.value }))}
                  className="external-input"
                />
              </Field>
            </div>

            <Field label="Summary" hint="One line headline the doctor should see">
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. WBC 12,500 — high, bacterial picture"
                className="external-textarea"
              />
            </Field>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-[#ccc] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isAbnormal}
                  onChange={(e) => setForm((f) => ({ ...f, isAbnormal: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 dark:border-[#333] text-amber-600 focus:ring-amber-500"
                />
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className={`w-4 h-4 ${form.isAbnormal ? "text-amber-600 dark:text-amber-400" : "text-slate-300 dark:text-[#444]"}`} />
                  Flag as abnormal
                </span>
              </label>
              <button
                type="button"
                onClick={handleAddToList}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 hover:bg-violet-100 dark:bg-violet-500/10 dark:hover:bg-violet-500/20 border border-violet-100 dark:border-violet-500/20 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add to list
              </button>
            </div>
          </div>

          {/* Staging list */}
          {staged.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#ccc]">
                  Pending
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
                  {staged.length} ready to save
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#1c1c1c] overflow-hidden divide-y divide-slate-100 dark:divide-[#1c1c1c]">
                {staged.map((entry) => (
                  <StagedRow key={entry._key} entry={entry} onRemove={() => handleRemoveStaged(entry._key)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-[#1c1c1c] flex items-center justify-between gap-3 bg-white dark:bg-[#0f0f0f]">
          <p className="text-[11px] text-slate-400 dark:text-[#666] hidden md:block">
            <FileText className="inline w-3 h-3 mr-1" />
            Reports stay on the patient chart forever — corrections add a new row, never overwrite.
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? "Saving…" : `Save All${staged.length > 0 ? ` (${staged.length}${form.testName.trim() && form.sourceName.trim() ? "+1" : ""})` : ""}`}
            </button>
          </div>
        </div>
      </div>
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

function Field({ label, hint, icon, required, className = "", children }) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-[#aaa] flex items-center gap-1.5">
          {icon}{label}
          {required && <span className="text-rose-500">*</span>}
        </label>
        {hint && <span className="text-[10px] font-normal normal-case text-slate-400 dark:text-[#666]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function StagedRow({ entry, onRemove }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 bg-white dark:bg-[#111] hover:bg-slate-50/60 dark:hover:bg-[#161616] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            entry.category === "LAB"        ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20" :
            entry.category === "RADIOLOGY"  ? "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20" :
            entry.category === "PATHOLOGY"  ? "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20" :
            "text-slate-700 bg-slate-100 border-slate-200 dark:text-[#ccc] dark:bg-[#1a1a1a] dark:border-[#2a2a2a]"
          }`}>
            {entry.category}
          </span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{entry.testName}</span>
          {entry.isAbnormal && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20">
              <AlertTriangle className="w-3 h-3" /> Abnormal
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-[#888] truncate">
          {entry.sourceName} <span className="text-slate-300 dark:text-[#444]">·</span> {entry.testDate}
        </p>
        {entry.notes && (
          <p className="text-xs text-slate-600 dark:text-[#bbb] mt-1 line-clamp-2">{entry.notes}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
        aria-label="Remove from list"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
