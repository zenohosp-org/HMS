import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { patientServicesApi } from "@/utils/api";
import SidePane from "@/components/SidePane";

const EMPTY_FORM = {
  name: "",
  type: "FOOD",
  mealTime: "BREAKFAST",
  pricePerMeal: "",
  pricePerDay: "",
  isActive: true,
};

function PatientServiceFormModal({ isOpen, onClose, service, hospitalId, onSuccess }) {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name,
        type: service.type,
        mealTime: service.mealTime || "BREAKFAST",
        pricePerMeal: service.pricePerMeal ?? "",
        pricePerDay: service.pricePerDay ?? "",
        isActive: service.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [service, isOpen]);

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      hospitalId,
      name: form.name.trim(),
      type: form.type,
      mealTime: form.type === "FOOD" ? form.mealTime : null,
      pricePerMeal: form.type === "FOOD" ? parseFloat(form.pricePerMeal) || 0 : null,
      pricePerDay: form.type !== "FOOD" ? parseFloat(form.pricePerDay) || 0 : null,
      isActive: form.isActive,
    };
    setLoading(true);
    try {
      if (service) {
        await patientServicesApi.update(service.id, payload);
        notify("Service updated", "success");
      } else {
        await patientServicesApi.create(payload);
        notify("Service added", "success");
      }
      onSuccess();
      onClose();
    } catch {
      notify(service ? "Failed to update service" : "Failed to add service", "error");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder-slate-400 dark:placeholder-[#444444] text-slate-700 dark:text-[#cccccc] text-sm";
  const labelCls = "text-sm font-semibold text-slate-700 dark:text-[#aaaaaa]";

  const formBody = (
    <form id="psForm" onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className={labelCls}>Service Name <span className="text-rose-500">*</span></label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Breakfast Meal"
          className={inputCls}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Service Type <span className="text-rose-500">*</span></label>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          className={inputCls + " cursor-pointer"}
        >
          <option value="FOOD">Food</option>
          <option value="ROOM_SERVICE">Room Service</option>
          <option value="CONVENIENCE">Convenience</option>
          <option value="CUSTOM">Custom</option>
        </select>
      </div>

      {form.type === "FOOD" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Meal Time <span className="text-rose-500">*</span></label>
            <select
              value={form.mealTime}
              onChange={(e) => set("mealTime", e.target.value)}
              className={inputCls + " cursor-pointer"}
            >
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Price per Meal (₹) <span className="text-rose-500">*</span></label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.pricePerMeal}
              onChange={(e) => set("pricePerMeal", e.target.value)}
              placeholder="0"
              className={inputCls}
              required
            />
          </div>
        </div>
      )}

      {form.type !== "FOOD" && (
        <div className="space-y-1.5">
          <label className={labelCls}>Price per Day (₹) <span className="text-rose-500">*</span></label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.pricePerDay}
            onChange={(e) => set("pricePerDay", e.target.value)}
            placeholder="0"
            className={inputCls}
            required
          />
        </div>
      )}

      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] rounded-lg">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">Active</p>
          <p className="text-xs text-slate-500 dark:text-[#666666] mt-0.5">Add to patient invoices automatically</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-300 dark:bg-[#333333] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-600" />
        </label>
      </div>
    </form>
  );

  const footer = (
    <div className="flex gap-3">
      <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
      <button type="submit" form="psForm" disabled={loading} className="btn-primary flex-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : service ? "Save Changes" : "Add Service"}
      </button>
    </div>
  );

  if (service) {
    return (
      <SidePane isOpen={isOpen} onClose={onClose} title="Edit Service" footer={footer}>
        {formBody}
      </SidePane>
    );
  }

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1a1a1a]">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">New Patient Service</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e1e1e] rounded-lg text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-2">
          {formBody}
          <div className="pt-3">{footer}</div>
        </div>
      </div>
    </div>
  );
}

export default PatientServiceFormModal;
