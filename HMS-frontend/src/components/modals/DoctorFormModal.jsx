import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { doctorsApi, staffApi } from "@/utils/api";
import { X } from "lucide-react";
import StateSelect from "@/components/StateSelect";
import SidePane from "@/components/SidePane";

function DoctorFormModal({ onClose, onSaved, editDoctor }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [submitting, setSubmitting] = useState(false);
  const [paneOpen, setPaneOpen] = useState(true);
  const [userForm, setUserForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", state: "" });
  const [doctorForm, setDoctorForm] = useState({
    specialization: editDoctor?.specialization || "",
    qualification: editDoctor?.qualification || "",
    medicalRegistrationNumber: editDoctor?.medicalRegistrationNumber || "",
    registrationCouncil: editDoctor?.registrationCouncil || "",
    consultationFee: editDoctor?.consultationFee || 500,
    followUpFee: editDoctor?.followUpFee || 300,
    availableDays: editDoctor?.availableDays || "MON,TUE,WED,THU,FRI",
    slotDurationMin: editDoctor?.slotDurationMin || 15,
    maxDailySlots: editDoctor?.maxDailySlots || 40,
  });

  const handleClose = () => {
    if (editDoctor) {
      setPaneOpen(false);
      setTimeout(onClose, 290);
    } else {
      onClose();
    }
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
        const newUser = await staffApi.create({ ...userForm, role: "DOCTOR", hospitalId: user.hospitalId });
        await doctorsApi.create({ ...doctorForm, userId: newUser.id, hospitalId: user.hospitalId });
        notify("Doctor profile created", "success");
      }
      onSaved();
      if (editDoctor) {
        setPaneOpen(false);
        setTimeout(onClose, 290);
      }
    } catch (error) {
      notify(error.response?.data?.error || "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = "w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/50 focus:border-slate-900 dark:border-white transition-all";
  const labelClasses = "block text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider mb-2";

  const professionalFields = (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
          {editDoctor ? "Professional Details" : "Step 2: Professional Details"}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Specialization *</label>
            <input required type="text" value={doctorForm.specialization}
              onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
              className={inputClasses} placeholder="e.g., Cardiologist" />
          </div>
          <div>
            <label className={labelClasses}>Qualification *</label>
            <input required type="text" value={doctorForm.qualification}
              onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
              className={inputClasses} placeholder="e.g., MBBS, MD" />
          </div>
          <div>
            <label className={labelClasses}>Medical Registration Number *</label>
            <input required type="text" value={doctorForm.medicalRegistrationNumber}
              onChange={(e) => setDoctorForm({ ...doctorForm, medicalRegistrationNumber: e.target.value })}
              className={inputClasses} placeholder="Reg Num" />
          </div>
          <div>
            <label className={labelClasses}>Registration Council *</label>
            <input required type="text" value={doctorForm.registrationCouncil}
              onChange={(e) => setDoctorForm({ ...doctorForm, registrationCouncil: e.target.value })}
              className={inputClasses} placeholder="e.g., State Medical Council" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
          {editDoctor ? "Billing & Availability" : "Step 3: Billing & Availability"}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Consultation Fee (₹) *</label>
            <input required type="number" min="1" step="0.01" value={doctorForm.consultationFee || ""}
              onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: parseFloat(e.target.value) || 0 })}
              className={inputClasses} placeholder="500" />
          </div>
          <div>
            <label className={labelClasses}>Follow-up Fee (₹) *</label>
            <input required type="number" min="1" step="0.01" value={doctorForm.followUpFee || ""}
              onChange={(e) => setDoctorForm({ ...doctorForm, followUpFee: parseFloat(e.target.value) || 0 })}
              className={inputClasses} placeholder="300" />
          </div>
          <div className="col-span-2">
            <label className={labelClasses}>Available Days *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => {
                const selected = doctorForm.availableDays.split(",").map((d) => d.trim()).includes(day);
                const toggle = () => {
                  const current = doctorForm.availableDays.split(",").map((d) => d.trim()).filter(Boolean);
                  const next = selected ? current.filter((d) => d !== day) : [...current, day];
                  const ordered = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].filter((d) => next.includes(d));
                  setDoctorForm({ ...doctorForm, availableDays: ordered.join(",") });
                };
                return (
                  <button key={day} type="button" onClick={toggle}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selected ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30" : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-[#1a1a1a] dark:text-[#555555] dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-[#3a3a3a]"}`}>
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelClasses}>Slot Duration (Mins) *</label>
            <input required type="number" min="5" step="5" value={doctorForm.slotDurationMin || ""}
              onChange={(e) => setDoctorForm({ ...doctorForm, slotDurationMin: parseInt(e.target.value) || 0 })}
              className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Max Daily Slots *</label>
            <input required type="number" min="1" value={doctorForm.maxDailySlots || ""}
              onChange={(e) => setDoctorForm({ ...doctorForm, maxDailySlots: parseInt(e.target.value) || 0 })}
              className={inputClasses} />
          </div>
        </div>
      </div>
    </>
  );

  if (editDoctor) {
    return (
      <SidePane
        isOpen={paneOpen}
        onClose={handleClose}
        title="Edit Doctor Profile"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
            <button type="submit" form="doctorForm" disabled={submitting} className="btn-primary">
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        }
      >
        <form id="doctorForm" onSubmit={handleSubmit} className="space-y-8">
          {professionalFields}
        </form>
      </SidePane>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#000000]/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111111] rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#2a2a2a]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1e1e1e]">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Doctor Profile</h2>
          <button onClick={onClose} className="p-2 text-slate-600 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
              Step 1: User Account Setup
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-[#151515] p-5 rounded-lg border border-slate-100 dark:border-[#222222]">
              <div>
                <label className={labelClasses}>First Name *</label>
                <input required type="text" value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} className={inputClasses} placeholder="John" />
              </div>
              <div>
                <label className={labelClasses}>Last Name *</label>
                <input required type="text" value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} className={inputClasses} placeholder="Doe" />
              </div>
              <div>
                <label className={labelClasses}>Email Address *</label>
                <input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className={inputClasses} placeholder="doctor@hospital.com" />
              </div>
              <div>
                <label className={labelClasses}>Phone Number</label>
                <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} className={inputClasses} placeholder="+1 234 567 8900" />
              </div>
              <div className="col-span-2">
                <label className={labelClasses}>Temporary Password *</label>
                <input required type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className={inputClasses} placeholder="Minimum 6 characters" />
              </div>
              <div className="col-span-2">
                <StateSelect value={userForm.state} onChange={(val) => setUserForm({ ...userForm, state: val })} inputClassName={inputClasses} labelClassName={labelClasses} />
              </div>
            </div>
          </div>
          <form id="doctorForm" onSubmit={handleSubmit} className="space-y-8">
            {professionalFields}
          </form>
        </div>
        <div className="p-6 border-t border-slate-100 dark:border-[#1e1e1e] flex justify-end gap-3 bg-slate-50 dark:bg-[#0a0a0a]">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="doctorForm" disabled={submitting} className="btn-primary">
            {submitting ? "Saving..." : "Create Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { DoctorFormModal as default };
