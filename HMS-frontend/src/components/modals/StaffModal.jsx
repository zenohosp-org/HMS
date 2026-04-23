import { useState } from "react";
import { validateEmail, validateRequired, validatePassword } from "@/utils/validators";
function StaffModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "STAFF",
    specialization: "",
    department: ""
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));
  const validate = () => {
    const e = {};
    const fn = validateRequired(form.firstName, "First name");
    const em = validateEmail(form.email);
    const pw = validatePassword(form.password);
    if (fn) e.firstName = fn;
    if (em) e.email = em;
    if (pw) e.password = pw;
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"><div className="card w-full max-w-lg mx-4"><div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Add Staff / Doctor</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button></div><form onSubmit={handleSubmit} className="p-6 space-y-4">{
    /* Role selector */
  }<div><label className="label">Role *</label><div className="flex gap-3">{["STAFF", "DOCTOR"].map((r) => <button
    key={r}
    type="button"
    onClick={() => set("role", r)}
    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                    ${form.role === r ? "bg-primary-600 border-primary-600 text-white" : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
  >{r === "DOCTOR" ? "\u{1F468}\u200D\u2695\uFE0F Doctor" : "\u{1F9D1}\u200D\u{1F4BC} Staff"}</button>)}</div></div><div className="grid grid-cols-2 gap-4"><div><label className="label">First Name *</label><input
    className="input"
    value={form.firstName}
    onChange={(e) => set("firstName", e.target.value)}
  />{errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}</div><div><label className="label">Last Name</label><input
    className="input"
    value={form.lastName}
    onChange={(e) => set("lastName", e.target.value)}
  /></div></div><div><label className="label">Email *</label><input
    type="email"
    className="input"
    value={form.email}
    onChange={(e) => set("email", e.target.value)}
  />{errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}</div><div><label className="label">Temporary Password *</label><input
    type="password"
    className="input"
    value={form.password}
    onChange={(e) => set("password", e.target.value)}
    placeholder="Min 6 characters"
  />{errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}</div>{form.role === "DOCTOR" && <div className="grid grid-cols-2 gap-4"><div><label className="label">Specialization</label><input
    className="input"
    placeholder="e.g. Cardiology"
    value={form.specialization}
    onChange={(e) => set("specialization", e.target.value)}
  /></div><div><label className="label">Department</label><input
    className="input"
    placeholder="e.g. ICU"
    value={form.department}
    onChange={(e) => set("department", e.target.value)}
  /></div></div>}<div className="flex justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Creating\u2026" : "Create Account"}</button></div></form></div></div>;
}
export {
  StaffModal as default
};
