import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useDebounce } from "../../utils/hooks";
function SearchSelect({
  label,
  value,
  onChange,
  onSearch,
  renderItem,
  getDisplayValue,
  placeholder = "Search...",
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    onSearch(debouncedQuery).then((data) => {
      if (active) setResults(data);
    }).catch(() => {
      if (active) setResults([]);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [debouncedQuery, isOpen, onSearch]);
  const handleSelect = (item) => {
    onChange(item);
    setIsOpen(false);
    setQuery("");
  };
  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setQuery("");
  };
  return <div className="relative w-full max-w-sm" ref={containerRef}><label className="label">{label}</label><div
    className={`
                    relative flex items-center justify-between input cursor-text p-0 overflow-hidden
                    ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"}
                `}
    onClick={() => !disabled && setIsOpen(true)}
  >{!isOpen && value ? <div className="flex-1 truncate font-medium px-3 py-2 cursor-pointer">{getDisplayValue(value)}</div> : <input
    type="text"
    className="flex-1 bg-transparent outline-none border-none px-3 py-2 text-sm"
    placeholder={value ? getDisplayValue(value) : placeholder}
    value={query}
    onChange={(e) => {
      setQuery(e.target.value);
      if (!isOpen) setIsOpen(true);
    }}
    onFocus={() => setIsOpen(true)}
    disabled={disabled}
  />}<div className="flex items-center gap-2 shrink-0 px-3 text-slate-400">{loading && isOpen && <Loader2 className="w-4 h-4 animate-spin" />}{value && !disabled && <button onClick={handleClear} className="hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>}{!value && !loading && <Search className="w-4 h-4" />}</div></div>{isOpen && !disabled && <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border-2 border-slate-700 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] max-h-60 overflow-y-auto">{loading && results.length === 0 ? <div className="p-4 text-center text-sm text-slate-500">Searching...</div> : results.length === 0 ? <div className="p-4 text-center text-sm text-slate-500">No results found.</div> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{results.map((item, idx) => <li
    key={idx}
    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
    onClick={() => handleSelect(item)}
  >{renderItem(item)}</li>)}</ul>}</div>}</div>;
}
export {
  SearchSelect as default
};
