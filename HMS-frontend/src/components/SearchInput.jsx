import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

const MAX = 5;

export default function SearchInput({ value, onChange, placeholder = "Search…", suggestions = [], className = "" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = value.trim()
    ? suggestions
        .filter((s) => {
          const q = value.toLowerCase();
          return s.label.toLowerCase().includes(q) || s.sub?.toLowerCase().includes(q);
        })
        .slice(0, MAX)
    : [];

  const handleSelect = (label) => {
    onChange(label);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => value.trim() && setOpen(true)}
        placeholder={placeholder}
        className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] shadow-xl overflow-hidden">
          <ul>
            {filtered.map((s, i) => (
              <li
                key={i}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s.label); }}
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-[#cccccc] truncate">{s.label}</span>
                {s.sub && <span className="text-xs text-slate-400 dark:text-[#555] ml-3 shrink-0">{s.sub}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
