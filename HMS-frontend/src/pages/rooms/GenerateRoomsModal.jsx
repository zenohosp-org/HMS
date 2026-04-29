import { useState } from "react";
import api from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { X, Loader2 } from "lucide-react";
function GenerateRoomsModal({ onClose, onSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    roomPrefix: "GEN",
    roomType: "GENERAL",
    count: 5,
    pricePerDay: 0
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post("/rooms/generate", {
        ...formData,
        hospitalId: user?.hospitalId
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to generate rooms", error);
      alert(error.response?.data?.message || "Failed to generate rooms");
    } finally {
      setLoading(false);
    }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#2a2a2a]"><div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#222222]"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Generate Rooms</h2><button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#aaaaaa] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"><X className="w-5 h-5" /></button></div><form onSubmit={handleSubmit} className="p-5 space-y-4"><div><label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-1.5">Room Prefix</label><input
    type="text"
    required
    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] 
                                bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc] placeholder:text-slate-400 dark:placeholder:text-[#555555]
                                focus:outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/50"
    placeholder="e.g. GEN, ICU, WARD"
    value={formData.roomPrefix}
    onChange={(e) => setFormData({ ...formData, roomPrefix: e.target.value.toUpperCase() })}
  /><p className="text-xs text-slate-500 mt-1.5">Rooms will be generated as {formData.roomPrefix}-01, {formData.roomPrefix}-02, etc.</p></div><div><label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-1.5">Room Type</label><select
    required
    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a] 
                                bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc]
                                focus:outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/50"
    value={formData.roomType}
    onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
  ><option value="GENERAL">General</option><option value="ICU">ICU</option><option value="PRIVATE">Private</option><option value="WARD">Ward</option></select></div><div><label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-1.5">Price Per Day (₹)</label><input
    type="number"
    required
    min="0"
    step="0.01"
    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a]
                                bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc]
                                focus:outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/50"
    value={formData.pricePerDay || ""}
    onChange={(e) => setFormData({ ...formData, pricePerDay: parseFloat(e.target.value) || 0 })}
  /><p className="text-xs text-slate-500 mt-1.5">This price will be used when adding room charges to a bill.</p></div><div><label className="block text-sm font-semibold text-slate-700 dark:text-[#cccccc] mb-1.5">Number of Rooms to Generate</label><input
    type="number"
    required
    min="1"
    max="50"
    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2a2a2a]
                                bg-white dark:bg-[#111111] text-slate-900 dark:text-[#cccccc]
                                focus:outline-none focus:ring-2 focus:ring-slate-900 dark:ring-white/50"
    value={formData.count || ""}
    onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 0 })}
  /></div><div className="pt-4 flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">
                            Cancel
                        </button><button type="submit" disabled={loading} className="btn-primary">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}</button></div></form></div></div>;
}
export {
  GenerateRoomsModal as default
};
