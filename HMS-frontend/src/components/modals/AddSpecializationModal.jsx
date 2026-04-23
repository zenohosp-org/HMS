import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { specializationApi } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
function AddSpecializationModal({ isOpen, onClose, onSuccess, initialData }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true
  });
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description || "",
        isActive: initialData.isActive
      });
    } else {
      setFormData({ name: "", description: "", isActive: true });
    }
  }, [initialData, isOpen]);
  if (!isOpen) return null;
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      if (initialData) {
        await specializationApi.update(initialData.id, {
          ...formData,
          hospitalId: user.hospitalId
        });
        notify("Specialization updated successfully", "success");
      } else {
        await specializationApi.create({
          ...formData,
          hospitalId: user.hospitalId
        });
        notify("Specialization added successfully", "success");
      }
      onSuccess();
      onClose();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to save specialization", "error");
    } finally {
      setLoading(false);
    }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white dark:bg-[#111111] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#222222] animate-in zoom-in-95 duration-200"><div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1a1a1a]"><h2 className="text-xl font-bold text-slate-800 dark:text-white">{initialData ? "Edit Specialization" : "Add New Specialization"}</h2><button
    onClick={onClose}
    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
  ><X className="w-5 h-5" /></button></div><form onSubmit={handleSubmit} className="p-6 space-y-5"><div className="space-y-2"><label className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">
                            Specialization <span className="text-rose-500">*</span></label><input
    required
    type="text"
    value={formData.name}
    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    placeholder="e.g. Cardiology"
    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
  /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">
                            Description
                        </label><textarea
    rows={4}
    value={formData.description}
    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
    placeholder="Enter detail description..."
    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
  /></div><div className="flex items-center gap-3 py-2"><input
    type="checkbox"
    id="isActive"
    checked={formData.isActive}
    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
  /><label htmlFor="isActive" className="text-sm font-medium text-slate-700 dark:text-[#aaaaaa] cursor-pointer">
                            Active status
                        </label></div><div className="flex items-center gap-3 pt-2"><button
    type="button"
    onClick={onClose}
    className="btn-secondary flex-1"
  >
                            Cancel
                        </button><button
    type="submit"
    disabled={loading}
    className="btn-primary flex-1"
  >{loading ? <><Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </> : initialData ? "Update Specialization" : "Add Specialization"}</button></div></form></div></div>;
}
export {
  AddSpecializationModal as default
};
