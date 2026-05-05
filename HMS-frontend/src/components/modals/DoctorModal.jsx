import { useState } from "react";
import { X, Loader2 } from "lucide-react";
function DoctorModal({ doctor, onClose, onSave }) {
  const [form, setForm] = useState({
    about: doctor.about || "",
    specialization: doctor.specialization || "",
    department: doctor.department || "",
    experienceYears: doctor.experienceYears || 0,
    languages: doctor.languages || "",
    education: doctor.education || "",
    certifications: doctor.certifications || "",
    address: doctor.address || "",
    phone: doctor.phone || ""
  });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"><div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"><div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e]"><h2 className="text-lg font-bold text-slate-800 dark:text-white">Edit Professional Profile</h2><button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e1e1e] rounded-full transition-colors"><X className="w-5 h-5 text-slate-600" /></button></div><form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-5"><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">Specialization</label><input
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
    value={form.specialization}
    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
  /></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">Department</label><input
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
    value={form.department}
    onChange={(e) => setForm({ ...form, department: e.target.value })}
  /></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">Experience (Years)</label><input
    type="number"
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
    value={form.experienceYears}
    onChange={(e) => setForm({ ...form, experienceYears: parseInt(e.target.value) })}
  /></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">Languages (comma separated)</label><input
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
    value={form.languages}
    onChange={(e) => setForm({ ...form, languages: e.target.value })}
    placeholder="English, Spanish, etc."
  /></div></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">About / Bio</label><textarea
    rows={3}
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
    value={form.about}
    onChange={(e) => setForm({ ...form, about: e.target.value })}
    placeholder="Write a brief bio..."
  /></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">Education (Markdown or Text)</label><textarea
    rows={3}
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
    value={form.education}
    onChange={(e) => setForm({ ...form, education: e.target.value })}
    placeholder="MD - Harvard Medical School (2012)..."
  /></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">Certifications (Markdown or Text)</label><textarea
    rows={3}
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
    value={form.certifications}
    onChange={(e) => setForm({ ...form, certifications: e.target.value })}
    placeholder="Board Certification in Cardiology (2018)..."
  /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">Clinic Address</label><input
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
    value={form.address}
    onChange={(e) => setForm({ ...form, address: e.target.value })}
  /></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">Contact Phone</label><input
    className="w-full bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
    value={form.phone}
    onChange={(e) => setForm({ ...form, phone: e.target.value })}
  /></div></div><div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-[#1e1e1e]"><button type="button" onClick={onClose} className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors">
                            Cancel
                        </button><button type="submit" disabled={saving} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? "Saving..." : "Save Profile"}</button></div></form></div></div>;
}
export {
  DoctorModal as default
};
