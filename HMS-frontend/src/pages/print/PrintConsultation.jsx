import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  appointmentsApi, recordApi, radiologyApi, externalResultsApi,
} from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { fmtId } from "@/utils/idFormat";

/**
 * Three-page printable summary of a single appointment, opened in a
 * new tab by the dashboard's "Print Consultation" action. Each page
 * starts on a fresh sheet via the .print-page CSS utility:
 *
 *   Page 1 — Consultation     chief complaint, doctor's notes,
 *                             instructions, follow-up
 *   Page 2 — Prescription     drug table; sections suppressed when
 *                             no items
 *   Page 3 — Lab Results      external entries the hospital captured
 *                             plus internal radiology orders the
 *                             hospital raised; suppressed when none
 *
 * The page auto-fires window.print() once data has settled. The user
 * closes the tab after printing — no in-app "back" affordance because
 * this is a print sheet, not navigation.
 *
 * Failures are non-blocking: each fetch returns null/[] silently on
 * error so a missing radiology endpoint never wipes the consult page.
 */
export default function PrintConsultation() {
  const { appointmentId } = useParams();
  const { user } = useAuth();

  const [appointment, setAppointment] = useState(null);
  const [record, setRecord] = useState(null);
  const [radiology, setRadiology] = useState([]);
  const [externalResults, setExternalResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!appointmentId || !user?.hospitalId) return;

    (async () => {
      setLoading(true);
      const [appt, recs, rads, exts] = await Promise.all([
        appointmentsApi.getById(appointmentId).catch(() => null),
        recordApi.getByAppointment(appointmentId, user.hospitalId).catch(() => []),
        // Radiology fetch needs the patient id; we do it after we have
        // the appointment in a follow-up, but the Promise.all already
        // resolves what it can in parallel.
        Promise.resolve([]),
        Promise.resolve([]),
      ]);
      if (cancelled) return;
      setAppointment(appt);
      // Records list is newest-first; the print sheet shows the most
      // recent one as canonical (typically the one created by Mark
      // Complete; older entries are amendments).
      setRecord(Array.isArray(recs) && recs.length > 0 ? recs[0] : null);

      // Now fan out the patient-scoped fetches (radiology + external),
      // both of which need appt.patientId.
      const patientId = appt?.patientId;
      if (patientId) {
        const [r, e] = await Promise.all([
          radiologyApi.getByPatient(patientId).catch(() => []),
          externalResultsApi.listForPatient(patientId, user.hospitalId, { size: 100 }).catch(() => null),
        ]);
        if (cancelled) return;
        setRadiology(Array.isArray(r) ? r : []);
        const erRows = Array.isArray(e?.content) ? e.content : (Array.isArray(e) ? e : []);
        setExternalResults(erRows);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [appointmentId, user?.hospitalId]);

  // Trigger the system print dialog once content is on-screen. The
  // tiny delay lets the browser finish layout so QR codes / tables
  // aren't half-rendered when print fires.
  useEffect(() => {
    if (loading) return;
    if (!appointment) return;
    const t = setTimeout(() => {
      try { window.print(); } catch { /* user cancelled */ }
    }, 400);
    return () => clearTimeout(t);
  }, [loading, appointment]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading print preview…
      </div>
    );
  }
  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-rose-600">
        Could not load this appointment.
      </div>
    );
  }

  const { chiefComplaint, notes } = splitDescription(record?.description);
  const rxItems = Array.isArray(record?.prescriptionItems) ? record.prescriptionItems : [];
  const externalsByCategory = groupBy(externalResults, (e) => e.category || "OTHER");

  return (
    <div className="bg-white text-slate-900 print:text-black">
      {/* PAGE 1 — Consultation */}
      <article className="print-page max-w-3xl mx-auto px-10 py-10 text-[12.5px] leading-relaxed">
        <Letterhead hospital={user?.hospitalName} branchName={null} />
        <SheetTitle title="Consultation Summary" subtitle="Page 1 of 3" />
        <PatientHeader appointment={appointment} record={record} />

        <PrintSection title="Chief Complaint">
          <p>{chiefComplaint || dash}</p>
        </PrintSection>

        <PrintSection title="Doctor's Notes">
          <p className="whitespace-pre-wrap">{notes || dash}</p>
        </PrintSection>

        {record?.instructions && (
          <PrintSection title="Instructions for Patient">
            <p className="whitespace-pre-wrap">{record.instructions}</p>
          </PrintSection>
        )}

        {record?.nextVisitDate && (
          <PrintSection title="Follow-up Visit">
            <p>
              {new Date(record.nextVisitDate).toLocaleString("en-IN", {
                day: "2-digit", month: "long", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </PrintSection>
        )}

        <SignatureFooter doctorName={appointment.doctorName} />
      </article>

      {/* PAGE 2 — Prescription */}
      <article className="print-page max-w-3xl mx-auto px-10 py-10 text-[12.5px] leading-relaxed">
        <Letterhead hospital={user?.hospitalName} branchName={null} />
        <SheetTitle title="Prescription" subtitle="Page 2 of 3" />
        <PatientHeader appointment={appointment} record={record} compact />

        {rxItems.length === 0 ? (
          <p className="mt-8 italic text-slate-500">No drugs prescribed in this visit.</p>
        ) : (
          <table className="w-full mt-6 border-collapse text-[12px]">
            <thead>
              <tr className="border-b-2 border-slate-800">
                <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider text-[10px]">#</th>
                <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider text-[10px]">Drug</th>
                <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider text-[10px]">Dose</th>
                <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider text-[10px]">Frequency</th>
                <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider text-[10px]">Days</th>
                <th className="text-right py-2 pr-3 font-bold uppercase tracking-wider text-[10px]">Qty</th>
                <th className="text-left py-2 font-bold uppercase tracking-wider text-[10px]">Route</th>
              </tr>
            </thead>
            <tbody>
              {rxItems.map((d, i) => (
                <tr key={d.id} className="border-b border-slate-200 print-page-break-inside-avoid align-top">
                  <td className="py-2.5 pr-3 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold">{d.drugName || dash}</div>
                    {(d.drugStrength || d.drugForm) && (
                      <div className="text-[10.5px] text-slate-500">
                        {[d.drugStrength, d.drugForm].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {d.instructions && (
                      <div className="text-[10.5px] italic text-slate-600 mt-0.5">{d.instructions}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">{d.dose || dash}</td>
                  <td className="py-2.5 pr-3">{d.frequency || dash}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{d.durationDays != null ? `${d.durationDays}` : dash}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-semibold">{d.quantity ?? dash}</td>
                  <td className="py-2.5">{d.route || dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <SignatureFooter doctorName={appointment.doctorName} />
      </article>

      {/* PAGE 3 — Lab Reports */}
      <article className="print-page max-w-3xl mx-auto px-10 py-10 text-[12.5px] leading-relaxed">
        <Letterhead hospital={user?.hospitalName} branchName={null} />
        <SheetTitle title="Lab Reports" subtitle="Page 3 of 3" />
        <PatientHeader appointment={appointment} record={record} compact />

        {externalResults.length === 0 && radiology.length === 0 ? (
          <p className="mt-8 italic text-slate-500">
            No lab reports on file for this patient yet.
          </p>
        ) : (
          <div className="space-y-6 mt-6">
            {Object.entries(externalsByCategory).map(([cat, rows]) => (
              <div key={cat} className="print-page-break-inside-avoid">
                <h3 className="text-[11px] font-bold uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
                  {cat} · External
                </h3>
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li key={r.id} className="text-[12px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">{r.testName}</span>
                        <span className="text-[10.5px] text-slate-500 tabular-nums">
                          {r.testDate || ""}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-600">
                        {r.sourceName}
                        {r.sourceDoctorName && <span> · {r.sourceDoctorName}</span>}
                      </div>
                      {(r.resultValue || r.resultUnit) && (
                        <div className="mt-0.5">
                          <span className="font-semibold tabular-nums">{r.resultValue || dash}</span>
                          {r.resultUnit && <span className="ml-1 text-slate-600">{r.resultUnit}</span>}
                          {r.referenceRange && (
                            <span className="ml-3 text-[10.5px] text-slate-500">
                              ref: {r.referenceRange}
                            </span>
                          )}
                          {r.isAbnormal && (
                            <span className="ml-2 text-[10.5px] font-bold text-amber-700">⚠ Abnormal</span>
                          )}
                        </div>
                      )}
                      {r.notes && <div className="text-[11px] mt-0.5">{r.notes}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {radiology.length > 0 && (
              <div className="print-page-break-inside-avoid">
                <h3 className="text-[11px] font-bold uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
                  Internal Radiology
                </h3>
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="text-left py-1.5 pr-3 font-bold text-[10px] uppercase tracking-wider">Investigation</th>
                      <th className="text-left py-1.5 pr-3 font-bold text-[10px] uppercase tracking-wider">Status</th>
                      <th className="text-left py-1.5 font-bold text-[10px] uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {radiology.map((o) => (
                      <tr key={o.id} className="border-b border-slate-200">
                        <td className="py-1.5 pr-3">
                          {o.serviceName || o.investigationName || dash}
                          {o.modality && <span className="text-[10.5px] text-slate-500 ml-1">({o.modality})</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-[11px]">{(o.status || dash).toString().replace(/_/g, " ")}</td>
                        <td className="py-1.5 text-[11px]">
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : dash}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <PrintFooter />
      </article>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

const dash = "—";

function splitDescription(description) {
  if (!description) return { chiefComplaint: "", notes: "" };
  const text = description.replace(/\r\n/g, "\n");
  const ccMatch = /^Chief complaint:\s*([^\n]+)\n\n?/i.exec(text);
  if (ccMatch) {
    return {
      chiefComplaint: ccMatch[1].trim(),
      notes: text.slice(ccMatch[0].length).trim(),
    };
  }
  return { chiefComplaint: "", notes: text.trim() };
}

function groupBy(arr, keyFn) {
  return (arr || []).reduce((acc, item) => {
    const k = keyFn(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function Letterhead({ hospital, branchName }) {
  return (
    <header className="border-b-2 border-slate-900 pb-3 mb-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{hospital || "Hospital Name"}</h1>
          {branchName && <p className="text-[11px] text-slate-600">{branchName}</p>}
        </div>
        <p className="text-[10px] text-slate-500 tabular-nums">
          Printed {new Date().toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>
    </header>
  );
}

function SheetTitle({ title, subtitle }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <span className="text-[10px] text-slate-500 tabular-nums">{subtitle}</span>
    </div>
  );
}

function PatientHeader({ appointment, record, compact }) {
  const uhid = fmtId(appointment.patientUhid) || appointment.patientUhid || dash;
  const time = appointment.apptTime ? appointment.apptTime.substring(0, 5) : "";
  const date = appointment.apptDate;
  return (
    <section className={`border border-slate-300 rounded-md ${compact ? "py-2 px-3" : "py-3 px-4"} mb-5 text-[11.5px]`}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Patient" value={appointment.patientName || dash} />
        <Field label="UHID" value={uhid} mono />
        <Field label="Age / Sex" value={[ageFrom(appointment.patientDob), appointment.patientGender].filter(Boolean).join(" / ") || dash} />
        <Field label="Doctor" value={appointment.doctorName ? `Dr. ${appointment.doctorName}` : dash} />
        <Field label="Visit" value={[date, time].filter(Boolean).join(" · ") || dash} />
        <Field label="MRN" value={fmtId(record?.mrn) || record?.mrn || dash} mono />
      </div>
    </section>
  );
}

function Field({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-semibold ${mono ? "font-mono tabular-nums" : ""}`}>{value}</div>
    </div>
  );
}

function PrintSection({ title, children }) {
  return (
    <section className="mb-5 print-page-break-inside-avoid">
      <h3 className="text-[10.5px] font-bold uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function SignatureFooter({ doctorName }) {
  return (
    <footer className="mt-12 flex items-end justify-end">
      <div className="text-right">
        <div className="border-t border-slate-700 w-56 mb-1" />
        <p className="text-[11px] font-semibold">{doctorName ? `Dr. ${doctorName}` : "Doctor"}</p>
        <p className="text-[9.5px] text-slate-500">Signature</p>
      </div>
    </footer>
  );
}

function PrintFooter() {
  return (
    <footer className="mt-10 pt-3 border-t border-slate-200 text-[9.5px] text-slate-500 text-center">
      Lab reports printed here are a hospital-side record. Original lab/clinic reports remain authoritative.
    </footer>
  );
}

function ageFrom(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 150 ? `${age} yr` : null;
}
