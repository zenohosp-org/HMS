import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { hospitalServiceApi } from "@/utils/api";
function AddServiceModal({ isOpen, onClose, service, specializations, onSuccess }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    specializationId: "",
    price: ""
  });
  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        specializationId: service.specializationId,
        price: service.price.toString()
      });
    } else {
      setFormData({
        name: "",
        specializationId: "",
        price: ""
      });
    }
  }, [service, isOpen]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.hospitalId) return;
    if (!formData.name || !formData.specializationId || !formData.price) {
      notify("Please fill all required fields", "error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        hospitalId: user.hospitalId,
        price: parseFloat(formData.price),
        isActive: service ? service.isActive : true
      };
      if (service) {
        await hospitalServiceApi.update(service.id, payload);
        notify("Service updated successfully", "success");
      } else {
        await hospitalServiceApi.create(payload);
        notify("Service created successfully", "success");
      }
      onSuccess();
      onClose();
    } catch (err) {
      notify(service ? "Failed to update service" : "Failed to create service", "error");
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} /><div className="relative w-full max-w-md bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"><div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1a1a1a]"><h2 className="text-xl font-bold text-slate-800 dark:text-white">{service ? "Edit Service" : "New Service"}</h2><button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e1e1e] rounded-xl text-slate-400 transition-colors"><X className="w-5 h-5" /></button></div><form onSubmit={handleSubmit} className="p-6 space-y-5"><div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-[#aaaaaa] ml-1">
                            Service Name <span className="text-rose-500">*</span></label><input
    type="text"
    value={formData.name}
    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
    placeholder="e.g. General Consultation"
    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder-slate-400 dark:placeholder-[#444444] text-slate-700 dark:text-[#cccccc]"
    required
  /></div><div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-[#aaaaaa] ml-1">
                            Department <span className="text-rose-500">*</span></label><select
    value={formData.specializationId}
    onChange={(e) => setFormData((prev) => ({ ...prev, specializationId: e.target.value }))}
    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-slate-700 dark:text-[#cccccc] appearance-none cursor-pointer"
    required
  ><option value="">Select Department</option>{specializations.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-[#aaaaaa] ml-1">
                            Price ($) <span className="text-rose-500">*</span></label><input
    type="number"
    step="0.01"
    value={formData.price}
    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
    placeholder="0.00"
    className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder-slate-400 dark:placeholder-[#444444] text-slate-700 dark:text-[#cccccc]"
    required
  /></div><div className="flex gap-3 pt-2"><button
    type="button"
    onClick={onClose}
    className="btn-secondary flex-1"
  >
                            Cancel
                        </button><button
    type="submit"
    disabled={loading}
    className="btn-primary flex-1"
  >{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : service ? "Update Service" : "Add New Service"}</button></div></form></div></div>;
}
export {
  AddServiceModal as default
};
