import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { doctorsApi, staffApi } from "@/utils/api";
import StateSelect from "@/components/StateSelect";
import SidePane from "@/components/SidePane";
import {
  Stethoscope, Briefcase, User, Building2, Home, Lock, X,
} from "lucide-react";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const inputBase =
  "w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 dark:focus:border-blue-500 transition-all";

const textareaBase =
  "w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 dark:focus:border-blue-500 transition-all resize-none";

function SectionTitle({ children }) {
  return (
    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
      {children}
    </p>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
      {children}
      {required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
  );
}

function ContactGroup({ icon: Icon, label, colorClass, children }) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-[#222222] bg-slate-50/60 dark:bg-[#0f0f0f] p-4 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}

function fmtDuration(mins) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h} hrs`;
  return `${m} min`;
}

function DoctorFormModal({ onClose, onSaved, editDoctor }) {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [submitting, setSubmitting] = useState(false);
  const [paneOpen, setPaneOpen] = useState(true);
  const [sameAddress, setSameAddress] = useState(false);

  const [userForm, setUserForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", state: "",
  });

  const [doctorForm, setDoctorForm] = useState({
    specialization:            editDoctor?.specialization || "",
    qualification:             editDoctor?.qualification || "",
    medicalRegistrationNumber: editDoctor?.medicalRegistrationNumber || "",
    registrationCouncil:       editDoctor?.registrationCouncil || "",
    workPhone:                 editDoctor?.workPhone || "",
    personalPhone:             editDoctor?.personalPhone || "",
    workEmail:                 editDoctor?.workEmail || "",
    personalEmail:             editDoctor?.personalEmail || "",
    workAddress:               editDoctor?.workAddress || "",
    residentialAddress:        editDoctor?.residentialAddress || "",
    consultationFee:           editDoctor?.consultationFee || 500,
    followUpFee:               editDoctor?.followUpFee || 300,
    availableDays:             editDoctor?.availableDays || "MON,TUE,WED,THU,FRI",
    slotDurationMin:           editDoctor?.slotDurationMin || 15,
    maxDailySlots:             editDoctor?.maxDailySlots || 40,
  });

  const setDoc = (patch) => setDoctorForm((p) => ({ ...p, ...patch }));
  const setUser = (patch) => setUserForm((p) => ({ ...p, ...patch }));

  const activeDays = doctorForm.availableDays.split(",").map((d) => d.trim()).filter(Boolean);
  const slotMin = doctorForm.slotDurationMin || 0;
  const slotsPerDay = doctorForm.maxDailySlots || 0;
  const totalMinPerDay = slotMin * slotsPerDay;
  const totalMinPerWeek = totalMinPerDay * activeDays.length;

  const toggleDay = (day) => {
    const next = activeDays.includes(day)
      ? activeDays.filter((d) => d !== day)
      : [...activeDays, day];
    setDoc({ availableDays: DAYS.filter((d) => next.includes(d)).join(",") });
  };

  const handleClose = () => {
    if (editDoctor) { setPaneOpen(false); setTimeout(onClose, 290); }
    else onClose();
  };

  const validateCreate = () => {
    if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim() || !userForm.password.trim()) {
      notify("Please fill in all required account fields", "error"); return false;
    }
    if (userForm.password.length < 6) {
      notify("Password must be at least 6 characters", "error"); return false;
    }
    if (!doctorForm.specialization.trim() || !doctorForm.qualification.trim() || !doctorForm.medicalRegistrationNumber.trim() || !doctorForm.registrationCouncil.trim()) {
      notify("Please fill in all professional details", "error"); return false;
    }
    if (!doctorForm.consultationFee || !doctorForm.slotDurationMin || !doctorForm.maxDailySlots || activeDays.length === 0) {
      notify("Please complete scheduling & fee details", "error"); return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateCreate() || !user?.hospitalId) return;
    setSubmitting(true);
    try {
      const newUser = await staffApi.create({ ...userForm, role: "DOCTOR", hospitalId: user.hospitalId });
      await doctorsApi.create({ ...doctorForm, userId: newUser.id, hospitalId: user.hospitalId });
      notify("Doctor profile created", "success");
      onSaved();
      onClose();
    } catch (error) {
      notify(error.response?.data?.error || "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e?.preventDefault();
    if (!user?.hospitalId) return;
    setSubmitting(true);
    try {
      await doctorsApi.update(editDoctor.id, doctorForm);
      notify("Doctor profile updated", "success");
      onSaved();
      setPaneOpen(false);
      setTimeout(onClose, 290);
    } catch (error) {
      notify(error.response?.data?.error || "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit mode: SidePane ───────────────────────────────────────────────────
  if (editDoctor) {
    const initials = `${editDoctor.firstName?.[0] ?? ""}${editDoctor.lastName?.[0] ?? ""}`.toUpperCase();
    return (
      <SidePane
        isOpen={paneOpen}
        onClose={handleClose}
        title="Edit Doctor Profile"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleUpdate} disabled={submitting} className="btn-primary min-w-[120px]">
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleUpdate} className="space-y-8">
          {/* Doctor card */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#0f0f0f] border border-slate-100 dark:border-[#1e1e1e]">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800/30 flex items-center justify-center text-lg font-bold text-blue-700 dark:text-blue-400 shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                Dr. {editDoctor.firstName} {editDoctor.lastName}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{editDoctor.email}</p>
              <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                editDoctor.userIsActive
                  ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30"
                  : "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/30"
              }`}>
                {editDoctor.userIsActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Professional */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Professional</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Specialization", key: "specialization", placeholder: "e.g. Cardiologist", req: true },
                { label: "Qualification", key: "qualification", placeholder: "e.g. MBBS, MD", req: true },
                { label: "Registration No.", key: "medicalRegistrationNumber", placeholder: "MRC-XXXXXX", req: true },
                { label: "Council", key: "registrationCouncil", placeholder: "Tamil Nadu MC", req: true },
              ].map(({ label, key, placeholder, req }) => (
                <div key={key}>
                  <FieldLabel required={req}>{label}</FieldLabel>
                  <input type="text" value={doctorForm[key]}
                    onChange={(e) => setDoc({ [key]: e.target.value })}
                    className={inputBase} placeholder={placeholder} />
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contact</p>
            <ContactGroup icon={Briefcase} label="Work" colorClass="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Work Phone</FieldLabel>
                  <input type="tel" value={doctorForm.workPhone} onChange={(e) => setDoc({ workPhone: e.target.value })} className={inputBase} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <FieldLabel>Work Email</FieldLabel>
                  <input type="email" value={doctorForm.workEmail} onChange={(e) => setDoc({ workEmail: e.target.value })} className={inputBase} placeholder="dr@hospital.com" />
                </div>
              </div>
            </ContactGroup>
            <ContactGroup icon={User} label="Personal" colorClass="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Personal Phone</FieldLabel>
                  <input type="tel" value={doctorForm.personalPhone} onChange={(e) => setDoc({ personalPhone: e.target.value })} className={inputBase} placeholder="+91 99999 00000" />
                </div>
                <div>
                  <FieldLabel>Personal Email</FieldLabel>
                  <input type="email" value={doctorForm.personalEmail} onChange={(e) => setDoc({ personalEmail: e.target.value })} className={inputBase} placeholder="name@personal.com" />
                </div>
              </div>
            </ContactGroup>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Address</p>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <FieldLabel>Work / Clinic</FieldLabel>
              </div>
              <textarea rows={3} value={doctorForm.workAddress}
                onChange={(e) => { setDoc({ workAddress: e.target.value }); if (sameAddress) setDoc({ residentialAddress: e.target.value }); }}
                className={textareaBase} placeholder="Hospital/clinic, street, city, pincode" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer group w-fit select-none">
              <div onClick={() => { const n = !sameAddress; setSameAddress(n); if (n) setDoc({ residentialAddress: doctorForm.workAddress }); }}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${sameAddress ? "bg-blue-500 border-blue-500" : "border-slate-300 dark:border-[#3a3a3a] group-hover:border-blue-400"}`}>
                {sameAddress && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Same as work address</span>
            </label>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Home className="w-3.5 h-3.5 text-violet-500" />
                <FieldLabel>Residential</FieldLabel>
              </div>
              <textarea rows={3} value={doctorForm.residentialAddress}
                onChange={(e) => setDoc({ residentialAddress: e.target.value })}
                disabled={sameAddress}
                className={`${textareaBase} ${sameAddress ? "opacity-40 cursor-not-allowed" : ""}`}
                placeholder="Home, street, city, pincode" />
            </div>
          </div>

          {/* Schedule & Fees */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Schedule & Fees</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Consultation (₹)", key: "consultationFee", type: "number", step: "0.01" },
                { label: "Follow-up (₹)", key: "followUpFee", type: "number", step: "0.01" },
                { label: "Slot Duration (min)", key: "slotDurationMin", type: "number", step: "5" },
                { label: "Max Daily Slots", key: "maxDailySlots", type: "number" },
              ].map(({ label, key, type, step: st }) => (
                <div key={key}>
                  <FieldLabel required>{label}</FieldLabel>
                  <input type={type} step={st} min="1" value={doctorForm[key] || ""}
                    onChange={(e) => setDoc({ [key]: st === "0.01" ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0 })}
                    className={inputBase} />
                </div>
              ))}
            </div>
            <div>
              <FieldLabel required>Available Days</FieldLabel>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {DAYS.map((day) => {
                  const active = activeDays.includes(day);
                  return (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        active ? "bg-blue-500 text-white border-blue-500" : "bg-white dark:bg-[#161616] text-slate-400 border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300"
                      }`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </form>
      </SidePane>
    );
  }

  // ── Create mode: single-view modal ───────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-[#111111] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#222222] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Add New Doctor</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Fill in all details to create the doctor's profile</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

          {/* ── Account Setup ── */}
          <div>
            <SectionTitle>Account Setup</SectionTitle>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>First Name</FieldLabel>
                  <input autoFocus type="text" value={userForm.firstName}
                    onChange={(e) => setUser({ firstName: e.target.value })}
                    className={inputBase} placeholder="Arjun" />
                </div>
                <div>
                  <FieldLabel required>Last Name</FieldLabel>
                  <input type="text" value={userForm.lastName}
                    onChange={(e) => setUser({ lastName: e.target.value })}
                    className={inputBase} placeholder="Sharma" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Email Address</FieldLabel>
                  <input type="email" value={userForm.email}
                    onChange={(e) => setUser({ email: e.target.value })}
                    className={inputBase} placeholder="doctor@hospital.com" />
                </div>
                <div>
                  <FieldLabel>Phone Number</FieldLabel>
                  <input type="tel" value={userForm.phone}
                    onChange={(e) => setUser({ phone: e.target.value })}
                    className={inputBase} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div>
                <FieldLabel required>Temporary Password</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={userForm.password}
                    onChange={(e) => setUser({ password: e.target.value })}
                    className={`${inputBase} pl-11`} placeholder="Min. 6 characters" />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-[#1e1e1e]" />

          {/* ── Professional Identity ── */}
          <div>
            <SectionTitle>Professional Identity</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Specialization</FieldLabel>
                <input type="text" value={doctorForm.specialization}
                  onChange={(e) => setDoc({ specialization: e.target.value })}
                  className={inputBase} placeholder="e.g. Cardiologist" />
              </div>
              <div>
                <FieldLabel required>Qualification</FieldLabel>
                <input type="text" value={doctorForm.qualification}
                  onChange={(e) => setDoc({ qualification: e.target.value })}
                  className={inputBase} placeholder="e.g. MBBS, MD" />
              </div>
              <div>
                <FieldLabel required>Registration Number</FieldLabel>
                <input type="text" value={doctorForm.medicalRegistrationNumber}
                  onChange={(e) => setDoc({ medicalRegistrationNumber: e.target.value })}
                  className={inputBase} placeholder="MRC-XXXXXX" />
              </div>
              <div>
                <FieldLabel required>Registration Council</FieldLabel>
                <input type="text" value={doctorForm.registrationCouncil}
                  onChange={(e) => setDoc({ registrationCouncil: e.target.value })}
                  className={inputBase} placeholder="e.g. Tamil Nadu Medical Council" />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-[#1e1e1e]" />

          {/* ── Contact Information ── */}
          <div>
            <SectionTitle>Contact Information</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <ContactGroup icon={Briefcase} label="Work" colorClass="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                <div>
                  <FieldLabel>Work Phone</FieldLabel>
                  <input type="tel" value={doctorForm.workPhone}
                    onChange={(e) => setDoc({ workPhone: e.target.value })}
                    className={inputBase} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <FieldLabel>Work Email</FieldLabel>
                  <input type="email" value={doctorForm.workEmail}
                    onChange={(e) => setDoc({ workEmail: e.target.value })}
                    className={inputBase} placeholder="dr.name@hospital.com" />
                </div>
              </ContactGroup>
              <ContactGroup icon={User} label="Personal" colorClass="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
                <div>
                  <FieldLabel>Personal Phone</FieldLabel>
                  <input type="tel" value={doctorForm.personalPhone}
                    onChange={(e) => setDoc({ personalPhone: e.target.value })}
                    className={inputBase} placeholder="+91 99999 00000" />
                </div>
                <div>
                  <FieldLabel>Personal Email</FieldLabel>
                  <input type="email" value={doctorForm.personalEmail}
                    onChange={(e) => setDoc({ personalEmail: e.target.value })}
                    className={inputBase} placeholder="name@personal.com" />
                </div>
              </ContactGroup>
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-[#1e1e1e]" />

          {/* ── Address ── */}
          <div>
            <SectionTitle>Address</SectionTitle>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <FieldLabel>Work / Clinic Address</FieldLabel>
                </div>
                <textarea rows={3} value={doctorForm.workAddress}
                  onChange={(e) => { setDoc({ workAddress: e.target.value }); if (sameAddress) setDoc({ residentialAddress: e.target.value }); }}
                  className={textareaBase} placeholder="Hospital/clinic name, street, area, city, pincode" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer group w-fit select-none">
                <div
                  onClick={() => { const n = !sameAddress; setSameAddress(n); if (n) setDoc({ residentialAddress: doctorForm.workAddress }); }}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                    sameAddress ? "bg-blue-500 border-blue-500" : "border-slate-300 dark:border-[#3a3a3a] group-hover:border-blue-400"
                  }`}
                >
                  {sameAddress && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Residential address same as work address</span>
              </label>
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Home className="w-3.5 h-3.5 text-violet-500" />
                  <FieldLabel>Residential Address</FieldLabel>
                </div>
                <textarea rows={3} value={doctorForm.residentialAddress}
                  onChange={(e) => setDoc({ residentialAddress: e.target.value })}
                  disabled={sameAddress}
                  className={`${textareaBase} ${sameAddress ? "opacity-40 cursor-not-allowed" : ""}`}
                  placeholder="Home address, street, area, city, pincode" />
              </div>
              <StateSelect
                value={userForm.state}
                onChange={(val) => setUser({ state: val })}
                inputClassName={`${inputBase} flex items-center justify-between text-left`}
                labelClassName="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
              />
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-[#1e1e1e]" />

          {/* ── Schedule & Fees ── */}
          <div>
            <SectionTitle>Schedule & Fees</SectionTitle>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Consultation Fee (₹)</FieldLabel>
                  <input type="number" min="1" step="0.01" value={doctorForm.consultationFee || ""}
                    onChange={(e) => setDoc({ consultationFee: parseFloat(e.target.value) || 0 })}
                    className={inputBase} placeholder="500" />
                </div>
                <div>
                  <FieldLabel required>Follow-up Fee (₹)</FieldLabel>
                  <input type="number" min="1" step="0.01" value={doctorForm.followUpFee || ""}
                    onChange={(e) => setDoc({ followUpFee: parseFloat(e.target.value) || 0 })}
                    className={inputBase} placeholder="300" />
                </div>
                <div>
                  <FieldLabel required>Slot Duration (min)</FieldLabel>
                  <input type="number" min="5" step="5" value={doctorForm.slotDurationMin || ""}
                    onChange={(e) => setDoc({ slotDurationMin: parseInt(e.target.value) || 0 })}
                    className={inputBase} placeholder="15" />
                </div>
                <div>
                  <FieldLabel required>Max Daily Slots</FieldLabel>
                  <input type="number" min="1" value={doctorForm.maxDailySlots || ""}
                    onChange={(e) => setDoc({ maxDailySlots: parseInt(e.target.value) || 0 })}
                    className={inputBase} placeholder="40" />
                </div>
              </div>
              <div>
                <FieldLabel required>Available Days</FieldLabel>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAYS.map((day) => {
                    const active = activeDays.includes(day);
                    return (
                      <button key={day} type="button" onClick={() => toggleDay(day)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          active
                            ? "bg-blue-500 text-white border-blue-500 shadow-sm shadow-blue-200 dark:shadow-blue-900/30"
                            : "bg-white dark:bg-[#161616] text-slate-400 border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-[#3a3a3a]"
                        }`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100 dark:border-emerald-800/20 p-5">
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-4">
                  Weekly Schedule Preview
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Slot",      value: slotMin > 0 ? `${slotMin} min` : "—" },
                    { label: "Per Day",   value: slotsPerDay > 0 ? slotsPerDay : "—" },
                    { label: "Hrs / Day", value: fmtDuration(totalMinPerDay) },
                    { label: "Days / Wk", value: activeDays.length > 0 ? activeDays.length : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/70 dark:bg-black/20 rounded-xl p-3 text-center">
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-800/20 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total clinical hours / week</span>
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtDuration(totalMinPerWeek)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end gap-3 px-7 py-5 border-t border-slate-100 dark:border-[#1a1a1a] bg-slate-50/50 dark:bg-[#0a0a0a]">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={submitting}
            className="btn-primary min-w-[140px] justify-center">
            {submitting ? "Creating…" : "Create Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { DoctorFormModal as default };
