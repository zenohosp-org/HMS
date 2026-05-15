import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { doctorsApi, staffApi } from "@/utils/api";
import StateSelect from "@/components/StateSelect";
import SidePane from "@/components/SidePane";
import {
  UserPlus, Stethoscope, Phone, MapPin, Calendar,
  Briefcase, User, Building2, Home, Lock, Mail,
} from "lucide-react";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-[#1e1e1e]">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
  );
}

function ContactGroup({ icon: Icon, label, color, children }) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400",
    violet: "bg-violet-50 dark:bg-violet-900/10 text-violet-600 dark:text-violet-400",
  };
  return (
    <div className="rounded-xl border border-slate-100 dark:border-[#222222] bg-slate-50/50 dark:bg-[#0f0f0f] p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all";

const textareaBase =
  "w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all resize-none";

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
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    state: "",
  });

  const [doctorForm, setDoctorForm] = useState({
    specialization: editDoctor?.specialization || "",
    qualification: editDoctor?.qualification || "",
    medicalRegistrationNumber: editDoctor?.medicalRegistrationNumber || "",
    registrationCouncil: editDoctor?.registrationCouncil || "",
    workPhone: editDoctor?.workPhone || "",
    personalPhone: editDoctor?.personalPhone || "",
    workEmail: editDoctor?.workEmail || "",
    personalEmail: editDoctor?.personalEmail || "",
    workAddress: editDoctor?.workAddress || "",
    residentialAddress: editDoctor?.residentialAddress || "",
    consultationFee: editDoctor?.consultationFee || 500,
    followUpFee: editDoctor?.followUpFee || 300,
    availableDays: editDoctor?.availableDays || "MON,TUE,WED,THU,FRI",
    slotDurationMin: editDoctor?.slotDurationMin || 15,
    maxDailySlots: editDoctor?.maxDailySlots || 40,
  });

  const setDoctor = (patch) => setDoctorForm((p) => ({ ...p, ...patch }));

  const handleSameAddress = (checked) => {
    setSameAddress(checked);
    if (checked) setDoctor({ residentialAddress: doctorForm.workAddress });
  };

  const handleClose = () => {
    setPaneOpen(false);
    setTimeout(onClose, 290);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.hospitalId) return;
    setSubmitting(true);
    try {
      if (editDoctor) {
        await doctorsApi.update(editDoctor.id, doctorForm);
        notify("Doctor profile updated", "success");
      } else {
        const newUser = await staffApi.create({
          ...userForm,
          role: "DOCTOR",
          hospitalId: user.hospitalId,
        });
        await doctorsApi.create({
          ...doctorForm,
          userId: newUser.id,
          hospitalId: user.hospitalId,
        });
        notify("Doctor profile created", "success");
      }
      onSaved();
      setPaneOpen(false);
      setTimeout(onClose, 290);
    } catch (error) {
      notify(error.response?.data?.error || "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day) => {
    const current = doctorForm.availableDays.split(",").map((d) => d.trim()).filter(Boolean);
    const selected = current.includes(day);
    const next = selected ? current.filter((d) => d !== day) : [...current, day];
    const ordered = DAYS.filter((d) => next.includes(d));
    setDoctor({ availableDays: ordered.join(",") });
  };

  const activeDays = doctorForm.availableDays.split(",").map((d) => d.trim()).filter(Boolean);
  const slotMin = doctorForm.slotDurationMin || 0;
  const slotsPerDay = doctorForm.maxDailySlots || 0;
  const totalMinPerDay = slotMin * slotsPerDay;
  const totalMinPerWeek = totalMinPerDay * activeDays.length;

  const professionalSection = (
    <div className="space-y-2">
      <SectionHeader icon={Stethoscope} title="Professional Identity" subtitle="Credentials and medical registration" />
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <FieldLabel required>Specialization</FieldLabel>
          <input
            required
            type="text"
            value={doctorForm.specialization}
            onChange={(e) => setDoctor({ specialization: e.target.value })}
            className={inputBase}
            placeholder="e.g. Cardiologist"
          />
        </div>
        <div>
          <FieldLabel required>Qualification</FieldLabel>
          <input
            required
            type="text"
            value={doctorForm.qualification}
            onChange={(e) => setDoctor({ qualification: e.target.value })}
            className={inputBase}
            placeholder="e.g. MBBS, MD"
          />
        </div>
        <div>
          <FieldLabel required>Registration Number</FieldLabel>
          <input
            required
            type="text"
            value={doctorForm.medicalRegistrationNumber}
            onChange={(e) => setDoctor({ medicalRegistrationNumber: e.target.value })}
            className={inputBase}
            placeholder="MRC-XXXXXX"
          />
        </div>
        <div>
          <FieldLabel required>Registration Council</FieldLabel>
          <input
            required
            type="text"
            value={doctorForm.registrationCouncil}
            onChange={(e) => setDoctor({ registrationCouncil: e.target.value })}
            className={inputBase}
            placeholder="e.g. Tamil Nadu MC"
          />
        </div>
      </div>
    </div>
  );

  const contactSection = (
    <div className="space-y-2">
      <SectionHeader icon={Phone} title="Contact Details" subtitle="Work and personal contact information" />
      <div className="space-y-3 pt-1">
        <ContactGroup icon={Briefcase} label="Work" color="blue">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Work Phone</FieldLabel>
              <input
                type="tel"
                value={doctorForm.workPhone}
                onChange={(e) => setDoctor({ workPhone: e.target.value })}
                className={inputBase}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <FieldLabel>Work Email</FieldLabel>
              <input
                type="email"
                value={doctorForm.workEmail}
                onChange={(e) => setDoctor({ workEmail: e.target.value })}
                className={inputBase}
                placeholder="dr.name@hospital.com"
              />
            </div>
          </div>
        </ContactGroup>
        <ContactGroup icon={User} label="Personal" color="violet">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Personal Phone</FieldLabel>
              <input
                type="tel"
                value={doctorForm.personalPhone}
                onChange={(e) => setDoctor({ personalPhone: e.target.value })}
                className={inputBase}
                placeholder="+91 99999 00000"
              />
            </div>
            <div>
              <FieldLabel>Personal Email</FieldLabel>
              <input
                type="email"
                value={doctorForm.personalEmail}
                onChange={(e) => setDoctor({ personalEmail: e.target.value })}
                className={inputBase}
                placeholder="name@personal.com"
              />
            </div>
          </div>
        </ContactGroup>
      </div>
    </div>
  );

  const addressSection = (
    <div className="space-y-2">
      <SectionHeader icon={MapPin} title="Address" subtitle="Work location and home address" />
      <div className="space-y-3 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            <FieldLabel>Work / Clinic Address</FieldLabel>
          </div>
          <textarea
            rows={3}
            value={doctorForm.workAddress}
            onChange={(e) => {
              setDoctor({ workAddress: e.target.value });
              if (sameAddress) setDoctor({ residentialAddress: e.target.value });
            }}
            className={textareaBase}
            placeholder="Hospital/clinic name, street, city, pincode"
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer group w-fit">
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${sameAddress ? "bg-blue-500 border-blue-500" : "border-slate-300 dark:border-[#3a3a3a] group-hover:border-blue-400"}`}
            onClick={() => handleSameAddress(!sameAddress)}
          >
            {sameAddress && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <input type="checkbox" className="sr-only" checked={sameAddress} onChange={(e) => handleSameAddress(e.target.checked)} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Residential address same as work address</span>
        </label>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Home className="w-3.5 h-3.5 text-violet-500" />
            <FieldLabel>Residential Address</FieldLabel>
          </div>
          <textarea
            rows={3}
            value={doctorForm.residentialAddress}
            onChange={(e) => setDoctor({ residentialAddress: e.target.value })}
            disabled={sameAddress}
            className={`${textareaBase} ${sameAddress ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-[#0a0a0a]" : ""}`}
            placeholder="Home address, street, city, pincode"
          />
        </div>
      </div>
    </div>
  );

  const schedulingSection = (
    <div className="space-y-2">
      <SectionHeader icon={Calendar} title="Scheduling & Fees" subtitle="Consultation pricing and availability" />
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel required>Consultation Fee (₹)</FieldLabel>
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={doctorForm.consultationFee || ""}
              onChange={(e) => setDoctor({ consultationFee: parseFloat(e.target.value) || 0 })}
              className={inputBase}
              placeholder="500"
            />
          </div>
          <div>
            <FieldLabel required>Follow-up Fee (₹)</FieldLabel>
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={doctorForm.followUpFee || ""}
              onChange={(e) => setDoctor({ followUpFee: parseFloat(e.target.value) || 0 })}
              className={inputBase}
              placeholder="300"
            />
          </div>
        </div>
        <div>
          <FieldLabel required>Available Days</FieldLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {DAYS.map((day) => {
              const active = activeDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    active
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30"
                      : "bg-white text-slate-400 border-slate-200 dark:bg-[#1a1a1a] dark:text-[#555555] dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-[#3a3a3a]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel required>Slot Duration (min)</FieldLabel>
            <input
              required
              type="number"
              min="5"
              step="5"
              value={doctorForm.slotDurationMin || ""}
              onChange={(e) => setDoctor({ slotDurationMin: parseInt(e.target.value) || 0 })}
              className={inputBase}
              placeholder="15"
            />
          </div>
          <div>
            <FieldLabel required>Max Daily Slots</FieldLabel>
            <input
              required
              type="number"
              min="1"
              value={doctorForm.maxDailySlots || ""}
              onChange={(e) => setDoctor({ maxDailySlots: parseInt(e.target.value) || 0 })}
              className={inputBase}
              placeholder="40"
            />
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/15 p-4">
          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-3">
            Weekly Schedule Summary
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Slot", value: slotMin > 0 ? `${slotMin}m` : "—" },
              { label: "Per Day", value: slotsPerDay > 0 ? slotsPerDay : "—" },
              { label: "Hrs / Day", value: fmtDuration(totalMinPerDay) },
              { label: "Days / Wk", value: activeDays.length > 0 ? activeDays.length : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-white dark:bg-[#111111] border border-emerald-100/60 dark:border-emerald-500/10 p-2">
                <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-500/15 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Working Hours / Week</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtDuration(totalMinPerWeek)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const doctorAvatar = editDoctor && (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#0f0f0f] border border-slate-100 dark:border-[#1e1e1e]">
      <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800/30 flex items-center justify-center text-lg font-bold text-blue-700 dark:text-blue-400 shrink-0">
        {`${editDoctor.firstName?.[0] ?? ""}${editDoctor.lastName?.[0] ?? ""}`.toUpperCase()}
      </div>
      <div>
        <p className="font-bold text-slate-900 dark:text-white text-base leading-tight">
          Dr. {editDoctor.firstName} {editDoctor.lastName}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{editDoctor.email}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
            editDoctor.userIsActive
              ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30"
              : "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/30"
          }`}>
            {editDoctor.userIsActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
    </div>
  );

  const formContent = (
    <form id="doctorForm" onSubmit={handleSubmit} className="space-y-8">
      {editDoctor && doctorAvatar}

      {!editDoctor && (
        <div className="space-y-2">
          <SectionHeader icon={UserPlus} title="Account Setup" subtitle="Login credentials for the doctor" />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <FieldLabel required>First Name</FieldLabel>
              <input
                required
                type="text"
                value={userForm.firstName}
                onChange={(e) => setUserForm((p) => ({ ...p, firstName: e.target.value }))}
                className={inputBase}
                placeholder="Arjun"
              />
            </div>
            <div>
              <FieldLabel required>Last Name</FieldLabel>
              <input
                required
                type="text"
                value={userForm.lastName}
                onChange={(e) => setUserForm((p) => ({ ...p, lastName: e.target.value }))}
                className={inputBase}
                placeholder="Sharma"
              />
            </div>
            <div>
              <FieldLabel required>Login Email</FieldLabel>
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                className={inputBase}
                placeholder="doctor@hospital.com"
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input
                type="tel"
                value={userForm.phone}
                onChange={(e) => setUserForm((p) => ({ ...p, phone: e.target.value }))}
                className={inputBase}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="col-span-2">
              <FieldLabel required>Temporary Password</FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  required
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                  className={`${inputBase} pl-10`}
                  placeholder="Min. 6 characters"
                />
              </div>
            </div>
            <div className="col-span-2">
              <StateSelect
                value={userForm.state}
                onChange={(val) => setUserForm((p) => ({ ...p, state: val }))}
                inputClassName={inputBase}
                labelClassName="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
              />
            </div>
          </div>
        </div>
      )}

      {professionalSection}
      {contactSection}
      {addressSection}
      {schedulingSection}
    </form>
  );

  return (
    <SidePane
      isOpen={paneOpen}
      onClose={handleClose}
      title={editDoctor ? "Edit Doctor Profile" : "Add Doctor"}
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="doctorForm" disabled={submitting} className="btn-primary min-w-[110px]">
            {submitting ? "Saving…" : editDoctor ? "Save Changes" : "Create Profile"}
          </button>
        </div>
      }
    >
      {formContent}
    </SidePane>
  );
}

export { DoctorFormModal as default };
