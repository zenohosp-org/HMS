import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { vitalsApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import {
  Activity, HeartPulse, Wind, Scale, Droplet, CheckCircle2, Loader2,
  User as UserIcon, IdCard, CalendarClock, Stethoscope,
} from "lucide-react";

/**
 * Nurse-facing form to record per-visit vitals (BP, SpO2, HR, weight) on
 * a CHECKED_IN appointment, before the doctor takes over. Backed by the
 * /api/vitals/appointment/{id} upsert endpoint — one row per appointment,
 * re-takes UPDATE in place.
 *
 * Blood group is read-through from the patient record and shown for
 * reference; it isn't editable here because it lives on patient
 * registration and never changes per visit.
 *
 * Props:
 *   appointment — AppointmentDto from the dashboard. Must include id,
 *                 patientId, patientName, patientUhid, patientBloodGroup.
 *   onClose     — close handler.
 *   onSaved     — called with the VitalsDto after a successful upsert so
 *                 the dashboard can refresh its "has-vitals" badge.
 */
export default function VitalsModal({ appointment, onClose, onSaved }) {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [spo2, setSpo2] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);

  // Hydrate from any prior reading on this appointment so re-takes start
  // with the last values rather than a blank form.
  useEffect(() => {
    let cancelled = false;
    if (!appointment?.id) { setLoading(false); return; }
    vitalsApi.get(appointment.id)
      .then((v) => {
        if (cancelled || !v) return;
        setExisting(v);
        if (v.bpSystolic != null)  setBpSystolic(String(v.bpSystolic));
        if (v.bpDiastolic != null) setBpDiastolic(String(v.bpDiastolic));
        if (v.spo2 != null)        setSpo2(String(v.spo2));
        if (v.heartRate != null)   setHeartRate(String(v.heartRate));
        if (v.weightKg != null)    setWeightKg(String(v.weightKg));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appointment?.id]);

  const handleSave = async () => {
    if (!appointment?.id) {
      notify("Missing appointment — cannot save vitals", "error");
      return;
    }
    // Soft validation — server clamps too, but catching here gives the
    // nurse an immediate, intent-aware error instead of a generic 400.
    const sys = bpSystolic === "" ? null : Number(bpSystolic);
    const dia = bpDiastolic === "" ? null : Number(bpDiastolic);
    const sp = spo2 === "" ? null : Number(spo2);
    const hr = heartRate === "" ? null : Number(heartRate);
    const wt = weightKg === "" ? null : Number(weightKg);

    if (sys != null && (sys < 40 || sys > 300)) {
      notify("Systolic BP must be between 40 and 300 mmHg", "warning"); return;
    }
    if (dia != null && (dia < 20 || dia > 200)) {
      notify("Diastolic BP must be between 20 and 200 mmHg", "warning"); return;
    }
    if (sp != null && (sp < 0 || sp > 100)) {
      notify("SpO₂ must be between 0 and 100%", "warning"); return;
    }
    if (hr != null && (hr < 20 || hr > 300)) {
      notify("Heart rate must be between 20 and 300 bpm", "warning"); return;
    }
    if (wt != null && (wt <= 0 || wt > 999)) {
      notify("Weight must be between 0 and 999 kg", "warning"); return;
    }
    if (sys == null && dia == null && sp == null && hr == null && wt == null) {
      notify("Enter at least one vital sign before saving", "warning"); return;
    }

    setSaving(true);
    try {
      const saved = await vitalsApi.upsert(appointment.id, {
        bpSystolic: sys, bpDiastolic: dia, spo2: sp, heartRate: hr, weightKg: wt,
      });
      notify(existing ? "Vitals updated" : "Vitals recorded", "success");
      onSaved?.(saved);
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to save vitals", "error");
    } finally {
      setSaving(false);
    }
  };

  const patientFullName =
    appointment?.patientName ||
    [appointment?.patientFirstName, appointment?.patientLastName].filter(Boolean).join(" ");
  const uhidDisplay = fmtId(appointment?.patientUhid) || appointment?.patientUhid || "—";
  const apptTime = appointment?.apptTime ? appointment.apptTime.substring(0, 5) : "";
  const dateTimeText = [appointment?.apptDate, apptTime].filter(Boolean).join(" · ");
  const bloodGroup = appointment?.patientBloodGroup || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm pointer-events-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] border border-slate-200 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Record Vitals</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Triage before the doctor starts the consultation
                </p>
              </div>
            </div>
            {existing && (
              <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                RE-CHECK
              </span>
            )}
          </div>

          {/* Patient meta strip */}
          <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-100 bg-slate-50/60">
            <PreField icon={<UserIcon className="w-3.5 h-3.5" />} label="Patient" value={patientFullName || "—"} />
            <PreField icon={<IdCard className="w-3.5 h-3.5" />} label="UHID" value={uhidDisplay} mono />
            <PreField icon={<Droplet className="w-3.5 h-3.5" />} label="Blood group" value={bloodGroup} />
            <PreField icon={<CalendarClock className="w-3.5 h-3.5" />} label="Date & time" value={dateTimeText || "—"} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading vitals…
            </div>
          ) : (
            <div className="space-y-5">

              {/* BP — split into two paired inputs */}
              <VitalField
                icon={<HeartPulse className="w-3.5 h-3.5" />}
                label="Blood Pressure"
                hint="Systolic / Diastolic, mmHg"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="40" max="300" step="1" inputMode="numeric"
                    value={bpSystolic}
                    onChange={e => setBpSystolic(e.target.value)}
                    placeholder="120"
                    className="vital-input w-24 text-center"
                  />
                  <span className="text-slate-400 font-bold text-lg">/</span>
                  <input
                    type="number" min="20" max="200" step="1" inputMode="numeric"
                    value={bpDiastolic}
                    onChange={e => setBpDiastolic(e.target.value)}
                    placeholder="80"
                    className="vital-input w-24 text-center"
                  />
                  <span className="text-xs text-slate-500 ml-1">mmHg</span>
                </div>
              </VitalField>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <VitalField
                  icon={<Wind className="w-3.5 h-3.5" />}
                  label="SpO₂"
                  hint="Oxygen saturation"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="100" step="1" inputMode="numeric"
                      value={spo2}
                      onChange={e => setSpo2(e.target.value)}
                      placeholder="98"
                      className="vital-input w-24 text-center"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </VitalField>

                <VitalField
                  icon={<HeartPulse className="w-3.5 h-3.5" />}
                  label="Heart Rate"
                  hint="Pulse, bpm"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="20" max="300" step="1" inputMode="numeric"
                      value={heartRate}
                      onChange={e => setHeartRate(e.target.value)}
                      placeholder="72"
                      className="vital-input w-24 text-center"
                    />
                    <span className="text-xs text-slate-500">bpm</span>
                  </div>
                </VitalField>

                <VitalField
                  icon={<Scale className="w-3.5 h-3.5" />}
                  label="Weight"
                  hint="Body weight"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="999" step="0.1" inputMode="decimal"
                      value={weightKg}
                      onChange={e => setWeightKg(e.target.value)}
                      placeholder="68.5"
                      className="vital-input w-24 text-center"
                    />
                    <span className="text-xs text-slate-500">kg</span>
                  </div>
                </VitalField>
              </div>

              {existing && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 text-[11px] text-slate-500 flex items-center gap-2">
                  <Stethoscope className="w-3 h-3" />
                  Previously recorded by{" "}
                  <span className="font-semibold text-slate-700">
                    {existing.recordedByName || "—"}
                  </span>
                  {existing.updatedAt && (
                    <>
                      ·{" "}
                      <span className="font-mono">
                        {new Date(existing.updatedAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {existing ? "Update Vitals" : "Save Vitals"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreField({ icon, label, value, mono }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <p className={`mt-0.5 text-sm font-semibold text-slate-900 truncate ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function VitalField({ icon, label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
          <span className="text-slate-400">{icon}</span>
          {label}
        </h3>
        {hint && (
          <span className="text-[10px] text-slate-400 normal-case font-normal">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
