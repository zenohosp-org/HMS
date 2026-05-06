import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { checkupApi } from "@/utils/api";
import {
  Package, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, GripVertical, X, Check, AlertCircle,
} from "lucide-react";

const CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "CARDIAC", label: "Cardiac" },
  { value: "DIABETIC", label: "Diabetic" },
  { value: "CANCER_SCREENING", label: "Cancer Screening" },
  { value: "WOMENS_HEALTH", label: "Women's Health" },
  { value: "SENIOR", label: "Senior" },
  { value: "PAEDIATRIC", label: "Paediatric" },
  { value: "COMPREHENSIVE", label: "Comprehensive" },
  { value: "CUSTOM", label: "Custom" },
];

const TEST_CATEGORIES = ["BLOOD_TEST", "RADIOLOGY", "CONSULTATION", "PHYSICAL", "VISION", "DENTAL", "GENERAL"];

const CATEGORY_COLORS = {
  GENERAL: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400",
  CARDIAC: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  DIABETIC: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  CANCER_SCREENING: "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  WOMENS_HEALTH: "bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",
  SENIOR: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  PAEDIATRIC: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  COMPREHENSIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  CUSTOM: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

const EMPTY_TEST = { testName: "", testCategory: "GENERAL", normalRange: "", mandatory: true };

const EMPTY_FORM = {
  name: "", description: "", category: "GENERAL", targetGender: "ANY",
  price: "", validityDays: 1, active: true, tests: [],
};

function PackageFormModal({ initial, hospitalId, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addTest = () => setForm(f => ({ ...f, tests: [...f.tests, { ...EMPTY_TEST }] }));

  const updateTest = (i, k, v) => setForm(f => {
    const tests = [...f.tests];
    tests[i] = { ...tests[i], [k]: v };
    return { ...f, tests };
  });

  const removeTest = (i) => setForm(f => ({ ...f, tests: f.tests.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) { setError("Name and price are required."); return; }
    if (form.tests.length === 0) { setError("Add at least one test to the package."); return; }
    setSaving(true); setError(null);
    try {
      await checkupApi.savePackage(hospitalId, { ...form, price: parseFloat(form.price) });
      onSaved();
      onClose();
    } catch { setError("Failed to save package. Please try again."); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#1a1a1a] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 placeholder:text-slate-400";
  const labelCls = "block text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e]">
          <h2 className="font-bold text-slate-900 dark:text-white">{form.id ? "Edit Package" : "New Health Package"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>Package Name</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Executive Health Package" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Target Gender</label>
              <select value={form.targetGender} onChange={e => set("targetGender", e.target.value)} className={inputCls}>
                <option value="ANY">Any / Unisex</option>
                <option value="MALE">Male Only</option>
                <option value="FEMALE">Female Only</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Price (₹)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => set("price", e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Validity (Days)</label>
              <input type="number" min="1" value={form.validityDays} onChange={e => set("validityDays", parseInt(e.target.value))} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Description</label>
              <textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Brief description of what this package covers…" className={`${inputCls} resize-none`} />
            </div>
          </div>

          {/* Tests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={labelCls}>Tests Included ({form.tests.length})</label>
              <button type="button" onClick={addTest} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-200 dark:border-emerald-500/20">
                <Plus className="w-3 h-3" /> Add Test
              </button>
            </div>

            {form.tests.length === 0 ? (
              <div className="py-8 flex flex-col items-center rounded-lg border border-dashed border-slate-200 dark:border-[#333] text-slate-400">
                <Package className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-xs">No tests added yet. Click "Add Test" to begin.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {form.tests.map((t, i) => (
                  <div key={i} className="flex gap-2 p-3 rounded-lg border border-slate-100 dark:border-[#222] bg-slate-50 dark:bg-[#1a1a1a]">
                    <GripVertical className="w-4 h-4 text-slate-500 dark:text-[#888888] mt-2.5 shrink-0" />
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="col-span-2 md:col-span-2">
                        <input value={t.testName} onChange={e => updateTest(i, "testName", e.target.value)} placeholder="Test name (e.g. Complete Blood Count)" className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300/50 dark:focus:ring-[#444444]/50 focus:border-slate-400 dark:focus:border-[#444444] placeholder:text-slate-400" />
                      </div>
                      <div>
                        <select value={t.testCategory} onChange={e => updateTest(i, "testCategory", e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300/50">
                          {TEST_CATEGORIES.map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                        </select>
                      </div>
                      <div>
                        <input value={t.normalRange} onChange={e => updateTest(i, "normalRange", e.target.value)} placeholder="Normal range" className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#111] text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300/50 placeholder:text-slate-400" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-[#666] cursor-pointer">
                        <input type="checkbox" checked={t.mandatory} onChange={e => updateTest(i, "mandatory", e.target.checked)} className="rounded" />
                        Req.
                      </label>
                      <button type="button" onClick={() => removeTest(i)} className="p-1 rounded text-slate-300 hover:text-rose-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#1e1e1e]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)} className="rounded" />
              <span className="text-sm font-medium text-slate-600 dark:text-[#888]">Active (visible for booking)</span>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-[#333] text-sm font-medium text-slate-600 dark:text-[#888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Save Package"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PackageCard({ pkg, onEdit, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const label = CATEGORIES.find(c => c.value === pkg.category)?.label || pkg.category;

  return (
    <div className={`bg-white dark:bg-[#111] border rounded-lg overflow-hidden transition-all ${pkg.active ? "border-slate-200 dark:border-[#222]" : "border-slate-100 dark:border-[#1a1a1a] opacity-60"}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">{pkg.name}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[pkg.category] || CATEGORY_COLORS.CUSTOM}`}>{label}</span>
              {pkg.targetGender !== "ANY" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400">{pkg.targetGender}</span>
              )}
              {!pkg.active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#222] text-slate-400">Inactive</span>}
            </div>
            {pkg.description && <p className="text-xs text-slate-500 dark:text-[#666] line-clamp-2 mt-1">{pkg.description}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹{Number(pkg.price).toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{pkg.validityDays === 1 ? "Single visit" : `${pkg.validityDays} days`}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#666] hover:text-slate-700 dark:hover:text-[#aaa] transition-colors font-medium">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {pkg.tests?.length || 0} tests
          </button>
          <div className="flex items-center gap-1">
            <button onClick={onToggle} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors" title={pkg.active ? "Deactivate" : "Activate"}>
              {pkg.active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {expanded && pkg.tests?.length > 0 && (
        <div className="border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0d0d0d] px-5 py-4">
          <div className="space-y-1.5">
            {pkg.tests.map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0 text-[10px]">{i + 1}</span>
                <span className="font-medium text-slate-700 dark:text-[#ccc] flex-1">{t.testName}</span>
                <span className="text-slate-600 dark:text-[#999999] text-[10px]">{t.testCategory?.replace("_", " ")}</span>
                {t.normalRange && <span className="text-slate-600 dark:text-[#999999] text-[10px]">({t.normalRange})</span>}
                {t.mandatory && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PackageManager() {
  const { user } = useAuth();
  const hospitalId = user?.hospitalId;

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState("ALL");

  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  const load = async () => {
    setLoading(true);
    try { setPackages(await checkupApi.getPackages(hospitalId)); }
    finally { setLoading(false); }
  };

  const handleEdit = (pkg) => {
    setEditing({
      ...pkg,
      price: String(pkg.price),
      tests: (pkg.tests || []).map(t => ({ ...t })),
    });
    setShowForm(true);
  };

  const handleToggle = async (id) => {
    await checkupApi.togglePackage(id);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this package? Existing bookings will not be affected.")) return;
    await checkupApi.deletePackage(id);
    load();
  };

  const filtered = filterCat === "ALL" ? packages : packages.filter(p => p.category === filterCat);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Health Packages</h1>
          <p className="text-sm text-slate-500 dark:text-[#666] mt-0.5">Define checkup packages your hospital offers</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white text-sm font-bold transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" /> New Package
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat("ALL")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterCat === "ALL" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-white dark:bg-[#111] border border-slate-200 dark:border-[#333] text-slate-500 dark:text-[#888] hover:bg-slate-50"}`}>
          All ({packages.length})
        </button>
        {CATEGORIES.filter(c => packages.some(p => p.category === c.value)).map(c => (
          <button key={c.value} onClick={() => setFilterCat(c.value)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterCat === c.value ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-white dark:bg-[#111] border border-slate-200 dark:border-[#333] text-slate-500 dark:text-[#888] hover:bg-slate-50"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg text-slate-400">
          <Package className="w-12 h-12 mb-3 opacity-25" />
          <p className="font-semibold text-sm">No packages yet</p>
          <p className="text-xs mt-1">Create your first health checkup package to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(pkg => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={() => handleEdit(pkg)}
              onToggle={() => handleToggle(pkg.id)}
              onDelete={() => handleDelete(pkg.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <PackageFormModal
          initial={editing}
          hospitalId={hospitalId}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
