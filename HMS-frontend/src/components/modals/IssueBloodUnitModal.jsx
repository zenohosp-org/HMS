import { useEffect, useState } from "react";
import { Button, FormGroup, Input, Modal, Textarea } from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { bloodBankApi, patientApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";

export default function IssueBloodUnitModal({ isOpen, onClose, hospitalId, unit, onSuccess }) {
  const { notify } = useNotification();
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({
    patientId: "",
    admissionId: "",
    doctorName: "",
    replacementsPledged: "0",
    salePrice: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !hospitalId) return;
    patientApi.list(hospitalId).then(setPatients).catch(() => setPatients([]));
    setForm((p) => ({
      ...p,
      salePrice: unit?.salePrice != null ? String(unit.salePrice) : "",
    }));
  }, [isOpen, hospitalId, unit]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.patientId) return notify("Patient is required", "error");
    setSaving(true);
    try {
      await bloodBankApi.issueUnit(unit.id, {
        patientId: Number(form.patientId),
        admissionId: form.admissionId || null,
        doctorName: form.doctorName || null,
        replacementsPledged: form.replacementsPledged ? Number(form.replacementsPledged) : 0,
        salePrice: form.salePrice ? Number(form.salePrice) : null,
        notes: form.notes || null,
      });
      notify("Bag issued and billed", "success");
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to issue bag", "error");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <Button variant="cancel" type="button" onClick={onClose}>Cancel</Button>
      <Button variant="primary" type="submit" form="bb-issue-form" loading={saving}>
        Issue + bill
      </Button>
    </>
  );

  if (!unit) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Issue bag ${unit.bagNumber}`} size="md" footer={footer}>
      <form id="bb-issue-form" onSubmit={submit}>
        <div className="hms-bb-modal-grid">
          <div className="hms-bb-modal-grid__full">
            <p className="text-sm text-gray-600">
              {unit.bloodGroupCode} · {unit.componentCode}
              {unit.volumeMl ? ` · ${unit.volumeMl} ml` : ""}
              {unit.expiryDate ? ` · expires ${unit.expiryDate}` : ""}
            </p>
          </div>
          <div className="hms-bb-modal-grid__full">
            <FormGroup label="Patient *">
              <SearchableSelect
                value={form.patientId}
                onChange={(v) => set("patientId", v)}
                options={patients.map((p) => ({
                  value: String(p.id),
                  label: `${p.firstName} ${p.lastName ?? ""} — ${p.uhid}`,
                }))}
                placeholder="Search patient"
              />
            </FormGroup>
          </div>
          <FormGroup label="Admission ID (optional)">
            <Input value={form.admissionId} onChange={(e) => set("admissionId", e.target.value)} placeholder="Auto-detected if IPD" />
          </FormGroup>
          <FormGroup label="Prescribing doctor">
            <Input value={form.doctorName} onChange={(e) => set("doctorName", e.target.value)} placeholder="Dr. Patel" />
          </FormGroup>
          <FormGroup label="Replacement donors pledged">
            <Input type="number" min="0" value={form.replacementsPledged} onChange={(e) => set("replacementsPledged", e.target.value)} />
          </FormGroup>
          <FormGroup label="Sale price (₹)">
            <Input type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
          </FormGroup>
          <div className="hms-bb-modal-grid__full">
            <FormGroup label="Notes">
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Indication, transfusion site, etc." />
            </FormGroup>
          </div>
        </div>
      </form>
    </Modal>
  );
}
