import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";

/**
 * Generic searchable dropdown — replaces every <select> in the app.
 *
 * Props:
 *   options   — [{ value, label }]
 *   value     — currently selected value (string/number)
 *   onChange  — (value) => void   ← receives the raw value, NOT an event
 *   placeholder — trigger text when nothing is selected
 *   disabled / loading — passed through
 *   className — applied to the trigger button (defaults to "input")
 *
 * Behaviour:
 *   • Shows first 5 options before any typing.
 *   • Filters the full list as the user types.
 *   • Closes + resets query on outside click or after selection.
 *   • X clears the current value (calls onChange("")).
 */
export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select…",
  disabled = false,
  loading = false,
  className = "input",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const lower = query.toLowerCase();
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(lower))
    : options;

  const selected = options.find((o) => String(o.value) === String(value));

  const pick = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        className={`${className} flex items-center justify-between text-left w-full`}
      >
        <span className={selected ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-[#555555]"}>
          {loading ? "Loading…" : (selected?.label ?? placeholder)}
        </span>
        <span className="flex items-center gap-1 shrink-0 ml-2">
          {value && !disabled && (
            <X
              className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              onClick={clear}
            />
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full text-sm bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400 text-center">No results</li>
            )}
            {filtered.map((opt) => (
              <li
                key={opt.value}
                onClick={() => pick(opt)}
                className={`px-4 py-2.5 text-sm cursor-pointer select-none transition-colors hover:bg-slate-50 dark:hover:bg-[#1a1a1a] ${
                  String(value) === String(opt.value)
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium"
                    : "text-slate-800 dark:text-[#cccccc]"
                }`}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
