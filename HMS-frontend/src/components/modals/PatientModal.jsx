import { useState } from "react";
import { validateEmail, validateRequired, validatePhone } from "@/utils/validators";
import StateSelect from "@/components/StateSelect";
import SidePane from "@/components/SidePane";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function formatAadhaar(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{4})(\d{0,4})(\d{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-'));
}

function PatientModal({ patient, onClose, onSave }) {
  const isEdit = !!patient;
  const [paneOpen, setPaneOpen] = useState(true);
  const [form, setForm] = useState({
    firstName: patient?.firstName ?? "",
    lastName: patient?.lastName ?? "",
    dob: patient?.dob ?? "",
    gender: patient?.gender ?? "Male",
    phone: patient?.phone ?? "",
    email: patient?.email ?? "",
    bloodGroup: patient?.bloodGroup ?? "",
    address: patient?.address ?? "",
    state: patient?.state ?? "",
    aadhaarNumber: patient?.aadhaarNumber
      ? patient.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3')
      : "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleClose = () => {
    if (isEdit) {
      setPaneOpen(false);
      setTimeout(onClose, 290);
    } else {
      onClose();
    }
  };

  const validate = () => {
    const e = {};
    const fn = validateRequired(form.firstName, "First name");
    const ln = validateRequired(form.lastName, "Last name");
    const db = validateRequired(form.dob, "Date of birth");
    const ph = validatePhone(form.phone);
    const em = form.email ? validateEmail(form.email) : undefined;
    if (fn) e.firstName = fn;
    if (ln) e.lastName = ln;
    if (db) e.dob = db;
    if (ph) e.phone = ph;
    if (em) e.email = em;
    const aadhaarDigits = form.aadhaarNumber.replace(/\D/g, '');
    if (form.aadhaarNumber && aadhaarDigits.length !== 12) {
      e.aadhaarNumber = "Aadhaar must be exactly 12 digits";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ ...form, aadhaarNumber: form.aadhaarNumber.replace(/\D/g, '') || null });
      if (isEdit) {
        setPaneOpen(false);
        setTimeout(onClose, 290);
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "input";
  const labelCls = "label";

  const formContent = (
    <form id="patientForm" onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>First Name *</label>
          <input className={inputCls} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className={labelCls}>Last Name *</label>
          <input className={inputCls} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Date of Birth *</label>
          <input type="date" className={inputCls} value={form.dob} onChange={(e) => set("dob", e.target.value)} />
          {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
        </div>
        <div>
          <label className={labelCls}>Gender *</label>
          <select className={inputCls} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Blood Group</label>
          <select className={inputCls} value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
            <option value="">Select</option>
            {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Aadhaar Number</label>
          <input
            className={"input" + (errors.aadhaarNumber ? " border-red-400" : "")}
            value={form.aadhaarNumber}
            onChange={(e) => set("aadhaarNumber", formatAadhaar(e.target.value))}
            placeholder="XXXX-XXXX-XXXX"
            maxLength={14}
          />
          {errors.aadhaarNumber
            ? <p className="text-red-500 text-xs mt-1">{errors.aadhaarNumber}</p>
            : <p className="text-slate-400 text-[10px] mt-1">Used for Ayushman Bharat / PMJAY identification</p>
          }
        </div>
      </div>
      <div>
        <label className={labelCls}>Address</label>
        <textarea rows={2} className="input resize-none" value={form.address} onChange={(e) => set("address", e.target.value)} />
      </div>
      <StateSelect value={form.state} onChange={(val) => set("state", val)}
        inputClassName="input w-full flex items-center justify-between text-left"
        labelClassName="label" />
    </form>
  );

  if (isEdit) {
    return (
      <SidePane
        isOpen={paneOpen}
        onClose={handleClose}
        title="Edit Patient"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
            <button type="submit" form="patientForm" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Update Patient"}
            </button>
          </div>
        }
      >
        {formContent}
      </SidePane>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Register New Patient</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {formContent}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" form="patientForm" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Register Patient"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { PatientModal as default };
