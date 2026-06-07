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
    <div className="hms-cmodal-overlay">
      <div className="hms-cmodal is-xl">

        {/* Header */}
        <div className="hms-cmodal__header">
          <div className="hms-cmodal__header-row">
            <div className="hms-cmodal__title-block">
              <div className="hms-icon-tile is-success">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <h2 className="hms-cmodal__title">Write Prescription</h2>
                <p className="hms-cmodal__subtitle">
                  {patient ? `${patient.firstName} ${patient.lastName ?? ""} · ${patient.uhid ?? ""}` : ""}
                  {appointmentId && <span className="hms-badge is-info is-soft ml-2">OPD</span>}
                  {admissionId && <span className="hms-badge is-violet is-soft ml-2">IPD</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="hms-cmodal__body">
          <div className="hms-form-stack">

            <div className="hms-clinical-section">
              <div className="hms-rx-head">
                <label className="hms-clinical-section__title">Drugs</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="hms-rx-add-btn is-ghost"
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

            {/* Narrative notes — kept alongside the structured drugs.
                Doctors use this for context that doesn't fit any per-drug field:
                "monitor BP after first dose", "patient allergic to sulpha", etc.
                Pharmacy reads it for safety context at dispense time. */}
            <div className="hms-clinical-section">
              <label className="hms-rx-notes-label">
                Doctor's notes
                <span className="hms-rx-notes-label__hint">— context, warnings, follow-up</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Monitor BP after first dose. Avoid driving for 24 hours."
                className="hms-clinical-textarea mt-2"
              />
            </div>

            <div className="hms-form-grid is-2col">
              <div className="hms-clinical-section">
                <label className="hms-rx-notes-label">Next visit</label>
                <input
                  type="datetime-local"
                  value={nextVisitDate}
                  onChange={e => setNextVisitDate(e.target.value)}
                  className="hms-clinical-input mt-2"
                />
              </div>
            </div>
          </div>
        </form>

        <div className="hms-cmodal__footer">
          <button type="button" onClick={onClose} className="zu-btn-cancel">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="zu-btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Prescription
          </button>
        </div>
      </div>
    </div>
  );
}
