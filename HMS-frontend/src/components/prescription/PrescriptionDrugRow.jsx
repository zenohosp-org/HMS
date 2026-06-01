import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { drugsApi } from "@/utils/api";
import { Search, Loader2, Trash2, AlertCircle } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";

// Standard schedule shorthand used in Indian clinical practice. Surfaced as a
// dropdown so prescriptions are normalised across doctors and pharmacy doesn't
// have to interpret "twice a day" vs "BD" vs "2x daily".
export const FREQUENCIES = [
  { value: "OD",   label: "OD — Once daily" },
  { value: "BD",   label: "BD — Twice daily" },
  { value: "TDS",  label: "TDS — Thrice daily" },
  { value: "QID",  label: "QID — Four times daily" },
  { value: "Q4H",  label: "Q4H — Every 4 hours" },
  { value: "Q6H",  label: "Q6H — Every 6 hours" },
  { value: "Q8H",  label: "Q8H — Every 8 hours" },
  { value: "HS",   label: "HS — At bedtime" },
  { value: "AC",   label: "AC — Before meals" },
  { value: "PC",   label: "PC — After meals" },
  { value: "SOS",  label: "SOS — As needed" },
  { value: "STAT", label: "STAT — Immediately, once" },
];

// Doses per 24h for each frequency code. Drives auto-fill of the
// dispense quantity from frequency × duration. SOS is intentionally
// absent — as-needed dosing has no fixed daily count and shouldn't
// auto-derive a number that pharmacy treats as authoritative.
export const DOSES_PER_DAY = {
  OD: 1, BD: 2, TDS: 3, QID: 4,
  Q4H: 6, Q6H: 4, Q8H: 3,
  HS: 1, AC: 3, PC: 3,
  STAT: 1,
};

/**
 * Pull the leading numeric portion off the free-text dose field
 * ("1 tab" → 1, "2 caps" → 2, "5 ml" → 5). Defaults to 1 so an empty
 * dose still gives a sensible quantity for the common single-unit case.
 */
function parseDoseUnits(dose) {
  if (!dose) return 1;
  const m = String(dose).trim().match(/^(\d+(?:\.\d+)?)/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Suggested dispense quantity from dose × doses-per-day × days.
 * Returns null when any input is missing or the frequency has no
 * fixed daily count (SOS) — the field stays empty in that case.
 */
export function computeQuantity({ dose, frequency, durationDays }) {
  const perDay = DOSES_PER_DAY[frequency];
  if (!perDay) return null;
  const days = Number(durationDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  const units = parseDoseUnits(dose);
  const q = Math.ceil(units * perDay * days);
  return q > 0 ? q : null;
}

export const ROUTES = [
  { value: "ORAL",        label: "Oral" },
  { value: "IV",          label: "IV" },
  { value: "IM",          label: "IM" },
  { value: "SC",          label: "Subcutaneous" },
  { value: "TOPICAL",     label: "Topical" },
  { value: "INHALED",     label: "Inhaled" },
  { value: "OPHTHALMIC",  label: "Eye" },
  { value: "OTIC",        label: "Ear" },
  { value: "NASAL",       label: "Nasal" },
  { value: "RECTAL",      label: "Rectal" },
];

export function newBlankDrugItem() {
  return {
    key: Date.now() + Math.random(),
    drugId: null, drugName: "", drugGeneric: "", drugStrength: "", drugForm: "",
    dose: "", frequency: "BD", durationDays: "", quantity: "", route: "ORAL",
    instructions: "",
    // Tracks whether the doctor has manually typed in the quantity
    // field. While false, the row recomputes quantity from dose ×
    // frequency × duration on every input change.
    quantityTouched: false,
  };
}

/**
 * Map a drug-row UI item into the PrescriptionItemRequest shape the
 * backend expects. Returns undefined for empty rows so callers can filter
 * them out before submitting.
 */
export function drugItemToRequest(it, displayOrder) {
  if (!it.drugName?.trim()) return undefined;
  return {
    drugId: it.drugId || undefined,
    drugName: it.drugName.trim(),
    drugGeneric: it.drugGeneric || undefined,
    drugStrength: it.drugStrength || undefined,
    drugForm: it.drugForm || undefined,
    dose: it.dose || undefined,
    frequency: it.frequency || undefined,
    durationDays: it.durationDays ? Number(it.durationDays) : undefined,
    quantity: Number(it.quantity),
    route: it.route || undefined,
    instructions: it.instructions || undefined,
    displayOrder,
  };
}

/**
 * Single drug line — typeahead drug search + per-drug fields.
 * Selecting a drug from the search fills brand/generic/strength/form from
 * the master so the doctor doesn't retype; they can still override (e.g.
 * for an off-label strength).
 */
export function PrescriptionDrugRow({ index, item, onChange, onRemove, isLastRemovable }) {
  const { user } = useAuth();
  const [query, setQuery] = useState(item.drugName);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const blurTimer = useRef(null);

  useEffect(() => { setQuery(item.drugName); }, [item.drugName]);

  // Auto-fill quantity from dose × frequency × duration. Stops the
  // moment the doctor types a number into the quantity box (signalled
  // by quantityTouched). Clearing the box brings auto-fill back so a
  // mis-typed override can be undone without retyping the formula.
  useEffect(() => {
    if (item.quantityTouched) return;
    const computed = computeQuantity({
      dose: item.dose,
      frequency: item.frequency,
      durationDays: item.durationDays,
    });
    const next = computed != null ? String(computed) : "";
    if (next !== (item.quantity ?? "")) {
      onChange("quantity", next);
    }
    // onChange is a fresh closure each render; including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.dose, item.frequency, item.durationDays, item.quantityTouched]);

  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await drugsApi.search(user?.hospitalId, q.trim());
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [user?.hospitalId]);

  const onQueryChange = (val) => {
    setQuery(val);
    onChange("drugName", val);
    onChange("drugId", null);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 200);
  };

  const pickDrug = (d) => {
    onChange("drugId", d.id);
    onChange("drugName", d.brandName || d.genericName || "");
    onChange("drugGeneric", d.genericName || "");
    onChange("drugStrength", d.strength || "");
    onChange("drugForm", d.form || "");
    setQuery(d.brandName || d.genericName || "");
    setOpen(false);
  };

  return (
    <div className="hms-drug-row">
      <div className="hms-drug-row__inner">
        <div className="hms-drug-row__num">{index + 1}</div>

        <div className="hms-drug-row__fields">
          {/* Drug typeahead */}
          <div className="hms-drug-row__search">
            <div className="hms-drug-row__search-wrap">
              <Search className="hms-drug-row__search-icon w-3 h-3" />
              <input
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                onFocus={() => { clearTimeout(blurTimer.current); setOpen(true); if (results.length === 0 && query) doSearch(query); }}
                onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
                placeholder="Drug name (e.g. Amoxicillin, Crocin)"
                className="hms-drug-row__search-input"
              />
              {searching && <Loader2 className="hms-drug-row__search-spinner w-3 h-3" />}
            </div>

            {open && results.length > 0 && (
              <div className="hms-drug-row__results">
                {results.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onMouseDown={() => pickDrug(d)}
                    className="hms-drug-row__result-item"
                  >
                    <div className="hms-drug-row__result-head">
                      <div>
                        <p className="hms-drug-row__result-name">{d.brandName}</p>
                        <p className="hms-drug-row__result-sub">
                          {[d.genericName, d.strength, d.form].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="hms-drug-row__result-badges">
                        {d.schedule && (
                          <span className="hms-drug-row__schedule-badge">SCH-{d.schedule}</span>
                        )}
                        <span className={`hms-drug-row__stock-badge ${d.inStock ? "is-stocked" : "is-out"}`}>
                          {d.inStock ? "In stock" : "Not stocked"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {item.drugId && (
            <p className="hms-drug-row__linked">
              {[item.drugGeneric, item.drugStrength, item.drugForm].filter(Boolean).join(" · ") || "Linked to master"}
            </p>
          )}
          {!item.drugId && query.trim().length >= 2 && (
            <p className="hms-drug-row__warn">
              <AlertCircle className="w-3 h-3" />
              Not linked to drug master — pharmacy will see free-text only
            </p>
          )}

          <div className="hms-drug-row__grid">
            <div>
              <label className="hms-drug-row__col-label">Dose</label>
              <input
                value={item.dose}
                onChange={e => onChange("dose", e.target.value)}
                placeholder="1 tab / 5ml"
                className="hms-drug-row__field"
              />
            </div>
            <div>
              <label className="hms-drug-row__col-label">Frequency</label>
              <SearchableSelect
                value={item.frequency}
                onChange={(v) => onChange("frequency", v)}
                options={FREQUENCIES}
              />
            </div>
            <div>
              <label className="hms-drug-row__col-label">Duration (days)</label>
              <input
                type="number" min="0"
                value={item.durationDays}
                onChange={e => onChange("durationDays", e.target.value)}
                placeholder="5"
                className="hms-drug-row__field"
              />
            </div>
            <div>
              <label className="hms-drug-row__col-label">
                Quantity *
                {!item.quantityTouched && item.quantity && (
                  <span className="hms-drug-row__auto-badge">· auto</span>
                )}
              </label>
              <input
                type="number" min="1"
                value={item.quantity}
                onChange={e => {
                  const v = e.target.value;
                  onChange("quantity", v);
                  onChange("quantityTouched", v !== "");
                }}
                placeholder="15"
                required
                className="hms-drug-row__field"
              />
            </div>
            <div>
              <label className="hms-drug-row__col-label">Route</label>
              <SearchableSelect
                value={item.route}
                onChange={(v) => onChange("route", v)}
                options={ROUTES}
              />
            </div>
          </div>

          <input
            value={item.instructions}
            onChange={e => onChange("instructions", e.target.value)}
            placeholder="After meals · With milk · Taper over 5 days"
            className="hms-drug-row__instructions"
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!isLastRemovable}
          title={isLastRemovable ? "Remove drug" : "At least one drug is required"}
          className="hms-drug-row__remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
