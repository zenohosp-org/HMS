import { ChevronLeft, ChevronRight } from "lucide-react";
function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("\u2026");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("\u2026");
    pages.push(totalPages);
  }
  return <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100"><p className="text-xs text-slate-600">
                Showing <span className="font-semibold text-slate-600">{from}–{to}</span> of <span className="font-semibold text-slate-600">{totalItems}</span></p><div className="flex items-center gap-1"><button
    onClick={() => onPageChange(currentPage - 1)}
    disabled={currentPage === 1}
    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
  ><ChevronLeft className="w-3.5 h-3.5" /></button>{pages.map(
    (p, i) => p === "\u2026" ? <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-600">…</span> : <button
      key={p}
      onClick={() => onPageChange(p)}
      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors
                                ${currentPage === p ? "bg-slate-900 text-white border border-transparent" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
    >{p}</button>
  )}<button
    onClick={() => onPageChange(currentPage + 1)}
    disabled={currentPage === totalPages}
    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
  ><ChevronRight className="w-3.5 h-3.5" /></button></div></div>;
}
export {
  Pagination as default
};
