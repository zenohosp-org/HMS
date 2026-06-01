import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { recordApi } from "@/utils/api";
import { Plus, Loader2, Pill, CheckCircle2 } from "lucide-react";
import {
  PrescriptionDrugRow,
  newBlankDrugItem,
  drugItemToRequest,
} from "@/components/prescription/PrescriptionDrugRow";

/**
 * Modal for writing a PRESCRIPTION-type record with structured drug lines.
 * Props:
 *   patient — { id, firstName, lastName, uhid }
 *   appointmentId — optional, set when invoked from an appointment row
 *   admissionId / admissionNumber — optional, set when invoked from an IPD context
 *   onClose — close handler
 *   onSaved — called with the created RecordDto after successful save
 */
export default function WritePrescriptionModal({
  patient, appointmentId, admissionId, admissionNumber, onClose, onSaved,
}) {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [notes, setNotes] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [items, setItems] = useState([newBlankDrugItem()]);
  const [saving, setSaving] = useState(false);

  const setItemField = (key, field, value) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const removeItem = (key) => {
    setItems(prev => prev.length === 1
      ? [newBlankDrugItem()]
      : prev.filter(i => i.key !== key));
  };

  const addItem = () => setItems(prev => [...prev, newBlankDrugItem()]);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    const filled = items.filter(i => i.drugName.trim().length > 0);
    if (filled.length === 0) {
      notify("Add at least one drug to the prescription", "warning");
      return;
    }
    for (const it of filled) {
      const qty = Number(it.quantity);
      if (!qty || qty <= 0) {
        notify(`Set a positive quantity for ${it.drugName}`, "warning");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        hospitalId: user.hospitalId,
        patientId: patient.id,
        historyType: "PRESCRIPTION",
        description: notes || undefined,
        nextVisitDate: nextVisitDate || undefined,
        admissionId: admissionId || undefined,
        admissionNumber: admissionNumber || undefined,
        appointmentId: appointmentId || undefined,
        prescriptionItems: filled.map((it, idx) => drugItemToRequest(it, idx)),
      };
      const created = await recordApi.create(payload);
      notify(`Prescription saved — ${filled.length} drug${filled.length === 1 ? "" : "s"}`, "success");
      onSaved?.(created);
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to save prescription", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm pointer-events-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] border border-slate-200 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Pill className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Write Prescription</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {patient ? `${patient.firstName} ${patient.lastName ?? ""} · ${patient.uhid ?? ""}` : ""}
                {appointmentId && <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold">OPD</span>}
                {admissionId && <span className="ml-2 px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px] font-bold">IPD</span>}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Drugs</label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
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

          {/* Narrative notes — kept alongside the structured drugs.
              Doctors use this for context that doesn't fit any per-drug field:
              "monitor BP after first dose", "patient allergic to sulpha", etc.
              Pharmacy reads it for safety context at dispense time. */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Doctor's notes
              <span className="ml-1 font-normal text-slate-400 normal-case">— context, warnings, follow-up</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Monitor BP after first dose. Avoid driving for 24 hours."
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Next visit</label>
              <input
                type="datetime-local"
                value={nextVisitDate}
                onChange={e => setNextVisitDate(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300/50"
              />
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Prescription
          </button>
        </div>
      </div>
    </div>
  );
}
