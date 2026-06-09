import { useEffect, useState } from "react";
import { Button, FormGroup, Input, Modal, Textarea } from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { bloodBankApi } from "@/utils/api";
import { useNotification } from "@/context/NotificationContext";

export default function RegisterBloodUnitModal({ isOpen, onClose, hospitalId, onSuccess }) {
  const { notify } = useNotification();
  const [groups, setGroups] = useState([]);
  const [components, setComponents] = useState([]);
  const [sources, setSources] = useState([]);
  const [donors, setDonors] = useState([]);
  const [form, setForm] = useState({
    bagNumber: "",
    bloodGroupCode: "",
    componentCode: "WHOLE_BLOOD",
    sourceCode: "IN_HOUSE_DONOR",
    donorId: "",
    volumeMl: "",
    collectionDate: new Date().toISOString().slice(0, 10),
    storageLocation: "",
    screeningPassed: false,
    costPrice: "",
    salePrice: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !hospitalId) return;
    Promise.all([
      bloodBankApi.listLookups(hospitalId, "BLOOD_GROUP").catch(() => []),
      bloodBankApi.listLookups(hospitalId, "COMPONENT").catch(() => []),
      bloodBankApi.listLookups(hospitalId, "SOURCE_TYPE").catch(() => []),
      bloodBankApi.listDonors(hospitalId).catch(() => []),
    ]).then(([g, c, s, d]) => {
      setGroups(g);
      setComponents(c);
      setSources(s);
      setDonors(d);
    });
  }, [isOpen, hospitalId]);

  // Default volume from component metadata if available
  useEffect(() => {
    if (!form.componentCode || form.volumeMl) return;
    const comp = components.find((c) => c.code === form.componentCode);
    if (comp && comp.metadata) {
      try {
        const meta = JSON.parse(comp.metadata);
        if (meta.defaultVolumeMl) setForm((p) => ({ ...p, volumeMl: meta.defaultVolumeMl }));
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.componentCode, components]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const isExternal = form.sourceCode === "EXTERNAL_PURCHASE";

  const submit = async (e) => {
    e.preventDefault();
    if (!form.bagNumber.trim()) return notify("Bag number is required", "error");
    if (!form.bloodGroupCode) return notify("Blood group is required", "error");
    if (!form.componentCode) return notify("Component is required", "error");
    if (!isExternal && !form.donorId) return notify("Donor is required for in-house bags", "error");
    setSaving(true);
    try {
      await bloodBankApi.registerUnit(hospitalId, {
        bagNumber: form.bagNumber.trim(),
        bloodGroupCode: form.bloodGroupCode,
        componentCode: form.componentCode,
        sourceCode: form.sourceCode,
        donorId: isExternal ? null : form.donorId || null,
        volumeMl: form.volumeMl ? Number(form.volumeMl) : null,
        collectionDate: form.collectionDate || null,
        storageLocation: form.storageLocation || null,
        screeningPassed: !!form.screeningPassed,
        costPrice: form.costPrice ? Number(form.costPrice) : null,
        salePrice: form.salePrice ? Number(form.salePrice) : null,
        notes: form.notes || null,
      });
      notify("Bag registered", "success");
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to register bag", "error");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <Button variant="cancel" type="button" onClick={onClose}>Cancel</Button>
      <Button variant="primary" type="submit" form="bb-unit-form" loading={saving}>
        Register bag
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register blood bag" size="md" footer={footer}>
      <form id="bb-unit-form" onSubmit={submit}>
        <div className="hms-bb-modal-grid">
          <FormGroup label="Bag number *">
            <Input value={form.bagNumber} onChange={(e) => set("bagNumber", e.target.value)} placeholder="BG-2026-0001" />
          </FormGroup>
          <FormGroup label="Source *">
            <SearchableSelect
              value={form.sourceCode}
              onChange={(v) => set("sourceCode", v)}
              options={sources.map((s) => ({ value: s.code, label: s.label }))}
            />
          </FormGroup>
          <FormGroup label="Blood group *">
            <SearchableSelect
              value={form.bloodGroupCode}
              onChange={(v) => set("bloodGroupCode", v)}
              options={groups.map((g) => ({ value: g.code, label: g.label }))}
              placeholder="Select group"
            />
          </FormGroup>
          <FormGroup label="Component *">
            <SearchableSelect
              value={form.componentCode}
              onChange={(v) => set("componentCode", v)}
              options={components.map((c) => ({ value: c.code, label: c.label }))}
            />
          </FormGroup>
          {!isExternal && (
            <div className="hms-bb-modal-grid__full">
              <FormGroup label="Donor *">
                <SearchableSelect
                  value={form.donorId}
                  onChange={(v) => set("donorId", v)}
                  options={donors.map((d) => ({
                    value: d.id,
                    label: `${d.donorCode} — ${d.firstName} ${d.lastName ?? ""} (${d.bloodGroupCode || "?"})`,
                  }))}
                  placeholder="Search donor"
                />
              </FormGroup>
            </div>
          )}
          <FormGroup label="Volume (ml)">
            <Input type="number" min="0" value={form.volumeMl} onChange={(e) => set("volumeMl", e.target.value)} />
          </FormGroup>
          <FormGroup label="Collection date">
            <Input type="date" value={form.collectionDate} onChange={(e) => set("collectionDate", e.target.value)} />
          </FormGroup>
          <FormGroup label="Storage location">
            <Input value={form.storageLocation} onChange={(e) => set("storageLocation", e.target.value)} placeholder="Refrigerator A, shelf 2" />
          </FormGroup>
          <FormGroup label="Cost price (₹)">
            <Input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} />
          </FormGroup>
          <FormGroup label="Sale price (₹)">
            <Input type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
          </FormGroup>
          <FormGroup label="Screening cleared">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.screeningPassed}
                onChange={(e) => set("screeningPassed", e.target.checked)}
              />
              All TTI tests negative
            </label>
          </FormGroup>
          <div className="hms-bb-modal-grid__full">
            <FormGroup label="Notes">
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </FormGroup>
          </div>
        </div>
      </form>
    </Modal>
  );
}
