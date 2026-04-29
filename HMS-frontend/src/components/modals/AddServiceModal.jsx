import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { hospitalServiceApi } from "@/utils/api";
import SidePane from "@/components/SidePane";

function AddServiceModal({ isOpen, onClose, service, specializations, onSuccess }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", specializationId: "", price: "" });

  useEffect(() => {
    if (service) {
      setFormData({ name: service.name, specializationId: service.specializationId, price: service.price.toString() });
    } else {
      setFormData({ name: "", specializationId: "", price: "" });
    }
  }, [service, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData, hospitalId: user.hospitalId, price: parseFloat(formData.price), isActive: service ? service.isActive : true };
    setLoading(true);
    try {
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

  const inputCls = "w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder-slate-400 dark:placeholder-[#444444] text-slate-700 dark:text-[#cccccc]";
  const labelCls = "text-sm font-semibold text-slate-700 dark:text-[#aaaaaa] ml-1";

  const formFields = (
    <form id="serviceForm" onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className={labelCls}>Service Name <span className="text-rose-500">*</span></label>
        <input type="text" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. General Consultation" className={inputCls} required />
      </div>
      <div className="space-y-1.5">
        <label className={labelCls}>Department <span className="text-rose-500">*</span></label>
        <select value={formData.specializationId} onChange={(e) => setFormData((p) => ({ ...p, specializationId: e.target.value }))}
          className={inputCls + " appearance-none cursor-pointer"} required>
          <option value="">Select Department</option>
          {specializations.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className={labelCls}>Price (₹) <span className="text-rose-500">*</span></label>
        <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
          placeholder="0.00" className={inputCls} required />
      </div>
    </form>
  );

  const actionButtons = (isAdd) => (
    <div className="flex gap-3">
      <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
      <button type="submit" form="serviceForm" disabled={loading} className="btn-primary flex-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isAdd ? "Add New Service" : "Update Service"}
      </button>
    </div>
  );

  if (service) {
    return (
      <SidePane isOpen={isOpen} onClose={onClose} title="Edit Service" footer={actionButtons(false)}>
        {formFields}
      </SidePane>
    );
  }

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1a1a1a]">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">New Service</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e1e1e] rounded-lg text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {formFields}
          <div className="pt-2">{actionButtons(true)}</div>
        </div>
      </div>
    </div>
  );
}

export { AddServiceModal as default };
