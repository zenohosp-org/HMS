import { useState } from "react";
import { useNotification } from "@/context/NotificationContext";
import { recordApi, casualtyApi, birthApi } from "@/utils/api";
import { X, FileText, AlertTriangle, Baby } from "lucide-react";

const BASE_TYPES = ["CONSULTATION", "PRESCRIPTION", "LAB_RESULT", "SURGERY", "DIAGNOSIS", "OTHER"];
const ALL_TYPES = [...BASE_TYPES, "CASUALTY", "BIRTH"];

const TRIAGE_OPTIONS = ["RED", "YELLOW", "GREEN"];
const BROUGHT_BY_OPTIONS = ["SELF", "FAMILY", "POLICE", "AMBULANCE", "PASSERBY"];
const ARRIVAL_OPTIONS = ["WALKING", "STRETCHER", "AMBULANCE"];
const CONSCIOUS_OPTIONS = ["CONSCIOUS", "SEMI_CONSCIOUS", "UNCONSCIOUS"];
const MECHANISM_OPTIONS = [
  "ROAD_ACCIDENT", "FALL", "ASSAULT", "POISONING", "BURNS", "SNAKE_BITE", "CARDIAC", "OTHER"
];
const DELIVERY_OPTIONS = ["NORMAL", "LSCS", "FORCEPS", "VACUUM"];
const BABY_GENDER_OPTIONS = ["MALE", "FEMALE", "UNKNOWN"];

const EMPTY_CASUALTY = {
  triageCategory: "YELLOW",
  broughtBy: "FAMILY",
  modeOfArrival: "WALKING",
  isMlc: false,
  mlcNumber: "",
  policeStation: "",
  officerName: "",
  consciousState: "CONSCIOUS",
  mechanism: "OTHER",
  vitalsBp: "",
  vitalsPulse: "",
  vitalsSpO2: "",
  vitalsGcs: "",
  referredFrom: "",
  arrivalTime: "",
};

const EMPTY_BIRTH = {
  fatherName: "",
  fatherPhone: "",
  deliveryType: "NORMAL",
  birthDatetime: "",
  babyGender: "UNKNOWN",
  babyWeightKg: "",
  apgar1Min: "",
  apgar5Min: "",
  obstetrician: "",
  pediatrician: "",
  complications: "",
};

export default function AddRecordForm({
  patientId,
  hospitalId,
  admissionId,
  admissionNumber,
  onSaved,
  onCancel,
}) {
  const { notify } = useNotification();
  const [historyType, setHistoryType] = useState("CONSULTATION");
  const [description, setDescription] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [casualty, setCasualty] = useState(EMPTY_CASUALTY);
  const [birth, setBirth] = useState(EMPTY_BIRTH);
  const [saving, setSaving] = useState(false);

  const setC = (field, val) => setCasualty(p => ({ ...p, [field]: val }));
  const setB = (field, val) => setBirth(p => ({ ...p, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (historyType === "CASUALTY" && !casualty.triageCategory) {
      notify("Select a triage category", "error");
      return;
    }
    if (historyType === "BIRTH" && !birth.birthDatetime) {
      notify("Birth date & time is required", "error");
      return;
    }
    setSaving(true);
    try {
      if (historyType === "CASUALTY") {
        await casualtyApi.save(patientId, hospitalId, {
          ...casualty,
          arrivalTime: casualty.arrivalTime || null,
          admissionId: admissionId || null,
          admissionNumber: admissionNumber || null,
        });
      } else if (historyType === "BIRTH") {
        await birthApi.create(patientId, hospitalId, {
          ...birth,
          babyWeightKg: birth.babyWeightKg ? parseFloat(birth.babyWeightKg) : null,
          apgar1Min: birth.apgar1Min ? parseInt(birth.apgar1Min) : null,
          apgar5Min: birth.apgar5Min ? parseInt(birth.apgar5Min) : null,
          admissionId: admissionId || null,
          admissionNumber: admissionNumber || null,
        });
      } else {
        await recordApi.create({
          patientId,
          hospitalId,
          historyType,
          description: description || undefined,
          nextVisitDate: nextVisitDate || undefined,
          admissionId: admissionId || undefined,
          admissionNumber: admissionNumber || undefined,
        });
      }
      notify(
        historyType === "BIRTH" ? "Birth recorded — baby patient registered" : "Record added",
        "success"
      );
      onSaved();
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to save record", "error");
    } finally {
      setSaving(false);
    }
  };

  const labelCls = "label text-[11px]";
  const inputCls = "input text-sm";

  return (
    <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-[#cccccc]">Add New Record</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-[#aaaaaa] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type + Next Visit (base fields, always shown) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Record Type *</label>
            <select className={inputCls} value={historyType} onChange={e => setHistoryType(e.target.value)}>
              {BASE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              <option disabled>──────────</option>
              <option value="CASUALTY">CASUALTY</option>
              <option value="BIRTH">BIRTH</option>
            </select>
          </div>
          {historyType !== "CASUALTY" && historyType !== "BIRTH" && (
            <div>
              <label className={labelCls}>Next Visit Date</label>
              <input type="datetime-local" className={inputCls} value={nextVisitDate}
                onChange={e => setNextVisitDate(e.target.value)} />
            </div>
          )}
        </div>

        {/* Notes — only for base types */}
        {historyType !== "CASUALTY" && historyType !== "BIRTH" && (
          <div>
            <label className={labelCls}>Notes / Description</label>
            <textarea rows={3} className="input text-sm resize-none"
              placeholder="Enter description or notes..."
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        )}

        {/* ── CASUALTY extended fields ── */}
        {historyType === "CASUALTY" && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-[#2a2a2a]">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <p className="text-xs font-bold text-slate-700 dark:text-[#ccc] uppercase tracking-wider">Casualty Details</p>
            </div>

            {/* Triage + Mechanism */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Triage *</label>
                <select className={inputCls} value={casualty.triageCategory} onChange={e => setC("triageCategory", e.target.value)}>
                  {TRIAGE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Mechanism</label>
                <select className={inputCls} value={casualty.mechanism} onChange={e => setC("mechanism", e.target.value)}>
                  {MECHANISM_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Conscious State</label>
                <select className={inputCls} value={casualty.consciousState} onChange={e => setC("consciousState", e.target.value)}>
                  {CONSCIOUS_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>

            {/* Brought by + Mode + Referred from */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Brought By</label>
                <select className={inputCls} value={casualty.broughtBy} onChange={e => setC("broughtBy", e.target.value)}>
                  {BROUGHT_BY_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Mode of Arrival</label>
                <select className={inputCls} value={casualty.modeOfArrival} onChange={e => setC("modeOfArrival", e.target.value)}>
                  {ARRIVAL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Referred From</label>
                <input className={inputCls} value={casualty.referredFrom} onChange={e => setC("referredFrom", e.target.value)} placeholder="Transfer hospital" />
              </div>
            </div>

            {/* Vitals */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>BP</label>
                <input className={inputCls} value={casualty.vitalsBp} onChange={e => setC("vitalsBp", e.target.value)} placeholder="120/80" />
              </div>
              <div>
                <label className={labelCls}>Pulse</label>
                <input className={inputCls} value={casualty.vitalsPulse} onChange={e => setC("vitalsPulse", e.target.value)} placeholder="88" />
              </div>
              <div>
                <label className={labelCls}>SpO2 %</label>
                <input className={inputCls} value={casualty.vitalsSpO2} onChange={e => setC("vitalsSpO2", e.target.value)} placeholder="98" />
              </div>
              <div>
                <label className={labelCls}>GCS</label>
                <input className={inputCls} value={casualty.vitalsGcs} onChange={e => setC("vitalsGcs", e.target.value)} placeholder="15" />
              </div>
            </div>

            {/* MLC toggle */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={casualty.isMlc}
                  onChange={e => setC("isMlc", e.target.checked)}
                  className="w-4 h-4 rounded accent-rose-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-[#ccc]">Medico-Legal Case (MLC)</span>
              </label>
            </div>
            {casualty.isMlc && (
              <div className="grid grid-cols-3 gap-3 pl-6 border-l-2 border-rose-200 dark:border-rose-500/30">
                <div>
                  <label className={labelCls}>MLC Number</label>
                  <input className={inputCls} value={casualty.mlcNumber} onChange={e => setC("mlcNumber", e.target.value)} placeholder="MLC/2026/0001" />
                </div>
                <div>
                  <label className={labelCls}>Police Station</label>
                  <input className={inputCls} value={casualty.policeStation} onChange={e => setC("policeStation", e.target.value)} placeholder="Station name" />
                </div>
                <div>
                  <label className={labelCls}>Officer Name</label>
                  <input className={inputCls} value={casualty.officerName} onChange={e => setC("officerName", e.target.value)} placeholder="SI / ASI name" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BIRTH extended fields ── */}
        {historyType === "BIRTH" && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-[#2a2a2a]">
              <Baby className="w-3.5 h-3.5 text-pink-500" />
              <p className="text-xs font-bold text-slate-700 dark:text-[#ccc] uppercase tracking-wider">Birth Details</p>
              <span className="text-[10px] text-slate-400 dark:text-[#666] normal-case font-normal">Baby patient will be auto-registered</span>
            </div>

            {/* Birth datetime + Delivery type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date & Time of Birth *</label>
                <input type="datetime-local" className={inputCls} value={birth.birthDatetime}
                  onChange={e => setB("birthDatetime", e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Delivery Type</label>
                <select className={inputCls} value={birth.deliveryType} onChange={e => setB("deliveryType", e.target.value)}>
                  {DELIVERY_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Baby details */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Baby Gender</label>
                <select className={inputCls} value={birth.babyGender} onChange={e => setB("babyGender", e.target.value)}>
                  {BABY_GENDER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Weight (kg)</label>
                <input type="number" step="0.001" min="0" max="10" className={inputCls}
                  value={birth.babyWeightKg} onChange={e => setB("babyWeightKg", e.target.value)} placeholder="3.200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>APGAR 1 min</label>
                  <input type="number" min="0" max="10" className={inputCls}
                    value={birth.apgar1Min} onChange={e => setB("apgar1Min", e.target.value)} placeholder="8" />
                </div>
                <div>
                  <label className={labelCls}>APGAR 5 min</label>
                  <input type="number" min="0" max="10" className={inputCls}
                    value={birth.apgar5Min} onChange={e => setB("apgar5Min", e.target.value)} placeholder="9" />
                </div>
              </div>
            </div>

            {/* Father details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Father's Name</label>
                <input className={inputCls} value={birth.fatherName} onChange={e => setB("fatherName", e.target.value)} placeholder="Father's full name" />
              </div>
              <div>
                <label className={labelCls}>Father's Phone</label>
                <input className={inputCls} value={birth.fatherPhone} onChange={e => setB("fatherPhone", e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>

            {/* Doctors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Obstetrician</label>
                <input className={inputCls} value={birth.obstetrician} onChange={e => setB("obstetrician", e.target.value)} placeholder="Dr. name" />
              </div>
              <div>
                <label className={labelCls}>Paediatrician</label>
                <input className={inputCls} value={birth.pediatrician} onChange={e => setB("pediatrician", e.target.value)} placeholder="Dr. name" />
              </div>
            </div>

            {/* Complications */}
            <div>
              <label className={labelCls}>Complications (if any)</label>
              <textarea rows={2} className="input text-sm resize-none"
                placeholder="None / describe if any..."
                value={birth.complications} onChange={e => setB("complications", e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn-secondary text-xs" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary text-xs" disabled={saving}>
            {saving
              ? historyType === "BIRTH" ? "Registering baby…" : "Saving…"
              : historyType === "BIRTH" ? "Record Birth & Register Baby"
              : historyType === "CASUALTY" ? "Save Casualty Record"
              : "Save Record"}
          </button>
        </div>
      </form>
    </div>
  );
}
