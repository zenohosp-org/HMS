import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { doctorsApi, staffApi } from "@/utils/api";
import StateSelect from "@/components/StateSelect";
import SidePane from "@/components/SidePane";
import {
  UserPlus, Stethoscope, Phone, MapPin, Calendar,
  Briefcase, User, Building2, Home, Lock, X, Check,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const STEPS = [
  { id: 1, icon: UserPlus,    title: "Account Setup",   subtitle: "Login credentials" },
  { id: 2, icon: Stethoscope, title: "Professional",    subtitle: "Credentials & registration" },
  { id: 3, icon: Phone,       title: "Contact",         subtitle: "Work & personal" },
  { id: 4, icon: MapPin,      title: "Address",         subtitle: "Clinic & home" },
  { id: 5, icon: Calendar,    title: "Schedule & Fees", subtitle: "Availability & pricing" },
];

const PROGRESS_WIDTH = { 1: "w-1/5", 2: "w-2/5", 3: "w-3/5", 4: "w-4/5", 5: "w-full" };

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
    <div className="rounded-xl border border-slate-100 dark:border-[#222222] bg-slate-50/60 dark:bg-[#0f0f0f] p-5 space-y-4">
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

const inputBase =
  "w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 dark:focus:border-blue-500 transition-all";

const textareaBase =
  "w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 dark:focus:border-blue-500 transition-all resize-none";

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

  const [step, setStep] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [slideDir, setSlideDir] = useState("forward");

  const [sameAddress, setSameAddress] = useState(false);

  const [userForm, setUserForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", state: "",
  });

  const [doctorForm, setDoctorForm] = useState({
    specialization:           editDoctor?.specialization || "",
    qualification:            editDoctor?.qualification || "",
    medicalRegistrationNumber: editDoctor?.medicalRegistrationNumber || "",
    registrationCouncil:      editDoctor?.registrationCouncil || "",
    workPhone:                editDoctor?.workPhone || "",
    personalPhone:            editDoctor?.personalPhone || "",
    workEmail:                editDoctor?.workEmail || "",
    personalEmail:            editDoctor?.personalEmail || "",
    workAddress:              editDoctor?.workAddress || "",
    residentialAddress:       editDoctor?.residentialAddress || "",
    consultationFee:          editDoctor?.consultationFee || 500,
    followUpFee:              editDoctor?.followUpFee || 300,
    availableDays:            editDoctor?.availableDays || "MON,TUE,WED,THU,FRI",
    slotDurationMin:          editDoctor?.slotDurationMin || 15,
    maxDailySlots:            editDoctor?.maxDailySlots || 40,
  });

  const setDoc = (patch) => setDoctorForm((p) => ({ ...p, ...patch }));
  const setUser = (patch) => setUserForm((p) => ({ ...p, ...patch }));

  const activeDays = doctorForm.availableDays.split(",").map((d) => d.trim()).filter(Boolean);
  const slotMin = doctorForm.slotDurationMin || 0;
  const slotsPerDay = doctorForm.maxDailySlots || 0;
  const totalMinPerDay = slotMin * slotsPerDay;
  const totalMinPerWeek = totalMinPerDay * activeDays.length;

  const toggleDay = (day) => {
    const current = activeDays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setDoc({ availableDays: DAYS.filter((d) => next.includes(d)).join(",") });
  };

  const validate = (s) => {
    if (s === 1) {
      if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim() || !userForm.password.trim()) {
        notify("Please fill in all required account fields", "error");
        return false;
      }
      if (userForm.password.length < 6) {
        notify("Password must be at least 6 characters", "error");
        return false;
      }
    }
    if (s === 2) {
      if (!doctorForm.specialization.trim() || !doctorForm.qualification.trim() || !doctorForm.medicalRegistrationNumber.trim() || !doctorForm.registrationCouncil.trim()) {
        notify("Please fill in all professional details", "error");
        return false;
      }
    }
    if (s === 5) {
      if (!doctorForm.consultationFee || !doctorForm.slotDurationMin || !doctorForm.maxDailySlots || activeDays.length === 0) {
        notify("Please complete scheduling & fee details", "error");
        return false;
      }
    }
    return true;
  };

  const goTo = (target) => {
    if (target > step && !validate(step)) return;
    const dir = target > step ? "forward" : "backward";
    setSlideDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(target);
      setAnimating(false);
    }, 200);
  };

  const handleClose = () => {
    if (editDoctor) {
      setPaneOpen(false);
      setTimeout(onClose, 290);
    } else {
      onClose();
    }
  };

  const handleCreate = async () => {
    if (!validate(step)) return;
    if (!user?.hospitalId) return;
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
    e.preventDefault();
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

  // ─── Step content ──────────────────────────────────────────────────────────

  const stepContent = {
    1: (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create login account</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            These credentials will be used by the doctor to log into the HMS.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel required>First Name</FieldLabel>
            <input required type="text" autoFocus value={userForm.firstName}
              onChange={(e) => setUser({ firstName: e.target.value })}
              className={inputBase} placeholder="Arjun" />
          </div>
          <div>
            <FieldLabel required>Last Name</FieldLabel>
            <input required type="text" value={userForm.lastName}
              onChange={(e) => setUser({ lastName: e.target.value })}
              className={inputBase} placeholder="Sharma" />
          </div>
          <div>
            <FieldLabel required>Email Address</FieldLabel>
            <input required type="email" value={userForm.email}
              onChange={(e) => setUser({ email: e.target.value })}
              className={inputBase} placeholder="doctor@hospital.com" />
          </div>
          <div>
            <FieldLabel>Phone Number</FieldLabel>
            <input type="tel" value={userForm.phone}
              onChange={(e) => setUser({ phone: e.target.value })}
              className={inputBase} placeholder="+91 98765 43210" />
          </div>
          <div className="col-span-2">
            <FieldLabel required>Temporary Password</FieldLabel>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input required type="password" value={userForm.password}
                onChange={(e) => setUser({ password: e.target.value })}
                className={`${inputBase} pl-11`} placeholder="Min. 6 characters" />
            </div>
          </div>
        </div>
      </div>
    ),

    2: (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Professional identity</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Medical specialization, qualifications, and official registration details.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Specialization</FieldLabel>
            <input required type="text" autoFocus value={doctorForm.specialization}
              onChange={(e) => setDoc({ specialization: e.target.value })}
              className={inputBase} placeholder="e.g. Cardiologist" />
          </div>
          <div>
            <FieldLabel required>Qualification</FieldLabel>
            <input required type="text" value={doctorForm.qualification}
              onChange={(e) => setDoc({ qualification: e.target.value })}
              className={inputBase} placeholder="e.g. MBBS, MD" />
          </div>
          <div>
            <FieldLabel required>Registration Number</FieldLabel>
            <input required type="text" value={doctorForm.medicalRegistrationNumber}
              onChange={(e) => setDoc({ medicalRegistrationNumber: e.target.value })}
              className={inputBase} placeholder="MRC-XXXXXX" />
          </div>
          <div>
            <FieldLabel required>Registration Council</FieldLabel>
            <input required type="text" value={doctorForm.registrationCouncil}
              onChange={(e) => setDoc({ registrationCouncil: e.target.value })}
              className={inputBase} placeholder="e.g. Tamil Nadu Medical Council" />
          </div>
        </div>
        <div className="rounded-xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4">
          <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
            Registration details are used for verification and will appear on official prescriptions and patient-facing documents.
          </p>
        </div>
      </div>
    ),

    3: (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Contact information</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Separate work and personal contact details for internal use.
          </p>
        </div>
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
    ),

    4: (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Address details</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Clinic/hospital work address and residential address for records.
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            <FieldLabel>Work / Clinic Address</FieldLabel>
          </div>
          <textarea rows={4} value={doctorForm.workAddress}
            onChange={(e) => {
              setDoc({ workAddress: e.target.value });
              if (sameAddress) setDoc({ residentialAddress: e.target.value });
            }}
            className={textareaBase}
            placeholder="Hospital/clinic name, street, area, city, pincode" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer group w-fit select-none">
          <div
            onClick={() => {
              const next = !sameAddress;
              setSameAddress(next);
              if (next) setDoc({ residentialAddress: doctorForm.workAddress });
            }}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
              sameAddress
                ? "bg-blue-500 border-blue-500"
                : "border-slate-300 dark:border-[#3a3a3a] group-hover:border-blue-400"
            }`}
          >
            {sameAddress && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Residential address is same as work address</span>
        </label>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Home className="w-4 h-4 text-violet-500" />
            <FieldLabel>Residential Address</FieldLabel>
          </div>
          <textarea rows={4}
            value={doctorForm.residentialAddress}
            onChange={(e) => setDoc({ residentialAddress: e.target.value })}
            disabled={sameAddress}
            className={`${textareaBase} ${sameAddress ? "opacity-40 cursor-not-allowed" : ""}`}
            placeholder="Home address, street, area, city, pincode" />
        </div>
        <StateSelect
          value={userForm.state}
          onChange={(val) => setUser({ state: val })}
          inputClassName={inputBase}
          labelClassName="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
        />
      </div>
    ),

    5: (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Schedule & fees</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Set consultation pricing, working days, and appointment slot settings.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Consultation Fee (₹)</FieldLabel>
            <input required type="number" min="1" step="0.01" value={doctorForm.consultationFee || ""}
              onChange={(e) => setDoc({ consultationFee: parseFloat(e.target.value) || 0 })}
              className={inputBase} placeholder="500" />
          </div>
          <div>
            <FieldLabel required>Follow-up Fee (₹)</FieldLabel>
            <input required type="number" min="1" step="0.01" value={doctorForm.followUpFee || ""}
              onChange={(e) => setDoc({ followUpFee: parseFloat(e.target.value) || 0 })}
              className={inputBase} placeholder="300" />
          </div>
          <div>
            <FieldLabel required>Slot Duration (min)</FieldLabel>
            <input required type="number" min="5" step="5" value={doctorForm.slotDurationMin || ""}
              onChange={(e) => setDoc({ slotDurationMin: parseInt(e.target.value) || 0 })}
              className={inputBase} placeholder="15" />
          </div>
          <div>
            <FieldLabel required>Max Daily Slots</FieldLabel>
            <input required type="number" min="1" value={doctorForm.maxDailySlots || ""}
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
              { label: "Slot", value: slotMin > 0 ? `${slotMin} min` : "—" },
              { label: "Per Day", value: slotsPerDay > 0 ? slotsPerDay : "—" },
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
    ),
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
                  <input required={req} type="text" value={doctorForm[key]}
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

          {/* Scheduling */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Schedule & Fees</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Consultation (₹)", key: "consultationFee", type: "number", step: "0.01", req: true },
                { label: "Follow-up (₹)", key: "followUpFee", type: "number", step: "0.01", req: true },
                { label: "Slot Duration (min)", key: "slotDurationMin", type: "number", step: "5", req: true },
                { label: "Max Daily Slots", key: "maxDailySlots", type: "number", req: true },
              ].map(({ label, key, type, step: st, req }) => (
                <div key={key}>
                  <FieldLabel required={req}>{label}</FieldLabel>
                  <input required={req} type={type} step={st} min="1" value={doctorForm[key] || ""}
                    onChange={(e) => setDoc({ [key]: type === "number" ? (st === "0.01" ? parseFloat(e.target.value) : parseInt(e.target.value)) || 0 : e.target.value })}
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
                        active
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white dark:bg-[#161616] text-slate-400 border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300"
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

  // ── Create mode: multi-step wizard ────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-5xl h-[88vh] flex rounded-2xl overflow-hidden shadow-2xl border border-white/10">

        {/* ── Left: dark step sidebar ── */}
        <div className="w-72 shrink-0 bg-slate-900 flex flex-col">
          {/* Branding */}
          <div className="px-7 pt-8 pb-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Add New Doctor</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Step {step} of {STEPS.length}</p>
              </div>
            </div>
          </div>

          {/* Step list */}
          <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {STEPS.map((s, i) => {
              const done = step > s.id;
              const active = step === s.id;
              const Icon = s.icon;
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    onClick={() => { if (done) goTo(s.id); }}
                    className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all text-left ${
                      active ? "bg-white/10 shadow-inner" : done ? "hover:bg-white/5 cursor-pointer" : "cursor-default opacity-50"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                      done ? "bg-blue-500 shadow-md shadow-blue-500/30" : active ? "bg-white" : "bg-slate-700/60"
                    }`}>
                      {done
                        ? <Check className="w-4 h-4 text-white" />
                        : <Icon className={`w-4 h-4 ${active ? "text-slate-900" : "text-slate-400"}`} />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold leading-tight truncate ${active ? "text-white" : done ? "text-slate-300" : "text-slate-500"}`}>
                        {s.title}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${active ? "text-slate-300" : "text-slate-600"}`}>
                        {s.subtitle}
                      </p>
                    </div>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className="ml-8 pl-[18px] py-0.5">
                      <div className={`w-px h-5 transition-all duration-500 ${done ? "bg-blue-500/40" : "bg-slate-700/60"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hint */}
          <div className="px-4 pb-6">
            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Click any completed step to go back and edit. Required fields are marked with <span className="text-rose-400">*</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: content area ── */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#111111] overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100 dark:bg-[#1a1a1a] shrink-0">
            <div className={`h-full bg-blue-500 transition-all duration-500 ease-out ${PROGRESS_WIDTH[step]}`} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-[#1a1a1a] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />; })()}
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Step {step} / {STEPS.length}</p>
                <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{STEPS[step - 1].title}</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step content with animation */}
          <div className={`flex-1 overflow-y-auto px-8 py-7 transition-all duration-200 ${
            animating
              ? slideDir === "forward" ? "opacity-0 translate-x-5" : "opacity-0 -translate-x-5"
              : "opacity-100 translate-x-0"
          }`}>
            {stepContent[step]}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-8 py-5 border-t border-slate-100 dark:border-[#1a1a1a] bg-slate-50/50 dark:bg-[#0a0a0a]">
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                step === 1
                  ? "invisible"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a]"
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((s) => (
                <div key={s.id}
                  className={`rounded-full transition-all duration-300 ${
                    s.id === step
                      ? "w-7 h-2.5 bg-blue-500"
                      : s.id < step
                      ? "w-2.5 h-2.5 bg-blue-300 dark:bg-blue-700 cursor-pointer"
                      : "w-2.5 h-2.5 bg-slate-200 dark:bg-[#2a2a2a]"
                  }`}
                  onClick={() => { if (s.id < step) goTo(s.id); }}
                />
              ))}
            </div>

            {step < STEPS.length ? (
              <button
                type="button"
                onClick={() => goTo(step + 1)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold transition-all hover:opacity-90 active:scale-95"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-all active:scale-95 min-w-[140px] justify-center disabled:opacity-60"
              >
                {submitting ? "Creating…" : <><Check className="w-4 h-4" /> Create Profile</>}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export { DoctorFormModal as default };
