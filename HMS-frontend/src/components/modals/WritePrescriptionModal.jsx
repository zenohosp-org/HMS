import { Spinner } from "@/components/ui/Loader";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { recordApi, doctorsApi } from "@/utils/api";
import { Plus, Pill, CheckCircle2, AlertTriangle } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { FormGroup } from "@/components/ui";
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
  patient, appointmentId, admissionId, admissionNumber, allergies, onClose, onSaved,
}) {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [notes, setNotes] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [items, setItems] = useState([newBlankDrugItem()]);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [attendingDoctorId, setAttendingDoctorId] = useState(null);

  useEffect(() => {
    doctorsApi.list(user.hospitalId).then((list) => {
      setDoctors(list ?? []);
      if (user.role === "doctor") setAttendingDoctorId(user.id);
    }).catch(() => {});
  }, [user.hospitalId, user.id, user.role]);

  const doctorOptions = doctors.map((d) => ({
    value: d.userId,
    label: `Dr. ${[d.firstName, d.lastName].filter(Boolean).join(" ")}${d.specialization ? ` · ${d.specialization}` : ""}`,
  }));

  const knownAllergies = Array.isArray(allergies) ? allergies : [];
  const allergenNames = knownAllergies.map((a) => a.allergen.toLowerCase());
  const drugMatchesAllergy = (drugName) =>
    !!drugName && allergenNames.some((a) => drugName.toLowerCase().includes(a) || a.includes(drugName.toLowerCase()));

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
    if (!attendingDoctorId) {
      notify("Select the prescribing doctor", "warning");
      return;
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
        attendingDoctorId: attendingDoctorId || undefined,
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
    <div className="zu-modal-overlay">
      <div className="zu-modal is-xl">

        {/* Header */}
        <div className="zu-modal-header">
          <div className="zu-modal-header-row">
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

        <form onSubmit={handleSave} className="zu-modal-body">
          <div className="hms-form-stack">

            {knownAllergies.length > 0 && (
              <div className="hms-allergy-banner">
                <AlertTriangle size={13} className="hms-allergy-banner__icon" />
                <span className="hms-allergy-banner__label">Known allergies:</span>
                <div className="hms-allergy-chip-row">
                  {knownAllergies.map((a) => (
                    <span
                      key={a.id}
                      className={`hms-allergy-chip is-${(a.severity || "UNKNOWN").toLowerCase()} is-readonly`}
                    >
                      {a.allergen}
                      {a.reaction && <span className="hms-allergy-chip__reaction">· {a.reaction}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <FormGroup label={<span>Prescribing doctor <span className="text-danger">*</span></span>}>
              <SearchableSelect
                value={attendingDoctorId}
                onChange={setAttendingDoctorId}
                options={doctorOptions}
                placeholder="Select doctor…"
                clearable={false}
              />
            </FormGroup>

            <div className="hms-clinical-section">
              <div className="hms-rx-table">

                {/* Column header */}
                <div className="hms-rx-table-head">
                  <div className="hms-rx-table-head__cell" />
                  <div className="hms-rx-table-head__cell">Drug</div>
                  <div className="hms-rx-table-head__cell">Dose</div>
                  <div className="hms-rx-table-head__cell">Freq</div>
                  <div className="hms-rx-table-head__cell">Days</div>
                  <div className="hms-rx-table-head__cell">Qty *</div>
                  <div className="hms-rx-table-head__cell">Route</div>
                  <div className="hms-rx-table-head__cell" />
                </div>

                {items.map((item, idx) => (
                  <PrescriptionDrugRow
                    key={item.key}
                    index={idx}
                    item={item}
                    allergyMatch={drugMatchesAllergy(item.drugName)}
                    onChange={(field, value) => setItemField(item.key, field, value)}
                    onRemove={() => removeItem(item.key)}
                    isLastRemovable={items.length > 1}
                  />
                ))}

                {/* Add drug row */}
                <div className="hms-rx-add-row">
                  <button
                    type="button"
                    onClick={addItem}
                    className="hms-rx-add-btn is-ghost"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add drug
                  </button>
                </div>
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

            {!admissionId && (
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
            )}
          </div>
        </form>

        <div className="zu-modal-footer">
          <button type="button" onClick={onClose} className="zu-btn-cancel">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="zu-btn-primary">
            {saving ? <Spinner className="w-4 h-4 zu-spinner" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Prescription
          </button>
        </div>
      </div>
    </div>
  );
}
