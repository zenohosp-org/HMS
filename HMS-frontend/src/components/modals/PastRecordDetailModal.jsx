import { useEffect } from "react";
import { fmtId } from "@/utils/idFormat";
import {
  Stethoscope, Pill, ClipboardList, FileText, ListChecks, CalendarClock,
  IdCard, Clock, X, User as UserIcon, Beaker, Scissors, FlaskConical,
  Tag, BedDouble,
} from "lucide-react";

/**
 * Read-only detail view for a single PatientRecord — opened from the
 * "Previous Records" rail in the Consultation View when the doctor
 * clicks one of the past-visit cards. The pastRecords list already
 * carries every field we display (description, instructions,
 * prescriptionItems, createdBy, nextVisitDate, mrn, etc.), so this
 * modal is purely a renderer — no fetch, instant open.
 *
 * Sections are conditional:
 *   • Chief complaint    — only if description begins with the
 *                          "Chief complaint:" prefix the consultation
 *                          modal writes.
 *   • Doctor's notes     — remainder of description after the chief
 *                          complaint line; renders only if non-empty.
 *   • Instructions       — only if instructions text is present.
 *   • Prescription table — only if at least one prescriptionItem row.
 *   • Next visit         — only if a follow-up was scheduled.
 *
 * No edit / delete affordances. Past records are immutable; a
 * correction is a new record, never an in-place mutation. That
 * posture matches the rest of the records feature.
 */
export default function PastRecordDetailModal({ record, onClose }) {
  // ESC-to-close keeps the modal feeling native; the back-button
  // muscle memory is exit, not navigate. Cleanup runs on unmount.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!record) return null;

  const { chiefComplaint, notes } = splitDescription(record.description);
  const items = Array.isArray(record.prescriptionItems) ? record.prescriptionItems : [];
  const meta = TYPE_META[record.historyType] || TYPE_META.OTHER;
  const Icon = meta.icon;
  const creator = record.createdBy
    ? [record.createdBy.firstName, record.createdBy.lastName].filter(Boolean).join(" ").trim()
    : null;
  const creatorRole = record.createdBy?.role;
  const createdAt = record.createdAt ? new Date(record.createdAt) : null;
  const nextVisit = record.nextVisitDate ? new Date(record.nextVisitDate) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm pointer-events-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] border border-slate-200 flex flex-col overflow-hidden">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-lg ${meta.iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${meta.iconText}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 truncate">
                    {meta.label}
                  </h2>
                  {items.length > 0 && record.historyType !== "PRESCRIPTION" && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      + {items.length} Rx
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Past record — read-only
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Meta strip — type, date, MRN, visit linkage */}
          <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-100 bg-slate-50/60">
            <MetaField icon={<Clock className="w-3.5 h-3.5" />} label="Date" value={createdAt ? createdAt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} />
            <MetaField icon={<IdCard className="w-3.5 h-3.5" />} label="MRN" value={fmtId(record.mrn) || record.mrn || "—"} mono />
            <MetaField icon={<Tag className="w-3.5 h-3.5" />} label="Type" value={meta.label} />
            <MetaField
              icon={record.admissionId ? <BedDouble className="w-3.5 h-3.5" /> : <Stethoscope className="w-3.5 h-3.5" />}
              label={record.admissionId ? "Admission" : "Visit"}
              value={record.admissionNumber || (record.admissionId ? "IPD" : "OPD")}
              mono={!!record.admissionNumber}
            />
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

          {chiefComplaint && (
            <Section icon={<ClipboardList className="w-3.5 h-3.5" />} title="Chief complaint" tone="blue">
              <p className="text-sm text-slate-800 leading-relaxed">
                {chiefComplaint}
              </p>
            </Section>
          )}

          {notes && (
            <Section icon={<FileText className="w-3.5 h-3.5" />} title="Doctor's notes">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {notes}
              </p>
            </Section>
          )}

          {record.instructions && (
            <Section icon={<ListChecks className="w-3.5 h-3.5" />} title="Instructions for patient" tone="amber">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {record.instructions}
              </p>
            </Section>
          )}

          {items.length > 0 && (
            <Section
              icon={<Pill className="w-3.5 h-3.5" />}
              title={`Prescription · ${items.length} drug${items.length === 1 ? "" : "s"}`}
              tone="emerald"
            >
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="col-span-4">Drug</div>
                  <div className="col-span-2">Dose</div>
                  <div className="col-span-2">Frequency</div>
                  <div className="col-span-1 text-center">Days</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-2">Route</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((d) => (
                    <PrescriptionRow key={d.id} drug={d} />
                  ))}
                </div>
              </div>
            </Section>
          )}

          {nextVisit && (
            <Section icon={<CalendarClock className="w-3.5 h-3.5" />} title="Follow-up scheduled">
              <p className="text-sm font-semibold text-slate-800">
                {nextVisit.toLocaleString("en-IN", {
                  day: "2-digit", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </Section>
          )}

          {/* Empty state for records that somehow carry no body content */}
          {!chiefComplaint && !notes && !record.instructions && items.length === 0 && !nextVisit && (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400">
                This record has no clinical content to display.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="shrink-0 px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-slate-500 truncate">
            <UserIcon className="w-3 h-3 shrink-0" />
            {creator ? (
              <>
                Recorded by <span className="font-semibold text-slate-700">{creator}</span>
                {creatorRole && <span className="text-slate-400"> · {creatorRole}</span>}
              </>
            ) : (
              <span>Recorded</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

/**
 * The consultation modal writes "Chief complaint: …" as the first line
 * of description, then a blank line, then the doctor's narrative. We
 * split on that prefix so the modal can render each in its own section.
 * Old records without the prefix fall through with chief complaint
 * empty and the whole description as notes — non-destructive.
 */
function splitDescription(description) {
  if (!description) return { chiefComplaint: "", notes: "" };
  const text = description.replace(/\r\n/g, "\n");
  const ccMatch = /^Chief complaint:\s*([^\n]+)\n\n?/i.exec(text);
  if (ccMatch) {
    return {
      chiefComplaint: ccMatch[1].trim(),
      notes: text.slice(ccMatch[0].length).trim(),
    };
  }
  return { chiefComplaint: "", notes: text.trim() };
}

const TYPE_META = {
  CONSULTATION: {
    label:   "Consultation",
    icon:    Stethoscope,
    iconBg:  "bg-blue-50",
    iconText:"text-blue-600",
  },
  PRESCRIPTION: {
    label:   "Prescription",
    icon:    Pill,
    iconBg:  "bg-emerald-50",
    iconText:"text-emerald-600",
  },
  LAB_RESULT: {
    label:   "Lab Result",
    icon:    Beaker,
    iconBg:  "bg-amber-50",
    iconText:"text-amber-600",
  },
  SURGERY: {
    label:   "Surgery",
    icon:    Scissors,
    iconBg:  "bg-rose-50",
    iconText:"text-rose-600",
  },
  DIAGNOSIS: {
    label:   "Diagnosis",
    icon:    FlaskConical,
    iconBg:  "bg-violet-50",
    iconText:"text-violet-600",
  },
  OTHER: {
    label:   "Record",
    icon:    FileText,
    iconBg:  "bg-slate-100",
    iconText:"text-slate-600",
  },
  OTHERS: {
    label:   "Record",
    icon:    FileText,
    iconBg:  "bg-slate-100",
    iconText:"text-slate-600",
  },
};

function MetaField({ icon, label, value, mono }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {icon}{label}
      </div>
      <p className={`mt-0.5 text-sm font-semibold text-slate-900 truncate ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Section({ icon, title, tone, children }) {
  const toneCls =
    tone === "blue"    ? "text-blue-700" :
    tone === "emerald" ? "text-emerald-700" :
    tone === "amber"   ? "text-amber-700" :
    "text-slate-700";
  return (
    <section>
      <h3 className={`flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider ${toneCls}`}>
        {icon}{title}
      </h3>
      {children}
    </section>
  );
}

function PrescriptionRow({ drug }) {
  const strengthLine = [drug.drugStrength, drug.drugForm].filter(Boolean).join(" · ");
  return (
    <div className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 bg-white hover:bg-slate-50/60 transition-colors">
      <div className="col-span-4">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {drug.drugName || "—"}
        </p>
        {strengthLine && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {strengthLine}
            {drug.drugGeneric && <span className="text-slate-300"> · {drug.drugGeneric}</span>}
          </p>
        )}
        {drug.instructions && (
          <p className="text-[11px] italic text-slate-500 mt-0.5 line-clamp-1">
            {drug.instructions}
          </p>
        )}
      </div>
      <div className="col-span-2 text-xs text-slate-700">{drug.dose || "—"}</div>
      <div className="col-span-2 text-xs text-slate-700">{drug.frequency || "—"}</div>
      <div className="col-span-1 text-xs text-slate-500 text-center tabular-nums">
        {drug.durationDays != null ? `${drug.durationDays}d` : "—"}
      </div>
      <div className="col-span-1 text-sm font-semibold text-slate-900 text-right tabular-nums">
        {drug.quantity ?? "—"}
      </div>
      <div className="col-span-2 text-xs text-slate-500">{drug.route || "—"}</div>
    </div>
  );
}
