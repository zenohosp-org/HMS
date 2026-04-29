import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function SidePane({ isOpen, onClose, title, children, footer }) {
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setRendered(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`relative flex flex-col h-full w-[520px] max-w-[95vw] bg-white dark:bg-[#111111] border-l border-slate-200 dark:border-[#222222] shadow-2xl transition-transform duration-300 ease-in-out ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#1a1a1a] shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-[#1a1a1a] bg-slate-50/50 dark:bg-[#0a0a0a]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
