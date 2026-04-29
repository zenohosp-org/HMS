import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import api from "@/utils/api";
function StateSelect({ value, onChange, inputClassName, labelClassName, required }) {
  const [states, setStates] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  useEffect(() => {
    api.get("/states").then((res) => setStates(res.data)).catch(() => {
    });
  }, []);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const filtered = query ? states.filter(
    (s) => s.stateName.toLowerCase().includes(query.toLowerCase()) || s.stateCode.toLowerCase().includes(query.toLowerCase())
  ) : states;
  const handleSelect = (stateName) => {
    onChange(stateName);
    setOpen(false);
    setQuery("");
  };
  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };
  return <div ref={containerRef} className="relative"><label className={labelClassName}>State {required && "*"}</label><button
    type="button"
    onClick={() => setOpen((o) => !o)}
    className={`${inputClassName} flex items-center justify-between text-left`}
  ><span className={value ? "" : "text-slate-600 dark:text-[#555555]"}>{value || "Select state"}</span><span className="flex items-center gap-1 shrink-0 ml-2">{value && <X
    className="w-3.5 h-3.5 text-slate-600 hover:text-slate-600 dark:hover:text-white"
    onClick={handleClear}
  />}<ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} /></span></button>{open && <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111111] shadow-lg overflow-hidden"><div className="p-2 border-b border-slate-100 dark:border-[#222222] flex items-center gap-2"><Search className="w-4 h-4 text-slate-600 shrink-0" /><input
    autoFocus
    type="text"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Search state..."
    className="w-full text-sm bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-600"
  /></div><ul className="max-h-52 overflow-y-auto">{filtered.length === 0 && <li className="px-4 py-3 text-sm text-slate-600 text-center">No states found</li>}{filtered.map((s) => <li
    key={s.id}
    onClick={() => handleSelect(s.stateName)}
    className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between
                                    hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors
                                    ${value === s.stateName ? "bg-violet-50 dark:bg-[#1a1a1a] text-violet-600 dark:text-violet-400 font-medium" : "text-slate-800 dark:text-[#cccccc]"}`}
  ><span>{s.stateName}</span><span className="text-xs text-slate-600 dark:text-[#555555]">{s.stateCode}</span></li>)}</ul></div>}</div>;
}
export {
  StateSelect as default
};
