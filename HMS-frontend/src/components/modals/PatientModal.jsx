import { useState } from "react";
import { validateEmail, validateRequired, validatePhone } from "@/utils/validators";
import StateSelect from "@/components/StateSelect";
import SidePane from "@/components/SidePane";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const INSURANCE_SCHEMES = [
  "None",
  "Ayushman Bharat / PMJAY",
  "CGHS",
  "ESI / ESIC",
  "ECHS (Defence)",
  "Private / Corporate",
  "Other",
];

const EMERGENCY_RELATIONS = [
  "Father", "Mother", "Spouse / Partner", "Son", "Daughter",
  "Brother", "Sister", "Guardian", "Friend", "Other",
];

function formatAadhaar(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{4})(\d{0,4})(\d{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-'));
}

function PatientModal({ patient, onClose, onSave }) {
  const isEdit = !!patient;
  const [paneOpen, setPaneOpen] = useState(true);
  const VALID_GENDERS = ["Male", "Female", "Other"];
  const [form, setForm] = useState({
    firstName: patient?.firstName ?? "",
    lastName: patient?.lastName === "—" ? "" : (patient?.lastName ?? ""),
    dob: patient?.dob ?? "",
    gender: VALID_GENDERS.includes(patient?.gender) ? patient.gender : "",
    phone: patient?.phone ?? "",
    email: patient?.email ?? "",
    bloodGroup: patient?.bloodGroup ?? "",
    address: patient?.address ?? "",
    state: patient?.state ?? "",
    aadhaarNumber: patient?.aadhaarNumber
      ? patient.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3')
      : "",
    maritalStatus: patient?.maritalStatus ?? "",
    occupation: patient?.occupation ?? "",
    emergencyContactName: patient?.emergencyContactName ?? "",
    emergencyContactPhone: patient?.emergencyContactPhone ?? "",
    emergencyContactRelation: patient?.emergencyContactRelation ?? "",
    insuranceScheme: patient?.insuranceScheme ?? "",
    insurancePolicyNumber: patient?.insurancePolicyNumber ?? "",
    allergies: patient?.allergies ?? "",
    chronicConditions: patient?.chronicConditions ?? "",
    referredBy: patient?.referredBy ?? "",
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
    if (!form.gender) e.gender = "Gender is required";
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
    <form id="patientForm" onSubmit={handleSubmit} className="space-y-6">

      {/* ── Personal Information ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Personal Information</p>
        <div className="space-y-4">
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
                <option value="">Select gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
              {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Marital Status</label>
              <select className={inputCls} value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)}>
                <option value="">Select</option>
                <option>Single</option>
                <option>Married</option>
                <option>Divorced</option>
                <option>Widowed</option>
                <option>Separated</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Occupation</label>
              <input className={inputCls} value={form.occupation} onChange={(e) => set("occupation", e.target.value)} placeholder="e.g. Farmer, Teacher, Business" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Contact</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone *</label>
              <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <textarea rows={2} className="input resize-none" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <StateSelect value={form.state} onChange={(val) => set("state", val)}
            inputClassName="input w-full flex items-center justify-between text-left"
            labelClassName="label" />
        </div>
      </div>

      {/* ── Emergency Contact ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Emergency Contact</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} placeholder="+91 XXXXX XXXXX" />
          </div>
          <div>
            <label className={labelCls}>Relation</label>
            <select className={inputCls} value={form.emergencyContactRelation} onChange={(e) => set("emergencyContactRelation", e.target.value)}>
              <option value="">Select</option>
              {EMERGENCY_RELATIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Medical Identifiers ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Medical Identifiers</p>
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
      </div>

      {/* ── Insurance ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Insurance</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Scheme</label>
            <select className={inputCls} value={form.insuranceScheme} onChange={(e) => set("insuranceScheme", e.target.value)}>
              <option value="">Select</option>
              {INSURANCE_SCHEMES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Policy / Card Number</label>
            <input className={inputCls} value={form.insurancePolicyNumber} onChange={(e) => set("insurancePolicyNumber", e.target.value)} placeholder="e.g. PMJAY-XXXXXXXX" />
          </div>
        </div>
      </div>

      {/* ── Clinical History ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Clinical History</p>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Known Allergies</label>
            <textarea rows={2} className="input resize-none" value={form.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="e.g. Penicillin, Aspirin, Peanuts — leave blank if none" />
          </div>
          <div>
            <label className={labelCls}>Chronic Conditions / Medical History</label>
            <textarea rows={2} className="input resize-none" value={form.chronicConditions} onChange={(e) => set("chronicConditions", e.target.value)} placeholder="e.g. Diabetes Type 2, Hypertension, Asthma" />
          </div>
          <div>
            <label className={labelCls}>Referred By</label>
            <input className={inputCls} value={form.referredBy} onChange={(e) => set("referredBy", e.target.value)} placeholder="Doctor name or clinic" />
          </div>
        </div>
      </div>
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
